import { describe, expect, it } from 'vitest'

import { formatCentavosToBrl, maskBrlCurrencyInput, parseBrlToCentavos } from '@/utils/format/money'

describe('money', () => {
  it('formata centavos em BRL', () => {
    expect(formatCentavosToBrl(5000)).toBe('R$\u00a050,00')
  })

  it('no \u00e1rabe isola o valor da linha, para o "R$" n\u00e3o virar "$R"', () => {
    const valor = formatCentavosToBrl(0, 'ar-u-nu-latn')

    expect(valor.startsWith('\u2066')).toBe(true)
    expect(valor.endsWith('\u2069')).toBe(true)
    expect(formatCentavosToBrl(0, 'en-US').includes('\u2066')).toBe(false)
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
