/**
 * Os casos difíceis do requisito da agenda, verificados no dataset.
 *
 * Estes testes existem porque um caso difícil que **deixa de ser difícil** não avisa. O encaixe
 * de emergência já esteve plantado num horário sem bloqueio nenhum por baixo: a grade mostrava
 * um encaixe comum, o conflito `block-invasion` nunca era exercitado, e a demonstração passava
 * batida por meses sem ninguém notar que o caso tinha evaporado.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { createClinicClock } from '../../domain/clinic-time'
import { detectarConflitos, materializarBloqueios } from '../../domain/conflicts'
import { CAPACIDADE_MINUTOS_POR_PROFISSIONAL } from '../../domain/load'
import {
  appointmentTypesFixture,
  CLINIC_UTC_OFFSET,
  roomsFixture,
} from '../fixtures'
import { getDataset, resetDataset } from '../store'

const clock = createClinicClock(CLINIC_UTC_OFFSET)

function contextoDoDia() {
  const dataset = getDataset()
  const data = dataset.ancora

  return {
    clinic: dataset.clinic,
    clock,
    data,
    atendimentos: dataset.appointments.filter(
      (appointment) => clock.dateOf(appointment.inicio) === data,
    ),
    bloqueios: materializarBloqueios(dataset.blocks, data, clock),
    tipos: appointmentTypesFixture,
    salas: roomsFixture,
    pets: dataset.pets,
    capacidadeMinutos: CAPACIDADE_MINUTOS_POR_PROFISSIONAL,
  }
}

describe('casos difíceis do dia âncora', () => {
  beforeEach(() => {
    resetDataset()
  })

  it('o encaixe de emergência cai dentro de um bloco reservado', () => {
    const encaixe = getDataset().appointments.find((item) => item.id === 'apt-encaixe')

    expect(encaixe).toBeDefined()
    expect(encaixe!.encaixe).toBe(true)

    const conflitos = detectarConflitos(
      {
        id: encaixe!.id,
        petId: encaixe!.petId,
        professionalId: encaixe!.professionalId,
        roomIds: encaixe!.roomIds,
        typeId: encaixe!.typeId,
        inicio: encaixe!.inicio,
        fim: encaixe!.fim,
        linkedGroupId: encaixe!.linkedGroupId,
      },
      contextoDoDia(),
    )

    /* O ponto do caso: a emergência precisa levantar invasão de bloqueio. */
    expect(conflitos.map((conflito) => conflito.kind)).toContain('block-invasion')
  })

  it('o encaixe atravessa o bloqueio sem ser impedido', () => {
    /**
     * Nada bloqueia — regra do módulo inteiro. O conflito é aviso, e um aviso `blocking` aqui
     * transformaria a emergência em algo que a recepção teria de contornar no papel.
     */
    const encaixe = getDataset().appointments.find((item) => item.id === 'apt-encaixe')!
    const conflitos = detectarConflitos(
      {
        id: encaixe.id,
        petId: encaixe.petId,
        professionalId: encaixe.professionalId,
        roomIds: encaixe.roomIds,
        typeId: encaixe.typeId,
        inicio: encaixe.inicio,
        fim: encaixe.fim,
        linkedGroupId: encaixe.linkedGroupId,
      },
      contextoDoDia(),
    )

    const invasao = conflitos.find((conflito) => conflito.kind === 'block-invasion')

    expect(invasao?.severity).not.toBe('blocking')
  })

  it('a cirurgia ocupa duas salas em atendimentos ligados', () => {
    const dataset = getDataset()
    const centro = dataset.appointments.find((item) => item.id === 'apt-cirurgia-centro')!
    const recuperacao = dataset.appointments.find(
      (item) => item.id === 'apt-cirurgia-recuperacao',
    )!

    expect(centro.linkedGroupId).toBeTruthy()
    expect(centro.linkedGroupId).toBe(recuperacao.linkedGroupId)
    expect(centro.roomIds).not.toEqual(recuperacao.roomIds)
  })

  it('há sobreposição de dois pacientes no mesmo profissional', () => {
    const dataset = getDataset()
    const a = dataset.appointments.find((item) => item.id === 'apt-sobrepoe-a')!
    const b = dataset.appointments.find((item) => item.id === 'apt-sobrepoe-b')!

    expect(a.professionalId).toBe(b.professionalId)
    expect(b.inicio < a.fim).toBe(true)
  })
})
