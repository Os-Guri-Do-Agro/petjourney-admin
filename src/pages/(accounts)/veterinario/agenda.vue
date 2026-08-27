<script setup lang="ts">
/**
 * Agenda da clínica.
 *
 * A página traduz o estado do store nas props do `PartnerPageFrame` e não escreve estado de
 * carga próprio — carregando, erro e vazio já vêm resolvidos pelo shell do portal.
 *
 * O estado de visualização mora na URL (`useAgendaUrlState`): recarregar devolve exatamente a
 * mesma visão, e o link que a recepção manda para o veterinário abre onde deveria.
 */
import Button from 'primevue/button'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import ClinicShortcutsDialog from '@/features/clinico/components/base/ClinicShortcutsDialog.vue'
import AgendaAppointmentDrawer from '@/features/clinico/components/agenda/AgendaAppointmentDrawer.vue'
import AgendaCancelDialog from '@/features/clinico/components/agenda/AgendaCancelDialog.vue'
import AgendaDayGrid from '@/features/clinico/components/agenda/AgendaDayGrid.vue'
import AgendaMoveDialog from '@/features/clinico/components/agenda/AgendaMoveDialog.vue'
import AgendaBloquearDialog from '@/features/clinico/components/agenda/AgendaBloquearDialog.vue'
import AgendaCriarDialog from '@/features/clinico/components/agenda/AgendaCriarDialog.vue'
import AgendaToolbar from '@/features/clinico/components/agenda/AgendaToolbar.vue'
import AgendaUndoBar from '@/features/clinico/components/agenda/AgendaUndoBar.vue'
import AgendaWeekView from '@/features/clinico/components/agenda/AgendaWeekView.vue'
import ClinicDevPanel from '@/features/clinico/components/base/ClinicDevPanel.vue'
import type { ArrasteProposta } from '@/features/clinico/composables/useAgendaDrag'
import { useAgendaUrlState } from '@/features/clinico/composables/useAgendaUrlState'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import { useClinicPrefs } from '@/features/clinico/composables/useClinicPrefs'
import { useClinicShortcuts } from '@/features/clinico/composables/useClinicShortcuts'
import type { Appointment, AppointmentStatus, CancelReason } from '@/features/clinico/data/types'
import { useAgendaStore } from '@/features/clinico/stores/agenda'
import { useClinicoStore } from '@/features/clinico/stores/clinico'
import { useFilaStore } from '@/features/clinico/stores/fila'

const { t } = useI18n()
const router = useRouter()
const agenda = useAgendaStore()
const clinico = useClinicoStore()
const fila = useFilaStore()
const formato = useClinicFormat()
const { alternarDensidade } = useClinicPrefs()

useAgendaUrlState()

const propostaDeMovimento = ref<ArrasteProposta | null>(null)
const atendimentoParaCancelar = ref<string | null>(null)
const ajudaAberta = ref(false)

const selecionado = computed(
  () => agenda.atendimentos.find((item) => item.id === agenda.focoId) ?? null,
)

const paraCancelar = computed(
  () => agenda.atendimentos.find((item) => item.id === atendimentoParaCancelar.value) ?? null,
)

const feriado = computed(() => agenda.dia?.feriado ?? null)

const erroTraduzido = computed(() => (agenda.erro ? t(agenda.erro) : ''))

/**
 * Dia fechado não é vazio: existe agenda possível ali, só não deveria haver. O frame mostra o
 * estado vazio quando não há nada; o aviso de clínica fechada é conteúdo, não estado.
 */
const vazio = computed(
  () => agenda.visao === 'dia' && agenda.vazio && !agenda.clinicaFechada,
)

async function carregar() {
  await clinico.carregar()
  await agenda.recarregar()
}

onMounted(carregar)

watch(() => [agenda.data, agenda.visao], () => void agenda.recarregar())
watch(
  () => clinico.revisao,
  () => {
    /** Alguém invalidou tudo: a semana também precisa voltar a bater com o dia. */
    if (agenda.visao === 'semana') {
      void agenda.carregarSemana()
    }
  },
)

function abrir(appointmentId: string) {
  agenda.focoId = appointmentId
}

function fecharDrawer() {
  agenda.focoId = null
}

async function confirmarMovimento(proposta: ArrasteProposta) {
  await agenda.mover(proposta.appointment.id, {
    inicio: proposta.inicio,
    fim: proposta.fim,
    professionalId: proposta.professionalId,
  })
  propostaDeMovimento.value = null
}

/**
 * Cancelar e marcar falta liberam o horário. É aqui que a fila entra: sem este aviso, a vaga
 * volta a existir e ninguém fica sabendo — que é a forma mais silenciosa de a fila de espera
 * virar decoração.
 */
