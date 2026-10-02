/**
 * Contas do painel de resumo.
 *
 * Número de painel que ninguém consegue verificar é número que ninguém deveria mostrar. Cada
 * indicador da tela tem um caso aqui, com dados montados à mão — se a conta mudar, o teste diz
 * antes do cliente.
 */

import { describe, expect, it } from 'vitest'

import { createClinicClock } from '../clinic-time'
import type {
  Appointment,
  AppointmentStatus,
  AppointmentType,
  Clinic,
  Encounter,
  Professional,
  WeekdayIndex,
} from '../../data/types'
import {
  diasDoIntervalo,
  inicioDaSemana,
  intervaloDoPeriodo,
  resumirClinica,
  type ResumoFiltro,
} from '../resumo'

const clock = createClinicClock('-04:00')

/** 2026-08-24 é uma segunda-feira. */
const ANCORA = '2026-08-24'

const clinic: Clinic = {
  id: 'clinica',
  nome: 'Teste',
  endereco: 'Rua Teste, 1',
  telefone: '(11) 0000-0000',
  utcOffset: '-04:00',
  slotMinutos: 15,
  horarios: ([0, 1, 2, 3, 4, 5, 6] as WeekdayIndex[]).map((weekday) => ({
    weekday,
    fechado: weekday === 0,
    expediente: { inicio: '08:00', fim: '18:00' },
    almoco: null,
  })),
  feriados: [],
}

const profissionais: Professional[] = [
  {
    id: 'prof-a',
    nome: 'A',
    iniciais: 'A',
    conselho: 'CRMV-SP 1',
    especialidade: 'Clínica geral',
    corIndice: 0,
    salaPadraoId: 'sala-1',
    ativo: true,
  },
  {
    id: 'prof-b',
    nome: 'B',
    iniciais: 'B',
    conselho: 'CRMV-SP 2',
    especialidade: 'Clínica geral',
    corIndice: 1,
    salaPadraoId: 'sala-2',
    ativo: true,
  },
]

const tipos: AppointmentType[] = [
  { id: 'tipo-consulta', nome: 'Consulta', duracaoMinutos: 30, kind: 'consulta', salasCompativeis: [], permiteEncaixe: true },
  { id: 'tipo-vacina', nome: 'Vacina', duracaoMinutos: 15, kind: 'vacina', salasCompativeis: [], permiteEncaixe: true },
]

let sequencia = 0

function atendimento(patch: {
  data: string
  hora: number
  status: AppointmentStatus
  petId?: string
  professionalId?: string
  typeId?: string
  encaixe?: boolean
  duracao?: number
}): Appointment {
  sequencia += 1
  const duracao = patch.duracao ?? 60

  return {
    id: `apt-${sequencia}`,
    petId: patch.petId ?? `pet-${sequencia}`,
    tutorId: 'tutor-1',
    professionalId: patch.professionalId ?? 'prof-a',
    roomIds: [],
    typeId: patch.typeId ?? 'tipo-consulta',
    inicio: clock.toIso(patch.data, patch.hora * 60),
    fim: clock.toIso(patch.data, patch.hora * 60 + duracao),
    status: patch.status,
    origem: 'recepcao',
    encaixe: patch.encaixe ?? false,
    observacao: '',
    chegadaEm: null,
    iniciadoEm: null,
    finalizadoEm: null,
    canceladoEm: null,
    motivoCancelamento: null,
    justificativaDeFalta: null,
    encounterId: null,
    linkedGroupId: null,
    criadoEm: clock.toIso(patch.data, 8 * 60),
    atualizadoEm: clock.toIso(patch.data, 8 * 60),
  }
}

function resumir(appointments: Appointment[], encounters: Encounter[] = [], patch: Partial<ResumoFiltro> = {}) {
  return resumirClinica({
    appointments,
    encounters,
    clinic,
    profissionais,
    tipos,
    filtro: { periodo: 'semana', professionalId: null, typeId: null, ...patch },
    ancora: ANCORA,
    clock,
  })
}

