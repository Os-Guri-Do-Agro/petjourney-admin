/**
 * Retorno indicado e não marcado.
 *
 * "Retorno em 15 dias" registrado ontem não é pendência — é combinado. Vira pendência quando a
 * janela chega e ninguém marcou: aí é receita parada na mesa, e a clínica precisa ver.
 *
 * Sem este corte a lista de pendências acumula todo retorno já indicado na vida do paciente e
 * deixa de ser lida.
 */

import type { Encounter, ISODate } from '../data/types'

import { addDays, type ClinicClock, diffDays } from './clinic-time'

export type RetornoPendente = {
  encounter: Encounter
  /** Data em que o retorno deveria acontecer. */
  vencimento: ISODate
  /** Negativo enquanto falta tempo; positivo quando já passou. */
  diasDeAtraso: number
}

export function retornoPendente(
  encounter: Encounter,
  clock: ClinicClock,
  hoje: ISODate,
): RetornoPendente | null {
  const { emDias, appointmentId } = encounter.conduta.retorno

  if (emDias === null || appointmentId !== null) {
    return null
  }

  const base = clock.dateOf(encounter.finalizadoEm ?? encounter.abertoEm)
  const vencimento = addDays(base, emDias)

  return { encounter, vencimento, diasDeAtraso: diffDays(vencimento, hoje) }
}

/** Só os que já venceram, do mais atrasado para o menos. */
export function retornosVencidos(
  encounters: Encounter[],
  clock: ClinicClock,
  hoje: ISODate,
): RetornoPendente[] {
  return encounters
    .map((encounter) => retornoPendente(encounter, clock, hoje))
    .filter((item): item is RetornoPendente => item !== null && item.diasDeAtraso >= 0)
    .sort((a, b) => b.diasDeAtraso - a.diasDeAtraso)
}
