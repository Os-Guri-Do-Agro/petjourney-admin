<script setup lang="ts">
import Button from 'primevue/button'
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'

import PartnerStatusBadge from '@/components/parceiro/PartnerStatusBadge.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import type { StatusModoParceiro } from '@/service/parceiro/types'
import { currentColors } from '@/theme/color-mode'

type StepTone = 'primary' | 'warm' | 'amber'

type NextStep = {
  id: string
  icon: string
  title: string
  description: string
  to: string
  ctaLabel: string
  tone: StepTone
}

const { store, ensureContext } = useParceiroPortal()

const panelStyle = computed(() => {
  const colors = currentColors.value

  return {
    '--visao-card': colors.dashboard.surface,
    '--visao-surface': colors.dashboard.surfaceSoft,
    '--visao-line': colors.dashboard.line,
    '--visao-line-soft': colors.dashboard.lineSoft,
    '--visao-text': colors.dashboard.text,
    '--visao-muted': colors.dashboard.muted,
    '--visao-faint': colors.dashboard.faint,
    '--visao-primary': colors.vet.primary,
    '--visao-primary-soft': colors.vet.secondary,
    '--visao-primary-strong': colors.dashboard.primaryStrong,
    '--visao-success-bg': colors.dashboard.successBg,
    '--visao-success-text': colors.dashboard.successText,
    '--visao-warm-bg': colors.dashboard.warmBg,
    '--visao-warm-text': colors.dashboard.warmText,
    '--visao-amber-bg': colors.dashboard.amberBg,
    '--visao-amber-text': colors.dashboard.amberText,
    '--visao-shadow-rgb': colors.auth.shadowRgb,
  }
})

const isLoading = computed(() => store.loadState === 'loading' && !store.dashboard)
const isError = computed(() => store.loadState === 'error')

const initials = computed(() => {
  const nome = store.parceiroNome || 'Parceiro'

  return (
    nome
      .split(' ')
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'PJ'
  )
})

const programStatus = computed(() => [
  {
    id: 'auditoria',
    label: 'Credenciamento',
    hint: 'Liberação para operar',
    status: store.dashboard?.parceiro.statusAuditoria ?? 'PENDENTE',
    to: '/parceiro/programas?aba=credenciamento',
  },
  {
    id: 'afiliado',
    label: 'Programa afiliado',
    hint: 'Comissão por indicação + carteira',
    status: store.status?.statusAfiliado ?? 'NAO_SOLICITADO',
    to: '/parceiro/programas?aba=afiliado',
  },
  {
    id: 'participativo',
    label: 'Programa participativo',
    hint: 'Selo e comunidade PetJourney',
    status: store.status?.statusParticipativo ?? 'NAO_SOLICITADO',
    to: '/parceiro/programas?aba=participativo',
  },
])

const divulgacaoMetrics = computed(() => {
  const totais = store.dashboard?.totais

  return [
    {
      id: 'cupons',
      label: 'Cupons ativos',
      value: totais?.cuponsAtivos ?? 0,
      hint: 'disponíveis para tutores',
      icon: 'pi pi-ticket',
      tone: 'primary' as const,
    },
    {
      id: 'resgates',
      label: 'Resgates totais',
      value: totais?.resgatesTotal ?? 0,
      hint: 'desde o início da parceria',
      icon: 'pi pi-check-circle',
      tone: 'success' as const,
    },
    {
      id: 'ultimos',
      label: 'Últimos 30 dias',
      value: totais?.resgatesUltimos30d ?? 0,
      hint: 'resgates recentes',
      icon: 'pi pi-chart-line',
      tone: 'amber' as const,
    },
  ]
})

function needsAfiliadoAction(status: StatusModoParceiro | undefined) {
  return status === 'NAO_SOLICITADO' || status === 'REJEITADO' || status === 'SUSPENSO'
}

