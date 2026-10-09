<script setup lang="ts">
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import PartnerOperabilityBanner from '@/components/parceiro/PartnerOperabilityBanner.vue'
import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import PartnerPanelLoading from '@/components/parceiro/PartnerPanelLoading.vue'
import PartnerSectionTabs from '@/components/parceiro/PartnerSectionTabs.vue'
import VincularCodigoDialog from '@/components/parceiro/VincularCodigoDialog.vue'
import { useAgora } from '@/composables/useAgora'
import { useRevalidarAoVoltar } from '@/composables/useRevalidarAoVoltar'
import { isGuidanceVisible } from '@/composables/useLayoutPreferences'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { usePartnerTabs } from '@/composables/usePartnerTabs'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import { getCompartilhamentos } from '@/service/parceiro/compartilhamentos-service'
import {
  MAX_BUSCA_PACIENTES,
  type CompartilhamentoDetalhe,
  type CompartilhamentoResumo,
  type EspeciePet,
  type OrdenacaoPacientes,
  type TipoServicoPrestador,
} from '@/service/parceiro/types'
import { currentColors } from '@/theme/color-mode'
import { calcularTempoRestante } from '@/utils/format/expiracao'
import { carimboDoResumo } from '@/utils/parceiro/snapshot-compartilhado'

const ATENDIMENTO_TABS = ['ativos', 'historico'] as const
type AtendimentoTab = (typeof ATENDIMENTO_TABS)[number]

const PAGE_SIZE = 20
/** Espera entre teclas antes de ir à rede: a busca dispara a cada digitação. */
const BUSCA_DEBOUNCE_MS = 350

const ESPECIES: EspeciePet[] = ['CACHORRO', 'GATO', 'AVE', 'ROEDOR', 'COELHO', 'PEIXE', 'REPTIL']
const TIPOS_SERVICO: TipoServicoPrestador[] = [
  'BANHO',
  'TOSA',
  'CONSULTA',
  'EXAME',
  'HOTEL',
  'OUTRO',
]
const ORDENACOES: OrdenacaoPacientes[] = ['recentes', 'nome', 'expiraEm']

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const { store, ensureContext, parceiroQuery } = useParceiroPortal()
const { activeTab, setTab } = usePartnerTabs(ATENDIMENTO_TABS, 'ativos')
const agora = useAgora()

const items = ref<CompartilhamentoResumo[]>([])
/** Cursor único: o servidor resolve status, filtros e ordem numa consulta só. */
const cursor = ref<string | null>(null)
const loading = ref(true)
const loadingMore = ref(false)
const error = ref('')

const vincularVisible = ref(false)

const filtros = reactive({
  q: '',
  especie: null as EspeciePet | null,
  tipoServico: null as TipoServicoPrestador | null,
  ordenarPor: 'recentes' as OrdenacaoPacientes,
  comProntuario: false,
  vinculadoDe: '',
  vinculadoAte: '',
})

const temFiltroAtivo = computed(
  () =>
    Boolean(filtros.q.trim()) ||
    filtros.especie != null ||
    filtros.tipoServico != null ||
    filtros.ordenarPor !== 'recentes' ||
    filtros.comProntuario ||
    Boolean(filtros.vinculadoDe) ||
    Boolean(filtros.vinculadoAte),
)

/**
 * Data do resumo quando o responsável o regerou depois de entregar o acesso.
 * String vazia quando o resumo ainda é o da criação: aí não há o que avisar.
 */
function resumoAtualizado(item: CompartilhamentoResumo) {
  const carimbo = carimboDoResumo(item)

  if (!carimbo.atualizado) {
    return ''
  }

  return new Date(carimbo.data).toLocaleDateString(INTL_LOCALE[locale.value as Locale])
}

const especieOptions = computed(() =>
  ESPECIES.map((value) => ({ value, label: t(`acessos.especie.${value}`) })),
)

const tipoServicoOptions = computed(() =>
  TIPOS_SERVICO.map((value) => ({ value, label: t(`acessos.servico.${value}`) })),
)

const ordenacaoOptions = computed(() =>
  ORDENACOES.map((value) => ({ value, label: t(`acessos.filtros.ordem.${value}`) })),
)

const ordenacaoLabel = computed(() => t(`acessos.filtros.ordem.${filtros.ordenarPor}`))

/** O grupo de datas é um filtro só; o leitor de tela anuncia assim. */
const periodoAriaLabel = computed(() => t('acessos.filtros.periodo'))

/** `AAAA-MM-DD` no fuso local: o `toISOString` mudaria o dia para quem está a oeste de Greenwich. */
function paraTextoDeData(data: Date | null | undefined): string {
  if (!data) {
    return ''
  }

  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')

  return `${data.getFullYear()}-${mes}-${dia}`
}

function paraData(texto: string): Date | null {
  if (!texto) {
    return null
  }

  const [ano, mes, dia] = texto.split('-').map(Number)

  return new Date(ano!, mes! - 1, dia!)
}

/**
 * O período num calendário só, do PrimeVue, em vez de dois campos de data do navegador: cada
 * navegador desenha o seu, fora da paleta, e o intervalo se escolhe num clique duplo.
 */
const periodo = computed<Array<Date | null> | null>({
  get: () =>
    filtros.vinculadoDe || filtros.vinculadoAte
      ? [paraData(filtros.vinculadoDe), paraData(filtros.vinculadoAte)]
      : null,
  set: (valor) => {
    filtros.vinculadoDe = paraTextoDeData(valor?.[0])
    filtros.vinculadoAte = paraTextoDeData(valor?.[1])
  },
})

/**
 * A lista do Select é teleportada para fora da `.partner-page`, então não herda os
 * tokens `--partner-*`: eles vão junto no `pt`. Sem isso o painel cai no fundo claro
 * que o preset do PrimeVue usa para superfície de formulário no dark.
 */
const selectPt = computed(() => {
  const colors = currentColors.value

  return {
    overlay: {
      class: 'atend-filtros__overlay',
      style: {
        '--atend-ov-bg': colors.dashboard.surface,
        '--atend-ov-line': colors.dashboard.line,
        '--atend-ov-text': colors.dashboard.text,
        '--atend-ov-muted': colors.dashboard.muted,
        '--atend-ov-hover': colors.dashboard.surfaceSoft,
        '--atend-ov-selected-bg': colors.dashboard.successBg,
        '--atend-ov-selected-text': colors.dashboard.successText,
      },
    },
  }
})

