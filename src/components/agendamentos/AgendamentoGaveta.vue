<script setup lang="ts">
/**
 * Um horário da agenda (E3-02, guia e3 2.7): o que é, os avisos do servidor e o que cabe fazer na
 * situação dele (`acoesDaSituacao`). Na mesma gaveta, em vez de abrir outra: editar (tipo, duração,
 * salas, observação, encaixe), mudar o horário (o arrastar de quem usa toque ou teclado) e cancelar
 * com o motivo.
 *
 * Toda ação manda a `versao` que a tela tem. Mudou no meio do caminho (409 `AGENDAMENTO_ALTERADO`):
 * a página relê o dia e a gaveta mostra o horário novo. Dia especial fechado ao mudar o horário:
 * o 409 `CONFLITO_BLOQUEANTE` pede o segundo passo.
 */
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import InputMask from 'primevue/inputmask'
import InputNumber from 'primevue/inputnumber'
import Menu from 'primevue/menu'
import type { MenuItem } from 'primevue/menuitem'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'

import { horaNoFuso, ordenarConflitos } from '@/components/agendamentos/leitura-da-agenda'
import { lerErroDaAgenda, useFrasesDaAgenda } from '@/components/agendamentos/useFrasesDaAgenda'
import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import PreConsultaDoHorario from '@/components/agendamentos/PreConsultaDoHorario.vue'
import FaltaDoHorario from '@/components/faltas/FaltaDoHorario.vue'
import JustificativaCampos from '@/components/faltas/JustificativaCampos.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  diaLocal,
  DURACAO_MAX,
  DURACAO_MIN,
  DURACAO_PASSO,
  instanteNoFuso,
  type Sala,
  type TipoDeAtendimento,
} from '@/service/parceiro/agenda-config-service'
import {
  acoesDaSituacao,
  agirNoAgendamento,
  cancelarAgendamento,
  editarAgendamento,
  moverAgendamento,
  MOTIVOS_DE_CANCELAMENTO,
  type Agendamento,
  type EdicaoDoAgendamento,
  type MotivoDoCancelamento,
  type Mutacao,
} from '@/service/parceiro/agenda-service'
import {
  justificativaParaEnviar,
  marcarFalta,
  problemaDaJustificativa,
  type NovaJustificativa,
  type Obito,
} from '@/service/parceiro/faltas-service'

const OBSERVACAO_MAX = 500

const props = defineProps<{
  agendamento: Agendamento | null
  fuso: string
  profissionais: { id: string; nome: string }[]
  salas: Sala[]
  tipos: TipoDeAtendimento[]
  podeEscrever: boolean
  /** O óbito encerra o caso e pede `paciente.escrever` (guia 3.1). */
  podeObito: boolean
  /** `AAAA-MM-DD` de hoje na clínica e o relógio da página (a falta só depois do início). */
  hoje: string
  relogio: Date
}>()
const emit = defineEmits<{
  mudou: [mutacao: Mutacao, texto: string]
  alterado: [mensagem: string]
  retorno: [agendamento: Agendamento]
  /** Contato registrado numa falta: a página relê. */
  justificado: [obito: Obito | null]
  obito: [obito: Obito]
}>()
const visible = defineModel<boolean>('visible', { default: false })

const { t } = useI18n()
const rotulos = useRotulosDoCadastro()
const frases = useFrasesDaAgenda()
const { store, parceiroQuery } = useParceiroPortal()
const router = useRouter()

/**
 * O atendimento do horário (E4-01): quem lê prontuário abre daqui; quem escreve nele cai direto no
 * atendimento depois do "Iniciar". A recepção inicia e fica na agenda.
 */
const leProntuario = computed(
  () => Boolean(store.modulo('CLINICA')?.podeLer) && store.temPermissao('prontuario.ler'),
)
const escreveProntuario = computed(
  () => leProntuario.value && store.temPermissao('prontuario.escrever'),
)

type Modo = 'ver' | 'editar' | 'mudar' | 'cancelar' | 'falta'

const modo = ref<Modo>('ver')
const enviando = ref<string | null>(null)
const erro = ref('')
const tentou = ref(false)

/* Outro horário aberto, ou a gaveta reaberta: volta ao começo. */
watch(
  () => [visible.value, props.agendamento?.id] as const,
  ([aberta]) => {
    if (!aberta) return
    modo.value = 'ver'
    erro.value = ''
    tentou.value = false
    bloqueante.value = null
    semContato.value = false
  },
)

const ag = computed(() => props.agendamento)
const acoes = computed(() =>
  ag.value && props.podeEscrever ? acoesDaSituacao(ag.value.status) : acoesDaSituacao('CANCELADO'),
)

/* ------------------------------------------------------------------------------- leitura */

