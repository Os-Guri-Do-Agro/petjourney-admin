<script setup lang="ts">
/**
 * A agenda da Clínica pela API (E3-02, PJ-4BS8TK; guia e3 seção 2).
 *
 * O dia (colunas por profissional ou por sala) e a semana (a carga de cada dia), com a data, a visão
 * e o agrupamento na URL (`?data=&visao=semana&por=sala`). As regras são do servidor: conflitos,
 * carga, sugestões e prazos chegam prontos; a tela só desenha. Toda escrita aplica a resposta na
 * hora, mostra o "Desfazer" por 8 s e relê o período (os avisos dos outros cartões podem mudar).
 *
 * Ler é `agenda.ler`; marcar, mexer e desfazer, `agenda.escrever` com a Clínica escrevendo (a
 * enfermagem lê e não marca: os botões nem aparecem).
 */
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import Dialog from 'primevue/dialog'
import Popover from 'primevue/popover'
import SelectButton from 'primevue/selectbutton'
import Skeleton from 'primevue/skeleton'
import ToggleSwitch from 'primevue/toggleswitch'
import { useToast } from 'primevue/usetoast'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import AgendamentoGaveta from '@/components/agendamentos/AgendamentoGaveta.vue'
import DesfazerNaAgenda from '@/components/agendamentos/DesfazerNaAgenda.vue'
import GradeDoDia from '@/components/agendamentos/GradeDoDia.vue'
import {
  aplicarMutacao,
  destinoDoArraste,
  horaDe,
  minutosAgoraNoFuso,
  noPasso,
  ordenarConflitos,
  segundaDe,
  somarDias,
  STATUS_RISCADOS,
  tocaODia,
} from '@/components/agendamentos/leitura-da-agenda'
import MarcarGaveta, { type InicioDaMarcacao } from '@/components/agendamentos/MarcarGaveta.vue'
import SemanaDaAgenda from '@/components/agendamentos/SemanaDaAgenda.vue'
import { lerErroDaAgenda, useFrasesDaAgenda } from '@/components/agendamentos/useFrasesDaAgenda'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import { hojeNoFuso } from '@/components/parceiro/estabelecimento/horario'
import UiPagina from '@/components/ui/UiPagina.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { invalidarPendenciasDoPortal } from '@/composables/usePendenciasDoPortal'
import {
  instanteNoFuso,
  listarSalas,
  listarTipos,
  obterPolitica,
  type Sala,
  type TipoDeAtendimento,
} from '@/service/parceiro/agenda-config-service'
import {
  DESFAZER_NA_TELA_MS,
  desfazerNaAgenda,
  moverAgendamento,
  obterDia,
  obterSemana,
  type AgendaDaSemana,
  type AgendaDoDia,
  type Agendamento,
  type Agrupamento,
  type ColunaDaAgenda,
  type Mutacao,
} from '@/service/parceiro/agenda-service'
import {
  FALTAS_POR_LOTE,
  marcarFaltasEmLote,
  type IgnoradoNoLote,
  type Obito,
} from '@/service/parceiro/faltas-service'
import { listarProfissionais } from '@/service/parceiro/profissionais-service'
import { criarUltimaLeitura } from '@/utils/ultima-leitura'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const rotulos = useRotulosDoCadastro()
const frases = useFrasesDaAgenda()
const { store, parceiroQuery } = useParceiroPortal()

const podeEscrever = computed(
  () => Boolean(store.modulo('CLINICA')?.podeEscrever) && store.temPermissao('agenda.escrever'),
)

/** O óbito (na falta) encerra o caso: pede também `paciente.escrever` (guia e3 3.1). */
const podeObito = computed(() => podeEscrever.value && store.temPermissao('paciente.escrever'))

/* ------------------------------------------------------------------------- onde estou */

/** O fuso da clínica vem em toda leitura; antes da primeira, o do navegador. */
const fuso = ref(Intl.DateTimeFormat().resolvedOptions().timeZone)
const relogio = ref(new Date())
const hoje = computed(() => hojeNoFuso(fuso.value, relogio.value))

const DATA = /^\d{4}-\d{2}-\d{2}$/

const data = computed(() => {
  const pedida = route.query.data
  return typeof pedida === 'string' && DATA.test(pedida) ? pedida : hoje.value
})
const visao = computed<'dia' | 'semana'>(() => (route.query.visao === 'semana' ? 'semana' : 'dia'))
const agrupar = computed<Agrupamento>(() => (route.query.por === 'sala' ? 'SALA' : 'PROFISSIONAL'))

