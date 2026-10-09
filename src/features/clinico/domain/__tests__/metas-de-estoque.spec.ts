/**
 * Metas de estoque.
 *
 * O erro daqui não quebra tela: faz a gerência comemorar um mês que vai fechar abaixo, ou comprar
 * vacina para uma meta que já estava coberta pela geladeira. Os testes cobrem as decisões que mudam
 * o que alguém faz no dia seguinte — quando o mês é "no ritmo", quando o teto estourou, de onde sai
 * a sugestão e quanto o pedido manda comprar.
 */

import { describe, expect, it } from 'vitest'

import type { AplicacaoVacina, LoteDeVacina, PlanoDeEstoque, Vacina } from '../../data/types'
import { addDays } from '../clinic-time'
import type { LoteNoEstoque } from '../estoque-vacinas'
import {
  diasCorridos,
  diasNoMes,
  mesAnterior,
  mesSeguinte,
  pedidoDeCompra,
  progressoDaMeta,
  progressoDoPlano,
  projetar,
  realizadoNoMes,
  sugerirPlano,
} from '../metas-de-estoque'

/** Dia 10 de um mês de 31: um terço do mês corrido, que é quando a gerência olha o ritmo. */
const HOJE = '2026-10-10'

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

let sequencia = 0

function aplicacao(dia: string, patch: Partial<AplicacaoVacina> = {}): AplicacaoVacina {
  sequencia += 1

  return {
    id: `apl-${sequencia}`,
    petId: `pet-${sequencia}`,
    vacinaId: 'vac-v10',
    origem: 'clinica',
    professionalId: 'prof-ana',
    aplicadaEm: `${dia}T10:00:00-03:00`,
    lote: 'V10-A',
    validadeLote: addDays(HOJE, 300),
    dose: 1,
    dosesNaSerie: 3,
    via: 'subcutanea',
    proximaDoseEm: addDays(dia, 365),
    agendamentoDaProximaId: null,
    encounterId: null,
    externa: null,
    observacao: '',
    ...patch,
  }
}

function noEstoque(patch: Partial<LoteNoEstoque> = {}): LoteNoEstoque {
  return {
    id: 'lote-1',
    vacinaId: 'vac-v10',
    vacinaNome: 'V10',
    codigo: 'V10-A',
    fornecedor: 'PetSupply',
    recebidoEm: addDays(HOJE, -60),
    validade: addDays(HOJE, 300),
    quantidadeRecebida: 20,
    custoUnitario: 3390,
    aplicadas: 5,
    perdidas: 0,
    saldo: 15,
    situacao: 'ativo',
    diasParaVencer: 300,
    valorParado: 15 * 3390,
    ...patch,
  }
}

function plano(metas: PlanoDeEstoque['metas'], mes = '2026-10'): PlanoDeEstoque {
  return {
    mes,
    metas,
    baseadoEm: null,
    criadoPor: 'prof-ana',
    atualizadoEm: `${HOJE}T08:00:00-03:00`,
  }
}

describe('calendário', () => {
  it('vira o ano nas duas direções', () => {
    expect(mesSeguinte('2026-12')).toBe('2027-01')
    expect(mesAnterior('2027-01')).toBe('2026-12')
  })

  it('sabe o tamanho de fevereiro', () => {
    expect(diasNoMes('2028-02')).toBe(29)
    expect(diasNoMes('2026-02')).toBe(28)
  })

  it('separa mês fechado, em curso e futuro', () => {
    expect(diasCorridos('2026-09', HOJE)).toBe(30)
    expect(diasCorridos('2026-10', HOJE)).toBe(10)
    expect(diasCorridos('2026-11', HOJE)).toBe(0)
  })

  it('projeta pelo ritmo só no mês em curso', () => {
    /* 4 doses em 10 dias de um mês de 31: 12,4, que vira 12. */
    expect(projetar(4, '2026-10', HOJE)).toBe(12)
    expect(projetar(4, '2026-09', HOJE)).toBe(4)
  })
})

