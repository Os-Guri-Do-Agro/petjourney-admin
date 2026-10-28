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

/**
 * O próximo passo natural do atendimento, para virar botão primário.
 *
 * O botão diz a ação ("Registrar chegada"), e não o estado em que o atendimento vai ficar: com
 * o rótulo "Aguardando", a recepção lia o botão como o estado atual e não clicava.
 */
const proximoStatus = computed<AppointmentStatus | null>(() => {
  switch (props.appointment?.status) {
    case 'agendado':
    case 'confirmado':
      /* Chegada só no dia: "Registrar chegada" na consulta de amanhã punha na recepção quem nem saiu de casa. */
      return clinicClock.dateOf(props.appointment.inicio) === clinicClock.today() ? 'aguardando' : null
    case 'aguardando':
      return 'em-atendimento'
    case 'em-atendimento':
      return 'finalizado'
    default:
      return null
  }
})

/** Avisos deste atendimento, do mais recente para o mais antigo. */
/** A cor do estado, na mesma escada do resto do sistema. */
const tomDoEstado = computed(() => {
  switch (props.appointment?.status) {
    case 'em-atendimento':
      return 'sala'
    case 'aguardando':
      return 'atencao'
    case 'finalizado':
      return 'ok'
    case 'falta':
    case 'cancelado':
      return 'risco'
    default:
      return 'neutro'
  }
})

