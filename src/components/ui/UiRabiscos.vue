<script setup lang="ts">
/**
 * Os desenhos de traço do fundo dos destaques, como no app (`HeaderPattern`, em
 * `components/ds/ScreenHeader.tsx` do petjourney-app): bichos do Phosphor `light`, ossinho, a pata
 * da marca, corações e brilhos, em branco fino. Muitos no pé, saindo pela borda, e cada vez menos,
 * menores e mais apagados conforme sobem.
 *
 * Camada de fundo: o pai precisa de `position: relative`, `overflow: hidden` e `isolation:
 * isolate`. A força dos traços vem de `--rabiscos-forca` no pai (padrão 0,2, a do app).
 */
import {
  PhBird,
  PhBone,
  PhCat,
  PhDog,
  PhFishSimple,
  PhHeart,
  PhRabbit,
  PhSparkle,
  PhStar,
} from '@phosphor-icons/vue'

import pataDeTraco from '@/assets/Logos/pata-traco.png'

type Rabisco = {
  tipo:
    | 'pata'
    | 'brilho'
    | 'coracao'
    | 'estrela'
    | 'bolinha'
    | 'cachorro'
    | 'gato'
    | 'passaro'
    | 'peixe'
    | 'coelho'
    | 'osso'
  tamanho: number
  giro?: number
  /** px a partir da borda de baixo (negativo sai por ela), ou % da altura do painel. */
  baixo: number | `${number}%`
  /** % da largura, a partir do começo da linha (troca de lado no árabe). */
  inicio: number
  /** Multiplica a opacidade dos desenhos: os de cima vão sumindo. Padrão: 1. */
  alfa?: number
}

/** Bichos e afins em traço fino (Phosphor `light`). A pata é a imagem da marca, como no app. */
const ICONE_DO_RABISCO = {
  brilho: PhSparkle,
  coracao: PhHeart,
  estrela: PhStar,
  cachorro: PhDog,
  gato: PhCat,
  passaro: PhBird,
  peixe: PhFishSimple,
  coelho: PhRabbit,
  osso: PhBone,
}

/*
 * A mesma subida dos cabeçalhos do app (`HeaderPattern`, em `components/ds/ScreenHeader.tsx`),
 * com mais desenhos por faixa: o painel aqui é três a quatro vezes mais largo que um celular. As
 * posições se desencontram de uma faixa para a outra, para não formar coluna nem fileira reta.
 */