describe('realizado do mês', () => {
  it('conta só a dose daqui, e só a do mês', () => {
    const realizado = realizadoNoMes({
      mes: '2026-10',
      lotes: [],
      aplicacoes: [
        aplicacao('2026-10-02'),
        aplicacao('2026-10-09'),
        aplicacao('2026-09-30'),
        aplicacao('2026-10-05', { origem: 'externa', lote: null }),
      ],
    })

    expect(realizado.aplicacoes).toBe(2)
    expect(realizado.aplicacoesPorVacina['vac-v10']).toBe(2)
  })

  it('soma compra pela data de recebimento e perda pela data da baixa', () => {
    const realizado = realizadoNoMes({
      mes: '2026-10',
      aplicacoes: [],
      lotes: [
        lote({ recebidoEm: '2026-10-03', quantidadeRecebida: 6, custoUnitario: 3390 }),
        lote({
          id: 'lote-2',
          recebidoEm: '2026-08-01',
          perdas: [
            { em: '2026-10-04', quantidade: 2, motivo: 'quebra' },
            { em: '2026-09-04', quantidade: 5, motivo: 'temperatura' },
          ],
        }),
      ],
    })

    expect(realizado.comprasCentavos).toBe(6 * 3390)
    expect(realizado.perdas).toBe(2)
  })
})

describe('progresso', () => {
  const quatroAteODia10 = realizadoNoMes({
    mes: '2026-10',
    lotes: [],
    aplicacoes: [1, 3, 6, 9].map((dia) => aplicacao(`2026-10-0${dia}`)),
  })

  it('julga a meta de aplicação pelo ritmo enquanto o mês corre', () => {
    const noRitmo = progressoDaMeta(
      { id: 'm', tipo: 'aplicacoes', vacinaId: 'vac-v10', alvo: 12 },
      quatroAteODia10,
      HOJE,
    )
    const abaixo = progressoDaMeta(
      { id: 'm', tipo: 'aplicacoes', vacinaId: 'vac-v10', alvo: 15 },
      quatroAteODia10,
      HOJE,
    )

    expect(noRitmo.situacao).toBe('no-ritmo')
    expect(noRitmo.projecao).toBe(12)
    expect(abaixo.situacao).toBe('atencao')
  })

  it('não salva pelo ritmo o mês que já fechou', () => {
    const fechado = progressoDaMeta(
      { id: 'm', tipo: 'aplicacoes', vacinaId: null, alvo: 5 },
      { ...quatroAteODia10, mes: '2026-09' },
      HOJE,
    )

    expect(fechado.situacao).toBe('falhou')
  })

  it('estoura o teto na hora, sem esperar o fim do mês', () => {
    /*
     * Quatro doses perdidas no dia 3 não viram "no ritmo" diluídas em 31 dias: a perda chega em
     * bloco, e o teto já passou.
     */
    const realizado = { ...quatroAteODia10, perdas: 4 }
    const estourou = progressoDaMeta(
      { id: 'p', tipo: 'perdas', vacinaId: null, alvo: 3 },
      realizado,
      HOJE,
    )
    const perto = progressoDaMeta(
      { id: 'p', tipo: 'perdas', vacinaId: null, alvo: 5 },
      realizado,
      HOJE,
    )

    expect(estourou.situacao).toBe('falhou')
    expect(estourou.projecao).toBe(4)
    expect(perto.situacao).toBe('atencao')
  })

  it('cumpre o teto quando o mês fecha dentro dele', () => {
    const realizado = { ...quatroAteODia10, mes: '2026-09', perdas: 1 }

    expect(
      progressoDaMeta({ id: 'p', tipo: 'perdas', vacinaId: null, alvo: 2 }, realizado, HOJE)
        .situacao,
    ).toBe('cumprida')
  })

  it('põe o que falhou e o que pede atenção no topo', () => {
    const progresso = progressoDoPlano(
      plano([
        { id: 'a', tipo: 'aplicacoes', vacinaId: 'vac-v10', alvo: 2 },
        { id: 'b', tipo: 'aplicacoes', vacinaId: 'vac-v10', alvo: 30 },
        { id: 'c', tipo: 'perdas', vacinaId: null, alvo: 0 },
      ]),
      { ...quatroAteODia10, perdas: 1 },
      HOJE,
    )

    expect(progresso.map((item) => item.meta.id)).toEqual(['c', 'b', 'a'])
  })
})

