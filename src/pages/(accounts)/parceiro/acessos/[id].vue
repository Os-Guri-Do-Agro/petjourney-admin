<script setup lang="ts">
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import AnotacaoEstruturadaFields from '@/components/parceiro/AnotacaoEstruturadaFields.vue'
import AnotacaoEstruturadaView from '@/components/parceiro/AnotacaoEstruturadaView.vue'
import PartnerOperabilityBanner from '@/components/parceiro/PartnerOperabilityBanner.vue'
import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import PartnerSectionTabs from '@/components/parceiro/PartnerSectionTabs.vue'
import PartnerStatusBadge from '@/components/parceiro/PartnerStatusBadge.vue'
import { useAgora } from '@/composables/useAgora'
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
  StatusCompartilhamento,
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

/** A lista fechada mais "Outra": fora dela, o valor e texto livre do parceiro. */
const opcoesEspecialidade = [...ESPECIALIDADES, ESPECIALIDADE_OUTRA] as const

/** Clicar de novo limpa: o campo e opcional e sem isso nao ha como desfazer a escolha. */
function selecionarEspecialidade(opcao: (typeof opcoesEspecialidade)[number]) {
  anotacaoForm.especialidade = anotacaoForm.especialidade === opcao ? null : opcao

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
  alergias: { icon: 'pi pi-exclamation-triangle', tone: 'warm' },
  vacinas: { icon: 'pi pi-shield', tone: 'default' },
  medicamentos: { icon: 'pi pi-inbox', tone: 'default' },
  comportamento: { icon: 'pi pi-eye', tone: 'default' },
  diagnosticos: { icon: 'pi pi-file-edit', tone: 'default' },
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
  montarBlocosLista(fonteSnapshot.value).map((bloco) => ({
    id: bloco.id,
    title: t(`acessos.snapshot.${bloco.id}`),
    icon: APARENCIA_BLOCO[bloco.id].icon,
    tone: APARENCIA_BLOCO[bloco.id].tone,
    items: bloco.items.map((item) => ({
      ...rotuloItem(item),
      destaque: item.destaque,
    })),
    vazioTexto: bloco.motivo ? textoMotivo(bloco.id, bloco.motivo) : '',
  })),
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

function statusBadge(status: StatusCompartilhamento) {
  const map: Record<StatusCompartilhamento, 'ATIVO' | 'SUSPENSO' | 'REJEITADO'> = {
    ATIVO: 'ATIVO',
    EXPIRADO: 'SUSPENSO',
    REVOGADO: 'REJEITADO',
  }

  return map[status]
}

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

function onAnexosSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  formError.value = ''

  for (const file of files) {
    if (anexosForm.value.length >= MAX_ANEXOS) {
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
    } else {
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
    :subtitle="t('acessos.detalhe.subtitle')"
    :title="detalhe?.petNome ?? t('acessos.detalhe.title')"
    :loading="loading"
    :error="error"
    :no-partner-access="store.semAcessoParceiro"
    guidance
    @retry="loadDetalhe()"
  >
    <template #actions>
      <Button
        :label="t('acessos.detalhe.back')"
        icon="pi pi-arrow-left"
        severity="secondary"
        @click="voltar"
      />
    </template>

    <!-- Leitura do prontuário não é gated por auditoria (seção 4): o acesso foi
         consentido pelo responsável, não pelo status do cadastro. Suspenso lê
         tudo e perde só a anotação, que é mutação. -->
    <PartnerOperabilityBanner cover-suspended />

    <template v-if="detalhe">
      <!-- Identidade do pet -->
      <section class="atd-hero" :data-status="detalhe.status">
        <div class="atd-hero__pet">
          <img
            v-if="detalhe.petFoto"
            :src="detalhe.petFoto"
            :alt="detalhe.petNome"
            class="atd-hero__foto"
          />
          <span v-else class="atd-hero__foto atd-hero__foto--empty" aria-hidden="true">
            <i class="pi pi-heart" />
          </span>

          <div class="atd-hero__identity">
            <div class="atd-hero__title-row">
              <strong>{{ detalhe.petNome }}</strong>
              <PartnerStatusBadge :status="statusBadge(detalhe.status)" />
            </div>

            <p class="atd-hero__subtitle">
              {{ detalhe.especieLabel }}
              <template v-if="isAtivo && detalhe.petCastrado != null">
                ·
                {{ detalhe.petCastrado ? t('acessos.pet.castrado') : t('acessos.pet.naoCastrado') }}
              </template>
            </p>

            <div class="atd-hero__tags" :aria-label="t('acessos.detalhe.metaAria')">
              <span class="atd-hero__tag atd-hero__tag--service">
                <i class="pi pi-briefcase" aria-hidden="true" />
                {{ servicoLabel }}
              </span>
              <span v-if="isAtivo" class="atd-hero__tag atd-hero__tag--expiry">
                <i class="pi pi-clock" aria-hidden="true" />
                {{ expiraLabel(detalhe.expiraEm) }}
              </span>
            </div>
          </div>
        </div>

        <dl v-if="pesoKg != null" class="atd-hero__facts">
          <div class="atd-hero__fact">
            <dt>{{ t('acessos.snapshot.peso') }}</dt>
            <dd>{{ pesoKgLegivel }} kg</dd>
          </div>
        </dl>
      </section>

      <!-- Encerrado -->
      <section v-if="!isAtivo" class="atd-closed" role="status">
        <i class="pi pi-lock" aria-hidden="true" />
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

      <PartnerSectionTabs
        :tabs="tabs"
        :active-tab="displayTab"
        :aria-label="tabsAriaLabel"
        @select="setTab($event as DetalheTab)"
      />

      <!-- Aba: resumo do pet -->
      <div v-if="displayTab === 'resumo'" class="atd-panel atd-resumo" role="tabpanel">
        <!-- Em atendimento com estadia o quadro muda no meio: saber que o responsável
             mexeu no resumo depois de entregar é o que avisa que a leitura de ontem
             pode não valer mais. -->
        <p
          v-if="carimbo"
          class="atd-stamp"
          :data-atualizado="carimbo.atualizado ? 'true' : 'false'"
        >
          <i :class="carimbo.atualizado ? 'pi pi-history' : 'pi pi-clock'" aria-hidden="true" />
          <span>{{
            carimbo.atualizado
              ? t('acessos.snapshot.carimboAtualizado', {
                  data: formatDateTime(carimbo.data),
                })
              : t('acessos.snapshot.carimbo', { data: formatDateTime(carimbo.data) })
          }}</span>
        </p>

        <!-- Responsável pode liberar o acesso sem marcar nenhuma categoria: a aba existe
             e não tem o que mostrar. Explica o porquê e empurra para a ação útil. -->
        <section v-if="resumoVazio" class="atd-empty">
          <span class="atd-empty__icon" aria-hidden="true">
            <i class="pi pi-lock-open" />
          </span>
          <strong>{{ t('acessos.snapshot.emptyTitle') }}</strong>
          <p>{{ t('acessos.snapshot.emptyBody', { pet: detalhe.petNome }) }}</p>
          <Button
            :label="t('acessos.snapshot.emptyCta')"
            icon="pi pi-pencil"
            size="small"
            @click="setTab('anotacoes')"
          />
        </section>

        <div v-if="mensagemTutor || showObservacoesTutor" class="atd-resumo__context">
          <section v-if="mensagemTutor" class="atd-callout">
            <header class="atd-callout__head">
              <span class="atd-callout__icon" aria-hidden="true">
                <i class="pi pi-comment" />
              </span>
              <h3>{{ t('acessos.detalhe.mensagemTutor') }}</h3>
            </header>
            <p>{{ mensagemTutor }}</p>
          </section>

          <section v-if="showObservacoesTutor" class="atd-callout atd-callout--soft">
            <header class="atd-callout__head">
              <span class="atd-callout__icon" aria-hidden="true">
                <i class="pi pi-info-circle" />
              </span>
              <h3>{{ t('acessos.snapshot.observacoes') }}</h3>
            </header>
            <p>{{ observacoesTutor }}</p>
          </section>
        </div>

        <!-- Tratamento contínuo (Parte 16), ACIMA das listas clínicas: é o remédio de
             todo dia, e o item cuja falha tem dano imediato para quem vai cuidar do pet
             sem conviver com ele. -->
        <section
          v-if="tratamentosEstado !== 'OCULTO'"
          class="atd-diario"
          aria-labelledby="atd-trat-title"
        >
          <header class="atd-docs__head">
            <div>
              <h2 id="atd-trat-title">{{ t('acessos.tratamentos.title') }}</h2>
              <p v-if="isGuidanceVisible">{{ t('acessos.tratamentos.lede') }}</p>
            </div>
            <span v-if="tratamentosContinuos.length" class="atd-docs__count">{{
              t('acessos.tratamentos.count', { n: tratamentosContinuos.length }, tratamentosContinuos.length)
            }}</span>
          </header>

          <p v-if="tratamentosVazioTexto" class="atd-bloco-vazio">{{ tratamentosVazioTexto }}</p>

          <ul v-else class="atd-trat__list">
            <li v-for="item in tratamentosContinuos" :key="item.key" class="atd-trat__entry">
              <header class="atd-trat__head">
                <i class="pi pi-heart-fill" aria-hidden="true" />
                <strong>{{ item.titulo }}</strong>
              </header>

              <p v-if="item.posologia" class="atd-trat__posologia">{{ item.posologia }}</p>

              <dl v-if="item.campos.length" class="atd-trat__grid">
                <div v-for="campo in item.campos" :key="campo.chave">
                  <dt>{{ campo.label }}</dt>
                  <dd>{{ campo.valor }}</dd>
                </div>
              </dl>

              <div v-if="item.observacoes" class="atd-trat__text">
                <span>{{ t('acessos.tratamentos.campos.observacoes') }}</span>
                <p>{{ item.observacoes }}</p>
              </div>
            </li>
          </ul>
        </section>

        <section
          v-if="snapshotListSections.length"
          class="atd-clinical"
          aria-labelledby="atd-clinical-title"
        >
          <header class="atd-clinical__head">
            <div>
              <h2 id="atd-clinical-title">{{ t('acessos.snapshot.clinicalTitle') }}</h2>
              <p>{{ t('acessos.snapshot.clinicalLede') }}</p>
            </div>
            <span class="atd-clinical__count">{{
              t('acessos.snapshot.sectionsCount', { n: snapshotListSections.length }, snapshotListSections.length)
            }}</span>
          </header>

          <div class="atd-folds">
            <section
              v-for="section in snapshotListSections"
              :key="section.id"
              class="atd-fold"
              :data-tone="section.tone"
              :data-open="isSectionOpen(section.id) ? 'true' : 'false'"
            >
              <h3 class="atd-fold__heading">
                <Button
                  type="button"
                  class="atd-fold__trigger"
                  :aria-expanded="isSectionOpen(section.id)"
                  :aria-controls="`atd-fold-${section.id}`"
                  @click="toggleSection(section.id)"
                >
                  <span class="atd-fold__icon" aria-hidden="true">
                    <i :class="section.icon" />
                  </span>
                  <span class="atd-fold__copy">
                    <strong>{{ section.title }}</strong>
                    <small>{{
                      section.items.length
                        ? t('acessos.snapshot.itemsCount', { n: section.items.length }, section.items.length)
                        : t('acessos.snapshot.semItens')
                    }}</small>
                  </span>
                  <i
                    class="pi atd-fold__chevron"
                    :class="isSectionOpen(section.id) ? 'pi-chevron-up' : 'pi-chevron-down'"
                    aria-hidden="true"
                  />
                </Button>
              </h3>

              <div
                v-show="isSectionOpen(section.id)"
                :id="`atd-fold-${section.id}`"
                class="atd-fold__body"
              >
                <p v-if="!section.items.length" class="atd-fold__vazio">
                  {{ section.vazioTexto }}
                </p>

                <div v-else class="atd-fold__scroll" tabindex="0">
                  <ul class="atd-items">
                    <li
                      v-for="(item, index) in section.items"
                      :key="`${section.id}-${index}`"
                      :class="{ 'atd-item--destaque': item.destaque }"
                    >
                      <strong>{{ item.titulo }}</strong>
                      <span v-if="item.detalhe" class="atd-item__meta">{{ item.detalhe }}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </section>
          </div>
        </section>

        <!-- Documentos liberados item a item: o snapshot traz ids do cofre, a URL
             de leitura nasce no clique e vale por poucos minutos. -->
        <section
          v-if="documentosEstado !== 'OCULTO'"
          class="atd-docs"
          aria-labelledby="atd-docs-title"
        >
          <header class="atd-docs__head">
            <div>
              <h2 id="atd-docs-title">{{ t('acessos.documentos.title') }}</h2>
              <p v-if="isGuidanceVisible">{{ t('acessos.documentos.lede') }}</p>
            </div>
            <span v-if="documentos.length" class="atd-docs__count">{{
              t('acessos.documentos.count', { n: documentos.length }, documentos.length)
            }}</span>
          </header>

          <p v-if="documentosVazioTexto" class="atd-bloco-vazio">{{ documentosVazioTexto }}</p>

          <ul v-else class="atd-docs__list">
            <li v-for="doc in documentos" :key="doc.key" class="atd-doc">
              <span class="atd-doc__icon" aria-hidden="true">
                <i class="pi pi-file" />
              </span>

              <div class="atd-doc__copy">
                <strong :title="doc.nome">{{ doc.nome }}</strong>
                <small class="atd-doc__meta">
                  <span class="atd-doc__tipo">{{ doc.tipo }}</span>
                  <template v-if="doc.emissao">
                    {{ t('acessos.documentos.emissao', { data: doc.emissao }) }}
                  </template>
                  <template v-if="doc.expiracao">
                    {{ t('acessos.documentos.expiracao', { data: doc.expiracao }) }}
                  </template>
                </small>
              </div>

              <p v-if="!doc.arquivos.length" class="atd-doc__empty">
                {{ t('acessos.documentos.semArquivo') }}
              </p>

              <ul v-else class="atd-doc__files">
                <li v-for="(arquivo, index) in doc.arquivos" :key="arquivo.id">
                  <span v-if="doc.arquivos.length > 1" class="atd-doc__file-label">
                    {{ t('acessos.documentos.arquivoN', { n: index + 1 }) }}
                  </span>
                  <Button
                    :label="t('acessos.documentos.abrir')"
                    icon="pi pi-external-link"
                    severity="secondary"
                    outlined
                    size="small"
                    :loading="arquivoOcupado === `abrir:${arquivo.id}`"
                    :aria-label="`${t('acessos.documentos.abrir')}: ${doc.nome}`"
                    @click="abrirArquivo(arquivo.id)"
                  />
                  <Button
                    :label="t('acessos.documentos.baixar')"
                    icon="pi pi-download"
                    size="small"
                    :loading="arquivoOcupado === `baixar:${arquivo.id}`"
                    :aria-label="`${t('acessos.documentos.baixar')}: ${doc.nome}`"
                    @click="baixarArquivo(arquivo.id, arquivo.nome)"
                  />
                </li>
              </ul>
            </li>
          </ul>
        </section>

        <!-- Diário: só entram os dias com anormalidade registrada, dentro da janela
             que o responsável liberou. Enum já chega traduzido do backend. -->
        <section
          v-if="diarioEstado !== 'OCULTO'"
          class="atd-diario"
          aria-labelledby="atd-diario-title"
        >
          <header class="atd-docs__head">
            <div>
              <h2 id="atd-diario-title">{{ t('acessos.diario.title') }}</h2>
              <p v-if="isGuidanceVisible">{{ t('acessos.diario.lede') }}</p>
            </div>
            <span v-if="diario.length" class="atd-docs__count">{{
              t('acessos.diario.count', { n: diario.length }, diario.length)
            }}</span>
          </header>

          <p v-if="diarioVazioTexto" class="atd-bloco-vazio">{{ diarioVazioTexto }}</p>

          <ul v-else class="atd-diario__list">
            <li v-for="entrada in diario" :key="entrada.key" class="atd-diario__entry">
              <header class="atd-diario__head">
                <i class="pi pi-calendar" aria-hidden="true" />
                <strong>{{ entrada.data }}</strong>
              </header>

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

              <dl v-if="entrada.campos.length" class="atd-diario__grid">
                <div v-for="campo in entrada.campos" :key="campo.chave">
                  <dt>{{ campo.label }}</dt>
                  <dd>{{ campo.valor }}</dd>
                </div>
              </dl>

              <div v-for="texto in entrada.textos" :key="texto.chave" class="atd-diario__text">
                <span>{{ texto.label }}</span>
                <p>{{ texto.valor }}</p>
              </div>

              <div v-if="entrada.fotoIds.length" class="atd-diario__fotos">
                <span class="atd-diario__fotos-label">
                  {{ t('acessos.diario.fotos', { n: entrada.fotoIds.length }, entrada.fotoIds.length) }}
                </span>
                <Button
                  v-for="(fotoId, index) in entrada.fotoIds"
                  :key="fotoId"
                  :label="t('acessos.diario.abrirFoto', { n: index + 1 })"
                  icon="pi pi-image"
                  severity="secondary"
                  outlined
                  size="small"
                  :loading="arquivoOcupado === `abrir:${fotoId}`"
                  @click="abrirArquivo(fotoId)"
                />
              </div>
            </li>
          </ul>
        </section>
      </div>

      <!-- Aba: anotações -->
      <div v-else class="atd-panel atd-notes" role="tabpanel">
        <div
          class="atd-notes__layout"
          :class="{
            'atd-notes__layout--with-form': podeAnotar,
            'atd-notes__layout--structured': podeAnotar && temCamposEstruturados,
          }"
        >
          <section class="atd-notes__feed" aria-labelledby="atd-notes-title">
            <header class="atd-notes__head">
              <div>
                <h2 id="atd-notes-title">{{ t('acessos.anotacoes.title') }}</h2>
                <p v-if="isGuidanceVisible">{{ t('acessos.anotacoes.lede') }}</p>
              </div>
              <span v-if="anotacoesOrdenadas.length" class="atd-notes__count">{{
                t('acessos.anotacoes.count', { n: anotacoesOrdenadas.length }, anotacoesOrdenadas.length)
              }}</span>
            </header>

            <div v-if="anotacoesOrdenadas.length === 0" class="atd-empty">
              <span class="atd-empty__icon" aria-hidden="true">
                <i class="pi pi-pencil" />
              </span>
              <strong>{{ t('acessos.anotacoes.empty') }}</strong>
              <p>
                {{
                  isAtivo
                    ? t('acessos.anotacoes.emptyHint')
                    : t('acessos.anotacoes.emptyHintClosed')
                }}
              </p>
            </div>

            <ol v-else class="atd-timeline">
              <li
                v-for="anotacao in anotacoesOrdenadas"
                :key="anotacao.id"
                class="atd-timeline__item"
              >
                <span class="atd-timeline__rail" aria-hidden="true">
                  <span class="atd-timeline__dot" />
                </span>

                <article class="atd-note">
                  <header class="atd-note__head">
                    <div class="atd-note__title">
                      <span class="atd-note__service">{{ anotacao.servicoRealizado }}</span>
                      <time class="atd-note__time" :datetime="anotacao.criadaEm">{{
                        formatDateTime(anotacao.criadaEm)
                      }}</time>
                    </div>
                    <p class="atd-note__byline">
                      <i class="pi pi-building" aria-hidden="true" />
                      <span>{{ anotacao.empresaNome }}</span>
                      <template v-if="autorDaAnotacao(anotacao)">
                        <span class="atd-note__sep" aria-hidden="true">·</span>
                        <i class="pi pi-user" aria-hidden="true" />
                        <span>{{ autorDaAnotacao(anotacao) }}</span>
                      </template>
                    </p>
                  </header>

                  <p class="atd-note__body">{{ anotacao.texto }}</p>

                  <AnotacaoEstruturadaView :anotacao="anotacao" />

                  <div v-if="anotacao.anexos.length" class="atd-note__files">
                    <p class="atd-note__files-label">
                      {{ t('acessos.anotacoes.anexosLabel') }}
                      <span>{{ anotacao.anexos.length }}</span>
                    </p>
                    <ul class="atd-note__attachments">
                      <li v-for="anexo in anotacao.anexos" :key="anexo.id">
                        <Button
                          type="button"
                          class="atd-note__file"
                          :disabled="abrindoAnexoId === anexo.id"
                          :aria-label="`${t('acessos.anotacoes.abrirAnexo')}: ${anexo.nome}`"
                          @click="abrirAnexo(anexo.id)"
                        >
                          <span class="atd-note__file-icon" aria-hidden="true">
                            <i
                              :class="
                                abrindoAnexoId === anexo.id
                                  ? 'pi pi-spin pi-spinner'
                                  : 'pi pi-paperclip'
                              "
                            />
                          </span>
                          <span class="atd-note__file-copy">
                            <strong>{{ anexo.nome }}</strong>
                            <small>
                              <template v-if="anexo.tipoDocumento">
                                {{ anexo.tipoDocumento }} ·
                              </template>
                              {{ formatBytes(anexo.tamanhoBytes) }}
                            </small>
                          </span>
                          <i class="pi pi-external-link atd-note__file-go" aria-hidden="true" />
                        </Button>
                      </li>
                    </ul>
                  </div>
                </article>
              </li>
            </ol>
          </section>

          <aside v-if="somenteLeitura" class="atd-readonly" role="status">
            <i class="pi pi-eye" aria-hidden="true" />
            <div>
              <strong>{{ t('acessos.anotacao.somenteLeitura.title') }}</strong>
              <p>{{ t('acessos.anotacao.somenteLeitura.body') }}</p>
            </div>
          </aside>

          <aside v-if="podeAnotar" class="atd-composer" aria-labelledby="atd-composer-title">
            <header class="atd-composer__head">
              <span class="atd-composer__badge" aria-hidden="true">
                <i class="pi pi-plus" />
              </span>
              <div>
                <h3 id="atd-composer-title">{{ t('acessos.anotacao.title') }}</h3>
                <p>{{ t('acessos.anotacao.lede') }}</p>
              </div>
            </header>

            <p v-if="formError" class="atd-composer__error" role="alert">{{ formError }}</p>

            <div class="atd-composer__fields">
              <div class="atd-field">
                <label for="anot-servico">{{ t('acessos.anotacao.servico') }}</label>
                <InputText
                  id="anot-servico"
                  v-model="anotacaoForm.servicoRealizado"
                  :maxlength="LIMITES_CAMPOS_LIVRES.servicoRealizado"
                  :placeholder="t('acessos.anotacao.servicoPlaceholder')"
                />
              </div>

              <div class="atd-field">
                <label for="anot-texto">{{ t('acessos.anotacao.texto') }}</label>
                <Textarea
                  id="anot-texto"
                  v-model="anotacaoForm.texto"
                  rows="5"
                  auto-resize
                  :maxlength="LIMITES_CAMPOS_LIVRES.texto"
                  :placeholder="t('acessos.anotacao.textoPlaceholder')"
                />
              </div>

              <AnotacaoEstruturadaFields
                v-if="temCamposEstruturados && detalhe"
                v-model="estruturadaForm"
                :tipo-servico="detalhe.tipoServico"
                :erros="estruturadaErros"
                :disabled="submittingAnotacao"
              />

              <div class="atd-field">
                <label for="anot-profissional">{{ t('acessos.anotacao.profissional') }}</label>
                <InputText
                  id="anot-profissional"
                  v-model="anotacaoForm.profissionalNome"
                  :maxlength="LIMITES_CAMPOS_LIVRES.profissionalNome"
                  :placeholder="t('acessos.anotacao.profissionalPlaceholder')"
                />
              </div>

              <!-- Area de atuacao: lista fechada em chips mais "Outra" com texto livre.
                   O que viaja e a CHAVE quando e uma das opcoes; "Fisioterapia" e
                   "Acupuntura" sao casos legitimos e um enum fechado viraria 400. -->
              <div class="atd-field">
                <span class="atd-field__label">{{ t('acessos.anotacao.especialidade') }}</span>
                <div class="atd-chips">
                  <!-- Chips que quebram linha, com desmarcar ao clicar de novo: Button com
                       aria-pressed em vez de SelectButton (grupo colado, sem quebra). -->
                  <Button
                    v-for="opcao in opcoesEspecialidade"
                    :key="opcao"
                    type="button"
                    class="atd-chip"
                    :class="{ 'atd-chip--on': anotacaoForm.especialidade === opcao }"
                    :label="t(SUFIXO_ESPECIALIDADE + opcao)"
                    severity="secondary"
                    outlined
                    rounded
                    size="small"
                    :aria-pressed="anotacaoForm.especialidade === opcao"
                    :disabled="submittingAnotacao"
                    @click="selecionarEspecialidade(opcao)"
                  />
                </div>
                <InputText
                  v-if="anotacaoForm.especialidade === ESPECIALIDADE_OUTRA"
                  v-model="anotacaoForm.especialidadeOutra"
                  :maxlength="LIMITES_CAMPOS_LIVRES.profissionalEspecialidade"
                  :placeholder="t('acessos.anotacao.especialidadeOutraPlaceholder')"
                  :disabled="submittingAnotacao"
                />
              </div>

              <div class="atd-field atd-field--files">
                <span class="atd-field__label">
                  {{ t('acessos.anotacao.anexos', { n: MAX_ANEXOS }) }}
                </span>

                <ul v-if="anexosForm.length" class="atd-anexo-list">
                  <li v-for="(anexo, index) in anexosForm" :key="`${anexo.file.name}-${index}`">
                    <div class="atd-anexo-list__top">
                      <div class="atd-anexo-list__info">
                        <i class="pi pi-file" aria-hidden="true" />
                        <span>{{ anexo.file.name }}</span>
                        <small>{{ formatBytes(anexo.file.size) }}</small>
                      </div>
                      <Button
                        icon="pi pi-times"
                        severity="secondary"
                        text
                        rounded
                        :aria-label="t('acessos.anotacao.removerAnexo')"
                        @click="removeAnexo(index)"
                      />
                    </div>

                    <div class="atd-anexo-list__type">
                      <label :for="`anexo-tipo-${index}`">{{
                        t('acessos.anotacao.tipoDocumento')
                      }}</label>
                      <Select
                        :id="`anexo-tipo-${index}`"
                        v-model="anexo.tipoDocumento"
                        class="atd-anexo-list__select"
                        :options="tiposDocumentoOptions"
                        option-label="label"
                        option-value="value"
                        :placeholder="t('acessos.anotacao.tipoDocumentoPlaceholder')"
                        show-clear
                        size="small"
                      />
                    </div>
                  </li>
                </ul>

                <label v-if="anexosForm.length < MAX_ANEXOS" class="atd-file-cta">
                  <input
                    ref="fileInput"
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                    @change="onAnexosSelected"
                  />
                  <i class="pi pi-paperclip" aria-hidden="true" />
                  {{ t('acessos.anotacao.adicionarAnexo') }}
                </label>
                <small class="atd-file-hint">
                  {{ t('acessos.anotacao.anexoHint') }}
                </small>
              </div>
            </div>

            <footer class="atd-composer__footer">
              <Button
                :label="t('acessos.anotacao.enviar')"
                icon="pi pi-check"
                :loading="submittingAnotacao"
                @click="submitAnotacao"
              />
            </footer>
          </aside>
        </div>
      </div>
    </template>
  </PartnerPageFrame>
</template>

<style scoped>
.atd-hero {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.85rem 1.5rem;
  padding: 1.1rem 1.2rem;
  border: 1px solid color-mix(in srgb, var(--partner-primary) 22%, var(--partner-line));
  border-radius: 1.1rem;
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--partner-primary-soft) 35%, var(--partner-card)),
    var(--partner-card) 62%
  );
}