function irPara(mudanca: {
  data?: string | null
  visao?: 'dia' | 'semana'
  agrupar?: Agrupamento
}) {
  const query = { ...route.query }
  if (mudanca.data !== undefined) {
    if (!mudanca.data || mudanca.data === hoje.value) delete query.data
    else query.data = mudanca.data
  }
  if (mudanca.visao) {
    if (mudanca.visao === 'dia') delete query.visao
    else query.visao = mudanca.visao
  }
  if (mudanca.agrupar) {
    if (mudanca.agrupar === 'PROFISSIONAL') delete query.por
    else query.por = 'sala'
  }
  void router.replace({ query })
}

function andar(sentido: 1 | -1) {
  irPara({ data: somarDias(data.value, sentido * (visao.value === 'semana' ? 7 : 1)) })
}

const ehHoje = computed(() =>
  visao.value === 'semana'
    ? segundaDe(data.value) === segundaDe(hoje.value)
    : data.value === hoje.value,
)

const rotuloDaData = computed(() => {
  if (visao.value === 'dia') return frases.diaPorExtenso(data.value)
  const de = segundaDe(data.value)
  const civil = (dia: string) => new Date(`${dia}T12:00:00Z`)
  return new Intl.DateTimeFormat(rotulos.intl(), {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).formatRange(civil(de), civil(somarDias(de, 6)))
})

const calendario = ref<InstanceType<typeof Popover> | null>(null)

const diaDoCalendario = computed(() => {
  const [ano, mes, dia] = data.value.split('-').map(Number)
  return new Date(ano!, mes! - 1, dia!)
})

function escolherNoCalendario(valor: Date | Date[] | (Date | null)[] | null | undefined) {
  if (!(valor instanceof Date)) return
  const escolhido = `${valor.getFullYear()}-${String(valor.getMonth() + 1).padStart(2, '0')}-${String(valor.getDate()).padStart(2, '0')}`
  calendario.value?.hide()
  irPara({ data: escolhido })
}

/* ---------------------------------------------------------------------------- exibição */

const opcoesDeVisao = computed(() => [
  { valor: 'dia', rotulo: t('agendamentos.visao.dia') },
  { valor: 'semana', rotulo: t('agendamentos.visao.semana') },
])

const opcoesDeAgrupamento = computed(() => [
  { valor: 'PROFISSIONAL', rotulo: t('agendamentos.agrupar.PROFISSIONAL') },
  { valor: 'SALA', rotulo: t('agendamentos.agrupar.SALA') },
])

const exibicao = ref<InstanceType<typeof Popover> | null>(null)

const PREFERENCIA = 'pj.agenda.ocultarRiscados'

function lerPreferencia() {
  try {
    return localStorage.getItem(PREFERENCIA) === '1'
  } catch {
    return false
  }
}

const ocultarRiscados = ref(lerPreferencia())

watch(ocultarRiscados, (valor) => {
  try {
    localStorage.setItem(PREFERENCIA, valor ? '1' : '0')
  } catch {
    /* Sem o armazenamento, a escolha vale só até recarregar. */
  }
})

/* ------------------------------------------------------------------------------ leitura */

const dia = ref<AgendaDoDia | null>(null)
const semana = ref<AgendaDaSemana | null>(null)
const carregando = ref(true)
const jaCarregou = ref(false)
const erro = ref('')

/* Trocar de dia antes de a resposta chegar: a leitura do dia anterior não vale mais. */
const leitura = criarUltimaLeitura()

async function carregar(silencioso = false) {
  const vez = leitura.nova()
  if (!silencioso) carregando.value = true
  erro.value = ''

  try {
    if (visao.value === 'dia') {
      const lido = await obterDia(data.value, agrupar.value, parceiroQuery())
      if (!leitura.valendo(vez)) return
      dia.value = lido
      fuso.value = lido.fuso
    } else {
      const lida = await obterSemana(data.value, parceiroQuery())
      if (!leitura.valendo(vez)) return
      semana.value = lida
      fuso.value = lida.fuso
    }
    jaCarregou.value = true
  } catch (err) {
    if (!leitura.valendo(vez)) return
    erro.value = lerErroDaAgenda(err, t('agendamentos.erroAoCarregar')).mensagem
  } finally {
    if (leitura.valendo(vez)) carregando.value = false
  }
}

watch([data, visao, agrupar], () => void carregar())

/* O que a tela mostra é do período pedido: o dia ou a semana de outra data esperam a leitura. */
const diaNaTela = computed(() =>
  dia.value && dia.value.data === data.value && dia.value.agrupar === agrupar.value
    ? dia.value
    : null,
)
const semanaNaTela = computed(() =>
  semana.value && semana.value.de === segundaDe(data.value) ? semana.value : null,
)

/* --------------------------------------------------------------------- tipos e equipe */

const tipos = ref<TipoDeAtendimento[]>([])
const salas = ref<Sala[]>([])
const equipe = ref<{ id: string; nome: string }[]>([])
const passo = ref(15)

async function carregarApoio() {
  const [listaDeTipos, listaDeSalas, listaDeProfissionais, politica] = await Promise.all([
    listarTipos(parceiroQuery()).catch(() => [] as TipoDeAtendimento[]),
    listarSalas(parceiroQuery()).catch(() => [] as Sala[]),
    listarProfissionais({ ...parceiroQuery(), ativo: true, atendeNaAgenda: true }).catch(() => []),
    obterPolitica(parceiroQuery()).catch(() => null),
  ])
  tipos.value = listaDeTipos
  salas.value = listaDeSalas
  equipe.value = listaDeProfissionais.map((item) => ({ id: item.id, nome: item.nome }))
  if (politica?.granularidadeMinutos) passo.value = politica.granularidadeMinutos
}

function nomeDoTipo(id: string) {
  return tipos.value.find((tipo) => tipo.id === id)?.nome ?? ''
}

/** Quem atende na agenda e, para dizer o nome, quem tem horário no dia mesmo inativo. */
const profissionais = computed(() => {
  const lista = [...equipe.value]
  for (const item of dia.value?.profissionais ?? []) {
    if (!lista.some((outro) => outro.id === item.id)) lista.push({ id: item.id, nome: item.nome })
  }
  return lista
})

const profissionaisQueMarcam = computed(() => equipe.value)

/* ------------------------------------------------------------------------------ relógio */

let tique: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  void carregar()
  void carregarApoio()
  tique = setInterval(() => {
    relogio.value = new Date()
  }, 60_000)
})

