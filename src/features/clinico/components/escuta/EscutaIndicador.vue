<script setup lang="ts">
/**
 * O microfone continua aberto fora da anamnese.
 *
 * A conversa não para quando o veterinário vai aferir a temperatura: a gravação segue enquanto
 * ele anda pelas etapas. O que não pode é ela seguir **sem ninguém ver** — microfone aberto numa
 * tela que não diz isso é exatamente o que a autorização do responsável não cobre. Então, fora da
 * anamnese, este indicador fica junto do trilho, com o caminho de volta.
 *
 * É uma pílula em tom de risco com o ponto que pulsa enquanto ouve (parado quando pausada, e
 * parado também com movimento reduzido): o estado se lê em cor, em palavra e no relógio.
 */
import { PhMicrophone, PhMicrophoneSlash } from '@phosphor-icons/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useRotulosDaEscuta } from '../../composables/useRotulosDaEscuta'
import { useEscutaStore } from '../../stores/escuta'

const emit = defineEmits<{ voltar: [] }>()

const { t } = useI18n()
const escuta = useEscutaStore()
const rotulos = useRotulosDaEscuta()

const pausada = computed(() => escuta.fase === 'pausada')
</script>

<template>
  <span class="indicador" :class="{ 'indicador--pausado': pausada }">
    <span class="indicador__icone" aria-hidden="true">
      <component :is="pausada ? PhMicrophoneSlash : PhMicrophone" weight="bold" />
    </span>
    <span class="indicador__texto">
      <span role="status">{{
        pausada ? t('clinico.escuta.indicador.pausada') : t('clinico.escuta.indicador.ouvindo')
      }}</span>
      <span class="indicador__relogio ui-num" role="timer" aria-live="off">{{
        rotulos.relogio(escuta.tempoMs)
      }}</span>
    </span>
    <button type="button" class="indicador__voltar" @click="emit('voltar')">
      {{ t('clinico.escuta.indicador.voltar') }}
    </button>
  </span>
</template>

<style scoped>
.indicador {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  gap: 10px;
  padding: 0 6px 0 8px;
  border: 1px solid color-mix(in oklab, var(--risco) 35%, var(--linha));
  border-radius: 999px;
  background: var(--risco-fundo);
  color: var(--risco-tinta);
  font-size: 13.5px;
  font-weight: 600;
}

.indicador--pausado {
  border-color: var(--linha);
  background: var(--neutro-fundo);
  color: var(--neutro-tinta);
}

.indicador__icone {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 50%;
  background: var(--superficie);
  font-size: 14px;
}

.indicador:not(.indicador--pausado) .indicador__icone {
  animation: pulsar 1.6s ease-in-out infinite;
}

@keyframes pulsar {
  50% {
    box-shadow: 0 0 0 4px color-mix(in oklab, var(--risco) 25%, transparent);
  }
}

.indicador__texto {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
}

.indicador__relogio {
  font-weight: 650;
}

.indicador__voltar {
  min-height: 28px;
  padding: 0 10px;
  border: 0;
  border-radius: 999px;
  background: var(--superficie);
  color: var(--tinta);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 550;
}

.indicador__voltar:hover {
  background: var(--superficie-2);
}

.indicador__voltar:focus-visible {
  outline: 2px solid var(--risco);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .indicador__icone {
    animation: none !important;
  }
}
</style>
