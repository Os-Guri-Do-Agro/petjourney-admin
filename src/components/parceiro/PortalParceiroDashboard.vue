<script setup lang="ts">
import Skeleton from 'primevue/skeleton'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import IndicacaoQrBlock from '@/components/parceiro/IndicacaoQrBlock.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { useCupomResgateModal } from '@/composables/useCupomResgateModal'
import { usePartnerFocusSurface } from '@/composables/usePartnerFocusSurface'
import { CUPOM_FEATURE_ENABLED } from '@/features/cupom-feature'
import { getCarteira, getPortalIndicacao } from '@/service/parceiro/parceiro-portal-service'
import type { Carteira, PortalIndicacao } from '@/service/parceiro/types'
import { formatCentavosToBrl } from '@/utils/format/money'
import { currentColors } from '@/theme/color-mode'

const { t } = useI18n()
const toast = useToast()
const { store, ensureContext, parceiroQuery } = useParceiroPortal()
const { lastSuccessAt } = useCupomResgateModal()
const { focusSurfaceStyle } = usePartnerFocusSurface()

const indicacao = ref<PortalIndicacao | null>(null)
const carteira = ref<Carteira | null>(null)
const loadingHighlights = ref(true)
const error = ref('')

const isLoading = computed(
  () => loadingHighlights.value || store.loadState === 'loading' || store.loadState === 'idle',
)

const dashStyle = computed(() => {
  const colors = currentColors.value
  const focus = focusSurfaceStyle.value

  return {
    '--dash-card': colors.dashboard.surface,
    '--dash-surface': colors.dashboard.surfaceSoft,
    '--dash-line': colors.dashboard.line,
    '--dash-text': colors.dashboard.text,
    '--dash-muted': colors.dashboard.muted,
    '--dash-faint': colors.dashboard.faint,
    '--dash-primary': colors.vet.primary,
    '--dash-primary-soft': colors.vet.secondary,
    '--dash-primary-strong': colors.dashboard.primaryStrong,
    '--dash-primary-deep': colors.dashboard.primaryDeep,
    '--dash-commission-from': focus['--pf-from'],
    '--dash-commission-to': focus['--pf-to'],
    '--dash-commission-glow-rgb': focus['--pf-glow-rgb'],
    '--dash-success-text': colors.dashboard.successText,
    '--dash-on-primary': focus['--pf-on'],
    '--dash-commission-cta-bg': focus['--pf-cta-bg'],
    '--dash-commission-cta-text': focus['--pf-cta-text'],
    '--dash-shadow-rgb': colors.auth.shadowRgb,
    '--dash-amber-bg': colors.dashboard.amberBg,
    '--dash-amber-text': colors.dashboard.amberText,
  }
})

const totais = computed(() => store.dashboard?.totais)

/**
 * As três métricas do pulso são todas de cupom e resgate. Com a feature desligada
 * elas só mostravam zero para algo que ainda não existe, então a seção inteira sai
 * (mesmo critério já aplicado em Divulgação).
 */
const cupomFeatureEnabled = CUPOM_FEATURE_ENABLED

const metrics = computed(() => [
  {
    id: 'cupons',
    label: t('inicio.dash.metrics.cuponsAtivos'),
    value: totais.value?.cuponsAtivos ?? 0,
    hint: t('inicio.dash.metrics.cuponsHint'),
    icon: 'pi pi-ticket',
    tone: 'sage' as const,
  },
  {
    id: 'resgates-total',
    label: t('inicio.dash.metrics.resgatesTotal'),
    value: totais.value?.resgatesTotal ?? 0,
    hint: t('inicio.dash.metrics.resgatesTotalHint'),
    icon: 'pi pi-check-circle',
    tone: 'success' as const,
  },
  {
    id: 'resgates-30d',
    label: t('inicio.dash.metrics.resgates30d'),
    value: totais.value?.resgatesUltimos30d ?? 0,
    hint: t('inicio.dash.metrics.resgates30dHint'),
    icon: 'pi pi-chart-line',
    tone: 'deep' as const,
  },
])

