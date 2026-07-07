<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  getCarteira,
  getPortalIndicacao,
} from '@/service/parceiro/parceiro-portal-service'
import type { Carteira, PortalIndicacao } from '@/service/parceiro/types'
import { formatCentavosToBrl } from '@/utils/format/money'
import { currentColors, isDarkMode } from '@/theme/color-mode'

const { store, ensureContext, parceiroQuery } = useParceiroPortal()

const indicacao = ref<PortalIndicacao | null>(null)
const carteira = ref<Carteira | null>(null)
const loadingHighlights = ref(false)
const error = ref('')

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
    '--dash-commission-glow-rgb': '255 255 255',
    '--dash-success-bg': colors.dashboard.successBg,
    '--dash-success-text': colors.dashboard.successText,
    '--dash-on-primary': isDarkMode.value ? colors.text.primary : colors.auth.white,
    '--dash-commission-cta-bg': isDarkMode.value ? colors.text.primary : colors.auth.white,
    '--dash-commission-cta-text': isDarkMode.value
      ? colors.dashboard.primaryDeep
      : colors.dashboard.primaryStrong,
    '--dash-shadow-rgb': colors.auth.shadowRgb,
  }
})

const totais = computed(() => store.dashboard?.totais)

const metrics = computed(() => [
  {
    id: 'cupons',
    label: 'Cupons ativos',
    value: totais.value?.cuponsAtivos ?? 0,
    hint: 'Disponíveis para resgate',
    icon: 'pi pi-ticket',
  },
  {
    id: 'resgates-total',
    label: 'Resgates (total)',
    value: totais.value?.resgatesTotal ?? 0,
    hint: 'Desde o início',
    icon: 'pi pi-check-circle',
  },
  {
    id: 'resgates-30d',
    label: 'Resgates (30 dias)',
    value: totais.value?.resgatesUltimos30d ?? 0,
    hint: '',
    icon: 'pi pi-chart-line',
    trend: null as string | null,
  },
])

const saldoSacavelLabel = computed(() =>
  carteira.value != null ? formatCentavosToBrl(carteira.value.saldoSacavelCentavos) : '—',
)

const saldoTotalLabel = computed(() =>
  carteira.value != null ? formatCentavosToBrl(carteira.value.saldoTotalCentavos) : '—',
)

const showCommissionCard = computed(() => store.statusAfiliadoAtivo)

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

onMounted(() => {
  void loadDashboardData()
})
</script>

<template>
  <div class="partner-dash" :style="dashStyle">
    <p class="partner-dash__intro">
      Acompanhe seus cupons, indicações e comissões da rede PetJourney em um só lugar.
    </p>

    <div v-if="error" class="partner-dash__state partner-dash__state--error" role="alert">
      <p>{{ error }}</p>
      <button type="button" @click="loadDashboardData">Tentar novamente</button>
    </div>

    <template v-else>
      <div class="partner-dash__metrics">
        <article
          v-for="metric in metrics"
          :key="metric.id"
          class="metric-card"
        >
          <div class="metric-card__head">
            <span>{{ metric.label }}</span>
            <span class="metric-card__icon" aria-hidden="true">
              <i :class="metric.icon" />
            </span>
          </div>
          <strong class="metric-card__value">{{ metric.value }}</strong>
          <p v-if="metric.hint" class="metric-card__hint">{{ metric.hint }}</p>
          <span v-if="metric.trend" class="metric-card__trend">{{ metric.trend }}</span>
        </article>
      </div>

      <div v-if="loadingHighlights" class="partner-dash__state" role="status">
        <i class="pi pi-spin pi-spinner" aria-hidden="true" />
        <span>Carregando comissão e indicação...</span>
      </div>

      <div v-else class="partner-dash__highlights">
        <article v-if="showCommissionCard" class="commission-card">
          <div class="commission-card__glow" aria-hidden="true" />
          <p class="commission-card__eyebrow">Comissão · Afiliado ativo</p>
          <div class="commission-card__amount">
            <strong>{{ saldoSacavelLabel }}</strong>
            <span>sacável</span>
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
          <p class="commission-card__eyebrow">Comissão</p>
          <div class="commission-card__amount">
            <strong>Programa afiliado</strong>
          </div>
          <p class="commission-card__meta">
            Ative o programa afiliado para acompanhar saldo, extrato e saques via PIX.
          </p>
          <RouterLink class="commission-card__cta commission-card__cta--ghost" to="/parceiro/programas">
            Ver programas
            <i class="pi pi-arrow-right" aria-hidden="true" />
          </RouterLink>
        </article>

        <article class="referral-card">
          <p class="referral-card__eyebrow">Seu código</p>
          <strong class="referral-card__code">
            {{ indicacao?.codigoIndicacao ?? '—' }}
          </strong>
          <p class="referral-card__meta">
            Compartilhe e ganhe comissão por cada tutor que assinar.
          </p>
          <RouterLink class="referral-card__cta" to="/parceiro/divulgacao">
            Ver indicação
          </RouterLink>
        </article>
      </div>
    </template>
  </div>
</template>

<style scoped>
.partner-dash {
  display: grid;
  gap: 1.15rem;
}

.partner-dash__intro {
  margin: 0;
  max-width: 40rem;
  color: var(--dash-muted);
  font-size: 0.92rem;
  line-height: 1.55;
}

