<script setup lang="ts">
/**
 * A prateleira no tempo: cada lote, do recebimento ao vencimento.
 *
 * É a única visão que responde **qual frasco abrir primeiro**. Uma tabela ordenada por validade
 * dá a mesma ordem, mas não mostra a coisa que decide a compra: a **sobreposição**. Dois lotes
 * da mesma vacina vencendo na mesma janela é dinheiro comprado duas vezes; um vão entre o fim de
 * um lote e a chegada do seguinte é a semana em que a clínica vai recusar vacinação.
 *
 * Quatro decisões:
 *
 * - **A barra vai do recebimento ao vencimento, não de hoje ao vencimento.** O comprimento é a
 *   prateleira que o lote tinha; cortando no dia de hoje, um lote de dois anos e um de três
 *   meses desenhariam o mesmo traço.
 * - **A linha de hoje atravessa o gráfico.** É ela que separa o que já passou do que ainda dá
 *   para usar — sem ela, a barra do lote vencido não se distingue da do lote novo.
 * - **A cor é estado, e vem acompanhada.** Vencido, a vencer, ativo e esgotado usam a paleta de
 *   significado; o saldo em doses vai escrito **dentro da barra** e a situação por extenso vai
 *   na dica. Quem não separa as duas cores lê a mesma coisa pelo número.
 * - **O rótulo do eixo é o código do lote.** É por ele que a farmacovigilância pergunta e é o
 *   que está impresso no frasco que a pessoa tem na mão.
 */
import type { ApexAxisChartSeries, ApexFormatterOpts, ApexOptions } from 'apexcharts'
import { computed } from 'vue'

import { useClinicChartTheme } from '../../composables/useClinicChartTheme'
import type { LoteNoEstoque, SituacaoDoLote } from '../../domain/estoque-vacinas'
import VueApexCharts from '../charts/apex'

const props = defineProps<{
  lotes: LoteNoEstoque[]
  hoje: string
  legenda: {
    hoje: string
    doses: string
    /** Situação por extenso, já traduzida. */
    situacao: Record<SituacaoDoLote, string>
  }
  vazio: string
}>()

const tema = useClinicChartTheme()

const ALTURA_DA_LINHA = 30
const ALTURA_DA_MOLDURA = 46

const altura = computed(() => props.lotes.length * ALTURA_DA_LINHA + ALTURA_DA_MOLDURA)

/**
 * Por validade, do que vence antes para o que vence depois — que é a ordem de uso.
 *
 * A lista chega do domínio ordenada por **urgência** (vencido, a vencer, ativo, esgotado), que é
 * a ordem certa para uma fila de tarefas e a errada para uma linha do tempo: as barras subiriam
 * e desceriam no eixo do tempo e a leitura em diagonal — que é o que uma linha do tempo oferece
 * de graça — desapareceria. Invertido no fim porque o Apex desenha a primeira categoria embaixo.
 */
const ordenados = computed(() =>
  [...props.lotes].sort((a, b) => a.validade.localeCompare(b.validade)).reverse(),
)

function corDaSituacao(situacao: SituacaoDoLote): string {
  const cor = tema.cor.value

  if (situacao === 'vencido') {
    return cor['risk-text']
  }

  if (situacao === 'vencendo') {
    return cor['attention-text']
  }

  /*
   * Esgotado é cinza de propósito: não pede ação nenhuma, só continua existindo no registro.
   *
   * `faint`, e não `line-strong`. A cor de linha é quase branca no tema claro e quase preta no
   * escuro, e o saldo escrito dentro da barra desaparecia contra ela nos dois — o "0" do lote
   * vazio, que é justamente o que a barra cinza está ali para dizer. `faint` é meio-tom nos dois
   * temas, e a mesma tinta do rótulo continua legível sobre ela.
   */
  return situacao === 'esgotado' ? cor.faint : cor['accent-strong']
}

const series = computed<ApexAxisChartSeries>(() => [
  {
    name: props.legenda.doses,
    data: ordenados.value.map((lote) => ({
      x: lote.codigo,
      y: [Date.parse(`${lote.recebidoEm}T00:00:00Z`), Date.parse(`${lote.validade}T00:00:00Z`)],
      fillColor: corDaSituacao(lote.situacao),
    })),
  },
])

