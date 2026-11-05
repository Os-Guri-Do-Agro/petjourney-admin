/**
 * O expediente do profissional (E3-01, seção 1.4): lê os 7 dias resolvidos de segunda a domingo e
 * manda de volta só os dias que diferem da clínica.
 */
import { describe, expect, it } from 'vitest'

import {
  diasParaSalvar,
  linhasDoExpediente,
  problemaNaLinha,
  type LinhaDoExpediente,
} from '../expediente'
import type { DiaDoExpediente } from '@/service/parceiro/agenda-config-service'

function daClinica(diaSemana: number, trabalha = true): DiaDoExpediente {
  return {
    diaSemana,
    origem: 'ESTABELECIMENTO',
    trabalha,
    inicio: trabalha ? '08:00' : null,
    fim: trabalha ? '18:00' : null,
    intervaloInicio: trabalha ? '12:00' : null,
    intervaloFim: trabalha ? '13:00' : null,
  }
}

function proprio(diaSemana: number, trabalha: boolean, inicio?: string, fim?: string) {
  return {
    diaSemana,
    origem: 'PROFISSIONAL' as const,
    trabalha,
    inicio: inicio ?? null,
    fim: fim ?? null,
    intervaloInicio: null,
    intervaloFim: null,
  }
}

function linha(parcial: Partial<LinhaDoExpediente>): LinhaDoExpediente {
  return { diaSemana: 1, modo: 'proprio', inicio: '08:00', fim: '12:00', clinica: null, ...parcial }
}

describe('linhasDoExpediente', () => {
  it('põe a semana de segunda a domingo, com o modo de cada dia', () => {
    const linhas = linhasDoExpediente({
      dias: [
        daClinica(0, false),
        daClinica(1),
        proprio(2, true, '13:00', '19:00'),
        daClinica(3),
        proprio(4, false),
        daClinica(5),
        daClinica(6, false),
      ],
    })

    expect(linhas.map((item) => item.diaSemana)).toEqual([1, 2, 3, 4, 5, 6, 0])
    expect(linhas.map((item) => item.modo)).toEqual([
      'clinica',
      'proprio',
      'clinica',
      'folga',
      'clinica',
      'clinica',
      'clinica',
    ])
    expect(linhas[0]?.clinica).toEqual({
      trabalha: true,
      inicio: '08:00',
      fim: '18:00',
      intervaloInicio: '12:00',
      intervaloFim: '13:00',
    })
    expect(linhas[1]).toMatchObject({ inicio: '13:00', fim: '19:00', clinica: null })
  })

  it('dia que não veio segue a clínica, sem hora conhecida', () => {
    const [segunda] = linhasDoExpediente({ dias: [] })

    expect(segunda).toEqual({ diaSemana: 1, modo: 'clinica', inicio: '', fim: '', clinica: null })
  })
})

describe('problemaNaLinha', () => {
  it('confere só o dia próprio, como a API', () => {
    expect(problemaNaLinha(linha({ modo: 'clinica', inicio: '' }))).toBeNull()
    expect(problemaNaLinha(linha({ modo: 'folga', inicio: '' }))).toBeNull()
    expect(problemaNaLinha(linha({ inicio: '', fim: '12:00' }))).toBe('ABRE_E_FECHA_OBRIGATORIOS')
    expect(problemaNaLinha(linha({ inicio: '08:__' }))).toBe('ABRE_E_FECHA_OBRIGATORIOS')
    expect(problemaNaLinha(linha({ inicio: '25:00' }))).toBe('HORA_INVALIDA')
    expect(problemaNaLinha(linha({ inicio: '24:00', fim: '24:00' }))).toBe('HORA_INVALIDA')
    expect(problemaNaLinha(linha({ inicio: '18:00', fim: '08:00' }))).toBe('ABRE_DEPOIS_DE_FECHA')
    expect(problemaNaLinha(linha({ inicio: '20:00', fim: '24:00' }))).toBeNull()
  })
})

describe('diasParaSalvar', () => {
  it('manda só próprio e folga, em ordem, e folga sem hora', () => {
    expect(
      diasParaSalvar([
        linha({ diaSemana: 1, modo: 'clinica' }),
        linha({ diaSemana: 2, modo: 'proprio', inicio: '13:00', fim: '19:00' }),
        linha({ diaSemana: 0, modo: 'folga', inicio: '08:00', fim: '12:00' }),
      ]),
    ).toEqual([
      { diaSemana: 0, trabalha: false },
      { diaSemana: 2, trabalha: true, inicio: '13:00', fim: '19:00' },
    ])
  })

  it('tudo como a clínica vira lista vazia', () => {
    expect(diasParaSalvar([linha({ modo: 'clinica' })])).toEqual([])
  })
})
