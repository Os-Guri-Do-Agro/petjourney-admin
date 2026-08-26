/**
 * Detecção de conflitos de agenda.
 *
 * Regra do módulo: **nada bloqueia**. Encaixe, invasão de bloqueio e agendamento em dia
 * fechado são sempre possíveis, com aviso. Só `holiday-closed` é `blocking`, e mesmo assim a
 * interface oferece confirmar em dois passos. Sistema que proíbe vira sistema contornado no
 * papel, com atendimento fantasma numa agenda paralela.
 *
 * Nenhum conflito carrega texto pronto: sai `kind` + `params` e a apresentação traduz.
 */

import type {
  Appointment,
  AppointmentType,
  Block,
  Clinic,
  Conflict,
  ISODate,
  ISODateTime,
  Pet,
  Room,
} from '../data/types'

import { clockToMinutes, type ClinicClock, weekdayOf } from './clinic-time'
import { overlapMinutes, overlaps, type Span } from './overlap'

/** Um atendimento cancelado ou faltoso não disputa o horário — mas continua visível no dia. */
export function ocupaHorario(appointment: Appointment): boolean {
  return appointment.status !== 'cancelado' && appointment.status !== 'falta'
}

export type ConflictCandidate = {
  /** Ausente quando é um agendamento novo. */
  id?: string
  petId: string
  professionalId: string
  roomIds: string[]
  typeId: string
  inicio: ISODateTime
  fim: ISODateTime
  /**
   * Grupo ligado (cirurgia que ocupa duas salas). As pernas do mesmo grupo compartilham
   * horário por construção e não devem acusar conflito entre si.
   */
  linkedGroupId?: string | null
}

export type ConflictContext = {
  clinic: Clinic
  clock: ClinicClock
  data: ISODate
  atendimentos: Appointment[]
  bloqueios: Block[]
  tipos: AppointmentType[]
  salas: Room[]
  pets: Pet[]
  /** Minutos de agenda por profissional acima dos quais a carga vira aviso. */
  capacidadeMinutos: number
}

const SEVERIDADE_ORDEM: Record<Conflict['severity'], number> = {
  blocking: 0,
  warning: 1,
  info: 2,
}

function spanOf(candidate: ConflictCandidate, clock: ClinicClock, data: ISODate): Span {
  return {
    id: candidate.id ?? 'candidato',
    inicioMin: clock.minutesFrom(candidate.inicio, data),
    fimMin: clock.minutesFrom(candidate.fim, data),
  }
}

function spanOfAppointment(appointment: Appointment, clock: ClinicClock, data: ISODate): Span {
  return {
    id: appointment.id,
    inicioMin: clock.minutesFrom(appointment.inicio, data),
    fimMin: clock.minutesFrom(appointment.fim, data),
  }
}

