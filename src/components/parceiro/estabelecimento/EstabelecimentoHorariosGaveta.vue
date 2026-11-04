<script setup lang="ts">
/**
 * Os horários da semana, numa gaveta, do jeito que a casa fala deles: "de segunda a sexta, das
 * 08:00 às 18:00; sábado, das 08:00 às 12:00". Cada horário é um bloco com os dias em que vale; o
 * dia que não está em nenhum fica fechado. A semana típica cabe em dois blocos, em vez de sete dias
 * com os mesmos campos repetidos.
 *
 * A API continua recebendo os 7 dias (`semanaDosGrupos`), e a conferência é a dela (`horario.ts`):
 * o bloco errado fica marcado antes de enviar e, se a API recusar mesmo assim
 * (`ESTABELECIMENTO_HORARIO_INVALIDO`), o bloco do dia que ela apontar é o marcado.
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Drawer from 'primevue/drawer'
import InputMask from 'primevue/inputmask'
import ToggleButton from 'primevue/togglebutton'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSidePanelOffset } from '@/composables/useSidePanelOffset'
import { useTelaLarga } from '@/composables/useTelaLarga'
import { INTL_LOCALE, isRTLLocale, type Locale } from '@/i18n/locales'
import { ApiError } from '@/service/api'
import type { HorarioDoDia } from '@/service/parceiro/estabelecimento-service'

import {
  ABRE_24H,
  FECHA_24H,
  ORDEM_DA_SEMANA,
  agruparSemana,
  dataCivil,
  diasSemGrupo,
  eVinteEQuatroHoras,
  naOrdemDaSemana,
  nomeDoFuso,
  problemaNoGrupo,
  semanaCompleta,
  semanaDosGrupos,
  temHorario,
  type GrupoDeHorario,
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

/** Um domingo qualquer, para o nome de cada dia sair do `Intl` no idioma da sessão. */
const UM_DOMINGO = '2026-10-18'

/** O primeiro horário de quem ainda não cadastrou nada: o comercial, para ajustar. */
const SEMANA_COMERCIAL: GrupoDeHorario = {
  dias: [1, 2, 3, 4, 5],
  abre: '08:00',
  fecha: '18:00',
  comPausa: false,
  pausaInicio: '',
  pausaFim: '',
}

type GrupoEditavel = GrupoDeHorario & { id: number; vinteEQuatro: boolean }

const { t, locale } = useI18n()
const telaLarga = useTelaLarga()

useSidePanelOffset(
  computed(() => visible.value && telaLarga.value),
  LARGURA,
)

const drawerPosition = computed(() => (isRTLLocale(locale.value as Locale) ? 'left' : 'right'))

const grupos = ref<GrupoEditavel[]>([])
const tentouSalvar = ref(false)
let proximoId = 0

function editavel(grupo: GrupoDeHorario): GrupoEditavel {
  return {
    ...grupo,
    dias: [...grupo.dias],
    id: proximoId++,
    vinteEQuatro: eVinteEQuatroHoras(grupo),
  }
}

watch(visible, (aberta) => {
  if (!aberta) return

  const semana = semanaCompleta(props.horarios)

  grupos.value = (temHorario(semana) ? agruparSemana(semana) : [SEMANA_COMERCIAL]).map(editavel)
  tentouSalvar.value = false
})

/* --------------------------------------------------------------------------- os dias */

function nomeDoDia(diaSemana: number, formato: 'long' | 'short' = 'long') {
  const data = dataCivil(UM_DOMINGO)
  data.setUTCDate(data.getUTCDate() + diaSemana)

  const nome = data
    .toLocaleDateString(INTL_LOCALE[locale.value as Locale], { weekday: formato, timeZone: 'UTC' })
    .replace(/\.$/, '')

  return nome.charAt(0).toLocaleUpperCase() + nome.slice(1)
}