onBeforeUnmount(() => clearInterval(tique))

const agora = computed(() =>
  diaNaTela.value && diaNaTela.value.data === hoje.value
    ? minutosAgoraNoFuso(fuso.value, relogio.value)
    : null,
)

/* ------------------------------------------------------------------------------- resumo */

const marcadosNoDia = computed(
  () =>
    diaNaTela.value?.agendamentos.filter(
      (item) =>
        (!item.grupoId || item.grupoId === item.id) &&
        !STATUS_RISCADOS.includes(item.status) &&
        item.inicio.slice(0, 10) === diaNaTela.value?.data,
    ).length ?? 0,
)

const marcadosNaSemana = computed(
  () => semanaNaTela.value?.dias.reduce((soma, item) => soma + item.agendados, 0) ?? 0,
)

const fraseDoResumo = computed(() => {
  const n = visao.value === 'dia' ? marcadosNoDia.value : marcadosNaSemana.value
  if (visao.value === 'dia' && !diaNaTela.value) return ''
  if (visao.value === 'semana' && !semanaNaTela.value) return ''
  return n
    ? t('agendamentos.resumo.marcados', { n: rotulos.numero(n) }, n)
    : t('agendamentos.resumo.nenhum')
})

/* ------------------------------------------------------------------------------ escrita */

const feito = ref<{ texto: string; ate: number; token: string } | null>(null)
const desfazendo = ref(false)

function aplicarNaTela(mutacao: Pick<Mutacao, 'agendamentos' | 'removidos'>) {
  if (dia.value) {
    const lido = dia.value
    dia.value = aplicarMutacao(lido, mutacao, (item) => tocaODia(item, lido.data))
  }
  if (semana.value) {
    const lida = semana.value
    semana.value = aplicarMutacao(lida, mutacao, (item) => {
      const inicio = item.inicio.slice(0, 10)
      return inicio >= lida.de && inicio <= lida.ate
    })
  }
}

/**
 * Depois de gravar: aplica, oferece o "Desfazer" e relê. Os avisos do horário gravado aparecem
 * depois (guia 2.6: mostra, não impede), só em quem acabou de marcar, mover ou editar.
 */
