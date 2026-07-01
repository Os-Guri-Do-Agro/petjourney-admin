import { describe, expect, it } from 'vitest'

import { getPasswordRequirements, isPasswordValid } from '@/utils/validation/password'

describe('password validation', () => {
  it('tracks each requirement independently', () => {
    expect(getPasswordRequirements('Aa1!')).toEqual({
      minLength: false,
      hasNumber: true,
      hasUppercase: true,
      hasSpecialChar: true,
    })
  })

  it('accepts a password that meets all rules', () => {
    expect(isPasswordValid('Senha@1')).toBe(true)
  })

  it('rejects passwords missing special characters', () => {
    expect(isPasswordValid('Senha123')).toBe(false)
  })
})
