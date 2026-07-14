import { describe, expect, it } from 'vitest'

import { resolveLoginProfileFlags } from '@/service/auth/auth-service'

describe('resolveLoginProfileFlags', () => {
  it('lê tutorInactive do body de login', () => {
    expect(resolveLoginProfileFlags({ tutorInactive: true }, null)).toEqual({
      tutorInactive: true,
      veterinarioInactive: false,
    })
  })

  it('lê veterinarioInactive do body', () => {
    expect(resolveLoginProfileFlags({ veterinarioInactive: true }, null).veterinarioInactive).toBe(
      true,
    )
  })

  it('usa claims JWT ativas quando body omite flags', () => {
    expect(
      resolveLoginProfileFlags(
        { access_token: 'x' },
        {
          userId: '1',
          email: 'a@b.com',
          nome: 'A',
          veterinarioActive: false,
          iat: 0,
          exp: 9,
        },
      ),
    ).toEqual({
      tutorInactive: false,
      veterinarioInactive: true,
    })
  })

  it('ausência de flag = ativo', () => {
    expect(resolveLoginProfileFlags({}, { userId: '1', email: 'a', nome: 'A', iat: 0, exp: 1 })).toEqual(
      {
        tutorInactive: false,
        veterinarioInactive: false,
      },
    )
  })
})