const RABISCOS: Rabisco[] = [
  // o pé: saem de baixo da borda, em alturas desencontradas
  { tipo: 'cachorro', tamanho: 28, giro: -8, baixo: -7, inicio: 2 },
  { tipo: 'pata', tamanho: 24, giro: 14, baixo: 4, inicio: 10 },
  { tipo: 'gato', tamanho: 27, giro: 6, baixo: -6, inicio: 18.5 },
  { tipo: 'osso', tamanho: 21, giro: -22, baixo: 6, inicio: 27 },
  { tipo: 'coelho', tamanho: 27, giro: -6, baixo: -7, inicio: 35.5 },
  { tipo: 'pata', tamanho: 28, giro: -12, baixo: 2, inicio: 44 },
  { tipo: 'peixe', tamanho: 26, giro: 10, baixo: -5, inicio: 52.5 },
  { tipo: 'passaro', tamanho: 25, giro: -8, baixo: 5, inicio: 61 },
  { tipo: 'cachorro', tamanho: 27, giro: 8, baixo: -6, inicio: 69.5 },
  { tipo: 'pata', tamanho: 24, giro: 18, baixo: 3, inicio: 78 },
  { tipo: 'gato', tamanho: 26, giro: -6, baixo: -6, inicio: 86.5 },
  { tipo: 'osso', tamanho: 20, giro: 20, baixo: 5, inicio: 95 },
  // faixa 1
  { tipo: 'pata', tamanho: 19, giro: 20, baixo: '14%', inicio: 6, alfa: 0.85 },
  { tipo: 'coracao', tamanho: 17, giro: -12, baixo: '21%', inicio: 14.5, alfa: 0.85 },
  { tipo: 'passaro', tamanho: 19, giro: -8, baixo: '12%', inicio: 23, alfa: 0.85 },
  { tipo: 'gato', tamanho: 18, giro: 8, baixo: '19%', inicio: 31.5, alfa: 0.8 },
  { tipo: 'brilho', tamanho: 16, baixo: '15%', inicio: 40, alfa: 0.8 },
  { tipo: 'cachorro', tamanho: 19, giro: -6, baixo: '22%', inicio: 48.5, alfa: 0.8 },
  { tipo: 'estrela', tamanho: 15, baixo: '13%', inicio: 57, alfa: 0.8 },
  { tipo: 'pata', tamanho: 18, giro: -14, baixo: '20%', inicio: 65.5, alfa: 0.8 },
  { tipo: 'coelho', tamanho: 18, giro: 6, baixo: '14%', inicio: 74, alfa: 0.8 },
  { tipo: 'coracao', tamanho: 16, giro: 10, baixo: '21%', inicio: 82.5, alfa: 0.78 },
  { tipo: 'brilho', tamanho: 15, baixo: '16%', inicio: 91, alfa: 0.78 },
  // faixa 2
  { tipo: 'brilho', tamanho: 14, baixo: '33%', inicio: 3, alfa: 0.65 },
  { tipo: 'osso', tamanho: 15, giro: -20, baixo: '39%', inicio: 15, alfa: 0.62 },
  { tipo: 'pata', tamanho: 15, giro: 16, baixo: '30%', inicio: 27, alfa: 0.62 },
  { tipo: 'estrela', tamanho: 13, baixo: '37%', inicio: 39, alfa: 0.6 },
  { tipo: 'coelho', tamanho: 15, giro: -6, baixo: '31%', inicio: 51, alfa: 0.6 },
  { tipo: 'coracao', tamanho: 14, giro: 10, baixo: '38%', inicio: 63, alfa: 0.6 },
  { tipo: 'passaro', tamanho: 15, giro: -8, baixo: '32%', inicio: 75, alfa: 0.58 },
  { tipo: 'pata', tamanho: 14, giro: -10, baixo: '39%', inicio: 87, alfa: 0.58 },
  // faixa 3
  { tipo: 'estrela', tamanho: 11, baixo: '50%', inicio: 9, alfa: 0.45 },
  { tipo: 'brilho', tamanho: 10, baixo: '56%', inicio: 25, alfa: 0.42 },
  { tipo: 'pata', tamanho: 11, giro: -14, baixo: '47%', inicio: 41, alfa: 0.42 },
  { tipo: 'bolinha', tamanho: 7, baixo: '54%', inicio: 57, alfa: 0.4 },
  { tipo: 'coracao', tamanho: 10, giro: 8, baixo: '49%', inicio: 73, alfa: 0.4 },
  { tipo: 'bolinha', tamanho: 7, baixo: '55%', inicio: 89, alfa: 0.4 },
  // faixa 4: sumindo
  { tipo: 'bolinha', tamanho: 6, baixo: '66%', inicio: 18, alfa: 0.3 },
  { tipo: 'brilho', tamanho: 8, baixo: '71%', inicio: 42, alfa: 0.26 },
  { tipo: 'bolinha', tamanho: 5, baixo: '68%', inicio: 66, alfa: 0.24 },
  { tipo: 'estrela', tamanho: 7, baixo: '72%', inicio: 90, alfa: 0.24 },
]

function estiloDoRabisco(rabisco: Rabisco) {
  return {
    bottom: typeof rabisco.baixo === 'number' ? `${rabisco.baixo}px` : rabisco.baixo,
    insetInlineStart: `${rabisco.inicio}%`,
    '--rabisco-alfa': rabisco.alfa ?? 1,
    transform: rabisco.giro ? `rotate(${rabisco.giro}deg)` : undefined,
  }
}
</script>

<template>
  <div class="rabiscos" aria-hidden="true">
    <span
      v-for="(rabisco, indice) in RABISCOS"
      :key="indice"
      class="rabiscos__traco"
      :style="estiloDoRabisco(rabisco)"
    >
      <img
        v-if="rabisco.tipo === 'pata'"
        :src="pataDeTraco"
        alt=""
        :width="rabisco.tamanho"
        :height="rabisco.tamanho"
      />
      <span
        v-else-if="rabisco.tipo === 'bolinha'"
        class="rabiscos__bolinha"
        :style="{ width: `${rabisco.tamanho}px`, height: `${rabisco.tamanho}px` }"
      />
      <component
        :is="ICONE_DO_RABISCO[rabisco.tipo]"
        v-else
        :size="rabisco.tamanho"
        weight="light"
      />
    </span>
  </div>
</template>

<style scoped>
.rabiscos {
  position: absolute;
  z-index: -1;
  inset: 0;
  color: #fff;
  pointer-events: none;
}

.rabiscos__traco {
  position: absolute;
  display: block;
  line-height: 0;
  opacity: calc(var(--rabiscos-forca, 0.2) * var(--rabisco-alfa));
}

.rabiscos__traco img {
  display: block;
}

.rabiscos__bolinha {
  display: block;
  border: 1.5px solid currentColor;
  border-radius: 50%;
}
</style>