.atd-hero[data-status='EXPIRADO'],
.atd-hero[data-status='REVOGADO'] {
  border-color: var(--partner-line);
  background: var(--partner-surface);
}

.atd-hero__pet {
  display: flex;
  flex: 1 1 22rem;
  align-items: flex-start;
  gap: 0.95rem;
  min-width: 0;
}

.atd-hero__foto {
  width: 4.35rem;
  height: 4.35rem;
  flex: 0 0 auto;
  border-radius: 1.1rem;
  object-fit: cover;
}

.atd-hero__foto--empty {
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--partner-primary) 16%, var(--partner-card));
  color: var(--partner-primary-strong);
  font-size: 1.35rem;
}

.atd-hero__identity {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
  flex: 1;
}

.atd-hero__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.55rem 0.7rem;
}

.atd-hero__title-row strong {
  color: var(--partner-text);
  font-size: 1.3rem;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.atd-hero__subtitle {
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.88rem;
  line-height: 1.35;
}

.atd-hero__tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.2rem;
}

.atd-hero__tag {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 1.7rem;
  padding: 0.28rem 0.65rem;
  border: 1px solid transparent;
  border-radius: 999px;
  font-size: 0.76rem;
  font-weight: 700;
  line-height: 1.2;
}

.atd-hero__tag i {
  font-size: 0.72rem;
}

