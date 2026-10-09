/**
 * Store das reservas e do mapa de acomodações.
 *
 * As duas telas bebem daqui porque respondem à **mesma pergunta em dois formatos**: o mapa mostra
 * onde há vaga num período, a lista mostra o que já foi vendido. Separá-las em duas stores
 * produziria duas noções de "o período selecionado" — e a recepção veria uma coisa no mapa e outra
 * na lista, no mesmo instante.
 *
 * O período vive aqui, e é o estado mais importante do módulo: **vaga é sempre por intervalo**,
 * nunca por hoje, porque a venda é futura.
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import {
  AdmissaoBloqueadaError,
  reservaRepository,
  VagaIndisponivelError,
  type MapaDoPeriodo,
  type ReservaDetalhada,
  type ReservaNaLista,
} from '../data/repositories'
import type {
  ExigenciaKind,
  ISODate,
  ISODateTime,
  MotivoDeCancelamento,
  PessoaAutorizada,
  PetPorte,
  PetSpecies,
  ReservaOrigem,
  ServicoContratado,
} from '../data/types'
import { addDays, instante } from '../domain/hotel-time'
import { HOTEL_UTC_OFFSET } from '../data/fixtures'

import { hotelClock, useHotelStore } from './hotel'

export type FiltroDeBusca = {
  porte: PetPorte | null
  especie: PetSpecies | null
  ocupantes: number
  tipos: string[]
}

export const useReservasStore = defineStore('hotel-reservas', () => {
  const hotelStore = useHotelStore()

  /**
   * O período que governa o mapa.
   *
   * Nasce em "amanhã por três noites" e não em "hoje": quem abre o mapa está atendendo o telefone,
   * e a pergunta do telefone quase nunca é sobre hoje. Hoje já está resolvido no painel.
   */
  const de = ref<ISODate>(addDays(hotelClock.today(), 1))
  const ate = ref<ISODate>(addDays(hotelClock.today(), 4))

  const filtro = ref<FiltroDeBusca>({ porte: null, especie: null, ocupantes: 1, tipos: [] })

  const mapa = ref<MapaDoPeriodo | null>(null)
  const lista = ref<ReservaNaLista[]>([])
  const detalhe = ref<ReservaDetalhada | null>(null)
  const espera = ref<Awaited<ReturnType<typeof reservaRepository.espera>>>([])

  const carregando = ref(false)
  const salvando = ref(false)
  const erro = ref('')
  /** Erro de uma ação pontual — não derruba a tela, aparece ao lado do que falhou. */
  const erroDeAcao = ref('')

  /**
   * As horas do período saem da política da casa, e não são escolhidas no mapa.
   *
   * Quem procura vaga pensa em dias; a hora só importa depois, na reserva. Pedir as duas no
   * seletor transformaria a pergunta de dois cliques numa de seis.
   */
  const inicioIso = computed<ISODateTime>(() =>
    instante(de.value, hotelStore.hotel?.politica.horarioDeEntrada ?? '08:00', HOTEL_UTC_OFFSET),
  )

  const fimIso = computed<ISODateTime>(() =>
    instante(ate.value, hotelStore.hotel?.politica.horarioDeSaida ?? '12:00', HOTEL_UTC_OFFSET),
  )

  const noites = computed(() =>
    Math.max(
      1,
      Math.round(
        (Date.parse(`${ate.value}T12:00:00Z`) - Date.parse(`${de.value}T12:00:00Z`)) / 86_400_000,
      ),
    ),
  )

  function definirPeriodo(novoDe: ISODate, novoAte: ISODate) {
    de.value = novoDe
    /* Saída antes da entrada é um período que não existe: empurra um dia em vez de recusar. */
    ate.value = novoAte > novoDe ? novoAte : addDays(novoDe, 1)
  }

  // -------------------------------------------------------------------------
  // Leitura
  // -------------------------------------------------------------------------

  async function carregarMapa() {
    carregando.value = true
    erro.value = ''

    try {
      await hotelStore.carregar()
      mapa.value = await reservaRepository.mapa({
        inicio: inicioIso.value,
        fim: fimIso.value,
        porte: filtro.value.porte,
        especie: filtro.value.especie,
        ocupantes: filtro.value.ocupantes,
        tipos: filtro.value.tipos,
      })
    } catch {
      erro.value = 'hotel.erros.mapa'
    } finally {
      carregando.value = false
    }
  }

  async function carregarLista(recorte?: { de?: ISODate; ate?: ISODate }) {
    carregando.value = true
    erro.value = ''

    try {
      await hotelStore.carregar()
      lista.value = await reservaRepository.listar(recorte)
      espera.value = await reservaRepository.espera()
    } catch {
      erro.value = 'hotel.erros.reservas'
    } finally {
      carregando.value = false
    }
  }

  async function abrir(reservaId: string) {
    carregando.value = true
    erro.value = ''

    try {
      await hotelStore.carregar()
      detalhe.value = await reservaRepository.abrir(reservaId)
    } catch {
      erro.value = 'hotel.erros.reservas'
    } finally {
      carregando.value = false
    }
  }

  /** Orçamento sem gravar nada — o número que o balcão diz antes de cadastrar. */
  function simular(entrada: {
    acomodacaoId: string
    petId: string
    acompanhantePetId?: string | null
    inicio?: ISODateTime
    fim?: ISODateTime
    servicos?: ServicoContratado[]
  }) {
    return reservaRepository.simular({
      ...entrada,
      inicio: entrada.inicio ?? inicioIso.value,
      fim: entrada.fim ?? fimIso.value,
    })
  }

  // -------------------------------------------------------------------------
  // Escrita
  // -------------------------------------------------------------------------

  /**
   * Envelope único das mutações.
   *
   * Todas seguem o mesmo roteiro: limpa o erro anterior, grava, invalida o mundo. Repetir isso em
   * oito funções seria oito chances de esquecer o `invalidarTudo` — que é o esquecimento que
   * deixa a tela mostrando o que acabou de deixar de ser verdade.
   */
  async function mutar<T>(acao: () => Promise<T>): Promise<T | null> {
    salvando.value = true
    erroDeAcao.value = ''

    try {
      const resultado = await acao()

      hotelStore.invalidarTudo()

      return resultado
    } catch (falha) {
      erroDeAcao.value = traduzir(falha)

      return null
    } finally {
      salvando.value = false
    }
  }

  function traduzir(falha: unknown): string {
    if (falha instanceof VagaIndisponivelError) {
      return `hotel.erros.vaga.${falha.kind}`
    }

    if (falha instanceof AdmissaoBloqueadaError) {
      return 'hotel.erros.admissao'
    }

    return 'hotel.erros.acao'
  }

  async function criar(entrada: {
    petId: string
    acompanhantePetId?: string | null
    acomodacaoId: string
    inicio?: ISODateTime
    fim?: ISODateTime
    origem: ReservaOrigem
    servicos?: ServicoContratado[]
    observacao?: string
    autorizadosARetirar?: PessoaAutorizada[]
  }) {
    const reserva = await mutar(() =>
      reservaRepository.criar({
        ...entrada,
        inicio: entrada.inicio ?? inicioIso.value,
        fim: entrada.fim ?? fimIso.value,
      }),
    )

    if (reserva) {
      await carregarMapa()
    }

    return reserva
  }

  async function editar(entrada: {
    reservaId: string
    inicio?: ISODateTime
    fim?: ISODateTime
    acomodacaoId?: string
    servicos?: ServicoContratado[]
    observacao?: string
  }) {
    const reserva = await mutar(() => reservaRepository.editar(entrada))

    if (reserva) {
      await abrir(entrada.reservaId)
    }

    return reserva
  }

  async function confirmar(reservaId: string, pagoCentavos: number) {
    const reserva = await mutar(() => reservaRepository.confirmar(reservaId, pagoCentavos))

    if (reserva) {
      await abrir(reservaId)
    }

    return reserva
  }

  async function cancelar(reservaId: string, motivo: MotivoDeCancelamento, naoCompareceu = false) {
    const reserva = await mutar(() => reservaRepository.cancelar(reservaId, motivo, naoCompareceu))

    if (reserva) {
      await abrir(reservaId)
    }

    return reserva
  }

  async function registrarComprovante(entrada: {
    petId: string
    kind: ExigenciaKind
    apresentadoEm: ISODate
    documento: string
    observacao?: string
  }) {
    const comprovante = await mutar(() => reservaRepository.registrarComprovante(entrada))

    if (comprovante && detalhe.value) {
      await abrir(detalhe.value.reserva.id)
    }

    return comprovante
  }

  async function dispensar(entrada: {
    reservaId: string
    kind: ExigenciaKind
    motivo: string
    autorizadaPor: string
  }) {
    const reserva = await mutar(() => reservaRepository.dispensar(entrada))

    if (reserva) {
      await abrir(entrada.reservaId)
    }

    return reserva
  }

  return {
    de,
    ate,
    filtro,
    mapa,
    lista,
    detalhe,
    espera,
    carregando,
    salvando,
    erro,
    erroDeAcao,
    inicioIso,
    fimIso,
    noites,
    definirPeriodo,
    carregarMapa,
    carregarLista,
    abrir,
    simular,
    criar,
    editar,
    confirmar,
    cancelar,
    registrarComprovante,
    dispensar,
  }
})
