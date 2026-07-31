<script setup lang="ts">
import { computed } from 'vue'

import { currentColors } from '@/theme/color-mode'

defineProps<{
  currentStep: number
  totalSteps: number
  labels: string[]
  /** Rótulo da lista para leitor de tela (o indicador é só visual sem ele).
   *  Não se chama `ariaLabel` de propósito: colidiria com o atributo nativo. */
  listLabel: string
}>()

const indicatorStyle = computed(() => {
  const colors = currentColors.value

  return {
    '--step-active': colors.dashboard.primaryStrong,
    '--step-done': colors.dashboard.successText,
    '--step-pending': colors.auth.line,
    '--step-pending-text': colors.auth.soft,
    '--step-text': colors.auth.muted,
    '--step-text-active': colors.auth.text,
    /* Cor de contraste sobre marcador sólido: no claro é branco, no escuro é a
       superfície escura. É o mesmo par que o resto do portal usa. */
    '--step-on-solid': colors.auth.white,
  }
})
</script>

<template>
  <ol class="register-steps" :style="indicatorStyle" :aria-label="listLabel">
    <li
      v-for="(label, index) in labels"
      :key="index"
      class="register-steps__item"
      :class="{
        'register-steps__item--active': currentStep === index + 1,
        'register-steps__item--done': currentStep > index + 1,
      }"
      :aria-current="currentStep === index + 1 ? 'step' : undefined"
    >
      <span class="register-steps__marker">
        <i v-if="currentStep > index + 1" class="pi pi-check" aria-hidden="true" />
        <span v-else>{{ index + 1 }}</span>
      </span>
      <span class="register-steps__label">{{ label }}</span>
    </li>
  </ol>
</template>

<style scoped>
.register-steps {
  display: grid;
  grid-template-columns: repeat(v-bind(totalSteps), minmax(0, 1fr));
  gap: 0.5rem;
  margin: 0 0 1.5rem;
  padding: 0;
  list-style: none;
}

.register-steps__item {
  position: relative;
  display: grid;
  gap: 0.5rem;
  justify-items: center;
  min-width: 0;
  text-align: center;
}

/* Trilha ligando o marcador anterior a este: sem ela os passos leem como dois
   badges soltos, não como um caminho. Recuada 1.4rem de cada centro, então nunca
   passa por baixo dos círculos (raio 1rem). */
.register-steps__item + .register-steps__item::before {
  content: '';
  position: absolute;
  top: 1rem;
  right: 50%;
  left: calc(-50% - 0.25rem);
  height: 2px;
  margin: 0 1.4rem;
  border-radius: 999px;
  background: var(--step-pending);
  transition: background-color 180ms ease;
}

/* A trilha é preenchida quando a etapa que ela alimenta já foi alcançada. */
.register-steps__item--active::before,
.register-steps__item--done::before {
  background: var(--step-active);
}

.register-steps__marker {
  position: relative;
  z-index: 1;
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border: 2px solid var(--step-pending);
  border-radius: 999px;
  background: transparent;
  color: var(--step-pending-text);
  font-size: 0.8125rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  transition:
    background-color 180ms ease,
    border-color 180ms ease,
    color 180ms ease,
    box-shadow 180ms ease;
}

.register-steps__label {
  color: var(--step-text);
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 1.3;
  overflow-wrap: anywhere;
  transition: color 180ms ease;
}

/* Ativo: marcador sólido, com halo suave para puxar o olho sem glow decorativo. */
.register-steps__item--active .register-steps__marker {
  border-color: var(--step-active);
  background: var(--step-active);
  color: var(--step-on-solid);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--step-active) 16%, transparent);
}

.register-steps__item--active .register-steps__label {
  color: var(--step-text-active);
}

/* Concluído: sólido também, mas em verde e com o check no lugar do número.
   O ícone garante que o estado não dependa só da cor. */
.register-steps__item--done .register-steps__marker {
  border-color: var(--step-done);
  background: var(--step-done);
  color: var(--step-on-solid);
}

.register-steps__item--done .register-steps__label {
  color: var(--step-text-active);
}

@media (prefers-reduced-motion: reduce) {
  .register-steps__item::before,
  .register-steps__marker,
  .register-steps__label {
    transition: none;
  }
}

@media (max-width: 560px) {
  .register-steps__label {
    font-size: 0.64rem;
  }

  .register-steps__item + .register-steps__item::before {
    margin: 0 1.2rem;
  }
}
</style>
