<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useToast } from 'primevue/usetoast'

import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  getCarteira,
  getPortalIndicacao,
} from '@/service/parceiro/parceiro-portal-service'
import type { Carteira, PortalIndicacao } from '@/service/parceiro/types'
import { formatCentavosToBrl } from '@/utils/format/money'
import { currentColors, isDarkMode } from '@/theme/color-mode'

const toast = useToast()
const { store, ensureContext, parceiroQuery } = useParceiroPortal()

const indicacao = ref<PortalIndicacao | null>(null)
const carteira = ref<Carteira | null>(null)
const loadingHighlights = ref(false)
const error = ref('')
const now = ref(new Date())
let clockId: ReturnType<typeof setInterval> | undefined

const dashStyle = computed(() => {
  const colors = currentColors.value

  return {
    '--dash-bg': colors.dashboard.bg,
    '--dash-card': colors.dashboard.surface,
    '--dash-surface': colors.dashboard.surfaceSoft,
    '--dash-line': colors.dashboard.line,
    '--dash-line-soft': colors.dashboard.lineSoft,
    '--dash-text': colors.dashboard.text,
    '--dash-muted': colors.dashboard.muted,
    '--dash-faint': colors.dashboard.faint,
    '--dash-primary': colors.vet.primary,
    '--dash-primary-soft': colors.vet.secondary,
    '--dash-primary-strong': colors.dashboard.primaryStrong,
    '--dash-primary-deep': colors.dashboard.primaryDeep,
    '--dash-commission-from': isDarkMode.value
      ? colors.dashboard.primaryDeep
      : colors.auth.sageStrong,
    '--dash-commission-to': isDarkMode.value ? colors.vet.secondary : colors.dashboard.primaryDeep,
    '--dash-commission-glow-rgb': isDarkMode.value ? '242 248 245' : '255 255 255',
    '--dash-success-bg': colors.dashboard.successBg,
    '--dash-success-text': colors.dashboard.successText,
    '--dash-on-primary': isDarkMode.value ? colors.text.primary : colors.auth.white,
    '--dash-commission-cta-bg': isDarkMode.value ? colors.text.primary : colors.auth.white,
    '--dash-commission-cta-text': isDarkMode.value
      ? colors.dashboard.primaryDeep
      : colors.dashboard.primaryStrong,
    '--dash-shadow-rgb': colors.auth.shadowRgb,
    '--dash-amber-bg': colors.dashboard.amberBg,
    '--dash-amber-text': colors.dashboard.amberText,
  }
})

const totais = computed(() => store.dashboard?.totais)

const todayLabel = computed(() =>
  now.value.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }),
)

const metrics = computed(() => [
  {
    id: 'cupons',
    label: 'Cupons ativos',
    value: totais.value?.cuponsAtivos ?? 0,
    hint: 'Prontos para resgate',
    icon: 'pi pi-ticket',
    tone: 'sage' as const,
  },
  {
    id: 'resgates-total',
    label: 'Resgates (total)',
    value: totais.value?.resgatesTotal ?? 0,
    hint: 'Desde o início',
    icon: 'pi pi-check-circle',
    tone: 'success' as const,
  },
  {
    id: 'resgates-30d',
    label: 'Resgates (30 dias)',
    value: totais.value?.resgatesUltimos30d ?? 0,
    hint: 'Último mês',
    icon: 'pi pi-chart-line',
    tone: 'deep' as const,
  },
])

const saldoSacavelLabel = computed(() =>
  carteira.value != null ? formatCentavosToBrl(carteira.value.saldoSacavelCentavos) : '—',
)

const saldoTotalLabel = computed(() =>
  carteira.value != null ? formatCentavosToBrl(carteira.value.saldoTotalCentavos) : '—',
)

const showCommissionCard = computed(() => store.statusAfiliadoAtivo)

const codigoIndicacao = computed(() => indicacao.value?.codigoIndicacao ?? '')

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
    error.value = err instanceof Error ? err.message : 'Não foi possível carregar o painel.'
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
      summary: 'Código copiado',
      detail: codigoIndicacao.value,
      life: 2500,
    })
  } catch {
    toast.add({
      severity: 'warn',
      summary: 'Não foi possível copiar',
      detail: 'Copie o código manualmente.',
      life: 3500,
    })
  }
}

