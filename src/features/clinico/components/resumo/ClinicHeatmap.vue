<script setup lang="ts">
/**
 * Mapa de calor de hora × dia da semana: onde a clínica lota.
 *
 * É a pergunta que a agenda não responde por rolagem — "que horário está sempre cheio?" — e a
 * que decide contratação, escala de almoço e onde caber um encaixe.
 *
 * A intensidade **não** é só cor. Cada célula carrega o número, e a cor entra como reforço:
 * mapa de calor que só fala por cor exclui quem não distingue verde de âmbar e morre impresso
 * em preto e branco. Por isso também os degraus são quatro e discretos, e não um gradiente
 * contínuo — entre 3 e 4 atendimentos, gradiente vira ruído de cor.
 *
 * A tabela escondida abaixo do gráfico não é redundância: o desenho do Apex é um monte de
 * `<rect>` sem relação de linha e coluna, e leitor de tela não navega retângulo. A tabela leva
 * cabeçalho de linha e de coluna e diz a mesma coisa em texto.
 */
import type { ApexAxisChartSeries, ApexOptions } from 'apexcharts'
import { computed } from 'vue'
import VueApexCharts from '../charts/apex'

import { useClinicChartTheme } from '../../composables/useClinicChartTheme'
import type { CelulaDeHora } from '../../domain/resumo'

const props = defineProps<{
  celulas: CelulaDeHora[]
  pico: number
  /** Rótulos dos sete dias, de segunda a domingo. */
  dias: string[]
  vazio: string
}>()

const tema = useClinicChartTheme()

const ALTURA_DA_LINHA = 26
const ALTURA_DA_MOLDURA = 74

/** Segunda a domingo — mesma ordem de `inicioDaSemana`. */
const ORDEM = [1, 2, 3, 4, 5, 6, 0]

/** Faixa de horas desenhada: do primeiro ao último horário com movimento, nunca 0h–23h. */
const horas = computed(() => {
  if (props.celulas.length === 0) {
    return []
  }

  const inicio = props.celulas.reduce((menor, celula) => Math.min(menor, celula.hora), 23)
  const fim = props.celulas.reduce((maior, celula) => Math.max(maior, celula.hora), 0)
  const lista: number[] = []

  for (let hora = inicio; hora <= fim; hora += 1) {
    lista.push(hora)
  }

  return lista
})

function nomeDaHora(hora: number): string {
  return `${String(hora).padStart(2, '0')}h`
}

const porChave = computed(
  () => new Map(props.celulas.map((celula) => [`${celula.weekday}:${celula.hora}`, celula.valor])),
)

const grade = computed(() =>
  horas.value.map((hora) => ({
    hora,
    colunas: ORDEM.map((weekday, indice) => ({
      weekday,
      dia: props.dias[indice] ?? '',
      valor: porChave.value.get(`${weekday}:${hora}`) ?? 0,
    })),
  })),
)

/** O Apex empilha a primeira série embaixo; invertido, o dia começa no topo, como num relógio. */
const series = computed<ApexAxisChartSeries>(() =>
  [...grade.value].reverse().map((linha) => ({
    name: nomeDaHora(linha.hora),
    data: linha.colunas.map((coluna) => ({ x: coluna.dia, y: coluna.valor })),
  })),
)

const altura = computed(() => horas.value.length * ALTURA_DA_LINHA + ALTURA_DA_MOLDURA)

/**
 * Quatro degraus proporcionais ao pico, mais a faixa do zero.
 *
 * Os limites sobem sempre pelo menos um: com pico 3, `ceil(3 × 0,25)` e `ceil(3 × 0,5)` dariam
 * 1 e 2, mas com pico 2 dariam 1 e 1 — duas faixas na mesma cor e um degrau perdido.
 */
const degraus = computed(() => {
  const pico = Math.max(1, props.pico)
  const d1 = Math.max(1, Math.ceil(pico * 0.25))
  const d2 = Math.max(d1 + 1, Math.ceil(pico * 0.5))
  const d3 = Math.max(d2 + 1, Math.ceil(pico * 0.75))

  return { d1, d2, d3, d4: Math.max(d3 + 1, pico) }
})

