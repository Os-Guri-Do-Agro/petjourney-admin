/**
 * Os gráficos do estoque desenham com o dado que o protótipo produz.
 *
 * `vue-tsc` valida o template contra os tipos e não prova que o gráfico **monta**: opção de
 * ApexCharts com nome errado, tipo de gráfico não importado em `charts/apex.ts` e chave de
 * tradução que resolve para um objeto passam pelos tipos e só falham na tela. Aqui os três
 * componentes são montados com o dataset de verdade.
 *
 * O que se afirma é o contrato de leitura, não o desenho: que a série carrega o número certo, que
 * a cor de cada vacina vem da **posição no catálogo** — e não do tamanho da fatia —, e que o
 * estado vazio aparece em vez de um gráfico de nada.
 */

import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it } from 'vitest'

import i18n from '@/i18n'

import { setMockConfig } from '../../../data/mock-runtime'
import { vacinaRepository } from '../../../data/repositories'
import { resetDataset } from '../../../data/store'
import { resumirEstoque, type ResumoDoEstoque } from '../../../domain/estoque-vacinas'
import { vacinasFixture } from '../../../data/fixtures'
import { getDataset } from '../../../data/store'
import { clinicClock } from '../../../stores/clinico'
import EstoqueChartConsumo from '../EstoqueChartConsumo.vue'
import EstoqueChartSaldo from '../EstoqueChartSaldo.vue'
import EstoqueChartValidade from '../EstoqueChartValidade.vue'

const COM_I18N = { plugins: [i18n, PrimeVue] }

const LEGENDA_SALDO = {
  minimo: 'Mínimo',
  doses: 'doses',
  zerado: 'Acabou',
  abaixo: 'Abaixo do mínimo',
  ok: 'Em nível',
  cobertura: (dias: number | null) => (dias === null ? 'sem saída' : `cobertura de ${dias} d`),
}

const LEGENDA_VALIDADE = {
  hoje: 'Hoje',
  doses: 'doses',
  situacao: {
    vencido: 'Vencido',
    vencendo: 'A vencer',
    ativo: 'Ativo',
    esgotado: 'Esgotado',
  },
}

let estoque: ResumoDoEstoque

beforeEach(() => {
  setActivePinia(createPinia())
  resetDataset()
  setMockConfig({ latenciaMs: 0, jitterMs: 0 })

  const dataset = getDataset()

  estoque = resumirEstoque({
    lotes: dataset.lotesDeVacina,
    vacinas: vacinasFixture,
    aplicacoes: dataset.aplicacoesDeVacina,
    hoje: clinicClock.today(),
  })
})