.atd-hero__tag--service {
  border-color: color-mix(in srgb, var(--partner-primary) 22%, var(--partner-line));
  background: color-mix(in srgb, var(--partner-primary) 14%, var(--partner-card));
  color: var(--partner-primary-strong);
}

.atd-hero__tag--expiry {
  border-color: color-mix(in srgb, var(--partner-amber-text) 28%, var(--partner-line));
  background: color-mix(in srgb, var(--partner-amber-bg) 70%, var(--partner-card));
  color: var(--partner-amber-text);
}

.atd-hero__facts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0;
}

.atd-hero__fact {
  min-width: 7.5rem;
  padding: 0.6rem 0.9rem;
  border: 1px solid var(--partner-line);
  border-radius: 0.9rem;
  background: color-mix(in srgb, var(--partner-card) 82%, transparent);
}

.atd-hero__fact dt {
  color: var(--partner-faint);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.atd-hero__fact dd {
  margin: 0.1rem 0 0;
  color: var(--partner-text);
  font-size: 1.25rem;
  font-weight: 750;
  letter-spacing: -0.02em;
  line-height: 1.15;
}

.atd-closed {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.75rem;
  padding: 0.95rem 1.1rem;
  border: 1px solid var(--partner-line);
  border-radius: 0.95rem;
  background: var(--partner-surface);
  color: var(--partner-muted);
}

.atd-closed i {
  margin-top: 0.15rem;
}

.atd-closed strong {
  display: block;
  margin-bottom: 0.2rem;
  color: var(--partner-text);
  font-size: 0.9rem;
}

.atd-closed p {
  margin: 0;
  font-size: 0.86rem;
  line-height: 1.5;
}

.atd-panel {
  display: grid;
  gap: 1rem;
  grid-template-columns: minmax(0, 1fr);
}

.atd-resumo {
  gap: 1.15rem;
}

/* Um recado só ocupa a linha inteira; recado + observações dividem a largura. */
.atd-resumo__context {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fit, minmax(24rem, 1fr));
  align-items: start;
}

