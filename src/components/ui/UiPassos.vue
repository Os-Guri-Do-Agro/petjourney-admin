<script setup lang="ts">
/**
 * "Como funciona" em etapas: um ladrilho com o ícone e o número de cada etapa, o título e a frase.
 * Nasceu em Acessos (`AcessosPassos`), a tela que o Luís apontou como a única "com algo legal"
 * (17/11/2026), e virou peça de todas: os vazios ilustrados (`UiVazioIlustrado`) usam ela.
 *
 * Com largura de sobra, as etapas ficam numa fileira ligadas por uma trilha tracejada que passa
 * entre os ladrilhos; no estreito, descem em coluna e a trilha corre na vertical, ao lado deles.
 * Quem decide é a largura do bloco (container query), não a da janela.
 *
 * O número de cada etapa é só visual (a `ol` já conta para o leitor de tela).
 *
 * **Etapa que se faz no sistema** (17/11/2026, "tem sempre que ter os botões call to action quando
 * precisar"): ganha o botão dela (`acao`), que leva aonde se faz (`to`) ou abre ali mesmo
 * (`aoClicar`), e, quando já foi feita, o selo "Feito" no lugar do botão (`feito`), com o ladrilho
 * no verde do que está em ordem. O botão da primeira etapa por fazer é o cheio; os outros,
 * contornados: o olho vai para o próximo passo.
 */
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

export type AcaoDoPasso = {
  rotulo: string
  icone?: string
  to?: RouteLocationRaw
  aoClicar?: () => void
  /** Ainda não dá para fazer (falta a etapa anterior): o botão aparece, apagado. */
  bloqueada?: boolean
}

export type PassoDoGuia = {
  id: string
  icone: string
  titulo: string
  texto: string
  acao?: AcaoDoPasso
  feito?: boolean
}

const props = defineProps<{ passos: PassoDoGuia[] }>()

const { t } = useI18n()

/** A primeira etapa por fazer que tem ação: o botão dela é o cheio. */
const proxima = computed(
  () => props.passos.find((passo) => !passo.feito && passo.acao && !passo.acao.bloqueada)?.id,
)
</script>

<template>
  <div class="ui-passos" :style="{ '--etapas': passos.length }">
    <ol class="ui-passos__lista">
      <li
        v-for="(passo, indice) in passos"
        :key="passo.id"
        class="ui-passos__etapa"
        :class="{ 'ui-passos__etapa--feita': passo.feito }"
      >
        <span class="ui-passos__marco" aria-hidden="true">
          <span class="ui-ladrilho ui-ladrilho--g ui-passos__ladrilho">
            <i :class="passo.feito ? 'ph ph-check' : passo.icone" />
          </span>
          <span class="ui-passos__n ui-num">{{ indice + 1 }}</span>
        </span>
        <span class="ui-passos__texto">
          <strong class="ui-passos__titulo">{{ passo.titulo }}</strong>
          <span class="ui-passos__frase">{{ passo.texto }}</span>
          <span v-if="passo.feito" class="ui-selo ui-selo--ok ui-passos__feito">
            <i class="ph ph-check" aria-hidden="true" />
            {{ t('common.feito') }}
          </span>
          <span v-else-if="passo.acao" class="ui-passos__acao">
            <Button
              v-if="passo.acao.to && !passo.acao.bloqueada"
              :as="RouterLink"
              :to="passo.acao.to"
              size="small"
              :icon="passo.acao.icone"
              :label="passo.acao.rotulo"
              :severity="passo.id === proxima ? undefined : 'secondary'"
              :outlined="passo.id !== proxima"
            />
            <Button
              v-else
              type="button"
              size="small"
              :icon="passo.acao.icone"
              :label="passo.acao.rotulo"
              :disabled="passo.acao.bloqueada"
              :severity="passo.id === proxima ? undefined : 'secondary'"
              :outlined="passo.id !== proxima"
              @click="passo.acao.aoClicar?.()"
            />
          </span>
        </span>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.ui-passos {
  /* O ladrilho da etapa e o vão entre as etapas: a trilha se mede por eles. */
  --marco: 48px;
  --vao: 28px;
  --trilha: color-mix(in oklab, var(--pj-lugar, var(--portal)) 42%, var(--linha-media));

  container: ui-passos / inline-size;
}

