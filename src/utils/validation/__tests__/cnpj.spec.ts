import { describe, expect, it } from 'vitest'

import { formatCnpj, isValidCnpj, stripCnpj } from '../cnpj'

describe('stripCnpj', () => {
  it('mantém só os dígitos', () => {
    expect(stripCnpj('11.222.333/0001-81')).toBe('11222333000181')
    expect(stripCnpj('  11 222 333 0001 81 ')).toBe('11222333000181')
    expect(stripCnpj('')).toBe('')
  })
})

describe('formatCnpj', () => {
  it('aplica a máscara progressivamente enquanto o usuário digita', () => {
    expect(formatCnpj('1')).toBe('1')
    expect(formatCnpj('11')).toBe('11')
    expect(formatCnpj('112')).toBe('11.2')
    expect(formatCnpj('11222')).toBe('11.222')
    expect(formatCnpj('112223')).toBe('11.222.3')
    expect(formatCnpj('11222333')).toBe('11.222.333')
    expect(formatCnpj('112223330')).toBe('11.222.333/0')
    expect(formatCnpj('112223330001')).toBe('11.222.333/0001')
    expect(formatCnpj('11222333000181')).toBe('11.222.333/0001-81')
  })

  it('descarta o que passa de 14 dígitos', () => {
    expect(formatCnpj('11222333000181999')).toBe('11.222.333/0001-81')
  })

  it('reformata valor que já vem mascarado', () => {
    expect(formatCnpj('11.222.333/0001-81')).toBe('11.222.333/0001-81')
  })
})

describe('isValidCnpj', () => {
  it('aceita CNPJ válido, com ou sem máscara', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true)
    expect(isValidCnpj('11222333000181')).toBe(true)
    expect(isValidCnpj('34.028.316/0001-03')).toBe(true)
  })

  it('recusa dígito verificador errado', () => {
    expect(isValidCnpj('11.222.333/0001-82')).toBe(false)
    expect(isValidCnpj('11222333000180')).toBe(false)
  })

  it('recusa comprimento fora de 14 dígitos', () => {
    expect(isValidCnpj('')).toBe(false)
    expect(isValidCnpj('1122233300018')).toBe(false)
    expect(isValidCnpj('112223330001811')).toBe(false)
  })

  it('recusa sequência de dígitos repetidos', () => {
    expect(isValidCnpj('00000000000000')).toBe(false)
    expect(isValidCnpj('11111111111111')).toBe(false)
    expect(isValidCnpj('99999999999999')).toBe(false)
  })

  it('recusa texto sem dígito suficiente', () => {
    expect(isValidCnpj('abc')).toBe(false)
  })
})
