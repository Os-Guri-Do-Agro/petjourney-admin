<script setup lang="ts">
/**
 * Drawer lateral do atendimento — 320 px fixos à direita.
 *
 * Web não tem a restrição do nativo de um modal por vez, então o drawer convive com a grade:
 * dá para conferir o card ao lado enquanto se decide. Ele não é modal de propósito — a agenda
 * continua clicável atrás.
 *
 * Toda ação daqui tem equivalente de teclado e passa pelo store, que invalida tudo.
 */
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import ClinicAlertChip from '../base/ClinicAlertChip.vue'
import ClinicPatientHeader from '../base/ClinicPatientHeader.vue'
import { useClinicFormat } from '../../composables/useClinicFormat'
import type { Appointment, AppointmentStatus } from '../../data/types'
import { useAgendaStore } from '../../stores/agenda'
import { useAvisosStore } from '../../stores/avisos'
import { useClinicoStore } from '../../stores/clinico'

const props = defineProps<{ appointment: Appointment | null }>()

const emit = defineEmits<{
  fechar: []
  alterarStatus: [status: AppointmentStatus]
  cancelar: []
  abrirProntuario: []
  verHistorico: []
}>()

const { t } = useI18n()
const agenda = useAgendaStore()
const avisos = useAvisosStore()
const clinico = useClinicoStore()
const formato = useClinicFormat()

const pet = computed(() => (props.appointment ? clinico.pet(props.appointment.petId) : null))
const tutor = computed(() => (props.appointment ? clinico.tutor(props.appointment.tutorId) : null))
const tipo = computed(() => (props.appointment ? clinico.tipo(props.appointment.typeId) : null))
const profissional = computed(() =>
  props.appointment ? clinico.profissional(props.appointment.professionalId) : null,
)
const salas = computed(() =>
  (props.appointment?.roomIds ?? [])
    .map((roomId) => clinico.sala(roomId)?.nome)
    .filter((nome): nome is string => Boolean(nome)),
)

const conflitos = computed(() => {
  const appointment = props.appointment

  if (!appointment) {
    return []
  }

  return agenda.conflitosDe({
    id: appointment.id,
    petId: appointment.petId,
    professionalId: appointment.professionalId,
    roomIds: appointment.roomIds,
    typeId: appointment.typeId,
    inicio: appointment.inicio,
    fim: appointment.fim,
    linkedGroupId: appointment.linkedGroupId,
  })
})

/** O próximo passo natural do atendimento, para virar botão primário. */
const proximoStatus = computed<AppointmentStatus | null>(() => {
  switch (props.appointment?.status) {
    case 'agendado':
    case 'confirmado':
      return 'aguardando'
    case 'aguardando':
      return 'em-atendimento'
    case 'em-atendimento':
      return 'finalizado'
    default:
      return null
  }
})

/** Avisos deste atendimento, do mais recente para o mais antigo. */
const avisosDoAtendimento = computed(() =>
  props.appointment ? avisos.doAtendimento(props.appointment.id) : [],
)

const encerrado = computed(() =>
  ['finalizado', 'cancelado', 'falta'].includes(props.appointment?.status ?? ''),
)
</script>

