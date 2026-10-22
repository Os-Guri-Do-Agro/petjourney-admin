/**
 * Gerador determinístico do dataset clínico.
 *
 * Mesma semente, mesmo dia âncora, mesmos 40 atendimentos. O dia âncora nasce sempre em
 * **hoje**, empurrado para a próxima segunda quando cai em fim de semana — dataset preso a
 * data fixa morre na semana seguinte.
 *
 * Armadilha que custou tempo e está resolvida aqui: **o sorteio de status usa um gerador
 * separado do sorteio de posicionamento** (`rngStatus` vs `rngPos`). O status depende do
 * relógio (o que já passou está finalizado); consumindo do mesmo fluxo, a hora em que a
 * página abriu deslocaria o sorteio dos horários e o dia âncora deixaria de ter sempre os
 * mesmos 40 atendimentos. Deu 40 de manhã e 38 à tarde até isolar os dois.
 */

import {
  addDays,
  clockToMinutes,
  createClinicClock,
  diffDays,
  isWeekend,
  nextBusinessDay,
  weekdayOf,
} from '../domain/clinic-time'

import { alergiaConflitante, calcularDose } from '../domain/dose'

import {
  CLINIC_UTC_OFFSET,
  appointmentTypesFixture,
  vacinasFixture,
  clinicFixture,
  politicaDaClinicaFixture,
  diagnosisCatalogFixture,
  examCatalogFixture,
  medicationsFixture,
  petsFixture,
  tutorsFixture,
  professionalsFixture,
  roomsFixture,
} from './fixtures'
import { createPrng, hashSeed, intBetween, pickFrom } from './mock-runtime'
import {
  CONSULTAS_DA_ADESAO,
  casosDaAdesao,
  cuidadoresDoDataset,
  gerarAdesao,
  petsDaAdesao,
} from './seed-adesao'
import { gerarInternacoes, type DatasetDeInternacao } from './seed-internacao'
import {
  consentimentosDosResponsaveis,
  faltaDaBrunilda,
  filaDaBrunilda,
  JANELAS_DA_BRUNILDA,
  justificativaPeloApp,
  PET_DA_FILA,
  proximoDiaUtil,
  RESPONSAVEL_DA_DEMONSTRACAO,
  vacinaDaPerola,
} from './seed-responsavel'
import { vagaLivre } from '../domain/politica'
import type { PoliticaDaClinica } from '../contrato/responsavel'
import {
  CONSULTAS_DO_RESUMO,
  HORARIOS_DE_HOJE,
  PET_DIARIO_CHEIO,
  PET_NOVO,
  PET_PERDA_DE_PESO,
  gerarDiario,
  petsDoResumo,
} from './seed-resumo'
import { planosDeEstoquePlantados } from './seed-estoque'
import { agendamentoOnlinePadrao, contasSoNoApp, semearPedidos } from './seed-pedidos'
import { aplicacoesDaVacinacao, eventosDaVacinacao, petsDaVacinacao } from './seed-vacinacao'
import type {
  AgendamentoOnline,
  Anamnese,
  AplicacaoVacina,
  Appointment,
  AvisoDoPedido,
  AppointmentStatus,
  AppointmentType,
  Block,
  CarePlan,
  Clinic,
  Cuidador,
  Diagnosis,
  ConsentimentoDoResponsavel,
  Encounter,
  ExameFisico,
  Holiday,
  ISODate,
  LoteDeVacina,
  Measurement,
  Medication,
  MotivoDePerda,
  PedidoDeHorario,
  PesagemDeCasa,
  Pet,
  PlanoDeEstoque,
  Prescription,
  Professional,
  RegistroDoDiario,
  SystemKey,
  AtoClinico,
  TimelineEvent,
  TratamentoEmCasa,
  Tutor,
  VitalKey,
  WaitlistEntry,
} from './types'
import type { RegistroDeDose } from '../domain/adesao'

export const SEMENTE_PADRAO = 0x5eed_c11c
export const ATENDIMENTOS_NO_DIA_ANCORA = 40

const clock = createClinicClock(CLINIC_UTC_OFFSET)

const VITAIS: VitalKey[] = [
  'peso',
  'temperatura',
  'frequenciaCardiaca',
  'frequenciaRespiratoria',
  'tempoPreenchimentoCapilar',
  'escoreCorporal',
  'pressaoSistolica',
]

const SISTEMAS: SystemKey[] = [
  'cardiovascular',
  'respiratorio',
  'digestorio',
  'urinario',
  'tegumentar',
  'locomotor',
  'neurologico',
  'linfonodos',
]

export type CasoId =
  | 'sobreposicao'
  | 'encaixe'
  | 'duas-salas'
  | 'atravessa-almoco'
  | 'bloqueio-recorrente'
  | 'dia-fechado'
  | 'falta-reincidente'
  | 'cancelado-visivel'
  | 'fila-expirando'
  | 'alergia-prescricao'
  | 'nomes-extremos'
  | 'retorno-sem-horario'
  /*
   * Os três casos difíceis da internação. Vivem em `seed-internacao.ts`, e não aqui, porque
   * dependem do plantão corrente e não do dia âncora — mas precisam constar do painel junto
   * com os outros, senão demonstrar a internação passa a depender de alguém decorar a rota.
   */
  | 'internacao-piora'
  | 'internacao-troca-plantao'
  | 'internacao-boletim-horario'
  /* Os três casos do resumo "Este pet em 30 segundos". Ver `seed-resumo.ts`. */
  | 'resumo-perda-de-peso'
  | 'resumo-diario-cheio'
  | 'resumo-pet-novo'
  /* Os três casos da adesão ao tratamento. Ver `seed-adesao.ts`. */
  | 'adesao-sem-registro'
  | 'adesao-critico'
  | 'adesao-varias-vezes'

export type CasoDificil = {
  id: CasoId
  /** Rota completa que leva direto ao caso — o painel navega, não explica. */
  rota: string
  appointmentId: string | null
  encounterId: string | null
}

export type SeedResult = {
  semente: number
  /** Dia de referência de todo o dataset. */
  ancora: ISODate
  clinic: Clinic
  appointments: Appointment[]
  blocks: Block[]
  encounters: Encounter[]
  waitlist: WaitlistEntry[]
  timeline: TimelineEvent[]
  /** Vacinas aplicadas — a carteira do paciente e o motor de recall saem daqui. */
  aplicacoesDeVacina: AplicacaoVacina[]
  /**
   * Lotes de vacina na geladeira.
   *
   * O consumo de cada um **não** está aqui: ele é contado a partir das aplicações que citam o
   * código do lote. Ver `domain/estoque-vacinas.ts`.
   */
  lotesDeVacina: LoteDeVacina[]
  /**
   * O piso de estoque que a clínica ajustou, por vacina.
   *
   * O catálogo traz o piso de fábrica; o que a clínica muda pela tela fica aqui, por cima dele. Mudar
   * o catálogo em si faria a mudança vazar entre regenerações do seed — ele é constante de módulo.
   */
  estoqueMinimo: Record<string, number>
  /** O que a clínica combinou para cada mês — ver `domain/metas-de-estoque.ts`. */
  planosDeEstoque: PlanoDeEstoque[]
  /**
   * Procedimentos realizados e medicação aplicada na clínica.
   *
   * Só o que não tem registro próprio em outro lugar. Vacina e dose de internação entram na
   * história do paciente **derivadas** na leitura — ver `domain/atos.ts`.
   */
  atos: AtoClinico[]
  /** Leitos, plantões, aprazamento e boletins. Ancorado no plantão corrente, não no dia âncora. */
  internacao: DatasetDeInternacao
  casos: CasoDificil[]
  /**
   * Cópia dos pacientes e responsáveis da fixture.
   *
   * Ficam no dataset, não na fixture, porque a partir do cadastro pela agenda eles **crescem**:
   * fixture é constante de módulo, e empurrar um paciente novo para dentro dela vazaria entre
   * regeneracões do seed e entre testes.
   */
  pets: Pet[]
  tutores: Tutor[]
  /**
   * O que os responsáveis registraram no Diário Pet do app, na forma do contrato. Mais recente
   * primeiro. Quem pode ler é decidido por `consentimentos`, não pela existência do registro.
   */
  diario: RegistroDoDiario[]
  /** `PesoRegistro` do app: balança de casa. Mais recente primeiro. */
  pesagensDeCasa: PesagemDeCasa[]
  /** O que cada responsável liberou para a clínica ver entre as consultas. */
  consentimentos: ConsentimentoDoResponsavel[]
  /** Prazos combinados com quem marca pelo app. Ver `domain/politica.ts`. */
  politica: PoliticaDaClinica
  /** Quem cuida de cada pet no app: o dono e a família dele. Ver `seed-adesao.ts`. */
  cuidadores: Cuidador[]
  /** Itens de receita que viraram lembrete no app. */
  tratamentos: TratamentoEmCasa[]
  /**
   * O que a casa registrou, dose a dose. Só o que alguém marcou: a dose sem registro é a
   * **ausência** de linha aqui, e a grade a deduz — ver `domain/adesao.ts`.
   */
  registrosDeDose: RegistroDeDose[]
  /** Pedidos de horário do app e do link — ver `seed-pedidos.ts`. */
  pedidos: PedidoDeHorario[]
  agendamentoOnline: AgendamentoOnline
  /**
   * Contas do app que a clínica ainda não conhece. Entram em `tutores` e `pets` no aceite do
   * primeiro pedido — é aí que nasce o vínculo.
   */
  contasSoNoApp: Array<{ tutor: Tutor; pets: Pet[] }>
  /** Código de acompanhamento de cada pedido que veio pelo link, por id do pedido. */
  tokensDoLink: Record<string, string>
  avisosDoPedido: AvisoDoPedido[]
}

function iso(date: ISODate, minutes: number) {
  return clock.toIso(date, minutes)
}

function tipoPorId(id: string): AppointmentType {
  return (
    appointmentTypesFixture.find((tipo) => tipo.id === id) ??
    (appointmentTypesFixture[0] as AppointmentType)
  )
}

function petPorId(id: string): Pet {
  return (
    petsFixture.find((pet) => pet.id === id) ??
    petsDoResumo(clock.today()).find((pet) => pet.id === id) ??
    petsDaAdesao(clock.today()).find((pet) => pet.id === id) ??
    (petsFixture[0] as Pet)
  )
}

/**
 * Sala do atendimento. A do próprio profissional vem primeiro — sem isso, toda consulta de
 * todo profissional caía no "Consultório 1", e a grade nascia acusando conflito de sala entre
 * gente que nunca dividiu sala nenhuma.
 */
function salaPadrao(professional: Professional, tipo: AppointmentType): string[] {
  const propria = roomsFixture.find((room) => room.id === professional.salaPadraoId)

  if (tipo.salasCompativeis.length === 0) {
    return propria ? [propria.id] : []
  }

  if (propria && tipo.salasCompativeis.includes(propria.kind)) {
    return [propria.id]
  }

  const compativel = roomsFixture.find((room) => tipo.salasCompativeis.includes(room.kind))

  return compativel ? [compativel.id] : []
}

type AppointmentSeed = {
  id: string
  petId: string
  professionalId: string
  typeId: string
  data: ISODate
  inicioMin: number
  duracaoMin?: number
  roomIds?: string[]
  encaixe?: boolean
  origem?: Appointment['origem']
  observacao?: string
  linkedGroupId?: string | null
  /** Status forçado; sem isto o `rngStatus` decide a partir do relógio. */
  statusFixo?: AppointmentStatus
  motivoCancelamento?: Appointment['motivoCancelamento']
  justificativaDeFalta?: Appointment['justificativaDeFalta']
}

function montarAppointment(seed: AppointmentSeed): Appointment {
  const tipo = tipoPorId(seed.typeId)
  const pet = petPorId(seed.petId)
  const professional =
    professionalsFixture.find((item) => item.id === seed.professionalId) ??
    (professionalsFixture[0] as Professional)
  const duracao = seed.duracaoMin ?? tipo.duracaoMinutos

  return {
    id: seed.id,
    petId: pet.id,
    tutorId: pet.tutorId,
    professionalId: professional.id,
    roomIds: seed.roomIds ?? salaPadrao(professional, tipo),
    typeId: tipo.id,
    inicio: iso(seed.data, seed.inicioMin),
    fim: iso(seed.data, seed.inicioMin + duracao),
    status: seed.statusFixo ?? 'agendado',
    origem: seed.origem ?? 'recepcao',
    encaixe: seed.encaixe ?? false,
    observacao: seed.observacao ?? '',
    chegadaEm: null,
    iniciadoEm: null,
    finalizadoEm: null,
    canceladoEm: null,
    motivoCancelamento: seed.motivoCancelamento ?? null,
    justificativaDeFalta: seed.justificativaDeFalta ?? null,
    encounterId: null,
    linkedGroupId: seed.linkedGroupId ?? null,
    criadoEm: iso(addDays(seed.data, -3), 9 * 60),
    atualizadoEm: iso(addDays(seed.data, -3), 9 * 60),
  }
}

/** Os motivos que o dataset distribui, e o peso de cada um na vida real de uma clínica. */
const MOTIVOS_DE_FALTA_PLANTADOS: Array<
  NonNullable<Appointment['justificativaDeFalta']>['motivo']
> = ['esqueceu', 'esqueceu', 'imprevisto', 'transporte', 'paciente-melhorou', 'custo', 'emergencia']

const CANAIS_PLANTADOS: Array<NonNullable<Appointment['justificativaDeFalta']>['canal']> = [
  'telefone',
  'whatsapp',
  'whatsapp',
  'sem-resposta',
]

/**
 * O motivo de uma falta sorteada — ou `null`, que é metade dos casos.
 *
 * **Não consome `rngStatus`.** O sorteio de status depende do relógio, e o arquivo inteiro
 * existe em cima da separação entre os dois geradores: puxar um número a mais daqui deslocaria
 * a sequência e o dia âncora deixaria de ter sempre os mesmos quarenta atendimentos. O valor
 * sai de um hash do id, que é estável por construção e não tem sequência para deslocar.
 *
 * Perto de metade fica sem motivo de propósito: é a fila de trabalho do painel de faltas, e uma
 * tela cuja fila abre vazia não demonstra para que serve.
 */