async function avisarFilaDaVaga(appointment: Appointment) {
  await fila.aoLiberarHorario(appointment.inicio, appointment.professionalId)
}

async function alterarStatus(status: AppointmentStatus) {
  const appointment = selecionado.value

  if (!appointment) {
    return
  }

  await agenda.alterarStatus(appointment.id, status)

  if (status === 'falta') {
    await avisarFilaDaVaga(appointment)
  }
}

async function confirmarCancelamento(motivo: CancelReason) {
  const appointment = paraCancelar.value

  if (!appointment) {
    return
  }

  await agenda.cancelar(appointment.id, motivo)
  atendimentoParaCancelar.value = null
  await avisarFilaDaVaga(appointment)
}

function abrirProntuario() {
  const appointment = selecionado.value

  if (!appointment) {
    return
  }

  void router.push(
    appointment.encounterId
      ? `/veterinario/atendimento/${appointment.encounterId}`
      : `/veterinario/atendimento/novo-${appointment.id}`,
  )
}

function verHistorico() {
  if (!selecionado.value) {
    return
  }

  void router.push(`/veterinario/paciente/${selecionado.value.petId}/historico`)
}

/**
 * Criação e bloqueio compartilham o mesmo caminho: fecham a ajuda e abrem o diálogo.
 *
 * "Encaixar" é o formulário de criação com a marca ligada — encaixe não é outro tipo de
 * agendamento, é o mesmo agendamento assumindo que vai passar por cima da carga do dia.
 */
const criarAberto = ref(false)
const criarComoEncaixe = ref(false)
const bloquearAberto = ref(false)

/**
 * Clicar numa faixa livre da grade abre o formulário **já naquele profissional e naquela hora**.
 * É o caminho que a recepção usa de verdade: o horário é escolhido olhando o buraco na agenda,
 * não digitado num campo depois.
 */
const criarProfissional = ref<string | null>(null)
const criarMinuto = ref<number | null>(null)

function abrirCriacao(encaixe: boolean, alvo?: { professionalId: string; minuto: number }) {
  ajudaAberta.value = false
  criarComoEncaixe.value = encaixe
  criarProfissional.value = alvo?.professionalId ?? null
  criarMinuto.value = alvo?.minuto ?? null
  criarAberto.value = true
}

function abrirBloqueio() {
  ajudaAberta.value = false
  bloquearAberto.value = true
}

useClinicShortcuts({
  visaoDia: () => {
    agenda.visao = 'dia'
  },
  visaoSemana: () => {
    agenda.visao = 'semana'
  },
  agruparProfissional: () => {
    agenda.agrupamento = 'profissional'
  },
  agruparSala: () => {
    agenda.agrupamento = 'sala'
  },
  hoje: () => agenda.hoje(),
  diaAnterior: () => agenda.avancar(-1),
  proximoDia: () => agenda.avancar(1),
  semanaAnterior: () => agenda.avancar(-7),
  proximaSemana: () => agenda.avancar(7),
  densidade: alternarDensidade,
  desfazer: () => void agenda.desfazerUltima(),
  ajuda: () => {
    ajudaAberta.value = !ajudaAberta.value
  },
  novo: () => abrirCriacao(false),
  encaixar: () => abrirCriacao(true),
  bloquear: abrirBloqueio,
  fechar: () => {
    if (propostaDeMovimento.value) {
      propostaDeMovimento.value = null

      return
    }

    if (atendimentoParaCancelar.value) {
      atendimentoParaCancelar.value = null

      return
    }

    if (ajudaAberta.value) {
      ajudaAberta.value = false

      return
    }

    fecharDrawer()
  },
})
</script>

