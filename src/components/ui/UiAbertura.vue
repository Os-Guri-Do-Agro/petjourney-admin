<script setup lang="ts">
/**
 * A abertura de uma tela de painel (Início, Hoje da Clínica, Hoje do Hotel): o painel na cor do
 * espaço que responde "como está o dia" antes de qualquer lista.
 *
 * À esquerda, a frase do momento e a ação principal; à direita, os poucos números que decidem o
 * que fazer primeiro, cada um levando à tela onde ele se resolve. Atrás, a trilha da marca — os
 * nós ligados da pata — atravessa o painel: é o mesmo desenho que liga os destinos na barra.
 *
 * Não é cabeçalho de toda tela: só das que abrem um espaço. As outras usam o título do `UiPagina`.
 */
import { RouterLink, type RouteLocationRaw } from 'vue-router'

export type IndicadorDaAbertura = {
  id: string
  valor: string | number
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
</script>

<template>
  <section class="abertura">
    <svg
      class="abertura__trilha"
      viewBox="0 0 640 240"
      preserveAspectRatio="xMaxYMid slice"
      aria-hidden="true"
    >
      <path
        d="M -20 220 C 120 210 170 120 280 128 S 430 210 520 120 S 600 20 680 30"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-dasharray="2 9"
      />
      <circle cx="280" cy="128" r="5" />
      <circle cx="430" cy="178" r="3.5" />
      <circle cx="610" cy="42" r="4.5" />
    </svg>

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
          <strong class="abertura__valor">{{ item.valor }}</strong>
          <span class="abertura__rotulo">{{ item.rotulo }}</span>
        </component>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.abertura {
  --abertura-fundo: color-mix(in oklab, var(--pj-lugar) 62%, var(--rail));

  position: relative;
  display: grid;
  align-items: center;
  gap: 24px 40px;
  grid-template-columns: minmax(0, 1fr) auto;
  overflow: hidden;
  padding: 30px 32px;
  border-radius: var(--raio-painel);
  background:
    radial-gradient(
      520px 260px at 100% 0%,
      color-mix(in oklab, var(--pj-lugar-claro) 42%, transparent),
      transparent 72%
    ),
    radial-gradient(
      420px 240px at 0% 100%,
      color-mix(in oklab, var(--pj-lugar) 55%, transparent),
      transparent 70%
    ),
    linear-gradient(135deg, var(--abertura-fundo) 0%, color-mix(in oklab, var(--pj-lugar) 88%, var(--rail)) 100%);
  box-shadow:
    0 18px 40px -22px color-mix(in oklab, var(--pj-lugar) 75%, transparent),
    inset 0 1px 0 rgb(255 255 255 / 14%);
  color: #fff;
  isolation: isolate;
}

.app-dark .abertura {
  --abertura-fundo: color-mix(in oklab, var(--pj-lugar) 26%, var(--rail));

  background:
    radial-gradient(
      520px 260px at 100% 0%,
      color-mix(in oklab, var(--pj-lugar) 30%, transparent),
      transparent 72%
    ),
    linear-gradient(
      135deg,
      var(--abertura-fundo) 0%,
      color-mix(in oklab, var(--pj-lugar) 42%, var(--rail)) 100%
    );
  box-shadow:
    0 18px 40px -22px rgb(0 0 0 / 70%),
    inset 0 1px 0 rgb(255 255 255 / 8%);
}

.abertura__trilha {
  position: absolute;
  z-index: -1;
  inset: 0;
  width: 100%;
  height: 100%;
  color: rgb(255 255 255 / 30%);
  fill: rgb(255 255 255 / 36%);

  /* A trilha nasce depois do texto: atrás da frase ela só atrapalharia a leitura. */
  mask-image: linear-gradient(90deg, transparent 0%, transparent 38%, #000 62%);
}

.abertura__texto {
  display: grid;
  min-width: 0;
  justify-items: start;
  gap: 6px;
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
  margin-top: 14px;
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

/* Os números: vidro sobre a cor, um ao lado do outro. */
.abertura__indicadores {
  display: grid;
  gap: 10px;
  grid-auto-columns: minmax(118px, 1fr);
  grid-auto-flow: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.abertura__indicador {
  display: grid;
  height: 100%;
  align-content: start;
  gap: 2px;
  padding: 14px 16px 15px;
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
  margin-bottom: 6px;
  color: rgb(255 255 255 / 82%);
  font-size: 18px;
}

.abertura__ponto {
  width: 9px;
  height: 9px;
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
  font-size: 28px;
  font-variant-numeric: tabular-nums;
  font-weight: 650;
  letter-spacing: -0.03em;
  line-height: 1.05;
}

.abertura__rotulo {
  color: rgb(255 255 255 / 82%);
  font-size: 12.5px;
  line-height: 1.3;
}

@media (max-width: 1180px) {
  .abertura {
    grid-template-columns: minmax(0, 1fr);
  }

  .abertura__indicadores {
    grid-auto-flow: row;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  }
}

@media (max-width: 600px) {
  .abertura {
    padding: 22px 20px;
  }

  .abertura__titulo {
    font-size: 24px;
  }

  .abertura__indicadores {
    grid-template-columns: repeat(2, minmax(0, 1fr));
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