function justificativaPlantada(appointment: Appointment): Appointment['justificativaDeFalta'] {
  const hash = hashSeed(`falta|${appointment.id}`)

  if (hash % 100 < 45) {
    return null
  }

  return {
    motivo: MOTIVOS_DE_FALTA_PLANTADOS[hash % MOTIVOS_DE_FALTA_PLANTADOS.length]!,
    /*
     * `>>>`, e não `>>`.
     *
     * `hashSeed` devolve um inteiro **sem sinal** de 32 bits, e o deslocamento com sinal trata
     * qualquer valor acima de 2³¹ como negativo: o índice saía negativo, o item vinha
     * `undefined` e a tela escrevia o motivo seguido de um ponto solto, sem canal nenhum. O `!`
     * daqui prometia que isso não acontecia — e era o `!` que estava errado.
     */
    canal: CANAIS_PLANTADOS[(hash >>> 3) % CANAIS_PLANTADOS.length]!,
    observacao: '',
    professionalId: 'prof-ana',
    /* No dia seguinte ao da falta: é quando a recepção corre a lista. */
    registradaEm: iso(addDays(clock.dateOf(appointment.inicio), 1), 10 * 60),
  }
}

/**
 * Segunda passada, com gerador próprio: decide o status a partir da posição do atendimento
 * no relógio da clínica. Nada aqui consome `rngPos`.
 */
function aplicarStatus(appointments: Appointment[], semente: number): Appointment[] {
  const rngStatus = createPrng(semente ^ 0x9e3779b9)
  const agora = Date.parse(clock.nowIso())

  return appointments.map((appointment) => {
    if (appointment.status !== 'agendado') {
      return appointment
    }

    const inicio = Date.parse(appointment.inicio)
    const fim = Date.parse(appointment.fim)
    const sorteio = rngStatus()

    if (fim < agora) {
      if (sorteio < 0.08) {
        return {
          ...appointment,
          status: 'falta' as const,
          justificativaDeFalta: justificativaPlantada(appointment),
        }
      }

      return {
        ...appointment,
        status: 'finalizado' as const,
        chegadaEm: iso(clock.dateOf(appointment.inicio), clock.minutesOf(appointment.inicio) - 8),
        iniciadoEm: appointment.inicio,
        finalizadoEm: appointment.fim,
      }
    }

    if (inicio <= agora && fim >= agora) {
      return {
        ...appointment,
        status: 'em-atendimento' as const,
        chegadaEm: iso(clock.dateOf(appointment.inicio), clock.minutesOf(appointment.inicio) - 10),
        iniciadoEm: appointment.inicio,
      }
    }

    /** Próximo da hora e já na recepção: é o que a tela "Meu dia" precisa mostrar. */
    if (inicio - agora < 45 * 60_000 && sorteio < 0.55) {
      return {
        ...appointment,
        status: 'aguardando' as const,
        chegadaEm: clock.nowIso(),
      }
    }

    return { ...appointment, status: sorteio < 0.6 ? ('confirmado' as const) : appointment.status }
  })
}

/**
 * Atendimentos que existem para garantir um estado específico na grade. A promoção abaixo não
 * pode roubá-los: às oito da manhã eles são justamente os mais próximos do agora, e promovê-los
 * apagaria o "finalizado" e a "falta" que eles existem para mostrar.
 */
const ESTADOS_GARANTIDOS = new Set([
  'apt-finalizado-cedo',
  'apt-falta-hoje',
  /* A pré-consulta só faz sentido em atendimento que ainda vai acontecer. */
  'apt-pre-consulta',
])

/**
 * Garante que o dia âncora sempre tenha alguém **em atendimento** e alguém **aguardando** na
 * recepção.
 *
 * Os dois estados nascem da posição do relógio: só existem se a hora em que a demonstração
 * abriu cair dentro de um atendimento, ou minutos antes do próximo. Quem revisa às oito da
 * noite via "Ninguém aguardando na recepção" e concluía que a tela não funciona — quando o
 * que faltava era dado, não código.
 *
 * A promoção escolhe os atendimentos **mais próximos do agora**, então a cena continua
 * plausível: é sempre a consulta da vez que aparece em curso, e as seguintes na espera.
 */
function garantirEstadosDoDia(appointments: Appointment[], ancora: ISODate): Appointment[] {
  const agora = Date.parse(clock.nowIso())
  const doDia = appointments.filter(
    (appointment) =>
      clock.dateOf(appointment.inicio) === ancora &&
      !ESTADOS_GARANTIDOS.has(appointment.id) &&
      !['cancelado', 'falta'].includes(appointment.status),
  )

  const distanciaDoAgora = (appointment: Appointment) =>
    Math.abs(Date.parse(appointment.inicio) - agora)

  const promover = (
    status: Extract<AppointmentStatus, 'em-atendimento' | 'aguardando'>,
    quantidade: number,
    jaUsados: Set<string>,
  ) => {
    const existentes = doDia.filter((appointment) => appointment.status === status)

    if (existentes.length >= quantidade) {
      existentes.forEach((appointment) => jaUsados.add(appointment.id))

      return
    }

    doDia
      .filter((appointment) => !jaUsados.has(appointment.id) && appointment.status !== status)
      .sort((a, b) => distanciaDoAgora(a) - distanciaDoAgora(b))
      .slice(0, quantidade - existentes.length)
      .forEach((appointment) => {
        jaUsados.add(appointment.id)
        appointment.status = status
        appointment.chegadaEm = iso(ancora, clock.minutesOf(appointment.inicio) - 12)
        appointment.iniciadoEm = status === 'em-atendimento' ? appointment.inicio : null
        appointment.finalizadoEm = null
      })
  }

  const usados = new Set<string>()

  promover('em-atendimento', 1, usados)
  promover('aguardando', 2, usados)

  return appointments
}

function feriadosDoAno(ancora: ISODate): Holiday[] {
  const ano = Number(ancora.slice(0, 4))

  return [
    { date: `${ano}-01-01`, nome: 'Confraternização Universal', fechado: true },
    { date: `${ano}-04-21`, nome: 'Tiradentes', fechado: true },
    { date: `${ano}-05-01`, nome: 'Dia do Trabalho', fechado: true },
    { date: `${ano}-09-07`, nome: 'Independência', fechado: true },
    { date: `${ano}-10-12`, nome: 'Nossa Senhora Aparecida', fechado: true },
    { date: `${ano}-11-15`, nome: 'Proclamação da República', fechado: true },
    { date: `${ano}-12-25`, nome: 'Natal', fechado: true },
  ]
}

/** O caso "dia fechado" precisa existir perto do âncora, não em dezembro. */
function diaFechadoProximo(ancora: ISODate): Holiday {
  return {
    date: addDays(ancora, 9),
    nome: 'Feriado municipal',
    fechado: true,
  }
}

function medicao(valor: number | null, naoAferido = false): Measurement {
  return { valor, naoAferido }
}

function exameFisicoVazio(): ExameFisico {
  const vitais = {} as Record<VitalKey, Measurement>

  for (const vital of VITAIS) {
    vitais[vital] = medicao(null)
  }

  const sistemas = {} as ExameFisico['sistemas']

  for (const sistema of SISTEMAS) {
    sistemas[sistema] = { status: 'nao-avaliado', nota: '' }
  }

  return { vitais, mucosas: 'nao-avaliado', hidratacao: '', sistemas, observacao: '' }
}

function anamneseVazia(): Anamnese {
  return {
    queixaPrincipal: '',
    historia: '',
    duracaoSintomas: '',
    evolucao: '',
    antecedentes: [],
    apetite: '',
    evacuacao: '',
    miccao: '',
    ambiente: '',
    vacinacaoEmDia: null,
    vermifugacaoEmDia: null,
  }
}

function condutaVazia(): CarePlan {
  return {
    orientacoes: '',
    prescricoes: [],
    examesSolicitados: [],
    retorno: { emDias: null, typeId: null, appointmentId: null },
  }
}

export function encounterVazio(appointment: Appointment, abertoEm: string): Encounter {
  return {
    id: `enc-${appointment.id}`,
    appointmentId: appointment.id,
    petId: appointment.petId,
    tutorId: appointment.tutorId,
    professionalId: appointment.professionalId,
    status: 'rascunho',
    abertoEm,
    finalizadoEm: null,
    anamnese: anamneseVazia(),
    exameFisico: exameFisicoVazio(),
    diagnosticos: [],
    conduta: condutaVazia(),
    versao: 1,
    lock: null,
    preConsulta: null,
  }
}

function encounterPreenchido(appointment: Appointment, pet: Pet, rng: () => number): Encounter {
  const base = encounterVazio(appointment, appointment.inicio)

  /**
   * Cirurgia sorteia entre os diagnósticos que levam alguém à mesa. Sorteando do catálogo
   * inteiro saía "Cirurgia — Dermatite alérgica a pulgas", e quem entende do assunto para de
   * ler a tela ali.
   */
  const catalogo =
    tipoPorId(appointment.typeId).kind === 'cirurgia'
      ? diagnosisCatalogFixture.filter((item) => item.sistema === 'locomotor')
      : diagnosisCatalogFixture

  const diagnostico = pickFrom(rng, catalogo, diagnosisCatalogFixture[0]!)
  const foraDaFaixa = rng() < 0.35

  const exameFisico: ExameFisico = {
    ...base.exameFisico,
    vitais: {
      ...base.exameFisico.vitais,
      peso: medicao(pet.pesoKg),
      temperatura: medicao(foraDaFaixa ? 39.9 : 38.4),
      frequenciaCardiaca: medicao(pet.especie === 'felina' ? 180 : 104),
      frequenciaRespiratoria: medicao(28),
      tempoPreenchimentoCapilar: medicao(null, true),
      escoreCorporal: medicao(intBetween(rng, 3, 7)),
      pressaoSistolica: medicao(null, true),
    },
    sistemas: {
      ...base.exameFisico.sistemas,
      cardiovascular: { status: 'normal', nota: '' },
      digestorio: {
        status: foraDaFaixa ? 'alterado' : 'normal',
        nota: foraDaFaixa ? 'Dor à palpação em abdome cranial.' : '',
      },
    },
    observacao: '',
  }

  /**
   * O tipo do diagnóstico varia entre os três possíveis. Sortear só entre dois deixava
   * "diferencial" sem nenhuma ocorrência no dataset inteiro — e o que não aparece na
   * demonstração não é revisado por ninguém.
   */
  const tiposDeDiagnostico: Diagnosis['kind'][] = ['presuntivo', 'definitivo', 'diferencial']

  const diagnosticos: Diagnosis[] = [
    {
      id: `diag-${appointment.id}`,
      codigo: diagnostico.codigo,
      descricao: diagnostico.descricao,
      kind: pickFrom(rng, tiposDeDiagnostico, 'presuntivo'),
    },
  ]

  /** Um segundo diagnóstico em parte dos casos, para a coluna "+1" da lista existir. */
  if (rng() < 0.3) {
    const outro = pickFrom(rng, diagnosisCatalogFixture, diagnosisCatalogFixture[0]!)

    if (outro.codigo !== diagnostico.codigo) {
      diagnosticos.push({
        id: `diag-${appointment.id}-2`,
        codigo: outro.codigo,
        descricao: outro.descricao,
        kind: 'diferencial',
      })
    }
  }

  return {
    ...base,
    status: 'finalizado',
    finalizadoEm: appointment.fim,
    anamnese: {
      ...base.anamnese,
      queixaPrincipal: diagnostico.descricao,
      historia: 'Responsável relata início dos sinais há poucos dias, sem outros animais afetados.',
      duracaoSintomas: `${intBetween(rng, 1, 9)} dias`,
      apetite: rng() < 0.5 ? 'reduzido' : 'normal',
      evacuacao: 'normal',
      miccao: 'normal',
      ambiente: 'domiciliar',
      vacinacaoEmDia: true,
      vermifugacaoEmDia: rng() < 0.7,
    },
    exameFisico,
    diagnosticos,
    conduta: {
      ...condutaVazia(),
      orientacoes: orientacaoDe(diagnostico.codigo),
      /**
       * Toda consulta finalizada sai com prescrição. Antes nenhuma saía, e o bloco de
       * medicamentos — o mais delicado do prontuário, com dose calculada e conferência de
       * alergia — nunca aparecia numa demonstração nem numa folha impressa.
       */
      prescricoes: montarPrescricoes(appointment, pet, rng),
      examesSolicitados: sortearExames(rng),
      retorno: {
        emDias: pickFrom(rng, [7, 15, 30, null], 15),
        typeId: 'tipo-retorno',
        appointmentId: null,
      },
    },
    versao: 3,
  }
}

/**
 * Orientação ao responsável, escrita para o diagnóstico.
 *
 * Todas as consultas saíam com a mesma frase sobre dieta leve — inclusive as de otite e as de
 * displasia. Repetida uma dúzia de vezes na linha do tempo de um paciente, ela anunciava que o
 * dado é de mentira antes de qualquer outra coisa na tela.
 */
const ORIENTACOES: Record<string, string> = {
  'GE-01': 'Dieta leve e fracionada por 5 dias. Água à vontade e retorno se houver vômito.',
  'DR-04': 'Controle de pulgas do animal e do ambiente. Evitar banho nos 3 primeiros dias.',
  'DR-09': 'Limpeza do conduto a cada 2 dias, antes da medicação. Não usar hastes de algodão.',
  'CV-02': 'Contar a frequência respiratória em repouso, uma vez por dia. Evitar esforço.',
  'UR-03': 'Ração renal e água disponível em vários pontos da casa. Pesar a cada 15 dias.',
  'UR-07': 'Aumentar a água na dieta e reduzir estresse. Caixa de areia limpa e reservada.',
  'LO-05': 'Repouso relativo, passeios curtos na coleira. Evitar escada e piso liso.',
  'LO-11': 'Repouso em local restrito por 4 semanas. Nada de pular ou subir em móveis.',
  'RE-02': 'Peitoral em vez de coleira. Evitar calor e agitação; observar ronco e cansaço.',
  'NE-06': 'Ambiente sem obstáculos e sem escada. Auxiliar na alimentação enquanto oscilar.',
  'LF-01': 'Observar novos aumentos de linfonodo e medir a temperatura uma vez por dia.',
  'GN-00': 'Manter vacinação e vermifugação em dia. Retorno de rotina em 12 meses.',
}

function orientacaoDe(codigo: string): string {
  return ORIENTACOES[codigo] ?? 'Manter dieta leve por 5 dias e retornar em caso de piora.'
}

/**
 * Prescrição com a dose já calculada pelo mesmo domínio que a tela usa — nada de número
 * inventado no dado de mentira, senão a demonstração mostra uma conta que o produto não faz.
 *
 * Quando o paciente tem alergia registrada ao princípio ativo sorteado, a prescrição nasce
 * **confirmada**: no histórico ela já foi decidida. O caso pendente de confirmação é plantado à
 * parte, no rascunho de hoje, que é onde a interface precisa cobrar a decisão.
 */
