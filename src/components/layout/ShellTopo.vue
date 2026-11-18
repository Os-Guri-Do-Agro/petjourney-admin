<script setup lang="ts">
/**
 * O menu no alto (formato "Menu no alto", Configurações → Aparência e menu da conta).
 *
 * Sem barra lateral: a tela ganha a largura inteira e o menu vira uma faixa branca no alto, com a
 * empresa à esquerda, o Início e um botão por espaço no meio, e as ferramentas da conta à direita
 * (pendência, avisos, a pessoa). Cada espaço abre um painel com as seções dele lado a lado: o título
 * da seção em cima e as telas embaixo, cada uma com o nome das abas que ela tem — quem abre o menu
 * da Clínica vê de uma vez o que mora em "Dia a dia", "Atendimento" e "Gestão".
 *
 * O espaço da tela atual fica aceso; o destino atual, aceso dentro do painel. Até 900 px a moldura
 * volta à gaveta de sempre (o `AppShell` decide).
 */
import Popover from 'primevue/popover'
import { computed, ref, watch, type ComponentPublicInstance } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'

import ShellAvisos from '@/components/layout/ShellAvisos.vue'
import ShellConta from '@/components/layout/ShellConta.vue'
import ShellEmpresa from '@/components/layout/ShellEmpresa.vue'
import ShellPendencia from '@/components/layout/ShellPendencia.vue'
import type { Destino, Espaco, Localizacao } from '@/navegacao/espacos'
import { useParceiroStore } from '@/stores/parceiro'

const props = defineProps<{
  espacos: Espaco[]
  aqui: Localizacao
}>()

const { t } = useI18n()
const route = useRoute()
const parceiroStore = useParceiroStore()

const noInicio = computed(() => route.path === '/inicio')

const empresas = ref<InstanceType<typeof ShellEmpresa> | null>(null)
const empresasAbertas = ref(false)

/* Um painel por espaço: clicar no vizinho fecha o aberto (clique fora) e abre o dele. */
const paineis = new Map<string, InstanceType<typeof Popover>>()
const aberto = ref<string | null>(null)

function guardarPainel(id: string, el: Element | ComponentPublicInstance | null) {
  if (el) {
    paineis.set(id, el as unknown as InstanceType<typeof Popover>)
  } else {
    paineis.delete(id)
  }
}

function alternar(espaco: Espaco, evento: Event) {
  paineis.get(espaco.id)?.toggle(evento)
}

function fecharPaineis() {
  for (const painel of paineis.values()) {
    painel.hide()
  }
}

/* Escolher uma tela fecha o painel; trocar de tela por outro caminho (link, voltar) também. */
watch(() => route.fullPath, fecharPaineis)

function destinoAtivo(espaco: Espaco, destino: Destino) {
  return props.aqui.espaco?.id === espaco.id && props.aqui.destino?.id === destino.id
}

/** O que mora dentro da tela, pelo nome das abas: "Calendário · Pedidos · Lista de espera". */
function abasDe(destino: Destino) {
  return destino.abas.length > 1 ? destino.abas.map((aba) => aba.rotulo).join(' · ') : ''
}
</script>