const saldoSacavelLabel = computed(() =>
  carteira.value != null ? formatCentavosToBrl(carteira.value.saldoSacavelCentavos) : '-',
)

const saldoTotalLabel = computed(() =>
  carteira.value != null ? formatCentavosToBrl(carteira.value.saldoTotalCentavos) : '-',
)

const showCommissionCard = computed(() => store.statusAfiliadoAtivo)
const codigoIndicacao = computed(() => indicacao.value?.codigoIndicacao ?? '')
const qrImageUrl = computed(() => indicacao.value?.qrImageUrl ?? '')
const podeIndicar = computed(() => Boolean(indicacao.value?.podeIndicar))
/** Texto por status vindo do backend; a tela não escreve copy própria. */
const avisoIndicacao = computed(() => indicacao.value?.aviso ?? '')

async function loadDashboardData() {
  error.value = ''
  loadingHighlights.value = true

  try {
    await ensureContext()

    const [indicacaoData, carteiraData] = await Promise.all([
      getPortalIndicacao(parceiroQuery()),
      store.statusAfiliadoAtivo
        ? getCarteira(parceiroQuery()).catch(() => null)
        : Promise.resolve(null),
    ])

    indicacao.value = indicacaoData
    carteira.value = carteiraData
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('inicio.dash.errorLoad')
  } finally {
    loadingHighlights.value = false
  }
}

async function copyCodigo() {
  if (!codigoIndicacao.value) {
    return
  }

  try {
    await navigator.clipboard.writeText(codigoIndicacao.value)
    toast.add({
      severity: 'success',
      summary: t('inicio.dash.referral.toastCopied'),
      detail: codigoIndicacao.value,
      life: 2500,
    })
  } catch {
    toast.add({
      severity: 'warn',
      summary: t('inicio.dash.referral.toastCopyFail'),
      detail: t('inicio.dash.referral.toastCopyFailDetail'),
      life: 3500,
    })
  }
}

onMounted(() => {
  void loadDashboardData()
})

watch(lastSuccessAt, (at) => {
  if (!at) {
    return
  }

  void store.bootstrap(true).catch(() => undefined)
})
</script>

