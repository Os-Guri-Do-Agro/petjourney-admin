<script setup lang="ts">
/**
 * Alternador de densidade e zoom.
 *
 * Fica no cabeçalho das telas operacionais porque a escolha é de quem opera e muda ao longo
 * do dia: a mesma pessoa quer o dia inteiro na tela de manhã e respiro à tarde. Persiste em
 * `localStorage` e vale para o módulo inteiro.
 */
import { useI18n } from 'vue-i18n'

import {
  DENSIDADES,
  ZOOMS,
  useClinicPrefs,
  type ClinicDensidade,
  type ClinicZoom,
} from '../../composables/useClinicPrefs'

withDefaults(defineProps<{ comZoom?: boolean }>(), { comZoom: true })

const { t } = useI18n()
const { densidade, zoom, definirDensidade, definirZoom } = useClinicPrefs()

const iconePorDensidade: Record<ClinicDensidade, string> = {
  compacta: 'pi pi-bars',
  media: 'pi pi-align-justify',
  confortavel: 'pi pi-align-left',
}

const iconePorZoom: Record<ClinicZoom, string> = {
  reduzido: 'pi pi-search-minus',
  medio: 'pi pi-search',
  ampliado: 'pi pi-search-plus',
}
</script>

<template>
  <div class="prefs">
    <div class="prefs__grupo" role="radiogroup" :aria-label="t('clinico.densidade.titulo')">
      <button
        v-for="opcao in DENSIDADES"
        :key="opcao"
        type="button"
        class="prefs__botao clinic-focusable"
        :class="{ 'prefs__botao--ativo': densidade === opcao }"
        role="radio"
        :aria-checked="densidade === opcao"
        :title="`${t('clinico.densidade.titulo')}: ${t(`clinico.densidade.${opcao}`)}`"
        @click="definirDensidade(opcao)"
      >
        <i :class="iconePorDensidade[opcao]" aria-hidden="true" />
        <span class="prefs__rotulo">{{ t(`clinico.densidade.${opcao}`) }}</span>
      </button>
    </div>

    <div
      v-if="comZoom"
      class="prefs__grupo"
      role="radiogroup"
      :aria-label="t('clinico.zoom.titulo')"
    >
      <button
        v-for="opcao in ZOOMS"
        :key="opcao"
        type="button"
        class="prefs__botao prefs__botao--icone clinic-focusable"
        :class="{ 'prefs__botao--ativo': zoom === opcao }"
        role="radio"
        :aria-checked="zoom === opcao"
        :title="`${t('clinico.zoom.titulo')}: ${t(`clinico.zoom.${opcao}`)}`"
        @click="definirZoom(opcao)"
      >
        <i :class="iconePorZoom[opcao]" aria-hidden="true" />
        <span class="sr-only">{{ t(`clinico.zoom.${opcao}`) }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.prefs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--clinic-space-2);
}

.prefs__grupo {
  display: inline-flex;
  padding: 2px;
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface-soft);
}

.prefs__botao {
  display: inline-flex;
  min-height: var(--clinic-hit-target);
  align-items: center;
  gap: 0.3rem;
  padding: 0 var(--clinic-space-3);
  border: none;
  border-radius: calc(var(--clinic-radius-control) - 2px);
  background: transparent;
  color: var(--clinic-muted);
  cursor: pointer;
  font: inherit;
  font-size: var(--clinic-font-label);
  font-weight: 700;
  letter-spacing: 0.04em;
}

.prefs__botao--icone {
  padding: 0 var(--clinic-space-2);
}

.prefs__botao:hover {
  color: var(--clinic-text);
}

/* Anel + peso: a marcação precisa se ler antes da cor, e sobreviver à escala de cinza. */
.prefs__botao--ativo {
  background: var(--clinic-surface);
  box-shadow:
    var(--clinic-shadow-card),
    inset 0 0 0 1.5px var(--clinic-accent-strong);
  color: var(--clinic-accent-strong);
  font-weight: 800;
}

.prefs__botao i {
  font-size: 0.72rem;
}

@media (max-width: 900px) {
  .prefs__rotulo {
    display: none;
  }
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