.partner-dash__state {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 1.25rem;
  border: 1px solid var(--dash-line);
  border-radius: 1rem;
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
  border-radius: 0.6rem;
  padding: 0.4rem 0.75rem;
  background: var(--dash-card);
  cursor: pointer;
}

.partner-dash__metrics {
  display: grid;
  gap: 0.85rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.metric-card {
  display: grid;
  gap: 0.45rem;
  padding: 1rem 1.05rem;
  border: 1px solid var(--dash-line);
  border-radius: 1rem;
  background: var(--dash-card);
  box-shadow: 0 12px 28px rgb(var(--dash-shadow-rgb) / 0.04);
}

.metric-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  color: var(--dash-muted);
  font-size: 0.8rem;
  font-weight: 600;
}

.metric-card__icon {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border-radius: 0.55rem;
  background: var(--dash-surface);
  color: var(--dash-faint);
  font-size: 0.85rem;
}

.metric-card__value {
  font-size: clamp(1.6rem, 2.5vw, 1.9rem);
  line-height: 1.1;
  letter-spacing: -0.03em;
}

.metric-card__hint {
  margin: 0;
  color: var(--dash-faint);
  font-size: 0.76rem;
}

.metric-card__trend {
  display: inline-flex;
  width: fit-content;
  padding: 0.18rem 0.5rem;
  border-radius: 999px;
  background: var(--dash-success-bg);
  color: var(--dash-success-text);
  font-size: 0.72rem;
  font-weight: 700;
}

.partner-dash__highlights {
  display: grid;
  gap: 0.85rem;
  grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr);
}

.commission-card {
  position: relative;
  display: grid;
  gap: 0.65rem;
  overflow: hidden;
  padding: 1.15rem 1.2rem;
  border-radius: 1rem;
  border: 1px solid color-mix(in srgb, var(--dash-commission-to) 72%, black);
  background:
    radial-gradient(
      circle at 92% 4%,
      rgb(var(--dash-commission-glow-rgb) / 0.24) 0%,
      rgb(var(--dash-commission-glow-rgb) / 0.08) 34%,
      transparent 62%
    ),
    linear-gradient(150deg, var(--dash-commission-from), var(--dash-commission-to));
  box-shadow: 0 16px 36px rgb(var(--dash-shadow-rgb) / 0.1);
  color: var(--dash-on-primary);
}

.commission-card--muted {
  background: var(--dash-card);
  border: 1px solid var(--dash-line);
  box-shadow: 0 12px 28px rgb(var(--dash-shadow-rgb) / 0.04);
  color: var(--dash-text);
}

.commission-card__glow {
  position: absolute;
  top: -3.5rem;
  right: -2.25rem;
  width: 9.5rem;
  height: 9.5rem;
  border-radius: 999px;
  background: rgb(var(--dash-commission-glow-rgb) / 0.16);
  pointer-events: none;
}

.commission-card__eyebrow {
  margin: 0;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  opacity: 0.88;
}

.commission-card--muted .commission-card__eyebrow {
  color: var(--dash-faint);
  opacity: 1;
}

.commission-card__amount {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.35rem 0.55rem;
}

.commission-card__amount strong {
  font-size: clamp(1.55rem, 2.5vw, 1.95rem);
  letter-spacing: -0.03em;
}

.commission-card__amount span {
  font-size: 0.88rem;
  opacity: 0.9;
}

.commission-card--muted .commission-card__amount span {
  opacity: 1;
  color: var(--dash-muted);
}

.commission-card__meta {
  margin: 0;
  max-width: 28rem;
  font-size: 0.84rem;
  line-height: 1.45;
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
  margin-top: 0.2rem;
  padding: 0.55rem 0.9rem;
  border-radius: 0.7rem;
  background: var(--dash-commission-cta-bg);
  color: var(--dash-commission-cta-text);
  font-size: 0.84rem;
  font-weight: 700;
  text-decoration: none;
}

.commission-card__cta--ghost {
  border: 1px solid var(--dash-line);
  background: var(--dash-card);
  color: var(--dash-primary-strong);
}

.referral-card {
  display: grid;
  gap: 0.55rem;
  align-content: start;
  padding: 1.15rem 1.2rem;
  border: 1px solid var(--dash-line);
  border-radius: 1rem;
  background: var(--dash-card);
}

.referral-card__eyebrow {
  margin: 0;
  color: var(--dash-faint);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.referral-card__code {
  font-size: clamp(1.35rem, 2vw, 1.65rem);
  letter-spacing: 0.05em;
}

.referral-card__meta {
  margin: 0;
  color: var(--dash-muted);
  font-size: 0.84rem;
  line-height: 1.45;
}

.referral-card__cta {
  display: inline-flex;
  width: 100%;
  align-items: center;
  justify-content: center;
  min-height: 2.55rem;
  margin-top: 0.35rem;
  border: 1px solid var(--dash-line);
  border-radius: 0.75rem;
  background: var(--dash-card);
  color: var(--dash-text);
  font-size: 0.86rem;
  font-weight: 650;
  text-decoration: none;
  transition:
    border-color 140ms ease,
    background 140ms ease;
}

.referral-card__cta:hover,
.referral-card__cta:focus-visible {
  border-color: color-mix(in srgb, var(--dash-primary) 28%, var(--dash-line));
  background: color-mix(in srgb, var(--dash-primary-soft) 18%, var(--dash-card));
  outline: none;
}

@media (max-width: 900px) {
  .partner-dash__metrics,
  .partner-dash__highlights {
    grid-template-columns: 1fr;
  }
}
</style>
