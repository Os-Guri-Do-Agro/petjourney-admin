<script setup lang="ts">
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { PhHeart } from '@phosphor-icons/vue'
import { useToast } from 'primevue/usetoast'
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import AnotacaoEstruturadaFields from '@/components/parceiro/AnotacaoEstruturadaFields.vue'
import AnotacaoEstruturadaView from '@/components/parceiro/AnotacaoEstruturadaView.vue'
import LerReceitaComIA from '@/components/parceiro/LerReceitaComIA.vue'
import PartnerOperabilityBanner from '@/components/parceiro/PartnerOperabilityBanner.vue'
import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import PartnerSectionTabs from '@/components/parceiro/PartnerSectionTabs.vue'
import { useAgora } from '@/composables/useAgora'
import { useLeituraReceitaParceiro } from '@/composables/useLeituraReceitaParceiro'
import { useRevalidarAoVoltar } from '@/composables/useRevalidarAoVoltar'
import { isGuidanceVisible } from '@/composables/useLayoutPreferences'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { usePartnerTabs } from '@/composables/usePartnerTabs'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import { ApiError } from '@/service/api'
import {
  criarAnotacao,
  getAnexoSignedUrl,
  getArquivoSignedUrl,
  getCompartilhamentoDetalhe,
} from '@/service/parceiro/compartilhamentos-service'
import type {
  Anotacao,
  BlocoSnapshot,
  CompartilhamentoDetalhe,
  TipoDocumentoAnexo,
} from '@/service/parceiro/types'
import { calcularTempoRestante } from '@/utils/format/expiracao'
import { classificarFalhaArquivo } from '@/utils/parceiro/arquivo-compartilhado'
import {
  ESPECIALIDADES,
  ESPECIALIDADE_OUTRA,
  rotuloEspecialidade,
  servidorGuardouEspecialidade,
  valorEspecialidade,
  type EscolhaEspecialidade,
} from '@/utils/parceiro/especialidade'
import {
  criarAnotacaoEstruturadaForm,
  LIMITES_CAMPOS_LIVRES,
  montarAnotacaoEstruturada,
  tipoAceitaEstruturado,
  validarAnotacaoEstruturada,
} from '@/utils/parceiro/anotacao-estruturada'
import { mesclarPrescricaoLida, temCampoAConferir } from '@/utils/parceiro/leitura-receita'
import type {
  BlocoLista,
  FonteSnapshot,
  MotivoVazioRender,
} from '@/utils/parceiro/snapshot-compartilhado'
import {
  carimboDoResumo,
  estadoDoBloco,
  estadoTratamentosContinuos,
  montarBlocosLista,
  rotuloItem,
} from '@/utils/parceiro/snapshot-compartilhado'

const DETALHE_TABS = ['resumo', 'anotacoes'] as const
type DetalheTab = (typeof DETALHE_TABS)[number]

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { store, ensureContext, parceiroQuery } = useParceiroPortal()
const { activeTab, setTab } = usePartnerTabs(DETALHE_TABS, 'resumo')
const agora = useAgora()

const detalhe = ref<CompartilhamentoDetalhe | null>(null)
const loading = ref(true)
const error = ref('')

const MAX_ANEXOS = 3
const MAX_ANEXO_BYTES = 10 * 1024 * 1024
const MIMES_ACEITOS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']

const TIPOS_DOCUMENTO: TipoDocumentoAnexo[] = [
  'Receita Medica',
  'Exame de Sangue',
  'Raio-X',
  'Ultrassom',
  'Outro',
]

type AnexoForm = {
  file: File
  tipoDocumento: TipoDocumentoAnexo | null
}

const anotacaoForm = reactive({
  servicoRealizado: '',
  texto: '',
  profissionalNome: '',
  especialidade: null as EscolhaEspecialidade,
  especialidadeOutra: '',
})

/** Prefixo das chaves de rotulo de area, usado no chip e na linha do autor. */
const SUFIXO_ESPECIALIDADE = 'acessos.especialidade.'

/**
 * A lista fechada mais "Outra": fora dela, o valor e texto livre do parceiro. Num Select, e nao
 * em treze chips: o campo e opcional e os chips ocupavam quatro linhas da folha.
 */
const opcoesEspecialidade = computed(() =>
  [...ESPECIALIDADES, ESPECIALIDADE_OUTRA].map((value) => ({
    value,
    label: t(SUFIXO_ESPECIALIDADE + value),
  })),
)

/** O X do Select limpa: o campo e opcional e precisa de volta ao vazio. */
function escolherEspecialidade(valor: EscolhaEspecialidade) {
  anotacaoForm.especialidade = valor ?? null

  if (anotacaoForm.especialidade !== ESPECIALIDADE_OUTRA) {
    anotacaoForm.especialidadeOutra = ''
  }
}

/**
 * Linha do autor: "Dra. Ana (Cardiologia)".
 *
 * A area so vira parenteses quando existe: anotacao criada antes do campo vem sem ele e a
 * linha sai como sempre saiu, nunca com "(null)". Sem nome e com area, a area aparece
 * sozinha, porque e a unica coisa que se sabe de quem atendeu.
 */
function autorDaAnotacao(anotacao: Anotacao): string | null {
  const area = rotuloEspecialidade(anotacao.profissionalEspecialidade, (chave) =>
    t(SUFIXO_ESPECIALIDADE + chave),
  )

  if (!anotacao.profissionalNome) {
    return area
  }

  return area ? anotacao.profissionalNome + ' (' + area + ')' : anotacao.profissionalNome
}
const estruturadaForm = ref(criarAnotacaoEstruturadaForm())
const estruturadaErros = ref<Record<string, string>>({})
const anexosForm = ref<AnexoForm[]>([])
const formError = ref('')
const submittingAnotacao = ref(false)
const abrindoAnexoId = ref<string | null>(null)
/** Chave `acao:arquivoId`: abrir e baixar o mesmo arquivo não podem girar juntos. */
const arquivoOcupado = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

const compartilhamentoId = computed(() =>
  typeof route.params.id === 'string' ? route.params.id : '',
)

const isAtivo = computed(() => detalhe.value?.status === 'ATIVO')

/**
 * Anotar é mutação, e mutação é gated por auditoria (seção 4). Leitura não: o
 * acesso continua valendo porque quem o consentiu foi o responsável, e o
 * cadastro do parceiro ter caído em análise não desfaz esse consentimento.
 */
const podeAnotar = computed(() => isAtivo.value && store.podeOperar)

/** Acesso vivo, mas o cadastro perdeu a operabilidade: só leitura. */
const somenteLeitura = computed(() => isAtivo.value && !store.podeOperar)

/** OUTRO segue só com o formulário livre; os demais tipos ganham campos próprios. */
const temCamposEstruturados = computed(() =>
  detalhe.value ? tipoAceitaEstruturado(detalhe.value.tipoServico) : false,
)

/**
 * Ler receita com IA: só em acesso de CONSULTA (a API recusa os outros com 400) e enquanto o
 * recurso não respondeu 503. Toda a equipe pode (DONO e OPERADOR).
 */
const leituraReceita = useLeituraReceitaParceiro({
  compartilhamentoId,
  parceiroQuery,
  anexosDoFormulario: () => anexosForm.value.length,
  aoLer: (leitura) => {
    const mescla = mesclarPrescricaoLida(estruturadaForm.value.prescricaoItens, leitura)
    estruturadaForm.value.prescricaoItens = mescla.itens

    return {
      aplicados: mescla.aplicados,
      cortados: mescla.cortados,
      temConferir: temCampoAConferir(mescla.itens.slice(mescla.itens.length - mescla.aplicados)),
    }
  },
  aoEncerrarAcesso: () => {
    formError.value = t('acessos.anotacao.encerrado')
    void loadDetalhe(true)
  },
  aoFicarIndisponivel: (mensagem) => {
    toast.add({
      severity: 'warn',
      summary: mensagem || t('acessos.leituraReceita.indisponivel'),
      life: 6000,
    })
  },
})

const mostrarLeituraReceita = computed(
  () => detalhe.value?.tipoServico === 'CONSULTA' && leituraReceita.disponivel,
)

/** Lugar ocupado no teto de anexos: os do formulário mais os arquivos da receita. */
const anexosOcupados = computed(() => anexosForm.value.length + leituraReceita.reservados)

const anotacoesOrdenadas = computed(() =>
  [...(detalhe.value?.anotacoes ?? [])].sort(
    (a, b) => new Date(b.criadaEm).getTime() - new Date(a.criadaEm).getTime(),
  ),
)

/** Encerrado não tem snapshot: só a aba de anotações faz sentido. */
const tabs = computed(() => {
  const resumo = {
    id: 'resumo',
    label: t('acessos.detalhe.tabs.resumo.label'),
    description: t('acessos.detalhe.tabs.resumo.description'),
  }
  const anotacoes = {
    id: 'anotacoes',
    label: `${t('acessos.detalhe.tabs.anotacoes.label')} (${anotacoesOrdenadas.value.length})`,
    description: t('acessos.detalhe.tabs.anotacoes.description'),
  }

  return isAtivo.value ? [resumo, anotacoes] : [anotacoes]
})

const displayTab = computed<DetalheTab>(() => (isAtivo.value ? activeTab.value : 'anotacoes'))

const tabsAriaLabel = computed(() =>
  t('frame.tabs.aria', { labels: tabs.value.map((tab) => tab.label).join(', ') }),
)

const servicoLabel = computed(() => {
  if (!detalhe.value) {
    return ''
  }

  if (detalhe.value.tipoServico === 'OUTRO' && detalhe.value.servicoOutroLabel) {
    return detalhe.value.servicoOutroLabel
  }

  return t(`acessos.servico.${detalhe.value.tipoServico}`)
})

function normalizeTutorText(value: string | null | undefined) {
  return value?.replace(/\s+/g, ' ').trim() ?? ''
}

const mensagemTutor = computed(() => normalizeTutorText(detalhe.value?.mensagemTutor))

/** Peso é identidade do pet, não lista clínica: fica no cabeçalho, junto de espécie e serviço. */
const pesoKg = computed(() => detalhe.value?.snapshot?.pesoKg ?? null)

const observacoesTutor = computed(() =>
  normalizeTutorText(detalhe.value?.snapshot?.observacoesTutor),
)

/** Evita dois blocos iguais quando a API espelha a mesma frase nos dois campos. */
const showObservacoesTutor = computed(() => {
  if (!observacoesTutor.value) {
    return false
  }

  return (
    observacoesTutor.value.localeCompare(mensagemTutor.value, undefined, {
      sensitivity: 'accent',
    }) !== 0
  )
})

const APARENCIA_BLOCO: Record<BlocoLista, { icon: string; tone: 'warm' | 'default' }> = {
  alergias: { icon: 'ph ph-warning', tone: 'warm' },
  vacinas: { icon: 'ph ph-shield', tone: 'default' },
  medicamentos: { icon: 'ph ph-tray', tone: 'default' },
  comportamento: { icon: 'ph ph-eye', tone: 'default' },
  diagnosticos: { icon: 'ph ph-note-pencil', tone: 'default' },
}

