<script setup lang="ts">
/**
 * Uma porta de entrada por tipo de conta: o ícone num disco, o nome e uma frase, e a linha inteira
 * leva para o cadastro daquele tipo.
 */
import type { RouteLocationRaw } from 'vue-router'

withDefaults(
  defineProps<{
    title: string
    description: string
    to: RouteLocationRaw
    tone?: 'vet' | 'tutor'
  }>(),
  {
    tone: 'vet',
  },
)
</script>

<template>
  <RouterLink class="account-type-option" :class="`account-type-option--${tone}`" :to="to">
    <span class="account-type-option__icon" aria-hidden="true">
      <slot name="icon" />
    </span>

    <span class="account-type-option__texto">
      <strong>{{ title }}</strong>
      <span>{{ description }}</span>
    </span>

    <i class="ph ph-caret-right account-type-option__seta" aria-hidden="true" />
  </RouterLink>
</template>

<style scoped>
.account-type-option {
  display: flex;
  min-height: 72px;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border: 1px solid var(--linha);
  border-radius: 16px;
  background: var(--superficie);
  color: var(--tinta);
  text-decoration: none;
  transition: border-color var(--pj-tempo-curto) var(--pj-curva-chega);
}

.account-type-option:hover {
  border-color: var(--linha-forte);
}

.account-type-option:focus-visible {
  outline: 2px solid var(--musgo);
  outline-offset: 2px;
}

.account-type-option__icon {
  display: grid;
  width: 44px;
  height: 44px;
  flex: none;
  place-items: center;
  border-radius: 12px;
  background: var(--musgo-fundo);
  color: var(--musgo);
  font-size: 20px;
}

.account-type-option--tutor .account-type-option__icon {
  background: var(--pets-fundo);
  color: var(--pets-tinta);
}

.account-type-option__texto {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 2px;
}

.account-type-option__texto strong {
  font-size: 15px;
  font-weight: 600;
}

.account-type-option__texto span {
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.45;
}

.account-type-option__seta {
  color: var(--tinta-3);
}

[dir='rtl'] .account-type-option__seta {
  transform: scaleX(-1);
}

@media (prefers-reduced-motion: reduce) {
  .account-type-option {
    transition: none;
  }
}
</style>