describe('consumo mensal', () => {
  function montar(patch: Record<string, unknown> = {}) {
    return mount(EstoqueChartConsumo, {
      global: COM_I18N,
      attachTo: document.body,
      props: {
        meses: estoque.consumo,
        vacinas: vacinaRepository.catalogo(),
        rotulos: estoque.consumo.map((mes) => mes.mes),
        unidade: 'doses',
        vazio: 'Nenhuma dose aplicada no período.',
        ...patch,
      },
    })
  }

  it('monta com o dataset do protótipo', () => {
    expect(montar().find('.consumo').exists()).toBe(true)
  })

  it('uma série por vacina que teve saída, e nenhuma zerada', () => {
    /*
     * Série inteiramente zerada não desenha nada e mesmo assim ocupa uma linha da legenda com
     * uma cor que não aparece no gráfico — é a forma mais rápida de fazer alguém procurar uma
     * faixa que não existe.
     */
    const series = montar().findComponent({ name: 'apexchart' }).props('series') as Array<{
      name: string
      data: number[]
    }>

    expect(series.length).toBeGreaterThan(1)
    expect(series.every((serie) => serie.data.some((valor) => valor > 0))).toBe(true)
  })

  it('a soma da série bate com o total do domínio', () => {
    const series = montar().findComponent({ name: 'apexchart' }).props('series') as Array<{
      data: number[]
    }>
    const somado = series.reduce(
      (total, serie) => total + serie.data.reduce((soma, valor) => soma + valor, 0),
      0,
    )

    expect(somado).toBe(estoque.consumo.reduce((total, mes) => total + mes.total, 0))
  })

  it('esconder a vacina sem saída não repinta as que ficaram', () => {
    /*
     * A afirmação que protege a leitura entre semanas. A série zerada sai da legenda — ela não
     * desenha nada e só faria alguém procurar uma faixa que não existe —, e a cor de cada uma
     * das restantes continua vindo da **posição no catálogo**, não da posição na legenda. Se a
     * cor viesse do ranking, o mês em que a V10 passa a antirrábica trocaria as duas de cor.
     */
    const catalogo = vacinaRepository.catalogo()
    const cores = (wrapper: ReturnType<typeof montar>) =>
      (wrapper.findComponent({ name: 'apexchart' }).props('options') as { colors: string[] }).colors
    const nomes = (wrapper: ReturnType<typeof montar>) =>
      (wrapper.findComponent({ name: 'apexchart' }).props('series') as Array<{ name: string }>).map(
        (serie) => serie.name,
      )

    const cheio = montar()

    /* A primeira vacina do catálogo perde toda a saída do período. */
    const primeira = catalogo[0]!
    const zerada = montar({
      meses: estoque.consumo.map((mes) => ({
        ...mes,
        porVacina: { ...mes.porVacina, [primeira.id]: 0 },
      })),
    })

    expect(nomes(cheio)).toContain(primeira.nome)
    expect(nomes(zerada)).not.toContain(primeira.nome)

    /* Cada vacina que sobrou continua com a cor que já tinha. */
    for (const [indice, nome] of nomes(zerada).entries()) {
      expect(cores(zerada)[indice], nome).toBe(cores(cheio)[nomes(cheio).indexOf(nome)])
    }
  })

  it('sem saída nenhuma, mostra o texto e não um gráfico vazio', () => {
    const wrapper = montar({
      meses: estoque.consumo.map((mes) => ({ ...mes, total: 0, porVacina: {} })),
    })

    expect(wrapper.find('.consumo__vazio').text()).toBe('Nenhuma dose aplicada no período.')
    expect(wrapper.findComponent({ name: 'apexchart' }).exists()).toBe(false)
  })
})

describe('saldo contra o mínimo', () => {
  function montar(patch: Record<string, unknown> = {}) {
    return mount(EstoqueChartSaldo, {
      global: COM_I18N,
      attachTo: document.body,
      props: { saldos: estoque.saldos, legenda: LEGENDA_SALDO, vazio: 'Sem lotes', ...patch },
    })
  }

  it('monta com o dataset do protótipo', () => {
    expect(montar().find('.saldo').exists()).toBe(true)
  })

  it('cada barra carrega o próprio piso como alvo', () => {
    /*
     * É o que a anotação de eixo não faria: ela valeria a mesma linha para as seis barras, e o
     * piso é diferente em cada vacina.
     */
    const series = montar().findComponent({ name: 'apexchart' }).props('series') as Array<{
      data: Array<{ x: string; y: number; goals: Array<{ value: number }> }>
    }>
    const pontos = series[0]!.data

    expect(pontos).toHaveLength(estoque.saldos.length)

    for (const ponto of pontos) {
      const saldo = estoque.saldos.find((item) => item.nome === ponto.x)!

      expect(ponto.y, ponto.x).toBe(saldo.saldo)
      expect(ponto.goals[0]!.value, ponto.x).toBe(saldo.minimo)
    }
  })

  it('a vacina zerada e a em nível não recebem a mesma cor', () => {
    /* A cor aqui é estado — "compre" ou "não compre" —, e é o que a barra de zero precisa dizer. */
    const series = montar().findComponent({ name: 'apexchart' }).props('series') as Array<{
      data: Array<{ x: string; fillColor: string }>
    }>
    const pontos = series[0]!.data
    const corDe = (situacao: string) =>
      pontos.find(
        (ponto) => estoque.saldos.find((item) => item.nome === ponto.x)!.situacao === situacao,
      )?.fillColor

    expect(corDe('zerado')).toBeDefined()
    expect(corDe('ok')).toBeDefined()
    expect(corDe('zerado')).not.toBe(corDe('ok'))
  })

  it('o rótulo escreve o saldo, e não o mínimo', () => {
    /*
     * Com `goals` no ponto, o formatador do Apex recebe o alvo em algumas passagens de desenho —
     * e a barra da vacina zerada chegou a escrever o próprio mínimo como se fosse o saldo.
     */
    const opcoes = montar().findComponent({ name: 'apexchart' }).props('options') as {
      dataLabels: { formatter: (valor: number, opts: { dataPointIndex: number }) => string }
    }
    const ordenados = [...estoque.saldos].reverse()

    for (const [indice, item] of ordenados.entries()) {
      expect(opcoes.dataLabels.formatter(item.minimo, { dataPointIndex: indice })).toBe(
        String(item.saldo),
      )
    }
  })

  it('sem vacina nenhuma, mostra o texto', () => {
    expect(montar({ saldos: [] }).find('.saldo__vazio').text()).toBe('Sem lotes')
  })
})