function depoisDeMudar(mutacao: Mutacao, texto: string, avisar = false) {
  aplicarNaTela(mutacao)
  feito.value = mutacao.desfazerToken
    ? { texto, token: mutacao.desfazerToken, ate: Date.now() + DESFAZER_NA_TELA_MS }
    : null
  invalidarPendenciasDoPortal()

  const alvo = mutacao.agendamentos.find((item) => item.id === mutacao.id)
  const avisos = ordenarConflitos(alvo?.conflitos ?? []).filter((item) => item.severity !== 'info')
  if (avisar && avisos.length) {
    toast.add({
      severity: 'warn',
      summary: t('agendamentos.gravadoComAviso'),
      detail: frases.frase(avisos[0]!),
      life: 6000,
    })
  }

  void carregar(true)
}

async function desfazer() {
  const atual = feito.value
  if (!atual) return
  desfazendo.value = true

  try {
    const mutacao = await desfazerNaAgenda(atual.token, parceiroQuery())
    feito.value = null
    aplicarNaTela(mutacao)
    invalidarPendenciasDoPortal()
    toast.add({ severity: 'success', summary: t('agendamentos.desfazer.feito'), life: 3000 })
    void carregar(true)
  } catch (err) {
    feito.value = null
    const lido = lerErroDaAgenda(err, t('agendamentos.erros.salvar'))
    toast.add({
      severity: 'warn',
      summary:
        lido.codigo === 'DESFAZER_EXPIRADO' ? t('agendamentos.desfazer.expirado') : lido.mensagem,
      life: 6000,
    })
  } finally {
    desfazendo.value = false
  }
}

/** Versão velha ou situação que mudou: avisa e relê (a gaveta aberta mostra o horário novo). */
function alterado(mensagem: string) {
  toast.add({ severity: 'warn', summary: mensagem, life: 6000 })
  void carregar(true)
}

/** Contato registrado numa falta: relê o dia (a situação muda) e avisa o óbito, se houve. */
function justificado(obito: Obito | null) {
  toast.add({ severity: 'success', summary: t('faltas.feito.contato'), life: 3000 })
  if (obito) avisarObito(obito)
  invalidarPendenciasDoPortal()
  void carregar(true)
}

/** O óbito encerra o caso: diz quantos horários dele foram cancelados (guia e3 3.6). */
function avisarObito(obito: Obito) {
  toast.add({
    severity: 'info',
    summary: t('faltas.obito.titulo'),
    detail: t(
      'faltas.obito.cancelados',
      { n: obito.agendamentosCancelados },
      obito.agendamentosCancelados,
    ),
    life: 8000,
  })
}

/* ----------------------------------------------------------------------- fechar o turno */

/**
 * Os horários do dia que já acabaram e ninguém chegou: o "fechar o turno" (guia e3 3.2) marca
 * todos de uma vez. O servidor confere de novo e devolve os que ficaram de fora e por quê.
 */
const semChegada = computed(() => {
  const lido = diaNaTela.value
  if (!lido || !podeEscrever.value) return []
  const agora = relogio.value.getTime()
  return lido.agendamentos
    .filter(
      (item) =>
        (!item.grupoId || item.grupoId === item.id) &&
        (item.status === 'AGENDADO' || item.status === 'CONFIRMADO') &&
        item.inicio.slice(0, 10) === lido.data &&
        Date.parse(item.fim) <= agora,
    )
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
})

const fecharTurnoAberto = ref(false)
const fechandoTurno = ref(false)

async function fecharTurno() {
  const lido = diaNaTela.value
  if (!lido) return
  fechandoTurno.value = true
  try {
    const resposta = await marcarFaltasEmLote(
      {
        data: lido.data,
        agendamentoIds: semChegada.value.slice(0, FALTAS_POR_LOTE).map((item) => item.id),
      },
      parceiroQuery(),
    )
    fecharTurnoAberto.value = false
    aplicarNaTela({ agendamentos: resposta.marcados, removidos: [] })
    const n = resposta.marcados.length
    feito.value = resposta.desfazerToken
      ? {
          texto: t('faltas.lote.marcadas', { n }, n),
          token: resposta.desfazerToken,
          ate: Date.now() + DESFAZER_NA_TELA_MS,
        }
      : null
    if (resposta.ignorados.length) {
      toast.add({
        severity: 'info',
        summary: t(
          'faltas.lote.deFora',
          { n: resposta.ignorados.length },
          resposta.ignorados.length,
        ),
        detail: porquesDoLote(resposta.ignorados),
        life: 8000,
      })
    }
    invalidarPendenciasDoPortal()
    void carregar(true)
  } catch (err) {
    const lido = lerErroDaAgenda(err, t('agendamentos.erros.salvar'))
    toast.add({ severity: 'error', summary: lido.mensagem, life: 6000 })
    if (lido.codigo === 'AGENDAMENTO_ALTERADO') void carregar(true)
  } finally {
    fechandoTurno.value = false
  }
}

