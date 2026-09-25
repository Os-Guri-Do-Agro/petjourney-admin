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
import AgendaEditarDialog from '@/features/clinico/components/agenda/AgendaEditarDialog.vue'
import AgendaFaltaDialog from '@/features/clinico/components/agenda/AgendaFaltaDialog.vue'
import AgendaLegenda from '@/features/clinico/components/agenda/AgendaLegenda.vue'
import AgendaMoveDialog from '@/features/clinico/components/agenda/AgendaMoveDialog.vue'
import AgendaReagendarDialog from '@/features/clinico/components/agenda/AgendaReagendarDialog.vue'
import FilaAdicionarDialog from '@/features/clinico/components/agenda/FilaAdicionarDialog.vue'
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
import {
  agendaRepository,
  type EntradaDeJustificativa,
} from '@/features/clinico/data/repositories'
import type {
  Appointment,
  AppointmentStatus,
  CanalDeContato,
  CancelReason,
  MotivoDeFalta,
  SlotSugestao,
} from '@/features/clinico/data/types'
import { motivoEncerraOCaso } from '@/features/clinico/domain/faltas'
import { useAgendaStore } from '@/features/clinico/stores/agenda'
import { useAvisosStore } from '@/features/clinico/stores/avisos'
import { clinicClock, useClinicoStore } from '@/features/clinico/stores/clinico'
import { useFilaStore } from '@/features/clinico/stores/fila'

const { t } = useI18n()
const router = useRouter()
const agenda = useAgendaStore()
const clinico = useClinicoStore()
const fila = useFilaStore()
const avisos = useAvisosStore()
const formato = useClinicFormat()
const { alternarDensidade } = useClinicPrefs()

useAgendaUrlState()

const propostaDeMovimento = ref<ArrasteProposta | null>(null)
const atendimentoParaCancelar = ref<string | null>(null)
const atendimentoParaFaltar = ref<string | null>(null)
const atendimentoParaEditar = ref<string | null>(null)
const ajudaAberta = ref(false)

const selecionado = computed(
  () => agenda.atendimentos.find((item) => item.id === agenda.focoId) ?? null,
)

const paraCancelar = computed(
  () => agenda.atendimentos.find((item) => item.id === atendimentoParaCancelar.value) ?? null,
)

const paraFaltar = computed(
  () => agenda.atendimentos.find((item) => item.id === atendimentoParaFaltar.value) ?? null,
)

/** O responsável do atendimento em falta — é o telefone que o diálogo oferece. */
const tutorDaFalta = computed(() =>
  paraFaltar.value ? (clinico.tutor(paraFaltar.value.tutorId) ?? null) : null,
)

