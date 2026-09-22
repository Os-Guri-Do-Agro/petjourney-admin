/**
 * Relógio do hotel.
 *
 * O módulo não tem aritmética de tempo própria: `clinic-time` já resolve parede, offset e
 * conversão para ISO, e é o mesmo relógio da casa. O que existe aqui é o pouco que o hotel
 * precisa e a clínica não: **contagem de diárias** e **cruzamento de intervalos longos**.
 *
 * A diferença de escala é real. A agenda clínica pensa em minutos dentro de um dia; o hotel pensa
 * em dias dentro de um mês, e as duas perguntas não se respondem com a mesma função. Uma estadia
 * que entra às 18h do dia 22 e sai às 9h do dia 23 dura **uma diária**, e nenhuma conta de minutos
 * chega a esse número sozinha.
 */

import {
  addDays,
  clockToMinutes,
  createClinicClock,
  diffDays,
  epochToWall,
  minutesToClock,
  offsetToMinutes,
  wallToIso,
} from '@/features/clinico/domain/clinic-time'

import type { ClockTime, ISODate, ISODateTime } from '../data/types'

export { addDays, clockToMinutes, createClinicClock, diffDays, minutesToClock, offsetToMinutes }

/**
 * O offset gravado no próprio instante.
 *
 * Todo `ISODateTime` do módulo carrega o offset da parede da casa — é invariante do contrato, e
 * está lá justamente para que uma data lida de um registro antigo não precise da configuração
 * atual do hotel para ser interpretada.
 */
export function offsetDe(iso: ISODateTime): string {
  return iso.slice(19) || 'Z'
}

/** A data de um instante, sem o horário. */
export function dataDe(iso: ISODateTime): ISODate {
  return iso.slice(0, 10)
}

/** O horário de parede de um instante, `HH:mm`. */
export function horaDe(iso: ISODateTime): ClockTime {
  return iso.slice(11, 16)
}

/** Minutos desde a meia-noite da parede, para comparar com um horário de política. */
export function minutosDe(iso: ISODateTime): number {
  return clockToMinutes(horaDe(iso))
}

/** Monta um instante a partir de data, hora e o offset da casa. */
export function instante(data: ISODate, hora: ClockTime, utcOffset: string): ISODateTime {
  return wallToIso({ date: data, minutes: clockToMinutes(hora) }, utcOffset)
}

/** Soma minutos a um instante, preservando o offset da parede em que ele foi escrito. */
export function maisMinutos(iso: ISODateTime, minutos: number): ISODateTime {
  const offset = offsetDe(iso)

  return wallToIso(epochToWall(Date.parse(iso) + minutos * 60_000, offset), offset)
}

/**
 * Todas as datas de um intervalo, inclusive as pontas.
 *
 * Usado pelo mapa de ocupação e pelo resumo: a pergunta "quantos estavam na casa no dia 24" só tem
 * resposta se a estadia souber dizer em quais dias ela existe.
 */
export function datasEntre(inicio: ISODate, fim: ISODate): ISODate[] {
  const total = diffDays(inicio, fim)

  if (total < 0) {
    return []
  }

  return Array.from({ length: total + 1 }, (_, indice) => addDays(inicio, indice))
}

/**
 * Dois intervalos se cruzam?
 *
 * Comparação por **instante** e não por data, e com as pontas abertas: uma saída às 10h e uma
 * entrada às 10h do mesmo dia não se cruzam. É metade da regra R2 — a outra metade, a janela de
 * higienização, é somada por quem chama.
 */
export function cruzam(
  umInicio: ISODateTime,
  umFim: ISODateTime,
  outroInicio: ISODateTime,
  outroFim: ISODateTime,
): boolean {
  return Date.parse(umInicio) < Date.parse(outroFim) && Date.parse(outroInicio) < Date.parse(umFim)
}

/**
 * Quantas diárias uma estadia custa.
 *
 * **Não é `diffDays`.** Cada pernoite é uma diária, com um piso de um: entrada e saída no mesmo
 * dia continuam custando uma, porque o animal ocupou a acomodação e ela não pôde ser vendida.
 *
 * A saída depois do horário limite acrescenta meia ou uma inteira — isso fica em
 * `cobrancaDaSaida`, porque é preço e não tempo.
 */
export function contarDiarias(entrada: ISODateTime, saida: ISODateTime): number {
  return Math.max(1, diffDays(dataDe(entrada), dataDe(saida)))
}
