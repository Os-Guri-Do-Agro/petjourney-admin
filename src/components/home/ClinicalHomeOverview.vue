<script setup lang="ts">
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { currentColors } from '@/theme/color-mode'

type MetricTone = 'success' | 'attention' | 'danger' | 'neutral'

type ClinicalMetric = {
  id: string
  label: string
  shortLabel: string
  value: number
  detail: string
  tone: MetricTone
  icon: string
  progress?: number
  progressLabel?: string
  insight: string
}

const props = withDefaults(
  defineProps<{
    layout?: 'strip' | 'dashboard'
  }>(),
  {
    layout: 'dashboard',
  },
)

const metricsDrawerOpen = ref(false)

const sectionStyle = computed(() => {
  const colors = currentColors.value

  return {
    '--dash-card': colors.dashboard.surface,
    '--dash-surface': colors.dashboard.surfaceSoft,
    '--dash-line': colors.dashboard.line,
    '--dash-line-soft': colors.dashboard.lineSoft,
    '--dash-muted': colors.dashboard.muted,
    '--dash-faint': colors.dashboard.faint,
    '--dash-text': colors.dashboard.text,
    '--dash-primary': colors.vet.primary,
    '--dash-primary-soft': colors.vet.secondary,
    '--dash-primary-strong': colors.dashboard.primaryStrong,
    '--dash-success-bg': colors.dashboard.successBg,
    '--dash-success-text': colors.dashboard.successText,
    '--dash-warm-bg': colors.dashboard.warmBg,
    '--dash-warm-text': colors.dashboard.warmText,
    '--dash-amber-bg': colors.dashboard.amberBg,
    '--dash-amber-text': colors.dashboard.amberText,
    '--dash-shadow-rgb': colors.auth.shadowRgb,
  }
})

const todayLabel = computed(() =>
  new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }),
)

const metrics: ClinicalMetric[] = [
  {
    id: 'consultas',
    label: 'Consultas hoje',
    shortLabel: 'Consultas',
    value: 8,
    detail: '3 agendadas até 12h',
    tone: 'success',
    icon: 'pi pi-calendar',
    progress: 38,
    progressLabel: 'Até meio-dia',
    insight: 'Pico de atendimento entre 09h e 11h.',
  },
  {
    id: 'atendidos',
    label: 'Atendidos',
    shortLabel: 'Atendidos',
    value: 5,
    detail: '62% do volume do dia',
    tone: 'success',
    icon: 'pi pi-check-circle',
    progress: 62,
    progressLabel: 'Concluídos',
    insight: 'Ritmo acima da média das últimas semanas.',
  },
  {
    id: 'pendencias',
    label: 'Pendências',
    shortLabel: 'Pendências',
    value: 6,
    detail: '2 marcadas como urgentes',
    tone: 'attention',
    icon: 'pi pi-clock',
    progress: 33,
    progressLabel: 'Urgentes',
    insight: 'Priorize retornos e confirmações pendentes.',
  },
  {
    id: 'atencao',
    label: 'Em atenção',
    shortLabel: 'Atenção',
    value: 3,
    detail: 'Risco clínico ou retorno crítico',
    tone: 'danger',
    icon: 'pi pi-exclamation-circle',
    progress: 38,
    progressLabel: 'Com alerta',
    insight: 'Revise alergias e medicações antes do atendimento.',
  },
]

const hourlyVolume = [
  { hour: '08h', value: 1 },
  { hour: '09h', value: 3 },
  { hour: '10h', value: 4 },
  { hour: '11h', value: 2 },
  { hour: '12h', value: 1 },
  { hour: '14h', value: 3 },
  { hour: '15h', value: 2 },
  { hour: '16h', value: 1 },
]

const shortcuts = [
  { label: 'Agenda', to: '/veterinario/agenda', icon: 'pi pi-calendar', description: 'Calendário do dia' },
  { label: 'Atividades', to: '/veterinario/atividades', icon: 'pi pi-list', description: 'Tarefas e follow-ups' },
  { label: 'Pacientes', to: '/veterinario/pacientes', icon: 'pi pi-users', description: 'Cadastro e busca' },
  { label: 'Prontuários', to: '/veterinario/prontuarios', icon: 'pi pi-file-edit', description: 'Histórico clínico' },
]

const consultasMetric = computed(() => metrics.find((metric) => metric.id === 'consultas'))
const atendidosMetric = computed(() => metrics.find((metric) => metric.id === 'atendidos'))

