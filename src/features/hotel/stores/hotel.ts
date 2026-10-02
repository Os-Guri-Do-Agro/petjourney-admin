/**
 * Store raiz do módulo hotel: catálogos, relógio da casa e invalidação.
 *
 * A disciplina que importa neste domínio: **quase toda escrita mexe em mais de uma leitura**. Um
 * check-in muda o mapa de acomodações, a lista de hóspedes, a prancheta do turno e o painel do
 * dia. Por isso toda mutação chama `invalidarTudo()`, por um helper único. Invalidar só o pedaço
 * óbvio deixa metade da tela desatualizada — e é o tipo de defeito que ninguém percebe até a
 * recepção vender uma baia que acabou de ser ocupada.
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { Pet, Tutor } from '@/features/clinico/data/types'

import { invalidarPendenciasDoHotel } from '../composables/useHotelPendencias'
import { HOTEL_UTC_OFFSET, type TemporadaSazonal } from '../data/fixtures'
import { catalogoRepository, type CatalogosDoHotel } from '../data/repositories'
import type {
  Acomodacao,
  Bloco,
  Comprovante,
  Cuidador,
  Exigencia,
  Hotel,
  Servico,
  Tarifa,
  Temporada,
  TipoDeAcomodacao,
} from '../data/types'
import { createClinicClock } from '../domain/hotel-time'

export const hotelClock = createClinicClock(HOTEL_UTC_OFFSET)

export const useHotelStore = defineStore('hotel', () => {
  const hotel = ref<Hotel | null>(null)
  const blocos = ref<Bloco[]>([])
  const acomodacoes = ref<Acomodacao[]>([])
  const tiposDeAcomodacao = ref<TipoDeAcomodacao[]>([])
  const tarifas = ref<Tarifa[]>([])
  const temporadas = ref<Temporada[]>([])
  const temporadasSazonais = ref<TemporadaSazonal[]>([])
  const servicos = ref<Servico[]>([])
  const exigencias = ref<Exigencia[]>([])
  const cuidadores = ref<Cuidador[]>([])
  const comprovantes = ref<Comprovante[]>([])
  const pets = ref<Pet[]>([])
  const tutores = ref<Tutor[]>([])

  const carregando = ref(false)
  const erro = ref('')
  const pronto = ref(false)

  /**
   * Contador de invalidação. Quem deriva dado do módulo observa isto e recarrega — é o equivalente
   * pobre e suficiente da invalidação central do React Query.
   */
  const revisao = ref(0)

  const acomodacaoPorId = computed(() => new Map(acomodacoes.value.map((item) => [item.id, item])))
  const blocoPorId = computed(() => new Map(blocos.value.map((item) => [item.id, item])))
  const petPorId = computed(() => new Map(pets.value.map((item) => [item.id, item])))
  const tutorPorId = computed(() => new Map(tutores.value.map((item) => [item.id, item])))
  const cuidadorPorId = computed(() => new Map(cuidadores.value.map((item) => [item.id, item])))
  const servicoPorId = computed(() => new Map(servicos.value.map((item) => [item.id, item])))
  const tipoPorId = computed(
    () => new Map(tiposDeAcomodacao.value.map((item) => [item.id, item])),
  )

  const tarifaPorId = computed(() => new Map(tarifas.value.map((item) => [item.id, item])))

  function aplicar(catalogos: CatalogosDoHotel) {
    hotel.value = catalogos.hotel
    blocos.value = catalogos.blocos
    acomodacoes.value = catalogos.acomodacoes
    tiposDeAcomodacao.value = catalogos.tiposDeAcomodacao
    tarifas.value = catalogos.tarifas
    temporadas.value = catalogos.temporadas
    temporadasSazonais.value = catalogos.temporadasSazonais
    servicos.value = catalogos.servicos
    exigencias.value = catalogos.exigencias
    cuidadores.value = catalogos.cuidadores
    comprovantes.value = catalogos.comprovantes
    pets.value = catalogos.pets
    tutores.value = catalogos.tutores
  }

  async function carregar(forcar = false) {
    if (pronto.value && !forcar) {
      return
    }

    carregando.value = true
    erro.value = ''

    try {
      aplicar(await catalogoRepository.carregar())
      pronto.value = true
    } catch {
      erro.value = 'hotel.erros.catalogos'
    } finally {
      carregando.value = false
    }
  }

  /**
   * Ponto único de invalidação. Toda mutação do módulo passa por aqui.
   *
   * Avisa também o contador do menu e da visão geral: uma tarefa marcada ou uma exigência
   * dispensada mudam o número ao lado de Rotina e de Reservas, e contador que só atualiza no F5
   * mente com ar de autoridade.
   */
  function invalidarTudo() {
    revisao.value += 1
    invalidarPendenciasDoHotel()
  }

  function acomodacao(id: string): Acomodacao | null {
    return acomodacaoPorId.value.get(id) ?? null
  }

  function bloco(id: string): Bloco | null {
    return blocoPorId.value.get(id) ?? null
  }

  function pet(id: string): Pet | null {
    return petPorId.value.get(id) ?? null
  }

  function tutor(id: string): Tutor | null {
    return tutorPorId.value.get(id) ?? null
  }

  function cuidador(id: string): Cuidador | null {
    return cuidadorPorId.value.get(id) ?? null
  }

  function servico(id: string): Servico | null {
    return servicoPorId.value.get(id) ?? null
  }

  /** O tipo cadastrado pela casa. `null` quando a acomodação aponta para um id que sumiu. */
  function tipoDeAcomodacao(id: string): TipoDeAcomodacao | null {
    return tipoPorId.value.get(id) ?? null
  }

  function tarifa(id: string): Tarifa | null {
    return tarifaPorId.value.get(id) ?? null
  }

  /**
   * Quem está operando agora, para assinar o que for registrado.
   *
   * No protótipo é o primeiro cuidador ativo. Com a API, vem da sessão — e é por isso que existe
   * como função e não como constante espalhada: todo registro do módulo passa por aqui, e trocar
   * a origem é trocar uma linha.
   */
  function operadorAtual(): string {
    return cuidadores.value[0]?.id ?? ''
  }

  /** Cor da faixa de um cuidador — índice, nunca literal: o token resolve claro e escuro. */
  function corDoCuidador(id: string): string {
    return `var(--clinic-col-${(cuidador(id)?.corIndice ?? 0) % 6})`
  }

  function $resetModulo() {
    pronto.value = false
    erro.value = ''
    invalidarTudo()
  }

  return {
    hotel,
    blocos,
    /* O índice, e não só a lista: a rotina ordena as fileiras de uma ronda pela ordem da casa. */
    blocoPorId,
    acomodacoes,
    tiposDeAcomodacao,
    tipoPorId,
    tarifas,
    temporadas,
    temporadasSazonais,
    servicos,
    exigencias,
    cuidadores,
    comprovantes,
    pets,
    tutores,
    carregando,
    erro,
    pronto,
    revisao,
    carregar,
    invalidarTudo,
    acomodacao,
    bloco,
    pet,
    tutor,
    cuidador,
    servico,
    tipoDeAcomodacao,
    tarifa,
    operadorAtual,
    corDoCuidador,
    $resetModulo,
  }
})