const nextSteps = computed<NextStep[]>(() => {
  const steps: NextStep[] = []

  if (!store.podeOperar) {
    steps.push({
      id: 'credenciamento',
      icon: 'pi pi-shield',
      title: 'Credenciamento em análise',
      description:
        store.status?.motivoAuditoria ??
        'A equipe PetJourney está revisando o cadastro da sua empresa. Você é avisado quando liberar.',
      to: '/parceiro/programas?aba=credenciamento',
      ctaLabel: 'Ver detalhes',
      tone: 'warm',
    })

    return steps
  }

  const afiliadoStatus = store.status?.statusAfiliado

  if (needsAfiliadoAction(afiliadoStatus) && store.isDono) {
    steps.push({
      id: 'afiliado-solicitar',
      icon: 'pi pi-wallet',
      title: 'Ative o programa afiliado',
      description: 'Necessário para receber comissão por indicações e liberar a carteira.',
      to: '/parceiro/programas?aba=afiliado',
      ctaLabel: 'Solicitar afiliado',
      tone: 'primary',
    })
  } else if (afiliadoStatus === 'SOLICITADO') {
    steps.push({
      id: 'afiliado-analise',
      icon: 'pi pi-hourglass',
      title: 'Afiliado em análise',
      description: 'Aguardando aprovação para liberar carteira e comissões.',
      to: '/parceiro/programas?aba=afiliado',
      ctaLabel: 'Acompanhar',
      tone: 'amber',
    })
  }

  steps.push({
    id: 'divulgacao',
    icon: 'pi pi-megaphone',
    title: 'Compartilhe seu link de indicação',
    description: 'Cada tutor cadastrado pelo seu link fica vinculado à sua empresa.',
    to: '/parceiro/divulgacao?aba=indicacao',
    ctaLabel: 'Abrir divulgação',
    tone: 'primary',
  })

  if (afiliadoStatus === 'ATIVO') {
    steps.push({
      id: 'financeiro',
      icon: 'pi pi-money-bill',
      title: 'Acompanhar carteira',
      description: 'Saldo, extrato e solicitações de saque via PIX.',
      to: '/parceiro/carteira',
      ctaLabel: 'Abrir financeiro',
      tone: 'primary',
    })
  }

  return steps
})

onMounted(() => {
  void ensureContext()
})
</script>

<template>
  <section
    id="partner-panel-visao"
    class="visao"
    :style="panelStyle"
    role="tabpanel"
    aria-labelledby="partner-tab-visao"
  >
    <div v-if="isLoading" class="visao__skeleton" aria-hidden="true">
      <div class="skel skel--hero" />
      <div class="skel skel--row" />
      <div class="skel skel--metrics" />
      <div class="skel skel--row" />
    </div>

    <div v-else-if="isError" class="visao__error" role="alert">
      <i class="pi pi-exclamation-triangle" aria-hidden="true" />
      <div>
        <strong>Não foi possível carregar os dados</strong>
        <p>{{ store.errorMessage || 'Tente recarregar em instantes.' }}</p>
      </div>
      <Button label="Recarregar" severity="secondary" @click="ensureContext(true)" />
    </div>

    <template v-else>
      <header class="visao__hero">
        <div class="visao__hero-identity">
          <div class="visao__avatar" aria-hidden="true">{{ initials }}</div>
          <div class="visao__hero-text">
            <p class="visao__eyebrow">Empresa parceira</p>
            <h2 class="visao__name">{{ store.parceiroNome }}</h2>
            <p class="visao__meta">
              <span>Papel <strong>{{ store.papel ?? '—' }}</strong></span>
              <span v-if="store.dashboard?.parceiro.cnpj">
                CNPJ <strong>{{ store.dashboard.parceiro.cnpj }}</strong>
              </span>
            </p>
          </div>
        </div>

        <PartnerStatusBadge
          v-if="store.dashboard"
          class="visao__hero-badge"
          :status="store.dashboard.parceiro.statusAuditoria"
        />
      </header>

      <section class="visao__block" aria-labelledby="visao-programs-title">
        <header class="visao__block-head">
          <h3 id="visao-programs-title">Situação dos programas</h3>
          <p>Vínculos comerciais que sua empresa mantém com o PetJourney.</p>
        </header>

        <div class="visao__programs">
          <RouterLink
            v-for="item in programStatus"
            :key="item.id"
            class="program-row"
            :to="item.to"
          >
            <div>
              <strong>{{ item.label }}</strong>
              <p>{{ item.hint }}</p>
            </div>
            <PartnerStatusBadge :status="item.status" />
          </RouterLink>
        </div>
      </section>

      <section class="visao__block" aria-labelledby="visao-metrics-title">
        <header class="visao__block-head">
          <h3 id="visao-metrics-title">Divulgação em números</h3>
          <p>Como sua indicação e cupons estão performando.</p>
        </header>

        <div class="visao__metrics">
          <article
            v-for="metric in divulgacaoMetrics"
            :key="metric.id"
            class="metric"
            :data-tone="metric.tone"
          >
            <span class="metric__icon">
              <i :class="metric.icon" aria-hidden="true" />
            </span>
            <div>
              <p class="metric__label">{{ metric.label }}</p>
              <strong class="metric__value">{{ metric.value }}</strong>
              <small class="metric__hint">{{ metric.hint }}</small>
            </div>
          </article>
        </div>
      </section>

      <section class="visao__block" aria-labelledby="visao-steps-title">
        <header class="visao__block-head">
          <h3 id="visao-steps-title">Próximos passos</h3>
          <p>Ações sugeridas para tirar mais valor da parceria.</p>
        </header>

        <div class="visao__steps">
          <RouterLink
            v-for="step in nextSteps"
            :key="step.id"
            class="step-card"
            :data-tone="step.tone"
            :to="step.to"
          >
            <span class="step-card__icon">
              <i :class="step.icon" aria-hidden="true" />
            </span>
            <div class="step-card__body">
              <strong>{{ step.title }}</strong>
              <p>{{ step.description }}</p>
            </div>
            <span class="step-card__cta">
              {{ step.ctaLabel }}
              <i class="pi pi-arrow-right" aria-hidden="true" />
            </span>
          </RouterLink>
        </div>
      </section>
    </template>
  </section>
