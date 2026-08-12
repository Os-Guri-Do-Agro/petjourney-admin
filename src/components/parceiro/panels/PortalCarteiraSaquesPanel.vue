<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import PartnerPanelLoading from '@/components/parceiro/PartnerPanelLoading.vue'
import PartnerStatusBadge from '@/components/parceiro/PartnerStatusBadge.vue'
import PortalSaqueDetalheDrawer from '@/components/parceiro/PortalSaqueDetalheDrawer.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import { ApiError } from '@/service/api'
import { getSaques } from '@/service/parceiro/parceiro-portal-service'
import type { SaqueResumo } from '@/service/parceiro/types'
import { formatCentavosToBrl } from '@/utils/format/money'

type SaqueDayGroup = {
  dayKey: string
  label: string
  items: SaqueResumo[]
}

type SaqueMonthGroup = {
  monthKey: string
  label: string
  days: SaqueDayGroup[]
}

const emit = defineEmits<{
  needsProgramas: []
}>()

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const { ensureContext, parceiroQuery, store } = useParceiroPortal()
const saques = ref<SaqueResumo[]>([])
const loading = ref(true)
const error = ref('')
const drawerVisible = ref(false)
const selectedSaqueId = ref<string | null>(null)

const statusMap = {
  PENDENTE: 'SOLICITADO',
  PAGO: 'ATIVO',
  FALHA: 'REJEITADO',
} as const

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

const groupedSaques = computed((): SaqueMonthGroup[] => {
  const monthMap = new Map<string, SaqueMonthGroup>()
  const dayMaps = new Map<string, Map<string, SaqueDayGroup>>()

  for (const saque of saques.value) {
    const date = new Date(saque.createdAt)
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

    dayGroup.items.push(saque)
  }

  return [...monthMap.values()]
})

function openSaqueDetail(id: string) {
  selectedSaqueId.value = id
  drawerVisible.value = true

  void router.replace({
    path: '/parceiro/carteira',
    query: { ...route.query, aba: 'saques', saque: id },
  })
}

function clearSaqueQuery() {
  if (!('saque' in route.query)) {
    return
  }

  const nextQuery = { ...route.query }
  delete nextQuery.saque
  void router.replace({
    path: '/parceiro/carteira',
    query: { ...nextQuery, aba: 'saques' },
  })
}

function syncSaqueFromQuery() {
  const saqueQuery = route.query.saque
  const id = typeof saqueQuery === 'string' ? saqueQuery : null

  if (!id) {
    if (drawerVisible.value) {
      drawerVisible.value = false
      selectedSaqueId.value = null
    }
    return
  }

  selectedSaqueId.value = id
  drawerVisible.value = true
}

async function loadSaques() {
  loading.value = true
  error.value = ''

  try {
    await ensureContext()

    if (!store.statusAfiliadoAtivo) {
      emit('needsProgramas')
      return
    }

    saques.value = await getSaques(parceiroQuery())
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 409) {
      emit('needsProgramas')
      return
    }

    /** 403 aqui pode ser o parceiro excluído no meio da sessão: a tela de saída assume. */
    if (await store.revalidarAcesso(err)) {
      return
    }

    error.value = err instanceof Error ? err.message : t('carteira.saques.errorLoad')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadSaques()
  syncSaqueFromQuery()
})

watch(
  () => route.query.saque,
  () => {
    syncSaqueFromQuery()
  },
)

watch(drawerVisible, (open) => {
  if (!open) {
    selectedSaqueId.value = null
    clearSaqueQuery()
  }
})
</script>

<template>
  <div id="partner-panel-saques" class="portal-panel" role="tabpanel" aria-labelledby="partner-tab-saques">
    <PartnerPanelLoading
      v-if="loading"
      :title="t('carteira.saques.loadingTitle')"
      :description="t('carteira.saques.loadingDesc')"
    />

    <div v-else-if="error" class="portal-panel__state portal-panel__state--error" role="alert">
      <p>{{ error }}</p>
      <button type="button" @click="loadSaques">{{ t('carteira.saques.retry') }}</button>
    </div>

    <div v-else-if="saques.length === 0" class="portal-panel__empty">
      <i class="pi pi-wallet" aria-hidden="true" />
      <strong>{{ t('carteira.saques.emptyTitle') }}</strong>
      <p>{{ t('carteira.saques.emptyBody') }}</p>
    </div>

    <div v-else class="saques-timeline">
      <section
        v-for="month in groupedSaques"
        :key="month.monthKey"
        class="saques-month"
        :aria-label="month.label"
      >
        <header class="saques-month__head">
          <h3>{{ month.label }}</h3>
        </header>

        <div v-for="day in month.days" :key="day.dayKey" class="saques-day">
          <h4 class="saques-day__head">{{ day.label }}</h4>

          <div class="saques-list">
            <button
              v-for="saque in day.items"
              :key="saque.id"
              type="button"
              class="saque-row"
              @click="openSaqueDetail(saque.id)"
            >
              <div>
                <strong>{{ formatCentavosToBrl(saque.valorCentavos) }}</strong>
                <p>
                  {{ t('carteira.saques.requestedAt', { data: formatTime(saque.createdAt) }) }}
                </p>
                <p v-if="saque.motivoFalha" class="saque-row__fail">{{ saque.motivoFalha }}</p>
              </div>
              <PartnerStatusBadge :status="statusMap[saque.status]" />
            </button>
          </div>
        </div>
      </section>
    </div>

    <PortalSaqueDetalheDrawer v-model:visible="drawerVisible" :saque-id="selectedSaqueId" />
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

.portal-panel__state button {
  border: 1px solid var(--partner-line);
  border-radius: 0.6rem;
  padding: 0.45rem 0.85rem;
  background: var(--partner-card);
  cursor: pointer;
}

.portal-panel__empty strong {
  color: var(--partner-text, inherit);
}

.portal-panel__empty p {
  margin: 0;
  max-width: 24rem;
  font-size: 0.88rem;
}

.saques-timeline {
  display: grid;
  gap: 1.35rem;
}

.saques-month {
  display: grid;
  gap: 0.85rem;
}

.saques-month__head h3 {
  margin: 0;
  color: var(--partner-text);
  font-size: 0.95rem;
  font-weight: 750;
  letter-spacing: -0.01em;
  text-transform: capitalize;
}

.saques-day {
  display: grid;
  gap: 0.45rem;
}

.saques-day__head {
  margin: 0;
  padding: 0.15rem 0.15rem 0.05rem;
  color: var(--partner-muted);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.saques-list {
  display: grid;
  gap: 0.45rem;
}

.saque-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  width: 100%;
  padding: 0.85rem 1rem;
  border: 1px solid var(--partner-line);
  border-radius: 0.85rem;
  background: var(--partner-card);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.saque-row:hover,
.saque-row:focus-visible {
  border-color: var(--partner-primary-strong);
}

.saque-row:focus-visible {
  outline: 2px solid var(--partner-primary);
  outline-offset: 2px;
}

.saque-row p {
  margin: 0.15rem 0 0;
  color: var(--partner-muted);
  font-size: 0.8rem;
}

.saque-row__fail {
  color: var(--partner-warm-text) !important;
}
</style>
