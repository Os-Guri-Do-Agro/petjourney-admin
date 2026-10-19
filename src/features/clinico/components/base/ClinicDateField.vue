<script setup lang="ts">
/**
 * Campo de data do módulo: o calendário do PrimeVue com o valor em texto.
 *
 * Os formulários guardam data como texto — `AAAA-MM-DD`, ou `AAAA-MM-DDTHH:MM` quando há hora —
 * porque é o que a validação compara e o que vai para a API. Até aqui eles usavam o campo de data
 * do navegador (`type="date"`), e cada navegador desenha o próprio calendário, fora da paleta e da
 * língua da tela. Este componente troca só o desenho: o valor que entra e sai continua o mesmo
 * texto, então a regra de cada formulário não muda.
 *
 * Data e hora no fuso local, montadas à mão: `toISOString` mudaria o dia de quem está a oeste de
 * Greenwich.
 *
 * O painel do calendário é teleportado para o `body`, então a pele dele mora numa regra global
 * presa à classe própria (`datas-painel`): raio de folha, sombra do que flutua, dias em grade de
 * 36 px com algarismos de dado, hoje com anel e o dia escolhido em musgo.
 */
import DatePicker from 'primevue/datepicker'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    inputId?: string
    /** Mesmo formato do valor. Data máxima aceita (ex.: hoje, para o que já aconteceu). */
    max?: string
    min?: string
    /** Data e hora: o valor vira `AAAA-MM-DDTHH:MM`. */
    comHora?: boolean
    ariaDescribedby?: string
    invalido?: boolean
  }>(),
  {
    inputId: undefined,
    max: '',
    min: '',
    comHora: false,
    ariaDescribedby: undefined,
    invalido: false,
  },
)

const emit = defineEmits<{ 'update:modelValue': [valor: string] }>()

function doisDigitos(valor: number) {
  return String(valor).padStart(2, '0')
}

function paraData(texto: string): Date | null {
  const encontrado = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(texto)

  if (!encontrado) {
    return null
  }

  const [, ano, mes, dia, hora = '0', minuto = '0'] = encontrado

  return new Date(Number(ano), Number(mes) - 1, Number(dia), Number(hora), Number(minuto))
}

function paraTexto(data: Date | null): string {
  if (!data) {
    return ''
  }

  const dia = `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}`

  return props.comHora
    ? `${dia}T${doisDigitos(data.getHours())}:${doisDigitos(data.getMinutes())}`
    : dia
}

const valor = computed<Date | null>({
  get: () => paraData(props.modelValue),
  set: (data) => emit('update:modelValue', paraTexto(data)),
})

const maxima = computed(() => (props.max ? (paraData(props.max) ?? undefined) : undefined))
const minima = computed(() => (props.min ? (paraData(props.min) ?? undefined) : undefined))
</script>

<template>
  <DatePicker
    v-model="valor"
    :input-id="inputId"
    :max-date="maxima"
    :min-date="minima"
    :show-time="comHora"
    hour-format="24"
    show-icon
    icon-display="input"
    fluid
    :invalid="invalido"
    class="datas"
    panel-class="hc-tema datas-painel"
    :aria-describedby="ariaDescribedby"
  />
</template>

<style scoped>
.datas :deep(.p-datepicker-input) {
  font-family: var(--font-dados);
  font-variant-numeric: tabular-nums;
}

.datas :deep(.p-datepicker-input-icon-container) {
  color: var(--tinta-2);
}
</style>

<style>
.p-datepicker-panel.datas-painel {
  padding: 12px 12px 10px;
  border: 1px solid var(--linha);
  border-radius: 14px;
  background: var(--superficie);
  box-shadow: var(--sombra-2);
  color: var(--tinta);
  font-family: var(--font-texto);
  font-size: 13.5px;
}

.datas-painel .p-datepicker-header {
  padding: 0 0 8px;
  border-bottom: 1px solid var(--linha);
  background: transparent;
  color: var(--tinta);
}

.datas-painel .p-datepicker-title {
  gap: 4px;
}

.datas-painel .p-datepicker-select-month,
.datas-painel .p-datepicker-select-year {
  padding: 4px 8px;
  border-radius: 8px;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
}

.datas-painel .p-datepicker-select-year {
  font-family: var(--font-dados);
  font-variant-numeric: tabular-nums;
}

.datas-painel .p-datepicker-select-month:enabled:hover,
.datas-painel .p-datepicker-select-year:enabled:hover {
  background: var(--superficie-2);
  color: var(--tinta);
}

.datas-painel .p-datepicker-prev-button,
.datas-painel .p-datepicker-next-button {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  color: var(--tinta-2);
}

.datas-painel .p-datepicker-prev-button:not(:disabled):hover,
.datas-painel .p-datepicker-next-button:not(:disabled):hover {
  background: var(--superficie-2);
  color: var(--tinta);
}

.datas-painel .p-datepicker-day-view {
  margin-top: 6px;
  font-size: 13.5px;
}

.datas-painel .p-datepicker-weekday {
  padding: 6px 0;
  color: var(--tinta-2);
  font-size: 12px;
  font-weight: 550;
}

.datas-painel .p-datepicker-day-cell {
  padding: 1px;
}

.datas-painel .p-datepicker-day {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  color: var(--tinta);
  font-family: var(--font-dados);
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}

.datas-painel .p-datepicker-day:not(.p-datepicker-day-selected):not(.p-disabled):hover {
  background: var(--superficie-2);
  color: var(--tinta);
}

.datas-painel .p-datepicker-other-month .p-datepicker-day {
  color: var(--tinta-3);
}

.datas-painel .p-datepicker-today > .p-datepicker-day {
  background: transparent;
  box-shadow: inset 0 0 0 1.5px var(--linha-forte);
  color: var(--tinta);
  font-weight: 650;
}

.datas-painel .p-datepicker-day.p-datepicker-day-selected,
.datas-painel .p-datepicker-today > .p-datepicker-day.p-datepicker-day-selected {
  background: var(--musgo);
  box-shadow: none;
  color: var(--sobre-musgo);
  font-weight: 650;
}

.datas-painel .p-datepicker-day.p-disabled {
  color: var(--tinta-3);
  opacity: 0.55;
}

.datas-painel .p-datepicker-day:focus-visible {
  outline: 2px solid var(--pj-lugar, var(--musgo));
  outline-offset: 1px;
  box-shadow: none;
}

.datas-painel .p-datepicker-month,
.datas-painel .p-datepicker-year {
  border-radius: 10px;
  color: var(--tinta);
}

.datas-painel .p-datepicker-month.p-datepicker-month-selected,
.datas-painel .p-datepicker-year.p-datepicker-year-selected {
  background: var(--musgo);
  color: var(--sobre-musgo);
}

.datas-painel .p-datepicker-time-picker {
  border-top: 1px solid var(--linha);
  font-family: var(--font-dados);
  font-variant-numeric: tabular-nums;
}
</style>