const ICONE_DO_PASSO: Partial<Record<AppointmentStatus, string>> = {
  aguardando: 'ph ph-door-open',
  'em-atendimento': 'ph ph-stethoscope',
  finalizado: 'ph ph-check-circle',
}

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
    :class="[`drawer--${appointment.status}`, `drawer--tom-${tomDoEstado}`]"
    role="complementary"
    :aria-label="pet?.nome"
    @keydown.esc="emit('fechar')"
  >
    <!-- O horário e o estado: as duas coisas que quem clicou queria confirmar. -->
    <header class="drawer__topo">
      <div class="drawer__quando">
        <span class="drawer__estado" :class="`drawer__estado--${tomDoEstado}`">
          <span class="drawer__ponto" aria-hidden="true" />
          {{ formato.status(appointment.status) }}
        </span>
        <strong class="drawer__hora ui-num">
          {{ formato.intervalo(appointment.inicio, appointment.fim) }}
        </strong>
      </div>

      <div class="drawer__topo-acoes">
        <!--
          Editar mora no alto, ao lado do horário, e não junto de falta e cancelamento: corrigir o
          tipo de um atendimento não é da mesma família. Some quando o atendimento já encerrou.
        -->
        <Button
          v-if="!encerrado"
          icon="ph ph-pencil-simple"
          severity="secondary"
          text
          rounded
          :title="t('clinico.agenda.editar.titulo')"
          :aria-label="t('clinico.agenda.editar.titulo')"
          @click="emit('editar')"
        />
        <Button
          icon="ph ph-x"
          severity="secondary"
          text
          rounded
          :title="t('clinico.atalhos.fechar')"
          :aria-label="t('clinico.atalhos.fechar')"
          @click="emit('fechar')"
        />
      </div>
    </header>

    <div class="drawer__corpo">
      <!-- O próximo passo vem antes de tudo: é por ele que se abre o atendimento na maior parte das vezes. -->
      <Button
        v-if="proximoStatus"
        class="drawer__passo"
        :label="t(`clinico.agenda.proximoPasso.${proximoStatus}`)"
        :icon="ICONE_DO_PASSO[proximoStatus] ?? 'ph ph-arrow-right'"
        :loading="agenda.salvando"
        @click="emit('alterarStatus', proximoStatus)"
      />

      <ClinicPatientHeader :pet="pet" :tutor="tutor" compacto />

      <dl class="drawer__dados ui-poco">
        <div>
          <dt><i class="ph ph-user" aria-hidden="true" />{{ t('clinico.agenda.mover.profissional') }}</dt>
          <dd>{{ profissional?.nome }}</dd>
        </div>
        <div>
          <dt><i class="ph ph-door" aria-hidden="true" />{{ t('clinico.agenda.bloqueioDialogo.sala') }}</dt>
          <dd>{{ salas.join(', ') || t('clinico.agenda.semSala') }}</dd>
        </div>
        <!-- Rótulo em cima, valor embaixo, como os vizinhos: antes o tipo virava rótulo da origem. -->
        <div>
          <dt><i class="ph ph-stethoscope" aria-hidden="true" />{{ t('clinico.agenda.tipoCurto') }}</dt>
          <dd>{{ tipo?.nome }}</dd>
        </div>
        <div>
          <dt><i class="ph ph-signpost" aria-hidden="true" />{{ t('clinico.agenda.comoChegou') }}</dt>
          <dd>{{ t(`clinico.origem.${appointment.origem}`) }}</dd>
        </div>
        <div v-if="appointment.chegadaEm">
          <dt><i class="ph ph-hourglass-medium" aria-hidden="true" />{{ t('clinico.meuDia.esperando') }}</dt>
          <dd class="ui-num">{{ formato.relativo(appointment.chegadaEm) }}</dd>
        </div>
        <div v-if="presenca" class="drawer__largo">
          <dt><i class="ph ph-check-circle" aria-hidden="true" />{{ t('clinico.agenda.presenca.titulo') }}</dt>
          <dd :class="{ drawer__pendente: presenca.pendente }">
            {{ presenca.texto }}
            <span v-if="presenca.quando" class="drawer__canal">{{ presenca.quando }}</span>
          </dd>
          <dd v-if="appointment.status === 'agendado'" class="drawer__acao-linha">
            <Button
              :label="t('clinico.agenda.presenca.registrar')"
              icon="ph ph-check"
              severity="secondary"
              outlined
              size="small"
              :loading="agenda.salvando"
              @click="emit('confirmarPresenca')"
            />
          </dd>
        </div>
        <div v-if="prazoDoApp" class="drawer__largo">
          <dt><i class="ph ph-device-mobile" aria-hidden="true" />{{ t('clinico.agenda.prazoApp.titulo') }}</dt>
          <dd class="drawer__prazo">{{ prazoDoApp }}</dd>
        </div>
        <div v-if="appointment.motivoCancelamento" class="drawer__largo">
          <dt><i class="ph ph-x-circle" aria-hidden="true" />{{ t('clinico.agenda.cancelarDialogo.motivo') }}</dt>
          <dd>{{ formato.motivoCancelamento(appointment.motivoCancelamento) }}</dd>
        </div>
        <!--
          Por que o paciente não veio: é a pergunta que alguém faz antes de ligar de novo — e a
          ausência dela é informação: falta sem motivo é falta que ninguém apurou.
        -->
        <div v-if="appointment.status === 'falta'" class="drawer__largo">
          <dt><i class="ph ph-user-minus" aria-hidden="true" />{{ t('clinico.faltas.justificativa.motivo') }}</dt>
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

      <p v-if="appointment.observacao" class="drawer__observacao">
        <i class="ph ph-chat-text" aria-hidden="true" />
        <span>{{ appointment.observacao }}</span>
      </p>

      <section v-if="conflitos.length > 0" class="drawer__secao">
        <h3 class="drawer__subtitulo">{{ t('clinico.agenda.conflitosTitulo') }}</h3>
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
        Comprovante de que o responsável foi avisado. Fica acima das ações porque é o que se confere
        **antes** de ligar de novo: sem ele, a recepção repete o aviso ou deixa de dar.
      -->
      <section v-if="avisosDoAtendimento.length > 0" class="drawer__secao">
        <h3 class="drawer__subtitulo">{{ t('clinico.avisos.titulo') }}</h3>
        <ul class="drawer__avisos-enviados">
          <li v-for="aviso in avisosDoAtendimento" :key="aviso.id">
            <span class="drawer__aviso-topo">
              <strong>{{ t(`clinico.avisos.kind.${aviso.kind}`) }}</strong>
              <span class="drawer__aviso-quando ui-num">
                {{ formato.relativo(aviso.enviadoEm) }}
              </span>
            </span>
            <p class="drawer__aviso-texto">{{ aviso.texto }}</p>
          </li>
        </ul>
      </section>

      <nav class="drawer__ir" :aria-label="t('clinico.agenda.drawer.irPara')">
        <button type="button" class="drawer__atalho" @click="emit('abrirProntuario')">
          <span class="ui-ladrilho ui-ladrilho--p" aria-hidden="true">
            <i class="ph ph-note-pencil" />
          </span>
          <span class="drawer__atalho-texto">{{ t('clinico.paciente.abrirProntuario') }}</span>
          <i class="ph ph-caret-right drawer__seta" aria-hidden="true" />
        </button>
        <button type="button" class="drawer__atalho" @click="emit('verResumo')">
          <span class="ui-ladrilho ui-ladrilho--p" aria-hidden="true">
            <i class="ph ph-timer" />
          </span>
          <span class="drawer__atalho-texto">{{ t('clinico.resumoDoPaciente.verResumo') }}</span>
          <i class="ph ph-caret-right drawer__seta" aria-hidden="true" />
        </button>
        <button type="button" class="drawer__atalho" @click="emit('verHistorico')">
          <span class="ui-ladrilho ui-ladrilho--p" aria-hidden="true">
            <i class="ph ph-clock-counter-clockwise" />
          </span>
          <span class="drawer__atalho-texto">{{ t('clinico.paciente.verHistorico') }}</span>
          <i class="ph ph-caret-right drawer__seta" aria-hidden="true" />
        </button>
      </nav>
    </div>

    <div v-if="!encerrado" class="drawer__risco">
      <Button
        :label="t('clinico.faltas.marcar')"
        icon="ph ph-user-minus"
        severity="warn"
        text
        size="small"
        :loading="agenda.salvando"
        @click="emit('alterarStatus', 'falta')"
      />
      <Button
        :label="t('clinico.agenda.cancelarDialogo.confirmar')"
        icon="ph ph-x-circle"
        severity="danger"
        text
        size="small"
        @click="emit('cancelar')"
      />
    </div>
  </aside>
