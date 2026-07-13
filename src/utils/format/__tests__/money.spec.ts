import { describe, expect, it } from 'vitest'

import { formatCentavosToBrl, maskBrlCurrencyInput, parseBrlToCentavos } from '@/utils/format/money'

describe('money', () => {
  it('formata centavos em BRL', () => {
    expect(formatCentavosToBrl(5000)).toBe('R$\u00a050,00')
  })

  it('converte BRL para centavos', () => {
    expect(parseBrlToCentavos('50,00')).toBe(5000)
    expect(parseBrlToCentavos('R$ 1.234,56')).toBe(123456)
  })

  it('retorna null para valor inválido', () => {
    expect(parseBrlToCentavos('abc')).toBeNull()
  })

  it('mascara digitação em BRL', () => {
    expect(maskBrlCurrencyInput('')).toBe('')
    expect(maskBrlCurrencyInput('5')).toBe('0,05')
    expect(maskBrlCurrencyInput('5000')).toBe('50,00')
    expect(maskBrlCurrencyInput('123456')).toBe('1.234,56')
    expect(maskBrlCurrencyInput('abc12x34')).toBe('12,34')
  })
})