function nomeDoProfissional(id: string) {
  return props.profissionais.find((item) => item.id === id)?.nome ?? ''
}

function nomeDoTipo(id: string) {
  return props.tipos.find((item) => item.id === id)?.nome ?? ''
}

const nomesDasSalas = computed(() =>
  (ag.value?.salaIds ?? [])
    .map((id) => props.salas.find((sala) => sala.id === id)?.nome)
    .filter(Boolean)
    .join(', '),
)

const avisos = computed(() => (ag.value ? ordenarConflitos(ag.value.conflitos) : []))

const ICONE_DO_AVISO = {
  blocking: 'ph ph-prohibit',
  warning: 'ph ph-warning',
  info: 'ph ph-info',
} as const

/** "06/11, 09:05" na parede da clínica. */
function momento(iso: string) {
  try {
    return new Intl.DateTimeFormat(rotulos.intl(), {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: props.fuso,
    }).format(new Date(iso))
  } catch {
    return horaNoFuso(iso, props.fuso)
  }
}

/** O que aconteceu com o horário, do mais antigo ao mais novo. */
const rastro = computed(() => {
  const atual = ag.value
  if (!atual) return []

  const linhas: { icone: string; texto: string }[] = [
    {
      icone: 'ph ph-calendar-plus',
      texto: t('agendamentos.rastro.criado', {
        quando: momento(atual.criadoEm),
        origem: t(`agendamentos.origem.${atual.origem}`),
      }),
    },
  ]
  if (atual.confirmadoEm) {
    linhas.push({
      icone: 'ph ph-check-circle',
      texto: t('agendamentos.rastro.confirmado', {
        quando: momento(atual.confirmadoEm),
        quem: t(`agendamentos.porQuem.${atual.confirmadoPor ?? 'RECEPCAO'}`),
      }),
    })
  }
  if (atual.chegadaEm) {
    linhas.push({
      icone: 'ph ph-hourglass-medium',
      texto: t('agendamentos.rastro.chegada', { quando: momento(atual.chegadaEm) }),
    })
  }
  if (atual.iniciadoEm) {
    linhas.push({
      icone: 'ph ph-stethoscope',
      texto: t('agendamentos.rastro.iniciado', { quando: momento(atual.iniciadoEm) }),
    })
  }
  if (atual.finalizadoEm) {
    linhas.push({
      icone: 'ph ph-check-square',
      texto: t('agendamentos.rastro.finalizado', { quando: momento(atual.finalizadoEm) }),
    })
  }
  if (atual.faltaEm) {
    linhas.push({
      icone: 'ph ph-user-minus',
      texto: t('agendamentos.rastro.falta', { quando: momento(atual.faltaEm) }),
    })
  }
  if (atual.canceladoEm) {
    linhas.push({
      icone: 'ph ph-x-circle',
      texto: t('agendamentos.rastro.cancelado', {
        quando: momento(atual.canceladoEm),
        quem: t(`agendamentos.porQuem.${atual.canceladoPor ?? 'RECEPCAO'}`),
        motivo: atual.motivoCancelamento
          ? t(`agendamentos.cancelar.motivos.${atual.motivoCancelamento}`)
          : '',
      }),
    })
  }

  return linhas
})

/* ------------------------------------------------------------------------------ escrever */

/**
 * O erro de uma escrita: versão velha ou situação que mudou fazem a página reler (a gaveta mostra o
 * horário novo); o resto é a mensagem da API, que já vem traduzida.
 */
function falhou(err: unknown) {
  const lido = lerErroDaAgenda(err, t('agendamentos.erros.salvar'))
  if (lido.codigo === 'AGENDAMENTO_ALTERADO') {
    modo.value = 'ver'
    emit('alterado', t('agendamentos.erros.alterado'))
    return
  }
  if (lido.codigo === 'AGENDAMENTO_STATUS_INVALIDO') {
    modo.value = 'ver'
    emit('alterado', lido.mensagem)
    return
  }
  erro.value = lido.mensagem
}

async function agir(acao: 'confirmar-presenca' | 'chegada' | 'iniciar') {
  const atual = ag.value
  if (!atual) return
  enviando.value = acao
  erro.value = ''

  try {
    const mutacao = await agirNoAgendamento(atual.id, acao, atual.versao, parceiroQuery())
    emit('mudou', mutacao, t(`agendamentos.feito.${acao}`))
    const atendimentoId = mutacao.agendamentos.find((item) => item.id === atual.id)?.atendimentoId
    if (acao === 'iniciar' && atendimentoId && escreveProntuario.value) {
      void router.push(`/clinica/atendimento/${atendimentoId}`)
    }
  } catch (err) {
    falhou(err)
  } finally {
    enviando.value = null
  }
}

