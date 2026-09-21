/**
 * Estado das etapas do prontuário.
 *
 * O passo no topo da tela e o diálogo de finalizar leem a mesma conta. Se divergirem, o
 * profissional vê "conduta completa" no passo e "falta confirmar a alergia" ao finalizar — e
 * passa a não confiar em nenhum dos dois.
 */

import { describe, expect, it } from 'vitest'

import { medicationsFixture, petsFixture } from '../../data/fixtures'
import { encounterVazio } from '../../data/seed'
import type { Appointment, Encounter, Medication, Pet } from '../../data/types'
import { createClinicClock } from '../clinic-time'
import {
  alergiaNaoConfirmada,
  progressoDaConduta,
  progressoDoAtendimento,
} from '../encounter-progress'

const clock = createClinicClock('-04:00')
const DATA = '2026-08-21'

const luna = petsFixture.find((pet) => pet.id === 'pet-luna') as Pet
const amoxicilina = medicationsFixture.find(
  (item) => item.principioAtivo === 'Amoxicilina',
) as Medication
const dipirona = medicationsFixture.find(
  (item) => item.principioAtivo === 'Dipirona',
) as Medication

const catalogo = (id: string) => medicationsFixture.find((item) => item.id === id) ?? null

function appointment(): Appointment {
  return {
    id: 'apt-1',
    petId: luna.id,
    tutorId: luna.tutorId,
    professionalId: 'prof-ana',
    roomIds: ['sala-1'],
    typeId: 'tipo-consulta',
    inicio: clock.toIso(DATA, 540),
    fim: clock.toIso(DATA, 570),
    status: 'em-atendimento',
    origem: 'recepcao',
    encaixe: false,
    observacao: '',
    chegadaEm: null,
    iniciadoEm: null,
    finalizadoEm: null,
    canceladoEm: null,
    motivoCancelamento: null,
    justificativaDeFalta: null,
    encounterId: null,
    linkedGroupId: null,
    criadoEm: clock.toIso(DATA, 480),
    atualizadoEm: clock.toIso(DATA, 480),
  }
}

function novoEncounter(): Encounter {
  return encounterVazio(appointment(), clock.toIso(DATA, 540))
}

function prescricaoDe(medicamento: Medication, alergiaConfirmada: boolean) {
  return {
    id: 'presc-1',
    medicamentoId: medicamento.id,
    via: 'oral' as const,
    calculo: {
      medicamentoId: medicamento.id,
      mgPorKg: 20,
      pesoKg: 12,
      mgPorAdministracao: 240,
      quantidadeApresentacao: 1,
      frequenciaHoras: 12,
      duracaoDias: 7,
      totalAdministracoes: 14,
    },
    observacao: '',
    alergiaConfirmada,
  }
}

describe('progresso do atendimento', () => {
  it('começa com as cinco etapas vazias', () => {
    const etapas = progressoDoAtendimento(novoEncounter(), luna, catalogo)

    expect(etapas.map((etapa) => etapa.id)).toEqual([
      'anamnese',
      'exame',
      'diagnostico',
      'conduta',
      'resumo',
    ])
    expect(etapas.every((etapa) => etapa.estado === 'vazio')).toBe(true)
  })

  /**
   * O resumo é etapa de conferência, não de preenchimento: o estado dele espelha o atendimento
   * inteiro. Contar campos próprios daria a um passo de leitura uma barra que ele não enche.
   */
  it('resume o atendimento inteiro no último passo', () => {
    const encounter = novoEncounter()

    encounter.anamnese.queixaPrincipal = 'Claudicação'

    const etapas = progressoDoAtendimento(encounter, luna, catalogo)
    const resumo = etapas[etapas.length - 1]

    expect(resumo?.id).toBe('resumo')
    expect(resumo?.estado).toBe('parcial')
  })

  it('leva o alerta de alergia até o resumo', () => {
    const encounter = novoEncounter()

    encounter.conduta.prescricoes = [prescricaoDe(amoxicilina, false)]

    const etapas = progressoDoAtendimento(encounter, luna, catalogo)

    expect(etapas[etapas.length - 1]?.estado).toBe('alerta')
  })

  it('marca a anamnese como parcial com a queixa preenchida e nada mais', () => {
    const encounter = novoEncounter()

    encounter.anamnese.queixaPrincipal = 'Claudicação'

    const [anamnese] = progressoDoAtendimento(encounter, luna, catalogo)

    expect(anamnese?.estado).toBe('parcial')
    expect(anamnese?.preenchidos).toBe(1)
  })

  it('conta `não aferido` como aferido: a decisão de não medir também é registro', () => {
    const encounter = novoEncounter()

    encounter.exameFisico.vitais.temperatura = { valor: null, naoAferido: true }
    encounter.exameFisico.vitais.peso = { valor: 12.4, naoAferido: false }

    const exame = progressoDoAtendimento(encounter, luna, catalogo)[1]

    expect(exame?.preenchidos).toBe(2)
    expect(exame?.estado).toBe('parcial')
  })

  it('um diagnóstico já completa a etapa', () => {
    const encounter = novoEncounter()

    encounter.diagnosticos = [
      { id: 'd1', codigo: 'GE-01', descricao: 'Gastroenterite aguda', kind: 'presuntivo' },
    ]

    expect(progressoDoAtendimento(encounter, luna, catalogo)[2]?.estado).toBe('completo')
  })

  it('a conduta vira `alerta` quando a prescrição encosta numa alergia registrada', () => {
    const encounter = novoEncounter()

    encounter.conduta.orientacoes = 'Repouso'
    encounter.conduta.prescricoes = [prescricaoDe(amoxicilina, false)]

    expect(progressoDaConduta(encounter, luna, catalogo).estado).toBe('alerta')
    expect(alergiaNaoConfirmada(encounter, luna, catalogo)).toBe(true)
  })

  it('a confirmação explícita tira o alerta sem apagar a prescrição', () => {
    const encounter = novoEncounter()

    encounter.conduta.orientacoes = 'Repouso'
    encounter.conduta.prescricoes = [prescricaoDe(amoxicilina, true)]

    expect(alergiaNaoConfirmada(encounter, luna, catalogo)).toBe(false)
    expect(progressoDaConduta(encounter, luna, catalogo).estado).not.toBe('alerta')
    expect(encounter.conduta.prescricoes).toHaveLength(1)
  })

  it('medicamento sem relação com a alergia não dispara alerta', () => {
    const encounter = novoEncounter()

    encounter.conduta.prescricoes = [prescricaoDe(dipirona, false)]

    expect(alergiaNaoConfirmada(encounter, luna, catalogo)).toBe(false)
  })

  it('sem paciente carregado não inventa alerta', () => {
    const encounter = novoEncounter()

    encounter.conduta.prescricoes = [prescricaoDe(amoxicilina, false)]

    expect(alergiaNaoConfirmada(encounter, null, catalogo)).toBe(false)
  })
})
