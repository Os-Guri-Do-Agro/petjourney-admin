<script setup lang="ts">
/**
 * Alternador de densidade e zoom.
 *
 * Fica no cabeçalho das telas operacionais porque a escolha é de quem opera e muda ao longo
 * do dia: a mesma pessoa quer o dia inteiro na tela de manhã e respiro à tarde. Persiste em
 * `localStorage` e vale para o módulo inteiro.
 */
import SelectButton from 'primevue/selectbutton'
import { computed } from 'vue'
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
  compacta: 'ph ph-list',
  media: 'ph ph-text-align-justify',
  confortavel: 'ph ph-text-align-left',
}

const iconePorZoom: Record<ClinicZoom, string> = {
  reduzido: 'ph ph-magnifying-glass-minus',
  medio: 'ph ph-magnifying-glass',
  ampliado: 'ph ph-magnifying-glass-plus',
}

const opcoesDeDensidade = computed(() =>
  DENSIDADES.map((valor) => ({
    valor,
    rotulo: t(`clinico.densidade.${valor}`),
    icone: iconePorDensidade[valor],
  })),
)

const opcoesDeZoom = computed(() =>
  ZOOMS.map((valor) => ({ valor, rotulo: t(`clinico.zoom.${valor}`), icone: iconePorZoom[valor] })),
)

/**
 * Cada opção continua sendo um `radio` com `aria-checked`, como antes do `SelectButton` — o
 * tema entregaria botões com `aria-pressed`, que anunciam "alternar" e não "escolher um de três".
 * O botão só conhece o próprio rótulo, e é dele que sai o `title`.
 */
function passthrough(titulo: () => string) {
  return {
    pcToggleButton: {
      root: ({
        props: botao,
        context,
      }: {
        props: { onLabel?: string }
        context: { active: boolean }
      }) => ({
        class: 'prefs__botao',
        role: 'radio',
        'aria-checked': context.active,
        'aria-pressed': undefined,
        title: `${titulo()}: ${botao.onLabel ?? ''}`,
      }),
    },
  }
}

const ptDensidade = passthrough(() => t('clinico.densidade.titulo'))
const ptZoom = passthrough(() => t('clinico.zoom.titulo'))
</script>

<template>
  <div class="prefs">
    <SelectButton
      class="prefs__grupo"
      :model-value="densidade"
      :options="opcoesDeDensidade"
      option-label="rotulo"
      option-value="valor"
      :allow-empty="false"
      role="radiogroup"
      :aria-label="t('clinico.densidade.titulo')"
      :pt="ptDensidade"
      @update:model-value="definirDensidade"
    >
      <template #option="{ option }">
        <i :class="option.icone" aria-hidden="true" />
        <span class="prefs__rotulo">{{ option.rotulo }}</span>
      </template>
    </SelectButton>

    <SelectButton
      v-if="comZoom"
      class="prefs__grupo"
      :model-value="zoom"
      :options="opcoesDeZoom"
      option-label="rotulo"
      option-value="valor"
      :allow-empty="false"
      role="radiogroup"
      :aria-label="t('clinico.zoom.titulo')"
      :pt="ptZoom"
      @update:model-value="definirZoom"
    >
      <template #option="{ option }">
        <i :class="option.icone" aria-hidden="true" />
        <span class="sr-only">{{ option.rotulo }}</span>
      </template>
    </SelectButton>
  </div>
</template>

<style scoped>
.prefs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--clinic-space-2);
}

/*
 * Trilho com as opções dentro, no lugar da fileira de botões colados do tema. `:deep` porque
 * os botões são filhos do `SelectButton`; a especificidade dobrada passa a do tema e a da camada
 * global da clínica (`.clinic-scope .p-togglebutton`).
 */
.prefs__grupo.p-selectbutton {
  display: inline-flex;
  padding: 2px;
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface-soft);
}

.prefs__grupo.p-selectbutton :deep(.p-togglebutton) {
  min-height: var(--clinic-hit-target);
  padding: 0;
  border: none;
  border-radius: calc(var(--clinic-radius-control) - 2px);
  background: transparent;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-weight: 700;
  letter-spacing: 0.04em;
}

.prefs__grupo.p-selectbutton :deep(.p-togglebutton-content) {
  gap: 0.3rem;
  padding: 0 var(--clinic-space-3);
  border-radius: inherit;
}

.prefs__grupo.p-selectbutton
  :deep(.p-togglebutton:not(:disabled):not(.p-togglebutton-checked):hover) {
  background: transparent;
  color: var(--clinic-text);
}

/* Anel + peso: a marcação precisa se ler antes da cor, e sobreviver à escala de cinza. */
.prefs__grupo.p-selectbutton :deep(.p-togglebutton-checked) {
  background: transparent;
  color: var(--clinic-accent-strong);
  font-weight: 800;
}

.prefs__grupo.p-selectbutton :deep(.p-togglebutton-checked .p-togglebutton-content) {
  background: var(--clinic-surface);
  box-shadow:
    var(--clinic-shadow-card),
    inset 0 0 0 1.5px var(--clinic-accent-strong);
}

.prefs__grupo.p-selectbutton :deep(.p-togglebutton-content i) {
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