/** Entrada das regras da Parte 15: status manda tanto quanto o snapshot. */
const fonteSnapshot = computed<FonteSnapshot>(() => ({
  status: detalhe.value?.status ?? 'EXPIRADO',
  categorias: detalhe.value?.categorias,
  snapshot: detalhe.value?.snapshot,
}))

/** Traduz a chave de motivo que o núcleo devolveu. Genérico não afirma ausência de registro. */
function textoMotivo(bloco: BlocoSnapshot, motivo: MotivoVazioRender) {
  if (motivo === 'FILTRADO_JANELA') {
    return t('acessos.snapshot.vazio.diarioFiltrado')
  }

  if (motivo === 'SEM_REGISTRO') {
    return t(`acessos.snapshot.vazio.semRegistro.${bloco}`)
  }

  /** Frase única para todos os blocos: o que aconteceu é o mesmo, mudou só a categoria. */
  if (motivo === 'REMOVIDO_PELO_TUTOR') {
    return t('acessos.snapshot.vazio.removido')
  }

  return t('acessos.snapshot.vazio.generico')
}

/** Categoria compartilhada com bloco vazio continua rendendo seção — com o motivo. */
const snapshotListSections = computed(() =>
  montarBlocosLista(fonteSnapshot.value).map((bloco) => {
    const items = bloco.items.map((item) => ({
      ...rotuloItem(item),
      destaque: item.destaque,
    }))

    return {
      id: bloco.id,
      title: t(`acessos.snapshot.${bloco.id}`),
      icon: APARENCIA_BLOCO[bloco.id].icon,
      // Alergia sem nenhuma registrada não é alerta: o tom quente só com item na lista.
      tone: items.length ? APARENCIA_BLOCO[bloco.id].tone : 'default',
      items,
      /** Linha recolhida mostra os primeiros nomes: dá para ler sem abrir. */
      resumo: items.map((item) => item.titulo).join(', '),
      vazioTexto: bloco.motivo ? textoMotivo(bloco.id, bloco.motivo) : '',
    }
  }),
)

/**
 * Tratamento contínuo em bloco próprio (Parte 16): o remédio de todo dia.
 *
 * Quem decide se o bloco existe é `estadoTratamentosContinuos`, e não o tamanho desta
 * lista: a chave ausente no snapshot significa "acesso criado antes da Parte 16", e ali o
 * tratamento continua saindo fundido dentro de Medicamentos. O `?? []` abaixo é só para
 * iterar depois que o estado já disse `CONTEUDO`.
 */
const tratamentosEstado = computed(() => estadoTratamentosContinuos(fonteSnapshot.value))

const tratamentosContinuos = computed(() =>
  (detalhe.value?.snapshot?.tratamentosContinuos ?? []).map((item, index) => {
    const campos = [
      { chave: 'motivo', valor: item.motivo },
      { chave: 'diagnostico', valor: item.diagnostico },
      { chave: 'desde', valor: item.desde ? formatDate(item.desde) : null },
    ]
      // Campo nulo não vira linha vazia nem "(null)" na tela.
      .filter((campo) => Boolean(campo.valor && campo.valor.trim()))
      .map((campo) => ({
        chave: campo.chave,
        label: t(`acessos.tratamentos.campos.${campo.chave}`),
        valor: campo.valor as string,
      }))

    return {
      key: `${item.titulo}-${index}`,
      titulo: item.titulo,
      /*
       * `detalheLabel` é a mesma posologia com os enums traduzidos. Hoje sai igual a
       * `detalhe` (dose, frequência e via são texto livre do responsável); ler o label
       * primeiro deixa a tela pronta para quando algum deles virar enum no backend.
       */
      posologia: (item.detalheLabel ?? item.detalhe ?? '').trim(),
      campos,
      observacoes: item.observacoes?.trim() || null,
    }
  }),
)

const tratamentosVazioTexto = computed(() =>
  tratamentosEstado.value === 'OCULTO' || tratamentosEstado.value === 'CONTEUDO'
    ? ''
    : textoMotivo('tratamentosContinuos', tratamentosEstado.value),
)

/**
 * Documentos do prontuário liberados item a item. O snapshot traz só ids do cofre
 * (`arquivoIds`), nunca URL: cada abrir/baixar pede uma signed URL nova.
 */
const documentos = computed(() => {
  const lista = detalhe.value?.snapshot?.documentos ?? []

  return lista.map((doc, index) => ({
    key: doc.origemId || `${doc.nome}-${index}`,
    nome: doc.nome,
    tipo: doc.tipo,
    emissao: doc.dataEmissao ? formatDate(doc.dataEmissao) : null,
    expiracao: doc.dataExpiracao ? formatDate(doc.dataExpiracao) : null,
    arquivos: doc.arquivoIds.map((id) => ({ id, nome: doc.nome })),
  }))
})

const documentosEstado = computed(() =>
  estadoDoBloco(fonteSnapshot.value, 'documentos', documentos.value.length),
)

const documentosVazioTexto = computed(() =>
  documentosEstado.value === 'OCULTO' || documentosEstado.value === 'CONTEUDO'
    ? ''
    : textoMotivo('documentos', documentosEstado.value),
)

/** Um dia do diário com anormalidade. Labels já chegam localizados do backend. */
const diario = computed(() => {
  const entradas = detalhe.value?.snapshot?.diario ?? []

  return entradas.map((entrada, index) => {
    const campos = (
      [
        ['vitalidade', entrada.vitalidade],
        ['alimentacao', entrada.alimentacao],
        ['hidratacao', entrada.hidratacao],
        ['fezes', entrada.fezes],
        ['urina', entrada.urina],
        ['cicloCio', entrada.cicloCio],
      ] as const
    )
      .filter(([, valor]) => Boolean(valor?.trim()))
      .map(([chave, valor]) => ({
        chave,
        label: t(`acessos.diario.campos.${chave}`),
        valor: valor as string,
      }))

    const textos = (
      [
        ['remedios', entrada.remedios],
        ['observacoes', entrada.observacoes],
        ['nota', entrada.nota],
      ] as const
    )
      .filter(([, valor]) => Boolean(valor?.trim()))
      .map(([chave, valor]) => ({
        chave,
        label: t(`acessos.diario.campos.${chave}`),
        valor: (valor as string).trim(),
      }))

    return {
      key: `${entrada.data}-${index}`,
      data: formatDate(entrada.data),
      sintomas: [...entrada.sintomas, ...(entrada.sintomasOutros ? [entrada.sintomasOutros] : [])],
      doencas: [...entrada.doencas, ...(entrada.doencasOutras ? [entrada.doencasOutras] : [])],
      campos,
      textos,
      fotoIds: entrada.fotoIds ?? [],
    }
  })
})

const diarioEstado = computed(() =>
  estadoDoBloco(fonteSnapshot.value, 'diario', diario.value.length),
)

const diarioVazioTexto = computed(() =>
  diarioEstado.value === 'OCULTO' || diarioEstado.value === 'CONTEUDO'
    ? ''
    : textoMotivo('diario', diarioEstado.value),
)

/** `snapshotAtualizadoEm` quando o responsável mexeu depois de entregar; senão `criadoEm`. */
const carimbo = computed(() => (detalhe.value ? carimboDoResumo(detalhe.value) : null))

/**
 * Snapshot é filtrado pelas categorias que o responsável marcou: ele pode liberar o
 * acesso sem nenhuma. Também cobre `snapshot: null`, que antes caía no `v-else`
 * e renderizava o painel de anotações sob a aba "Resumo do pet".
 * Peso não conta aqui: ele é exibido no cabeçalho, fora da aba.
 */
const resumoVazio = computed(
  () =>
    !mensagemTutor.value &&
    !showObservacoesTutor.value &&
    snapshotListSections.value.length === 0 &&
    tratamentosEstado.value === 'OCULTO' &&
    documentosEstado.value === 'OCULTO' &&
    diarioEstado.value === 'OCULTO',
)

/** Seções abertas: alergias sempre; demais só se a lista for curta. */
const openSections = ref<Record<string, boolean>>({})

watch(
  snapshotListSections,
  (sections) => {
    const next = { ...openSections.value }

    for (const section of sections) {
      if (!(section.id in next)) {
        next[section.id] = section.id === 'alergias' || section.items.length <= 2
      }
    }

    openSections.value = next
  },
  { immediate: true },
)

function toggleSection(id: string) {
  openSections.value = {
    ...openSections.value,
    [id]: !openSections.value[id],
  }
}

function isSectionOpen(id: string) {
  return Boolean(openSections.value[id])
}

