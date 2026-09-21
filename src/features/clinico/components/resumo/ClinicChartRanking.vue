<script setup lang="ts">
/**
 * Ranking em barras horizontais, desenhado com ApexCharts.
 *
 * Barra horizontal em vez de rosca: comparar fatias de um donut é notoriamente impreciso, e o
 * nome de cada item — "Márcia Do Espírito Santo Albuquerque", "Doença mixomatosa da valva
 * mitral" — não cabe em legenda de gráfico circular sem virar sopa de cores.
 *
 * Três escolhas de leitura:
 *
 * - **O número fica fora da barra, não dentro.** Dentro, o primeiro colocado lê bem e o último
 *   — barra de dez pixels — esconde o próprio valor. Fora, todos leem igual, e é o último
 *   colocado que costuma ser a informação nova.
 * - **A escala é relativa ao primeiro colocado.** Comparar entre si é o ponto de um ranking; o
 *   percentual do total vai junto do número, para quem precisa do peso absoluto.
 * - **A altura acompanha a quantidade de itens.** Altura fixa com três itens desenha barras
 *   gordas e vazio embaixo; com dez, esmaga tudo.
 */
import type { ApexAxisChartSeries, ApexFormatterOpts, ApexOptions } from 'apexcharts'
import { computed } from 'vue'
import VueApexCharts from '../charts/apex'

import { useClinicChartTheme } from '../../composables/useClinicChartTheme'
import type { Fatia } from '../../domain/resumo'

const props = withDefaults(
  defineProps<{
    fatias: Fatia[]
    /** Sufixo do valor: "atendimentos", "casos". Vazio mostra só o número. */
    unidade?: string
    tom?: 'acento' | 'atencao'
    vazio?: string
  }>(),
  { unidade: '', tom: 'acento', vazio: '' },
)

const tema = useClinicChartTheme()

const ALTURA_DA_LINHA = 34
const ALTURA_DA_MOLDURA = 26

const altura = computed(() => props.fatias.length * ALTURA_DA_LINHA + ALTURA_DA_MOLDURA)

/**
 * O Apex desenha a primeira categoria embaixo. Como as fatias já chegam do maior para o menor,
 * a ordem é invertida aqui para o primeiro colocado ficar no topo.
 */
const ordenadas = computed(() => [...props.fatias].reverse())

/**
 * Valores e categorias vão separados de propósito.
 *
 * A forma `{ x, y }` também funciona, mas em barra horizontal o Apex inverte os eixos por
 * dentro e passa a tratar o `x` do dado como valor. Com `xaxis.categories` a divisão é
 * explícita: a categoria é o nome, o número é o dado.
 */
const series = computed<ApexAxisChartSeries>(() => [
  { name: props.unidade, data: ordenadas.value.map((fatia) => fatia.valor) },
])

const categorias = computed(() => ordenadas.value.map((fatia) => fatia.rotulo))

/**
 * O percentual vem do índice do ponto, não de uma busca pelo rótulo desenhado.
 *
 * Dois diagnósticos podem ter a mesma descrição vinda de bases diferentes, e o rótulo do eixo
 * chega truncado quando é longo — nos dois casos a busca por texto pegaria a fatia errada.
 */
function porcentagem(indice: number): string {
  return `${Math.round((ordenadas.value[indice]?.parte ?? 0) * 100)}%`
}

const opcoes = computed<ApexOptions>(() => {
  const cor = tema.cor.value
  const barra = props.tom === 'atencao' ? cor['attention-text'] : cor['accent-strong']

  return {
    chart: { ...tema.grafico.value, type: 'bar', height: altura.value, stacked: false },
    colors: [barra],
    grid: {
      ...tema.grade.value,
      /* Num ranking a grade vertical é ruído: o que se compara é comprimento, não valor exato. */
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: false } },
      /*
       * `left` **não** pode ser zero, por mais que não haja grade a afastar.
       *
       * É esta folga que abriga o rótulo do eixo. Zerada, o Apex encosta a coluna de nomes na
       * borda do SVG e a primeira letra de cada rótulo longo fica do lado de fora — o corte
       * aparecia só em inglês, porque em português os nomes cabiam antes do limite e nunca
       * chegavam à borda ("Chronic kidney disease" virava "hronic kidney disease").
       */
      padding: { top: -14, right: 44, bottom: -14, left: 10 },
    },
    legend: { show: false },
    states: tema.estados.value,
    fill: { opacity: 1 },
    plotOptions: {
      bar: {
        horizontal: true,
        barHeight: '58%',
        borderRadius: 4,
        borderRadiusApplication: 'end',
        colors: {
          /* Trilho: sem ele a barra curta flutua e some contra o fundo do cartão. */
          backgroundBarColors: [cor['surface-sunken']],
          backgroundBarOpacity: 1,
          backgroundBarRadius: 4,
        },
        /*
         * `top`, em barra horizontal, é a ponta da barra. E `hideOverflowingLabels` precisa
         * ficar desligado: o primeiro colocado ocupa a largura inteira e o Apex esconderia
         * justamente o número dele — o recuo à direita na grade é que abre o espaço.
         */
        dataLabels: { position: 'top', hideOverflowingLabels: false },
      },
    },
    dataLabels: {
      enabled: true,
      textAnchor: 'start',
      offsetX: 8,
      offsetY: 1,
      style: {
        fontFamily: tema.fonte.value.familia,
        fontSize: tema.fonte.value.rotulo,
        fontWeight: 800,
        colors: [cor.text],
      },
      background: { enabled: false },
      formatter: (valor: string | number | number[], opts?: ApexFormatterOpts) =>
        `${valor}  ${porcentagem(opts?.dataPointIndex ?? 0)}`,
    },
    xaxis: {
      type: 'category',
      categories: categorias.value,
      axisBorder: { show: false },
      axisTicks: { show: false },
      /* O eixo de valor não aparece: o número já está na ponta de cada barra. */
      labels: { show: false },
      crosshairs: { show: false },
      tooltip: { enabled: false },
    },
    yaxis: {
      labels: {
        /*
         * Nome longo é a regra aqui, não a exceção. O corte em 150 px mantém a coluna de barras
         * começando no mesmo lugar nos dois cartões lado a lado; o nome inteiro fica na dica.
         */
        maxWidth: 150,
        align: 'left',
        style: {
          ...tema.rotuloDeEixo.value,
          colors: cor.text,
        },
      },
    },
    tooltip: {
      ...tema.dica.value,
      shared: false,
      intersect: true,
      marker: { show: false },
      x: { show: true },
      y: {
        formatter: (valor: number, opts?: ApexFormatterOpts) => {
          const numero = props.unidade ? `${valor} ${props.unidade}` : String(valor)

          return `${numero} · ${porcentagem(opts?.dataPointIndex ?? 0)}`
        },
        title: { formatter: () => '' },
      },
    },
  }
})
</script>

<template>
  <div class="ranking">
    <p v-if="fatias.length === 0" class="ranking__vazio">{{ vazio }}</p>

    <VueApexCharts
      v-else
      type="bar"
      :height="altura"
      :options="opcoes"
      :series="series"
      width="100%"
    />
  </div>
</template>

<style scoped>
.ranking__vazio {
  margin: 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}
</style>
