<script setup lang="ts">
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { isGuidanceVisible } from '@/composables/useLayoutPreferences'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import type { IndicacaoMetricas } from '@/service/parceiro/types'
import {
  MAX_DIAS_SERIE,
  resumirUserAgent,
  type MetricasEstadoErro,
} from '@/utils/parceiro/indicacao-metricas'

/**
 * Leituras do QR de indicação: quantas pessoas escanearam e quando.
 *
 * O gráfico mostra sempre os últimos 14 dias, com os dias sem leitura no lugar deles (um traço na
 * linha de base): a API só manda os dias que tiveram leitura, e juntar 3 de outubro com 9 de
 * outubro numa barra vizinha da outra contaria uma semana que não aconteceu. Uma série só, numa
 * cor só; o número fica escrito sobre o dia de pico e aparece em qualquer dia ao passar o mouse.
 *
 * `409` (parceiro ainda não aprovado) e `503` (serviço de QR fora) são estados
 * previstos, com texto próprio — nenhum dos dois derruba o painel. A lista de
 * leituras recentes nunca mostra IP: o backend não envia, por LGPD.
 */
const props = defineProps<{
  metricas: IndicacaoMetricas | null
  loading: boolean
  erro: MetricasEstadoErro | null
}>()

const emit = defineEmits<{ retry: [] }>()

const { t, locale } = useI18n()

const intlLocale = computed(() => INTL_LOCALE[locale.value as Locale])

function chaveDoDia(data: Date) {
  const y = data.getFullYear()
  const m = String(data.getMonth() + 1).padStart(2, '0')
  const d = String(data.getDate()).padStart(2, '0')

  return `${y}-${m}-${d}`
}

function dataDoDia(day: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)

  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null
}

type DiaDoGrafico = {
  day: string
  count: number
  /** Altura da barra, em % do dia de pico. */
  percent: number
  eixo: string
  hoje: boolean
  pico: boolean
}

/**
 * Os 14 dias até hoje (ou até o último dia que a API mandou, se o fuso dela já virou o dia).
 * Dia que não veio na resposta é dia sem leitura.
 */
const dias = computed<DiaDoGrafico[]>(() => {
  const porDia = new Map((props.metricas?.byDay ?? []).map((item) => [item.day, item.count]))
  const hoje = new Date()
  const ultimoDaApi = [...porDia.keys()].sort().at(-1)
  const ultimo = ultimoDaApi && ultimoDaApi > chaveDoDia(hoje) ? dataDoDia(ultimoDaApi)! : hoje

  const lista = Array.from({ length: MAX_DIAS_SERIE }, (_, indice) => {
    const data = new Date(ultimo.getFullYear(), ultimo.getMonth(), ultimo.getDate())
    data.setDate(data.getDate() - (MAX_DIAS_SERIE - 1 - indice))
    const day = chaveDoDia(data)

    return { day, count: porDia.get(day) ?? 0, data }
  })

  const maior = Math.max(0, ...lista.map((item) => item.count))
  const chaveDeHoje = chaveDoDia(hoje)
  /* O pico rotulado é o mais recente, se dois dias empatarem. */
  const indiceDoPico = maior > 0 ? lista.map((item) => item.count).lastIndexOf(maior) : -1

  return lista.map((item, indice) => ({
    day: item.day,
    count: item.count,
    percent: maior > 0 ? Math.round((item.count / maior) * 100) : 0,
    eixo: String(item.data.getDate()),
    hoje: item.day === chaveDeHoje,
    pico: indice === indiceDoPico,
  }))
})

const scanCount = computed(() => props.metricas?.scanCount ?? 0)

const leiturasNoPeriodo = computed(() => dias.value.reduce((soma, dia) => soma + dia.count, 0))

const recentes = computed(() =>
  (props.metricas?.recent ?? []).map((item, index) => {
    const dispositivo = resumirUserAgent(item.userAgent)

    return {
      id: `${item.at}-${index}`,
      at: item.at,
      quando: formatarDataHora(item.at),
      dispositivo,
      icone:
        dispositivo === 'Windows' || dispositivo === 'Mac' || dispositivo === 'Linux'
          ? 'ph ph-desktop'
          : 'ph ph-device-mobile',
    }
  }),
)

const semLeitura = computed(
  () =>
    !props.loading &&
    !props.erro &&
    scanCount.value === 0 &&
    (props.metricas?.byDay ?? []).length === 0,
)

/** "Hoje, 14:32", "Ontem, 09:10" ou a data curta com a hora. */
function formatarDataHora(valor: string) {
  const data = new Date(valor)

  if (Number.isNaN(data.getTime())) {
    return valor
  }

  const hora = data.toLocaleTimeString(intlLocale.value, { hour: '2-digit', minute: '2-digit' })
  const hoje = new Date()
  const ontem = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 1)

  if (chaveDoDia(data) === chaveDoDia(hoje)) {
    return `${t('carteira.extrato.today')}, ${hora}`
  }

  if (chaveDoDia(data) === chaveDoDia(ontem)) {
    return `${t('carteira.extrato.yesterday')}, ${hora}`
  }

  return data.toLocaleString(intlLocale.value, { dateStyle: 'short', timeStyle: 'short' })
}

