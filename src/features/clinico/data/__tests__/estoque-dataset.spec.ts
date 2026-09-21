/**
 * O estoque de vacinas no dataset.
 *
 * A aba de estoque é argumento de venda, e ela só argumenta se **cada situação tiver um caso**:
 * um lote vencido ainda com dose dentro (o prejuízo), um a vencer com saldo (o que ainda dá para
 * salvar), uma vacina zerada e uma abaixo do piso. Nada disso quebra a tela se sumir — os
 * gráficos abrem retos e em silêncio, que é o pior jeito de perder uma demonstração.
 *
 * O outro dever destes testes é a **amarra entre as duas camadas**: o estoque nasceu dentro da
 * mesma função que planta as aplicações, e o que liga as duas é o código do lote. Um seed que
 * deixe a carteira do animal citando um lote que o estoque não conhece faz a tela contar consumo
 * zero num frasco que girou o ano inteiro.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { createClinicClock } from '../../domain/clinic-time'
import { resumirEstoque } from '../../domain/estoque-vacinas'
import { reforcosDoPaciente } from '../../domain/vacinacao'
import { CLINIC_UTC_OFFSET, vacinasFixture } from '../fixtures'
import { getDataset, resetDataset } from '../store'

const clock = createClinicClock(CLINIC_UTC_OFFSET)

function resumo() {
  const dataset = getDataset()

  return resumirEstoque({
    lotes: dataset.lotesDeVacina,
    vacinas: vacinasFixture,
    aplicacoes: dataset.aplicacoesDeVacina,
    hoje: clock.today(),
  })
}

beforeEach(() => {
  resetDataset()
})

describe('lotes do dataset', () => {
  it('tem lote registrado', () => {
    expect(getDataset().lotesDeVacina.length).toBeGreaterThan(0)
  })

  it('todo lote aponta para vacina do catálogo', () => {
    const ids = new Set(vacinasFixture.map((vacina) => vacina.id))

    for (const lote of getDataset().lotesDeVacina) {
      expect(ids.has(lote.vacinaId), lote.codigo).toBe(true)
    }
  })

  it('o código do lote é único', () => {
    /* É a chave que liga a aplicação ao estoque: repetido, duas geladeiras viram uma. */
    const codigos = getDataset().lotesDeVacina.map((lote) => lote.codigo)

    expect(new Set(codigos).size).toBe(codigos.length)
  })

  it('todo lote vence depois de ter sido recebido', () => {
    for (const lote of getDataset().lotesDeVacina) {
      expect(lote.validade > lote.recebidoEm, lote.codigo).toBe(true)
    }
  })

  it('nenhum lote sai mais do que entrou', () => {
    /*
     * A atribuição por PEPS é o que garante isto. Sem a amarra, o seed produziria saldo negativo
     * e o total da clínica passaria a somar ao contrário.
     */
    for (const lote of resumo().lotes) {
      expect(lote.aplicadas + lote.perdidas, lote.codigo).toBeLessThanOrEqual(
        lote.quantidadeRecebida,
      )
    }
  })

  it('a aplicação que cita um lote do estoque copia a validade dele', () => {
    /*
     * A carteira do animal e a geladeira precisam dizer a mesma data. Divergindo, o comprovante
     * impresso contradiz a tela de quem confere o frasco.
     */
    const dataset = getDataset()
    const porCodigo = new Map(dataset.lotesDeVacina.map((lote) => [lote.codigo, lote]))

    const divergentes = dataset.aplicacoesDeVacina
      .map((aplicacao) => ({ aplicacao, lote: porCodigo.get(aplicacao.lote) }))
      .filter(({ aplicacao, lote }) => lote && aplicacao.validadeLote !== lote.validade)
      .map(({ aplicacao }) => `${aplicacao.id} (${aplicacao.lote})`)

    expect(divergentes).toEqual([])
  })

  it('a maior parte das doses sai de um lote conhecido', () => {
    /*
     * Não são todas de propósito: a dose de antes do controle de estoque existe no dataset, e a
     * tela precisa conviver com ela. Mas se a maioria caísse fora, o gráfico de consumo estaria
     * desenhando um estoque que não é o da clínica.
     */
    const dataset = getDataset()
    const codigos = new Set(dataset.lotesDeVacina.map((lote) => lote.codigo))
    const conhecidas = dataset.aplicacoesDeVacina.filter((item) => codigos.has(item.lote))

    expect(conhecidas.length / dataset.aplicacoesDeVacina.length).toBeGreaterThan(0.5)
  })
})

