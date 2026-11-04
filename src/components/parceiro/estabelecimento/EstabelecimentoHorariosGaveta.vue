<script setup lang="ts">
/**
 * Os horários da semana, numa gaveta: um dia por linha, aberto ou fechado, com o intervalo
 * recolhido até alguém pedir. A semana vai inteira (os 7 dias) a cada salvamento, como a API pede.
 *
 * A conferência é a da API (`horario.ts`): o dia errado fica marcado antes de enviar e, se a API
 * recusar mesmo assim (`ESTABELECIMENTO_HORARIO_INVALIDO`), o dia que ela apontar é o marcado.
 */
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import InputMask from 'primevue/inputmask'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSidePanelOffset } from '@/composables/useSidePanelOffset'
import { useTelaLarga } from '@/composables/useTelaLarga'
import { INTL_LOCALE, isRTLLocale, type Locale } from '@/i18n/locales'
import { ApiError } from '@/service/api'
import type { HorarioDoDia } from '@/service/parceiro/estabelecimento-service'

import {
  dataCivil,
  nomeDoFuso,
  problemaNoDia,
  semanaCompleta,
  type ProblemaDeHorario,
} from './horario'
import './gaveta.css'

const props = defineProps<{
  horarios: HorarioDoDia[]
  fuso: string | null
  salvando: boolean
  erro: Error | null
}>()

const emit = defineEmits<{ salvar: [dias: HorarioDoDia[]] }>()

const visible = defineModel<boolean>('visible', { default: false })

const LARGURA = '32rem'

/** A semana de trabalho começa na segunda; domingo fecha a lista. */
const ORDEM = [1, 2, 3, 4, 5, 6, 0] as const

/** Um domingo qualquer, para o nome de cada dia sair do `Intl` no idioma da sessão. */
const UM_DOMINGO = '2026-10-18'

type DiaEditavel = {
  diaSemana: number
  aberto: boolean
  abre: string
  fecha: string
  comIntervalo: boolean
  intervaloInicio: string
  intervaloFim: string
}

const { t, locale } = useI18n()
const telaLarga = useTelaLarga()

useSidePanelOffset(
  computed(() => visible.value && telaLarga.value),
  LARGURA,
)

const drawerPosition = computed(() => (isRTLLocale(locale.value as Locale) ? 'left' : 'right'))

const dias = ref<DiaEditavel[]>([])
const tentouSalvar = ref(false)

watch(visible, (aberta) => {
  if (!aberta) return

  dias.value = semanaCompleta(props.horarios).map((dia) => ({
    diaSemana: dia.diaSemana,
    aberto: !dia.fechado,
    abre: dia.abre ?? '',
    fecha: dia.fecha ?? '',
    comIntervalo: Boolean(dia.intervaloInicio || dia.intervaloFim),
    intervaloInicio: dia.intervaloInicio ?? '',
    intervaloFim: dia.intervaloFim ?? '',
  }))
  tentouSalvar.value = false
})

const diasNaOrdem = computed(() =>
  ORDEM.map((diaSemana) => dias.value.find((dia) => dia.diaSemana === diaSemana)!).filter(Boolean),
)

/** O nome do dia no idioma da sessão; com maiúscula só quando abre a frase ("de segunda-feira"). */
function nomeDoDia(diaSemana: number, abreAFrase = true) {
  const data = dataCivil(UM_DOMINGO)
  data.setUTCDate(data.getUTCDate() + diaSemana)

  const nome = data.toLocaleDateString(INTL_LOCALE[locale.value as Locale], {
    weekday: 'long',
    timeZone: 'UTC',
  })

  return abreAFrase ? nome.charAt(0).toLocaleUpperCase() + nome.slice(1) : nome
}

function paraEnviar(dia: DiaEditavel): HorarioDoDia {
  if (!dia.aberto) {
    return {
      diaSemana: dia.diaSemana,
      fechado: true,
      abre: null,
      fecha: null,
      intervaloInicio: null,
      intervaloFim: null,
    }
  }

  return {
    diaSemana: dia.diaSemana,
    fechado: false,
    abre: dia.abre || null,
    fecha: dia.fecha || null,
    intervaloInicio: dia.comIntervalo ? dia.intervaloInicio || null : null,
    intervaloFim: dia.comIntervalo ? dia.intervaloFim || null : null,
  }
}

