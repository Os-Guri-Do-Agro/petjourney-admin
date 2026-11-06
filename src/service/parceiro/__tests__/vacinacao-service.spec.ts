import { describe, expect, it } from 'vitest'

import { CODIGO_DO_LOTE, pontosDaSerie } from '../vacinacao-service'

describe('vacinação conectada', () => {
  it('desenha os pontos da série pelo total, com as dadas primeiro', () => {
    expect(pontosDaSerie({ aplicadasNaSerie: 1, total: 3 })).toEqual(['dada', 'falta', 'falta'])
    expect(pontosDaSerie({ aplicadasNaSerie: 0, total: 1 })).toEqual(['falta'])
  })

  it('não some ponto quando a série encurta abaixo do que já foi dado', () => {
    expect(pontosDaSerie({ aplicadasNaSerie: 3, total: 2 })).toEqual(['dada', 'dada', 'dada'])
  })

  it('aceita o código do lote como a API (letras, números, espaço, . / - _)', () => {
    expect(CODIGO_DO_LOTE.test('AB-123/2026')).toBe(true)
    expect(CODIGO_DO_LOTE.test('LOTE 7_A.1')).toBe(true)
    expect(CODIGO_DO_LOTE.test('lote#1')).toBe(false)
    expect(CODIGO_DO_LOTE.test('')).toBe(false)
  })
})
