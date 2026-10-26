<script setup lang="ts">
/**
 * Os desenhos de traço do fundo dos destaques, como no app (`HeaderPattern`, em
 * `components/ds/ScreenHeader.tsx` do petjourney-app): bichos do Phosphor `light`, ossinho, a pata
 * da marca, corações e brilhos, em branco fino. Muitos no pé, saindo pela borda, e cada vez menos,
 * mais apagados conforme sobem.
 *
 * Os tamanhos se misturam dentro de cada faixa (um grande ao lado de um pequeno), em vez de todos
 * encolherem juntos: com tamanho único por altura o fundo virava fileira (pedido do Luís,
 * 2026-10-24, "mais e de tamanhos diferentes"). Os marcados `largo` só aparecem em painel com mais
 * de 700px: no celular o mesmo número de desenhos virava amontoado.
 *
 * `estreito`: o conjunto do topo da gaveta (uns 260 x 90), menor e com menos desenhos.
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
import { computed } from 'vue'

import pataDeTraco from '@/assets/Logos/pata-traco.png'

const props = defineProps<{
  /** O conjunto pequeno, para o topo da gaveta. */
  estreito?: boolean
}>()

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
  /** Só em painel largo (mais de 700px). */
  largo?: boolean
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
 * A mesma subida dos cabeçalhos do app, com mais desenhos por faixa: o painel aqui é três a quatro
 * vezes mais largo que um celular. As posições se desencontram de uma faixa para a outra, para não
 * formar coluna nem fileira reta.
 */