const completionRate = computed(() => {
  const total = consultasMetric.value?.value ?? 0
  const done = atendidosMetric.value?.value ?? 0

  if (total <= 0) {
    return 0
  }

  return Math.round((done / total) * 100)
})

const maxHourlyValue = computed(() => Math.max(...hourlyVolume.map((slot) => slot.value), 1))

const ringCircumference = 2 * Math.PI * 46

const ringOffset = computed(() => ringCircumference * (1 - completionRate.value / 100))

const operationSegments = computed(() => {
  const atendidos = atendidosMetric.value?.value ?? 0
  const pendencias = metrics.find((metric) => metric.id === 'pendencias')?.value ?? 0
  const atencao = metrics.find((metric) => metric.id === 'atencao')?.value ?? 0
  const total = atendidos + pendencias + atencao

  if (total <= 0) {
    return []
  }

  return [
    { id: 'atendidos', label: 'Atendidos', value: atendidos, tone: 'success' as const },
    { id: 'pendencias', label: 'Pendências', value: pendencias, tone: 'attention' as const },
    { id: 'atencao', label: 'Atenção', value: atencao, tone: 'danger' as const },
  ].map((segment) => ({
    ...segment,
    percent: Math.round((segment.value / total) * 100),
  }))
})

function openMetrics() {
  metricsDrawerOpen.value = true
}

function formatMetricValue(value: number) {
  return String(value)
}
</script>

