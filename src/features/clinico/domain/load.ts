/**
 * Carga da agenda: quanto do dia já está comprometido.
 *
 * A ocupação sai como número, não só como barra: em escala de cinza uma barra sozinha não
 * diz nada, e a visão de semana precisa ser lida de relance.
 */

import type {
  Appointment,
  Clinic,
  DiaCarga,
  ISODate,
  NoShowSummary,
  Professional,
} from '../data/types'

import { clockToMinutes, type ClinicClock, weekdayOf } from './clinic-time'
import { ocupaHorario } from './conflicts'

export function capacidadeDoDia(
  clinic: Clinic,
  data: ISODate,
  profissionais: Professional[],
): number {
  const horario = clinic.horarios.find((item) => item.weekday === weekdayOf(data))

  if (!horario || horario.fechado) {
    return 0
  }

  const bruto = clockToMinutes(horario.expediente.fim) - clockToMinutes(horario.expediente.inicio)
  const almoco = horario.almoco
    ? clockToMinutes(horario.almoco.fim) - clockToMinutes(horario.almoco.inicio)
    : 0

  return Math.max(0, bruto - almoco) * Math.max(1, profissionais.length)
}

export function cargaDoDia(
  data: ISODate,
  atendimentos: Appointment[],
  clinic: Clinic,
  profissionais: Professional[],
  clock: ClinicClock,
): DiaCarga {
  const doDia = atendimentos.filter((appointment) => clock.dateOf(appointment.inicio) === data)
  const ocupado = doDia
    .filter(ocupaHorario)
    .reduce(
      (total, appointment) => total + clock.durationMinutes(appointment.inicio, appointment.fim),
      0,
    )

  const capacidade = capacidadeDoDia(clinic, data, profissionais)

  return {
    data,
    agendados: doDia.filter(ocupaHorario).length,
    capacidadeMinutos: capacidade,
    ocupadoMinutos: ocupado,
    ocupacao: capacidade > 0 ? Math.min(ocupado / capacidade, 2) : 0,
    faltas: doDia.filter((appointment) => appointment.status === 'falta').length,
    encaixes: doDia.filter((appointment) => appointment.encaixe && ocupaHorario(appointment)).length,
  }
}

export type FaixaOcupacao = 'vazio' | 'tranquilo' | 'cheio' | 'excedido'

export function faixaDeOcupacao(ocupacao: number): FaixaOcupacao {
  if (ocupacao <= 0) {
    return 'vazio'
  }

  if (ocupacao < 0.7) {
    return 'tranquilo'
  }

  if (ocupacao <= 1) {
    return 'cheio'
  }

  return 'excedido'
}

/**
 * Resumo de faltas por responsável e paciente. O painel mostra quantas **e quanto**: a
 * conversa com o responsável muda quando a clínica sabe quantos minutos de agenda ficaram
 * parados.
 */
export function resumirFaltas(
  atendimentos: Appointment[],
  clock: ClinicClock,
  limiteReincidencia: number,
): NoShowSummary[] {
  const porChave = new Map<string, NoShowSummary>()

  for (const appointment of atendimentos) {
    if (appointment.status !== 'falta') {
      continue
    }

    const chave = `${appointment.tutorId}|${appointment.petId}`
    const atual = porChave.get(chave) ?? {
      tutorId: appointment.tutorId,
      petId: appointment.petId,
      faltas: 0,
      minutosPerdidos: 0,
      ultimaFaltaEm: null,
      reincidente: false,
    }

    atual.faltas += 1
    atual.minutosPerdidos += clock.durationMinutes(appointment.inicio, appointment.fim)

    if (!atual.ultimaFaltaEm || appointment.inicio > atual.ultimaFaltaEm) {
      atual.ultimaFaltaEm = appointment.inicio
    }

    atual.reincidente = atual.faltas >= limiteReincidencia
    porChave.set(chave, atual)
  }

  return [...porChave.values()].sort(
    (a, b) => b.faltas - a.faltas || b.minutosPerdidos - a.minutosPerdidos,
  )
}
