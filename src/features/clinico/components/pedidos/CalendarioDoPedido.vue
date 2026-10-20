<script setup lang="ts">
/**
 * O calendário do pedido — o mesmo no celular de quem pede e na gaveta de quem responde.
 *
 * Um mês à vista diz de relance o que a fileira de dias escondia: onde há vaga, onde está cheio,
 * onde a casa fecha. O dia com vaga leva um ponto na tinta da casa; o cheio fica apagado; o fechado,
 * riscado. Nenhum deles é desabilitado: tocar no feriado diz que é feriado, tocar no dia cheio
 * oferece o próximo — dia que some do calendário parece defeito, não regra.
 *
 * Dois modos. `dia` escolhe um dia (o horário vem depois, embaixo). `periodo` escolhe de–até: a
 * semana em que o responsável pode, a estadia do hotel.
 *
 * `destaque` é o dia que o pedido trazia, num anel — a recepção compara o que vai marcar com o que
 * foi pedido. `janela` é o período que o responsável disse que pode, levemente tingido.
 *
 * Fala `AAAA-MM-DD` para fora. O `Date` do PrimeVue nasce e morre aqui, ao meio-dia local, para o
 * fuso de quem abre não empurrar o dia 22 para o 21.
 */
import DatePicker from 'primevue/datepicker'
import { computed } from 'vue'

export type SituacaoNoCalendario = 'livre' | 'cheio' | 'fechado'

const props = withDefaults(
  defineProps<{
    modo?: 'dia' | 'periodo'
    min: string
    max: string
    situacoes?: Record<string, SituacaoNoCalendario>
    destaque?: string | null
    janela?: { de: string; ate: string } | null
    rotulo: string
  }>(),
  { modo: 'dia', situacoes: () => ({}), destaque: null, janela: null },
)

const dia = defineModel<string | null>('dia', { default: null })
const periodo = defineModel<{ de: string; ate: string | null } | null>('periodo', {
  default: null,
})

function paraData(iso: string) {
  return new Date(`${iso}T12:00:00`)
}

function paraIso(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(
    data.getDate(),
  ).padStart(2, '0')}`
}

/*
 * Os limites memorizados, e não `paraData(min)` no template: um `Date` novo a cada render é,
 * para o DatePicker, um limite que mudou — ele refaz o mês e agenda um segundo "focar o dia", que
 * puxava o foco para o calendário cada vez que a tela atualizava.
 */
const minimo = computed(() => paraData(props.min))
const maximo = computed(() => paraData(props.max))

const valor = computed({
  get: (): Date | Array<Date | null> | null => {
    if (props.modo === 'dia') {
      return dia.value ? paraData(dia.value) : null
    }

    if (!periodo.value) {
      return null
    }

    return [paraData(periodo.value.de), periodo.value.ate ? paraData(periodo.value.ate) : null]
  },
  set: (novo) => {
    if (props.modo === 'dia') {
      dia.value = novo instanceof Date ? paraIso(novo) : null

      return
    }

    if (!Array.isArray(novo) || !novo[0]) {
      periodo.value = null

      return
    }

    periodo.value = { de: paraIso(novo[0]), ate: novo[1] ? paraIso(novo[1]) : null }
  },
})

type DiaDoSlot = { day: number; month: number; year: number; otherMonth?: boolean }

function isoDoSlot(data: DiaDoSlot) {
  return `${data.year}-${String(data.month + 1).padStart(2, '0')}-${String(data.day).padStart(2, '0')}`
}

function classesDoDia(data: DiaDoSlot) {
  const iso = isoDoSlot(data)
  const situacao = props.situacoes[iso]

  return {
    [`cal__dia--${situacao}`]: Boolean(situacao),
    'cal__dia--destaque': iso === props.destaque,
    'cal__dia--janela': Boolean(props.janela && iso >= props.janela.de && iso <= props.janela.ate),
  }
}
</script>

<template>
  <div class="cal">
    <DatePicker
      v-model="valor"
      inline
      panel-class="hc-tema cal__painel"
      :selection-mode="modo === 'dia' ? 'single' : 'range'"
      :min-date="minimo"
      :max-date="maximo"
      :aria-label="rotulo"
    >
      <template #date="{ date }">
        <span class="cal__dia" :class="classesDoDia(date)">
          {{ date.day }}
          <span
            v-if="situacoes[isoDoSlot(date)] === 'livre'"
            class="cal__ponto"
            aria-hidden="true"
          />
        </span>
      </template>
    </DatePicker>
  </div>
</template>

<style scoped>
.cal {
  display: grid;
}

.cal :deep(.p-datepicker) {
  width: 100%;
}

/*
 * O hoje sem disco: o anel e o tingido já dizem "dia pedido" e "quando pode", e um terceiro
 * círculo confundia os três. Hoje fica na tinta forte da casa, só.
 */
.cal :deep(.cal__painel) {
  --p-datepicker-today-background: transparent;
  --p-datepicker-today-color: var(--musgo);

  width: 100%;
  min-width: 0;
  padding: 6px 4px 8px;
  border: 1px solid var(--linha);
  border-radius: 14px;
  background: var(--superficie);
  box-shadow: none;
}

.cal :deep(.p-datepicker-header) {
  padding: 2px 4px 6px;
  border-bottom: 1px solid var(--linha);
}

.cal :deep(.p-datepicker-title) {
  font-weight: 600;
}

.cal :deep(.p-datepicker-day-view) {
  width: 100%;
  margin-top: 0.35rem;
  table-layout: fixed;
}

.cal :deep(.p-datepicker-weekday) {
  color: var(--tinta-2);
  font-size: 12px;
  font-weight: 550;
  text-transform: none;
}

.cal :deep(.p-datepicker-day-cell) {
  padding: 0.12rem 0;
}

.cal :deep(.p-datepicker-today) .cal__dia {
  font-weight: 700;
}

.cal :deep(.p-datepicker-day) {
  width: 2.15rem;
  height: 2.15rem;
  margin-inline: auto;
  font-family: var(--font-dados);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}

.cal__dia {
  display: inline-grid;
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  place-items: center;
}

/* O ponto do dia com vaga: tinta da casa, embaixo do número. Branco no dia escolhido. */
.cal__ponto {
  position: absolute;
  bottom: 0.22rem;
  left: 50%;
  width: 0.3rem;
  height: 0.3rem;
  border-radius: 50%;
  background: var(--musgo);
  transform: translateX(-50%);
}

.cal :deep(.p-datepicker-day-selected) .cal__ponto {
  background: var(--sobre-musgo);
}

.cal__dia--livre {
  font-weight: 650;
}

.cal__dia--cheio {
  color: var(--tinta-3);
}

.cal__dia--fechado {
  color: var(--tinta-3);
  text-decoration: line-through;
}

.cal__dia--janela {
  background: var(--musgo-fundo);
}

.cal :deep(.p-datepicker-day-selected) .cal__dia--janela {
  background: transparent;
}

/* O dia que o pedido trazia: um anel, para comparar com o que vai ser marcado. */
.cal__dia--destaque {
  box-shadow: inset 0 0 0 1.5px var(--musgo);
}

.cal :deep(.p-datepicker-day-selected) .cal__dia--cheio,
.cal :deep(.p-datepicker-day-selected) .cal__dia--fechado {
  color: inherit;
}
</style>
