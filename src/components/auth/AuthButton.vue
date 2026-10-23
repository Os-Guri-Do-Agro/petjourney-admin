<script setup lang="ts">
/**
 * O botão da entrada: grande, de toque fácil, e com a ação dita por extenso.
 *
 * `primary` é o próximo passo (musgo cheio), `secondary` o caminho ao lado (contorno) e `ghost`
 * o link com corpo de botão. Com `to`, vira um link de verdade (abre em outra guia, volta).
 */
import Button from 'primevue/button'
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

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
</script>

<template>
  <Button v-if="to" :as="RouterLink" :class="buttonClasses" :fluid="fullWidth" :to="to">
    <slot />
  </Button>

  <Button
    v-else
    :class="buttonClasses"
    :disabled="disabled || loading"
    :fluid="fullWidth"
    :loading="loading"
    :type="type"
  >
    <!-- O slot default substitui o conteúdo do Button; o spinner de loading vem daqui. -->
    <i v-if="loading" class="ph ph-circle-notch ph-spin auth-button__spinner" aria-hidden="true" />
    <slot />
  </Button>
</template>

<style scoped>
.auth-button.p-button {
  min-height: 52px;
  gap: 8px;
  padding: 0 22px;
  border: 1px solid transparent;
  border-radius: 12px;
  font-family: var(--font-texto);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0;
  text-decoration: none;
  transition:
    background-color var(--pj-tempo-curto) var(--pj-curva-chega),
    border-color var(--pj-tempo-curto) var(--pj-curva-chega);
}

.auth-button.p-button:focus-visible {
  box-shadow: none;
  outline: 2px solid var(--musgo);
  outline-offset: 3px;
}

.auth-button.p-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.auth-button--primary.p-button,
.auth-button--primary.p-button:not(:disabled):active {
  border-color: var(--musgo);
  background: var(--musgo);
  color: var(--sobre-musgo);
}

.auth-button--primary.p-button:not(:disabled):hover {
  border-color: color-mix(in oklab, var(--musgo) 86%, var(--tinta));
  background: color-mix(in oklab, var(--musgo) 86%, var(--tinta));
  color: var(--sobre-musgo);
}

.auth-button--secondary.p-button {
  border-color: var(--linha-forte);
  background: var(--superficie);
  color: var(--tinta);
}

.auth-button--secondary.p-button:not(:disabled):hover,
.auth-button--secondary.p-button:not(:disabled):active {
  border-color: var(--linha-forte);
  background: var(--superficie-2);
  color: var(--tinta);
}

.auth-button--ghost.p-button {
  background: transparent;
  color: var(--musgo);
}

.auth-button--ghost.p-button:not(:disabled):hover,
.auth-button--ghost.p-button:not(:disabled):active {
  border-color: transparent;
  background: var(--musgo-fundo);
  color: var(--musgo);
}

.auth-button__spinner {
  font-size: 18px;
}

@media (prefers-reduced-motion: reduce) {
  .auth-button.p-button {
    transition: none;
  }
}
</style>
