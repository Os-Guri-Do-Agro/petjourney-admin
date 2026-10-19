<script setup lang="ts">
/**
 * Saldo por vacina, contra o piso de cada uma — a lista de compras, desenhada.
 *
 * O gráfico existe porque **saldo sozinho não decide compra**. Nove doses é folga de sobra para
 * a FeLV e falta para a antirrábica, e uma tabela de saldos obriga a pessoa a comparar cada
 * número com um piso que está escrito em outra coluna. Aqui o piso é uma marca dentro da
 * própria barra: a comparação vira uma olhada em vez de doze.
 *
 * Quatro escolhas:
 *
 * - **A cor aqui é estado, não identidade.** Cada barra é uma vacina, mas o que ela precisa
 *   dizer é "compre" ou "não compre" — então ela veste a paleta de risco e atenção, e não a
 *   paleta de séries. Dar cor de identidade a cada vacina gastaria o canal da cor repintando o
 *   que o nome ao lado já diz.
 * - **A marca do piso é um `goal`, não uma anotação.** A anotação do Apex é por eixo: valeria a
 *   mesma linha para as seis barras, e o piso é diferente em cada uma. O `goal` anda com o
 *   ponto.
 * - **O número fica fora da barra.** Dentro, a vacina zerada — barra de zero pixel — esconderia
 *   justamente o próprio valor, que é o mais importante da tela.
 * - **Cor nunca sozinha.** O estado vai no ícone e no texto da dica, e a tabela de lotes
 *   embaixo repete tudo em palavra. Quem não distingue as duas cores continua lendo a tela.
 */
import type { ApexAxisChartSeries, ApexFormatterOpts, ApexOptions } from 'apexcharts'
import { computed } from 'vue'

import { useClinicChartTheme } from '../../composables/useClinicChartTheme'
import type { SaldoDaVacina } from '../../domain/estoque-vacinas'
import VueApexCharts from '../charts/apex'

const props = defineProps<{
  saldos: SaldoDaVacina[]
  legenda: {
    /** Nome da marca do piso na dica: "mínimo". */
    minimo: string
    doses: string
    /** Texto por situação, já traduzido. */
    zerado: string
    abaixo: string
    ok: string
    /** "cobertura de {dias} d" — o formatador recebe os dias. */
    cobertura: (dias: number | null) => string
  }
  vazio: string
}>()

const tema = useClinicChartTheme()

const ALTURA_DA_LINHA = 38
const ALTURA_DA_MOLDURA = 30
const ALTURA_DA_BARRA = '56%'

/**
 * Meia altura da marca do piso, **em pixels**.
 *
 * O Apex desenha a marca com `sHeight * 2` de altura, e `strokeHeight` é medida em pixel — não
 * em fração da barra, por mais que o nome sugira. A primeira versão passou `1.4` achando que
 * era proporção e desenhou um tracinho de menos de três pixels: a marca sumiu e o gráfico
 * perdeu, em silêncio, a comparação que ele existe para fazer.
 *
 * 13 px dá 26 de altura sobre uma barra de ~21 (56% da linha de 38). O transbordo é de
 * propósito: quando o saldo é muito menor que o piso, a marca cai sobre o trilho vazio, e uma
 * marca da altura exata da barra desapareceria contra ele.
 */
const MEIA_MARCA_DO_PISO = 13

const altura = computed(() => props.saldos.length * ALTURA_DA_LINHA + ALTURA_DA_MOLDURA)

/**
 * O Apex desenha a primeira categoria embaixo. Os saldos já chegam do mais urgente para o mais
 * folgado, então a ordem é invertida aqui para o que falta comprar ficar no topo.
 */
const ordenados = computed(() => [...props.saldos].reverse())

function corDaSituacao(situacao: SaldoDaVacina['situacao']): string {
  const cor = tema.cor.value

  if (situacao === 'zerado') {
    return cor['risk-text']
  }

  return situacao === 'abaixo' ? cor['attention-text'] : cor['accent-strong']
}

