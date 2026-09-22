/**
 * Preço.
 *
 * Dois erros que estes testes existem para impedir, e os dois custam dinheiro de verdade:
 *
 * 1. **A saída tardia esquecida.** A diária a mais que ninguém lança é a receita que só aparece
 *    no fim do mês, quando não há mais a quem cobrar.
 * 2. **A temporada cobrada pelo período inteiro.** Uma estadia de 28 de dezembro a 4 de janeiro
 *    tem parte em alta e parte fora, e errar para mais perde o cliente.
 */

import { describe, expect, it } from 'vitest'

import { cobrancaDaSaida, diariasEmTemporada, montarOrcamento } from '../tarifas'
import type { PoliticaDoHotel, Servico, Tarifa, Temporada } from '../../data/types'

const OFFSET = '-04:00'

function iso(data: string, hora: string) {
  return `${data}T${hora}:00${OFFSET}`
}

const tarifa: Tarifa = {
  id: 'tarifa-padrao',
  nome: 'Padrão',
  diariaPorPorte: { mini: 7_900, pequeno: 8_900, medio: 10_000, grande: 13_900, gigante: 16_900 },
  acompanhantePercentual: 70,
}

const politica: PoliticaDoHotel = {
  horarioDeSaida: '12:00',
  limiteMeiaDiaria: '18:00',
  meiaDiariaPercentual: 50,
  horarioDeEntrada: '08:00',
  sinalPercentual: 30,
  cancelamentoSemCustoDias: 7,
}

const banho: Servico = {
  id: 'servico-banho',
  kind: 'banho',
  precoCentavos: 8_900,
  porDiaria: false,
  ativo: true,
}

const passeio: Servico = {
  id: 'servico-passeio',
  kind: 'passeio-extra',
  precoCentavos: 3_500,
  porDiaria: true,
  ativo: true,
}

function orcar(entrada: Partial<Parameters<typeof montarOrcamento>[0]> = {}) {
  return montarOrcamento({
    entrada: iso('2026-06-10', '09:00'),
    saida: iso('2026-06-14', '10:00'),
    tarifa,
    porte: 'medio',
    temporadas: [],
    servicos: [],
    catalogoDeServicos: [banho, passeio],
    politica,
    ...entrada,
  })
}

describe('diárias', () => {
  it('conta pernoites, e o total é a diária vezes o número delas', () => {
    const orcamento = orcar()

    expect(orcamento.linhas[0]).toMatchObject({
      kind: 'diaria',
      quantidade: 4,
      totalCentavos: 40_000,
    })
    expect(orcamento.totalCentavos).toBe(40_000)
  })

  it('entrada e saída no mesmo dia custam uma diária', () => {
    /* O animal ocupou a acomodação, e ela não pôde ser vendida. Zero diária não existe. */
    const orcamento = orcar({
      entrada: iso('2026-06-10', '08:00'),
      saida: iso('2026-06-10', '11:00'),
    })

    expect(orcamento.linhas[0]?.quantidade).toBe(1)
  })

  it('o porte não informado paga como médio', () => {
    expect(orcar({ porte: null }).linhas[0]?.valorUnitarioCentavos).toBe(10_000)
  })

  it('o acompanhante é uma linha própria, em percentual da diária dele', () => {
    const orcamento = orcar({ porteAcompanhante: 'pequeno' })
    const linha = orcamento.linhas.find((item) => item.kind === 'acompanhante')

    /* 70% de 8.900 = 6.230, por quatro diárias. */
    expect(linha).toMatchObject({ valorUnitarioCentavos: 6_230, quantidade: 4 })
    expect(orcamento.totalCentavos).toBe(40_000 + 24_920)
  })
})

describe('saída tardia', () => {
  it('não cobra nada até o horário de saída', () => {
    expect(cobrancaDaSaida(iso('2026-06-14', '12:00'), politica)).toBe(0)
    expect(orcar().linhas.some((linha) => linha.kind === 'meia-diaria')).toBe(false)
  })

  it('cobra meia diária entre o horário de saída e o limite', () => {
    expect(cobrancaDaSaida(iso('2026-06-14', '16:30'), politica)).toBe(50)

    const orcamento = orcar({ saida: iso('2026-06-14', '16:30') })
    const linha = orcamento.linhas.find((item) => item.kind === 'meia-diaria')

    expect(linha?.totalCentavos).toBe(5_000)
    expect(orcamento.totalCentavos).toBe(45_000)
  })

  it('cobra a diária inteira depois do limite', () => {
    expect(cobrancaDaSaida(iso('2026-06-14', '19:00'), politica)).toBe(100)
    expect(
      orcar({ saida: iso('2026-06-14', '19:00') }).linhas.find(
        (item) => item.kind === 'meia-diaria',
      )?.totalCentavos,
    ).toBe(10_000)
  })
})