.atd-callout {
  display: grid;
  gap: 0.55rem;
  min-width: 0;
  padding: 0.95rem 1.05rem;
  border: 1px solid color-mix(in srgb, var(--partner-primary) 18%, var(--partner-line));
  border-radius: 1rem;
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--partner-primary-soft) 28%, var(--partner-card)),
    var(--partner-card) 70%
  );
}

.atd-callout--soft {
  border-color: var(--partner-line);
  background: var(--partner-card);
}

.atd-callout__head {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}

.atd-callout__icon {
  display: grid;
  width: 1.85rem;
  height: 1.85rem;
  place-items: center;
  border-radius: 0.65rem;
  background: color-mix(in srgb, var(--partner-primary) 16%, transparent);
  color: var(--partner-primary-strong);
  font-size: 0.85rem;
}

.atd-callout h3 {
  margin: 0;
  color: var(--partner-text);
  font-size: 0.84rem;
  font-weight: 750;
}

.atd-callout p {
  margin: 0;
  color: var(--partner-text);
  font-size: 0.95rem;
  font-weight: 500;
  line-height: 1.55;
  white-space: pre-line;
}

.atd-clinical {
  display: grid;
  gap: 0.75rem;
}

.atd-clinical__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.65rem;
  padding-bottom: 0.55rem;
  border-bottom: 1px solid color-mix(in srgb, var(--partner-line) 85%, transparent);
}