</template>

<style scoped>
.visao {
  display: grid;
  gap: 1.15rem;
}

.visao__skeleton {
  display: grid;
  gap: 0.85rem;
}

.skel {
  border-radius: 1rem;
  background: linear-gradient(
    90deg,
    var(--visao-surface),
    var(--visao-line-soft),
    var(--visao-surface)
  );
  background-size: 200% 100%;
  animation: visao-pulse 1.4s ease-in-out infinite;
}

.skel--hero {
  height: 6.5rem;
}

.skel--row {
  height: 9.5rem;
}

.skel--metrics {
  height: 7rem;
}

@keyframes visao-pulse {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.visao__error {
  display: grid;
  justify-items: center;
  gap: 0.75rem;
  padding: 2.25rem 1.25rem;
  border: 1px solid var(--visao-line);
  border-radius: 1rem;
  background: var(--visao-warm-bg);
  color: var(--visao-warm-text);
  text-align: center;
}

.visao__error i {
  font-size: 1.6rem;
}

.visao__error strong {
  display: block;
  font-size: 0.98rem;
}

.visao__error p {
  margin: 0.15rem 0 0;
  color: var(--visao-muted);
  font-size: 0.9rem;
}

.visao__hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.2rem 1.3rem;
  border: 1px solid var(--visao-line);
  border-radius: 1.15rem;
  background:
    radial-gradient(
      130% 220% at 0% 0%,
      color-mix(in srgb, var(--visao-primary) 14%, transparent),
      transparent 55%
    ),
    var(--visao-card);
  box-shadow: 0 12px 32px rgb(var(--visao-shadow-rgb) / 0.05);
}

.visao__hero-identity {
  display: flex;
  align-items: center;
  gap: 1rem;
  min-width: 0;
}

.visao__hero-text {
  min-width: 0;
}

.visao__avatar {
  display: grid;
  width: 3.2rem;
  height: 3.2rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 1rem;
  background: color-mix(in srgb, var(--visao-primary) 22%, var(--visao-card));
  color: var(--visao-primary-strong);
  font-size: 0.98rem;
  font-weight: 700;
  letter-spacing: 0.03em;
}

.visao__eyebrow {
  margin: 0 0 0.15rem;
  color: var(--visao-faint);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.visao__name {
  margin: 0;
  font-size: clamp(1.15rem, 2vw, 1.4rem);
  font-weight: 700;
  letter-spacing: -0.02em;
}

.visao__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.15rem 1rem;
  margin: 0.4rem 0 0;
  color: var(--visao-muted);
  font-size: 0.84rem;
}

.visao__meta strong {
  color: var(--visao-text);
  font-weight: 700;
}

.visao__hero-badge {
  flex: 0 0 auto;
}

