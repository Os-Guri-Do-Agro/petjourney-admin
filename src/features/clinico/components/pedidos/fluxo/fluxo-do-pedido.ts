/**
 * O fluxo do responsável: do "preciso de horário" ao pedido enviado.
 *
 * Um fluxo só para os dois lugares onde ele acontece — o app (no celular da demonstração) e a
 * página pública da clínica, de quem ainda não tem o app. O que muda entre eles é pouco e está
 * dito aqui: no app a pessoa escolhe entre os pets da conta e entre as clínicas dela; no link a
 * clínica já está escolhida e o pet vem do cadastro mínimo, no fim.
 *
 * Fala só o contrato (`agendamentoOnlineDoResponsavel`): é exatamente o que o app de verdade vai
 * chamar. A ordem das etapas é a do pedido do produto — pet, motivo, clínica, profissional (ou
 * qualquer um), horário, confirmação —, com o desvio de emergência logo no motivo: quem marca
 * "falta de ar" não chega à tela de horários.
 */

import { computed, inject, provide, reactive, ref, type InjectionKey } from 'vue'

import type {
  Agendamento,
  AgendamentoOnlineDaClinica,
  DataIso,
  DiaParaPedido,
  EspecieNaClinica,
  ModoDoPedidoNoContrato,
  MotivoVisita,
  OpcaoDeHorario,
  PedidoDeAgendamento,
  PedidoPeloLink,
  PeriodoDoDiaNoContrato,
  ReservaDoPedido,
  SexoNaClinica,
  SinalDeEmergencia,
} from '../../../contrato/responsavel'
import {
  agendamentoOnlineDoResponsavel as api,
  ErroDoPedido,
  type PetDaConta,
} from '../../../data/agendamento-online'
import type { AvisoDoPedido, PetSex } from '../../../data/types'
import { addDays, weekdayOf } from '../../../domain/clinic-time'
import { clinicClock } from '../../../stores/clinico'

export type CanalDoFluxo = 'app' | 'link'

export type EtapaDoFluxo =
  | 'inicio'
  | 'pets'
  | 'completar'
  | 'motivo'
  | 'clinica'
  | 'modo'
  | 'profissional'
  | 'horario'
  | 'preferencia'
  | 'seus-dados'
  | 'revisar'
  | 'enviado'
  | 'emergencia'

/**
 * O que a pessoa diz que é. `BANHO` não existe no motivo do Prisma: é o serviço de estética, e no
 * fio vai como `OUTRO` com o serviço de banho — o que a clínica precisa saber está no serviço.
 */
export type MotivoNaTela = MotivoVisita | 'BANHO'

export const MOTIVOS_NA_TELA: Exclude<MotivoNaTela, 'EMERGENCIA' | 'OUTRO'>[] = [
  'CHECKUP',
  'SINTOMA',
  'VACINA',
  'RETORNO',
  'EXAME',
  'BANHO',
]

/** O serviço que cada motivo pede. Sintoma e check-up são consulta. */
const SERVICO_DO_MOTIVO: Record<Exclude<MotivoNaTela, 'EMERGENCIA'>, string> = {
  CHECKUP: 'CONSULTA',
  SINTOMA: 'CONSULTA',
  OUTRO: 'CONSULTA',
  VACINA: 'VACINA',
  RETORNO: 'RETORNO',
  EXAME: 'EXAME',
  BANHO: 'BANHO',
}

/** Os atalhos do calendário de melhor horário; `periodo` é o de–até tocado no próprio calendário. */
export type QuandoPode = 'amanha' | 'semana' | 'proxima' | 'periodo'

/** Outra clínica da conta, para o passo "qual clínica" existir de verdade. Não recebe pedidos. */
export const OUTRA_CLINICA = {
  id: 'clinica-pompeia',
  nome: 'Hospital Veterinário Pompeia',
  telefone: '(11) 3872-0090',
}

export type FluxoDoPedido = ReturnType<typeof criarFluxoDoPedido>

