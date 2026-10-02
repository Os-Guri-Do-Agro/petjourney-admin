<script setup lang="ts">
/**
 * Ranking em linhas: nome, trilho com a barra, e o número com o peso no total — "70 (44%)".
 *
 * Era um gráfico do ApexCharts, e três coisas dele atrapalhavam a leitura:
 *
 * - **A ordem saía de cabeça para baixo.** O componente invertia as fatias supondo que o Apex
 *   desenhasse a primeira categoria embaixo; ele desenha em cima, e o primeiro colocado ia parar
 *   no pé do cartão.
 * - **O nome era cortado em 150 px** — "Doença mixomatosa da valv…", "Márcia Do Espírito Santo
 *   A…" — e o nome inteiro só existia na dica do mouse, que tablet não tem.
 * - **"70  44%" grudados** liam como um número só.
 *
 * Em HTML o nome quebra em duas linhas quando precisa, a ordem é a da lista (maior primeiro, como
 * as fatias já chegam do domínio) e o leitor de tela lê uma lista de verdade, sem tabela escondida.
 * A escala continua relativa ao primeiro colocado: comparar entre si é o ponto de um ranking.
 */
import { computed } from 'vue'

import { useClinicFormat } from '../../composables/useClinicFormat'
import type { Fatia } from '../../domain/resumo'

const props = withDefaults(
  defineProps<{
    fatias: Fatia[]
    /** Sufixo do valor: "doses", "casos". Vazio mostra só o número. */
    unidade?: string
    /** `atencao` só onde a contagem é ruim por natureza (perdas de vacina); o resto é tinta da marca. */
    tom?: 'acento' | 'atencao'
    vazio?: string
  }>(),
  { unidade: '', tom: 'acento', vazio: '' },
)

const formato = useClinicFormat()

const maior = computed(() => props.fatias.reduce((topo, fatia) => Math.max(topo, fatia.valor), 0))

function largura(fatia: Fatia) {
  return maior.value > 0 ? (fatia.valor / maior.value) * 100 : 0
}
</script>

<template>
  <p v-if="fatias.length === 0" class="ranking__vazio">{{ vazio }}</p>

  <ol v-else class="ranking" :class="`ranking--${tom}`">
    <li v-for="fatia in fatias" :key="fatia.id" class="ranking__linha">
      <span class="ranking__nome">{{ fatia.rotulo }}</span>
      <span class="ranking__trilho" aria-hidden="true">
        <span class="ranking__barra" :style="{ inlineSize: `${largura(fatia)}%` }" />
      </span>
      <span class="ranking__valor">
        <strong>{{ unidade ? `${fatia.valor} ${unidade}` : fatia.valor }}</strong>
        ({{ formato.percentual(fatia.parte) }})
      </span>
    </li>
  </ol>
</template>

<style scoped>
.ranking {
  display: grid;
  gap: 0.55rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Três colunas que se repetem em toda linha: as barras começam no mesmo lugar. */
.ranking__linha {
  display: grid;
  align-items: center;
  gap: 0.85rem;
  grid-template-columns: minmax(7rem, 12rem) minmax(0, 1fr) 5.75rem;
}

.ranking__nome {
  display: -webkit-box;
  overflow: hidden;
  color: var(--hc-tinta);
  font-size: 0.8125rem;
  font-weight: 600;
  line-height: 1.3;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.ranking__trilho {
  display: block;
  height: 0.6rem;
  overflow: hidden;
  border-radius: 999px;
  background: var(--hc-linha);
}

.ranking__barra {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--hc-marca);
  transition: inline-size 0.2s ease-out;
}

.ranking--atencao .ranking__barra {
  background: var(--hc-pessego-tinta);
}

.ranking__valor {
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.ranking__valor strong {
  color: var(--hc-tinta);
  font-weight: 700;
}

.ranking__vazio {
  margin: 0;
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
}

@media (prefers-reduced-motion: reduce) {
  .ranking__barra {
    transition: none;
  }
}
</style>
