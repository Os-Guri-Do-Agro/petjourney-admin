import { describe, expect, it } from 'vitest'

import { isValidChavePix, tipoDaChavePix } from '../pix'

describe('chave PIX', () => {
  it('reconhece os cinco tipos de chave', () => {
    expect(tipoDaChavePix('27.527.903/0001-81')).toBe('cnpj')
    expect(tipoDaChavePix('27527903000181')).toBe('cnpj')
    expect(tipoDaChavePix('529.982.247-25')).toBe('cpf')
    expect(tipoDaChavePix('financeiro@clinica-aurora.com.br')).toBe('email')
    expect(tipoDaChavePix('+55 11 98765-4321')).toBe('telefone')
    expect(tipoDaChavePix('+55 (11) 3456-7890')).toBe('telefone')
    expect(tipoDaChavePix('123e4567-e89b-42d3-a456-426614174000')).toBe('aleatoria')
  })

  it('telefone só com +55 e DDD, como a API (PJ-4BI7TE)', () => {
    expect(tipoDaChavePix('(11) 98765-4321')).toBeNull()
    expect(tipoDaChavePix('11 98765-4321')).toBeNull()
    expect(tipoDaChavePix('5511987654321')).toBeNull()
    expect(tipoDaChavePix('11987654321')).not.toBe('telefone')
    expect(tipoDaChavePix('+5511987654321')).toBe('telefone')
    expect(tipoDaChavePix('+55 11 88765-4321')).toBeNull()
    expect(tipoDaChavePix('+55 01 98765-4321')).toBeNull()
    expect(tipoDaChavePix('+1 415 555 0100')).toBeNull()
  })

  it('recusa o que não é chave (o "abc" que a API aceitou)', () => {
    expect(isValidChavePix('abc')).toBe(false)
    expect(isValidChavePix('')).toBe(false)
    expect(isValidChavePix('12345')).toBe(false)
    expect(isValidChavePix('27.527.903/0001-00')).toBe(false)
    expect(isValidChavePix('helena@')).toBe(false)
    expect(isValidChavePix('+55 11')).toBe(false)
  })
})
