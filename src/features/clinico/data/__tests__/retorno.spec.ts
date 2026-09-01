/**
 * Contrato de `agendaRepository.sugerirRetorno`.
 *
 * O retorno é o que liga o fim de um atendimento ao começo do próximo. Antes, o botão
 * "Agendar retorno" só navegava para a agenda focando o atendimento que **acabava de
 * terminar** — não criava nada e nunca preenchia `retorno.appointmentId`, então o aviso de
 * "retorno pendente" ficava na tela para sempre.
 *
 * O que estes testes fixam é o que torna a sugestão utilizável: horários que existem de
 * verdade, com quem atendeu, e a data pedida tratada como **sugestão** — retorno em 15 dias que
 * cai em domingo vira 16, não vira "não há horário".
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { addDays, createClinicClock, weekdayOf } from '../../domain/clinic-time'
import { CLINIC_UTC_OFFSET } from '../fixtures'
import { agendaRepository } from '../repositories'
import { getDataset, resetDataset } from '../store'

const clock = createClinicClock(CLINIC_UTC_OFFSET)

describe('agendaRepository.sugerirRetorno', () => {
  beforeEach(() => {
    resetDataset()
  })

  it('sugere horários com o profissional que atendeu', async () => {
    const { ancora } = getDataset()

    const sugestoes = await agendaRepository.sugerirRetorno({
      petId: 'pet-luna',
      professionalId: 'prof-ana',
      typeId: 'tipo-retorno',
      aPartirDe: ancora,
      emDias: 15,
    })

    expect(sugestoes.length).toBeGreaterThan(0)
    /** Continuidade vale mais que horário cedo: o retorno é com quem atendeu. */
    expect(sugestoes.every((slot) => slot.professionalId === 'prof-ana')).toBe(true)
  })

  it('só devolve horário sem conflito', async () => {
    const { ancora } = getDataset()

    const sugestoes = await agendaRepository.sugerirRetorno({
      petId: 'pet-luna',
      professionalId: 'prof-ana',
      typeId: 'tipo-retorno',
      aPartirDe: ancora,
      emDias: 15,
    })

    expect(sugestoes.every((slot) => slot.conflitos.length === 0)).toBe(true)
  })

  it('avança quando a data pedida cai em dia fechado', async () => {
    const dataset = getDataset()
    const { ancora } = dataset

    /**
     * Fecha a clínica exatamente no dia alvo. A busca precisa pular para o dia seguinte em vez
     * de devolver lista vazia — senão "retorno em 10 dias" viraria "não há horário" toda vez
     * que o alvo caísse num feriado.
     */
    const dataFechada = addDays(ancora, 10)

    dataset.clinic.feriados.push({ date: dataFechada, nome: 'Teste', fechado: true })

    const sugestoes = await agendaRepository.sugerirRetorno({
      petId: 'pet-luna',
      professionalId: 'prof-ana',
      typeId: 'tipo-retorno',
      aPartirDe: ancora,
      emDias: 10,
    })

    /** Achou horário mesmo assim — e nenhum deles no dia fechado. */
    expect(sugestoes.length).toBeGreaterThan(0)
    expect(sugestoes.some((slot) => clock.dateOf(slot.inicio) === dataFechada)).toBe(false)
  })

  it('nunca sugere horário em dia sem expediente', async () => {
    const dataset = getDataset()
    const { ancora } = dataset
    const fechados = dataset.clinic.horarios
      .filter((horario) => horario.fechado)
      .map((horario) => horario.weekday)

    const sugestoes = await agendaRepository.sugerirRetorno({
      petId: 'pet-luna',
      professionalId: 'prof-ana',
      typeId: 'tipo-retorno',
      aPartirDe: ancora,
      emDias: 5,
    })

    for (const slot of sugestoes) {
      expect(fechados).not.toContain(weekdayOf(clock.dateOf(slot.inicio)))
    }
  })
})
