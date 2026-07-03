<script setup lang="ts">
import Button from 'primevue/button'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import PartnerStatusBadge from '@/components/parceiro/PartnerStatusBadge.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { currentColors } from '@/theme/color-mode'

const { store } = useParceiroPortal()

const sectionStyle = computed(() => {
  const colors = currentColors.value

  return {
    '--dash-card': colors.dashboard.surface,
    '--dash-line': colors.dashboard.line,
    '--dash-muted': colors.dashboard.muted,
    '--dash-primary': colors.vet.primary,
    '--dash-primary-soft': colors.vet.secondary,
    '--dash-warm-bg': colors.dashboard.warmBg,
    '--dash-warm-text': colors.dashboard.warmText,
  }
})

const metrics = computed(() => {
  const totais = store.dashboard?.totais

  return [
    {
      label: 'Cupons ativos',
      value: String(totais?.cuponsAtivos ?? 0),
      detail: 'disponíveis para tutores',
    },
    {
      label: 'Resgates totais',
      value: String(totais?.resgatesTotal ?? 0),
      detail: 'desde o início',
    },
    {
      label: 'Últimos 30 dias',
      value: String(totais?.resgatesUltimos30d ?? 0),
      detail: 'resgates recentes',
    },
    {
      label: 'Credenciamento',
      value: store.status?.podeOperar ? 'Operável' : 'Bloqueado',
      detail: store.dashboard?.parceiro.statusAuditoria ?? '—',
    },
  ]
})

const quickLinks = [
  { label: 'Divulgação', to: '/parceiro/divulgacao', icon: 'pi pi-megaphone' },
  { label: 'Financeiro', to: '/parceiro/carteira', icon: 'pi pi-wallet', requiresAfiliado: true },
  { label: 'Equipe', to: '/parceiro/equipe', icon: 'pi pi-users' },
]

const visibleQuickLinks = computed(() =>
  quickLinks.filter((link) => !link.requiresAfiliado || store.statusAfiliadoAtivo),
)

const showPartnerBlock = computed(
  () => store.loadState === 'ready' || store.loadState === 'loading' || store.dashboard,
)
</script>

<template>
  <section
    v-if="showPartnerBlock"
    class="home-block"
    :style="sectionStyle"
    aria-labelledby="home-partner-title"
  >
    <header class="home-block__header">
      <div>
        <p class="home-block__eyebrow">Parceria</p>
        <h2 id="home-partner-title">{{ store.parceiroNome }}</h2>
        <p class="home-block__meta">
          Papel: <strong>{{ store.papel ?? '—' }}</strong>
          <span v-if="store.dashboard?.parceiro.cnpj">
            · CNPJ {{ store.dashboard.parceiro.cnpj }}</span
          >
        </p>
      </div>
      <PartnerStatusBadge
        v-if="store.dashboard"
        :status="store.dashboard.parceiro.statusAuditoria"
      />
    </header>

    <div v-if="!store.podeOperar" class="home-block__alert">
      <i class="pi pi-info-circle" aria-hidden="true" />
      <p>
        Credenciamento ainda não liberado.
        <RouterLink to="/parceiro/programas?aba=credenciamento">Acompanhar status</RouterLink>
        <template v-if="store.dashboard?.parceiro.motivoAuditoria">
          — {{ store.dashboard.parceiro.motivoAuditoria }}
        </template>
      </p>
    </div>

    <div class="home-block__metrics">
      <article v-for="metric in metrics" :key="metric.label" class="metric-card">
        <span>{{ metric.label }}</span>
        <strong>{{ metric.value }}</strong>
        <small>{{ metric.detail }}</small>
      </article>
    </div>

    <div class="home-block__links">
      <RouterLink v-for="link in visibleQuickLinks" :key="link.to" class="quick-link" :to="link.to">
        <i :class="link.icon" aria-hidden="true" />
        <span>{{ link.label }}</span>
      </RouterLink>
    </div>

    <Button
      v-if="!store.statusAfiliadoAtivo && store.podeOperar"
      as="router-link"
      label="Ativar programa afiliado"
      to="/parceiro/programas?aba=afiliado"
    />
  </section>
</template>

<style scoped>
.home-block {
  display: grid;
  gap: 1rem;
  padding: 1.2rem 1.25rem;
  border: 1px solid var(--dash-line);
  border-radius: 1rem;
  background: var(--dash-card);
}

.home-block__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.home-block__eyebrow {
  margin: 0 0 0.35rem;
  color: var(--dash-muted);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.home-block__header h2 {
  margin: 0;
  font-size: 1.25rem;
}

.home-block__meta {
  margin: 0.45rem 0 0;
  color: var(--dash-muted);
  font-size: 0.88rem;
}

.home-block__alert {
  display: flex;
  gap: 0.65rem;
  padding: 0.85rem 0.95rem;
  border-radius: 0.85rem;
  background: var(--dash-warm-bg);
  color: var(--dash-warm-text);
  font-size: 0.88rem;
}

.home-block__alert p {
  margin: 0;
}

.home-block__alert a {
  color: inherit;
  font-weight: 700;
}

.home-block__metrics {
  display: grid;
  gap: 0.65rem;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.metric-card {
  display: grid;
  gap: 0.15rem;
  padding: 0.85rem;
  border: 1px solid var(--dash-line);
  border-radius: 0.85rem;
  background: color-mix(in srgb, var(--dash-primary-soft) 8%, var(--dash-card));
}

.metric-card span,
.metric-card small {
  color: var(--dash-muted);
  font-size: 0.76rem;
}

.metric-card strong {
  font-size: 1.2rem;
}

.home-block__links {
  display: grid;
  gap: 0.55rem;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.quick-link {
  display: flex;
  min-height: 3.75rem;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.75rem;
  border: 1px solid var(--dash-line);
  border-radius: 0.8rem;
  background: color-mix(in srgb, var(--dash-primary-soft) 12%, var(--dash-card));
  color: inherit;
  font-size: 0.84rem;
  font-weight: 650;
  text-decoration: none;
}

.quick-link i {
  color: var(--dash-primary);
}

@media (max-width: 900px) {
  .home-block__metrics,
  .home-block__links {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .home-block__header {
    flex-direction: column;
  }

  .home-block__metrics,
  .home-block__links {
    grid-template-columns: 1fr;
  }
}
</style>