const tabs = computed(() => [
  {
    id: 'ativos',
    label: t('acessos.tabs.ativos.label'),
  },
  {
    id: 'historico',
    label: t('acessos.tabs.historico.label'),
  },
])

const tabsAriaLabel = computed(() =>
  t('frame.tabs.aria', { labels: tabs.value.map((tab) => tab.label).join(', ') }),
)

const hasMore = computed(() => cursor.value != null)

const loadError = computed(() =>
  store.loadState === 'error' && !store.semAcessoParceiro ? store.errorMessage : '',
)

/**
 * Digitar rápido dispara várias buscas; a resposta lenta de uma tecla antiga pode
 * chegar depois da nova e sobrescrever a lista. Só a requisição mais recente
 * escreve no estado.
 */
let requestId = 0

/** `YYYY-MM-DD` do input vira ISO no fuso local; vazio some da query. */
function dataFiltro(valor: string) {
  if (!valor.trim()) {
    return undefined
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor.trim())

  if (!match) {
    return undefined
  }

  const data = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))

  return Number.isNaN(data.getTime()) ? undefined : data.toISOString()
}

function queryAtual(cursorAtual?: string) {
  return {
    ...parceiroQuery(),
    // O histórico usa o status virtual: um cursor só para expirados e revogados.
    status: activeTab.value === 'ativos' ? ('ATIVO' as const) : ('ENCERRADO' as const),
    q: filtros.q.trim() || undefined,
    especie: filtros.especie ?? undefined,
    tipoServico: filtros.tipoServico ?? undefined,
    ordenarPor: filtros.ordenarPor,
    comProntuario: filtros.comProntuario || undefined,
    vinculadoDe: dataFiltro(filtros.vinculadoDe),
    vinculadoAte: dataFiltro(filtros.vinculadoAte),
    cursor: cursorAtual,
    limit: PAGE_SIZE,
  }
}

/**
 * `silencioso` é a releitura de fundo — a que acontece ao voltar para a aba.
 *
 * Ela troca a lista quando dá certo e não faz nada quando dá errado: acender o spinner ou
 * esvaziar a lista por causa de uma falha de rede em segundo plano tiraria da tela dados que
 * continuavam bons.
 */
async function loadFirstPage(silencioso = false) {
  const id = ++requestId

  if (!silencioso) {
    loading.value = true
    error.value = ''
  }

  try {
    await ensureContext()
    const page = await getCompartilhamentos(queryAtual())

    if (id !== requestId) {
      return
    }

    items.value = page.data
    cursor.value = page.meta.proximoCursor ?? null

    // A releitura de fundo não mexe no que a pessoa abriu.
    if (!silencioso) {
      abrirOPrimeiroGrupo()
    }
  } catch (err) {
    if (id !== requestId || silencioso) {
      return
    }

    items.value = []
    cursor.value = null

    /** 403 aqui pode ser o parceiro excluído no meio da sessão: a tela de saída assume. */
    if (await store.revalidarAcesso(err)) {
      return
    }

    error.value = err instanceof Error ? err.message : t('acessos.list.errorLoad')
  } finally {
    if (id === requestId && !silencioso) {
      loading.value = false
    }
  }
}

async function loadMore() {
  if (loadingMore.value || cursor.value == null) {
    return
  }

  const id = requestId
  loadingMore.value = true

  try {
    const page = await getCompartilhamentos(queryAtual(cursor.value))

    // Filtro trocado no meio do carregamento: a página velha não entra na lista.
    if (id !== requestId) {
      return
    }

    // A ordem vem do servidor (`ordenarPor`): concatenar, nunca reordenar aqui.
    items.value = [...items.value, ...page.data]
    cursor.value = page.meta.proximoCursor ?? null
  } catch (err) {
    if (id === requestId) {
      error.value = err instanceof Error ? err.message : t('acessos.list.errorLoad')
    }
  } finally {
    loadingMore.value = false
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | undefined

function agendarBusca() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    void loadFirstPage()
  }, BUSCA_DEBOUNCE_MS)
}

function limparFiltros() {
  filtros.q = ''
  filtros.especie = null
  filtros.tipoServico = null
  filtros.ordenarPor = 'recentes'
  filtros.comProntuario = false
  filtros.vinculadoDe = ''
  filtros.vinculadoAte = ''
}

function servicoLabel(item: CompartilhamentoResumo) {
  if (item.tipoServico === 'OUTRO' && item.servicoOutroLabel) {
    return item.servicoOutroLabel
  }

  return t(`acessos.servico.${item.tipoServico}`)
}

/**
 * Prazo do card: contagem regressiva enquanto o acesso vive, data de encerramento
 * depois. No histórico a data solta com ícone de relógio parecia contagem viva;
 * dizer "encerrado em" custa uma palavra e tira a dúvida.
 */
function prazoLabel(item: CompartilhamentoResumo) {
  if (item.status !== 'ATIVO') {
    return t('acessos.list.encerradoEm', {
      data: new Date(item.expiraEm).toLocaleDateString(INTL_LOCALE[locale.value as Locale]),
    })
  }

  const restante = calcularTempoRestante(item.expiraEm, agora.value)

  switch (restante.estado) {
    case 'dias':
      return t('acessos.expira.dias', { d: restante.dias, h: restante.horas })
    case 'horas':
      return t('acessos.expira.horas', { h: restante.horas, m: restante.minutos })
    case 'minutos':
      return t('acessos.expira.minutos', { m: restante.minutos })
    default:
      return t('acessos.expira.expirado')
  }
}

/**
 * Só o acesso que fecha hoje ganha âmbar. Pintar toda contagem de alerta fazia a
 * lista inteira gritar, e aí nenhum card gritava.
 */
function prazoUrgente(item: CompartilhamentoResumo) {
  if (item.status !== 'ATIVO') {
    return false
  }

  return calcularTempoRestante(item.expiraEm, agora.value).estado !== 'dias'
}

