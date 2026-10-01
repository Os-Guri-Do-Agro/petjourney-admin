<script setup lang="ts">
/**
 * A pauta: o que está parado em cada módulo, e para onde ir resolver.
 *
 * ## A forma
 *
 * O "My Tasks" do Prodify, na paleta da casa: cartão branco com título e ícone de linha, um grupo
 * por módulo com o chip em caixa alta e a contagem ao lado, recolhível; dentro, a tabela com as
 * colunas Assunto, Gravidade e Onde — o "Name / Priority / Due date" de lá. Cada linha tem o
 * quadradinho na cor do grupo, o assunto, o selo de prioridade e a tela aonde ela leva.
 *
 * O cálculo mora em `usePautaDaHome`, que o cabeçalho da página também lê.
 */
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import { PhCheckCircle, PhClipboardText, PhWarningCircle } from '@phosphor-icons/vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import IconeDaCasa from '@/components/common/IconeDaCasa.vue'

import PautaTabela from './PautaTabela.vue'
import { usePautaDaHome } from './usePautaDaHome'

const { t } = useI18n()
const {
  modulos,
  visivel,
  algumModuloCarregando,
  conferindo,
  conferidoEm,
  avisoGeral,
  avisoDe,
  reconferir,
} = usePautaDaHome()

/** Grupos recolhidos por quem usa. Estado da tela, não do dado: volta aberto no próximo acesso. */
const recolhidos = ref<Set<string>>(new Set())

function estaRecolhido(id: string) {
  return recolhidos.value.has(id)
}

function alternar(id: string) {
  const proximo = new Set(recolhidos.value)

  if (proximo.has(id)) proximo.delete(id)
  else proximo.add(id)

  recolhidos.value = proximo
}

/** A cor do grupo: ciano para a Clínica, lilás para o Hotel — como o chip de estado do Prodify. */
function corDoGrupo(id: string) {
  return id === 'hotel' ? 'lilas' : 'ciano'
}
</script>

<template>
  <section v-if="visivel" class="hc pauta" aria-labelledby="home-pauta-titulo">
    <header class="hc__cabeca">
      <h2 id="home-pauta-titulo" class="hc__titulo">
        <PhClipboardText class="hc__icone" aria-hidden="true" />
        {{ t('inicio.pauta.titulo') }}
      </h2>

      <div class="hc__ferramentas">
        <p class="pauta__conferido" aria-live="polite">
          <template v-if="conferindo || algumModuloCarregando">
            {{ t('inicio.pauta.conferindo') }}
          </template>
          <time v-else-if="conferidoEm">{{
            t('inicio.pauta.conferido', { hora: conferidoEm })
          }}</time>
        </p>
        <Button
          type="button"
          class="pauta__ferramenta"
          severity="secondary"
          text
          rounded
          size="small"
          :disabled="conferindo"
          :aria-label="t('inicio.pauta.reconferir')"
          :title="t('inicio.pauta.reconferir')"
          @click="reconferir"
        >
          <template #icon>
            <IconeDaCasa
              nome="recarregar"
              class="pauta__ferramenta-icone"
              :class="{ 'pauta__ferramenta-icone--girando': conferindo }"
            />
          </template>
        </Button>
      </div>
    </header>

    <!-- Todos os módulos falharam juntos: um aviso só, com uma ação só. -->
    <div v-if="avisoGeral" class="aviso" role="status">
      <PhWarningCircle class="aviso__icone" weight="fill" aria-hidden="true" />
      <p class="aviso__texto">{{ avisoGeral }}</p>
      <Button
        type="button"
        class="aviso__acao"
        severity="secondary"
        text
        size="small"
        :label="t('inicio.pauta.tentar')"
        :disabled="conferindo"
        @click="reconferir"
      />
    </div>

    <section
      v-for="modulo in modulos"
      :key="modulo.id"
      class="grupo"
      :style="{ '--grupo-cor': `var(--hc-${corDoGrupo(modulo.id)}-tinta)` }"
      :aria-labelledby="`home-pauta-${modulo.id}`"
    >
      <header class="grupo__cabeca">
        <Button
          type="button"
          class="grupo__alternar"
          severity="secondary"
          text
          rounded
          size="small"
          :aria-expanded="!estaRecolhido(modulo.id)"
          :aria-controls="`home-pauta-${modulo.id}-corpo`"
          :aria-label="
            estaRecolhido(modulo.id)
              ? t('inicio.pauta.expandir', { modulo: modulo.titulo })
              : t('inicio.pauta.recolher', { modulo: modulo.titulo })
          "
          @click="alternar(modulo.id)"
        >
          <template #icon>
            <IconeDaCasa
              nome="expandir"
              peso="bold"
              class="grupo__caret"
              :class="{ 'grupo__caret--recolhido': estaRecolhido(modulo.id) }"
            />
          </template>
        </Button>

        <h3 :id="`home-pauta-${modulo.id}`" class="grupo__titulo">
          <span class="hc-chip" :class="`hc--${corDoGrupo(modulo.id)}`">{{ modulo.titulo }}</span>
          <span v-if="modulo.carregado && modulo.linhas.length > 0" class="grupo__contagem">
            •
            {{ t('inicio.pauta.contagem', { total: modulo.linhas.length }, modulo.linhas.length) }}
          </span>
        </h3>

        <RouterLink class="hc__link grupo__atalho" :to="modulo.atalho.to">
          {{ modulo.atalho.rotulo }}
          <IconeDaCasa nome="irPara" class="grupo__seta" />
        </RouterLink>
      </header>

      <!--
        Recolher é visual e também de foco: `inert` tira do Tab e do leitor de tela o que ficou
        fechado, senão o teclado entraria em linhas que ninguém vê.
      -->
      <div
        :id="`home-pauta-${modulo.id}-corpo`"
        class="grupo__corpo"
        :class="{ 'grupo__corpo--recolhido': estaRecolhido(modulo.id) }"
        :inert="estaRecolhido(modulo.id)"
      >
        <div class="grupo__dobra">
          <div v-if="modulo.carregado && avisoDe(modulo)" class="aviso" role="status">
            <PhWarningCircle class="aviso__icone" weight="fill" aria-hidden="true" />
            <p class="aviso__texto">{{ avisoDe(modulo) }}</p>
            <Button
              type="button"
              class="aviso__acao"
              severity="secondary"
              text
              size="small"
              :label="t('inicio.pauta.tentar')"
              :disabled="conferindo"
              @click="modulo.recarregar()"
            />
          </div>

          <div
            v-if="!modulo.carregado"
            class="grupo__esqueleto"
            role="status"
            aria-busy="true"
            :aria-label="t('inicio.pauta.carregandoAria')"
          >
            <Skeleton v-for="n in 3" :key="n" width="100%" height="2.6rem" border-radius="0.5rem" />
          </div>

          <PautaTabela
            v-else-if="modulo.linhas.length > 0"
            :linhas="
              modulo.linhas.map((linha) => ({ ...linha, onde: t(`inicio.pauta.onde.${linha.id}`) }))
            "
          />

          <!-- Calma só com conferência completa. Parcial ou falha nunca chegam aqui. -->
          <p v-else-if="modulo.situacao === 'ok'" class="grupo__calma">
            <PhCheckCircle class="grupo__calma-icone" weight="fill" aria-hidden="true" />
            {{ t('inicio.pauta.calma') }}
          </p>
        </div>
      </div>
    </section>
  </section>
