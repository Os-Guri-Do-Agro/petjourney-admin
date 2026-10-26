<script setup lang="ts">
/**
 * Os passos de um fluxo curto da entrada (criar conta, redefinir senha), deitados numa linha:
 * o número e o nome de cada um, ligados por um traço que se enche quando o passo fica para trás.
 * O passo feito troca o número pelo visto — o estado não depende só da cor.
 */
defineProps<{
  currentStep: number
  totalSteps: number
  labels: string[]
  /** Rótulo da lista para leitor de tela (o indicador é só visual sem ele).
   *  Não se chama `ariaLabel` de propósito: colidiria com o atributo nativo. */
  listLabel: string
}>()
</script>

<template>
  <ol class="register-steps" :aria-label="listLabel" :data-total="totalSteps">
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
      <span class="register-steps__marker" aria-hidden="true">
        <i v-if="currentStep > index + 1" class="ph ph-check" />
        <span v-else>{{ index + 1 }}</span>
      </span>
      <span class="register-steps__label">{{ label }}</span>
    </li>
  </ol>
</template>

<style scoped>
.register-steps {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.register-steps__item {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

/* O traço entre um passo e o seguinte: cresce para ocupar o espaço que sobra. */
.register-steps__item + .register-steps__item::before {
  width: clamp(16px, 6vw, 40px);
  height: 2px;
  flex: none;
  margin-inline-end: 2px;
  border-radius: 2px;
  background: var(--linha);
  content: '';
  transition: background-color var(--pj-tempo-medio) var(--pj-curva-chega);
}

.register-steps__item + .register-steps__item--active::before,
.register-steps__item + .register-steps__item--done::before {
  background: var(--auth-acao, var(--musgo));
}

.register-steps__marker {
  display: grid;
  width: 28px;
  height: 28px;
  flex: none;
  place-items: center;
  border: 1.5px solid var(--linha-forte);
  border-radius: 999px;
  background: var(--superficie);
  color: var(--tinta-2);
  font-family: var(--font-dados);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  font-weight: 650;
  transition:
    background-color var(--pj-tempo-medio) var(--pj-curva-chega),
    border-color var(--pj-tempo-medio) var(--pj-curva-chega),
    color var(--pj-tempo-medio) var(--pj-curva-chega);
}

.register-steps__label {
  overflow: hidden;
  color: var(--tinta-2);
  font-size: 14px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* O passo ativo na sálvia da entrada, como o botão (`--auth-acao`, do `AuthLayout`). */
.register-steps__item--active .register-steps__marker {
  border-color: var(--auth-acao, var(--musgo));
  background: var(--auth-acao, var(--musgo));
  box-shadow: 0 0 0 4px var(--musgo-fundo);
  color: var(--sobre-auth-acao, var(--sobre-musgo));
}

.register-steps__item--active .register-steps__label {
  color: var(--tinta);
  font-weight: 600;
}

.register-steps__item--done .register-steps__marker {
  border-color: var(--auth-acao, var(--musgo));
  background: var(--musgo-fundo);
  color: var(--musgo);
  font-size: 14px;
}

.register-steps__item--done .register-steps__label {
  color: var(--tinta);
}

/* Estreito: só o passo de agora leva o nome; os outros ficam no número. */
@media (max-width: 420px) {
  .register-steps__item:not(.register-steps__item--active) .register-steps__label {
    position: absolute;
    overflow: hidden;
    width: 1px;
    height: 1px;
    clip-path: inset(50%);
    white-space: nowrap;
  }
}

@media (prefers-reduced-motion: reduce) {
  .register-steps__item::before,
  .register-steps__marker {
    transition: none;
  }
}
</style>