/** Marcar um dia de outro horário o traz para este: um dia tem um horário só. */
function alternarDia(grupo: GrupoEditavel, diaSemana: number) {
  if (grupo.dias.includes(diaSemana)) {
    grupo.dias = grupo.dias.filter((dia) => dia !== diaSemana)
    return
  }

  for (const outro of grupos.value) {
    if (outro !== grupo) outro.dias = outro.dias.filter((dia) => dia !== diaSemana)
  }

  grupo.dias = naOrdemDaSemana([...grupo.dias, diaSemana])
}

function alternarVinteEQuatro(grupo: GrupoEditavel, ligado: boolean) {
  grupo.vinteEQuatro = ligado

  if (ligado) {
    grupo.abre = ABRE_24H
    grupo.fecha = FECHA_24H
    grupo.comPausa = false
  } else if (grupo.abre === ABRE_24H && grupo.fecha === FECHA_24H) {
    grupo.abre = '08:00'
    grupo.fecha = '18:00'
  }
}

function alternarPausa(grupo: GrupoEditavel) {
  grupo.comPausa = !grupo.comPausa

  if (grupo.comPausa && !grupo.pausaInicio && !grupo.pausaFim) {
    grupo.pausaInicio = '12:00'
    grupo.pausaFim = '13:00'
  }
}

/** Outro horário começa com os dias que ainda estão fechados. */
function adicionarGrupo() {
  grupos.value.push(
    editavel({ ...SEMANA_COMERCIAL, abre: '08:00', fecha: '12:00', dias: [...fechados.value] }),
  )
}

function tirarGrupo(grupo: GrupoEditavel) {
  grupos.value = grupos.value.filter((item) => item !== grupo)
}

const fechados = computed(() => diasSemGrupo(grupos.value))

/** "Fechado: sábado e domingo." Lista na forma do idioma (`Intl.ListFormat`). */
const fraseDosFechados = computed(() => {
  if (grupos.value.length === 0 || fechados.value.length === 7) {
    return t('parceiro.estabelecimento.horario.editor.tudoFechado')
  }

  if (fechados.value.length === 0) return t('parceiro.estabelecimento.horario.editor.semFechado')

  const nomes = fechados.value.map((dia) => nomeDoDia(dia).toLocaleLowerCase())
  const lista = new Intl.ListFormat(INTL_LOCALE[locale.value as Locale], {
    style: 'long',
    type: 'conjunction',
  }).format(nomes)

  return t('parceiro.estabelecimento.horario.editor.fechadoEm', { dias: lista })
})

/* ------------------------------------------------------------------------- conferência */

/** O problema que a API apontou, no dia que ela apontou. */
const problemaDaApi = computed<{ diaSemana: number; problema: ProblemaDeHorario } | null>(() => {
  const erro = props.erro

  if (!(erro instanceof ApiError) || erro.codigo !== 'ESTABELECIMENTO_HORARIO_INVALIDO') return null

  const { diaSemana, problema } = erro.detalhes as { diaSemana?: unknown; problema?: unknown }

  return typeof diaSemana === 'number' && typeof problema === 'string'
    ? { diaSemana, problema: problema as ProblemaDeHorario }
    : null
})

function problemaDe(grupo: GrupoEditavel) {
  const local = tentouSalvar.value ? problemaNoGrupo(grupo) : null

  if (local) return local
  if (problemaDaApi.value && grupo.dias.includes(problemaDaApi.value.diaSemana)) {
    return problemaDaApi.value.problema
  }

  return null
}

/** Grupo sem dia não tem hora errada: só o horário com problema pinta os campos de vermelho. */
function horarioInvalido(grupo: GrupoEditavel) {
  const problema = problemaDe(grupo)

  return problema !== null && problema !== 'SEM_DIAS'
}

/** "Horário 2: fecha às": com dois blocos, o leitor de tela precisa saber de qual é o campo. */
function rotuloDoCampo(
  indice: number,
  campo: 'abreAs' | 'fechaAs' | 'pausaComeca' | 'pausaTermina',
) {
  const bloco = t('parceiro.estabelecimento.horario.editor.horario', { numero: indice + 1 })

  return `${bloco}: ${t(`parceiro.estabelecimento.horario.editor.${campo}`)}`
}