const opcoes = computed<ApexOptions>(() => {
  const cor = tema.cor.value

  return {
    chart: { ...tema.grafico.value, type: 'rangeBar', height: altura.value },
    grid: {
      ...tema.grade.value,
      xaxis: { lines: { show: true } },
      yaxis: { lines: { show: false } },
      padding: { top: -8, right: 10, bottom: -8, left: 10 },
    },
    legend: { show: false },
    states: tema.estados.value,
    fill: { opacity: 1 },
    plotOptions: {
      bar: {
        horizontal: true,
        barHeight: '54%',
        borderRadius: 4,
        /*
         * `around` e não `end`: a barra tem começo **e** fim próprios — não nasce de uma linha
         * de base —, e arredondar só a ponta direita deixaria o canto de chegada do lote
         * quadrado contra o de saída redondo.
         */
        borderRadiusApplication: 'around',
        rangeBarGroupRows: false,
      },
    },
    /*
     * O saldo dentro da barra.
     *
     * É o segundo canal do estado, e o que faz a tela continuar legível em escala de cinza: a
     * barra cinza com "0" é esgotada, a barra com "6" à esquerda da linha de hoje é o lote que
     * venceu com dose dentro — o prejuízo.
     */
    dataLabels: {
      enabled: true,
      textAnchor: 'middle',
      style: {
        fontFamily: tema.fonte.value.familia,
        fontSize: tema.fonte.value.rotulo,
        fontWeight: 800,
        colors: [cor['on-accent']],
      },
      background: { enabled: false },
      formatter: (_valor: string | number | number[], opts?: ApexFormatterOpts) =>
        String(ordenados.value[opts?.dataPointIndex ?? 0]?.saldo ?? 0),
    },
    xaxis: {
      type: 'datetime',
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: tema.rotuloDeEixo.value,
        datetimeUTC: true,
        /* Mês e ano: dia a dia num eixo de quase três anos vira uma régua ilegível. */
        format: 'MMM/yy',
      },
      crosshairs: { show: false },
      tooltip: { enabled: false },
    },
    yaxis: {
      labels: {
        maxWidth: 110,
        align: 'left',
        style: { ...tema.rotuloDeEixo.value, colors: cor.text },
      },
    },
    annotations: {
      xaxis: [
        {
          x: Date.parse(`${props.hoje}T00:00:00Z`),
          borderColor: cor['accent-deep'],
          strokeDashArray: 4,
          label: {
            text: props.legenda.hoje,
            borderColor: 'transparent',
            position: 'top',
            /*
             * Deitado. A marca de eixo vertical do Apex nasce com o texto em pé, e uma palavra
             * girada noventa graus atravessando a primeira barra é mais difícil de ler do que a
             * própria linha tracejada já dizia.
             */
            orientation: 'horizontal',
            offsetY: -4,
            style: {
              background: cor['accent-tint'],
              color: cor['accent-strong'],
              fontFamily: tema.fonte.value.familia,
              fontSize: tema.fonte.value.rotulo,
              fontWeight: 750,
              padding: { left: 6, right: 6, top: 2, bottom: 2 },
            },
          },
        },
      ],
    },
    tooltip: {
      ...tema.dica.value,
      shared: false,
      intersect: true,
      marker: { show: false },
      x: { show: false },
      /*
       * A dica é escrita inteira à mão.
       *
       * A padrão de um `rangeBar` mostra o par de datas cru em milissegundos formatados, e o que
       * a pessoa precisa saber aqui é outra coisa: qual vacina, quantas doses sobraram e em que
       * estado o lote está.
       */
      custom: ({ dataPointIndex }: { dataPointIndex: number }) => {
        const lote = ordenados.value[dataPointIndex]

        if (!lote) {
          return ''
        }

        const linhas = [
          `${lote.codigo} · ${lote.vacinaNome}`,
          `${lote.saldo} ${props.legenda.doses} · ${props.legenda.situacao[lote.situacao]}`,
        ]

        return `<div class="clinic-chart-dica">${linhas
          .map((linha) => `<span>${linha}</span>`)
          .join('')}</div>`
      },
    },
  }
})
</script>

<template>
  <div class="validade">
    <p v-if="lotes.length === 0" class="validade__vazio">{{ vazio }}</p>

    <VueApexCharts
      v-else
      type="rangeBar"
      :height="altura"
      :options="opcoes"
      :series="series"
      width="100%"
    />
  </div>
</template>

<style scoped>
.validade__vazio {
  margin: 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}
</style>