<template>
  <section
    class="clinical-home"
    :class="`clinical-home--${props.layout}`"
    :style="sectionStyle"
    aria-labelledby="home-clinical-title"
  >
    <template v-if="props.layout === 'strip'">
      <div class="clinical-strip__main">
        <div class="clinical-strip__identity">
          <p class="clinical-home__eyebrow">Clínica</p>
          <h2 id="home-clinical-title">Rotina de hoje</h2>
        </div>

        <ul class="clinical-strip__chips" aria-label="Resumo do dia">
          <li
            v-for="metric in metrics"
            :key="metric.id"
          >
            <button
              type="button"
              class="clinical-chip"
              :data-tone="metric.tone"
              @click="openMetrics"
            >
              <span class="clinical-chip__icon" aria-hidden="true">
                <i :class="metric.icon" />
              </span>
              <strong>{{ formatMetricValue(metric.value) }}</strong>
              <span>{{ metric.shortLabel }}</span>
            </button>
          </li>
        </ul>

        <Button
          class="clinical-strip__cta"
          icon="pi pi-chart-bar"
          label="Métricas"
          severity="secondary"
          size="small"
          @click="openMetrics"
        />
      </div>
    </template>

    <template v-else>
      <header class="clinical-dashboard__header">
        <div>
          <p class="clinical-home__eyebrow">Clínica</p>
          <h2 id="home-clinical-title">Rotina de hoje</h2>
          <p class="clinical-dashboard__date">{{ todayLabel }}</p>
        </div>
        <RouterLink class="clinical-dashboard__agenda-link" to="/veterinario/agenda">
          Abrir agenda
          <i class="pi pi-arrow-right" aria-hidden="true" />
        </RouterLink>
      </header>

      <div class="clinical-dashboard__kpis">
        <article
          v-for="metric in metrics"
          :key="metric.id"
          class="clinical-kpi"
          :data-tone="metric.tone"
        >
          <div class="clinical-kpi__head">
            <span>{{ metric.label }}</span>
            <span class="clinical-kpi__icon" aria-hidden="true">
              <i :class="metric.icon" />
            </span>
          </div>
          <strong class="clinical-kpi__value">{{ formatMetricValue(metric.value) }}</strong>
          <p class="clinical-kpi__detail">{{ metric.detail }}</p>
        </article>
      </div>

      <div class="clinical-dashboard__charts">
        <article class="clinical-chart-card clinical-chart-card--bars">
          <div class="clinical-chart-card__head">
            <div>
              <h3>Volume por horário</h3>
              <p>Distribuição de consultas ao longo do dia</p>
            </div>
            <span class="clinical-chart-card__badge">Hoje</span>
          </div>

          <div class="hourly-chart" role="img" aria-label="Gráfico de barras do volume por horário">
            <div
              v-for="slot in hourlyVolume"
              :key="slot.hour"
              class="hourly-chart__column"
            >
              <div class="hourly-chart__bar-wrap">
                <span
                  class="hourly-chart__bar"
                  :style="{ height: `${(slot.value / maxHourlyValue) * 100}%` }"
                />
              </div>
              <span class="hourly-chart__label">{{ slot.hour }}</span>
            </div>
          </div>
        </article>

        <article class="clinical-chart-card clinical-chart-card--ring">
          <div class="clinical-chart-card__head">
            <div>
              <h3>Taxa de conclusão</h3>
              <p>Consultas finalizadas no dia</p>
            </div>
          </div>

          <div class="completion-ring" role="img" :aria-label="`${completionRate}% das consultas concluídas`">
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <circle
                class="completion-ring__track"
                cx="60"
                cy="60"
                r="46"
              />
              <circle
                class="completion-ring__value"
                cx="60"
                cy="60"
                r="46"
                :stroke-dasharray="ringCircumference"
                :stroke-dashoffset="ringOffset"
              />
            </svg>
            <div class="completion-ring__center">
              <strong>{{ completionRate }}%</strong>
              <span>concluído</span>
            </div>
          </div>

          <p class="clinical-chart-card__footnote">
            {{ atendidosMetric?.value ?? 0 }} de {{ consultasMetric?.value ?? 0 }} consultas atendidas
          </p>
        </article>
      </div>

      <div class="clinical-dashboard__lower">
        <article class="clinical-progress-card">
          <div class="clinical-progress-card__head">
            <h3>Progresso operacional</h3>
            <p>Indicadores que pedem ação antes do fim do expediente</p>
          </div>

          <div class="clinical-progress-card__stack" role="presentation">
            <div
              v-for="segment in operationSegments"
              :key="segment.id"
              class="clinical-progress-card__segment"
              :data-tone="segment.tone"
              :style="{ width: `${segment.percent}%` }"
              :title="`${segment.label}: ${segment.value}`"
            />
          </div>

          <ul class="clinical-progress-card__legend">
            <li v-for="segment in operationSegments" :key="`${segment.id}-legend`" :data-tone="segment.tone">
              <span>{{ segment.label }}</span>
              <strong>{{ segment.value }}</strong>
            </li>
          </ul>

          <div class="clinical-progress-card__metrics">
            <article
              v-for="metric in metrics.filter((item) => item.id !== 'consultas')"
              :key="metric.id"
              class="metric-panel"
              :data-tone="metric.tone"
            >
              <div class="metric-panel__head">
                <span class="metric-panel__icon" aria-hidden="true">
                  <i :class="metric.icon" />
                </span>
                <div>
                  <span class="metric-panel__label">{{ metric.label }}</span>
                  <strong class="metric-panel__value">{{ formatMetricValue(metric.value) }}</strong>
                </div>
              </div>

              <div v-if="metric.progress != null" class="metric-panel__progress">
                <div class="metric-panel__progress-meta">
                  <span>{{ metric.progressLabel }}</span>
                  <span>{{ metric.progress }}%</span>
                </div>
                <div class="metric-panel__progress-track" role="presentation">
                  <span :style="{ width: `${metric.progress}%` }" />
                </div>
              </div>

              <p class="metric-panel__insight">{{ metric.insight }}</p>
            </article>
          </div>
        </article>

        <aside class="clinical-shortcuts-card" aria-labelledby="clinical-shortcuts-title">
          <h3 id="clinical-shortcuts-title">Acesso rápido</h3>
          <p>Atalhos para as áreas que sustentam a rotina clínica.</p>

          <div class="clinical-shortcuts-card__links">
            <RouterLink
              v-for="item in shortcuts"
              :key="item.to"
              class="clinical-shortcut"
              :to="item.to"
            >
              <span class="clinical-shortcut__icon" aria-hidden="true">
                <i :class="item.icon" />
              </span>
              <span class="clinical-shortcut__copy">
                <strong>{{ item.label }}</strong>
                <small>{{ item.description }}</small>
              </span>
              <i class="pi pi-arrow-right clinical-shortcut__arrow" aria-hidden="true" />
            </RouterLink>
          </div>
        </aside>
      </div>
    </template>

    <Drawer
      v-if="props.layout === 'strip'"
      v-model:visible="metricsDrawerOpen"
      position="right"
      block-scroll
      class="clinical-metrics-drawer"
    >
      <template #header>
        <div class="metrics-drawer__header">
          <p class="metrics-drawer__eyebrow">Clínica · {{ todayLabel }}</p>
          <h2>Métricas do dia</h2>
          <p class="metrics-drawer__subtitle">
            Visão consolidada para priorizar o que exige ação agora.
          </p>
        </div>
      </template>

      <div class="metrics-drawer__body">
        <div class="metrics-drawer__summary">
          <article class="metrics-drawer__ring-card">
            <div
              class="completion-ring completion-ring--compact"
              role="img"
              :aria-label="`${completionRate}% das consultas concluídas`"
            >
              <svg viewBox="0 0 120 120" aria-hidden="true">
                <circle class="completion-ring__track" cx="60" cy="60" r="46" />
                <circle
                  class="completion-ring__value"
                  cx="60"
                  cy="60"
                  r="46"
                  :stroke-dasharray="ringCircumference"
                  :stroke-dashoffset="ringOffset"
                />
              </svg>
              <div class="completion-ring__center">
                <strong>{{ completionRate }}%</strong>
                <span>concluído</span>
              </div>
            </div>
            <p>
              {{ atendidosMetric?.value ?? 0 }} de {{ consultasMetric?.value ?? 0 }} consultas atendidas
            </p>
          </article>

          <article class="metrics-drawer__stack-card">
            <div class="metrics-drawer__stack-head">
              <h3>Operação do dia</h3>
              <span>{{ operationSegments.reduce((sum, item) => sum + item.value, 0) }} itens</span>
            </div>
            <div class="clinical-progress-card__stack" role="presentation">
              <div
                v-for="segment in operationSegments"
                :key="segment.id"
                class="clinical-progress-card__segment"
                :data-tone="segment.tone"
                :style="{ width: `${segment.percent}%` }"
                :title="`${segment.label}: ${segment.value}`"
              />
            </div>
            <ul class="clinical-progress-card__legend clinical-progress-card__legend--compact">
              <li
                v-for="segment in operationSegments"
                :key="`${segment.id}-drawer`"
                :data-tone="segment.tone"
              >
                <span>{{ segment.label }}</span>
                <strong>{{ segment.value }}</strong>
              </li>
            </ul>
          </article>
        </div>

        <article class="metrics-drawer__chart-card">
          <div class="clinical-chart-card__head">
            <div>
              <h3>Volume por horário</h3>
              <p>Distribuição das consultas de hoje</p>
            </div>
          </div>
          <div class="hourly-chart hourly-chart--compact" role="img" aria-label="Volume por horário">
            <div v-for="slot in hourlyVolume" :key="slot.hour" class="hourly-chart__column">
              <div class="hourly-chart__bar-wrap">
                <span
                  class="hourly-chart__bar"
                  :style="{ height: `${(slot.value / maxHourlyValue) * 100}%` }"
                />
              </div>
              <span class="hourly-chart__label">{{ slot.hour }}</span>
            </div>
          </div>
        </article>

        <div class="metrics-drawer__metrics">
          <article
            v-for="metric in metrics"
            :key="metric.id"
            class="metric-panel metric-panel--drawer"
            :data-tone="metric.tone"
          >
            <div class="metric-panel__head">
              <span class="metric-panel__icon" aria-hidden="true">
                <i :class="metric.icon" />
              </span>
              <div class="metric-panel__title">
                <span class="metric-panel__label">{{ metric.label }}</span>
                <strong class="metric-panel__value">{{ formatMetricValue(metric.value) }}</strong>
              </div>
              <span v-if="metric.progress != null" class="metric-panel__badge">
                {{ metric.progress }}%
              </span>
            </div>

            <p class="metric-panel__detail">{{ metric.detail }}</p>

            <div v-if="metric.progress != null" class="metric-panel__progress">
              <div class="metric-panel__progress-meta">
                <span>{{ metric.progressLabel }}</span>
                <span>{{ metric.progress }}%</span>
              </div>
              <div class="metric-panel__progress-track" role="presentation">
                <span :style="{ width: `${metric.progress}%` }" />
              </div>
            </div>

            <p class="metric-panel__insight">{{ metric.insight }}</p>
          </article>
        </div>

        <section class="metrics-drawer__shortcuts" aria-labelledby="metrics-shortcuts-title">
          <h3 id="metrics-shortcuts-title">Acesso rápido</h3>
          <div class="metrics-drawer__links">
            <RouterLink
              v-for="item in shortcuts"
              :key="item.to"
              class="clinical-shortcut clinical-shortcut--drawer"
              :to="item.to"
              @click="metricsDrawerOpen = false"
            >
              <span class="clinical-shortcut__icon" aria-hidden="true">
                <i :class="item.icon" />
              </span>
              <span class="clinical-shortcut__copy">
                <strong>{{ item.label }}</strong>
                <small>{{ item.description }}</small>
              </span>
              <i class="pi pi-arrow-right clinical-shortcut__arrow" aria-hidden="true" />
            </RouterLink>
          </div>
        </section>
      </div>
    </Drawer>
  </section>
