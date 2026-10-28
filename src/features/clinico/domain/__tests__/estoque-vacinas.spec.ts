/**
 * Estoque de vacinas.
 *
 * O modo de falhar daqui é financeiro e silencioso: nenhuma conta errada neste arquivo quebra
 * tela nenhuma, só faz a clínica comprar o que já tinha, ou descobrir no dia que acabou. Os
 * testes cobrem as quatro decisões que custam dinheiro — quanto sobrou, o que vence antes de
 * sair, o que falta comprar e quanto já virou descarte.
 */

import { describe, expect, it } from 'vitest'

import type { AplicacaoVacina, LoteDeVacina, Vacina } from '../../data/types'
import { addDays } from '../clinic-time'
import {
  JANELA_DE_VALIDADE_EM_DIAS,
  resumirEstoque,
  situacaoDoLote,
  type EntradaDoEstoque,
} from '../estoque-vacinas'

const HOJE = '2026-09-02'

const V10: Vacina = {
  id: 'vac-v10',
  nome: 'V10',
  fabricante: 'Zoetis',
  especies: ['canina'],
  dosesNaSerie: 3,
  dosesAdultoSemHistorico: 2,
  idadeMinimaDias: 42,
  essencial: true,
  vias: ['subcutanea'],
  intervaloReforcoDias: 365,
  obrigatoria: false,
  estoqueMinimo: 10,
}

const ANTIRRABICA: Vacina = {
  id: 'vac-antirrabica-canina',
  nome: 'Antirrábica',
  fabricante: 'Boehringer',
  especies: ['canina', 'felina'],
  dosesNaSerie: 1,
  dosesAdultoSemHistorico: 1,
  idadeMinimaDias: 42,
  essencial: true,
  vias: ['subcutanea'],
  intervaloReforcoDias: 365,
  obrigatoria: true,
  estoqueMinimo: 12,
}

function lote(patch: Partial<LoteDeVacina> = {}): LoteDeVacina {
  return {
    id: 'lote-1',
    vacinaId: 'vac-v10',
    codigo: 'V10-A',
    fornecedor: 'Fornecedor',
    recebidoEm: addDays(HOJE, -120),
    validade: addDays(HOJE, 300),
    quantidadeRecebida: 20,
    custoUnitario: 3000,
    perdas: [],
    ...patch,
  }
}

function aplicacao(patch: Partial<AplicacaoVacina> = {}): AplicacaoVacina {
  return {
    id: 'apl-1',
    petId: 'pet-luna',
    vacinaId: 'vac-v10',
    origem: 'clinica',
    professionalId: 'prof-ana',
    aplicadaEm: `${HOJE}T10:00:00-04:00`,
    lote: 'V10-A',
    validadeLote: addDays(HOJE, 300),
    dose: 1,
    dosesNaSerie: 3,
    via: 'subcutanea',
    proximaDoseEm: addDays(HOJE, 28),
    agendamentoDaProximaId: null,
    encounterId: null,
    externa: null,
    observacao: '',
    ...patch,
  }
}

describe('dose externa', () => {
  it('não gasta frasco daqui nem entra no giro', () => {
    /*
     * A V10 que o filhote tomou no pet shop está na carteira dele, mas não saiu desta geladeira.
     * Contá-la no consumo faria a clínica comprar para um giro que não é o dela.
     */
    const externa = aplicacao({
      id: 'apl-fora',
      origem: 'externa',
      professionalId: '',
      lote: null,
      validadeLote: null,
    })
    const semExterna = resumir({ lotes: [lote()], aplicacoes: [aplicacao()] })
    const comExterna = resumir({ lotes: [lote()], aplicacoes: [aplicacao(), externa] })

    expect(comExterna.lotes[0]?.saldo).toBe(semExterna.lotes[0]?.saldo)
    expect(ultimoMes(comExterna).total).toBe(ultimoMes(semExterna).total)
  })
})