function salvar() {
  tentouSalvar.value = true

  if (props.salvando || grupos.value.some((grupo) => problemaNoGrupo(grupo))) return

  emit('salvar', semanaDosGrupos(grupos.value))
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
        {{ t('parceiro.estabelecimento.horario.editor.comoFunciona') }}
        <template v-if="fuso">
          {{ t('parceiro.estabelecimento.horario.noFuso', { fuso: nomeDoFuso(fuso) }) }}
        </template>
      </p>

      <ol class="grupos">
        <li
          v-for="(grupo, indice) in grupos"
          :key="grupo.id"
          class="grupo"
          :class="{ 'grupo--invalido': !!problemaDe(grupo) }"
        >
          <div class="grupo__cabeca">
            <span :id="`grupo-${grupo.id}-titulo`" class="grupo__titulo">
              {{ t('parceiro.estabelecimento.horario.editor.horario', { numero: indice + 1 }) }}
            </span>
            <Button
              type="button"
              icon="ph ph-trash"
              severity="secondary"
              outlined
              size="small"
              :aria-label="
                t('parceiro.estabelecimento.horario.editor.tirar', { numero: indice + 1 })
              "
              :title="t('parceiro.estabelecimento.horario.editor.tirar', { numero: indice + 1 })"
              :disabled="salvando"
              @click="tirarGrupo(grupo)"
            />
          </div>

          <div
            class="grupo__dias"
            role="group"
            :aria-label="t('parceiro.estabelecimento.horario.editor.dias')"
          >
            <ToggleButton
              v-for="diaSemana in ORDEM_DA_SEMANA"
              :key="diaSemana"
              :model-value="grupo.dias.includes(diaSemana)"
              :on-label="nomeDoDia(diaSemana, 'short')"
              :off-label="nomeDoDia(diaSemana, 'short')"
              :aria-label="nomeDoDia(diaSemana)"
              :disabled="salvando"
              class="grupo__dia"
              @update:model-value="alternarDia(grupo, diaSemana)"
            />
          </div>

          <div v-if="!grupo.vinteEQuatro" class="grupo__faixa">
            <span class="grupo__texto">{{ t('parceiro.estabelecimento.horario.editor.das') }}</span>
            <InputMask
              v-model="grupo.abre"
              mask="99:99"
              placeholder="08:00"
              :aria-label="rotuloDoCampo(indice, 'abreAs')"
              :invalid="horarioInvalido(grupo)"
              :disabled="salvando"
            />
            <span class="grupo__texto">{{ t('parceiro.estabelecimento.horario.editor.as') }}</span>
            <InputMask
              v-model="grupo.fecha"
              mask="99:99"
              placeholder="18:00"
              :aria-label="rotuloDoCampo(indice, 'fechaAs')"
              :invalid="horarioInvalido(grupo)"
              :disabled="salvando"
            />
          </div>

          <div v-if="grupo.comPausa && !grupo.vinteEQuatro" class="grupo__faixa">
            <span class="grupo__texto">{{
              t('parceiro.estabelecimento.horario.editor.fechadoDas')
            }}</span>
            <InputMask
              v-model="grupo.pausaInicio"
              mask="99:99"
              placeholder="12:00"
              :aria-label="rotuloDoCampo(indice, 'pausaComeca')"
              :invalid="horarioInvalido(grupo)"
              :disabled="salvando"
            />
            <span class="grupo__texto">{{ t('parceiro.estabelecimento.horario.editor.as') }}</span>
            <InputMask
              v-model="grupo.pausaFim"
              mask="99:99"
              placeholder="13:00"
              :aria-label="rotuloDoCampo(indice, 'pausaTermina')"
              :invalid="horarioInvalido(grupo)"
              :disabled="salvando"
            />
            <Button
              type="button"
              icon="ph ph-x"
              severity="secondary"
              outlined
              size="small"
              :aria-label="t('parceiro.estabelecimento.horario.editor.tirarPausa')"
              :title="t('parceiro.estabelecimento.horario.editor.tirarPausa')"
              :disabled="salvando"
              @click="alternarPausa(grupo)"
            />
          </div>

          <div class="grupo__opcoes">
            <Button
              v-if="!grupo.comPausa && !grupo.vinteEQuatro"
              type="button"
              icon="ph ph-plus"
              :label="t('parceiro.estabelecimento.horario.editor.comPausa')"
              severity="secondary"
              outlined
              size="small"
              :disabled="salvando"
              @click="alternarPausa(grupo)"
            />
            <label class="grupo__24h">
              <Checkbox
                :model-value="grupo.vinteEQuatro"
                binary
                :disabled="salvando"
                @update:model-value="alternarVinteEQuatro(grupo, $event)"
              />
              {{ t('parceiro.estabelecimento.horario.editor.vinteEQuatro') }}
            </label>
          </div>

          <p v-if="problemaDe(grupo)" class="eg__invalido" role="alert">
            {{ t(`parceiro.estabelecimento.horario.problema.${problemaDe(grupo)}`) }}
          </p>
        </li>
      </ol>

      <Button
        type="button"
        class="grupos__adicionar"
        icon="ph ph-plus"
        :label="t('parceiro.estabelecimento.horario.editor.outro')"
        severity="secondary"
        outlined
        :disabled="salvando"
        @click="adicionarGrupo"
      />

      <p class="fechados">
        <i class="ph ph-moon" aria-hidden="true" />
        {{ fraseDosFechados }}
      </p>

      <p class="eg__dica">{{ t('parceiro.estabelecimento.horario.editor.meiaNoite') }}</p>

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
.grupos {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Cada horário num véu: o bloco é a unidade que se edita, sem borda nem sombra. */
.grupo {
  display: grid;
  gap: 12px;
  padding: 14px 16px 16px;
  border-radius: 16px;
  background: var(--app-veu, var(--superficie-2));
}

.grupo--invalido {
  box-shadow: inset 0 0 0 1px var(--risco-tinta);
}

.grupo__cabeca {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.grupo__titulo {
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 650;
}

.grupo__dias {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* Os dias como pílulas soltas: marcada na cor do botão principal, as outras no papel. */
.grupo__dias :deep(.p-togglebutton) {
  min-width: 3.1rem;
  padding: 0;
  border: 1px solid var(--linha-media, var(--linha));
  border-radius: 999px;
  background: var(--app-cartao, var(--superficie));
  color: var(--tinta);
}

.grupo__dias :deep(.p-togglebutton .p-togglebutton-content) {
  padding: 7px 10px;
  border-radius: 999px;
  background: transparent;
  box-shadow: none;
  color: inherit;
  font-size: 13px;
  font-weight: 600;
}

.grupo__dias :deep(.p-togglebutton.p-togglebutton-checked) {
  border-color: var(--p-button-primary-background);
  background: var(--p-button-primary-background);
  color: var(--p-button-primary-color);
}

.grupo__dias :deep(.p-togglebutton:not(.p-togglebutton-checked):not(:disabled):hover) {
  border-color: var(--app-salvia-texto, var(--musgo));
}

.grupo__faixa {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.grupo__faixa :deep(.p-inputmask) {
  width: 5.5rem;
  font-family: var(--font-dados);
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.grupo__texto {
  color: var(--tinta-2);
  font-size: 13.5px;
}

.grupo__opcoes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 16px;
}

.grupo__24h {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--tinta);
  font-size: 13.5px;
  cursor: pointer;
}

.grupos__adicionar {
  justify-self: start;
}

.fechados {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
}

.fechados i {
  color: var(--tinta-2);
  font-size: 16px;
}
</style>
