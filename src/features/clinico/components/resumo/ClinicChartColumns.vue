<script setup lang="ts">
/**
 * Colunas empilhadas por dia, com a linha de ocupação por cima — desenhadas com ApexCharts.
 *
 * A versão anterior era CSS puro e SVG na mão. Funcionava, mas parava onde um painel começa a
 * ser útil: não tinha dica ao passar o mouse, não dava para isolar uma série clicando na
 * legenda e o eixo de ocupação não existia — a linha flutuava sem escala ao lado.
 *
 * Quatro decisões que sobreviveram à troca de biblioteca, porque são de leitura e não de
 * desenho:
 *
 * - **Cada coluna mostra o próprio total.** Barra sem número obriga a medir com o olho contra a
 *   grade, e em impressão preto e branco some. Aqui isso é
 *   `plotOptions.bar.dataLabels.total`, que roda mesmo com `dataLabels.enabled: false` — os
 *   rótulos por segmento ficariam ilegíveis numa faixa de dois atendimentos.
 * - **A ocupação é linha em eixo próprio, não barra.** É uma taxa, não uma contagem: na mesma
 *   escala, "80%" competiria visualmente com "8 atendimentos". O eixo da direita vai de 0 a
 *   100% e diz isso em voz alta.
 * - **A linha quebra no dia fechado.** O valor vai como `null`, não como zero: unir a linha por
 *   cima de um feriado desenharia movimento onde a clínica estava de portas fechadas, e um zero
 *   afundaria a média visual do período.
 * - **Traço reto, nunca suavizado.** Curva entre dois dias inventa um caminho que ninguém
 *   mediu.
 *
 * O dia fechado é marcado três vezes de propósito — fundo rebaixado na coluna, rótulo mais
 * apagado no eixo e a palavra na dica — porque nenhuma das três sozinha sobrevive a impressão
 * em escala de cinza.
 */
import type { ApexAxisChartSeries, ApexOptions, ApexYAxis } from 'apexcharts'
import { computed } from 'vue'
import VueApexCharts from '../charts/apex'

import { useClinicFormat } from '../../composables/useClinicFormat'
import { misturar, useClinicChartTheme } from '../../composables/useClinicChartTheme'
import type { PontoDoDia } from '../../domain/resumo'

const props = withDefaults(
  defineProps<{
    pontos: PontoDoDia[]
    /** Rótulo curto de cada coluna, na mesma ordem dos pontos. Vazio esconde o rótulo. */
    rotulos: string[]
    legenda: {
      finalizados: string
      previstos: string
      faltas: string
      ocupacao: string
      fechado: string
    }
    /** Dia em destaque — normalmente hoje. */
    destaque?: string
    /** Texto da marca sobre o dia em destaque. Vazio desenha só a linha. */
    rotuloDestaque?: string
    mostrarOcupacao?: boolean
  }>(),
  { destaque: '', rotuloDestaque: '', mostrarOcupacao: true },
)

const tema = useClinicChartTheme()
const formato = useClinicFormat()

const ALTURA = 300

/**
 * Teto do eixo de contagem.
 *
 * Mínimo de 4 e sempre múltiplo de 4: um dia com um atendimento não deve virar uma coluna de
 * altura inteira, e com quatro intervalos o teto múltiplo de 4 dá marcas inteiras sem depender do
 * formatador do eixo (que o Apex 7 ignora nas barras puras — "28.5" no eixo).
 */
const maximo = computed(() => {
  const maior = props.pontos.reduce(
    (topo, ponto) => Math.max(topo, ponto.finalizados + ponto.previstos + ponto.faltas),
    0,
  )

  return Math.max(4, Math.ceil(maior / 4) * 4)
})

/**
 * A categoria é a data ISO, não o rótulo curto.
 *
 * Em trinta dias o rótulo se repete ("seg" quatro vezes) e às vezes é vazio; a anotação do dia
 * de hoje e o texto da dica precisam de uma chave que case com um dia só. O que a pessoa lê no
 * eixo continua vindo de `rotulos`, pelo formatador.
 */