/** "2 ainda não acabaram, 1 chegou": cada motivo com quantos. */
function porquesDoLote(ignorados: IgnoradoNoLote[]) {
  const contagem = new Map<IgnoradoNoLote['reason'], number>()
  for (const item of ignorados) contagem.set(item.reason, (contagem.get(item.reason) ?? 0) + 1)
  return [...contagem.entries()]
    .map(([motivo, n]) => t(`faltas.lote.porque.${motivo}`, { n }, n))
    .join(' · ')
}

/* ------------------------------------------------------------------------------- abrir */

const abertoId = ref<string | null>(null)
const ultimoAberto = ref<Agendamento | null>(null)
const detalheAberto = ref(false)

const aberto = computed(() => {
  const id = abertoId.value
  if (!id) return null
  return (
    dia.value?.agendamentos.find((item) => item.id === id) ??
    semana.value?.agendamentos.find((item) => item.id === id) ??
    ultimoAberto.value
  )
})

watch(aberto, (atual) => {
  if (atual) ultimoAberto.value = atual
})

function abrir(agendamento: Agendamento) {
  abertoId.value = agendamento.id
  ultimoAberto.value = agendamento
  detalheAberto.value = true
}

function mudouNaGaveta(mutacao: Mutacao, texto: string) {
  depoisDeMudar(mutacao, texto, true)
}

/* ------------------------------------------------------------------------------ marcar */

const marcarAberto = ref(false)
const inicioDaMarcacao = ref<InicioDaMarcacao>({ data: '', hora: '09:00', profissionalId: null })

function horaSugerida() {
  if (data.value !== hoje.value) return '09:00'
  const proximo = noPasso(minutosAgoraNoFuso(fuso.value) + passo.value, passo.value)
  return horaDe(Math.min(proximo, 23 * 60))
}

function abrirMarcacao(inicio?: Partial<InicioDaMarcacao>) {
  detalheAberto.value = false
  inicioDaMarcacao.value = {
    data: data.value,
    hora: horaSugerida(),
    profissionalId: null,
    ...inicio,
  }
  marcarAberto.value = true
}

function marcarNaGrade(dados: { coluna: ColunaDaAgenda; inicioMin: number }) {
  abrirMarcacao({
    data: data.value,
    hora: horaDe(dados.inicioMin),
    profissionalId: dados.coluna.tipo === 'PROFISSIONAL' ? dados.coluna.id : null,
    salaId: dados.coluna.tipo === 'SALA' ? dados.coluna.id : null,
  })
}

function marcarRetorno(agendamento: Agendamento) {
  const retorno = tipos.value.find((tipo) => tipo.ativo && tipo.kind === 'RETORNO')
  abrirMarcacao({
    data: somarDias(hoje.value, 1),
    hora: '09:00',
    profissionalId: agendamento.profissionalId,
    paciente: {
      id: agendamento.paciente.id,
      nome: agendamento.paciente.nome,
      responsavel: agendamento.paciente.clienteNome,
    },
    tipoId: retorno?.id ?? agendamento.tipoId,
    retorno: true,
  })
}

function marcado(mutacao: Mutacao) {
  depoisDeMudar(mutacao, t('agendamentos.feito.criar'), true)
  const novo = mutacao.agendamentos.find((item) => item.id === mutacao.id)
  const outroDia = novo ? novo.inicio.slice(0, 10) : null
  if (visao.value === 'dia' && outroDia && outroDia !== data.value) irPara({ data: outroDia })
}

/* ---------------------------------------------------------------------------- arrastar */

type Movimento = {
  agendamento: Agendamento
  origem: ColunaDaAgenda
  destino: ColunaDaAgenda
  inicioMin: number
}

const movendo = ref(false)
/** O arraste que esbarrou no dia especial fechado: espera o "mudar mesmo assim". */
const aConfirmar = ref<{ movimento: Movimento; frase: string } | null>(null)