describe('sugestão do próximo mês', () => {
  it('usa o maior entre o ritmo de agora e os reforços que vencem no mês', () => {
    const aplicacoes = [1, 3, 6, 9].map((dia) => aplicacao(`2026-10-0${dia}`))
    const base = {
      mesPlanejado: '2026-11',
      hoje: HOJE,
      lotes: [],
      aplicacoes,
      vacinas: [V10],
      orcamentoCentavos: 0,
    }

    const peloRitmo = sugerirPlano({ ...base, reforcos: [] })
    const pelosReforcos = sugerirPlano({
      ...base,
      reforcos: Array.from({ length: 18 }, (_, indice) => ({
        vacinaId: 'vac-v10',
        proximaDoseEm: `2026-11-${String(indice + 1).padStart(2, '0')}`,
      })),
    })

    expect(peloRitmo.referencias[0]?.sugestao).toBe(12)
    expect(pelosReforcos.referencias[0]?.sugestao).toBe(18)
    expect(pelosReforcos.mesBase).toBe('2026-10')
  })

  it('cai na média do trimestre quando a vacina não saiu neste mês', () => {
    const sugestao = sugerirPlano({
      mesPlanejado: '2026-11',
      hoje: HOJE,
      lotes: [],
      aplicacoes: [
        '2026-07-10',
        '2026-08-10',
        '2026-08-11',
        '2026-09-10',
        '2026-09-12',
        '2026-09-20',
      ].map((dia) => aplicacao(dia)),
      vacinas: [V10],
      reforcos: [],
      orcamentoCentavos: 0,
    })

    expect(sugestao.referencias[0]?.mediaDoTrimestre).toBe(2)
    expect(sugestao.referencias[0]?.sugestao).toBe(2)
  })

  it('não deixa um reforço solitário baixar a meta abaixo da média', () => {
    /*
     * O caso que motivou a regra dos três números: seis dias de outubro sem V10, um reforço
     * vencendo em novembro, e uma média de duas por mês. A meta não pode ser 1.
     */
    const sugestao = sugerirPlano({
      mesPlanejado: '2026-11',
      hoje: HOJE,
      lotes: [],
      aplicacoes: [
        '2026-07-10',
        '2026-08-10',
        '2026-08-11',
        '2026-09-10',
        '2026-09-12',
        '2026-09-20',
      ].map((dia) => aplicacao(dia)),
      vacinas: [V10],
      reforcos: [{ vacinaId: 'vac-v10', proximaDoseEm: '2026-11-05' }],
      orcamentoCentavos: 0,
    })

    expect(sugestao.referencias[0]?.sugestao).toBe(2)
  })

  it('propõe metade da perda como teto, e só põe orçamento quando há pedido', () => {
    const sugestao = sugerirPlano({
      mesPlanejado: '2026-11',
      hoje: HOJE,
      lotes: [lote({ perdas: [{ em: '2026-10-02', quantidade: 5, motivo: 'temperatura' }] })],
      aplicacoes: [],
      vacinas: [V10],
      reforcos: [],
      orcamentoCentavos: 0,
    })

    expect(sugestao.metas.find((meta) => meta.tipo === 'perdas')?.alvo).toBe(2)
    expect(sugestao.metas.some((meta) => meta.tipo === 'compras')).toBe(false)
  })
})

describe('pedido de compra', () => {
  it('fecha o mês no mínimo depois de aplicar a meta', () => {
    /*
     * Saldo 15; até o fim de outubro saem mais 8 (4 em 10 dias → 12 no mês); sobram 7. Meta de
     * novembro 12 + mínimo 10 − sobra 7 = 15.
     */
    const [linha] = pedidoDeCompra({
      mesPlanejado: '2026-11',
      hoje: HOJE,
      lotes: [noEstoque()],
      vacinas: [V10],
      metaPorVacina: { 'vac-v10': 12 },
      aplicadasNoMesAtual: { 'vac-v10': 4 },
    })

    expect(linha?.saidaAteVirar).toBe(8)
    expect(linha?.sobra).toBe(7)
    expect(linha?.comprar).toBe(15)
    expect(linha?.custoEstimado).toBe(15 * 3390)
  })

  it('não conta o lote que vence antes de o mês começar', () => {
    const [linha] = pedidoDeCompra({
      mesPlanejado: '2026-11',
      hoje: HOJE,
      lotes: [
        noEstoque({ validade: '2026-10-28', saldo: 9 }),
        noEstoque({ id: 'lote-2', saldo: 3 }),
      ],
      vacinas: [V10],
      metaPorVacina: {},
      aplicadasNoMesAtual: {},
    })

    expect(linha?.saldoUtil).toBe(3)
    expect(linha?.comprar).toBe(7)
  })

  it('nunca manda comprar negativo', () => {
    const [linha] = pedidoDeCompra({
      mesPlanejado: '2026-11',
      hoje: HOJE,
      lotes: [noEstoque({ saldo: 80 })],
      vacinas: [V10],
      metaPorVacina: { 'vac-v10': 5 },
      aplicadasNoMesAtual: {},
    })

    expect(linha?.comprar).toBe(0)
  })
})
