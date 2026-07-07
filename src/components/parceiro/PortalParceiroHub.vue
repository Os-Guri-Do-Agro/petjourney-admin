<script setup lang="ts">
import Button from 'primevue/button'
import { computed, onMounted } from 'vue'

import PartnerStatusBadge from '@/components/parceiro/PartnerStatusBadge.vue'
import PortalAreaNav from '@/components/parceiro/PortalAreaNav.vue'
import PortalCredenciamentoSection from '@/components/parceiro/sections/PortalCredenciamentoSection.vue'
import PortalModoPanel from '@/components/parceiro/panels/PortalModoPanel.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { currentColors } from '@/theme/color-mode'

const { store, ensureContext } = useParceiroPortal()

const hubStyle = computed(() => {
  const colors = currentColors.value

  return {
    '--hub-card': colors.dashboard.surface,
    '--hub-surface': colors.dashboard.surfaceSoft,
    '--hub-line': colors.dashboard.line,
    '--hub-line-soft': colors.dashboard.lineSoft,
    '--hub-text': colors.dashboard.text,
    '--hub-muted': colors.dashboard.muted,
    '--hub-faint': colors.dashboard.faint,
    '--hub-primary': colors.vet.primary,
    '--hub-primary-soft': colors.vet.secondary,
    '--hub-primary-strong': colors.dashboard.primaryStrong,
    '--hub-warm-bg': colors.dashboard.warmBg,
    '--hub-warm-text': colors.dashboard.warmText,
    '--hub-shadow-rgb': colors.auth.shadowRgb,
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

onMounted(() => {
  void ensureContext()
})
</script>

<template>
  <div class="hub" :style="hubStyle">
    <div v-if="isLoading" class="hub__skeleton" aria-hidden="true">
      <div class="hub__skel hub__skel--hero" />
      <div class="hub__skel hub__skel--block" />
      <div class="hub__skel hub__skel--block" />
    </div>

    <div v-else-if="isError" class="hub__error" role="alert">
      <i class="pi pi-exclamation-triangle" aria-hidden="true" />
      <div>
        <strong>Não foi possível carregar a parceria</strong>
        <p>{{ store.errorMessage || 'Tente recarregar em instantes.' }}</p>
      </div>
      <Button label="Recarregar" severity="secondary" @click="ensureContext(true)" />
    </div>

    <template v-else>
      <header class="hub__hero">
        <div class="hub__hero-identity">
          <div class="hub__avatar" aria-hidden="true">{{ initials }}</div>
          <div>
            <p class="hub__eyebrow">Empresa parceira</p>
            <h2 class="hub__name">{{ store.parceiroNome }}</h2>
            <p class="hub__meta">
              <span>Papel <strong>{{ store.papel ?? '—' }}</strong></span>
              <span v-if="store.dashboard?.parceiro.cnpj">
                CNPJ <strong>{{ store.dashboard.parceiro.cnpj }}</strong>
              </span>
            </p>
          </div>
        </div>
        <PartnerStatusBadge
          v-if="store.dashboard"
          class="hub__hero-badge"
          :status="store.dashboard.parceiro.statusAuditoria"
        />
      </header>

      <PortalCredenciamentoSection />

      <section id="programas" class="hub-section" aria-labelledby="hub-programas-title">
        <header class="hub-section__head">
          <h3 id="hub-programas-title">Programas de Participação</h3>
          <p>Ative o programa afiliado ou participativo conforme o modelo da sua empresa.</p>
        </header>
        <div class="hub__programas">
          <PortalModoPanel id="programas-afiliado" modo="afiliado" embedded />
          <PortalModoPanel modo="participativo" embedded />
        </div>
      </section>

      <section class="hub-section" aria-labelledby="hub-areas-title">
        <header class="hub-section__head">
          <h3 id="hub-areas-title">Próximos passos</h3>
          <p>Divulgação, financeiro e equipe ficam em telas dedicadas para facilitar o foco.</p>
        </header>
        <PortalAreaNav />
      </section>
    </template>
  </div>
</template>

<style scoped>
.hub {
  display: grid;
  gap: 1.25rem;
}

.hub__skeleton {
  display: grid;
  gap: 0.85rem;
}

.hub__skel {
  border-radius: 1rem;
  background: linear-gradient(
    90deg,
    var(--hub-surface),
    var(--hub-line-soft),
    var(--hub-surface)
  );
  background-size: 200% 100%;
  animation: hub-pulse 1.4s ease-in-out infinite;
}

.hub__skel--hero {
  height: 6rem;
}

.hub__skel--block {
  height: 10rem;
}

@keyframes hub-pulse {
  0% {
    background-position: 200% 0;
  }

  100% {
    background-position: -200% 0;
  }
}

.hub__error {
  display: grid;
  justify-items: center;
  gap: 0.75rem;
  padding: 2rem 1.25rem;
  border: 1px solid var(--hub-line);
  border-radius: 1rem;
  background: var(--hub-warm-bg);
  color: var(--hub-warm-text);
  text-align: center;
}

.hub__error p {
  margin: 0.15rem 0 0;
  color: var(--hub-muted);
  font-size: 0.9rem;
}

.hub__hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.15rem 1.25rem;
  border: 1px solid var(--hub-line);
  border-radius: 1.1rem;
  background:
    radial-gradient(
      130% 220% at 0% 0%,
      color-mix(in srgb, var(--hub-primary) 14%, transparent),
      transparent 55%
    ),
    var(--hub-card);
  box-shadow: 0 12px 32px rgb(var(--hub-shadow-rgb) / 0.05);
}

.hub__hero-identity {
  display: flex;
  align-items: center;
  gap: 1rem;
  min-width: 0;
}

.hub__avatar {
  display: grid;
  width: 3rem;
  height: 3rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.95rem;
  background: color-mix(in srgb, var(--hub-primary) 22%, var(--hub-card));
  color: var(--hub-primary-strong);
  font-size: 0.95rem;
  font-weight: 700;
}

.hub__eyebrow {
  margin: 0 0 0.1rem;
  color: var(--hub-faint);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.hub__name {
  margin: 0;
  font-size: clamp(1.1rem, 2vw, 1.35rem);
  font-weight: 700;
  letter-spacing: -0.02em;
}

.hub__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.15rem 1rem;
  margin: 0.35rem 0 0;
  color: var(--hub-muted);
  font-size: 0.84rem;
}

.hub__meta strong {
  color: var(--hub-text);
}

.hub-section {
  display: grid;
  gap: 0.85rem;
  scroll-margin-top: 5rem;
}

.hub-section__head h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
}

.hub-section__head p {
  margin: 0.2rem 0 0;
  color: var(--hub-muted);
  font-size: 0.83rem;
}

.hub__programas {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (max-width: 720px) {
  .hub__hero {
    flex-direction: column;
    align-items: flex-start;
  }

  .hub__programas {
    grid-template-columns: 1fr;
  }
}
</style>
