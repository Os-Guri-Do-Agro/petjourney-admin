<script setup lang="ts">
/**
 * A marca, fechando o Início: a logo da PetJourney sobre o verde da barra.
 *
 * É a parte mais calma da página, de propósito — vem depois de tudo o que pede trabalho. O fundo é
 * o mesmo `--rail` da barra lateral, com um brilho de sálvia num canto e uma pegada grande, apagada,
 * no outro: a página termina na mesma cor em que a barra começa.
 *
 * O cartão só é clicável quando alguém ouve `abrir` (a ação ainda não foi decidida). Sem ouvinte,
 * é uma figura: um botão que não faz nada ensinaria a desconfiar dos outros botões.
 */
import { computed, getCurrentInstance } from 'vue'

import logoUrl from '@/assets/Logos/logo-png.png'

const emit = defineEmits<{ abrir: [] }>()

const instancia = getCurrentInstance()

const clicavel = computed(() => Boolean(instancia?.vnode.props?.onAbrir))
</script>

<template>
  <button
    v-if="clicavel"
    type="button"
    class="marca marca--clicavel"
    aria-label="PetJourney"
    @click="emit('abrir')"
  >
    <i class="ph ph-paw-print marca__pata" aria-hidden="true" />
    <img :src="logoUrl" alt="" class="marca__logo" />
  </button>
  <figure v-else class="marca" role="img" aria-label="PetJourney">
    <i class="ph ph-paw-print marca__pata" aria-hidden="true" />
    <img :src="logoUrl" alt="" class="marca__logo" />
  </figure>
</template>

<style scoped>
.marca {
  position: relative;
  isolation: isolate;
  display: grid;
  width: 100%;
  min-height: 148px;
  place-items: center;
  margin: 0;
  padding: 28px;
  overflow: hidden;
  border: 0;
  border-radius: 16px;
  background:
    radial-gradient(
      28rem 14rem at 100% 0%,
      color-mix(in oklab, var(--salvia) 38%, transparent),
      transparent 70%
    ),
    var(--rail);
  color: var(--sobre-rail);
}

/* Uma pegada grande, apagada, saindo pelo canto de baixo: marca-d'água, não figura. */
.marca__pata {
  position: absolute;
  z-index: -1;
  inset-block-end: -46px;
  inset-inline-end: -30px;
  color: var(--sobre-rail);
  font-size: 190px;
  line-height: 1;
  opacity: 0.06;
  rotate: -24deg;
}

.marca__logo {
  width: min(56%, 15rem);
  height: auto;
}

.marca--clicavel {
  cursor: pointer;
  transition: translate var(--pj-tempo-medio) var(--pj-curva-chega);
}

.marca--clicavel:hover {
  translate: 0 -2px;
}

.marca--clicavel:focus-visible {
  outline: 2px solid var(--musgo);
  outline-offset: 3px;
}

@media (prefers-reduced-motion: reduce) {
  .marca--clicavel {
    transition: none;
  }

  .marca--clicavel:hover {
    translate: none;
  }
}
</style>