describe('intervalo do período', () => {
  it('a semana começa na segunda e termina no domingo', () => {
    const intervalo = intervaloDoPeriodo('semana', ANCORA)

    expect(intervalo).toEqual({ inicio: '2026-08-24', fim: '2026-08-30' })
  })

  it('encontra a segunda mesmo partindo de um sábado', () => {
    expect(inicioDaSemana('2026-08-29')).toBe('2026-08-24')
  })

  it('encontra a segunda partindo de um domingo, sem pular a semana', () => {
    expect(inicioDaSemana('2026-08-30')).toBe('2026-08-24')
  })

  it('hoje é um dia só', () => {
    expect(intervaloDoPeriodo('hoje', ANCORA)).toEqual({
      inicio: ANCORA,
      fim: ANCORA,
    })
  })

  it('semana passada não encosta na atual', () => {
    expect(intervaloDoPeriodo('semana-passada', ANCORA)).toEqual({
      inicio: '2026-08-17',
      fim: '2026-08-23',
    })
  })

  it('trinta dias termina hoje e conta o próprio dia', () => {
    const intervalo = intervaloDoPeriodo('trinta-dias', ANCORA)

    expect(intervalo.fim).toBe(ANCORA)
    expect(diasDoIntervalo(intervalo)).toHaveLength(30)
  })
})

describe('indicadores', () => {
  /**
   * A regra que atravessa o painel: **cancelado não é falta**. Quem avisou liberou o horário;
   * somar os dois faz o número parecer pior do que é.
   */
  it('deixa o cancelado fora da taxa de comparecimento', () => {
    const resumo = resumir([
      atendimento({ data: ANCORA, hora: 9, status: 'finalizado' }),
      atendimento({ data: ANCORA, hora: 10, status: 'finalizado' }),
      atendimento({ data: ANCORA, hora: 11, status: 'finalizado' }),
      atendimento({ data: ANCORA, hora: 12, status: 'falta' }),
      atendimento({ data: ANCORA, hora: 13, status: 'cancelado' }),
      atendimento({ data: ANCORA, hora: 14, status: 'cancelado' }),
    ])

    expect(resumo.indicadores.finalizados).toBe(3)
    expect(resumo.indicadores.faltas).toBe(1)
    expect(resumo.indicadores.cancelados).toBe(2)
    expect(resumo.indicadores.comparecimento).toBeCloseTo(0.75)
  })

  it('não divide por zero quando não houve movimento', () => {
    const resumo = resumir([])

    expect(resumo.indicadores.comparecimento).toBe(0)
    expect(resumo.indicadores.ocupacaoMedia).toBe(0)
  })

  it('soma as horas atendidas só do que foi concluído', () => {
    const resumo = resumir([
      atendimento({ data: ANCORA, hora: 9, status: 'finalizado', duracao: 90 }),
      atendimento({ data: ANCORA, hora: 11, status: 'falta', duracao: 60 }),
    ])

    expect(resumo.indicadores.horasAtendidas).toBeCloseTo(1.5)
  })

  it('conta encaixes', () => {
    const resumo = resumir([
      atendimento({ data: ANCORA, hora: 9, status: 'finalizado', encaixe: true }),
      atendimento({ data: ANCORA, hora: 10, status: 'finalizado' }),
    ])

    expect(resumo.indicadores.encaixes).toBe(1)
  })

  /** Paciente novo é quem estreia na base, não quem apareceu de novo no período. */
  it('conta como novo só o paciente cujo primeiro atendimento cai no período', () => {
    const resumo = resumir([
      atendimento({ data: '2026-08-25', hora: 9, status: 'agendado', petId: 'pet-antigo' }),
      /* Fora do período e mais antigo: o pet deixa de ser novidade. */
      atendimento({ data: '2026-07-01', hora: 9, status: 'finalizado', petId: 'pet-antigo' }),
      atendimento({ data: '2026-08-26', hora: 9, status: 'agendado', petId: 'pet-estreante' }),
    ])

    expect(resumo.indicadores.novosPacientes).toBe(1)
  })

  /**
   * Filtrando por um profissional, a capacidade também precisa cair para um. Dividindo pela
   * capacidade da equipe inteira, a ocupação virava um quinto e o painel dizia "clínica vazia"
   * no dia mais cheio da agenda de alguém.
   */
  it('divide a ocupação pela capacidade do profissional filtrado', () => {
    const atendimentos = [
      atendimento({ data: ANCORA, hora: 9, status: 'finalizado', professionalId: 'prof-a', duracao: 300 }),
      atendimento({ data: ANCORA, hora: 9, status: 'finalizado', professionalId: 'prof-b', duracao: 300 }),
    ]

    const equipeInteira = resumir(atendimentos, [], { periodo: 'hoje' })
    const soDeA = resumir(atendimentos, [], { periodo: 'hoje', professionalId: 'prof-a' })

    expect(equipeInteira.indicadores.ocupacaoMedia).toBeCloseTo(soDeA.indicadores.ocupacaoMedia)
  })
})