</template>

<style scoped>
/*
 * O painel do atendimento é um cartão que flutua ao lado da grade. O alto é o cartão de estado: o
 * tom do atendimento (na sala, na recepção, feito, falta) desce num degradê até o papel, como os
 * postos do Hoje. Embaixo, o paciente, os dados num poço e os caminhos em linhas.
 */
.drawer {
  --drawer-tom: var(--superficie-3);

  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-content: start;
  width: 340px;
  /* Da altura da grade ao lado (a página a define): o painel rola por dentro, não a página. */
  max-height: var(--altura-da-grade, 100%);
  overflow-y: auto;
  border: 1px solid var(--linha);
  border-radius: var(--raio-cartao);
  background: var(--superficie);
  box-shadow: var(--sombra-2);
}

.drawer--tom-sala {
  --drawer-tom: var(--clinica-fundo);
}

.drawer--tom-atencao {
  --drawer-tom: var(--atencao-fundo);
}

.drawer--tom-ok {
  --drawer-tom: var(--ok-fundo);
}

.drawer--tom-risco {
  --drawer-tom: var(--risco-fundo);
}

.drawer__topo {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding: 18px 14px 16px 20px;
  border-radius: var(--raio-cartao) var(--raio-cartao) 0 0;
  background: linear-gradient(
    180deg,
    color-mix(in oklab, var(--drawer-tom) 75%, var(--superficie)),
    var(--superficie)
  );
}

.drawer__quando {
  display: grid;
  gap: 8px;
}

.drawer__estado {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 7px;
  height: 26px;
  padding: 0 11px 0 10px;
  border-radius: 999px;
  background: var(--neutro-fundo);
  color: var(--neutro-tinta);
  font-size: 12.5px;
  font-weight: 600;
}

