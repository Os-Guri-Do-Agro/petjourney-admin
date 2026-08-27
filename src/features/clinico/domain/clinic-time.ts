/**
 * Hora de parede da clínica — nunca a do navegador.
 *
 * Este é o **único** arquivo do módulo autorizado a tocar em `Date`. Quem opera com o
 * computador em outro fuso leria 09:00 como 10:00, e isso é erro clínico, não cosmético.
 * Componente que precisa de "agora" pede aqui.
 *
 * A representação de trabalho é `Wall`: uma data civil (`YYYY-MM-DD`) mais os minutos desde
 * a meia-noite. Aritmética de agenda é aritmética de minutos; instante epoch só aparece nas
 * fronteiras de serialização.
 */

import type { ClockTime, ISODate, ISODateTime, WeekdayIndex } from '../data/types'

export const MINUTOS_POR_DIA = 24 * 60

export type Wall = {
  date: ISODate
  /** Minutos desde a meia-noite da parede da clínica. Pode passar de 1440 em faixa que vira o dia. */
  minutes: number
}

/**
 * Deslocamento artificial do relógio, em milissegundos, usado só pelo painel de
 * desenvolvimento para viajar no tempo sem mexer no relógio da máquina.
 */
let clockSkewMs = 0

export function setClockSkew(ms: number) {
  clockSkewMs = ms
}

export function getClockSkew() {
  return clockSkewMs
}

export function epochNow() {
  return Date.now() + clockSkewMs
}

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

/** `-04:00` → `-240`. */
export function offsetToMinutes(utcOffset: string): number {
  const match = /^([+-])(\d{2}):?(\d{2})$/.exec(utcOffset.trim())

  if (!match) {
    return 0
  }

  const sign = match[1] === '-' ? -1 : 1
  const hours = Number(match[2])
  const minutes = Number(match[3])

  return sign * (hours * 60 + minutes)
}

export function parseDate(date: ISODate): { year: number; month: number; day: number } {
  const parts = date.split('-')

  return {
    year: Number(parts[0] ?? '1970'),
    month: Number(parts[1] ?? '01'),
    day: Number(parts[2] ?? '01'),
  }
}

/** `08:30` → `510`. */
export function clockToMinutes(clock: ClockTime): number {
  const parts = clock.split(':')

  return Number(parts[0] ?? '0') * 60 + Number(parts[1] ?? '0')
}

/** `510` → `08:30`. Minutos acima de 1440 continuam legíveis como `25:00`. */
export function minutesToClock(minutes: number): ClockTime {
  const safe = Math.max(0, Math.round(minutes))

  return `${pad2(Math.floor(safe / 60))}:${pad2(safe % 60)}`
}

export function wallToEpoch(wall: Wall, utcOffset: string): number {
  const { year, month, day } = parseDate(wall.date)

  return Date.UTC(year, month - 1, day, 0, wall.minutes) - offsetToMinutes(utcOffset) * 60_000
}

export function epochToWall(epochMs: number, utcOffset: string): Wall {
  const shifted = new Date(epochMs + offsetToMinutes(utcOffset) * 60_000)

  return {
    date: `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`,
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  }
}

export function wallToIso(wall: Wall, utcOffset: string): ISODateTime {
  const normalized = normalizeWall(wall)
  const sign = offsetToMinutes(utcOffset) < 0 ? '-' : '+'
  const abs = Math.abs(offsetToMinutes(utcOffset))
  const offsetLabel = `${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`

  return `${normalized.date}T${minutesToClock(normalized.minutes)}:00${offsetLabel}`
}

export function isoToWall(iso: ISODateTime, utcOffset: string): Wall {
  return epochToWall(Date.parse(iso), utcOffset)
}

/** Traz minutos fora de `0..1439` para o dia correspondente. */
export function normalizeWall(wall: Wall): Wall {
  if (wall.minutes >= 0 && wall.minutes < MINUTOS_POR_DIA) {
    return wall
  }

  const dayShift = Math.floor(wall.minutes / MINUTOS_POR_DIA)

  return {
    date: addDays(wall.date, dayShift),
    minutes: wall.minutes - dayShift * MINUTOS_POR_DIA,
  }
}

export function addDays(date: ISODate, days: number): ISODate {
  const { year, month, day } = parseDate(date)
  const shifted = new Date(Date.UTC(year, month - 1, day + days))

  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`
}

export function diffDays(from: ISODate, to: ISODate): number {
  const a = parseDate(from)
  const b = parseDate(to)

  return Math.round(
    (Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000,
  )
}

export function weekdayOf(date: ISODate): WeekdayIndex {
  const { year, month, day } = parseDate(date)

  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() as WeekdayIndex
}

/** Semana começando na segunda: é como a clínica lê a escala. */
export function startOfWeek(date: ISODate): ISODate {
  const weekday = weekdayOf(date)
  const back = weekday === 0 ? 6 : weekday - 1

  return addDays(date, -back)
}

export function weekDates(date: ISODate): ISODate[] {
  const monday = startOfWeek(date)

  return Array.from({ length: 7 }, (_, index) => addDays(monday, index))
}

export function isWeekend(date: ISODate): boolean {
  const weekday = weekdayOf(date)

  return weekday === 0 || weekday === 6
}

/** Empurra para a próxima segunda quando cai em fim de semana. */
export function nextBusinessDay(date: ISODate): ISODate {
  const weekday = weekdayOf(date)

  if (weekday === 6) {
    return addDays(date, 2)
  }

  if (weekday === 0) {
    return addDays(date, 1)
  }

  return date
}

/** Arredonda para a grade de 15 min (ou o passo pedido). Usado no snap do arraste. */
export function snapMinutes(minutes: number, step: number): number {
  if (step <= 0) {
    return Math.round(minutes)
  }

  return Math.round(minutes / step) * step
}

export type ClinicClock = {
  utcOffset: string
  /** Instante atual já na parede da clínica. */
  now(): Wall
  today(): ISODate
  nowIso(): ISODateTime
  toIso(date: ISODate, minutes: number): ISODateTime
  toWall(iso: ISODateTime): Wall
  minutesOf(iso: ISODateTime): number
  dateOf(iso: ISODateTime): ISODate
  /** Minutos de `iso` medidos a partir da meia-noite de `reference`. Atravessa o dia sem quebrar. */
  minutesFrom(iso: ISODateTime, reference: ISODate): number
  durationMinutes(inicio: ISODateTime, fim: ISODateTime): number
}

export function createClinicClock(utcOffset: string): ClinicClock {
  return {
    utcOffset,
    now: () => epochToWall(epochNow(), utcOffset),
    today: () => epochToWall(epochNow(), utcOffset).date,
    nowIso: () => wallToIso(epochToWall(epochNow(), utcOffset), utcOffset),
    toIso: (date, minutes) => wallToIso({ date, minutes }, utcOffset),
    toWall: (iso) => isoToWall(iso, utcOffset),
    minutesOf: (iso) => isoToWall(iso, utcOffset).minutes,
    dateOf: (iso) => isoToWall(iso, utcOffset).date,
    minutesFrom: (iso, reference) => {
      const wall = isoToWall(iso, utcOffset)

      return wall.minutes + diffDays(reference, wall.date) * MINUTOS_POR_DIA
    },
    durationMinutes: (inicio, fim) => Math.round((Date.parse(fim) - Date.parse(inicio)) / 60_000),
  }
}