</template>

<style scoped>
.clinical-home {
  color: var(--dash-text);
}

.clinical-home--strip {
  padding: 0.7rem 0.95rem;
  border: 1px solid var(--dash-line);
  border-radius: 0.9rem;
  background: var(--dash-card);
}

.clinical-home--dashboard {
  display: grid;
  gap: 1rem;
  padding: 1.15rem 1.2rem;
  border: 1px solid var(--dash-line);
  border-radius: 1rem;
  background: var(--dash-card);
  box-shadow: 0 14px 34px rgb(var(--dash-shadow-rgb) / 0.05);
}

.clinical-home__eyebrow {
  margin: 0 0 0.1rem;
  color: var(--dash-faint);
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.clinical-strip__main {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.clinical-strip__identity {
  flex: 0 0 auto;
  min-width: 0;
}

.clinical-strip__identity h2,
.clinical-dashboard__header h2 {
  margin: 0;
  font-size: clamp(1rem, 1.8vw, 1.2rem);
  font-weight: 700;
  letter-spacing: -0.02em;
}

.clinical-strip__chips {
  display: flex;
  flex: 1 1 auto;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
  min-width: 0;
}

.clinical-strip__chips li {
  display: contents;
}

.clinical-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.34rem 0.62rem;
  border: 1px solid var(--dash-line-soft);
  border-radius: 999px;
  background: color-mix(in srgb, var(--dash-primary-soft) 10%, var(--dash-card));
  color: inherit;
  font: inherit;
  font-size: 0.74rem;
  cursor: pointer;
  transition:
    border-color 140ms ease,
    background 140ms ease,
    transform 140ms ease;
}

.clinical-chip:hover,
.clinical-chip:focus-visible {
  border-color: color-mix(in srgb, var(--dash-primary) 24%, var(--dash-line));
  background: color-mix(in srgb, var(--dash-primary-soft) 22%, var(--dash-card));
  transform: translateY(-1px);
  outline: none;
}

.clinical-chip__icon {
  display: grid;
  width: 1.35rem;
  height: 1.35rem;
  place-items: center;
  border-radius: 999px;
  background: color-mix(in srgb, var(--dash-primary) 12%, var(--dash-card));
  color: var(--dash-primary-strong);
  font-size: 0.62rem;
}

.clinical-chip strong {
  font-size: 0.82rem;
  line-height: 1;
}

.clinical-chip span {
  color: var(--dash-muted);
}

.clinical-chip[data-tone='success'] {
  background: color-mix(in srgb, var(--dash-success-bg) 50%, var(--dash-card));
}

.clinical-chip[data-tone='attention'] {
  background: color-mix(in srgb, var(--dash-amber-bg) 50%, var(--dash-card));
}

.clinical-chip[data-tone='danger'] {
  background: color-mix(in srgb, var(--dash-warm-bg) 50%, var(--dash-card));
}

.clinical-strip__cta {
  flex: 0 0 auto;
  margin-left: auto;
}

.clinical-dashboard__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.clinical-dashboard__date {
  margin: 0.25rem 0 0;
  color: var(--dash-muted);
  font-size: 0.84rem;
  text-transform: capitalize;
}

.clinical-dashboard__agenda-link {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 0.85rem;
  border: 1px solid var(--dash-line);
  border-radius: 0.7rem;
  background: var(--dash-surface);
  color: var(--dash-primary-strong);
  font-size: 0.84rem;
  font-weight: 650;
  text-decoration: none;
  white-space: nowrap;
}

.clinical-dashboard__agenda-link:hover,
.clinical-dashboard__agenda-link:focus-visible {
  border-color: color-mix(in srgb, var(--dash-primary) 28%, var(--dash-line));
  background: color-mix(in srgb, var(--dash-primary-soft) 18%, var(--dash-card));
  outline: none;
}

.clinical-dashboard__kpis {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.clinical-kpi {
  display: grid;
  gap: 0.4rem;
  padding: 0.9rem 0.95rem;
  border: 1px solid var(--dash-line);
  border-radius: 0.9rem;
  background: var(--dash-surface);
}

.clinical-kpi[data-tone='success'] {
  background: color-mix(in srgb, var(--dash-success-bg) 42%, var(--dash-card));
}

.clinical-kpi[data-tone='attention'] {
  background: color-mix(in srgb, var(--dash-amber-bg) 42%, var(--dash-card));
}

.clinical-kpi[data-tone='danger'] {
  background: color-mix(in srgb, var(--dash-warm-bg) 42%, var(--dash-card));
}

.clinical-kpi__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  color: var(--dash-muted);
  font-size: 0.78rem;
  font-weight: 600;
}

.clinical-kpi__icon {
  display: grid;
  width: 1.9rem;
  height: 1.9rem;
  place-items: center;
  border-radius: 0.55rem;
  background: color-mix(in srgb, var(--dash-primary) 12%, var(--dash-card));
  color: var(--dash-primary-strong);
  font-size: 0.8rem;
}

.clinical-kpi__value {
  font-size: clamp(1.45rem, 2vw, 1.75rem);
  line-height: 1.05;
  letter-spacing: -0.03em;
}

.clinical-kpi__detail {
  margin: 0;
  color: var(--dash-muted);
  font-size: 0.76rem;
}

.clinical-dashboard__charts {
  display: grid;
  gap: 0.85rem;
  grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
}

.clinical-chart-card {
  display: grid;
  gap: 0.85rem;
  padding: 1rem 1.05rem;
  border: 1px solid var(--dash-line);
  border-radius: 0.95rem;
  background: var(--dash-surface);
}

.clinical-chart-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.clinical-chart-card__head h3 {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 700;
}

.clinical-chart-card__head p {
  margin: 0.2rem 0 0;
  color: var(--dash-muted);
  font-size: 0.78rem;
}

.clinical-chart-card__badge {
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--dash-primary-soft) 24%, var(--dash-card));
  color: var(--dash-primary-strong);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.hourly-chart {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 0.45rem;
  align-items: end;
  min-height: 11rem;
  padding-top: 0.35rem;
}

