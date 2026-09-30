/**
 * O lote com o frasco na mão: pode ou não pode, e o que avisar.
 *
 * Vencido trava; perto de vencer passa, é o sugerido e diz por quê. O que esta suíte protege é a
 * diferença entre as duas coisas — assustar quem aplica com um frasco válido faz a clínica
 * descartar a dose que ainda dava para usar.
 */

import { describe, expect, it } from 'vitest'

import { addDays } from '../clinic-time'
import type { LoteNoEstoque } from '../estoque-vacinas'
import {
  AVISO_DE_VALIDADE_NA_APLICACAO_EM_DIAS,
  avaliarValidade,
  lotesParaAplicar,
} from '../lote-na-aplicacao'

const HOJE = '2026-09-29'

function lote(patch: Partial<LoteNoEstoque>): LoteNoEstoque {
  return {
    id: `lote-${patch.codigo ?? 'x'}`,
    vacinaId: 'vac-v10',
    vacinaNome: 'V10',
    codigo: 'V10-X',
    fornecedor: 'Fornecedor',
    recebidoEm: addDays(HOJE, -100),
    validade: addDays(HOJE, 200),
    quantidadeRecebida: 10,
    custoUnitario: 3000,
    aplicadas: 0,
    perdidas: 0,
    saldo: 5,
    situacao: 'ativo',
    diasParaVencer: 200,
    valorParado: 15000,
    ...patch,
  }
}

describe('avaliarValidade', () => {
  it('vencido trava', () => {
    expect(avaliarValidade(addDays(HOJE, -1), HOJE)).toEqual({
      pode: false,
      motivo: 'vencido',
      dias: -1,
    })
  })

  it('no último dia da validade ainda pode, com aviso', () => {
    expect(avaliarValidade(HOJE, HOJE)).toEqual({ pode: true, aviso: 'vence-hoje', dias: 0 })
  })

  it('perto de vencer pode, com aviso', () => {
    expect(avaliarValidade(addDays(HOJE, 12), HOJE)).toEqual({
      pode: true,
      aviso: 'vencendo',
      dias: 12,
    })
  })

  it('longe de vencer, sem aviso', () => {
    expect(
      avaliarValidade(addDays(HOJE, AVISO_DE_VALIDADE_NA_APLICACAO_EM_DIAS + 1), HOJE),
    ).toEqual({ pode: true, aviso: null, dias: AVISO_DE_VALIDADE_NA_APLICACAO_EM_DIAS + 1 })
  })

  it('sem validade trava: a carteira sairia sem o dado que a viagem confere', () => {
    expect(avaliarValidade(null, HOJE)).toEqual({ pode: false, motivo: 'sem-validade' })
  })
})

describe('lotesParaAplicar', () => {
  const geladeira = [
    lote({ codigo: 'NOVO', validade: addDays(HOJE, 400) }),
    lote({ codigo: 'VENCIDO', validade: addDays(HOJE, -20), situacao: 'vencido' }),
    lote({ codigo: 'VENCENDO', validade: addDays(HOJE, 15), situacao: 'vencendo' }),
    lote({ codigo: 'VAZIO', validade: addDays(HOJE, 10), saldo: 0, situacao: 'esgotado' }),
    lote({ codigo: 'OUTRA', vacinaId: 'vac-giardia', validade: addDays(HOJE, 5) }),
  ]

  it('sugere o primeiro a vencer que ainda pode', () => {
    const lotes = lotesParaAplicar(geladeira, 'vac-v10', HOJE)

    expect(lotes.filter((item) => item.sugerido).map((item) => item.codigo)).toEqual(['VENCENDO'])
  })

  it('o vencido continua na lista, travado e no fim', () => {
    /* Some da lista e alguém digita o código à mão. Travado, ele explica por que não. */
    const lotes = lotesParaAplicar(geladeira, 'vac-v10', HOJE)

    expect(lotes.map((item) => item.codigo)).toEqual(['VENCENDO', 'NOVO', 'VENCIDO'])
    expect(lotes[2]?.avaliacao.pode).toBe(false)
  })

  it('frasco sem dose e lote de outra vacina ficam fora', () => {
    const codigos = lotesParaAplicar(geladeira, 'vac-v10', HOJE).map((item) => item.codigo)

    expect(codigos).not.toContain('VAZIO')
    expect(codigos).not.toContain('OUTRA')
  })

  it('só vencidos na geladeira: nenhum sugerido', () => {
    const lotes = lotesParaAplicar(
      [lote({ codigo: 'VENCIDO', validade: addDays(HOJE, -3) })],
      'vac-v10',
      HOJE,
    )

    expect(lotes.some((item) => item.sugerido)).toBe(false)
  })
})