.visao__block {
  display: grid;
  gap: 0.9rem;
  padding: 1.15rem 1.2rem;
  border: 1px solid var(--visao-line);
  border-radius: 1.1rem;
  background: var(--visao-card);
}

.visao__block-head h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.015em;
}

.visao__block-head p {
  margin: 0.25rem 0 0;
  color: var(--visao-muted);
  font-size: 0.83rem;
}

.visao__programs {
  display: grid;
  gap: 0.55rem;
}

.program-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.8rem 0.95rem;
  border: 1px solid var(--visao-line-soft);
  border-radius: 0.9rem;
  background: var(--visao-surface);
  color: inherit;
  text-decoration: none;
  transition:
    border-color 160ms ease,
    transform 160ms ease,
    box-shadow 160ms ease;
}

.program-row:hover,
.program-row:focus-visible {
  border-color: color-mix(in srgb, var(--visao-primary) 32%, var(--visao-line));
  transform: translateY(-1px);
  box-shadow: 0 10px 24px rgb(var(--visao-shadow-rgb) / 0.06);
  outline: none;
}

.program-row strong {
  display: block;
  font-size: 0.92rem;
  font-weight: 650;
}

.program-row p {
  margin: 0.15rem 0 0;
  color: var(--visao-muted);
  font-size: 0.8rem;
}

.visao__metrics {
  display: grid;
  gap: 0.7rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.metric {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
  padding: 0.95rem 1rem;
  border: 1px solid var(--visao-line-soft);
  border-radius: 0.95rem;
  background: var(--visao-surface);
}

.metric__icon {
  display: grid;
  width: 2.4rem;
  height: 2.4rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.72rem;
  background: color-mix(in srgb, var(--visao-primary) 16%, var(--visao-card));
  color: var(--visao-primary-strong);
  font-size: 0.98rem;
}

.metric[data-tone='success'] .metric__icon {
  background: var(--visao-success-bg);
  color: var(--visao-success-text);
}

.metric[data-tone='amber'] .metric__icon {
  background: var(--visao-amber-bg);
  color: var(--visao-amber-text);
}

.metric__label {
  margin: 0;
  color: var(--visao-muted);
  font-size: 0.77rem;
  font-weight: 600;
}

.metric__value {
  display: block;
  margin-top: 0.05rem;
  font-size: 1.55rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.1;
}

.metric__hint {
  display: block;
  color: var(--visao-faint);
  font-size: 0.74rem;
}

.visao__steps {
  display: grid;
  gap: 0.65rem;
}

.step-card {
  display: grid;
  grid-template-columns: 2.65rem 1fr auto;
  align-items: center;
  gap: 0.9rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--visao-line-soft);
  border-radius: 0.95rem;
  background: var(--visao-surface);
  color: inherit;
  text-decoration: none;
  transition:
    border-color 160ms ease,
    transform 160ms ease;
}

.step-card:hover,
.step-card:focus-visible {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--visao-primary) 32%, var(--visao-line));
  outline: none;
}

.step-card__icon {
  display: grid;
  width: 2.65rem;
  height: 2.65rem;
  place-items: center;
  border-radius: 0.8rem;
  background: color-mix(in srgb, var(--visao-primary) 16%, var(--visao-card));
  color: var(--visao-primary-strong);
  font-size: 1rem;
}

.step-card[data-tone='warm'] .step-card__icon {
  background: var(--visao-warm-bg);
  color: var(--visao-warm-text);
}

.step-card[data-tone='amber'] .step-card__icon {
  background: var(--visao-amber-bg);
  color: var(--visao-amber-text);
}

.step-card__body strong {
  display: block;
  font-size: 0.93rem;
  font-weight: 650;
}

.step-card__body p {
  margin: 0.15rem 0 0;
  color: var(--visao-muted);
  font-size: 0.82rem;
}

.step-card__cta {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--visao-primary-strong);
  font-size: 0.82rem;
  font-weight: 700;
  white-space: nowrap;
}

@media (max-width: 900px) {
  .visao__metrics {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 640px) {
  .visao__hero {
    flex-direction: column;
    align-items: flex-start;
  }

  .visao__metrics {
    grid-template-columns: 1fr;
  }

  .step-card {
    grid-template-columns: 2.65rem 1fr;
  }

  .step-card__cta {
    grid-column: 1 / -1;
    justify-content: flex-end;
  }
}
</style>