/** Ativo, expirado ou revogado — o que o parceiro precisa ler, sem apelido de auditoria. */
function statusLabel(item: CompartilhamentoResumo) {
  return t(`acessos.list.status.${item.status}`)
}

/**
 * Selo do lado direito da linha. No histórico é o desfecho (expirado ou revogado), em cinza: a
 * aba já diz que está encerrado. Nos ativos é o prazo — e só o que vence em menos de um dia pinta.
 */
function seloDoAcesso(item: CompartilhamentoResumo) {
  if (item.status === 'ATIVO') {
    return { texto: prazoLabel(item), tom: prazoUrgente(item) ? 'hc--pessego' : 'hc--cinza' }
  }

  return { texto: statusLabel(item), tom: 'hc--cinza' }
}

/** Serviço e prazo, a frase da linha: "Banho · encerrado em 12/09/2026". */
function fraseDoAcesso(item: CompartilhamentoResumo) {
  if (item.status === 'ATIVO') {
    return servicoLabel(item)
  }

  return `${servicoLabel(item)} · ${t('acessos.grupo.encerradoEm', { data: dataCurta(item.expiraEm) })}`
}

function dataCurta(iso: string) {
  return new Date(iso).toLocaleDateString(INTL_LOCALE[locale.value as Locale])
}

type FatoDoAcesso = {
  id: string
  icone: string
  /** O que aparece; vazio quando o ícone basta. */
  texto: string
  /** A frase inteira, para o leitor de tela e o `title`. */
  rotulo: string
  /** `oculto` guarda a vaga do fato ausente: os números ficam em coluna de linha a linha. */
  tom?: 'vazio' | 'alerta' | 'oculto'
}

/**
 * Os fatos do acesso viram ícone com número, sempre na mesma ordem e na mesma vaga. Zero anotações
 * continua aparecendo, apagado: é a pergunta que o parceiro faz ao abrir o histórico ("já anotei
 * algo aqui?"). O alerta de resumo vem antes, à esquerda, para não empurrar as colunas.
 */
function fatosDoAcesso(item: CompartilhamentoResumo): FatoDoAcesso[] {
  const fatos: FatoDoAcesso[] = []

  // O responsável mexeu depois de entregar: o que foi lido ontem pode não valer mais.
  const atualizado = resumoAtualizado(item)

  if (atualizado) {
    const rotulo = t('acessos.list.resumoAtualizado', { data: atualizado })
    fatos.push({ id: 'resumo', icone: 'ph ph-arrow-clockwise', texto: rotulo, rotulo, tom: 'alerta' })
  }

  fatos.push(
    {
      id: 'anotacoes',
      icone: 'ph ph-chat-circle',
      texto: String(item.totalAnotacoes),
      rotulo: t('acessos.list.anotacoes', { n: item.totalAnotacoes }, item.totalAnotacoes),
      tom: item.totalAnotacoes ? undefined : 'vazio',
    },
    {
      id: 'documentos',
      icone: 'ph ph-file',
      texto: String(item.totalDocumentos),
      rotulo: t('acessos.list.documentos', { n: item.totalDocumentos }, item.totalDocumentos),
      tom: item.totalDocumentos ? undefined : 'oculto',
    },
    {
      id: 'diario',
      icone: 'ph ph-book-open',
      texto: '',
      rotulo: t('acessos.list.diario'),
      tom: item.temDiario ? undefined : 'oculto',
    },
  )

  return fatos
}

type GrupoDoPet = {
  chave: string
  petNome: string
  especieLabel: string
  petFoto: string | null
  acessos: CompartilhamentoResumo[]
}

/**
 * A listagem não traz o id do pet, então o grupo junta nome, espécie e foto. Dois pets homônimos,
 * da mesma espécie e sem foto, caem no mesmo grupo — cada linha de acesso continua abrindo o
 * acesso certo, só a contagem do grupo soma os dois.
 */
function chaveDoPet(item: CompartilhamentoResumo) {
  return [item.petNome.trim().toLocaleLowerCase(), item.especie, item.petFoto ?? ''].join('|')
}

/** Um pet, uma linha. A ordem dos grupos é a do primeiro acesso de cada um, que vem do servidor. */
const grupos = computed<GrupoDoPet[]>(() => {
  const mapa = new Map<string, GrupoDoPet>()

  for (const item of items.value) {
    const chave = chaveDoPet(item)
    const grupo = mapa.get(chave)

    if (grupo) {
      grupo.acessos.push(item)
    } else {
      mapa.set(chave, {
        chave,
        petNome: item.petNome,
        especieLabel: item.especieLabel,
        petFoto: item.petFoto,
        acessos: [item],
      })
    }
  }

  return [...mapa.values()]
})

/** Quantos acessos um grupo aberto mostra antes do "ver os outros". */
const ACESSOS_VISIVEIS = 3

const gruposAbertos = ref(new Set<string>())
const gruposCompletos = ref(new Set<string>())

function alternarGrupo(chave: string) {
  const abertos = new Set(gruposAbertos.value)

  if (!abertos.delete(chave)) {
    abertos.add(chave)
  }

  gruposAbertos.value = abertos
}

function mostrarTodos(chave: string) {
  gruposCompletos.value = new Set(gruposCompletos.value).add(chave)
}

function acessosVisiveis(grupo: GrupoDoPet) {
  return gruposCompletos.value.has(grupo.chave)
    ? grupo.acessos
    : grupo.acessos.slice(0, ACESSOS_VISIVEIS)
}

/** Lista nova começa com o primeiro pet aberto, se ele tiver mais de um acesso; o resto recolhido. */
function abrirOPrimeiroGrupo() {
  const primeiro = grupos.value[0]

  gruposAbertos.value = new Set(primeiro && primeiro.acessos.length > 1 ? [primeiro.chave] : [])
  gruposCompletos.value = new Set()
}

/**
 * A linha de um pet com vários acessos. Nos ativos, o prazo mais curto (é o que pede ação); no
 * histórico, a última data e o que a empresa deixou registrado.
 */
