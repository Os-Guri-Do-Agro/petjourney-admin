<script setup lang="ts">
/**
 * Cancelamento com motivo.
 *
 * O motivo é `kind`, não texto livre: é o que permite o painel de faltas separar "responsável
 * desmarcou" de "clínica remarcou" mais adiante, e traduzir nos quatro idiomas.
 *
 * A descrição diz em voz alta o que acontece: o horário volta a ficar livre, **mas o card
 * continua visível no dia**.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import AgendaDialogoTopo from './AgendaDialogoTopo.vue'
import ClinicField from '../base/ClinicField.vue'
import type { Appointment, CancelReason } from '../../data/types'
import { useClinicFormat } from '../../composables/useClinicFormat'
import { useAgendaStore } from '../../stores/agenda'
import { useClinicoStore } from '../../stores/clinico'

const props = defineProps<{ appointment: Appointment | null }>()

const emit = defineEmits<{
  confirmar: [motivo: CancelReason]
  fechar: []
}>()

const { t } = useI18n()
const idTitulo = useId()
const agenda = useAgendaStore()
const clinico = useClinicoStore()
const formato = useClinicFormat()

const MOTIVOS: CancelReason[] = [
  'responsavel-desmarcou',
  'clinica-remarcou',
  'paciente-indisponivel',
  'duplicado',
  'outro',
]

const motivo = ref<CancelReason>('responsavel-desmarcou')

const opcoes = computed(() =>
  MOTIVOS.map((valor) => ({ valor, rotulo: formato.motivoCancelamento(valor) })),
)

const aberto = computed({
  get: () => props.appointment !== null,
  set: (valor: boolean) => {
    if (!valor) {
      emit('fechar')
    }
  },
})

const pet = computed(() =>
  props.appointment ? clinico.pet(props.appointment.petId) : null,
)

/** Em quem se está mexendo: o paciente e o horário, que é o que a caixa cobre na grade. */
const alvo = computed(() =>
  props.appointment
    ? `${pet.value?.nome ?? ''} · ${formato.intervalo(props.appointment.inicio, props.appointment.fim)}`
    : '',
)
</script>

<template>
  <Dialog
    v-model:visible="aberto"
    modal
    class="clinic-dialog hc-tema agenda-dialogo"
    :style="{ width: 'min(30rem, 94vw)' }"
    :aria-labelledby="idTitulo"
    dismissable-mask
  >
    <template #header>
      <AgendaDialogoTopo
        :id="idTitulo"
        :titulo="t('clinico.agenda.cancelarDialogo.titulo')"
        :subtitulo="alvo"
        icone="ph ph-x-circle"
        tom="risco"
      />
    </template>

    <div v-if="appointment" class="cancelar clinic-scope">
      <ClinicField :rotulo="t('clinico.agenda.cancelarDialogo.motivo')">
        <template #default="{ id }">
          <Select
            v-model="motivo"
            :input-id="id"
            :options="opcoes"
            option-label="rotulo"
            option-value="valor"
            fluid
            :pt="{ overlay: { class: 'clinic-overlay' } }"
          />
        </template>
      </ClinicField>

      <!-- O que acontece, dito antes: o horário vaga, mas o atendimento continua à vista. -->
      <p class="cancelar__nota">
        <i class="ph ph-info" aria-hidden="true" />
        <span>{{ t('clinico.agenda.cancelarDialogo.descricao') }}</span>
      </p>
    </div>

    <template #footer>
      <Button
        :label="t('clinico.agenda.mover.cancelar')"
        severity="secondary"
        text
        @click="emit('fechar')"
      />
      <Button
        :label="t('clinico.agenda.cancelarDialogo.confirmar')"
        icon="ph ph-x-circle"
        severity="danger"
        :loading="agenda.salvando"
        @click="emit('confirmar', motivo)"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.cancelar {
  display: grid;
  gap: 18px;
}

.cancelar__nota {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.5;
}

.cancelar__nota i {
  margin-top: 2px;
  font-size: 16px;
}
</style>
