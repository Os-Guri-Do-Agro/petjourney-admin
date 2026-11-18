<script setup lang="ts">
/**
 * Os bairros mais atrasados num indicador, um por linha: o nome, o percentual em dia, a barra na cor
 * da faixa do mapa (a escala de perigo, `escala-de-perigo.css`) e quantos animais contam. O Painel
 * mostra os da cidade; o detalhe da região, os dela.
 */
import { numero } from '@/features/saude-publica/dados'
import '@/features/saude-publica/escala-de-perigo.css'

defineProps<{
  bairros: { nome: string; valor: number; publico: number }[]
  /** Quem conta no número: "cães", "gatos" ou "cães e gatos". */
  quem: string
}>()

/** As mesmas cinco faixas do mapa: a barra do bairro tem a cor que ele tem no mapa. */
const FAIXAS = [40, 50, 60, 70]

function faixaDe(valor: number) {
  const indice = FAIXAS.findIndex((limite) => valor < limite)
  return indice === -1 ? FAIXAS.length : indice
}
</script>

<template>
  <ol class="lb sp-escala">
    <li v-for="bairro in bairros" :key="bairro.nome" class="lb__bairro">
      <span class="lb__nome">{{ bairro.nome }}</span>
      <span class="lb__valor ui-num">{{ bairro.valor }}%</span>
      <span class="lb__trilho" aria-hidden="true">
        <span
          class="lb__barra"
          :class="`lb__barra--faixa-${faixaDe(bairro.valor)}`"
          :style="{ width: `${bairro.valor}%` }"
        />
      </span>
      <span class="lb__publico">{{ numero(bairro.publico) }} {{ quem }}</span>
    </li>
  </ol>
</template>

<style scoped>
.lb {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.lb__bairro {
  display: grid;
  align-items: center;
  gap: 4px 12px;
  grid-template-columns: minmax(0, 1fr) auto;
}

.lb__nome {
  overflow: hidden;
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lb__valor {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 700;
}

.lb__trilho {
  position: relative;
  height: 8px;
  border-radius: 999px;
  background: var(--superficie);
  grid-column: 1 / -1;
}

.lb__barra {
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  border-radius: 999px;
}

.lb__barra--faixa-0 {
  background: var(--faixa-0);
}

.lb__barra--faixa-1 {
  background: var(--faixa-1);
}

.lb__barra--faixa-2 {
  background: var(--faixa-2);
}

.lb__barra--faixa-3 {
  background: var(--faixa-3);
}

.lb__barra--faixa-4 {
  background: var(--faixa-4);
}

.lb__publico {
  color: var(--tinta-3);
  font-size: 12px;
  grid-column: 1 / -1;
}
</style>
