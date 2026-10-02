<script setup lang="ts">
/**
 * A tendência de peso dos últimos seis meses, com as consultas marcadas.
 *
 * **Uma linha só**, clínica e casa juntas. Duas séries — uma por balança — partiriam a mesma
 * história em dois traços que se cruzam, e a pergunta aqui é uma: o peso está indo para onde?
 * A origem de cada ponto vai no marcador: cheio é a balança da clínica (e cai sempre numa
 * consulta, que ganha também o tracejado vertical); vazado é a balança de casa, que vale como
 * tendência e não como medida.
 *
 * A linha só troca para o tom de risco quando o resumo já levantou a perda de peso como sinal —
 * e o sinal, lá em cima, carrega o ícone e o texto. A cor aqui repete o que já foi dito com
 * palavra, nunca diz sozinha.
 *
 * Sem animação de entrada: o gráfico é lido na porta da sala, e crescer a linha na segunda
 * abertura é só atraso.
 */
import { PhScales } from '@phosphor-icons/vue'
import type { ApexOptions } from 'apexcharts'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import VueApexCharts from '../../charts/apex'
import { useClinicChartTheme } from '../../../composables/useClinicChartTheme'
import { useClinicFormat } from '../../../composables/useClinicFormat'
import type { ResumoDoPaciente } from '../../../domain/resumo-do-paciente'
import { clinicClock } from '../../../stores/clinico'

const props = defineProps<{
  peso: ResumoDoPaciente['peso']
  /** A perda de peso já é sinal de risco no topo da página. */
  emRisco: boolean
}>()

const ALTURA = 200

const { t } = useI18n()
const formato = useClinicFormat()
const tema = useClinicChartTheme()

function kg(valor: number): string {
  return formato.numero(valor, Number.isInteger(Math.round(valor * 100) / 10) ? 1 : 2)
}

const pontos = computed(() => props.peso.serie)
const ultimo = computed(() => pontos.value[pontos.value.length - 1] ?? null)

const series = computed(() => [
  {
    name: t('clinico.resumoDoPaciente.peso.serie'),
    data: pontos.value.map((ponto) => ({ x: Date.parse(ponto.em), y: ponto.pesoKg })),
  },
])

