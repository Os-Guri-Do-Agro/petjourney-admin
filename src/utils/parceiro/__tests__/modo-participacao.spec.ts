import { describe, expect, it } from 'vitest'

import { ApiError } from '@/service/api'

import {
  canManageSolicitacaoModo,
  canSolicitarModo,
  getModoCardCopy,
  isAfiliadoNaoAtivoError,
  resolveModoCta,
  resolveSolicitarModoError,
} from '@/utils/parceiro/modo-participacao'

describe('modo-participacao', () => {
  it('identifica status que permitem solicitar', () => {
    expect(canSolicitarModo('NAO_SOLICITADO')).toBe(true)
    expect(canSolicitarModo('REJEITADO')).toBe(true)
    expect(canSolicitarModo('SUSPENSO')).toBe(true)
    expect(canSolicitarModo('SOLICITADO')).toBe(false)
    expect(canSolicitarModo('ATIVO')).toBe(false)
  })

  it('permite solicitar sem membership ou como dono', () => {
    expect(canManageSolicitacaoModo(true, false)).toBe(true)
    expect(canManageSolicitacaoModo(false, true)).toBe(true)
    expect(canManageSolicitacaoModo(false, false)).toBe(false)
  })

  it('usa a cópia sugerida da spec para cada modo', () => {
    expect(getModoCardCopy('afiliado').features).toHaveLength(3)
    expect(getModoCardCopy('participativo').description).toContain('comunidade PetJourney')
  })

  it('resolve CTA conforme status e papel', () => {
    expect(resolveModoCta('NAO_SOLICITADO', 'afiliado', true)).toEqual({
      type: 'solicitar',
      label: 'Solicitar',
    })
    expect(resolveModoCta('REJEITADO', 'participativo', true)).toEqual({
      type: 'solicitar-novamente',
      label: 'Solicitar de novo',
    })
    expect(resolveModoCta('SOLICITADO', 'afiliado', true)).toEqual({
      type: 'aguardando',
      label: 'Aguardando análise',
    })
    expect(resolveModoCta('ATIVO', 'afiliado', true)).toEqual({
      type: 'carteira',
      label: 'Ir para a Carteira',
      to: '/parceiro/carteira',
    })
    expect(resolveModoCta('ATIVO', 'participativo', true)).toEqual({ type: 'none' })
    expect(resolveModoCta('NAO_SOLICITADO', 'afiliado', false)).toEqual({ type: 'none' })
  })

  it('mapeia erros de solicitação da API', () => {
    expect(resolveSolicitarModoError(new ApiError('Forbidden', 403))).toBe(
      'Sem permissão para solicitar. Confirme o vínculo da conta ou peça ao dono da empresa.',
    )

    expect(
      resolveSolicitarModoError(new ApiError('Parceiro nao operavel', 409)),
    ).toBe('Seu cadastro ainda está em análise.')

    expect(
      resolveSolicitarModoError(new ApiError('Modo ja solicitado ou ativo', 409)),
    ).toBe('Este programa já foi solicitado ou está ativo.')
  })

  it('detecta erro AFILIADO_NAO_ATIVO da carteira', () => {
    expect(
      isAfiliadoNaoAtivoError(new ApiError('Conflito', 409, 'AFILIADO_NAO_ATIVO')),
    ).toBe(true)
    expect(isAfiliadoNaoAtivoError(new ApiError('Outro', 409))).toBe(false)
  })
})
