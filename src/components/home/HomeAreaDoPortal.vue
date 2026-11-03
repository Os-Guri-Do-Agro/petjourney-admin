<script setup lang="ts">
/**
 * Uma área do Portal no Início de quem só tem o Portal: Acessos, Carteira, Indicados, Divulgação
 * ou Equipe. O nome leva à tela; ao lado dele, o atalho de trabalho da área.
 *
 * Embaixo, numa linha, o número que resume a área e o que ele quer dizer ("4 acessos ativos"), e o
 * corpo que a página manda pelo slot — os acessos de agora, o QR, as pessoas, os valores. Só o
 * número deixava a área sem nada para olhar: "4" não diz quais quatro.
 *
 * ## Bloqueada
 *
 * A área que depende de um programa que a empresa ainda não tem (Carteira, Divulgação e Indicados
 * precisam do Programa de Afiliados ativo) fica no lugar, turva, e por cima o nome dela, o aviso e o
 * botão que leva aos Programas. Esconder a área deixava a pessoa sem saber que ela existe; mostrar o
 * "0" de verdade dizia que existe e está vazia, o que não é o caso.
 *
 * O cartão turvo é figura: fica fora da árvore de acessibilidade e não recebe foco. O nome que vale
 * para o leitor de tela é o do aviso.
 */
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

import type { TomDoNumero } from './espaco-da-home'

export type AcaoDaArea = { rotulo: string; icone: string; to?: RouteLocationRaw }

export type BloqueioDaArea = {
  titulo: string
  texto: string
  botao: string
  to: RouteLocationRaw
}

const props = defineProps<{
  id: string
  titulo: string
  icone: string
  to: RouteLocationRaw
  /** `null`: carregando. Sem número (`undefined`), a área é só o corpo. */
  valor?: string | number | null
  rotulo?: string
  meta?: string
  tom?: TomDoNumero
  /** O atalho da área, à direita do nome. Sem `to`, é um botão e a área emite `acao`. */
  acao?: AcaoDaArea | null
  bloqueio?: BloqueioDaArea | null
}>()

const emit = defineEmits<{ acao: [] }>()

const idDoTitulo = `inicio-area-${props.id}`
</script>

<template>
  <section
    class="area ui-folha"
    :class="{ 'area--bloqueada': bloqueio }"
    :aria-labelledby="idDoTitulo"
  >
    <div
      class="area__conteudo"
      :aria-hidden="bloqueio ? 'true' : undefined"
      :inert="Boolean(bloqueio)"
    >
      <!-- `div`, não `header`: na moldura do app, folha com `header` direto vira seção sem fundo. -->
      <div class="area__cabeca">
        <span class="ui-ladrilho ui-ladrilho--p" aria-hidden="true"><i :class="icone" /></span>
        <h2 :id="bloqueio ? undefined : idDoTitulo" class="area__titulo">
          <RouterLink class="area__nome" :to="to">
            {{ titulo }}
            <i class="ph ph-caret-right area__caret" aria-hidden="true" />
          </RouterLink>
        </h2>

        <template v-if="acao && !bloqueio">
          <Button
            v-if="acao.to"
            :as="RouterLink"
            :to="acao.to"
            class="area__acao"
            size="small"
            severity="secondary"
            :icon="acao.icone"
            :label="acao.rotulo"
            :aria-label="acao.rotulo"
            :title="acao.rotulo"
          />
          <Button
            v-else
            type="button"
            class="area__acao"
            size="small"
            severity="secondary"
            :icon="acao.icone"
            :label="acao.rotulo"
            :aria-label="acao.rotulo"
            :title="acao.rotulo"
            @click="emit('acao')"
          />
        </template>
      </div>

      <div v-if="valor !== undefined" class="area__resumo">
        <span class="area__numero">
          <Skeleton
            v-if="valor === null"
            class="area__esqueleto"
            width="3rem"
            height="1.5rem"
            border-radius="8px"
          />
          <!-- `bdi`: dinheiro ("R$ 312,60") não se inverte no meio de uma tela em árabe. -->
          <strong v-else class="area__valor ui-num" :class="`area__valor--${tom ?? 'neutro'}`">
            <bdi dir="ltr">{{ valor }}</bdi>
          </strong>
          <span v-if="rotulo" class="area__rotulo">{{ rotulo }}</span>
        </span>
        <span v-if="meta" class="area__meta" :class="`area__meta--${tom ?? 'neutro'}`">
          {{ meta }}
        </span>
      </div>

      <div v-if="$slots.default" class="area__corpo">
        <slot />
      </div>
    </div>

    <div v-if="bloqueio" class="area__bloqueio">
      <h2 :id="idDoTitulo" class="area__bloqueio-titulo">
        <i class="ph ph-lock-simple" aria-hidden="true" />
        {{ titulo }}
      </h2>
      <p class="area__aviso">
        <strong>{{ bloqueio.titulo }}.</strong>
        {{ bloqueio.texto }}
      </p>
      <Button
        :as="RouterLink"
        :to="bloqueio.to"
        size="small"
        icon="ph ph-lock-key-open"
        :label="bloqueio.botao"
      />
    </div>
  </section>