const categorias = computed(() =>
  /*
   * Nas barras puras o rótulo vai pronto na categoria: o Apex 7 não aplica o formatador do eixo x
   * quando o gráfico não tem série de linha, e o dia saía como "2026-09-28". A dica acha o dia
   * pelo índice do ponto, então rótulo repetido ou vazio não atrapalha.
   */
  props.mostrarOcupacao ? props.pontos.map((ponto) => ponto.data) : props.rotulos,
)

const rotuloPorData = computed(
  () => new Map(props.pontos.map((ponto, indice) => [ponto.data, props.rotulos[indice] ?? ''])),
)

const pontoPorData = computed(() => new Map(props.pontos.map((ponto) => [ponto.data, ponto])))

/** Misto (colunas + linha) só quando a ocupação entra; sem ela, barras puras. */
const tipo = computed(() => (props.mostrarOcupacao ? 'line' : 'bar'))

const series = computed<ApexAxisChartSeries>(() => {
  const contagens: ApexAxisChartSeries = [
    {
      name: props.legenda.finalizados,
      type: 'column',
      data: props.pontos.map((ponto) => ponto.finalizados),
    },
    {
      name: props.legenda.previstos,
      type: 'column',
      data: props.pontos.map((ponto) => ponto.previstos),
    },
    {
      name: props.legenda.faltas,
      type: 'column',
      data: props.pontos.map((ponto) => ponto.faltas),
    },
  ]

  /*
   * Sem a linha, o gráfico é de barras puro e as séries não declaram tipo. Num gráfico misto sem
   * nenhuma série de linha o Apex deixava de aplicar os formatadores dos dois eixos — o dia saía
   * como "2026-09-28" e a escala como "28.5".
   */
  if (!props.mostrarOcupacao) {
    return contagens.map(({ name, data }) => ({ name, data }))
  }

  return [
    ...contagens,
    {
      name: props.legenda.ocupacao,
      type: 'line',
      data: props.pontos.map((ponto) =>
        ponto.fechado ? null : Math.round(Math.min(1, ponto.ocupacao) * 100),
      ),
    },
  ]
})