.atd-clinical__head h2 {
  margin: 0;
  color: var(--partner-text);
  font-size: 1rem;
  font-weight: 750;
  letter-spacing: -0.02em;
}

.atd-clinical__head p {
  margin: 0.2rem 0 0;
  color: var(--partner-muted);
  font-size: 0.82rem;
  line-height: 1.4;
}

.atd-clinical__count {
  display: inline-flex;
  align-items: center;
  min-height: 1.7rem;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--partner-primary) 14%, transparent);
  color: var(--partner-primary-strong);
  font-size: 0.72rem;
  font-weight: 750;
}

/* Cinco listas empilhadas viravam uma página só de rolagem: em telas largas elas
   dividem a largura, e a lista crítica (alergias) fica sozinha na primeira linha. */
.atd-folds {
  display: grid;
  gap: 0.55rem;
  align-items: start;
}

@media (min-width: 1100px) {
  .atd-folds {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .atd-fold[data-tone='warm'] {
    grid-column: 1 / -1;
  }
}

.atd-fold {
  border: 1px solid var(--partner-line);
  border-radius: 1rem;
  background: var(--partner-card);
  overflow: clip;
}

.atd-fold[data-tone='warm'] {
  border-color: color-mix(in srgb, var(--partner-warm-text) 28%, var(--partner-line));
}

.atd-fold[data-open='true'] {
  box-shadow: 0 10px 24px rgb(var(--partner-shadow-rgb) / 0.04);
}

.atd-fold__heading {
  margin: 0;
}

/* Gatilho de seção recolhível: Button com slot, sem o visual de CTA do preset. */
.atd-fold__trigger.p-button {
  justify-content: flex-start;
  width: 100%;
  gap: 0.75rem;
  padding: 0.85rem 0.95rem;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: inherit;
  font-size: inherit;
  text-align: start;
}

.atd-fold__trigger.p-button:not(:disabled):hover,
.atd-fold__trigger.p-button:not(:disabled):active,
.atd-fold__trigger.p-button:focus-visible {
  border: 0;
  background: color-mix(in srgb, var(--partner-surface) 70%, transparent);
  color: inherit;
  outline: none;
}

.atd-fold__trigger.p-button:focus-visible {
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--partner-primary) 45%, transparent);
}

.atd-fold__icon {
  display: grid;
  width: 2.2rem;
  height: 2.2rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.7rem;
  background: color-mix(in srgb, var(--partner-primary) 16%, transparent);
  color: var(--partner-primary-strong);
  font-size: 0.9rem;
}

.atd-fold[data-tone='warm'] .atd-fold__icon {
  background: color-mix(in srgb, var(--partner-warm-text) 16%, transparent);
  color: var(--partner-warm-text);
}

.atd-fold__copy {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
  flex: 1;
}

.atd-fold__copy strong {
  color: var(--partner-text);
  font-size: 0.92rem;
  font-weight: 750;
  letter-spacing: -0.01em;
}

.atd-fold__copy small {
  color: var(--partner-faint);
  font-size: 0.74rem;
  font-weight: 600;
}

.atd-fold__chevron {
  color: var(--partner-faint);
  font-size: 0.78rem;
}

.atd-fold__body {
  padding-block: 0 0.75rem;
  padding-inline: 0.85rem 0.55rem;
}

.atd-fold__scroll {
  max-height: min(14.5rem, 42vh);
  overflow-x: hidden;
  overflow-y: auto;
  padding-block: 0.1rem 0.15rem;
  padding-inline: 0 0.45rem;
  border-radius: 0.75rem;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--partner-primary) 42%, transparent) transparent;
}

.atd-fold__scroll:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--partner-primary) 45%, transparent);
  outline-offset: 2px;
}

.atd-fold__scroll::-webkit-scrollbar {
  width: 0.4rem;
}