/** O problema que a API apontou, no dia que ela apontou. */
const problemaDaApi = computed<{ diaSemana: number; problema: ProblemaDeHorario } | null>(() => {
  const erro = props.erro

  if (!(erro instanceof ApiError) || erro.codigo !== 'ESTABELECIMENTO_HORARIO_INVALIDO') return null

  const { diaSemana, problema } = erro.detalhes as { diaSemana?: unknown; problema?: unknown }

  return typeof diaSemana === 'number' && typeof problema === 'string'
    ? { diaSemana, problema: problema as ProblemaDeHorario }
    : null
})

function problemaDe(dia: DiaEditavel): ProblemaDeHorario | null {
  const local = tentouSalvar.value ? problemaNoDia(paraEnviar(dia)) : null

  if (local) return local
  if (problemaDaApi.value?.diaSemana === dia.diaSemana) return problemaDaApi.value.problema

  return null
}

function aoAbrirDia(dia: DiaEditavel, aberto: boolean) {
  dia.aberto = aberto

  /* Um dia que abre pela primeira vez já vem com um expediente comum, para ajustar. */
  if (aberto && !dia.abre && !dia.fecha) {
    dia.abre = '08:00'
    dia.fecha = '18:00'
  }
}

function alternarIntervalo(dia: DiaEditavel) {
  dia.comIntervalo = !dia.comIntervalo

  if (dia.comIntervalo && !dia.intervaloInicio && !dia.intervaloFim) {
    dia.intervaloInicio = '12:00'
    dia.intervaloFim = '13:00'
  }
}

/** Repete o horário deste dia nos outros dias abertos: a semana costuma ser igual. */
function copiarParaOsAbertos(origem: DiaEditavel) {
  for (const dia of dias.value) {
    if (dia === origem || !dia.aberto) continue

    dia.abre = origem.abre
    dia.fecha = origem.fecha
    dia.comIntervalo = origem.comIntervalo
    dia.intervaloInicio = origem.intervaloInicio
    dia.intervaloFim = origem.intervaloFim
  }
}

const outrosAbertos = computed(() => dias.value.filter((dia) => dia.aberto).length > 1)

function salvar() {
  tentouSalvar.value = true

  const semana = dias.value
    .slice()
    .sort((um, outro) => um.diaSemana - outro.diaSemana)
    .map(paraEnviar)

  if (props.salvando || semana.some((dia) => problemaNoDia(dia))) return

  emit('salvar', semana)
}
</script>