.ui-passos__lista {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* ------------------------------------------------------------------ estreito: coluna */

.ui-passos__etapa {
  position: relative;
  display: grid;
  align-content: start;
  align-items: start;
  column-gap: 16px;
  grid-template-columns: var(--marco) minmax(0, 1fr);
  padding-bottom: 24px;
}

.ui-passos__etapa:last-child {
  padding-bottom: 0;
}

/* A trilha: do pé de um ladrilho até o alto do próximo. */
.ui-passos__etapa:not(:last-child)::after {
  position: absolute;
  top: calc(var(--marco) + 8px);
  bottom: 8px;
  inset-inline-start: calc(var(--marco) / 2 - 1px);
  border-inline-start: 2px dashed var(--trilha);
  content: '';
}

.ui-passos__marco {
  position: relative;
  display: grid;
  width: var(--marco);
  height: var(--marco);
  place-items: center;
}

.ui-passos__ladrilho.ui-ladrilho {
  width: var(--marco);
  height: var(--marco);
  border-radius: 15px;
  box-shadow:
    var(--sombra-xs),
    inset 0 0 0 1px color-mix(in oklab, var(--pj-lugar, var(--portal)) 14%, transparent);
  font-size: 23px;
}

/* O número, discreto, no canto do ladrilho. */
.ui-passos__n {
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

.ui-passos__texto {
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 5px;
  padding-top: 3px;
}

.ui-passos__titulo {
  color: var(--tinta);
  font-size: 15px;
  font-weight: 650;
  letter-spacing: -0.01em;
  line-height: 1.35;
}

.ui-passos__frase {
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.55;
  text-wrap: pretty;
}

/* O botão da etapa, embaixo da frase; e o "Feito", no lugar dele. */
.ui-passos__acao {
  display: flex;
  margin-top: 6px;
}

.ui-passos__feito {
  justify-self: start;
  margin-top: 6px;
}

/* Etapa feita: o ladrilho no verde do que está em ordem. */
.ui-passos__etapa--feita .ui-passos__ladrilho.ui-ladrilho {
  background: var(--ok-fundo);
  color: var(--ok-tinta);
}

/* ------------------------------------------------------------------ largo: fileira */

@container ui-passos (min-width: 620px) {
  .ui-passos__lista {
    column-gap: var(--vao);
    grid-template-columns: repeat(var(--etapas, 3), minmax(0, 1fr));
  }

  .ui-passos__etapa {
    justify-items: center;
    row-gap: 16px;
    grid-template-columns: minmax(0, 1fr);
    padding-bottom: 0;
    text-align: center;
  }

  /* A trilha na horizontal: do lado de um ladrilho até o lado do próximo, na altura do meio. */
  .ui-passos__etapa:not(:last-child)::after {
    top: calc(var(--marco) / 2 - 1px);
    bottom: auto;
    width: calc(100% + var(--vao) - var(--marco) - 32px);
    inset-inline-start: calc(50% + var(--marco) / 2 + 16px);
    border-inline-start: 0;
    border-top: 2px dashed var(--trilha);
  }

  .ui-passos__texto {
    max-width: 34ch;
    padding-top: 0;
  }

  /* Os botões das etapas na mesma linha, por mais que as frases tenham tamanhos diferentes. */
  .ui-passos__etapa {
    grid-template-rows: auto 1fr;
  }

  .ui-passos__texto {
    align-self: stretch;
    grid-template-rows: auto auto 1fr;
  }

  .ui-passos__acao {
    align-self: end;
    justify-content: center;
  }

  .ui-passos__feito {
    justify-self: center;
  }
}
</style>
