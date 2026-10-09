<script setup lang="ts">
import Button from 'primevue/button'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import PartnerPanelLoading from '@/components/parceiro/PartnerPanelLoading.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import { ApiError } from '@/service/api'
import { getCarteiraExtrato } from '@/service/parceiro/parceiro-portal-service'
import type { TransacaoCarteira } from '@/service/parceiro/types'
import { formatCentavosToBrl } from '@/utils/format/money'

type ExtratoDayGroup = {
  dayKey: string
  label: string
  items: TransacaoCarteira[]
}

type ExtratoMonthGroup = {
  monthKey: string
  label: string
  days: ExtratoDayGroup[]
}

const emit = defineEmits<{
  needsProgramas: []
}>()

const { t, locale } = useI18n()
const { ensureContext, parceiroQuery, store } = useParceiroPortal()
const items = ref<TransacaoCarteira[]>([])
const nextCursor = ref<string | null>(null)
const loading = ref(true)
const loadingMore = ref(false)
const error = ref('')

function intlLocale() {
  return INTL_LOCALE[locale.value as Locale]
}

function localDayKey(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function localMonthKey(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function formatDayLabel(date: Date) {
  const today = startOfLocalDay(new Date())
  const target = startOfLocalDay(date)
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86_400_000)

  if (diffDays === 0) {
    return t('carteira.extrato.today')
  }

  if (diffDays === 1) {
    return t('carteira.extrato.yesterday')
  }

  return new Intl.DateTimeFormat(intlLocale(), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date)
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat(intlLocale(), {
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(intlLocale(), {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

const groupedItems = computed((): ExtratoMonthGroup[] => {
  const monthMap = new Map<string, ExtratoMonthGroup>()
  const dayMaps = new Map<string, Map<string, ExtratoDayGroup>>()

  for (const item of items.value) {
    const date = new Date(item.createdAt)
    if (Number.isNaN(date.getTime())) {
      continue
    }

    const monthKey = localMonthKey(date)
    const dayKey = localDayKey(date)

    let monthGroup = monthMap.get(monthKey)
    if (!monthGroup) {
      monthGroup = { monthKey, label: formatMonthLabel(date), days: [] }
      monthMap.set(monthKey, monthGroup)
      dayMaps.set(monthKey, new Map())
    }

    const days = dayMaps.get(monthKey)!
    let dayGroup = days.get(dayKey)
    if (!dayGroup) {
      dayGroup = { dayKey, label: formatDayLabel(date), items: [] }
      days.set(dayKey, dayGroup)
      monthGroup.days.push(dayGroup)
    }

    dayGroup.items.push(item)
  }

  return [...monthMap.values()]
})

async function loadExtrato(cursor?: string) {
  if (cursor) {
    loadingMore.value = true
  } else {
    loading.value = true
    error.value = ''
  }

  try {
    await ensureContext()

    if (!store.statusAfiliadoAtivo) {
      emit('needsProgramas')
      return
    }

    const page = await getCarteiraExtrato({ ...parceiroQuery(), cursor, limit: 20 })

    if (cursor) {
      items.value = [...items.value, ...page.items]
    } else {
      items.value = page.items
    }

    nextCursor.value = page.nextCursor
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 409) {
      emit('needsProgramas')
      return
    }

    /** 403 aqui pode ser o parceiro excluído no meio da sessão: a tela de saída assume. */
    if (await store.revalidarAcesso(err)) {
      return
    }

    error.value = err instanceof Error ? err.message : t('carteira.extrato.errorLoad')
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

onMounted(() => {
  void loadExtrato()
})
</script>

<template>
  <div id="partner-panel-extrato" class="portal-panel" role="tabpanel" aria-labelledby="partner-tab-extrato">
    <PartnerPanelLoading
      v-if="loading"
      :title="t('carteira.extrato.loadingTitle')"
      :description="t('carteira.extrato.loadingDesc')"
    />

    <div v-else-if="error" class="portal-panel__state portal-panel__state--error" role="alert">
      <p>{{ error }}</p>
      <Button
        type="button"
        :label="t('carteira.extrato.retry')"
        icon="ph ph-arrow-clockwise"
        severity="secondary"
        outlined
        size="small"
        @click="loadExtrato()"
      />
    </div>

    <div v-else-if="items.length === 0" class="portal-panel__empty">
      <i class="ph ph-list-bullets" aria-hidden="true" />
      <strong>{{ t('carteira.extrato.emptyTitle') }}</strong>
      <p>{{ t('carteira.extrato.emptyBody') }}</p>
    </div>

    <template v-else>
      <div class="extrato-timeline">
        <section
          v-for="month in groupedItems"
          :key="month.monthKey"
          class="extrato-month"
          :aria-label="month.label"
        >
          <header class="extrato-month__head">
            <h3>{{ month.label }}</h3>
          </header>

          <div
            v-for="day in month.days"
            :key="day.dayKey"
            class="extrato-day"
          >
            <h4 class="extrato-day__head">{{ day.label }}</h4>

            <div class="extrato-list">
              <article v-for="item in day.items" :key="item.id" class="extrato-row">
                <div>
                  <strong>{{ t(`carteira.extrato.tipo.${item.tipo}`) }}</strong>
                  <p>
                    <span v-if="item.origem">{{ item.origem }}</span>
                    <span v-if="item.periodicidade"> · {{ item.periodicidade }}</span>
                  </p>
                </div>
                <div class="extrato-row__value">
                  <strong :class="{ 'is-negative': item.valorCentavos < 0 }">
                    {{ formatCentavosToBrl(item.valorCentavos, intlLocale()) }}
                  </strong>
                  <time :datetime="item.createdAt">{{ formatTime(item.createdAt) }}</time>
                </div>
              </article>
            </div>
          </div>
        </section>
      </div>

      <Button
        v-if="nextCursor"
        class="mt-2"
        :label="t('carteira.extrato.loadMore')"
        :loading="loadingMore"
        severity="secondary"
        @click="loadExtrato(nextCursor ?? undefined)"
      />
    </template>
  </div>
</template>

<style scoped>
.portal-panel__state,
.portal-panel__empty {
  display: grid;
  justify-items: center;
  gap: 0.5rem;
  padding: 2rem 1rem;
  color: var(--partner-muted);
  text-align: center;
}

.portal-panel__state--error p {
  margin: 0;
  color: var(--partner-warm-text);
}

.portal-panel__empty strong {
  color: var(--partner-text, inherit);
}

.portal-panel__empty p {
  margin: 0;
  max-width: 24rem;
  font-size: 0.88rem;
}

.extrato-timeline {
  display: grid;
  gap: 1.35rem;
}

.extrato-month {
  display: grid;
  gap: 0.85rem;
}

.extrato-month__head h3 {
  margin: 0;
  color: var(--partner-text);
  font-size: 0.95rem;
  font-weight: 750;
  letter-spacing: -0.01em;
}

/* Só a primeira letra: `capitalize` fazia "Setembro De 2026" (e "Septembar" no sérvio). */
.extrato-month__head h3::first-letter {
  text-transform: uppercase;
}

.extrato-day {
  display: grid;
  gap: 0.45rem;
}

.extrato-day__head {
  margin: 0;
  padding: 0.15rem 0.15rem 0.05rem;
  color: var(--partner-muted);
  font-size: 0.75rem;
  font-weight: 700;
}

/*
 * Um cartão por dia, e os lançamentos como linhas dele — como num extrato. Um cartão por
 * lançamento fazia uma tarde de três saques ocupar a tela inteira.
 */
.extrato-list {
  display: grid;
  overflow: hidden;
  border: 1px solid var(--partner-line);
  border-radius: 0.85rem;
  background: var(--partner-card);
}

.extrato-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
}

.extrato-row + .extrato-row {
  border-top: 1px solid var(--partner-line);
}

.extrato-row p {
  margin: 0.15rem 0 0;
  color: var(--partner-muted);
  font-size: 0.8rem;
}

.extrato-row__value {
  display: grid;
  justify-items: end;
  gap: 0.15rem;
  font-size: 0.8rem;
  color: var(--partner-muted);
}

.is-negative {
  color: var(--partner-warm-text);
}
</style>
