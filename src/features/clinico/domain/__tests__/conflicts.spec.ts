/**
 * Regras que separam "aviso" de "impedimento".
 *
 * A regra do módulo é que **nada bloqueia**: só `holiday-closed` é `blocking`, e mesmo assim a
 * interface oferece confirmar em dois passos. Sistema que proíbe vira sistema contornado no
 * papel, com atendimento fantasma numa agenda paralela.
 */

import { describe, expect, it } from 'vitest'

import { appointmentTypesFixture, petsFixture, roomsFixture } from '../../data/fixtures'
import type { Appointment, Block, Clinic } from '../../data/types'
import { createClinicClock } from '../clinic-time'
import {
  detectarConflitos,
  materializarBloqueios,
  ocupaHorario,
  severidadeMaxima,
  type ConflictContext,
} from '../conflicts'
import { groupOverlapping, layoutSpans, overlapMinutes } from '../overlap'

const OFFSET = '-04:00'
const clock = createClinicClock(OFFSET)
const DATA = '2026-08-21'

const clinic: Clinic = {
  id: 'c',
  nome: 'Teste',
  endereco: 'Rua Teste, 1',
  telefone: '(11) 0000-0000',
  utcOffset: OFFSET,
  slotMinutos: 15,
  horarios: [
    { weekday: 0, fechado: true, expediente: { inicio: '00:00', fim: '00:00' }, almoco: null },
    ...([1, 2, 3, 4, 5] as const).map((weekday) => ({
      weekday,
      fechado: false,
      expediente: { inicio: '08:00', fim: '19:00' },
      almoco: { inicio: '12:00', fim: '13:00' },
    })),
    { weekday: 6, fechado: false, expediente: { inicio: '08:00', fim: '13:00' }, almoco: null },
  ],
  feriados: [{ date: '2026-08-25', nome: 'Feriado municipal', fechado: true }],
}

function appointment(patch: Partial<Appointment> & Pick<Appointment, 'id'>): Appointment {
  return {
    petId: 'pet-luna',
    tutorId: 'tutor-marina',
    professionalId: 'prof-ana',
    roomIds: ['sala-1'],
    typeId: 'tipo-consulta',
    inicio: clock.toIso(DATA, 9 * 60),
    fim: clock.toIso(DATA, 9 * 60 + 30),
    status: 'agendado',
    origem: 'recepcao',
    encaixe: false,
    observacao: '',
    chegadaEm: null,
    iniciadoEm: null,
    finalizadoEm: null,
    canceladoEm: null,
    motivoCancelamento: null,
    encounterId: null,
    linkedGroupId: null,
    criadoEm: clock.toIso(DATA, 8 * 60),
    atualizadoEm: clock.toIso(DATA, 8 * 60),
    ...patch,
  }
}

function contexto(patch: Partial<ConflictContext> = {}): ConflictContext {
  return {
    clinic,
    clock,
    data: DATA,
    atendimentos: [],
    bloqueios: [],
    tipos: appointmentTypesFixture,
    salas: roomsFixture,
    pets: petsFixture,
    capacidadeMinutos: 8 * 60,
    ...patch,
  }
}

const candidato = {
  petId: 'pet-tofu',
  professionalId: 'prof-ana',
  roomIds: ['sala-1'],
  typeId: 'tipo-consulta',
  inicio: clock.toIso(DATA, 9 * 60 + 15),
  fim: clock.toIso(DATA, 9 * 60 + 45),
}

describe('detectarConflitos', () => {
  it('acusa sobreposição do mesmo profissional como aviso, não como impedimento', () => {
    const conflitos = detectarConflitos(
      candidato,
      contexto({ atendimentos: [appointment({ id: 'a' })] }),
    )

    const sobreposicao = conflitos.find((item) => item.kind === 'professional-overlap')

    expect(sobreposicao?.severity).toBe('warning')
    expect(sobreposicao?.params.minutos).toBe(15)
  })

  it('acusa sala ocupada mesmo com profissional diferente', () => {
    const conflitos = detectarConflitos(
      candidato,
      contexto({
        atendimentos: [appointment({ id: 'a', professionalId: 'prof-caio' })],
      }),
    )

    expect(conflitos.map((item) => item.kind)).toContain('room-overlap')
    expect(conflitos.map((item) => item.kind)).not.toContain('professional-overlap')
  })

  it('ignora atendimento cancelado: o horário está livre de novo', () => {
    const conflitos = detectarConflitos(
      candidato,
      contexto({ atendimentos: [appointment({ id: 'a', status: 'cancelado' })] }),
    )

    expect(conflitos.map((item) => item.kind)).not.toContain('professional-overlap')
  })

  it('não acusa conflito entre as pernas do mesmo grupo ligado', () => {
    const conflitos = detectarConflitos(
      { ...candidato, linkedGroupId: 'grupo-1' },
      contexto({
        atendimentos: [appointment({ id: 'a', linkedGroupId: 'grupo-1' })],
      }),
    )

    expect(conflitos.map((item) => item.kind)).not.toContain('professional-overlap')
  })

  it('trata invasão de bloqueio como aviso e almoço como informação', () => {
    const bloqueio: Block = {
      id: 'b1',
      professionalId: 'prof-ana',
      roomId: null,
      inicio: clock.toIso(DATA, 9 * 60),
      fim: clock.toIso(DATA, 10 * 60),
      motivo: 'reuniao',
      detalhe: '',
      recorrencia: null,
      materializadoDe: null,
    }

    const conflitos = detectarConflitos(candidato, contexto({ bloqueios: [bloqueio] }))
    const invasao = conflitos.find((item) => item.kind === 'block-invasion')

    expect(invasao?.severity).toBe('warning')
    expect(invasao?.params.motivo).toBe('reuniao')
  })

  it('marca o almoço atravessado como informação, com os minutos invadidos', () => {
    const conflitos = detectarConflitos(
      {
        ...candidato,
        inicio: clock.toIso(DATA, 11 * 60 + 30),
        fim: clock.toIso(DATA, 12 * 60 + 30),
      },
      contexto(),
    )

    const almoco = conflitos.find((item) => item.kind === 'lunch-overlap')

    expect(almoco?.severity).toBe('info')
    expect(almoco?.params.minutos).toBe(30)
  })

  it('feriado fechado é o único conflito bloqueante do módulo', () => {
    const conflitos = detectarConflitos(
      {
        ...candidato,
        inicio: clock.toIso('2026-08-25', 9 * 60),
        fim: clock.toIso('2026-08-25', 9 * 60 + 30),
      },
      contexto({ data: '2026-08-25' }),
    )

    expect(severidadeMaxima(conflitos)).toBe('blocking')
    expect(conflitos.filter((item) => item.severity === 'blocking')).toHaveLength(1)
    expect(conflitos[0]?.kind).toBe('holiday-closed')
  })

  it('avisa fora do expediente sem impedir o encaixe', () => {
    const conflitos = detectarConflitos(
      {
        ...candidato,
        inicio: clock.toIso(DATA, 20 * 60),
        fim: clock.toIso(DATA, 20 * 60 + 30),
      },
      contexto(),
    )

    const fora = conflitos.find((item) => item.kind === 'outside-hours')

    expect(fora?.severity).toBe('warning')
    expect(severidadeMaxima(conflitos)).not.toBe('blocking')
  })

  it('não devolve texto pronto: só `kind` e `params`', () => {
    const conflitos = detectarConflitos(
      candidato,
      contexto({ atendimentos: [appointment({ id: 'a' })] }),
    )

    for (const conflito of conflitos) {
      expect(Object.keys(conflito).sort()).toEqual(['kind', 'params', 'severity'])
    }
  })
})

