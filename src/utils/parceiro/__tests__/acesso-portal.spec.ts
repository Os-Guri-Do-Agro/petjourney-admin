import { describe, expect, it } from 'vitest'

import { ApiError } from '@/service/api'
import { decidirAcessoPortal, type AcessoPortalContexto } from '@/utils/parceiro/acesso-portal'

function contexto(overrides: Partial<AcessoPortalContexto> = {}): AcessoPortalContexto {
  return {
    parceiroIdEnviado: null,
    tinhaContexto: false,
    jaRetentou: false,
    ...overrides,
  }
}

describe('decidirAcessoPortal', () => {
  it('400 pede escolha explícita de parceiro', () => {
    expect(decidirAcessoPortal(new ApiError('x', 400), contexto())).toBe('selecionar-parceiro')
  })

  it('403 com parceiroId enviado retenta sem o id (pode estar morto no localStorage)', () => {
    expect(
      decidirAcessoPortal(new ApiError('x', 403), contexto({ parceiroIdEnviado: 'p-1' })),
    ).toBe('retentar-sem-parceiro')
  })

  it('403 na retentativa não retenta de novo: sem contexto anterior é conta sem acesso', () => {
    expect(
      decidirAcessoPortal(
        new ApiError('x', 403),
        contexto({ parceiroIdEnviado: 'p-1', jaRetentou: true }),
      ),
    ).toBe('sem-acesso')
  })

  it('403 depois de o portal já ter carregado é acesso encerrado', () => {
    expect(
      decidirAcessoPortal(new ApiError('x', 403), contexto({ tinhaContexto: true })),
    ).toBe('acesso-encerrado')
  })

  it('403 na retentativa com contexto anterior também é acesso encerrado', () => {
    expect(
      decidirAcessoPortal(
        new ApiError('x', 403),
        contexto({ parceiroIdEnviado: 'p-1', jaRetentou: true, tinhaContexto: true }),
      ),
    ).toBe('acesso-encerrado')
  })

  it('403 sem contexto e sem id enviado é conta que nunca teve parceiro', () => {
    expect(decidirAcessoPortal(new ApiError('x', 403), contexto())).toBe('sem-acesso')
  })

  it('outros status e erros de rede caem no erro genérico', () => {
    expect(decidirAcessoPortal(new ApiError('x', 500), contexto())).toBe('erro')
    expect(decidirAcessoPortal(new ApiError('x', 409), contexto({ tinhaContexto: true }))).toBe(
      'erro',
    )
    expect(decidirAcessoPortal(new Error('offline'), contexto())).toBe('erro')
  })
})