/* ---------------------------------------------------------------------------- editar */

const tipoId = ref('')
const duracao = ref(30)
const salaIds = ref<string[]>([])
const observacao = ref('')
const encaixe = ref(false)

const opcoesDeTipo = computed(() =>
  props.tipos
    .filter((tipo) => tipo.ativo || tipo.id === ag.value?.tipoId)
    .map((tipo) => ({ valor: tipo.id, rotulo: tipo.nome })),
)

/* Sala desativada fica se já estava (guia 2.7); nova, só das ativas. */
const opcoesDeSala = computed(() =>
  props.salas
    .filter((sala) => sala.ativa || ag.value?.salaIds.includes(sala.id))
    .map((sala) => ({ valor: sala.id, rotulo: sala.nome })),
)

function abrirEdicao() {
  const atual = ag.value
  if (!atual) return
  tipoId.value = atual.tipoId
  duracao.value = atual.duracaoMinutos
  salaIds.value = [...atual.salaIds]
  observacao.value = atual.observacao ?? ''
  encaixe.value = atual.encaixe
  erro.value = ''
  tentou.value = false
  modo.value = 'editar'
}

/** Escolher outro tipo traz a duração dele: é o que a recepção espera. */
function trocarTipo(novo: string) {
  tipoId.value = novo
  const tipo = props.tipos.find((item) => item.id === novo)
  if (tipo) duracao.value = tipo.duracaoMinutos
}

const problemaDaEdicao = computed(() => {
  if (!salaIds.value.length) return t('agendamentos.editar.semSala')
  if (salaIds.value.length > 4) return t('agendamentos.editar.salasDemais')
  if (duracao.value < DURACAO_MIN || duracao.value > DURACAO_MAX)
    return t('agendamentos.editar.duracaoInvalida')
  return ''
})

async function salvarEdicao() {
  const atual = ag.value
  if (!atual) return
  tentou.value = true
  erro.value = ''
  if (problemaDaEdicao.value) return

  /* Só o que mudou: `observacao: null` apaga; o resto não aceita `null`. */
  const edicao: EdicaoDoAgendamento = { versao: atual.versao }
  if (tipoId.value !== atual.tipoId) edicao.tipoId = tipoId.value
  if (duracao.value !== atual.duracaoMinutos) edicao.duracaoMinutos = duracao.value
  if ([...salaIds.value].sort().join() !== [...atual.salaIds].sort().join())
    edicao.salaIds = salaIds.value
  const texto = observacao.value.trim()
  if (texto !== (atual.observacao ?? '')) edicao.observacao = texto || null
  if (encaixe.value !== atual.encaixe) edicao.encaixe = encaixe.value

  if (Object.keys(edicao).length === 1) {
    modo.value = 'ver'
    return
  }

  enviando.value = 'editar'
  try {
    const mutacao = await editarAgendamento(atual.id, edicao, parceiroQuery())
    modo.value = 'ver'
    emit('mudou', mutacao, t('agendamentos.feito.editar'))
  } catch (err) {
    falhou(err)
  } finally {
    enviando.value = null
  }
}

/* ----------------------------------------------------------------------------- mudar */

const novoDia = ref(new Date())
const novaHora = ref('09:00')
const novoProfissional = ref('')
const bloqueante = ref<string | null>(null)

function dataDe(iso: string) {
  const [ano, mes, dia] = iso.slice(0, 10).split('-').map(Number)
  return new Date(ano!, mes! - 1, dia!)
}

function abrirMudanca() {
  const atual = ag.value
  if (!atual) return
  novoDia.value = dataDe(atual.inicio)
  novaHora.value = atual.inicio.slice(11, 16)
  novoProfissional.value = atual.profissionalId
  bloqueante.value = null
  erro.value = ''
  tentou.value = false
  modo.value = 'mudar'
}

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/

async function salvarMudanca(confirmar = false) {
  const atual = ag.value
  if (!atual) return
  tentou.value = true
  erro.value = ''
  if (!HORA.test(novaHora.value)) return

  const inicio = instanteNoFuso(props.fuso, diaLocal(novoDia.value), novaHora.value)
  const outroProfissional = novoProfissional.value !== atual.profissionalId
  if (inicio.slice(0, 16) === atual.inicio.slice(0, 16) && !outroProfissional) {
    modo.value = 'ver'
    return
  }

  enviando.value = 'mudar'
  try {
    const mutacao = await moverAgendamento(
      atual.id,
      {
        inicio,
        versao: atual.versao,
        ...(outroProfissional ? { destino: { profissionalId: novoProfissional.value } } : {}),
        ...(confirmar ? { confirmarConflitos: ['holiday-closed' as const] } : {}),
      },
      parceiroQuery(),
    )
    modo.value = 'ver'
    bloqueante.value = null
    emit('mudou', mutacao, t('agendamentos.feito.mover'))
  } catch (err) {
    const lido = lerErroDaAgenda(err, t('agendamentos.erros.salvar'))
    if (lido.codigo === 'CONFLITO_BLOQUEANTE') {
      const fechado = lido.conflitos.find((conflito) => conflito.severity === 'blocking')
      bloqueante.value = fechado ? frases.frase(fechado) : lido.mensagem
    } else {
      falhou(err)
    }
  } finally {
    enviando.value = null
  }
}

