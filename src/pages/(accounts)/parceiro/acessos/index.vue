<script setup lang="ts">
/**
 * Acessos — os pets que os responsáveis compartilharam com a empresa pelo app.
 *
 * ## A forma (redesenho total, 19/10/2026)
 *
 * A tela responde, por linha, às quatro perguntas de quem atende: **quem é** (o rosto, o nome, a
 * espécie e o serviço), **desde quando** (há quanto tempo o código foi vinculado), **o que já tem
 * ali** (anotações da equipe, documentos e diário liberados) e **quanto tempo ainda resta** — a
 * contagem regressiva com uma barra que esvazia, em âmbar e com a marca na borda quando falta
 * menos de um dia. A linha inteira abre o acesso.
 *
 * Em cima, "Vincular código" é a ação da tela; Ativos | Histórico é um controle segmentado (o
 * parâmetro `?aba=historico` continua valendo), a busca é o campo grande e os filtros finos moram
 * atrás de um botão, com o que está aplicado à vista em fichas que se removem num clique.
 *
 * Pet com mais de um acesso continua numa linha só, que abre a lista dele embaixo (o Marsh com
 * onze acessos não vira onze linhas iguais). Com "Mostrar explicações" ligado — e sempre na lista
 * vazia — aparecem os três passos de como um acesso funciona (`AcessosPassos`, uma trilha).
 *
 * Com o cadastro em análise, "Vincular código" guarda o código para a aprovação (`reivindicar`),
 * e os avisos dos códigos guardados (`ReivindicacoesAvisos`) ficam em cima da lista.
 */
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import AcessosPassos from '@/components/parceiro/AcessosPassos.vue'
import ReivindicacoesAvisos from '@/components/parceiro/ReivindicacoesAvisos.vue'
import VincularCodigoDialog from '@/components/parceiro/VincularCodigoDialog.vue'
import UiPagina from '@/components/ui/UiPagina.vue'
import { useAgora } from '@/composables/useAgora'
import { useRevalidarAoVoltar } from '@/composables/useRevalidarAoVoltar'
import { isGuidanceVisible } from '@/composables/useLayoutPreferences'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { usePartnerTabs } from '@/composables/usePartnerTabs'
import type { PetSpecies } from '@/features/clinico/data/types'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import {
  getCompartilhamentos,
  getReivindicacoes,
  isCodigoVinculoValido,
  normalizarCodigoVinculo,
} from '@/service/parceiro/compartilhamentos-service'
import {
  MAX_BUSCA_PACIENTES,
  type CompartilhamentoDetalhe,
  type CompartilhamentoResumo,
  type EspeciePet,
  type OrdenacaoPacientes,
  type ReivindicacaoAcesso,
  type TipoServicoPrestador,
} from '@/service/parceiro/types'
import {
  calcularTempoRestante,
  diasDeCalendarioEntre,
  parseInstante,
} from '@/utils/format/expiracao'
import { rotuloDaEspecie } from '@/utils/parceiro/especie-do-acesso'
import { modoDoVinculo } from '@/utils/parceiro/reivindicacoes'
import { carimboDoResumo } from '@/utils/parceiro/snapshot-compartilhado'

const ATENDIMENTO_TABS = ['ativos', 'historico'] as const
type AtendimentoTab = (typeof ATENDIMENTO_TABS)[number]

/**
 * `?vincular=123456`: o código que chega pelo "Entrar no portal" da página do acesso, no site.
 * O nome é contrato com o petjourney-web (`portalVincularCodigoUrl` em `src/lib/parcerias-cta.ts`).
 */
const PARAMETRO_VINCULAR = 'vincular'

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

/** A silhueta do avatar: só cão e gato têm desenho, o resto fica nas iniciais. */
const ESPECIE_DO_AVATAR: Partial<Record<string, PetSpecies>> = {
  CACHORRO: 'canina',
  GATO: 'felina',
  AVE: 'ave',
  ROEDOR: 'roedor',
  REPTIL: 'reptil',
}

/** O mesmo ícone do serviço que a folha da anotação usa. */
const ICONE_DO_SERVICO: Record<TipoServicoPrestador, string> = {
  CONSULTA: 'ph ph-stethoscope',
  EXAME: 'ph ph-microscope',
  BANHO: 'ph ph-drop',
  TOSA: 'ph ph-scissors',
  HOTEL: 'ph ph-bed',
  OUTRO: 'ph ph-paw-print',
}

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
/** O código que veio pelo link; vale só para a abertura que ele mesmo provocou. */
const codigoDoLink = ref('')

/** Os códigos guardados com o cadastro em análise e o que aconteceu com eles. */
const reivindicacoes = ref<ReivindicacaoAcesso[]>([])
/** Guardou um código e a releitura falhou: o aviso sem o nome do pet segura o lugar. */
const codigoGuardadoSemLista = ref(false)

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

const intl = computed(() => INTL_LOCALE[locale.value as Locale])

/**
 * Data do resumo quando o responsável o regerou depois de entregar o acesso.
 * String vazia quando o resumo ainda é o da criação: aí não há o que avisar.
 */