.drawer__ponto {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.drawer__estado--sala {
  background: var(--clinica-fundo);
  color: var(--clinica-tinta);
}

.drawer__estado--atencao {
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
}

.drawer__estado--ok {
  background: var(--ok-fundo);
  color: var(--ok-tinta);
}

.drawer__estado--risco {
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

/* No alto tingido, o selo ganha papel por trás: não some no fundo da mesma cor. */
.drawer:not(.drawer--tom-neutro) .drawer__estado {
  box-shadow:
    0 0 0 1px color-mix(in oklab, currentColor 18%, transparent),
    var(--sombra-xs);
}

.drawer__hora {
  color: var(--tinta);
  font-size: 26px;
  font-weight: 650;
  letter-spacing: -0.025em;
  line-height: 1.1;
}

.drawer__topo-acoes {
  display: flex;
  align-items: center;
  gap: 2px;
}

.drawer__corpo {
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 16px;
  padding: 4px 18px 18px;
}

.drawer__passo.p-button {
  width: 100%;
  justify-content: center;
}

/* Os dados do atendimento num poço: rente, apoiando o paciente que está acima. */
.drawer__dados {
  display: grid;
  gap: 14px 16px;
  grid-template-columns: 1fr 1fr;
  margin: 0;
  padding: 14px 16px;
}

.drawer__dados div {
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 3px;
}

.drawer__largo {
  grid-column: 1 / -1;
}

.drawer__dados dt {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--tinta-2);
  font-size: 12.5px;
}

.drawer__dados dt i {
  color: var(--tinta-3);
  font-size: 14px;
}

.drawer__dados dd {
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.drawer__canal {
  margin-inline-start: 4px;
  color: var(--tinta-3);
  font-size: 12.5px;
  font-weight: 450;
}

.drawer__acao-linha {
  margin-top: 4px;
}

.drawer__prazo {
  color: var(--tinta-2);
}

.drawer__dados dd.drawer__pendente,
.drawer__pendente {
  color: var(--atencao-tinta);
}

.drawer__observacao {
  display: flex;
  gap: 10px;
  margin: 0;
  padding: 12px 14px;
  border: 1px solid var(--linha-suave);
  border-radius: var(--raio-cartao-pequeno);
  background: var(--superficie-2);
  color: var(--tinta);
  font-size: 13.5px;
  line-height: 1.5;
}

.drawer__observacao i {
  margin-top: 2px;
  color: var(--tinta-3);
}

.drawer__secao {
  display: grid;
  gap: 8px;
}

.drawer__subtitulo {
  margin: 0;
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 650;
}

.drawer__avisos,
.drawer__avisos-enviados {
  display: grid;
  min-width: 0;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.drawer__avisos-enviados li {
  padding: 10px 12px;
  border: 1px solid var(--linha);
  border-radius: 12px;
  background: var(--superficie);
}

.drawer__aviso-topo {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 13px;
}

.drawer__aviso-quando {
  color: var(--tinta-3);
}

.drawer__aviso-texto {
  margin: 4px 0 0;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

/* Para onde ir a partir daqui: três destinos, cada um uma linha com o ladrilho e a seta. */
.drawer__ir {
  display: grid;
  overflow: hidden;
  border: 1px solid var(--linha);
  border-radius: var(--raio-cartao-pequeno);
  background: var(--superficie);
}

.drawer__atalho {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  padding: 0 12px 0 10px;
  border: 0;
  background: transparent;
  color: var(--tinta);
  cursor: pointer;
  font: inherit;
  font-size: 14px;
  font-weight: 550;
  text-align: left;
  transition: background-color var(--pj-tempo-curto) var(--pj-curva-chega);
}

.drawer__atalho + .drawer__atalho {
  border-top: 1px solid var(--linha-suave);
}

.drawer__atalho:hover {
  background: var(--superficie-2);
}

.drawer__atalho:focus-visible {
  outline: 2px solid var(--clinica);
  outline-offset: -2px;
}

.drawer__atalho-texto {
  flex: 1;
  min-width: 0;
}

.drawer__seta {
  color: var(--tinta-3);
  font-size: 15px;
  transition: transform var(--pj-tempo-curto) var(--pj-curva-chega);
}

.drawer__atalho:hover .drawer__seta {
  color: var(--tinta);
  transform: translateX(2px);
}

/* As ações que desfazem o dia ficam no pé, separadas: longe do clique da ação principal. */
.drawer__risco {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 4px;
  padding: 10px 12px;
  border-top: 1px solid var(--linha-suave);
  background: color-mix(in oklab, var(--superficie-2) 60%, var(--superficie));
}

@media (max-width: 1100px) {
  .drawer {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .drawer__atalho,
  .drawer__seta {
    transition: none;
  }
}
</style>
