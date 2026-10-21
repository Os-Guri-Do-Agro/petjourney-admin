<script setup lang="ts">
/**
 * Como um acesso chega à empresa, em três etapas: o responsável compartilha no app, a empresa
 * vincula o código, a anotação volta para o prontuário do pet.
 *
 * Mora em dois lugares de Acessos: no guia do topo (com "Mostrar explicações") e na lista vazia.
 * Com largura de sobra, as etapas ficam numa fileira ligadas por uma trilha tracejada que passa
 * entre os ladrilhos; no estreito, descem em coluna e a trilha corre na vertical, ao lado deles.
 * Quem decide é a largura do bloco (container query), não a da janela: o mesmo bloco cabe no
 * cartão do guia e no poço da lista vazia.
 *
 * O número de cada etapa é só visual (a `ol` já conta para o leitor de tela).
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const passos = computed(() => [
  {
    id: 'compartilha',
    icone: 'ph ph-device-mobile',
    titulo: t('acessos.guia.passo1.titulo'),
    texto: t('acessos.guia.passo1.texto'),
  },
  {
    id: 'vincula',
    icone: 'ph ph-key',
    titulo: t('acessos.guia.passo2.titulo'),
    texto: t('acessos.guia.passo2.texto'),
  },
  {
    id: 'anota',
    icone: 'ph ph-note-pencil',
    titulo: t('acessos.guia.passo3.titulo'),
    texto: t('acessos.guia.passo3.texto'),
  },
])
</script>

<template>
  <div class="acessos-passos">
    <ol class="acessos-passos__lista">
      <li v-for="(passo, indice) in passos" :key="passo.id" class="acessos-passos__etapa">
        <span class="acessos-passos__marco" aria-hidden="true">
          <span class="ui-ladrilho ui-ladrilho--g acessos-passos__ladrilho">
            <i :class="passo.icone" />
          </span>
          <span class="acessos-passos__n ui-num">{{ indice + 1 }}</span>
        </span>
        <span class="acessos-passos__texto">
          <strong class="acessos-passos__titulo">{{ passo.titulo }}</strong>
          <span class="acessos-passos__frase">{{ passo.texto }}</span>
        </span>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.acessos-passos {
  /* O ladrilho da etapa e o vão entre as etapas: a trilha se mede por eles. */
  --marco: 48px;
  --vao: 28px;
  --trilha: color-mix(in oklab, var(--pj-lugar, var(--portal)) 42%, var(--linha-media));

  container: acessos-passos / inline-size;
}

.acessos-passos__lista {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* ------------------------------------------------------------------ estreito: coluna */

.acessos-passos__etapa {
  position: relative;
  display: grid;
  align-content: start;
  align-items: start;
  column-gap: 16px;
  grid-template-columns: var(--marco) minmax(0, 1fr);
  padding-bottom: 24px;
}

.acessos-passos__etapa:last-child {
  padding-bottom: 0;
}

/* A trilha: do pé de um ladrilho até o alto do próximo. */
.acessos-passos__etapa:not(:last-child)::after {
  position: absolute;
  top: calc(var(--marco) + 8px);
  bottom: 8px;
  inset-inline-start: calc(var(--marco) / 2 - 1px);
  border-inline-start: 2px dashed var(--trilha);
  content: '';
}

.acessos-passos__marco {
  position: relative;
  display: grid;
  width: var(--marco);
  height: var(--marco);
  place-items: center;
}

.acessos-passos__ladrilho.ui-ladrilho {
  width: var(--marco);
  height: var(--marco);
  border-radius: 15px;
  box-shadow:
    var(--sombra-xs),
    inset 0 0 0 1px color-mix(in oklab, var(--pj-lugar, var(--portal)) 14%, transparent);
  font-size: 23px;
}

/* O número, discreto, no canto do ladrilho. */
.acessos-passos__n {
  position: absolute;
  top: -7px;
  inset-inline-end: -7px;
  display: grid;
  min-width: 21px;
  height: 21px;
  place-items: center;
  padding: 0 5px;
  border: 1px solid var(--linha);
  border-radius: 999px;
  background: var(--superficie);
  box-shadow: var(--sombra-xs);
  color: var(--tinta-2);
  font-size: 11.5px;
  font-weight: 650;
  line-height: 1;
}

.acessos-passos__texto {
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 5px;
  padding-top: 3px;
}

.acessos-passos__titulo {
  color: var(--tinta);
  font-size: 15px;
  font-weight: 650;
  letter-spacing: -0.01em;
  line-height: 1.35;
}

.acessos-passos__frase {
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.55;
  text-wrap: pretty;
}

/* ------------------------------------------------------------------ largo: fileira */

@container acessos-passos (min-width: 620px) {
  .acessos-passos__lista {
    column-gap: var(--vao);
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .acessos-passos__etapa {
    justify-items: center;
    row-gap: 16px;
    grid-template-columns: minmax(0, 1fr);
    padding-bottom: 0;
    text-align: center;
  }

  /* A trilha na horizontal: do lado de um ladrilho até o lado do próximo, na altura do meio. */
  .acessos-passos__etapa:not(:last-child)::after {
    top: calc(var(--marco) / 2 - 1px);
    bottom: auto;
    width: calc(100% + var(--vao) - var(--marco) - 32px);
    inset-inline-start: calc(50% + var(--marco) / 2 + 16px);
    border-inline-start: 0;
    border-top: 2px dashed var(--trilha);
  }

  .acessos-passos__texto {
    max-width: 34ch;
    padding-top: 0;
  }
}
</style>