<template>
  <header class="topo-app">
    <div class="topo-app__marca-area">
      <button
        type="button"
        class="topo-app__marca"
        aria-haspopup="menu"
        :aria-expanded="empresasAbertas"
        :aria-label="`${parceiroStore.parceiroNome}: ${t('shell.user.trocarEmpresa')}`"
        :title="`${parceiroStore.parceiroNome}\n${t('shell.user.trocarEmpresa')}`"
        @click="empresas?.alternar($event)"
      >
        <span class="topo-app__pata" aria-hidden="true"><img src="/pata.png" alt="" /></span>
        <strong class="topo-app__empresa" dir="auto">{{ parceiroStore.parceiroNome }}</strong>
        <i class="ph ph-caret-up-down topo-app__trocar" aria-hidden="true" />
      </button>
      <ShellEmpresa ref="empresas" @aberto="empresasAbertas = $event" />
    </div>

    <nav class="topo-app__nav" :aria-label="t('shell.barra.navegacao')">
      <RouterLink
        class="topo-app__item"
        :class="{ 'topo-app__item--ativo': noInicio }"
        to="/inicio"
        :aria-current="noInicio ? 'page' : undefined"
      >
        <i class="ph ph-house-simple topo-app__icone" aria-hidden="true" />
        <span>{{ t('shell.barra.inicio') }}</span>
      </RouterLink>

      <div
        v-for="espaco in espacos"
        :key="espaco.id"
        class="topo-app__espaco"
        :class="`pj-lugar--${espaco.lugar}`"
      >
        <button
          type="button"
          class="topo-app__item"
          :class="{
            'topo-app__item--ativo': aqui.espaco?.id === espaco.id,
            'topo-app__item--aberto': aberto === espaco.id,
          }"
          aria-haspopup="true"
          :aria-expanded="aberto === espaco.id"
          :aria-controls="`menu-do-espaco-${espaco.id}`"
          @click="alternar(espaco, $event)"
        >
          <span class="topo-app__ladrilho" aria-hidden="true"><i :class="espaco.icone" /></span>
          <span>{{ espaco.rotulo }}</span>
          <span
            v-if="espaco.selo"
            class="topo-selo"
            :class="`topo-selo--${espaco.tom ?? 'neutro'}`"
          >
            {{ espaco.selo }}
          </span>
          <i class="ph ph-caret-down topo-app__seta" aria-hidden="true" />
        </button>

        <Popover
          :ref="(el) => guardarPainel(espaco.id, el)"
          @show="aberto = espaco.id"
          @hide="aberto === espaco.id && (aberto = null)"
        >
          <nav
            :id="`menu-do-espaco-${espaco.id}`"
            class="topo-menu"
            :class="`pj-lugar--${espaco.lugar}`"
            :style="{ '--colunas': espaco.secoes.length }"
            :aria-label="t('settings.aparencia.formato.menuDoEspaco', { espaco: espaco.rotulo })"
          >
            <section
              v-for="secao in espaco.secoes"
              :key="secao.id"
              class="topo-menu__secao"
              :aria-labelledby="`topo-secao-${espaco.id}-${secao.id}`"
            >
              <h3 :id="`topo-secao-${espaco.id}-${secao.id}`" class="topo-menu__titulo">
                {{ secao.rotulo }}
              </h3>
              <ul class="topo-menu__lista">
                <li v-for="destino in secao.destinos" :key="destino.id">
                  <RouterLink
                    class="topo-menu__destino"
                    :class="{
                      'topo-menu__destino--ativo': destinoAtivo(espaco, destino),
                      'topo-menu__destino--bloqueado': destino.bloqueado,
                    }"
                    :to="destino.to"
                    active-class=""
                    exact-active-class=""
                    :aria-current="destinoAtivo(espaco, destino) ? 'page' : undefined"
                    :title="destino.tituloDoSelo"
                    @click="fecharPaineis"
                  >
                    <span class="topo-menu__icone" aria-hidden="true"
                      ><i :class="destino.icone"
                    /></span>
                    <span class="topo-menu__texto">
                      <strong>{{ destino.rotulo }}</strong>
                      <small v-if="abasDe(destino)">{{ abasDe(destino) }}</small>
                    </span>
                    <i
                      v-if="destino.bloqueado"
                      class="ph ph-lock-simple topo-menu__cadeado"
                      aria-hidden="true"
                    />
                    <span
                      v-else-if="destino.selo"
                      class="topo-selo"
                      :class="`topo-selo--${destino.tom ?? 'neutro'}`"
                      :aria-label="destino.tituloDoSelo"
                    >
                      {{ destino.selo }}
                    </span>
                  </RouterLink>
                </li>
              </ul>
            </section>
          </nav>
        </Popover>
      </div>
    </nav>

    <div class="topo-app__ferramentas">
      <ShellPendencia recolhida />
      <ShellAvisos recolhida />
      <ShellConta recolhida />
    </div>
  </header>
</template>

<style scoped>
/*
 * A faixa do alto: branca como a página, separada dela só pela régua de véu (o menu do app). A
 * faixa sálvia da tela vem logo embaixo, e é ela que diz onde se está.
 */