/**
 * A tinta da marca do piso, escolhida contra o **fundo onde ela cai**.
 *
 * Uma cor fixa não serve, e isso só apareceu ao olhar a tela nos dois temas. A marca cai sobre
 * a barra quando o saldo cobre o piso, e sobre o trilho vazio quando não cobre — e barra e
 * trilho trocam de claridade entre o tema claro e o escuro: no claro a barra é escura e o
 * trilho é quase branco, no escuro é o contrário. Tinta única acertava um dos dois e sumia no
 * outro, justamente no caso que importa, que é a marca sobre o trilho de uma vacina em falta.
 *
 * Sobre a barra, a tinta é a da superfície; sobre o trilho, a do texto. Nos dois temas.
 */
function corDaMarca(item: SaldoDaVacina): string {
  const cor = tema.cor.value

  return item.minimo <= item.saldo ? cor.surface : cor.text
}

/**
 * Um ponto por vacina, cada um com a própria cor e o próprio alvo.
 *
 * A forma `{ x, y, goals, fillColor }` é o que permite cor por barra sem inventar uma série por
 * vacina — seis séries de um ponto cada desenhariam seis legendas para uma pergunta só.
 */
const series = computed<ApexAxisChartSeries>(() => [
  {
    name: props.legenda.doses,
    data: ordenados.value.map((item) => ({
      x: item.nome,
      y: item.saldo,
      fillColor: corDaSituacao(item.situacao),
      goals: [
        {
          name: props.legenda.minimo,
          value: item.minimo,
          strokeHeight: MEIA_MARCA_DO_PISO,
          strokeWidth: 3,
          strokeDashArray: 0,
          strokeColor: corDaMarca(item),
        },
      ],
    })),
  },
])

function textoDaSituacao(situacao: SaldoDaVacina['situacao']): string {
  return props.legenda[situacao]
}

const opcoes = computed<ApexOptions>(() => {
  const cor = tema.cor.value

  return {
    chart: { ...tema.grafico.value, type: 'bar', height: altura.value, stacked: false },
    grid: {
      ...tema.grade.value,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: false } },
      /* O recuo à direita é o que abre espaço para o número na ponta da barra mais longa. */
      padding: { top: -10, right: 56, bottom: -10, left: 10 },
    },
    legend: { show: false },
    states: tema.estados.value,
    fill: { opacity: 1 },
    plotOptions: {
      bar: {
        horizontal: true,
        barHeight: ALTURA_DA_BARRA,
        borderRadius: 4,
        borderRadiusApplication: 'end',
        colors: {
          /* Trilho: sem ele a barra da vacina zerada não tem onde ser vista. */
          backgroundBarColors: [cor['surface-sunken']],
          backgroundBarOpacity: 1,
          backgroundBarRadius: 4,
        },
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
      /*
       * O rótulo lê o saldo do dado e não o valor que o Apex passa.
       *
       * Com `goals` no ponto, o formatador recebe o alvo em algumas passagens de desenho — e a
       * barra da vacina zerada chegava a escrever o próprio mínimo como se fosse o saldo.
       */
      formatter: (_valor: string | number | number[], opts?: ApexFormatterOpts) =>
        String(ordenados.value[opts?.dataPointIndex ?? 0]?.saldo ?? 0),
    },
    xaxis: {
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: tema.rotuloDeEixo.value,
        formatter: (valor: string) => String(Math.round(Number(valor))),
      },
      crosshairs: { show: false },
      tooltip: { enabled: false },
    },
    yaxis: {
      labels: {
        maxWidth: 170,
        align: 'left',
        style: { ...tema.rotuloDeEixo.value, colors: cor.text },
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
          const item = ordenados.value[opts?.dataPointIndex ?? 0]

          if (!item) {
            return String(valor)
          }

          return [
            `${item.saldo} ${props.legenda.doses}`,
            `${props.legenda.minimo}: ${item.minimo}`,
            textoDaSituacao(item.situacao),
            props.legenda.cobertura(item.coberturaEmDias),
          ].join(' · ')
        },
        title: { formatter: () => '' },
      },
    },
  }
})
</script>

<template>
  <div class="saldo">
    <p v-if="saldos.length === 0" class="saldo__vazio">{{ vazio }}</p>

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
.saldo__vazio {
  margin: 0;
  padding: 8px 0;
  color: var(--tinta-2);
  font-size: 14px;
}
</style>