<template>
  <div class="partner-dash" :style="dashStyle">
    <div v-if="error" class="partner-dash__state partner-dash__state--error" role="alert">
      <p>{{ error }}</p>
      <button type="button" @click="loadDashboardData">{{ t('inicio.dash.retry') }}</button>
    </div>

    <template v-else>
      <section class="dash-zone" aria-labelledby="dash-focus-title">
        <header class="dash-zone__head">
          <div>
            <p class="dash-zone__index">01</p>
            <h2 id="dash-focus-title">{{ t('inicio.dash.focus.title') }}</h2>
          </div>
          <p>{{ t('inicio.dash.focus.lede') }}</p>
        </header>

        <div
          v-if="isLoading"
          class="dash-focus"
          role="status"
          aria-live="polite"
          aria-busy="true"
          :aria-label="t('inicio.dash.focus.loadingAria')"
        >
          <article class="commission-card commission-card--skeleton" aria-hidden="true">
            <div class="commission-card__glow" />
            <div class="commission-card__top">
              <Skeleton width="11rem" height="0.7rem" border-radius="4px" />
              <Skeleton width="4.5rem" height="1.45rem" border-radius="999px" />
            </div>
            <div class="commission-card__amount">
              <Skeleton width="9.5rem" height="2.15rem" border-radius="8px" />
              <Skeleton width="5.5rem" height="0.9rem" border-radius="4px" />
            </div>
            <div class="commission-card__meta">
              <Skeleton width="100%" height="0.85rem" border-radius="4px" />
              <Skeleton width="72%" height="0.85rem" border-radius="4px" />
            </div>
            <Skeleton
              class="commission-card__cta commission-card__cta--skeleton"
              width="8.5rem"
              height="2.65rem"
              border-radius="0.85rem"
            />
          </article>

          <article class="referral-card referral-card--skeleton" aria-hidden="true">
            <Skeleton
              class="referral-card__eyebrow referral-card__eyebrow--skeleton"
              width="9rem"
              height="0.7rem"
              border-radius="4px"
            />
            <div class="referral-card__code-row">
              <Skeleton
                class="referral-card__code referral-card__code--skeleton"
                width="8.5rem"
                height="2.5rem"
                border-radius="0.75rem"
              />
              <Skeleton width="2.5rem" height="2.5rem" border-radius="0.75rem" />
            </div>
            <div class="referral-card__meta">
              <Skeleton width="100%" height="0.85rem" border-radius="4px" />
              <Skeleton width="78%" height="0.85rem" border-radius="4px" />
            </div>
            <Skeleton
              class="referral-card__cta referral-card__cta--skeleton"
              width="100%"
              height="2.65rem"
              border-radius="0.85rem"
            />
          </article>
        </div>

        <div v-else class="dash-focus">
          <article v-if="showCommissionCard" class="commission-card">
            <div class="commission-card__glow" aria-hidden="true" />
            <div class="commission-card__top">
              <p class="commission-card__eyebrow">
                {{ t('inicio.dash.commission.eyebrowActive') }}
              </p>
              <span class="commission-card__badge">
                <i class="pi pi-wallet" aria-hidden="true" />
                {{ t('inicio.dash.commission.badge') }}
              </span>
            </div>
            <div class="commission-card__amount">
              <strong>{{ saldoSacavelLabel }}</strong>
              <span>{{ t('inicio.dash.commission.sacavelNow') }}</span>
            </div>
            <p class="commission-card__meta">
              {{ t('inicio.dash.commission.metaHold', { valor: saldoTotalLabel }) }}
            </p>
            <RouterLink class="commission-card__cta" to="/parceiro/carteira">
              {{ t('inicio.dash.commission.openWallet') }}
              <i class="pi pi-arrow-right" aria-hidden="true" />
            </RouterLink>
          </article>

          <article v-else class="commission-card commission-card--muted">
            <div class="commission-card__top">
              <p class="commission-card__eyebrow">{{ t('inicio.dash.commission.eyebrowMuted') }}</p>
              <span class="commission-card__badge commission-card__badge--muted">{{
                t('inicio.dash.commission.badgeMuted')
              }}</span>
            </div>
            <div class="commission-card__amount">
              <strong>{{ t('inicio.dash.commission.inactiveTitle') }}</strong>
            </div>
            <p class="commission-card__meta">
              {{ t('inicio.dash.commission.inactiveMeta') }}
            </p>
            <RouterLink
              class="commission-card__cta commission-card__cta--ghost"
              to="/parceiro/programas"
            >
              {{ t('inicio.dash.commission.seePrograms') }}
              <i class="pi pi-arrow-right" aria-hidden="true" />
            </RouterLink>
          </article>

          <article class="referral-card" :class="{ 'referral-card--with-qr': Boolean(qrImageUrl) }">
            <div class="referral-card__main">
              <p class="referral-card__eyebrow">{{ t('inicio.dash.referral.eyebrow') }}</p>

              <!-- Gate: sem cadastro aprovado (2026-07-29) ou sem Programa de
                   Afiliados ativo (2026-08-19) não há código nem QR. Mostrar o
                   aviso do backend em vez de um traço que parece código vazio. -->
              <template v-if="!podeIndicar">
                <p class="referral-card__espera">
                  <i class="pi pi-hourglass" aria-hidden="true" />
                  <span>{{ avisoIndicacao || t('inicio.dash.referral.esperaFallback') }}</span>
                </p>
                <RouterLink
                  class="referral-card__cta"
                  :to="{ path: '/parceiro/programas', hash: '#programas' }"
                >
                  {{ t('inicio.dash.referral.esperaCta') }}
                  <i class="pi pi-arrow-right" aria-hidden="true" />
                </RouterLink>
              </template>

              <template v-else>
                <div class="referral-card__code-row">
                  <strong class="referral-card__code">{{ codigoIndicacao }}</strong>
                  <button
                    v-if="codigoIndicacao"
                    class="referral-card__copy"
                    type="button"
                    :aria-label="t('inicio.dash.referral.copyAria')"
                    @click="copyCodigo"
                  >
                    <i class="pi pi-copy" aria-hidden="true" />
                  </button>
                </div>
                <p class="referral-card__meta">
                  {{ t('inicio.dash.referral.meta') }}
                </p>
                <RouterLink class="referral-card__cta" to="/parceiro/divulgacao">
                  {{ t('inicio.dash.referral.cta') }}
                  <i class="pi pi-arrow-right" aria-hidden="true" />
                </RouterLink>
              </template>
            </div>
            <IndicacaoQrBlock
              v-if="qrImageUrl && podeIndicar"
              class="referral-card__qr"
              :image-url="qrImageUrl"
              :code="codigoIndicacao"
              size="sm"
            />
          </article>
        </div>
      </section>

      <section v-if="cupomFeatureEnabled" class="dash-zone" aria-labelledby="dash-pulse-title">
        <header class="dash-zone__head">
          <div>
            <p class="dash-zone__index">02</p>
            <h2 id="dash-pulse-title">{{ t('inicio.dash.pulse.title') }}</h2>
          </div>
          <p>{{ t('inicio.dash.pulse.lede') }}</p>
        </header>

        <div
          v-if="isLoading"
          class="dash-metrics"
          role="status"
          aria-live="polite"
          aria-busy="true"
          :aria-label="t('inicio.dash.pulse.loadingAria')"
        >
          <article
            v-for="metric in metrics"
            :key="`skeleton-${metric.id}`"
            class="metric-card metric-card--skeleton"
            :class="`metric-card--${metric.tone}`"
            aria-hidden="true"
          >
            <div class="metric-card__head">
              <Skeleton width="6.5rem" height="0.75rem" border-radius="4px" />
              <Skeleton width="1.85rem" height="1.85rem" border-radius="0.65rem" />
            </div>
            <Skeleton
              class="metric-card__value metric-card__value--skeleton"
              width="3.25rem"
              height="2rem"
              border-radius="6px"
            />
            <Skeleton width="7rem" height="0.7rem" border-radius="4px" />
          </article>
        </div>

        <div v-else class="dash-metrics">
          <article
            v-for="metric in metrics"
            :key="metric.id"
            class="metric-card"
            :class="`metric-card--${metric.tone}`"
          >
            <div class="metric-card__head">
              <span>{{ metric.label }}</span>
              <span class="metric-card__icon" aria-hidden="true">
                <i :class="metric.icon" />
              </span>
            </div>
            <strong class="metric-card__value">{{ metric.value }}</strong>
            <p class="metric-card__hint">{{ metric.hint }}</p>
          </article>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.partner-dash {
  display: grid;
  gap: 1.65rem;
  width: 100%;
  max-width: 100%;
  overflow-x: clip;
}