function resumoDoGrupo(grupo: GrupoDoPet) {
  const n = grupo.acessos.length
  const partes = [t('acessos.grupo.acessos', { n }, n)]

  if (activeTab.value === 'ativos') {
    const proximo = grupo.acessos.reduce((menor, item) =>
      item.expiraEm < menor.expiraEm ? item : menor,
    )

    partes.push(t('acessos.grupo.proximo', { prazo: prazoLabel(proximo) }))
  } else {
    const ultimo = grupo.acessos.reduce((maior, item) =>
      item.expiraEm > maior.expiraEm ? item : maior,
    )

    partes.push(t('acessos.grupo.ultimoEncerrado', { data: dataCurta(ultimo.expiraEm) }))
  }

  const anotacoes = grupo.acessos.reduce((soma, item) => soma + item.totalAnotacoes, 0)
  const documentos = grupo.acessos.reduce((soma, item) => soma + item.totalDocumentos, 0)
  const registros = [
    anotacoes ? t('acessos.list.anotacoes', { n: anotacoes }, anotacoes) : '',
    documentos ? t('acessos.list.documentos', { n: documentos }, documentos) : '',
  ].filter(Boolean)

  if (registros.length) {
    partes.push(registros.join(', '))
  }

  return partes.join(' · ')
}

/** Um grupo com algum acesso que vence em menos de um dia: o ícone avisa mesmo recolhido. */
function grupoUrgente(grupo: GrupoDoPet) {
  return grupo.acessos.some(prazoUrgente)
}

function iniciais(nome: string) {
  return nome.trim().slice(0, 2).toLocaleUpperCase()
}

/** Filtros fora da busca: a busca fica à vista, o resto recolhe atrás do botão. */
const filtrosLigados = computed(
  () =>
    [
      filtros.especie != null,
      filtros.tipoServico != null,
      filtros.ordenarPor !== 'recentes',
      filtros.comProntuario,
      Boolean(filtros.vinculadoDe || filtros.vinculadoAte),
    ].filter(Boolean).length,
)

const filtrosAbertos = ref(false)

/**
 * A frase da saudação. Nos ativos, quantos acessos estão valendo e quantos vencem logo; no
 * histórico, de quantos pets. Com filtro ligado vira "encontrados" — a contagem é do recorte.
 */
const fraseDoResumo = computed(() => {
  if (loading.value || error.value) {
    return ''
  }

  if (temFiltroAtivo.value) {
    const pets = grupos.value.length
    return t('acessos.saudacao.encontrados', { n: pets }, pets)
  }

  if (activeTab.value === 'ativos') {
    const n = items.value.length
    const base = hasMore.value
      ? t('acessos.saudacao.ativosMais', { n })
      : t('acessos.saudacao.ativos', { n }, n)
    const urgentes = items.value.filter(prazoUrgente).length

    return urgentes
      ? `${base} · ${t('acessos.saudacao.vencemLogo', { n: urgentes }, urgentes)}`
      : base
  }

  const pets = grupos.value.length

  return hasMore.value
    ? t('acessos.saudacao.historicoRecente', { n: pets }, pets)
    : t('acessos.saudacao.historico', { n: pets }, pets)
})

function openDetalhe(id: string) {
  void router.push(`/parceiro/acessos/${id}`)
}

function onVinculado(detalhe: CompartilhamentoDetalhe) {
  void router.push(`/parceiro/acessos/${detalhe.id}`)
}

watch(activeTab, () => {
  void loadFirstPage()
})

/** Busca é debounced; os demais filtros são discretos e vão direto. */
watch(() => filtros.q, agendarBusca)

watch(
  () => [
    filtros.especie,
    filtros.tipoServico,
    filtros.ordenarPor,
    filtros.comProntuario,
    filtros.vinculadoDe,
    filtros.vinculadoAte,
  ],
  () => {
    clearTimeout(debounceTimer)
    void loadFirstPage()
  },
)

onUnmounted(() => {
  clearTimeout(debounceTimer)
})

onMounted(() => {
  // Deep link legado: ?atendimento=:id virou rota própria de detalhe.
  const deepLink = route.query.atendimento

  if (typeof deepLink === 'string' && deepLink) {
    void router.replace(`/parceiro/acessos/${deepLink}`)
    return
  }

  void loadFirstPage()
})

/**
 * Mesma razão do detalhe: a validade de um acesso pode ter encurtado sem aviso, e esta lista
 * mostra contagem regressiva. Relendo na volta, o número volta a valer.
 */
useRevalidarAoVoltar(() => void loadFirstPage(true))
</script>