/* --------------------------------------------------------------------------- cancelar */

const motivo = ref<MotivoDoCancelamento | null>(null)

const opcoesDeMotivo = computed(() =>
  MOTIVOS_DE_CANCELAMENTO.map((valor) => ({
    valor,
    rotulo: t(`agendamentos.cancelar.motivos.${valor}`),
  })),
)

function abrirCancelamento() {
  motivo.value = null
  erro.value = ''
  tentou.value = false
  modo.value = 'cancelar'
}

async function cancelar() {
  const atual = ag.value
  if (!atual) return
  tentou.value = true
  erro.value = ''
  if (!motivo.value) return

  enviando.value = 'cancelar'
  try {
    const mutacao = await cancelarAgendamento(
      atual.id,
      { versao: atual.versao, motivo: motivo.value },
      parceiroQuery(),
    )
    modo.value = 'ver'
    emit('mudou', mutacao, t('agendamentos.feito.cancelar'))
  } catch (err) {
    falhou(err)
  } finally {
    enviando.value = null
  }
}

/* ------------------------------------------------------------------------------ falta */

/** A falta só depois do início (guia 3.2) e só de quem ainda não chegou. */
const podeMarcarFalta = computed(() => {
  const atual = ag.value
  if (!atual || !props.podeEscrever) return false
  if (atual.status !== 'AGENDADO' && atual.status !== 'CONFIRMADO') return false
  return props.relogio.getTime() >= Date.parse(atual.inicio)
})

const comContato = ref(false)
const justificativa = ref<NovaJustificativa>({ canal: 'TELEFONE', motivo: null })
/** Cliente anonimizado: a falta se marca, o contato não (guia 3.3). */
const semContato = ref(false)

function abrirFalta() {
  comContato.value = false
  justificativa.value = { canal: 'TELEFONE', motivo: null }
  erro.value = ''
  tentou.value = false
  modo.value = 'falta'
}

async function salvarFalta() {
  const atual = ag.value
  if (!atual) return
  tentou.value = true
  erro.value = ''
  if (comContato.value && problemaDaJustificativa(justificativa.value, props.hoje)) return

  enviando.value = 'falta'
  try {
    const marcada = await marcarFalta(
      atual.id,
      {
        versao: atual.versao,
        ...(comContato.value
          ? { justificativa: justificativaParaEnviar(justificativa.value) }
          : {}),
      },
      parceiroQuery(),
    )
    modo.value = 'ver'
    emit('mudou', marcada, t('faltas.feito.marcada'))
    if (marcada.obito) emit('obito', marcada.obito)
  } catch (err) {
    const lido = lerErroDaAgenda(err, t('agendamentos.erros.salvar'))
    if (lido.codigo === 'CLIENTE_ANONIMIZADO') {
      semContato.value = true
      comContato.value = false
    }
    if (lido.codigo === 'AGENDAMENTO_ALTERADO' || lido.codigo === 'AGENDAMENTO_STATUS_INVALIDO') {
      falhou(err)
      return
    }
    erro.value = lido.mensagem
  } finally {
    enviando.value = null
  }
}

/** O horário em falta, para o bloco da falta (registros, contato e reagendar). */
const horarioQueFaltou = computed(() => {
  const atual = ag.value
  if (!atual || atual.status !== 'FALTA') return null
  return {
    agendamentoId: atual.id,
    pacienteId: atual.paciente.id,
    pacienteNome: atual.paciente.nome,
    inicio: atual.inicio,
    profissionalId: atual.profissionalId,
    tipoId: atual.tipoId,
  }
})

/* ------------------------------------------------------------------------------- topo */

const titulo = computed(() => {
  if (modo.value === 'editar') return t('agendamentos.editar.titulo')
  if (modo.value === 'mudar') return t('agendamentos.mudar.titulo')
  if (modo.value === 'cancelar') return t('agendamentos.cancelar.titulo')
  if (modo.value === 'falta') return t('faltas.marcar.titulo')
  return ag.value?.paciente.nome ?? t('agendamentos.detalhe.titulo')
})