async function moverPelaGrade(movimento: Movimento, confirmar = false) {
  const lido = diaNaTela.value
  if (!lido) return
  const destino = destinoDoArraste(movimento.agendamento, movimento.origem, movimento.destino)
  movendo.value = true

  try {
    const mutacao = await moverAgendamento(
      movimento.agendamento.id,
      {
        inicio: instanteNoFuso(lido.fuso, lido.data, horaDe(movimento.inicioMin)),
        versao: movimento.agendamento.versao,
        ...(destino ? { destino } : {}),
        ...(confirmar ? { confirmarConflitos: ['holiday-closed' as const] } : {}),
      },
      parceiroQuery(),
    )
    aConfirmar.value = null
    depoisDeMudar(mutacao, t('agendamentos.feito.mover'), true)
  } catch (err) {
    const erroLido = lerErroDaAgenda(err, t('agendamentos.erros.salvar'))
    if (erroLido.codigo === 'CONFLITO_BLOQUEANTE') {
      const fechado = erroLido.conflitos.find((item) => item.severity === 'blocking')
      aConfirmar.value = { movimento, frase: fechado ? frases.frase(fechado) : erroLido.mensagem }
      return
    }
    aConfirmar.value = null
    if (erroLido.codigo === 'AGENDAMENTO_ALTERADO') {
      alterado(t('agendamentos.erros.alterado'))
      return
    }
    toast.add({ severity: 'error', summary: erroLido.mensagem, life: 6000 })
    void carregar(true)
  } finally {
    movendo.value = false
  }
}

/* ------------------------------------------------------------------------------ avisos */

const feriado = computed(() => diaNaTela.value?.feriado ?? null)
</script>