function montarPrescricoes(appointment: Appointment, pet: Pet, rng: () => number): Prescription[] {
  const quantidade = rng() < 0.35 ? 2 : 1
  const escolhidos: Medication[] = []

  while (escolhidos.length < quantidade) {
    const candidato = pickFrom(rng, medicationsFixture, medicationsFixture[0] as Medication)

    if (!escolhidos.some((item) => item.id === candidato.id)) {
      escolhidos.push(candidato)
    }
  }

  return escolhidos.map((medicamento, indice) => {
    const mgPorKg =
      medicamento.doseUsualMgKg.min +
      (medicamento.doseUsualMgKg.max - medicamento.doseUsualMgKg.min) * rng()
    const frequencia = pickFrom(rng, [8, 12, 24], 12)
    const duracao = pickFrom(rng, [5, 7, 10], 7)

    const calculo = calcularDose({
      medicamento,
      pesoKg: pet.pesoKg,
      mgPorKg: Math.round(mgPorKg * 100) / 100,
      frequenciaHoras: frequencia,
      duracaoDias: duracao,
    })

    return {
      id: `presc-${appointment.id}-${indice}`,
      medicamentoId: medicamento.id,
      via: pickFrom(rng, medicamento.viasPermitidas, 'oral'),
      calculo: calculo ?? {
        medicamentoId: medicamento.id,
        mgPorKg,
        pesoKg: pet.pesoKg ?? 0,
        mgPorAdministracao: 0,
        quantidadeApresentacao: 0,
        frequenciaHoras: frequencia,
        duracaoDias: duracao,
        totalAdministracoes: 0,
      },
      observacao: indice === 0 ? 'Administrar após a refeição.' : '',
      alergiaConfirmada: alergiaConflitante(pet, medicamento) !== null,
    }
  })
}

/** Pelo menos um exame na maioria dos atendimentos; dois em parte deles. */
function sortearExames(rng: () => number): string[] {
  const sorteio = rng()

  if (sorteio < 0.25) {
    return []
  }

  const primeiro = pickFrom(rng, examCatalogFixture, examCatalogFixture[0]!).id

  if (sorteio < 0.7) {
    return [primeiro]
  }

  const segundo = pickFrom(rng, examCatalogFixture, examCatalogFixture[0]!).id

  return segundo === primeiro ? [primeiro] : [primeiro, segundo]
}

// ---------------------------------------------------------------------------
// Os 12 casos difíceis, plantados à mão no dia âncora
// ---------------------------------------------------------------------------

function casosDoDiaAncora(ancora: ISODate): {
  appointments: Appointment[]
  blocks: Block[]
  casos: CasoDificil[]
} {
  const rotaAgenda = (foco: string) => `/clinica/agenda?data=${ancora}&foco=${foco}`
  const appointments: Appointment[] = []

  // 1. Sobreposição: dois pacientes na mesma profissional, no mesmo horário.
  appointments.push(
    montarAppointment({
      id: 'apt-sobrepoe-a',
      petId: 'pet-luna',
      professionalId: 'prof-ana',
      typeId: 'tipo-consulta',
      data: ancora,
      inicioMin: clockToMinutes('09:00'),
      observacao: 'Retorno de gastroenterite.',
    }),
    montarAppointment({
      id: 'apt-sobrepoe-b',
      petId: 'pet-tofu',
      professionalId: 'prof-ana',
      typeId: 'tipo-consulta',
      data: ancora,
      inicioMin: clockToMinutes('09:15'),
      observacao: 'Reavaliação renal.',
    }),
  )

  /*
   * 2. Encaixe: emergência **dentro de um bloco reservado**.
   *
   * O caso difícil do requisito não é "encaixe fora da grade" — é o encaixe atravessando um
   * horário que alguém tinha protegido. Antes, este atendimento caía às 10:20, quando nenhum
   * bloqueio da prof-ana cobria o horário: a grade mostrava um encaixe comum e o conflito
   * `block-invasion` nunca era exercitado.
   *
   * Agora ele nasce às 16:20, por cima do `bloco-pessoal` da prof-ana — e a tela precisa
   * mostrar a emergência por cima da faixa reservada, com o aviso, **sem impedir**. É a
   * situação real: o cachorro atropelado não espera o compromisso pessoal terminar.
   */
  appointments.push(
    montarAppointment({
      id: 'apt-encaixe',
      petId: 'pet-thor',
      professionalId: 'prof-tiago',
      typeId: 'tipo-emergencia',
      data: ancora,
      inicioMin: clockToMinutes('16:20'),
      encaixe: true,
      origem: 'encaixe',
      observacao: 'Atropelamento. Trazido pela recepção por cima do bloqueio.',
    }),
  )

  // 3. Duas salas: a mesma cirurgia ocupa centro cirúrgico e recuperação, e as duas colunas
  //    andam juntas quando alguém arrasta.
  appointments.push(
    montarAppointment({
      id: 'apt-cirurgia-centro',
      petId: 'pet-bento',
      professionalId: 'prof-caio',
      typeId: 'tipo-cirurgia',
      data: ancora,
      inicioMin: clockToMinutes('13:30'),
      roomIds: ['sala-cirurgia'],
      linkedGroupId: null,
      observacao: 'Osteossíntese de fêmur.',
    }),
    montarAppointment({
      id: 'apt-cirurgia-recuperacao',
      petId: 'pet-bento',
      professionalId: 'prof-marcia',
      typeId: 'tipo-cirurgia',
      data: ancora,
      inicioMin: clockToMinutes('13:30'),
      duracaoMin: 120,
      roomIds: ['sala-recuperacao'],
      linkedGroupId: 'grupo-cirurgia-bento',
      observacao: 'Anestesia e recuperação.',
    }),
  )
  const centro = appointments.find((item) => item.id === 'apt-cirurgia-centro')

  if (centro) {
    centro.linkedGroupId = 'grupo-cirurgia-bento'
  }

  // 4. Atravessa o almoço: banho longo que invade o intervalo. Legível e marcado, não escondido.
  appointments.push(
    montarAppointment({
      id: 'apt-banho-almoco',
      petId: 'pet-maximiliano',
      professionalId: 'prof-helena',
      typeId: 'tipo-banho',
      data: ancora,
      inicioMin: clockToMinutes('11:30'),
      roomIds: ['sala-banho'],
      observacao: 'Tosa higiênica completa.',
    }),
  )

  // 8. Cancelado continua visível: sumir da grade é como a recepção perde a informação de que
  //    o horário vagou.
  appointments.push(
    montarAppointment({
      id: 'apt-cancelado',
      petId: 'pet-sushi',
      professionalId: 'prof-tiago',
      typeId: 'tipo-consulta',
      data: ancora,
      inicioMin: clockToMinutes('15:00'),
      statusFixo: 'cancelado',
      motivoCancelamento: 'responsavel-desmarcou',
      observacao: 'Responsável avisou na véspera.',
    }),
  )

  /**
   * "Finalizado" e "falta" nascem do relógio: às oito da manhã nada terminou ainda, e a grade
   * abria sem nenhum exemplo dos dois. Estes dois são fixos no início do expediente — cedo o
   * bastante para serem plausíveis a qualquer hora em que a demonstração seja aberta.
   */
  appointments.push(
    montarAppointment({
      id: 'apt-finalizado-cedo',
      petId: 'pet-oliver',
      professionalId: 'prof-ana',
      typeId: 'tipo-vacina',
      data: ancora,
      inicioMin: clockToMinutes('08:00'),
      statusFixo: 'finalizado',
      origem: 'app',
      observacao: 'Reforço anual.',
    }),
    montarAppointment({
      id: 'apt-falta-hoje',
      petId: 'pet-jack',
      professionalId: 'prof-helena',
      typeId: 'tipo-consulta',
      data: ancora,
      inicioMin: clockToMinutes('08:00'),
      statusFixo: 'falta',
      origem: 'fila',
    }),
  )

  appointments.push(
    montarAppointment({
      id: 'apt-cancelado-clinica',
      petId: 'pet-frida',
      professionalId: 'prof-helena',
      typeId: 'tipo-retorno',
      data: ancora,
      inicioMin: clockToMinutes('16:45'),
      statusFixo: 'cancelado',
      motivoCancelamento: 'clinica-remarcou',
      origem: 'telefone',
      observacao: 'Profissional convocada para uma emergência.',
    }),
  )

  // 10. Alergia registrada versus prescrição: a conduta encosta no princípio ativo da alergia.
  appointments.push(
    montarAppointment({
      id: 'apt-alergia',
      petId: 'pet-nina',
      professionalId: 'prof-tiago',
      typeId: 'tipo-consulta',
      data: ancora,
      inicioMin: clockToMinutes('16:00'),
      observacao: 'Quadro álgico; avaliar analgesia.',
    }),
  )

  // 11. Nomes extremos, os três no mesmo dia e na mesma tela.
  appointments.push(
    montarAppointment({
      id: 'apt-nome-curto',
      petId: 'pet-ni',
      professionalId: 'prof-helena',
      typeId: 'tipo-vacina',
      data: ancora,
      inicioMin: clockToMinutes('08:30'),
    }),
    montarAppointment({
      id: 'apt-nome-acentuado',
      petId: 'pet-acai',
      professionalId: 'prof-helena',
      typeId: 'tipo-retorno',
      data: ancora,
      inicioMin: clockToMinutes('08:45'),
    }),
  )

  /*
   * 13. Agendamento vindo do app, com pré-consulta respondida na véspera.
   *
   * Precisa ser um atendimento **que ainda vai acontecer**: pré-consulta num prontuário já
   * fechado não demonstra nada, porque o vet já viu o paciente. Antes o único atendimento com
   * `origem: 'app'` no dia era um finalizado das oito da manhã — e o painel nunca aparecia.
   */
  appointments.push(
    montarAppointment({
      id: 'apt-pre-consulta',
      petId: 'pet-amora',
      professionalId: 'prof-helena',
      typeId: 'tipo-consulta',
      data: ancora,
      inicioMin: clockToMinutes('15:30'),
      origem: 'app',
      statusFixo: 'confirmado',
      observacao: 'Agendado pelo app. Responsável respondeu a pré-consulta.',
    }),
  )

  // 12. Retorno indicado sem horário marcado — receita parada na mesa.
  appointments.push(
    montarAppointment({
      id: 'apt-retorno-pendente',
      petId: 'pet-cacau',
      professionalId: 'prof-ana',
      typeId: 'tipo-consulta',
      data: ancora,
      inicioMin: clockToMinutes('14:00'),
      observacao: 'Discopatia em acompanhamento.',
    }),
  )

  /*
   * 14. Os três pacientes do resumo "Este pet em 30 segundos", todos com horário hoje: o botão
   * que abre o atendimento a partir do resumo precisa de um atendimento para abrir. Estado
   * fixo, fora do sorteio do relógio — o resumo é lido **antes** de entrar na sala.
   */
  appointments.push(
    ...HORARIOS_DE_HOJE.map((item) =>
      montarAppointment({
        id: item.id,
        petId: item.petId,
        professionalId: 'prof-helena',
        typeId: item.typeId,
        data: ancora,
        inicioMin: clockToMinutes(item.inicio),
        statusFixo: 'confirmado',
        origem: item.origem,
        observacao: item.observacao,
      }),
    ),
  )

  // 5. Bloqueio recorrente: reunião de equipe toda terça e quinta, materializada na data pedida.
  const blocks: Block[] = [
    {
      id: 'bloco-reuniao',
      professionalId: null,
      roomId: null,
      inicio: iso(addDays(ancora, -28), clockToMinutes('17:00')),
      fim: iso(addDays(ancora, -28), clockToMinutes('18:00')),
      motivo: 'reuniao',
      detalhe: 'Reunião clínica semanal',
      recorrencia: { kind: 'weekly', weekdays: [2, 4], ate: null },
      materializadoDe: null,
    },
    {
      id: 'bloco-manutencao',
      professionalId: null,
      roomId: 'sala-exame',
      inicio: iso(ancora, clockToMinutes('10:00')),
      fim: iso(ancora, clockToMinutes('11:30')),
      motivo: 'manutencao',
      detalhe: 'Calibração do aparelho de ultrassom',
      recorrencia: null,
      materializadoDe: null,
    },
    {
      id: 'bloco-pessoal',
      professionalId: 'prof-tiago',
      roomId: null,
      inicio: iso(ancora, clockToMinutes('16:00')),
      fim: iso(ancora, clockToMinutes('17:00')),
      motivo: 'bloqueio-pessoal',
      detalhe: 'Compromisso pessoal',
      recorrencia: null,
      materializadoDe: null,
    },
    {
      /** Férias entram num dia à frente: no dia âncora esvaziariam uma coluna inteira. */
      id: 'bloco-ferias',
      professionalId: 'prof-marcia',
      roomId: null,
      inicio: iso(addDays(ancora, 3), clockToMinutes('08:00')),
      fim: iso(addDays(ancora, 3), clockToMinutes('19:00')),
      motivo: 'ferias',
      detalhe: 'Férias',
      recorrencia: null,
      materializadoDe: null,
    },
    {
      id: 'bloco-almoco',
      professionalId: null,
      roomId: null,
      inicio: iso(addDays(ancora, -28), clockToMinutes('12:00')),
      fim: iso(addDays(ancora, -28), clockToMinutes('13:00')),
      motivo: 'almoco',
      detalhe: '',
      recorrencia: { kind: 'weekly', weekdays: [1, 2, 3, 4, 5], ate: null },
      materializadoDe: null,
    },
  ]

  const casos: CasoDificil[] = [
    {
      id: 'sobreposicao',
      rota: rotaAgenda('apt-sobrepoe-a'),
      appointmentId: 'apt-sobrepoe-a',
      encounterId: null,
    },
    {
      id: 'encaixe',
      rota: rotaAgenda('apt-encaixe'),
      appointmentId: 'apt-encaixe',
      encounterId: null,
    },
    {
      id: 'duas-salas',
      rota: `/clinica/agenda?data=${ancora}&agrupar=sala&foco=apt-cirurgia-centro`,
      appointmentId: 'apt-cirurgia-centro',
      encounterId: null,
    },
    {
      id: 'atravessa-almoco',
      rota: rotaAgenda('apt-banho-almoco'),
      appointmentId: 'apt-banho-almoco',
      encounterId: null,
    },
    {
      id: 'bloqueio-recorrente',
      rota: `/clinica/agenda?data=${proximoDiaDaSemana(ancora, 2)}`,
      appointmentId: null,
      encounterId: null,
    },
    {
      id: 'dia-fechado',
      rota: `/clinica/agenda?data=${addDays(ancora, 9)}`,
      appointmentId: null,
      encounterId: null,
    },
    {
      id: 'falta-reincidente',
      rota: '/clinica/faltas',
      appointmentId: null,
      encounterId: null,
    },
    {
      id: 'cancelado-visivel',
      rota: rotaAgenda('apt-cancelado'),
      appointmentId: 'apt-cancelado',
      encounterId: null,
    },
    { id: 'fila-expirando', rota: '/clinica/fila', appointmentId: null, encounterId: null },
    {
      id: 'alergia-prescricao',
      rota: '/clinica/atendimento/enc-apt-alergia',
      appointmentId: 'apt-alergia',
      encounterId: 'enc-apt-alergia',
    },
    {
      id: 'nomes-extremos',
      rota: rotaAgenda('apt-nome-acentuado'),
      appointmentId: 'apt-nome-acentuado',
      encounterId: null,
    },
    {
      id: 'retorno-sem-horario',
      rota: '/clinica/meu-dia',
      appointmentId: 'apt-retorno-pendente',
      encounterId: null,
    },
    ...(
      [
        ['resumo-perda-de-peso', PET_PERDA_DE_PESO, 'apt-resumo-perola'],
        ['resumo-diario-cheio', PET_DIARIO_CHEIO, 'apt-resumo-chico'],
        ['resumo-pet-novo', PET_NOVO, 'apt-resumo-pacoca'],
      ] as const
    ).map(([id, petId, appointmentId]) => ({
      id,
      rota: `/clinica/paciente/${petId}/resumo`,
      appointmentId,
      encounterId: null,
    })),
  ]

  return { appointments, blocks, casos }
}

