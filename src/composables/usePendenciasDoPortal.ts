/**
 * Os números do menu e da pauta do Início, vindos do servidor (`GET /parceiro/portal/pendencias`,
 * E1-06).
 *
 * Fora do modo demonstração, nenhum número de pendência é calculado no navegador: a API conta,
 * filtra pelo que a pessoa pode ver (permissão, CRMV, módulo ligado) e devolve tudo numa chamada.
 * Este arquivo só guarda a resposta e a arruma por rota, que é como o menu a lê.
 *
 * ## Por que é singleton de módulo
 *
 * Pelo mesmo motivo de `useClinicoPendencias`: quem consome é o shell, que monta uma vez, e o
 * Início, que lê os mesmos números. Uma chamada serve os dois, e o número do selo e o da pauta
 * nunca são de momentos diferentes.
 *
 * ## Quando recarrega
 *
 * Na entrada, ao trocar de parceiro, a cada 5 minutos com a aba visível e ao voltar para a janela
 * (`criarReconferencia`), e quando uma tela avisa que mexeu num número (`invalidarPendenciasDoPortal`,
 * por exemplo ao convidar alguém). O servidor guarda cada número por 30 s: pedir mais vezes que isso
 * não traz número novo.
 */

import { computed, ref, watch } from 'vue'

import { criarReconferencia, type SituacaoDaConferencia } from '@/composables/conferencia'
import type {
  ParteDePendencia,
  TomDePendencia,
} from '@/features/clinico/composables/useClinicoPendencias'
import {
  listarPendencias,
  type Pendencia,
  type TomDaPendencia,
} from '@/service/parceiro/pendencias-service'
import { useParceiroStore } from '@/stores/parceiro'

/** O que um selo do menu mostra: a soma dos contadores daquela rota e o tom do mais grave. */
export type SeloDaRota = {
  total: number
  tom: TomDePendencia
  /** Cada contador que entrou na soma, para a frase do selo dizer de que ele é feito. */
  partes: ParteDePendencia[]
}

const TOM: Record<TomDaPendencia, TomDePendencia> = {
  NEUTRO: 'neutro',
  ATENCAO: 'atencao',
  RISCO: 'risco',
}

const PESO_DO_TOM: Record<TomDePendencia, number> = { neutro: 0, atencao: 1, risco: 2 }

export function tomDaPendencia(tom: TomDaPendencia): TomDePendencia {
  return TOM[tom] ?? 'neutro'
}

/**
 * O que pede alguém agora: `valor` acima de zero. Zero não vira selo, e `null` (o contador falhou
 * no servidor) também não: mostrar "0" ali seria afirmar o que ninguém conferiu.
 */
export function pendenciasComValor(lista: readonly Pendencia[]) {
  return lista.filter((item): item is Pendencia & { valor: number } => (item.valor ?? 0) > 0)
}

/** Os contadores somados por rota: dois números que abrem a mesma tela viram um selo só. */
export function selosPorRota(lista: readonly Pendencia[]): Map<string, SeloDaRota> {
  const selos = new Map<string, SeloDaRota>()

  for (const item of pendenciasComValor(lista)) {
    const tom = tomDaPendencia(item.tom)
    const atual = selos.get(item.rota)

    if (!atual) {
      selos.set(item.rota, {
        total: item.valor,
        tom,
        partes: [{ chave: item.chave, total: item.valor }],
      })
      continue
    }

    atual.total += item.valor
    atual.partes.push({ chave: item.chave, total: item.valor })

    if (PESO_DO_TOM[tom] > PESO_DO_TOM[atual.tom]) {
      atual.tom = tom
    }
  }

  return selos
}

const lista = ref<Pendencia[]>([])
/**
 * Para qual parceiro foi a última conferência, tenha dado certo ou não (`undefined`: nenhuma ainda).
 * Trocar de parceiro não pode deixar o número do outro no menu, nem dizer "em dia" antes de
 * conferir o novo.
 */
const conferidoPara = ref<string | null | undefined>(undefined)
const carregando = ref(false)
const conferidoEm = ref<Date | null>(null)
const situacao = ref<SituacaoDaConferencia | null>(null)

let emVoo: Promise<void> | null = null
let parceiroAtual: () => string | null = () => null

async function apurar() {
  const parceiroId = parceiroAtual()

  try {
    const resposta = await listarPendencias(parceiroId ? { parceiroId } : undefined)

    /* A resposta chegou depois de uma troca de parceiro: é de quem já não está na tela. */
    if (parceiroAtual() !== parceiroId) return

    lista.value = resposta
    conferidoPara.value = parceiroId
    /* Contador que falhou no servidor vem com `valor: null`; os outros valem. */
    situacao.value = resposta.some((item) => item.valor === null) ? 'parcial' : 'ok'
    conferidoEm.value = new Date()
  } catch {
    if (parceiroAtual() !== parceiroId) return

    /* Do mesmo parceiro, a lista que estava fica: um número de antes é melhor que nenhum. */
    if (conferidoPara.value !== parceiroId) {
      lista.value = []
      conferidoEm.value = null
    }

    conferidoPara.value = parceiroId
    situacao.value = 'falhou'
  }
}

function carregar() {
  if (emVoo) {
    return emVoo
  }

  carregando.value = true

  emVoo = apurar().finally(() => {
    carregando.value = false
    emVoo = null
  })

  return emVoo
}

/**
 * Refaz a contagem, se alguém já a estava usando. Chamado por quem mexe num número: convite enviado
 * ou cancelado, por exemplo. O servidor invalida o próprio cache nesses eventos.
 */
export function invalidarPendenciasDoPortal() {
  if (conferidoPara.value !== undefined) {
    void carregar()
  }
}

const reconferencia = criarReconferencia({
  recarregar: carregar,
  conferidoEm: () => conferidoEm.value,
  carregado: () => conferidoPara.value !== undefined,
})

/**
 * Os contadores do parceiro, carregados sob demanda.
 *
 * `ativo` diz se é hora de pedir: fora da demonstração e com o contexto do parceiro pronto.
 * Enquanto for `false`, a lista fica vazia e nada é pedido.
 */
export function usePendenciasDoPortal(ativo: () => boolean) {
  const store = useParceiroStore()

  parceiroAtual = () => store.parceiroId

  watch(
    [ativo, () => store.parceiroId],
    ([ligado, parceiroId]) => {
      if (ligado && conferidoPara.value !== parceiroId) {
        void carregar()
      }
    },
    { immediate: true },
  )

  reconferencia.assinar(ativo)

  /* A conferência que vale é a deste parceiro; a de outro não aparece nem como "conferido". */
  const carregado = computed(() => ativo() && conferidoPara.value === store.parceiroId)
  const doParceiroAtual = computed(() => (carregado.value ? lista.value : []))

  return {
    lista: doParceiroAtual,
    selos: computed(() => selosPorRota(doParceiroAtual.value)),
    situacao: computed(() => (carregado.value ? situacao.value : null)),
    conferidoEm: computed(() => (carregado.value ? conferidoEm.value : null)),
    carregando: computed(() => carregando.value),
    carregado,
    recarregar: carregar,
  }
}

/** Zera o singleton. Existe para o teste, e para o logout não deixar número de outra conta. */
export function limparPendenciasDoPortal() {
  lista.value = []
  conferidoPara.value = undefined
  conferidoEm.value = null
  situacao.value = null
  carregando.value = false
  emVoo = null
}
