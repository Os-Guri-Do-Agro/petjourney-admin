<script setup lang="ts">
/**
 * Ranking em barras horizontais.
 *
 * Barra horizontal em vez de rosca: comparar fatias de um donut é notoriamente impreciso, e o
 * nome de cada item — "Márcia Do Espírito Santo Albuquerque", "Doença mixomatosa da valva
 * mitral" — não cabe em legenda de gráfico circular sem virar sopa de cores.
 *
 * A barra é desenhada com `div`, não com SVG: são retângulos alinhados a texto, e o layout do
 * navegador faz isso melhor do que qualquer cálculo de viewBox.
 */
import { computed } from 'vue'

import type { Fatia } from '../../domain/resumo'

const props = withDefaults(
  defineProps<{
    fatias: Fatia[]
    /** Sufixo do valor: "atendimentos", "casos". Vazio mostra só o número. */
    unidade?: string
    tom?: 'acento' | 'atencao'
    vazio?: string
  }>(),
  { unidade: '', tom: 'acento', vazio: '' },
)

/** A escala é relativa ao primeiro colocado — comparar entre si é o ponto de um ranking. */
const maior = computed(() =>
  props.fatias.reduce((topo, fatia) => Math.max(topo, fatia.valor), 0),
)

function largura(fatia: Fatia) {
  return maior.value > 0 ? `${Math.max(3, (fatia.valor / maior.value) * 100)}%` : '0%'
}
</script>

<template>
  <div class="ranking" :class="`ranking--${tom}`">
    <p v-if="fatias.length === 0" class="ranking__vazio">{{ vazio }}</p>

    <div v-for="fatia in fatias" :key="fatia.id" class="ranking__linha">
      <span class="ranking__rotulo" :title="fatia.rotulo">{{ fatia.rotulo }}</span>

      <span class="ranking__trilho">
        <span class="ranking__barra" :style="{ width: largura(fatia) }" />
      </span>

      <span class="ranking__valor clinic-value">
        {{ fatia.valor }}<template v-if="unidade">&nbsp;{{ unidade }}</template>
        <small>{{ Math.round(fatia.parte * 100) }}%</small>
      </span>
    </div>
  </div>
</template>

<style scoped>
.ranking {
  display: grid;
  gap: 0.55rem;
}

.ranking__vazio {
  margin: 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.ranking__linha {
  display: grid;
  align-items: center;
  gap: var(--clinic-space-3);
  grid-template-columns: minmax(6rem, 9.5rem) minmax(0, 1fr) auto;
}

.ranking__rotulo {
  overflow: hidden;
  color: var(--clinic-text);
  font-size: var(--clinic-font-label);
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ranking__trilho {
  height: 0.55rem;
  border-radius: 999px;
  background: var(--clinic-surface-sunken);
}

.ranking__barra {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--clinic-accent-strong);
}

.ranking--atencao .ranking__barra {
  background: var(--clinic-attention-text);
}

.ranking__valor {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  color: var(--clinic-text);
  font-weight: 800;
  white-space: nowrap;
}

.ranking__valor small {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}
</style>