</template>

<style scoped>
.pauta {
  gap: 0.75rem;
}

.pauta__conferido {
  margin: 0;
  color: var(--hc-tinta-3);
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
}

.pauta__ferramenta.p-button {
  inline-size: 2rem;
  block-size: 2rem;
  color: var(--hc-tinta-3);
}

.pauta__ferramenta.p-button:not(:disabled):hover {
  background: var(--hc-linha);
  color: var(--hc-tinta);
}

.pauta__ferramenta-icone {
  width: 1.05rem;
  height: 1.05rem;
}

/* Gira só enquanto confere: o movimento diz "estou olhando agora", e para quando terminou. */
.pauta__ferramenta-icone--girando {
  animation: pauta-girar 900ms linear infinite;
}

@keyframes pauta-girar {
  to {
    rotate: 360deg;
  }
}

/* ------------------------------------------------------------------ aviso */

.aviso {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.5rem;
  padding: 0.6rem 0.8rem;
  border-radius: 0.75rem;
  background: var(--hc-pessego-fundo);
}

.aviso__icone {
  flex-shrink: 0;
  width: 1.1rem;
  height: 1.1rem;
  color: var(--hc-pessego-tinta);
}

.aviso__texto {
  flex: 1 1 14rem;
  margin: 0;
  color: var(--hc-tinta);
  font-size: 0.8125rem;
  line-height: 1.45;
}

.aviso__acao.p-button {
  color: var(--hc-marca-forte);
  font-weight: 700;
}

/* ------------------------------------------------------------------ grupo */

.grupo {
  display: grid;
}

.grupo + .grupo {
  margin-block-start: 0.35rem;
}

.grupo__cabeca {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 2.5rem;
}

.grupo__alternar.p-button {
  inline-size: 1.75rem;
  block-size: 1.75rem;
  margin-inline-start: -0.35rem;
  color: var(--hc-tinta-3);
}

.grupo__alternar.p-button:not(:disabled):hover {
  background: var(--hc-linha);
  color: var(--hc-tinta);
}

.grupo__alternar.p-button:focus-visible {
  outline: 2px solid var(--hc-marca);
  outline-offset: 1px;
}

.grupo__caret {
  width: 0.9rem;
  height: 0.9rem;
  rotate: 180deg;
  transition: rotate 180ms ease-out;
}

.grupo__caret--recolhido {
  rotate: 0deg;
}

.grupo__titulo {
  display: inline-flex;
  flex: 1;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: inherit;
  font-weight: inherit;
}

.grupo__contagem {
  color: var(--hc-tinta-3);
  font-size: 0.8125rem;
  font-weight: 500;
}

.grupo__seta {
  width: 0.95rem;
  height: 0.95rem;
}

[dir='rtl'] .grupo__seta {
  scale: -1 1;
}

/* Recolher em altura, sem medir nada: a linha da grade vai de 1fr a 0fr. */
.grupo__corpo {
  display: grid;
  grid-template-rows: 1fr;
  transition: grid-template-rows 200ms ease-out;
}

.grupo__corpo--recolhido {
  grid-template-rows: 0fr;
}

.grupo__dobra {
  display: grid;
  gap: 0.5rem;
  min-height: 0;
  overflow: hidden;
}

.grupo__esqueleto {
  display: grid;
  gap: 0.4rem;
  padding-block: 0.25rem;
}

.grupo__calma {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  padding: 0.6rem 0.25rem;
  color: var(--hc-tinta-2);
  font-size: 0.875rem;
}

.grupo__calma-icone {
  width: 1.05rem;
  height: 1.05rem;
  color: var(--hc-verde-tinta);
}

@media (prefers-reduced-motion: reduce) {
  .grupo__corpo,
  .grupo__caret {
    transition: none;
  }

  .pauta__ferramenta-icone--girando {
    animation: none;
  }
}
</style>
