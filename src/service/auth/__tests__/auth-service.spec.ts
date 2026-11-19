import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  avisarSaidaNaApi,
  extractResetToken,
  resolveLoginProfileFlags,
} from '@/service/auth/auth-service'

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

describe('extractResetToken', () => {
  it('lê reset_token do data', () => {
    expect(extractResetToken({ reset_token: 'jwt-reset' })).toBe('jwt-reset')
  })

  it('rejeita ausência ou valor inválido', () => {
    expect(() => extractResetToken({})).toThrow(/inválida/i)
    expect(() => extractResetToken({ reset_token: '' })).toThrow(/inválida/i)
    expect(() => extractResetToken(null)).toThrow(/inválida/i)
  })
})

describe('avisarSaidaNaApi', () => {
  afterEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it('manda o refresh token para /auth/logout, sem Authorization e com keepalive', () => {
    window.localStorage.setItem('refresh_token', 'refresh-1')
    const enviar = vi.fn((..._args: Parameters<typeof fetch>) =>
      Promise.resolve(new Response('{}', { status: 200 })),
    )

    avisarSaidaNaApi({ fetch: enviar, base: 'https://api.teste' })

    expect(enviar).toHaveBeenCalledTimes(1)
    const [url, init] = enviar.mock.calls[0]!
    expect(url).toBe('https://api.teste/auth/logout')
    expect(init?.method).toBe('POST')
    expect(init?.keepalive).toBe(true)
    expect(JSON.parse(String(init?.body))).toEqual({ refresh_token: 'refresh-1' })
    expect(new Headers(init?.headers).has('Authorization')).toBe(false)
  })

  it('o token da demonstração nunca vai à API', () => {
    window.localStorage.setItem('refresh_token', 'cabeca.corpo.demonstracao')
    const enviar = vi.fn((..._args: Parameters<typeof fetch>) =>
      Promise.resolve(new Response('{}')),
    )

    avisarSaidaNaApi({ fetch: enviar, base: 'https://api.teste' })

    expect(enviar).not.toHaveBeenCalled()
  })

  it('não chama a API sem refresh token', () => {
    const enviar = vi.fn((..._args: Parameters<typeof fetch>) =>
      Promise.resolve(new Response('{}')),
    )

    avisarSaidaNaApi({ fetch: enviar, base: 'https://api.teste' })

    expect(enviar).not.toHaveBeenCalled()
  })

  it('rede fora ou fetch que quebra não chegam a quem está saindo', async () => {
    window.sessionStorage.setItem('refresh_token', 'refresh-2')
    const rejeita = vi.fn((..._args: Parameters<typeof fetch>) =>
      Promise.reject(new TypeError('Failed to fetch')),
    )
    const quebra = vi.fn((..._args: Parameters<typeof fetch>): Promise<Response> => {
      throw new Error('sem fetch')
    })

    expect(() => avisarSaidaNaApi({ fetch: rejeita, base: 'https://api.teste' })).not.toThrow()
    expect(() => avisarSaidaNaApi({ fetch: quebra, base: 'https://api.teste' })).not.toThrow()
    await Promise.resolve()
    expect(rejeita).toHaveBeenCalledTimes(1)
    expect(quebra).toHaveBeenCalledTimes(1)
  })
})