const opcoes = computed<ApexOptions>(() => {
  const cor = tema.cor.value
  const contagem: ApexYAxis = {
    seriesName: props.legenda.finalizados,
    min: 0,
    max: maximo.value,
    tickAmount: Math.min(4, maximo.value),
    forceNiceScale: false,
    labels: {
      style: tema.rotuloDeEixo.value,
      formatter: (valor: number) => String(Math.round(valor)),
    },
  }

  const eixos: ApexYAxis[] = [contagem, { ...contagem, show: false }, { ...contagem, show: false }]

  if (props.mostrarOcupacao) {
    eixos.push({
      seriesName: props.legenda.ocupacao,
      opposite: true,
      min: 0,
      max: 100,
      tickAmount: 4,
      forceNiceScale: false,
      labels: {
        style: { ...tema.rotuloDeEixo.value, colors: cor['attention-text'] },
        formatter: (valor: number) => `${Math.round(valor)}%`,
      },
    })
  }

  return {
    chart: { ...tema.grafico.value, type: tipo.value, height: ALTURA, stacked: true },
    /* Previsto é a marca meio apagada: o que ainda vai acontecer lê mais leve que o concluído. */
    colors: [
      cor['accent-strong'],
      misturar(cor.accent, cor.surface, 0.45),
      cor['risk-text'],
      cor['attention-text'],
    ],
    grid: tema.grade.value,
    legend: tema.legenda.value,
    states: tema.estados.value,
    stroke: {
      /* Zero nas colunas: contorno em barra empilhada vira uma linha entre dois segmentos. */
      width: props.mostrarOcupacao ? [0, 0, 0, 2.5] : [0, 0, 0],
      curve: 'straight',
      lineCap: 'round',
    },
    fill: { opacity: 1 },
    markers: {
      size: props.mostrarOcupacao ? [0, 0, 0, 4] : [0, 0, 0],
      strokeColors: cor.surface,
      strokeWidth: 2,
      hover: { sizeOffset: 2 },
    },
    dataLabels: { enabled: false },
    plotOptions: {
      bar: {
        columnWidth: props.pontos.length > 12 ? '76%' : '52%',
        borderRadius: 4,
        borderRadiusApplication: 'end',
        colors: {
          /*
           * Fundo do dia fechado. Vem daqui e não de uma anotação porque a barra de fundo do
           * Apex já tem a largura e o arredondamento da coluna — uma faixa desenhada por cima
           * teria que redescobrir os dois a cada redimensionamento.
           */
          backgroundBarColors: props.pontos.map((ponto) =>
            ponto.fechado ? cor['surface-sunken'] : 'transparent',
          ),
          backgroundBarOpacity: 1,
          backgroundBarRadius: 4,
        },
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
        /* Os rótulos já chegam rareados pela página; deixar o Apex esconder de novo abriria buracos. */
        hideOverlappingLabels: false,
        showDuplicates: true,
        trim: false,
        rotate: 0,
        style: {
          fontFamily: tema.fonte.value.familia,
          fontSize: tema.fonte.value.rotulo,
          fontWeight: 700,
          colors: props.pontos.map((ponto) => {
            if (ponto.data === props.destaque) {
              return cor['accent-strong']
            }

            return ponto.fechado ? cor.faint : cor.muted
          }),
        },
        formatter: (valor: string | number) => rotuloPorData.value.get(String(valor)) ?? '',
      },
      crosshairs: { show: true, stroke: { color: cor['line-strong'], width: 1, dashArray: 3 } },
      tooltip: { enabled: false },
    },
    yaxis: props.mostrarOcupacao ? eixos : { ...contagem, seriesName: undefined },
    annotations: {
      /*
       * Nas barras puras o dia de hoje se marca só pelo rótulo na cor da marca: a anotação do Apex
       * desenhava uma linha atravessando a coluna e o "Hoje" em pé, por cima dos números.
       */
      xaxis:
        props.mostrarOcupacao && props.destaque && pontoPorData.value.has(props.destaque)
          ? [
              {
                x: props.destaque,
                strokeDashArray: 0,
                borderColor: cor.accent,
                label: props.rotuloDestaque
                  ? {
                      text: props.rotuloDestaque,
                      borderColor: 'transparent',
                      position: 'top',
                      offsetY: -6,
                      style: {
                        background: cor['accent-tint'],
                        color: cor['accent-strong'],
                        fontFamily: tema.fonte.value.familia,
                        fontSize: tema.fonte.value.rotulo,
                        fontWeight: 750,
                        padding: { left: 6, right: 6, top: 2, bottom: 2 },
                      },
                    }
                  : undefined,
              },
            ]
          : [],
    },
    tooltip: {
      ...tema.dica.value,
      shared: true,
      intersect: false,
      hideEmptySeries: false,
      x: {
        formatter: (valor: string | number, opts?: { dataPointIndex?: number }) => {
          const ponto = props.mostrarOcupacao
            ? pontoPorData.value.get(String(valor))
            : props.pontos[opts?.dataPointIndex ?? -1]
          if (!ponto) {
            return String(valor)
          }

          const titulo = formato.dataLonga(ponto.data)

          return ponto.fechado ? `${titulo} · ${props.legenda.fechado}` : titulo
        },
      },
      y: props.mostrarOcupacao
        ? [
            { formatter: (valor: number) => String(valor ?? 0) },
            { formatter: (valor: number) => String(valor ?? 0) },
            { formatter: (valor: number) => String(valor ?? 0) },
            { formatter: (valor: number) => (valor === null ? '—' : `${valor}%`) },
          ]
        : { formatter: (valor: number) => String(valor ?? 0) },
    },
  }
})
</script>

<template>
  <figure class="colunas">
    <VueApexCharts :type="tipo" :height="ALTURA" :options="opcoes" :series="series" width="100%" />
  </figure>
</template>

<style scoped>
.colunas {
  margin: 0;
}
</style>