</template>

<style scoped>
/* Um ritmo só, o dos blocos do Início: 18 de folga nas bordas, 14 entre as partes. */
.area {
  display: grid;
  min-width: 0;
  overflow: hidden;
  container-type: inline-size;
  container-name: area;
}

/* O conteúdo e o aviso dividem a mesma célula: a área tem a altura do maior dos dois. */
.area__conteudo,
.area__bloqueio {
  grid-area: 1 / 1;
}

.area__conteudo {
  display: grid;
  align-content: start;
  gap: 14px;
  padding: 16px 18px 18px;
}

.area__cabeca {
  display: flex;
  min-height: 32px;
  align-items: center;
  gap: 10px;
}

.area__titulo {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 15px;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.area__nome {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-radius: 6px;
  color: var(--tinta);
  text-decoration: none;
}

.area__nome:hover {
  color: var(--app-salvia-texto, var(--tinta));
}

.area__nome:focus-visible {
  outline: 2px solid var(--musgo);
  outline-offset: 2px;
}

.area__caret {
  color: var(--tinta-3);
  font-size: 13px;
  transition: translate var(--pj-tempo-curto) var(--pj-curva-chega);
}

.area__nome:hover .area__caret {
  translate: 2px 0;
}

[dir='rtl'] .area__caret {
  scale: -1 1;
}

.area__cabeca :deep(.p-button) {
  flex: none;
  white-space: nowrap;
}

/*
 * Cartão estreito: o atalho fica só com o ícone, no mesmo botão cheio. O nome continua no leitor
 * de tela e no título do botão.
 */
@container area (max-width: 420px) {
  .area__acao :deep(.p-button-label) {
    display: none;
  }

  .area__acao {
    gap: 0;
  }
}

/* ------------------------------------------------------------------ o número */

.area__resumo {
  display: grid;
  justify-items: start;
  gap: 2px;
}

/* O número e o que ele quer dizer na mesma linha: "4 acessos ativos". */
.area__numero {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 8px;
}

.area__valor {
  color: var(--tinta);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.1;
  white-space: nowrap;
}

.area__esqueleto {
  align-self: center;
}

.area__rotulo {
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.35;
}

.area__meta {
  color: var(--tinta-3);
  font-size: 12px;
  line-height: 1.35;
}

.area__valor--ok,
.area__meta--ok {
  color: var(--ok-tinta);
}

.area__valor--atencao,
.area__meta--atencao {
  color: var(--atencao-tinta);
}

.area__valor--risco,
.area__meta--risco {
  color: var(--risco-tinta);
}

.area__meta--ok,
.area__meta--atencao,
.area__meta--risco {
  font-weight: 600;
}

/* Zero é zero: o número fica apagado para os outros saltarem. */
.area__valor--apagado {
  color: var(--tinta-3);
}

.area__corpo {
  display: grid;
  min-width: 0;
}

/* ------------------------------------------------------------------ bloqueada */

/* O cartão inteiro turvo: dá para ver que ali há uma área com conteúdo, não qual. */
.area--bloqueada .area__conteudo {
  filter: blur(4px);
  opacity: 0.4;
  pointer-events: none;
  user-select: none;
}

.area__bloqueio {
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 6px;
  padding: 14px 18px;
  background: color-mix(in oklab, var(--superficie) 50%, transparent);
  text-align: center;
}

.area__bloqueio-titulo {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.area__bloqueio-titulo i {
  color: var(--tinta-2);
  font-size: 16px;
}

.area__aviso {
  max-width: 34ch;
  margin: 0 0 4px;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

.area__aviso strong {
  color: var(--tinta);
  font-weight: 650;
}

@media (prefers-reduced-motion: reduce) {
  .area__caret {
    transition: none;
  }
}
</style>
