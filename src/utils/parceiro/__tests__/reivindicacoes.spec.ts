import { describe, expect, it } from 'vitest'

import type { PortalStatus } from '@/service/parceiro/types'

import { modoDoVinculo } from '../reivindicacoes'

function status(
  statusAuditoria: PortalStatus['statusAuditoria'],
  podeOperar: boolean,
): Pick<PortalStatus, 'podeOperar' | 'statusAuditoria'> {
  return { statusAuditoria, podeOperar }
}

describe('modoDoVinculo', () => {
  it('cadastro operando vincula', () => {
    expect(modoDoVinculo(status('APROVADO', true))).toBe('vincular')
  })

  it('cadastro em análise guarda o código para a aprovação', () => {
    expect(modoDoVinculo(status('PENDENTE', false))).toBe('reivindicar')
  })

  it.each([
    ['SUSPENSO', false],
    ['REJEITADO', false],
    // Aprovado mas sem operar (desativado): a API recusaria as duas rotas.
    ['APROVADO', false],
  ] as const)('%s sem operar fica sem o modal', (auditoria, podeOperar) => {
    expect(modoDoVinculo(status(auditoria, podeOperar))).toBeNull()
  })

  it('sem status carregado, ainda não abre', () => {
    expect(modoDoVinculo(null)).toBeNull()
  })
})