<template>
  <Drawer
    v-model:visible="visible"
    :position="drawerPosition"
    :modal="false"
    :dismissable="false"
    :block-scroll="false"
    class="estabelecimento-gaveta"
    :style="{ width: `min(${LARGURA}, 100vw)` }"
  >
    <template #header>
      <h2 class="eg-titulo">
        <span class="ui-ladrilho ui-ladrilho--lugar" aria-hidden="true">
          <i class="ph ph-clock" />
        </span>
        {{ t('parceiro.estabelecimento.gaveta.titulo.horarios') }}
      </h2>
    </template>

    <form id="estabelecimento-horarios" class="eg" novalidate @submit.prevent="salvar">
      <p class="eg__dica">
        <template v-if="fuso">
          {{ t('parceiro.estabelecimento.horario.noFuso', { fuso: nomeDoFuso(fuso) }) }}
        </template>
        {{ t('parceiro.estabelecimento.horario.regras') }}
      </p>

      <ul class="semana">
        <li
          v-for="dia in diasNaOrdem"
          :key="dia.diaSemana"
          class="dia"
          :class="{ 'dia--fechado': !dia.aberto }"
        >
          <div class="dia__cabeca">
            <label class="dia__nome" :for="`dia-${dia.diaSemana}-aberto`">
              {{ nomeDoDia(dia.diaSemana) }}
            </label>
            <span class="dia__estado" aria-hidden="true">
              {{
                dia.aberto
                  ? t('parceiro.estabelecimento.horario.aberto')
                  : t('parceiro.estabelecimento.horario.fechado')
              }}
            </span>
            <ToggleSwitch
              :model-value="dia.aberto"
              :input-id="`dia-${dia.diaSemana}-aberto`"
              :disabled="salvando"
              @update:model-value="aoAbrirDia(dia, $event)"
            />
          </div>

          <template v-if="dia.aberto">
            <div class="dia__faixa">
              <InputMask
                v-model="dia.abre"
                mask="99:99"
                placeholder="08:00"
                :aria-label="
                  t('parceiro.estabelecimento.horario.abreAs', { dia: nomeDoDia(dia.diaSemana) })
                "
                :invalid="!!problemaDe(dia)"
                :disabled="salvando"
              />
              <span class="dia__ate">{{ t('parceiro.estabelecimento.horario.ate') }}</span>
              <InputMask
                v-model="dia.fecha"
                mask="99:99"
                placeholder="18:00"
                :aria-label="
                  t('parceiro.estabelecimento.horario.fechaAs', { dia: nomeDoDia(dia.diaSemana) })
                "
                :invalid="!!problemaDe(dia)"
                :disabled="salvando"
              />
              <Button
                v-if="outrosAbertos"
                type="button"
                icon="ph ph-copy"
                severity="secondary"
                outlined
                size="small"
                :aria-label="
                  t('parceiro.estabelecimento.horario.copiar', {
                    dia: nomeDoDia(dia.diaSemana, false),
                  })
                "
                :title="
                  t('parceiro.estabelecimento.horario.copiar', {
                    dia: nomeDoDia(dia.diaSemana, false),
                  })
                "
                :disabled="salvando"
                @click="copiarParaOsAbertos(dia)"
              />
            </div>

            <div v-if="dia.comIntervalo" class="dia__faixa dia__faixa--intervalo">
              <span class="dia__intervalo-rotulo">{{
                t('parceiro.estabelecimento.horario.intervalo')
              }}</span>
              <InputMask
                v-model="dia.intervaloInicio"
                mask="99:99"
                placeholder="12:00"
                :aria-label="
                  t('parceiro.estabelecimento.horario.intervaloDe', {
                    dia: nomeDoDia(dia.diaSemana),
                  })
                "
                :invalid="!!problemaDe(dia)"
                :disabled="salvando"
              />
              <span class="dia__ate">{{ t('parceiro.estabelecimento.horario.ate') }}</span>
              <InputMask
                v-model="dia.intervaloFim"
                mask="99:99"
                placeholder="13:00"
                :aria-label="
                  t('parceiro.estabelecimento.horario.intervaloAte', {
                    dia: nomeDoDia(dia.diaSemana),
                  })
                "
                :invalid="!!problemaDe(dia)"
                :disabled="salvando"
              />
            </div>

            <Button
              type="button"
              class="dia__alternar"
              size="small"
              severity="secondary"
              outlined
              :icon="dia.comIntervalo ? 'ph ph-minus' : 'ph ph-plus'"
              :label="
                dia.comIntervalo
                  ? t('parceiro.estabelecimento.horario.semIntervalo')
                  : t('parceiro.estabelecimento.horario.comIntervalo')
              "
              :disabled="salvando"
              @click="alternarIntervalo(dia)"
            />
          </template>

          <p v-if="problemaDe(dia)" class="eg__invalido" role="alert">
            {{ t(`parceiro.estabelecimento.horario.problema.${problemaDe(dia)}`) }}
          </p>
        </li>
      </ul>

      <p v-if="erro && !problemaDaApi" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        {{ erro.message }}
      </p>
    </form>

    <template #footer>
      <div class="eg__pe">
        <Button
          type="button"
          :label="t('parceiro.estabelecimento.gaveta.cancelar')"
          severity="secondary"
          outlined
          :disabled="salvando"
          @click="visible = false"
        />
        <Button
          type="submit"
          form="estabelecimento-horarios"
          icon="ph ph-check"
          :label="t('parceiro.estabelecimento.gaveta.salvar')"
          :loading="salvando"
        />
      </div>
    </template>
  </Drawer>
</template>

<style scoped>
/* Uma linha por dia, separadas por um fio: sete cartões empilhados pesavam mais que a semana. */
.semana {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dia {
  display: grid;
  gap: 10px;
  padding: 14px 0;
  border-top: 1px solid var(--linha);
}

.dia:first-child {
  border-top: 0;
  padding-top: 4px;
}

.dia--fechado .dia__nome {
  color: var(--tinta-2);
  font-weight: 500;
}

.dia__cabeca {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dia__nome {
  flex: 1;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.dia__estado {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.dia__faixa {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.dia__faixa :deep(.p-inputmask) {
  width: 5.5rem;
  font-family: var(--font-dados);
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.dia__ate,
.dia__intervalo-rotulo {
  color: var(--tinta-2);
  font-size: 13px;
}

.dia__intervalo-rotulo {
  min-width: 4.5rem;
}

.dia__alternar {
  justify-self: start;
}
</style>
