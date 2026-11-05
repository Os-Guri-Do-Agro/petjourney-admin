import { describe, expect, it } from 'vitest'

import {
  diaDaSemanaDe,
  diasDaSemanaNoPeriodo,
  partesDosDias,
  separarBloqueios,
} from '@/components/agenda/bloqueios'
import type { OcorrenciaDeBloqueio } from '@/service/parceiro/agenda-config-service'

function ocorrencia(
  bloqueioId: string,
  data: string,
  hora: string,
  recorrente: boolean,
  fim = '13:00',
): OcorrenciaDeBloqueio {
  return {
    bloqueioId,
    data,
    inicio: `${data}T${hora}:00-04:00`,
    fim: `${data}T${fim}:00-04:00`,
    profissionalId: null,
    salaId: null,
    motivo: 'ALMOCO',
    detalhe: null,
    recorrente,
  } as OcorrenciaDeBloqueio
}

describe('separarBloqueios', () => {
  it('mostra a série uma vez só, com os dias dela, e deixa o único no dia dele', () => {
    const { series, dias } = separarBloqueios([
      ocorrencia('almoco', '2026-11-09', '12:00', true),
      ocorrencia('plantao', '2026-11-06', '15:30', true, '16:00'),
      ocorrencia('almoco', '2026-11-06', '12:00', true),
      ocorrencia('reuniao', '2026-11-10', '09:00', false, '10:00'),
      ocorrencia('plantao', '2026-11-09', '15:30', true, '16:00'),
    ])

    expect(series.map((serie) => serie.bloqueioId)).toEqual(['almoco', 'plantao'])
    expect(series[0]!.primeira.data).toBe('2026-11-06')
    expect(series[0]!.dias.map((item) => item.data)).toEqual(['2026-11-06', '2026-11-09'])
    expect(dias).toEqual([
      { data: '2026-11-10', itens: [expect.objectContaining({ bloqueioId: 'reuniao' })] },
    ])
  })

  it('ordena as séries pela hora do dia, não pela primeira data', () => {
    const { series } = separarBloqueios([
      ocorrencia('tarde', '2026-11-06', '15:00', true),
      ocorrencia('manha', '2026-11-09', '08:00', true),
    ])

    expect(series.map((serie) => serie.bloqueioId)).toEqual(['manha', 'tarde'])
  })

  it('sem nada, devolve listas vazias', () => {
    expect(separarBloqueios([])).toEqual({ series: [], dias: [] })
  })
})

describe('dias da semana', () => {
  it('lê o dia da semana da data sem depender do fuso de quem usa', () => {
    expect(diaDaSemanaDe('2026-11-06')).toBe(5)
    expect(diaDaSemanaDe('2026-11-08')).toBe(0)
  })

  it('retrata a série pelos dias em que ela aparece no período', () => {
    const { series } = separarBloqueios([
      ocorrencia('a', '2026-11-06', '12:00', true),
      ocorrencia('a', '2026-11-09', '12:00', true),
      ocorrencia('a', '2026-11-13', '12:00', true),
    ])

    expect(diasDaSemanaNoPeriodo(series[0]!).sort()).toEqual([1, 5])
  })
})

describe('partesDosDias', () => {
  it('três ou mais seguidos viram faixa', () => {
    expect(partesDosDias([1, 2, 3, 4, 5])).toEqual([{ tipo: 'faixa', de: 1, ate: 5 }])
  })

  it('dias soltos vão um a um', () => {
    expect(partesDosDias([5, 1, 3])).toEqual([
      { tipo: 'dia', dia: 1 },
      { tipo: 'dia', dia: 3 },
      { tipo: 'dia', dia: 5 },
    ])
  })

  it('o fim de semana vem depois da sexta, na ordem da semana de trabalho', () => {
    expect(partesDosDias([0, 6])).toEqual([
      { tipo: 'dia', dia: 6 },
      { tipo: 'dia', dia: 0 },
    ])
    expect(partesDosDias([5, 6, 0])).toEqual([{ tipo: 'faixa', de: 5, ate: 0 }])
  })

  it('mistura faixa e dia solto', () => {
    expect(partesDosDias([1, 2, 3, 4, 5, 0])).toEqual([
      { tipo: 'faixa', de: 1, ate: 5 },
      { tipo: 'dia', dia: 0 },
    ])
  })

  it('os sete são todos os dias', () => {
    expect(partesDosDias([0, 1, 2, 3, 4, 5, 6])).toEqual([{ tipo: 'todos' }])
  })
})
