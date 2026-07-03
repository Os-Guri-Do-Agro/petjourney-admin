<script setup lang="ts">
import Button from 'primevue/button'
import { computed } from 'vue'

import { currentColors } from '@/theme/color-mode'

withDefaults(
  defineProps<{
    title: string
    subtitle?: string
    loading?: boolean
    error?: string
    empty?: boolean
    emptyTitle?: string
    emptyDescription?: string
    emptyActionLabel?: string
  }>(),
  {
    subtitle: '',
    loading: false,
    error: '',
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

const pageStyle = computed(() => {
  const colors = currentColors.value

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
      <div v-if="$slots.actions" class="partner-page__actions">
        <slot name="actions" />
      </div>
    </header>

    <div v-if="loading" class="partner-page__state" role="status" aria-live="polite">
      <i class="pi pi-spin pi-spinner" aria-hidden="true" />
      <span>Carregando...</span>
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
  padding: 1.5rem 1.35rem 2rem;
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

.partner-page__state strong {
  display: block;
  margin-bottom: 0.25rem;
}

.partner-page__state p {
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.92rem;
}

@media (max-width: 720px) {
  .partner-page {
    padding: 1rem 0.85rem 1.5rem;
  }

  .partner-page__header {
    flex-direction: column;
  }
}
</style>