.atd-fold__scroll::-webkit-scrollbar-track {
  margin: 0.2rem 0;
  background: transparent;
}

.atd-fold__scroll::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: color-mix(in srgb, var(--partner-primary) 38%, var(--partner-line));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--partner-card) 55%, transparent);
}

.atd-fold__scroll::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--partner-primary-strong) 55%, var(--partner-line));
}

.atd-fold__scroll::-webkit-scrollbar-corner {
  background: transparent;
}

.atd-items {
  display: grid;
  gap: 0.4rem;
  grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Alergia tem texto mais longo e ocupa a linha inteira: menos colunas, mais leitura. */
.atd-fold[data-tone='warm'] .atd-items {
  grid-template-columns: repeat(auto-fit, minmax(21rem, 1fr));
}

.atd-items li {
  display: grid;
  gap: 0.28rem;
  align-content: start;
  padding: 0.65rem 0.75rem;
  border: 1px solid color-mix(in srgb, var(--partner-line) 90%, transparent);
  border-radius: 0.8rem;
  background: color-mix(in srgb, var(--partner-surface) 72%, var(--partner-card));
}

.atd-items strong {
  color: var(--partner-text);
  font-size: 0.86rem;
  font-weight: 700;
  line-height: 1.3;
}

.atd-item__meta {
  display: inline-flex;
  width: fit-content;
  max-width: 100%;
  padding: 0.18rem 0.45rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--partner-primary) 12%, transparent);
  color: var(--partner-muted);
  font-size: 0.72rem;
  font-weight: 650;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.atd-item--destaque {
  border-color: color-mix(in srgb, var(--partner-warm-text) 35%, var(--partner-line));
  background: color-mix(in srgb, var(--partner-warm-bg) 55%, var(--partner-card));
}

.atd-item--destaque strong {
  color: var(--partner-warm-text);
}

.atd-item--destaque .atd-item__meta {
  background: color-mix(in srgb, var(--partner-warm-text) 14%, transparent);
  color: var(--partner-warm-text);
}

.atd-stamp {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--partner-line);
  border-radius: 0.8rem;
  background: color-mix(in srgb, var(--partner-surface) 70%, var(--partner-card));
  color: var(--partner-muted);
  font-size: 0.78rem;
  font-weight: 600;
}

.atd-stamp i {
  color: var(--partner-faint);
  font-size: 0.75rem;
}

/* Resumo mexido depois da entrega: o que o parceiro leu antes pode estar velho. */
.atd-stamp[data-atualizado='true'] {
  border-color: color-mix(in srgb, var(--partner-amber-text) 30%, var(--partner-line));
  background: color-mix(in srgb, var(--partner-amber-bg) 60%, var(--partner-card));
  color: var(--partner-amber-text);
}

.atd-stamp[data-atualizado='true'] i {
  color: inherit;
}

/* Bloco de categoria compartilhada que veio vazio: a frase é o conteúdo. */
.atd-bloco-vazio,
.atd-fold__vazio {
  margin: 0;
  padding: 0.7rem 0.85rem;
  border: 1px dashed color-mix(in srgb, var(--partner-line) 92%, transparent);
  border-radius: 0.8rem;
  background: color-mix(in srgb, var(--partner-surface) 55%, transparent);
  color: var(--partner-muted);
  font-size: 0.82rem;
  line-height: 1.45;
}

.atd-docs,
.atd-diario {
  display: grid;
  gap: 0.75rem;
}

.atd-docs__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.65rem;
  padding-bottom: 0.55rem;
  border-bottom: 1px solid color-mix(in srgb, var(--partner-line) 85%, transparent);
}

.atd-docs__head h2 {
  margin: 0;
  color: var(--partner-text);
  font-size: 1rem;
  font-weight: 750;
  letter-spacing: -0.02em;
}

.atd-docs__head p {
  margin: 0.2rem 0 0;
  color: var(--partner-muted);
  font-size: 0.82rem;
  line-height: 1.4;
}

.atd-docs__count {
  display: inline-flex;
  align-items: center;
  min-height: 1.7rem;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--partner-primary) 14%, transparent);
  color: var(--partner-primary-strong);
  font-size: 0.72rem;
  font-weight: 750;
}

.atd-docs__list {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.atd-doc {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem 0.75rem;
  padding: 0.75rem 0.85rem;
  border: 1px solid var(--partner-line);
  border-radius: 0.95rem;
  background: var(--partner-card);
}

.atd-doc__icon {
  display: grid;
  width: 2.2rem;
  height: 2.2rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.7rem;
  background: color-mix(in srgb, var(--partner-primary) 16%, transparent);
  color: var(--partner-primary-strong);
  font-size: 0.9rem;
}

.atd-doc__copy {
  display: grid;
  gap: 0.15rem;
  flex: 1 1 14rem;
  min-width: 0;
}

.atd-doc__copy strong {
  overflow: hidden;
  color: var(--partner-text);
  font-size: 0.9rem;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.atd-doc__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem 0.45rem;
  color: var(--partner-muted);
  font-size: 0.74rem;
  font-weight: 600;
}

.atd-doc__tipo {
  display: inline-flex;
  padding: 0.12rem 0.45rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--partner-primary) 12%, transparent);
  color: var(--partner-primary-strong);
}

.atd-doc__empty {
  margin: 0;
  color: var(--partner-faint);
  font-size: 0.76rem;
  font-weight: 600;
}

.atd-doc__files {
  display: grid;
  gap: 0.4rem;
  margin-block: 0;
  margin-inline: auto 0;
  padding: 0;
  list-style: none;
}

.atd-doc__files li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.4rem;
}

.atd-doc__file-label {
  margin-inline-end: 0.15rem;
  color: var(--partner-faint);
  font-size: 0.72rem;
  font-weight: 700;
}

.atd-trat__list,
.atd-diario__list {
  display: grid;
  gap: 0.55rem;
  grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
  margin: 0;
  padding: 0;
  list-style: none;
}

.atd-trat__entry,
.atd-diario__entry {
  display: grid;
  gap: 0.55rem;
  align-content: start;
  padding: 0.85rem 0.95rem;
  border: 1px solid var(--partner-line);
  border-radius: 0.95rem;
  background: var(--partner-card);
}

.atd-trat__head,
.atd-diario__head {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--partner-text);
  font-size: 0.86rem;
}

.atd-trat__head i,
.atd-diario__head i {
  color: var(--partner-primary-strong);
  font-size: 0.8rem;
}

.atd-trat__posologia {
  margin: 0;
  color: var(--partner-amber-text);
  font-size: 0.84rem;
  font-weight: 650;
}

.atd-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.atd-chip.p-button {
  padding: 0.3rem 0.65rem;
  border-color: var(--partner-line);
  background: var(--partner-card);
  color: var(--partner-muted);
  font-size: 0.76rem;
}

.atd-chip.p-button :deep(.p-button-label) {
  font-weight: 650;
}

.atd-chip.p-button:not(:disabled):hover {
  border-color: var(--partner-primary-strong);
  background: var(--partner-card);
  color: var(--partner-text);
}

.atd-chip--on.p-button,
.atd-chip--on.p-button:not(:disabled):hover {
  border-color: var(--partner-primary-strong);
  background: color-mix(in srgb, var(--partner-primary-strong) 12%, var(--partner-card));
  color: var(--partner-primary-strong);
}

