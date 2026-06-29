<script setup lang="ts">
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

import { currentColors } from '@/theme/color-mode'

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

const buttonStyle = computed(() => {
  const colors = currentColors.value

  return {
    '--auth-primary': colors.vet.primary,
    '--auth-primary-muted': colors.auth.sageStrong,
    '--auth-secondary': colors.vet.secondary,
    '--auth-white': colors.auth.white,
    '--auth-border': colors.auth.line,
  }
})
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
  color: var(--auth-primary);
  cursor: pointer;
}

.auth-button:focus {
  --tw-ring-color: color-mix(in srgb, var(--auth-secondary) 70%, transparent);
}

.auth-button--primary {
  background: var(--auth-primary);
  color: var(--auth-white);
}

.auth-button--primary:hover {
  background: var(--auth-primary-muted);
}

.auth-button--secondary {
  background: var(--auth-white);
  border-color: var(--auth-border);
}

.auth-button--secondary:hover,
.auth-button--ghost:hover {
  border-color: var(--auth-primary);
  background: color-mix(in srgb, var(--auth-secondary) 40%, var(--auth-white));
  color: var(--auth-primary);
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
