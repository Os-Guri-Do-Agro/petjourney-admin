<script setup lang="ts">
/**
 * O medidor do microfone: cinco barras que sobem com a voz.
 *
 * Não é enfeite de "gravando". É a única prova, sem ler nada, de que o microfone **está
 * ouvindo** — barra parada com alguém falando é microfone mudo, e é isso que a pessoa precisa
 * perceber antes de conversar dez minutos para o nada. Por isso as barras seguem o volume real e
 * não um ciclo animado.
 *
 * Com movimento reduzido, o medidor sai: o estado "Ouvindo" e o relógio dizem o mesmo sem nada
 * pulando na tela.
 */
import { computed } from 'vue'

const props = defineProps<{ nivel: number }>()

/** O desenho de uma onda: as barras do meio sobem mais que as das pontas. */
const PESOS = [0.5, 0.85, 1, 0.75, 0.45]

const alturas = computed(() =>
  PESOS.map((peso) => `${3 + Math.round(peso * Math.min(1, props.nivel) * 13)}px`),
)
</script>

<template>
  <span class="nivel" aria-hidden="true">
    <span
      v-for="(altura, indice) in alturas"
      :key="indice"
      class="nivel__barra"
      :style="{ height: altura }"
    />
  </span>
</template>

<style scoped>
.nivel {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 16px;
}

.nivel__barra {
  width: 3px;
  border-radius: 2px;
  background: var(--clinic-muted);
  transition: height 90ms linear;
}

@media (prefers-reduced-motion: reduce) {
  .nivel {
    display: none;
  }
}
</style>
