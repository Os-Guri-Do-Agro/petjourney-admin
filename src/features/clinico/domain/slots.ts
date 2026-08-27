/**
 * Horários livres e melhores alternativas.
 *
 * "Melhor alternativa" aqui é a que fica mais perto do que a pessoa queria e carrega menos
 * aviso. A busca nunca esconde um horário com conflito: devolve com os avisos anexados, e a
 * tela decide como apresentar.
 */

import type { Conflict, ISODate, ISODateTime, SlotSugestao } from '../data/types'

import { clockToMinutes, weekdayOf } from './clinic-time'
import { detectarConflitos, type ConflictContext } from './conflicts'

export type BuscaSlotInput = {
  petId: string
  typeId: string
  duracaoMinutos: number
  /** Profissionais aceitos; vazio significa qualquer um da agenda do dia. */
  professionalIds: string[]
  roomIds: string[]
  /** Preferência do responsável, em minutos desde a meia-noite. */
  preferenciaMinutos: number | null
  data: ISODate
}

export function gerarSlotsDoDia(
  context: ConflictContext,
  data: ISODate,
  passoMinutos: number,
): number[] {
  const horario = context.clinic.horarios.find((item) => item.weekday === weekdayOf(data))

  if (!horario || horario.fechado) {
    return []
  }

  const inicio = clockToMinutes(horario.expediente.inicio)
  const fim = clockToMinutes(horario.expediente.fim)
  const slots: number[] = []

  for (let minuto = inicio; minuto < fim; minuto += passoMinutos) {
    slots.push(minuto)
  }

  return slots
}

function pesoDosConflitos(conflitos: Conflict[]): number {
  return conflitos.reduce((total, conflito) => {
    if (conflito.severity === 'blocking') {
      return total + 1000
    }

    if (conflito.severity === 'warning') {
      return total + 100
    }

    return total + 10
  }, 0)
}

export function buscarAlternativas(
  input: BuscaSlotInput,
  context: ConflictContext,
  limite = 5,
): SlotSugestao[] {
  const passo = context.clinic.slotMinutos
  const slots = gerarSlotsDoDia(context, input.data, passo)
  const profissionais =
    input.professionalIds.length > 0
      ? input.professionalIds
      : context.atendimentos.length > 0
        ? [...new Set(context.atendimentos.map((appointment) => appointment.professionalId))]
        : []

  const sugestoes: SlotSugestao[] = []

  for (const professionalId of profissionais) {
    for (const minuto of slots) {
      const inicio: ISODateTime = context.clock.toIso(input.data, minuto)
      const fim: ISODateTime = context.clock.toIso(input.data, minuto + input.duracaoMinutos)

      const conflitos = detectarConflitos(
        {
          petId: input.petId,
          professionalId,
          roomIds: input.roomIds,
          typeId: input.typeId,
          inicio,
          fim,
        },
        { ...context, data: input.data },
      )

      sugestoes.push({
        professionalId,
        inicio,
        fim,
        conflitos,
        distanciaMinutos:
          input.preferenciaMinutos === null ? 0 : Math.abs(minuto - input.preferenciaMinutos),
      })
    }
  }

  return sugestoes
    .sort(
      (a, b) =>
        pesoDosConflitos(a.conflitos) - pesoDosConflitos(b.conflitos) ||
        a.distanciaMinutos - b.distanciaMinutos ||
        a.inicio.localeCompare(b.inicio),
    )
    .slice(0, limite)
}

/** Slots sem nenhum aviso — a lista curta que a recepção pode oferecer sem pensar. */
export function slotsLivres(
  input: BuscaSlotInput,
  context: ConflictContext,
  limite = 8,
): SlotSugestao[] {
  return buscarAlternativas(input, context, Number.MAX_SAFE_INTEGER)
    .filter((sugestao) => sugestao.conflitos.length === 0)
    .slice(0, limite)
}
