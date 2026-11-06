import { describe, expect, it } from 'vitest'

import {
  justificativaParaEnviar,
  MOTIVOS_DA_FALTA,
  problemaDaJustificativa,
} from '@/service/parceiro/faltas-service'

const HOJE = '2026-11-06'

describe('problemaDaJustificativa (guia 3.3)', () => {
  it('com contato, o motivo é obrigatório', () => {
    expect(problemaDaJustificativa({ canal: 'TELEFONE' }, HOJE)).toBe('motivo')
    expect(problemaDaJustificativa({ canal: 'TELEFONE', motivo: 'ESQUECEU' }, HOJE)).toBeNull()
  })

  it('sem resposta não pede motivo', () => {
    expect(problemaDaJustificativa({ canal: 'SEM_RESPOSTA' }, HOJE)).toBeNull()
  })

  it('o óbito nunca depois de hoje', () => {
    expect(
      problemaDaJustificativa({ canal: 'TELEFONE', motivo: 'OBITO', obitoEm: '2026-11-07' }, HOJE),
    ).toBe('obitoNoFuturo')
  })
})

describe('justificativaParaEnviar', () => {
  it('sem resposta vai sem motivo e sem data, com a observação aparada', () => {
    expect(
      justificativaParaEnviar({
        canal: 'SEM_RESPOSTA',
        motivo: 'ESQUECEU',
        observacao: '  caixa postal  ',
        obitoEm: '2026-11-01',
      }),
    ).toEqual({ canal: 'SEM_RESPOSTA', observacao: 'caixa postal' })
  })

  it('a data só vai com o óbito', () => {
    expect(
      justificativaParaEnviar({ canal: 'TELEFONE', motivo: 'ESQUECEU', obitoEm: '2026-11-01' }),
    ).toEqual({ canal: 'TELEFONE', motivo: 'ESQUECEU' })
    expect(
      justificativaParaEnviar({ canal: 'TELEFONE', motivo: 'OBITO', obitoEm: '2026-11-01' }),
    ).toEqual({ canal: 'TELEFONE', motivo: 'OBITO', obitoEm: '2026-11-01' })
  })

  it('o óbito fica no fim da lista de motivos', () => {
    expect(MOTIVOS_DA_FALTA[MOTIVOS_DA_FALTA.length - 1]).toBe('OBITO')
  })
})
