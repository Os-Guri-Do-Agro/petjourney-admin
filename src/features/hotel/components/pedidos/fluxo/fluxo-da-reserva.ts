/**
 * O fluxo do responsável no hotel: do "vou viajar" ao pedido de reserva enviado.
 *
 * O mesmo desenho do fluxo da clínica (`features/clinico/components/pedidos/fluxo/`), nos mesmos
 * dois lugares — o app e a página pública do hotel —, com as perguntas de um hotel: quem vai (até
 * dois da mesma casa, na mesma acomodação), quando entra e quando sai, e como prefere — escolher a
 * acomodação vendo o que está livre, ou deixar o hotel escolher.
 *
 * O desvio de urgência mora nas datas: entrada antes da antecedência mínima não é pedido, é
 * telefonema — a tela mostra o contato do hotel e para.
 */

import { computed, inject, provide, reactive, ref, type InjectionKey } from 'vue'

import type {
  DisponibilidadeDoPeriodo,
  ModoDoPedidoDeReservaNoContrato,
  PedidoDeReservaNoContrato,
  PedidoDeReservaPeloLink,
  PorteNoContrato,
  ReservaOnlineDoHotel,
  ServicoNoPedido,
} from '../../../contrato/responsavel'
import {
  ErroDaReservaOnline,
  reservaOnlineDoResponsavel as api,
  type EstadiaNoApp,
  type PetDaContaNoHotel,
} from '../../../data/reserva-online'
import { agoraIso, hojeIso } from '../../../data/store'
import type { AvisoDoPedidoDeReserva, PetPorte } from '../../../data/types'
import { contarDiarias, instante } from '../../../domain/hotel-time'
import { ehUrgente } from '../../../domain/pedidos-de-reserva'
import { HOTEL_UTC_OFFSET } from '../../../data/fixtures'
import { addDays } from '@/features/clinico/domain/clinic-time'

export type CanalDaReserva = 'app' | 'link'

export type EtapaDaReserva =
  | 'inicio'
  | 'pets'
  | 'porte'
  | 'pet-do-link'
  | 'datas'
  | 'modo'
  | 'acomodacao'
  | 'extras'
  | 'seus-dados'
  | 'revisar'
  | 'enviado'
  | 'urgente'

export type FluxoDaReserva = ReturnType<typeof criarFluxoDaReserva>

const CHAVE: InjectionKey<FluxoDaReserva> = Symbol('fluxo-da-reserva')

export function proverFluxoDaReserva(fluxo: FluxoDaReserva) {
  provide(CHAVE, fluxo)
}

export function useFluxoDaReserva(): FluxoDaReserva {
  const fluxo = inject(CHAVE)

  if (!fluxo) {
    throw new Error('useFluxoDaReserva fora de um fluxo de reserva')
  }

  return fluxo
}

function codigoDe(causa: unknown): string {
  return causa instanceof ErroDaReservaOnline ? causa.codigo : 'FALHA'
}

/** `Date` do seletor → `YYYY-MM-DD`, pelo calendário de quem escolheu. */
function dataIso(data: Date): string {
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')

  return `${data.getFullYear()}-${mes}-${dia}`
}

function dataDoSeletor(iso: string): Date {
  const [ano, mes, dia] = iso.split('-').map(Number)

  return new Date(ano!, mes! - 1, dia!)
}

const PORTE_NO_FIO: Record<PetPorte, PorteNoContrato> = {
  mini: 'MINI',
  pequeno: 'PEQUENO',
  medio: 'MEDIO',
  grande: 'GRANDE',
  gigante: 'GIGANTE',
}

