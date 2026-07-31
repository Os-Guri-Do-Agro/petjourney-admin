import { describe, expect, it } from 'vitest'

import { ApiError } from '@/service/api'
import { montarSerie, resolveMetricasErro, resumirUserAgent } from '../indicacao-metricas'

describe('resolveMetricasErro', () => {
  it('409 é parceiro ainda não aprovado, não falha da tela', () => {
    expect(resolveMetricasErro(new ApiError('nao operavel', 409))).toBe('naoOperavel')
  })

  it('503 é o serviço de QR fora do ar', () => {
    expect(resolveMetricasErro(new ApiError('QR indisponivel', 503))).toBe('indisponivel')
  })

  it('qualquer outro status vira erro genérico', () => {
    expect(resolveMetricasErro(new ApiError('boom', 500))).toBe('erro')
    expect(resolveMetricasErro(new ApiError('nao achou', 404))).toBe('erro')
    expect(resolveMetricasErro(new Error('rede'))).toBe('erro')
    expect(resolveMetricasErro(undefined)).toBe('erro')
  })
})

describe('montarSerie', () => {
  it('série vazia ou ausente não gera barras', () => {
    expect(montarSerie([])).toEqual([])
    expect(montarSerie(undefined)).toEqual([])
  })

  it('escala as barras pelo dia de maior contagem', () => {
    const serie = montarSerie([
      { day: '2026-07-01', count: 5 },
      { day: '2026-07-02', count: 10 },
      { day: '2026-07-03', count: 0 },
    ])

    expect(serie).toEqual([
      { day: '2026-07-01', count: 5, percent: 50 },
      { day: '2026-07-02', count: 10, percent: 100 },
      { day: '2026-07-03', count: 0, percent: 0 },
    ])
  })

  it('ordena por dia mesmo se a API devolver fora de ordem', () => {
    const serie = montarSerie([
      { day: '2026-07-03', count: 1 },
      { day: '2026-07-01', count: 2 },
    ])

    expect(serie.map((b) => b.day)).toEqual(['2026-07-01', '2026-07-03'])
  })

  it('corta nos últimos dias, mantendo os mais recentes', () => {
    const bruta = Array.from({ length: 20 }, (_, i) => ({
      day: `2026-07-${String(i + 1).padStart(2, '0')}`,
      count: i + 1,
    }))

    const serie = montarSerie(bruta, 5)

    expect(serie).toHaveLength(5)
    expect(serie.map((b) => b.day)).toEqual([
      '2026-07-16',
      '2026-07-17',
      '2026-07-18',
      '2026-07-19',
      '2026-07-20',
    ])
  })

  it('série toda zerada não vira NaN', () => {
    const serie = montarSerie([
      { day: '2026-07-01', count: 0 },
      { day: '2026-07-02', count: 0 },
    ])

    expect(serie.every((b) => b.percent === 0)).toBe(true)
  })
})

describe('resumirUserAgent', () => {
  it('reconhece os aparelhos mais comuns', () => {
    expect(resumirUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(
      'iPhone',
    )
    expect(resumirUserAgent('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)')).toBe('iPad')
    expect(resumirUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe('Android')
    expect(resumirUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('Windows')
    expect(resumirUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('Mac')
    expect(resumirUserAgent('Mozilla/5.0 (X11; Linux x86_64)')).toBe('Linux')
  })

  it('Android ganha de Linux, que o user-agent também traz', () => {
    expect(resumirUserAgent('Mozilla/5.0 (Linux; Android 13)')).toBe('Android')
  })

  it('devolve null quando não dá para afirmar', () => {
    expect(resumirUserAgent(null)).toBeNull()
    expect(resumirUserAgent(undefined)).toBeNull()
    expect(resumirUserAgent('   ')).toBeNull()
    expect(resumirUserAgent('curl/8.4.0')).toBeNull()
  })
})
