/**
 * Store da caixa de pedidos de horário — o lado da recepção do agendamento online.
 *
 * O pedido chega do app ou do link da clínica, e alguém da casa responde: aceita o horário que o
 * responsável escolheu, marca no melhor horário que tiver, ou recusa dizendo por quê. Cada resposta
 * vira, na mesma gravação, um atendimento na agenda (com a origem do pedido) e um aviso para quem
 * pediu.
 *
 * `versao` sobe a cada mudança — de lá ou de cá. É o que faz o celular da demonstração, aberto ao
 * lado, buscar o aviso que acabou de sair, e o que faz a caixa reler quando o celular manda um
 * pedido novo.
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { invalidarPendenciasClinicas } from '../composables/useClinicoPendencias'
import { ErroDoPedido, pedidoRepository, type PedidoNaCaixa } from '../data/agendamento-online'
import type {
  AgendamentoOnline,
  Appointment,
  ISODateTime,
  MotivoDaRecusaDoPedido,
} from '../data/types'
import { situacaoDoPrazo } from '../domain/pedidos'

import { clinicClock, useClinicoStore } from './clinico'

/**
 * O que a última resposta fez, dito em uma linha. Fica fora de `erro` pelo mesmo motivo da fila:
 * "o horário foi ocupado" não é falha da tela, é notícia a dar.
 */
export type ResultadoDaResposta =
  | { tipo: 'marcado'; chave: string; atendimentos: Appointment[] }
  | { tipo: 'recusado'; chave: string }
  | { tipo: 'horario-ocupado'; chave: string }
  | { tipo: 'ja-respondido'; chave: string }

export const usePedidosStore = defineStore('clinico-pedidos', () => {
  const linhas = ref<PedidoNaCaixa[]>([])
  const configuracao = ref<AgendamentoOnline | null>(null)
  const carregando = ref(false)
  const carregado = ref(false)
  /** A chave da linha sendo respondida. Uma por vez: a recepção responde, não despacha em lote. */
  const respondendo = ref<string | null>(null)
  const erro = ref('')
  const resultado = ref<ResultadoDaResposta | null>(null)
  const versao = ref(0)

  /**
   * Os que esperam resposta, na ordem do prazo: o que vence primeiro em cima. Não é a ordem de
   * chegada — um pedido da noite vence no meio da manhã, depois de um que chegou às oito.
   */
  const abertas = computed(() =>
    linhas.value
      .filter((linha) => linha.pedidos[0]!.status === 'pendente')
      .sort((a, b) => a.pedidos[0]!.responderAte.localeCompare(b.pedidos[0]!.responderAte)),
  )

  /** Os já respondidos: o mais recente em cima. O histórico mora recolhido na tela. */
  const respondidas = computed(() =>
    linhas.value
      .filter((linha) => linha.pedidos[0]!.status !== 'pendente')
      .sort((a, b) =>
        (b.pedidos[0]!.respondidoEm ?? b.pedidos[0]!.criadoEm).localeCompare(
          a.pedidos[0]!.respondidoEm ?? a.pedidos[0]!.criadoEm,
        ),
      ),
  )

  const atrasadas = computed(
    () =>
      abertas.value.filter(
        (linha) => situacaoDoPrazo(linha.pedidos[0]!, clinicClock.nowIso()) === 'atrasado',
      ).length,
  )

  async function carregar() {
    carregando.value = true
    erro.value = ''

    try {
      linhas.value = await pedidoRepository.listar()
      configuracao.value = pedidoRepository.configuracao()
      carregado.value = true
    } catch {
      erro.value = 'clinico.pedidos.erros.carregar'
    } finally {
      carregando.value = false
    }
  }

  /** Algo mudou — aqui ou no celular. Relê a caixa e avisa quem mais conta. */
  async function avisarMudanca() {
    versao.value += 1
    invalidarPendenciasClinicas()
    await carregar()
  }

  function traduzirErro(chave: string, causa: unknown): ResultadoDaResposta | null {
    if (causa instanceof ErroDoPedido && causa.codigo === 'HORARIO_INDISPONIVEL') {
      return { tipo: 'horario-ocupado', chave }
    }

    if (causa instanceof ErroDoPedido && causa.codigo === 'PEDIDO_JA_RESPONDIDO') {
      return { tipo: 'ja-respondido', chave }
    }

    return null
  }

  /**
   * Aceita o grupo. Sem `escolha`, no horário que o responsável escolheu; com ela, no horário que a
   * recepção escolheu no lugar — o melhor horário, ou a alternativa ao escolhido que sumiu.
   */
  async function aceitar(
    chave: string,
    pedidoId: string,
    escolha: { professionalId: string; inicio: ISODateTime } | null = null,
  ) {
    respondendo.value = chave
    erro.value = ''

    try {
      const atendimentos = await pedidoRepository.aceitar(pedidoId, escolha)

      /*
       * Primeira vez: o aceite acabou de criar o paciente. O catálogo da tela relê pets e
       * responsáveis antes de dizer quem foi marcado — senão a frase sai sem nome.
       */
      await useClinicoStore().carregar(true)
      resultado.value = { tipo: 'marcado', chave, atendimentos }

      return true
    } catch (causa) {
      const conhecido = traduzirErro(chave, causa)

      if (conhecido) {
        resultado.value = conhecido
      } else {
        erro.value = 'clinico.pedidos.erros.responder'
      }

      return false
    } finally {
      respondendo.value = null
      await avisarMudanca()
    }
  }

  async function recusar(
    chave: string,
    pedidoId: string,
    motivo: MotivoDaRecusaDoPedido,
    mensagem: string,
  ) {
    respondendo.value = chave
    erro.value = ''

    try {
      await pedidoRepository.recusar(pedidoId, motivo, mensagem)
      resultado.value = { tipo: 'recusado', chave }

      return true
    } catch (causa) {
      const conhecido = traduzirErro(chave, causa)

      if (conhecido) {
        resultado.value = conhecido
      } else {
        erro.value = 'clinico.pedidos.erros.responder'
      }

      return false
    } finally {
      respondendo.value = null
      await avisarMudanca()
    }
  }

  async function salvarConfiguracao(nova: AgendamentoOnline) {
    erro.value = ''

    try {
      configuracao.value = await pedidoRepository.salvarConfiguracao(nova)
      await avisarMudanca()

      return true
    } catch {
      erro.value = 'clinico.pedidos.erros.configuracao'

      return false
    }
  }

  function dispensarResultado() {
    resultado.value = null
  }

  return {
    linhas,
    configuracao,
    carregando,
    carregado,
    respondendo,
    erro,
    resultado,
    versao,
    abertas,
    respondidas,
    atrasadas,
    carregar,
    avisarMudanca,
    aceitar,
    recusar,
    salvarConfiguracao,
    dispensarResultado,
  }
})
