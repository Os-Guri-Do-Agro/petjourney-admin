import { describe, expect, it } from 'vitest'

import { normalizeUsuarioProfile } from '@/service/user/user-service'

describe('normalizeUsuarioProfile', () => {
  it('lê campos planos e veterinarioPerfil', () => {
    const profile = normalizeUsuarioProfile(
      {
        id: 'u1',
        email: 'a@b.com',
        nome: 'Ana',
        telefone: '11999990000',
        cpf: '12345678909',
        veterinarioPerfil: {
          crmv: 'CRMV-SP 1',
          especialidade: 'Clínica',
          foto: 'https://cdn/x.jpg',
        },
      },
      'fallback',
    )

    expect(profile.id).toBe('u1')
    expect(profile.email).toBe('a@b.com')
    expect(profile.veterinarioPerfil?.crmv).toBe('CRMV-SP 1')
    expect(profile.veterinarioPerfil?.foto).toBe('https://cdn/x.jpg')
  })

  it('aceita bloco aninhado usuario + veterinario', () => {
    const profile = normalizeUsuarioProfile(
      {
        usuario: {
          id: 'u2',
          email: 'c@d.com',
          nome: 'Bruno',
          veterinario: { crmv: 'CRMV-RJ 9', especialidade: 'Cirurgia' },
        },
      },
      'fallback',
    )

    expect(profile.id).toBe('u2')
    expect(profile.nome).toBe('Bruno')
    expect(profile.veterinarioPerfil?.especialidade).toBe('Cirurgia')
  })

  it('usa fallbackId quando id ausente', () => {
    const profile = normalizeUsuarioProfile({ email: 'x@y.com', nome: 'X' }, 'fb')

    expect(profile.id).toBe('fb')
    expect(profile.email).toBe('x@y.com')
  })
})
