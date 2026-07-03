import { describe, expect, it } from 'vitest'

import { formatCentavosToBrl, parseBrlToCentavos } from '@/utils/format/money'

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
})
