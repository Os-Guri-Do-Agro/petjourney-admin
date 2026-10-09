<script setup lang="ts">
/**
 * A nota de 0 a 10 (NPS), em onze casas iguais numa linha.
 *
 * É um `radiogroup`, com o teclado que a função pede: uma parada de Tab para a escala inteira
 * (tabindex móvel), setas andam e escolhem, Home e End vão às pontas, Enter e espaço marcam a casa
 * em foco. Onze paradas de Tab para atravessar uma pergunta seriam onze toques à toa.
 *
 * A escala é neutra de propósito: nada de vermelho no 0 e verde no 10. Cor ali puxaria a resposta,
 * e a casa marcada já se distingue por fundo cheio e peso, sem depender de enxergar cor.
 */
import Button from 'primevue/button'
import { computed, nextTick, ref } from 'vue'

const NOTAS = Array.from({ length: 11 }, (_, nota) => nota)

const props = defineProps<{
  modelValue: number | null
  /** Rótulo de cada casa para o leitor de tela, ex.: "Nota 7". */
  rotuloDe: (nota: number) => string
}>()

const emit = defineEmits<{ 'update:modelValue': [nota: number] }>()

const escala = ref<HTMLElement | null>(null)

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
    [avancar]: Math.min(10, nota + 1),
    ArrowDown: Math.min(10, nota + 1),
    [voltar]: Math.max(0, nota - 1),
    ArrowUp: Math.max(0, nota - 1),
    Home: 0,
    End: 10,
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
  <div ref="escala" class="escala-nota" role="radiogroup">
    <Button
      v-for="nota in NOTAS"
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
  grid-template-columns: repeat(11, minmax(0, 1fr));
  gap: 0.3rem;
}

/*
 * 44 px de altura: alvo de toque de tablet, mesmo com as onze casas numa linha. Sem a sombra que o
 * `.hc-tema` dá a todo botão: onze casas com sombra viravam onze cartõezinhos.
 */
.escala-nota .escala-nota__casa.p-button {
  --hc-botao-sombra: none;

  min-width: 0;
  min-height: 2.75rem;
  padding: 0;
  border: 1px solid var(--hc-borda);
  border-radius: 0.6rem;
  background: var(--hc-cartao);
  color: var(--hc-tinta);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  transition:
    background-color 150ms ease-out,
    border-color 150ms ease-out,
    color 150ms ease-out;
}

.escala-nota .escala-nota__casa.p-button:not(:disabled):hover {
  --hc-botao-sombra: none;

  border-color: var(--hc-tinta-3);
  background: var(--hc-fundo);
  color: var(--hc-tinta);
}

.escala-nota .escala-nota__casa--marcada.p-button,
.escala-nota .escala-nota__casa--marcada.p-button:not(:disabled):hover {
  border-color: var(--hc-marca-forte);
  background: var(--hc-marca-forte);
  color: var(--hc-cartao);
  font-weight: 800;
}

@media (prefers-reduced-motion: reduce) {
  .escala-nota .escala-nota__casa.p-button {
    transition: none;
  }
}
</style>