describe('validade dos lotes', () => {
  function montar(patch: Record<string, unknown> = {}) {
    return mount(EstoqueChartValidade, {
      global: COM_I18N,
      attachTo: document.body,
      props: {
        lotes: estoque.lotes,
        hoje: clinicClock.today(),
        legenda: LEGENDA_VALIDADE,
        vazio: 'Sem lotes',
        ...patch,
      },
    })
  }

  it('monta com o dataset do protótipo', () => {
    expect(montar().find('.validade').exists()).toBe(true)
  })

  it('cada barra vai do recebimento ao vencimento', () => {
    /* Cortar em hoje faria um lote de dois anos e um de três meses desenharem o mesmo traço. */
    const series = montar().findComponent({ name: 'apexchart' }).props('series') as Array<{
      data: Array<{ x: string; y: [number, number] }>
    }>

    expect(series[0]!.data).toHaveLength(estoque.lotes.length)

    for (const ponto of series[0]!.data) {
      const lote = estoque.lotes.find((item) => item.codigo === ponto.x)!

      expect(ponto.y[0], ponto.x).toBe(Date.parse(`${lote.recebidoEm}T00:00:00Z`))
      expect(ponto.y[1], ponto.x).toBe(Date.parse(`${lote.validade}T00:00:00Z`))
      expect(ponto.y[1], ponto.x).toBeGreaterThan(ponto.y[0])
    }
  })

  it('ordena pelo tempo, e não pela urgência que o domínio entrega', () => {
    /*
     * A lista chega ordenada por urgência, que é a ordem certa para uma fila de tarefas e a
     * errada para uma linha do tempo: as barras subiriam e desceriam no eixo do tempo.
     * O Apex desenha a primeira categoria embaixo, então a série vai do mais tarde para o
     * mais cedo.
     */
    const series = montar().findComponent({ name: 'apexchart' }).props('series') as Array<{
      data: Array<{ y: [number, number] }>
    }>
    const fins = series[0]!.data.map((ponto) => ponto.y[1])

    expect([...fins].sort((a, b) => b - a)).toEqual(fins)
  })

  it('marca hoje sobre o gráfico', () => {
    /* Sem a linha, a barra do lote vencido não se distingue da do lote novo. */
    const opcoes = montar().findComponent({ name: 'apexchart' }).props('options') as {
      annotations: { xaxis: Array<{ x: number }> }
    }

    expect(opcoes.annotations.xaxis[0]!.x).toBe(Date.parse(`${clinicClock.today()}T00:00:00Z`))
  })

  it('a dica nomeia o lote, o saldo e a situação por extenso', () => {
    /*
     * A dica padrão de um `rangeBar` mostra o par de datas cru. E é a palavra ao lado do número
     * que mantém a tela legível para quem não separa as duas cores.
     */
    const opcoes = montar().findComponent({ name: 'apexchart' }).props('options') as {
      tooltip: { custom: (ctx: { dataPointIndex: number }) => string }
    }
    const texto = opcoes.tooltip.custom({ dataPointIndex: 0 })
    const ultimoAVencer = [...estoque.lotes].sort((a, b) => a.validade.localeCompare(b.validade))[
      estoque.lotes.length - 1
    ]!

    expect(texto).toContain(ultimoAVencer.codigo)
    expect(texto).toContain(ultimoAVencer.vacinaNome)
    expect(texto).toContain(LEGENDA_VALIDADE.situacao[ultimoAVencer.situacao])
  })

  it('sem lote nenhum, mostra o texto', () => {
    expect(montar({ lotes: [] }).find('.validade__vazio').text()).toBe('Sem lotes')
  })
})