onMounted(() => {
  void loadDashboardData()
  clockId = setInterval(() => {
    now.value = new Date()
  }, 60_000)
})

onUnmounted(() => {
  if (clockId) {
    clearInterval(clockId)
  }
})
</script>

<template>
  <div class="partner-dash" :style="dashStyle">
    <header class="partner-dash__intro">
      <p class="partner-dash__date">{{ todayLabel }}</p>
      <p class="partner-dash__lede">
        Acompanhe cupons, indicações e comissões da rede PetJourney em um só lugar.
      </p>
    </header>

    <div v-if="error" class="partner-dash__state partner-dash__state--error" role="alert">
      <p>{{ error }}</p>
      <button type="button" @click="loadDashboardData">Tentar novamente</button>
    </div>

    <template v-else>
      <section class="partner-dash__band" aria-labelledby="dash-pulse-title">
        <div class="partner-dash__band-head">
          <h2 id="dash-pulse-title">Pulso da rede</h2>
          <p>Indicadores da operação com cupons e resgates.</p>
        </div>

        <div class="partner-dash__metrics">
          <article
            v-for="(metric, index) in metrics"
            :key="metric.id"
            class="metric-card"
            :class="`metric-card--${metric.tone}`"
            :style="{ '--metric-delay': `${index * 40}ms` }"
          >
            <div class="metric-card__head">
              <span>{{ metric.label }}</span>
              <span class="metric-card__icon" aria-hidden="true">
                <i :class="metric.icon" />
              </span>
            </div>
            <strong class="metric-card__value">{{ metric.value }}</strong>
            <p v-if="metric.hint" class="metric-card__hint">{{ metric.hint }}</p>
          </article>
        </div>
      </section>

      <section class="partner-dash__band" aria-labelledby="dash-focus-title">
        <div class="partner-dash__band-head">
          <h2 id="dash-focus-title">Foco agora</h2>
          <p>Comissão e indicação — as ações que movem a parceria.</p>
        </div>

        <div v-if="loadingHighlights" class="partner-dash__state" role="status">
          <i class="pi pi-spin pi-spinner" aria-hidden="true" />
          <span>Carregando comissão e indicação...</span>
        </div>

        <div v-else class="partner-dash__highlights">
          <article v-if="showCommissionCard" class="commission-card">
            <div class="commission-card__glow" aria-hidden="true" />
            <div class="commission-card__top">
              <p class="commission-card__eyebrow">Comissão · Afiliado ativo</p>
              <span class="commission-card__badge">
                <i class="pi pi-wallet" aria-hidden="true" />
                Carteira
              </span>
            </div>
            <div class="commission-card__amount">
              <strong>{{ saldoSacavelLabel }}</strong>
              <span>sacável agora</span>
            </div>
            <p class="commission-card__meta">
              Saldo total de {{ saldoTotalLabel }} — parte em janela de segurança de 14 dias.
            </p>
            <RouterLink class="commission-card__cta" to="/parceiro/carteira">
              Abrir carteira
              <i class="pi pi-arrow-right" aria-hidden="true" />
            </RouterLink>
          </article>

          <article v-else class="commission-card commission-card--muted">
            <div class="commission-card__top">
              <p class="commission-card__eyebrow">Comissão</p>
              <span class="commission-card__badge commission-card__badge--muted">
                Não ativo
              </span>
            </div>
            <div class="commission-card__amount">
              <strong>Programa afiliado</strong>
            </div>
            <p class="commission-card__meta">
              Ative o programa afiliado para acompanhar saldo, extrato e saques via PIX.
            </p>
            <RouterLink
              class="commission-card__cta commission-card__cta--ghost"
              to="/parceiro/programas"
            >
              Ver programas
              <i class="pi pi-arrow-right" aria-hidden="true" />
            </RouterLink>
          </article>

          <article class="referral-card">
            <p class="referral-card__eyebrow">Seu código de indicação</p>
            <div class="referral-card__code-row">
              <strong class="referral-card__code">
                {{ codigoIndicacao || '—' }}
              </strong>
              <button
                v-if="codigoIndicacao"
                class="referral-card__copy"
                type="button"
                aria-label="Copiar código de indicação"
                @click="copyCodigo"
              >
                <i class="pi pi-copy" aria-hidden="true" />
              </button>
            </div>
            <p class="referral-card__meta">
              Compartilhe e ganhe comissão por cada tutor que assinar.
            </p>
            <RouterLink class="referral-card__cta" to="/parceiro/divulgacao">
              Ver indicação
              <i class="pi pi-arrow-right" aria-hidden="true" />
            </RouterLink>
          </article>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.partner-dash {
  display: grid;
  gap: 1.55rem;
}