<template>
  <PartnerPageFrame
    class="hc-tema"
    :subtitle="t('acessos.subtitle')"
    :title="t('acessos.title')"
    :loading="false"
    :error="loadError"
    :no-partner-access="store.semAcessoParceiro"
    guidance
    @retry="ensureContext(true)"
  >
    <template #cabecalho>
      <div class="hc-saudacao">
        <p class="hc-saudacao__data">{{ t('acessos.subtitle') }}</p>
        <h1 class="hc-saudacao__titulo">{{ t('acessos.title') }}</h1>

        <div class="hc-saudacao__linha">
          <p v-if="fraseDoResumo" class="hc-saudacao__resumo" aria-live="polite">
            {{ fraseDoResumo }}
          </p>

          <nav class="hc-acoes" :aria-label="t('acessos.saudacao.acoes')">
            <Button
              type="button"
              class="hc-pilula hc-pilula--cheia"
              :label="t('acessos.vincular.cta')"
              icon="ph ph-link"
              :disabled="!store.podeOperar"
              :title="!store.podeOperar ? t('acessos.vincular.bloqueado') : undefined"
              @click="vincularVisible = true"
            />
          </nav>
        </div>
      </div>
    </template>

    <!-- Leitura não é gated por auditoria (seção 4): suspenso lê a lista e o
         prontuário, e perde só o claim e a anotação. O banner explica no lugar
         do gate de página cheia. -->
    <PartnerOperabilityBanner cover-suspended />

    <p v-if="isGuidanceVisible" class="atend-lede">{{ t('acessos.lede') }}</p>

    <!-- Abas, busca e filtros numa linha só: antes eram três faixas empilhadas antes do
         primeiro pet aparecer. Os filtros finos recolhem atrás do botão. -->
    <div class="atend-barra">
      <PartnerSectionTabs
        class="atend-barra__abas"
        :tabs="tabs"
        :active-tab="activeTab"
        :aria-label="tabsAriaLabel"
        @select="setTab($event as AtendimentoTab)"
      />

      <label class="atend-filtros__sr" for="atend-q">{{ t('acessos.filtros.q') }}</label>
      <span class="atend-barra__busca">
        <i class="ph ph-magnifying-glass" aria-hidden="true" />
        <InputText
          id="atend-q"
          v-model="filtros.q"
          :maxlength="MAX_BUSCA_PACIENTES"
          :placeholder="t('acessos.filtros.qPlaceholder')"
          autocomplete="off"
        />
      </span>

      <Button
        type="button"
        class="atend-barra__filtros"
        :label="t('acessos.filtros.botao')"
        icon="ph ph-sliders-horizontal"
        severity="secondary"
        outlined
        :badge="filtrosLigados ? String(filtrosLigados) : undefined"
        :aria-expanded="filtrosAbertos"
        aria-controls="atend-filtros"
        @click="filtrosAbertos = !filtrosAbertos"
      />
    </div>

    <!-- Rótulos existem para leitor de tela, mas ficam ocultos: cinco textos
         empilhados sobre controles pequenos viram ruído. Cada controle carrega o
         próprio nome no placeholder. v-show: o alvo do `aria-controls` existe sempre. -->
    <section
      v-show="filtrosAbertos"
      id="atend-filtros"
      class="atend-filtros"
      :aria-label="t('acessos.filtros.aria')"
    >
      <label class="atend-filtros__sr" for="atend-especie">
        {{ t('acessos.filtros.especie') }}
      </label>
      <Select
        id="atend-especie"
        v-model="filtros.especie"
        class="atend-filtros__select"
        :options="especieOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('acessos.filtros.especie')"
        show-clear
        size="small"
        :pt="selectPt"
      />

      <label class="atend-filtros__sr" for="atend-tipo">
        {{ t('acessos.filtros.tipoServico') }}
      </label>
      <Select
        id="atend-tipo"
        v-model="filtros.tipoServico"
        class="atend-filtros__select"
        :options="tipoServicoOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('acessos.filtros.tipoServico')"
        show-clear
        size="small"
        :pt="selectPt"
      />

      <label class="atend-filtros__sr" for="atend-ordem">
        {{ t('acessos.filtros.ordenarPor') }}
      </label>
      <Select
        id="atend-ordem"
        v-model="filtros.ordenarPor"
        class="atend-filtros__select"
        :options="ordenacaoOptions"
        option-label="label"
        option-value="value"
        size="small"
        :pt="selectPt"
      >
        <!-- Ordenação sempre tem valor, então o placeholder nunca aparece:
             o ícone é o que diz que aquele controle é a ordem da lista. -->
        <template #value>
          <span class="atend-filtros__ordem">
            <i class="ph ph-arrows-down-up" aria-hidden="true" />
            {{ ordenacaoLabel }}
          </span>
        </template>
      </Select>

      <!-- Filtro binário: acesso com prontuário pede leitura antes do
           atendimento, acesso só de identidade não. `aria-pressed` porque é
           um estado que fica ligado, não uma ação que dispara e passa. -->
      <Button
        type="button"
        class="atend-filtros__toggle"
        :class="{ 'atend-filtros__toggle--on': filtros.comProntuario }"
        icon="ph ph-folder-open"
        :label="t('acessos.filtros.comProntuario')"
        severity="secondary"
        outlined
        :aria-pressed="filtros.comProntuario"
        @click="filtros.comProntuario = !filtros.comProntuario"
      />

      <div class="atend-filtros__periodo" role="group" :aria-label="periodoAriaLabel">
        <span class="atend-filtros__periodo-label" aria-hidden="true">
          {{ t('acessos.filtros.periodo') }}
        </span>
        <label class="atend-filtros__sr" for="atend-periodo">
          {{ t('acessos.filtros.periodo') }}
        </label>
        <DatePicker
          panel-class="hc-tema"
          v-model="periodo"
          input-id="atend-periodo"
          selection-mode="range"
          :manual-input="false"
          date-format="dd/mm/yy"
          show-icon
          show-button-bar
          class="atend-filtros__date"
        />
      </div>

      <Button
        v-if="temFiltroAtivo"
        class="atend-filtros__limpar"
        :label="t('acessos.filtros.limpar')"
        icon="ph ph-funnel-x"
        severity="secondary"
        text
        size="small"
        @click="limparFiltros"
      />
    </section>

    <div
      :id="`partner-panel-${activeTab}`"
      class="atend-panel"
      role="tabpanel"
      :aria-labelledby="`partner-tab-${activeTab}`"
    >
      <PartnerPanelLoading
        v-if="loading"
        :title="t('acessos.list.loadingTitle')"
        :description="t('acessos.list.loadingDesc')"
      />

      <div v-else-if="error" class="hc atend-state atend-state--error" role="alert">
        <p>{{ error }}</p>
        <Button :label="t('common.retry')" severity="secondary" @click="loadFirstPage()" />
      </div>

      <!-- Vazio por filtro é outro problema do usuário: a saída é limpar o filtro,
           não vincular um código novo. -->
      <div
        v-else-if="items.length === 0 && temFiltroAtivo"
        class="hc atend-state atend-state--empty"
      >
        <i class="ph ph-funnel-x" aria-hidden="true" />
        <strong>{{ t('acessos.list.emptyFiltroTitle') }}</strong>
        <p>{{ t('acessos.list.emptyFiltroBody') }}</p>
        <Button
          :label="t('acessos.filtros.limpar')"
          icon="ph ph-funnel-x"
          severity="secondary"
          @click="limparFiltros"
        />
      </div>

      <!-- Sem título: a saudação já diz "Nenhum acesso ativo"; aqui fica só o que fazer. -->
      <div v-else-if="items.length === 0" class="hc atend-state atend-state--empty">
        <i class="ph ph-tray" aria-hidden="true" />
        <p>
          {{
            activeTab === 'ativos'
              ? t('acessos.list.emptyAtivosBody')
              : t('acessos.list.emptyHistoricoBody')
          }}
        </p>
      </div>

      <template v-else>
        <!-- Um pet, uma linha, num cartão só. O Marsh com onze acessos era onze cartões iguais. -->
        <ul class="hc atend-lista" :class="{ 'atend-lista--ativos': activeTab === 'ativos' }">
          <li v-for="grupo in grupos" :key="grupo.chave" class="atend-grupo">
            <!-- Pet com um acesso: a linha já é o acesso, e abre direto. -->
            <Button
              v-if="grupo.acessos.length === 1"
              type="button"
              class="atend-linha atend-linha--pet"
              @click="openDetalhe(grupo.acessos[0]!.id)"
            >
              <span class="atend-foto" aria-hidden="true">
                <img v-if="grupo.petFoto" :src="grupo.petFoto" alt="" />
                <template v-else>{{ iniciais(grupo.petNome) }}</template>
              </span>

              <span class="atend-linha__corpo">
                <span class="atend-linha__nome">
                  <strong>{{ grupo.petNome }}</strong>
                  <span class="atend-linha__especie">· {{ grupo.especieLabel }}</span>
                </span>
                <span class="atend-linha__frase">{{ fraseDoAcesso(grupo.acessos[0]!) }}</span>
              </span>

              <span class="atend-linha__lado">
                <span class="atend-fatos">
                  <span
                    v-for="fato in fatosDoAcesso(grupo.acessos[0]!)"
                    :key="fato.id"
                    class="atend-fato"
                    :class="fato.tom ? `atend-fato--${fato.tom}` : undefined"
                    :title="fato.rotulo"
                  >
                    <i :class="fato.icone" aria-hidden="true" />
                    <span v-if="fato.texto" aria-hidden="true">{{ fato.texto }}</span>
                    <span class="atend-sr">{{ fato.rotulo }}</span>
                  </span>
                </span>
                <span class="hc-selo" :class="seloDoAcesso(grupo.acessos[0]!).tom">
                  {{ seloDoAcesso(grupo.acessos[0]!).texto }}
                </span>
                <i class="ph ph-caret-right atend-linha__seta" aria-hidden="true" />
              </span>
            </Button>

            <!-- Pet com vários acessos: a linha resume e abre a lista dele embaixo. -->
            <template v-else>
              <Button
                type="button"
                class="atend-linha atend-linha--pet"
                :aria-expanded="gruposAbertos.has(grupo.chave)"
                :aria-controls="`atend-grupo-${grupo.chave}`"
                @click="alternarGrupo(grupo.chave)"
              >
                <span class="atend-foto" aria-hidden="true">
                  <img v-if="grupo.petFoto" :src="grupo.petFoto" alt="" />
                  <template v-else>{{ iniciais(grupo.petNome) }}</template>
                </span>

                <span class="atend-linha__corpo">
                  <span class="atend-linha__nome">
                    <strong>{{ grupo.petNome }}</strong>
                    <span class="atend-linha__especie">· {{ grupo.especieLabel }}</span>
                    <i
                      v-if="grupoUrgente(grupo)"
                      class="ph ph-clock atend-linha__urgente"
                      :title="t('acessos.grupo.venceLogo')"
                      :aria-label="t('acessos.grupo.venceLogo')"
                    />
                  </span>
                  <span class="atend-linha__frase">{{ resumoDoGrupo(grupo) }}</span>
                </span>

                <span class="atend-linha__alternar">
                  {{
                    gruposAbertos.has(grupo.chave)
                      ? t('acessos.grupo.recolher')
                      : t('acessos.grupo.verAcessos')
                  }}
                  <i
                    class="ph"
                    :class="gruposAbertos.has(grupo.chave) ? 'ph-caret-up' : 'ph-caret-down'"
                    aria-hidden="true"
                  />
                </span>
              </Button>

              <Transition name="atend-abre">
                <ul
                  v-show="gruposAbertos.has(grupo.chave)"
                  :id="`atend-grupo-${grupo.chave}`"
                  class="atend-sublista"
                  :aria-label="grupo.petNome"
                >
                  <li v-for="item in acessosVisiveis(grupo)" :key="item.id">
                    <Button
                      type="button"
                      class="atend-linha atend-linha--acesso"
                      @click="openDetalhe(item.id)"
                    >
                      <span class="atend-linha__frase atend-linha__frase--acesso">
                        <strong>{{ servicoLabel(item) }}</strong>
                        <template v-if="item.status !== 'ATIVO'">
                          · {{ t('acessos.grupo.encerradoEm', { data: dataCurta(item.expiraEm) }) }}
                        </template>
                      </span>

                      <span class="atend-linha__lado">
                        <span class="atend-fatos">
                          <span
                            v-for="fato in fatosDoAcesso(item)"
                            :key="fato.id"
                            class="atend-fato"
                            :class="fato.tom ? `atend-fato--${fato.tom}` : undefined"
                            :title="fato.rotulo"
                          >
                            <i :class="fato.icone" aria-hidden="true" />
                            <span v-if="fato.texto" aria-hidden="true">{{ fato.texto }}</span>
                            <span class="atend-sr">{{ fato.rotulo }}</span>
                          </span>
                        </span>
                        <span class="hc-selo" :class="seloDoAcesso(item).tom">
                          {{ seloDoAcesso(item).texto }}
                        </span>
                        <i class="ph ph-caret-right atend-linha__seta" aria-hidden="true" />
                      </span>
                    </Button>
                  </li>

                  <li v-if="grupo.acessos.length > acessosVisiveis(grupo).length">
                    <Button
                      type="button"
                      class="atend-ver-outros"
                      :label="
                        t(
                          'acessos.grupo.verOutros',
                          {
                            n: grupo.acessos.length - acessosVisiveis(grupo).length,
                            pet: grupo.petNome,
                          },
                          grupo.acessos.length - acessosVisiveis(grupo).length,
                        )
                      "
                      text
                      size="small"
                      @click="mostrarTodos(grupo.chave)"
                    />
                  </li>
                </ul>
              </Transition>
            </template>
          </li>
        </ul>

        <div v-if="hasMore" class="atend-more">
          <Button
            :label="t('acessos.list.loadMore')"
            severity="secondary"
            outlined
            :loading="loadingMore"
            @click="loadMore"
          />
        </div>
      </template>
    </div>

    <VincularCodigoDialog v-model:visible="vincularVisible" @vinculado="onVinculado" />
  </PartnerPageFrame>