<template>
  <UiPagina
    class="tela-agenda"
    :carregando="carregando && !jaCarregou"
    :erro="erro && !jaCarregou ? erro : ''"
    @tentar-de-novo="carregar"
  >
    <template v-if="fraseDoResumo" #resumo>
      <span aria-live="polite">{{ fraseDoResumo }}</span>
    </template>

    <template v-if="podeEscrever" #acoes>
      <Button
        v-if="visao === 'dia' && semChegada.length"
        type="button"
        severity="secondary"
        icon="ph ph-user-minus"
        :label="t('faltas.lote.botao', { n: semChegada.length })"
        @click="fecharTurnoAberto = true"
      />
      <Button
        type="button"
        icon="ph ph-calendar-plus"
        :label="t('agendamentos.marcar.titulo')"
        @click="abrirMarcacao()"
      />
    </template>

    <div class="ag">
      <!-- Onde estou e o que estou vendo: fora da caixa, em cima. -->
      <div class="ag__barra">
        <div class="ag__onde" role="group" :aria-label="t('agendamentos.navegar')">
          <Button
            type="button"
            severity="secondary"
            outlined
            icon="ph ph-caret-left"
            :aria-label="
              visao === 'dia' ? t('agendamentos.diaAnterior') : t('agendamentos.semanaAnterior')
            "
            :title="
              visao === 'dia' ? t('agendamentos.diaAnterior') : t('agendamentos.semanaAnterior')
            "
            @click="andar(-1)"
          />
          <Button
            type="button"
            severity="secondary"
            outlined
            class="ag__data"
            icon="ph ph-calendar-blank"
            :label="rotuloDaData"
            :aria-label="`${t('agendamentos.escolherDia')}: ${rotuloDaData}`"
            aria-haspopup="dialog"
            @click="calendario?.toggle($event)"
          />
          <Button
            type="button"
            severity="secondary"
            outlined
            icon="ph ph-caret-right"
            :aria-label="
              visao === 'dia' ? t('agendamentos.proximoDia') : t('agendamentos.proximaSemana')
            "
            :title="
              visao === 'dia' ? t('agendamentos.proximoDia') : t('agendamentos.proximaSemana')
            "
            @click="andar(1)"
          />
          <Button
            v-if="!ehHoje"
            type="button"
            severity="secondary"
            outlined
            icon="ph ph-arrow-u-up-left"
            :label="t('agendamentos.hoje')"
            @click="irPara({ data: null })"
          />
        </div>

        <div class="ag__como">
          <SelectButton
            :model-value="visao"
            :options="opcoesDeVisao"
            option-label="rotulo"
            option-value="valor"
            :allow-empty="false"
            :aria-label="t('agendamentos.visao.rotulo')"
            @update:model-value="(valor: 'dia' | 'semana') => irPara({ visao: valor })"
          />
          <Button
            type="button"
            severity="secondary"
            outlined
            icon="ph ph-sliders-horizontal"
            :label="t('agendamentos.exibicao')"
            aria-haspopup="dialog"
            @click="exibicao?.toggle($event)"
          />
        </div>
      </div>

      <Popover ref="calendario">
        <DatePicker
          :model-value="diaDoCalendario"
          inline
          :aria-label="t('agendamentos.escolherDia')"
          @update:model-value="escolherNoCalendario"
        />
      </Popover>

      <Popover ref="exibicao">
        <div class="ag__exibicao">
          <section v-if="visao === 'dia'" class="ag__opcao">
            <span id="ag-colunas" class="ag__rotulo">{{ t('agendamentos.agrupar.rotulo') }}</span>
            <SelectButton
              :model-value="agrupar"
              :options="opcoesDeAgrupamento"
              option-label="rotulo"
              option-value="valor"
              :allow-empty="false"
              aria-labelledby="ag-colunas"
              @update:model-value="(valor: Agrupamento) => irPara({ agrupar: valor })"
            />
          </section>
          <label class="ag__chave">
            <span>{{ t('agendamentos.ocultarRiscados') }}</span>
            <ToggleSwitch v-model="ocultarRiscados" />
          </label>
        </div>
      </Popover>

      <p v-if="erro && jaCarregou" class="ag__aviso ui-folha" role="alert">
        <span class="ui-ladrilho ui-ladrilho--risco" aria-hidden="true">
          <i class="ph ph-warning-circle" />
        </span>
        <span>{{ erro }}</span>
        <Button
          type="button"
          size="small"
          severity="secondary"
          outlined
          :label="t('cadastro.tentarDeNovo')"
          @click="carregar()"
        />
      </p>

      <!-- O dia -->
      <template v-if="visao === 'dia'">
        <p v-if="diaNaTela?.clinicaFechada" class="ag__aviso ui-folha" role="status">
          <span class="ui-ladrilho ui-ladrilho--atencao" aria-hidden="true">
            <i class="ph ph-calendar-x" />
          </span>
          <span>
            {{
              feriado
                ? t('agendamentos.fechadoNoFeriado', { nome: feriado.nome })
                : t('agendamentos.fechado')
            }}
          </span>
        </p>
        <p v-else-if="feriado" class="ag__aviso ui-folha" role="status">
          <span class="ui-ladrilho ui-ladrilho--neutro" aria-hidden="true">
            <i class="ph ph-calendar-star" />
          </span>
          <span>
            {{
              feriado.abre && feriado.fecha
                ? t('agendamentos.feriadoComHorario', {
                    nome: feriado.nome,
                    abre: feriado.abre,
                    fecha: feriado.fecha,
                  })
                : feriado.nome
            }}
          </span>
        </p>

        <div v-if="!diaNaTela" class="ag__folha ui-folha" aria-busy="true">
          <Skeleton height="2rem" width="40%" />
          <Skeleton height="24rem" />
        </div>

        <div v-else-if="!diaNaTela.colunas.length" class="ui-folha ui-vazio ag__vazio">
          <span class="ui-ladrilho ui-ladrilho--neutro" aria-hidden="true">
            <i class="ph ph-moon" />
          </span>
          <h2>{{ t('agendamentos.vazio.titulo') }}</h2>
          <p>{{ t('agendamentos.vazio.descricao') }}</p>
          <Button
            type="button"
            severity="secondary"
            outlined
            icon="ph ph-calendar-blank"
            :label="t('agendamentos.vazio.semana')"
            @click="irPara({ visao: 'semana' })"
          />
        </div>

        <div
          v-else
          class="ag__folha ui-folha"
          :class="{ 'ag__folha--lendo': carregando || movendo }"
          :aria-busy="carregando || movendo"
        >
          <GradeDoDia
            :dia="diaNaTela"
            :passo="passo"
            :pode-escrever="podeEscrever"
            :ocultar-riscados="ocultarRiscados"
            :agora="agora"
            :nome-do-tipo="nomeDoTipo"
            @abrir="abrir"
            @criar="marcarNaGrade"
            @mover="(movimento) => moverPelaGrade(movimento)"
          />
        </div>
      </template>

      <!-- A semana -->
      <template v-else>
        <div v-if="!semanaNaTela" class="ag__folha ui-folha" aria-busy="true">
          <Skeleton height="12rem" />
        </div>
        <div v-else class="ag__folha ui-folha" :class="{ 'ag__folha--lendo': carregando }">
          <SemanaDaAgenda
            :semana="semanaNaTela"
            :hoje="hoje"
            :ocultar-riscados="ocultarRiscados"
            @escolher="(escolhido) => irPara({ data: escolhido, visao: 'dia' })"
          />
        </div>
      </template>
    </div>

    <template #sempre>
      <AgendamentoGaveta
        v-model:visible="detalheAberto"
        :agendamento="aberto"
        :fuso="fuso"
        :profissionais="profissionais"
        :salas="salas"
        :tipos="tipos"
        :pode-escrever="podeEscrever"
        :pode-obito="podeObito"
        :hoje="hoje"
        :relogio="relogio"
        @mudou="mudouNaGaveta"
        @alterado="alterado"
        @retorno="marcarRetorno"
        @justificado="justificado"
        @obito="avisarObito"
      />

      <Dialog
        v-model:visible="fecharTurnoAberto"
        modal
        :header="t('faltas.lote.titulo')"
        :style="{ width: 'min(30rem, calc(100vw - 32px))' }"
      >
        <p class="ag__confirmar">
          {{ t('faltas.lote.pergunta', { n: semChegada.length }, semChegada.length) }}
        </p>
        <ul class="ag__turno">
          <li v-for="item in semChegada" :key="item.id">
            <span class="ui-num">{{ item.inicio.slice(11, 16) }}</span>
            <bdi>{{ item.paciente.nome }}</bdi>
            <span class="ag__turno-com">{{
              profissionais.find((pessoa) => pessoa.id === item.profissionalId)?.nome ?? ''
            }}</span>
          </li>
        </ul>
        <template #footer>
          <Button
            type="button"
            severity="secondary"
            outlined
            :label="t('agendamentos.voltar')"
            :disabled="fechandoTurno"
            @click="fecharTurnoAberto = false"
          />
          <Button
            type="button"
            icon="ph ph-user-minus"
            :label="t('faltas.lote.confirmar')"
            :loading="fechandoTurno"
            @click="fecharTurno"
          />
        </template>
      </Dialog>

      <MarcarGaveta
        v-if="podeEscrever"
        v-model:visible="marcarAberto"
        :inicio="inicioDaMarcacao"
        :fuso="fuso"
        :profissionais="profissionaisQueMarcam"
        :salas="salas"
        :tipos="tipos"
        @marcado="marcado"
      />

      <Dialog
        :visible="Boolean(aConfirmar)"
        modal
        :header="t('agendamentos.fechadoTitulo')"
        :style="{ width: 'min(28rem, calc(100vw - 32px))' }"
        @update:visible="(valor: boolean) => !valor && (aConfirmar = null)"
      >
        <p class="ag__confirmar">{{ aConfirmar?.frase }}</p>
        <template #footer>
          <Button
            type="button"
            severity="secondary"
            outlined
            :label="t('agendamentos.voltar')"
            :disabled="movendo"
            @click="aConfirmar = null"
          />
          <Button
            type="button"
            :label="t('agendamentos.mudar.mesmoAssim')"
            :loading="movendo"
            @click="aConfirmar && moverPelaGrade(aConfirmar.movimento, true)"
          />
        </template>
      </Dialog>

      <DesfazerNaAgenda
        :feito="feito"
        :desfazendo="desfazendo"
        @desfazer="desfazer"
        @sumiu="feito = null"
      />
    </template>
  </UiPagina>