/** Dia por extenso curto para a dica e para o leitor de tela (`YYYY-MM-DD` sem virar o fuso). */
function formatarDia(day: string) {
  const data = dataDoDia(day)

  return data
    ? data.toLocaleDateString(intlLocale.value, { weekday: 'short', day: '2-digit', month: '2-digit' })
    : day
}

function barraAria(day: string, count: number) {
  return t('divulgacao.metricas.dica', { dia: formatarDia(day), n: count }, count)
}
</script>

<template>
  <section class="qrm ui-folha" aria-labelledby="qrm-title">
    <header class="qrm__cabeca">
      <div class="qrm__titulos">
        <h3 id="qrm-title" class="qrm__titulo">
          <i class="ph ph-qr-code" aria-hidden="true" />
          {{ t('divulgacao.metricas.title') }}
        </h3>
        <p v-if="isGuidanceVisible">{{ t('divulgacao.metricas.lede') }}</p>
      </div>
      <Button
        v-if="erro === 'indisponivel' || erro === 'erro'"
        :label="t('common.retry')"
        icon="ph ph-arrow-clockwise"
        severity="secondary"
        text
        size="small"
        @click="emit('retry')"
      />
    </header>

    <div v-if="loading" class="qrm__carregando" role="status" aria-live="polite" aria-busy="true">
      <Skeleton width="8rem" height="2.2rem" border-radius="8px" />
      <Skeleton width="100%" height="7rem" border-radius="10px" />
    </div>

    <p v-else-if="erro" class="qrm__aviso" role="status">
      <i class="ph ph-info" aria-hidden="true" />
      {{ t(`divulgacao.metricas.erro.${erro}`) }}
    </p>

    <p v-else-if="semLeitura" class="qrm__aviso" role="status">
      <i class="ph ph-qr-code" aria-hidden="true" />
      {{ t('divulgacao.metricas.vazio') }}
    </p>

    <div v-else class="qrm__corpo">
      <div class="qrm__grafico">
        <p class="qrm__total">
          <strong class="ui-num">{{ scanCount }}</strong>
          <span>{{ t('divulgacao.metricas.aoTodo', scanCount) }}</span>
          <span class="qrm__periodo ui-num">
            {{ t('divulgacao.metricas.ultimos14', { n: leiturasNoPeriodo }) }}
          </span>
        </p>

        <!-- A lista é a tabela do gráfico: cada dia diz a data e a contagem ao leitor de tela. -->
        <ol class="qrm__barras" :aria-label="t('divulgacao.metricas.chartAria')">
          <li
            v-for="dia in dias"
            :key="dia.day"
            class="qrm__dia"
            :class="{
              'qrm__dia--hoje': dia.hoje,
              'qrm__dia--pico': dia.pico,
              'qrm__dia--zero': dia.count === 0,
            }"
          >
            <span class="qrm__coluna" aria-hidden="true">
              <span v-if="dia.pico" class="qrm__rotulo ui-num">{{ dia.count }}</span>
              <span class="qrm__barra" :style="{ blockSize: `${dia.percent}%` }" />
            </span>
            <span class="qrm__eixo ui-num" aria-hidden="true">{{ dia.eixo }}</span>
            <span class="qrm__dica" aria-hidden="true">{{ barraAria(dia.day, dia.count) }}</span>
            <span class="qrm__sr">{{ barraAria(dia.day, dia.count) }}</span>
          </li>
        </ol>
      </div>

      <div v-if="recentes.length" class="qrm__recentes">
        <h4 class="qrm__subtitulo">{{ t('divulgacao.metricas.recentes') }}</h4>
        <ul class="qrm__lista">
          <li v-for="item in recentes" :key="item.id" class="qrm__leitura">
            <span class="qrm__aparelho" aria-hidden="true"><i :class="item.icone" /></span>
            <time class="qrm__quando ui-num" :datetime="item.at">{{ item.quando }}</time>
            <span v-if="item.dispositivo" class="qrm__dispositivo">{{ item.dispositivo }}</span>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<style scoped>
/*
 * Folha própria, nos tokens do Trilha: o mesmo bloco aparece na Divulgação (largo) e na gaveta
 * do QR no Início (estreito). Quem decide a forma é a largura do bloco, não a da janela.
 */
.qrm {
  display: grid;
  align-content: start;
  gap: 16px;
  padding: 20px 22px 22px;
  container: qrm / inline-size;
}

.qrm__sr {
  position: absolute;
  overflow: hidden;
  width: 1px;
  height: 1px;
  clip-path: inset(50%);
  white-space: nowrap;
}

