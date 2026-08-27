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
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

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
</script>

<template>
  <Dialog
    v-model:visible="aberto"
    modal
    class="clinic-dialog"
    :style="{ width: 'min(28rem, 94vw)' }"
    :header="t('clinico.agenda.cancelarDialogo.titulo')"
    dismissable-mask
  >
    <div v-if="appointment" class="cancelar clinic-scope">
      <p class="cancelar__alvo">
        <strong>{{ pet?.nome }}</strong>
        <span class="clinic-value">
          {{ formato.intervalo(appointment.inicio, appointment.fim) }}
        </span>
      </p>

      <label class="cancelar__campo">
        <span class="clinic-label">{{ t('clinico.agenda.cancelarDialogo.motivo') }}</span>
        <Select
          v-model="motivo"
          :options="opcoes"
          option-label="rotulo"
          option-value="valor"
          fluid
          :pt="{ overlay: { class: 'clinic-overlay' } }"
        />
      </label>

      <p class="cancelar__nota">{{ t('clinico.agenda.cancelarDialogo.descricao') }}</p>
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
  gap: var(--clinic-space-4);
}

.cancelar__alvo {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--clinic-space-3);
  margin: 0;
}

.cancelar__alvo strong {
  font-size: var(--clinic-font-title);
  font-weight: 750;
  overflow-wrap: anywhere;
}

.cancelar__campo {
  display: grid;
  gap: 0.25rem;
}

.cancelar__nota {
  margin: 0;
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface-soft);
  color: var(--clinic-muted);
  line-height: 1.5;
}
</style>
