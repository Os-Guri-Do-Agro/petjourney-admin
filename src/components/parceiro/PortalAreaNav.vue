<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { currentColors } from '@/theme/color-mode'

const { store } = useParceiroPortal()

const navStyle = computed(() => {
  const colors = currentColors.value

  return {
    '--nav-card': colors.dashboard.surface,
    '--nav-surface': colors.dashboard.surfaceSoft,
    '--nav-line': colors.dashboard.line,
    '--nav-text': colors.dashboard.text,
    '--nav-muted': colors.dashboard.muted,
    '--nav-primary': colors.vet.primary,
    '--nav-primary-soft': colors.vet.secondary,
    '--nav-primary-strong': colors.dashboard.primaryStrong,
    '--nav-shadow-rgb': colors.auth.shadowRgb,
  }
})

const areas = computed(() => {
  const items = [
    {
      id: 'divulgacao',
      to: '/parceiro/divulgacao',
      icon: 'pi pi-share-alt',
      label: 'Divulgação',
      description: 'Código de indicação, cupons e resgates.',
    },
  ]

  if (store.statusAfiliadoAtivo) {
    items.push({
      id: 'financeiro',
      to: '/parceiro/carteira',
      icon: 'pi pi-wallet',
      label: 'Financeiro',
      description: 'Saldo, extrato e saques via PIX.',
    })
  }

  return items
})
</script>

<template>
  <nav class="area-nav" :style="navStyle" aria-label="Outras áreas do portal">
    <RouterLink
      v-for="area in areas"
      :key="area.id"
      class="area-nav__card"
      :to="area.to"
    >
      <span class="area-nav__icon" aria-hidden="true">
        <i :class="area.icon" />
      </span>
      <span class="area-nav__copy">
        <strong>{{ area.label }}</strong>
        <small>{{ area.description }}</small>
      </span>
      <i class="pi pi-arrow-right area-nav__arrow" aria-hidden="true" />
    </RouterLink>
  </nav>
</template>

<style scoped>
.area-nav {
  display: grid;
  gap: 0.55rem;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
}

.area-nav__card {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 0.95rem;
  border: 1px solid var(--nav-line);
  border-radius: 0.9rem;
  background: var(--nav-card);
  color: var(--nav-text);
  text-decoration: none;
  box-shadow: 0 10px 24px rgb(var(--nav-shadow-rgb) / 0.04);
  transition:
    border-color 140ms ease,
    background 140ms ease,
    transform 140ms ease;
}

.area-nav__card:hover,
.area-nav__card:focus-visible {
  border-color: color-mix(in srgb, var(--nav-primary) 30%, var(--nav-line));
  background: color-mix(in srgb, var(--nav-primary-soft) 18%, var(--nav-card));
  transform: translateY(-1px);
  outline: none;
}

.area-nav__icon {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  border-radius: 0.65rem;
  background: color-mix(in srgb, var(--nav-primary) 14%, var(--nav-card));
  color: var(--nav-primary-strong);
  font-size: 0.95rem;
}

.area-nav__copy {
  display: grid;
  gap: 0.12rem;
  min-width: 0;
}

.area-nav__copy strong {
  font-size: 0.9rem;
}

.area-nav__copy small {
  color: var(--nav-muted);
  font-size: 0.78rem;
  line-height: 1.35;
}

.area-nav__arrow {
  color: var(--nav-muted);
  font-size: 0.78rem;
}
</style>