.qrm__cabeca {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.qrm__titulos {
  display: grid;
  gap: 2px;
}

.qrm__titulo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.qrm__titulo i {
  color: var(--portal);
  font-size: 19px;
}

.qrm__titulos p {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.45;
}

.qrm__carregando {
  display: grid;
  gap: 12px;
}

.qrm__aviso {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0;
  padding: 14px 16px;
  border-radius: 12px;
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 14px;
  line-height: 1.5;
}

.qrm__aviso i {
  margin-top: 1px;
  color: var(--tinta-2);
  font-size: 18px;
}

.qrm__corpo {
  display: grid;
  gap: 22px;
}

@container qrm (min-width: 640px) {
  .qrm__corpo {
    align-items: start;
    gap: 32px;
    grid-template-columns: minmax(0, 1.7fr) minmax(220px, 1fr);
  }

  .qrm__recentes {
    padding-inline-start: 28px;
    border-inline-start: 1px solid var(--linha);
  }
}

.qrm__grafico {
  display: grid;
  min-width: 0;
  gap: 16px;
}

.qrm__total {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
}

.qrm__total strong {
  color: var(--tinta);
  font-size: 30px;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1;
}

.qrm__periodo {
  color: var(--tinta-3);
  font-size: 13px;
}

.qrm__periodo::before {
  margin-inline-end: 8px;
  content: '·';
}

/* ------------------------------------------------------------------ o gráfico
 * Colunas finas, ponta de cima arredondada (4px) e presa à linha de base, 2px de folga entre
 * elas, grade nenhuma: o pico leva o número; os outros dias, a dica ao passar o mouse.
 */
.qrm__barras {
  position: relative;
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
  grid-template-columns: repeat(14, minmax(0, 1fr));
}

.qrm__dia {
  position: relative;
  display: grid;
  gap: 6px;
  grid-template-rows: 128px auto;
  cursor: default;
}

.qrm__coluna {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  border-bottom: 1px solid var(--linha-forte);
}

.qrm__barra {
  width: min(70%, 22px);
  min-block-size: 3px;
  border-radius: 4px 4px 0 0;
  background: var(--portal);
  transition: background-color var(--pj-tempo-curto, 140ms) ease-out;
}

.qrm__dia--zero .qrm__barra {
  background: var(--linha-forte);
}

.qrm__dia:hover .qrm__barra {
  background: var(--portal-tinta);
}

.qrm__rotulo {
  margin-bottom: 4px;
  color: var(--tinta);
  font-size: 12.5px;
  font-weight: 650;
}

.qrm__eixo {
  color: var(--tinta-3);
  font-size: 11.5px;
  text-align: center;
}

.qrm__dia--hoje .qrm__eixo {
  color: var(--tinta);
  font-weight: 650;
}

/* A dica: aparece sobre a coluna com o dia e a contagem. */
.qrm__dica {
  position: absolute;
  z-index: 2;
  bottom: calc(100% - 4px);
  left: 50%;
  padding: 6px 9px;
  border-radius: 8px;
  background: var(--tinta);
  box-shadow: var(--sombra-2);
  color: var(--superficie);
  font-size: 12.5px;
  font-weight: 500;
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, 4px);
  transition:
    opacity var(--pj-tempo-curto, 140ms) ease-out,
    transform var(--pj-tempo-curto, 140ms) ease-out;
  white-space: nowrap;
}

.qrm__dica::first-letter {
  text-transform: uppercase;
}

.qrm__dia:first-child .qrm__dica,
.qrm__dia:nth-child(2) .qrm__dica {
  left: 0;
  transform: translate(0, 4px);
}

.qrm__dia:last-child .qrm__dica,
.qrm__dia:nth-last-child(2) .qrm__dica {
  right: 0;
  left: auto;
  transform: translate(0, 4px);
}

.qrm__dia:hover .qrm__dica {
  opacity: 1;
  transform: translate(-50%, 0);
}

.qrm__dia:first-child:hover .qrm__dica,
.qrm__dia:nth-child(2):hover .qrm__dica,
.qrm__dia:last-child:hover .qrm__dica,
.qrm__dia:nth-last-child(2):hover .qrm__dica {
  transform: translate(0, 0);
}

/* Estreito (a gaveta do Início): o eixo fica com um dia sim, um dia não, contando de hoje. */
@container qrm (max-width: 420px) {
  .qrm__dia:nth-last-child(even):not(.qrm__dia--hoje) .qrm__eixo {
    visibility: hidden;
  }

  .qrm__dia {
    grid-template-rows: 104px auto;
  }
}

/* ------------------------------------------------------------------ leituras recentes */

.qrm__recentes {
  display: grid;
  align-content: start;
  gap: 8px;
  min-width: 0;
}

.qrm__subtitulo {
  margin: 0;
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 550;
}

.qrm__lista {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.qrm__leitura {
  display: flex;
  min-height: 44px;
  align-items: center;
  gap: 10px;
}

.qrm__leitura + .qrm__leitura {
  border-top: 1px solid var(--linha);
}

.qrm__aparelho {
  display: grid;
  width: 28px;
  height: 28px;
  flex: none;
  place-items: center;
  border-radius: 8px;
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 16px;
}

.qrm__quando {
  flex: 1;
  min-width: 0;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 500;
}

.qrm__dispositivo {
  color: var(--tinta-2);
  font-size: 13px;
}

@media (prefers-reduced-motion: reduce) {
  .qrm__barra,
  .qrm__dica {
    transition: none;
  }
}
</style>