export function criarFluxoDaReserva(opcoes: {
  canal: CanalDaReserva
  tutorId: () => string | null
  aoMudar?: () => void
}) {
  const inicial: EtapaDaReserva = opcoes.canal === 'app' ? 'inicio' : 'pet-do-link'
  const etapa = ref<EtapaDaReserva>(inicial)
  const historico = ref<EtapaDaReserva[]>([])
  /** Para onde a última troca foi — a transição desliza para a frente ou para trás (ver a clínica). */
  const direcao = ref<'frente' | 'volta'>('frente')

  const hotel = ref<ReservaOnlineDoHotel | null>(null)
  const carregando = ref(false)
  const erro = ref<string | null>(null)

  const petsDaConta = ref<PetDaContaNoHotel[]>([])
  const pedidos = ref<PedidoDeReservaNoContrato[]>([])
  const estadias = ref<EstadiaNoApp[]>([])
  const avisos = ref<AvisoDoPedidoDeReserva[]>([])

  const hoje = hojeIso()

  const pedido = reactive({
    petIds: [] as string[],
    entrada: dataDoSeletor(addDays(hoje, 7)) as Date | null,
    horaEntrada: '10:00',
    saida: dataDoSeletor(addDays(hoje, 10)) as Date | null,
    horaSaida: '12:00',
    modo: null as ModoDoPedidoDeReservaNoContrato | null,
    tipoId: null as string | null,
    aceitaMudarUmDia: true,
    servicos: [] as ServicoNoPedido[],
    observacao: '',
    visitante: {
      nome: '',
      telefone: '',
      petNome: '',
      especie: 'CANINA' as 'CANINA' | 'FELINA',
      porte: 'MEDIO' as PorteNoContrato | null,
    },
  })

  const disponibilidade = ref<DisponibilidadeDoPeriodo | null>(null)
  /** O tipo que a pessoa escolheu e alguém pegou antes do envio. */
  const tipoSumiu = ref<string | null>(null)
  const enviado = ref<PedidoDeReservaNoContrato | PedidoDeReservaPeloLink | null>(null)

  // ------------------------------------------------------------------ derivados

  const petsEscolhidos = computed(() =>
    petsDaConta.value.filter((pet) => pedido.petIds.includes(pet.id)),
  )

  const petSemPorte = computed(() => petsEscolhidos.value.find((pet) => pet.faltaPorte) ?? null)

  /** Dois de espécies diferentes não dividem acomodação: o fluxo avisa antes de buscar vaga. */
  const naoDividem = computed(
    () =>
      petsEscolhidos.value.length > 1 &&
      petsEscolhidos.value.some((pet) => pet.especie !== petsEscolhidos.value[0]!.especie),
  )

  const entradaIso = computed(() =>
    pedido.entrada ? instante(dataIso(pedido.entrada), pedido.horaEntrada, HOTEL_UTC_OFFSET) : null,
  )

  const saidaIso = computed(() =>
    pedido.saida ? instante(dataIso(pedido.saida), pedido.horaSaida, HOTEL_UTC_OFFSET) : null,
  )

  const datasValidas = computed(
    () =>
      entradaIso.value !== null &&
      saidaIso.value !== null &&
      Date.parse(saidaIso.value) > Date.parse(entradaIso.value),
  )

  const diarias = computed(() =>
    entradaIso.value && saidaIso.value && datasValidas.value
      ? contarDiarias(entradaIso.value, saidaIso.value)
      : 0,
  )

  const urgente = computed(
    () =>
      hotel.value !== null &&
      entradaIso.value !== null &&
      ehUrgente(entradaIso.value, agoraIso(), hotel.value.antecedenciaMinimaHoras),
  )

  const tipoEscolhido = computed(
    () => disponibilidade.value?.tipos.find((tipo) => tipo.tipoId === pedido.tipoId) ?? null,
  )

  /** A estimativa da estadia mais os extras — o que a tela de revisão mostra. */
  const estimativa = computed(() => {
    if (!disponibilidade.value || !hotel.value) {
      return null
    }

    const base =
      tipoEscolhido.value?.estimativaCentavos ??
      Math.min(
        ...disponibilidade.value.tipos
          .filter((tipo) => tipo.livres > 0)
          .map((tipo) => tipo.estimativaCentavos),
      )

    if (!Number.isFinite(base)) {
      return null
    }

    const extras = pedido.servicos.reduce((soma, servico) => {
      const preco = hotel.value!.servicos.find((item) => item.servico === servico)

      return soma + (preco ? preco.precoCentavos * (preco.porDiaria ? diarias.value : 1) : 0)
    }, 0)

    return base + extras
  })

  // ------------------------------------------------------------------ navegação

  function irPara(proxima: EtapaDaReserva) {
    historico.value.push(etapa.value)
    direcao.value = 'frente'
    etapa.value = proxima
    erro.value = null
  }

  function voltar() {
    const anterior = historico.value.pop()

    erro.value = null

    if (anterior) {
      direcao.value = 'volta'
      etapa.value = anterior
    }
  }

  const podeVoltar = computed(
    () => historico.value.length > 0 && etapa.value !== 'enviado' && etapa.value !== 'inicio',
  )

  // ------------------------------------------------------------------ carga

  async function recarregarConta() {
    const tutorId = opcoes.tutorId()

    if (opcoes.canal !== 'app' || !tutorId) {
      return
    }

    petsDaConta.value = api.petsDaConta(tutorId)
    estadias.value = api.estadias(tutorId)
    avisos.value = api.avisos(tutorId)
    pedidos.value = await api.pedidos(tutorId)

    const atualizado = enviado.value
      ? pedidos.value.find((item) => item.id === enviado.value!.id)
      : undefined

    if (atualizado) {
      enviado.value = { ...enviado.value, ...atualizado }
    }
  }

  async function iniciar() {
    carregando.value = true
    erro.value = null

    try {
      hotel.value = await api.hotel()
      pedido.horaSaida = hotel.value.horarioDeSaida
      await recarregarConta()
    } catch (causa) {
      erro.value = codigoDe(causa)
    } finally {
      carregando.value = false
    }
  }

  async function recomecar() {
    Object.assign(pedido, {
      petIds: [],
      entrada: dataDoSeletor(addDays(hojeIso(), 7)),
      horaEntrada: '10:00',
      saida: dataDoSeletor(addDays(hojeIso(), 10)),
      modo: null,
      tipoId: null,
      aceitaMudarUmDia: true,
      servicos: [],
      observacao: '',
    })
    Object.assign(pedido.visitante, {
      nome: '',
      telefone: '',
      petNome: '',
      especie: 'CANINA',
      porte: 'MEDIO',
    })
    disponibilidade.value = null
    tipoSumiu.value = null
    enviado.value = null
    historico.value = []
    direcao.value = 'volta'
    etapa.value = inicial
    await iniciar()
  }

  // ------------------------------------------------------------------ etapas

  function comecarPedido() {
    irPara('pets')
  }

  function alternarPet(petId: string) {
    pedido.petIds = pedido.petIds.includes(petId)
      ? pedido.petIds.filter((id) => id !== petId)
      : [...pedido.petIds, petId].slice(-2)
  }

  function confirmarPets() {
    irPara(petSemPorte.value ? 'porte' : 'datas')
  }

  async function completarPorte(porte: PetPorte) {
    const tutorId = opcoes.tutorId()
    const pet = petSemPorte.value

    if (!tutorId || !pet) {
      return
    }

    carregando.value = true

    try {
      await api.completarPorte(tutorId, pet.id, porte)
      petsDaConta.value = api.petsDaConta(tutorId)

      if (!petSemPorte.value) {
        historico.value.pop()
        direcao.value = 'frente'
        etapa.value = 'datas'
        historico.value.push('pets')
      }
    } catch (causa) {
      erro.value = codigoDe(causa)
    } finally {
      carregando.value = false
    }
  }

  function confirmarPetDoLink() {
    irPara('datas')
  }

  async function carregarDisponibilidade() {
    if (!entradaIso.value || !saidaIso.value) {
      return
    }

    carregando.value = true
    erro.value = null

    try {
      disponibilidade.value =
        opcoes.canal === 'app'
          ? await api.disponibilidade(
              opcoes.tutorId() ?? '',
              [...pedido.petIds],
              entradaIso.value,
              saidaIso.value,
            )
          : await api.disponibilidadePublica(
              pedido.visitante.especie,
              pedido.visitante.especie === 'CANINA' ? pedido.visitante.porte : null,
              entradaIso.value,
              saidaIso.value,
            )
    } catch (causa) {
      erro.value = codigoDe(causa)
    } finally {
      carregando.value = false
    }
  }

  async function confirmarDatas() {
    if (urgente.value) {
      irPara('urgente')

      return
    }

    await carregarDisponibilidade()

    if (!erro.value) {
      irPara('modo')
    }
  }

  function escolherModo(modo: ModoDoPedidoDeReservaNoContrato) {
    pedido.modo = modo
    pedido.tipoId = null
    irPara(modo === 'ACOMODACAO_ESCOLHIDA' ? 'acomodacao' : 'extras')
  }

  function escolherTipo(tipoId: string) {
    pedido.tipoId = tipoId
    tipoSumiu.value = null
    irPara('extras')
  }

  function confirmarExtras() {
    irPara(opcoes.canal === 'link' ? 'seus-dados' : 'revisar')
  }

  function confirmarDados() {
    irPara('revisar')
  }

  const visitanteValido = computed(
    () =>
      pedido.visitante.nome.trim().length > 1 &&
      pedido.visitante.telefone.replace(/\D/g, '').length >= 10 &&
      pedido.visitante.petNome.trim().length > 0,
  )

  async function enviar() {
    if (!pedido.modo || !entradaIso.value || !saidaIso.value) {
      return
    }

    carregando.value = true
    erro.value = null

    const comum = {
      modo: pedido.modo,
      entrada: entradaIso.value,
      saida: saidaIso.value,
      ...(pedido.modo === 'ACOMODACAO_ESCOLHIDA' && pedido.tipoId ? { tipoId: pedido.tipoId } : {}),
      ...(pedido.modo === 'HOTEL_ESCOLHE' ? { aceitaMudarUmDia: pedido.aceitaMudarUmDia } : {}),
      servicos: [...pedido.servicos],
      observacao: pedido.observacao.trim() || undefined,
    }

    try {
      enviado.value =
        opcoes.canal === 'app'
          ? await api.pedir(opcoes.tutorId() ?? '', { ...comum, petIds: [...pedido.petIds] })
          : await api.pedirPeloLink({
              ...comum,
              visitante: {
                nome: pedido.visitante.nome.trim(),
                telefone: pedido.visitante.telefone.trim(),
                petNome: pedido.visitante.petNome.trim(),
                especie: pedido.visitante.especie,
                ...(pedido.visitante.especie === 'CANINA' && pedido.visitante.porte
                  ? { porte: pedido.visitante.porte }
                  : {}),
              },
            })

      historico.value = []
      direcao.value = 'frente'
      etapa.value = 'enviado'
      opcoes.aoMudar?.()
      await recarregarConta()
    } catch (causa) {
      const codigo = codigoDe(causa)

      if (codigo === 'SEM_VAGA_NO_TIPO') {
        /* Alguém pediu antes: a lista é relida e o tipo aparece esgotado — de verdade. */
        tipoSumiu.value = tipoEscolhido.value?.nome ?? ''
        pedido.tipoId = null
        opcoes.aoMudar?.()
        historico.value = historico.value.filter(
          (item) => item !== 'extras' && item !== 'seus-dados',
        )
        direcao.value = 'volta'
        etapa.value = 'acomodacao'
        await carregarDisponibilidade()
      } else {
        erro.value = codigo
      }
    } finally {
      carregando.value = false
    }
  }

  async function desistirDoPedido(pedidoId: string) {
    carregando.value = true

    try {
      await api.cancelarPedido(pedidoId)
      opcoes.aoMudar?.()
      await recarregarConta()
    } catch (causa) {
      erro.value = codigoDe(causa)
    } finally {
      carregando.value = false
    }
  }

  function pedirDeNovo(anterior: PedidoDeReservaNoContrato) {
    pedido.petIds = anterior.pets.map((pet) => pet.id).filter(Boolean)
    irPara('datas')
  }

  /** Do link para o porte que a busca de vaga entende. */
  const porteDoVisitante = computed(() =>
    pedido.visitante.especie === 'CANINA' ? pedido.visitante.porte : null,
  )

  return {
    canal: opcoes.canal,
    etapa,
    direcao,
    podeVoltar,
    hotel,
    carregando,
    erro,
    petsDaConta,
    pedidos,
    estadias,
    avisos,
    pedido,
    disponibilidade,
    tipoSumiu,
    enviado,
    petsEscolhidos,
    petSemPorte,
    naoDividem,
    entradaIso,
    saidaIso,
    datasValidas,
    diarias,
    urgente,
    tipoEscolhido,
    estimativa,
    visitanteValido,
    porteDoVisitante,
    PORTE_NO_FIO,
    irPara,
    voltar,
    iniciar,
    recomecar,
    recarregarConta,
    comecarPedido,
    alternarPet,
    confirmarPets,
    completarPorte,
    confirmarPetDoLink,
    confirmarDatas,
    escolherModo,
    escolherTipo,
    confirmarExtras,
    confirmarDados,
    enviar,
    desistirDoPedido,
    pedirDeNovo,
  }
}