const RABISCOS_LARGOS: Rabisco[] = [
  // o pé: saem de baixo da borda, grandes e pequenos alternados
  { tipo: 'cachorro', tamanho: 34, giro: -8, baixo: -10, inicio: 1 },
  { tipo: 'brilho', tamanho: 14, baixo: 10, inicio: 6.5, largo: true },
  { tipo: 'pata', tamanho: 22, giro: 14, baixo: 3, inicio: 9.5 },
  { tipo: 'gato', tamanho: 30, giro: 6, baixo: -8, inicio: 15 },
  { tipo: 'coracao', tamanho: 15, giro: -10, baixo: 9, inicio: 21, largo: true },
  { tipo: 'osso', tamanho: 24, giro: -22, baixo: 4, inicio: 24.5 },
  { tipo: 'coelho', tamanho: 32, giro: -6, baixo: -9, inicio: 31 },
  { tipo: 'estrela', tamanho: 13, baixo: 11, inicio: 37, largo: true },
  { tipo: 'pata', tamanho: 30, giro: -12, baixo: 0, inicio: 40.5 },
  { tipo: 'peixe', tamanho: 24, giro: 10, baixo: -4, inicio: 47.5 },
  { tipo: 'brilho', tamanho: 16, baixo: 9, inicio: 53, largo: true },
  { tipo: 'passaro', tamanho: 30, giro: -8, baixo: 2, inicio: 56.5 },
  { tipo: 'cachorro', tamanho: 22, giro: 8, baixo: -5, inicio: 63.5 },
  { tipo: 'coracao', tamanho: 18, giro: 12, baixo: 8, inicio: 68, largo: true },
  { tipo: 'pata', tamanho: 34, giro: 18, baixo: -6, inicio: 72 },
  { tipo: 'gato', tamanho: 22, giro: -6, baixo: 3, inicio: 79.5 },
  { tipo: 'estrela', tamanho: 14, baixo: 10, inicio: 84, largo: true },
  { tipo: 'osso', tamanho: 28, giro: 20, baixo: -2, inicio: 87.5 },
  { tipo: 'coelho', tamanho: 20, giro: 8, baixo: 6, inicio: 94 },
  // faixa 1
  { tipo: 'pata', tamanho: 16, giro: 20, baixo: '15%', inicio: 4, alfa: 0.85 },
  { tipo: 'gato', tamanho: 24, giro: 8, baixo: '20%', inicio: 11, alfa: 0.85, largo: true },
  { tipo: 'brilho', tamanho: 12, baixo: '24%', inicio: 17.5, alfa: 0.8 },
  { tipo: 'coracao', tamanho: 20, giro: -12, baixo: '13%', inicio: 22, alfa: 0.85 },
  { tipo: 'cachorro', tamanho: 15, giro: -6, baixo: '22%', inicio: 29, alfa: 0.8, largo: true },
  { tipo: 'osso', tamanho: 22, giro: -18, baixo: '16%', inicio: 34.5, alfa: 0.82 },
  { tipo: 'estrela', tamanho: 12, baixo: '24%', inicio: 41, alfa: 0.8, largo: true },
  { tipo: 'passaro', tamanho: 20, giro: -8, baixo: '14%', inicio: 45.5, alfa: 0.82 },
  { tipo: 'pata', tamanho: 24, giro: -14, baixo: '21%', inicio: 52, alfa: 0.8 },
  { tipo: 'coelho', tamanho: 14, giro: 6, baixo: '13%', inicio: 59, alfa: 0.8, largo: true },
  { tipo: 'brilho', tamanho: 18, baixo: '23%', inicio: 64, alfa: 0.8 },
  { tipo: 'peixe', tamanho: 16, giro: 10, baixo: '15%', inicio: 70.5, alfa: 0.8, largo: true },
  { tipo: 'cachorro', tamanho: 24, giro: -6, baixo: '22%', inicio: 76, alfa: 0.78 },
  { tipo: 'coracao', tamanho: 13, giro: 10, baixo: '14%', inicio: 83, alfa: 0.78, largo: true },
  { tipo: 'pata', tamanho: 20, giro: 16, baixo: '20%', inicio: 89, alfa: 0.78 },
  { tipo: 'brilho', tamanho: 12, baixo: '15%', inicio: 96, alfa: 0.78, largo: true },
  // faixa 2
  { tipo: 'estrela', tamanho: 10, baixo: '34%', inicio: 2, alfa: 0.65 },
  { tipo: 'coelho', tamanho: 18, giro: -6, baixo: '31%', inicio: 8, alfa: 0.65, largo: true },
  { tipo: 'pata', tamanho: 12, giro: 16, baixo: '40%', inicio: 15, alfa: 0.62 },
  { tipo: 'coracao', tamanho: 20, giro: 10, baixo: '33%', inicio: 21, alfa: 0.62 },
  { tipo: 'brilho', tamanho: 11, baixo: '41%', inicio: 28, alfa: 0.6, largo: true },
  { tipo: 'gato', tamanho: 16, giro: 8, baixo: '30%', inicio: 33.5, alfa: 0.6 },
  { tipo: 'osso', tamanho: 12, giro: -20, baixo: '39%', inicio: 40, alfa: 0.6, largo: true },
  { tipo: 'pata', tamanho: 19, giro: -10, baixo: '32%', inicio: 46, alfa: 0.6 },
  { tipo: 'estrela', tamanho: 10, baixo: '41%', inicio: 53, alfa: 0.58, largo: true },
  { tipo: 'passaro', tamanho: 17, giro: -8, baixo: '31%', inicio: 58.5, alfa: 0.58 },
  { tipo: 'bolinha', tamanho: 7, baixo: '38%', inicio: 65, alfa: 0.58, largo: true },
  { tipo: 'coracao', tamanho: 13, giro: 8, baixo: '33%', inicio: 70, alfa: 0.58 },
  { tipo: 'cachorro', tamanho: 18, giro: -6, baixo: '40%', inicio: 76.5, alfa: 0.56, largo: true },
  { tipo: 'brilho', tamanho: 12, baixo: '31%', inicio: 83, alfa: 0.56 },
  { tipo: 'peixe', tamanho: 14, giro: 10, baixo: '39%', inicio: 89, alfa: 0.56, largo: true },
  { tipo: 'pata', tamanho: 11, giro: 14, baixo: '33%', inicio: 95, alfa: 0.56 },
  // faixa 3
  { tipo: 'bolinha', tamanho: 6, baixo: '50%', inicio: 5, alfa: 0.45 },
  { tipo: 'pata', tamanho: 14, giro: -14, baixo: '47%', inicio: 12, alfa: 0.45, largo: true },
  { tipo: 'brilho', tamanho: 9, baixo: '56%', inicio: 19, alfa: 0.45 },
  { tipo: 'coracao', tamanho: 12, giro: 8, baixo: '49%', inicio: 26, alfa: 0.44, largo: true },
  { tipo: 'estrela', tamanho: 8, baixo: '55%', inicio: 33, alfa: 0.44 },
  { tipo: 'gato', tamanho: 13, giro: 6, baixo: '47%', inicio: 40, alfa: 0.42, largo: true },
  { tipo: 'bolinha', tamanho: 7, baixo: '56%', inicio: 47, alfa: 0.42 },
  { tipo: 'pata', tamanho: 10, giro: -12, baixo: '50%', inicio: 54, alfa: 0.42 },
  { tipo: 'brilho', tamanho: 13, baixo: '47%', inicio: 61, alfa: 0.42, largo: true },
  { tipo: 'coelho', tamanho: 11, giro: -6, baixo: '55%', inicio: 68, alfa: 0.42 },
  { tipo: 'estrela', tamanho: 9, baixo: '48%', inicio: 75, alfa: 0.42, largo: true },
  { tipo: 'coracao', tamanho: 10, giro: 10, baixo: '56%', inicio: 82, alfa: 0.4 },
  { tipo: 'bolinha', tamanho: 6, baixo: '49%', inicio: 89, alfa: 0.4, largo: true },
  { tipo: 'pata', tamanho: 12, giro: 16, baixo: '54%', inicio: 95.5, alfa: 0.4 },
  // faixa 4: sumindo
  { tipo: 'brilho', tamanho: 8, baixo: '66%', inicio: 9, alfa: 0.32 },
  { tipo: 'bolinha', tamanho: 5, baixo: '71%', inicio: 20, alfa: 0.3, largo: true },
  { tipo: 'estrela', tamanho: 9, baixo: '64%', inicio: 31, alfa: 0.3 },
  { tipo: 'pata', tamanho: 9, giro: -10, baixo: '72%', inicio: 43, alfa: 0.3, largo: true },
  { tipo: 'bolinha', tamanho: 6, baixo: '65%', inicio: 55, alfa: 0.28 },
  { tipo: 'coracao', tamanho: 8, giro: 8, baixo: '70%', inicio: 66, alfa: 0.28, largo: true },
  { tipo: 'brilho', tamanho: 10, baixo: '63%', inicio: 78, alfa: 0.28 },
  { tipo: 'bolinha', tamanho: 5, baixo: '72%', inicio: 90, alfa: 0.26, largo: true },
  // faixa 5: quase nada
  { tipo: 'bolinha', tamanho: 4, baixo: '82%', inicio: 14, alfa: 0.22 },
  { tipo: 'brilho', tamanho: 6, baixo: '86%', inicio: 37, alfa: 0.2, largo: true },
  { tipo: 'estrela', tamanho: 6, baixo: '80%', inicio: 61, alfa: 0.2 },
  { tipo: 'bolinha', tamanho: 4, baixo: '85%', inicio: 84, alfa: 0.2, largo: true },
]

