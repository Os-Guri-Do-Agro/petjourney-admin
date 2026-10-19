/**
 * O que conta como histórico do paciente.
 *
 * Mora fora do `HistoricoLista` porque duas peças precisam da mesma régua: a lista, que desenha
 * cada acontecimento, e a aba "Histórico" da capa do paciente, que mostra quantos são. Duas
 * contas separadas acabariam discordando — a aba dizendo 24 e a lista mostrando 23 — e número que
 * não bate ensina a não ler número.
 */
import type { Appointment, AppointmentStatus, TimelineEvent } from '../../../data/types'

/** O que ainda vai acontecer ou está acontecendo agora: não é histórico. */
export const ATENDIMENTO_ABERTO: readonly AppointmentStatus[] = [
  'agendado',
  'confirmado',
  'aguardando',
  'em-atendimento',
]

/**
 * O atendimento passado que não virou evento da linha do tempo: o cancelado, a falta, a consulta
 * sem diagnóstico. Entra no histórico pela própria data.
 */
export function atendimentosSemEvento(
  eventos: TimelineEvent[],
  atendimentos: Appointment[],
  agoraIso: string,
): Appointment[] {
  const comEvento = new Set(eventos.map((evento) => evento.appointmentId).filter(Boolean))

  return atendimentos.filter(
    (atendimento) =>
      !comEvento.has(atendimento.id) &&
      atendimento.inicio <= agoraIso &&
      !ATENDIMENTO_ABERTO.includes(atendimento.status),
  )
}

/** Quantas linhas o histórico do paciente tem — o número da aba. */
export function contarHistorico(
  eventos: TimelineEvent[],
  atendimentos: Appointment[],
  agoraIso: string,
): number {
  return eventos.length + atendimentosSemEvento(eventos, atendimentos, agoraIso).length
}
