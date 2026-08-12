import { describe, expect, it } from 'vitest'

import type { PerfilParceiro } from '@/service/auth/auth-service'
import { montarOpcoesParceiro, podeCadastrarNovaEmpresa } from '@/utils/parceiro/perfis-parceiro'

function perfil(overrides: Partial<PerfilParceiro> = {}): PerfilParceiro {
  return {
    parceiroId: 'p-1',
    nome: 'Clínica X',
    papel: 'DONO',
    status: 'APROVADO',
    ...overrides,
  }
}

describe('montarOpcoesParceiro', () => {
  it('marca o parceiro do token como ativo e os demais não', () => {
    const opcoes = montarOpcoesParceiro(
      [perfil({ parceiroId: 'p-1' }), perfil({ parceiroId: 'p-2' })],
      'p-2',
    )

    expect(opcoes.find((o) => o.parceiroId === 'p-1')?.ativo).toBe(false)
    expect(opcoes.find((o) => o.parceiroId === 'p-2')?.ativo).toBe(true)
  })

  it('sem parceiro ativo, nenhum item fica marcado', () => {
    expect(montarOpcoesParceiro([perfil()], null).every((o) => !o.ativo)).toBe(true)
    expect(montarOpcoesParceiro([perfil()], undefined).every((o) => !o.ativo)).toBe(true)
  })

  it('OPERADOR vira equipe e DONO vem antes na lista', () => {
    const opcoes = montarOpcoesParceiro(
      [
        perfil({ parceiroId: 'equipe', papel: 'OPERADOR' }),
        perfil({ parceiroId: 'meu', papel: 'DONO' }),
      ],
      null,
    )

    expect(opcoes.map((o) => o.parceiroId)).toEqual(['meu', 'equipe'])
    expect(opcoes[0]?.equipe).toBe(false)
    expect(opcoes[1]?.equipe).toBe(true)
  })

  it('APROVADO não ganha badge; os outros status ganham', () => {
    expect(montarOpcoesParceiro([perfil({ status: 'APROVADO' })], null)[0]?.badgeStatus).toBeNull()
    expect(montarOpcoesParceiro([perfil({ status: 'PENDENTE' })], null)[0]?.badgeStatus).toBe(
      'PENDENTE',
    )
    expect(montarOpcoesParceiro([perfil({ status: 'SUSPENSO' })], null)[0]?.badgeStatus).toBe(
      'SUSPENSO',
    )
  })
})

describe('podeCadastrarNovaEmpresa', () => {
  it('libera quando não há negócio próprio em andamento', () => {
    expect(podeCadastrarNovaEmpresa([])).toBe(true)
    expect(podeCadastrarNovaEmpresa([perfil({ papel: 'OPERADOR' })])).toBe(true)
    expect(podeCadastrarNovaEmpresa([perfil({ papel: 'DONO', status: 'REJEITADO' })])).toBe(true)
  })

  it('bloqueia com DONO em PENDENTE ou APROVADO (o backend nega com 409)', () => {
    expect(podeCadastrarNovaEmpresa([perfil({ papel: 'DONO', status: 'PENDENTE' })])).toBe(false)
    expect(podeCadastrarNovaEmpresa([perfil({ papel: 'DONO', status: 'APROVADO' })])).toBe(false)
  })

  it('DONO SUSPENSO não conta como negócio em andamento', () => {
    expect(podeCadastrarNovaEmpresa([perfil({ papel: 'DONO', status: 'SUSPENSO' })])).toBe(true)
  })
})