/** O topo da gaveta: a mesma subida, em escala de bolso. */
const RABISCOS_ESTREITOS: Rabisco[] = [
  // o pé
  { tipo: 'cachorro', tamanho: 22, giro: -8, baixo: -6, inicio: 3 },
  { tipo: 'pata', tamanho: 14, giro: 14, baixo: 6, inicio: 15 },
  { tipo: 'gato', tamanho: 18, giro: 6, baixo: -4, inicio: 26 },
  { tipo: 'brilho', tamanho: 10, baixo: 8, inicio: 37 },
  { tipo: 'osso', tamanho: 16, giro: -20, baixo: 0, inicio: 44 },
  { tipo: 'coracao', tamanho: 12, giro: 10, baixo: 7, inicio: 56 },
  { tipo: 'coelho', tamanho: 20, giro: -6, baixo: -5, inicio: 64 },
  { tipo: 'pata', tamanho: 18, giro: -12, baixo: 3, inicio: 77 },
  { tipo: 'estrela', tamanho: 10, baixo: 9, inicio: 89 },
  // faixa 1
  { tipo: 'brilho', tamanho: 9, baixo: '38%', inicio: 8, alfa: 0.7 },
  { tipo: 'pata', tamanho: 11, giro: 16, baixo: '44%', inicio: 30, alfa: 0.6 },
  { tipo: 'coracao', tamanho: 10, giro: -10, baixo: '35%', inicio: 50, alfa: 0.6 },
  { tipo: 'passaro', tamanho: 12, giro: -8, baixo: '42%', inicio: 70, alfa: 0.6 },
  { tipo: 'brilho', tamanho: 8, baixo: '36%', inicio: 92, alfa: 0.55 },
  // faixa 2: sumindo
  { tipo: 'bolinha', tamanho: 5, baixo: '62%', inicio: 20, alfa: 0.4 },
  { tipo: 'estrela', tamanho: 7, baixo: '70%', inicio: 45, alfa: 0.35 },
  { tipo: 'bolinha', tamanho: 5, baixo: '64%', inicio: 68, alfa: 0.35 },
  { tipo: 'brilho', tamanho: 7, baixo: '72%', inicio: 84, alfa: 0.3 },
]

const rabiscos = computed(() => (props.estreito ? RABISCOS_ESTREITOS : RABISCOS_LARGOS))

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
      v-for="(rabisco, indice) in rabiscos"
      :key="indice"
      class="rabiscos__traco"
      :class="{ 'rabiscos__traco--largo': rabisco.largo }"
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
  container-type: inline-size;
}

.rabiscos__traco {
  position: absolute;
  display: block;
  line-height: 0;
  opacity: calc(var(--rabiscos-forca, 0.2) * var(--rabisco-alfa));
}

/* Painel estreito (celular): só os desenhos de base, sem amontoar. */
.rabiscos__traco--largo {
  display: none;
}

@container (min-width: 700px) {
  .rabiscos__traco--largo {
    display: block;
  }
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
