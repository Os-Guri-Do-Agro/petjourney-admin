<script setup lang="ts">
/**
 * A abertura de uma tela de painel (Início, Hoje da Clínica, Hoje do Hotel): o painel na cor do
 * espaço que responde "como está o dia" antes de qualquer lista.
 *
 * À esquerda, a frase do momento e a ação principal; à direita, os poucos números que decidem o
 * que fazer primeiro, em 2 x 2, cada um levando à tela onde ele se resolve. Quando a frase não cabe
 * ao lado, os números descem para baixo dela, do mesmo tamanho.
 *
 * O fundo é o do app: cor lisa do espaço com os desenhos de traço branco (bichos, ossinho, a pata
 * da marca, corações e brilhos), muitos no pé e cada vez menos, menores e mais apagados conforme
 * sobem. Fracos o bastante para não atrapalhar a leitura quando caem atrás do texto.
 *
 * Não é cabeçalho de toda tela: só das que abrem um espaço. As outras usam o título do `UiPagina`.
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
import Skeleton from 'primevue/skeleton'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

import pataDeTraco from '@/assets/Logos/pata-traco.png'

export type IndicadorDaAbertura = {
  id: string
  /** `null` enquanto o número carrega: o quadro fica no lugar, com o esqueleto. */
  valor: string | number | null
  rotulo: string
  icone: string
  to?: RouteLocationRaw
  /** Só quando o número é um alerta: ganha um ponto na cor do estado. */
  tom?: 'risco' | 'atencao'
}

withDefaults(
  defineProps<{
    titulo: string
    resumo?: string
    /** Linha pequena acima do título (a data, por exemplo). */
    sobre?: string
    indicadores?: IndicadorDaAbertura[]
    /** Rótulo da lista de números, para o leitor de tela. */
    rotuloDosIndicadores?: string
  }>(),
  { resumo: '', sobre: '', indicadores: () => [], rotuloDosIndicadores: '' },
)

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
  <section class="abertura">
    <div class="abertura__rabiscos" aria-hidden="true">
      <span
        v-for="(rabisco, indice) in RABISCOS"
        :key="indice"
        class="abertura__rabisco"
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
          class="abertura__bolinha"
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

    <div class="abertura__texto">
      <p v-if="sobre" class="abertura__sobre">{{ sobre }}</p>
      <h1 class="abertura__titulo">{{ titulo }}</h1>
      <p v-if="resumo || $slots.resumo" class="abertura__resumo">
        <slot name="resumo">{{ resumo }}</slot>
      </p>
      <div v-if="$slots.acoes" class="abertura__acoes">
        <slot name="acoes" />
      </div>
    </div>

    <ul
      v-if="indicadores.length"
      class="abertura__indicadores"
      :aria-label="rotuloDosIndicadores || undefined"
    >
      <li v-for="item in indicadores" :key="item.id">
        <component
          :is="item.to ? RouterLink : 'div'"
          class="abertura__indicador"
          :class="{ 'abertura__indicador--link': item.to }"
          :to="item.to"
        >
          <span class="abertura__indicador-topo">
            <i :class="item.icone" aria-hidden="true" />
            <span
              v-if="item.tom"
              class="abertura__ponto"
              :class="`abertura__ponto--${item.tom}`"
              aria-hidden="true"
            />
          </span>
          <Skeleton
            v-if="item.valor === null"
            class="abertura__esqueleto"
            width="2.2rem"
            height="1.7rem"
            border-radius="7px"
          />
          <strong v-else class="abertura__valor">{{ item.valor }}</strong>
          <span class="abertura__rotulo">{{ item.rotulo }}</span>
        </component>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.abertura {
  /* A cor lisa do espaço, como o fundo dos destaques do app: sem degradê nem brilho. */
  --abertura-fundo: color-mix(in oklab, var(--pj-lugar) 62%, var(--rail));

  /* Branco fino a 20%, a mesma força dos desenhos do app. */
  --abertura-rabisco: 0.2;

  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 24px 32px;
  overflow: hidden;
  padding: 30px 34px;
  border-radius: var(--raio-painel);
  background: var(--abertura-fundo);
  box-shadow: 0 18px 40px -22px color-mix(in oklab, var(--pj-lugar) 75%, transparent);
  color: #fff;
  isolation: isolate;
}

.app-dark .abertura {
  --abertura-fundo: color-mix(in oklab, var(--pj-lugar) 26%, var(--rail));
  --abertura-rabisco: 0.14;

  box-shadow: 0 18px 40px -22px rgb(0 0 0 / 70%);
}

.abertura__rabiscos {
  position: absolute;
  z-index: -1;
  inset: 0;
  color: #fff;
  pointer-events: none;
}

