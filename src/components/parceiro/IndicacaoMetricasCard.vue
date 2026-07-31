<script setup lang="ts">
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import type { IndicacaoMetricas } from '@/service/parceiro/types'
import {
  montarSerie,
  resumirUserAgent,
  type MetricasEstadoErro,
} from '@/utils/parceiro/indicacao-metricas'

/**
 * Leituras do QR de indicação: quantas pessoas escanearam e quando.
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

const serie = computed(() => montarSerie(props.metricas?.byDay))

const scanCount = computed(() => props.metricas?.scanCount ?? 0)

const recentes = computed(() =>
  (props.metricas?.recent ?? []).map((item, index) => ({
    id: `${item.at}-${index}`,
    quando: formatarDataHora(item.at),
    dispositivo: resumirUserAgent(item.userAgent),
  })),
)

const semLeitura = computed(
  () => !props.loading && !props.erro && scanCount.value === 0 && serie.value.length === 0,
)

function formatarDataHora(valor: string) {
  const data = new Date(valor)

  return Number.isNaN(data.getTime())
    ? valor
    : data.toLocaleString(intlLocale.value, { dateStyle: 'short', timeStyle: 'short' })
}

/** Dia curto para o eixo (`YYYY-MM-DD` sem virar o dia por causa de fuso). */
function formatarDia(day: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)

  if (!match) {
    return day
  }

  const data = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))

  return data.toLocaleDateString(intlLocale.value, { day: '2-digit', month: '2-digit' })
}

function barraAria(day: string, count: number) {
  return t('divulgacao.metricas.barraAria', { dia: formatarDia(day), n: count })
}
</script>

<template>
  <section class="qrm" aria-labelledby="qrm-title">
    <header class="qrm__head">
      <div>
        <h3 id="qrm-title">{{ t('divulgacao.metricas.title') }}</h3>
        <p>{{ t('divulgacao.metricas.lede') }}</p>
      </div>
      <Button
        v-if="erro === 'indisponivel' || erro === 'erro'"
        :label="t('common.retry')"
        icon="pi pi-refresh"
        severity="secondary"
        text
        size="small"
        @click="emit('retry')"
      />
    </header>

    <div v-if="loading" class="qrm__loading" role="status" aria-live="polite" aria-busy="true">
      <Skeleton width="7rem" height="2.4rem" border-radius="8px" />
      <Skeleton width="100%" height="4.5rem" border-radius="8px" />
    </div>

    <p v-else-if="erro" class="qrm__aviso" role="status">
      <i class="pi pi-info-circle" aria-hidden="true" />
      {{ t(`divulgacao.metricas.erro.${erro}`) }}
    </p>

    <p v-else-if="semLeitura" class="qrm__aviso" role="status">
      <i class="pi pi-qrcode" aria-hidden="true" />
      {{ t('divulgacao.metricas.vazio') }}
    </p>

    <template v-else>
      <p class="qrm__total">
        <strong>{{ scanCount }}</strong>
        <span>{{ t('divulgacao.metricas.leituras', scanCount) }}</span>
      </p>

      <div v-if="serie.length" class="qrm__chart-wrap">
        <ul class="qrm__chart" :aria-label="t('divulgacao.metricas.chartAria')">
          <li v-for="barra in serie" :key="barra.day" class="qrm__bar-slot">
            <span
              class="qrm__bar"
              :style="{ height: `${barra.percent}%` }"
              :title="barraAria(barra.day, barra.count)"
            >
              <span class="qrm__sr">{{ barraAria(barra.day, barra.count) }}</span>
            </span>
            <small>{{ formatarDia(barra.day) }}</small>
          </li>
        </ul>
      </div>

      <div v-if="recentes.length" class="qrm__recent">
        <h4>{{ t('divulgacao.metricas.recentes') }}</h4>
        <ul>
          <li v-for="item in recentes" :key="item.id">
            <span class="qrm__recent-when">{{ item.quando }}</span>
            <span v-if="item.dispositivo" class="qrm__recent-device">{{ item.dispositivo }}</span>
          </li>
        </ul>
      </div>
    </template>
  </section>
</template>

<style scoped>
.qrm {
  display: grid;
  gap: 0.75rem;
  align-content: start;
  padding: 1rem 1.05rem;
  border: 1px solid var(--div-line);
  border-radius: 1.1rem;
  background: var(--div-card);
}

.qrm__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.qrm__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}

.qrm__head h3 {
  margin: 0;
  color: var(--div-text);
  font-size: 0.95rem;
  font-weight: 750;
  letter-spacing: -0.01em;
}

.qrm__head p {
  margin: 0.2rem 0 0;
  color: var(--div-muted);
  font-size: 0.8rem;
  line-height: 1.45;
}

.qrm__loading {
  display: grid;
  gap: 0.55rem;
}

.qrm__aviso {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0;
  padding: 0.7rem 0.8rem;
  border-radius: 0.75rem;
  background: color-mix(in srgb, var(--div-surface) 80%, var(--div-card));
  color: var(--div-muted);
  font-size: 0.82rem;
  line-height: 1.45;
}

.qrm__aviso i {
  flex: 0 0 auto;
  color: var(--div-primary-strong);
}

.qrm__total {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  margin: 0;
}

.qrm__total strong {
  color: var(--div-primary-strong);
  font-size: 1.9rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1;
}

.qrm__total span {
  color: var(--div-muted);
  font-size: 0.84rem;
  font-weight: 600;
}

/* Série pode passar da largura em tela estreita: rola dentro do próprio bloco. */
.qrm__chart-wrap {
  overflow-x: auto;
  padding-bottom: 0.2rem;
}

.qrm__chart {
  display: flex;
  align-items: flex-end;
  gap: 0.3rem;
  min-width: max-content;
  height: 5.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.qrm__bar-slot {
  display: grid;
  grid-template-rows: 1fr auto;
  gap: 0.3rem;
  align-items: end;
  justify-items: center;
  height: 100%;
  min-width: 1.9rem;
}

.qrm__bar {
  position: relative;
  width: 0.7rem;
  /* Barra de dia zerado vira um traço, para o dia não sumir do eixo. */
  min-height: 2px;
  border-radius: 999px 999px 0.2rem 0.2rem;
  background: linear-gradient(
    to top,
    color-mix(in srgb, var(--div-primary) 45%, transparent),
    var(--div-primary-strong)
  );
}

.qrm__bar-slot small {
  color: var(--div-faint);
  font-size: 0.62rem;
  font-weight: 650;
  white-space: nowrap;
}

.qrm__recent {
  display: grid;
  gap: 0.35rem;
  padding-top: 0.65rem;
  border-top: 1px solid color-mix(in srgb, var(--div-line) 85%, transparent);
}

.qrm__recent h4 {
  margin: 0;
  color: var(--div-faint);
  font-size: 0.68rem;
  font-weight: 750;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.qrm__recent ul {
  display: grid;
  gap: 0.25rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.qrm__recent li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.35rem 0.5rem;
  border-radius: 0.55rem;
  background: color-mix(in srgb, var(--div-surface) 70%, var(--div-card));
}

.qrm__recent-when {
  color: var(--div-text);
  font-size: 0.78rem;
  font-weight: 600;
}

.qrm__recent-device {
  color: var(--div-muted);
  font-size: 0.72rem;
  font-weight: 650;
}
</style>
