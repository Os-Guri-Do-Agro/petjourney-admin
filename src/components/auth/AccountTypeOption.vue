<script setup lang="ts">
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

import { currentColors } from '@/theme/color-mode'

const props = withDefaults(
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

const optionStyle = computed(() => {
  const colors = currentColors.value

  return {
    '--option-primary': props.tone === 'vet' ? colors.vet.primary : colors.tutor.primary,
    '--option-secondary': props.tone === 'vet' ? colors.vet.secondary : colors.tutor.secondary,
    '--option-text': colors.auth.text,
    '--option-muted': colors.auth.muted,
    '--option-white': colors.auth.white,
  }
})
</script>

<template>
  <RouterLink
    class="account-type-option group block rounded-3xl border p-5 transition hover:-translate-y-0.5"
    :style="optionStyle"
    :to="to"
  >
    <div class="flex items-start gap-4">
      <span
        class="account-type-option__icon mt-1 flex size-11 shrink-0 items-center justify-center rounded-2xl text-sm font-bold"
      >
        <slot name="icon" />
      </span>

      <span class="space-y-1">
        <span class="block font-bold text-(--option-text)">{{ title }}</span>
        <span class="block text-sm leading-6 text-(--option-muted)">{{ description }}</span>
      </span>
    </div>
  </RouterLink>
</template>

<style scoped>
.account-type-option {
  background: var(--option-white);
  border-color: color-mix(in srgb, var(--option-secondary) 45%, transparent);
}

.account-type-option:hover {
  border-color: var(--option-primary);
}

.account-type-option__icon {
  background: color-mix(in srgb, var(--option-secondary) 28%, transparent);
  color: var(--option-primary);
}
</style>
