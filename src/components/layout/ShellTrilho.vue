<script setup lang="ts">
/**
 * O trilho de ícones flutuante, para a moldura sem barra lateral larga.
 *
 * Um cartão estreito preso no alto, à esquerda: a pata (leva ao Início), o Início e cada espaço
 * (Clínica, Hotel, Portal) com o ícone e o nome embaixo, o aberto em sálvia; e, no pé, a conta. Os
 * destinos do espaço aberto não moram aqui: a página os mostra em abas, embaixo do título.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'

import ShellConta from '@/components/layout/ShellConta.vue'
import type { Espaco, Localizacao } from '@/navegacao/espacos'

const props = defineProps<{
  espacos: Espaco[]
  aqui: Localizacao
}>()

const { t } = useI18n()
const route = useRoute()

const noInicio = computed(() => route.path === '/inicio')

function aberto(espaco: Espaco) {
  return !noInicio.value && props.aqui.espaco?.id === espaco.id
}
</script>

<template>
  <nav class="trilho" :aria-label="t('shell.barra.navegacao')">
    <RouterLink class="trilho__marca" to="/inicio" :title="t('shell.barra.inicio')">
      <img src="/pata-clara.png" alt="" width="22" height="22" />
      <span class="trilho__oculto">PetJourney</span>
    </RouterLink>

    <ul class="trilho__itens">
      <li>
        <RouterLink
          class="trilho__item"
          :class="{ 'trilho__item--aberto': noInicio }"
          to="/inicio"
          :aria-current="noInicio ? 'page' : undefined"
        >
          <span class="trilho__icone" aria-hidden="true"><i class="ph ph-house" /></span>
          <span class="trilho__rotulo">{{ t('shell.barra.inicio') }}</span>
        </RouterLink>
      </li>
      <li v-for="espaco in espacos" :key="espaco.id">
        <RouterLink
          class="trilho__item"
          :class="{ 'trilho__item--aberto': aberto(espaco) }"
          :to="espaco.to"
          :aria-current="aberto(espaco) ? 'page' : undefined"
        >
          <span class="trilho__icone" aria-hidden="true">
            <i :class="espaco.icone" />
            <span v-if="espaco.selo && !aberto(espaco)" class="trilho__ponto" />
          </span>
          <span class="trilho__rotulo">{{ espaco.rotulo }}</span>
        </RouterLink>
      </li>
    </ul>

    <div class="trilho__pe">
      <ShellConta class="trilho__conta" :recolhida="true" />
      <span class="trilho__rotulo" aria-hidden="true">{{ t('shell.barra.conta') }}</span>
    </div>
  </nav>
</template>

<style scoped>
/* Na altura do que tem dentro, preso no alto: um cartão, não uma coluna. */
.trilho {
  position: sticky;
  top: 12px;
  display: flex;
  align-self: start;
  width: 76px;
  max-height: calc(100dvh - 24px);
  flex-direction: column;
  align-items: center;
  gap: 18px;
  margin: 12px 0 12px 12px;
  padding: 12px 8px 14px;
  border-radius: 32px;
  background: var(--ct-cartao);
  box-shadow: var(--ct-sombra);
}

.trilho__marca {
  display: grid;
  width: 48px;
  height: 48px;
  flex: none;
  place-items: center;
  border-radius: 50%;
  background: var(--ct-logo);
}

.trilho__marca:focus-visible,
.trilho__item:focus-visible {
  outline: 2px solid var(--ct-marca-forte);
  outline-offset: 2px;
}

.trilho__oculto {
  position: absolute;
  overflow: hidden;
  width: 1px;
  height: 1px;
  clip-path: inset(50%);
  white-space: nowrap;
}

.trilho__itens {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.trilho__item {
  display: grid;
  justify-items: center;
  gap: 4px;
  color: var(--ct-tinta-2);
  text-decoration: none;
}

.trilho__icone {
  position: relative;
  display: grid;
  width: 52px;
  height: 40px;
  place-items: center;
  border-radius: 14px;
  font-size: 20px;
  transition: background-color 150ms ease-out;
}

.trilho__item:hover .trilho__icone {
  background: var(--ct-cartao-2);
}

.trilho__item--aberto {
  color: var(--ct-tinta);
}

.trilho__item--aberto .trilho__icone,
.trilho__item--aberto:hover .trilho__icone {
  background: var(--ct-salvia);
  color: var(--ct-sobre-salvia);
}

.trilho__ponto {
  position: absolute;
  top: 7px;
  right: 12px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--ct-coral);
}

.trilho__rotulo {
  font-size: 11px;
  font-weight: 600;
  line-height: 1.2;
}

.trilho__item--aberto .trilho__rotulo {
  font-weight: 700;
}

.trilho__pe {
  display: grid;
  justify-items: center;
  gap: 4px;
  margin-top: 10px;
  color: var(--ct-tinta-2);
}

/* A conta só com o rosto, num círculo. */
.trilho__conta :deep(.shell-rotulo) {
  display: none;
}

.trilho__conta :deep(.conta__botao) {
  width: auto;
  padding: 2px;
  border: 0;
  border-radius: 50%;
  background: transparent;
}

.trilho__conta :deep(.conta__avatar) {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  box-shadow: none;
}
</style>