describe('ocupaHorario', () => {
  it('cancelado e falta liberam o horário', () => {
    expect(ocupaHorario(appointment({ id: 'a', status: 'cancelado' }))).toBe(false)
    expect(ocupaHorario(appointment({ id: 'b', status: 'falta' }))).toBe(false)
    expect(ocupaHorario(appointment({ id: 'c', status: 'confirmado' }))).toBe(true)
  })
})

describe('materializarBloqueios', () => {
  it('devolve a ocorrência recorrente **na data pedida**', () => {
    const semanal: Block = {
      id: 'reuniao',
      professionalId: null,
      roomId: null,
      inicio: clock.toIso('2026-07-21', 17 * 60),
      fim: clock.toIso('2026-07-21', 18 * 60),
      motivo: 'reuniao',
      detalhe: '',
      /** Terça e quinta. 2026-08-25 é terça. */
      recorrencia: { kind: 'weekly', weekdays: [2, 4], ate: null },
      materializadoDe: null,
    }

    const naTerca = materializarBloqueios([semanal], '2026-08-25', clock)

    expect(naTerca).toHaveLength(1)
    expect(clock.dateOf(naTerca[0]!.inicio)).toBe('2026-08-25')
    expect(clock.minutesOf(naTerca[0]!.inicio)).toBe(17 * 60)
    expect(naTerca[0]!.materializadoDe).toBe('reuniao')

    /** 2026-08-26 é quarta: a ocorrência não existe nesse dia. */
    expect(materializarBloqueios([semanal], '2026-08-26', clock)).toHaveLength(0)
  })

  it('não repete bloqueio pontual em outro dia', () => {
    const pontual: Block = {
      id: 'manutencao',
      professionalId: null,
      roomId: 'sala-exame',
      inicio: clock.toIso(DATA, 10 * 60),
      fim: clock.toIso(DATA, 11 * 60),
      motivo: 'manutencao',
      detalhe: '',
      recorrencia: null,
      materializadoDe: null,
    }

    expect(materializarBloqueios([pontual], DATA, clock)).toHaveLength(1)
    expect(materializarBloqueios([pontual], '2026-08-24', clock)).toHaveLength(0)
  })
})

describe('empacotamento de sobreposições', () => {
  it('divide a coluna entre os que compartilham horário', () => {
    const layout = layoutSpans([
      { id: 'a', inicioMin: 540, fimMin: 600 },
      { id: 'b', inicioMin: 555, fimMin: 615 },
      { id: 'c', inicioMin: 700, fimMin: 730 },
    ])

    const a = layout.find((item) => item.id === 'a')
    const c = layout.find((item) => item.id === 'c')

    expect(a?.lanes).toBe(2)
    expect(a?.concorrentes).toBe(1)
    /** `c` não cruza ninguém: fica com a coluna inteira. */
    expect(c?.lanes).toBe(1)
  })

  it('agrupa sobreposição encadeada: A cruza B, B cruza C, os três dividem', () => {
    const grupos = groupOverlapping([
      { id: 'a', inicioMin: 540, fimMin: 570 },
      { id: 'b', inicioMin: 560, fimMin: 600 },
      { id: 'c', inicioMin: 590, fimMin: 620 },
    ])

    expect(grupos).toHaveLength(1)
    expect(grupos[0]).toHaveLength(3)
  })

  it('mede a interseção em minutos', () => {
    expect(
      overlapMinutes({ id: 'a', inicioMin: 540, fimMin: 600 }, { id: 'b', inicioMin: 570, fimMin: 630 }),
    ).toBe(30)
    expect(
      overlapMinutes({ id: 'a', inicioMin: 540, fimMin: 560 }, { id: 'b', inicioMin: 560, fimMin: 600 }),
    ).toBe(0)
  })
})