.atd-chip.p-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.atd-diario__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.atd-diario__tag {
  display: inline-flex;
  padding: 0.18rem 0.5rem;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 650;
}

.atd-diario__tag--sintoma {
  background: color-mix(in srgb, var(--partner-warm-bg) 65%, var(--partner-card));
  color: var(--partner-warm-text);
}

.atd-diario__tag--doenca {
  background: color-mix(in srgb, var(--partner-amber-bg) 70%, var(--partner-card));
  color: var(--partner-amber-text);
}

.atd-trat__grid,
.atd-diario__grid {
  display: grid;
  gap: 0.35rem;
  grid-template-columns: repeat(auto-fit, minmax(7.5rem, 1fr));
  margin: 0;
}

.atd-trat__grid dt,
.atd-diario__grid dt {
  color: var(--partner-faint);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.atd-trat__grid dd,
.atd-diario__grid dd {
  margin: 0.1rem 0 0;
  color: var(--partner-text);
  font-size: 0.82rem;
  font-weight: 650;
}

.atd-trat__text span,
.atd-diario__text span {
  display: block;
  color: var(--partner-faint);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.atd-trat__text p,
.atd-diario__text p {
  margin: 0.15rem 0 0;
  color: var(--partner-text);
  font-size: 0.85rem;
  line-height: 1.5;
  white-space: pre-line;
}

.atd-diario__fotos {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  padding-top: 0.15rem;
  border-top: 1px solid color-mix(in srgb, var(--partner-line) 88%, transparent);
}

.atd-diario__fotos-label {
  color: var(--partner-faint);
  font-size: 0.72rem;
  font-weight: 700;
}

.atd-notes__layout {
  display: grid;
  gap: 1rem;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
}

.atd-notes__layout--with-form {
  grid-template-columns: minmax(0, 1.2fr) minmax(18rem, 0.85fr);
}

/* Prescrição e exames solicitados não cabem numa coluna de 18rem. */
.atd-notes__layout--structured {
  grid-template-columns: minmax(0, 1fr) minmax(23rem, 1fr);
}

/* Formulário por tipo passa da altura da viewport: preso no topo, o botão de
   registrar ficaria fora da tela. Aqui ele rola junto com a página. */
.atd-notes__layout--structured .atd-composer {
  position: static;
}

.atd-notes__feed,
.atd-composer {
  min-width: 0;
}

.atd-notes__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.65rem;
  margin-bottom: 0.85rem;
  padding-bottom: 0.65rem;
  border-bottom: 1px solid color-mix(in srgb, var(--partner-line) 85%, transparent);
}

.atd-notes__head h2 {
  margin: 0;
  color: var(--partner-text);
  font-size: 1rem;
  font-weight: 750;
  letter-spacing: -0.02em;
}

.atd-notes__head p {
  margin: 0.2rem 0 0;
  color: var(--partner-muted);
  font-size: 0.82rem;
  line-height: 1.4;
}

.atd-notes__count {
  display: inline-flex;
  align-items: center;
  min-height: 1.7rem;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--partner-primary) 14%, transparent);
  color: var(--partner-primary-strong);
  font-size: 0.72rem;
  font-weight: 750;
}

/* Vazio da página: serve tanto a aba de resumo quanto o feed de anotações. */
.atd-empty {
  display: grid;
  justify-items: center;
  gap: 0.4rem;
  padding: 2.2rem 1.25rem;
  border: 1px dashed color-mix(in srgb, var(--partner-primary) 28%, var(--partner-line));
  border-radius: 1.1rem;
  background: color-mix(in srgb, var(--partner-surface) 55%, var(--partner-card));
  text-align: center;
}

.atd-empty__icon {
  display: grid;
  width: 2.6rem;
  height: 2.6rem;
  margin-bottom: 0.25rem;
  place-items: center;
  border-radius: 0.85rem;
  background: color-mix(in srgb, var(--partner-primary) 16%, transparent);
  color: var(--partner-primary-strong);
  font-size: 1.05rem;
}

.atd-empty strong {
  color: var(--partner-text);
  font-size: 0.95rem;
}

.atd-empty p {
  margin: 0;
  max-width: 26rem;
  color: var(--partner-muted);
  font-size: 0.84rem;
  line-height: 1.45;
}

.atd-empty :deep(.p-button) {
  margin-top: 0.55rem;
}

.atd-timeline {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.atd-timeline__item {
  display: grid;
  grid-template-columns: 1.25rem minmax(0, 1fr);
  gap: 0.75rem;
  align-items: stretch;
}

.atd-timeline__rail {
  position: relative;
  display: flex;
  justify-content: center;
  padding-top: 1.15rem;
}

.atd-timeline__rail::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 2px;
  transform: translateX(-50%);
  background: color-mix(in srgb, var(--partner-primary) 22%, var(--partner-line));
}

.atd-timeline__item:first-child .atd-timeline__rail::before {
  top: 1.15rem;
}

.atd-timeline__item:last-child .atd-timeline__rail::before {
  bottom: calc(100% - 1.35rem);
}

.atd-timeline__dot {
  position: relative;
  z-index: 1;
  width: 0.7rem;
  height: 0.7rem;
  border: 2px solid var(--partner-card);
  border-radius: 999px;
  background: var(--partner-primary-strong);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--partner-primary) 28%, transparent);
}

.atd-note {
  display: grid;
  gap: 0.7rem;
  margin-bottom: 0.75rem;
  padding: 1rem 1.05rem 1.05rem;
  border: 1px solid var(--partner-line);
  border-radius: 1.05rem;
  background: linear-gradient(
    160deg,
    color-mix(in srgb, var(--partner-primary-soft) 18%, var(--partner-card)),
    var(--partner-card) 42%
  );
  box-shadow: 0 10px 22px rgb(var(--partner-shadow-rgb) / 0.04);
}

.atd-note__head {
  display: grid;
  gap: 0.4rem;
}

.atd-note__title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.45rem 0.75rem;
}

.atd-note__service {
  display: inline-flex;
  align-items: center;
  min-height: 1.7rem;
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--partner-primary) 16%, transparent);
  color: var(--partner-primary-strong);
  font-size: 0.78rem;
  font-weight: 750;
}

.atd-note__time {
  color: var(--partner-faint);
  font-size: 0.76rem;
  font-weight: 600;
  white-space: nowrap;
}

.atd-note__byline {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem 0.4rem;
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.78rem;
  font-weight: 600;
}

.atd-note__byline i {
  color: var(--partner-primary-strong);
  font-size: 0.72rem;
}

.atd-note__sep {
  color: var(--partner-faint);
}

.atd-note__body {
  margin: 0;
  color: var(--partner-text);
  font-size: 0.92rem;
  font-weight: 500;
  line-height: 1.55;
  white-space: pre-line;
}

.atd-note__files {
  display: grid;
  gap: 0.45rem;
  padding-top: 0.15rem;
  border-top: 1px solid color-mix(in srgb, var(--partner-line) 88%, transparent);
}

.atd-note__files-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  color: var(--partner-faint);
  font-size: 0.72rem;
  font-weight: 750;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.atd-note__files-label span {
  display: inline-flex;
  min-width: 1.2rem;
  justify-content: center;
  padding: 0.08rem 0.35rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--partner-primary) 14%, transparent);
  color: var(--partner-primary-strong);
  letter-spacing: 0;
  text-transform: none;
}

