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
 *
 * **Em fileira** (`em-linha`, o Início): os números descem para uma fileira embaixo da frase, na
 * largura dela, e o slot `lado` ganha a coluna da direita na altura toda. Os quatro quadros em 2 x 2
 * na ponta, longe da frase, deixavam o meio da faixa vazio em tela larga.
 */
import Skeleton from 'primevue/skeleton'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

import UiRabiscos from '@/components/ui/UiRabiscos.vue'

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
    /** Números numa fileira embaixo da frase, e o slot `lado` à direita. */
    emLinha?: boolean
  }>(),
  { resumo: '', sobre: '', indicadores: () => [], rotuloDosIndicadores: '', emLinha: false },
)
</script>

<template>
  <section class="abertura" :class="{ 'abertura--em-linha': emLinha }">
    <UiRabiscos />

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

    <div v-if="emLinha && $slots.lado" class="abertura__lado">
      <slot name="lado" />
    </div>
  </section>
</template>

<style scoped>
.abertura {
  /* A cor lisa do espaço, como o fundo dos destaques do app: sem degradê nem brilho. */
  --abertura-fundo: color-mix(in oklab, var(--pj-lugar) 62%, var(--rail));

  /* Branco fino a 20%, a mesma força dos desenhos do app. */
  --rabiscos-forca: 0.2;

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
  --rabiscos-forca: 0.14;

  box-shadow: 0 18px 40px -22px rgb(0 0 0 / 70%);
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

/*
 * Na moldura do app (o portal inteiro desde 26/10/2026) a abertura mora na faixa sálvia do
 * `UiPagina`, que já traz a cor e os desenhos: ela perde o bloco próprio e fica só com o texto
 * branco e os números em vidro, como o topo da home do app.
 */
.moldura-app .abertura {
  overflow: visible;
  padding: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.moldura-app .abertura > .rabiscos {
  display: none;
}

.moldura-app .abertura__sobre,
.moldura-app .abertura__resumo {
  color: #fff;
}

.moldura-app .abertura__titulo {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.5px;
}

/* Botão de apoio na faixa: o vidro escuro do app. O vidro claro clareava a sálvia e o branco caía. */
.moldura-app .abertura__acoes :deep(.p-button.p-button-secondary),
.moldura-app .abertura__acoes :deep(.p-button.p-button-text) {
  border-color: transparent;
  background: var(--app-vidro);
}

.moldura-app .abertura__acoes :deep(.p-button.p-button-secondary:hover),
.moldura-app .abertura__acoes :deep(.p-button.p-button-text:hover) {
  background: var(--app-vidro-forte);
}

.moldura-app .abertura__indicador {
  border: 0;
  border-radius: 18px;
  background: var(--app-vidro);
  backdrop-filter: none;
}

.moldura-app .abertura__indicador--link:hover {
  background: var(--app-vidro-forte);
  transform: none;
}

.moldura-app .abertura__rotulo {
  color: #fff;
  font-weight: 600;
}

/*
 * Em fileira: a frase e os números à esquerda, um embaixo do outro, os números dividindo a largura
 * em partes iguais; o `lado` à direita, na altura toda.
 */
.abertura--em-linha {
  display: grid;
  align-items: stretch;
  gap: 22px 28px;
  grid-template-areas:
    'texto lado'
    'numeros lado';
  grid-template-columns: minmax(0, 1fr) auto;
}

.abertura--em-linha .abertura__texto {
  align-self: end;
  grid-area: texto;
}

.abertura--em-linha .abertura__indicadores {
  align-self: start;
  grid-area: numeros;
  grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
}

.abertura__lado {
  display: grid;
  min-width: 0;
  grid-area: lado;
}

/* O lado que não desenhou nada (sem código de indicação) não guarda coluna. */
.abertura__lado:empty {
  display: none;
}

.abertura--em-linha:has(.abertura__lado:empty),
.abertura--em-linha:not(:has(.abertura__lado)) {
  grid-template-areas:
    'texto'
    'numeros';
  grid-template-columns: minmax(0, 1fr);
}

/* Faixa estreita (tablet): o lado desce para baixo dos números. */
@container faixa (max-width: 920px) {
  .abertura--em-linha {
    grid-template-areas:
      'texto'
      'numeros'
      'lado';
    grid-template-columns: minmax(0, 1fr);
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