const paraEditar = computed(
  () => agenda.atendimentos.find((item) => item.id === atendimentoParaEditar.value) ?? null,
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

/**
 * Salva a edição — e registra o aviso **só quando houve o que avisar**.
 *
 * A caixa já decide isso e manda a mensagem vazia quando a mudança é interna (tipo, sala,
 * observação). Aqui o comprovante entra como `remarcacao`, que é o que a mudança significa do
 * lado de fora: quem recebeu a ligação não distingue "editaram o horário" de "remarcaram".
 */
async function salvarEdicao(
  dados: {
    typeId: string
    professionalId: string
    roomIds: string[]
    inicio: string
    fim: string
    observacao: string
  },
  mensagem: string,
) {
  const appointment = paraEditar.value

  if (!appointment) {
    return
  }

  await agenda.editar(appointment.id, dados)

  if (mensagem.trim()) {
    avisos.registrar({
      appointmentId: appointment.id,
      tutorId: appointment.tutorId,
      kind: 'remarcacao',
      texto: mensagem,
    })
  }

  atendimentoParaEditar.value = null
}

async function confirmarMovimento(proposta: ArrasteProposta, mensagem: string) {
  await agenda.mover(proposta.appointment.id, {
    inicio: proposta.inicio,
    fim: proposta.fim,
    professionalId: proposta.professionalId,
    roomIds: proposta.roomIds,
  })

  /*
   * O texto que a caixa mostrou não pode morrer com ela: é o comprovante de que o responsável
   * foi avisado, e é o que a recepção consulta quando alguém liga dizendo que não sabia.
   */
  if (mensagem.trim()) {
    avisos.registrar({
      appointmentId: proposta.appointment.id,
      tutorId: proposta.appointment.tutorId,
      kind: 'remarcacao',
      texto: mensagem,
    })
  }

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

/**
 * Marcar falta, venha de onde vier — e o motivo vem antes do status.
 *
 * O card e o drawer chamam o mesmo caminho. A ordem inverteu de propósito: antes a falta era
 * gravada no clique e a tela seguia direto para o reagendamento, então o motivo nunca era
 * perguntado e o painel de faltas herdava uma lista em que ninguém sabia por que ninguém veio.
 * Agora o clique abre a justificativa — que é onde está o telefone do responsável — e o status
 * só muda quando a recepção decide entre registrar o motivo e deixar para depois.
 *
 * As duas saídas do diálogo terminam nas mesmas três consequências: o status muda, a fila é
 * avisada de que um horário vagou, e **o reagendamento é oferecido na hora**. Oferecer depois é
 * não oferecer: quem marca falta às três da tarde não volta à lista às seis para lembrar de
 * ligar. O que muda é só a falta nascer com motivo ou entrar na fila de pendências do painel.
 */
function marcarFalta(appointmentId: string) {
  const appointment = agenda.atendimentos.find((item) => item.id === appointmentId)

  if (!appointment) {
    return
  }

  atendimentoParaFaltar.value = appointmentId
}

/**
 * O que acontece depois da falta — e o que **não** acontece quando o paciente morreu.
 *
 * A vaga continua sendo oferecida à fila nos dois casos: o horário vagou de fato, e a oferta vai
 * para outra pessoa. O que some é a proposta de remarcação, que iria para o responsável do
 * animal que acabou de morrer. Ela é aberta automaticamente logo depois da falta justamente para
 * não depender de ninguém lembrar — e é por isso que o caso precisa ser tratado aqui, e não
 * confiado a quem estiver com a tela aberta.
 */
async function concluirFalta(
  appointment: Appointment,
  justificativa: EntradaDeJustificativa | null,
) {
  await agenda.alterarStatus(appointment.id, 'falta', justificativa)
  atendimentoParaFaltar.value = null
  await avisarFilaDaVaga(appointment)

  if (justificativa && motivoEncerraOCaso(justificativa.motivo)) {
    return
  }

  abrirReagendamento(appointment)
}

async function registrarFalta(entrada: {
  motivo: MotivoDeFalta
  canal: CanalDeContato
  observacao: string
}) {
  const appointment = paraFaltar.value

  if (!appointment) {
    return
  }

  await concluirFalta(appointment, {
    ...entrada,
    /* Quem registra é quem está com a agenda aberta — na API real, o usuário da sessão. */
    professionalId: appointment.professionalId,
  })
}

async function adiarJustificativa() {
  const appointment = paraFaltar.value

  if (appointment) {
    await concluirFalta(appointment, null)
  }
}

async function alterarStatus(status: AppointmentStatus) {
  const appointment = selecionado.value

  if (!appointment) {
    return
  }

  if (status === 'falta') {
    await marcarFalta(appointment.id)

    return
  }

  await agenda.alterarStatus(appointment.id, status)
}

// ----------------------------------------------------------------- reagendamento

const faltaParaReagendar = ref<Appointment | null>(null)
const sugestoesDeReagendamento = ref<SlotSugestao[]>([])
const buscandoReagendamento = ref(false)

function abrirReagendamento(appointment: Appointment) {
  faltaParaReagendar.value = appointment
  sugestoesDeReagendamento.value = []
  buscandoReagendamento.value = true

  void agendaRepository
    .sugerirReagendamento({
      petId: appointment.petId,
      professionalId: appointment.professionalId,
      typeId: appointment.typeId,
      aPartirDe: clinicClock.dateOf(appointment.inicio),
    })
    .then((sugestoes) => {
      sugestoesDeReagendamento.value = sugestoes
    })
    .catch(() => {
      sugestoesDeReagendamento.value = []
    })
    .finally(() => {
      buscandoReagendamento.value = false
    })
}

async function confirmarReagendamento({
  slot,
  mensagem,
}: {
  slot: SlotSugestao
  mensagem: string
}) {
  const falta = faltaParaReagendar.value

  if (!falta) {
    return
  }

  const criado = await agenda.criar({
    petId: falta.petId,
    tutorId: falta.tutorId,
    professionalId: slot.professionalId,
    roomIds: falta.roomIds,
    typeId: falta.typeId,
    inicio: slot.inicio,
    fim: slot.fim,
    encaixe: false,
    observacao: '',
    origem: 'recepcao',
  })

  if (criado) {
    /* O aviso ao responsável fica registrado no atendimento novo, não se perde no diálogo. */
    avisos.registrar({
      appointmentId: criado.id,
      kind: 'reagendamento',
      texto: mensagem,
      tutorId: falta.tutorId,
    })
    faltaParaReagendar.value = null
  }
}

async function confirmarCancelamento(motivo: CancelReason) {
  const appointment = paraCancelar.value

  if (!appointment) {
    return
  }

  await agenda.cancelar(appointment.id, motivo)
  avisos.registrar({
    appointmentId: appointment.id,
    tutorId: appointment.tutorId,
    kind: 'cancelamento',
    texto: t('clinico.agenda.cancelarDialogo.aviso', {
      paciente: clinico.pet(appointment.petId)?.nome ?? '',
      motivo: t(`clinico.cancelamento.${motivo}`),
    }),
  })
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

function verResumo() {
  if (!selecionado.value) {
    return
  }

  void router.push(`/veterinario/paciente/${selecionado.value.petId}/resumo`)
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
/**
 * Entrada na fila a partir da criação sem horário.
 *
 * Fecha o diálogo de agendamento e abre o da fila **já com o que foi digitado** — repetir
 * paciente e tipo seria cobrar duas vezes a mesma informação, no meio de uma ligação.
 */
const filaAberta = ref(false)
const filaPet = ref<string | null>(null)
const filaTipo = ref<string | null>(null)
const filaProfissional = ref<string | null>(null)

function abrirEntradaNaFila(sugestao: {
  petId: string | null
  typeId: string | null
  professionalId: string | null
}) {
  criarAberto.value = false
  filaPet.value = sugestao.petId
  filaTipo.value = sugestao.typeId
  filaProfissional.value = sugestao.professionalId
  filaAberta.value = true
}

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

    if (atendimentoParaFaltar.value) {
      atendimentoParaFaltar.value = null

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

      <!--
        A legenda fica **acima** da grade e fora dela: dentro, rolaria junto e sumiria assim
        que alguém descesse até a tarde — que é exatamente quando a grade fica cheia e a chave
        de leitura passa a fazer falta.
      -->
      <AgendaLegenda v-if="agenda.visao === 'dia' && !agenda.clinicaFechada" />

      <div v-if="agenda.visao !== 'semana'" class="agenda__corpo">
        <AgendaDayGrid
          @abrir="abrir"
          @propor="propostaDeMovimento = $event"
          @marcar-falta="marcarFalta"
          @criar-em="abrirCriacao(false, $event)"
        />

        <AgendaAppointmentDrawer
          :appointment="selecionado"
          @fechar="fecharDrawer"
          @editar="atendimentoParaEditar = selecionado?.id ?? null"
          @alterar-status="alterarStatus"
          @cancelar="atendimentoParaCancelar = selecionado?.id ?? null"
          @abrir-prontuario="abrirProntuario"
          @ver-historico="verHistorico"
          @ver-resumo="verResumo"
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
      @entrar-na-fila="abrirEntradaNaFila"
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

    <AgendaEditarDialog
      :appointment="paraEditar"
      @salvar="salvarEdicao"
      @fechar="atendimentoParaEditar = null"
    />

    <AgendaCancelDialog
      :appointment="paraCancelar"
      @confirmar="confirmarCancelamento"
      @fechar="atendimentoParaCancelar = null"
    />

    <!--
      A justificativa vem **antes** de a falta ser gravada: é o diálogo que traz o telefone do
      responsável, e perguntar depois é não perguntar.
    -->
    <AgendaFaltaDialog
      :appointment="paraFaltar"
      :tutor="tutorDaFalta"
      :salvando="agenda.salvando"
      @confirmar="registrarFalta"
      @adiar="adiarJustificativa"
      @fechar="atendimentoParaFaltar = null"
    />

    <!--
      Reagendamento abre logo depois de marcar a falta — com o telefone do responsável à mão e
      horários já buscados. Oferecer depois é não oferecer.
    -->
    <AgendaReagendarDialog
      :appointment="faltaParaReagendar"
      :sugestoes="sugestoesDeReagendamento"
      :buscando="buscandoReagendamento"
      :salvando="agenda.salvando"
      @confirmar="confirmarReagendamento"
      @fechar="faltaParaReagendar = null"
    />

    <FilaAdicionarDialog
      v-model:visivel="filaAberta"
      :pet-id="filaPet"
      :type-id="filaTipo"
      :professional-id="filaProfissional"
      @adicionado="fila.carregar()"
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
  margin-inline-end: 0.3rem;
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