/** O mês corrente: o último ponto da janela. Sem `Array.at`, que o alvo do teste não tem. */
function ultimoMes(resumo: ReturnType<typeof resumir>) {
  return resumo.consumo[resumo.consumo.length - 1]!
}

function resumir(patch: Partial<EntradaDoEstoque> = {}) {
  return resumirEstoque({
    lotes: [lote()],
    vacinas: [V10, ANTIRRABICA],
    aplicacoes: [],
    hoje: HOJE,
    ...patch,
  })
}

describe('situação do lote', () => {
  it('lote dentro da validade e com dose é ativo', () => {
    expect(situacaoDoLote(addDays(HOJE, 200), 5, HOJE)).toBe('ativo')
  })

  it('entra em "a vencer" ao cruzar a janela de aviso', () => {
    expect(situacaoDoLote(addDays(HOJE, JANELA_DE_VALIDADE_EM_DIAS + 1), 5, HOJE)).toBe('ativo')
    expect(situacaoDoLote(addDays(HOJE, JANELA_DE_VALIDADE_EM_DIAS), 5, HOJE)).toBe('vencendo')
  })

  it('lote vencido **com dose dentro** é vencido, não esgotado', () => {
    /* É o prejuízo da tela: frasco pago, nunca faturado. Some se virar "esgotado". */
    expect(situacaoDoLote(addDays(HOJE, -1), 4, HOJE)).toBe('vencido')
  })

  it('lote vencido e vazio é só esgotado', () => {
    /* Já foi todo usado antes de vencer: não há prejuízo nenhum a apontar. */
    expect(situacaoDoLote(addDays(HOJE, -1), 0, HOJE)).toBe('esgotado')
  })

  it('lote sem saldo não entra em "a vencer"', () => {
    /*
     * Frasco vazio não tem o que ser usado primeiro. Avisar a validade dele empurraria para
     * baixo da lista justamente os lotes que ainda dava para salvar.
     */
    expect(situacaoDoLote(addDays(HOJE, 10), 0, HOJE)).toBe('esgotado')
  })
})

describe('saldo do lote', () => {
  it('conta a saída pelas aplicações que citam o código do lote', () => {
    const { lotes } = resumir({
      aplicacoes: [aplicacao({ id: 'a' }), aplicacao({ id: 'b' })],
    })

    expect(lotes[0]!.aplicadas).toBe(2)
    expect(lotes[0]!.saldo).toBe(18)
  })

  it('ignora aplicação de outro código, mesmo sendo da mesma vacina', () => {
    /* Dose de antes do controle de estoque: existe na carteira, não sai deste lote. */
    const { lotes } = resumir({ aplicacoes: [aplicacao({ lote: 'L2024-999' })] })

    expect(lotes[0]!.aplicadas).toBe(0)
    expect(lotes[0]!.saldo).toBe(20)
  })

  it('desconta a perda junto com a aplicação', () => {
    const { lotes } = resumir({
      lotes: [lote({ perdas: [{ em: HOJE, quantidade: 3, motivo: 'temperatura' }] })],
      aplicacoes: [aplicacao()],
    })

    expect(lotes[0]!.perdidas).toBe(3)
    expect(lotes[0]!.saldo).toBe(16)
  })

  it('nunca fecha com saldo negativo', () => {
    /*
     * Código digitado à mão pode gerar mais saída do que o lote recebeu. O saldo negativo
     * entraria somando ao contrário no total da clínica, e o painel mostraria menos doses do
     * que existem sem ninguém entender por quê.
     */
    const aplicacoes = Array.from({ length: 25 }, (_, i) => aplicacao({ id: `a-${i}` }))
    const { lotes, indicadores } = resumir({ aplicacoes })

    expect(lotes[0]!.saldo).toBe(0)
    expect(indicadores.dosesEmEstoque).toBe(0)
  })

  it('o valor parado é o saldo vezes o custo unitário, em centavos', () => {
    const { lotes } = resumir({ aplicacoes: [aplicacao()] })

    expect(lotes[0]!.valorParado).toBe(19 * 3000)
  })
})

