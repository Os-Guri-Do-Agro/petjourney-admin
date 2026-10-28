<script setup lang="ts">
/**
 * Agenda da clínica.
 *
 * A página traduz o estado do store nas props do `UiPagina` (carregando, erro). O dia vazio não é
 * estado da página: a barra com a semana continua de pé — sem ela não haveria como ir para o dia
 * seguinte — e o vazio aparece no lugar da grade, com o botão de marcar.
 *
 * O estado de visualização mora na URL (`useAgendaUrlState`): recarregar devolve exatamente a
 * mesma visão, e o link que a recepção manda para o veterinário abre onde deveria.
 */
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import UiPagina from '@/components/ui/UiPagina.vue'
import ClinicShortcutsDialog from '@/features/clinico/components/base/ClinicShortcutsDialog.vue'
import AgendaAppointmentDrawer from '@/features/clinico/components/agenda/AgendaAppointmentDrawer.vue'
import AgendaCancelDialog from '@/features/clinico/components/agenda/AgendaCancelDialog.vue'
import AgendaDayGrid from '@/features/clinico/components/agenda/AgendaDayGrid.vue'
import AgendaTabelaDia from '@/features/clinico/components/agenda/AgendaTabelaDia.vue'
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
import { agendaRepository, type EntradaDeJustificativa } from '@/features/clinico/data/repositories'
import type {
  Appointment,
  AppointmentStatus,
  CanalDeContato,
  CancelReason,
  MotivoDeFalta,
  SlotSugestao,
} from '@/features/clinico/data/types'
import { ocupaHorario } from '@/features/clinico/domain/conflicts'
import { motivoEncerraOCaso } from '@/features/clinico/domain/faltas'
import { useAgendaStore } from '@/features/clinico/stores/agenda'
import { useAvisosStore } from '@/features/clinico/stores/avisos'
import { clinicClock, useClinicoStore } from '@/features/clinico/stores/clinico'
import { useFilaStore } from '@/features/clinico/stores/fila'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const agenda = useAgendaStore()
const toast = useToast()
const clinico = useClinicoStore()
const fila = useFilaStore()
const avisos = useAvisosStore()
const formato = useClinicFormat()
const { alternarDensidade, formatoDaAgenda } = useClinicPrefs()

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

/*
 * Erro de **carga** toma o lugar da grade; erro de **salvar** não. Antes os dois iam para o mesmo
 * estado da página: um "Agendar" que falhava trocava a agenda inteira por "Não foi possível
 * carregar", por trás do diálogo, e o diálogo continuava aberto sem dizer nada. O de salvar vira
 * aviso por cima de tudo (o toast fica acima da máscara do diálogo), e a grade continua lá.
 */
const ERRO_DE_SALVAR = 'clinico.erros.mutacao'

const erroTraduzido = computed(() =>
  agenda.erro && agenda.erro !== ERRO_DE_SALVAR ? t(agenda.erro) : '',
)

watch(
  () => agenda.erro,
  (erro) => {
    if (erro === ERRO_DE_SALVAR) {
      toast.add({ severity: 'error', summary: t(ERRO_DE_SALVAR), life: 6000 })
    }
  },
  { flush: 'sync' },
)

/**
 * A frase da saudação (redesenho de 30/09/2026): quantos atendimentos o dia aberto tem, e quantos
 * já esperam na recepção — a única conta que pede alguém levantar agora.
 */
const fraseDoDia = computed(() => {
  /*
   * A mesma conta da fita da semana logo abaixo (`ocupaHorario`: sem cancelado nem falta). Com
   * contas diferentes, a saudação dizia 38 e o dia escolhido na fita dizia 32.
   */
  const ativos = agenda.atendimentos.filter(ocupaHorario)

  if (ativos.length === 0) {
    return t('clinico.agenda.frase.vazio')
  }

  const total = t('clinico.agenda.frase.atendimentos', { total: ativos.length }, ativos.length)
  const naRecepcao = ativos.filter((item) => item.status === 'aguardando').length

  return naRecepcao > 0
    ? t('clinico.agenda.frase.comRecepcao', {
        atendimentos: total,
        recepcao: t('clinico.agenda.frase.naRecepcao', { total: naRecepcao }),
      })
    : total
})

/**
 * Dia fechado não é vazio: existe agenda possível ali, só não deveria haver. O vazio aparece no
 * lugar da grade; o aviso de clínica fechada é conteúdo, não estado.
 */