const CHAVE: InjectionKey<FluxoDoPedido> = Symbol('fluxo-do-pedido')

export function proverFluxo(fluxo: FluxoDoPedido) {
  provide(CHAVE, fluxo)
}

export function useFluxo(): FluxoDoPedido {
  const fluxo = inject(CHAVE)

  if (!fluxo) {
    throw new Error('useFluxo fora de um fluxo de pedido')
  }

  return fluxo
}

/** O código do erro, quando é um dos que a tela sabe contar. */
function codigoDe(causa: unknown): string {
  return causa instanceof ErroDoPedido ? causa.codigo : 'FALHA'
}

export function criarFluxoDoPedido(opcoes: {
  canal: CanalDoFluxo
  /** Quem está no app. No link é sempre `null`. */
  tutorId: () => string | null
  /** Avisa quem está do outro lado (a caixa de pedidos) de que algo mudou. */
  aoMudar?: () => void
}) {
  const etapa = ref<EtapaDoFluxo>(opcoes.canal === 'app' ? 'inicio' : 'motivo')
  const historico = ref<EtapaDoFluxo[]>([])

  const clinica = ref<AgendamentoOnlineDaClinica | null>(null)
  const carregando = ref(false)
  /** Código do último erro — a etapa escolhe a frase. */
  const erro = ref<string | null>(null)

  // ------------------------------------------------------------------ a conta (app)

  const petsDaConta = ref<PetDaConta[]>([])
  const pedidos = ref<PedidoDeAgendamento[]>([])
  const agendamentos = ref<Agendamento[]>([])
  const avisos = ref<AvisoDoPedido[]>([])

  // ------------------------------------------------------------------ o pedido em montagem

  const pedido = reactive({
    petIds: [] as string[],
    motivo: null as MotivoNaTela | null,
    sinais: [] as SinalDeEmergencia[],
    queixa: '',
    modo: null as ModoDoPedidoNoContrato | null,
    /** `null` é qualquer profissional. */
    profissionalId: null as string | null,
    dia: null as DataIso | null,
    quando: 'semana' as QuandoPode,
    /** O de–até escolhido no calendário, quando `quando` é `periodo`. */
    periodoEscolhido: null as { de: DataIso; ate: DataIso } | null,
    periodos: [] as PeriodoDoDiaNoContrato[],
    compartilharHistorico: false,
    remarca: null as Agendamento | null,
    visitante: {
      nome: '',
      telefone: '',
      petNome: '',
      especie: 'CANINA' as EspecieNaClinica,
      nascimento: null as Date | null,
      sexo: null as SexoNaClinica | null,
    },
  })

  const dias = ref<DiaParaPedido[]>([])
  const reserva = ref<ReservaDoPedido | null>(null)
  /** O horário que a pessoa tocou e alguém pegou antes. A tela de horários diz isso em voz alta. */
  const horarioSumiu = ref<OpcaoDeHorario | null>(null)
  const enviado = ref<PedidoDeAgendamento | PedidoPeloLink | null>(null)

  // ------------------------------------------------------------------ derivados

  const petsEscolhidos = computed(() =>
    petsDaConta.value.filter((pet) => pedido.petIds.includes(pet.id)),
  )

  /** O primeiro pet escolhido que ainda não tem o que a clínica precisa. */
  const petIncompleto = computed(
    () => petsEscolhidos.value.find((pet) => pet.faltam.length > 0) ?? null,
  )

  /** Algum pet nunca passou pela clínica: o pedido é de primeira consulta. */
  const primeiraVez = computed(
    () => opcoes.canal === 'link' || petsEscolhidos.value.some((pet) => !pet.conhecidoPelaClinica),
  )

  const servico = computed(() => {
    if (!clinica.value || !pedido.motivo || pedido.motivo === 'EMERGENCIA') {
      return null
    }

    const tipo = pedido.remarca?.servico.tipo ?? SERVICO_DO_MOTIVO[pedido.motivo]

    return clinica.value.servicos.find((item) => item.tipo === tipo) ?? null
  })

  /** Os motivos que esta clínica atende online — o de banho some na clínica sem banho. */
  const motivosDisponiveis = computed(() =>
    MOTIVOS_NA_TELA.filter((motivo) =>
      clinica.value?.servicos.some((item) => item.tipo === SERVICO_DO_MOTIVO[motivo]),
    ),
  )

  const modos = computed(() => clinica.value?.modos ?? [])

  const profissional = computed(
    () => clinica.value?.profissionais.find((item) => item.id === pedido.profissionalId) ?? null,
  )

  const diaAtual = computed(() => dias.value.find((item) => item.data === pedido.dia) ?? null)

  /** O próximo dia com horário depois do que está na tela — o atalho do dia cheio. */
  const proximoDiaComHorario = computed(() => {
    const depois = dias.value.filter(
      (item) => item.situacao === 'COM_HORARIO' && (!pedido.dia || item.data > pedido.dia),
    )

    return depois[0] ?? null
  })

  /** Do dia de hoje ao fim do horizonte que a clínica abre. */
  const limitesDoCalendario = computed((): { min: DataIso; max: DataIso } => {
    const hoje = clinicClock.today()

    return { min: hoje, max: addDays(hoje, clinica.value?.horizonteDias ?? 30) }
  })

  /** Cada dia carregado, na palavra do calendário: com vaga, cheio, fechado. */
  const situacoesDosDias = computed(() =>
    Object.fromEntries(
      dias.value.map((item) => [
        item.data,
        item.situacao === 'COM_HORARIO'
          ? ('livre' as const)
          : item.situacao === 'FECHADA'
            ? ('fechado' as const)
            : ('cheio' as const),
      ]),
    ),
  )

  const janela = computed((): { de: DataIso; ate: DataIso } => {
    const hoje = clinicClock.today()
    const amanha = addDays(hoje, 1)

    if (pedido.quando === 'periodo' && pedido.periodoEscolhido) {
      return { ...pedido.periodoEscolhido }
    }

    if (pedido.quando === 'amanha') {
      return { de: amanha, ate: amanha }
    }

    if (pedido.quando === 'proxima') {
      /* A próxima segunda, e a semana dela. */
      const ateSegunda = (8 - weekdayOf(hoje)) % 7 || 7
      const segunda = addDays(hoje, ateSegunda)

      return { de: segunda, ate: addDays(segunda, 5) }
    }

    return { de: amanha, ate: addDays(hoje, 6) }
  })

  // ------------------------------------------------------------------ navegação

  function irPara(proxima: EtapaDoFluxo) {
    historico.value.push(etapa.value)
    etapa.value = proxima
    erro.value = null
  }

  async function voltar() {
    const anterior = historico.value.pop()

    /* Saiu da revisão: o horário segurado volta para os outros na hora, não em cinco minutos. */
    if (etapa.value === 'revisar' && reserva.value) {
      await liberarReserva()
    }

    erro.value = null

    if (anterior) {
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
    avisos.value = api.avisos(tutorId)

    const [meusPedidos, meusHorarios] = await Promise.all([
      api.pedidos(tutorId),
      api.agendamentos(tutorId),
    ])

    pedidos.value = meusPedidos
    agendamentos.value = meusHorarios

    /* A clínica respondeu com a tela de enviado aberta: ela passa a dizer o que aconteceu. */
    const atualizado = enviado.value
      ? meusPedidos.find((item) => item.id === enviado.value!.id)
      : undefined

    if (atualizado) {
      enviado.value = { ...enviado.value, ...atualizado }
    }
  }

  async function iniciar() {
    carregando.value = true
    erro.value = null

    try {
      clinica.value = await api.clinica()
      await recarregarConta()
    } catch (causa) {
      erro.value = codigoDe(causa)
    } finally {
      carregando.value = false
    }
  }

  /** Volta ao começo, com a conta relida — depois de enviar, ou ao trocar de pessoa. */
  async function recomecar() {
    if (reserva.value) {
      await liberarReserva()
    }

    Object.assign(pedido, {
      petIds: [],
      motivo: null,
      sinais: [],
      queixa: '',
      modo: null,
      profissionalId: null,
      dia: null,
      quando: 'semana',
      periodoEscolhido: null,
      periodos: [],
      compartilharHistorico: false,
      remarca: null,
    })
    Object.assign(pedido.visitante, {
      nome: '',
      telefone: '',
      petNome: '',
      especie: 'CANINA',
      nascimento: null,
      sexo: null,
    })
    dias.value = []
    horarioSumiu.value = null
    enviado.value = null
    historico.value = []
    etapa.value = opcoes.canal === 'app' ? 'inicio' : 'motivo'
    await iniciar()
  }

  // ------------------------------------------------------------------ etapas

  function comecarPedido() {
    irPara(opcoes.canal === 'app' ? 'pets' : 'motivo')
  }

  function alternarPet(petId: string) {
    pedido.petIds = pedido.petIds.includes(petId)
      ? pedido.petIds.filter((id) => id !== petId)
      : [...pedido.petIds, petId].slice(0, 3)
  }

  function confirmarPets() {
    irPara(petIncompleto.value ? 'completar' : 'motivo')
  }

  async function completarPet(dados: { nascimento: Date | null; sexo: PetSex | null }) {
    const tutorId = opcoes.tutorId()
    const pet = petIncompleto.value

    if (!tutorId || !pet) {
      return
    }

    carregando.value = true

    try {
      await api.completarPet(tutorId, pet.id, {
        nascimento: dados.nascimento ? dataIso(dados.nascimento) : null,
        sexo: dados.sexo,
      })
      petsDaConta.value = api.petsDaConta(tutorId)

      /* Dois pets incompletos: a etapa se repete para o segundo. */
      if (!petIncompleto.value) {
        historico.value.pop()
        etapa.value = 'motivo'
        historico.value.push('pets')
      }
    } catch (causa) {
      erro.value = codigoDe(causa)
    } finally {
      carregando.value = false
    }
  }

  function escolherMotivo(motivo: MotivoNaTela) {
    pedido.motivo = motivo

    if (motivo === 'EMERGENCIA') {
      irPara('emergencia')

      return
    }

    /* Sintoma pergunta pelos sinais na própria etapa; os outros seguem direto. */
    if (motivo !== 'SINTOMA') {
      pedido.sinais = []
      seguirDoMotivo()
    }
  }

  /** Depois do motivo (e dos sinais, se for sintoma): emergência ou o resto do pedido. */
  function seguirDoMotivo() {
    if (pedido.sinais.length > 0) {
      irPara('emergencia')

      return
    }

    irPara(opcoes.canal === 'app' ? 'clinica' : 'modo')
  }

  function escolherClinica() {
    if (!clinica.value?.recebePedidos) {
      return
    }

    irPara('modo')
  }

  async function escolherModo(modo: ModoDoPedidoNoContrato) {
    pedido.modo = modo
    irPara(modo === 'HORARIO_ESCOLHIDO' ? 'profissional' : 'preferencia')
  }

  async function carregarDias() {
    if (!servico.value) {
      return
    }

    carregando.value = true
    erro.value = null

    try {
      const { min, max } = limitesDoCalendario.value

      /* O horizonte inteiro de uma vez: o calendário mostra o mês, e o mês precisa dos pontos. */
      dias.value = await api.dias({
        servicoId: servico.value.id,
        petIds: opcoes.canal === 'app' ? [...pedido.petIds] : [],
        de: min,
        ate: max,
        ...(pedido.profissionalId ? { profissionalId: pedido.profissionalId } : {}),
      })

      const aindaServe = dias.value.find(
        (item) => item.data === pedido.dia && item.situacao === 'COM_HORARIO',
      )

      if (!aindaServe) {
        pedido.dia = dias.value.find((item) => item.situacao === 'COM_HORARIO')?.data ?? min
      }
    } catch (causa) {
      erro.value = codigoDe(causa)
    } finally {
      carregando.value = false
    }
  }

  async function escolherProfissional(id: string | null) {
    pedido.profissionalId = id
    pedido.dia = null
    horarioSumiu.value = null
    irPara('horario')
    await carregarDias()
  }

  async function escolherHorario(opcao: OpcaoDeHorario) {
    if (!clinica.value || !servico.value) {
      return
    }

    carregando.value = true
    erro.value = null
    horarioSumiu.value = null

    try {
      reserva.value = await api.reservar({
        clinicaId: clinica.value.clinica.id,
        servicoId: servico.value.id,
        petIds: opcoes.canal === 'app' ? [...pedido.petIds] : [],
        profissionalId: opcao.profissional.id,
        inicio: opcao.inicio,
      })
      irPara(opcoes.canal === 'link' ? 'seus-dados' : 'revisar')
    } catch (causa) {
      if (codigoDe(causa) === 'HORARIO_INDISPONIVEL') {
        /* Alguém foi mais rápido: a lista é relida e o horário some dela — de verdade. */
        horarioSumiu.value = opcao
        carregando.value = false
        /* O horário foi tomado na agenda da clínica: quem está do outro lado precisa reler. */
        opcoes.aoMudar?.()
        await carregarDias()

        return
      }

      erro.value = codigoDe(causa)
    } finally {
      carregando.value = false
    }
  }

  async function liberarReserva() {
    const atual = reserva.value

    reserva.value = null

    if (atual) {
      await api.liberar(atual.id).catch(() => undefined)
    }
  }

  /** A reserva venceu na revisão: volta aos horários, que podem ter mudado. */
  async function reservaVenceu() {
    reserva.value = null
    erro.value = 'RESERVA_EXPIRADA'
    historico.value.pop()
    etapa.value = 'horario'
    await carregarDias()
    erro.value = 'RESERVA_EXPIRADA'
  }

  function confirmarPreferencia() {
    irPara(opcoes.canal === 'link' ? 'seus-dados' : 'revisar')
  }

  function confirmarDados() {
    irPara('revisar')
  }

  /** Sem horário no dia nem nos seguintes: passar a pedir o melhor horário, sem recomeçar. */
  function trocarParaMelhorHorario() {
    pedido.modo = 'MELHOR_HORARIO'
    pedido.periodos = []
    pedido.quando = 'semana'
    pedido.periodoEscolhido = null
    historico.value.pop()
    etapa.value = 'preferencia'
  }

  const visitanteValido = computed(
    () =>
      pedido.visitante.nome.trim().length > 1 &&
      pedido.visitante.telefone.replace(/\D/g, '').length >= 10 &&
      pedido.visitante.petNome.trim().length > 0,
  )

  async function enviar() {
    if (!clinica.value || !servico.value || !pedido.modo || !pedido.motivo) {
      return
    }

    carregando.value = true
    erro.value = null

    const comum = {
      servicoId: servico.value.id,
      motivo: (pedido.motivo === 'BANHO' ? 'OUTRO' : pedido.motivo) as MotivoVisita,
      queixa: pedido.queixa.trim() || undefined,
      modo: pedido.modo,
      ...(pedido.modo === 'HORARIO_ESCOLHIDO' && reserva.value
        ? { reservaId: reserva.value.id }
        : {}),
      ...(pedido.modo === 'MELHOR_HORARIO'
        ? {
            preferencia: {
              ...janela.value,
              periodos: [...pedido.periodos],
              profissionalId: pedido.profissionalId,
            },
          }
        : {}),
    }

    try {
      if (opcoes.canal === 'app') {
        enviado.value = await api.pedir(opcoes.tutorId() ?? '', {
          ...comum,
          clinicaId: clinica.value.clinica.id,
          petIds: [...pedido.petIds],
          compartilharHistorico: primeiraVez.value ? pedido.compartilharHistorico : undefined,
          ...(pedido.remarca ? { remarcaAgendamentoId: pedido.remarca.id } : {}),
        })
      } else {
        enviado.value = await api.pedirPeloLink({
          ...comum,
          visitante: {
            nome: pedido.visitante.nome.trim(),
            telefone: pedido.visitante.telefone.trim(),
            petNome: pedido.visitante.petNome.trim(),
            especie: pedido.visitante.especie,
            ...(pedido.visitante.nascimento
              ? { nascimento: dataIso(pedido.visitante.nascimento) }
              : {}),
            ...(pedido.visitante.sexo ? { sexo: pedido.visitante.sexo } : {}),
          },
        })
      }

      /* A reserva virou pedido no servidor: não há o que liberar. */
      reserva.value = null
      historico.value = []
      etapa.value = 'enviado'
      opcoes.aoMudar?.()
      await recarregarConta()
    } catch (causa) {
      const codigo = codigoDe(causa)

      if (codigo === 'RESERVA_EXPIRADA') {
        await reservaVenceu()
      } else {
        erro.value = codigo
      }
    } finally {
      carregando.value = false
    }
  }

  // ------------------------------------------------------------------ depois de enviar

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

  async function cancelarAgendamento(agendamentoId: string) {
    const tutorId = opcoes.tutorId()

    if (!tutorId) {
      return
    }

    carregando.value = true

    try {
      await api.cancelarAgendamento(tutorId, agendamentoId)
      opcoes.aoMudar?.()
      await recarregarConta()
    } catch (causa) {
      erro.value = codigoDe(causa)
    } finally {
      carregando.value = false
    }
  }

  /**
   * Remarcar é pedir de novo, com o pet e o serviço já sabidos: a pessoa pula direto para "como
   * prefere marcar". O horário antigo continua dela até a clínica aceitar o novo.
   */
  function remarcar(agendamento: Agendamento) {
    pedido.petIds = [agendamento.pet.id]
    pedido.remarca = agendamento
    pedido.motivo = agendamento.servico.tipo === 'RETORNO' ? 'RETORNO' : 'CHECKUP'
    irPara('modo')
  }

  /** Pedido recusado: o mesmo pedido, de novo, com outro horário. */
  function pedirDeNovo(anterior: PedidoDeAgendamento) {
    pedido.petIds = anterior.pets.map((pet) => pet.id)
    pedido.motivo = anterior.motivo
    pedido.queixa = anterior.queixa
    irPara('modo')
  }

  return {
    canal: opcoes.canal,
    tutorId: opcoes.tutorId,
    etapa,
    podeVoltar,
    clinica,
    carregando,
    erro,
    petsDaConta,
    pedidos,
    agendamentos,
    avisos,
    pedido,
    dias,
    limitesDoCalendario,
    situacoesDosDias,
    diaAtual,
    proximoDiaComHorario,
    reserva,
    horarioSumiu,
    enviado,
    petsEscolhidos,
    petIncompleto,
    primeiraVez,
    servico,
    motivosDisponiveis,
    modos,
    profissional,
    janela,
    visitanteValido,
    irPara,
    voltar,
    iniciar,
    recomecar,
    recarregarConta,
    comecarPedido,
    alternarPet,
    confirmarPets,
    completarPet,
    escolherMotivo,
    seguirDoMotivo,
    escolherClinica,
    escolherModo,
    escolherProfissional,
    carregarDias,
    escolherHorario,
    liberarReserva,
    reservaVenceu,
    confirmarPreferencia,
    confirmarDados,
    trocarParaMelhorHorario,
    enviar,
    desistirDoPedido,
    cancelarAgendamento,
    remarcar,
    pedirDeNovo,
  }
}

/** `Date` do seletor → `YYYY-MM-DD`, pelo calendário local de quem escolheu. */
function dataIso(data: Date): DataIso {
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')

  return `${data.getFullYear()}-${mes}-${dia}`
}