function proximoDiaDaSemana(from: ISODate, weekday: number): ISODate {
  for (let offset = 0; offset < 7; offset += 1) {
    const candidato = addDays(from, offset)

    if (weekdayOf(candidato) === weekday) {
      return candidato
    }
  }

  return from
}

// ---------------------------------------------------------------------------
// Preenchimento determinístico
// ---------------------------------------------------------------------------

/**
 * Paciente fora dos dias futuros de propósito: sem ele, todo paciente teria horário marcado e o
 * filtro "sem horário marcado" nasceria com contagem zero — uma opção que ninguém consegue
 * exercitar. Os pets de `DA_DEMONSTRACAO_DO_APP` também ficam sem, por outro motivo.
 */
const SEM_AGENDA_FUTURA = ['pet-duque']

/**
 * Os pets da responsável da demonstração do app não entram em sorteio nenhum, nem no passado.
 *
 * A história deles é o cenário plantado em `seed-responsavel.ts`, contada igual no portal e no
 * celular (`npm run contrato:demo`). Sorteados, ganhavam um horário a cada poucos dias e
 * diagnóstico de outra espécie — o jabuti com síndrome braquicefálica —, e o app mostraria uma
 * agenda que responsável nenhum tem.
 */
const DA_DEMONSTRACAO_DO_APP = new Set(
  petsFixture.filter((pet) => pet.tutorId === RESPONSAVEL_DA_DEMONSTRACAO).map((pet) => pet.id),
)

/** Quem o gerador pode sortear para um horário. */
function petsSorteaveis(): Pet[] {
  return petsFixture.filter((pet) => !DA_DEMONSTRACAO_DO_APP.has(pet.id))
}

/**
 * Quem pode receber horário no dia âncora e nos dias futuros.
 *
 * Duas exclusões além das de `petsSorteaveis`, por dois motivos diferentes.
 * `SEM_AGENDA_FUTURA` mantém viva a opção "sem horário marcado". O paciente do óbito sai porque
 * ele morreu: agenda futura para ele seria a incoerência que a tela de faltas existe justamente
 * para não produzir.
 *
 * Excluir na **origem** e não filtrar depois é o que preserva os quarenta atendimentos do dia
 * âncora. A primeira versão filtrava no fim e levava junto os horários que o gerador tinha dado
 * a esse paciente hoje — o dia perdia atendimentos e o teste de fumaça do seed caía.
 */
function petsComAgenda(): Pet[] {
  return petsSorteaveis().filter(
    (pet) => !SEM_AGENDA_FUTURA.includes(pet.id) && pet.id !== PET_DO_OBITO,
  )
}

function preencherDia(
  data: ISODate,
  quantidade: number,
  rng: () => number,
  ocupados: Set<string>,
  prefixo: string,
  salasJaTomadas: Set<string> = new Set(),
  petsDisponiveis: Pet[] = petsSorteaveis(),
): Appointment[] {
  const horario = clinicFixture.horarios.find((item) => item.weekday === weekdayOf(data))

  if (!horario || horario.fechado || quantidade <= 0) {
    return []
  }

  const abre = clockToMinutes(horario.expediente.inicio)
  const fecha = clockToMinutes(horario.expediente.fim)
  const ativos = professionalsFixture.filter((professional) => professional.ativo)
  /**
   * Lista com peso, não conjunto: consulta é o que mais acontece, cirurgia é rara. Sortear
   * uniformemente daria uma clínica que opera tanto quanto consulta — e deixar a cirurgia de
   * fora, como antes, deixava o histórico sem nenhum evento cirúrgico para revisar.
   */
  const tiposSorteaveis = [
    'tipo-consulta',
    'tipo-consulta',
    'tipo-consulta',
    'tipo-retorno',
    'tipo-retorno',
    'tipo-vacina',
    'tipo-exame',
    'tipo-banho',
    'tipo-cirurgia',
  ].map((id) => tipoPorId(id))

  const gerados: Appointment[] = []
  /**
   * Ocupação de sala, bloco a bloco. Sem isto o gerador dava a mesma sala de banho a todos os
   * banhos do dia e a mesma sala de imagem a todos os exames — e a grade nascia com aviso de
   * conflito em quase todo card. Aviso que aparece sempre é aviso que ninguém lê.
   */
  const salasOcupadas = new Set<string>(salasJaTomadas)
  /** Um paciente não está em duas salas ao mesmo tempo — e um dataset cheio disso grita lobo. */
  const petsOcupados = new Set<string>()
  let tentativas = 0

  function blocosDe(chave: string, inicioMin: number, duracao: number) {
    const blocos: string[] = []

    for (
      let minuto = inicioMin;
      minuto < inicioMin + duracao;
      minuto += clinicFixture.slotMinutos
    ) {
      blocos.push(`${chave}|${minuto}`)
    }

    return blocos
  }

  while (gerados.length < quantidade && tentativas < quantidade * 20) {
    tentativas += 1

    const professional = pickFrom(rng, ativos, ativos[0] as Professional)
    const tipo = pickFrom(rng, tiposSorteaveis, tiposSorteaveis[0] as AppointmentType)
    const pet = pickFrom(rng, petsDisponiveis, petsDisponiveis[0] as Pet)
    const passos = Math.floor((fecha - abre - tipo.duracaoMinutos) / clinicFixture.slotMinutos)

    if (passos <= 0) {
      continue
    }

    const inicioMin = abre + intBetween(rng, 0, passos) * clinicFixture.slotMinutos
    const chave = `${professional.id}|${inicioMin}`

    if (ocupados.has(chave)) {
      continue
    }

    const blocosDoPet = blocosDe(pet.id, inicioMin, tipo.duracaoMinutos)

    if (blocosDoPet.some((bloco) => petsOcupados.has(bloco))) {
      continue
    }

    /** Primeira sala compatível que esteja livre no intervalo inteiro. */
    const candidatas = roomsFixture.filter(
      (room) => tipo.salasCompativeis.length === 0 || tipo.salasCompativeis.includes(room.kind),
    )

    const sala = candidatas.find(
      (room) =>
        !blocosDe(room.id, inicioMin, tipo.duracaoMinutos).some((bloco) =>
          salasOcupadas.has(bloco),
        ),
    )

    if (!sala) {
      continue
    }

    ocupados.add(chave)

    for (const bloco of blocosDe(sala.id, inicioMin, tipo.duracaoMinutos)) {
      salasOcupadas.add(bloco)
    }

    for (const bloco of blocosDoPet) {
      petsOcupados.add(bloco)
    }

    gerados.push(
      montarAppointment({
        id: `${prefixo}-${gerados.length + 1}`,
        petId: pet.id,
        professionalId: professional.id,
        typeId: tipo.id,
        data,
        inicioMin,
        roomIds: [sala.id],
        /** As seis origens aparecem no dataset — nenhuma fica sem exemplo para revisar. */
        origem: pickFrom(
          rng,
          ['recepcao', 'recepcao', 'app', 'telefone', 'retorno', 'fila'] as const,
          'recepcao',
        ),
      }),
    )
  }

  return gerados
}

/**
 * O motivo de cada falta reincidente — e a **ausência** dele nas duas mais recentes.
 *
 * As quatro faltas do mesmo responsável são o caso que o painel existe para discutir, e o que
 * as torna discutíveis é a mistura: duas já foram apuradas e contam a mesma história
 * (transporte), duas ainda esperam ligação. Justificar as quatro esvaziaria a fila de trabalho
 * da tela; deixar as quatro em branco esconderia o que a justificativa mostra — que este
 * responsável não está sumindo, está sem como chegar.
 *
 * As justificadas são as **mais antigas** de propósito: é assim que a apuração anda na prática,
 * do fundo da fila para a frente.
 */
const MOTIVOS_DAS_REINCIDENTES: Array<Appointment['justificativaDeFalta']> = [
  /* 4 dias atrás e 11 dias atrás: ainda sem contato. */
  null,
  null,
  {
    motivo: 'transporte',
    canal: 'whatsapp',
    observacao: 'Sem carro no dia; pediu horário no fim da tarde.',
    professionalId: 'prof-ana',
    registradaEm: '',
  },
  {
    motivo: 'transporte',
    canal: 'telefone',
    observacao: 'Mesma dificuldade da vez anterior.',
    professionalId: 'prof-ana',
    registradaEm: '',
  },
]

/**
 * O paciente que morreu — o caso terminal do painel de faltas.
 *
 * Existe porque a tela precisa demonstrar o que o óbito **desliga**: a falta fica registrada e
 * contada, e a oferta de remarcação some. Sem um caso no dataset, o estado "caso encerrado" é
 * código que ninguém vê rodar.
 *
 * Fica num paciente só dele, longe do responsável reincidente: misturar as duas histórias faria
 * a demonstração contar que a clínica cobra remarcação de quem perdeu o animal — que é
 * exatamente o contrário do que a mudança serve para impedir.
 */
/**
 * Um paciente só dele, e sem papel em nenhum outro caso.
 *
 * A primeira escolha foi o Cacau, e foi errada duas vezes: ele é o caso plantado de "retorno
 * indicado sem horário marcado" no próprio dia âncora — que o filtro do óbito levava junto,
 * derrubando os quarenta atendimentos do dia — e carrega histórico de internação que a história
 * do óbito passaria a contradizer.
 *
 * A Lola não aparece em caso nenhum, e o alerta de braquicefálica que ela já tem no cadastro
 * torna a história plausível sem precisar inventar nada.
 */
const PET_DO_OBITO = 'pet-lola'

function faltaComObito(ancora: ISODate): Appointment {
  const data = nextBusinessDay(addDays(ancora, -9))

  return montarAppointment({
    id: 'apt-falta-obito',
    petId: PET_DO_OBITO,
    professionalId: 'prof-tiago',
    typeId: 'tipo-retorno',
    data,
    inicioMin: clockToMinutes('15:00'),
    statusFixo: 'falta',
    justificativaDeFalta: {
      motivo: 'obito',
      canal: 'telefone',
      observacao: 'Responsável avisou no dia seguinte. Não oferecer remarcação.',
      professionalId: 'prof-tiago',
      registradaEm: iso(addDays(data, 1), 11 * 60),
    },
  })
}

/**
 * Nada na agenda do paciente **depois do dia em que ele morreu**.
 *
 * O corte é na data do óbito, e não em hoje. A primeira versão cortava só o futuro, e o gerador
 * — que espalha atendimentos por todos os pacientes sem saber desta história — deixou uma
 * consulta quatro dias depois da morte: passada, portanto sobrevivente ao filtro, e visível no
 * painel como "reagendado para 18/09" embaixo de um óbito registrado em 14/09.
 *
 * O que vem antes fica: é o histórico do paciente, e apagá-lo seria fingir que o animal nunca
 * foi atendido.
 *
 * Isto é maquiagem de dataset, e não regra de negócio. A regra de verdade — a clínica saber que
 * o paciente morreu e parar de agendar — depende de um estado no cadastro do próprio paciente,
 * que este protótipo ainda não tem.
 */
function semAgendaDepoisDoObito(appointments: Appointment[]): Appointment[] {
  const obito = appointments.find((appointment) => appointment.id === 'apt-falta-obito')

  if (!obito) {
    return appointments
  }

  const diaDoObito = clock.dateOf(obito.inicio)

  return appointments.filter(
    (appointment) =>
      appointment.id === obito.id ||
      appointment.petId !== PET_DO_OBITO ||
      clock.dateOf(appointment.inicio) <= diaDoObito,
  )
}

function faltasReincidentes(ancora: ISODate): Appointment[] {
  /** Um responsável com histórico é o que dá o que discutir no painel de faltas. */
  return [4, 11, 18, 25].map((diasAtras, indice) => {
    const data = nextBusinessDay(addDays(ancora, -diasAtras))
    const motivo = MOTIVOS_DAS_REINCIDENTES[indice]

    return montarAppointment({
      id: `apt-falta-reincidente-${indice + 1}`,
      petId: 'pet-jack',
      professionalId: 'prof-ana',
      typeId: 'tipo-consulta',
      data,
      inicioMin: clockToMinutes('09:30'),
      statusFixo: 'falta',
      /* Apurada no dia seguinte ao da falta: é quando a recepção corre a lista. */
      justificativaDeFalta: motivo
        ? { ...motivo, registradaEm: iso(addDays(data, 1), 10 * 60) }
        : null,
    })
  })
}

