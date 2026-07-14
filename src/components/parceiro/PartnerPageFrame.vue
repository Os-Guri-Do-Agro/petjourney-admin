<script setup lang="ts">
import Button from 'primevue/button'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { hasVeterinarioProfile } from '@/service/auth/auth-session'
import { currentColors, isDarkMode } from '@/theme/color-mode'

withDefaults(
  defineProps<{
    title: string
    subtitle?: string
    loading?: boolean
    error?: string
    /** Conta sem membership de Parceiro (API 403). */
    noPartnerAccess?: boolean
    empty?: boolean
    emptyTitle?: string
    emptyDescription?: string
    emptyActionLabel?: string
  }>(),
  {
    subtitle: '',
    loading: false,
    error: '',
    noPartnerAccess: false,
    empty: false,
    emptyTitle: 'Nada por aqui ainda',
    emptyDescription: '',
    emptyActionLabel: '',
  },
)

const emit = defineEmits<{
  retry: []
  emptyAction: []
}>()

const showClinicalCta = computed(() => hasVeterinarioProfile())

const pageStyle = computed(() => {
  const colors = currentColors.value
  const dark = isDarkMode.value

  return {
    '--partner-bg': colors.dashboard.bg,
    '--partner-card': colors.dashboard.surface,
    '--partner-surface': colors.dashboard.surfaceSoft,
    '--partner-line': colors.dashboard.line,
    '--partner-text': colors.dashboard.text,
    '--partner-muted': colors.dashboard.muted,
    '--partner-faint': colors.dashboard.faint,
    '--partner-primary': colors.vet.primary,
    '--partner-primary-soft': colors.vet.secondary,
    '--partner-primary-strong': colors.dashboard.primaryStrong,
    '--partner-on-primary': dark ? colors.dashboard.bg : colors.auth.white,
    '--partner-warm-bg': colors.dashboard.warmBg,
    '--partner-warm-text': colors.dashboard.warmText,
    '--partner-success-bg': colors.dashboard.successBg,
    '--partner-success-text': colors.dashboard.successText,
    '--partner-amber-bg': colors.dashboard.amberBg,
    '--partner-amber-text': colors.dashboard.amberText,
    '--partner-shadow-rgb': colors.auth.shadowRgb,
  }
})
</script>

<template>
  <section class="partner-page" :style="pageStyle">
    <header class="partner-page__header">
      <div>
        <p v-if="subtitle" class="partner-page__subtitle">{{ subtitle }}</p>
        <h1 class="partner-page__title">{{ title }}</h1>
      </div>
      <div v-if="$slots.actions && !noPartnerAccess" class="partner-page__actions">
        <slot name="actions" />
      </div>
    </header>

    <div v-if="loading" class="partner-page__state" role="status" aria-live="polite">
      <i class="pi pi-spin pi-spinner" aria-hidden="true" />
      <span>Carregando...</span>
    </div>

    <div
      v-else-if="noPartnerAccess"
      class="partner-page__state partner-page__state--blocked"
      role="status"
    >
      <i class="pi pi-building" aria-hidden="true" />
      <div>
        <strong>Portal do parceiro ainda não liberado</strong>
        <p>
          Sua conta ainda não está vinculada a uma empresa parceira operável. Solicite afiliado
          e/ou participativo em Programas — o time PetJourney analisa e libera o acesso.
        </p>
        <p class="partner-page__hint">
          Se você já pediu, aguarde a análise ou verifique novamente em instantes. Também é possível
          um admin vincular sua conta manualmente.
        </p>
      </div>

      <div class="partner-page__cta-row">
        <RouterLink class="partner-page__cta partner-page__cta--primary" to="/parceiro/programas">
          Solicitar programas
        </RouterLink>
        <RouterLink
          v-if="showClinicalCta"
          class="partner-page__cta partner-page__cta--ghost"
          to="/settings?aba=perfil"
        >
          Ir para configurações
        </RouterLink>
        <Button label="Verificar novamente" severity="secondary" @click="emit('retry')" />
      </div>

      <p class="partner-page__contact">
        Dúvidas:
        <a href="mailto:atendimento@petjourney.health">atendimento@petjourney.health</a>
      </p>
    </div>

    <div v-else-if="error" class="partner-page__state partner-page__state--error" role="alert">
      <i class="pi pi-exclamation-circle" aria-hidden="true" />
      <div>
        <strong>Não foi possível carregar</strong>
        <p>{{ error }}</p>
      </div>
      <Button label="Tentar novamente" severity="secondary" @click="emit('retry')" />
    </div>

    <div v-else-if="empty" class="partner-page__state partner-page__state--empty">
      <i class="pi pi-inbox" aria-hidden="true" />
      <div>
        <strong>{{ emptyTitle }}</strong>
        <p v-if="emptyDescription">{{ emptyDescription }}</p>
      </div>
      <Button
        v-if="emptyActionLabel"
        :label="emptyActionLabel"
        @click="emit('emptyAction')"
      />
    </div>

    <div v-else class="partner-page__body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.partner-page {
  min-height: calc(100vh - 4.25rem);
  max-width: 100%;
  padding: 1.5rem 1.35rem 2rem;
  overflow-x: clip;
  background: var(--partner-bg);
  color: var(--partner-text);
}

.partner-page__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.35rem;
}

.partner-page__subtitle {
  margin: 0 0 0.2rem;
  color: var(--partner-faint);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.partner-page__title {
  margin: 0;
  font-size: clamp(1.45rem, 2vw, 1.85rem);
  font-weight: 700;
  letter-spacing: -0.03em;
}

.partner-page__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.partner-page__body {
  display: grid;
  gap: 1rem;
}

.partner-page__state {
  display: grid;
  gap: 0.85rem;
  justify-items: center;
  max-width: 40rem;
  margin-inline: auto;
  padding: 3rem 1.5rem;
  border: 1px solid var(--partner-line);
  border-radius: 1.1rem;
  background: var(--partner-card);
  text-align: center;
}

.partner-page__state i {
  font-size: 1.5rem;
  color: var(--partner-primary-strong);
}

.partner-page__state--error i {
  color: var(--partner-warm-text);
}

.partner-page__state--blocked i {
  color: var(--partner-primary-strong);
}

.partner-page__state strong {
  display: block;
  margin-bottom: 0.35rem;
  font-size: 1.1rem;
}

.partner-page__state p {
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.92rem;
  line-height: 1.55;
}

.partner-page__hint {
  margin-top: 0.65rem !important;
  font-size: 0.86rem !important;
}

.partner-page__cta-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.65rem;
  margin-top: 0.35rem;
}

.partner-page__cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.6rem;
  padding: 0 1.1rem;
  border-radius: 0.75rem;
  font-size: 0.875rem;
  font-weight: 700;
  text-decoration: none;
}

.partner-page__cta--primary {
  background: var(--partner-primary);
  color: var(--partner-on-primary);
}

.partner-page__cta--ghost {
  border: 1px solid var(--partner-line);
  background: transparent;
  color: var(--partner-text);
}

.partner-page__contact {
  margin-top: 0.25rem !important;
  font-size: 0.82rem !important;
}

.partner-page__contact a {
  color: var(--partner-primary-strong);
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 2px;
}

@media (max-width: 720px) {
  .partner-page {
    padding: 1rem 0.85rem 1.5rem;
  }

  .partner-page__header {
    flex-direction: column;
  }

  .partner-page__cta-row {
    flex-direction: column;
    width: 100%;
  }

  .partner-page__cta-row :deep(.p-button),
  .partner-page__cta {
    width: 100%;
  }
}
</style>
