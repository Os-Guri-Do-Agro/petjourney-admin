/**
 * Quanto trabalho está parado no hotel, e o que o dia traz.
 *
 * Irmão de `useClinicoPendencias`, com a mesma regra e as mesmas razões: singleton de módulo porque
 * quem consome é o shell (menu) e a visão geral, e nada importado no topo porque o menu existe
 * para toda conta — um `import` estático de `../data/repositories` arrastaria o dataset inteiro
 * de demonstração do hotel para o primeiro carregamento de quem nunca abriu o módulo.
 *
 * ## O que entra como pendência
 *
 * Só o que **alguém precisa fazer**, nunca o que meramente existe:
 *
 * - **Rotina atrasada** — tarefa do turno que passou da janela sem registro. Uma medicação
 *   atrasada é risco; refeição, passeio ou água atrasados são atenção. A régua é a mesma da
 *   prancheta (`situacaoDaTarefa`), para o número da home bater com a lista do turno.
 * - **Véspera travada** — reserva que chega em até três dias e ainda não pode entrar (exigência
 *   vencida ou ausente, não dispensada). O mesmo recorte da faixa de véspera em Reservas: três
 *   dias é o prazo em que ainda dá para pedir o papel.
 *
 * ## O que entra como contexto, e por que não é pendência
 *
 * Chegadas e saídas de hoje. "4 chegadas" não é trabalho parado — é o dia. Mas é a primeira coisa
 * que a recepção procura ao abrir o sistema, então a visão geral mostra os dois números como
 * **linha de contexto**, sem tom e sem selo no menu. Um contador que soma rotina ensina a ignorar
 * contador.
 */

import { computed, ref, watch } from 'vue'

import {
  consultar,
  criarReconferencia,
  situacaoPelasFontes,
  type SituacaoDaConferencia,
} from '@/composables/conferencia'
import {
  partesQueExistem,
  type ContagemDePendencia,
} from '@/features/clinico/composables/useClinicoPendencias'

/**
 * O dia do hotel. `null` é "não se sabe": a fonte nunca respondeu. Diferente de zero, que é "não
 * há chegada hoje" — e a tela só pode afirmar o segundo quando a lista de reservas carregou.
 */
export type HojeNoHotel = {
  chegadas: number | null
  saidas: number | null
}

const VAZIO: ContagemDePendencia = { total: 0, tom: 'neutro' }
const HOJE_VAZIO: HojeNoHotel = { chegadas: null, saidas: null }

/** Prazo da faixa de véspera, o mesmo de `/hotel/reservas`. */
export const DIAS_DE_VESPERA = 3

const rotina = ref<ContagemDePendencia>(VAZIO)
const vespera = ref<ContagemDePendencia>(VAZIO)
const hoje = ref<HojeNoHotel>(HOJE_VAZIO)

const carregando = ref(false)
const carregado = ref(false)
/**
 * Quando a última conferência que **deu certo** terminou — a visão geral diz "conferido às 8h12".
 * Uma conferência que falhou inteira não mexe aqui.
 */
const conferidoEm = ref<Date | null>(null)
/** Como foi a última conferência. `null` enquanto nenhuma terminou. */
const situacao = ref<SituacaoDaConferencia | null>(null)

let emVoo: Promise<void> | null = null

/**
 * A apuração, isolada do estado para poder ser testada contra o dataset.
 *
 * Cada fonte falha sozinha, e o que dependia dela volta `null` — **não zero**. Uma reserva que não
 * carrega não apaga a rotina atrasada, e também não vira "nenhuma chegada travada".
 */
