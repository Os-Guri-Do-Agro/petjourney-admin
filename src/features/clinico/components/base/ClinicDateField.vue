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
    panel-class="hc-tema"
    :aria-describedby="ariaDescribedby"
  />
</template>
