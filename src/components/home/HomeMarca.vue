<script setup lang="ts">
/**
 * O cartão da marca: a logo da PetJourney no centro, sobre a cor principal de parceiro
 * (`#84C1B4`, a mesma do trilho lateral).
 *
 * Fecha a coluna da esquerda da visão geral e cresce para ocupar o que sobra dela, até a altura da
 * coluna da direita. É clicável, mas a ação ainda não foi decidida: o clique só emite `abrir`, e
 * quem usa o cartão decide o que fazer com ele.
 *
 * ## A textura
 *
 * A do cartão da marca do Prodify: um degradê do tom mais fundo à esquerda para o mais claro à
 * direita, um brilho no canto de cima, e por cima duas camadas de ruído — um grão fino que tira o
 * ar de chapado e partículas claras esparsas, o "pó" que se vê de perto. No hover o cartão sobe um
 * pouco, as partículas derivam devagar e uma faixa de luz atravessa na diagonal. Com movimento
 * reduzido, nada anda: só a sombra cresce.
 */
import Button from 'primevue/button'

import logoUrl from '@/assets/Logos/logo-png.png'

const emit = defineEmits<{ abrir: [] }>()
</script>

<template>
  <Button type="button" class="marca" aria-label="PetJourney" @click="emit('abrir')">
    <span class="marca__particulas" aria-hidden="true" />
    <span class="marca__luz" aria-hidden="true" />
    <img :src="logoUrl" alt="" class="marca__logo" />
  </Button>
</template>

<style scoped>
.marca.p-button {
  --marca-sombra: 0 1px 2px rgb(40 84 74 / 18%), 0 18px 40px -22px rgb(40 84 74 / 60%);

  position: relative;
  isolation: isolate;
  display: grid;
  flex: 1 0 11rem;
  place-items: center;
  width: 100%;
  min-height: 11rem;
  padding: 2rem;
  overflow: hidden;
  border: 0;
  border-radius: 1rem;
  background:
    radial-gradient(30rem 18rem at 100% -10%, rgb(255 255 255 / 30%), transparent 60%),
    radial-gradient(24rem 16rem at 0% 110%, rgb(47 108 95 / 35%), transparent 70%),
    linear-gradient(110deg, #5fa696 0%, #84c1b4 52%, #a6d5cb 100%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 28%),
    var(--marca-sombra);
  cursor: pointer;
  transition:
    translate 200ms ease-out,
    box-shadow 200ms ease-out;
}

/* O grão fino, espalhado por igual: textura de papel, não pontos. */
.marca.p-button::after {
  position: absolute;
  z-index: -1;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E");
  content: '';
  mix-blend-mode: soft-light;
  opacity: 0.3;
  pointer-events: none;
}

/*
 * As partículas: o mesmo ruído, cortado por limiar para sobrar só o pico — pontos brancos soltos,
 * de tamanhos diferentes, mais densos no alto do cartão, onde bate a luz.
 */
.marca__particulas {
  position: absolute;
  z-index: 0;
  inset: -12px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='p'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='1' seed='7' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 14 0 0 0 -9.8'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23p)'/%3E%3C/svg%3E");
  mask-image: linear-gradient(180deg, #000 0%, rgb(0 0 0 / 70%) 55%, rgb(0 0 0 / 35%) 100%);
  opacity: 0.7;
  pointer-events: none;
  transition: translate 1400ms ease-out;
}

/* A faixa de luz que atravessa no hover: parada fora do cartão, à esquerda, até o ponteiro chegar. */
.marca__luz {
  position: absolute;
  z-index: 1;
  inset-block: -20%;
  inset-inline-start: -60%;
  width: 45%;
  background: linear-gradient(
    100deg,
    transparent 0%,
    rgb(255 255 255 / 0%) 20%,
    rgb(255 255 255 / 26%) 50%,
    rgb(255 255 255 / 0%) 80%,
    transparent 100%
  );
  rotate: 12deg;
  pointer-events: none;
}

.marca.p-button:not(:disabled):hover {
  --marca-sombra: 0 2px 4px rgb(40 84 74 / 18%), 0 26px 50px -22px rgb(40 84 74 / 72%);

  translate: 0 -2px;
  background:
    radial-gradient(30rem 18rem at 100% -10%, rgb(255 255 255 / 38%), transparent 60%),
    radial-gradient(24rem 16rem at 0% 110%, rgb(47 108 95 / 35%), transparent 70%),
    linear-gradient(110deg, #5fa696 0%, #84c1b4 52%, #a6d5cb 100%);
}

.marca.p-button:hover .marca__particulas {
  translate: 10px -8px;
}

.marca.p-button:hover .marca__luz {
  translate: 400% 0;
  transition: translate 700ms ease-out;
}

.marca.p-button:not(:disabled):active {
  translate: 0 0;
}

.marca.p-button:focus-visible {
  outline: 2px solid #4f756b;
  outline-offset: 3px;
}

.app-dark .marca.p-button:focus-visible {
  outline-color: #bfe3db;
}

.marca__logo {
  position: relative;
  z-index: 2;
  /* A logo completa (pata, nome e slogan) tem folga própria no arquivo: larga o bastante para ler o slogan. */
  width: min(60%, 19rem);
  height: auto;
  filter: drop-shadow(0 2px 8px rgb(31 70 62 / 35%));
}

@media (prefers-reduced-motion: reduce) {
  .marca.p-button,
  .marca__particulas,
  .marca.p-button:hover .marca__luz {
    transition: none;
  }

  .marca.p-button:not(:disabled):hover,
  .marca.p-button:hover .marca__particulas {
    translate: none;
  }

  .marca__luz {
    display: none;
  }
}
</style>
