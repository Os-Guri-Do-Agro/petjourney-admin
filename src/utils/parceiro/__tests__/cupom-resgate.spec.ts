import { describe, expect, it } from 'vitest'

import { ApiError } from '@/service/api'
import {
  isCodigoResgateFormatoValido,
  normalizarCodigoResgate,
  resolveValidarCupomError,
} from '@/utils/parceiro/cupom-resgate'

describe('normalizarCodigoResgate', () => {
  it('remove espaços e força maiúsculas', () => {
    expect(normalizarCodigoResgate('abcde f1234')).toBe('ABCDEF1234')
  })
})

describe('isCodigoResgateFormatoValido', () => {
  it('aceita alfabeto A–Z e dígitos 2–9 (6–32 chars)', () => {
    expect(isCodigoResgateFormatoValido('ABCDEF2345')).toBe(true)
    expect(isCodigoResgateFormatoValido('ABCDEF')).toBe(true)
  })

  it('rejeita 0/1 e tamanho inválido', () => {
    expect(isCodigoResgateFormatoValido('ABC')).toBe(false)
    expect(isCodigoResgateFormatoValido('ABCDE1')).toBe(false)
    expect(isCodigoResgateFormatoValido('ABCDE0')).toBe(false)
  })
})

describe('resolveValidarCupomError', () => {
  it('usa copy fixa em 404 e 410', () => {
    expect(resolveValidarCupomError(new ApiError('x', 404)).message).toMatch(/inválido/i)
    expect(resolveValidarCupomError(new ApiError('x', 410)).message).toMatch(/expirado/i)
  })

  it('exibe a mensagem do servidor em 409', () => {
    const view = resolveValidarCupomError(new ApiError('Já validado neste atendimento.', 409))
    expect(view.message).toBe('Já validado neste atendimento.')
  })
})