</template>

<style scoped>
.atend-lede {
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.94rem;
  line-height: 1.5;
}

.atend-sr,
.atend-filtros__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* Abas, busca e o botão de filtros numa linha; a busca ocupa o que sobra. */
.atend-barra {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.65rem;
}

.atend-barra .atend-barra__abas {
  flex: 0 0 auto;
  margin: 0;
}

.atend-barra__busca {
  position: relative;
  display: block;
  flex: 1 1 16rem;
  min-width: 0;
}

.atend-barra__busca i {
  position: absolute;
  top: 50%;
  inset-inline-start: 0.85rem;
  transform: translateY(-50%);
  color: var(--hc-tinta-2);
  font-size: 0.82rem;
  pointer-events: none;
}

.atend-barra__busca :deep(.p-inputtext) {
  width: 100%;
  min-height: 2.6rem;
  padding-inline-start: 2.3rem;
  border: 1px solid var(--hc-borda);
  border-radius: 999px;
  background: var(--hc-cartao);
  color: var(--hc-tinta);
}

.atend-barra__busca :deep(.p-inputtext::placeholder) {
  color: var(--hc-tinta-2);
  opacity: 1;
}

.atend-barra__busca :deep(.p-inputtext:focus) {
  border-color: var(--hc-marca);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--hc-marca) 18%, transparent);
}