.hourly-chart__column {
  display: grid;
  gap: 0.45rem;
  align-content: end;
  height: 100%;
}

.hourly-chart__bar-wrap {
  display: flex;
  align-items: flex-end;
  height: 8.5rem;
  padding: 0 0.15rem;
  border-radius: 0.55rem;
  background: color-mix(in srgb, var(--dash-line) 55%, transparent);
}

.hourly-chart__bar {
  display: block;
  width: 100%;
  min-height: 0.45rem;
  border-radius: 0.45rem 0.45rem 0.15rem 0.15rem;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--dash-primary) 88%, white),
    var(--dash-primary-strong)
  );
  transition: height 280ms ease;
}

.hourly-chart__label {
  color: var(--dash-muted);
  font-size: 0.72rem;
  text-align: center;
}

.completion-ring {
  position: relative;
  display: grid;
  place-items: center;
  width: min(100%, 11rem);
  margin: 0 auto;
}

.completion-ring svg {
  width: 100%;
  height: auto;
  transform: rotate(-90deg);
}

.completion-ring__track {
  fill: none;
  stroke: var(--dash-line);
  stroke-width: 10;
}

.completion-ring__value {
  fill: none;
  stroke: var(--dash-success-text);
  stroke-width: 10;
  stroke-linecap: round;
  transition: stroke-dashoffset 320ms ease;
}

