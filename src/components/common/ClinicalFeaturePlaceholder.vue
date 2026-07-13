<script setup lang="ts">
import { computed } from 'vue'

import { currentColors } from '@/theme/color-mode'

withDefaults(
  defineProps<{
    title: string
    description?: string
  }>(),
  {
    description:
      'A área clínica ainda não está integrada à API. Dados de demonstração foram desativados para o ambiente de produção.',
  },
)

const styleVars = computed(() => {
  const colors = currentColors.value

  return {
    '--placeholder-card': colors.dashboard.surface,
    '--placeholder-line': colors.dashboard.line,
    '--placeholder-text': colors.dashboard.text,
    '--placeholder-muted': colors.dashboard.muted,
    '--placeholder-primary': colors.vet.primary,
    '--placeholder-shadow-rgb': colors.auth.shadowRgb,
  }
})
</script>

<template>
  <article class="clinical-placeholder" :style="styleVars" role="status">
    <span class="clinical-placeholder__icon" aria-hidden="true">
      <i class="pi pi-inbox" />
    </span>
    <h2>{{ title }}</h2>
    <p>{{ description }}</p>
  </article>
</template>

<style scoped>
.clinical-placeholder {
  display: grid;
  gap: 0.65rem;
  max-width: 32rem;
  padding: 1.5rem 1.35rem;
  border: 1px solid var(--placeholder-line);
  border-radius: 1rem;
  background: var(--placeholder-card);
  box-shadow: 0 12px 28px rgb(var(--placeholder-shadow-rgb) / 0.05);
}

.clinical-placeholder__icon {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  place-items: center;
  border-radius: 0.75rem;
  background: color-mix(in srgb, var(--placeholder-primary) 16%, var(--placeholder-card));
  color: var(--placeholder-primary);
  font-size: 1rem;
}

.clinical-placeholder h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--placeholder-text);
}

.clinical-placeholder p {
  margin: 0;
  color: var(--placeholder-muted);
  font-size: 0.9rem;
  line-height: 1.5;
}
</style>