.atend-barra__filtros.p-button {
  min-height: 2.6rem;
  border-radius: 999px;
}

/* O painel de filtros aberto: controles soltos, sem moldura própria — é ferramenta, não conteúdo. */
.atend-filtros {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
}

.atend-filtros__select {
  flex: 0 1 auto;
  width: auto;
  min-width: 8.5rem;
  border: 1px solid var(--hc-borda);
  border-radius: 0.7rem;
  background: var(--hc-cartao);
  color: var(--hc-tinta);
}

.atend-filtros__select:not(.p-disabled):hover {
  border-color: color-mix(in srgb, var(--hc-marca) 40%, var(--hc-borda));
}

.atend-filtros__select:not(.p-disabled).p-focus {
  border-color: var(--hc-marca);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--hc-marca) 18%, transparent);
}

.atend-filtros__select :deep(.p-select-label) {
  color: var(--hc-tinta);
  font-size: 0.82rem;
  font-weight: 600;
}

.atend-filtros__select :deep(.p-select-label.p-placeholder) {
  color: var(--hc-tinta-2);
  font-weight: 500;
}

.atend-filtros__select :deep(.p-select-dropdown),
.atend-filtros__select :deep(.p-select-clear-icon) {
  color: var(--hc-tinta-2);
}

.atend-filtros__ordem {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.atend-filtros__ordem i {
  color: var(--hc-marca-forte);
  font-size: 0.75rem;
}

/* Filtro liga/desliga (aria-pressed): Button com o mesmo desenho dos outros campos da barra. */
.atend-filtros__toggle.p-button {
  flex: 0 1 auto;
  gap: 0.4rem;
  min-height: 2.25rem;
  padding: 0 0.75rem;
  border-color: var(--hc-borda);
  border-radius: 0.7rem;
  background: var(--hc-cartao);
  color: var(--hc-tinta-2);
  font-size: 0.82rem;
}

.atend-filtros__toggle.p-button :deep(.p-button-label) {
  font-weight: 650;
}

.atend-filtros__toggle.p-button:not(:disabled):hover {
  border-color: color-mix(in srgb, var(--hc-marca) 40%, var(--hc-borda));
  background: var(--hc-cartao);
  color: var(--hc-tinta-2);
}

.atend-filtros__toggle--on.p-button,
.atend-filtros__toggle--on.p-button:not(:disabled):hover {
  border-color: var(--hc-marca);
  background: var(--hc-marca-clara);
  color: var(--hc-marca-forte);
}

/* Período é um filtro só: as duas datas vivem dentro da mesma cápsula. */
.atend-filtros__periodo {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
  padding-block: 0.2rem;
  padding-inline: 0.7rem 0.55rem;
  border: 1px solid var(--hc-borda);
  border-radius: 0.7rem;
  background: var(--hc-cartao);
}

.atend-filtros__periodo-label {
  color: var(--hc-tinta-2);
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
}

/*
 * O calendário do período, embutido na pílula: o campo sem moldura própria, o ícone ao lado.
 * A classe cai na raiz do DatePicker; o campo de texto é filho, por isso o `:deep`.
 */
.atend-filtros__date {
  min-width: 0;
}

.atend-filtros__date :deep(.p-datepicker-input) {
  width: 13.5rem;
  padding: 0.32rem 0.4rem;
  border: 0;
  border-radius: 0.45rem;
  background: transparent;
  box-shadow: none;
  color: var(--hc-tinta);
  font-size: 0.8rem;
  font-weight: 600;
}

.atend-filtros__date :deep(.p-datepicker-dropdown) {
  border: 0;
  background: transparent;
  color: var(--hc-tinta-2);
}

.atend-filtros__limpar {
  margin-inline-start: auto;
}

.atend-panel {
  display: grid;
  gap: 0.85rem;
}

.atend-state {
  display: grid;
  gap: 0.6rem;
  justify-items: center;
  padding: 2.2rem 1rem;
  color: var(--hc-tinta-2);
  text-align: center;
}

.atend-state--error p {
  margin: 0;
  color: var(--hc-coral-tinta);
}

.atend-state--empty i {
  font-size: 1.4rem;
  color: var(--hc-marca-forte);
}

.atend-state--empty strong {
  color: var(--hc-tinta);
}

.atend-state--empty p {
  margin: 0;
  max-width: 26rem;
  font-size: 0.88rem;
  line-height: 1.5;
}

/* A lista inteira num cartão; os pets se separam por linha, não por moldura. */
.atend-lista {
  display: grid;
  margin: 0;
  padding: 0.35rem 1.1rem;
  list-style: none;
}

.atend-grupo + .atend-grupo {
  border-top: 1px solid var(--hc-linha);
}

/* Linha clicável rica: Button com slot, sem o visual de CTA do preset. */
.atend-linha.p-button {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  width: 100%;
  padding: 0.85rem 0.35rem;
  border: 0;
  border-radius: 0.6rem;
  background: transparent;
  color: inherit;
  font-size: inherit;
  font-weight: inherit;
  text-align: start;
  transition: background-color 0.15s ease-out;
}

.atend-linha.p-button:not(:disabled):hover,
.atend-linha.p-button:not(:disabled):active {
  background: color-mix(in srgb, var(--hc-marca-clara) 45%, transparent);
  color: inherit;
}

.atend-linha.p-button:focus-visible {
  outline: 2px solid var(--hc-marca);
  outline-offset: -2px;
}

/* A sombra de botão da casa não vale aqui: a linha é item de lista, não ação solta. */
.atend-lista .atend-linha.p-button,
.atend-lista .atend-linha.p-button:not(:disabled):hover,
.atend-lista .atend-linha.p-button:focus-visible {
  box-shadow: none;
}

.atend-foto {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  overflow: hidden;
  width: 2.6rem;
  height: 2.6rem;
  border-radius: 0.75rem;
  background: var(--hc-marca-clara);
  color: var(--hc-marca-forte);
  font-size: 0.8rem;
  font-weight: 750;
}

.atend-foto img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.atend-linha__corpo {
  display: grid;
  flex: 1 1 auto;
  gap: 0.2rem;
  min-width: 0;
}

.atend-linha__nome {
  display: flex;
  align-items: baseline;
  gap: 0.3rem;
  min-width: 0;
}

.atend-linha__nome strong {
  overflow: hidden;
  color: var(--hc-tinta);
  font-size: 0.95rem;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.atend-linha__especie {
  color: var(--hc-tinta-2);
  font-size: 0.8rem;
  white-space: nowrap;
}

/* A urgência mora no ícone: o grupo recolhido avisa sem pintar a linha. */
.atend-linha__urgente {
  align-self: center;
  color: var(--hc-pessego-tinta);
  font-size: 0.8rem;
}

.atend-linha__frase {
  overflow: hidden;
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.atend-linha__lado {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.75rem;
}

.atend-linha__seta {
  color: var(--hc-tinta-2);
  font-size: 0.78rem;
}

.atend-linha__alternar {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.4rem;
  color: var(--hc-marca-forte);
  font-size: 0.84rem;
  font-weight: 650;
}

.atend-linha__alternar i {
  font-size: 0.75rem;
}

/* Os acessos do pet, recuados até a coluna do nome: pertencem a ele, não à lista. */
.atend-sublista {
  display: grid;
  margin: 0 0 0.5rem;
  padding: 0;
  padding-inline-start: 3.85rem;
  list-style: none;
}

.atend-sublista > li {
  border-top: 1px solid var(--hc-linha);
}

.atend-linha--acesso.p-button {
  padding-block: 0.6rem;
}

.atend-linha__frase--acesso {
  flex: 1 1 auto;
  min-width: 0;
}

.atend-linha__frase--acesso strong {
  color: var(--hc-tinta);
  font-weight: 650;
}

.atend-ver-outros.p-button {
  padding-inline: 0.35rem;
  color: var(--hc-marca-forte);
  font-weight: 650;
}

/* Fatos do acesso: ícone e número, sem fundo — quem chama atenção é o selo e o alerta. */
.atend-fatos {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.atend-fato {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--hc-tinta-2);
  font-size: 0.78rem;
  font-weight: 600;
  white-space: nowrap;
}

.atend-fato i {
  font-size: 0.75rem;
}

/* Zero anotações continua sendo informação, mas não merece o mesmo peso de uma. */
.atend-fato--vazio {
  opacity: 0.6;
  font-weight: 500;
}

/* O resumo mudou depois da entrega: o único fato com cor. */
.atend-fato--alerta {
  color: var(--hc-coral-tinta);
}

/* Vaga do fato ausente: some da vista e do leitor de tela, mas segura a coluna. */
.atend-fato--oculto {
  visibility: hidden;
}

/* As vagas de número têm largura fixa; o alerta, que é frase, não. */
.atend-fato:not(.atend-fato--alerta) {
  justify-content: flex-end;
  min-width: 2.1rem;
}

.atend-linha__lado .hc-selo {
  min-width: 5.4rem;
}

/* Nos ativos o selo é o prazo ("expira em 14d 23h"): largura de sobra e dígitos de mesma largura. */
.atend-lista--ativos .atend-linha__lado .hc-selo {
  min-width: 8.4rem;
  font-variant-numeric: tabular-nums;
}

.atend-more {
  display: flex;
  justify-content: center;
}

/* Abrir o grupo: os acessos descem do pet, 160 ms, sem altura animada. */
.atend-abre-enter-active {
  transition:
    opacity 0.16s ease-out,
    transform 0.16s ease-out;
}

.atend-abre-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .atend-abre-enter-active,
  .atend-linha.p-button {
    transition: none;
  }
}

/* Tablet em pé: a linha cabe inteira; só o recuo dos acessos encolhe. */
@media (max-width: 900px) {
  .atend-sublista {
    padding-inline-start: 0.75rem;
  }
}
</style>

<style>
/* Painel teleportado: os tokens chegam pelo `pt` (inline) e cascateiam daqui. */
.atend-filtros__overlay.p-select-overlay {
  border: 1px solid var(--atend-ov-line);
  background: var(--atend-ov-bg);
  color: var(--atend-ov-text);
}

.atend-filtros__overlay .p-select-option {
  color: var(--atend-ov-text);
}

.atend-filtros__overlay .p-select-option:not(.p-disabled):hover,
.atend-filtros__overlay .p-select-option.p-focus:not(.p-select-option-selected) {
  background: var(--atend-ov-hover);
  color: var(--atend-ov-text);
}

.atend-filtros__overlay .p-select-option.p-select-option-selected {
  background: var(--atend-ov-selected-bg);
  color: var(--atend-ov-selected-text);
}

.atend-filtros__overlay .p-select-empty-message {
  color: var(--atend-ov-muted);
}
</style>
