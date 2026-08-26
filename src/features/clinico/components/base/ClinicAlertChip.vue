<script setup lang="ts">
/**
 * Chip de alerta clínico.
 *
 * Cor sozinha não carrega informação aqui: cada severidade tem ícone próprio e tratamento de
 * borda distinto, para que em escala de cinza — ou para quem não distingue vermelho de verde —
 * "risco" continue diferente de "atenção". O texto sempre acompanha; chip sem rótulo é enfeite.
 */
import { computed } from 'vue'

import type { AlertSeverity } from '../../data/types'

const props = withDefaults(
  defineProps<{
    severidade: AlertSeverity
    rotulo: string
    detalhe?: string
    /** Só o ícone, com o rótulo no `title` — para grades muito estreitas. */
    compacto?: boolean
    icone?: string
  }>(),
  { detalhe: '', compacto: false, icone: '' },
)

const iconePorSeveridade: Record<AlertSeverity, string> = {
  risco: 'pi pi-exclamation-triangle',
  atencao: 'pi pi-exclamation-circle',
  info: 'pi pi-info-circle',
}

const icone = computed(() => props.icone || iconePorSeveridade[props.severidade])
const titulo = computed(() =>
  props.detalhe ? `${props.rotulo} — ${props.detalhe}` : props.rotulo,
)
</script>

<template>
  <span
    class="chip"
    :class="[`chip--${severidade}`, { 'chip--compacto': compacto }]"
    :title="titulo"
  >
    <i :class="icone" aria-hidden="true" />
    <span v-if="!compacto" class="chip__rotulo">{{ rotulo }}</span>
    <span v-if="!compacto && detalhe" class="chip__detalhe">{{ detalhe }}</span>
    <span v-if="compacto" class="sr-only">{{ titulo }}</span>
  </span>
</template>

<style scoped>
.chip {
  display: inline-flex;
  min-width: 0;
  max-width: 100%;
  align-items: center;
  gap: var(--clinic-space-1);
  padding: 0.15rem 0.5rem;
  border: 1px solid transparent;
  border-radius: var(--clinic-radius-chip);
  font-size: var(--clinic-font-label);
  font-weight: 700;
  letter-spacing: 0.01em;
  line-height: 1.5;
}

.chip--compacto {
  padding: 0.15rem 0.3rem;
}

.chip i {
  flex: 0 0 auto;
  font-size: 0.7rem;
}

.chip__rotulo {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chip__detalhe {
  overflow: hidden;
  font-weight: 550;
  opacity: 0.85;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Risco: borda cheia e fundo quente — o único lugar onde o quente é permitido. */
.chip--risco {
  border-color: var(--clinic-risk-line);
  background: var(--clinic-risk-bg);
  color: var(--clinic-risk-text);
}

/* Atenção: borda tracejada, distinguível de risco sem depender do matiz. */
.chip--atencao {
  border-color: var(--clinic-attention-line);
  border-style: dashed;
  background: var(--clinic-attention-bg);
  color: var(--clinic-attention-text);
}

/* Informação: sem borda, o mais silencioso dos três. */
.chip--info {
  border-color: transparent;
  background: var(--clinic-neutral-bg);
  color: var(--clinic-neutral-text);
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