function montarFila(ancora: ISODate): WaitlistEntry[] {
  const agora = clock.nowIso()

  return [
    {
      id: 'fila-1',
      petId: 'pet-zeus',
      tutorId: 'tutor-rita',
      typeId: 'tipo-consulta',
      professionalId: 'prof-ana',
      prioridade: 'urgente',
      janelas: [
        { weekday: 1, inicio: '08:00', fim: '12:00' },
        { weekday: 3, inicio: '14:00', fim: '18:00' },
      ],
      status: 'ofertado',
      criadoEm: iso(addDays(ancora, -2), clockToMinutes('10:00')),
      /** Oferta perto de expirar: é o caso que testa o relógio da fila. */
      ofertaExpiraEm: iso(clock.dateOf(agora), clock.minutesOf(agora) + 4),
      ofertaSlotInicio: iso(ancora, clockToMinutes('17:00')),
      observacao: 'Aceita qualquer profissional em caso de urgência.',
    },
    {
      id: 'fila-2',
      petId: 'pet-pandora',
      tutorId: 'tutor-heitor',
      typeId: 'tipo-vacina',
      professionalId: null,
      prioridade: 'normal',
      janelas: [{ weekday: 5, inicio: '08:00', fim: '13:00' }],
      status: 'aguardando',
      criadoEm: iso(addDays(ancora, -5), clockToMinutes('15:30')),
      ofertaExpiraEm: null,
      ofertaSlotInicio: null,
      observacao: '',
    },
    {
      id: 'fila-3',
      petId: 'pet-amora',
      tutorId: 'tutor-luciana',
      typeId: 'tipo-retorno',
      professionalId: 'prof-tiago',
      prioridade: 'preferencial',
      janelas: [
        { weekday: 2, inicio: '08:00', fim: '12:00' },
        { weekday: 4, inicio: '08:00', fim: '12:00' },
      ],
      status: 'aguardando',
      criadoEm: iso(addDays(ancora, -1), clockToMinutes('11:15')),
      ofertaExpiraEm: null,
      ofertaSlotInicio: null,
      observacao: 'Responsável só consegue vir pela manhã.',
    },
    {
      /** Alguém que já aceitou a vaga: sem isto, "Aceitou" não existia no dataset. */
      id: 'fila-aceito',
      petId: 'pet-bidu',
      tutorId: 'tutor-sergio',
      typeId: 'tipo-vacina',
      professionalId: 'prof-helena',
      prioridade: 'normal',
      janelas: [{ weekday: 4, inicio: '14:00', fim: '18:00' }],
      status: 'aceito',
      criadoEm: iso(addDays(ancora, -4), clockToMinutes('08:40')),
      ofertaExpiraEm: iso(addDays(ancora, -1), clockToMinutes('09:00')),
      ofertaSlotInicio: iso(addDays(ancora, 6), clockToMinutes('15:00')),
      observacao: 'Confirmou por telefone.',
    },
    {
      /**
       * Segunda oferta em aberto, com prazo folgado. A primeira expira em quatro minutos e
       * pinta de vermelho; sozinha, ela fazia parecer que oferta da fila é sempre emergência.
       */
      id: 'fila-ofertado-tranquilo',
      petId: 'pet-tofu',
      tutorId: 'tutor-rita',
      typeId: 'tipo-consulta',
      professionalId: 'prof-ana',
      prioridade: 'normal',
      janelas: [{ weekday: 3, inicio: '08:00', fim: '12:00' }],
      status: 'ofertado',
      criadoEm: iso(addDays(ancora, -3), clockToMinutes('16:20')),
      ofertaExpiraEm: iso(clock.dateOf(agora), clock.minutesOf(agora) + 190),
      ofertaSlotInicio: iso(addDays(ancora, 2), clockToMinutes('09:30')),
      observacao: 'Prefere o fim da manhã.',
    },
    {
      id: 'fila-4',
      petId: 'pet-frida',
      tutorId: 'tutor-marina',
      typeId: 'tipo-consulta',
      professionalId: null,
      prioridade: 'normal',
      janelas: [{ weekday: 6, inicio: '08:00', fim: '13:00' }],
      status: 'expirado',
      criadoEm: iso(addDays(ancora, -9), clockToMinutes('09:00')),
      ofertaExpiraEm: iso(addDays(ancora, -7), clockToMinutes('09:20')),
      ofertaSlotInicio: iso(addDays(ancora, -7), clockToMinutes('16:00')),
      observacao: '',
    },
  ]
}

/**
 * Vacina, exame e cirurgia têm ícone próprio na linha do tempo. Mapear tudo para "consulta"
 * deixava três dos sete ícones sem nenhuma ocorrência para revisar.
 */
function kindDaLinhaDoTempo(typeId: string): TimelineEvent['kind'] {
  const kind = tipoPorId(typeId).kind

  switch (kind) {
    case 'cirurgia':
      return 'cirurgia'
    case 'vacina':
      return 'vacina'
    case 'exame':
      return 'exame'
    default:
      return 'consulta'
  }
}

function montarTimeline(encounters: Encounter[], appointments: Appointment[]): TimelineEvent[] {
  const porId = new Map(appointments.map((appointment) => [appointment.id, appointment]))
  const eventos: TimelineEvent[] = []

  for (const encounter of encounters) {
    if (encounter.status !== 'finalizado') {
      continue
    }

    const appointment = porId.get(encounter.appointmentId)

    if (!appointment) {
      continue
    }

    eventos.push({
      id: `tl-${encounter.id}`,
      petId: encounter.petId,
      kind: kindDaLinhaDoTempo(appointment.typeId),
      em: encounter.finalizadoEm ?? appointment.fim,
      titulo: encounter.diagnosticos[0]?.descricao ?? encounter.anamnese.queixaPrincipal,
      resumo: encounter.conduta.orientacoes,
      encounterId: encounter.id,
      appointmentId: appointment.id,
    })
  }

  for (const appointment of appointments) {
    if (appointment.status !== 'falta') {
      continue
    }

    eventos.push({
      id: `tl-falta-${appointment.id}`,
      petId: appointment.petId,
      kind: 'falta',
      em: appointment.inicio,
      titulo: '',
      resumo: '',
      encounterId: null,
      appointmentId: appointment.id,
    })
  }

  eventos.push(...internacoesPlantadas(encounters))

  return eventos.sort((a, b) => b.em.localeCompare(a.em))
}

/**
 * Vacinas aplicadas, plantadas para a carteira e o recall existirem na demonstração.
 *
 * A distribuição é deliberada e cobre as quatro situações que a lista de chamada precisa
 * mostrar — **em dia, a vencer, vencido e série incompleta**. Sem um caso de cada, a tela de
 * recall abriria com uma pilha só e o vendedor não teria o que apontar.
 *
 * As datas nascem relativas a hoje pelo mesmo motivo do resto do dataset: data fixa morre na
 * semana seguinte.
 */
/**
 * Procedimentos e aplicações plantados.
 *
 * Três casos que a tela precisa saber desenhar, e que o dataset não produzia de outro jeito:
 * o ato **da consulta** (com elo para o prontuário), o ato **avulso** — contado pelo responsável,
 * que a clínica não presenciou e por isso não tem profissional — e o procedimento antigo que
 * explica uma cicatriz.
 */
function atosPlantados(encounters: Encounter[], hoje: ISODate): AtoClinico[] {
  const PLANTADOS: Array<{
    petId: string
    kind: AtoClinico['kind']
    origem: AtoClinico['origem']
    medicamentoId: string | null
    descricao: string
    via: AtoClinico['via']
    doseTexto: string
    diasAtras: number
    minuto: number
    professionalId: string
    observacao: string
  }> = [
    {
      petId: 'pet-luna',
      kind: 'medicamento',
      origem: 'clinica',
      medicamentoId: 'med-dipirona',
      descricao: 'Dipirona',
      via: 'intravenosa',
      doseTexto: '310 mg',
      diasAtras: 14,
      minuto: 10 * 60 + 40,
      professionalId: 'prof-ana',
      observacao: 'Aplicada no consultório; dor cedeu em 20 min.',
    },
    {
      petId: 'pet-luna',
      kind: 'procedimento',
      origem: 'avulso',
      medicamentoId: null,
      descricao: 'Castração',
      via: null,
      doseTexto: '',
      diasAtras: 900,
      minuto: 9 * 60,
      professionalId: '',
      observacao: 'Relato do responsável: feita em outro serviço.',
    },
    {
      petId: 'pet-cacau',
      kind: 'procedimento',
      origem: 'clinica',
      medicamentoId: null,
      descricao: 'Limpeza dentária sob sedação',
      via: null,
      doseTexto: '',
      diasAtras: 96,
      minuto: 14 * 60 + 15,
      professionalId: 'prof-caio',
      observacao: 'Extração de dois incisivos.',
    },
    {
      petId: 'pet-nero',
      kind: 'medicamento',
      origem: 'clinica',
      medicamentoId: 'med-furosemida',
      descricao: 'Furosemida — primeira dose supervisionada',
      via: 'oral',
      doseTexto: '35 mg',
      diasAtras: 60,
      minuto: 11 * 60,
      professionalId: 'prof-helena',
      observacao: '',
    },
    {
      petId: 'pet-bento',
      kind: 'procedimento',
      origem: 'clinica',
      medicamentoId: null,
      descricao: 'Troca de curativo',
      via: null,
      doseTexto: '',
      diasAtras: 18,
      minuto: 16 * 60 + 30,
      professionalId: 'prof-tiago',
      observacao: 'Ferida limpa, sem secreção.',
    },
  ]

  return PLANTADOS.map((item, indice) => {
    const em = iso(addDays(hoje, -item.diasAtras), item.minuto)

    /** O elo para o prontuário só existe quando há um atendimento do mesmo dia para apontar. */
    const doDia =
      item.origem === 'clinica'
        ? (encounters.find(
            (encounter) =>
              encounter.petId === item.petId &&
              clock.dateOf(encounter.abertoEm) === clock.dateOf(em),
          ) ?? null)
        : null

    return {
      id: `ato-plantado-${indice}`,
      petId: item.petId,
      kind: item.kind,
      origem: item.origem,
      encounterId: doDia?.id ?? null,
      internacaoId: null,
      medicamentoId: item.medicamentoId,
      descricao: item.descricao,
      via: item.via,
      doseTexto: item.doseTexto,
      realizadoEm: em,
      professionalId: item.professionalId,
      observacao: item.observacao,
    }
  })
}

/**
 * Vacinas: o que entrou na geladeira e o que saiu dela.
 *
 * Lote e aplicação nascem **na mesma função**, e isso não é economia de arquivo. O que liga os
 * dois é o código impresso no frasco: se o lote fosse plantado de um lado e a aplicação de
 * outro, a primeira mudança em qualquer um dos dois lados deixaria a carteira do animal citando
 * um lote que o estoque não conhece — e a tela de estoque contaria consumo zero num lote que
 * girou o ano inteiro.
 *
 * A saída é atribuída por **PEPS**: cada aplicação consome o lote mais antigo daquela vacina que
 * ainda estava dentro da validade no dia e ainda tinha dose. É o que a clínica faz na geladeira,
 * e é o que faz o saldo de cada lote fechar sem nunca ficar negativo.
 */
type PerdaPlantada = { diasAtras: number; quantidade: number; motivo: MotivoDePerda }

type LotePlantado = {
  vacinaId: string
  codigo: string
  fornecedor: string
  recebidoDiasAtras: number
  /** Dias de prateleira contados do recebimento. */
  validadeEmDias: number
  quantidade: number
  /** Centavos por dose. */
  custoUnitario: number
  perdas: PerdaPlantada[]
  /**
   * Doses que ficam no frasco até depois do vencimento, qualquer que seja o sorteio da rotina.
   *
   * O movimento de fundo é sorteado com a data do dia na semente: num dia ele gasta o lote até a
   * última dose, noutro deixa três. O caso "lote vencido com dose dentro" não pode depender disso
   * — é ele que a demonstração abre no diálogo de aplicar para mostrar o frasco travado.
   */
  sobraGarantida?: number
  /** O que este lote existe para demonstrar. */
  caso: string
}

/**
 * Os lotes da geladeira.
 *
 * A lista é desenhada para que **cada situação do estoque tenha um caso**: sem um lote vencido
 * com saldo, a tela nunca mostra prejuízo; sem dois a vencer, não há o que usar primeiro; e sem
 * uma vacina zerada e outra abaixo do piso, o gráfico de compra abre reto e não há o que apontar
 * numa demonstração.
 */
const LOTES_PLANTADOS: LotePlantado[] = [
  /* Antirrábica: giro alto, três lotes na estrada — um morto, um correndo, um novo. */
  {
    vacinaId: 'vac-antirrabica-canina',
    codigo: 'RAB-2410',
    fornecedor: 'Distribuidora Vetline',
    recebidoDiasAtras: 420,
    validadeEmDias: 390,
    quantidade: 26,
    custoUnitario: 1890,
    /* Venceu com dose dentro: é o prejuízo que a tela precisa saber mostrar. */
    perdas: [{ diasAtras: 25, quantidade: 4, motivo: 'vencimento' }],
    caso: 'vencido com saldo',
  },
  {
    vacinaId: 'vac-antirrabica-canina',
    codigo: 'RAB-2503',
    fornecedor: 'Distribuidora Vetline',
    recebidoDiasAtras: 200,
    validadeEmDias: 245,
    quantidade: 8,
    custoUnitario: 1890,
    perdas: [],
    caso: 'a vencer',
  },
  {
    vacinaId: 'vac-antirrabica-canina',
    codigo: 'RAB-2601',
    fornecedor: 'Distribuidora Vetline',
    recebidoDiasAtras: 40,
    validadeEmDias: 440,
    quantidade: 6,
    custoUnitario: 1950,
    perdas: [],
    caso: 'ativo',
  },

  /* V10: a mais cara da lista, e a que mais dói perder por temperatura. */
  {
    vacinaId: 'vac-v10',
    codigo: 'V10-2409',
    fornecedor: 'PetSupply Nacional',
    recebidoDiasAtras: 380,
    validadeEmDias: 360,
    quantidade: 20,
    custoUnitario: 3250,
    /* Geladeira fora da faixa num fim de semana: leva o que estiver dentro, não uma dose só. */
    perdas: [{ diasAtras: 300, quantidade: 3, motivo: 'temperatura' }],
    sobraGarantida: 2,
    caso: 'vencido, perda por temperatura',
  },
  {
    vacinaId: 'vac-v10',
    codigo: 'V10-2505',
    fornecedor: 'PetSupply Nacional',
    recebidoDiasAtras: 150,
    validadeEmDias: 410,
    quantidade: 8,
    custoUnitario: 3390,
    perdas: [],
    caso: 'ativo',
  },
  {
    vacinaId: 'vac-v10',
    codigo: 'V10-2602',
    fornecedor: 'PetSupply Nacional',
    recebidoDiasAtras: 20,
    validadeEmDias: 560,
    quantidade: 6,
    custoUnitario: 3390,
    perdas: [],
    caso: 'ativo',
  },

  /* V4 felina: um lote grande chegando ao fim da prateleira com dose dentro. */
  {
    vacinaId: 'vac-v4-felina',
    codigo: 'V4F-2502',
    fornecedor: 'Distribuidora Vetline',
    recebidoDiasAtras: 300,
    validadeEmDias: 345,
    quantidade: 10,
    custoUnitario: 2990,
    perdas: [],
    caso: 'a vencer',
  },
  {
    vacinaId: 'vac-v4-felina',
    codigo: 'V4F-2601',
    fornecedor: 'Distribuidora Vetline',
    recebidoDiasAtras: 35,
    validadeEmDias: 515,
    quantidade: 6,
    custoUnitario: 3090,
    perdas: [{ diasAtras: 10, quantidade: 1, motivo: 'quebra' }],
    caso: 'ativo',
  },

  /* Gripe canina: giro baixo, lote único, sobra folgada. */
  {
    vacinaId: 'vac-gripe-canina',
    codigo: 'GRP-2504',
    fornecedor: 'PetSupply Nacional',
    recebidoDiasAtras: 240,
    validadeEmDias: 360,
    quantidade: 26,
    custoUnitario: 2290,
    perdas: [{ diasAtras: 90, quantidade: 1, motivo: 'quebra' }],
    caso: 'ativo',
  },

  /* Giárdia: fecha **abaixo do piso** — é o caso de "precisa comprar" sem estar zerado. */
  {
    vacinaId: 'vac-giardia',
    codigo: 'GIA-2501',
    fornecedor: 'Vacinas Brasil',
    recebidoDiasAtras: 330,
    validadeEmDias: 420,
    quantidade: 26,
    custoUnitario: 2790,
    perdas: [{ diasAtras: 120, quantidade: 3, motivo: 'temperatura' }],
    caso: 'abaixo do mínimo',
  },

  /* FeLV: fecha **zerado**. A vacina que a clínica deixou acabar. */
  {
    vacinaId: 'vac-felv',
    codigo: 'FLV-2411',
    fornecedor: 'Vacinas Brasil',
    recebidoDiasAtras: 400,
    validadeEmDias: 430,
    quantidade: 6,
    custoUnitario: 4150,
    perdas: [{ diasAtras: 200, quantidade: 0, motivo: 'quebra' }],
    caso: 'zerado',
  },
]

