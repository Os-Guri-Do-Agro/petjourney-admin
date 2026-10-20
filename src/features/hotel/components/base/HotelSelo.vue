<script setup lang="ts">
/**
 * Selo de estado do hotel.
 *
 * Tem a mesma cara do `ui-selo` do kit (redesenho total, 19/10/2026): palavra curta num retângulo
 * de cantos de 7 px, fundo do tom e tinta do tom. O tom é escolha de significado, não de
 * decoração, e ele **nunca é a única diferença**: a palavra é a informação, e o risco ainda sobe
 * de peso, para quem não distingue vermelho de âmbar.
 *
 * `acento` é a cor do lugar (lavanda no hotel); `positivo` é o verde de "pode", "pronto", "em dia".
 *
 * O ícone é opcional e sempre decorativo. Entra por dois caminhos: a prop `icone` recebe uma
 * classe da fonte do Phosphor (`ph ph-*`); o slot `#icone` recebe um componente do Phosphor.
 */
withDefaults(
  defineProps<{
    rotulo: string
    tom?: 'neutro' | 'atencao' | 'risco' | 'acento' | 'positivo'
    icone?: string
    /** Some o fundo: para quando o selo já vive dentro de um bloco com superfície própria. */
    plano?: boolean
  }>(),
  { tom: 'neutro', icone: '', plano: false },
)
</script>

<template>
  <span class="selo" :class="[`selo--${tom}`, { 'selo--plano': plano }]">
    <slot name="icone">
      <i v-if="icone" :class="icone" aria-hidden="true" />
    </slot>
    {{ rotulo }}
  </span>
</template>

<style scoped>
.selo {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 5px;
  min-height: 24px;
  padding: 3px 9px;
  border-radius: 7px;
  background: var(--neutro-fundo);
  color: var(--neutro-tinta);
  font-family: var(--font-texto);
  font-size: 12.5px;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
}

.selo i {
  font-size: 14px;
}

/* O componente do Phosphor não é fonte-ícone: ele mede pelo próprio quadro, não pelo `em`. */
.selo :deep(svg) {
  width: 14px;
  height: 14px;
  flex: none;
}

.selo--acento {
  background: var(--hotel-fundo);
  color: var(--hotel-tinta);
}

.selo--positivo {
  background: var(--ok-fundo);
  color: var(--ok-tinta);
}

.selo--atencao {
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
}

.selo--risco {
  background: var(--risco-fundo);
  color: var(--risco-tinta);
  font-weight: 650;
}

.selo--plano {
  padding-inline: 0;
  background: transparent;
}
</style>
