<script setup lang="ts">
/**
 * O bloco de um espaço no Início: a Clínica, o Hotel ou o Portal, na cor dele.
 *
 * É a moldura que os três dividem, para que a pergunta "como está cada parte da empresa agora" se
 * responda do mesmo jeito em todas: o nome do espaço (que leva à primeira tela dele, a mesma da
 * barra), um atalho de trabalho à direita, de dois a quatro **números do agora** — cada um leva à
 * tela onde ele se resolve — e, no pé, **o próximo passo**: a coisa que vale fazer primeiro ali.
 *
 * Quem decide os números e o passo é o bloco de cada espaço (`HomeEspacoClinica`, `HomeEspacoHotel`,
 * `HomeEspacoPortal`); este componente só desenha.
 *
 * ## A cor
 *
 * O bloco leva `pj-lugar--<espaço>`: dentro dele `--pj-lugar*` aponta para a cor do espaço, a
 * mesma que acende o espaço na barra. A faixa do título, o ícone, a barra de andamento e o pé do
 * próximo passo leem dali.
 *
 * ## Largo e estreito
 *
 * Estreito (três blocos lado a lado, ou o celular), os números ficam dois a dois e o passo é o pé
 * inteiro do bloco. Largo (o bloco na linha inteira: um espaço só, ou o terceiro no tablet), os
 * números correm numa fileira e o passo vai para a direita deles — sem deixar meia tela vazia.
 */
import Skeleton from 'primevue/skeleton'
import { useI18n } from 'vue-i18n'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

import type {
  AndamentoDoEspaco,
  AtalhoDoEspaco,
  NumeroDoEspaco,
  PassoDoEspaco,
} from './espaco-da-home'

const props = defineProps<{
  lugar: 'clinica' | 'hotel' | 'portal'
  titulo: string
  icone: string
  /** A primeira tela do espaço: a mesma em que a barra abre o espaço. */
  to: RouteLocationRaw
  numeros: NumeroDoEspaco[]
  /** O atalho de trabalho à direita do título (agenda, mapa de vagas, compartilhar o código). */
  atalho?: AtalhoDoEspaco | null
  /** `null`: nada parado — o pé diz isso em vez de inventar um passo. */
  passo: PassoDoEspaco | null
  /** A barra fina do dia: quanto já foi feito. */
  andamento?: AndamentoDoEspaco | null
  /** Uma frase de aviso (agenda que não carregou, clínica fechada). */
  aviso?: string
  /** Com aviso de falha, oferece "Tentar de novo". */
  podeTentar?: boolean
}>()

const emit = defineEmits<{ passo: []; atalho: []; tentar: [] }>()

const { t } = useI18n()

const idDoTitulo = `inicio-espaco-${props.lugar}`
</script>

