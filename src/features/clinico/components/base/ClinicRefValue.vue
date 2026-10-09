<script setup lang="ts">
/**
 * Valor clínico com faixa de referência.
 *
 * Três regras que o componente encarna:
 * 1. O status é **recalculado** a partir do valor e da faixa, nunca recebido pronto. Se fosse
 *    persistido, editar o peso deixaria a leitura antiga marcada como "dentro" para sempre.
 * 2. `não aferido` é diferente de vazio. Um traço para "ninguém preencheu"; a palavra por
 *    extenso para "o profissional decidiu não medir".
 * 3. Fora da faixa não se anuncia só por cor: ganha seta de direção e a palavra.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Measurement, ReferenceRange } from '../../data/types'
import { desvioRelativo, statusDaMedicao } from '../../domain/ranges'
import { useClinicFormat } from '../../composables/useClinicFormat'

const props = withDefaults(
  defineProps<{
    rotulo: string
    valor: Measurement | undefined
    faixa: ReferenceRange | null
    /** Esconde a faixa quando o espaço é curto; o `title` continua trazendo. */
    compacto?: boolean
    /**
     * `cartao` é a apresentação de leitura, com moldura própria. `linha` é para quando o valor
     * mora logo abaixo do campo que o produziu: ali a moldura duplicaria a do campo e o rótulo
     * repetiria o do formulário, então some — fica só o número e o julgamento.
     */
    variante?: 'cartao' | 'linha'
  }>(),
  { compacto: false, variante: 'cartao' },
)

const { t } = useI18n()
const formato = useClinicFormat()

const status = computed(() => statusDaMedicao(props.valor, props.faixa))
const texto = computed(() => formato.medicao(props.valor, props.faixa))
const faixaTexto = computed(() => formato.faixaDeReferencia(props.faixa))
const desvio = computed(() =>
  props.valor ? desvioRelativo(props.valor, props.faixa) : 0,
)

const seta = computed(() => {
  if (status.value === 'acima') {
    return 'ph ph-arrow-up-right'
  }

  if (status.value === 'abaixo') {
    return 'ph ph-arrow-down-right'
  }

  return ''
})

/** Desvio grande merece mais peso visual — mas continua legível em cinza pela palavra. */
const intenso = computed(() => desvio.value >= 0.5)

const titulo = computed(
  () => `${props.rotulo}: ${texto.value} · ${t('clinico.prontuario.referencia')} ${faixaTexto.value}`,
)
</script>

<template>
  <div
    class="ref"
    :class="[`ref--${status}`, `ref--${variante}`, { 'ref--intenso': intenso }]"
    :title="titulo"
  >
    <span v-if="variante === 'cartao'" class="ref__rotulo">{{ rotulo }}</span>

    <span class="ref__linha">
      <span class="ref__valor clinic-value">{{ texto }}</span>
      <i v-if="seta" :class="seta" class="ref__seta" aria-hidden="true" />
      <span v-if="status === 'acima' || status === 'abaixo'" class="ref__status">
        {{ formato.statusDeFaixa(status) }}
      </span>
      <span v-if="variante === 'linha' && !compacto" class="ref__faixa">{{ faixaTexto }}</span>
    </span>

    <span v-if="variante === 'cartao' && !compacto" class="ref__faixa">{{ faixaTexto }}</span>
  </div>
</template>

<style scoped>
.ref {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
}

.ref--cartao {
  padding: var(--clinic-cell-padding-y) var(--clinic-cell-padding-x);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface);
}

/* Variante de linha: sem moldura, sem rótulo, sem fundo. Só o valor e o que ele significa. */
.ref--linha .ref__linha {
  flex-wrap: wrap;
  gap: 0.3rem;
}

.ref--linha .ref__valor {
  font-size: var(--clinic-font-base);
}

.ref__rotulo {
  color: var(--clinic-faint);
  font-size: 0.75rem;
  font-weight: 600;
}

.ref__linha {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 0.3rem;
}

.ref__valor {
  min-width: 0;
  overflow: hidden;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ref__seta {
  font-size: 0.65rem;
}

.ref__status {
  font-size: var(--clinic-font-label);
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.ref__faixa {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-variant-numeric: tabular-nums;
}

.ref--dentro .ref__valor {
  color: var(--clinic-text);
}

/*
 * Fora da faixa se anuncia pelo conjunto — moldura, fundo, seta e a palavra —, não por um
 * filete na borda esquerda. Filete colorido é decoração barata: some em qualquer recorte e
 * não sobrevive à leitura por voz.
 */
.ref--acima.ref--cartao,
.ref--abaixo.ref--cartao {
  border-color: var(--clinic-risk-line);
  background: var(--clinic-risk-bg);
}

.ref--acima .ref__valor,
.ref--abaixo .ref__valor,
.ref--acima .ref__seta,
.ref--abaixo .ref__seta,
.ref--acima .ref__status,
.ref--abaixo .ref__status {
  color: var(--clinic-risk-text);
}

/* Desvio grande engrossa a moldura inteira, não um lado dela. */
.ref--intenso.ref--cartao {
  border-width: 2px;
}

.ref--intenso .ref__valor {
  font-weight: 800;
}

.ref--nao-aferido .ref__valor {
  color: var(--clinic-muted);
  font-style: italic;
  font-weight: 600;
}
</style>
