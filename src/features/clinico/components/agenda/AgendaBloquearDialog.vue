<script setup lang="ts">
/**
 * Bloqueio de horário: almoço, reunião, manutenção, folga, férias.
 *
 * Duas escolhas que o formulário torna explícitas em vez de esconder:
 *
 * - **Bloqueio sem profissional é da clínica inteira.** Manutenção do raio-x não é folga de
 *   ninguém — ela some da grade de todo mundo. O campo aceita ficar vazio de propósito, e o texto
 *   diz o que isso significa.
 * - **Recorrência é escolha de dias da semana, não uma data que se repete.** Almoço não é "toda
 *   segunda a partir de 24/08": é segunda a sexta, sempre. Guardar como recorrência e materializar
 *   na leitura é o que impede a agenda de encher de cópias.
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ClinicField from '../base/ClinicField.vue'
import { useClinicFormat } from '../../composables/useClinicFormat'
import type { BlockReason, ISODate, WeekdayIndex } from '../../data/types'
import { clockToMinutes } from '../../domain/clinic-time'
import { useAgendaStore } from '../../stores/agenda'
import { clinicClock, useClinicoStore } from '../../stores/clinico'

const props = defineProps<{
  visivel: boolean
  data: ISODate
  /** Sugestão de partida; a escolha do formulário vive em `professionalId`. */
  sugestaoProfissional?: string | null
}>()

const emit = defineEmits<{
  'update:visivel': [valor: boolean]
  criado: []
}>()

const { t } = useI18n()
const agenda = useAgendaStore()
const clinico = useClinicoStore()
const formato = useClinicFormat()

const MOTIVOS: BlockReason[] = ['almoco', 'reuniao', 'manutencao', 'bloqueio-pessoal', 'ferias']
const DIAS: WeekdayIndex[] = [1, 2, 3, 4, 5, 6, 0]

const motivo = ref<BlockReason>('reuniao')
const professionalId = ref<string | null>(null)
const roomId = ref<string | null>(null)
const inicio = ref('12:00')
const fim = ref('13:00')
const detalhe = ref('')
const repete = ref(false)
const diasEscolhidos = ref<WeekdayIndex[]>([])
const enviando = ref(false)

const opcoesMotivo = computed(() =>
  MOTIVOS.map((valor) => ({ valor, rotulo: formato.motivoBloqueio(valor) })),
)

const opcoesProfissional = computed(() => [
  { valor: null, rotulo: t('clinico.agenda.bloqueio.clinicaInteira') },
  ...clinico.profissionais.map((item) => ({ valor: item.id, rotulo: item.nome })),
])

const opcoesSala = computed(() => [
  { valor: null, rotulo: t('clinico.agenda.bloqueio.semSala') },
  ...clinico.salas.map((sala) => ({ valor: sala.id, rotulo: sala.nome })),
])

const opcoesDias = computed(() =>
  DIAS.map((dia) => ({
    valor: dia,
    rotulo: formato.diaDaSemanaCurto(diaExemplo(dia)),
  })),
)

const idRepete = useId()
const idDias = useId()

/** Um dia real daquela semana só para o `Intl` nomear o dia — nada de tabela fixa de rótulos. */
function diaExemplo(weekday: WeekdayIndex): ISODate {
  const base = new Date(`${props.data}T12:00:00Z`)
  const atual = base.getUTCDay()

  base.setUTCDate(base.getUTCDate() + ((weekday - atual + 7) % 7))

  return base.toISOString().slice(0, 10) as ISODate
}

const janelaValida = computed(() => clockToMinutes(fim.value) > clockToMinutes(inicio.value))

const podeSalvar = computed(
  () => janelaValida.value && (!repete.value || diasEscolhidos.value.length > 0),
)

watch(
  () => props.visivel,
  (aberto) => {
    if (!aberto) {
      return
    }

    motivo.value = 'reuniao'
    professionalId.value = props.sugestaoProfissional ?? null
    roomId.value = null
    detalhe.value = ''
    repete.value = false
    diasEscolhidos.value = []
    inicio.value = '12:00'
    fim.value = '13:00'
  },
)

