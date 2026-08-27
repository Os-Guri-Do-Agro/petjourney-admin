<script setup lang="ts">
/**
 * Aparência do painel: tema, formato do menu lateral e densidade.
 *
 * Tudo aqui é preferência de exibição — muda na hora, não passa pela API e não tem botão de
 * salvar.
 *
 * Cada opção mostra uma **maquete** do painel, não um rótulo: "Seções" e "Lista única" são
 * impossíveis de imaginar por nome, e ninguém deveria precisar escolher às cegas para descobrir
 * o que a escolha faz.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import SettingsLayoutMockup from '@/components/settings/SettingsLayoutMockup.vue'
import {
  navigatorDensity,
  navigatorMode,
  setNavigatorDensity,
  setNavigatorMode,
  type NavigatorDensity,
  type NavigatorMode,
} from '@/composables/useLayoutPreferences'
import { colorMode } from '@/theme/color-mode'
import type { ThemeMode } from '@/theme/colors'

const { t } = useI18n()

type Maquete = {
  tema?: 'claro' | 'escuro' | 'atual'
  trilho?: boolean
  grupos?: boolean
  linhas?: number
  densa?: boolean
}

type Opcao<T extends string> = {
  valor: T
  label: string
  hint: string
  maquete: Maquete
}

const temas = computed<Opcao<ThemeMode>[]>(() => [
  {
    valor: 'light',
    label: t('settings.aparencia.tema.claro.label'),
    hint: t('settings.aparencia.tema.claro.hint'),
    maquete: { tema: 'claro' },
  },
  {
    valor: 'dark',
    label: t('settings.aparencia.tema.escuro.label'),
    hint: t('settings.aparencia.tema.escuro.hint'),
    maquete: { tema: 'escuro' },
  },
])

const modos = computed<Opcao<NavigatorMode>[]>(() => [
  {
    valor: 'secoes',
    label: t('settings.aparencia.menu.secoes.label'),
    hint: t('settings.aparencia.menu.secoes.hint'),
    maquete: { trilho: true },
  },
  {
    valor: 'lista',
    label: t('settings.aparencia.menu.lista.label'),
    hint: t('settings.aparencia.menu.lista.hint'),
    maquete: { trilho: false, grupos: true, linhas: 7 },
  },
])

const densidades = computed<Opcao<NavigatorDensity>[]>(() => [
  {
    valor: 'confortavel',
    label: t('settings.aparencia.densidade.confortavel.label'),
    hint: t('settings.aparencia.densidade.confortavel.hint'),
    maquete: { linhas: 4 },
  },
  {
    valor: 'compacta',
    label: t('settings.aparencia.densidade.compacta.label'),
    hint: t('settings.aparencia.densidade.compacta.hint'),
    maquete: { linhas: 8, densa: true },
  },
])
</script>

<template>
  <div class="aparencia">
    <section class="bloco">
      <header class="bloco__topo">
        <span class="bloco__marca" aria-hidden="true"><i class="pi pi-palette" /></span>
        <span class="bloco__texto">
          <h3>{{ t('settings.aparencia.tema.titulo') }}</h3>
          <p>{{ t('settings.aparencia.tema.descricao') }}</p>
        </span>
      </header>

      <div class="opcoes">
        <label
          v-for="opcao in temas"
          :key="opcao.valor"
          class="opcao"
          :class="{ 'opcao--ativa': colorMode === opcao.valor }"
        >
          <input v-model="colorMode" type="radio" name="aparencia-tema" :value="opcao.valor" />

          <SettingsLayoutMockup v-bind="opcao.maquete" />

          <span class="opcao__texto">
            <strong>{{ opcao.label }}</strong>
            <small>{{ opcao.hint }}</small>
          </span>

          <span class="opcao__selo" aria-hidden="true"><i class="pi pi-check" /></span>
        </label>
      </div>
    </section>

    <section class="bloco">
      <header class="bloco__topo">
        <span class="bloco__marca" aria-hidden="true"><i class="pi pi-bars" /></span>
        <span class="bloco__texto">
          <h3>{{ t('settings.aparencia.menu.titulo') }}</h3>
          <p>{{ t('settings.aparencia.menu.descricao') }}</p>
        </span>
      </header>

      <div class="opcoes">
        <label
          v-for="opcao in modos"
          :key="opcao.valor"
          class="opcao"
          :class="{ 'opcao--ativa': navigatorMode === opcao.valor }"
        >
          <input
            type="radio"
            name="aparencia-menu"
            :value="opcao.valor"
            :checked="navigatorMode === opcao.valor"
            @change="setNavigatorMode(opcao.valor)"
          />

          <SettingsLayoutMockup v-bind="opcao.maquete" />

          <span class="opcao__texto">
            <strong>{{ opcao.label }}</strong>
            <small>{{ opcao.hint }}</small>
          </span>

          <span class="opcao__selo" aria-hidden="true"><i class="pi pi-check" /></span>
        </label>
      </div>
    </section>

    <section class="bloco">
      <header class="bloco__topo">
        <span class="bloco__marca" aria-hidden="true"><i class="pi pi-arrows-v" /></span>
        <span class="bloco__texto">
          <h3>{{ t('settings.aparencia.densidade.titulo') }}</h3>
          <p>{{ t('settings.aparencia.densidade.descricao') }}</p>
        </span>
      </header>

      <div class="opcoes">
        <label
          v-for="opcao in densidades"
          :key="opcao.valor"
          class="opcao"
          :class="{ 'opcao--ativa': navigatorDensity === opcao.valor }"
        >
          <input
            type="radio"
            name="aparencia-densidade"
            :value="opcao.valor"
            :checked="navigatorDensity === opcao.valor"
            @change="setNavigatorDensity(opcao.valor)"
          />

          <SettingsLayoutMockup v-bind="opcao.maquete" />

          <span class="opcao__texto">
            <strong>{{ opcao.label }}</strong>
            <small>{{ opcao.hint }}</small>
          </span>

          <span class="opcao__selo" aria-hidden="true"><i class="pi pi-check" /></span>
        </label>
      </div>
    </section>

    <p class="aparencia__nota">
      <i class="pi pi-info-circle" aria-hidden="true" />
      {{ t('settings.aparencia.nota') }}
    </p>
  </div>
</template>

<style scoped>
.aparencia {
  display: grid;
  gap: 1.1rem;
  max-width: 50rem;
}

/* --- Blocos ------------------------------------------------------------ */

