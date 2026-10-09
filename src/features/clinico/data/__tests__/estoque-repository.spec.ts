/**
 * As escritas do estoque: receber lote, dar baixa, ajustar o mínimo e combinar metas.
 *
 * O que estes testes protegem é a geladeira da tela continuar batendo com a de verdade depois de
 * cada gesto: a caixa recebida aparece para ser aplicada, a dose baixada some do saldo, a contagem
 * vira a diferença certa, e o mínimo ajustado muda o que falta comprar.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { addDays } from '../../domain/clinic-time'
import { mesDe, mesSeguinte } from '../../domain/metas-de-estoque'
import { resetMockConfig, setMockConfig } from '../mock-runtime'
import { estoqueRepository, EstoqueRecusadoError, vacinaRepository } from '../repositories'
import { getDataset, resetDataset } from '../store'
import { clinicClock } from '../../stores/clinico'

beforeEach(() => {
  resetDataset()
  setMockConfig({ latenciaMs: 0, jitterMs: 0 })
})

afterEach(() => {
  resetMockConfig()
})

const hoje = () => clinicClock.today()

function entrada(patch: Partial<Parameters<typeof estoqueRepository.receberLote>[0]> = {}) {
  return {
    vacinaId: 'vac-felv',
    codigo: 'FLV-2610',
    fornecedor: 'Vacinas Brasil',
    recebidoEm: hoje(),
    validade: addDays(hoje(), 400),
    quantidade: 6,
    custoUnitario: 4290,
    notaFiscal: '51003',
    recebidoPor: 'prof-ana',
    ...patch,
  }
}

async function recusa(promessa: Promise<unknown>) {
  try {
    await promessa
  } catch (falha) {
    return falha instanceof EstoqueRecusadoError ? falha.kind : 'outra'
  }

  return null
}

describe('receber lote', () => {
  it('põe a caixa na geladeira e no diálogo de aplicação', async () => {
    await estoqueRepository.receberLote(entrada())

    const resumo = await vacinaRepository.estoque()
    const felv = resumo.saldos.find((item) => item.vacinaId === 'vac-felv')

    expect(felv?.saldo).toBe(6)
    expect(felv?.situacao).toBe('ok')
    expect(
      (await vacinaRepository.lotesParaAplicar('vac-felv')).map((lote) => lote.codigo),
    ).toContain('FLV-2610')
  })

  it('recusa código repetido, ignorando maiúsculas', async () => {
    expect(await recusa(estoqueRepository.receberLote(entrada({ codigo: 'rab-2601' })))).toBe(
      'codigo-repetido',
    )
  })

  it('recusa frasco vencido e recebimento no futuro', async () => {
    expect(await recusa(estoqueRepository.receberLote(entrada({ validade: hoje() })))).toBe(
      'validade-passada',
    )
    expect(
      await recusa(estoqueRepository.receberLote(entrada({ recebidoEm: addDays(hoje(), 1) }))),
    ).toBe('recebido-no-futuro')
  })

  it('aparece nos movimentos com a nota', async () => {
    await estoqueRepository.receberLote(entrada())

    const [primeiro] = await estoqueRepository.movimentos()

    expect(primeiro).toMatchObject({ tipo: 'entrada', codigo: 'FLV-2610', detalhe: '51003' })
  })
})

describe('dar baixa', () => {
  function loteComSaldo() {
    return vacinaRepository
      .estoque()
      .then((resumo) => resumo.lotes.find((lote) => lote.situacao === 'ativo' && lote.saldo > 2)!)
  }

  it('tira as doses do saldo do lote', async () => {
    const lote = await loteComSaldo()

    await estoqueRepository.registrarBaixa({
      loteId: lote.id,
      motivo: 'quebra',
      quantidade: 2,
      contadas: null,
      em: hoje(),
      registradaPor: 'prof-ana',
      observacao: '',
    })

    const depois = (await vacinaRepository.estoque()).lotes.find((item) => item.id === lote.id)

    expect(depois?.saldo).toBe(lote.saldo - 2)
    expect(depois?.perdidas).toBe(lote.perdidas + 2)
  })

  it('não deixa baixar mais do que o lote tem', async () => {
    const lote = await loteComSaldo()

    expect(
      await recusa(
        estoqueRepository.registrarBaixa({
          loteId: lote.id,
          motivo: 'quebra',
          quantidade: lote.saldo + 1,
          contadas: null,
          em: hoje(),
          registradaPor: 'prof-ana',
          observacao: '',
        }),
      ),
    ).toBe('acima-do-saldo')
  })

  it('na contagem, baixa a diferença para o que foi achado', async () => {
    const lote = await loteComSaldo()

    const perda = await estoqueRepository.registrarBaixa({
      loteId: lote.id,
      motivo: 'contagem',
      quantidade: 0,
      contadas: lote.saldo - 1,
      em: hoje(),
      registradaPor: 'prof-ana',
      observacao: 'Contagem do fim do mês',
    })

    expect(perda).toMatchObject({ motivo: 'contagem', quantidade: 1 })
  })

  it('recusa contagem maior que o sistema e contagem que confere', async () => {
    const lote = await loteComSaldo()
    const base = {
      loteId: lote.id,
      motivo: 'contagem' as const,
      quantidade: 0,
      em: hoje(),
      registradaPor: 'prof-ana',
      observacao: '',
    }

    expect(
      await recusa(estoqueRepository.registrarBaixa({ ...base, contadas: lote.saldo + 2 })),
    ).toBe('contagem-acima-do-saldo')
    expect(await recusa(estoqueRepository.registrarBaixa({ ...base, contadas: lote.saldo }))).toBe(
      'contagem-sem-diferenca',
    )
  })
})

describe('mínimo por vacina', () => {
  it('muda o que falta comprar', async () => {
    await estoqueRepository.ajustarMinimo('vac-v10', 200)

    const v10 = (await vacinaRepository.estoque()).saldos.find(
      (item) => item.vacinaId === 'vac-v10',
    )

    expect(v10?.minimo).toBe(200)
    expect(v10?.situacao).toBe('abaixo')
  })

  it('não vaza para o dataset regenerado', async () => {
    await estoqueRepository.ajustarMinimo('vac-v10', 200)
    resetDataset()

    expect(vacinaRepository.catalogo().find((item) => item.id === 'vac-v10')?.estoqueMinimo).toBe(
      10,
    )
  })
})

describe('metas', () => {
  it('abre com o mês atual planejado e a sugestão do próximo', async () => {
    const painel = await estoqueRepository.metas()

    expect(painel.atual.mes).toBe(mesDe(hoje()))
    expect(painel.atual.plano).not.toBeNull()
    expect(painel.atual.progresso.length).toBe(painel.atual.plano?.metas.length)
    expect(painel.proximo.plano).toBeNull()
    expect(painel.sugestao.mes).toBe(mesSeguinte(mesDe(hoje())))
    expect(painel.historico.length).toBeGreaterThan(0)
  })

  it('grava o plano do próximo mês e o pedido passa a sair dele', async () => {
    const proximo = mesSeguinte(mesDe(hoje()))

    await estoqueRepository.salvarPlano({
      mes: proximo,
      metas: [
        { tipo: 'aplicacoes', vacinaId: 'vac-felv', alvo: 10 },
        { tipo: 'perdas', vacinaId: null, alvo: 1 },
      ],
      baseadoEm: mesDe(hoje()),
      criadoPor: 'prof-ana',
    })

    const painel = await estoqueRepository.metas()
    const felv = painel.pedido.find((linha) => linha.vacinaId === 'vac-felv')

    expect(painel.proximo.plano?.metas).toHaveLength(2)
    expect(felv?.meta).toBe(10)
    expect(felv?.comprar).toBe(10 + (felv?.minimo ?? 0) - (felv?.sobra ?? 0))
  })

  it('recusa meta repetida e mês que já fechou', async () => {
    expect(
      await recusa(
        estoqueRepository.salvarPlano({
          mes: mesSeguinte(mesDe(hoje())),
          metas: [
            { tipo: 'perdas', vacinaId: null, alvo: 1 },
            { tipo: 'perdas', vacinaId: null, alvo: 2 },
          ],
          baseadoEm: null,
          criadoPor: 'prof-ana',
        }),
      ),
    ).toBe('meta-repetida')

    expect(
      await recusa(
        estoqueRepository.salvarPlano({
          mes: getDataset().planosDeEstoque[0]!.mes,
          metas: [{ tipo: 'perdas', vacinaId: null, alvo: 1 }],
          baseadoEm: null,
          criadoPor: 'prof-ana',
        }),
      ),
    ).toBe('mes-fechado')
  })

  it('a compra de um lote recebido hoje conta no orçamento do mês', async () => {
    await estoqueRepository.receberLote(entrada())

    const painel = await estoqueRepository.metas()

    expect(painel.atual.realizado.comprasCentavos).toBeGreaterThanOrEqual(6 * 4290)
  })
})