.dash-zone {
  display: grid;
  gap: 0.9rem;
}

.dash-zone__head {
  display: grid;
  gap: 0.28rem;
  padding-bottom: 0.55rem;
  border-bottom: 1px solid color-mix(in srgb, var(--dash-line) 85%, transparent);
}

.dash-zone__head > div {
  display: flex;
  align-items: baseline;
  gap: 0.55rem;
}

.dash-zone__index {
  margin: 0;
  color: var(--dash-faint);
  font-size: 0.72rem;
  font-weight: 750;
  letter-spacing: 0.08em;
}

.dash-zone__head h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--dash-text);
}

.dash-zone__head > p {
  margin: 0;
  color: var(--dash-muted);
  font-size: 0.82rem;
  line-height: 1.4;
}

.partner-dash__state {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 1.2rem 1.25rem;
  border: 1px solid var(--dash-line);
  border-radius: 1.1rem;
  background: var(--dash-card);
  color: var(--dash-muted);
}

.partner-dash__state--error {
  flex-direction: column;
  align-items: flex-start;
  color: var(--dash-text);
}

.partner-dash__state--error p {
  margin: 0;
}

.partner-dash__state button {
  border: 1px solid var(--dash-line);
  border-radius: 0.7rem;
  padding: 0.45rem 0.85rem;
  background: var(--dash-card);
  color: var(--dash-text);
  cursor: pointer;
}