const vazio = computed(() => agenda.visao === 'dia' && agenda.vazio && !agenda.clinicaFechada)

/** A frase entra depois da data e dos dois-pontos: começa em minúscula, como no meio de uma frase. */
function minusculaInicial(texto: string) {
  return texto.charAt(0).toLocaleLowerCase() + texto.slice(1)
}

/** Dia sem expediente que não é feriado (domingo, folga da casa): a grade fica, com o aviso. */
const semExpediente = computed(
  () => agenda.visao === 'dia' && agenda.clinicaFechada && !feriado.value?.fechado,
)

async function carregar() {
  await clinico.carregar()
  await agenda.recarregar()
}

onMounted(carregar)

watch(
  () => [agenda.data, agenda.visao],
  () => void agenda.recarregar(),
)
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

function confirmarPresenca() {
  if (!selecionado.value) {
    return
  }

  void agenda.confirmarPresenca(selecionado.value.id)
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

const criarPaciente = ref<string | null>(null)
const criarTipo = ref<string | null>(null)

function abrirCriacao(
  encaixe: boolean,
  alvo?: { professionalId: string; minuto: number },
  sugestao?: { petId: string | null; typeId: string | null },
) {
  ajudaAberta.value = false
  criarComoEncaixe.value = encaixe
  criarProfissional.value = alvo?.professionalId ?? null
  criarMinuto.value = alvo?.minuto ?? null
  criarPaciente.value = sugestao?.petId ?? null
  criarTipo.value = sugestao?.typeId ?? null
  criarAberto.value = true
}

function abrirBloqueio() {
  ajudaAberta.value = false
  bloquearAberto.value = true
}

/*
 * `?novo=1` é o pedido do "Criar → Agendamento" da barra lateral: abre o formulário e tira o
 * pedido da URL, para que voltar no navegador não abra o formulário de novo.
 */
watch(
  () => route.query.novo,
  async (novo) => {
    if (novo !== '1') {
      return
    }

    const paciente = typeof route.query.paciente === 'string' ? route.query.paciente : null
    const tipo = typeof route.query.tipo === 'string' ? route.query.tipo : null
    const query = { ...route.query }

    delete query.novo
    delete query.paciente
    delete query.tipo
    void router.replace({ path: route.path, query })

    /* O tipo chega pelo nome ("retorno"); o formulário quer o id, que vem do catálogo. */
    await clinico.carregar()

    abrirCriacao(false, undefined, {
      petId: paciente,
      typeId: tipo ? (clinico.tipos.find((item) => item.kind === tipo)?.id ?? null) : null,
    })
  },
  { immediate: true },
)

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
  <UiPagina
    :carregando="!agenda.dia && !agenda.erro"
    :erro="erroTraduzido"
    bloquear-se-suspenso
    @tentar-de-novo="carregar"
  >
    <template #resumo>
      <span class="agenda__data">{{ formato.dataLonga(agenda.data) }}</span>
      <template v-if="agenda.dia">{{ ': ' }}<span aria-live="polite">{{ minusculaInicial(fraseDoDia) }}</span></template>
    </template>

    <template #acoes>
      <Button
        type="button"
        icon="ph ph-calendar-plus"
        :label="t('clinico.agenda.novoAtendimento')"
        :title="`${t('clinico.agenda.novoAtendimento')} (N)`"
        @click="abrirCriacao(false)"
      />
    </template>

    <div class="agenda clinic-scope">
      <AgendaToolbar
        @encaixar="abrirCriacao(true)"
        @bloquear="abrirBloqueio"
        @ajuda="ajudaAberta = true"
      />

      <p v-if="semExpediente" class="agenda__fechada ui-folha" role="status">
        <span class="ui-ladrilho ui-ladrilho--neutro" aria-hidden="true">
          <i class="ph ph-moon" />
        </span>
        <span>{{ t('clinico.agenda.semExpediente') }}</span>
      </p>

      <p v-if="feriado?.fechado" class="agenda__fechada ui-folha" role="status">
        <span class="ui-ladrilho ui-ladrilho--atencao" aria-hidden="true">
          <i class="ph ph-calendar-x" />
        </span>
        <span>
          <strong>{{ t('clinico.agenda.fechadaTitulo') }}</strong>
          {{ t('clinico.agenda.fechadaDescricao', { feriado: feriado.nome }) }}
        </span>
      </p>

      <!-- Vaga que acabou de abrir: a oferta nasce onde a vaga nasceu. -->
      <section v-if="fila.vagaAberta" class="vaga ui-folha" role="status">
        <span class="ui-ladrilho ui-ladrilho--ok" aria-hidden="true">
          <i class="ph ph-calendar-plus" />
        </span>
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
            @click="
              fila.ofertar(candidato.id, fila.vagaAberta!.inicio, fila.vagaAberta!.professionalId)
            "
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

      <div v-if="vazio" class="agenda__vazio ui-folha">
        <span class="ui-ladrilho ui-ladrilho--g" aria-hidden="true">
          <i class="ph ph-calendar-blank" />
        </span>
        <h2>{{ t('clinico.agenda.vazioTitulo') }}</h2>
        <p>{{ t('clinico.agenda.vazioDescricao') }}</p>
        <Button
          type="button"
          icon="ph ph-calendar-plus"
          :label="t('clinico.agenda.novoAtendimento')"
          @click="abrirCriacao(false)"
        />
      </div>

      <div v-else-if="agenda.visao !== 'semana'" class="agenda__corpo">
        <!-- A tabela é o padrão: aguenta o dia cheio. A linha do tempo fica no menu Exibição. -->
        <AgendaTabelaDia
          v-if="formatoDaAgenda === 'tabela'"
          @abrir="abrir"
          @propor="propostaDeMovimento = $event"
          @marcar-falta="marcarFalta"
          @criar-em="abrirCriacao(false, $event)"
        />
        <AgendaDayGrid
          v-else
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
          @confirmar-presenca="confirmarPresenca"
        />
      </div>
    </div>

    <template #sempre>
    <AgendaCriarDialog
      v-model:visivel="criarAberto"
      :encaixe="criarComoEncaixe"
      :data="agenda.data"
      :sugestao-profissional="criarProfissional"
      :minuto-inicial="criarMinuto"
      :sugestao-paciente="criarPaciente"
      :sugestao-tipo="criarTipo"
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
    </template>
  </UiPagina>
</template>

<style scoped>
.agenda {
  display: grid;
  gap: 16px;
}

.agenda__data {
  display: inline-block;
}

.agenda__data::first-letter {
  text-transform: uppercase;
}

/*
 * A grade ocupa a altura que sobra da janela e rola por dentro: a semana, as abas e o título
 * ficam à vista enquanto se percorre a tarde.
 */
.agenda__corpo {
  /* A janela menos o que fica acima da grade (título, abas, semana, legenda) e a moldura. */
  --altura-da-grade: max(28rem, calc(100dvh - 22.75rem));

  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 16px;
  min-height: var(--altura-da-grade);
}

.agenda__corpo > :first-child {
  height: var(--altura-da-grade);
}

.agenda__vazio {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 56px 24px;
  text-align: center;
}

.agenda__vazio h2 {
  margin: 8px 0 0;
  font-size: 18px;
  font-weight: 600;
}

.agenda__vazio p {
  max-width: 46ch;
  margin: 0 0 12px;
  color: var(--tinta-2);
  line-height: 1.5;
}

/* Dia sem expediente ou feriado: um cartão baixo, com o ladrilho dizendo o tom. */
.agenda__fechada {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 0;
  padding: 12px 18px 12px 14px;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.5;
}

.agenda__fechada strong {
  margin-inline-end: 4px;
  font-weight: 650;
}

/*
 * A vaga que acabou de abrir: um cartão de estado — o alto tingido do verde do "ok" descendo para
 * o papel, como a Recepção do Hoje. A oferta nasce onde a vaga nasceu.
 */
.vaga {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
  padding: 14px 18px 14px 14px;
  background: linear-gradient(
    180deg,
    color-mix(in oklab, var(--ok-fundo) 70%, var(--superficie)),
    var(--superficie)
  );
}

.vaga__texto {
  flex: 1 1 22rem;
  min-width: 0;
}

.vaga__texto strong {
  color: var(--tinta);
  font-size: 15.5px;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.vaga__texto p {
  margin: 2px 0 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.45;
}

.vaga__acoes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

@media (max-width: 1100px) {
  .agenda__corpo {
    --altura-da-grade: min(64vh, 36rem);

    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
