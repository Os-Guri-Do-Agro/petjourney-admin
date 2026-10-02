<script setup lang="ts">
/**
 * Faixa de desfazer — oito segundos.
 *
 * Tempo de perceber o engano, não de mudar de ideia. A barra nomeia o que aconteceu (não um
 * genérico "alteração salva") e some sozinha; `Z` faz o mesmo pelo teclado.
 */
import Button from 'primevue/button'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { DESFAZER_SEGUNDOS, useAgendaStore } from '../../stores/agenda'

const { t } = useI18n()
const agenda = useAgendaStore()

const restante = ref(0)
let contador: ReturnType<typeof setInterval> | null = null

const proporcao = computed(() =>
  restante.value > 0 ? restante.value / (DESFAZER_SEGUNDOS * 1000) : 0,
)

function parar() {
  if (contador) {
    clearInterval(contador)
    contador = null
  }
}

watch(
  () => agenda.desfazer,
  (acao) => {
    parar()

    if (!acao) {
      restante.value = 0

      return
    }

    const atualizar = () => {
      restante.value = Math.max(acao.expiraEm - Date.now(), 0)

      if (restante.value === 0) {
        parar()
      }
    }

    atualizar()
    contador = setInterval(atualizar, 100)
  },
  { immediate: true },
)

onBeforeUnmount(parar)
</script>

<template>
  <Transition name="desfazer">
    <div v-if="agenda.desfazer && restante > 0" class="desfazer clinic-scope" role="status">
      <span class="desfazer__texto">
        {{ t(`clinico.agenda.desfeito.${agenda.desfazer.kind}`) }}
      </span>

      <Button
        class="desfazer__botao"
        severity="secondary"
        outlined
        size="small"
        @click="agenda.desfazerUltima()"
      >
        <i class="pi pi-undo p-button-icon" aria-hidden="true" />
        <span class="p-button-label">{{ t('clinico.agenda.desfazer') }}</span>
        <kbd>Z</kbd>
      </Button>

      <span class="desfazer__barra" aria-hidden="true">
        <span class="desfazer__progresso" :style="{ transform: `scaleX(${proporcao})` }" />
      </span>
    </div>
  </Transition>
</template>

<style scoped>
.desfazer {
  position: fixed;
  bottom: var(--clinic-space-5);
  left: 50%;
  z-index: 60;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: var(--clinic-space-3);
  min-width: min(24rem, 90vw);
  padding: var(--clinic-space-3) var(--clinic-space-4);
  border: 1px solid var(--clinic-line-strong);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
  box-shadow: var(--clinic-shadow-float);
  transform: translateX(-50%);
}

.desfazer__texto {
  font-weight: 650;
}

.desfazer__botao kbd {
  padding: 0 0.25rem;
  border: 1px solid currentcolor;
  border-radius: 0.25rem;
  font-family: inherit;
  font-size: 0.62rem;
  opacity: 0.75;
}

.desfazer__barra {
  grid-column: 1 / -1;
  height: 2px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--clinic-line);
}

.desfazer__progresso {
  display: block;
  height: 100%;
  background: var(--clinic-accent-strong);
  transform-origin: left;
  transition: transform 100ms linear;
}

/* A barra esvazia rumo ao início da linha de leitura. */
[dir='rtl'] .desfazer__progresso {
  transform-origin: right;
}

.desfazer-enter-active,
.desfazer-leave-active {
  transition:
    opacity 160ms ease,
    transform 160ms ease;
}

.desfazer-enter-from,
.desfazer-leave-to {
  opacity: 0;
  transform: translate(-50%, 0.5rem);
}
</style>