.commission-card--skeleton .commission-card__meta,
.referral-card--skeleton .referral-card__meta {
  display: grid;
  gap: 0.35rem;
  max-width: 30rem;
}

.commission-card__cta--skeleton,
.referral-card__cta--skeleton {
  display: block;
  margin-top: auto;
  pointer-events: none;
}

.referral-card__eyebrow--skeleton {
  display: block;
}

.referral-card__code--skeleton {
  display: block;
  min-height: 2.5rem;
  padding: 0;
  background: transparent;
}

.metric-card--skeleton {
  pointer-events: none;
}

.metric-card--skeleton:hover {
  transform: none;
  border-color: var(--dash-line);
  box-shadow: 0 12px 26px rgb(var(--dash-shadow-rgb) / 0.04);
}

.metric-card__value--skeleton {
  display: block;
}

.commission-card--skeleton :deep(.p-skeleton) {
  --p-skeleton-background: color-mix(in srgb, white 30%, transparent);
  --p-skeleton-animation-background: color-mix(in srgb, white 14%, transparent);
}

.referral-card--skeleton :deep(.p-skeleton),
.metric-card--skeleton :deep(.p-skeleton) {
  --p-skeleton-background: color-mix(in srgb, var(--dash-primary-soft) 42%, var(--dash-card));
  --p-skeleton-animation-background: color-mix(in srgb, var(--dash-primary-soft) 18%, transparent);
}

.dash-focus {
  display: grid;
  gap: 0.9rem;
  width: 100%;
  grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr);
  align-items: stretch;
}

.commission-card,
.referral-card {
  display: grid;
  gap: 0.7rem;
  align-content: start;
  min-height: 100%;
  padding: 1.25rem 1.3rem 1.3rem;
  border-radius: 1.2rem;
}

.commission-card {
  position: relative;
  overflow: hidden;
  border: 0;
  background:
    radial-gradient(
      circle at 88% -8%,
      rgb(var(--dash-commission-glow-rgb) / 0.28) 0%,
      rgb(var(--dash-commission-glow-rgb) / 0.08) 38%,
      transparent 64%
    ),
    linear-gradient(152deg, var(--dash-commission-from), var(--dash-commission-to));
  box-shadow: 0 18px 40px rgb(var(--dash-shadow-rgb) / 0.11);
  color: var(--dash-on-primary);
}

.commission-card--muted {
  background: linear-gradient(
    160deg,
    color-mix(in srgb, var(--dash-primary-soft) 28%, var(--dash-card)),
    var(--dash-card) 55%
  );
  border: 1px solid var(--dash-line);
  box-shadow: 0 12px 28px rgb(var(--dash-shadow-rgb) / 0.045);
  color: var(--dash-text);
}

.commission-card__glow {
  position: absolute;
  top: -4rem;
  right: 0;
  width: 11rem;
  max-width: 55%;
  height: 11rem;
  border-radius: 999px;
  background: rgb(var(--dash-commission-glow-rgb) / 0.14);
  pointer-events: none;
  transform: translateX(30%);
}