async function confirmar() {
  if (!podeSalvar.value || enviando.value) {
    return
  }

  enviando.value = true

  try {
    const bloqueio = await agenda.criarBloqueio({
      professionalId: professionalId.value,
      roomId: roomId.value,
      inicio: clinicClock.toIso(props.data, clockToMinutes(inicio.value)),
      fim: clinicClock.toIso(props.data, clockToMinutes(fim.value)),
      motivo: motivo.value,
      detalhe: detalhe.value.trim(),
      weekdaysRecorrentes: repete.value ? diasEscolhidos.value : null,
    })

    if (bloqueio) {
      emit('criado')
      emit('update:visivel', false)
    }
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <Dialog
    :visible="visivel"
    modal
    class="clinic-dialog hc-tema"
    :style="{ width: 'min(34rem, 94vw)' }"
    @update:visible="emit('update:visivel', $event)"
  >
    <template #header>
      <h2 class="clinic-dialog__titulo">
        <span class="clinic-dialog__marca" aria-hidden="true"><i :class="'pi pi-lock'" /></span>
        {{ t('clinico.agenda.bloqueio.titulo') }}
      </h2>
    </template>

    <form class="bloquear clinic-scope" @submit.prevent="confirmar">
      <p class="bloquear__dia">{{ formato.dataLonga(data) }}</p>

      <ClinicField :rotulo="t('clinico.agenda.bloqueio.motivo')">
        <template #default="{ id }">
          <Select
            :input-id="id"
            v-model="motivo"
            fluid
            option-label="rotulo"
            option-value="valor"
            :options="opcoesMotivo"
            :pt="{ overlay: { class: 'clinic-overlay' } }"
          />
        </template>
      </ClinicField>

      <div class="bloquear__linha">
        <ClinicField :rotulo="t('clinico.agenda.criar.hora')">
          <template #default="{ id }">
            <InputText :id="id" v-model="inicio" type="time" fluid />
          </template>
        </ClinicField>

        <ClinicField :rotulo="t('clinico.agenda.bloqueio.ate')">
          <template #default="{ id }">
            <InputText :id="id" v-model="fim" type="time" fluid :invalid="!janelaValida" />
          </template>
        </ClinicField>
      </div>

      <p v-if="!janelaValida" class="bloquear__erro">
        {{ t('clinico.agenda.bloqueio.janelaInvalida') }}
      </p>

      <ClinicField :rotulo="t('clinico.agenda.mover.profissional')">
        <template #default="{ id }">
          <Select
            :input-id="id"
            v-model="professionalId"
            fluid
            option-label="rotulo"
            option-value="valor"
            :options="opcoesProfissional"
            :pt="{ overlay: { class: 'clinic-overlay' } }"
          />
        </template>
      </ClinicField>

      <ClinicField :rotulo="t('clinico.agenda.criar.sala')">
        <template #default="{ id }">
          <Select
            :input-id="id"
            v-model="roomId"
            fluid
            option-label="rotulo"
            option-value="valor"
            :options="opcoesSala"
            :pt="{ overlay: { class: 'clinic-overlay' } }"
          />
        </template>
      </ClinicField>

      <ClinicField :rotulo="t('clinico.agenda.bloqueio.detalhe')">
        <template #default="{ id }">
          <InputText :id="id" v-model="detalhe" fluid />
        </template>
      </ClinicField>

      <div class="bloquear__repete">
        <Checkbox v-model="repete" binary :input-id="idRepete" />
        <label :for="idRepete">{{ t('clinico.agenda.bloqueio.repetir') }}</label>
      </div>

      <!--
        Escolha múltipla, então não é o `ClinicToggleGroup` — aquele é de opção única e forçar
        um modo múltiplo nele mudaria o contrato de todos os outros seis lugares que o usam.
      -->
      <fieldset v-if="repete" class="dias">
        <legend :id="idDias" class="clinic-label">
          {{ t('clinico.agenda.bloqueio.diasDaSemana') }}
        </legend>

        <SelectButton
          v-model="diasEscolhidos"
          class="dias__lista"
          :options="opcoesDias"
          option-label="rotulo"
          option-value="valor"
          multiple
          size="small"
          :aria-labelledby="idDias"
        />
      </fieldset>
    </form>

    <template #footer>
      <Button
        severity="secondary"
        text
        :label="t('clinico.comum.cancelar')"
        @click="emit('update:visivel', false)"
      />
      <Button
        :disabled="!podeSalvar || enviando"
        :loading="enviando"
        :label="t('clinico.agenda.bloqueio.salvar')"
        @click="confirmar"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.bloquear {
  display: grid;
  gap: var(--clinic-space-3);
}

.bloquear__dia {
  margin: 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-weight: 650;
}

.bloquear__dia::first-letter {
  text-transform: uppercase;
}

.bloquear__linha {
  display: grid;
  gap: var(--clinic-space-3);
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

.bloquear__erro {
  margin: 0;
  color: var(--clinic-risk-text);
  font-size: var(--clinic-font-label);
  font-weight: 650;
}

.dias {
  margin: 0;
  padding: 0;
  border: 0;
}

.dias__lista.p-selectbutton {
  flex-wrap: wrap;
  margin-top: var(--clinic-space-2);
}

/* Dia marcado: anel e cor do acento, para o estado não depender só do fundo. */
.dias__lista :deep(.p-togglebutton-checked .p-togglebutton-content) {
  box-shadow: inset 0 0 0 1.5px var(--clinic-accent-strong);
  color: var(--clinic-accent-strong);
}

.bloquear__repete {
  display: flex;
  align-items: center;
  gap: var(--clinic-space-2);
  color: var(--clinic-text);
  font-size: var(--clinic-font-base);
}

.bloquear__repete label {
  cursor: pointer;
}
</style>