function resumoAtualizado(item: CompartilhamentoResumo) {
  const carimbo = carimboDoResumo(item)

  if (!carimbo.atualizado) {
    return ''
  }

  return dataLegivel(carimbo.data)
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

/** O controle segmentado não deixa ficar sem escolha, mas o evento ainda pode vir vazio. */
function escolherAba(valor: unknown) {
  if (valor === 'ativos' || valor === 'historico') {
    setTab(valor as AtendimentoTab)
  }
}

const hasMore = computed(() => cursor.value != null)

const loadError = computed(() =>
  store.loadState === 'error' && !store.semAcessoParceiro ? store.errorMessage : '',
)

/**
 * Cadastro que não opera (em análise, recusado ou suspenso): a lista continua legível — o acesso
 * foi consentido pelo responsável —, mas vincular código fica bloqueado. A faixa diz por quê.
 */
const avisoDoCadastro = computed(() => {
  if (store.loadState !== 'ready' || store.podeOperar) {
    return null
  }

  const status = store.statusAuditoria

  if (store.cadastroSuspenso || status === 'SUSPENSO') {
    return 'suspendedReadOnly'
  }

  if (status === 'REJEITADO') {
    return 'rejected'
  }

  return status === 'PENDENTE' ? 'pending' : null
})

/**
 * "Vincular código" abre para o cadastro operando (vincula na hora) e para o em análise (guarda o
 * código e vincula na aprovação). Recusado e suspenso continuam sem o modal: a API recusaria.
 */
const podeAbrirVinculo = computed(() => modoDoVinculo(store.status) !== null)

/**
 * A dica de bloqueio só com o status em mãos: enquanto ele carrega o botão fica parado, mas dizer
 * "Disponível após a aprovação" a uma empresa já aprovada assusta quem acabou de entrar.
 */
const dicaDoVinculo = computed(() =>
  store.status && !podeAbrirVinculo.value ? t('acessos.vincular.bloqueado') : undefined,
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

let reivindicacoesRequestId = 0

/**
 * Os avisos dos códigos guardados. São recado, não a tela: falhou, o aviso some e a lista segue,
 * sem erro nenhum. Na releitura de fundo (`silencioso`), a falha deixa os avisos que já estavam.
 * Devolve se a leitura deu certo.
 */
async function carregarReivindicacoes(silencioso = false) {
  const id = ++reivindicacoesRequestId

  try {
    const resposta = await getReivindicacoes(parceiroQuery())

    if (id === reivindicacoesRequestId) {
      reivindicacoes.value = Array.isArray(resposta?.itens) ? resposta.itens : []
      codigoGuardadoSemLista.value = false
    }

    return true
  } catch {
    if (id === reivindicacoesRequestId && !silencioso) {
      reivindicacoes.value = []
    }

    return false
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

function iconeDoServico(item: CompartilhamentoResumo) {
  return ICONE_DO_SERVICO[item.tipoServico] ?? 'ph ph-paw-print'
}

function especieDoAvatar(especie: string) {
  return ESPECIE_DO_AVATAR[especie] ?? null
}

// ------------------------------------------------------------------ tempo, em linguagem de gente

/** "22 de out." — com o ano só quando não é o deste ano. */
function dataLegivel(iso: string) {
  const data = new Date(parseInstante(iso))

  if (Number.isNaN(data.getTime())) {
    return ''
  }

  const mesmoAno = data.getFullYear() === new Date(agora.value).getFullYear()

  return new Intl.DateTimeFormat(intl.value, {
    day: 'numeric',
    month: 'short',
    ...(mesmoAno ? {} : { year: 'numeric' as const }),
  }).format(data)
}

/** "22 de out., 14:30": quando o acesso fecha, com a hora — é ela que decide o dia. */
function dataEHora(iso: string) {
  const data = new Date(parseInstante(iso))

  if (Number.isNaN(data.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat(intl.value, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(data)
}

/**
 * "há 4 dias", "ontem", "há 3 horas" — o `Intl` traduz para os seis idiomas sem chave nenhuma.
 * Passados dois meses conta em meses: "há 240 dias" obriga a fazer a conta de cabeça.
 */
function haQuantoTempo(iso: string) {
  const diff = agora.value - parseInstante(iso)

  if (Number.isNaN(diff)) {
    return ''
  }

  const relativo = new Intl.RelativeTimeFormat(intl.value, { numeric: 'auto' })
  const minutos = Math.max(0, Math.floor(diff / 60_000))

  if (minutos < 60) {
    return relativo.format(-Math.max(1, minutos), 'minute')
  }

  const horas = Math.floor(minutos / 60)

  if (horas < 24) {
    return relativo.format(-horas, 'hour')
  }

  /* Dias de calendário, não blocos de 24 h: "ontem" ao lado de uma data de dois dias atrás. */
  const dias = Math.max(1, diasDeCalendarioEntre(parseInstante(iso), agora.value))

  return dias < 60
    ? relativo.format(-dias, 'day')
    : relativo.format(-Math.round(dias / 30.4), 'month')
}

/** A contagem regressiva, curta: "3d 4h", "5h 12min", "40min". */
function prazoCurto(item: CompartilhamentoResumo) {
  const restante = calcularTempoRestante(item.expiraEm, agora.value)

  switch (restante.estado) {
    case 'dias':
      return t('acessos.lista.prazo.dias', { d: restante.dias, h: restante.horas })
    case 'horas':
      return t('acessos.lista.prazo.horas', { h: restante.horas, m: restante.minutos })
    case 'minutos':
      return t('acessos.lista.prazo.minutos', { m: restante.minutos })
    default:
      return t('acessos.expira.expirado')
  }
}

/**
 * Só o acesso que fecha em menos de um dia ganha âmbar. Pintar toda contagem de alerta fazia a
 * lista inteira gritar, e aí nenhuma linha gritava.
 */
function prazoUrgente(item: CompartilhamentoResumo) {
  if (item.status !== 'ATIVO') {
    return false
  }

  return calcularTempoRestante(item.expiraEm, agora.value).estado !== 'dias'
}

/** Quanto da janela do acesso ainda resta, de 0 a 1: é a barra que esvazia embaixo do número. */
function fracaoRestante(item: CompartilhamentoResumo) {
  const fim = parseInstante(item.expiraEm)
  const inicio = parseInstante(item.criadoEm || item.vinculadoEm)
  const total = fim - inicio

  if (!(total > 0)) {
    return 0
  }

  return Math.min(1, Math.max(0, (fim - agora.value) / total))
}

/** Ativo, expirado ou revogado — o que o parceiro precisa ler, sem apelido de auditoria. */
function statusLabel(item: CompartilhamentoResumo) {
  return t(`acessos.list.status.${item.status}`)
}

/**
 * Quando o acesso encerrado acabou. A listagem não traz a data da revogação: o revogado antes do
 * prazo ficaria com uma data no futuro, então fica sem data — o selo já diz o desfecho.
 */
function dataDoEncerramento(item: CompartilhamentoResumo) {
  if (item.status === 'REVOGADO' && parseInstante(item.expiraEm) > agora.value) {
    return ''
  }

  return dataLegivel(item.expiraEm)
}

/** O que o responsável liberou além do resumo: documentos e diário. Nada disso: "só o resumo". */
function prontuarioDoAcesso(item: Pick<CompartilhamentoResumo, 'totalDocumentos' | 'temDiario'>) {
  const partes: { id: string; icone: string; texto: string }[] = []

  if (item.totalDocumentos) {
    partes.push({
      id: 'documentos',
      icone: 'ph ph-file-text',
      texto: t('acessos.list.documentos', { n: item.totalDocumentos }, item.totalDocumentos),
    })
  }

  if (item.temDiario) {
    partes.push({ id: 'diario', icone: 'ph ph-notebook', texto: t('acessos.list.diario') })
  }

  return partes
}

/** A frase das anotações: no celular, quando as colunas somem, ela vai para baixo do nome. */
function anotacoesTexto(n: number) {
  return t('acessos.list.anotacoes', { n }, n)
}

type GrupoDoPet = {
  chave: string
  petNome: string
  especie: string
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
        especie: item.especie,
        especieLabel: rotuloDaEspecie(item),
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
 * O acesso que representa o grupo na coluna do prazo: nos ativos, o que vence primeiro (é o que
 * pede ação); no histórico, o último a encerrar.
 */
function acessoDeReferencia(grupo: GrupoDoPet) {
  return activeTab.value === 'ativos'
    ? grupo.acessos.reduce((menor, item) => (item.expiraEm < menor.expiraEm ? item : menor))
    : grupo.acessos.reduce((maior, item) => (item.expiraEm > maior.expiraEm ? item : maior))
}

/** O vínculo mais recente do pet. */
function vinculoMaisRecente(grupo: GrupoDoPet) {
  return grupo.acessos.reduce((maior, item) =>
    item.vinculadoEm > maior.vinculadoEm ? item : maior,
  ).vinculadoEm
}

/** "3 acessos · Hotel, Consulta, Banho": quantos e de quê, sem abrir. */
function metaDoGrupo(grupo: GrupoDoPet) {
  const n = grupo.acessos.length
  const servicos = [...new Set(grupo.acessos.map(servicoLabel))].join(', ')

  return `${t('acessos.grupo.acessos', { n }, n)} · ${servicos}`
}

function somaDoGrupo(grupo: GrupoDoPet) {
  return {
    totalAnotacoes: grupo.acessos.reduce((soma, item) => soma + item.totalAnotacoes, 0),
    totalDocumentos: grupo.acessos.reduce((soma, item) => soma + item.totalDocumentos, 0),
    temDiario: grupo.acessos.some((item) => item.temDiario),
  }
}

/** Um grupo com algum acesso que vence em menos de um dia: o grupo avisa mesmo recolhido. */
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

/** O que está aplicado, em fichas que se removem num clique — filtro escondido faz a lista "sumir". */
const fichas = computed(() => {
  const lista: { id: string; rotulo: string; tirar: () => void }[] = []

  if (filtros.especie) {
    lista.push({
      id: 'especie',
      rotulo: t(`acessos.especie.${filtros.especie}`),
      tirar: () => (filtros.especie = null),
    })
  }

  if (filtros.tipoServico) {
    lista.push({
      id: 'tipoServico',
      rotulo: t(`acessos.servico.${filtros.tipoServico}`),
      tirar: () => (filtros.tipoServico = null),
    })
  }

  if (filtros.comProntuario) {
    lista.push({
      id: 'comProntuario',
      rotulo: t('acessos.filtros.comProntuario'),
      tirar: () => (filtros.comProntuario = false),
    })
  }

  if (filtros.vinculadoDe || filtros.vinculadoAte) {
    const de = filtros.vinculadoDe ? dataLegivel(dataFiltro(filtros.vinculadoDe) ?? '') : ''
    const ate = filtros.vinculadoAte ? dataLegivel(dataFiltro(filtros.vinculadoAte) ?? '') : ''

    lista.push({
      id: 'periodo',
      rotulo: `${t('acessos.filtros.periodo')}: ${[de, ate].filter(Boolean).join(' – ')}`,
      tirar: () => {
        filtros.vinculadoDe = ''
        filtros.vinculadoAte = ''
      },
    })
  }

  if (filtros.ordenarPor !== 'recentes') {
    lista.push({
      id: 'ordem',
      rotulo: `${t('acessos.filtros.ordenarPor')}: ${ordenacaoLabel.value}`,
      tirar: () => (filtros.ordenarPor = 'recentes'),
    })
  }

  return lista
})

/**
 * A frase do alto. Nos ativos, quantos acessos estão valendo e quantos vencem logo; no
 * histórico, de quantos pets. Com filtro ligado vira "encontrados" — a contagem é do recorte.
 */
const fraseDoResumo = computed(() => {
  if (loading.value || error.value) {
    return ''
  }

  if (temFiltroAtivo.value) {
    /* Nos ativos cada linha é um acesso: a mesma Paçoca com dois acessos não são "2 pets". */
    if (activeTab.value === 'ativos') {
      const n = items.value.length
      return t('acessos.saudacao.encontradosAcessos', { n }, n)
    }

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

function onVinculado(detalhe: CompartilhamentoDetalhe) {
  // Vincular pode fechar um código guardado do mesmo pet: o aviso dele não pode sobrar.
  void carregarReivindicacoes()
  void router.push(`/parceiro/acessos/${detalhe.id}`)
}

/** Código guardado com o cadastro em análise: o aviso de espera aparece em cima da lista. */
async function onGuardado() {
  const leu = await carregarReivindicacoes()
  codigoGuardadoSemLista.value = !leu
}

/**
 * Lê o `?vincular=` e o tira da URL na hora: recarregar a página não pode reabrir o modal, e o
 * código não fica no histórico do navegador. Devolve o código só quando ele tem o formato certo.
 */
function tirarCodigoDaUrl() {
  const bruto = route.query[PARAMETRO_VINCULAR]

  if (bruto === undefined) {
    return ''
  }

  const query = { ...route.query }
  delete query[PARAMETRO_VINCULAR]
  void router.replace({ query, hash: route.hash })

  const codigo = typeof bruto === 'string' ? normalizarCodigoVinculo(bruto) : ''

  return isCodigoVinculoValido(codigo) ? codigo : ''
}

/**
 * Quem chegou pelo link do acesso já está com o código na mão: o modal abre preenchido e falta só
 * confirmar, em vez de a pessoa cair no Início sem saber o que fazer com ele.
 *
 * Roda depois da primeira página porque é o contexto do parceiro, carregado ali, que diz se o
 * cadastro opera — chamar o `ensureContext` em paralelo dobraria a ida à rede. Em análise, o
 * modal abre do mesmo jeito e guarda o código para a aprovação (quem cria a conta pela página do
 * acesso chega aqui ainda em análise). Recusado ou suspenso, a API recusaria: o modal não abre,
 * e a faixa do alto explica.
 */
function abrirVinculoDoLink(codigo: string) {
  if (!codigo || !podeAbrirVinculo.value) {
    return
  }

  codigoDoLink.value = codigo
  vincularVisible.value = true
}

/** Fechou (vinculando ou não): o próximo "Vincular código" abre com as caixas vazias. */
watch(vincularVisible, (aberto) => {
  if (!aberto) {
    codigoDoLink.value = ''
  }
})

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

  const codigoLido = tirarCodigoDaUrl()

  // Os avisos esperam o contexto do parceiro pelo mesmo motivo do link: o `parceiroId` vem dele.
  void loadFirstPage().then(() => {
    abrirVinculoDoLink(codigoLido)
    void carregarReivindicacoes()
  })
})

/**
 * Mesma razão do detalhe: a validade de um acesso pode ter encurtado sem aviso, e esta lista
 * mostra contagem regressiva. Relendo na volta, o número volta a valer. Os avisos voltam junto:
 * a aprovação do cadastro pode ter acontecido com a aba fechada.
 */
useRevalidarAoVoltar(() => {
  void loadFirstPage(true)
  void carregarReivindicacoes(true)
})
</script>

<template>
  <UiPagina
    class="tela-acessos"
    :erro="loadError"
    :sem-acesso-de-parceiro="store.semAcessoParceiro"
    guia
    @tentar-de-novo="ensureContext(true)"
  >
    <template v-if="fraseDoResumo" #resumo>
      <span aria-live="polite">{{ fraseDoResumo }}</span>
    </template>

    <template #acoes>
      <Button
        type="button"
        icon="ph ph-link"
        :label="t('acessos.vincular.cta')"
        :disabled="!podeAbrirVinculo"
        :title="dicaDoVinculo"
        @click="vincularVisible = true"
      />
    </template>

    <div class="acessos">
      <!-- Leitura não é gated por auditoria (seção 4): suspenso lê a lista e o prontuário, e
           perde só o vínculo e a anotação. A faixa explica no lugar do bloqueio de página. -->
      <section v-if="avisoDoCadastro" class="faixa faixa--atencao" role="status">
        <span class="faixa__icone" aria-hidden="true">
          <i :class="avisoDoCadastro === 'rejected' ? 'ph ph-x-circle' : 'ph ph-lock'" />
        </span>
        <span class="faixa__texto">
          <strong>{{ t(`frame.operability.${avisoDoCadastro}.title`) }}</strong>
          <span>
            {{ t(`frame.operability.${avisoDoCadastro}.body`) }}
            <template v-if="store.status?.motivoAuditoria">
              {{ t('frame.operability.reasonPrefix') }} {{ store.status.motivoAuditoria }}
            </template>
          </span>
        </span>
        <Button
          :as="RouterLink"
          to="/settings?aba=empresa"
          class="faixa__link"
          severity="secondary"
          size="small"
          :label="t(`frame.operability.${avisoDoCadastro}.link`)"
        />
      </section>

      <!-- Os códigos guardados com o cadastro em análise: o que espera a aprovação e o que não
           virou acesso. Falha na leitura só some com os avisos; a lista segue. -->
      <ReivindicacoesAvisos :itens="reivindicacoes" :codigo-guardado="codigoGuardadoSemLista" />

      <!-- As explicações: o que é um acesso, em três passos numa trilha. -->
      <section v-if="isGuidanceVisible" class="guia" aria-labelledby="acessos-guia-titulo">
        <p class="guia__lede">{{ t('acessos.lede') }}</p>
        <div class="guia__cartao ui-folha ui-cartao">
          <header class="ui-cartao__cabeca">
            <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-path" /></span>
            <div class="ui-cartao__titulos">
              <h2 id="acessos-guia-titulo" class="ui-cartao__titulo">
                {{ t('acessos.guia.titulo') }}
              </h2>
            </div>
          </header>
          <AcessosPassos class="guia__passos" />
        </div>
      </section>

      <!-- Ativos ou histórico, a busca grande e o botão dos filtros, numa linha. -->
      <div class="barra" role="search">
        <SelectButton
          class="barra__abas"
          :model-value="activeTab"
          :options="tabs"
          option-label="label"
          option-value="id"
          :allow-empty="false"
          :aria-label="tabsAriaLabel"
          @update:model-value="escolherAba"
        />

        <label class="sr-only" for="atend-q">{{ t('acessos.filtros.q') }}</label>
        <IconField class="barra__busca">
          <InputIcon class="ph ph-magnifying-glass" />
          <InputText
            id="atend-q"
            v-model="filtros.q"
            type="search"
            fluid
            :maxlength="MAX_BUSCA_PACIENTES"
            :placeholder="t('acessos.lista.buscaPlaceholder')"
            autocomplete="off"
          />
        </IconField>

        <Button
          type="button"
          class="barra__filtros"
          :class="{ 'barra__filtros--ligado': filtrosLigados > 0 }"
          severity="secondary"
          outlined
          :aria-expanded="filtrosAbertos"
          aria-controls="atend-filtros"
          @click="filtrosAbertos = !filtrosAbertos"
        >
          <i class="ph ph-sliders-horizontal" aria-hidden="true" />
          <span>{{ t('acessos.filtros.botao') }}</span>
          <span v-if="filtrosLigados" class="ui-contagem barra__total">{{ filtrosLigados }}</span>
          <i
            class="ph barra__seta"
            :class="filtrosAbertos ? 'ph-caret-up' : 'ph-caret-down'"
            aria-hidden="true"
          />
        </Button>
      </div>

      <!-- Os filtros finos, com o nome de cada um à vista. v-show: o alvo do `aria-controls`
           existe sempre. -->
      <section
        v-show="filtrosAbertos"
        id="atend-filtros"
        class="filtros ui-folha"
        :aria-label="t('acessos.filtros.aria')"
      >
        <div class="filtros__grade">
          <div class="campo">
            <label id="atend-especie-rotulo" class="campo__rotulo">
              {{ t('acessos.filtros.especie') }}
            </label>
            <Select
              v-model="filtros.especie"
              label-id="atend-especie"
              aria-labelledby="atend-especie-rotulo"
              :options="especieOptions"
              option-label="label"
              option-value="value"
              :placeholder="t('acessos.lista.qualquer')"
              show-clear
            />
          </div>

          <div class="campo">
            <label id="atend-tipo-rotulo" class="campo__rotulo">
              {{ t('acessos.filtros.tipoServico') }}
            </label>
            <Select
              v-model="filtros.tipoServico"
              label-id="atend-tipo"
              aria-labelledby="atend-tipo-rotulo"
              :options="tipoServicoOptions"
              option-label="label"
              option-value="value"
              :placeholder="t('acessos.lista.qualquer')"
              show-clear
            />
          </div>

          <div class="campo">
            <label id="atend-ordem-rotulo" class="campo__rotulo">
              {{ t('acessos.filtros.ordenarPor') }}
            </label>
            <Select
              v-model="filtros.ordenarPor"
              label-id="atend-ordem"
              aria-labelledby="atend-ordem-rotulo"
              :options="ordenacaoOptions"
              option-label="label"
              option-value="value"
            />
          </div>

          <div class="campo campo--periodo">
            <label class="campo__rotulo" for="atend-periodo">{{ t('acessos.filtros.periodo') }}</label>
            <DatePicker
              v-model="periodo"
              input-id="atend-periodo"
              selection-mode="range"
              :manual-input="false"
              date-format="dd/mm/yy"
              show-icon
              icon-display="input"
              show-button-bar
              :placeholder="t('acessos.lista.periodoPlaceholder')"
            />
          </div>

          <!-- Filtro binário: acesso com prontuário pede leitura antes do atendimento. -->
          <div class="campo campo--interruptor">
            <ToggleSwitch v-model="filtros.comProntuario" input-id="atend-prontuario" />
            <label for="atend-prontuario" class="campo__interruptor">
              <strong>{{ t('acessos.filtros.comProntuario') }}</strong>
              <small>{{ t('acessos.lista.comProntuarioAjuda') }}</small>
            </label>
          </div>
        </div>
      </section>

      <div v-if="fichas.length" class="aplicados">
        <button
          v-for="ficha in fichas"
          :key="ficha.id"
          type="button"
          class="ficha"
          :aria-label="`${ficha.rotulo}: ${t('clinico.comum.remover')}`"
          @click="ficha.tirar()"
        >
          <span>{{ ficha.rotulo }}</span>
          <i class="ph ph-x" aria-hidden="true" />
        </button>
        <button type="button" class="ui-mais" @click="limparFiltros">
          {{ t('acessos.filtros.limpar') }}
        </button>
      </div>

      <!-- ------------------------------------------------------------ a lista -->

      <div v-if="loading" class="quadro ui-folha" role="status" aria-live="polite">
        <span class="sr-only">{{ t('acessos.list.loadingTitle') }}</span>
        <ul class="ui-lista" aria-hidden="true">
          <li v-for="n in 4" :key="n" class="esqueleto">
            <span class="esqueleto__rosto" />
            <span class="esqueleto__texto">
              <span class="esqueleto__osso esqueleto__osso--nome" />
              <span class="esqueleto__osso" />
            </span>
            <span class="esqueleto__osso esqueleto__osso--fim" />
          </li>
        </ul>
      </div>

      <div v-else-if="error" class="estado ui-folha" role="alert">
        <span class="ui-ladrilho ui-ladrilho--g ui-ladrilho--risco" aria-hidden="true">
          <i class="ph ph-warning-circle" />
        </span>
        <p>{{ error }}</p>
        <Button
          type="button"
          icon="ph ph-arrow-clockwise"
          :label="t('common.retry')"
          severity="secondary"
          outlined
          @click="loadFirstPage()"
        />
      </div>

      <!-- Vazio por filtro é outro problema: a saída é limpar o filtro, não vincular código. -->
      <div v-else-if="items.length === 0 && temFiltroAtivo" class="estado ui-folha">
        <span class="ui-ladrilho ui-ladrilho--g ui-ladrilho--neutro" aria-hidden="true">
          <i class="ph ph-funnel-x" />
        </span>
        <h2>{{ t('acessos.list.emptyFiltroTitle') }}</h2>
        <p>{{ t('acessos.list.emptyFiltroBody') }}</p>
        <Button
          type="button"
          :label="t('acessos.filtros.limpar')"
          icon="ph ph-funnel-x"
          severity="secondary"
          outlined
          @click="limparFiltros"
        />
      </div>

      <!--
        Nenhum acesso ativo: é aqui que se aprende como um acesso chega. Três andares: o recado
        (ladrilho, título e a frase inteira), a trilha das etapas num poço (só quando o guia do
        topo está desligado, para não repetir) e a ação, sozinha embaixo.
      -->
      <section
        v-else-if="items.length === 0 && activeTab === 'ativos'"
        class="vazio-ativos ui-folha"
        aria-labelledby="acessos-vazio-titulo"
      >
        <div class="vazio-ativos__recado">
          <span class="ui-ladrilho ui-ladrilho--g ui-ladrilho--lugar" aria-hidden="true">
            <i class="ph ph-key" />
          </span>
          <h2 id="acessos-vazio-titulo">{{ t('acessos.list.emptyAtivosTitle') }}</h2>
          <p>{{ t('acessos.list.emptyAtivosBody') }}</p>
        </div>

        <div v-if="!isGuidanceVisible" class="vazio-ativos__guia ui-poco">
          <h3 class="vazio-ativos__guia-titulo">{{ t('acessos.guia.titulo') }}</h3>
          <AcessosPassos />
        </div>

        <div class="vazio-ativos__acao">
          <Button
            type="button"
            icon="ph ph-link"
            :label="t('acessos.vincular.cta')"
            :disabled="!podeAbrirVinculo"
            :title="dicaDoVinculo"
            @click="vincularVisible = true"
          />
        </div>
      </section>

      <div v-else-if="items.length === 0" class="estado ui-folha">
        <span class="ui-ladrilho ui-ladrilho--g ui-ladrilho--neutro" aria-hidden="true">
          <i class="ph ph-clock-counter-clockwise" />
        </span>
        <h2>{{ t('acessos.list.emptyHistoricoTitle') }}</h2>
        <p>{{ t('acessos.list.emptyHistoricoBody') }}</p>
      </div>

      <template v-else>
        <section
          class="quadro ui-folha ui-cartao"
          :class="`quadro--${activeTab}`"
          aria-labelledby="acessos-quadro-titulo"
        >
          <header class="ui-cartao__cabeca">
            <span class="ui-ladrilho" aria-hidden="true">
              <i :class="activeTab === 'ativos' ? 'ph ph-key' : 'ph ph-clock-counter-clockwise'" />
            </span>
            <div class="ui-cartao__titulos">
              <h2 id="acessos-quadro-titulo" class="ui-cartao__titulo">
                {{ t(`acessos.tabs.${activeTab}.label`) }}
              </h2>
              <p class="ui-cartao__descricao">{{ t(`acessos.tabs.${activeTab}.description`) }}</p>
            </div>
          </header>

          <div class="quadro__cab" aria-hidden="true">
            <span>{{ t('acessos.lista.colunas.pet') }}</span>
            <span>{{ t('acessos.lista.colunas.vinculado') }}</span>
            <span class="col-num">{{ t('acessos.lista.colunas.anotacoes') }}</span>
            <span>{{ t('acessos.lista.colunas.prontuario') }}</span>
            <span>
              {{
                activeTab === 'ativos'
                  ? t('acessos.lista.colunas.expira')
                  : t('acessos.lista.colunas.encerrado')
              }}
            </span>
            <span />
          </div>

          <ul class="ui-lista">
            <li v-for="grupo in grupos" :key="grupo.chave" class="grupo">
              <!-- Pet com um acesso: a linha já é o acesso, e abre direto. -->
              <RouterLink
                v-if="grupo.acessos.length === 1"
                :to="`/parceiro/acessos/${grupo.acessos[0]!.id}`"
                class="ui-linha linha"
                :class="{ 'ui-marca ui-marca--atencao': prazoUrgente(grupo.acessos[0]!) }"
              >
                <span class="linha__pet">
                  <PetAvatar
                    :nome="grupo.petNome"
                    :iniciais="iniciais(grupo.petNome)"
                    :especie="especieDoAvatar(grupo.especie)"
                    :foto-url="grupo.petFoto ?? ''"
                    tamanho="md"
                  />
                  <span class="ui-linha__texto">
                    <span class="ui-linha__titulo">{{ grupo.petNome }}</span>
                    <span class="ui-linha__meta linha__meta">
                      <span>{{ grupo.especieLabel }}</span>
                      <span class="linha__servico">
                        <i :class="iconeDoServico(grupo.acessos[0]!)" aria-hidden="true" />
                        {{ servicoLabel(grupo.acessos[0]!) }}
                      </span>
                    </span>
                    <span
                      v-if="resumoAtualizado(grupo.acessos[0]!)"
                      class="ui-selo ui-selo--atencao linha__atualizado"
                    >
                      <i class="ph ph-arrow-clockwise" aria-hidden="true" />
                      {{
                        t('acessos.list.resumoAtualizado', {
                          data: resumoAtualizado(grupo.acessos[0]!),
                        })
                      }}
                    </span>
                    <!-- No celular as colunas somem: o que elas diziam desce para cá. -->
                    <span class="linha__estreito">
                      {{ haQuantoTempo(grupo.acessos[0]!.vinculadoEm) }} ·
                      {{ anotacoesTexto(grupo.acessos[0]!.totalAnotacoes) }}
                    </span>
                  </span>
                </span>

                <span class="linha__vinculo">
                  <strong>{{ haQuantoTempo(grupo.acessos[0]!.vinculadoEm) }}</strong>
                  <small class="ui-num">{{ dataLegivel(grupo.acessos[0]!.vinculadoEm) }}</small>
                </span>

                <span
                  class="linha__num col-num"
                  :class="{ 'linha__num--zero': !grupo.acessos[0]!.totalAnotacoes }"
                  :title="anotacoesTexto(grupo.acessos[0]!.totalAnotacoes)"
                >
                  <i class="ph ph-note-pencil" aria-hidden="true" />
                  <span class="ui-num" aria-hidden="true">{{
                    grupo.acessos[0]!.totalAnotacoes
                  }}</span>
                  <span class="sr-only">{{
                    anotacoesTexto(grupo.acessos[0]!.totalAnotacoes)
                  }}</span>
                </span>

                <span class="linha__prontuario">
                  <template v-if="prontuarioDoAcesso(grupo.acessos[0]!).length">
                    <span v-for="parte in prontuarioDoAcesso(grupo.acessos[0]!)" :key="parte.id">
                      <i :class="parte.icone" aria-hidden="true" />
                      {{ parte.texto }}
                    </span>
                  </template>
                  <span v-else class="linha__nada">{{ t('acessos.lista.soResumo') }}</span>
                </span>

                <span
                  v-if="grupo.acessos[0]!.status === 'ATIVO'"
                  class="prazo"
                  :class="{ 'prazo--perto': prazoUrgente(grupo.acessos[0]!) }"
                >
                  <strong class="prazo__tempo ui-num">
                    <i
                      v-if="prazoUrgente(grupo.acessos[0]!)"
                      class="ph ph-alarm"
                      aria-hidden="true"
                    />
                    {{ prazoCurto(grupo.acessos[0]!) }}
                  </strong>
                  <span class="prazo__barra" aria-hidden="true">
                    <span
                      :style="{ inlineSize: `${fracaoRestante(grupo.acessos[0]!) * 100}%` }"
                    />
                  </span>
                  <small class="ui-num">{{ dataEHora(grupo.acessos[0]!.expiraEm) }}</small>
                  <span v-if="prazoUrgente(grupo.acessos[0]!)" class="sr-only">
                    {{ t('acessos.grupo.venceLogo') }}
                  </span>
                </span>
                <span v-else class="prazo prazo--fim">
                  <span class="ui-selo">
                    <i
                      :class="
                        grupo.acessos[0]!.status === 'REVOGADO' ? 'ph ph-prohibit' : 'ph ph-hourglass'
                      "
                      aria-hidden="true"
                    />
                    {{ statusLabel(grupo.acessos[0]!) }}
                  </span>
                  <small v-if="dataDoEncerramento(grupo.acessos[0]!)" class="ui-num">
                    {{ dataDoEncerramento(grupo.acessos[0]!) }}
                  </small>
                </span>

                <i class="ph ph-caret-right ui-linha__seta linha__seta" aria-hidden="true" />
              </RouterLink>

              <!-- Pet com vários acessos: a linha resume e abre a lista dele embaixo. -->
              <template v-else>
                <button
                  type="button"
                  class="ui-linha linha linha--grupo"
                  :class="{ 'ui-marca ui-marca--atencao': grupoUrgente(grupo) }"
                  :aria-expanded="gruposAbertos.has(grupo.chave)"
                  :aria-controls="`atend-grupo-${grupo.chave}`"
                  :aria-label="grupo.petNome"
                  @click="alternarGrupo(grupo.chave)"
                >
                  <span class="linha__pet">
                    <PetAvatar
                      :nome="grupo.petNome"
                      :iniciais="iniciais(grupo.petNome)"
                      :especie="especieDoAvatar(grupo.especie)"
                      :foto-url="grupo.petFoto ?? ''"
                      tamanho="md"
                    />
                    <span class="ui-linha__texto">
                      <span class="ui-linha__titulo">{{ grupo.petNome }}</span>
                      <span class="ui-linha__meta">
                        {{ grupo.especieLabel }} · {{ metaDoGrupo(grupo) }}
                      </span>
                      <span class="linha__estreito">
                        {{ anotacoesTexto(somaDoGrupo(grupo).totalAnotacoes) }}
                      </span>
                    </span>
                  </span>

                  <span class="linha__vinculo">
                    <strong>{{ haQuantoTempo(vinculoMaisRecente(grupo)) }}</strong>
                    <small class="ui-num">{{ dataLegivel(vinculoMaisRecente(grupo)) }}</small>
                  </span>

                  <span
                    class="linha__num col-num"
                    :class="{ 'linha__num--zero': !somaDoGrupo(grupo).totalAnotacoes }"
                    :title="anotacoesTexto(somaDoGrupo(grupo).totalAnotacoes)"
                  >
                    <i class="ph ph-note-pencil" aria-hidden="true" />
                    <span class="ui-num" aria-hidden="true">{{
                      somaDoGrupo(grupo).totalAnotacoes
                    }}</span>
                  </span>

                  <span class="linha__prontuario">
                    <template v-if="prontuarioDoAcesso(somaDoGrupo(grupo)).length">
                      <span
                        v-for="parte in prontuarioDoAcesso(somaDoGrupo(grupo))"
                        :key="parte.id"
                      >
                        <i :class="parte.icone" aria-hidden="true" />
                        {{ parte.texto }}
                      </span>
                    </template>
                    <span v-else class="linha__nada">{{ t('acessos.lista.soResumo') }}</span>
                  </span>

                  <span
                    v-if="activeTab === 'ativos'"
                    class="prazo"
                    :class="{ 'prazo--perto': prazoUrgente(acessoDeReferencia(grupo)) }"
                  >
                    <strong class="prazo__tempo ui-num">
                      <i
                        v-if="prazoUrgente(acessoDeReferencia(grupo))"
                        class="ph ph-alarm"
                        aria-hidden="true"
                      />
                      {{ prazoCurto(acessoDeReferencia(grupo)) }}
                    </strong>
                    <span class="prazo__barra" aria-hidden="true">
                      <span
                        :style="{
                          inlineSize: `${fracaoRestante(acessoDeReferencia(grupo)) * 100}%`,
                        }"
                      />
                    </span>
                    <small>{{ t('acessos.lista.oProximo') }}</small>
                    <span v-if="grupoUrgente(grupo)" class="sr-only">
                      {{ t('acessos.grupo.venceLogo') }}
                    </span>
                  </span>
                  <span v-else class="prazo prazo--fim">
                    <small>
                      {{
                        t('acessos.grupo.ultimoEncerrado', {
                          data: dataLegivel(acessoDeReferencia(grupo).expiraEm),
                        })
                      }}
                    </small>
                  </span>

                  <span class="linha__alternar" aria-hidden="true">
                    <i
                      class="ph"
                      :class="gruposAbertos.has(grupo.chave) ? 'ph-caret-up' : 'ph-caret-down'"
                    />
                  </span>
                </button>

                <Transition name="abre">
                  <ul
                    v-show="gruposAbertos.has(grupo.chave)"
                    :id="`atend-grupo-${grupo.chave}`"
                    class="sublista"
                    :aria-label="grupo.petNome"
                  >
                    <li v-for="item in acessosVisiveis(grupo)" :key="item.id">
                      <RouterLink
                        :to="`/parceiro/acessos/${item.id}`"
                        class="ui-linha linha linha--acesso"
                        :class="{ 'ui-marca ui-marca--atencao': prazoUrgente(item) }"
                      >
                        <span class="linha__pet linha__pet--acesso">
                          <span class="linha__icone-servico" aria-hidden="true">
                            <i :class="iconeDoServico(item)" />
                          </span>
                          <span class="ui-linha__texto">
                            <span class="ui-linha__titulo">{{ servicoLabel(item) }}</span>
                            <span
                              v-if="resumoAtualizado(item)"
                              class="ui-selo ui-selo--atencao linha__atualizado"
                            >
                              <i class="ph ph-arrow-clockwise" aria-hidden="true" />
                              {{ t('acessos.list.resumoAtualizado', { data: resumoAtualizado(item) }) }}
                            </span>
                            <span class="linha__estreito">
                              {{ haQuantoTempo(item.vinculadoEm) }} ·
                              {{ anotacoesTexto(item.totalAnotacoes) }}
                            </span>
                          </span>
                        </span>

                        <span class="linha__vinculo">
                          <strong>{{ haQuantoTempo(item.vinculadoEm) }}</strong>
                          <small class="ui-num">{{ dataLegivel(item.vinculadoEm) }}</small>
                        </span>

                        <span
                          class="linha__num col-num"
                          :class="{ 'linha__num--zero': !item.totalAnotacoes }"
                          :title="anotacoesTexto(item.totalAnotacoes)"
                        >
                          <i class="ph ph-note-pencil" aria-hidden="true" />
                          <span class="ui-num" aria-hidden="true">{{ item.totalAnotacoes }}</span>
                          <span class="sr-only">{{ anotacoesTexto(item.totalAnotacoes) }}</span>
                        </span>

                        <span class="linha__prontuario">
                          <template v-if="prontuarioDoAcesso(item).length">
                            <span v-for="parte in prontuarioDoAcesso(item)" :key="parte.id">
                              <i :class="parte.icone" aria-hidden="true" />
                              {{ parte.texto }}
                            </span>
                          </template>
                          <span v-else class="linha__nada">{{ t('acessos.lista.soResumo') }}</span>
                        </span>

                        <span
                          v-if="item.status === 'ATIVO'"
                          class="prazo"
                          :class="{ 'prazo--perto': prazoUrgente(item) }"
                        >
                          <strong class="prazo__tempo ui-num">
                            <i v-if="prazoUrgente(item)" class="ph ph-alarm" aria-hidden="true" />
                            {{ prazoCurto(item) }}
                          </strong>
                          <span class="prazo__barra" aria-hidden="true">
                            <span :style="{ inlineSize: `${fracaoRestante(item) * 100}%` }" />
                          </span>
                          <small class="ui-num">{{ dataEHora(item.expiraEm) }}</small>
                          <span v-if="prazoUrgente(item)" class="sr-only">
                            {{ t('acessos.grupo.venceLogo') }}
                          </span>
                        </span>
                        <span v-else class="prazo prazo--fim">
                          <span class="ui-selo">
                            <i
                              :class="item.status === 'REVOGADO' ? 'ph ph-prohibit' : 'ph ph-hourglass'"
                              aria-hidden="true"
                            />
                            {{ statusLabel(item) }}
                          </span>
                          <small v-if="dataDoEncerramento(item)" class="ui-num">
                            {{ dataDoEncerramento(item) }}
                          </small>
                        </span>

                        <i
                          class="ph ph-caret-right ui-linha__seta linha__seta"
                          aria-hidden="true"
                        />
                      </RouterLink>
                    </li>

                    <li
                      v-if="grupo.acessos.length > acessosVisiveis(grupo).length"
                      class="sublista__mais"
                    >
                      <button type="button" class="ui-mais" @click="mostrarTodos(grupo.chave)">
                        {{
                          t(
                            'acessos.grupo.verOutros',
                            {
                              n: grupo.acessos.length - acessosVisiveis(grupo).length,
                              pet: grupo.petNome,
                            },
                            grupo.acessos.length - acessosVisiveis(grupo).length,
                          )
                        }}
                      </button>
                    </li>
                  </ul>
                </Transition>
              </template>
            </li>
          </ul>
        </section>

        <div v-if="hasMore" class="mais">
          <Button
            type="button"
            :label="t('acessos.list.loadMore')"
            severity="secondary"
            outlined
            :loading="loadingMore"
            @click="loadMore"
          />
        </div>
      </template>
    </div>

    <template #sempre>
      <VincularCodigoDialog
        v-model:visible="vincularVisible"
        :codigo-inicial="codigoDoLink"
        @vinculado="onVinculado"
        @guardado="onGuardado"
      />
    </template>
  </UiPagina>
</template>

<style scoped>
.acessos {
  display: grid;
  gap: 16px;
  /* Sem isto, um filho largo (a trilha do vazio) alarga a coluna e empurra a tela para fora. */
  grid-template-columns: minmax(0, 1fr);
}

.sr-only {
  position: absolute;
  overflow: hidden;
  width: 1px;
  height: 1px;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* ------------------------------------------------------------------ faixa do cadastro */

.faixa {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
  padding: 12px 16px 12px 12px;
  border: 1px solid color-mix(in oklab, var(--atencao) 40%, var(--linha));
  border-radius: 14px;
  background: var(--atencao-fundo);
}

.faixa__icone {
  display: grid;
  width: 36px;
  height: 36px;
  flex: none;
  place-items: center;
  border-radius: 10px;
  background: var(--superficie);
  color: var(--atencao-tinta);
  font-size: 19px;
}

.faixa__texto {
  display: grid;
  min-width: 0;
  flex: 1 1 280px;
  gap: 2px;
  line-height: 1.45;
}

.faixa__texto strong {
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
}

.faixa__texto span {
  color: var(--tinta-2);
  font-size: 13.5px;
}

.faixa__link {
  flex: none;
  text-decoration: none;
}

/* ------------------------------------------------------------------ explicações */

.guia {
  display: grid;
  gap: 14px;
}

.guia__lede {
  max-width: 72ch;
  margin: 0;
  color: var(--tinta-2);
  font-size: 14.5px;
  line-height: 1.5;
}

.guia__passos {
  padding: 24px 28px 28px;
}

@media (max-width: 640px) {
  .guia__passos {
    padding: 20px 18px 22px;
  }
}

/* ------------------------------------------------------------------ barra */

.barra {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 12px;
}

.barra__abas {
  flex: none;
}

.barra__abas :deep(.p-togglebutton-content) {
  min-height: 38px;
  padding-inline: 16px;
  font-size: 14.5px;
}

.barra__busca {
  min-width: min(100%, 16rem);
  flex: 1 1 22rem;
  max-width: 40rem;
}

.barra__busca :deep(.p-inputtext) {
  min-height: 46px;
  padding-inline-start: 44px;
  font-size: 15.5px;
}

.barra__busca :deep(.p-inputicon) {
  inset-inline-start: 15px;
  color: var(--tinta-2);
  font-size: 19px;
}

.barra__filtros.p-button {
  min-height: 46px;
  gap: 8px;
  padding-inline: 16px;
  font-size: 14.5px;
  font-weight: 500;
}

.barra__filtros .ph-sliders-horizontal {
  font-size: 18px;
}

.barra__filtros--ligado.p-button {
  border-color: var(--pj-lugar);
}

.barra__total.ui-contagem {
  background: var(--pj-lugar-fundo);
  color: var(--pj-lugar-tinta);
}

.barra__seta {
  color: var(--tinta-3);
  font-size: 13px;
}

/* ------------------------------------------------------------------ filtros */

.filtros {
  padding: 16px 18px 18px;
}

.filtros__grade {
  display: grid;
  align-items: end;
  gap: 14px 16px;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
}

.campo {
  display: grid;
  min-width: 0;
  gap: 6px;
}

.campo__rotulo {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 550;
}

.campo :deep(.p-select),
.campo :deep(.p-datepicker) {
  width: 100%;
}

.campo--periodo {
  grid-column: span 1;
}

.campo--interruptor {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 42px;
}

.campo__interruptor {
  display: grid;
  gap: 1px;
  cursor: pointer;
  line-height: 1.3;
}

.campo__interruptor strong {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 550;
}

.campo__interruptor small {
  color: var(--tinta-2);
  font-size: 12.5px;
}

/* As fichas do que está aplicado. */
.aplicados {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
  margin-top: -4px;
}

.ficha {
  display: inline-flex;
  min-height: 32px;
  align-items: center;
  gap: 6px;
  padding: 0 8px 0 12px;
  border: 1px solid color-mix(in oklab, var(--pj-lugar) 45%, var(--linha));
  border-radius: 999px;
  background: var(--pj-lugar-fundo);
  color: var(--pj-lugar-tinta);
  cursor: pointer;
  font: inherit;
  font-size: 13.5px;
  font-weight: 550;
}

.ficha i {
  font-size: 13px;
}

.ficha:hover {
  border-color: var(--pj-lugar);
}

.ficha:focus-visible {
  outline: 2px solid var(--pj-lugar);
  outline-offset: 2px;
}

/* ------------------------------------------------------------------ o quadro */

/*
 * Uma grade só para o cabeçalho, as linhas e as sublinhas: as colunas batem de cima a baixo. O
 * quadro decide a forma pela largura que tem (a barra aberta ou fechada muda a conta).
 */
.quadro {
  --colunas: minmax(0, 2.3fr) minmax(7.5rem, 1fr) 6.5rem minmax(9rem, 1.15fr) minmax(10rem, 1.2fr)
    20px;

  overflow: hidden;
  container: quadro / inline-size;
}

.quadro__cab {
  display: grid;
  min-height: 40px;
  align-items: center;
  column-gap: 16px;
  padding: 0 20px;
  border-bottom: 1px solid var(--linha);
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 550;
  grid-template-columns: var(--colunas);
}

.quadro__cab > span:first-child {
  padding-inline-start: 52px;
}

.col-num {
  justify-self: start;
}

/* No cartão, a primeira linha vem depois do cabeçalho: sem canto arredondado no hover. */
.quadro .ui-lista > li:first-child > .ui-linha {
  border-top-left-radius: 0;
  border-top-right-radius: 0;
}

.linha.ui-linha {
  display: grid;
  min-height: 72px;
  column-gap: 16px;
  padding-block: 12px;
  grid-template-columns: var(--colunas);
}

.linha.ui-marca::before {
  top: 14px;
  bottom: 14px;
}

.linha__pet {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 14px;
}

.linha__pet .ui-linha__titulo {
  font-size: 15px;
  white-space: nowrap;
}

.linha__pet .ui-linha__meta {
  white-space: nowrap;
}

.linha__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 6px;
}

.linha__servico {
  white-space: nowrap;
}

.linha__meta > span + span::before {
  margin-inline-end: 6px;
  color: var(--tinta-3);
  content: '·';
}

.linha__servico i {
  margin-inline-end: 2px;
  color: var(--pj-lugar-tinta);
  font-size: 14px;
  vertical-align: -2px;
}

.linha__atualizado.ui-selo {
  max-width: 100%;
  height: auto;
  min-height: 22px;
  justify-self: start;
  margin-top: 4px;
  padding: 3px 7px;
  font-size: 12px;
  line-height: 1.3;
  white-space: normal;
}

.linha__estreito {
  display: none;
  overflow: hidden;
  color: var(--tinta-2);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.linha__vinculo {
  display: grid;
  min-width: 0;
  gap: 1px;
  line-height: 1.3;
}

.linha__vinculo strong {
  overflow: hidden;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 550;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.linha__vinculo small {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.linha__num {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--tinta);
  font-size: 16px;
  font-weight: 650;
}

.linha__num i {
  color: var(--tinta-2);
  font-size: 17px;
}

/* Zero anotações continua sendo informação ("já anotei algo aqui?"), mas pesa menos. */
.linha__num--zero {
  color: var(--tinta-3);
  font-weight: 500;
}

.linha__num--zero i {
  color: var(--tinta-3);
}

.linha__prontuario {
  display: grid;
  min-width: 0;
  gap: 3px;
  color: var(--tinta);
  font-size: 13.5px;
  line-height: 1.3;
}

.linha__prontuario > span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.linha__prontuario i {
  color: var(--pj-lugar-tinta);
  font-size: 15px;
}

.linha__prontuario .linha__nada {
  color: var(--tinta-3);
}

/* O prazo: o número que conta para trás, a barra que esvazia e quando fecha. */
.prazo {
  display: grid;
  min-width: 0;
  gap: 4px;
  line-height: 1.25;
}

.prazo__tempo {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--tinta);
  font-size: 16px;
  font-weight: 650;
  letter-spacing: -0.01em;
  white-space: nowrap;
}

.prazo__tempo i {
  font-size: 16px;
}

.prazo__barra {
  display: block;
  overflow: hidden;
  width: 100%;
  max-width: 9rem;
  height: 5px;
  border-radius: 999px;
  background: var(--superficie-3);
}

.prazo__barra > span {
  display: block;
  height: 100%;
  min-inline-size: 4px;
  border-radius: inherit;
  background: var(--pj-lugar);
}

.prazo small {
  color: var(--tinta-2);
  font-size: 12.5px;
  white-space: nowrap;
}

.prazo--perto .prazo__tempo,
.prazo--perto small {
  color: var(--atencao-tinta);
}

.prazo--perto .prazo__barra > span {
  background: var(--atencao);
}

.prazo--fim .ui-selo {
  justify-self: start;
}

.linha__seta {
  justify-self: end;
}

.linha__alternar {
  display: grid;
  width: 28px;
  height: 28px;
  justify-self: end;
  place-items: center;
  border-radius: 8px;
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 14px;
}

.linha--grupo[aria-expanded='true'] .linha__alternar {
  background: var(--pj-lugar-fundo);
  color: var(--pj-lugar-tinta);
}

/* Os acessos do pet, presos ao rosto dele por um fio: pertencem a ele, não à lista. */
.sublista {
  position: relative;
  display: grid;
  margin: 0;
  padding: 0 0 6px;
  background: color-mix(in oklab, var(--superficie-2) 55%, var(--superficie));
  list-style: none;
}

.sublista > li + li {
  border-top: 1px dashed var(--linha);
}

.sublista::before {
  position: absolute;
  top: 0;
  bottom: 18px;
  left: 36px;
  width: 2px;
  border-radius: 2px;
  background: var(--linha);
  content: '';
}

.linha--acesso.ui-linha {
  min-height: 60px;
}

.linha__pet--acesso {
  padding-inline-start: 52px;
}

.linha__icone-servico {
  display: grid;
  width: 30px;
  height: 30px;
  flex: none;
  place-items: center;
  border-radius: 9px;
  background: var(--pj-lugar-fundo);
  color: var(--pj-lugar-tinta);
  font-size: 16px;
}

.linha--acesso .ui-linha__titulo {
  font-size: 14.5px;
}

.sublista__mais {
  padding: 8px 18px 4px 70px;
}

.mais {
  display: flex;
  justify-content: center;
}

/* ------------------------------------------------------------------ esqueleto e estados */

.esqueleto {
  display: flex;
  min-height: 72px;
  align-items: center;
  gap: 14px;
  padding: 12px 18px;
}

.esqueleto__rosto {
  width: 44px;
  height: 44px;
  flex: none;
  border-radius: 14px;
  background: var(--superficie-3);
}

.esqueleto__texto {
  display: grid;
  flex: 1;
  gap: 8px;
}

.esqueleto__osso {
  display: block;
  width: 40%;
  height: 10px;
  border-radius: 6px;
  background: var(--superficie-3);
  animation: pulsar 1.4s ease-in-out infinite;
}

.esqueleto__osso--nome {
  width: 22%;
  height: 13px;
}

.esqueleto__osso--fim {
  width: 9rem;
  flex: none;
}

@keyframes pulsar {
  50% {
    opacity: 0.45;
  }
}

.estado {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 40px 24px;
  text-align: center;
}

.estado h2 {
  margin: 8px 0 0;
  color: var(--tinta);
  font-size: 18px;
  font-weight: 650;
}

.estado p {
  max-width: 48ch;
  margin: 0;
  color: var(--tinta-2);
  font-size: 14.5px;
  line-height: 1.5;
  /* Centrado, sem uma palavra sozinha na última linha ("…da sua / empresa."). */
  text-wrap: balance;
}

.estado > :deep(.p-button) {
  margin-top: 10px;
}

/*
 * Nenhum acesso ativo: o recado em cima, a trilha das etapas num poço no meio e a ação sozinha
 * embaixo. Cada andar tem o seu respiro; nada se sobrepõe, em largura nenhuma.
 */
.vazio-ativos {
  display: grid;
  justify-items: center;
  gap: 28px;
  padding: 44px 32px 40px;
}

.vazio-ativos__recado {
  display: grid;
  justify-items: center;
  gap: 8px;
  text-align: center;
}

.vazio-ativos__recado h2 {
  margin: 10px 0 0;
  color: var(--tinta);
  font-size: 19px;
  font-weight: 650;
  letter-spacing: -0.015em;
}

.vazio-ativos__recado p {
  max-width: 46ch;
  margin: 0;
  color: var(--tinta-2);
  font-size: 14.5px;
  line-height: 1.55;
  text-wrap: balance;
}

.vazio-ativos__guia.ui-poco {
  display: grid;
  width: 100%;
  max-width: 920px;
  gap: 22px;
  padding: 24px 28px 28px;
}

/* O título acompanha a trilha: centrado com as etapas em fileira, à esquerda com elas em coluna. */
.vazio-ativos__guia {
  container: guia-vazio / inline-size;
}

.vazio-ativos__guia-titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 650;
  text-align: start;
}

@container guia-vazio (min-width: 620px) {
  .vazio-ativos__guia-titulo {
    text-align: center;
  }
}

.vazio-ativos__acao {
  display: flex;
  justify-content: center;
}

@media (max-width: 640px) {
  .vazio-ativos {
    gap: 24px;
    padding: 32px 16px 28px;
  }

  .vazio-ativos__guia.ui-poco {
    padding: 20px 18px 22px;
  }

  .vazio-ativos__acao,
  .vazio-ativos__acao :deep(.p-button) {
    width: 100%;
  }

  .vazio-ativos__acao :deep(.p-button) {
    justify-content: center;
  }
}

/* ------------------------------------------------------------------ movimento */

.abre-enter-active {
  transition:
    opacity var(--pj-tempo-medio) var(--pj-curva-chega),
    transform var(--pj-tempo-medio) var(--pj-curva-chega);
}

.abre-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .abre-enter-active {
    transition: none;
  }

  .esqueleto__osso {
    animation: none;
  }
}

/* ------------------------------------------------------------------ larguras */

/* Quadro médio: some a coluna do vínculo, que desce para baixo do nome. */
@container quadro (max-width: 940px) {
  .quadro__cab,
  .linha.ui-linha {
    --colunas: minmax(0, 2fr) 5.5rem minmax(8.5rem, 1.1fr) minmax(9.5rem, 1.1fr) 20px;
  }

  .quadro__cab > span:nth-child(2),
  .linha__vinculo {
    display: none;
  }

  .linha__estreito {
    display: block;
  }
}

/* Quadro estreito (celular): rosto, nome e o prazo; o resto vira frase embaixo do nome. */
@container quadro (max-width: 620px) {
  .quadro__cab,
  .linha.ui-linha {
    --colunas: minmax(0, 1fr) auto 16px;
  }

  .quadro__cab {
    display: none;
  }

  .linha.ui-linha {
    column-gap: 12px;
    padding-inline: 14px 12px;
  }

  .linha__num,
  .linha__prontuario {
    display: none;
  }

  .linha__pet {
    gap: 12px;
  }

  .linha__pet .ui-linha__meta,
  .linha__estreito {
    white-space: normal;
  }

  .prazo {
    justify-items: end;
    text-align: end;
  }

  .prazo__barra {
    width: 5rem;
  }

  .prazo small {
    display: none;
  }

  .prazo--fim small {
    display: block;
  }

  .linha__pet--acesso {
    padding-inline-start: 50px;
  }

  .sublista::before {
    left: 32px;
  }

  .sublista__mais {
    padding-inline-start: 64px;
  }
}

@media (max-width: 640px) {
  .barra__abas {
    width: 100%;
  }

  .barra__abas :deep(.p-togglebutton) {
    flex: 1 1 0;
  }

  .barra__busca {
    flex-basis: 100%;
    max-width: none;
  }

  .barra__filtros.p-button {
    flex: 1 1 auto;
  }
}
</style>