function lotesDeVacinaPlantados(hoje: ISODate): LoteDeVacina[] {
  return LOTES_PLANTADOS.map((plantado, indice) => {
    const recebidoEm = addDays(hoje, -plantado.recebidoDiasAtras)

    return {
      id: `lote-${indice}-${plantado.codigo}`,
      vacinaId: plantado.vacinaId,
      codigo: plantado.codigo,
      fornecedor: plantado.fornecedor,
      recebidoEm,
      validade: addDays(recebidoEm, plantado.validadeEmDias),
      quantidadeRecebida: plantado.quantidade,
      custoUnitario: plantado.custoUnitario,
      perdas: plantado.perdas.map((perda) => ({
        em: addDays(hoje, -perda.diasAtras),
        quantidade: perda.quantidade,
        motivo: perda.motivo,
      })),
      /* Numeração de nota inventada, mas estável: a mesma semente, a mesma nota. */
      notaFiscal: String(48_210 + indice * 37),
      recebidoPor: '',
    }
  })
}

/**
 * De que lote saiu esta dose.
 *
 * PEPS entre os lotes daquela vacina que já tinham chegado e ainda não tinham vencido no dia da
 * aplicação, e que ainda têm dose livre. O contador de saída é passado de fora e vai sendo
 * gasto, e é ele que garante que nenhum lote feche com saldo negativo — a conta do estoque
 * depende disso para fechar.
 *
 * Sem lote elegível, a aplicação fica **sem lote de estoque** e a função devolve `null`: é o
 * caso real da dose que veio de antes do controle de estoque, e a tela precisa saber conviver
 * com ele em vez de inventar um código.
 */
function loteParaAplicacao(
  lotes: LoteDeVacina[],
  gasto: Map<string, number>,
  vacinaId: string,
  em: ISODate,
): LoteDeVacina | null {
  const elegiveis = lotes
    .filter(
      (lote) =>
        lote.vacinaId === vacinaId &&
        lote.recebidoEm <= em &&
        lote.validade >= em &&
        (gasto.get(lote.codigo) ?? 0) <
          lote.quantidadeRecebida - perdasDoLotePlantado(lote) - sobraGarantida(lote),
    )
    .sort((a, b) => a.validade.localeCompare(b.validade))

  const escolhido = elegiveis[0]

  if (!escolhido) {
    return null
  }

  gasto.set(escolhido.codigo, (gasto.get(escolhido.codigo) ?? 0) + 1)

  return escolhido
}

function perdasDoLotePlantado(lote: LoteDeVacina): number {
  return lote.perdas.reduce((total, perda) => total + perda.quantidade, 0)
}

function sobraGarantida(lote: LoteDeVacina): number {
  return LOTES_PLANTADOS.find((plantado) => plantado.codigo === lote.codigo)?.sobraGarantida ?? 0
}

/**
 * As aplicações que a demonstração precisa, em duas camadas.
 *
 * A primeira é a **lista plantada**: um caso de cada situação da lista de chamada. A segunda é o
 * **movimento de fundo** — as vacinas de rotina que fazem o gráfico de consumo ter doze meses em
 * vez de uma coluna. As duas camadas nunca tocam o mesmo par paciente × vacina, porque o que
 * define a situação do recall é a **última** aplicação daquele par: uma dose de fundo caindo
 * depois de um caso plantado apagaria justamente o caso que ele existe para mostrar.
 *
 * E o movimento de fundo fecha sempre **em dia**: série completa e dose recente. Quem entra na
 * lista de chamada é quem a camada plantada colocou lá, e só.
 */
function aplicacoesDeVacinaPlantadas(hoje: ISODate, lotes: LoteDeVacina[]): AplicacaoVacina[] {
  const PLANTADAS: Array<{
    petId: string
    vacinaId: string
    diasAtras: number
    dose: number
    /** O que este caso existe para demonstrar. */
    caso: string
  }> = [
    /* Em dia: aplicou há pouco, série fechada. */
    {
      petId: 'pet-luna',
      vacinaId: 'vac-antirrabica-canina',
      diasAtras: 40,
      dose: 1,
      caso: 'em dia',
    },
    { petId: 'pet-luna', vacinaId: 'vac-v10', diasAtras: 60, dose: 3, caso: 'em dia' },

    /* A vencer: dentro da janela de 30 dias — é a ligação da semana. */
    { petId: 'pet-bidu', vacinaId: 'vac-v10', diasAtras: 345, dose: 3, caso: 'a vencer' },
    {
      petId: 'pet-mel',
      vacinaId: 'vac-antirrabica-canina',
      diasAtras: 350,
      dose: 1,
      caso: 'a vencer',
    },

    /* Vencido: passou da data — é a ligação de hoje. */
    {
      petId: 'pet-thor',
      vacinaId: 'vac-antirrabica-canina',
      diasAtras: 430,
      dose: 1,
      caso: 'vencido',
    },
    { petId: 'pet-nina', vacinaId: 'vac-v10', diasAtras: 500, dose: 3, caso: 'vencido' },
    { petId: 'pet-sushi', vacinaId: 'vac-v4-felina', diasAtras: 420, dose: 3, caso: 'vencido' },

    /*
     * Série aberta: filhote no meio da série, com a próxima dose **ainda por vir**.
     *
     * A janela é curta de propósito. Passados os 28 dias entre doses, o caso deixa de ser
     * "série aberta" e vira "vencido" — que é a regra certa, mas some com esta situação da
     * demonstração. Aplicações recentes mantêm as quatro pilhas visíveis.
     */
    { petId: 'pet-amora', vacinaId: 'vac-v10', diasAtras: 12, dose: 1, caso: 'série aberta' },
    {
      petId: 'pet-pandora',
      vacinaId: 'vac-v4-felina',
      diasAtras: 18,
      dose: 2,
      caso: 'série aberta',
    },

    /* Histórico mais fundo, para a carteira do paciente ter profundidade. */
    {
      petId: 'pet-nina',
      vacinaId: 'vac-antirrabica-canina',
      diasAtras: 500,
      dose: 1,
      caso: 'histórico',
    },
    { petId: 'pet-nina', vacinaId: 'vac-gripe-canina', diasAtras: 520, dose: 2, caso: 'histórico' },
    { petId: 'pet-bento', vacinaId: 'vac-v10', diasAtras: 200, dose: 3, caso: 'histórico' },
  ]

  const gasto = new Map<string, number>()
  const aplicacoes: AplicacaoVacina[] = []

  /*
   * A ordem de criação é a ordem do tempo, da mais antiga para a mais recente. O PEPS depende
   * disso: atribuir na ordem da lista escrita faria uma dose de dois anos atrás consumir o lote
   * que só chegou no mês passado.
   */
  const rotina = rotinaDeVacinacao(hoje)
  const todas = [...PLANTADAS, ...rotina].sort((a, b) => b.diasAtras - a.diasAtras)

  for (const [indice, item] of todas.entries()) {
    const vacina = vacinasFixture.find((v) => v.id === item.vacinaId)
    const data = addDays(hoje, -item.diasAtras)
    const dentroDaSerie = vacina ? item.dose < vacina.dosesNaSerie : false
    const lote = loteParaAplicacao(lotes, gasto, item.vacinaId, data)

    aplicacoes.push({
      id: `apl-${indice}-${item.petId}`,
      petId: item.petId,
      vacinaId: item.vacinaId,
      origem: 'clinica' as const,
      /* Vacina é ato de quem aplica: fica com a clínica geral. */
      professionalId: 'prof-ana',
      aplicadaEm: iso(data, 9 * 60 + 30),
      /*
       * Sem lote de estoque, o código é derivado da data — é a dose de antes do controle, e o
       * comprovante continua precisando de **alguma** rastreabilidade impressa.
       */
      lote: lote?.codigo ?? `L${data.slice(0, 4)}-${String(indice + 1).padStart(3, '0')}`,
      validadeLote: lote?.validade ?? addDays(data, 540),
      dose: item.dose,
      /*
       * O tamanho da série congelado como o catálogo o tinha — é o registro de antes do protocolo
       * por idade, e a carteira desses animais continua dizendo o que sempre disse.
       */
      dosesNaSerie: vacina?.dosesNaSerie ?? 1,
      via: vacina?.vias[0] ?? 'subcutanea',
      proximaDoseEm: addDays(data, dentroDaSerie ? 28 : (vacina?.intervaloReforcoDias ?? 365)),
      agendamentoDaProximaId: null,
      encounterId: null,
      externa: null,
      observacao: '',
    })
  }

  return aplicacoes
}

/**
 * O movimento de rotina dos últimos doze meses.
 *
 * Sem ele o gráfico de consumo teria treze pontos espalhados em dois anos e não mostraria giro
 * nenhum — e giro é o que decide quanto comprar. As doses são sorteadas com semente fixa, para
 * o dataset continuar sendo o mesmo a cada carga.
 *
 * Duas amarras que mantêm a lista de chamada intacta:
 *
 * - **Só pares que a camada plantada não usa.** Ver `aplicacoesDeVacinaPlantadas`.
 * - **Sempre série completa e nunca além de 330 dias.** As duas juntas garantem `em-dia`: a
 *   próxima dose cai a mais de um mês daqui, que é o que tira a linha da fila de chamada.
 */
function rotinaDeVacinacao(
  hoje: ISODate,
): Array<{ petId: string; vacinaId: string; diasAtras: number; dose: number; caso: string }> {
  const rng = createPrng(hashSeed(`vacina-rotina-${hoje}`))
  const usados = new Set([
    'pet-luna|vac-antirrabica-canina',
    'pet-luna|vac-v10',
    'pet-bidu|vac-v10',
    'pet-mel|vac-antirrabica-canina',
    'pet-thor|vac-antirrabica-canina',
    'pet-nina|vac-v10',
    'pet-sushi|vac-v4-felina',
    'pet-amora|vac-v10',
    'pet-pandora|vac-v4-felina',
    'pet-nina|vac-antirrabica-canina',
    'pet-nina|vac-gripe-canina',
    'pet-bento|vac-v10',
  ])

  /* Todo par paciente × vacina que a espécie permite e a camada plantada não ocupou. */
  const pares: Array<{ petId: string; vacinaId: string; dosesNaSerie: number }> = []

  for (const pet of petsFixture) {
    for (const vacina of vacinasFixture) {
      if (!vacina.especies.includes(pet.especie) || usados.has(`${pet.id}|${vacina.id}`)) {
        continue
      }

      pares.push({ petId: pet.id, vacinaId: vacina.id, dosesNaSerie: vacina.dosesNaSerie })
    }
  }

  const saidas: Array<{
    petId: string
    vacinaId: string
    diasAtras: number
    dose: number
    caso: string
  }> = []

  for (const par of pares) {
    /*
     * Nem todo par vira aplicação: uma clínica onde todo animal tomou todas as vacinas do
     * catálogo não existe, e o gráfico de consumo sairia com as seis séries na mesma altura.
     */
    if (rng() > 0.85) {
      continue
    }

    /*
     * O reforço do ano, espalhado pela janela inteira.
     *
     * A primeira versão plantava dois reforços por par — o deste ano e o do ano passado, este
     * último entre 340 e 364 dias atrás. Só que 340 a 364 dias atrás **é um mês só**: o gráfico
     * abria com uma torre de vinte doses no mês mais antigo e o resto do ano raso, que é o
     * oposto do giro que ele existe para mostrar. Um reforço por par, sorteado na janela
     * inteira, desenha a linha que a clínica realmente tem.
     */
    const reforco = intBetween(rng, 5, 330)

    saidas.push({
      petId: par.petId,
      vacinaId: par.vacinaId,
      diasAtras: reforco,
      dose: par.dosesNaSerie,
      caso: 'reforço anual',
    })

    /*
     * Parte dos pares ganha a **série inicial** que antecede esse reforço, 28 dias entre doses.
     *
     * É volume medicamente correto — filhote toma três de V10 — e ele não mexe no recall:
     * as doses da série são mais antigas que o reforço, e quem decide a situação do par é a
     * última aplicação.
     */
    if (par.dosesNaSerie > 1 && rng() < 0.45) {
      for (let dose = 1; dose < par.dosesNaSerie; dose += 1) {
        saidas.push({
          petId: par.petId,
          vacinaId: par.vacinaId,
          diasAtras: reforco + (par.dosesNaSerie - dose) * 28,
          dose,
          caso: 'série inicial',
        })
      }
    }
  }

  /*
   * O mês corrente ganha o ritmo dos outros.
   *
   * O sorteio começa cinco dias atrás, e com isso o começo do mês corrente nunca tinha dose: no dia
   * 7, o mês aparecia zerado no gráfico de consumo e as metas de estoque diziam "abaixo do ritmo,
   * fecha em 0" para uma clínica que aplica sete doses por mês. Alguns pares já sorteados mudam
   * de data — o reforço e a série junto, com o mesmo espaçamento — para dentro do mês, um a cada
   * quatro dias corridos. Nenhuma dose é criada, e o reforço continua sendo o último do par: a
   * lista de chamada não muda.
   */
  const corridos = Number(hoje.slice(8, 10)) - 1
  const reforcos = saidas.filter((saida) => saida.caso === 'reforço anual')
  const faltam =
    Math.ceil(corridos / 4) - reforcos.filter((saida) => saida.diasAtras <= corridos).length

  if (faltam > 0) {
    const passo = Math.max(1, Math.floor(reforcos.length / faltam))
    const espaco = Math.max(1, Math.floor(corridos / faltam))

    for (let indice = 0; indice < faltam; indice += 1) {
      const escolhido = reforcos[indice * passo]

      if (!escolhido) {
        break
      }

      const desloca = escolhido.diasAtras - (corridos - ((indice * espaco) % corridos))

      for (const saida of saidas) {
        if (saida.petId === escolhido.petId && saida.vacinaId === escolhido.vacinaId) {
          saida.diasAtras -= desloca
        }
      }
    }
  }

  return saidas
}

