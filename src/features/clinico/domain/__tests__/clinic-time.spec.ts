import { describe, expect, it } from 'vitest'

import {
  addDays,
  clockToMinutes,
  createClinicClock,
  diffDays,
  epochToWall,
  minutesToClock,
  nextBusinessDay,
  normalizeWall,
  offsetToMinutes,
  snapMinutes,
  startOfWeek,
  weekDates,
  weekdayOf,
} from '../clinic-time'

const clock = createClinicClock('-04:00')

describe('clinic-time', () => {
  it('lê o offset da clínica, não o do navegador', () => {
    expect(offsetToMinutes('-04:00')).toBe(-240)
    expect(offsetToMinutes('+05:30')).toBe(330)
    expect(offsetToMinutes('lixo')).toBe(0)
  })

  it('mantém a hora de parede independente do fuso da máquina', () => {
    /** 12:00 UTC é 08:00 na parede da clínica em -04:00. */
    const wall = epochToWall(Date.parse('2026-08-21T12:00:00Z'), '-04:00')

    expect(wall.date).toBe('2026-08-21')
    expect(minutesToClock(wall.minutes)).toBe('08:00')
  })

  it('serializa sempre com o offset explícito', () => {
    expect(clock.toIso('2026-08-21', clockToMinutes('09:30'))).toBe('2026-08-21T09:30:00-04:00')
  })

  it('sobrevive à ida e volta', () => {
    const iso = clock.toIso('2026-08-21', 13 * 60 + 45)

    expect(clock.dateOf(iso)).toBe('2026-08-21')
    expect(clock.minutesOf(iso)).toBe(13 * 60 + 45)
  })

  it('mede minutos a partir da meia-noite de uma data de referência', () => {
    const iso = clock.toIso('2026-08-22', 60)

    expect(clock.minutesFrom(iso, '2026-08-21')).toBe(24 * 60 + 60)
  })

  it('normaliza faixa que vira o dia', () => {
    expect(normalizeWall({ date: '2026-08-21', minutes: 25 * 60 })).toEqual({
      date: '2026-08-22',
      minutes: 60,
    })
  })

  it('faz aritmética de calendário', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
    expect(diffDays('2026-08-21', '2026-08-28')).toBe(7)
    expect(weekdayOf('2026-08-21')).toBe(5)
  })

  it('abre a semana na segunda', () => {
    expect(startOfWeek('2026-08-21')).toBe('2026-08-17')
    expect(weekDates('2026-08-21')).toHaveLength(7)
    expect(weekDates('2026-08-21')[0]).toBe('2026-08-17')
  })

  it('empurra fim de semana para o próximo dia útil', () => {
    /** 2026-08-22 é sábado, 2026-08-23 é domingo. */
    expect(nextBusinessDay('2026-08-22')).toBe('2026-08-24')
    expect(nextBusinessDay('2026-08-23')).toBe('2026-08-24')
    expect(nextBusinessDay('2026-08-21')).toBe('2026-08-21')
  })

  it('gruda o arraste na grade de 15 minutos', () => {
    expect(snapMinutes(519, 15)).toBe(525)
    expect(snapMinutes(511, 15)).toBe(510)
    expect(snapMinutes(517, 15)).toBe(510)
  })
})
