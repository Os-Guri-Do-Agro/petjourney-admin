/**
 * As telas em que a demora atrapalha escutam o canal de tempo real por aqui (PJ-3SO0WX): a oferta
 * da fila de espera e o checklist da internação e o do plantão. O aviso só diz "o recurso X mudou";
 * a tela refaz o GET de sempre. O polling não sai: vira reserva (`useReleituraDeReserva`).
 *
 * - **Um canal por aba**, aberto com o parceiro em uso, enquanto alguma tela escuta. Sair da última
 *   tela, sair da conta ou o parceiro sumir fecha; trocar de parceiro fecha e abre o do novo.
 * - **Rajada vira uma releitura:** os avisos que chegam a uma tela em 500 ms (o cron que vence
 *   ofertas manda vários de uma vez) dão uma só chamada a `aoMudar`. O `canal.pronto` (que cobre o
 *   que mudou com o canal fechado) e o `canal.releia` entram na mesma conta.
 * - **Quem não recebe não escuta:** a API só entrega o aviso da equipe a quem tem a permissão do GET
 *   (`fila.gerir`, `internacao.executar`). Sem ela (`ativo` falso), a tela não abre canal e fica no
 *   polling de sempre.
 * - **Tipo desconhecido** não chama ninguém: cada tela ouve os tipos dela.
 *
 * Guia do front do card: seções 2 a 4.
 */
import {
  computed,
  effectScope,
  getCurrentScope,
  onScopeDispose,
  ref,
  shallowReactive,
  watch,
  type ComputedRef,
  type EffectScope,
  type Ref,
} from 'vue'

import { authSessionVersion, getAccessToken } from '@/service/auth/auth-session'
import {
  CanalDoTempoReal,
  type AvisoDoTempoReal,
  type TipoDeAvisoDoTempoReal,
} from '@/service/tempo-real/canal-do-tempo-real'
import { enderecoDoCanal, pedirTicketDoTempoReal } from '@/service/tempo-real/tempo-real-service'
import { useParceiroStore } from '@/stores/parceiro'

/** Avisos que chegam a uma tela dentro desta janela viram uma releitura só. */
export const JUNCAO_DA_RAJADA_MS = 500

export type OpcoesDoTempoReal = {
  tipos: readonly TipoDeAvisoDoTempoReal[]
  /** Só os avisos que esta tela mostra (ex.: a internação aberta). Sem filtro, todos os dos tipos. */
  filtro?: (aviso: AvisoDoTempoReal) => boolean
  /** A pessoa recebe esses avisos (tem a permissão que a API exige). Padrão: sim. */
  ativo?: () => boolean
  /** Refaz o GET de sempre. */
  aoMudar: () => void
}

type Interessado = {
  tipos: ReadonlySet<string>
  filtro?: (aviso: AvisoDoTempoReal) => boolean
  aoMudar: () => void
  juncao: ReturnType<typeof setTimeout> | null
}

const interessados = shallowReactive(new Set<Interessado>())
const canalAoVivo = ref(false)
let canal: CanalDoTempoReal | null = null
let vigilancia: EffectScope | null = null
let loja: ReturnType<typeof useParceiroStore> | null = null

function juntar(interessado: Interessado) {
  if (interessado.juncao) return

  interessado.juncao = setTimeout(() => {
    interessado.juncao = null
    if (interessados.has(interessado)) interessado.aoMudar()
  }, JUNCAO_DA_RAJADA_MS)
}

function obterCanal() {
  canal ??= new CanalDoTempoReal(
    {
      pedirTicket: pedirTicketDoTempoReal,
      abrirFonte: (ticket) => new EventSource(enderecoDoCanal(ticket)),
      temSessao: () => Boolean(getAccessToken()),
    },
    {
      aoAvisar(aviso) {
        for (const interessado of interessados) {
          if (!interessado.tipos.has(aviso.tipo)) continue
          if (interessado.filtro && !interessado.filtro(aviso)) continue
          juntar(interessado)
        }
      },
      aoReler() {
        for (const interessado of interessados) juntar(interessado)
      },
      aoMudarAoVivo(aoVivo) {
        canalAoVivo.value = aoVivo
      },
      /* O membro saiu da equipe: o contexto relido cai no "acesso encerrado" da moldura. */
      aoPerderAcesso() {
        void loja?.bootstrap(true).catch(() => {})
      },
    },
  )

  return canal
}

/** Liga e desliga o canal pelo que vale agora: alguém escutando, o parceiro em uso e o login. */
function vigiar() {
  if (vigilancia) return

  loja = useParceiroStore()
  const parceiro = loja
  vigilancia = effectScope(true)
  vigilancia.run(() => {
    watch(
      [() => interessados.size > 0, () => parceiro.parceiroId, authSessionVersion],
      ([comQuemEscute, parceiroId]) => {
        const atual = obterCanal()

        if (!getAccessToken()) {
          atual.encerrarSessao()
          return
        }

        if (comQuemEscute && parceiroId) atual.ligar(parceiroId)
        else atual.desligar()
      },
      { immediate: true },
    )
  })
}

/**
 * Escuta os avisos de `tipos` enquanto o escopo (a tela) existir. `aoVivo` diz se o canal está
 * entregando os avisos desta tela agora: é o que escolhe o intervalo do polling de reserva.
 */
export function useTempoReal(opcoes: OpcoesDoTempoReal): { aoVivo: ComputedRef<boolean> } {
  const escutando = ref(false)
  const aoVivo = computed(() => escutando.value && canalAoVivo.value)

  if (!getCurrentScope() || typeof window === 'undefined' || !('EventSource' in window)) {
    return { aoVivo }
  }

  const interessado: Interessado = {
    tipos: new Set(opcoes.tipos),
    filtro: opcoes.filtro,
    aoMudar: opcoes.aoMudar,
    juncao: null,
  }

  function sair() {
    interessados.delete(interessado)
    if (interessado.juncao) {
      clearTimeout(interessado.juncao)
      interessado.juncao = null
    }
  }

  vigiar()

  watch(
    () => opcoes.ativo?.() ?? true,
    (ativo) => {
      escutando.value = ativo
      if (ativo) interessados.add(interessado)
      else sair()
    },
    { immediate: true },
  )

  onScopeDispose(sair)

  return { aoVivo }
}

/**
 * O polling de reserva (seção 4 do guia): com o canal entregando os avisos da tela, o intervalo
 * longo; com ele fora (erro, 503, 404, `SUBSTITUIDA`, sem a permissão), o de sempre. Relê só com a
 * aba à vista, como os relógios que ele substitui.
 */
export function useReleituraDeReserva(
  reler: () => void,
  aoVivo: Readonly<Ref<boolean>>,
  intervalos: { aoVivoMs: number; foraMs: number },
) {
  if (!getCurrentScope()) return

  let relogio: ReturnType<typeof setTimeout> | null = null
  let parado = false

  function agendar() {
    if (relogio) clearTimeout(relogio)
    if (parado) return
    relogio = setTimeout(
      () => {
        relogio = null
        if (document.visibilityState === 'visible') reler()
        agendar()
      },
      aoVivo.value ? intervalos.aoVivoMs : intervalos.foraMs,
    )
  }

  agendar()
  watch(aoVivo, agendar)

  onScopeDispose(() => {
    parado = true
    if (relogio) clearTimeout(relogio)
    relogio = null
  })
}

/* A recarga do Vite troca o módulo: o canal velho não pode ficar aberto ao lado do novo. */
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    canal?.desligar()
    vigilancia?.stop()
  })
}