.commission-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.commission-card__eyebrow,
.referral-card__eyebrow {
  margin: 0;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.11em;
  text-transform: uppercase;
}

.commission-card__eyebrow {
  opacity: 0.9;
}

.commission-card--muted .commission-card__eyebrow,
.referral-card__eyebrow {
  color: var(--dash-faint);
  opacity: 1;
}

.commission-card__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.28rem 0.58rem;
  border-radius: 999px;
  background: rgb(var(--dash-commission-glow-rgb) / 0.18);
  font-size: 0.7rem;
  font-weight: 700;
  white-space: nowrap;
}

.commission-card__badge--muted {
  background: color-mix(in srgb, var(--dash-primary-soft) 28%, var(--dash-card));
  color: var(--dash-muted);
}

.commission-card__amount {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.35rem 0.55rem;
}

.commission-card__amount strong {
  font-size: clamp(1.7rem, 2.8vw, 2.15rem);
  letter-spacing: -0.04em;
  font-weight: 750;
}

.commission-card__amount span {
  font-size: 0.88rem;
  opacity: 0.88;
}

.commission-card--muted .commission-card__amount span {
  opacity: 1;
  color: var(--dash-muted);
}

.commission-card__meta,
.referral-card__meta {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.5;
}

/* Espera de aprovação: o aviso do backend ocupa o lugar do código. */
.referral-card__espera {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin: 0;
  padding: 0.65rem 0.75rem;
  border-radius: 0.8rem;
  background: color-mix(in srgb, var(--dash-surface) 70%, var(--dash-card));
  color: var(--dash-text);
  font-size: 0.85rem;
  font-weight: 600;
  line-height: 1.45;
}

.referral-card__espera i {
  margin-top: 0.15rem;
  color: var(--dash-primary-strong);
  font-size: 0.85rem;
}

.commission-card__meta {
  max-width: 30rem;
  opacity: 0.92;
}

.commission-card--muted .commission-card__meta,
.referral-card__meta {
  color: var(--dash-muted);
  opacity: 1;
}

.commission-card__cta,
.referral-card__cta {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  margin-top: auto;
  font-weight: 700;
  text-decoration: none;
  transition:
    transform 150ms ease,
    filter 150ms ease,
    background 150ms ease;
}

.commission-card__cta {
  width: fit-content;
  padding: 0.62rem 1rem;
  border-radius: 0.8rem;
  background: var(--dash-commission-cta-bg);
  color: var(--dash-commission-cta-text);
  font-size: 0.86rem;
}

.commission-card__cta i,
.referral-card__cta i {
  transition: transform 150ms ease;
}

.commission-card__cta:hover,
.commission-card__cta:focus-visible {
  transform: translateY(-1px);
  filter: brightness(1.03);
  outline: none;
}

.commission-card__cta:hover i,
.commission-card__cta:focus-visible i,
.referral-card__cta:hover i,
.referral-card__cta:focus-visible i {
  transform: translateX(2px);
}

.commission-card__cta--ghost {
  border: 1px solid var(--dash-line);
  background: var(--dash-card);
  color: var(--dash-primary-strong);
  filter: none;
}

.referral-card {
  display: grid;
  gap: 1rem;
  border: 1px solid var(--dash-line);
  background: linear-gradient(
    165deg,
    color-mix(in srgb, var(--dash-surface) 90%, var(--dash-card)),
    var(--dash-card)
  );
  box-shadow: 0 12px 28px rgb(var(--dash-shadow-rgb) / 0.045);
}

.referral-card--with-qr {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: stretch;
}

.referral-card__main {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  min-width: 0;
}

.referral-card__code-row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}