export async function apurarPendenciasDoHotel() {
  const [
    { hospedagemRepository, reservaRepository, situacaoDaTarefa, tomDaRotinaAtrasada },
    { agoraIso },
  ] =
    await Promise.all([import('../data/repositories'), import('../data/store')])

  const [prancheta, reservas, hospedes] = await Promise.all([
    consultar(() => hospedagemRepository.rotina()),
    consultar(() => reservaRepository.listar()),
    consultar(() => hospedagemRepository.listar()),
  ])

  let rotinaApurada: ContagemDePendencia | null = null

  if (prancheta.ok) {
    const agora = agoraIso()
    const atrasadas = prancheta.valor.filter(
      (linha) => situacaoDaTarefa(linha.tarefa, agora) === 'atrasada',
    )
    const medicacoes = atrasadas.filter((linha) => linha.tarefa.kind === 'medicacao').length

    rotinaApurada = {
      total: atrasadas.length,
      tom: tomDaRotinaAtrasada(atrasadas.length, medicacoes),
      /* A medicação é o que torna a rotina urgente — é ela que a linha precisa nomear. */
      partes: partesQueExistem([{ chave: 'medicacoesAtrasadas', total: medicacoes }]),
    }
  }

  let vesperaApurada: ContagemDePendencia | null = null
  let chegadas: number | null = null

  if (reservas.ok) {
    const travadas = reservas.valor.filter(
      (linha) =>
        linha.diasAteEntrada >= 0 &&
        linha.diasAteEntrada <= DIAS_DE_VESPERA &&
        (linha.reserva.status === 'confirmada' || linha.reserva.status === 'pendente') &&
        (linha.admissao === 'ausente' || linha.admissao === 'vencido'),
    ).length

    vesperaApurada = { total: travadas, tom: travadas > 0 ? 'atencao' : 'neutro' }
    chegadas = reservas.valor.filter(
      (linha) =>
        linha.diasAteEntrada === 0 &&
        (linha.reserva.status === 'confirmada' || linha.reserva.status === 'pendente'),
    ).length
  }

  return {
    situacao: situacaoPelasFontes([prancheta, reservas, hospedes]),
    rotina: rotinaApurada,
    vespera: vesperaApurada,
    chegadas,
    saidas: hospedes.ok ? hospedes.valor.filter((hospede) => hospede.saiHoje).length : null,
  }
}

function carregar() {
  if (emVoo) {
    return emVoo
  }

  carregando.value = true

  emVoo = apurarPendenciasDoHotel()
    .then((resultado) => {
      /* Só reescreve o que foi de fato apurado; o resto fica com o último valor conhecido. */
      if (resultado.rotina) rotina.value = resultado.rotina
      if (resultado.vespera) vespera.value = resultado.vespera

      hoje.value = {
        chegadas: resultado.chegadas ?? hoje.value.chegadas,
        saidas: resultado.saidas ?? hoje.value.saidas,
      }

      situacao.value = resultado.situacao

      if (resultado.situacao !== 'falhou') {
        conferidoEm.value = new Date()
      }
    })
    .catch(() => {
      /* Nem os repositórios carregaram. O menu fica quieto; a visão geral mostra que falhou. */
      situacao.value = 'falhou'
    })
    .finally(() => {
      carregando.value = false
      carregado.value = true
      emVoo = null
    })

  return emVoo
}

/**
 * Refaz a contagem, se alguém já a estava usando.
 *
 * Chamado pelo `invalidarTudo()` da store do hotel — toda mutação do módulo (tarefa marcada,
 * check-in, exigência dispensada) passa por lá. Numa conta sem o módulo, é uma função vazia.
 */
export function invalidarPendenciasDoHotel() {
  if (carregado.value) {
    void carregar()
  }
}

/** O relógio que refaz a contagem sozinho — ver `criarReconferencia`. */
const reconferencia = criarReconferencia({
  recarregar: carregar,
  conferidoEm: () => conferidoEm.value,
  carregado: () => carregado.value,
})

/**
 * Contagens do hotel, carregadas sob demanda.
 *
 * `ativo` diz se o consumidor tem direito de ver o módulo. Enquanto for `false`, tudo fica
 * zerado e nada é pedido ao repositório.
 */
export function useHotelPendencias(ativo: () => boolean) {
  watch(
    ativo,
    (ligado) => {
      if (ligado && !carregado.value) {
        void carregar()
      }
    },
    { immediate: true },
  )

  reconferencia.assinar(ativo)

  return {
    rotina: computed(() => (ativo() ? rotina.value : VAZIO)),
    vespera: computed(() => (ativo() ? vespera.value : VAZIO)),
    hoje: computed(() => (ativo() ? hoje.value : HOJE_VAZIO)),
    situacao: computed(() => (ativo() ? situacao.value : null)),
    conferidoEm: computed(() => conferidoEm.value),
    carregando: computed(() => carregando.value),
    carregado: computed(() => carregado.value),
    recarregar: carregar,
  }
}

/** Zera o singleton. Existe para o teste, e para o logout não deixar contagem de outra conta. */
export function limparPendenciasDoHotel() {
  rotina.value = VAZIO
  vespera.value = VAZIO
  hoje.value = HOJE_VAZIO
  conferidoEm.value = null
  situacao.value = null
  carregado.value = false
  carregando.value = false
  emVoo = null
}