<template>
  <PartnerPageFrame
    :subtitle="t('clinico.agenda.subtitulo')"
    :title="t('clinico.agenda.titulo')"
    :loading="agenda.carregando && !agenda.dia"
    :error="erroTraduzido"
    :empty="vazio"
    :empty-title="t('clinico.agenda.vazioTitulo')"
    :empty-description="t('clinico.agenda.vazioDescricao')"
    :empty-action-label="t('clinico.agenda.novoAtendimento')"
    block-when-suspended
    @retry="carregar"
    @empty-action="abrirCriacao(false)"
  >
    <div class="agenda clinic-scope">
      <AgendaToolbar
        @novo="abrirCriacao(false)"
        @encaixar="abrirCriacao(true)"
        @bloquear="abrirBloqueio"
        @ajuda="ajudaAberta = true"
      />

      <p v-if="feriado?.fechado" class="agenda__fechada" role="status">
        <i class="pi pi-calendar-times" aria-hidden="true" />
        <span>
          <strong>{{ t('clinico.agenda.fechadaTitulo') }}</strong>
          {{ t('clinico.agenda.fechadaDescricao', { feriado: feriado.nome }) }}
        </span>
      </p>

      <!-- Vaga que acabou de abrir: a oferta nasce onde a vaga nasceu. -->
      <section v-if="fila.vagaAberta" class="vaga" role="status">
        <div class="vaga__texto">
          <strong>{{ t('clinico.fila.vagaAberta.titulo') }}</strong>
          <p>
            {{
              t('clinico.fila.vagaAberta.descricao', {
                hora: formato.hora(fila.vagaAberta.inicio),
                profissional: clinico.profissional(fila.vagaAberta.professionalId)?.nome ?? '',
              })
            }}
          </p>
        </div>

        <div class="vaga__acoes">
          <Button
            v-for="candidato in fila.vagaAberta.candidatos"
            :key="candidato.id"
            :label="
              t('clinico.fila.vagaAberta.oferecer', {
                paciente: clinico.pet(candidato.petId)?.nome ?? '',
              })
            "
            size="small"
            :loading="fila.salvando"
            @click="fila.ofertar(candidato.id, fila.vagaAberta!.inicio)"
          />
          <Button
            :label="t('clinico.fila.vagaAberta.depois')"
            size="small"
            severity="secondary"
            text
            @click="fila.dispensarVaga()"
          />
        </div>
      </section>

      <AgendaWeekView
        v-if="agenda.visao === 'semana'"
        @escolher-dia="
          (data) => {
            agenda.irPara(data)
            agenda.visao = 'dia'
          }
        "
      />

      <div v-else class="agenda__corpo">
        <AgendaDayGrid
          @abrir="abrir"
          @propor="propostaDeMovimento = $event"
          @criar-em="abrirCriacao(false, $event)"
        />

        <AgendaAppointmentDrawer
          :appointment="selecionado"
          @fechar="fecharDrawer"
          @alterar-status="alterarStatus"
          @cancelar="atendimentoParaCancelar = selecionado?.id ?? null"
          @abrir-prontuario="abrirProntuario"
          @ver-historico="verHistorico"
        />
      </div>
    </div>

    <AgendaCriarDialog
      v-model:visivel="criarAberto"
      :encaixe="criarComoEncaixe"
      :data="agenda.data"
      :sugestao-profissional="criarProfissional"
      :minuto-inicial="criarMinuto"
      @criado="agenda.recarregar()"
    />

    <AgendaBloquearDialog
      v-model:visivel="bloquearAberto"
      :data="agenda.data"
      @criado="agenda.recarregar()"
    />

    <AgendaMoveDialog
      :proposta="propostaDeMovimento"
      @confirmar="confirmarMovimento"
      @fechar="propostaDeMovimento = null"
    />

    <AgendaCancelDialog
      :appointment="paraCancelar"
      @confirmar="confirmarCancelamento"
      @fechar="atendimentoParaCancelar = null"
    />

    <ClinicShortcutsDialog v-model:visible="ajudaAberta" />
    <AgendaUndoBar />
    <ClinicDevPanel />
  </PartnerPageFrame>
</template>

<style scoped>
.agenda {
  display: grid;
  gap: var(--clinic-space-3);
}

.agenda__corpo {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: var(--clinic-space-3);
  /* A grade ocupa a altura útil da janela e rola por dentro; a página não rola junto. */
  min-height: min(70vh, 44rem);
}

.agenda__corpo > :first-child {
  height: min(70vh, 44rem);
}

.agenda__fechada {
  display: flex;
  align-items: flex-start;
  gap: var(--clinic-space-2);
  margin: 0;
  padding: var(--clinic-space-3) var(--clinic-space-4);
  border: 1px solid var(--clinic-attention-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-attention-bg);
  color: var(--clinic-attention-text);
  line-height: 1.5;
}

.agenda__fechada strong {
  margin-right: 0.3rem;
}

.vaga {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-3) var(--clinic-space-4);
  border: 1px solid var(--clinic-accent);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-accent-tint);
}

.vaga__texto strong {
  font-weight: 750;
}

.vaga__texto p {
  margin: 0.15rem 0 0;
  color: var(--clinic-muted);
  line-height: 1.45;
}

.vaga__acoes {
  display: flex;
  flex-wrap: wrap;
  gap: var(--clinic-space-2);
}

@media (max-width: 1100px) {
  .agenda__corpo {
    grid-template-columns: minmax(0, 1fr);
  }

  .agenda__corpo > :first-child {
    height: min(60vh, 34rem);
  }
}
</style>