const tiposDocumentoOptions = computed(() =>
  TIPOS_DOCUMENTO.map((value) => ({ value, label: value })),
)

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(INTL_LOCALE[locale.value as Locale], {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(INTL_LOCALE[locale.value as Locale], {
    dateStyle: 'medium',
  })
}

function expiraLabel(value: string) {
  const restante = calcularTempoRestante(value, agora.value)

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

function resetAnotacaoForm() {
  anotacaoForm.servicoRealizado = ''
  anotacaoForm.texto = ''
  anotacaoForm.profissionalNome = ''
  anotacaoForm.especialidade = null
  anotacaoForm.especialidadeOutra = ''
  estruturadaForm.value = criarAnotacaoEstruturadaForm()
  estruturadaErros.value = {}
  anexosForm.value = []
  formError.value = ''
  leituraReceita.limpar()

  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

/**
 * `silencioso` é a releitura de fundo — a que acontece ao voltar para a aba.
 *
 * Ela não pode desmontar a tela: esvaziar `detalhe` e acender o spinner faria a página piscar
 * a cada alt-tab, e trocaria uma leitura que estava boa por um esqueleto. E falha de fundo não
 * vira tela de erro pelo mesmo motivo — a rede caiu, o que já estava lido continua válido.
 */
async function loadDetalhe(silencioso = false) {
  const id = compartilhamentoId.value

  if (!id) {
    void router.replace('/parceiro/acessos')
    return
  }

  if (!silencioso) {
    loading.value = true
    error.value = ''
    detalhe.value = null
  }

  try {
    await ensureContext()
    detalhe.value = await getCompartilhamentoDetalhe(id, parceiroQuery())
  } catch (err) {
    /** 403 aqui pode ser o parceiro excluído no meio da sessão: a tela de saída assume. */
    if (await store.revalidarAcesso(err)) {
      return
    }

    if (!silencioso) {
      error.value = err instanceof Error ? err.message : t('acessos.detalhe.errorLoad')
    }
  } finally {
    if (!silencioso) {
      loading.value = false
    }
  }
}

function voltar() {
  void router.push('/parceiro/acessos')
}

/**
 * Do resumo vazio para a folha. Na tela estreita troca de aba; na larga a folha já está ao
 * lado, e a troca sozinha não faria nada visível: o foco no primeiro campo é que leva até ela.
 */
async function irParaFolha() {
  setTab('anotacoes')
  await nextTick()
  document.getElementById('anot-servico')?.focus()
}

function onAnexosSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  formError.value = ''

  for (const file of files) {
    // A receita lida (ou em leitura) também ocupa lugar: a API a copia como anexo.
    if (anexosOcupados.value >= MAX_ANEXOS) {
      formError.value = t('acessos.anotacao.maxAnexos', { n: MAX_ANEXOS }, MAX_ANEXOS)
      break
    }

    if (!MIMES_ACEITOS.includes(file.type)) {
      formError.value = t('acessos.anotacao.tipoInvalido', { nome: file.name })
      continue
    }

    if (file.size > MAX_ANEXO_BYTES) {
      formError.value = t('acessos.anotacao.tamanhoInvalido', { nome: file.name })
      continue
    }

    anexosForm.value.push({ file, tipoDocumento: null })
  }

  input.value = ''
}

function removeAnexo(index: number) {
  anexosForm.value.splice(index, 1)
}

/** Erros dos campos estruturados, já traduzidos e indexados pelo id do campo. */
function validarEstruturada() {
  if (!detalhe.value || !temCamposEstruturados.value) {
    estruturadaErros.value = {}
    return true
  }

  const erros = validarAnotacaoEstruturada(detalhe.value.tipoServico, estruturadaForm.value)

  estruturadaErros.value = Object.fromEntries(
    erros.map((erro) => [
      erro.id,
      t(`acessos.estruturada.erros.${erro.chave}`, { ...erro.params }),
    ]),
  )

  return erros.length === 0
}

async function submitAnotacao() {
  if (!detalhe.value) {
    return
  }

  const servico = anotacaoForm.servicoRealizado.trim()
  const texto = anotacaoForm.texto.trim()

  if (!servico || !texto) {
    formError.value = t('acessos.anotacao.camposObrigatorios')
    return
  }

  // Tetos que o backend passou a impor nos campos livres: barrar aqui evita perder
  // a anotação inteira num 400 depois que o prestador já escreveu tudo.
  if (
    servico.length > LIMITES_CAMPOS_LIVRES.servicoRealizado ||
    texto.length > LIMITES_CAMPOS_LIVRES.texto ||
    anotacaoForm.profissionalNome.trim().length > LIMITES_CAMPOS_LIVRES.profissionalNome
  ) {
    formError.value = t('acessos.anotacao.textoLongo')
    return
  }

  if (!validarEstruturada()) {
    formError.value = t('acessos.estruturada.erros.formulario')
    return
  }

  // Receita escolhida ou ainda em leitura: mandar agora perderia a leitura.
  if (leituraReceita.ocupada) {
    formError.value = t('acessos.leituraReceita.enviarAntes')
    return
  }

  const leituraReceitaId = leituraReceita.leituraReceitaId ?? undefined

  const areaEnviada = valorEspecialidade(
    anotacaoForm.especialidade,
    anotacaoForm.especialidadeOutra,
    LIMITES_CAMPOS_LIVRES.profissionalEspecialidade,
  )

  submittingAnotacao.value = true
  formError.value = ''

  try {
    const nova = await criarAnotacao(
      detalhe.value.id,
      {
        servicoRealizado: servico,
        texto,
        profissionalNome: anotacaoForm.profissionalNome.trim() || undefined,
        profissionalEspecialidade: areaEnviada,
        tipoServico: detalhe.value.tipoServico,
        estruturado:
          montarAnotacaoEstruturada(detalhe.value.tipoServico, estruturadaForm.value) ?? undefined,
        anexos: anexosForm.value.map((a) => a.file),
        tiposDocumento: anexosForm.value.map((a) => a.tipoDocumento),
        leituraReceitaId,
      },
      parceiroQuery(),
    )

    /*
     * A rota e multipart e nao passa pela ValidationPipe: um servidor que nao conhece o
     * campo o ignora em SILENCIO, sem 400 nenhum. Comparar o que foi mandado com o que
     * voltou e o unico jeito de saber, e sem este aviso o parceiro preencheria a area,
     * veria a anotacao salva e nunca descobriria que ela nao foi guardada.
     */
    if (!servidorGuardouEspecialidade(areaEnviada, nova.profissionalEspecialidade)) {
      toast.add({
        severity: 'warn',
        summary: t('acessos.anotacao.especialidadeNaoSalva'),
        life: 6000,
      })
    }

    detalhe.value = {
      ...detalhe.value,
      anotacoes: [nova, ...detalhe.value.anotacoes],
    }
    resetAnotacaoForm()
    toast.add({
      severity: 'success',
      summary: t('acessos.anotacao.criada'),
      life: 3500,
    })
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 409) {
      formError.value = t('acessos.anotacao.encerrado')
    } else if (leituraReceitaId && err instanceof ApiError && err.statusCode === 503) {
      // Leitura desligada no meio do caminho: sai o vínculo e o botão; os remédios ficam.
      leituraReceita.marcarIndisponivel()
      formError.value = err.message || t('acessos.leituraReceita.indisponivel')
    } else if (
      leituraReceitaId &&
      err instanceof ApiError &&
      err.statusCode === 400 &&
      ['OUTRO_ACESSO', 'JA_VINCULADA', 'STATUS'].includes(err.reason ?? '')
    ) {
      // A leitura não serve mais (outra anotação usou, falhou, é de outro acesso): sai o
      // vínculo, ficam os remédios, e o próximo envio vai sem ela.
      leituraReceita.limpar()
      formError.value = err.message || t('acessos.leituraReceita.vinculoPerdido')
    } else {
      // ANEXOS_ACIMA_DO_LIMITE e o resto: a mensagem da API diz o que fazer.
      formError.value = err instanceof Error ? err.message : t('acessos.anotacao.erro')
    }
  } finally {
    submittingAnotacao.value = false
  }
}

async function abrirAnexo(anexoId: string) {
  if (!detalhe.value || abrindoAnexoId.value) {
    return
  }

  abrindoAnexoId.value = anexoId

  try {
    const { signedUrl } = await getAnexoSignedUrl(detalhe.value.id, anexoId, parceiroQuery())
    window.open(signedUrl, '_blank', 'noopener')
  } catch (err) {
    /*
     * O anexo é da anotação da própria empresa e o responsável não o remove — mas o acesso
     * inteiro ele encerra, e aí o cofre vai junto. Sem distinguir, o 409 saía como "arquivo
     * indisponível" e escondia que o prontuário todo tinha acabado.
     */
    const encerrado = classificarFalhaArquivo(err) === 'ACESSO_ENCERRADO'

    toast.add({
      severity: 'warn',
      summary: t(encerrado ? 'acessos.anexo.acessoEncerrado' : 'acessos.anexo.indisponivel'),
      detail: t(
        encerrado ? 'acessos.anexo.acessoEncerradoDetail' : 'acessos.anexo.indisponivelDetail',
      ),
      life: encerrado ? 6000 : 4500,
    })

    if (encerrado) {
      await loadDetalhe()
    }
  } finally {
    abrindoAnexoId.value = null
  }
}

/**
 * O `download` do `<a>` é ignorado em URL de outra origem (o arquivo vem do storage),
 * então quem manda o navegador salvar é o `?download=` da signed URL — o storage
 * responde com `Content-Disposition: attachment` e o nome real do documento.
 */
function urlDeDownload(signedUrl: string, nome: string) {
  const url = new URL(signedUrl)
  url.searchParams.set('download', nome)

  return url.toString()
}

async function comArquivoUrl(
  acao: 'abrir' | 'baixar',
  arquivoId: string,
  usar: (signedUrl: string) => void,
) {
  const chave = `${acao}:${arquivoId}`

  if (!detalhe.value || arquivoOcupado.value) {
    return
  }

  arquivoOcupado.value = chave

  try {
    const { signedUrl } = await getArquivoSignedUrl(detalhe.value.id, arquivoId, parceiroQuery())
    usar(signedUrl)
  } catch (err) {
    const falha = classificarFalhaArquivo(err)

    /**
     * 409 = o acesso caiu entre o load e o clique. Avisar e deixar a tela como
     * estava mentiria: o prontuário inteiro já não existe mais, não só este
     * arquivo. Recarregar traz o detalhe enxuto e o cabeçalho de encerrado.
     */
    if (falha === 'ACESSO_ENCERRADO') {
      toast.add({
        severity: 'warn',
        summary: t('acessos.anexo.acessoEncerrado'),
        detail: t('acessos.anexo.acessoEncerradoDetail'),
        life: 6000,
      })
      await loadDetalhe()
      return
    }

    /**
     * Arquivo removido do cofre com o acesso ainda vivo. Recarrega pelo mesmo
     * motivo do 409, em escala menor: o documento continua listado na tela até
     * alguém reler, e uma lista que oferece um arquivo que não existe convida ao
     * segundo clique.
     */
    if (falha === 'ARQUIVO_REMOVIDO') {
      toast.add({
        severity: 'warn',
        summary: t('acessos.anexo.removido'),
        detail: t('acessos.anexo.removidoDetail'),
        life: 6000,
      })
      await loadDetalhe()
      return
    }

    toast.add({
      severity: 'warn',
      summary: t('acessos.anexo.indisponivel'),
      detail: t('acessos.anexo.indisponivelDetail'),
      life: 4500,
    })
  } finally {
    arquivoOcupado.value = null
  }
}

function abrirArquivo(arquivoId: string) {
  return comArquivoUrl('abrir', arquivoId, (signedUrl) => {
    window.open(signedUrl, '_blank', 'noopener')
  })
}

function baixarArquivo(arquivoId: string, nome: string) {
  return comArquivoUrl('baixar', arquivoId, (signedUrl) => {
    const link = document.createElement('a')
    link.href = urlDeDownload(signedUrl, nome)
    link.download = nome
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    link.remove()
  })
}

function formatBytes(bytes: number) {
  const numero = new Intl.NumberFormat(INTL_LOCALE[locale.value as Locale], {
    maximumFractionDigits: 1,
  })

  if (bytes >= 1024 * 1024) {
    return `${numero.format(bytes / (1024 * 1024))} MB`
  }

  return `${numero.format(Math.max(1, Math.round(bytes / 1024)))} KB`
}

/** Peso no formato numérico do idioma da tela (vírgula ou ponto decimal). */
const pesoKgLegivel = computed(() =>
  pesoKg.value == null
    ? ''
    : new Intl.NumberFormat(INTL_LOCALE[locale.value as Locale], {
        maximumFractionDigits: 2,
      }).format(pesoKg.value),
)

watch(compartilhamentoId, (id, oldId) => {
  if (id && id !== oldId) {
    resetAnotacaoForm()
    void loadDetalhe()
  }
})

onMounted(() => {
  void loadDetalhe()
})

/**
 * O responsável pode ter retirado uma categoria, apagado um documento ou encurtado a validade
 * enquanto esta aba estava em segundo plano, e ninguém avisa. Voltar para a aba relê.
 */
useRevalidarAoVoltar(() => void loadDetalhe(true))
</script>

<template>
  <PartnerPageFrame
    class="hc-tema"
    :subtitle="t('acessos.detalhe.subtitle')"
    :title="detalhe?.petNome ?? t('acessos.detalhe.title')"
    :loading="loading"
    :error="error"
    :no-partner-access="store.semAcessoParceiro"
    guidance
    @retry="loadDetalhe()"
  >
    <!-- A identidade do pet é o título da página: antes ela aparecia duas vezes, no título e
         num cartão logo abaixo, e o cartão empurrava o trabalho para baixo da dobra. -->
    <template #cabecalho>
      <div v-if="detalhe" class="atd-id" :data-status="detalhe.status">
        <span class="atd-id__foto">
          <img v-if="detalhe.petFoto" :src="detalhe.petFoto" :alt="detalhe.petNome" />
          <i v-else class="ph ph-paw-print" aria-hidden="true" />
        </span>

        <div class="atd-id__texto">
          <p class="atd-id__sobre">
            {{ t('acessos.detalhe.subtitle') }}
            <span aria-hidden="true">·</span>
            {{ servicoLabel }}
          </p>
          <div class="atd-id__linha">
            <h1 class="atd-id__nome">{{ detalhe.petNome }}</h1>
            <span class="atd-id__status" :data-status="detalhe.status">
              <i :class="isAtivo ? 'ph ph-check-circle' : 'ph ph-lock-simple'" aria-hidden="true" />
              {{ t(`acessos.list.status.${detalhe.status}`) }}
            </span>
            <span v-if="isAtivo" class="atd-id__prazo">
              <i class="ph ph-hourglass-medium" aria-hidden="true" />
              {{ expiraLabel(detalhe.expiraEm) }}
            </span>
          </div>
          <p class="atd-id__meta" :aria-label="t('acessos.detalhe.metaAria')">
            <span>{{ detalhe.especieLabel }}</span>
            <span v-if="isAtivo && detalhe.petCastrado != null">
              {{ detalhe.petCastrado ? t('acessos.pet.castrado') : t('acessos.pet.naoCastrado') }}
            </span>
            <span v-if="pesoKg != null" :title="t('acessos.snapshot.peso')">
              {{ pesoKgLegivel }} kg
            </span>
          </p>
        </div>
      </div>

      <div v-else class="atd-id atd-id--carregando">
        <div class="atd-id__texto">
          <p class="atd-id__sobre">{{ t('acessos.detalhe.subtitle') }}</p>
          <h1 class="atd-id__nome">{{ t('acessos.detalhe.title') }}</h1>
        </div>
      </div>
    </template>

    <template #actions>
      <Button
        :label="t('acessos.detalhe.back')"
        icon="ph ph-arrow-left"
        severity="secondary"
        @click="voltar"
      />
    </template>

    <!-- Leitura do prontuário não é gated por auditoria (seção 4): o acesso foi
         consentido pelo responsável, não pelo status do cadastro. Suspenso lê
         tudo e perde só a anotação, que é mutação. -->
    <PartnerOperabilityBanner cover-suspended />

    <template v-if="detalhe">
      <section v-if="!isAtivo" class="atd-encerrado" role="status">
        <i class="ph ph-lock-simple" aria-hidden="true" />
        <div>
          <strong>{{ t('acessos.encerrado.title') }}</strong>
          <p>
            {{
              detalhe.status === 'REVOGADO'
                ? t('acessos.encerrado.revogado')
                : t('acessos.encerrado.expirado')
            }}
          </p>
        </div>
      </section>

      <!--
        A mesa: a ficha do pet ao lado da folha de anotação. Antes eram duas abas, e quem
        prescrevia escrevia o remédio sem ver a alergia, que ficava na outra aba. Na largura que
        cabe as duas colunas (container, não viewport: o menu lateral aberto ou fechado muda
        a conta), as abas somem; na estreita voltam, com as mesmas duas metades.
      -->
      <div class="atd-mesa" :data-aba="displayTab" :data-ficha="isAtivo ? 'sim' : 'nao'">
        <PartnerSectionTabs
          v-if="isAtivo"
          class="atd-mesa__abas"
          :tabs="tabs"
          :active-tab="displayTab"
          :aria-label="tabsAriaLabel"
          @select="setTab($event as DetalheTab)"
        />

        <div class="atd-mesa__grade">
          <!-- Ficha do pet -->
          <aside v-if="isAtivo" class="atd-ficha" aria-labelledby="atd-ficha-titulo">
            <header class="atd-ficha__cab">
              <h2 id="atd-ficha-titulo">{{ t('acessos.detalhe.tabs.resumo.label') }}</h2>
              <!-- Em atendimento com estadia o quadro muda no meio: saber que o responsável
                   mexeu no resumo depois de entregar é o que avisa que a leitura de ontem
                   pode não valer mais. -->
              <p
                v-if="carimbo"
                class="atd-carimbo"
                :data-atualizado="carimbo.atualizado ? 'true' : 'false'"
              >
                <i
                  :class="carimbo.atualizado ? 'ph ph-clock-counter-clockwise' : 'ph ph-clock'"
                  aria-hidden="true"
                />
                <span>{{
                  carimbo.atualizado
                    ? t('acessos.snapshot.carimboAtualizado', {
                        data: formatDateTime(carimbo.data),
                      })
                    : t('acessos.snapshot.carimbo', { data: formatDateTime(carimbo.data) })
                }}</span>
              </p>
            </header>

            <!-- Responsável pode liberar o acesso sem marcar nenhuma categoria: a ficha existe
                 e não tem o que mostrar. Explica o porquê e empurra para a ação útil. -->
            <section v-if="resumoVazio" class="atd-ficha__vazio">
              <i class="ph ph-lock-simple-open" aria-hidden="true" />
              <strong>{{ t('acessos.snapshot.emptyTitle') }}</strong>
              <p>{{ t('acessos.snapshot.emptyBody', { pet: detalhe.petNome }) }}</p>
              <Button
                v-if="podeAnotar"
                :label="t('acessos.snapshot.emptyCta')"
                icon="ph ph-pencil-simple"
                size="small"
                severity="secondary"
                outlined
                @click="irParaFolha"
              />
            </section>

            <section v-if="mensagemTutor" class="atd-ficha__secao">
              <h3 class="atd-ficha__titulo">
                <i class="ph ph-chat-circle-text" aria-hidden="true" />
                {{ t('acessos.detalhe.mensagemTutor') }}
              </h3>
              <blockquote class="atd-recado">{{ mensagemTutor }}</blockquote>
            </section>

            <section v-if="showObservacoesTutor" class="atd-ficha__secao">
              <h3 class="atd-ficha__titulo">
                <i class="ph ph-info" aria-hidden="true" />
                {{ t('acessos.snapshot.observacoes') }}
              </h3>
              <p class="atd-ficha__texto">{{ observacoesTutor }}</p>
            </section>

            <!-- Tratamento contínuo (Parte 16), ACIMA das listas clínicas: é o remédio de
                 todo dia, e o item cuja falha tem dano imediato para quem vai cuidar do pet
                 sem conviver com ele. -->
            <section
              v-if="tratamentosEstado !== 'OCULTO'"
              class="atd-ficha__secao"
              aria-labelledby="atd-trat-title"
            >
              <h3 id="atd-trat-title" class="atd-ficha__titulo">
                <i class="ph ph-heartbeat" aria-hidden="true" />
                {{ t('acessos.tratamentos.title') }}
                <span v-if="tratamentosContinuos.length" class="atd-ficha__conta">
                  {{ tratamentosContinuos.length }}
                </span>
              </h3>
              <p v-if="isGuidanceVisible" class="atd-ficha__lede">
                {{ t('acessos.tratamentos.lede') }}
              </p>

              <p v-if="tratamentosVazioTexto" class="atd-ficha__nada">
                {{ tratamentosVazioTexto }}
              </p>

              <ul v-else class="atd-trat">
                <li v-for="item in tratamentosContinuos" :key="item.key" class="atd-trat__item">
                  <PhHeart class="atd-trat__icone" weight="fill" aria-hidden="true" />
                  <div class="atd-trat__corpo">
                    <strong>{{ item.titulo }}</strong>
                    <p v-if="item.posologia" class="atd-trat__posologia">{{ item.posologia }}</p>
                    <dl v-if="item.campos.length" class="atd-par">
                      <div v-for="campo in item.campos" :key="campo.chave">
                        <dt>{{ campo.label }}</dt>
                        <dd>{{ campo.valor }}</dd>
                      </div>
                    </dl>
                    <p v-if="item.observacoes" class="atd-trat__obs">
                      <span>{{ t('acessos.tratamentos.campos.observacoes') }}:</span>
                      {{ item.observacoes }}
                    </p>
                  </div>
                </li>
              </ul>
            </section>

            <section
              v-if="snapshotListSections.length"
              class="atd-ficha__secao atd-ficha__secao--lista"
              aria-labelledby="atd-clinical-title"
            >
              <h3 id="atd-clinical-title" class="atd-ficha__titulo">
                <i class="ph ph-first-aid-kit" aria-hidden="true" />
                {{ t('acessos.snapshot.clinicalTitle') }}
              </h3>

              <!-- Uma linha por categoria. Vazia: a frase do motivo é o conteúdo. Com itens:
                   recolhe e mostra os primeiros nomes, para ler sem abrir. -->
              <ul class="atd-folds">
                <li
                  v-for="section in snapshotListSections"
                  :key="section.id"
                  class="atd-fold"
                  :data-tone="section.tone"
                  :data-vazio="section.items.length ? 'false' : 'true'"
                >
                  <div v-if="!section.items.length" class="atd-fold__row">
                    <span class="atd-fold__icon" aria-hidden="true">
                      <i :class="section.icon" />
                    </span>
                    <div class="atd-fold__copy">
                      <h4 class="atd-fold__title">{{ section.title }}</h4>
                      <p class="atd-fold__sub">{{ section.vazioTexto }}</p>
                    </div>
                  </div>

                  <template v-else>
                    <h4 class="atd-fold__heading">
                      <Button
                        type="button"
                        class="atd-fold__row atd-fold__trigger"
                        :aria-expanded="isSectionOpen(section.id)"
                        :aria-controls="`atd-fold-${section.id}`"
                        @click="toggleSection(section.id)"
                      >
                        <span class="atd-fold__icon" aria-hidden="true">
                          <i :class="section.icon" />
                        </span>
                        <span class="atd-fold__copy">
                          <span class="atd-fold__title">{{ section.title }}</span>
                          <span class="atd-fold__sub">
                            {{
                              t(
                                'acessos.snapshot.itemsCount',
                                { n: section.items.length },
                                section.items.length,
                              )
                            }}<template v-if="!isSectionOpen(section.id)">
                              · {{ section.resumo }}</template
                            >
                          </span>
                        </span>
                        <i
                          class="ph atd-fold__chevron"
                          :class="isSectionOpen(section.id) ? 'ph-caret-up' : 'ph-caret-down'"
                          aria-hidden="true"
                        />
                      </Button>
                    </h4>

                    <ul
                      v-show="isSectionOpen(section.id)"
                      :id="`atd-fold-${section.id}`"
                      class="atd-items"
                    >
                      <li
                        v-for="(item, index) in section.items"
                        :key="`${section.id}-${index}`"
                        :class="{ 'atd-item--destaque': item.destaque }"
                      >
                        <strong>{{ item.titulo }}</strong>
                        <span v-if="item.detalhe" class="atd-item__meta">{{ item.detalhe }}</span>
                      </li>
                    </ul>
                  </template>
                </li>
              </ul>
            </section>

            <!-- Documentos liberados item a item: o snapshot traz ids do cofre, a URL
                 de leitura nasce no clique e vale por poucos minutos. -->
            <section
              v-if="documentosEstado !== 'OCULTO'"
              class="atd-ficha__secao"
              aria-labelledby="atd-docs-title"
            >
              <h3 id="atd-docs-title" class="atd-ficha__titulo">
                <i class="ph ph-folder-simple" aria-hidden="true" />
                {{ t('acessos.documentos.title') }}
                <span v-if="documentos.length" class="atd-ficha__conta">
                  {{ documentos.length }}
                </span>
              </h3>
              <p v-if="isGuidanceVisible" class="atd-ficha__lede">
                {{ t('acessos.documentos.lede') }}
              </p>

              <p v-if="documentosVazioTexto" class="atd-ficha__nada">{{ documentosVazioTexto }}</p>

              <ul v-else class="atd-docs">
                <li v-for="doc in documentos" :key="doc.key" class="atd-doc">
                  <i class="ph ph-file-text atd-doc__icone" aria-hidden="true" />

                  <div class="atd-doc__texto">
                    <strong :title="doc.nome">{{ doc.nome }}</strong>
                    <small>
                      {{ doc.tipo }}
                      <template v-if="doc.emissao">
                        · {{ t('acessos.documentos.emissao', { data: doc.emissao }) }}
                      </template>
                      <template v-if="doc.expiracao">
                        · {{ t('acessos.documentos.expiracao', { data: doc.expiracao }) }}
                      </template>
                    </small>
                    <span v-if="!doc.arquivos.length" class="atd-doc__sem">
                      {{ t('acessos.documentos.semArquivo') }}
                    </span>
                  </div>

                  <div v-if="doc.arquivos.length" class="atd-doc__acoes">
                    <template v-for="(arquivo, index) in doc.arquivos" :key="arquivo.id">
                      <span v-if="doc.arquivos.length > 1" class="atd-doc__n">
                        {{ t('acessos.documentos.arquivoN', { n: index + 1 }) }}
                      </span>
                      <Button
                        icon="ph ph-arrow-square-out"
                        severity="secondary"
                        outlined
                        size="small"
                        :loading="arquivoOcupado === `abrir:${arquivo.id}`"
                        :aria-label="`${t('acessos.documentos.abrir')}: ${doc.nome}`"
                        :title="t('acessos.documentos.abrir')"
                        @click="abrirArquivo(arquivo.id)"
                      />
                      <Button
                        icon="ph ph-download-simple"
                        severity="secondary"
                        outlined
                        size="small"
                        :loading="arquivoOcupado === `baixar:${arquivo.id}`"
                        :aria-label="`${t('acessos.documentos.baixar')}: ${doc.nome}`"
                        :title="t('acessos.documentos.baixar')"
                        @click="baixarArquivo(arquivo.id, arquivo.nome)"
                      />
                    </template>
                  </div>
                </li>
              </ul>
            </section>

            <!-- Diário: só entram os dias com anormalidade registrada, dentro da janela
                 que o responsável liberou. Enum já chega traduzido do backend. -->
            <section
              v-if="diarioEstado !== 'OCULTO'"
              class="atd-ficha__secao"
              aria-labelledby="atd-diario-title"
            >
              <h3 id="atd-diario-title" class="atd-ficha__titulo">
                <i class="ph ph-notebook" aria-hidden="true" />
                {{ t('acessos.diario.title') }}
                <span v-if="diario.length" class="atd-ficha__conta">{{ diario.length }}</span>
              </h3>
              <p v-if="isGuidanceVisible" class="atd-ficha__lede">
                {{ t('acessos.diario.lede') }}
              </p>

              <p v-if="diarioVazioTexto" class="atd-ficha__nada">{{ diarioVazioTexto }}</p>

              <ol v-else class="atd-diario">
                <li v-for="entrada in diario" :key="entrada.key" class="atd-diario__dia">
                  <strong class="atd-diario__data">{{ entrada.data }}</strong>

                  <div
                    v-if="entrada.sintomas.length || entrada.doencas.length"
                    class="atd-diario__tags"
                  >
                    <span
                      v-for="(sintoma, index) in entrada.sintomas"
                      :key="`s-${index}`"
                      class="atd-diario__tag atd-diario__tag--sintoma"
                    >
                      {{ sintoma }}
                    </span>
                    <span
                      v-for="(doenca, index) in entrada.doencas"
                      :key="`d-${index}`"
                      class="atd-diario__tag atd-diario__tag--doenca"
                    >
                      {{ doenca }}
                    </span>
                  </div>

                  <dl v-if="entrada.campos.length" class="atd-par">
                    <div v-for="campo in entrada.campos" :key="campo.chave">
                      <dt>{{ campo.label }}</dt>
                      <dd>{{ campo.valor }}</dd>
                    </div>
                  </dl>

                  <p v-for="texto in entrada.textos" :key="texto.chave" class="atd-diario__texto">
                    <span>{{ texto.label }}:</span> {{ texto.valor }}
                  </p>

                  <div v-if="entrada.fotoIds.length" class="atd-diario__fotos">
                    <Button
                      v-for="(fotoId, index) in entrada.fotoIds"
                      :key="fotoId"
                      :label="t('acessos.diario.abrirFoto', { n: index + 1 })"
                      icon="ph ph-image"
                      severity="secondary"
                      outlined
                      size="small"
                      :loading="arquivoOcupado === `abrir:${fotoId}`"
                      @click="abrirArquivo(fotoId)"
                    />
                  </div>
                </li>
              </ol>
            </section>
          </aside>

          <!-- Trabalho: a folha da anotação e o histórico -->
          <div class="atd-trabalho">
            <aside v-if="somenteLeitura" class="atd-aviso" role="status">
              <i class="ph ph-eye" aria-hidden="true" />
              <div>
                <strong>{{ t('acessos.anotacao.somenteLeitura.title') }}</strong>
                <p>{{ t('acessos.anotacao.somenteLeitura.body') }}</p>
              </div>
            </aside>

            <section v-if="podeAnotar" class="atd-folha" aria-labelledby="atd-folha-titulo">
              <header class="atd-folha__cab">
                <h2 id="atd-folha-titulo">{{ t('acessos.anotacao.title') }}</h2>
                <p>{{ t('acessos.anotacao.lede') }}</p>
              </header>

              <div class="atd-folha__secao">
                <div class="atd-campo">
                  <label for="anot-servico">{{ t('acessos.anotacao.servico') }}</label>
                  <InputText
                    id="anot-servico"
                    v-model="anotacaoForm.servicoRealizado"
                    :maxlength="LIMITES_CAMPOS_LIVRES.servicoRealizado"
                    :placeholder="t('acessos.anotacao.servicoPlaceholder')"
                  />
                </div>

                <div class="atd-campo">
                  <label for="anot-texto">{{ t('acessos.anotacao.texto') }}</label>
                  <Textarea
                    id="anot-texto"
                    v-model="anotacaoForm.texto"
                    rows="4"
                    auto-resize
                    :maxlength="LIMITES_CAMPOS_LIVRES.texto"
                    :placeholder="t('acessos.anotacao.textoPlaceholder')"
                  />
                </div>
              </div>

              <AnotacaoEstruturadaFields
                v-if="temCamposEstruturados && detalhe"
                v-model="estruturadaForm"
                :tipo-servico="detalhe.tipoServico"
                :erros="estruturadaErros"
                :disabled="submittingAnotacao"
                :lendo-receita="
                  leituraReceita.etapa === 'enviando' || leituraReceita.etapa === 'lendo'
                "
              >
                <template v-if="mostrarLeituraReceita" #prescricao-topo>
                  <LerReceitaComIA
                    :leitura="leituraReceita"
                    :anexos-do-formulario="anexosForm.length"
                    :disabled="submittingAnotacao"
                  />
                </template>
              </AnotacaoEstruturadaFields>

              <!-- Quem atendeu: nome e área lado a lado, os dois opcionais. A área viaja como
                   CHAVE quando é uma das opções; "Fisioterapia" e "Acupuntura" são casos
                   legítimos de "Outra" e um enum fechado viraria 400. -->
              <div class="atd-folha__secao">
                <div class="atd-folha__duas">
                  <div class="atd-campo">
                    <label for="anot-profissional">{{ t('acessos.anotacao.profissional') }}</label>
                    <InputText
                      id="anot-profissional"
                      v-model="anotacaoForm.profissionalNome"
                      :maxlength="LIMITES_CAMPOS_LIVRES.profissionalNome"
                      :placeholder="t('acessos.anotacao.profissionalPlaceholder')"
                    />
                  </div>

                  <div class="atd-campo">
                    <label for="anot-especialidade">
                      {{ t('acessos.anotacao.especialidade') }}
                    </label>
                    <Select
                      input-id="anot-especialidade"
                      :model-value="anotacaoForm.especialidade"
                      :options="opcoesEspecialidade"
                      option-label="label"
                      option-value="value"
                      :placeholder="t('acessos.anotacao.especialidadePlaceholder')"
                      show-clear
                      :disabled="submittingAnotacao"
                      @update:model-value="escolherEspecialidade"
                    />
                  </div>
                </div>

                <div v-if="anotacaoForm.especialidade === ESPECIALIDADE_OUTRA" class="atd-campo">
                  <InputText
                    v-model="anotacaoForm.especialidadeOutra"
                    :maxlength="LIMITES_CAMPOS_LIVRES.profissionalEspecialidade"
                    :placeholder="t('acessos.anotacao.especialidadeOutraPlaceholder')"
                    :aria-label="t('acessos.anotacao.especialidade')"
                    :disabled="submittingAnotacao"
                  />
                </div>
              </div>

              <div class="atd-folha__secao">
                <div class="atd-folha__secao-cab">
                  <h3>
                    <i class="ph ph-paperclip" aria-hidden="true" />
                    {{ t('acessos.anotacao.anexos', { n: MAX_ANEXOS }) }}
                  </h3>
                  <label v-if="anexosOcupados < MAX_ANEXOS" class="atd-anexar">
                    <input
                      ref="fileInput"
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                      @change="onAnexosSelected"
                    />
                    <i class="ph ph-upload-simple" aria-hidden="true" />
                    {{ t('acessos.anotacao.adicionarAnexo') }}
                  </label>
                </div>

                <ul v-if="anexosForm.length" class="atd-anexos">
                  <li v-for="(anexo, index) in anexosForm" :key="`${anexo.file.name}-${index}`">
                    <i class="ph ph-file atd-anexos__icone" aria-hidden="true" />
                    <span class="atd-anexos__nome">
                      <strong :title="anexo.file.name">{{ anexo.file.name }}</strong>
                      <small>{{ formatBytes(anexo.file.size) }}</small>
                    </span>
                    <label class="atd-sr" :for="`anexo-tipo-${index}`">
                      {{ t('acessos.anotacao.tipoDocumento') }}
                    </label>
                    <Select
                      v-model="anexo.tipoDocumento"
                      class="atd-anexos__tipo"
                      :input-id="`anexo-tipo-${index}`"
                      :options="tiposDocumentoOptions"
                      option-label="label"
                      option-value="value"
                      :placeholder="t('acessos.anotacao.tipoDocumentoPlaceholder')"
                      show-clear
                    />
                    <Button
                      icon="ph ph-trash"
                      severity="secondary"
                      text
                      rounded
                      class="atd-anexos__remover"
                      :aria-label="t('acessos.anotacao.removerAnexo')"
                      :title="t('acessos.anotacao.removerAnexo')"
                      @click="removeAnexo(index)"
                    />
                  </li>
                </ul>

                <small v-if="leituraReceita.reservados > 0" class="atd-folha__nota">
                  <i class="ph ph-sparkle" aria-hidden="true" />
                  {{
                    t(
                      'acessos.leituraReceita.anexosDaReceita',
                      { n: leituraReceita.reservados },
                      leituraReceita.reservados,
                    )
                  }}
                </small>
                <small class="atd-folha__nota">{{ t('acessos.anotacao.anexoHint') }}</small>
              </div>

              <!-- Rodapé preso à tela enquanto a folha estiver nela: o erro aparece do lado do
                   botão que o causou, e não lá no topo, fora da vista de quem clicou. -->
              <footer class="atd-folha__rodape">
                <p v-if="formError" class="atd-folha__erro" role="alert">
                  <i class="ph ph-warning-circle" aria-hidden="true" />
                  {{ formError }}
                </p>
                <Button
                  class="atd-folha__enviar"
                  :label="t('acessos.anotacao.enviar')"
                  icon="ph ph-check"
                  :loading="submittingAnotacao"
                  @click="submitAnotacao"
                />
              </footer>
            </section>

            <section class="atd-hist" aria-labelledby="atd-notes-title">
              <header class="atd-hist__cab">
                <h2 id="atd-notes-title">{{ t('acessos.anotacoes.title') }}</h2>
                <span v-if="anotacoesOrdenadas.length" class="atd-hist__conta">{{
                  t(
                    'acessos.anotacoes.count',
                    { n: anotacoesOrdenadas.length },
                    anotacoesOrdenadas.length,
                  )
                }}</span>
              </header>
              <p v-if="isGuidanceVisible" class="atd-hist__lede">
                {{ t('acessos.anotacoes.lede') }}
              </p>

              <div v-if="anotacoesOrdenadas.length === 0" class="atd-hist__vazio">
                <i class="ph ph-clock-counter-clockwise" aria-hidden="true" />
                <div>
                  <strong>{{ t('acessos.anotacoes.empty') }}</strong>
                  <p>
                    {{
                      podeAnotar
                        ? t('acessos.anotacoes.emptyHint')
                        : t('acessos.anotacoes.emptyHintClosed')
                    }}
                  </p>
                </div>
              </div>

              <ol v-else class="atd-hist__lista">
                <li v-for="anotacao in anotacoesOrdenadas" :key="anotacao.id">
                  <article class="atd-nota">
                    <header class="atd-nota__cab">
                      <div class="atd-nota__quem">
                        <h3>{{ anotacao.servicoRealizado }}</h3>
                        <p>
                          <span>{{ anotacao.empresaNome }}</span>
                          <template v-if="autorDaAnotacao(anotacao)">
                            <span aria-hidden="true">·</span>
                            <span>{{ autorDaAnotacao(anotacao) }}</span>
                          </template>
                        </p>
                      </div>
                      <time class="atd-nota__quando" :datetime="anotacao.criadaEm">{{
                        formatDateTime(anotacao.criadaEm)
                      }}</time>
                    </header>

                    <p class="atd-nota__texto">{{ anotacao.texto }}</p>

                    <AnotacaoEstruturadaView :anotacao="anotacao" />

                    <ul
                      v-if="anotacao.anexos.length"
                      class="atd-nota__anexos"
                      :aria-label="t('acessos.anotacoes.anexosLabel')"
                    >
                      <li v-for="anexo in anotacao.anexos" :key="anexo.id">
                        <Button
                          type="button"
                          class="atd-nota__anexo"
                          :disabled="abrindoAnexoId === anexo.id"
                          :aria-label="`${t('acessos.anotacoes.abrirAnexo')}: ${anexo.nome}`"
                          @click="abrirAnexo(anexo.id)"
                        >
                          <i
                            :class="
                              abrindoAnexoId === anexo.id
                                ? 'ph ph-spin ph-circle-notch'
                                : 'ph ph-file-text'
                            "
                            aria-hidden="true"
                          />
                          <span class="atd-nota__anexo-nome">{{ anexo.nome }}</span>
                          <small>
                            <template v-if="anexo.tipoDocumento">
                              {{ anexo.tipoDocumento }} ·
                            </template>
                            {{ formatBytes(anexo.tamanhoBytes) }}
                          </small>
                        </Button>
                      </li>
                    </ul>
                  </article>
                </li>
              </ol>
            </section>
          </div>
        </div>
      </div>
    </template>
  </PartnerPageFrame>
</template>

<style scoped>
/* ------------------------------------------------------------------ tokens da tela */

/*
 * Tudo sai dos tokens `--hc-*`, que já trazem o claro e o escuro. Os campos deixam o linho do
 * preset (#FBF7F4 com borda #DDCDC4): sobre o cartão branco ele lia como pêssego desbotado e
 * brigava com o verde. Aqui o campo é do papel do cartão, com borda cinza e anel de foco na marca.
 */
.atd-id,
.atd-mesa,
.atd-encerrado {
  --atd-suave: color-mix(in srgb, var(--hc-tinta) 64%, var(--hc-cartao));
  --atd-fraco: color-mix(in srgb, var(--hc-tinta) 50%, var(--hc-cartao));
}

.atd-mesa {
  --folha-pad-x: 1.5rem;
  --folha-fio: var(--hc-linha);
  --folha-suave: var(--atd-suave);
  --atd-campo-fundo: var(--hc-cartao);
  --atd-campo-borda: color-mix(in srgb, var(--hc-tinta) 17%, var(--hc-cartao));
  --atd-campo-borda-hover: color-mix(in srgb, var(--hc-tinta) 32%, var(--hc-cartao));
  --atd-campo-apagado: color-mix(in srgb, var(--hc-tinta) 5%, var(--hc-cartao));
  --atd-anel: 0 0 0 3px color-mix(in srgb, var(--hc-marca) 22%, transparent);

  --p-inputtext-background: var(--atd-campo-fundo);
  --p-inputtext-disabled-background: var(--atd-campo-apagado);
  --p-inputtext-border-color: var(--atd-campo-borda);
  --p-inputtext-hover-border-color: var(--atd-campo-borda-hover);
  --p-inputtext-focus-border-color: var(--hc-marca);
  --p-inputtext-color: var(--hc-tinta);
  --p-inputtext-placeholder-color: var(--atd-fraco);
  --p-inputtext-shadow: none;
  --p-inputtext-border-radius: 0.6rem;
  --p-inputtext-padding-x: 0.75rem;
  --p-inputtext-padding-y: 0.55rem;
  --p-inputtext-focus-ring-shadow: var(--atd-anel);

  --p-textarea-background: var(--atd-campo-fundo);
  --p-textarea-disabled-background: var(--atd-campo-apagado);
  --p-textarea-border-color: var(--atd-campo-borda);
  --p-textarea-hover-border-color: var(--atd-campo-borda-hover);
  --p-textarea-focus-border-color: var(--hc-marca);
  --p-textarea-color: var(--hc-tinta);
  --p-textarea-placeholder-color: var(--atd-fraco);
  --p-textarea-shadow: none;
  --p-textarea-border-radius: 0.6rem;
  --p-textarea-padding-x: 0.75rem;
  --p-textarea-padding-y: 0.55rem;
  --p-textarea-focus-ring-shadow: var(--atd-anel);

  --p-select-background: var(--atd-campo-fundo);
  --p-select-disabled-background: var(--atd-campo-apagado);
  --p-select-border-color: var(--atd-campo-borda);
  --p-select-hover-border-color: var(--atd-campo-borda-hover);
  --p-select-focus-border-color: var(--hc-marca);
  --p-select-color: var(--hc-tinta);
  --p-select-placeholder-color: var(--atd-fraco);
  --p-select-shadow: none;
  --p-select-border-radius: 0.6rem;
  --p-select-padding-x: 0.75rem;
  --p-select-padding-y: 0.55rem;
  --p-select-focus-ring-shadow: var(--atd-anel);
  --p-select-dropdown-color: var(--atd-suave);

  container: mesa / inline-size;
  display: grid;
  gap: 1rem;
}

/* No escuro o campo afunda um degrau abaixo do cartão, senão some dentro dele. */
.app-dark .atd-mesa {
  --atd-campo-fundo: color-mix(in srgb, var(--hc-pagina) 60%, var(--hc-cartao));
  --atd-campo-borda: color-mix(in srgb, var(--hc-tinta) 20%, var(--hc-cartao));
}

/* Um corpo de letra para todo campo da tela: o preset deixava 16 px num, 14 px noutro. */
.atd-mesa :deep(.p-inputtext),
.atd-mesa :deep(.p-textarea),
.atd-mesa :deep(.p-select-label) {
  font-size: 0.875rem;
  line-height: 1.45;
}

.atd-mesa :deep(.p-textarea) {
  resize: none;
}

/* O InputNumber nasce com a largura do atributo size do input interno e vazava da coluna. */
.atd-mesa :deep(.p-inputnumber) {
  display: flex;
  width: 100%;
}

.atd-mesa :deep(.p-inputnumber-input) {
  width: 100%;
  min-width: 0;
}

.atd-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* ------------------------------------------------------------------ identidade */

.atd-id {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1rem;
  min-width: 0;
}

.atd-id__foto {
  display: grid;
  width: 3.5rem;
  height: 3.5rem;
  flex: 0 0 auto;
  place-items: center;
  overflow: hidden;
  border: 1px solid var(--hc-borda);
  border-radius: 1rem;
  background: var(--hc-marca-clara);
  color: var(--hc-marca-forte);
  font-size: 1.65rem;
}

.atd-id__foto img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.atd-id__texto {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
}

.atd-id__sobre {
  display: flex;
  gap: 0.35rem;
  margin: 0;
  color: var(--atd-suave);
  font-size: 0.78rem;
  font-weight: 650;
}

.atd-id__nome {
  margin: 0;
  color: var(--hc-tinta);
  font-size: 1.65rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.1;
}

.atd-id__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.1rem 0;
  margin: 0.1rem 0 0;
  color: var(--atd-suave);
  font-size: 0.86rem;
}