.partner-dash__intro {
  display: grid;
  gap: 0.35rem;
}

.partner-dash__date {
  margin: 0;
  color: var(--dash-faint);
  font-size: 0.78rem;
  font-weight: 650;
  letter-spacing: 0.02em;
  text-transform: capitalize;
}

.partner-dash__lede {
  margin: 0;
  max-width: 38rem;
  color: var(--dash-muted);
  font-size: 0.95rem;
  line-height: 1.55;
}

.partner-dash__band {
  display: grid;
  gap: 0.85rem;
}

.partner-dash__band-head h2 {
  margin: 0;
  font-size: 0.98rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--dash-text);
}

.partner-dash__band-head p {
  margin: 0.2rem 0 0;
  color: var(--dash-muted);
  font-size: 0.84rem;
  line-height: 1.4;
}

.partner-dash__state {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 1.25rem;
  border: 1px solid var(--dash-line);
  border-radius: 1.15rem;
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

.partner-dash__metrics {
  display: grid;
  gap: 0.85rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.metric-card {
  position: relative;
  display: grid;
  gap: 0.4rem;
  padding: 1.1rem 1.15rem 1.05rem;
  border: 1px solid var(--dash-line);
  border-radius: 1.15rem;
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--metric-accent, var(--dash-primary)) 8%, var(--dash-card)) 0%,
      var(--dash-card) 52%
    );
  box-shadow: 0 14px 30px rgb(var(--dash-shadow-rgb) / 0.045);
  overflow: hidden;
  animation: dash-rise 420ms ease both;
  animation-delay: var(--metric-delay, 0ms);
  transition:
    transform 160ms ease,
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.metric-card:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--metric-accent, var(--dash-primary)) 28%, var(--dash-line));
  box-shadow: 0 18px 34px rgb(var(--dash-shadow-rgb) / 0.07);
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
  width: 2.15rem;
  height: 2.15rem;
  place-items: center;
  border-radius: 0.7rem;
  background: color-mix(in srgb, var(--metric-accent, var(--dash-primary)) 16%, var(--dash-card));
  color: var(--metric-accent, var(--dash-primary-strong));
  font-size: 0.88rem;
}

.metric-card__value {
  font-size: clamp(1.75rem, 2.8vw, 2.15rem);
  line-height: 1.05;
  letter-spacing: -0.04em;
  font-weight: 750;
}

.metric-card__hint {
  margin: 0;
  color: var(--dash-faint);
  font-size: 0.76rem;
}

.partner-dash__highlights {
  display: grid;
  gap: 0.9rem;
  grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
}

.commission-card {
  position: relative;
  display: grid;
  gap: 0.7rem;
  align-content: start;
  overflow: hidden;
  min-height: 100%;
  padding: 1.3rem 1.35rem 1.35rem;
  border-radius: 1.25rem;
  border: 0;
  background:
    radial-gradient(
      circle at 88% -8%,
      rgb(var(--dash-commission-glow-rgb) / 0.28) 0%,
      rgb(var(--dash-commission-glow-rgb) / 0.08) 38%,
      transparent 64%
    ),
    linear-gradient(152deg, var(--dash-commission-from), var(--dash-commission-to));
  box-shadow: 0 20px 42px rgb(var(--dash-shadow-rgb) / 0.12);
  color: var(--dash-on-primary);
  animation: dash-rise 480ms ease both;
  animation-delay: 80ms;
}

.commission-card--muted {
  background:
    linear-gradient(
      160deg,
      color-mix(in srgb, var(--dash-primary-soft) 28%, var(--dash-card)),
      var(--dash-card) 55%
    );
  border: 1px solid var(--dash-line);
  box-shadow: 0 14px 30px rgb(var(--dash-shadow-rgb) / 0.05);
  color: var(--dash-text);
}

