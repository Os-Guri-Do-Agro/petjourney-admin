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
  clinicFixture,
  diagnosisCatalogFixture,
  examCatalogFixture,
  medicationsFixture,
  petsFixture,
  tutorsFixture,
  professionalsFixture,
  roomsFixture,
} from './fixtures'
import { createPrng, hashSeed, intBetween, pickFrom } from './mock-runtime'
import type {
  Anamnese,
  Appointment,
  AppointmentStatus,
  AppointmentType,
  Block,
  CarePlan,
  Clinic,
  Diagnosis,
  Encounter,
  ExameFisico,
  Holiday,
  ISODate,
  Measurement,
  Medication,
  Pet,
  Prescription,
  Professional,
  SystemKey,
  TimelineEvent,
  Tutor,
  VitalKey,
  WaitlistEntry,
} from './types'

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
  return petsFixture.find((pet) => pet.id === id) ?? (petsFixture[0] as Pet)
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
    encounterId: null,
    linkedGroupId: seed.linkedGroupId ?? null,
    criadoEm: iso(addDays(seed.data, -3), 9 * 60),
    atualizadoEm: iso(addDays(seed.data, -3), 9 * 60),
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
        return { ...appointment, status: 'falta' as const }
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
const ESTADOS_GARANTIDOS = new Set(['apt-finalizado-cedo', 'apt-falta-hoje'])

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

  return { vitais, sistemas, observacao: '' }
}

function anamneseVazia(): Anamnese {
  return {
    queixaPrincipal: '',
    historia: '',
    duracaoSintomas: '',
    apetite: '',
    hidratacao: '',
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
  }
}

function encounterPreenchido(
  appointment: Appointment,
  pet: Pet,
  rng: () => number,
): Encounter {
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
      hidratacao: 'normal',
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
function montarPrescricoes(
  appointment: Appointment,
  pet: Pet,
  rng: () => number,
): Prescription[] {
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
  const rotaAgenda = (foco: string) => `/veterinario/agenda?data=${ancora}&foco=${foco}`
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

  // 2. Encaixe: emergência fora da grade, marcada como encaixe.
  appointments.push(
    montarAppointment({
      id: 'apt-encaixe',
      petId: 'pet-thor',
      professionalId: 'prof-ana',
      typeId: 'tipo-emergencia',
      data: ancora,
      inicioMin: clockToMinutes('10:20'),
      encaixe: true,
      origem: 'encaixe',
      observacao: 'Trazido pela recepção sem agendamento.',
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
    { id: 'sobreposicao', rota: rotaAgenda('apt-sobrepoe-a'), appointmentId: 'apt-sobrepoe-a', encounterId: null },
    { id: 'encaixe', rota: rotaAgenda('apt-encaixe'), appointmentId: 'apt-encaixe', encounterId: null },
    {
      id: 'duas-salas',
      rota: `/veterinario/agenda?data=${ancora}&agrupar=sala&foco=apt-cirurgia-centro`,
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
      rota: `/veterinario/agenda?data=${proximoDiaDaSemana(ancora, 2)}`,
      appointmentId: null,
      encounterId: null,
    },
    {
      id: 'dia-fechado',
      rota: `/veterinario/agenda?data=${addDays(ancora, 9)}`,
      appointmentId: null,
      encounterId: null,
    },
    { id: 'falta-reincidente', rota: '/veterinario/faltas', appointmentId: null, encounterId: null },
    {
      id: 'cancelado-visivel',
      rota: rotaAgenda('apt-cancelado'),
      appointmentId: 'apt-cancelado',
      encounterId: null,
    },
    { id: 'fila-expirando', rota: '/veterinario/fila', appointmentId: null, encounterId: null },
    {
      id: 'alergia-prescricao',
      rota: '/veterinario/atendimento/enc-apt-alergia',
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
      rota: '/veterinario/meu-dia',
      appointmentId: 'apt-retorno-pendente',
      encounterId: null,
    },
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
 * Dois pacientes ficam de fora dos dias futuros de propósito: sem eles, todo paciente teria
 * horário marcado e o filtro "sem horário marcado" nasceria com contagem zero — uma opção que
 * ninguém consegue exercitar.
 */
const SEM_AGENDA_FUTURA = ['pet-brunilda', 'pet-duque']

function preencherDia(
  data: ISODate,
  quantidade: number,
  rng: () => number,
  ocupados: Set<string>,
  prefixo: string,
  salasJaTomadas: Set<string> = new Set(),
  petsDisponiveis: Pet[] = petsFixture,
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

    for (let minuto = inicioMin; minuto < inicioMin + duracao; minuto += clinicFixture.slotMinutos) {
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

function faltasReincidentes(ancora: ISODate): Appointment[] {
  /** Um responsável com histórico é o que dá o que discutir no painel de faltas. */
  return [4, 11, 18, 25].map((diasAtras, indice) =>
    montarAppointment({
      id: `apt-falta-reincidente-${indice + 1}`,
      petId: 'pet-jack',
      professionalId: 'prof-ana',
      typeId: 'tipo-consulta',
      data: nextBusinessDay(addDays(ancora, -diasAtras)),
      inicioMin: clockToMinutes('09:30'),
      statusFixo: 'falta',
    }),
  )
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

  return eventos.sort((a, b) => b.em.localeCompare(a.em))
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
      for (let minuto = inicioMin; minuto < inicioMin + duracao; minuto += clinicFixture.slotMinutos) {
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
    petsFixture.filter((pet) => !SEM_AGENDA_FUTURA.includes(pet.id)),
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
        data > ancora
          ? petsFixture.filter((pet) => !SEM_AGENDA_FUTURA.includes(pet.id))
          : petsFixture,
      ),
    )
  }

  const todos = [...plantados, ...complemento, ...outrosDias, ...faltasReincidentes(ancora)]
  const comStatus = garantirEstadosDoDia(aplicarStatus(todos, semente), ancora)

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
        hidratacao: 'normal',
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
              examesSolicitados: ['Radiografia de quadril', 'Hemograma completo'],
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
        historia: 'Responsável relata piora à noite e após passeio.',
      },
      versao: 2,
    })
    esquecido.encounterId = aberto.id
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
    const diasDesdeAConsulta = diffDays(
      clock.dateOf(alvo.finalizadoEm ?? alvo.abertoEm),
      ancora,
    )

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

  const clinic: Clinic = {
    ...clinicFixture,
    feriados: [...feriadosDoAno(ancora), diaFechadoProximo(ancora)],
  }

  return {
    semente,
    ancora,
    clinic,
    appointments: comStatus.sort((a, b) => a.inicio.localeCompare(b.inicio)),
    blocks,
    encounters,
    waitlist: montarFila(ancora),
    timeline: montarTimeline(encounters, comStatus),
    casos,
    pets: petsFixture.map((pet) => ({ ...pet, alertas: [...pet.alertas] })),
    tutores: tutorsFixture.map((tutor) => ({ ...tutor })),
  }
}

/** Usado pelo teste de fumaça e pelo painel: quantos atendimentos o dia âncora recebeu. */
export function contarNoDia(dataset: SeedResult, data: ISODate): number {
  return dataset.appointments.filter((appointment) => clock.dateOf(appointment.inicio) === data)
    .length
}