describe('saldo por vacina', () => {
  function saldoDe(resumo: ReturnType<typeof resumir>, vacinaId: string) {
    return resumo.saldos.find((item) => item.vacinaId === vacinaId)!
  }

  it('soma os lotes da mesma vacina', () => {
    const resumo = resumir({
      lotes: [lote(), lote({ id: 'lote-2', codigo: 'V10-B', quantidadeRecebida: 5 })],
    })

    expect(saldoDe(resumo, 'vac-v10').saldo).toBe(25)
  })

  it('lote vencido fica fora do saldo que aplica, mas segue no valor parado', () => {
    /* Na geladeira até o descarte, mas não vacina ninguém: não pode segurar a vacina "em nível". */
    const resumo = resumir({
      lotes: [lote(), lote({ id: 'l-vencido', codigo: 'V10-V', validade: addDays(HOJE, -3) })],
    })

    expect(saldoDe(resumo, 'vac-v10').saldo).toBe(20)
    expect(saldoDe(resumo, 'vac-v10').valorParado).toBe(40 * 3000)
  })

  it('vacina sem lote nenhum aparece zerada, e não some', () => {
    /* É a pior notícia do estoque: uma vacina do catálogo que a clínica deixou acabar. */
    const resumo = resumir()

    expect(saldoDe(resumo, 'vac-antirrabica-canina').saldo).toBe(0)
    expect(saldoDe(resumo, 'vac-antirrabica-canina').situacao).toBe('zerado')
  })

  it('marca abaixo do mínimo sem chamar de zerado', () => {
    /* São duas conversas: uma é "compre esta semana", a outra é "já perdeu venda hoje". */
    const resumo = resumir({ lotes: [lote({ quantidadeRecebida: 4 })] })

    expect(saldoDe(resumo, 'vac-v10').situacao).toBe('abaixo')
  })

  it('a cobertura em dias sai do consumo real da janela', () => {
    /* 12 doses em 12 meses = 1 por mês; 20 em estoque cobrem 600 dias no mesmo ritmo. */
    const aplicacoes = Array.from({ length: 12 }, (_, i) =>
      aplicacao({ id: `a-${i}`, lote: 'outro', aplicadaEm: `${addDays(HOJE, -i * 30)}T10:00:00Z` }),
    )
    const resumo = resumir({ aplicacoes })

    expect(saldoDe(resumo, 'vac-v10').consumoMensal).toBe(1)
    expect(saldoDe(resumo, 'vac-v10').coberturaEmDias).toBe(600)
  })

  it('sem consumo na janela a cobertura é nula, e não infinita', () => {
    /*
     * Dividir por zero escreveria "cobertura de ∞ dias" para um frasco parado há um ano — que é
     * exatamente o oposto do que aconteceu com ele.
     */
    expect(saldoDe(resumir(), 'vac-v10').coberturaEmDias).toBeNull()
  })

  it('ordena pelo que precisa ser comprado primeiro', () => {
    const resumo = resumir({ lotes: [lote({ quantidadeRecebida: 4 })] })

    /* Antirrábica está zerada; a V10 está abaixo do mínimo. Zerado vem antes. */
    expect(resumo.saldos.map((item) => item.situacao)).toEqual(['zerado', 'abaixo'])
  })
})