.referral-card__code {
  display: inline-flex;
  align-items: center;
  min-height: 2.5rem;
  padding: 0.35rem 0.8rem;
  border-radius: 0.75rem;
  background: color-mix(in srgb, var(--dash-primary-soft) 28%, var(--dash-card));
  color: var(--dash-primary-strong);
  font-size: clamp(1.15rem, 1.8vw, 1.4rem);
  letter-spacing: 0.08em;
  font-weight: 750;
}

.referral-card__copy {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  place-items: center;
  border: 1px solid var(--dash-line);
  border-radius: 0.75rem;
  background: var(--dash-card);
  color: var(--dash-muted);
  cursor: pointer;
  transition:
    background 140ms ease,
    border-color 140ms ease,
    color 140ms ease;
}

.referral-card__copy:hover,
.referral-card__copy:focus-visible {
  border-color: color-mix(in srgb, var(--dash-primary) 30%, var(--dash-line));
  background: color-mix(in srgb, var(--dash-primary-soft) 22%, var(--dash-card));
  color: var(--dash-primary-strong);
  outline: none;
}

.referral-card .referral-card__meta {
  max-width: 18rem;
}

.referral-card__cta {
  width: 100%;
  justify-content: center;
  min-height: 2.55rem;
  border-radius: 0.85rem;
  background: color-mix(in srgb, var(--dash-primary) 14%, var(--dash-card));
  color: var(--dash-primary-strong);
  font-size: 0.86rem;
}

.referral-card__cta:hover,
.referral-card__cta:focus-visible {
  background: color-mix(in srgb, var(--dash-primary) 22%, var(--dash-card));
  outline: none;
  transform: translateY(-1px);
}

.referral-card__qr {
  align-self: stretch;
}

.dash-metrics {
  display: grid;
  gap: 0.85rem;
  width: 100%;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.metric-card {
  display: grid;
  gap: 0.35rem;
  min-height: 8.2rem;
  padding: 1.05rem 1.1rem;
  border: 1px solid var(--dash-line);
  border-radius: 1.1rem;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--metric-accent, var(--dash-primary)) 8%, var(--dash-card)) 0%,
    var(--dash-card) 55%
  );
  box-shadow: 0 12px 26px rgb(var(--dash-shadow-rgb) / 0.04);
  transition:
    transform 160ms ease,
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.metric-card:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--metric-accent, var(--dash-primary)) 28%, var(--dash-line));
  box-shadow: 0 16px 30px rgb(var(--dash-shadow-rgb) / 0.065);
}

.metric-card--sage {
  --metric-accent: var(--dash-primary);
}

.metric-card--success {
  --metric-accent: var(--dash-success-text);
}

.metric-card--deep {
  --metric-accent: var(--dash-primary-deep);
}

.metric-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  color: var(--dash-muted);
  font-size: 0.8rem;
  font-weight: 650;
}

.metric-card__icon {
  display: grid;
  width: 2.1rem;
  height: 2.1rem;
  place-items: center;
  border-radius: 0.65rem;
  background: color-mix(in srgb, var(--metric-accent, var(--dash-primary)) 16%, var(--dash-card));
  color: var(--metric-accent, var(--dash-primary-strong));
  font-size: 0.86rem;
}

.metric-card__value {
  margin-top: 0.2rem;
  font-size: clamp(1.65rem, 2.5vw, 2rem);
  line-height: 1.05;
  letter-spacing: -0.04em;
  font-weight: 750;
}

.metric-card__hint {
  margin: 0;
  color: var(--dash-faint);
  font-size: 0.76rem;
}

@media (prefers-reduced-motion: reduce) {
  .metric-card:hover,
  .commission-card__cta:hover,
  .referral-card__cta:hover {
    transform: none;
  }
}

@media (max-width: 900px) {
  .dash-focus,
  .dash-metrics {
    grid-template-columns: 1fr;
  }

  .referral-card--with-qr {
    grid-template-columns: 1fr;
  }

  .referral-card__qr {
    width: min(100%, 12.5rem);
    justify-self: start;
  }
}
</style>