<template>
  <section class="espaco ui-folha" :class="`pj-lugar--${lugar}`" :aria-labelledby="idDoTitulo">
    <div class="espaco__miolo">
      <header class="espaco__cabeca">
        <span class="espaco__icone" aria-hidden="true"><i :class="icone" /></span>
        <h2 :id="idDoTitulo" class="espaco__titulo">
          <RouterLink class="espaco__nome" :to="to">
            {{ titulo }}
            <i class="ph ph-caret-right espaco__caret" aria-hidden="true" />
          </RouterLink>
        </h2>

        <template v-if="atalho">
          <RouterLink v-if="atalho.to" class="espaco__atalho" :to="atalho.to">
            <i :class="atalho.icone" aria-hidden="true" />
            {{ atalho.rotulo }}
          </RouterLink>
          <button v-else type="button" class="espaco__atalho" @click="emit('atalho')">
            <i :class="atalho.icone" aria-hidden="true" />
            {{ atalho.rotulo }}
          </button>
        </template>
      </header>

      <div class="espaco__corpo">
        <ul v-if="numeros.length" class="espaco__numeros">
          <li v-for="numero in numeros" :key="numero.id">
            <RouterLink class="numero" :class="`numero--${numero.tom ?? 'neutro'}`" :to="numero.to">
              <Skeleton
                v-if="numero.valor === null"
                class="numero__esqueleto"
                width="3.25rem"
                height="1.75rem"
                border-radius="8px"
              />
              <!-- `bdi`: dinheiro ("R$ 312,60") não se inverte no meio de uma tela em árabe. -->
              <strong v-else class="numero__valor ui-num"
                ><bdi dir="ltr">{{ numero.valor }}</bdi></strong
              >
              <span class="numero__rotulo">{{ numero.rotulo }}</span>
              <span v-if="numero.meta" class="numero__meta">{{ numero.meta }}</span>
            </RouterLink>
          </li>
        </ul>

        <slot />

        <div v-if="andamento" class="espaco__andamento">
          <span class="espaco__barra" role="img" :aria-label="andamento.texto">
            <span class="espaco__barra-cheia" :style="{ inlineSize: `${andamento.percentual}%` }" />
          </span>
          <span class="espaco__andamento-texto" aria-hidden="true">{{ andamento.texto }}</span>
        </div>

        <p v-if="aviso" class="espaco__aviso" role="status">
          <i class="ph ph-warning-circle" aria-hidden="true" />
          <span>{{ aviso }}</span>
          <button v-if="podeTentar" type="button" class="ui-mais" @click="emit('tentar')">
            {{ t('inicio.dia.tentar') }}
          </button>
        </p>
      </div>

      <div class="espaco__pe">
        <template v-if="passo">
          <RouterLink v-if="passo.to" class="passo" :to="passo.to">
            <i :class="passo.icone" class="passo__icone" aria-hidden="true" />
            <span class="passo__texto">{{ passo.rotulo }}</span>
            <i class="ph ph-arrow-right passo__seta" aria-hidden="true" />
          </RouterLink>
          <button v-else type="button" class="passo" @click="emit('passo')">
            <i :class="passo.icone" class="passo__icone" aria-hidden="true" />
            <span class="passo__texto">{{ passo.rotulo }}</span>
            <i class="ph ph-arrow-right passo__seta" aria-hidden="true" />
          </button>
        </template>
        <p v-else class="passo passo--calma">
          <i class="ph ph-check-circle passo__icone" aria-hidden="true" />
          <span class="passo__texto">{{ t('inicio.passo.calma') }}</span>
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.espaco {
  display: grid;
  min-width: 0;
  overflow: hidden;
  container-type: inline-size;
  container-name: espaco;
}

.espaco__miolo {
  display: grid;
  height: 100%;
  grid-template-rows: auto 1fr auto;
}

/* ------------------------------------------------------------------------------ cabeça */

.espaco__cabeca {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 60px;
  padding: 12px 14px 12px 16px;
  border-bottom: 1px solid var(--linha);
  background: color-mix(in oklab, var(--pj-lugar-fundo) 62%, var(--superficie));
}

.espaco__icone {
  display: grid;
  width: 32px;
  height: 32px;
  flex: none;
  place-items: center;
  border-radius: 10px;
  background: var(--pj-lugar);
  color: var(--superficie);
  font-size: 18px;
}

.espaco__titulo {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.espaco__nome {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-radius: 6px;
  color: var(--tinta);
  text-decoration: none;
}

.espaco__nome:hover {
  color: var(--pj-lugar-tinta);
}

.espaco__nome:hover .espaco__caret {
  translate: 2px 0;
}

.espaco__caret {
  color: var(--tinta-3);
  font-size: 14px;
  transition: translate var(--pj-tempo-curto) var(--pj-curva-chega);
}

[dir='rtl'] .espaco__caret {
  scale: -1 1;
}

.espaco__atalho {
  display: inline-flex;
  min-height: 36px;
  flex: none;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--pj-lugar-tinta);
  cursor: pointer;
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
}

.espaco__atalho i {
  font-size: 16px;
}

.espaco__atalho:hover {
  background: color-mix(in oklab, var(--pj-lugar-fundo) 80%, var(--superficie));
}

.espaco__nome:focus-visible,
.espaco__atalho:focus-visible,
.numero:focus-visible,
.passo:focus-visible {
  outline: 2px solid var(--pj-lugar);
  outline-offset: 2px;
}

/* ------------------------------------------------------------------------------ números */

.espaco__corpo {
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 10px 10px 14px;
}

.espaco__numeros {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 150px), 1fr));
  list-style: none;
}

