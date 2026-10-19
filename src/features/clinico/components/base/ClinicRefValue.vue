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
 *
 * O número usa a fonte de dados (algarismos de mesma largura) e a faixa de referência vem logo
 * abaixo, em tinta terciária: quem lê compara o valor com a faixa sem mudar de linha.
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
const desvio = computed(() => (props.valor ? desvioRelativo(props.valor, props.faixa) : 0))

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
  () =>
    `${props.rotulo}: ${texto.value} · ${t('clinico.prontuario.referencia')} ${faixaTexto.value}`,
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
      <span class="ref__valor ui-num clinic-value">{{ texto }}</span>
      <span v-if="status === 'acima' || status === 'abaixo'" class="ref__status">
        <i v-if="seta" :class="seta" class="ref__seta" aria-hidden="true" />
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
  min-width: 0;
  align-content: start;
  gap: 3px;
}

.ref--cartao {
  padding: 10px 12px 11px;
  border: 1px solid var(--linha);
  border-radius: 10px;
  background: var(--superficie);
}

.ref__rotulo {
  overflow: hidden;
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ref__linha {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 8px;
}

.ref .ref__valor {
  min-width: 0;
  overflow: hidden;
  color: var(--tinta);
  font-family: var(--font-dados);
  font-size: 17px;
  font-variant-numeric: tabular-nums;
  font-weight: 650;
  letter-spacing: -0.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Variante de linha: sem moldura, sem rótulo, sem fundo. Só o valor e o que ele significa. */
.ref--linha .ref__valor {
  font-size: 14.5px;
}

/* A palavra do julgamento, com a seta de direção: um selo de risco, da família do kit. */
.ref__status {
  display: inline-flex;
  align-self: center;
  align-items: center;
  gap: 3px;
  height: 20px;
  padding: 0 7px;
  border-radius: 6px;
  background: var(--risco-fundo);
  color: var(--risco-tinta);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.ref__seta {
  font-size: 12px;
}

.ref__faixa {
  color: var(--tinta-3);
  font-family: var(--font-dados);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

/*
 * Fora da faixa se anuncia pelo conjunto — a moldura, o número na tinta de risco e o selo com a
 * seta e a palavra —, não por um filete na borda. Filete colorido some em qualquer recorte e não
 * sobrevive à leitura por voz.
 */
.ref--acima.ref--cartao,
.ref--abaixo.ref--cartao {
  border-color: color-mix(in oklab, var(--risco) 45%, var(--linha));
  background: color-mix(in oklab, var(--risco-fundo) 55%, var(--superficie));
}

.ref--acima .ref__valor,
.ref--abaixo .ref__valor {
  color: var(--risco-tinta);
}

/* Desvio grande engrossa a moldura inteira, não um lado dela. */
.ref--intenso.ref--cartao {
  border-width: 2px;
  border-color: var(--risco);
  padding: 9px 11px 10px;
}

.ref--nao-aferido .ref__valor {
  color: var(--tinta-2);
  font-family: var(--font-texto);
  font-size: 14.5px;
  font-weight: 500;
}
</style>
