<script setup lang="ts">
/**
 * A faixa de doses pela API (E4-05b, guia e4 7b.2): uma coluna por dia, uma bolinha por dose, na
 * ordem do dia. A mesma regra da faixa da demonstração (e as mesmas cores, `faixa-cores.css`):
 * **não julgar**. Dada é o musgo; pulada, o âmbar; sem registro, o cinza neutro (nunca vermelho:
 * "sem registro" não é dose perdida); a dose da vez, só o contorno.
 *
 * O leitor de tela recebe a frase inteira pelo `rotulo`; cada bolinha diz o dia, a hora e quem
 * registrou ao passar o ponteiro.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import '@/features/clinico/components/tratamento/faixa-cores.css'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import {
  diaDaClinica,
  diasDaFaixa,
  somarDias,
  type DoseNaFaixa,
  type FaixaDeDoses,
} from '@/service/parceiro/adesao-service'

const props = defineProps<{ faixa: FaixaDeDoses; rotulo: string }>()

const { t, locale } = useI18n()
const intl = computed(() => INTL_LOCALE[locale.value as Locale])

const dias = computed(() => diasDaFaixa(props.faixa))

/**
 * A faixa abre no fim: o dia de hoje é o que a equipe procura, e numa caixa estreita os 42 dias
 * passam da largura. Em árabe o fim fica à esquerda (`scrollLeft` negativo); o navegador limita.
 * Numa aba ainda escondida a caixa não tem largura: rola quando ela aparecer, uma vez, para não
 * brigar com quem rolou para trás.
 */
const caixa = ref<HTMLElement | null>(null)
let falta = true
let observador: ResizeObserver | null = null

function irParaHoje() {
  const el = caixa.value
  if (!el || !falta || el.clientWidth === 0) return
  const rtl = getComputedStyle(el).direction === 'rtl'
  el.scrollLeft = rtl ? -el.scrollWidth : el.scrollWidth
  falta = false
}

onMounted(() => {
  irParaHoje()
  if (caixa.value && typeof ResizeObserver !== 'undefined') {
    observador = new ResizeObserver(irParaHoje)
    observador.observe(caixa.value)
  }
})
onBeforeUnmount(() => observador?.disconnect())
watch(dias, () => {
  falta = true
  nextTick(irParaHoje)
})

/**
 * O dia civil de cada coluna, na parede da clínica: `desde` é a meia-noite dela. A data sai em
 * UTC de propósito, para o fuso do navegador não trocar o dia.
 */
function dataDoDia(dia: number) {
  return new Date(`${somarDias(diaDaClinica(props.faixa.desde), dia)}T00:00:00Z`)
}

const formatoDoDia = computed(
  () => new Intl.DateTimeFormat(intl.value, { day: '2-digit', month: '2-digit', timeZone: 'UTC' }),
)

const CLASSE: Record<string, string> = {
  D: 'fa__dose--dada',
  P: 'fa__dose--pulada',
  S: 'fa__dose--sem',
  A: 'fa__dose--aberta',
}

const SITUACAO: Record<string, string> = {
  D: 'dada',
  P: 'pulada',
  S: 'sem-registro',
  A: 'aberta',
}

function hora(minutoDoDia: number) {
  const h = String(Math.floor(minutoDoDia / 60)).padStart(2, '0')
  const m = String(minutoDoDia % 60).padStart(2, '0')
  return `${h}:${m}`
}

function leitura(dose: DoseNaFaixa) {
  const partes = [
    `${formatoDoDia.value.format(dataDoDia(dose.dia))} ${hora(dose.minutoDoDia)}`,
    t(`clinico.adesao.situacao.${SITUACAO[dose.estado] ?? 'sem-registro'}`),
  ]
  if (dose.quem !== '-' && dose.estado !== 'S') partes.push(t(`adesao.quem.${dose.quem}`))
  return partes.join(' · ')
}

/**
 * Só o primeiro e o último dia levam a data embaixo: o meio é ritmo, não calendário. Numa faixa
 * curta as duas datas se encostariam: abaixo de 6 dias, só a primeira.
 */
const MINIMO_PARA_DUAS_DATAS = 6

function legendaDoDia(dia: number) {
  const primeiro = dia === dias.value[0]?.dia
  const ultimo = dias.value.length >= MINIMO_PARA_DUAS_DATAS && dia === dias.value.at(-1)?.dia
  return primeiro || ultimo ? formatoDoDia.value.format(dataDoDia(dia)) : ''
}
</script>

<template>
  <figure ref="caixa" class="fa faixa-cores" :aria-label="rotulo" role="img">
    <div class="fa__dias">
      <div v-for="item in dias" :key="item.dia" class="fa__dia">
        <span
          v-for="dose in item.doses"
          :key="dose.indice"
          class="fa__dose"
          :class="CLASSE[dose.estado]"
          :title="leitura(dose)"
        />
        <small class="fa__data ui-num" aria-hidden="true">{{ legendaDoDia(item.dia) }}</small>
      </div>
    </div>
  </figure>
</template>

<style scoped>
.fa {
  margin: 0;
  overflow-x: auto;
  scrollbar-width: thin;
}

.fa__dias {
  display: flex;
  align-items: flex-start;
  gap: 3px;
  min-width: min-content;
}

.fa__dia {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 3px;
  min-width: 10px;
  padding-bottom: 16px;
}

.fa__dose {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--faixa-sem-registro);
}

.fa__dose--dada {
  background: var(--faixa-dada);
}

.fa__dose--pulada {
  background: var(--faixa-pulada);
}

.fa__dose--aberta {
  background: transparent;
  box-shadow: inset 0 0 0 2px var(--faixa-agora);
}

.fa__data {
  position: absolute;
  bottom: 0;
  inset-inline-start: 0;
  color: var(--tinta-2);
  font-size: 11px;
  white-space: nowrap;
}

/* Com um dia só, a coluna é a primeira e a última: a data fica no começo, sem cortar. */
.fa__dia:last-child:not(:first-child) .fa__data {
  inset-inline-start: auto;
  inset-inline-end: 0;
}
</style>