</template>

<style scoped>
.ag {
  display: grid;
  gap: 16px;
}

.ag__barra {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 16px;
}

.ag__onde,
.ag__como {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.ag__data :deep(.p-button-label) {
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}

.ag__exibicao {
  display: grid;
  gap: 14px;
  min-width: 16rem;
}

.ag__opcao {
  display: grid;
  gap: 6px;
}

.ag__rotulo {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 600;
}

.ag__chave {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--tinta);
  font-size: 14px;
  cursor: pointer;
}

.ag__aviso {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  padding: 12px 16px;
  color: var(--tinta);
  font-size: 14px;
}

.ag__aviso > span:nth-child(2) {
  flex: 1;
}

.ag__folha {
  display: grid;
  gap: 12px;
  padding: 16px;
  transition: opacity 150ms ease-out;
}

.ag__folha--lendo {
  opacity: 0.7;
}

.ag__vazio .p-button {
  justify-self: center;
}

.ag__turno {
  display: grid;
  max-height: 16rem;
  margin: 12px 0 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.ag__turno li {
  display: grid;
  align-items: baseline;
  gap: 10px;
  padding: 8px 0;
  color: var(--tinta);
  font-size: 14px;
  grid-template-columns: auto minmax(0, 1fr) auto;
}

.ag__turno li + li {
  border-top: 1px solid var(--app-regua, var(--linha-suave));
}

.ag__turno .ui-num,
.ag__turno-com {
  color: var(--tinta-2);
  font-size: 13px;
}

.ag__confirmar {
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
}

@media (prefers-reduced-motion: reduce) {
  .ag__folha {
    transition: none;
  }
}
</style>