.abertura__rabisco {
  position: absolute;
  display: block;
  line-height: 0;
  opacity: calc(var(--abertura-rabisco) * var(--rabisco-alfa));
}

.abertura__rabisco img {
  display: block;
}

.abertura__bolinha {
  display: block;
  border: 1.5px solid currentColor;
  border-radius: 50%;
}

.abertura__texto {
  display: grid;
  min-width: 0;
  flex: 1 1 260px;
  justify-items: start;
  gap: 8px;
}

.abertura__sobre {
  margin: 0;
  color: rgb(255 255 255 / 78%);
  font-size: 13.5px;
  font-weight: 500;
}

.abertura__titulo {
  margin: 0;
  font-size: 30px;
  font-weight: 650;
  letter-spacing: -0.025em;
  line-height: 1.12;
  text-wrap: balance;
}

.abertura__resumo {
  max-width: 60ch;
  margin: 0;
  color: rgb(255 255 255 / 86%);
  font-size: 15px;
  line-height: 1.5;
}

.abertura__acoes {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 18px;
}

/*
 * Os botões sobre a cor: o principal vira papel branco com a tinta escura; os outros, vidro.
 * `:deep` porque são `Button` do PrimeVue, montados pelo slot.
 */
.abertura__acoes :deep(.p-button:not(.p-button-secondary):not(.p-button-text)) {
  border-color: #fff;
  background: #fff;
  box-shadow: 0 8px 20px -10px rgb(0 0 0 / 45%);
  color: var(--rail);
}

.abertura__acoes :deep(.p-button:not(.p-button-secondary):not(.p-button-text):hover) {
  background: rgb(255 255 255 / 90%);
}

.abertura__acoes :deep(.p-button.p-button-secondary),
.abertura__acoes :deep(.p-button.p-button-text) {
  border-color: rgb(255 255 255 / 28%);
  background: rgb(255 255 255 / 12%);
  box-shadow: none;
  color: #fff;
}

.abertura__acoes :deep(.p-button.p-button-secondary:hover),
.abertura__acoes :deep(.p-button.p-button-text:hover) {
  background: rgb(255 255 255 / 20%);
}

.abertura__acoes :deep(.p-button:focus-visible) {
  box-shadow: 0 0 0 2px var(--abertura-fundo), 0 0 0 4px #fff;
}

/*
 * Os números: vidro sobre a cor, dois por linha. A grade tem a largura dos quadros e não estica:
 * ao lado da frase ou embaixo dela, os quadros ficam do mesmo tamanho.
 */
.abertura__indicadores {
  display: grid;
  flex: 0 0 auto;
  gap: 10px;
  grid-template-columns: repeat(2, minmax(124px, 1fr));
  margin: 0;
  padding: 0;
  list-style: none;
}

.abertura__indicador {
  display: grid;
  height: 100%;
  align-content: start;
  gap: 2px;
  padding: 12px 14px 13px;
  border: 1px solid rgb(255 255 255 / 16%);
  border-radius: var(--raio-cartao-pequeno);
  background: rgb(255 255 255 / 10%);
  color: #fff;
  text-decoration: none;
  backdrop-filter: blur(6px);
  transition:
    background-color var(--pj-tempo-curto) var(--pj-curva-chega),
    transform var(--pj-tempo-curto) var(--pj-curva-chega);
}

.abertura__indicador--link:hover {
  background: rgb(255 255 255 / 17%);
  transform: translateY(-1px);
}

.abertura__indicador--link:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}

.abertura__indicador-topo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  color: #fff;
  font-size: 16px;
}

/* O ícone num disco de vidro: dá ao número um ponto de partida. */
.abertura__indicador-topo > i {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 9px;
  background: rgb(255 255 255 / 14%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 12%);
}

.abertura__ponto {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  box-shadow: 0 0 0 3px rgb(255 255 255 / 18%);
}

.abertura__ponto--risco {
  background: #ff9d92;
}

.abertura__ponto--atencao {
  background: #ffc58f;
}

.abertura__valor {
  font-family: var(--font-dados);
  font-size: 26px;
  font-variant-numeric: tabular-nums;
  font-weight: 650;
  letter-spacing: -0.03em;
  line-height: 1.05;
}

/* O esqueleto em vidro, da cor do número que vai entrar no lugar. */
.abertura__esqueleto {
  background: rgb(255 255 255 / 16%);
}

.abertura__rotulo {
  color: rgb(255 255 255 / 86%);
  font-size: 12.5px;
  font-weight: 500;
  line-height: 1.35;
}

@media (max-width: 600px) {
  .abertura {
    padding: 22px 20px;
  }

  .abertura__titulo {
    font-size: 24px;
  }

  .abertura__indicadores {
    gap: 8px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .abertura__indicador {
    transition: none;
  }

  .abertura__indicador--link:hover {
    transform: none;
  }
}
</style>