.atd-id__meta span + span::before {
  content: '·';
  margin-inline: 0.45rem;
  color: var(--atd-fraco);
}

.atd-id__linha {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.6rem;
}

.atd-id__linha .atd-id__nome {
  margin-inline-end: 0.15rem;
}

/* Status com o nome do próprio acesso: "Suspenso" para um acesso que só expirou enganava. */
.atd-id__status {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
  background: var(--hc-verde-fundo);
  color: var(--hc-verde-tinta);
  font-size: 0.76rem;
  font-weight: 700;
}

.atd-id__status:not([data-status='ATIVO']) {
  background: var(--hc-cinza-fundo);
  color: var(--hc-cinza-tinta);
}

.atd-id__prazo {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
  background: var(--hc-pessego-fundo);
  color: var(--hc-pessego-tinta);
  font-size: 0.76rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.atd-id[data-status='EXPIRADO'] .atd-id__foto,
.atd-id[data-status='REVOGADO'] .atd-id__foto {
  background: var(--hc-cinza-fundo);
  color: var(--hc-cinza-tinta);
  filter: grayscale(0.6);
}

.atd-encerrado {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.9rem 1.1rem;
  border: 1px solid var(--hc-borda);
  border-radius: 0.9rem;
  background: var(--hc-cinza-fundo);
  color: var(--atd-suave);
}

.atd-encerrado i {
  margin-top: 0.1rem;
  font-size: 1.1rem;
}

.atd-encerrado strong {
  display: block;
  margin-bottom: 0.15rem;
  color: var(--hc-tinta);
  font-size: 0.9rem;
}

.atd-encerrado p {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.5;
}

/* ------------------------------------------------------------------ a mesa */

.atd-mesa__grade {
  display: grid;
  gap: 1.25rem;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
}

/* Estreita: as abas escolhem a metade. */
.atd-mesa[data-aba='resumo'] .atd-trabalho,
.atd-mesa[data-aba='anotacoes'] .atd-ficha {
  display: none;
}

/* Larga: as duas metades lado a lado, a ficha presa abaixo do cabeçalho do app. */
@container mesa (min-width: 56rem) {
  .atd-mesa__abas {
    display: none;
  }

  .atd-mesa[data-ficha='sim'] .atd-mesa__grade {
    grid-template-columns: clamp(18.5rem, 30%, 21.5rem) minmax(0, 1fr);
  }

  .atd-mesa .atd-ficha__cab h2 {
    position: static;
    width: auto;
    height: auto;
    overflow: visible;
    clip: auto;
    white-space: normal;
  }

  .atd-mesa[data-aba] .atd-ficha {
    position: sticky;
    top: calc(var(--pj-shell-header-height, 4.25rem) + 1rem);
    display: flex;
    max-height: calc(100dvh - var(--pj-shell-header-height, 4.25rem) - 2rem);
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .atd-mesa[data-aba] .atd-trabalho {
    display: grid;
  }
}

/* ------------------------------------------------------------------ ficha do pet */

.atd-ficha {
  display: flex;
  flex-direction: column;
  min-width: 0;
  border: 1px solid var(--hc-borda);
  border-radius: 1rem;
  background: var(--hc-cartao);
  box-shadow: var(--hc-sombra);
}

.atd-ficha__cab {
  display: grid;
  gap: 0.3rem;
  padding: 1rem 1.15rem 0.9rem;
}

/* Na tela estreita a aba já diz "Resumo do pet": o título fica só para o leitor de tela. */
.atd-ficha__cab h2 {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  margin: 0;
  color: var(--hc-tinta);
  font-size: 1rem;
  font-weight: 750;
  letter-spacing: -0.01em;
}

.atd-carimbo {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  margin: 0;
  color: var(--atd-suave);
  font-size: 0.76rem;
  line-height: 1.4;
}

/* Resumo mexido depois da entrega: o que o parceiro leu antes pode estar velho. */
.atd-carimbo[data-atualizado='true'] {
  color: var(--hc-pessego-tinta);
  font-weight: 650;
}

.atd-ficha__secao {
  display: grid;
  gap: 0.6rem;
  padding: 0.95rem 1.15rem 1.05rem;
  border-top: 1px solid var(--hc-linha);
}

.atd-ficha__secao--lista {
  gap: 0.35rem;
  padding-inline: 0;
  padding-bottom: 0.25rem;
}

.atd-ficha__titulo {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0;
  color: var(--atd-suave);
  font-size: 0.72rem;
  font-weight: 750;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.atd-ficha__titulo i {
  color: var(--hc-marca);
  font-size: 0.95rem;
}

.atd-ficha__secao--lista .atd-ficha__titulo {
  padding-inline: 1.15rem;
}

.atd-ficha__conta {
  margin-inline-start: auto;
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  background: var(--hc-cinza-fundo);
  color: var(--hc-cinza-tinta);
  font-size: 0.7rem;
  letter-spacing: 0;
  font-variant-numeric: tabular-nums;
}

.atd-ficha__lede,
.atd-ficha__nada,
.atd-ficha__texto {
  margin: 0;
  color: var(--atd-suave);
  font-size: 0.82rem;
  line-height: 1.5;
}

.atd-ficha__texto {
  color: var(--hc-tinta);
  white-space: pre-line;
}

.atd-recado {
  margin: 0;
  padding: 0.75rem 0.9rem;
  border-radius: 0.75rem;
  background: var(--hc-marca-clara);
  color: var(--hc-tinta);
  font-size: 0.9rem;
  line-height: 1.55;
  white-space: pre-line;
}

.atd-ficha__vazio {
  display: grid;
  justify-items: center;
  gap: 0.4rem;
  padding: 1.5rem 1.15rem 1.6rem;
  border-top: 1px solid var(--hc-linha);
  text-align: center;
}

.atd-ficha__vazio > i {
  color: var(--hc-marca);
  font-size: 1.5rem;
}

.atd-ficha__vazio strong {
  color: var(--hc-tinta);
  font-size: 0.92rem;
}

.atd-ficha__vazio p {
  margin: 0;
  color: var(--atd-suave);
  font-size: 0.82rem;
  line-height: 1.5;
}

.atd-ficha__vazio :deep(.p-button) {
  margin-top: 0.4rem;
}

/* Pares rótulo/valor: tratamento contínuo e diário. */
.atd-par {
  display: grid;
  gap: 0.4rem 1rem;
  grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr));
  margin: 0;
}

.atd-par dt {
  color: var(--atd-suave);
  font-size: 0.7rem;
  font-weight: 700;
}

.atd-par dd {
  margin: 0;
  color: var(--hc-tinta);
  font-size: 0.82rem;
  font-weight: 600;
}

/* Tratamento contínuo */
.atd-trat {
  display: grid;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.atd-trat__item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.6rem;
}

.atd-trat__icone {
  margin-top: 0.15rem;
  color: var(--hc-coral-tinta);
  font-size: 0.95rem;
}

.atd-trat__corpo {
  display: grid;
  gap: 0.3rem;
  min-width: 0;
}

.atd-trat__corpo strong {
  color: var(--hc-tinta);
  font-size: 0.88rem;
}

.atd-trat__posologia,
.atd-trat__obs {
  margin: 0;
  color: var(--atd-suave);
  font-size: 0.8rem;
  line-height: 1.45;
  white-space: pre-line;
}

.atd-trat__obs span {
  font-weight: 700;
}

/* Dados clínicos: uma linha por categoria, sem cartão dentro da ficha. */
.atd-folds {
  margin: 0;
  padding: 0;
  list-style: none;
}

.atd-fold + .atd-fold {
  border-top: 1px solid var(--hc-linha);
}

.atd-fold__heading {
  margin: 0;
}

.atd-fold__row {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 0.7rem;
  padding: 0.65rem 1.15rem;
}

/* Gatilho de seção recolhível: Button com slot, sem o visual de CTA do preset (nem a
   sombra que o hc-tema dá ao botão cheio, que descolava o cabeçalho do corpo). */
.atd-fold__trigger.p-button {
  --hc-botao-sombra: none;
  justify-content: flex-start;
  width: 100%;
  gap: 0.7rem;
  padding: 0.65rem 1.15rem;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  color: inherit;
  font-size: inherit;
  text-align: start;
}

.atd-fold__trigger.p-button:not(:disabled):hover,
.atd-fold__trigger.p-button:not(:disabled):active,
.atd-fold__trigger.p-button:focus-visible {
  --hc-botao-sombra: none;
  border: 0;
  background: var(--hc-fundo);
  box-shadow: none;
  color: inherit;
  outline: none;
}

.atd-fold__trigger.p-button:focus-visible {
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--hc-marca) 50%, transparent);
}