.bloco {
  padding: 1.1rem 1.2rem 1.2rem;
  border: 1px solid var(--partner-line);
  border-radius: 1.1rem;
  background: var(--partner-card);
  box-shadow: 0 1px 2px rgb(var(--partner-shadow-rgb) / 0.05);
}

.bloco__topo {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  margin-bottom: 1rem;
}

.bloco__marca {
  display: grid;
  width: 2.15rem;
  height: 2.15rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.7rem;
  background: color-mix(in srgb, var(--partner-primary) 16%, var(--partner-card));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--partner-primary) 26%, transparent);
  color: var(--partner-primary-strong);
  font-size: 0.88rem;
}

.bloco__texto {
  display: grid;
  min-width: 0;
  gap: 0.1rem;
}

.bloco__texto h3 {
  margin: 0;
  color: var(--partner-text);
  font-size: 0.95rem;
  font-weight: 750;
  letter-spacing: -0.015em;
}

.bloco__texto p {
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.8rem;
  line-height: 1.45;
}

/* --- Opções ------------------------------------------------------------ */

.opcoes {
  display: grid;
  gap: 0.85rem;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
}

/*
 * Maquete à esquerda, texto à direita.
 *
 * Empilhada, a maquete herdava a largura do cartão e virava um bloco de 200px de altura — três
 * grupos assim viravam mil pixels de rolagem para escolher três coisas. Nesta largura ela ainda
 * é o triplo da miniatura que havia antes, e as duas opções continuam lado a lado para comparar.
 */
.opcao {
  position: relative;
  display: grid;
  align-items: center;
  gap: 0.8rem;
  grid-template-columns: 9rem minmax(0, 1fr);
  padding: 0.7rem 0.8rem;
  border: 1px solid var(--partner-line);
  border-radius: 0.9rem;
  background: var(--partner-card);
  cursor: pointer;
  transition:
    border-color 150ms ease,
    box-shadow 150ms ease,
    transform 150ms ease;
}

.opcao:hover {
  border-color: color-mix(in srgb, var(--partner-primary) 55%, transparent);
  transform: translateY(-1px);
}

/* Estado, não convite: a opção em uso ganha anel duplo e selo. */
.opcao--ativa {
  border-color: var(--partner-primary);
  box-shadow:
    0 0 0 1px var(--partner-primary),
    0 6px 16px rgb(var(--partner-shadow-rgb) / 0.1);
}

.opcao input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.opcao:has(input:focus-visible) {
  outline: 2px solid var(--partner-primary);
  outline-offset: 3px;
}

.opcao__texto {
  display: grid;
  min-width: 0;
  gap: 0.15rem;
  padding-right: 1rem;
}

.opcao__texto strong {
  color: var(--partner-text);
  font-size: 0.88rem;
  font-weight: 750;
}

.opcao__texto small {
  color: var(--partner-muted);
  font-size: 0.77rem;
  line-height: 1.42;
}

.opcao__selo {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  display: grid;
  width: 1.4rem;
  height: 1.4rem;
  place-items: center;
  border: 2px solid var(--partner-card);
  border-radius: 999px;
  background: var(--partner-primary-strong);
  color: var(--partner-on-primary);
  font-size: 0.58rem;
  opacity: 0;
  transform: scale(0.7);
  transition:
    opacity 150ms ease,
    transform 150ms ease;
}

.opcao--ativa .opcao__selo {
  opacity: 1;
  transform: scale(1);
}

/* --- Nota -------------------------------------------------------------- */

.aparencia__nota {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0;
  padding: 0 0.2rem;
  color: var(--partner-muted);
  font-size: 0.78rem;
}

.aparencia__nota i {
  font-size: 0.8rem;
}

@media (max-width: 900px) {
  .opcoes {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
