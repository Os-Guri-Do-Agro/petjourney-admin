<script setup lang="ts">
/**
 * A grade de desenhos, para quem cadastra corredor ou tipo de vaga.
 *
 * ## Por que existe
 *
 * Porque o **nome** dessas coisas é da casa e o **desenho** é nosso, e essa divisão precisa de um
 * lugar só. O corredor e o tipo de acomodação sofriam do mesmo defeito: cada um tinha um `kind`
 * fechado — `canil | gatil | externo | isolamento` num, `suite | baia | gatil | coletiva |
 * isolamento` no outro — que era, ao mesmo tempo, o nome imposto e o desenho. Separar os dois
 * devolve a palavra a quem trabalha na casa sem perder o ícone.
 *
 * ## Por que grade e não `Select`
 *
 * São nove formas. Escolher forma lendo o nome dela é escolher errado — e o nome interno ("cao",
 * "arvore") não é texto de interface, é chave. Na grade a pessoa vê o que está escolhendo.
 *
 * Cada célula é um rádio de verdade: o teclado anda entre elas com as setas, e o leitor de tela
 * anuncia o grupo. O `<input>` some da tela, não da árvore de acessibilidade.
 */
import {
  PhBed,
  PhBird,
  PhCat,
  PhDog,
  PhHouseLine,
  PhRabbit,
  PhShieldCheck,
  PhTree,
  PhUsersThree,
} from '@phosphor-icons/vue'
import { useI18n } from 'vue-i18n'
import type { Component } from 'vue'

import type { IconeDeAcomodacao } from '../../data/types'

defineProps<{
  /** Nome do grupo de rádio. Dois grupos na mesma página não podem dividir o mesmo. */
  grupo: string
  rotulo: string
}>()

const desenho = defineModel<IconeDeAcomodacao>({ required: true })

const { t } = useI18n()

/*
 * `Record<…>` fechado: desenho novo no domínio sem componente aqui passa a ser erro de
 * compilação, e não um quadrado vazio descoberto em produção.
 */
const DESENHOS: Record<IconeDeAcomodacao, Component> = {
  casa: PhHouseLine,
  cama: PhBed,
  gato: PhCat,
  cao: PhDog,
  grupo: PhUsersThree,
  escudo: PhShieldCheck,
  arvore: PhTree,
  passaro: PhBird,
  coelho: PhRabbit,
}

/*
 * O nome de cada forma, para quem não vê a tela.
 *
 * Mapa explícito, e não a chave montada concatenando o prefixo com o nome da forma: chave montada
 * por interpolação some do varredor de traduções, e com ela some a garantia de que os seis idiomas
 * têm todas. O varredor é literal a ponto de colher o exemplo escrito num comentário — então nem
 * o exemplo do que não fazer pode ser escrito como chamada.
 */
const NOME: Record<IconeDeAcomodacao, string> = {
  casa: 'hotel.desenho.casa',
  cama: 'hotel.desenho.cama',
  gato: 'hotel.desenho.gato',
  cao: 'hotel.desenho.cao',
  grupo: 'hotel.desenho.grupo',
  escudo: 'hotel.desenho.escudo',
  arvore: 'hotel.desenho.arvore',
  passaro: 'hotel.desenho.passaro',
  coelho: 'hotel.desenho.coelho',
}

const OPCOES = Object.keys(DESENHOS) as IconeDeAcomodacao[]
</script>

<template>
  <fieldset class="desenhos">
    <legend class="desenhos__titulo">{{ rotulo }}</legend>

    <label
      v-for="opcao in OPCOES"
      :key="opcao"
      class="desenho"
      :class="{ 'desenho--ativo': desenho === opcao }"
      :title="t(NOME[opcao])"
    >
      <input v-model="desenho" type="radio" :name="grupo" :value="opcao" class="desenho__radio" />
      <component :is="DESENHOS[opcao]" weight="duotone" aria-hidden="true" />
      <span class="desenho__nome">{{ t(NOME[opcao]) }}</span>
    </label>
  </fieldset>
</template>

<style scoped>
.desenhos {
  display: flex;
  flex-wrap: wrap;
  margin: 0;
  padding: 0;
  border: 0;
  gap: 8px;
}

.desenhos__titulo {
  width: 100%;
  margin-bottom: 6px;
  padding-inline: 0;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.desenho {
  display: grid;
  width: 46px;
  height: 46px;
  place-items: center;
  border: 1px solid var(--linha-forte);
  border-radius: 12px;
  background: var(--superficie);
  color: var(--tinta-2);
  cursor: pointer;
  transition:
    border-color var(--pj-tempo-curto) ease,
    background-color var(--pj-tempo-curto) ease;
}

.desenho:hover {
  border-color: var(--hotel);
  color: var(--tinta);
}

/* O rádio some da tela, mas não do teclado nem do leitor: é ele que carrega o estado. */
.desenho__radio {
  position: absolute;
  overflow: hidden;
  width: 1px;
  height: 1px;
  clip-path: inset(50%);
}

.desenho:has(.desenho__radio:focus-visible) {
  outline: 2px solid var(--hotel);
  outline-offset: 2px;
}

/* O escolhido ganha a cor do lugar e a borda dobrada: forma e cor, nunca só cor. */
.desenho--ativo {
  border: 2px solid var(--hotel);
  background: var(--hotel-fundo);
  color: var(--hotel-tinta);
}

.desenho :deep(svg) {
  width: 22px;
  height: 22px;
}

/* O nome do desenho é para o leitor de tela: na tela, a forma é a informação. */
.desenho__nome {
  position: absolute;
  overflow: hidden;
  width: 1px;
  height: 1px;
  clip-path: inset(50%);
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .desenho {
    transition: none;
  }
}
</style>