const icone = computed(() => {
  if (modo.value === 'editar') return 'ph ph-pencil-simple'
  if (modo.value === 'mudar') return 'ph ph-calendar-dots'
  if (modo.value === 'cancelar') return 'ph ph-calendar-x'
  if (modo.value === 'falta') return 'ph ph-user-minus'
  return 'ph ph-calendar-check'
})

const ROTULO_DA_ACAO = {
  'confirmar-presenca': 'agendamentos.acao.confirmar',
  chegada: 'agendamentos.acao.chegada',
  iniciar: 'agendamentos.acao.iniciar',
} as const

const ICONE_DA_ACAO = {
  'confirmar-presenca': 'ph ph-phone-call',
  chegada: 'ph ph-door-open',
  iniciar: 'ph ph-stethoscope',
} as const

/**
 * O passo que vem a seguir é o único em destaque: antes de chegar, a chegada; aguardando, iniciar.
 * O resto (confirmar presença, editar, mudar, cancelar) fica recolhido em "Mais ações".
 */
const principal = computed(() => {
  const a = acoes.value
  if (a.chegada) return 'chegada' as const
  if (a.iniciar) return 'iniciar' as const
  return null
})

const menu = ref<InstanceType<typeof Menu> | null>(null)

const itensDoMenu = computed<MenuItem[]>(() => {
  const a = acoes.value
  const itens: MenuItem[] = []
  if (a.confirmar) {
    itens.push({
      label: t(ROTULO_DA_ACAO['confirmar-presenca']),
      icon: ICONE_DA_ACAO['confirmar-presenca'],
      command: () => void agir('confirmar-presenca'),
    })
  }
  /* Antes de chegar, iniciar também vale (o servidor grava a chegada junto). */
  if (a.chegada && a.iniciar) {
    itens.push({
      label: t(ROTULO_DA_ACAO.iniciar),
      icon: ICONE_DA_ACAO.iniciar,
      command: () => void agir('iniciar'),
    })
  }
  if (a.editar) {
    itens.push({
      label: t('agendamentos.acao.editar'),
      icon: 'ph ph-pencil-simple',
      command: abrirEdicao,
    })
  }
  if (a.mover) {
    itens.push({
      label: t('agendamentos.acao.mudar'),
      icon: 'ph ph-calendar-dots',
      command: abrirMudanca,
    })
  }
  if (a.cancelar) {
    if (itens.length) itens.push({ separator: true })
    itens.push({
      label: t('agendamentos.cancelar.titulo'),
      icon: 'ph ph-calendar-x',
      command: abrirCancelamento,
    })
  }
  return itens
})
</script>