describe('temporada', () => {
  const carnaval: Temporada = {
    id: 'temporada-carnaval',
    nome: 'Carnaval',
    inicio: '2026-06-12',
    fim: '2026-06-20',
    acrescimoPercentual: 25,
  }

  it('conta só os dias que caem dentro da faixa', () => {
    /*
     * Entrada dia 10, saída dia 14: pernoites nos dias 10, 11, 12 e 13. A faixa começa no 12, então
     * dois dias entram. Cobrar os quatro seria errar para mais no único mês que sustenta a margem —
     * pelo lado que perde o cliente.
     */
    expect(
      diariasEmTemporada(iso('2026-06-10', '09:00'), iso('2026-06-14', '10:00'), carnaval),
    ).toBe(2)
  })

  it('o acréscimo é linha separada, e não uma diária mais cara', () => {
    const orcamento = orcar({ temporadas: [carnaval] })
    const linha = orcamento.linhas.find((item) => item.kind === 'temporada')

    /* 25% de 10.000 = 2.500, por dois dias. */
    expect(linha).toMatchObject({ quantidade: 2, valorUnitarioCentavos: 2_500 })
    expect(orcamento.totalCentavos).toBe(45_000)
  })

  it('faixa fora do período não gera linha nenhuma', () => {
    const julho: Temporada = { ...carnaval, inicio: '2026-07-01', fim: '2026-07-31' }

    expect(orcar({ temporadas: [julho] }).linhas.some((item) => item.kind === 'temporada')).toBe(
      false,
    )
  })
})

describe('serviços', () => {
  it('o serviço por estadia é cobrado uma vez', () => {
    const orcamento = orcar({
      servicos: [
        { servicoId: 'servico-banho', quantidade: 1, precoUnitarioCentavos: 8_900, observacao: '' },
      ],
    })

    expect(orcamento.linhas.find((item) => item.kind === 'servico')).toMatchObject({
      servicoKind: 'banho',
      quantidade: 1,
      totalCentavos: 8_900,
    })
  })

  it('o serviço por diária multiplica pelo número de diárias', () => {
    const orcamento = orcar({
      servicos: [
        {
          servicoId: 'servico-passeio',
          quantidade: 1,
          precoUnitarioCentavos: 3_500,
          observacao: '',
        },
      ],
    })

    expect(orcamento.linhas.find((item) => item.kind === 'servico')).toMatchObject({
      quantidade: 4,
      totalCentavos: 14_000,
    })
  })

  it('o preço congelado na contratação manda sobre o reajuste de hoje', () => {
    /* O que foi combinado não muda porque a tabela mudou depois. */
    const orcamento = orcar({
      servicos: [
        { servicoId: 'servico-banho', quantidade: 1, precoUnitarioCentavos: 6_000, observacao: '' },
      ],
    })

    expect(orcamento.linhas.find((item) => item.kind === 'servico')?.totalCentavos).toBe(6_000)
  })
})

describe('sinal e saldo', () => {
  it('o sinal é percentual do total, e o saldo desconta o que já entrou', () => {
    const orcamento = orcar({ pagoCentavos: 12_000 })

    expect(orcamento.sinalCentavos).toBe(12_000)
    expect(orcamento.saldoCentavos).toBe(28_000)
  })

  it('o total é sempre a soma das linhas', () => {
    /* A invariante que sustenta a tela: um total que não bate com as linhas destrói a conversa. */
    const orcamento = orcar({
      porteAcompanhante: 'grande',
      saida: iso('2026-06-14', '17:00'),
      servicos: [
        { servicoId: 'servico-banho', quantidade: 2, precoUnitarioCentavos: 8_900, observacao: '' },
      ],
    })

    const soma = orcamento.linhas.reduce((total, linha) => total + linha.totalCentavos, 0)

    expect(orcamento.totalCentavos).toBe(soma)
  })
})
