/**
 * Horários sugeridos: perto do que a pessoa queria, e nunca no passado.
 *
 * A busca mede a distância para os dois lados da preferência. Num dia que já começou, isso
 * oferecia à recepção horários que tinham passado — e uma sugestão que ninguém pode aceitar
 * ensina a recepção a ignorar todas as outras.
 */

import { describe, expect, it } from 'vitest'

import { appointmentTypesFixture, petsFixture, roomsFixture } from '../../data/fixtures'
import type { Clinic } from '../../data/types'
import { createClinicClock, type ClinicClock } from '../clinic-time'
import type { ConflictContext } from '../conflicts'
import { buscarAlternativas, type BuscaSlotInput } from '../slots'

const OFFSET = '-04:00'
const DATA = '2026-08-21'
const AMANHA = '2026-08-22'

const clinic: Clinic = {
  id: 'c',
  nome: 'Teste',
  endereco: 'Rua Teste, 1',
  telefone: '(11) 0000-0000',
  utcOffset: OFFSET,
  slotMinutos: 15,
  horarios: ([0, 1, 2, 3, 4, 5, 6] as const).map((weekday) => ({
    weekday,
    fechado: false,
    expediente: { inicio: '08:00', fim: '19:00' },
    almoco: null,
  })),
  feriados: [],
}

/** O relógio da clínica parado num minuto de `DATA`. */
function relogioEm(minutos: number): ClinicClock {
  return { ...createClinicClock(OFFSET), now: () => ({ date: DATA, minutes: minutos }) }
}

function contexto(clock: ClinicClock): ConflictContext {
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
  }
}

function busca(patch: Partial<BuscaSlotInput> = {}): BuscaSlotInput {
  return {
    petId: 'pet-tofu',
    typeId: 'tipo-consulta',
    duracaoMinutos: 30,
    professionalIds: ['prof-ana'],
    roomIds: [],
    preferenciaMinutos: 17 * 60 + 30,
    data: DATA,
    ...patch,
  }
}

describe('buscarAlternativas', () => {
  it('hoje, não sugere horário que já começou', () => {
    const agora = 17 * 60 + 30
    const sugestoes = buscarAlternativas(busca(), contexto(relogioEm(agora)), 20)

    expect(sugestoes.length).toBeGreaterThan(0)
    for (const sugestao of sugestoes) {
      expect(relogioEm(agora).minutesOf(sugestao.inicio)).toBeGreaterThanOrEqual(agora)
    }
  })

  it('em outro dia, oferece o dia inteiro, antes e depois da preferência', () => {
    const sugestoes = buscarAlternativas(
      busca({ data: AMANHA }),
      { ...contexto(relogioEm(17 * 60 + 30)), data: AMANHA },
      20,
    )
    const minutos = sugestoes.map((sugestao) => relogioEm(0).minutesOf(sugestao.inicio))

    expect(minutos.some((minuto) => minuto < 17 * 60 + 30)).toBe(true)
  })
})
