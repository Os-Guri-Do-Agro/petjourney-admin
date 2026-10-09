<script setup lang="ts">
import Button from 'primevue/button'
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

import { useAuthThemeVars } from '@/composables/useAuthThemeVars'

const props = withDefaults(
  defineProps<{
    to?: RouteLocationRaw
    type?: 'button' | 'submit' | 'reset'
    variant?: 'primary' | 'secondary' | 'ghost'
    fullWidth?: boolean
    disabled?: boolean
    loading?: boolean
  }>(),
  {
    to: undefined,
    type: 'button',
    variant: 'primary',
    fullWidth: false,
    disabled: false,
    loading: false,
  },
)

const buttonClasses = computed(() => ['auth-button', `auth-button--${props.variant}`])

const buttonStyle = useAuthThemeVars()
</script>

<template>
  <Button
    v-if="to"
    :as="RouterLink"
    :class="buttonClasses"
    :fluid="fullWidth"
    :style="buttonStyle"
    :to="to"
  >
    <slot />
  </Button>

  <Button
    v-else
    :class="buttonClasses"
    :disabled="disabled || loading"
    :fluid="fullWidth"
    :loading="loading"
    :style="buttonStyle"
    :type="type"
  >
    <!-- O slot default substitui o conteúdo do Button; o spinner de loading vem daqui. -->
    <i v-if="loading" class="ph ph-circle-notch ph-spin auth-button__spinner" aria-hidden="true" />
    <slot />
  </Button>
</template>

<style scoped>
.auth-button.p-button {
  height: 3rem;
  gap: 0;
  padding: 0 1.25rem;
  border: 1px solid transparent;
  border-radius: 0.75rem;
  background: transparent;
  color: var(--auth-sage);
  font-size: 0.875rem;
  font-weight: 700;
  text-decoration: none;
}

.auth-button.p-button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--auth-sage-soft) 70%, transparent);
}

.auth-button.p-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.auth-button--primary.p-button,
.auth-button--primary.p-button:not(:disabled):active {
  border-color: transparent;
  background: var(--auth-cta-bg);
  color: var(--auth-cta-text);
}

.auth-button--primary.p-button:not(:disabled):hover {
  border-color: transparent;
  background: var(--auth-cta-bg-hover);
  color: var(--auth-cta-text);
}

.auth-button--secondary.p-button {
  border-color: var(--auth-line);
  background: var(--auth-field-bg);
  color: var(--auth-text);
}

.auth-button--secondary.p-button:not(:disabled):hover,
.auth-button--secondary.p-button:not(:disabled):active,
.auth-button--ghost.p-button:not(:disabled):hover,
.auth-button--ghost.p-button:not(:disabled):active {
  border-color: var(--auth-sage);
  background: color-mix(in srgb, var(--auth-sage-soft) 40%, var(--auth-field-bg));
  color: var(--auth-link);
}

.auth-button--ghost.p-button:not(:disabled):hover,
.auth-button--ghost.p-button:not(:disabled):active {
  border-color: transparent;
}

.auth-button__spinner {
  margin-inline-end: 0.5rem;
  font-size: 1rem;
}
</style>
