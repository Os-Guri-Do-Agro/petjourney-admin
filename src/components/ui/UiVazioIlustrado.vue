<script setup lang="ts">
/**
 * O vazio que ensina, no desenho do vazio de Acessos (a tela que o Luís apontou, 17/11/2026, como a
 * única "com algo legal"). No lugar de uma linha cinza "Nenhum X", três andares centrados:
 *
 * 1. o recado: o ladrilho grande com o ícone na cor do lugar, o título e a frase do porquê;
 * 2. o "como funciona", num poço, com as etapas ligadas pela trilha (`UiPassos`), quando ajuda;
 * 3. a ação (slot `acao`), sozinha embaixo.
 *
 * `aninhado`: dentro de um cartão que já tem caixa, o vazio fica sem caixa própria (caixa dentro de
 * caixa não organiza nada).
 */
import { computed } from 'vue'

import UiPassos, { type PassoDoGuia } from '@/components/ui/UiPassos.vue'

const props = withDefaults(
  defineProps<{
    icone: string
    titulo: string
    texto?: string
    guiaTitulo?: string
    passos?: PassoDoGuia[]
    aninhado?: boolean
  }>(),
  { texto: '', guiaTitulo: '', passos: () => [], aninhado: false },
)

/* Título de vazio é um recado, não uma frase: sem o ponto final que alguns textos antigos trazem. */
const tituloSemPonto = computed(() => props.titulo.replace(/\.\s*$/, ''))
</script>

<template>
  <section
    class="ui-vazio-ilustrado"
    :class="{ 'ui-folha': !aninhado, 'ui-vazio-ilustrado--aninhado': aninhado }"
  >
    <div class="ui-vazio-ilustrado__recado">
      <span class="ui-ladrilho ui-ladrilho--g ui-ladrilho--lugar" aria-hidden="true">
        <i :class="icone" />
      </span>
      <h2 class="ui-vazio-ilustrado__titulo">{{ tituloSemPonto }}</h2>
      <p v-if="texto" class="ui-vazio-ilustrado__texto">{{ texto }}</p>
    </div>

    <div v-if="passos.length" class="ui-vazio-ilustrado__guia ui-poco">
      <h3 v-if="guiaTitulo" class="ui-vazio-ilustrado__guia-titulo">{{ guiaTitulo }}</h3>
      <UiPassos :passos="passos" />
    </div>

    <div v-if="$slots.acao" class="ui-vazio-ilustrado__acao">
      <slot name="acao" />
    </div>
  </section>
</template>

<style scoped>
.ui-vazio-ilustrado {
  display: grid;
  justify-items: center;
  gap: 28px;
  padding: 44px 32px 40px;
}

.ui-vazio-ilustrado--aninhado {
  padding: 28px 8px 12px;
}

.ui-vazio-ilustrado__recado {
  display: grid;
  justify-items: center;
  gap: 8px;
  text-align: center;
}

.ui-vazio-ilustrado__titulo {
  margin: 10px 0 0;
  color: var(--tinta);
  font-size: 19px;
  font-weight: 650;
  letter-spacing: -0.015em;
}

.ui-vazio-ilustrado__texto {
  max-width: 50ch;
  margin: 0;
  color: var(--tinta-2);
  font-size: 14.5px;
  line-height: 1.55;
  text-wrap: balance;
}

.ui-vazio-ilustrado__guia.ui-poco {
  display: grid;
  width: 100%;
  max-width: 920px;
  gap: 22px;
  padding: 24px 28px 28px;
  container: guia-vazio / inline-size;
}

/* O título acompanha a trilha: centrado com as etapas em fileira, à esquerda com elas em coluna. */
.ui-vazio-ilustrado__guia-titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 650;
  text-align: start;
}

@container guia-vazio (min-width: 620px) {
  .ui-vazio-ilustrado__guia-titulo {
    text-align: center;
  }
}

.ui-vazio-ilustrado__acao {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
}
</style>