/**
 * Internações na linha do tempo.
 *
 * O requisito nomeia internação ao lado de consultas, vacinas e exames — e ela não sai de um
 * atendimento de agenda: internação dura dias e nasce de uma decisão dentro da consulta. Sem
 * um modelo próprio de internação no protótipo, ela entra na linha do tempo como o evento que
 * é, plantada nos pacientes que a história do dataset justifica.
 *
 * Sem isto, o filtro por tipo abriria com uma opção que nunca teria nada atrás.
 */
function internacoesPlantadas(encounters: Encounter[]): TimelineEvent[] {
  const PLANTADAS: Array<{ petId: string; diasAtras: number; titulo: string; resumo: string }> = [
    {
      petId: 'pet-bento',
      diasAtras: 21,
      titulo: 'Internação pós-cirúrgica',
      resumo: 'Três dias em observação após osteossíntese. Alta sem intercorrência.',
    },
    {
      petId: 'pet-cacau',
      diasAtras: 96,
      titulo: 'Internação por desidratação',
      resumo: 'Fluidoterapia por 48 h. Recuperou apetite no segundo dia.',
    },
    {
      petId: 'pet-luna',
      diasAtras: 240,
      titulo: 'Internação por gastroenterite',
      resumo: 'Dois dias com antiemético e fluidos.',
    },
  ]

  /** Só planta para paciente que já tem história no dataset — senão a linha nasce órfã. */
  const comHistorico = new Set(encounters.map((encounter) => encounter.petId))

  return PLANTADAS.filter((item) => comHistorico.has(item.petId)).map((item) => ({
    id: `tl-internacao-${item.petId}`,
    petId: item.petId,
    kind: 'internacao' as const,
    em: iso(addDays(clock.today(), -item.diasAtras), 10 * 60),
    titulo: item.titulo,
    resumo: item.resumo,
    encounterId: null,
    appointmentId: null,
  }))
}

/**
 * Os casos difíceis da internação, apontados para as rotas que os mostram.
 *
 * O painel navega, não explica: cada linha precisa cair na tela onde o caso está aberto. Por
 * isso a piora aponta para o paciente internado e não para o mapa — no mapa ela é um ponto
 * vermelho, na tela do paciente ela é o boletim travado esperando a ligação.
 */
/**
 * A internação em curso também é história do paciente.
 *
 * Sem isto, abrir o histórico do Bento durante a internação dele mostraria a cirurgia de
 * anteontem e nada depois — como se ele tivesse ido para casa. O evento entra com a data de
 * **entrada**, não com a de hoje, porque é ali que ele pertence na linha.
 */
function eventosDasInternacoesAbertas(internacao: DatasetDeInternacao): TimelineEvent[] {
  return internacao.internacoes
    .filter((item) => item.status === 'internado')
    .map((item) => ({
      id: `tl-internacao-aberta-${item.id}`,
      petId: item.petId,
      kind: 'internacao' as const,
      em: item.entradaEm,
      titulo: item.motivo,
      resumo: item.diagnostico,
      encounterId: item.encounterId,
      appointmentId: null,
    }))
}

function casosDaInternacao(internacao: DatasetDeInternacao): CasoDificil[] {
  const tofu = internacao.internacoes.find((item) => item.id === 'int-tofu')
  const cacau = internacao.internacoes.find((item) => item.id === 'int-cacau')

  return [
    ...(tofu
      ? [
          {
            id: 'internacao-piora' as const,
            rota: `/clinica/internacao/${tofu.id}?aba=boletim`,
            appointmentId: null,
            encounterId: null,
          },
        ]
      : []),
    {
      id: 'internacao-troca-plantao' as const,
      rota: '/clinica/internacao?passagem=1',
      appointmentId: null,
      encounterId: null,
    },
    ...(cacau
      ? [
          {
            id: 'internacao-boletim-horario' as const,
            rota: `/clinica/internacao/${cacau.id}?aba=boletim`,
            appointmentId: null,
            encounterId: null,
          },
        ]
      : []),
  ]
}

// ---------------------------------------------------------------------------
// Entrada pública
// ---------------------------------------------------------------------------

export function calcularAncora(hoje: ISODate): ISODate {
  return isWeekend(hoje) ? nextBusinessDay(hoje) : hoje
}

