/**
 * Store da caixa de pedidos de reserva — o lado do balcão da reserva online do hotel.
 *
 * O irmão de `features/clinico/stores/pedidos.ts`. Cada resposta vira, na mesma gravação, uma
 * reserva `pendente` no mapa (com a origem do pedido) e um aviso para quem pediu. `versao` sobe a
 * cada mudança, de lá ou de cá, e é o que o celular da demonstração observa.
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { invalidarPendenciasDoHotel } from '../composables/useHotelPendencias'
import {
  ErroDaReservaOnline,
  pedidoDeReservaRepository,
  type PedidoDeReservaNaCaixa,
} from '../data/reserva-online'
import { agoraIso } from '../data/store'
import type { ISODateTime, MotivoDaRecusaDaReserva, Reserva, ReservaOnline } from '../data/types'
import { situacaoDoPrazoDaReserva } from '../domain/pedidos-de-reserva'

export type ResultadoDaRespostaDoHotel =
  | { tipo: 'reservado'; pedidoId: string; reserva: Reserva }
  | { tipo: 'recusado'; pedidoId: string }
  | { tipo: 'sem-vaga'; pedidoId: string }
  | { tipo: 'ja-respondido'; pedidoId: string }

export const usePedidosDeReservaStore = defineStore('hotel-pedidos-de-reserva', () => {
  const linhas = ref<PedidoDeReservaNaCaixa[]>([])
  const configuracao = ref<ReservaOnline | null>(null)
  const carregando = ref(false)
  const carregado = ref(false)
  const respondendo = ref<string | null>(null)
  const erro = ref('')
  const resultado = ref<ResultadoDaRespostaDoHotel | null>(null)
  const versao = ref(0)

  /** Na ordem do prazo prometido: o que vence primeiro em cima. */
  const abertas = computed(() =>
    linhas.value
      .filter((linha) => linha.pedido.status === 'pendente')
      .sort((a, b) => a.pedido.responderAte.localeCompare(b.pedido.responderAte)),
  )

  const respondidas = computed(() =>
    linhas.value
      .filter((linha) => linha.pedido.status !== 'pendente')
      .sort((a, b) =>
        (b.pedido.respondidoEm ?? b.pedido.criadoEm).localeCompare(
          a.pedido.respondidoEm ?? a.pedido.criadoEm,
        ),
      ),
  )

  const atrasadas = computed(
    () =>
      abertas.value.filter(
        (linha) => situacaoDoPrazoDaReserva(linha.pedido, agoraIso()) === 'atrasado',
      ).length,
  )

  async function carregar() {
    carregando.value = true
    erro.value = ''

    try {
      linhas.value = await pedidoDeReservaRepository.listar()
      configuracao.value = pedidoDeReservaRepository.configuracao()
      carregado.value = true
    } catch {
      erro.value = 'hotel.pedidos.erros.carregar'
    } finally {
      carregando.value = false
    }
  }

  async function avisarMudanca() {
    versao.value += 1
    invalidarPendenciasDoHotel()
    await carregar()
  }

  function conhecido(pedidoId: string, causa: unknown): ResultadoDaRespostaDoHotel | null {
    if (causa instanceof ErroDaReservaOnline && causa.codigo === 'SEM_VAGA_NO_TIPO') {
      return { tipo: 'sem-vaga', pedidoId }
    }

    if (causa instanceof ErroDaReservaOnline && causa.codigo === 'PEDIDO_JA_RESPONDIDO') {
      return { tipo: 'ja-respondido', pedidoId }
    }

    return null
  }

  async function aceitar(
    pedidoId: string,
    escolha: { acomodacaoId: string; inicio: ISODateTime; fim: ISODateTime } | null = null,
  ) {
    respondendo.value = pedidoId
    erro.value = ''

    try {
      const reserva = await pedidoDeReservaRepository.aceitar(pedidoId, escolha)

      resultado.value = { tipo: 'reservado', pedidoId, reserva }

      return true
    } catch (causa) {
      const sabido = conhecido(pedidoId, causa)

      if (sabido) {
        resultado.value = sabido
      } else {
        erro.value = 'hotel.pedidos.erros.responder'
      }

      return false
    } finally {
      respondendo.value = null
      await avisarMudanca()
    }
  }

  async function recusar(pedidoId: string, motivo: MotivoDaRecusaDaReserva, mensagem: string) {
    respondendo.value = pedidoId
    erro.value = ''

    try {
      await pedidoDeReservaRepository.recusar(pedidoId, motivo, mensagem)
      resultado.value = { tipo: 'recusado', pedidoId }

      return true
    } catch (causa) {
      const sabido = conhecido(pedidoId, causa)

      if (sabido) {
        resultado.value = sabido
      } else {
        erro.value = 'hotel.pedidos.erros.responder'
      }

      return false
    } finally {
      respondendo.value = null
      await avisarMudanca()
    }
  }

  async function salvarConfiguracao(nova: ReservaOnline) {
    erro.value = ''

    try {
      configuracao.value = await pedidoDeReservaRepository.salvarConfiguracao(nova)
      await avisarMudanca()

      return true
    } catch {
      erro.value = 'hotel.pedidos.erros.configuracao'

      return false
    }
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
    dispensarResultado: () => {
      resultado.value = null
    },
  }
})
