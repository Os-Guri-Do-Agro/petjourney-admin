<script setup lang="ts">
/**
 * Para quando é o pedido — lido antes de qualquer outra coisa da linha.
 *
 * Em cima, o dia em letra pequena ("ter., 20/10" ou "20/10 a 23/10"); embaixo, grande, a hora
 * escolhida (em algarismos de mesma largura, para as horas de linhas diferentes alinharem) ou o
 * período que a pessoa disse que pode ("Manhã"). A hora que já não existe sai riscada: a linha
 * continua dizendo o que foi pedido, e o risco diz que não serve mais.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useClinicFormat } from '../../composables/useClinicFormat'
import { useRotulosDoPedido } from '../../composables/useRotulosDoPedido'

const props = withDefaults(
  defineProps<{
    /** `AAAA-MM-DD`. */
    dia: string
    /** Último dia da janela, no pedido de melhor horário. */
    ate?: string | null
    /** A hora ("18:30") ou o período ("Manhã"). */
    principal: string
    /** A hora é número; o período é palavra. */
    hora?: boolean
    /** "+1": o segundo pet do grupo, no horário seguido. */
    extra?: string
    riscada?: boolean
    tamanho?: 'md' | 'lg'
  }>(),
  { ate: null, hora: true, extra: '', riscada: false, tamanho: 'md' },
)

const { t } = useI18n()
const formato = useClinicFormat()
const rotulos = useRotulosDoPedido()

const dataCurta = computed(() =>
  props.ate && props.ate !== props.dia
    ? t('clinico.pedidos.janela', {
        de: formato.dataCurta(props.dia),
        ate: formato.dataCurta(props.ate),
      })
    : rotulos.dia(props.dia),
)
</script>

<template>
  <span class="quando" :class="[`quando--${tamanho}`, { 'quando--riscada': riscada }]">
    <span class="quando__dia">{{ dataCurta }}</span>
    <span class="quando__principal" :class="{ 'ui-hora': hora, 'quando__periodo': !hora }">
      <component :is="riscada ? 's' : 'span'">{{ principal }}</component>
      <small v-if="extra" class="quando__extra ui-num">{{ extra }}</small>
    </span>
  </span>
</template>

<style scoped>
.quando {
  display: grid;
  min-width: 0;
  align-content: center;
  gap: 1px;
  line-height: 1.15;
}

.quando__dia {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 500;
  overflow-wrap: anywhere;
}

.quando__principal {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  color: var(--tinta);
  white-space: nowrap;
}

.quando__principal.ui-hora {
  font-size: 22px;
  letter-spacing: -0.02em;
}

.quando__periodo {
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.quando__extra {
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0;
}

.quando--lg .quando__dia {
  font-size: 13.5px;
}

.quando--lg .quando__principal.ui-hora {
  font-size: 28px;
}

.quando--lg .quando__periodo {
  font-size: 20px;
}

/* A hora que sumiu: riscada e apagada, para não ser lida como o horário que vai ser marcado. */
.quando--riscada .quando__principal {
  color: var(--tinta-3);
}

.quando--riscada s {
  text-decoration-thickness: 2px;
}
</style>
