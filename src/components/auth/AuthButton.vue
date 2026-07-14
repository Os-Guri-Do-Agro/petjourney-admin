<script setup lang="ts">
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

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

const isDisabled = computed(() => props.disabled || props.loading)

const buttonClasses = computed(() => [
  'auth-button inline-flex h-12 items-center justify-center rounded-xl px-5 text-sm font-bold transition focus:outline-none focus:ring-4',
  {
    'w-full': props.fullWidth,
    'cursor-not-allowed opacity-60': isDisabled.value,
  },
  {
    'auth-button--primary': props.variant === 'primary',
    'auth-button--secondary border': props.variant === 'secondary',
    'auth-button--ghost': props.variant === 'ghost',
  },
])

const buttonStyle = useAuthThemeVars()
</script>

<template>
  <RouterLink v-if="to" :class="buttonClasses" :style="buttonStyle" :to="to">
    <slot />
  </RouterLink>

  <button v-else :class="buttonClasses" :disabled="isDisabled" :style="buttonStyle" :type="type">
    <span v-if="loading" class="auth-button__spinner" aria-hidden="true" />
    <slot />
  </button>
</template>

<style scoped>
.auth-button {
  color: var(--auth-sage);
  cursor: pointer;
}

.auth-button:focus {
  --tw-ring-color: color-mix(in srgb, var(--auth-sage-soft) 70%, transparent);
}

.auth-button--primary {
  background: var(--auth-cta-bg);
  color: var(--auth-cta-text);
}

.auth-button--primary:hover {
  background: var(--auth-cta-bg-hover);
}

.auth-button--secondary {
  background: var(--auth-field-bg);
  border-color: var(--auth-line);
  color: var(--auth-text);
}

.auth-button--secondary:hover,
.auth-button--ghost:hover {
  border-color: var(--auth-sage);
  background: color-mix(in srgb, var(--auth-sage-soft) 40%, var(--auth-field-bg));
  color: var(--auth-link);
}

.auth-button__spinner {
  width: 1rem;
  height: 1rem;
  margin-right: 0.5rem;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 999px;
  animation: auth-button-spin 700ms linear infinite;
}

@keyframes auth-button-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
