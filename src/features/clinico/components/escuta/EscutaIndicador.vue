<script setup lang="ts">
/**
 * O microfone continua aberto fora da anamnese.
 *
 * A conversa não para quando o veterinário vai aferir a temperatura: a gravação segue enquanto
 * ele anda pelas etapas. O que não pode é ela seguir **sem ninguém ver** — microfone aberto numa
 * tela que não diz isso é exatamente o que a autorização do responsável não cobre. Então, fora da
 * anamnese, este indicador fica junto do stepper, com o caminho de volta.
 */
import { PhMicrophone, PhMicrophoneSlash } from '@phosphor-icons/vue'
import Button from 'primevue/button'
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
  <span class="indicador">
    <span
      class="indicador__disco"
      :class="{ 'indicador__disco--pausado': pausada }"
      aria-hidden="true"
    >
      <component :is="pausada ? PhMicrophoneSlash : PhMicrophone" weight="bold" />
    </span>
    <span class="indicador__texto">
      <span role="status">{{
        pausada ? t('clinico.escuta.indicador.pausada') : t('clinico.escuta.indicador.ouvindo')
      }}</span>
      <span class="clinic-value" role="timer" aria-live="off">{{
        rotulos.relogio(escuta.tempoMs)
      }}</span>
    </span>
    <Button
      class="indicador__voltar"
      :label="t('clinico.escuta.indicador.voltar')"
      link
      size="small"
      @click="emit('voltar')"
    />
  </span>
</template>

<style scoped>
.indicador {
  display: inline-flex;
  align-items: center;
  gap: var(--clinic-space-2);
  margin-inline-end: auto;
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.indicador__disco {
  display: grid;
  width: 1.4rem;
  height: 1.4rem;
  place-items: center;
  border-radius: 999px;
  background: var(--clinic-risk-bg);
  color: var(--clinic-risk-text);
  font-size: 0.75rem;
}

.indicador__disco--pausado {
  background: var(--clinic-neutral-bg);
  color: var(--clinic-neutral-text);
}

.indicador__texto {
  display: inline-flex;
  gap: 0.35rem;
  color: var(--clinic-text);
}

/* Tabular como todo relógio do módulo, mas na altura do rótulo: aqui ele é contexto, não valor. */
.indicador__texto .clinic-value {
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

.indicador__voltar.p-button {
  padding: 0;
  color: var(--clinic-accent-strong);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}
</style>