.numero {
  display: grid;
  height: 100%;
  align-content: start;
  gap: 3px;
  padding: 10px 10px 12px;
  border-radius: 12px;
  color: var(--tinta);
  text-decoration: none;
  transition: background-color var(--pj-tempo-curto) ease;
}

.numero:hover {
  background: var(--superficie-2);
}

.numero__valor {
  color: var(--tinta);
  font-size: 28px;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.05;
  white-space: nowrap;
}

.numero__esqueleto {
  margin-block: 1px 2px;
}

.numero__rotulo {
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.3;
}

/* Até duas linhas: "Ni, Nina e mais 2", "O saque começa em R$ 50,00." */
.numero__meta {
  display: -webkit-box;
  overflow: hidden;
  color: var(--tinta-3);
  font-size: 12px;
  line-height: 1.35;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.numero--risco .numero__valor,
.numero--risco .numero__meta {
  color: var(--risco-tinta);
}

.numero--atencao .numero__valor,
.numero--atencao .numero__meta {
  color: var(--atencao-tinta);
}

.numero--ok .numero__valor,
.numero--ok .numero__meta {
  color: var(--ok-tinta);
}

.numero--risco .numero__meta,
.numero--atencao .numero__meta,
.numero--ok .numero__meta {
  font-weight: 600;
}

.numero--lugar .numero__valor {
  color: var(--pj-lugar-tinta);
}

/* Zero é zero: o número fica apagado para os outros saltarem. */
.numero--apagado .numero__valor {
  color: var(--tinta-3);
}

/* ------------------------------------------------------------------------------ andamento */

.espaco__andamento {
  display: grid;
  gap: 6px;
  padding: 0 10px;
}

.espaco__barra {
  display: block;
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--superficie-3);
}

.espaco__barra-cheia {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--pj-lugar);
}

.espaco__andamento-texto {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.espaco__aviso {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  margin: 0;
  padding: 0 10px;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

.espaco__aviso i {
  color: var(--atencao-tinta);
  font-size: 16px;
}

/* ------------------------------------------------------------------------------ próximo passo */

.espaco__pe {
  border-top: 1px solid var(--linha);
}

.passo {
  display: flex;
  width: 100%;
  min-height: 52px;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 10px 16px;
  border: 0;
  background: color-mix(in oklab, var(--pj-lugar-fundo) 70%, var(--superficie));
  color: var(--pj-lugar-tinta);
  cursor: pointer;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
  text-align: start;
  text-decoration: none;
  transition: background-color var(--pj-tempo-curto) ease;
}

.passo:hover {
  background: var(--pj-lugar-fundo);
}

.passo:focus-visible {
  outline-offset: -3px;
}

.passo__icone {
  flex: none;
  font-size: 19px;
}

.passo__texto {
  flex: 1;
  min-width: 0;
}

.passo__seta {
  flex: none;
  font-size: 16px;
  transition: translate var(--pj-tempo-curto) var(--pj-curva-chega);
}

.passo:hover .passo__seta {
  translate: 3px 0;
}

[dir='rtl'] .passo__seta {
  scale: -1 1;
}

.passo--calma {
  background: transparent;
  color: var(--tinta-2);
  cursor: default;
  font-weight: 500;
}

.passo--calma:hover {
  background: transparent;
}

.passo--calma .passo__icone {
  color: var(--ok-tinta);
}

/*
 * Largo: um espaço só na linha inteira. Os números correm numa fileira à esquerda e o passo vira
 * um botão à direita deles, em vez de um pé de 1000 px com meia dúzia de palavras.
 */
@container espaco (min-width: 640px) {
  .espaco__miolo {
    grid-template-columns: minmax(0, 1fr) minmax(260px, 340px);
    grid-template-rows: auto 1fr;
  }

  .espaco__cabeca {
    grid-column: 1 / -1;
  }

  .espaco__numeros {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }

  .espaco__pe {
    display: grid;
    align-content: center;
    padding-block: 16px;
    padding-inline: 0 18px;
    border-top: 0;
  }

  .passo {
    border-radius: 12px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .numero,
  .passo,
  .passo__seta,
  .espaco__caret {
    transition: none;
  }
}
</style>
