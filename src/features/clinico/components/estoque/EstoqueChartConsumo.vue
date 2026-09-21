<script setup lang="ts">
/**
 * Doses aplicadas por mês, empilhadas por vacina.
 *
 * É o gráfico que responde **quanto comprar**. Saldo diz o que tem; só o giro diz se isso é
 * muito ou pouco — e giro de vacina não é reto: campanha de antirrábica, ninhada de filhote no
 * fim do ano, mês de viagem. Um número único de "média mensal" esconde exatamente as ondas que
 * decidem a compra do trimestre.
 *
 * Quatro decisões de leitura:
 *
 * - **Empilhado, e não uma linha por vacina.** A pergunta de cima é o total do mês — é ele que
 *   se compara com o saldo. Seis linhas soltas obrigam a somar de cabeça o que a pilha já soma.
 * - **O total vai escrito no topo da coluna.** Medir altura contra a grade é impreciso, e em
 *   impressão preto e branco a pilha inteira vira um bloco cinza. Os rótulos por segmento
 *   ficariam ilegíveis num mês de três doses — por isso só o total.
 * - **A cor da vacina vem da posição dela no catálogo.** Não do tamanho da fatia: se viesse do
 *   ranking, o mês em que a V10 passa a antirrábica trocaria as duas de cor e a leitura de uma
 *   semana não valeria para a seguinte.
 * - **Mês sem saída fica zerado, não some.** O buraco no meio da série é informação: foi o mês
 *   em que a clínica não vacinou.
 *
 * A legenda é clicável — isolar uma vacina é como se lê a sazonalidade dela sozinha.
 */
import type { ApexAxisChartSeries, ApexOptions } from 'apexcharts'
import { computed } from 'vue'

import { useClinicChartTheme } from '../../composables/useClinicChartTheme'
import type { MesDeConsumo } from '../../domain/estoque-vacinas'
import VueApexCharts from '../charts/apex'

const props = defineProps<{
  meses: MesDeConsumo[]
  /** As vacinas do catálogo, **na ordem do catálogo** — é ela que fixa a cor de cada série. */
  vacinas: Array<{ id: string; nome: string }>
  /** Rótulo curto de cada mês, na mesma ordem. */
  rotulos: string[]
  /** Nome da unidade na dica: "doses". */
  unidade: string
  vazio: string
}>()

const tema = useClinicChartTheme()

const ALTURA = 300

const totalGeral = computed(() => props.meses.reduce((total, mes) => total + mes.total, 0))

/**
 * Teto do eixo, mínimo de 4 e sempre par.
 *
 * Um mês de duas doses não deve desenhar uma coluna de altura inteira — pareceria movimento
 * cheio —, e escala ímpar espalha os tiques em números quebrados.
 */
const maximo = computed(() => {
  const maior = props.meses.reduce((topo, mes) => Math.max(topo, mes.total), 0)

  return Math.max(4, Math.ceil(maior / 2) * 2)
})

/**
 * Só as vacinas que tiveram saída no período entram na legenda.
 *
 * Uma série inteira zerada não desenha nada e mesmo assim ocupa uma linha da legenda com uma
 * cor que não aparece em lugar nenhum do gráfico — é a forma mais rápida de fazer alguém
 * procurar uma faixa que não existe. **A cor continua vindo do índice no catálogo**, então
 * esconder a vacina que não saiu não repinta as que ficaram.
 */
const visiveis = computed(() =>
  props.vacinas
    .map((vacina, indice) => ({ vacina, cor: tema.serie.value[indice] }))
    .filter(({ vacina }) => props.meses.some((mes) => (mes.porVacina[vacina.id] ?? 0) > 0)),
)

const series = computed<ApexAxisChartSeries>(() =>
  visiveis.value.map(({ vacina }) => ({
    name: vacina.nome,
    data: props.meses.map((mes) => mes.porVacina[vacina.id] ?? 0),
  })),
)

/**
 * A categoria é o **rótulo já formatado**, e não a chave `YYYY-MM`.
 *
 * O gráfico de colunas do resumo faz o contrário — lá a categoria é a data ISO e um formatador
 * traduz —, e por bom motivo: em trinta dias o rótulo "seg" se repete quatro vezes e alguns
 * vêm vazios, então a categoria precisa ser uma chave que case com um dia só.
 *
 * Aqui o caso é outro. Doze meses seguidos dão doze rótulos únicos, e a volta pelo formatador
 * só acrescentou um jeito de errar: enquanto os rótulos não chegavam, a reserva do mapa era a
 * própria chave, e o eixo desenhava `2025-10` em vez de `out/25` — sem quebrar nada, sem avisar
 * ninguém, e parecendo escolha de projeto. Com o rótulo como categoria não há reserva para cair.
 */
const categorias = computed(() =>
  props.meses.map((mes, indice) => props.rotulos[indice] || mes.mes),
)

const opcoes = computed<ApexOptions>(() => {
  const cor = tema.cor.value

  return {
    chart: { ...tema.grafico.value, type: 'bar', height: ALTURA, stacked: true },
    colors: visiveis.value.map((item) => item.cor ?? cor['accent-strong']),
    grid: tema.grade.value,
    legend: tema.legenda.value,
    states: tema.estados.value,
    fill: { opacity: 1 },
    /*
     * Traço da cor da superfície entre os segmentos.
     *
     * É o respiro de dois pixels que impede duas vacinas vizinhas de se lerem como uma faixa
     * só quando as duas saíram pouco no mesmo mês.
     */
    stroke: { show: true, width: 2, colors: [cor.surface] },
    dataLabels: { enabled: false },
    plotOptions: {
      bar: {
        columnWidth: '56%',
        borderRadius: 4,
        borderRadiusApplication: 'end',
        dataLabels: {
          total: {
            enabled: true,
            offsetY: -4,
            formatter: (valor?: string) => (Number(valor) > 0 ? String(valor) : ''),
            style: {
              color: cor.muted,
              fontFamily: tema.fonte.value.familia,
              fontSize: tema.fonte.value.rotulo,
              fontWeight: 800,
            },
          },
        },
      },
    },
    xaxis: {
      type: 'category',
      categories: categorias.value,
      tickPlacement: 'on',
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        hideOverlappingLabels: false,
        trim: false,
        rotate: 0,
        style: {
          fontFamily: tema.fonte.value.familia,
          fontSize: tema.fonte.value.rotulo,
          fontWeight: 700,
          colors: cor.muted,
        },
      },
      crosshairs: { show: true, stroke: { color: cor['line-strong'], width: 1, dashArray: 3 } },
      tooltip: { enabled: false },
    },
    yaxis: {
      min: 0,
      max: maximo.value,
      tickAmount: Math.min(4, maximo.value),
      forceNiceScale: false,
      labels: {
        style: tema.rotuloDeEixo.value,
        formatter: (valor: number) => String(Math.round(valor)),
      },
    },
    tooltip: {
      ...tema.dica.value,
      shared: true,
      intersect: false,
      /* Vacina sem saída no mês some da dica: doze linhas com "0" enterram as que têm valor. */
      hideEmptySeries: true,
      y: { formatter: (valor: number) => `${valor ?? 0} ${props.unidade}` },
    },
  }
})
</script>

<template>
  <figure class="consumo">
    <p v-if="totalGeral === 0" class="consumo__vazio">{{ vazio }}</p>

    <VueApexCharts
      v-else
      type="bar"
      :height="ALTURA"
      :options="opcoes"
      :series="series"
      width="100%"
    />
  </figure>
</template>

<style scoped>
.consumo {
  margin: 0;
}

.consumo__vazio {
  margin: 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}
</style>