.topo-app {
  position: relative;
  z-index: 40;
  display: flex;
  flex: none;
  min-height: 64px;
  align-items: center;
  gap: 16px;
  padding: 10px 20px;
  border-bottom: 1px solid var(--app-regua, var(--linha));
  background: var(--app-fundo, var(--superficie));
  color: var(--app-tinta, var(--tinta));
}

/* As palavras da barra (texto do sino, nome na conta) somem: aqui cada ferramenta é só o ícone. */
.topo-app :deep(.shell-rotulo) {
  display: none;
}

/* ------------------------------------------------------------------------------- a empresa */

.topo-app__marca-area {
  display: flex;
  min-width: 0;
  flex: 0 1 auto;
}

.topo-app__marca {
  display: flex;
  max-width: 240px;
  min-width: 0;
  align-items: center;
  gap: 10px;
  padding: 5px 10px 5px 5px;
  border: 0;
  border-radius: 14px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: start;
}

.topo-app__marca:hover {
  background: var(--app-toque, var(--superficie-2));
}

.topo-app__marca:focus-visible,
.topo-app__item:focus-visible {
  outline: 2px solid var(--app-salvia-texto, var(--musgo));
  outline-offset: 2px;
}

/* A pata no quadradinho sálvia do destaque, como no topo da barra lateral. */
.topo-app__pata {
  display: grid;
  width: 36px;
  height: 36px;
  flex: none;
  place-items: center;
  border-radius: 11px;
  background: var(--app-destaque, #76938d);
}

.topo-app__pata img {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

.topo-app__empresa {
  overflow: hidden;
  font-size: 14.5px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topo-app__trocar {
  flex: none;
  color: var(--app-texto-2, var(--tinta-2));
  font-size: 15px;
}

/* ---------------------------------------------------------------------------- os espaços */

.topo-app__nav {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 4px;
}

.topo-app__espaco {
  display: flex;
}

.topo-app__item {
  display: inline-flex;
  height: 42px;
  align-items: center;
  gap: 9px;
  padding: 0 12px 0 8px;
  border: 0;
  border-radius: 13px;
  background: transparent;
  color: var(--app-tinta, var(--tinta));
  cursor: pointer;
  font: inherit;
  font-size: 14.5px;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  transition: background-color var(--pj-tempo-curto) var(--pj-curva-chega);
}

.topo-app__item:hover,
.topo-app__item--aberto {
  background: var(--app-toque, var(--superficie-2));
}

/* Onde se está: o véu da sálvia, como a pílula escolhida do app. */
.topo-app__item--ativo,
.topo-app__item--ativo:hover {
  background: var(--app-veu-forte, var(--superficie-2));
  font-weight: 700;
}

.topo-app__icone {
  width: 28px;
  color: var(--app-salvia-texto, var(--musgo));
  font-size: 19px;
  text-align: center;
}

/* O ícone do espaço no quadradinho pastel da cor dele (Clínica azul, Hotel lilás, Portal âmbar). */
.topo-app__ladrilho {
  display: grid;
  width: 28px;
  height: 28px;
  flex: none;
  place-items: center;
  border-radius: 9px;
  background: var(--pj-lugar-fundo);
  color: var(--pj-lugar-tinta);
  font-size: 16px;
}

.topo-app__seta {
  color: var(--app-texto-2, var(--tinta-2));
  font-size: 12px;
  transition: transform var(--pj-tempo-medio) var(--pj-curva-chega);
}

.topo-app__item--aberto .topo-app__seta {
  transform: rotate(180deg);
}

/* ------------------------------------------------------------------------ as ferramentas */

.topo-app__ferramentas {
  display: flex;
  flex: none;
  align-items: center;
  gap: 6px;
}

/* O sino e a conta vieram do pé da barra: aqui são quadrados de 40 px. */
.topo-app__ferramentas :deep(.sino) {
  width: 40px;
  height: 40px;
  padding: 0;
  justify-content: center;
}

.topo-app__ferramentas :deep(.sino__icone) {
  width: 40px;
  height: 40px;
  border-radius: 13px;
}

.topo-app__ferramentas :deep(.pendencia-icone) {
  margin: 0;
}

.topo-app__ferramentas :deep(.conta__botao) {
  width: auto;
  padding: 3px;
  border: 0;
  border-radius: 999px;
  background: transparent;
}

.topo-app__ferramentas :deep(.conta__botao:hover) {
  background: var(--app-veu, var(--superficie-2));
}

/* ------------------------------------------------------------------------------- os selos */

.topo-selo {
  display: inline-grid;
  min-width: 22px;
  height: 22px;
  flex: none;
  padding: 0 6px;
  place-items: center;
  border-radius: 999px;
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  line-height: 1;
}

.topo-selo--neutro {
  background: var(--app-veu-forte, var(--superficie-2));
  color: var(--app-salvia-texto, var(--tinta-2));
}

.topo-selo--atencao {
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
}

.topo-selo--risco {
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

/* ------------------------------------------------------------------------------ o painel
 * As seções lado a lado, uma coluna cada. Cada tela leva embaixo o nome das abas: o que tem
 * dentro dela, sem abrir.
 */
.topo-menu {
  display: grid;
  width: min(calc(var(--colunas, 3) * 292px), calc(100vw - 48px));
  gap: 6px 14px;
  padding: 6px;
  grid-template-columns: repeat(var(--colunas, 3), minmax(0, 1fr));
}

.topo-menu__secao {
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 4px;
}

.topo-menu__titulo {
  margin: 0;
  padding: 4px 10px 6px;
  border-bottom: 1px solid var(--app-regua, var(--linha-suave));
  color: var(--app-texto-2, var(--tinta-2));
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.topo-menu__lista {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.topo-menu__destino {
  display: flex;
  min-height: 48px;
  align-items: center;
  gap: 11px;
  padding: 6px 10px 6px 6px;
  border-radius: 13px;
  color: var(--app-tinta, var(--tinta));
  text-decoration: none;
  transition: background-color var(--pj-tempo-curto) var(--pj-curva-chega);
}

.topo-menu__destino:hover {
  background: var(--app-toque, var(--superficie-2));
}

.topo-menu__destino:focus-visible {
  outline: 2px solid var(--app-salvia-texto, var(--musgo));
  outline-offset: -2px;
}

.topo-menu__icone {
  display: grid;
  width: 34px;
  height: 34px;
  flex: none;
  place-items: center;
  border-radius: 11px;
  background: var(--app-veu, var(--superficie-2));
  color: var(--app-salvia-texto, var(--musgo));
  font-size: 18px;
}

.topo-menu__texto {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 1px;
}

.topo-menu__texto strong {
  font-size: 14px;
  font-weight: 650;
}

/* As abas inteiras, em até duas linhas: cortadas ("Lista de e…"), não diziam o que tem dentro. */
.topo-menu__texto small {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  color: var(--app-texto-2, var(--tinta-2));
  font-size: 12px;
  line-height: 1.35;
}

/* A tela atual: a pílula cheia do app, texto e ícone brancos. */
.topo-menu__destino--ativo,
.topo-menu__destino--ativo:hover {
  background: var(--app-destaque, var(--musgo));
  color: #fff;
}

.topo-menu__destino--ativo .topo-menu__icone {
  background: var(--app-vidro, rgb(0 0 0 / 13%));
  color: #fff;
}

.topo-menu__destino--ativo .topo-menu__texto small {
  color: rgb(255 255 255 / 85%);
}

.topo-menu__destino--ativo .topo-selo {
  background: #fff;
  color: var(--risco-tinta);
}

.topo-menu__destino--bloqueado {
  opacity: 0.7;
}

.topo-menu__cadeado {
  font-size: 13px;
}

/* No tablet deitado, cada espaço só com o quadradinho e o nome; a empresa encolhe primeiro. */
@media (max-width: 1100px) {
  .topo-app {
    gap: 10px;
    padding-inline: 14px;
  }

  .topo-app__marca {
    max-width: 180px;
  }

  .topo-app__item {
    padding-inline: 8px 10px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .topo-app__item,
  .topo-app__seta,
  .topo-menu__destino {
    transition: none;
  }
}
</style>