describe('as situações que a aba precisa mostrar', () => {
  it('cobre as quatro situações de lote', () => {
    const situacoes = new Set(resumo().lotes.map((lote) => lote.situacao))

    expect(situacoes.has('vencido'), 'vencido').toBe(true)
    expect(situacoes.has('vencendo'), 'a vencer').toBe(true)
    expect(situacoes.has('ativo'), 'ativo').toBe(true)
    expect(situacoes.has('esgotado'), 'esgotado').toBe(true)
  })

  it('tem lote vencido **com dose dentro** — o prejuízo da tela', () => {
    const vencidos = resumo().lotes.filter((lote) => lote.situacao === 'vencido')

    expect(vencidos.length).toBeGreaterThan(0)
    expect(vencidos.every((lote) => lote.saldo > 0)).toBe(true)
  })

  it('tem dose a vencer que ainda dá para faturar', () => {
    const { indicadores } = resumo()

    expect(indicadores.dosesVencendo).toBeGreaterThan(0)
    expect(indicadores.valorEmRisco).toBeGreaterThan(0)
  })

  it('cobre as três situações de saldo por vacina', () => {
    const situacoes = new Set(resumo().saldos.map((item) => item.situacao))

    expect(situacoes.has('zerado'), 'acabou').toBe(true)
    expect(situacoes.has('abaixo'), 'abaixo do mínimo').toBe(true)
    expect(situacoes.has('ok'), 'em nível').toBe(true)
  })

  it('tem perda dos três motivos', () => {
    /* Um número só de "perdas" não diz qual conversa a clínica precisa ter. */
    const motivos = new Set(resumo().perdasPorMotivo.map((item) => item.motivo))

    expect(motivos).toEqual(new Set(['quebra', 'temperatura', 'vencimento']))
  })

  it('a perda é visível sem ser absurda', () => {
    /* Zero não demonstra nada; um terço do estoque faria a clínica duvidar do dado. */
    const { perdaPercentual } = resumo().indicadores

    expect(perdaPercentual).toBeGreaterThan(0.01)
    expect(perdaPercentual).toBeLessThan(0.2)
  })
})

describe('o giro que o gráfico de consumo desenha', () => {
  it('tem saída em todos os meses da janela', () => {
    /*
     * Uma torre num mês e onze colunas rasas não é giro, é artefato de geração — foi o que a
     * primeira versão do seed produziu, plantando o reforço do ano anterior numa janela de
     * vinte e quatro dias.
     */
    for (const mes of resumo().consumo) {
      expect(mes.total, mes.mes).toBeGreaterThan(0)
    }
  })

  it('nenhum mês concentra mais de um terço das doses do ano', () => {
    const consumo = resumo().consumo
    const total = consumo.reduce((soma, mes) => soma + mes.total, 0)

    for (const mes of consumo) {
      expect(mes.total / total, mes.mes).toBeLessThan(0.34)
    }
  })

  it('mais de uma vacina aparece na pilha', () => {
    /* Com uma série só, a paleta de identidade e a legenda não teriam o que fazer. */
    const comSaida = vacinasFixture.filter((vacina) =>
      resumo().consumo.some((mes) => (mes.porVacina[vacina.id] ?? 0) > 0),
    )

    expect(comSaida.length).toBeGreaterThan(1)
  })
})

describe('o estoque não estraga a lista de chamada', () => {
  it('as quatro situações de recall continuam no dataset', () => {
    /*
     * O movimento de fundo que o gráfico de consumo pediu triplicou o número de aplicações, e
     * cada uma delas é uma candidata a mexer no recall. A amarra é a camada de rotina nunca
     * tocar um par paciente × vacina que a camada plantada usa, e sempre fechar em dia.
     */
    const dataset = getDataset()
    const hoje = clock.today()
    const porPet = new Map<string, typeof dataset.aplicacoesDeVacina>()

    for (const aplicacao of dataset.aplicacoesDeVacina) {
      porPet.set(aplicacao.petId, [...(porPet.get(aplicacao.petId) ?? []), aplicacao])
    }

    const situacoes = new Set(
      [...porPet.values()]
        .flatMap((aplicacoes) => reforcosDoPaciente(aplicacoes, vacinasFixture, hoje))
        .map((item) => item.situacao),
    )

    expect(situacoes.has('vencido'), 'vencido').toBe(true)
    expect(situacoes.has('proximo'), 'a vencer').toBe(true)
    expect(situacoes.has('serie-incompleta'), 'série aberta').toBe(true)
    expect(situacoes.has('em-dia'), 'em dia').toBe(true)
  })
})