describe('consumo mensal', () => {
  it('devolve a janela inteira, com o mês sem saída zerado', () => {
    const resumo = resumir({ meses: 3 })

    expect(resumo.consumo).toHaveLength(3)
    expect(resumo.consumo.every((mes) => mes.total === 0)).toBe(true)
  })

  it('termina no mês de hoje e vai do mais antigo para o mais novo', () => {
    const resumo = resumir({ meses: 3 })

    expect(ultimoMes(resumo).mes).toBe(HOJE.slice(0, 7))
    expect([...resumo.consumo].sort((a, b) => a.mes.localeCompare(b.mes))).toEqual(resumo.consumo)
  })

  it('separa as doses por vacina dentro do mês', () => {
    const resumo = resumir({
      meses: 2,
      aplicacoes: [
        aplicacao({ id: 'a' }),
        aplicacao({ id: 'b', vacinaId: 'vac-antirrabica-canina' }),
      ],
    })
    const mes = ultimoMes(resumo)

    expect(mes.porVacina['vac-v10']).toBe(1)
    expect(mes.porVacina['vac-antirrabica-canina']).toBe(1)
    expect(mes.total).toBe(2)
  })

  it('deixa de fora a aplicação mais velha que a janela', () => {
    const resumo = resumir({
      meses: 2,
      aplicacoes: [aplicacao({ aplicadaEm: `${addDays(HOJE, -400)}T10:00:00Z` })],
    })

    expect(resumo.consumo.reduce((total, mes) => total + mes.total, 0)).toBe(0)
  })

  it('ignora aplicação de vacina fora do catálogo', () => {
    /* Entraria como uma série sem nome na legenda do gráfico. */
    const resumo = resumir({ meses: 2, aplicacoes: [aplicacao({ vacinaId: 'vac-sumida' })] })

    expect(ultimoMes(resumo).total).toBe(0)
  })
})

describe('indicadores', () => {
  it('só conta como "a vencer" o lote que ainda tem dose', () => {
    const resumo = resumir({
      lotes: [
        lote({ validade: addDays(HOJE, 10) }),
        lote({ id: 'lote-2', codigo: 'V10-B', validade: addDays(HOJE, 10), quantidadeRecebida: 0 }),
      ],
    })

    expect(resumo.indicadores.lotesVencendo).toBe(1)
    expect(resumo.indicadores.dosesVencendo).toBe(20)
    expect(resumo.indicadores.valorEmRisco).toBe(20 * 3000)
  })

  it('a taxa de perda é sobre o que entrou, não sobre o que sobrou', () => {
    const resumo = resumir({
      lotes: [lote({ perdas: [{ em: HOJE, quantidade: 4, motivo: 'quebra' }] })],
      aplicacoes: [aplicacao()],
    })

    /* 4 perdidas de 20 recebidas: a aplicação não muda o denominador. */
    expect(resumo.indicadores.dosesPerdidas).toBe(4)
    expect(resumo.indicadores.perdaPercentual).toBeCloseTo(0.2)
  })

  it('sem lote nenhum a taxa de perda é zero, e não NaN', () => {
    expect(resumir({ lotes: [] }).indicadores.perdaPercentual).toBe(0)
  })

  it('agrupa a perda por motivo, do maior para o menor', () => {
    const resumo = resumir({
      lotes: [
        lote({
          perdas: [
            { em: HOJE, quantidade: 1, motivo: 'quebra' },
            { em: HOJE, quantidade: 5, motivo: 'temperatura' },
            { em: HOJE, quantidade: 2, motivo: 'quebra' },
          ],
        }),
      ],
    })

    expect(resumo.perdasPorMotivo).toEqual([
      { motivo: 'temperatura', doses: 5 },
      { motivo: 'quebra', doses: 3 },
    ])
  })
})

describe('ordenação dos lotes', () => {
  it('urgência primeiro; dentro dela, o que vence antes', () => {
    const resumo = resumir({
      lotes: [
        lote({ id: 'l-ativo', codigo: 'A', validade: addDays(HOJE, 300) }),
        lote({ id: 'l-vencido', codigo: 'B', validade: addDays(HOJE, -5) }),
        lote({ id: 'l-vence-depois', codigo: 'C', validade: addDays(HOJE, 50) }),
        lote({ id: 'l-vence-antes', codigo: 'D', validade: addDays(HOJE, 20) }),
      ],
    })

    expect(resumo.lotes.map((item) => item.codigo)).toEqual(['B', 'D', 'C', 'A'])
  })
})