.atd-note__attachments {
  display: grid;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Anexo clicável: Button com slot (ícone + nome + tamanho), sem o visual de CTA do preset. */
.atd-note__file.p-button {
  justify-content: flex-start;
  width: 100%;
  gap: 0.65rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid color-mix(in srgb, var(--partner-line) 90%, transparent);
  border-radius: 0.8rem;
  background: color-mix(in srgb, var(--partner-surface) 70%, var(--partner-card));
  color: inherit;
  font-size: inherit;
  text-align: start;
  transition:
    border-color 150ms ease,
    background 150ms ease;
}

.atd-note__file.p-button:not(:disabled):hover,
.atd-note__file.p-button:not(:disabled):active,
.atd-note__file.p-button:focus-visible {
  border-color: color-mix(in srgb, var(--partner-primary) 36%, var(--partner-line));
  background: color-mix(in srgb, var(--partner-primary-soft) 22%, var(--partner-card));
  color: inherit;
  outline: none;
}

.atd-note__file.p-button:disabled {
  cursor: wait;
  opacity: 0.72;
}

.atd-note__file-icon {
  display: grid;
  width: 2rem;
  height: 2rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.65rem;
  background: color-mix(in srgb, var(--partner-primary) 16%, transparent);
  color: var(--partner-primary-strong);
  font-size: 0.85rem;
}

.atd-note__file-copy {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
  flex: 1;
}

.atd-note__file-copy strong {
  overflow: hidden;
  color: var(--partner-text);
  font-size: 0.82rem;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.atd-note__file-copy small {
  color: var(--partner-muted);
  font-size: 0.72rem;
}

.atd-note__file-go {
  color: var(--partner-faint);
  font-size: 0.72rem;
}

/* Mesma coluna do composer, tom neutro: é aviso de escopo, não de erro. */
.atd-readonly {
  display: flex;
  gap: 0.7rem;
  align-items: flex-start;
  padding: 0.95rem 1rem;
  border: 1px solid var(--partner-line);
  border-radius: 1rem;
  background: color-mix(in srgb, var(--partner-surface) 55%, var(--partner-card));
}

.atd-readonly i {
  margin-top: 0.1rem;
  color: var(--partner-muted);
}

.atd-readonly strong {
  display: block;
  margin-bottom: 0.2rem;
  font-size: 0.92rem;
}

.atd-readonly p {
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.86rem;
  line-height: 1.5;
}

.atd-composer {
  position: sticky;
  top: calc(var(--pj-shell-header-height, 4.25rem) + 1rem);
  display: grid;
  gap: 0.9rem;
  padding: 1.1rem 1.1rem 1.15rem;
  border: 1px solid color-mix(in srgb, var(--partner-primary) 20%, var(--partner-line));
  border-radius: 1.15rem;
  background: linear-gradient(
    165deg,
    color-mix(in srgb, var(--partner-primary-soft) 32%, var(--partner-card)),
    var(--partner-card) 48%
  );
  box-shadow: 0 14px 28px rgb(var(--partner-shadow-rgb) / 0.05);
}

.atd-composer__head {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.atd-composer__badge {
  display: grid;
  width: 2.35rem;
  height: 2.35rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.8rem;
  background: color-mix(in srgb, var(--partner-primary) 18%, transparent);
  color: var(--partner-primary-strong);
  font-size: 0.95rem;
}

.atd-composer__head h3 {
  margin: 0;
  color: var(--partner-text);
  font-size: 0.98rem;
  font-weight: 750;
  letter-spacing: -0.02em;
}

.atd-composer__head p {
  margin: 0.25rem 0 0;
  color: var(--partner-muted);
  font-size: 0.8rem;
  line-height: 1.4;
}

.atd-composer__error {
  margin: 0;
  padding: 0.7rem 0.85rem;
  border-radius: 0.75rem;
  background: var(--partner-warm-bg);
  color: var(--partner-warm-text);
  font-size: 0.82rem;
}

.atd-composer__fields {
  display: grid;
  gap: 0.8rem;
}

.atd-composer__footer :deep(.p-button) {
  width: 100%;
}

.atd-field {
  display: grid;
  gap: 0.35rem;
}

.atd-field label,
.atd-field__label {
  color: var(--partner-text);
  font-size: 0.78rem;
  font-weight: 700;
}

.atd-anexo-list {
  display: grid;
  gap: 0.45rem;
  grid-template-columns: minmax(0, 1fr);
  margin: 0;
  padding: 0;
  list-style: none;
}

.atd-anexo-list li {
  display: grid;
  gap: 0.55rem;
  padding: 0.7rem 0.75rem;
  border: 1px solid var(--partner-line);
  border-radius: 0.85rem;
  background: var(--partner-card);
}

.atd-anexo-list__top {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
}

.atd-anexo-list__info {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
  color: var(--partner-text);
  font-size: 0.8rem;
}

.atd-anexo-list__info span {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 650;
}

.atd-anexo-list__info small {
  color: var(--partner-muted);
  font-weight: 600;
  white-space: nowrap;
}

.atd-anexo-list__type {
  display: grid;
  gap: 0.28rem;
}

.atd-anexo-list__type label {
  color: var(--partner-muted);
  font-size: 0.72rem;
  font-weight: 700;
}

.atd-anexo-list__select {
  width: 100%;
}

.atd-anexo-list__type :deep(.atd-anexo-list__select.p-select) {
  width: 100%;
  border-color: color-mix(in srgb, var(--partner-primary) 22%, var(--partner-line));
  background: color-mix(in srgb, var(--partner-surface) 70%, var(--partner-card));
}

.atd-anexo-list__type :deep(.atd-anexo-list__select .p-select-label) {
  color: var(--partner-text);
  font-size: 0.82rem;
  font-weight: 600;
}

.atd-anexo-list__type :deep(.atd-anexo-list__select .p-select-label.p-placeholder) {
  color: var(--partner-muted);
  font-weight: 500;
}

.atd-anexo-list__type :deep(.atd-anexo-list__select .p-select-dropdown) {
  color: var(--partner-primary-strong);
}

.atd-file-cta {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  justify-self: start;
  padding: 0.5rem 0.85rem;
  border: 1px dashed color-mix(in srgb, var(--partner-primary) 45%, var(--partner-line));
  border-radius: 0.75rem;
  color: var(--partner-primary-strong);
  font-size: 0.8rem;
  font-weight: 650;
  cursor: pointer;
}

.atd-file-cta input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.atd-file-cta:hover {
  background: color-mix(in srgb, var(--partner-primary-soft) 28%, transparent);
}

.atd-file-cta:focus-within {
  outline: 2px solid var(--partner-primary);
  outline-offset: 2px;
}

.atd-file-hint {
  color: var(--partner-faint);
  font-size: 0.72rem;
  line-height: 1.4;
}

@media (max-width: 1180px) {
  .atd-notes__layout--structured {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 960px) {
  .atd-notes__layout--with-form {
    grid-template-columns: minmax(0, 1fr);
  }

  .atd-composer {
    position: static;
    order: -1;
  }

  .atd-notes__layout--with-form {
    display: flex;
    flex-direction: column;
  }
}

@media (max-width: 640px) {
  .atd-hero__facts,
  .atd-hero__fact {
    flex: 1 1 auto;
    width: 100%;
  }
}
</style>