describe('séries', () => {
  it('gera um ponto por dia do intervalo, inclusive nos dias sem movimento', () => {
    const resumo = resumir([atendimento({ data: ANCORA, hora: 9, status: 'finalizado' })])

    expect(resumo.porDia).toHaveLength(7)
    expect(resumo.porDia[0]?.finalizados).toBe(1)
    expect(resumo.porDia[1]?.finalizados).toBe(0)
  })

  it('marca como fechado o dia em que a clínica não abre', () => {
    const resumo = resumir([])
    const domingo = resumo.porDia[resumo.porDia.length - 1]

    expect(domingo?.data).toBe('2026-08-30')
    expect(domingo?.fechado).toBe(true)
  })

  it('marca feriado como dia fechado', () => {
    const resumo = resumirClinica({
      appointments: [],
      encounters: [],
      clinic: { ...clinic, feriados: [{ date: '2026-08-26', nome: 'Feriado', fechado: true }] },
      profissionais,
      tipos,
      filtro: { periodo: 'semana', professionalId: null, typeId: null },
      ancora: ANCORA,
      clock,
    })

    expect(resumo.porDia.find((ponto) => ponto.data === '2026-08-26')?.fechado).toBe(true)
  })

  /** Dia fechado não entra no divisor: senão a semana cheia parece folgada. */
  it('tira os dias fechados da média de ocupação', () => {
    const resumo = resumir([
      atendimento({ data: ANCORA, hora: 8, status: 'finalizado', duracao: 600 }),
      atendimento({ data: ANCORA, hora: 8, status: 'finalizado', professionalId: 'prof-b', duracao: 600 }),
    ])

    /** Um dia a 100% em seis dias abertos — não em sete. */
    expect(resumo.indicadores.ocupacaoMedia).toBeCloseTo(1 / 6, 2)
  })

  it('ordena tipos e profissionais do mais frequente para o menos', () => {
    const resumo = resumir([
      atendimento({ data: ANCORA, hora: 9, status: 'finalizado', typeId: 'tipo-vacina' }),
      atendimento({ data: ANCORA, hora: 10, status: 'finalizado', typeId: 'tipo-consulta' }),
      atendimento({ data: ANCORA, hora: 11, status: 'finalizado', typeId: 'tipo-consulta' }),
    ])

    expect(resumo.porTipo[0]).toMatchObject({ rotulo: 'Consulta', valor: 2 })
    expect(resumo.porTipo[0]?.parte).toBeCloseTo(2 / 3)
  })

  it('não conta cancelado nas distribuições', () => {
    const resumo = resumir([
      atendimento({ data: ANCORA, hora: 9, status: 'cancelado', typeId: 'tipo-vacina' }),
      atendimento({ data: ANCORA, hora: 10, status: 'finalizado', typeId: 'tipo-consulta' }),
    ])

    expect(resumo.porTipo).toHaveLength(1)
    expect(resumo.porTipo[0]?.rotulo).toBe('Consulta')
  })

  it('agrupa a grade de horários por dia da semana e hora de início', () => {
    const resumo = resumir([
      atendimento({ data: ANCORA, hora: 9, status: 'finalizado' }),
      atendimento({ data: ANCORA, hora: 9, status: 'finalizado' }),
      atendimento({ data: '2026-08-25', hora: 14, status: 'agendado' }),
    ])

    const segundaAs9 = resumo.porHora.find((celula) => celula.weekday === 1 && celula.hora === 9)

    expect(segundaAs9?.valor).toBe(2)
    expect(resumo.picoDaHora).toBe(2)
  })

  it('filtra por tipo de atendimento', () => {
    const resumo = resumir(
      [
        atendimento({ data: ANCORA, hora: 9, status: 'finalizado', typeId: 'tipo-vacina' }),
        atendimento({ data: ANCORA, hora: 10, status: 'finalizado', typeId: 'tipo-consulta' }),
      ],
      [],
      { typeId: 'tipo-vacina' },
    )

    expect(resumo.indicadores.finalizados).toBe(1)
    expect(resumo.porTipo).toHaveLength(1)
  })
})
