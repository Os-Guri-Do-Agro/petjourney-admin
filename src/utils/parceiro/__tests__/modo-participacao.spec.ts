import { beforeAll, describe, expect, it } from 'vitest'

import i18n from '@/i18n'
import { ApiError } from '@/service/api'

import {
  canManageSolicitacaoModo,
  canSolicitarModo,
  getModoCardCopy,
  isAfiliadoNaoAtivoError,
  isProgramaEditavelNoCadastro,
  programasEmAnalise,
  resolveCadastroErrorView,
  resolveModoCta,
  resolveProgramasIniciais,
  resolveSolicitarModoError,
} from '@/utils/parceiro/modo-participacao'

function bloco(status: Parameters<typeof canSolicitarModo>[0], podeSolicitar: boolean) {
  return { status, podeSolicitar }
}

describe('modo-participacao', () => {
  beforeAll(() => {
    i18n.global.locale.value = 'pt'
  })

  it('identifica status que permitem solicitar (Parte 9: SUSPENSO não re-solicita)', () => {
    expect(canSolicitarModo('NAO_SOLICITADO')).toBe(true)
    expect(canSolicitarModo('REJEITADO')).toBe(true)
    expect(canSolicitarModo('SUSPENSO')).toBe(false)
    expect(canSolicitarModo('SOLICITADO')).toBe(false)
    expect(canSolicitarModo('ATIVO')).toBe(false)
  })

  it('só o dono com membership solicita (sem vínculo, o caminho é o cadastro)', () => {
    expect(canManageSolicitacaoModo(true, false)).toBe(true)
    expect(canManageSolicitacaoModo(false, true)).toBe(false)
    expect(canManageSolicitacaoModo(true, true)).toBe(false)
    expect(canManageSolicitacaoModo(false, false)).toBe(false)
  })

  it('usa a cópia sugerida da spec para cada modo', () => {
    expect(getModoCardCopy('afiliado').features).toHaveLength(3)
    expect(getModoCardCopy('participativo').description).toContain('comunidade PetJourney')
  })

  it('resolve CTA pelo podeSolicitar do backend', () => {
    expect(resolveModoCta(bloco('NAO_SOLICITADO', true), 'afiliado', true)).toEqual({
      type: 'solicitar',
      label: 'Solicitar',
    })
    expect(resolveModoCta(bloco('REJEITADO', true), 'participativo', true)).toEqual({
      type: 'solicitar-novamente',
      label: 'Solicitar de novo',
    })
    expect(resolveModoCta(bloco('SOLICITADO', false), 'afiliado', true)).toEqual({
      type: 'aguardando',
      label: 'Aguardando análise',
    })
    expect(resolveModoCta(bloco('ATIVO', false), 'afiliado', true)).toEqual({
      type: 'carteira',
      label: 'Ir para a Carteira',
      to: '/parceiro/carteira',
    })
    expect(resolveModoCta(bloco('ATIVO', false), 'participativo', true)).toEqual({ type: 'none' })
    expect(resolveModoCta(bloco('SUSPENSO', false), 'afiliado', true)).toEqual({ type: 'none' })
    expect(resolveModoCta(bloco('NAO_SOLICITADO', true), 'afiliado', false)).toEqual({
      type: 'none',
    })
  })

  it('roteia erros de solicitação pelo reason estável', () => {
    expect(
      resolveSolicitarModoError(
        new ApiError('Conflito', 409, undefined, 'PARCEIRO_MODO_JA_SOLICITADO'),
      ),
    ).toBe('Este programa já foi solicitado ou está ativo.')

    expect(
      resolveSolicitarModoError(new ApiError('Conflito', 409, undefined, 'PARCEIRO_MODO_SUSPENSO')),
    ).toContain('suspenso')
  })

  it('mantém fallback para erros antigos sem reason', () => {
    expect(resolveSolicitarModoError(new ApiError('Forbidden', 403))).toBe(
      'Sem permissão para solicitar. Confirme o vínculo da conta ou peça ao dono da empresa.',
    )

    expect(resolveSolicitarModoError(new ApiError('Parceiro nao operavel', 409))).toBe(
      'Seu cadastro ainda está em análise.',
    )
  })

  it('roteia erros do cadastro pelo reason e aponta o campo', () => {
    expect(
      resolveCadastroErrorView(
        new ApiError('Conflito', 409, undefined, 'PARCEIRO_CADASTRO_NOME_EM_USO'),
      ).field,
    ).toBe('nome')

    expect(
      resolveCadastroErrorView(
        new ApiError('Conflito', 409, undefined, 'PARCEIRO_CADASTRO_CNPJ_EM_USO'),
      ).field,
    ).toBe('cnpj')

    const desconhecido = resolveCadastroErrorView(new ApiError('Mensagem do backend', 409))
    expect(desconhecido.message).toBe('Mensagem do backend')
    expect(desconhecido.field).toBeUndefined()
  })

  it('detecta erro AFILIADO_NAO_ATIVO da carteira', () => {
    expect(isAfiliadoNaoAtivoError(new ApiError('Conflito', 409, 'AFILIADO_NAO_ATIVO'))).toBe(true)
    expect(isAfiliadoNaoAtivoError(new ApiError('Outro', 409))).toBe(false)
  })

  it('primeiro cadastro nasce com afiliado marcado e participativo desmarcado', () => {
    expect(resolveProgramasIniciais(null)).toEqual(['afiliado'])
    expect(resolveProgramasIniciais()).toEqual(['afiliado'])
  })

  it('reenvio pós-recusa volta ao default, porque a recusa apagou a intenção', () => {
    const blocos = {
      afiliado: { status: 'NAO_SOLICITADO' as const },
      participativo: { status: 'NAO_SOLICITADO' as const },
    }

    expect(resolveProgramasIniciais(blocos)).toEqual(['afiliado'])
  })

  it('mantém marcado o que já está solicitado, inclusive o participativo', () => {
    expect(
      resolveProgramasIniciais({
        afiliado: { status: 'NAO_SOLICITADO' },
        participativo: { status: 'SOLICITADO' },
      }),
    ).toEqual(['afiliado', 'participativo'])
  })

  it('programa já decidido fica fora da submissão (ATIVO e SUSPENSO não se mexem)', () => {
    expect(
      resolveProgramasIniciais({
        afiliado: { status: 'ATIVO' },
        participativo: { status: 'SUSPENSO' },
      }),
    ).toEqual([])

    expect(isProgramaEditavelNoCadastro('ATIVO')).toBe(false)
    expect(isProgramaEditavelNoCadastro('SUSPENSO')).toBe(false)
    expect(isProgramaEditavelNoCadastro('REJEITADO')).toBe(true)
  })

  it('lista para a tela de espera só o que está aguardando decisão', () => {
    expect(
      programasEmAnalise({
        afiliado: { status: 'SOLICITADO' },
        participativo: { status: 'ATIVO' },
      }),
    ).toEqual(['afiliado'])

    expect(programasEmAnalise(null)).toEqual([])
  })
})
