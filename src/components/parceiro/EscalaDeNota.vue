<script setup lang="ts">
/**
 * A escala de nota de 0 até `max` (hoje 5, no questionário pós-saque), em casas iguais numa linha.
 *
 * É um `radiogroup`, com o teclado que a função pede: uma parada de Tab para a escala inteira
 * (tabindex móvel), setas andam e escolhem, Home e End vão às pontas, Enter e espaço marcam a casa
 * em foco. Uma parada de Tab por casa seria toque à toa para atravessar uma pergunta.
 *
 * A escala é neutra de propósito: nada de vermelho na menor nota e verde na maior. Cor ali puxaria a resposta,
 * e a casa marcada já se distingue por fundo cheio e peso, sem depender de enxergar cor.
 */
import Button from 'primevue/button'
import { computed, nextTick, ref } from 'vue'

const props = defineProps<{
  modelValue: number | null
  /** Maior nota da escala; a menor é sempre 0. */
  max: number
  /** Rótulo de cada casa para o leitor de tela, ex.: "Nota 7". */
  rotuloDe: (nota: number) => string
}>()

const emit = defineEmits<{ 'update:modelValue': [nota: number] }>()

const escala = ref<HTMLElement | null>(null)

const notas = computed(() => Array.from({ length: props.max + 1 }, (_, nota) => nota))

/** Sem nota, o 0 é a porta de entrada do grupo. */
const notaComParada = computed(() => props.modelValue ?? 0)

function escolher(nota: number, focar = false) {
  emit('update:modelValue', nota)

  if (focar) {
    void nextTick(() => {
      escala.value?.querySelectorAll<HTMLElement>('[role="radio"]')[nota]?.focus()
    })
  }
}

/** Em árabe a escala espelha (o 0 fica à direita), e as setas seguem o que a pessoa vê. */
function aoTeclar(evento: KeyboardEvent, nota: number) {
  const rtl = escala.value ? getComputedStyle(escala.value).direction === 'rtl' : false
  const avancar = rtl ? 'ArrowLeft' : 'ArrowRight'
  const voltar = rtl ? 'ArrowRight' : 'ArrowLeft'
  const alvos: Record<string, number> = {
    [avancar]: Math.min(props.max, nota + 1),
    ArrowDown: Math.min(props.max, nota + 1),
    [voltar]: Math.max(0, nota - 1),
    ArrowUp: Math.max(0, nota - 1),
    Home: 0,
    End: props.max,
  }
  const alvo = alvos[evento.key]

  if (alvo === undefined) {
    return
  }

  evento.preventDefault()
  escolher(alvo, true)
}
</script>

<template>
  <div
    ref="escala"
    class="escala-nota"
    role="radiogroup"
    :style="{ gridTemplateColumns: `repeat(${notas.length}, minmax(0, 1fr))` }"
  >
    <Button
      v-for="nota in notas"
      :key="nota"
      type="button"
      class="escala-nota__casa"
      :class="{ 'escala-nota__casa--marcada': nota === modelValue }"
      :label="String(nota)"
      role="radio"
      :aria-checked="nota === modelValue"
      :aria-label="rotuloDe(nota)"
      :tabindex="nota === notaComParada ? 0 : -1"
      @click="escolher(nota)"
      @keydown="aoTeclar($event, nota)"
    />
  </div>
</template>

<style scoped>
.escala-nota {
  display: grid;
  gap: 4px;
}

/*
 * 44 px de altura: alvo de toque de tablet, mesmo com todas as casas numa linha. A casa marcada é
 * a única cheia (musgo, a cor da ação); as outras são contorno, todas iguais.
 */
.escala-nota .escala-nota__casa.p-button {
  min-width: 0;
  min-height: 44px;
  padding: 0;
  border: 1px solid var(--linha-forte);
  border-radius: 10px;
  background: var(--superficie);
  box-shadow: none;
  color: var(--tinta);
  font-family: var(--font-dados);
  font-size: 15px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  transition:
    background-color var(--pj-tempo-curto, 140ms) ease-out,
    border-color var(--pj-tempo-curto, 140ms) ease-out,
    color var(--pj-tempo-curto, 140ms) ease-out;
}

.escala-nota .escala-nota__casa.p-button:not(:disabled):hover {
  border-color: var(--tinta-3);
  background: var(--superficie-2);
  color: var(--tinta);
}

.escala-nota .escala-nota__casa.p-button:focus-visible {
  outline: 2px solid var(--musgo);
  outline-offset: 2px;
}

.escala-nota .escala-nota__casa--marcada.p-button,
.escala-nota .escala-nota__casa--marcada.p-button:not(:disabled):hover {
  border-color: var(--musgo);
  background: var(--musgo);
  color: var(--sobre-musgo);
  font-weight: 700;
}

@media (prefers-reduced-motion: reduce) {
  .escala-nota .escala-nota__casa.p-button {
    transition: none;
  }
}
</style>