export function gerarDataset(semente: number = SEMENTE_PADRAO): SeedResult {
  const hoje = clock.today()
  const ancora = calcularAncora(hoje)

  /** Sorteio de posicionamento: só depende da semente e do dia âncora, nunca do relógio. */
  const rngPos = createPrng(semente ^ hashSeed(ancora))

  const { appointments: plantados, blocks, casos } = casosDoDiaAncora(ancora)
  const ocupados = new Set(
    plantados
      .filter((appointment) => clock.dateOf(appointment.inicio) === ancora)
      .map((appointment) => `${appointment.professionalId}|${clock.minutesOf(appointment.inicio)}`),
  )

  /** As salas que os casos plantados já tomam saem do jogo antes do preenchimento. */
  const salasTomadas = new Set<string>()

  for (const appointment of plantados) {
    if (clock.dateOf(appointment.inicio) !== ancora) {
      continue
    }

    const inicioMin = clock.minutesOf(appointment.inicio)
    const duracao = clock.durationMinutes(appointment.inicio, appointment.fim)

    for (const roomId of appointment.roomIds) {
      for (
        let minuto = inicioMin;
        minuto < inicioMin + duracao;
        minuto += clinicFixture.slotMinutos
      ) {
        salasTomadas.add(`${roomId}|${minuto}`)
      }
    }
  }

  const complemento = preencherDia(
    ancora,
    ATENDIMENTOS_NO_DIA_ANCORA - plantados.length,
    rngPos,
    ocupados,
    'apt-ancora',
    salasTomadas,
    /** Também fora do dia âncora: visto de manhã, o dia inteiro ainda é futuro. */
    petsComAgenda(),
  )

  const outrosDias: Appointment[] = []

  for (let offset = -21; offset <= 21; offset += 1) {
    if (offset === 0) {
      continue
    }

    const data = addDays(ancora, offset)

    if (isWeekend(data) && weekdayOf(data) === 0) {
      continue
    }

    const rngDia = createPrng(semente ^ hashSeed(data))
    const quantidade = intBetween(rngDia, 14, 34)

    outrosDias.push(
      ...preencherDia(
        data,
        quantidade,
        rngDia,
        new Set(),
        `apt-${data}`,
        new Set(),
        data > ancora ? petsComAgenda() : petsSorteaveis(),
      ),
    )
  }

  const todos = [
    ...plantados,
    ...complemento,
    ...outrosDias,
    ...faltasReincidentes(ancora),
    faltaComObito(ancora),
  ]
  const comStatus = semAgendaDepoisDoObito(
    garantirEstadosDoDia(aplicarStatus(todos, semente), ancora),
  )

  /** Prontuários: os finalizados do passado e os abertos do dia âncora. */
  const rngEncounter = createPrng(semente ^ 0x1234_5678)
  const encounters: Encounter[] = []

  for (const appointment of comStatus) {
    if (appointment.status === 'finalizado' && rngEncounter() < 0.55) {
      encounters.push(encounterPreenchido(appointment, petPorId(appointment.petId), rngEncounter))
      appointment.encounterId = `enc-${appointment.id}`
    }
  }

  /** O caso da alergia precisa de um prontuário aberto e alcançável por rota direta. */
  const consultaAlergia = comStatus.find((appointment) => appointment.id === 'apt-alergia')

  if (consultaAlergia) {
    const aberto = encounterVazio(consultaAlergia, consultaAlergia.inicio)
    const nina = petPorId(consultaAlergia.petId)
    const dipirona = medicationsFixture.find((item) => item.principioAtivo === 'Dipirona')

    /**
     * O caso difícil da alergia estava só **alcançável**, não materializado: a rota abria um
     * rascunho vazio e o conflito que dá nome ao caso não existia em lugar nenhum. Agora o
     * rascunho já traz a prescrição que encosta na alergia registrada da paciente, **sem
     * confirmação** — que é exatamente o estado em que a interface precisa cobrar a decisão.
     */
    const calculo = dipirona
      ? calcularDose({
          medicamento: dipirona,
          pesoKg: nina.pesoKg,
          mgPorKg: 20,
          frequenciaHoras: 8,
          duracaoDias: 5,
        })
      : null

    encounters.push({
      ...aberto,
      anamnese: {
        ...aberto.anamnese,
        queixaPrincipal: 'Claudicação em membro pélvico direito há 3 dias.',
        duracaoSintomas: '3 dias',
        historia: 'Sem trauma observado. Piora ao levantar após repouso.',
        apetite: 'normal',
      },
      exameFisico: {
        ...aberto.exameFisico,
        vitais: {
          ...aberto.exameFisico.vitais,
          peso: medicao(nina.pesoKg),
          temperatura: medicao(38.6),
          frequenciaCardiaca: medicao(112),
          pressaoSistolica: medicao(null, true),
        },
        sistemas: {
          ...aberto.exameFisico.sistemas,
          locomotor: { status: 'alterado', nota: 'Dor à extensão do quadril direito.' },
          cardiovascular: { status: 'normal', nota: '' },
        },
      },
      conduta:
        dipirona && calculo
          ? {
              ...aberto.conduta,
              orientacoes: 'Repouso por 5 dias e retorno em caso de piora.',
              prescricoes: [
                {
                  id: 'presc-alergia',
                  medicamentoId: dipirona.id,
                  via: 'oral',
                  calculo,
                  observacao: '',
                  alergiaConfirmada: false,
                },
              ],
              /**
               * O rascunho é a porta de entrada da demonstração. Sem exame pedido e sem prazo
               * de retorno, dois controles da conduta abriam em branco e ninguém via como eles
               * ficam preenchidos.
               */
              /*
               * **Id do catálogo, não o nome.** Estava gravando 'Radiografia de quadril' e
               * 'Hemograma completo': o `MultiSelect` compara por `exame.id`, não achava opção
               * nenhuma e desenhava duas fichas vazias — só o "x", sem texto. O nome do exame
               * é o rótulo; a identidade é o id.
               */
              examesSolicitados: ['exame-raiox-quadril', 'exame-hemograma'],
              retorno: { emDias: 15, typeId: 'tipo-retorno', appointmentId: null },
            }
          : aberto.conduta,
    })
    consultaAlergia.encounterId = aberto.id
  }

  /**
   * Um prontuário esquecido aberto dias atrás.
   *
   * O único rascunho do dataset era o de hoje, do caso da alergia — e "Prontuários em rascunho"
   * abria com uma linha só, sempre a mesma. Este aqui é a pendência que a caixa existe para
   * pegar: atendimento feito, registro começado, nunca finalizado.
   */
  const esquecido = comStatus.find(
    (appointment) =>
      appointment.status === 'finalizado' &&
      !appointment.encounterId &&
      clock.dateOf(appointment.inicio) < ancora,
  )

  if (esquecido) {
    const aberto = encounterVazio(esquecido, esquecido.inicio)

    encounters.push({
      ...aberto,
      anamnese: {
        ...aberto.anamnese,
        queixaPrincipal: 'Tosse seca há uma semana',
        duracaoSintomas: '7 dias',
        evolucao: 'piorando',
        historia: 'Responsável relata piora à noite e após passeio.',
        antecedentes: [
          {
            id: 'ant-esquecido-1',
            kind: 'medicacao-continua',
            descricao: 'Enalapril 5 mg, uma vez ao dia',
            quando: 'desde 2024',
          },
        ],
      },
      versao: 2,
    })
    esquecido.encounterId = aberto.id
  }

  /**
   * Um atendimento do dia com **pré-consulta respondida no app**.
   *
   * É o caso que demonstra o elo do produto dentro do prontuário: o responsável respondeu antes
   * de sair de casa, e o vet abre a consulta com o quadro já descrito — para **conferir**, não
   * para copiar. Sem um caso plantado, a sugestão nunca apareceria na demonstração.
   */
  const vindoDoApp = comStatus.find((appointment) => appointment.id === 'apt-pre-consulta')

  if (vindoDoApp && !vindoDoApp.encounterId) {
    const aberto = encounterVazio(vindoDoApp, vindoDoApp.inicio)
    const pet = petsFixture.find((item) => item.id === vindoDoApp.petId)

    encounters.push({
      ...aberto,
      preConsulta: {
        appointmentId: vindoDoApp.id,
        /** Respondido na véspera: recente o bastante para valer, antigo o bastante para conferir. */
        respondidoEm: iso(addDays(clock.dateOf(vindoDoApp.inicio), -1), 20 * 60 + 40),
        /* Nos enums do Diário Pet: é o contrato com o app (`RespostaDaPreConsulta`). */
        motivo: 'SINTOMA',
        queixaPrincipal: 'Está se coçando muito, principalmente as orelhas',
        sintomas: ['COCEIRA', 'LAMBEDURA_EXCESSIVA'],
        desdeQuando: 'TRES_A_SETE_DIAS',
        evolucao: 'PIORANDO',
        alimentacao: 'NORMAL',
        hidratacao: 'NORMAL',
        fezes: 'NORMAL',
        urina: 'NORMAL',
        vitalidade: 'AGITADO',
        /* Peso de balança de casa: parte de onde partir, não medição. */
        pesoKg: pet?.pesoKg ? Number((pet.pesoKg + 0.4).toFixed(1)) : null,
        pesadoEm: addDays(clock.dateOf(vindoDoApp.inicio), -1),
        observacao:
          'Começou depois que fomos ao parque. Ela dorme na varanda e tem outro cachorro em casa, que não está se coçando.',
        fotoIds: ['foto-amora-orelha-1', 'foto-amora-orelha-2'],
        /* Humor e água vieram do diário de ontem; o resto ela respondeu na hora. */
        camposDoDiario: ['hidratacao', 'vitalidade'],
      },
      versao: 0,
    })
    vindoDoApp.encounterId = aberto.id
  }

  /**
   * Retorno indicado que **já foi marcado** deixa de ser pendência.
   *
   * Sem este passo toda consulta do histórico virava retorno esquecido e a caixa de pendências
   * abria com oitenta e quatro linhas — número que ninguém lê e clínica nenhuma sobrevive. O
   * vínculo não é inventado: só liga quando o paciente de fato voltou depois, e o horário dessa
   * volta é o que passa a constar no prontuário anterior.
   */
  for (const encounter of encounters) {
    if (encounter.conduta.retorno.emDias === null || encounter.conduta.retorno.appointmentId) {
      continue
    }

    const desde = encounter.finalizadoEm ?? encounter.abertoEm
    const volta = comStatus.find(
      (appointment) =>
        appointment.petId === encounter.petId &&
        appointment.inicio > desde &&
        appointment.status !== 'cancelado' &&
        appointment.id !== encounter.appointmentId,
    )

    if (volta) {
      encounter.conduta = {
        ...encounter.conduta,
        retorno: { ...encounter.conduta.retorno, appointmentId: volta.id },
      }
    }
  }

  /**
   * Retornos vencidos e sem horário. Sem estes, "Retornos sem horário marcado" nascia vazio: os
   * prontuários recentes ainda estão dentro do prazo, e os antigos o bastante para vencer
   * ficavam fora de qualquer janela de busca.
   */
  const rngRetorno = createPrng(semente ^ 0x00ff_00ff)

  const jaAjustados = new Set<string>()

  for (const atraso of [2, 4, 6, 9, 13, 18, 24, 31]) {
    const candidatos = encounters.filter(
      (encounter) =>
        encounter.status === 'finalizado' &&
        !jaAjustados.has(encounter.id) &&
        clock.dateOf(encounter.finalizadoEm ?? encounter.abertoEm) <=
          addDays(ancora, -(atraso + 2)),
    )

    const alvo = candidatos[Math.floor(rngRetorno() * candidatos.length)]

    if (!alvo) {
      continue
    }

    /** O prazo é calculado para vencer há exatamente `atraso` dias — atraso visível na lista. */
    const diasDesdeAConsulta = diffDays(clock.dateOf(alvo.finalizadoEm ?? alvo.abertoEm), ancora)

    jaAjustados.add(alvo.id)
    alvo.conduta = {
      ...alvo.conduta,
      retorno: {
        emDias: Math.max(diasDesdeAConsulta - atraso, 1),
        typeId: 'tipo-retorno',
        appointmentId: null,
      },
    }
  }

  /*
   * O passado desenhado da Pérola, do Chico e da Duna. Entra **depois** de todo sorteio sobre prontuários:
   * no de quem recebe prontuário, cada consulta plantada consumiria um número do `rngEncounter`;
   * no dos retornos vencidos, ela entraria na lista de candidatos e roubaria a vaga de alguém —
   * o Chico apareceu em "retornos sem horário" com consulta marcada para hoje.
   */
  for (const consulta of [...CONSULTAS_DO_RESUMO, ...CONSULTAS_DA_ADESAO]) {
    const data = addDays(hoje, -consulta.diasAtras)
    const appointment = montarAppointment({
      id: consulta.id,
      petId: consulta.petId,
      professionalId: consulta.professionalId,
      typeId: consulta.typeId,
      data,
      inicioMin: clockToMinutes(consulta.inicio),
      statusFixo: 'finalizado',
    })
    const pet = petPorId(consulta.petId)
    const base = encounterVazio(appointment, appointment.inicio)
    const prescricao = consulta.prescricao
    const medicamento = prescricao
      ? medicationsFixture.find((item) => item.id === prescricao.medicamentoId)
      : undefined
    const calculo =
      prescricao && medicamento
        ? calcularDose({
            medicamento,
            pesoKg: consulta.pesoKg,
            mgPorKg: prescricao.mgPorKg,
            frequenciaHoras: prescricao.frequenciaHoras,
            duracaoDias: prescricao.duracaoDias,
          })
        : null

    appointment.chegadaEm = iso(data, clockToMinutes(consulta.inicio) - 8)
    appointment.iniciadoEm = appointment.inicio
    appointment.finalizadoEm = appointment.fim
    appointment.encounterId = base.id

    encounters.push({
      ...base,
      status: 'finalizado',
      finalizadoEm: appointment.fim,
      anamnese: {
        ...base.anamnese,
        queixaPrincipal: consulta.queixa,
        apetite: 'normal',
        vacinacaoEmDia: true,
      },
      exameFisico: {
        ...base.exameFisico,
        vitais: {
          ...base.exameFisico.vitais,
          peso: medicao(consulta.pesoKg),
          temperatura: medicao(pet.especie === 'felina' ? 38.6 : 38.4),
        },
      },
      diagnosticos: consulta.diagnostico
        ? [{ id: `diag-${appointment.id}`, ...consulta.diagnostico }]
        : [],
      conduta: {
        ...condutaVazia(),
        orientacoes: orientacaoDe(consulta.diagnostico?.codigo ?? ''),
        prescricoes:
          medicamento && calculo
            ? [
                {
                  id: `presc-${appointment.id}-0`,
                  medicamentoId: medicamento.id,
                  via: 'oral',
                  calculo,
                  observacao: '',
                  alergiaConfirmada: false,
                  ...(prescricao?.critico ? { critico: true } : {}),
                },
              ]
            : [],
      },
      versao: 3,
    })
    comStatus.push(appointment)
  }

  /*
   * O lado do responsável (`seed-responsavel.ts`): a falta da Brunilda, que ainda espera
   * justificativa, e uma falta de outro responsável que ele mesmo justificou pelo app.
   */
  const falta = faltaDaBrunilda(hoje)

  comStatus.push(
    montarAppointment({
      id: falta.id,
      petId: falta.petId,
      professionalId: falta.professionalId,
      typeId: falta.typeId,
      data: falta.data,
      inicioMin: clockToMinutes(falta.inicio),
      statusFixo: 'falta',
      origem: 'retorno',
    }),
  )

  const justificavelPeloApp = comStatus.find(
    (appointment) =>
      appointment.status === 'falta' &&
      !appointment.justificativaDeFalta &&
      appointment.petId !== PET_DA_FILA &&
      appointment.tutorId !== RESPONSAVEL_DA_DEMONSTRACAO &&
      clock.dateOf(appointment.inicio) < ancora,
  )

  if (justificavelPeloApp) {
    /* Três horas depois do horário: o responsável viu o aviso no app e respondeu. */
    justificavelPeloApp.justificativaDeFalta = justificativaPeloApp(
      iso(
        clock.dateOf(justificavelPeloApp.inicio),
        clock.minutesOf(justificavelPeloApp.inicio) + 190,
      ),
    )
  }

  /*
   * Presença confirmada, e por onde. Só hoje e o próximo dia útil: é a janela em que a
   * confirmação diz alguma coisa. Quem marcou pelo app confirmou pelo app, na noite anterior;
   * os outros, pela ligação da recepção.
   */
  const amanha = proximoDiaUtil(ancora)

  for (const appointment of comStatus) {
    const dia = clock.dateOf(appointment.inicio)

    if (appointment.status === 'confirmado' && (dia === ancora || dia === amanha)) {
      appointment.confirmacao = {
        por: appointment.origem === 'app' ? 'app' : 'recepcao',
        em: iso(addDays(dia, -1), 19 * 60 + (hashSeed(`confirma|${appointment.id}`) % 150)),
      }
    }
  }

  /*
   * O resumo liberado para o responsável: tudo o que terminou antes de hoje, vinte e cinco
   * minutos depois de fechar. O que termina hoje fica por liberar — é a ação que a demonstração
   * precisa ter para mostrar.
   */
  for (const encounter of encounters) {
    if (
      encounter.status === 'finalizado' &&
      encounter.finalizadoEm &&
      clock.dateOf(encounter.finalizadoEm) < hoje
    ) {
      encounter.resumoLiberadoEm = iso(
        clock.dateOf(encounter.finalizadoEm),
        clock.minutesOf(encounter.finalizadoEm) + 25,
      )
    }
  }

  /*
   * A vaga oferecida à Brunilda: o primeiro horário livre de verdade numa tarde que caiba nas
   * janelas dela, com qualquer profissional. Livre de verdade porque o aceite confere — uma
   * oferta para um horário ocupado levaria a demonstração a "vaga já preenchida". Dentro das
   * janelas porque a clínica abre sábado e a Fátima só pode de segunda a sexta: oferecer o
   * sábado seria oferecer o que ela já disse que não serve.
   */
  const feriados = [...feriadosDoAno(ancora), diaFechadoProximo(ancora)]
  const duracaoDaConsulta = tipoPorId('tipo-consulta').duracaoMinutos
  let vagaDaBrunilda: { inicio: string; professionalId: string } | null = null

  for (let offset = 1; offset <= 14 && !vagaDaBrunilda; offset += 1) {
    const dia = addDays(ancora, offset)
    const horario = clinicFixture.horarios.find((item) => item.weekday === weekdayOf(dia))
    const cabe = JANELAS_DA_BRUNILDA.some((janela) => janela.weekday === weekdayOf(dia))

    if (!cabe || !horario || horario.fechado || feriados.some((item) => item.date === dia)) {
      continue
    }

    for (let minuto = 15 * 60; minuto <= 17 * 60 + 30 && !vagaDaBrunilda; minuto += 15) {
      for (const professional of professionalsFixture.filter((item) => item.ativo)) {
        const vaga = {
          professionalId: professional.id,
          petId: PET_DA_FILA,
          inicio: iso(dia, minuto),
          fim: iso(dia, minuto + duracaoDaConsulta),
        }

        if (vagaLivre(comStatus, vaga)) {
          vagaDaBrunilda = { inicio: vaga.inicio, professionalId: vaga.professionalId }
          break
        }
      }
    }
  }

  const agoraDaClinica = clock.now()
  const fila = montarFila(ancora)

  if (vagaDaBrunilda) {
    fila.push(
      filaDaBrunilda(
        vagaDaBrunilda,
        iso(addDays(hoje, -6), 10 * 60 + 12),
        clock.toIso(agoraDaClinica.date, agoraDaClinica.minutes + 25),
      ),
    )
  }

  const internacao = gerarInternacoes(semente)

  const clinic: Clinic = { ...clinicFixture, feriados }

  const pets = [
    ...petsFixture,
    ...petsDoResumo(hoje),
    ...petsDaVacinacao(hoje),
    ...petsDaAdesao(hoje),
  ].map((pet) => ({
    ...pet,
    alertas: [...pet.alertas],
  }))
  const tutores = tutorsFixture.map((tutor) => ({ ...tutor }))
  const diario = gerarDiario(pets, hoje)
  const adesao = gerarAdesao({ encounters, hoje, agora: clock.nowIso() })

  /* Os lotes vêm antes das aplicações: é deles que sai o código que cada dose cita. */
  const lotesDeVacina = lotesDeVacinaPlantados(clock.today())
  const daCarteirinha = aplicacoesDaVacinacao(clock.today(), iso)
  const aplicacoesDeVacina = [
    ...aplicacoesDeVacinaPlantadas(clock.today(), lotesDeVacina),
    vacinaDaPerola(clock.today(), iso),
    ...daCarteirinha,
  ]

  /* Os pedidos vêm por último: o horário que eles escolhem precisa estar livre na agenda pronta. */
  const agendamentoOnline = agendamentoOnlinePadrao()
  const dosPedidos = semearPedidos({
    hoje,
    agora: clock.nowIso(),
    clinic,
    appointments: comStatus,
    blocks,
    pets,
    configuracao: agendamentoOnline,
  })

  return {
    semente,
    ancora,
    clinic,
    appointments: [...comStatus, ...dosPedidos.atendimentos].sort((a, b) =>
      a.inicio.localeCompare(b.inicio),
    ),
    blocks,
    encounters,
    waitlist: fila,
    timeline: [
      ...montarTimeline(encounters, comStatus),
      ...eventosDasInternacoesAbertas(internacao),
      ...eventosDaVacinacao(daCarteirinha),
    ].sort((a, b) => b.em.localeCompare(a.em)),
    aplicacoesDeVacina,
    lotesDeVacina,
    estoqueMinimo: {},
    planosDeEstoque: planosDeEstoquePlantados({
      hoje: clock.today(),
      lotes: lotesDeVacina,
      aplicacoes: aplicacoesDeVacina,
      iso,
    }),
    atos: atosPlantados(encounters, clock.today()),
    internacao,
    casos: [...casos, ...casosDaInternacao(internacao), ...casosDaAdesao()],
    pets,
    tutores,
    diario: diario.registros,
    pesagensDeCasa: diario.pesagens,
    /* Liberado numa noite de mês e meio atrás: o consentimento é anterior à consulta de hoje. */
    consentimentos: consentimentosDosResponsaveis(tutores, iso(addDays(hoje, -45), 20 * 60 + 15)),
    politica: { ...politicaDaClinicaFixture },
    cuidadores: cuidadoresDoDataset(tutores, pets),
    tratamentos: adesao.tratamentos,
    registrosDeDose: adesao.registrosDeDose,
    pedidos: dosPedidos.pedidos,
    agendamentoOnline,
    contasSoNoApp: contasSoNoApp(),
    tokensDoLink: dosPedidos.tokens,
    avisosDoPedido: [],
  }
}

/** Usado pelo teste de fumaça e pelo painel: quantos atendimentos o dia âncora recebeu. */
export function contarNoDia(dataset: SeedResult, data: ISODate): number {
  return dataset.appointments.filter((appointment) => clock.dateOf(appointment.inicio) === data)
    .length
}