.commission-card__glow {
  position: absolute;
  top: -4rem;
  right: -2.5rem;
  width: 11rem;
  height: 11rem;
  border-radius: 999px;
  background: rgb(var(--dash-commission-glow-rgb) / 0.14);
  pointer-events: none;
}

.commission-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.commission-card__eyebrow {
  margin: 0;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.11em;
  text-transform: uppercase;
  opacity: 0.9;
}

.commission-card--muted .commission-card__eyebrow {
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
  background: var(--dash-amber-bg);
  color: var(--dash-amber-text);
}

.commission-card__amount {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.35rem 0.55rem;
}

.commission-card__amount strong {
  font-size: clamp(1.75rem, 3vw, 2.25rem);
  letter-spacing: -0.04em;
  font-weight: 750;
}

.commission-card__amount span {
  font-size: 0.9rem;
  opacity: 0.88;
}

.commission-card--muted .commission-card__amount span {
  opacity: 1;
  color: var(--dash-muted);
}

.commission-card__meta {
  margin: 0;
  max-width: 30rem;
  font-size: 0.86rem;
  line-height: 1.5;
  opacity: 0.92;
}

.commission-card--muted .commission-card__meta {
  color: var(--dash-muted);
  opacity: 1;
}

.commission-card__cta {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 0.45rem;
  margin-top: 0.35rem;
  padding: 0.62rem 1rem;
  border-radius: 0.8rem;
  background: var(--dash-commission-cta-bg);
  color: var(--dash-commission-cta-text);
  font-size: 0.86rem;
  font-weight: 700;
  text-decoration: none;
  transition:
    transform 150ms ease,
    filter 150ms ease;
}

.commission-card__cta i {
  transition: transform 150ms ease;
}

.commission-card__cta:hover,
.commission-card__cta:focus-visible {
  transform: translateY(-1px);
  filter: brightness(1.03);
  outline: none;
}

.commission-card__cta:hover i,
.commission-card__cta:focus-visible i {
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
  gap: 0.65rem;
  align-content: start;
  padding: 1.3rem 1.25rem 1.25rem;
  border: 1px solid var(--dash-line);
  border-radius: 1.25rem;
  background:
    linear-gradient(
      165deg,
      color-mix(in srgb, var(--dash-surface) 90%, var(--dash-card)),
      var(--dash-card)
    );
  box-shadow: 0 14px 30px rgb(var(--dash-shadow-rgb) / 0.045);
  animation: dash-rise 480ms ease both;
  animation-delay: 120ms;
}

.referral-card__eyebrow {
  margin: 0;
  color: var(--dash-faint);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.11em;
  text-transform: uppercase;
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
  font-size: clamp(1.2rem, 2vw, 1.45rem);
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

.referral-card__meta {
  margin: 0;
  color: var(--dash-muted);
  font-size: 0.84rem;
  line-height: 1.5;
}

.referral-card__cta {
  display: inline-flex;
  width: 100%;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 2.65rem;
  margin-top: 0.25rem;
  border: 1px solid transparent;
  border-radius: 0.85rem;
  background: color-mix(in srgb, var(--dash-primary) 14%, var(--dash-card));
  color: var(--dash-primary-strong);
  font-size: 0.86rem;
  font-weight: 700;
  text-decoration: none;
  transition:
    background 140ms ease,
    transform 140ms ease;
}

.referral-card__cta i {
  transition: transform 140ms ease;
}

.referral-card__cta:hover,
.referral-card__cta:focus-visible {
  background: color-mix(in srgb, var(--dash-primary) 22%, var(--dash-card));
  outline: none;
  transform: translateY(-1px);
}

.referral-card__cta:hover i,
.referral-card__cta:focus-visible i {
  transform: translateX(2px);
}

@keyframes dash-rise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .metric-card,
  .commission-card,
  .referral-card {
    animation: none;
  }

  .metric-card:hover,
  .commission-card__cta:hover,
  .referral-card__cta:hover {
    transform: none;
  }
}

@media (max-width: 900px) {
  .partner-dash__metrics,
  .partner-dash__highlights {
    grid-template-columns: 1fr;
  }
}
</style>
