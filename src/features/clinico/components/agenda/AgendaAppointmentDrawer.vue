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
import { cancelarAte, podeConfirmarPresenca } from '../../domain/politica'
import { useAgendaStore } from '../../stores/agenda'
import { useAvisosStore } from '../../stores/avisos'
import { clinicClock, useClinicoStore } from '../../stores/clinico'

const props = defineProps<{ appointment: Appointment | null }>()

const emit = defineEmits<{
  fechar: []
  editar: []
  alterarStatus: [status: AppointmentStatus]
  cancelar: []
  abrirProntuario: []
  verHistorico: []
  verResumo: []
  confirmarPresenca: []
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

/**
 * Quem confirmou presença, e por onde.
 *
 * "Sem confirmação" só aparece na janela em que confirmar diz alguma coisa (as 48 horas antes):
 * cobrar confirmação de um horário de daqui a três semanas é ruído, e a linha pendente perderia
 * o peso que tem na véspera.
 */
const presenca = computed(() => {
  const appointment = props.appointment

  if (!appointment || (appointment.status !== 'agendado' && appointment.status !== 'confirmado')) {
    return null
  }

  if (appointment.confirmacao) {
    return {
      texto: t(`clinico.agenda.presenca.por.${appointment.confirmacao.por}`),
      quando: formato.relativo(appointment.confirmacao.em),
      pendente: false,
    }
  }

  if (appointment.status === 'confirmado') {
    return { texto: t('clinico.agenda.presenca.confirmada'), quando: '', pendente: false }
  }

  return podeConfirmarPresenca(appointment, clinicClock.nowIso())
    ? { texto: t('clinico.agenda.presenca.semConfirmacao'), quando: '', pendente: true }
    : null
})

/**
 * Até quando o responsável mexe neste horário pelo app. É a pergunta que chega à recepção
 * quando a pessoa liga dizendo "o app não me deixa cancelar".
 */
const prazoDoApp = computed(() => {
  const appointment = props.appointment
  const politica = clinico.politica

  if (!appointment || !politica) {
    return null
  }

  const limite = cancelarAte(appointment, politica, clinicClock.utcOffset)

  if (!limite) {
    return null
  }

  return Date.parse(clinicClock.nowIso()) < Date.parse(limite)
    ? t('clinico.agenda.prazoApp.ate', {
        data: formato.dataCurta(clinicClock.dateOf(limite)),
        hora: formato.hora(limite),
      })
    : t('clinico.agenda.prazoApp.encerrado')
})
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

      <div class="drawer__topo-acoes">
        <!--
          Editar mora no cabeçalho, ao lado do status, e não no rodapé com as ações de risco:
          corrigir o tipo de um atendimento não pertence à mesma família de falta e cancelamento.
          Fica escondido quando o atendimento já encerrou — editar o que acabou de ser cancelado
          ou faltado não conserta nada e ainda mexeria num horário que já voltou para a fila.
        -->
        <Button
          v-if="!encerrado"
          icon="pi pi-pencil"
          severity="secondary"
          text
          rounded
          size="small"
          :title="t('clinico.agenda.editar.titulo')"
          :aria-label="t('clinico.agenda.editar.titulo')"
          @click="emit('editar')"
        />

        <Button
          icon="pi pi-times"
          severity="secondary"
          text
          rounded
          size="small"
          :title="t('clinico.atalhos.fechar')"
          :aria-label="t('clinico.atalhos.fechar')"
          @click="emit('fechar')"
        />
      </div>
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
      <div v-if="presenca">
        <dt class="clinic-label">{{ t('clinico.agenda.presenca.titulo') }}</dt>
        <dd :class="{ drawer__pendente: presenca.pendente }">
          {{ presenca.texto }}
          <span v-if="presenca.quando" class="drawer__canal">{{ presenca.quando }}</span>
        </dd>
        <dd v-if="appointment.status === 'agendado'" class="drawer__acao-linha">
          <Button
            :label="t('clinico.agenda.presenca.registrar')"
            icon="pi pi-check"
            severity="secondary"
            text
            size="small"
            :loading="agenda.salvando"
            @click="emit('confirmarPresenca')"
          />
        </dd>
      </div>
      <div v-if="prazoDoApp">
        <dt class="clinic-label">{{ t('clinico.agenda.prazoApp.titulo') }}</dt>
        <dd class="drawer__prazo">{{ prazoDoApp }}</dd>
      </div>
      <div v-if="appointment.chegadaEm">
        <dt class="clinic-label">{{ t('clinico.meuDia.esperando') }}</dt>
        <dd class="clinic-value">{{ formato.relativo(appointment.chegadaEm) }}</dd>
      </div>
      <div v-if="appointment.motivoCancelamento">
        <dt class="clinic-label">{{ t('clinico.agenda.cancelarDialogo.motivo') }}</dt>
        <dd>{{ formato.motivoCancelamento(appointment.motivoCancelamento) }}</dd>
      </div>
      <!--
        Por que o paciente não veio. Aparece no drawer da falta porque é a pergunta que alguém
        faz antes de ligar de novo — e porque a ausência dela é informação: falta sem motivo é
        falta que ninguém apurou.
      -->
      <div v-if="appointment.status === 'falta'">
        <dt class="clinic-label">{{ t('clinico.faltas.justificativa.motivo') }}</dt>
        <dd v-if="appointment.justificativaDeFalta">
          {{ formato.motivoFalta(appointment.justificativaDeFalta.motivo) }}
          <span class="drawer__canal">
            {{ formato.canalDeContato(appointment.justificativaDeFalta.canal) }}
          </span>
        </dd>
        <dd v-else class="drawer__pendente">
          {{ t('clinico.faltas.justificativa.pendente') }}
        </dd>
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

      <!-- O resumo vem antes do histórico: é o que se lê na porta da sala. -->
      <Button
        :label="t('clinico.resumoDoPaciente.verResumo')"
        icon="pi pi-stopwatch"
        severity="secondary"
        outlined
        @click="emit('verResumo')"
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

.drawer__topo-acoes {
  display: flex;
  align-items: center;
  gap: var(--clinic-space-1);
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

/* O canal ao lado do motivo: como se soube, em tom secundário. */
.drawer__canal {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

/* O botão de registrar confirmação encosta na linha da presença, sem virar ação principal. */
.drawer__acao-linha {
  margin-inline-start: calc(var(--clinic-space-2) * -1);
}

.drawer__prazo {
  color: var(--clinic-muted);
  font-weight: 600;
}

/* Falta sem motivo não é campo vazio, é tarefa aberta — e o tom diz isso. */
.drawer__pendente {
  color: var(--clinic-attention-text);
  font-weight: 700;
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