export function detectarConflitos(
  candidate: ConflictCandidate,
  context: ConflictContext,
): Conflict[] {
  const { clinic, clock, data } = context
  const conflitos: Conflict[] = []
  const alvo = spanOf(candidate, clock, data)

  const grupoDoCandidato = candidate.linkedGroupId ?? null
  const concorrentes = context.atendimentos.filter(
    (appointment) =>
      appointment.id !== candidate.id &&
      ocupaHorario(appointment) &&
      !(grupoDoCandidato !== null && appointment.linkedGroupId === grupoDoCandidato),
  )

  const petsPorId = new Map(context.pets.map((pet) => [pet.id, pet]))

  for (const appointment of concorrentes) {
    const outro = spanOfAppointment(appointment, clock, data)

    if (!overlaps(alvo, outro)) {
      continue
    }

    const nomePet = petsPorId.get(appointment.petId)?.nome ?? ''
    const hora = clock.toWall(appointment.inicio)

    if (appointment.professionalId === candidate.professionalId) {
      conflitos.push({
        kind: 'professional-overlap',
        severity: 'warning',
        params: {
          paciente: nomePet,
          hora: hora.minutes,
          minutos: overlapMinutes(alvo, outro),
        },
      })
    }

    const salaCompartilhada = appointment.roomIds.find((roomId) =>
      candidate.roomIds.includes(roomId),
    )

    if (salaCompartilhada) {
      conflitos.push({
        kind: 'room-overlap',
        severity: 'warning',
        params: {
          sala: context.salas.find((room) => room.id === salaCompartilhada)?.nome ?? '',
          paciente: nomePet,
        },
      })
    }

    if (appointment.petId === candidate.petId) {
      conflitos.push({
        kind: 'pet-double-book',
        severity: 'warning',
        params: { paciente: nomePet, hora: hora.minutes },
      })
    }
  }

  for (const bloqueio of context.bloqueios) {
    const faixa: Span = {
      id: bloqueio.id,
      inicioMin: clock.minutesFrom(bloqueio.inicio, data),
      fimMin: clock.minutesFrom(bloqueio.fim, data),
    }

    const atingeProfissional =
      bloqueio.professionalId === null || bloqueio.professionalId === candidate.professionalId
    const atingeSala = bloqueio.roomId !== null && candidate.roomIds.includes(bloqueio.roomId)

    if (!overlaps(alvo, faixa) || (!atingeProfissional && !atingeSala)) {
      continue
    }

    if (bloqueio.motivo === 'almoco') {
      conflitos.push({
        kind: 'lunch-overlap',
        severity: 'info',
        params: { minutos: overlapMinutes(alvo, faixa) },
      })

      continue
    }

    conflitos.push({
      kind: 'block-invasion',
      severity: 'warning',
      params: { motivo: bloqueio.motivo, minutos: overlapMinutes(alvo, faixa) },
    })
  }

  const feriado = clinic.feriados.find((item) => item.date === data) ?? null
  const horario = clinic.horarios.find((item) => item.weekday === weekdayOf(data)) ?? null

  if (feriado?.fechado) {
    conflitos.push({
      kind: 'holiday-closed',
      severity: 'blocking',
      params: { feriado: feriado.nome },
    })
  } else if (horario?.fechado) {
    conflitos.push({ kind: 'outside-hours', severity: 'warning', params: { motivo: 'fechado' } })
  } else if (horario) {
    const abre = clockToMinutes(horario.expediente.inicio)
    const fecha = clockToMinutes(horario.expediente.fim)

    if (alvo.inicioMin < abre || alvo.fimMin > fecha) {
      conflitos.push({
        kind: 'outside-hours',
        severity: 'warning',
        params: { abre, fecha },
      })
    }

    if (horario.almoco) {
      const almoco: Span = {
        id: 'almoco',
        inicioMin: clockToMinutes(horario.almoco.inicio),
        fimMin: clockToMinutes(horario.almoco.fim),
      }
      const invade = overlapMinutes(alvo, almoco)

      if (invade > 0 && !conflitos.some((item) => item.kind === 'lunch-overlap')) {
        conflitos.push({ kind: 'lunch-overlap', severity: 'info', params: { minutos: invade } })
      }
    }
  }

  const tipo = context.tipos.find((item) => item.id === candidate.typeId) ?? null

  if (tipo && tipo.salasCompativeis.length > 0) {
    const salasDoCandidato = candidate.roomIds
      .map((roomId) => context.salas.find((room) => room.id === roomId))
      .filter((room): room is Room => Boolean(room))

    const incompativel = salasDoCandidato.find(
      (room) => !tipo.salasCompativeis.includes(room.kind),
    )

    if (incompativel) {
      conflitos.push({
        kind: 'type-room-mismatch',
        severity: 'info',
        params: { sala: incompativel.nome, tipo: tipo.nome },
      })
    }
  }

  const minutosDoProfissional = context.atendimentos
    .filter(
      (appointment) =>
        appointment.professionalId === candidate.professionalId &&
        appointment.id !== candidate.id &&
        ocupaHorario(appointment),
    )
    .reduce((total, appointment) => total + clock.durationMinutes(appointment.inicio, appointment.fim), 0)

  const totalComCandidato = minutosDoProfissional + (alvo.fimMin - alvo.inicioMin)

  if (totalComCandidato > context.capacidadeMinutos) {
    conflitos.push({
      kind: 'over-capacity',
      severity: 'info',
      params: {
        minutos: totalComCandidato,
        capacidade: context.capacidadeMinutos,
      },
    })
  }

  return ordenarConflitos(dedupe(conflitos))
}

function dedupe(conflitos: Conflict[]): Conflict[] {
  const vistos = new Set<string>()

  return conflitos.filter((conflito) => {
    const chave = `${conflito.kind}|${JSON.stringify(conflito.params)}`

    if (vistos.has(chave)) {
      return false
    }

    vistos.add(chave)

    return true
  })
}

export function ordenarConflitos(conflitos: Conflict[]): Conflict[] {
  return [...conflitos].sort(
    (a, b) => SEVERIDADE_ORDEM[a.severity] - SEVERIDADE_ORDEM[b.severity],
  )
}

export function severidadeMaxima(conflitos: Conflict[]): Conflict['severity'] | null {
  if (conflitos.length === 0) {
    return null
  }

  return ordenarConflitos(conflitos)[0]?.severity ?? null
}

/**
 * Materializa a ocorrência de um bloqueio recorrente **na data pedida**. Devolver a ocorrência
 * original faz a faixa aparecer no horário certo do dia errado.
 */
export function materializarBloqueios(
  bloqueios: Block[],
  data: ISODate,
  clock: ClinicClock,
): Block[] {
  const weekday = weekdayOf(data)
  const materializados: Block[] = []

  for (const bloqueio of bloqueios) {
    const inicioWall = clock.toWall(bloqueio.inicio)
    const fimWall = clock.toWall(bloqueio.fim)

    if (!bloqueio.recorrencia) {
      if (inicioWall.date === data) {
        materializados.push(bloqueio)
      }

      continue
    }

    if (!bloqueio.recorrencia.weekdays.includes(weekday)) {
      continue
    }

    if (bloqueio.recorrencia.ate && data > bloqueio.recorrencia.ate) {
      continue
    }

    if (data < inicioWall.date) {
      continue
    }

    const atravessaODia = fimWall.date !== inicioWall.date
    const fimMinutos = atravessaODia ? fimWall.minutes + 24 * 60 : fimWall.minutes

    materializados.push({
      ...bloqueio,
      id: `${bloqueio.id}@${data}`,
      inicio: clock.toIso(data, inicioWall.minutes),
      fim: clock.toIso(data, fimMinutos),
      materializadoDe: bloqueio.id,
    })
  }

  return materializados
}