const opcoes = computed<ApexOptions>(() => {
  const cor = tema.cor.value
  const linha = props.emRisco ? cor['risk-text'] : cor['accent-strong']
  const valores = pontos.value.map((ponto) => ponto.pesoKg)
  const menor = Math.min(...valores)
  const maior = Math.max(...valores)
  /* Folga de um quarto da faixa, com piso de 2% do peso: sem o piso, série quase plana vira serra. */
  const inicio = Date.parse(pontos.value[0]?.em ?? '')
  const fim = Date.parse(pontos.value[pontos.value.length - 1]?.em ?? '')
  const respiro = Math.max((fim - inicio) * 0.03, 24 * 60 * 60 * 1000)
  const folga = Math.max((maior - menor) * 0.25, maior * 0.02)

  return {
    chart: {
      ...tema.grafico.value,
      id: 'resumo-peso',
      animations: { enabled: false },
    },
    colors: [linha],
    stroke: { width: 2, curve: 'straight' },
    grid: tema.grade.value,
    legend: { show: false },
    dataLabels: { enabled: false },
    markers: {
      size: 0,
      strokeWidth: 2,
      hover: { size: 6 },
      discrete: pontos.value.map((ponto, indice) =>
        ponto.origem === 'clinica'
          ? {
              seriesIndex: 0,
              dataPointIndex: indice,
              size: 5,
              fillColor: linha,
              strokeColor: cor.surface,
            }
          : {
              seriesIndex: 0,
              dataPointIndex: indice,
              size: 3.5,
              fillColor: cor.surface,
              strokeColor: linha,
            },
      ),
    },
    xaxis: {
      type: 'datetime',
      /*
       * Respiro nas duas pontas. Colado na borda, o primeiro ponto caía em cima do rótulo do
       * eixo e o marcador da consulta mais antiga ficava pela metade.
       */
      min: inicio - respiro,
      max: fim + respiro,
      labels: {
        style: tema.rotuloDeEixo.value,
        datetimeUTC: false,
        format: 'dd/MM',
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
      tooltip: { enabled: false },
    },
    yaxis: {
      min: Math.max(0, menor - folga),
      max: maior + folga,
      tickAmount: 3,
      labels: {
        style: tema.rotuloDeEixo.value,
        formatter: (valor: number) => formato.numero(valor, 1),
      },
    },
    annotations: {
      xaxis: props.peso.consultas.map((consulta) => ({
        x: Date.parse(consulta.em),
        strokeDashArray: 3,
        borderColor: cor['line-strong'],
        opacity: 1,
      })),
    },
    tooltip: {
      ...tema.dica.value,
      x: {
        formatter: (valor: number) =>
          formato.dataCurta(clinicClock.dateOf(new Date(valor).toISOString())),
      },
      y: {
        title: { formatter: () => '' },
        formatter: (valor: number, contexto?: { dataPointIndex?: number }) => {
          const ponto = pontos.value[contexto?.dataPointIndex ?? -1]
          const origem = ponto ? t(`clinico.resumoDoPaciente.peso.origem.${ponto.origem}`) : ''

          return `${kg(valor)} kg${origem ? ` · ${origem}` : ''}`
        },
      },
    },
  }
})

const descricao = computed(() => {
  const variacao = props.peso.variacao

  return variacao
    ? t('clinico.resumoDoPaciente.peso.aria', {
        de: kg(variacao.deKg),
        para: kg(variacao.paraKg),
        semanas: variacao.semanas,
      })
    : ''
})
</script>

<template>
  <section class="peso" aria-labelledby="peso-titulo">
    <header class="peso__topo">
      <h2 id="peso-titulo" class="peso__titulo">
        <PhScales class="peso__titulo-icone" weight="duotone" aria-hidden="true" />
        {{ t('clinico.resumoDoPaciente.peso.titulo') }}
      </h2>

      <!-- A legenda é da forma do marcador, não da cor: a linha tem uma cor só. -->
      <ul v-if="pontos.length >= 2" class="peso__legenda">
        <li>
          <span class="marca marca--clinica" aria-hidden="true" />
          {{ t('clinico.resumoDoPaciente.peso.legendaClinica') }}
        </li>
        <li>
          <span class="marca marca--casa" aria-hidden="true" />
          {{ t('clinico.resumoDoPaciente.peso.legendaCasa') }}
        </li>
      </ul>
    </header>

    <figure
      v-if="pontos.length >= 2"
      class="peso__figura"
      :class="{ 'peso__figura--risco': emRisco }"
    >
      <VueApexCharts
        type="line"
        :height="ALTURA"
        :options="opcoes"
        :series="series"
        width="100%"
        :aria-label="descricao"
        role="img"
      />
      <!--
        A mesma série em tabela, para quem não lê o gráfico.

        O `sr-only` fica num `div`, não na tabela: tabela ignora `height: 1px` e cresce até o
        conteúdo. Posicionada em absoluto, ela esticava a página 290 px abaixo do app — a faixa
        branca no rodapé.
      -->
      <div class="sr-only">
        <table>
          <caption>
            {{
              t('clinico.resumoDoPaciente.peso.titulo')
            }}
          </caption>
          <tbody>
            <tr v-for="ponto in pontos" :key="ponto.em">
              <th scope="row">{{ formato.dataCurta(clinicClock.dateOf(ponto.em)) }}</th>
              <td>{{ kg(ponto.pesoKg) }} kg</td>
              <td>{{ t(`clinico.resumoDoPaciente.peso.origem.${ponto.origem}`) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </figure>

    <p v-else-if="ultimo" class="peso__unico">
      {{
        t('clinico.resumoDoPaciente.peso.umPonto', {
          peso: `${kg(ultimo.pesoKg)} kg`,
          data: formato.dataCurta(clinicClock.dateOf(ultimo.em)),
        })
      }}
    </p>

    <p v-else class="peso__unico">{{ t('clinico.resumoDoPaciente.peso.semPeso') }}</p>
  </section>
</template>

<style scoped>
.peso {
  display: grid;
  gap: var(--clinic-space-2);
  padding: 1.2rem 1.35rem 1.35rem;
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
  box-shadow: var(--clinic-shadow-card);
}

.peso__topo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--clinic-space-1) var(--clinic-space-3);
}

.peso__titulo {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  margin: 0;
  font-size: 1rem;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.peso__titulo-icone {
  flex-shrink: 0;
  width: 1.2rem;
  height: 1.2rem;
  color: var(--clinic-accent);
}

.peso__legenda {
  display: flex;
  flex-wrap: wrap;
  margin: 0;
  padding: 0;
  gap: var(--clinic-space-3);
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-weight: 600;
  list-style: none;
}

.peso__legenda li {
  display: inline-flex;
  align-items: center;
  gap: var(--clinic-space-1);
}

.marca {
  display: inline-block;
  width: 10px;
  height: 10px;
  border: 2px solid var(--clinic-accent-strong);
  border-radius: 50%;
}

.marca--clinica {
  background: var(--clinic-accent-strong);
}

.marca--casa {
  width: 8px;
  height: 8px;
  background: var(--clinic-surface);
}

.peso:has(.peso__figura--risco) .marca {
  border-color: var(--clinic-risk-text);
}

.peso:has(.peso__figura--risco) .marca--clinica {
  background: var(--clinic-risk-text);
}

.peso__figura {
  /* Âncora do `sr-only` da tabela: o que é absoluto fica preso aqui dentro. */
  position: relative;
  margin: 0;
  /* O Apex desenha em pixel fixo e estoura o grid sem este piso. */
  min-width: 0;
}

.peso__unico {
  margin: 0;
  color: var(--clinic-muted);
}
</style>
