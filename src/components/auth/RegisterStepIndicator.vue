<script setup lang="ts">
import { computed } from 'vue'

import { currentColors } from '@/theme/color-mode'

defineProps<{
  currentStep: number
  totalSteps: number
  labels: string[]
}>()

const indicatorStyle = computed(() => {
  const colors = currentColors.value

  return {
    '--step-active': colors.vet.primary,
    '--step-done': colors.success,
    '--step-pending': colors.auth.line,
    '--step-text': colors.auth.muted,
    '--step-text-active': colors.auth.text,
  }
})
</script>

<template>
  <div class="register-steps" :style="indicatorStyle">
    <div
      v-for="(label, index) in labels"
      :key="label"
      class="register-steps__item"
      :class="{
        'register-steps__item--active': currentStep === index + 1,
        'register-steps__item--done': currentStep > index + 1,
      }"
    >
      <span class="register-steps__marker">
        <i v-if="currentStep > index + 1" class="pi pi-check" aria-hidden="true" />
        <span v-else>{{ index + 1 }}</span>
      </span>
      <span class="register-steps__label">{{ label }}</span>
    </div>
  </div>
</template>

<style scoped>
.register-steps {
  display: grid;
  grid-template-columns: repeat(v-bind(totalSteps), minmax(0, 1fr));
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.register-steps__item {
  display: grid;
  gap: 0.45rem;
  justify-items: center;
  text-align: center;
}

.register-steps__marker {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border: 1px solid var(--step-pending);
  border-radius: 999px;
  background: transparent;
  color: var(--step-text);
  font-size: 0.8125rem;
  font-weight: 800;
}

.register-steps__label {
  color: var(--step-text);
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1.3;
}

.register-steps__item--active .register-steps__marker {
  border-color: var(--step-active);
  background: color-mix(in srgb, var(--step-active) 12%, transparent);
  color: var(--step-text-active);
}

.register-steps__item--active .register-steps__label {
  color: var(--step-text-active);
}

.register-steps__item--done .register-steps__marker {
  border-color: var(--step-done);
  background: color-mix(in srgb, var(--step-done) 14%, transparent);
  color: var(--step-done);
}

@media (max-width: 560px) {
  .register-steps__label {
    font-size: 0.62rem;
  }
}
</style>