.atd-fold__icon {
  display: grid;
  width: 2rem;
  height: 2rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.6rem;
  background: var(--hc-marca-clara);
  color: var(--hc-marca-forte);
  font-size: 0.95rem;
}

/* Alergia registrada: a urgência mora no ícone. */
.atd-fold[data-tone='warm'] .atd-fold__icon {
  background: var(--hc-coral-fundo);
  color: var(--hc-coral-tinta);
}

/* Categoria vazia recua: ícone apagado, sem nada a abrir. */
.atd-fold[data-vazio='true'] .atd-fold__icon {
  background: var(--hc-fundo);
  color: var(--atd-fraco);
}

.atd-fold__copy {
  display: grid;
  gap: 0.05rem;
  min-width: 0;
  flex: 1;
}

.atd-fold__title {
  margin: 0;
  color: var(--hc-tinta);
  font-size: 0.88rem;
  font-weight: 700;
  line-height: 1.3;
}

.atd-fold__sub {
  overflow: hidden;
  margin: 0;
  color: var(--atd-suave);
  font-size: 0.76rem;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* A frase do motivo é o conteúdo: lê inteira, quebra se precisar. */
.atd-fold[data-vazio='true'] .atd-fold__sub {
  white-space: normal;
}

.atd-fold__chevron {
  color: var(--atd-fraco);
  font-size: 0.78rem;
}

/* Itens alinhados ao título, não à borda; sem rolagem por dentro: quem acha longa, recolhe. */
.atd-items {
  display: grid;
  gap: 0.55rem;
  margin: 0;
  padding-block: 0 0.8rem;
  padding-inline: calc(1.15rem + 2rem + 0.7rem) 1.15rem;
  list-style: none;
}

.atd-items li {
  display: grid;
  gap: 0.05rem;
  min-width: 0;
}

.atd-items strong {
  color: var(--hc-tinta);
  font-size: 0.84rem;
  font-weight: 650;
  line-height: 1.35;
}

.atd-item__meta {
  color: var(--atd-suave);
  font-size: 0.76rem;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.atd-item--destaque strong {
  color: var(--hc-coral-tinta);
}

/* Documentos */
.atd-docs {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.atd-doc {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.6rem;
  padding-block: 0.5rem;
}

.atd-doc + .atd-doc {
  border-top: 1px solid var(--hc-linha);
}

.atd-doc__icone {
  color: var(--hc-marca);
  font-size: 1.15rem;
}

.atd-doc__texto {
  display: grid;
  gap: 0.05rem;
  min-width: 0;
}

.atd-doc__texto strong {
  overflow: hidden;
  color: var(--hc-tinta);
  font-size: 0.84rem;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.atd-doc__texto small,
.atd-doc__sem {
  color: var(--atd-suave);
  font-size: 0.72rem;
  line-height: 1.4;
}

.atd-doc__acoes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.3rem;
}

.atd-doc__n {
  color: var(--atd-suave);
  font-size: 0.7rem;
  font-weight: 700;
}

/* Diário */
.atd-diario {
  display: grid;
  gap: 0.85rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.atd-diario__dia {
  display: grid;
  gap: 0.45rem;
}

.atd-diario__dia + .atd-diario__dia {
  padding-top: 0.85rem;
  border-top: 1px solid var(--hc-linha);
}

.atd-diario__data {
  color: var(--hc-tinta);
  font-size: 0.84rem;
}

.atd-diario__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.atd-diario__tag {
  padding: 0.12rem 0.5rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 650;
}

.atd-diario__tag--sintoma {
  background: var(--hc-coral-fundo);
  color: var(--hc-coral-tinta);
}

.atd-diario__tag--doenca {
  background: var(--hc-pessego-fundo);
  color: var(--hc-pessego-tinta);
}

.atd-diario__texto {
  margin: 0;
  color: var(--hc-tinta);
  font-size: 0.8rem;
  line-height: 1.5;
  white-space: pre-line;
}

.atd-diario__texto span {
  color: var(--atd-suave);
  font-weight: 700;
}

.atd-diario__fotos {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

/* ------------------------------------------------------------------ trabalho */

.atd-trabalho {
  display: grid;
  gap: 1.5rem;
  align-content: start;
  min-width: 0;
}

/* Tom neutro: é aviso de escopo, não de erro. */
.atd-aviso {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.9rem 1.1rem;
  border: 1px solid var(--hc-borda);
  border-radius: 0.9rem;
  background: var(--hc-cartao);
}

.atd-aviso i {
  margin-top: 0.15rem;
  color: var(--atd-suave);
}

.atd-aviso strong {
  display: block;
  margin-bottom: 0.15rem;
  color: var(--hc-tinta);
  font-size: 0.9rem;
}

.atd-aviso p {
  margin: 0;
  color: var(--atd-suave);
  font-size: 0.85rem;
  line-height: 1.5;
}

/* A folha da anotação: um cartão, seções separadas por fio, nenhum cartão dentro. */
.atd-folha {
  min-width: 0;
  border: 1px solid var(--hc-borda);
  border-radius: 1rem;
  background: var(--hc-cartao);
  box-shadow: var(--hc-sombra);
}

.atd-folha__cab {
  display: grid;
  gap: 0.25rem;
  padding: 1.25rem var(--folha-pad-x) 0;
}

.atd-folha__cab h2 {
  margin: 0;
  color: var(--hc-tinta);
  font-size: 1.15rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.atd-folha__cab p {
  margin: 0;
  color: var(--atd-suave);
  font-size: 0.82rem;
  line-height: 1.45;
}

.atd-folha__secao {
  display: grid;
  gap: 0.9rem;
  padding: 1.25rem var(--folha-pad-x);
  border-top: 1px solid var(--folha-fio);
}

.atd-folha__cab + .atd-folha__secao {
  padding-top: 1rem;
  border-top: 0;
}

.atd-campo {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
}

.atd-campo label {
  color: var(--hc-tinta);
  font-size: 0.8rem;
  font-weight: 650;
}

.atd-campo :deep(.p-select) {
  width: 100%;
}

.atd-folha__duas {
  display: grid;
  gap: 0.9rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.atd-folha__secao-cab {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1rem;
}

.atd-folha__secao-cab h3 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  color: var(--hc-tinta);
  font-size: 0.95rem;
  font-weight: 750;
  letter-spacing: -0.01em;
}

.atd-folha__secao-cab h3 i {
  color: var(--hc-marca);
  font-size: 1.05rem;
}

/* Rótulo que abre o seletor de arquivo, com a mesma cara dos botões contornados da folha. */
.atd-anexar {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 2.1rem;
  padding: 0.35rem 0.9rem;
  border: 1px solid var(--atd-campo-borda);
  border-radius: 999px;
  background: var(--hc-cartao);
  color: var(--hc-tinta);
  font-size: 0.82rem;
  font-weight: 650;
  cursor: pointer;
  transition:
    border-color 150ms ease-out,
    background 150ms ease-out;
}

.atd-anexar:hover {
  border-color: var(--atd-campo-borda-hover);
  background: var(--hc-fundo);
}

.atd-anexar:focus-within {
  outline: 2px solid var(--hc-marca);
  outline-offset: 2px;
}

.atd-anexar input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.atd-anexar i {
  color: var(--hc-marca);
}

.atd-anexos {
  display: grid;
  gap: 0.45rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.atd-anexos li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) minmax(11rem, 14rem) auto;
  align-items: center;
  gap: 0.65rem;
  padding: 0.45rem 0.45rem 0.45rem 0.8rem;
  border: 1px solid var(--hc-borda);
  border-radius: 0.75rem;
  background: var(--hc-fundo);
}

.atd-anexos__icone {
  color: var(--hc-marca);
  font-size: 1.1rem;
}

.atd-anexos__nome {
  display: grid;
  min-width: 0;
}

.atd-anexos__nome strong {
  overflow: hidden;
  color: var(--hc-tinta);
  font-size: 0.84rem;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.atd-anexos__nome small {
  color: var(--atd-suave);
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
}

.atd-anexos__tipo {
  width: 100%;
}

.atd-anexos__remover.p-button {
  width: 2.25rem;
  height: 2.25rem;
  color: var(--atd-suave);
}

.atd-anexos__remover.p-button:not(:disabled):hover {
  background: var(--hc-coral-fundo);
  color: var(--hc-coral-tinta);
}

.atd-folha__nota {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  color: var(--atd-suave);
  font-size: 0.75rem;
  line-height: 1.4;
}

.atd-folha__nota i {
  color: var(--hc-lilas-tinta);
}

/* Preso ao pé da tela enquanto a folha estiver nela: registrar nunca fica a um scroll de
   distância, e o erro aparece ao lado de quem clicou. */
.atd-folha__rodape {
  position: sticky;
  bottom: 0;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.6rem 1rem;
  padding: 0.85rem var(--folha-pad-x);
  border-top: 1px solid var(--hc-borda);
  border-radius: 0 0 1rem 1rem;
  background: var(--hc-cartao);
  box-shadow: 0 -10px 24px -18px rgb(20 32 28 / 35%);
}

.atd-folha__erro {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  flex: 1 1 16rem;
  margin: 0;
  color: var(--hc-coral-tinta);
  font-size: 0.82rem;
  font-weight: 650;
  line-height: 1.4;
}

.atd-folha__enviar.p-button {
  min-width: 12rem;
}

/* ------------------------------------------------------------------ histórico */

.atd-hist {
  display: grid;
  gap: 0.75rem;
  min-width: 0;
}

.atd-hist__cab {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem 1rem;
}

.atd-hist__cab h2 {
  margin: 0;
  color: var(--hc-tinta);
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.atd-hist__conta {
  color: var(--atd-suave);
  font-size: 0.78rem;
  font-weight: 650;
}

.atd-hist__lede {
  margin: -0.35rem 0 0;
  color: var(--atd-suave);
  font-size: 0.82rem;
  line-height: 1.45;
}

.atd-hist__vazio {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem 1.15rem;
  border: 1px dashed var(--atd-campo-borda);
  border-radius: 1rem;
  color: var(--atd-suave);
}

.atd-hist__vazio i {
  margin-top: 0.1rem;
  font-size: 1.15rem;
}

.atd-hist__vazio strong {
  display: block;
  color: var(--hc-tinta);
  font-size: 0.9rem;
}

.atd-hist__vazio p {
  margin: 0.15rem 0 0;
  font-size: 0.82rem;
  line-height: 1.45;
}

.atd-hist__lista {
  display: grid;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.atd-nota {
  display: grid;
  gap: 0.9rem;
  padding: 1.15rem var(--folha-pad-x) 1.25rem;
  border: 1px solid var(--hc-borda);
  border-radius: 1rem;
  background: var(--hc-cartao);
}

.atd-nota__cab {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem 1rem;
}

.atd-nota__quem {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
}

.atd-nota__quem h3 {
  margin: 0;
  color: var(--hc-tinta);
  font-size: 1rem;
  font-weight: 750;
  letter-spacing: -0.01em;
}

.atd-nota__quem p {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin: 0;
  color: var(--atd-suave);
  font-size: 0.8rem;
}

.atd-nota__quando {
  flex: 0 0 auto;
  color: var(--atd-suave);
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.atd-nota__texto {
  margin: 0;
  color: var(--hc-tinta);
  font-size: 0.92rem;
  line-height: 1.6;
  white-space: pre-line;
}

.atd-nota__anexos {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Anexo clicável: Button com slot (ícone + nome + tamanho), sem o visual de CTA do preset. */
.atd-nota__anexo.p-button {
  --hc-botao-sombra: none;
  gap: 0.5rem;
  max-width: 100%;
  padding: 0.45rem 0.75rem;
  border: 1px solid var(--hc-borda);
  border-radius: 0.65rem;
  background: var(--hc-fundo);
  box-shadow: none;
  color: var(--hc-tinta);
  font-size: 0.82rem;
  text-align: start;
  transition: border-color 150ms ease-out;
}

.atd-nota__anexo.p-button:not(:disabled):hover,
.atd-nota__anexo.p-button:focus-visible {
  --hc-botao-sombra: none;
  border-color: var(--hc-marca);
  background: var(--hc-fundo);
  box-shadow: none;
  color: var(--hc-tinta);
}

.atd-nota__anexo.p-button:disabled {
  cursor: wait;
  opacity: 0.72;
}

.atd-nota__anexo i {
  color: var(--hc-marca);
}

.atd-nota__anexo-nome {
  overflow: hidden;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.atd-nota__anexo small {
  color: var(--atd-suave);
  font-size: 0.72rem;
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .atd-anexar,
  .atd-nota__anexo.p-button {
    transition: none;
  }
}

@media (max-width: 640px) {
  .atd-folha__duas {
    grid-template-columns: minmax(0, 1fr);
  }

  .atd-anexos li {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  .atd-anexos__tipo {
    grid-column: 1 / -1;
  }
}
</style>