.completion-ring__center {
  position: absolute;
  display: grid;
  gap: 0.1rem;
  text-align: center;
}

.completion-ring__center strong {
  font-size: 1.55rem;
  line-height: 1;
  letter-spacing: -0.03em;
}

.completion-ring__center span {
  color: var(--dash-muted);
  font-size: 0.74rem;
}

.clinical-chart-card__footnote {
  margin: 0;
  color: var(--dash-muted);
  font-size: 0.8rem;
  text-align: center;
}

.clinical-dashboard__lower {
  display: grid;
  gap: 0.85rem;
  grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr);
}

.clinical-progress-card,
.clinical-shortcuts-card {
  padding: 1rem 1.05rem;
  border: 1px solid var(--dash-line);
  border-radius: 0.95rem;
  background: var(--dash-surface);
}

.clinical-progress-card__head h3,
.clinical-shortcuts-card h3 {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 700;
}

.clinical-progress-card__head p,
.clinical-shortcuts-card > p {
  margin: 0.2rem 0 0;
  color: var(--dash-muted);
  font-size: 0.78rem;
  line-height: 1.45;
}

.clinical-progress-card__stack {
  display: flex;
  height: 0.55rem;
  margin-top: 0.85rem;
  border-radius: 999px;
  overflow: hidden;
  background: var(--dash-line);
}

.clinical-progress-card__segment {
  min-width: 0.35rem;
  transition: width 280ms ease;
}

.clinical-progress-card__segment[data-tone='success'] {
  background: var(--dash-success-text);
}

