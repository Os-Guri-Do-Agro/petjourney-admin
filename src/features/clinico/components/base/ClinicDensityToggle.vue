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
      class="prefs__grupo prefs__trilho"
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
      class="prefs__grupo prefs__trilho"
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
  gap: 8px;
}

/*
 * O mesmo controle segmentado do `ClinicToggleGroup`: trilho afundado e a escolhida em papel, com
 * `--sombra-1`. `:deep` porque os botões são filhos do `SelectButton`; a especificidade
 * (`.prefs .prefs__grupo.prefs__trilho`) passa a do tema (`html.trilha .hc-tema .p-selectbutton`)
 * e a da camada global da clínica (`.clinic-scope .p-togglebutton`).
 */
.prefs .prefs__grupo.prefs__trilho.p-selectbutton {
  display: inline-flex;
  flex-wrap: nowrap;
  gap: 2px;
  padding: 3px;
  border: 0;
  border-radius: 10px;
  background: var(--superficie-3);
}

.prefs .prefs__grupo.prefs__trilho.p-selectbutton :deep(.p-togglebutton) {
  min-height: 34px;
  flex: 0 0 auto;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--tinta-2);
  font-family: var(--font-texto);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0;
}

.prefs .prefs__grupo.prefs__trilho.p-selectbutton :deep(.p-togglebutton .p-togglebutton-content) {
  gap: 6px;
  height: 100%;
  padding: 0 10px;
  border-radius: 8px;
  background: transparent;
  box-shadow: none;
}

.prefs
  .prefs__grupo.prefs__trilho.p-selectbutton
  :deep(.p-togglebutton:not(:disabled):not(.p-togglebutton-checked):hover) {
  background: transparent;
  color: var(--tinta);
}

.prefs .prefs__grupo.prefs__trilho.p-selectbutton :deep(.p-togglebutton.p-togglebutton-checked) {
  background: transparent;
  color: var(--tinta);
  font-weight: 600;
}

.prefs
  .prefs__grupo.prefs__trilho.p-selectbutton
  :deep(.p-togglebutton.p-togglebutton-checked .p-togglebutton-content) {
  background: var(--superficie);
  box-shadow: var(--sombra-1);
}

.prefs .prefs__grupo.prefs__trilho.p-selectbutton :deep(.p-togglebutton:focus-visible) {
  outline: 2px solid var(--pj-lugar, var(--musgo));
  outline-offset: 1px;
}

.prefs .prefs__grupo.prefs__trilho.p-selectbutton :deep(.p-togglebutton-content i) {
  font-size: 15px;
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