/** Nome da faixa na legenda: o intervalo em números, que não precisa de tradução. */
function nomeDaFaixa(de: number, ate: number): string {
  return de === ate ? String(de) : `${de}–${ate}`
}

const opcoes = computed<ApexOptions>(() => {
  const cor = tema.cor.value
  const { d1, d2, d3, d4 } = degraus.value

  return {
    chart: {
      ...tema.grafico.value,
      type: 'heatmap',
      height: altura.value,
      /* Sem a animação escalonada, que num mapa de 70 células vira pisca-pisca. */
      animations: { ...tema.grafico.value.animations, animateGradually: { enabled: false } },
    },
    colors: [cor.accent],
    grid: { ...tema.grade.value, padding: { top: -18, right: 0, bottom: -8, left: 0 } },
    states: tema.estados.value,
    legend: {
      ...tema.legenda.value,
      markers: { size: 6, shape: 'square', strokeWidth: 0 },
    },
    stroke: { width: 2, colors: [cor.surface] },
    plotOptions: {
      heatmap: {
        radius: 4,
        enableShades: false,
        useFillColorAsStroke: false,
        colorScale: {
          ranges: [
            {
              from: 0,
              to: 0,
              color: cor['surface-sunken'],
              foreColor: cor['surface-sunken'],
              name: '0',
            },
            {
              from: 1,
              to: d1,
              color: cor['heat-1'],
              foreColor: cor.text,
              name: nomeDaFaixa(1, d1),
            },
            {
              from: d1 + 1,
              to: d2,
              color: cor['heat-2'],
              foreColor: cor.text,
              name: nomeDaFaixa(d1 + 1, d2),
            },
            {
              from: d2 + 1,
              to: d3,
              color: cor['heat-3'],
              foreColor: cor['heat-ink'],
              name: nomeDaFaixa(d2 + 1, d3),
            },
            {
              from: d3 + 1,
              to: d4,
              color: cor['heat-4'],
              foreColor: cor.surface,
              name: nomeDaFaixa(d3 + 1, d4),
            },
          ],
        },
      },
    },
    dataLabels: {
      enabled: true,
      /*
       * O zero fica sem número de propósito: setenta zeros desenhados competem com os poucos
       * números que importam. A célula vazia já se lê pela cor rebaixada — e a tabela escondida
       * guarda o valor para quem lê por leitor de tela.
       */
      formatter: (valor: string | number | number[]) => (Number(valor) > 0 ? String(valor) : ''),
      style: {
        fontFamily: tema.fonte.value.familia,
        fontSize: tema.fonte.value.rotulo,
        fontWeight: 750,
      },
    },
    xaxis: {
      type: 'category',
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: tema.rotuloDeEixo.value },
      tooltip: { enabled: false },
      crosshairs: { show: false },
    },
    yaxis: {
      labels: {
        align: 'right',
        style: { ...tema.rotuloDeEixo.value, colors: cor.muted, fontWeight: 700 },
      },
    },
    tooltip: {
      ...tema.dica.value,
      marker: { show: false },
      y: {
        formatter: (valor: number) => String(valor ?? 0),
        title: { formatter: (nome: string) => nome },
      },
    },
  }
})
</script>

<template>
  <div class="mapa">
    <p v-if="grade.length === 0" class="mapa__vazio">{{ vazio }}</p>

    <template v-else>
      <VueApexCharts
        type="heatmap"
        :height="altura"
        :options="opcoes"
        :series="series"
        width="100%"
      />

      <table class="mapa__leitura">
        <thead>
          <tr>
            <th scope="col">h</th>
            <th v-for="(dia, indice) in dias" :key="dia + indice" scope="col">{{ dia }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="linha in grade" :key="linha.hora">
            <th scope="row">{{ nomeDaHora(linha.hora) }}</th>
            <td v-for="coluna in linha.colunas" :key="`${linha.hora}-${coluna.weekday}`">
              {{ coluna.valor }}
            </td>
          </tr>
        </tbody>
      </table>
    </template>
  </div>
</template>

<style scoped>
.mapa__vazio {
  margin: 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

/** Mesma informação do gráfico, só para leitor de tela. */
.mapa__leitura {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
