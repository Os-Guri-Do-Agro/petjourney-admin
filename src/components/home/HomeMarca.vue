<script setup lang="ts">
/**
 * A marca, fechando o Início: a logo da PetJourney sobre o destaque do app.
 *
 * É a parte mais calma da página, de propósito — vem depois de tudo o que pede trabalho. Desde
 * 26/10/2026 segue o desenho do app: a sálvia lisa do destaque (a mesma do topo das telas), com os
 * desenhos de traço, e a logo em branco. Sem brilho, sem degradê e sem a pegada grande no canto
 * (o app proíbe pata solta como enfeite). Tem a altura da logo, não a da coluna: bloco de cor alto
 * e vazio lia como cartão esquecido.
 *
 * O cartão só é clicável quando alguém ouve `abrir` (a ação ainda não foi decidida). Sem ouvinte,
 * é uma figura: um botão que não faz nada ensinaria a desconfiar dos outros botões.
 */
import { computed, getCurrentInstance } from 'vue'

import logoUrl from '@/assets/Logos/logo-png.png'
import UiRabiscos from '@/components/ui/UiRabiscos.vue'

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
    <UiRabiscos />
    <img :src="logoUrl" alt="" class="marca__logo" />
  </button>
  <figure v-else class="marca" role="img" aria-label="PetJourney">
    <UiRabiscos />
    <img :src="logoUrl" alt="" class="marca__logo" />
  </figure>
</template>

<style scoped>
.marca {
  --rabiscos-forca: 0.2;

  position: relative;
  isolation: isolate;
  display: grid;
  width: 100%;
  min-height: 140px;
  place-items: center;
  margin: 0;
  padding: 28px;
  overflow: hidden;
  border: 0;
  border-radius: 22px;
  background: var(--app-destaque, #76938d);
  color: #fff;
}

.app-dark .marca {
  --rabiscos-forca: 0.14;
}

.marca__logo {
  position: relative;
  width: min(56%, 14rem);
  height: auto;
}

.marca--clicavel {
  cursor: pointer;
}

.marca--clicavel:focus-visible {
  outline: 2px solid var(--app-salvia-texto, var(--musgo));
  outline-offset: 3px;
}
</style>
