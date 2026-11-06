<script setup lang="ts">
/**
 * O "Desfazer" depois de uma escrita na agenda (guia e3 2.8): oito segundos na tela (o servidor
 * aceita quinze). A faixa nomeia o que aconteceu e some sozinha; um fio no pé mostra o tempo.
 */
import Button from 'primevue/button'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { DESFAZER_NA_TELA_MS } from '@/service/parceiro/agenda-service'

const props = defineProps<{
  /** O que aconteceu e até quando dá para voltar (`Date.now()` + 8 s); `null` esconde. */
  feito: { texto: string; ate: number } | null
  desfazendo: boolean
}>()
const emit = defineEmits<{ desfazer: []; sumiu: [] }>()

const { t } = useI18n()

const restante = ref(0)
let contador: ReturnType<typeof setInterval> | null = null

const proporcao = computed(() => Math.min(1, restante.value / DESFAZER_NA_TELA_MS))

function parar() {
  if (contador) clearInterval(contador)
  contador = null
}

watch(
  () => props.feito,
  (feito) => {
    parar()
    if (!feito) {
      restante.value = 0
      return
    }

    const atualizar = () => {
      restante.value = Math.max(feito.ate - Date.now(), 0)
      if (restante.value === 0 && !props.desfazendo) {
        parar()
        emit('sumiu')
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
  <Transition name="dn">
    <div v-if="feito && (restante > 0 || desfazendo)" class="dn" role="status">
      <span class="dn__icone" aria-hidden="true"><i class="ph ph-check" /></span>
      <span class="dn__texto">{{ feito.texto }}</span>
      <Button
        type="button"
        severity="secondary"
        outlined
        size="small"
        icon="ph ph-arrow-u-up-left"
        :label="t('agendamentos.desfazer.botao')"
        :loading="desfazendo"
        @click="emit('desfazer')"
      />
      <span class="dn__barra" aria-hidden="true">
        <span class="dn__tempo" :style="{ transform: `scaleX(${proporcao})` }" />
      </span>
    </div>
  </Transition>
</template>

<style scoped>
.dn {
  position: fixed;
  bottom: 24px;
  left: 50%;
  z-index: 60;
  display: grid;
  overflow: hidden;
  min-width: min(24rem, calc(100vw - 32px));
  max-width: calc(100vw - 32px);
  align-items: center;
  gap: 12px;
  padding: 12px 12px 14px 14px;
  border: 1px solid var(--app-regua, var(--linha));
  border-radius: 16px;
  background: var(--app-cartao, var(--superficie));
  box-shadow: var(--sombra-2);
  color: var(--tinta);
  grid-template-columns: auto minmax(0, 1fr) auto;
  transform: translateX(-50%);
}

.dn__icone {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 50%;
  background: var(--ok-fundo);
  color: var(--ok-tinta);
  font-size: 15px;
}

.dn__texto {
  font-size: 14px;
  font-weight: 550;
}

.dn__barra {
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  height: 3px;
  background: color-mix(in srgb, var(--tinta-3) 18%, transparent);
}

.dn__tempo {
  display: block;
  height: 100%;
  background: var(--tinta-2);
  transform-origin: left;
  transition: transform 100ms linear;
}

[dir='rtl'] .dn__tempo {
  transform-origin: right;
}

.dn-enter-active,
.dn-leave-active {
  transition:
    opacity 180ms ease-out,
    transform 180ms ease-out;
}

.dn-enter-from,
.dn-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}

@media (prefers-reduced-motion: reduce) {
  .dn-enter-active,
  .dn-leave-active,
  .dn__tempo {
    transition: none;
  }
}
</style>