.clinical-progress-card__segment[data-tone='attention'] {
  background: var(--dash-amber-text);
}

.clinical-progress-card__segment[data-tone='danger'] {
  background: var(--dash-warm-text);
}

.clinical-progress-card__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem 1rem;
  margin: 0.65rem 0 0;
  padding: 0;
  list-style: none;
}

.clinical-progress-card__legend li {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--dash-muted);
  font-size: 0.76rem;
}

.clinical-progress-card__legend li::before {
  content: '';
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 999px;
  background: var(--dash-primary);
}

.clinical-progress-card__legend li[data-tone='success']::before {
  background: var(--dash-success-text);
}

.clinical-progress-card__legend li[data-tone='attention']::before {
  background: var(--dash-amber-text);
}

.clinical-progress-card__legend li[data-tone='danger']::before {
  background: var(--dash-warm-text);
}

.clinical-progress-card__legend strong {
  color: var(--dash-text);
}

.clinical-progress-card__metrics {
  display: grid;
  gap: 0.65rem;
  margin-top: 0.9rem;
}

.metric-panel {
  display: grid;
  gap: 0.55rem;
  padding: 0.85rem 0.9rem;
  border: 1px solid var(--dash-line);
  border-radius: 0.85rem;
  background: color-mix(in srgb, var(--dash-primary-soft) 8%, var(--dash-card));
}

.metric-panel[data-tone='success'] {
  background: color-mix(in srgb, var(--dash-success-bg) 45%, var(--dash-card));
}

.metric-panel[data-tone='attention'] {
  background: color-mix(in srgb, var(--dash-amber-bg) 45%, var(--dash-card));
}

.metric-panel[data-tone='danger'] {
  background: color-mix(in srgb, var(--dash-warm-bg) 45%, var(--dash-card));
}

.metric-panel__head {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}

.metric-panel__icon {
  display: grid;
  width: 2.1rem;
  height: 2.1rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.65rem;
  background: color-mix(in srgb, var(--dash-primary) 14%, var(--dash-card));
  color: var(--dash-primary-strong);
}

.metric-panel[data-tone='success'] .metric-panel__icon {
  background: var(--dash-success-bg);
  color: var(--dash-success-text);
}

.metric-panel[data-tone='attention'] .metric-panel__icon {
  background: var(--dash-amber-bg);
  color: var(--dash-amber-text);
}

.metric-panel[data-tone='danger'] .metric-panel__icon {
  background: var(--dash-warm-bg);
  color: var(--dash-warm-text);
}

.metric-panel__label {
  display: block;
  color: var(--dash-muted);
  font-size: 0.74rem;
}

.metric-panel__value {
  font-size: 1.25rem;
  line-height: 1.1;
}

.metric-panel__detail {
  margin: 0;
  color: var(--dash-text);
  font-size: 0.82rem;
  font-weight: 600;
}

.metric-panel__progress-meta {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.3rem;
  color: var(--dash-muted);
  font-size: 0.72rem;
}

.metric-panel__progress-track {
  height: 0.35rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--dash-line) 70%, transparent);
  overflow: hidden;
}

.metric-panel__progress-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--dash-primary);
}

.metric-panel[data-tone='success'] .metric-panel__progress-track span {
  background: var(--dash-success-text);
}

.metric-panel[data-tone='attention'] .metric-panel__progress-track span {
  background: var(--dash-amber-text);
}

.metric-panel[data-tone='danger'] .metric-panel__progress-track span {
  background: var(--dash-warm-text);
}

.metric-panel__insight {
  margin: 0;
  color: var(--dash-muted);
  font-size: 0.76rem;
  line-height: 1.4;
}

.metric-panel--drawer .metric-panel__head {
  align-items: flex-start;
}

.metric-panel__title {
  flex: 1 1 auto;
  min-width: 0;
}

.metric-panel__badge {
  padding: 0.2rem 0.45rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--dash-primary-soft) 24%, var(--dash-card));
  color: var(--dash-primary-strong);
  font-size: 0.68rem;
  font-weight: 700;
}

.metric-panel[data-tone='success'] .metric-panel__badge {
  background: var(--dash-success-bg);
  color: var(--dash-success-text);
}

.metric-panel[data-tone='attention'] .metric-panel__badge {
  background: var(--dash-amber-bg);
  color: var(--dash-amber-text);
}

.metric-panel[data-tone='danger'] .metric-panel__badge {
  background: var(--dash-warm-bg);
  color: var(--dash-warm-text);
}