<template>
  <aside
    v-if="appointment"
    class="drawer clinic-scope"
    role="complementary"
    :aria-label="pet?.nome"
    @keydown.esc="emit('fechar')"
  >
    <header class="drawer__topo">
      <span class="clinic-label">{{ formato.status(appointment.status) }}</span>
      <button
        type="button"
        class="drawer__fechar clinic-focusable"
        :aria-label="t('clinico.atalhos.fechar')"
        @click="emit('fechar')"
      >
        <i class="pi pi-times" aria-hidden="true" />
      </button>
    </header>

    <ClinicPatientHeader :pet="pet" :tutor="tutor" compacto />

    <dl class="drawer__dados">
      <div>
        <dt class="clinic-label">{{ t('clinico.agenda.mover.para') }}</dt>
        <dd class="clinic-value">{{ formato.intervalo(appointment.inicio, appointment.fim) }}</dd>
      </div>
      <div>
        <dt class="clinic-label">{{ t('clinico.agenda.mover.profissional') }}</dt>
        <dd>{{ profissional?.nome }}</dd>
      </div>
      <div>
        <dt class="clinic-label">{{ t('clinico.agenda.bloqueioDialogo.sala') }}</dt>
        <dd>{{ salas.join(' · ') || t('clinico.agenda.semSala') }}</dd>
      </div>
      <div>
        <dt class="clinic-label">{{ tipo?.nome }}</dt>
        <dd>{{ t(`clinico.origem.${appointment.origem}`) }}</dd>
      </div>
      <div v-if="appointment.chegadaEm">
        <dt class="clinic-label">{{ t('clinico.meuDia.esperando') }}</dt>
        <dd class="clinic-value">{{ formato.relativo(appointment.chegadaEm) }}</dd>
      </div>
      <div v-if="appointment.motivoCancelamento">
        <dt class="clinic-label">{{ t('clinico.agenda.cancelarDialogo.motivo') }}</dt>
        <dd>{{ formato.motivoCancelamento(appointment.motivoCancelamento) }}</dd>
      </div>
    </dl>

    <p v-if="appointment.observacao" class="drawer__observacao">{{ appointment.observacao }}</p>

    <section v-if="conflitos.length > 0" class="drawer__secao">
      <h3 class="clinic-label">{{ t('clinico.agenda.filtros') }}</h3>
      <ul class="drawer__avisos">
        <li v-for="(conflito, indice) in conflitos" :key="indice">
          <ClinicAlertChip
            :severidade="conflito.severity === 'info' ? 'info' : 'atencao'"
            :rotulo="formato.conflito(conflito)"
          />
        </li>
      </ul>
    </section>

    <!--
      Comprovante de que o responsável foi avisado. Fica acima das ações porque é o que se
      confere **antes** de ligar de novo: sem ele, a recepção repete o aviso ou deixa de dar.
    -->
    <section v-if="avisosDoAtendimento.length > 0" class="drawer__secao">
      <h3 class="clinic-label">{{ t('clinico.avisos.titulo') }}</h3>
      <ul class="drawer__avisos-enviados">
        <li v-for="aviso in avisosDoAtendimento" :key="aviso.id">
          <span class="drawer__aviso-topo">
            <strong>{{ t(`clinico.avisos.kind.${aviso.kind}`) }}</strong>
            <span class="drawer__aviso-quando clinic-value">
              {{ formato.relativo(aviso.enviadoEm) }}
            </span>
          </span>
          <p class="drawer__aviso-texto">{{ aviso.texto }}</p>
        </li>
      </ul>
    </section>

    <div class="drawer__acoes">
      <Button
        v-if="proximoStatus"
        :label="formato.status(proximoStatus)"
        icon="pi pi-arrow-right"
        :loading="agenda.salvando"
        @click="emit('alterarStatus', proximoStatus)"
      />

      <Button
        :label="t('clinico.paciente.abrirProntuario')"
        icon="pi pi-file-edit"
        severity="secondary"
        outlined
        @click="emit('abrirProntuario')"
      />

      <Button
        :label="t('clinico.paciente.verHistorico')"
        icon="pi pi-history"
        severity="secondary"
        text
        @click="emit('verHistorico')"
      />

      <div v-if="!encerrado" class="drawer__acoes-risco">
        <Button
          :label="t('clinico.faltas.marcar')"
          icon="pi pi-user-minus"
          severity="warn"
          text
          :loading="agenda.salvando"
          @click="emit('alterarStatus', 'falta')"
        />
        <Button
          :label="t('clinico.agenda.cancelarDialogo.confirmar')"
          icon="pi pi-times-circle"
          severity="danger"
          text
          @click="emit('cancelar')"
        />
      </div>
    </div>
  </aside>
</template>

<style scoped>
.drawer {
  display: grid;
  align-content: start;
  gap: var(--clinic-space-4);
  width: 320px;
  max-height: 100%;
  overflow-y: auto;
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
  box-shadow: var(--clinic-shadow-float);
}

.drawer__topo {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.drawer__fechar {
  display: grid;
  width: var(--clinic-hit-target);
  height: var(--clinic-hit-target);
  place-items: center;
  border: none;
  border-radius: var(--clinic-radius-control);
  background: transparent;
  color: var(--clinic-muted);
  cursor: pointer;
}

.drawer__fechar:hover {
  background: var(--clinic-surface-soft);
  color: var(--clinic-text);
}

.drawer__dados {
  display: grid;
  gap: var(--clinic-space-3);
  margin: 0;
}

.drawer__dados div {
  display: grid;
  gap: 0.1rem;
}

.drawer__dados dd {
  margin: 0;
  font-weight: 650;
  overflow-wrap: anywhere;
}

.drawer__observacao {
  margin: 0;
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface-soft);
  color: var(--clinic-muted);
  line-height: 1.5;
}

.drawer__secao {
  display: grid;
  gap: var(--clinic-space-2);
}

.drawer__avisos {
  display: grid;
  gap: var(--clinic-space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

.drawer__avisos-enviados {
  display: grid;
  gap: var(--clinic-space-2);
  margin: 0;
  padding: 0;
  max-height: 11rem;
  overflow-y: auto;
  list-style: none;
}

.drawer__avisos-enviados li {
  padding: var(--clinic-space-2) var(--clinic-space-3);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface-soft);
}

.drawer__aviso-topo {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--clinic-space-2);
  font-size: var(--clinic-font-label);
}

.drawer__aviso-quando {
  color: var(--clinic-faint);
}

.drawer__aviso-texto {
  margin: 0.2rem 0 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  line-height: 1.45;
}

.drawer__acoes {
  display: grid;
  gap: var(--clinic-space-2);
  padding-top: var(--clinic-space-2);
  border-top: 1px solid var(--clinic-line);
}

.drawer__acoes-risco {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--clinic-space-1);
  margin-top: var(--clinic-space-2);
}

@media (max-width: 1100px) {
  .drawer {
    width: 100%;
  }
}
</style>
