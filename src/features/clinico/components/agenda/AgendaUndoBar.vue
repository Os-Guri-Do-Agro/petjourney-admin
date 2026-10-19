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
      <span class="desfazer__icone" aria-hidden="true"><i class="ph ph-check" /></span>
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
        <i class="ph ph-arrow-u-up-left p-button-icon" aria-hidden="true" />
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
  bottom: 24px;
  left: 50%;
  z-index: 60;
  display: grid;
  overflow: hidden;
  min-width: min(26rem, calc(100vw - 32px));
  max-width: calc(100vw - 32px);
  align-items: center;
  gap: 12px;
  padding: 12px 12px 14px 14px;
  border: 1px solid var(--linha);
  border-radius: 14px;
  background: var(--superficie);
  box-shadow: var(--sombra-2);
  color: var(--tinta);
  grid-template-columns: auto minmax(0, 1fr) auto;
  transform: translateX(-50%);
}

.desfazer__icone {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 50%;
  background: var(--ok-fundo);
  color: var(--ok-tinta);
  font-size: 15px;
}

.desfazer__texto {
  font-size: 14px;
  font-weight: 550;
}

.desfazer__botao kbd {
  padding: 0 5px;
  border: 1px solid var(--linha-forte);
  border-radius: 5px;
  color: var(--tinta-2);
  font-family: var(--font-dados);
  font-size: 11px;
  line-height: 1.4;
}

/* O tempo que resta: um fio que esvazia no pé da faixa. */
.desfazer__barra {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 3px;
  background: var(--superficie-3);
}

.desfazer__progresso {
  display: block;
  height: 100%;
  background: var(--clinica);
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
    opacity var(--pj-tempo-medio) var(--pj-curva-chega),
    transform var(--pj-tempo-medio) var(--pj-curva-chega);
}

.desfazer-enter-from,
.desfazer-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}

@media (prefers-reduced-motion: reduce) {
  .desfazer-enter-active,
  .desfazer-leave-active,
  .desfazer__progresso {
    transition: none;
  }
}
</style>