.metrics-drawer__header h2 {
  margin: 0.15rem 0 0;
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.metrics-drawer__eyebrow {
  margin: 0;
  color: var(--dash-muted);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.metrics-drawer__subtitle {
  margin: 0.35rem 0 0;
  color: var(--dash-muted);
  font-size: 0.82rem;
  line-height: 1.45;
}

.metrics-drawer__body {
  display: grid;
  gap: 0.9rem;
}

.metrics-drawer__summary {
  display: grid;
  gap: 0.65rem;
  grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
}

.metrics-drawer__ring-card,
.metrics-drawer__stack-card,
.metrics-drawer__chart-card {
  padding: 0.85rem 0.9rem;
  border: 1px solid var(--dash-line);
  border-radius: 0.9rem;
  background: var(--dash-surface);
}

.metrics-drawer__ring-card {
  display: grid;
  gap: 0.45rem;
  justify-items: center;
  text-align: center;
}

.metrics-drawer__ring-card p {
  margin: 0;
  color: var(--dash-muted);
  font-size: 0.76rem;
  line-height: 1.4;
}

.completion-ring--compact {
  width: min(100%, 6.5rem);
}

.metrics-drawer__stack-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.55rem;
}

.metrics-drawer__stack-head h3 {
  margin: 0;
  font-size: 0.84rem;
  font-weight: 700;
}

.metrics-drawer__stack-head span {
  color: var(--dash-muted);
  font-size: 0.72rem;
  font-weight: 600;
}

.clinical-progress-card__legend--compact {
  margin-top: 0.55rem;
  gap: 0.45rem 0.75rem;
}

.hourly-chart--compact {
  min-height: 7.5rem;
}

.hourly-chart--compact .hourly-chart__bar-wrap {
  height: 5.5rem;
}

.metrics-drawer__metrics {
  display: grid;
  gap: 0.65rem;
}

.metrics-drawer__shortcuts h3 {
  margin: 0 0 0.55rem;
  font-size: 0.88rem;
  font-weight: 700;
}

.metrics-drawer__links {
  display: grid;
  gap: 0.5rem;
}

.clinical-shortcut--drawer {
  grid-template-columns: auto 1fr auto;
}

.clinical-shortcuts-card__links {
  display: grid;
  gap: 0.55rem;
  margin-top: 0.85rem;
}

.clinical-shortcut {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.7rem;
  padding: 0.75rem 0.8rem;
  border: 1px solid var(--dash-line);
  border-radius: 0.8rem;
  background: var(--dash-card);
  color: inherit;
  text-decoration: none;
  transition:
    border-color 140ms ease,
    background 140ms ease,
    transform 140ms ease;
}

.clinical-shortcut:hover,
.clinical-shortcut:focus-visible {
  border-color: color-mix(in srgb, var(--dash-primary) 28%, var(--dash-line));
  background: color-mix(in srgb, var(--dash-primary-soft) 16%, var(--dash-card));
  transform: translateY(-1px);
  outline: none;
}

.clinical-shortcut__icon {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border-radius: 0.6rem;
  background: color-mix(in srgb, var(--dash-primary) 14%, var(--dash-card));
  color: var(--dash-primary-strong);
}

.clinical-shortcut__copy {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
}

.clinical-shortcut__copy strong {
  font-size: 0.84rem;
}

.clinical-shortcut__copy small {
  color: var(--dash-muted);
  font-size: 0.74rem;
}

.clinical-shortcut__arrow {
  color: var(--dash-faint);
  font-size: 0.75rem;
}

@media (max-width: 1100px) {
  .clinical-dashboard__kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .clinical-strip__main {
    flex-wrap: wrap;
  }

  .clinical-strip__cta {
    width: 100%;
    margin-left: 0;
  }

  .clinical-dashboard__header {
    flex-direction: column;
  }

  .clinical-dashboard__charts,
  .clinical-dashboard__lower {
    grid-template-columns: 1fr;
  }

  .metrics-drawer__summary {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .clinical-strip__chips {
    width: 100%;
  }

  .clinical-dashboard__kpis {
    grid-template-columns: 1fr;
  }

  .hourly-chart {
    gap: 0.3rem;
  }
}
</style>

<style>
.clinical-metrics-drawer {
  width: min(26rem, calc(100vw - 1.25rem)) !important;
}

.clinical-metrics-drawer .p-drawer-header {
  align-items: flex-start;
  padding: 1rem 1rem 0.35rem;
}

.clinical-metrics-drawer .p-drawer-content {
  padding: 0.35rem 1rem 1.1rem;
}
</style>
