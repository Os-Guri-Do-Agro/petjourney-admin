import { describe, expect, it } from 'vitest'

import { formatCpf, isValidCpf, stripCpf } from '@/utils/validation/cpf'

describe('cpf validation', () => {
  it('strips non-digit characters', () => {
    expect(stripCpf('123.456.789-09')).toBe('12345678909')
  })

  it('formats cpf progressively', () => {
    expect(formatCpf('12345678909')).toBe('123.456.789-09')
  })

  it('accepts a valid cpf', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true)
  })

  it('rejects repeated digits', () => {
    expect(isValidCpf('111.111.111-11')).toBe(false)
  })

  it('rejects invalid check digits', () => {
    expect(isValidCpf('123.456.789-00')).toBe(false)
  })
})