<template>
  <CadastroGaveta v-model:visible="visible" :titulo="titulo" :icone="icone" largura="34rem">
    <template v-if="ag">
      <!-- Ver -->
      <template v-if="modo === 'ver'">
        <section class="eg__secao">
          <p class="agv__quem">
            <span>{{
              t('agendamentos.detalhe.responsavel', { nome: ag.paciente.clienteNome })
            }}</span>
            <RouterLink class="agv__ficha" :to="`/clinica/ficha/${ag.paciente.id}`">
              {{ t('agendamentos.detalhe.abrirFicha') }}
              <i class="ph ph-arrow-right" aria-hidden="true" />
            </RouterLink>
          </p>
        </section>

        <section class="eg__secao">
          <span class="eg__rotulo">{{ t('agendamentos.detalhe.quando') }}</span>
          <p class="agv__quando">
            <strong>{{ frases.diaPorExtenso(ag.inicio.slice(0, 10)) }}</strong>
            <span class="ui-num">{{ frases.horario(ag) }}</span>
          </p>
        </section>

        <dl class="agv__dados">
          <div>
            <dt>{{ t('agendamentos.detalhe.tipo') }}</dt>
            <dd>
              {{ nomeDoTipo(ag.tipoId) }}
              <span v-if="ag.encaixe" class="ui-selo">{{ t('agendamentos.encaixe') }}</span>
            </dd>
          </div>
          <div>
            <dt>{{ t('agendamentos.detalhe.profissional') }}</dt>
            <dd>{{ nomeDoProfissional(ag.profissionalId) }}</dd>
          </div>
          <div v-if="nomesDasSalas">
            <dt>{{ t('agendamentos.detalhe.salas', ag.salaIds.length) }}</dt>
            <dd>{{ nomesDasSalas }}</dd>
          </div>
          <div>
            <dt>{{ t('agendamentos.detalhe.situacao') }}</dt>
            <dd>{{ t(`agendamentos.status.${ag.status}`) }}</dd>
          </div>
        </dl>

        <section v-if="avisos.length" class="eg__secao">
          <span class="eg__rotulo">{{ t('agendamentos.detalhe.avisos') }}</span>
          <ul class="agv__avisos">
            <li
              v-for="(aviso, indice) in avisos"
              :key="`${aviso.kind}-${indice}`"
              :class="`agv__aviso--${aviso.severity}`"
            >
              <i :class="ICONE_DO_AVISO[aviso.severity]" aria-hidden="true" />
              <span>{{ frases.frase(aviso) }}</span>
            </li>
          </ul>
        </section>

        <!-- O atendimento que o "Iniciar" abriu (E4-01). -->
        <RouterLink
          v-if="ag.atendimentoId && leProntuario"
          class="p-button p-component p-button-secondary p-button-outlined agv__atendimento"
          :to="`/clinica/atendimento/${ag.atendimentoId}`"
        >
          <i class="ph ph-note-pencil p-button-icon p-button-icon-left" aria-hidden="true" />
          <span class="p-button-label">{{ t('atendimento.abrirDoHorario') }}</span>
        </RouterLink>

        <!-- A pré-consulta do app (E3-07): recolhida até alguém pedir para ler. -->
        <PreConsultaDoHorario
          v-if="ag.status !== 'CANCELADO'"
          :agendamento-id="ag.id"
          :fuso="fuso"
        />

        <!-- A falta: em que pé está, os registros, o contato e o reagendar. -->
        <FaltaDoHorario
          v-if="horarioQueFaltou"
          :falta="horarioQueFaltou"
          :fuso="fuso"
          :profissionais="profissionais"
          :pode-escrever="podeEscrever"
          :pode-obito="podeObito"
          :hoje="hoje"
          @justificado="(obito) => emit('justificado', obito)"
          @reagendado="(mutacao) => emit('mudou', mutacao, t('faltas.feito.reagendada'))"
        />

        <section v-if="ag.observacao" class="eg__secao">
          <span class="eg__rotulo">{{ t('agendamentos.detalhe.observacao') }}</span>
          <p class="agv__observacao">{{ ag.observacao }}</p>
        </section>

        <section class="eg__secao">
          <span class="eg__rotulo">{{ t('agendamentos.detalhe.rastro') }}</span>
          <ul class="agv__rastro">
            <li v-for="(linha, indice) in rastro" :key="indice">
              <i :class="linha.icone" aria-hidden="true" />
              <span>{{ linha.texto }}</span>
            </li>
          </ul>
        </section>
      </template>

      <!-- Editar -->
      <form
        v-else-if="modo === 'editar'"
        id="agendamento-editar"
        class="eg"
        novalidate
        @submit.prevent="salvarEdicao"
      >
        <p class="eg__dica">
          {{ ag.paciente.nome }} · {{ frases.diaPorExtenso(ag.inicio.slice(0, 10)) }},
          {{ ag.inicio.slice(11, 16) }}
        </p>
        <div class="eg__linha">
          <section class="eg__secao">
            <label class="eg__rotulo" for="ag-editar-tipo">{{
              t('agendamentos.detalhe.tipo')
            }}</label>
            <Select
              :model-value="tipoId"
              input-id="ag-editar-tipo"
              :options="opcoesDeTipo"
              option-label="rotulo"
              option-value="valor"
              :disabled="Boolean(enviando)"
              @update:model-value="trocarTipo"
            />
          </section>
          <section class="eg__secao">
            <label class="eg__rotulo" for="ag-editar-duracao">{{
              t('agendamentos.marcar.duracao')
            }}</label>
            <InputNumber
              v-model="duracao"
              input-id="ag-editar-duracao"
              :min="DURACAO_MIN"
              :max="DURACAO_MAX"
              :step="DURACAO_PASSO"
              :suffix="` ${t('agendamentos.duracao.sufixo')}`"
              show-buttons
              :disabled="Boolean(enviando)"
            />
          </section>
        </div>
        <section class="eg__secao">
          <label class="eg__rotulo" for="ag-editar-salas">{{
            t('agendamentos.marcar.salas')
          }}</label>
          <MultiSelect
            v-model="salaIds"
            input-id="ag-editar-salas"
            :options="opcoesDeSala"
            option-label="rotulo"
            option-value="valor"
            :selection-limit="4"
            display="chip"
            :invalid="tentou && Boolean(problemaDaEdicao) && !salaIds.length"
            :disabled="Boolean(enviando)"
          />
        </section>
        <section class="eg__secao">
          <label class="eg__rotulo" for="ag-editar-observacao">
            {{ t('agendamentos.detalhe.observacao') }}
            <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
          </label>
          <Textarea
            id="ag-editar-observacao"
            v-model="observacao"
            rows="3"
            auto-resize
            :maxlength="OBSERVACAO_MAX"
            :disabled="Boolean(enviando)"
          />
          <small class="eg__dica">{{ t('agendamentos.marcar.observacaoDica') }}</small>
        </section>
        <label class="agv__chave">
          <span>
            <strong>{{ t('agendamentos.encaixe') }}</strong>
            <small>{{ t('agendamentos.marcar.encaixeDica') }}</small>
          </span>
          <ToggleSwitch v-model="encaixe" :disabled="Boolean(enviando)" />
        </label>
      </form>

      <!-- Mudar o horário -->
      <form
        v-else-if="modo === 'mudar'"
        id="agendamento-mudar"
        class="eg"
        novalidate
        @submit.prevent="salvarMudanca()"
      >
        <p class="eg__dica">{{ t('agendamentos.mudar.dica') }}</p>
        <section class="eg__secao">
          <span id="ag-mudar-dia" class="eg__rotulo">{{ t('agendamentos.marcar.dia') }}</span>
          <DatePicker
            v-model="novoDia"
            inline
            aria-labelledby="ag-mudar-dia"
            class="agv__calendario"
            :disabled="Boolean(enviando)"
          />
        </section>
        <div class="eg__linha">
          <section class="eg__secao">
            <label class="eg__rotulo" for="ag-mudar-hora">{{
              t('agendamentos.marcar.hora')
            }}</label>
            <InputMask
              id="ag-mudar-hora"
              v-model="novaHora"
              mask="99:99"
              :auto-clear="false"
              :invalid="tentou && !HORA.test(novaHora)"
              :disabled="Boolean(enviando)"
            />
          </section>
          <section class="eg__secao">
            <label class="eg__rotulo" for="ag-mudar-profissional">{{
              t('agendamentos.detalhe.profissional')
            }}</label>
            <Select
              v-model="novoProfissional"
              input-id="ag-mudar-profissional"
              :options="profissionais"
              option-label="nome"
              option-value="id"
              :disabled="Boolean(enviando)"
            />
          </section>
        </div>
        <div v-if="bloqueante" class="agv__confirmar" role="alert">
          <p>
            <i class="ph ph-prohibit" aria-hidden="true" />
            <span>{{ bloqueante }}</span>
          </p>
          <Button
            type="button"
            size="small"
            severity="secondary"
            outlined
            :label="t('agendamentos.marcar.mesmoAssim')"
            :loading="enviando === 'mudar'"
            @click="salvarMudanca(true)"
          />
        </div>
      </form>

      <!-- Marcar a falta, com o contato junto se já houve -->
      <form
        v-else-if="modo === 'falta'"
        id="agendamento-falta"
        class="eg"
        novalidate
        @submit.prevent="salvarFalta"
      >
        <p class="eg__dica">
          {{
            t('faltas.marcar.dica', {
              paciente: ag.paciente.nome,
              hora: ag.inicio.slice(11, 16),
            })
          }}
        </p>
        <label v-if="!semContato" class="agv__chave">
          <span>
            <strong>{{ t('faltas.marcar.comContato') }}</strong>
            <small>{{ t('faltas.marcar.comContatoDica') }}</small>
          </span>
          <ToggleSwitch v-model="comContato" :disabled="Boolean(enviando)" />
        </label>
        <JustificativaCampos
          v-if="comContato && !semContato"
          v-model="justificativa"
          :prefixo="`falta-${ag.id}`"
          :pode-obito="podeObito"
          :tentou="tentou"
          :desabilitado="Boolean(enviando)"
          :hoje="hoje"
        />
      </form>

      <!-- Cancelar -->
      <form v-else id="agendamento-cancelar" class="eg" novalidate @submit.prevent="cancelar">
        <p class="eg__dica">
          {{
            t('agendamentos.cancelar.dica', {
              paciente: ag.paciente.nome,
              quando: `${frases.diaNaFrase(ag.inicio.slice(0, 10))}, ${ag.inicio.slice(11, 16)}`,
            })
          }}
        </p>
        <section class="eg__secao">
          <label class="eg__rotulo" for="ag-cancelar-motivo">{{
            t('agendamentos.cancelar.motivo')
          }}</label>
          <Select
            v-model="motivo"
            input-id="ag-cancelar-motivo"
            :options="opcoesDeMotivo"
            option-label="rotulo"
            option-value="valor"
            :placeholder="t('agendamentos.cancelar.escolha')"
            :invalid="tentou && !motivo"
            :disabled="Boolean(enviando)"
          />
          <small v-if="tentou && !motivo" class="eg__invalido">{{
            t('agendamentos.cancelar.semMotivo')
          }}</small>
        </section>
      </form>

      <p
        v-if="erro || (tentou && modo === 'editar' && problemaDaEdicao)"
        class="eg__erro"
        role="alert"
      >
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erro || problemaDaEdicao }}</span>
      </p>
    </template>

    <template #pe>
      <template v-if="ag && modo === 'ver'">
        <div class="agv__pe">
          <template v-if="itensDoMenu.length">
            <Button
              type="button"
              severity="secondary"
              outlined
              icon="ph ph-dots-three"
              :label="t('agendamentos.acao.mais')"
              aria-haspopup="true"
              :loading="Boolean(enviando) && enviando !== principal"
              :disabled="Boolean(enviando)"
              @click="menu?.toggle($event)"
            />
            <Menu ref="menu" :model="itensDoMenu" popup />
          </template>
          <div class="agv__passos">
            <Button
              v-if="podeMarcarFalta"
              type="button"
              severity="secondary"
              outlined
              icon="ph ph-user-minus"
              :label="t('faltas.marcar.titulo')"
              :disabled="Boolean(enviando)"
              @click="abrirFalta"
            />
            <Button
              v-if="principal"
              type="button"
              :icon="ICONE_DA_ACAO[principal]"
              :label="t(ROTULO_DA_ACAO[principal])"
              :loading="enviando === principal"
              :disabled="Boolean(enviando) && enviando !== principal"
              @click="agir(principal)"
            />
            <Button
              v-else-if="ag.status === 'FINALIZADO' && podeEscrever"
              type="button"
              icon="ph ph-arrow-clockwise"
              :label="t('agendamentos.acao.retorno')"
              @click="emit('retorno', ag)"
            />
            <Button
              v-else
              type="button"
              severity="secondary"
              outlined
              :label="t('agenda.config.expediente.fechar')"
              @click="visible = false"
            />
          </div>
        </div>
      </template>

      <template v-else-if="ag">
        <Button
          type="button"
          severity="secondary"
          outlined
          :label="t('agendamentos.voltar')"
          :disabled="Boolean(enviando)"
          @click="modo = 'ver'"
        />
        <Button
          v-if="modo === 'editar'"
          type="submit"
          form="agendamento-editar"
          icon="ph ph-check"
          :label="t('cadastro.salvar')"
          :loading="enviando === 'editar'"
        />
        <Button
          v-else-if="modo === 'mudar'"
          type="submit"
          form="agendamento-mudar"
          icon="ph ph-check"
          :label="t('agendamentos.mudar.salvar')"
          :loading="enviando === 'mudar' && !bloqueante"
          :disabled="Boolean(bloqueante)"
        />
        <Button
          v-else-if="modo === 'falta'"
          type="submit"
          form="agendamento-falta"
          icon="ph ph-user-minus"
          :label="t('faltas.marcar.titulo')"
          :loading="enviando === 'falta'"
        />
        <Button
          v-else
          type="submit"
          form="agendamento-cancelar"
          severity="danger"
          icon="ph ph-calendar-x"
          :label="t('agendamentos.cancelar.confirmar')"
          :loading="enviando === 'cancelar'"
        />
      </template>
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.agv__quem {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 12px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.agv__ficha {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.agv__quando {
  display: grid;
  gap: 2px;
  margin: 0;
}

.agv__quando strong {
  color: var(--tinta);
  font-size: 15px;
  font-weight: 650;
}

.agv__quando span {
  color: var(--tinta-2);
  font-size: 13.5px;
}

.agv__dados {
  display: grid;
  gap: 12px 16px;
  margin: 0;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.agv__dados div {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.agv__dados dt {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.agv__dados dd {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
}

.agv__avisos,
.agv__rastro {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 13.5px;
}

.agv__avisos li,
.agv__rastro li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: var(--tinta);
}

.agv__avisos i,
.agv__rastro i {
  margin-top: 2px;
  font-size: 15px;
}

.agv__rastro li {
  color: var(--tinta-2);
}

.agv__aviso--blocking i {
  color: var(--risco-tinta);
}

.agv__aviso--warning i {
  color: var(--atencao-tinta);
}

.agv__aviso--info i {
  color: var(--tinta-2);
}

.agv__observacao {
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
  white-space: pre-line;
}

.agv__chave {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
}

.agv__chave span {
  display: grid;
  gap: 2px;
}

.agv__chave strong {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.agv__chave small {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.agv__calendario {
  justify-self: start;
}

.agv__confirmar {
  display: grid;
  gap: 8px;
}

.agv__confirmar p {
  display: flex;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 13.5px;
}

.agv__confirmar i {
  margin-top: 2px;
  color: var(--risco-tinta);
}

.agv__confirmar :deep(.p-button) {
  justify-self: start;
}

.agv__pe {
  display: flex;
  width: 100%;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.agv__passos {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  margin-inline-start: auto;
}

.agv__atendimento {
  justify-self: start;
}
</style>
