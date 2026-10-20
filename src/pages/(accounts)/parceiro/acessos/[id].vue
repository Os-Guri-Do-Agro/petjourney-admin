<script setup lang="ts">
/**
 * O acesso — o que o responsável compartilhou e a anotação que volta para o prontuário do pet.
 *
 * ## A forma (redesenho total, 19/10/2026)
 *
 * É a irmã leve do prontuário da Clínica, e se organiza em torno de três perguntas:
 *
 * 1. **Com quem e até quando** — a capa do pet (rosto, nome, espécie, castrado, o serviço do
 *    acesso) com dois números à direita: o peso e o **prazo do acesso**, em contagem regressiva
 *    com a barra que esvazia, em âmbar quando falta menos de um dia. Encerrado, o prazo vira o
 *    desfecho (expirado ou revogado) e a faixa embaixo explica o que sobrou.
 * 2. **O que o responsável trouxe** — à esquerda: a mensagem dele como citação, as observações,
 *    o tratamento contínuo, os dados clínicos (uma linha por categoria, que abre), os documentos
 *    e o diário. Contexto para ler antes e durante.
 * 3. **O que eu registro** — à direita: a folha da anotação, com os campos do serviço, a
 *    prescrição em linhas e "Ler receita com IA" à vista no alto dela, quem atendeu e os anexos;
 *    "Registrar anotação" é a única ação cheia, num rodapé preso à tela. Embaixo, o histórico de
 *    anotações da empresa.
 *
 * Em largura estreita as duas colunas viram uma, com "Resumo do pet | Anotações" num controle
 * segmentado (`?aba=anotacoes` continua valendo). Encerrado não tem formulário nem resumo: fica o
 * histórico, com a explicação do encerramento em cima.
 */
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import { PhHeart, PhQuotes } from '@phosphor-icons/vue'
import { useToast } from 'primevue/usetoast'
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import AnotacaoEstruturadaFields from '@/components/parceiro/AnotacaoEstruturadaFields.vue'
import AnotacaoEstruturadaView from '@/components/parceiro/AnotacaoEstruturadaView.vue'
import LerReceitaComIA from '@/components/parceiro/LerReceitaComIA.vue'
import UiPagina from '@/components/ui/UiPagina.vue'
import UiSecao from '@/components/ui/UiSecao.vue'
import { useAgora } from '@/composables/useAgora'
import { useLeituraReceitaParceiro } from '@/composables/useLeituraReceitaParceiro'
import { useRevalidarAoVoltar } from '@/composables/useRevalidarAoVoltar'
import { isGuidanceVisible } from '@/composables/useLayoutPreferences'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { usePartnerTabs } from '@/composables/usePartnerTabs'
import type { PetSpecies } from '@/features/clinico/data/types'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
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
  TipoServicoPrestador,
} from '@/service/parceiro/types'
import { calcularTempoRestante, parseInstante } from '@/utils/format/expiracao'
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
/** O envio barrou por falta de serviço ou texto: o campo vazio ganha a borda de erro. */
const faltaObrigatorio = computed(
  () => formError.value !== '' && formError.value === t('acessos.anotacao.camposObrigatorios'),
)

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

/** O controle segmentado não deixa ficar sem escolha, mas o evento ainda pode vir vazio. */
function escolherAba(valor: unknown) {
  if (valor === 'resumo' || valor === 'anotacoes') {
    setTab(valor as DetalheTab)
  }
}

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

/**
 * Só a mensagem, nenhum dado clínico: a coluna diz isso em uma linha, para ninguém procurar a
 * alergia que não veio.
 */
const semDadosClinicos = computed(
  () =>
    !resumoVazio.value &&
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

// ------------------------------------------------------------------ a capa: quem é e até quando

/** A silhueta do avatar: só cão e gato têm desenho, o resto fica nas iniciais. */
const ESPECIE_DO_AVATAR: Partial<Record<string, PetSpecies>> = {
  CACHORRO: 'canina',
  GATO: 'felina',
  AVE: 'ave',
  ROEDOR: 'roedor',
  REPTIL: 'reptil',
}

const ICONE_DO_SERVICO: Record<TipoServicoPrestador, string> = {
  CONSULTA: 'ph ph-stethoscope',
  EXAME: 'ph ph-microscope',
  BANHO: 'ph ph-drop',
  TOSA: 'ph ph-scissors',
  HOTEL: 'ph ph-bed',
  OUTRO: 'ph ph-paw-print',
}

const iniciaisDoPet = computed(() =>
  (detalhe.value?.petNome ?? '').trim().slice(0, 2).toLocaleUpperCase(),
)

const especieDoAvatar = computed(() =>
  detalhe.value ? (ESPECIE_DO_AVATAR[detalhe.value.especie] ?? null) : null,
)

const iconeDoServico = computed(() =>
  detalhe.value ? (ICONE_DO_SERVICO[detalhe.value.tipoServico] ?? 'ph ph-paw-print') : '',
)

/** "Cachorro · Castrado": castrado só enquanto o acesso vive (o encerrado não traz o dado). */
const metaDoPet = computed(() => {
  if (!detalhe.value) {
    return ''
  }

  const castrado =
    isAtivo.value && detalhe.value.petCastrado != null
      ? detalhe.value.petCastrado
        ? t('acessos.pet.castrado')
        : t('acessos.pet.naoCastrado')
      : ''

  return [detalhe.value.especieLabel, castrado].filter(Boolean).join(' · ')
})

/** A contagem regressiva do acesso, curta: "3d 4h", "5h 12min", "40min". */
const prazoCurto = computed(() => {
  if (!detalhe.value) {
    return ''
  }

  const restante = calcularTempoRestante(detalhe.value.expiraEm, agora.value)

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
})

/** Menos de um dia: o prazo fica âmbar, como na lista. */
const prazoPerto = computed(
  () =>
    isAtivo.value &&
    Boolean(detalhe.value) &&
    calcularTempoRestante(detalhe.value!.expiraEm, agora.value).estado !== 'dias',
)

/** Quanto da janela do acesso ainda resta, de 0 a 1: a barra que esvazia embaixo do número. */
const fracaoRestante = computed(() => {
  if (!detalhe.value) {
    return 0
  }

  const fim = parseInstante(detalhe.value.expiraEm)
  const total = fim - parseInstante(detalhe.value.criadoEm || detalhe.value.vinculadoEm)

  return total > 0 ? Math.min(1, Math.max(0, (fim - agora.value) / total)) : 0
})

/** "23 de out., 01:40". */
function dataEHora(value: string) {
  const data = new Date(parseInstante(value))

  return Number.isNaN(data.getTime())
    ? ''
    : new Intl.DateTimeFormat(INTL_LOCALE[locale.value as Locale], {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(data)
}

/** "anteontem", "há 3 dias" — o `Intl` traduz sem chave nenhuma. */
function haQuantoTempo(value: string) {
  const diff = agora.value - parseInstante(value)

  if (Number.isNaN(diff)) {
    return ''
  }

  const relativo = new Intl.RelativeTimeFormat(INTL_LOCALE[locale.value as Locale], {
    numeric: 'auto',
  })
  const minutos = Math.max(0, Math.floor(diff / 60_000))

  if (minutos < 60) {
    return relativo.format(-Math.max(1, minutos), 'minute')
  }

  const horas = Math.floor(minutos / 60)

  return horas < 24
    ? relativo.format(-horas, 'hour')
    : relativo.format(-Math.floor(horas / 24), 'day')
}

/** Quando o acesso acabou: a revogação tem data própria; o expirado acaba no prazo. */
const encerradoEm = computed(() =>
  detalhe.value ? (detalhe.value.revogadoEm ?? detalhe.value.expiraEm) : '',
)

/**
 * Cadastro que não opera (em análise, recusado ou suspenso): o acesso continua legível — foi
 * consentido pelo responsável —, mas a anotação fica bloqueada. A faixa diz por quê.
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
  <UiPagina
    class="tela-acesso"
    :titulo="detalhe?.petNome ?? t('acessos.detalhe.title')"
    :carregando="loading"
    :erro="error"
    :sem-acesso-de-parceiro="store.semAcessoParceiro"
    guia
    @tentar-de-novo="loadDetalhe()"
  >
    <template #voltar>
      <RouterLink to="/parceiro/acessos" class="voltar">
        <i class="ph ph-arrow-left" aria-hidden="true" />
        {{ t('acessos.title') }}
      </RouterLink>
    </template>

    <!-- A capa do pet: o pet é o título desta tela, e o prazo do acesso mora ao lado do nome. -->
    <template #cabecalho>
      <div v-if="detalhe" class="capa" :data-status="detalhe.status">
        <div class="capa__quem">
          <PetAvatar
            class="capa__rosto"
            :nome="detalhe.petNome"
            :iniciais="iniciaisDoPet"
            :especie="especieDoAvatar"
            :foto-url="detalhe.petFoto ?? ''"
            tamanho="xl"
          />
          <div class="capa__identidade">
            <h1 class="capa__nome">{{ detalhe.petNome }}</h1>
            <p v-if="metaDoPet" class="capa__meta">{{ metaDoPet }}</p>
            <p class="capa__selos">
              <span class="ui-selo ui-selo--lugar">
                <i :class="iconeDoServico" aria-hidden="true" />
                {{ servicoLabel }}
              </span>
            </p>
          </div>
        </div>

        <dl class="capa__dados" :aria-label="t('acessos.detalhe.metaAria')">
          <div v-if="pesoKg != null" class="capa__dado">
            <dt>{{ t('acessos.snapshot.peso') }}</dt>
            <dd class="capa__numero">
              <strong class="ui-num">{{ pesoKgLegivel }}</strong>
              <span>kg</span>
            </dd>
          </div>

          <div
            v-if="isAtivo"
            class="capa__dado capa__prazo"
            :class="{ 'capa__prazo--perto': prazoPerto }"
          >
            <dt>{{ t('acessos.detalhe.prazo.ativo') }}</dt>
            <dd>
              <strong class="capa__contagem ui-num">
                <i v-if="prazoPerto" class="ph ph-alarm" aria-hidden="true" />
                {{ prazoCurto }}
              </strong>
              <span class="capa__barra" aria-hidden="true">
                <span :style="{ inlineSize: `${fracaoRestante * 100}%` }" />
              </span>
              <small class="ui-num">
                {{ t('acessos.detalhe.prazo.ate', { data: dataEHora(detalhe.expiraEm) }) }}
              </small>
              <small>
                {{ t('acessos.detalhe.prazo.vinculado', { quando: haQuantoTempo(detalhe.vinculadoEm) }) }}
              </small>
              <span v-if="prazoPerto" class="sr-only">{{ t('acessos.grupo.venceLogo') }}</span>
            </dd>
          </div>

          <div v-else class="capa__dado capa__prazo capa__prazo--fim">
            <dt>{{ t('acessos.detalhe.prazo.encerrado') }}</dt>
            <dd>
              <strong class="capa__desfecho">{{ t(`acessos.list.status.${detalhe.status}`) }}</strong>
              <small class="ui-num">{{ dataEHora(encerradoEm) }}</small>
            </dd>
          </div>
        </dl>
      </div>

      <h1 v-else class="capa__reserva">{{ t('acessos.detalhe.title') }}</h1>
    </template>

    <div v-if="detalhe" class="acesso">
      <!-- Leitura do prontuário não é gated por auditoria (seção 4): o acesso foi consentido
           pelo responsável. Suspenso lê tudo e perde só a anotação, que é mutação. -->
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
        <RouterLink class="faixa__link ui-mais" to="/settings?aba=empresa">
          {{ t(`frame.operability.${avisoDoCadastro}.link`) }}
        </RouterLink>
      </section>

      <!-- Encerrado: sem formulário e sem resumo. O que aconteceu e o que sobrou. -->
      <section v-if="!isAtivo" class="faixa faixa--encerrado" role="status">
        <span class="faixa__icone" aria-hidden="true">
          <i :class="detalhe.status === 'REVOGADO' ? 'ph ph-prohibit' : 'ph ph-hourglass-low'" />
        </span>
        <span class="faixa__texto">
          <strong>{{ t('acessos.encerrado.title') }}</strong>
          <span>
            {{
              detalhe.status === 'REVOGADO'
                ? t('acessos.encerrado.revogado')
                : t('acessos.encerrado.expirado')
            }}
          </span>
        </span>
      </section>

      <div class="mesa" :data-aba="displayTab" :data-ficha="isAtivo ? 'sim' : 'nao'">
        <SelectButton
          v-if="isAtivo"
          class="mesa__abas"
          :model-value="displayTab"
          :options="tabs"
          option-label="label"
          option-value="id"
          :allow-empty="false"
          :aria-label="tabsAriaLabel"
          @update:model-value="escolherAba"
        />

        <div class="mesa__grade">
          <!-- ------------------------------------------------ o que o responsável compartilhou -->
          <aside v-if="isAtivo" class="ficha" aria-labelledby="atd-ficha-titulo">
            <header class="coluna__cab">
              <h2 id="atd-ficha-titulo" class="coluna__titulo">
                {{ t('acessos.detalhe.tabs.resumo.label') }}
              </h2>
              <!-- O responsável mexeu no resumo depois de entregar: a leitura de ontem pode não
                   valer mais. -->
              <p
                v-if="carimbo"
                class="carimbo"
                :class="{ 'carimbo--atualizado': carimbo.atualizado }"
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

            <!-- A mensagem do responsável, como citação: é a primeira coisa a ler. -->
            <figure v-if="mensagemTutor" class="recado">
              <PhQuotes class="recado__aspas" weight="fill" aria-hidden="true" />
              <blockquote class="recado__texto">{{ mensagemTutor }}</blockquote>
              <figcaption class="recado__quem">
                <i class="ph ph-chat-circle-text" aria-hidden="true" />
                {{ t('acessos.detalhe.mensagemTutor') }}
              </figcaption>
            </figure>

            <section v-if="showObservacoesTutor" class="observacao">
              <h3 class="observacao__titulo">
                <i class="ph ph-info" aria-hidden="true" />
                {{ t('acessos.snapshot.observacoes') }}
              </h3>
              <p class="observacao__texto">{{ observacoesTutor }}</p>
            </section>

            <!-- Responsável pode liberar o acesso sem marcar nenhuma categoria: a ficha existe
                 e não tem o que mostrar. Explica o porquê e empurra para a ação útil. -->
            <section v-if="resumoVazio" class="vazio-ficha ui-folha">
              <span class="vazio-ficha__icone" aria-hidden="true">
                <i class="ph ph-lock-simple-open" />
              </span>
              <strong>{{ t('acessos.snapshot.emptyTitle') }}</strong>
              <p>{{ t('acessos.snapshot.emptyBody', { pet: detalhe.petNome }) }}</p>
              <Button
                v-if="podeAnotar"
                type="button"
                :label="t('acessos.snapshot.emptyCta')"
                icon="ph ph-pencil-simple"
                size="small"
                severity="secondary"
                outlined
                @click="irParaFolha"
              />
            </section>

            <p v-else-if="semDadosClinicos" class="sem-dados">
              <i class="ph ph-lock-simple" aria-hidden="true" />
              {{ t('acessos.detalhe.semDadosClinicos') }}
            </p>

            <!-- Tratamento contínuo (Parte 16), ACIMA das listas clínicas: é o remédio de todo
                 dia, e o item cuja falha tem dano imediato. -->
            <UiSecao
              v-if="tratamentosEstado !== 'OCULTO'"
              id="atd-trat"
              :titulo="t('acessos.tratamentos.title')"
              icone="ph ph-heartbeat"
              :contagem="tratamentosContinuos.length || null"
              :descricao="isGuidanceVisible ? t('acessos.tratamentos.lede') : undefined"
              folha
            >
              <p v-if="tratamentosVazioTexto" class="ui-vazio">{{ tratamentosVazioTexto }}</p>

              <ul v-else class="ui-lista">
                <li v-for="item in tratamentosContinuos" :key="item.key" class="trat">
                  <PhHeart class="trat__icone" weight="fill" aria-hidden="true" />
                  <div class="trat__corpo">
                    <strong class="trat__nome">{{ item.titulo }}</strong>
                    <p v-if="item.posologia" class="trat__posologia ui-num">{{ item.posologia }}</p>
                    <dl v-if="item.campos.length" class="pares">
                      <div v-for="campo in item.campos" :key="campo.chave">
                        <dt>{{ campo.label }}</dt>
                        <dd>{{ campo.valor }}</dd>
                      </div>
                    </dl>
                    <p v-if="item.observacoes" class="trat__obs">
                      <span>{{ t('acessos.tratamentos.campos.observacoes') }}:</span>
                      {{ item.observacoes }}
                    </p>
                  </div>
                </li>
              </ul>
            </UiSecao>

            <!-- Uma linha por categoria. Vazia: a frase do motivo é o conteúdo. Com itens:
                 recolhe e mostra os primeiros nomes, para ler sem abrir. -->
            <UiSecao
              v-if="snapshotListSections.length"
              id="atd-clinical"
              :titulo="t('acessos.snapshot.clinicalTitle')"
              icone="ph ph-first-aid-kit"
              folha
            >
              <ul class="ui-lista dobras">
                <li
                  v-for="section in snapshotListSections"
                  :key="section.id"
                  class="dobra"
                  :data-tone="section.tone"
                  :data-vazio="section.items.length ? 'false' : 'true'"
                >
                  <div v-if="!section.items.length" class="dobra__linha">
                    <span class="dobra__icone" aria-hidden="true"><i :class="section.icon" /></span>
                    <span class="dobra__texto">
                      <h3 class="dobra__titulo">{{ section.title }}</h3>
                      <span class="dobra__sub">{{ section.vazioTexto }}</span>
                    </span>
                  </div>

                  <template v-else>
                    <h3 class="dobra__cabeca">
                      <button
                        type="button"
                        class="dobra__linha dobra__botao"
                        :aria-expanded="isSectionOpen(section.id)"
                        :aria-controls="`atd-fold-${section.id}`"
                        @click="toggleSection(section.id)"
                      >
                        <span class="dobra__icone" aria-hidden="true">
                          <i :class="section.icon" />
                        </span>
                        <span class="dobra__texto">
                          <span class="dobra__titulo">
                            {{ section.title }}
                            <span class="ui-contagem">{{ section.items.length }}</span>
                          </span>
                          <span v-if="!isSectionOpen(section.id)" class="dobra__sub">
                            {{ section.resumo }}
                          </span>
                        </span>
                        <i
                          class="ph dobra__seta"
                          :class="isSectionOpen(section.id) ? 'ph-caret-up' : 'ph-caret-down'"
                          aria-hidden="true"
                        />
                      </button>
                    </h3>

                    <ul
                      v-show="isSectionOpen(section.id)"
                      :id="`atd-fold-${section.id}`"
                      class="dobra__itens"
                      :aria-label="
                        t(
                          'acessos.snapshot.itemsCount',
                          { n: section.items.length },
                          section.items.length,
                        )
                      "
                    >
                      <li
                        v-for="(item, index) in section.items"
                        :key="`${section.id}-${index}`"
                        :class="{ 'dobra__item--destaque': item.destaque }"
                      >
                        <strong>{{ item.titulo }}</strong>
                        <span v-if="item.detalhe">{{ item.detalhe }}</span>
                      </li>
                    </ul>
                  </template>
                </li>
              </ul>
            </UiSecao>

            <!-- Documentos liberados item a item: o snapshot traz ids do cofre, a URL de
                 leitura nasce no clique e vale por poucos minutos. -->
            <UiSecao
              v-if="documentosEstado !== 'OCULTO'"
              id="atd-docs"
              :titulo="t('acessos.documentos.title')"
              icone="ph ph-folder-simple"
              :contagem="documentos.length || null"
              :descricao="isGuidanceVisible ? t('acessos.documentos.lede') : undefined"
              folha
            >
              <p v-if="documentosVazioTexto" class="ui-vazio">{{ documentosVazioTexto }}</p>

              <ul v-else class="ui-lista">
                <li v-for="doc in documentos" :key="doc.key" class="doc">
                  <span class="doc__icone" aria-hidden="true"><i class="ph ph-file-text" /></span>

                  <span class="doc__texto">
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
                    <span v-if="!doc.arquivos.length" class="doc__sem">
                      {{ t('acessos.documentos.semArquivo') }}
                    </span>
                  </span>

                  <span v-if="doc.arquivos.length" class="doc__acoes">
                    <span
                      v-for="(arquivo, index) in doc.arquivos"
                      :key="arquivo.id"
                      class="doc__arquivo"
                    >
                      <span v-if="doc.arquivos.length > 1" class="doc__n ui-num">
                        {{ t('acessos.documentos.arquivoN', { n: index + 1 }) }}
                      </span>
                      <Button
                        type="button"
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
                        type="button"
                        icon="ph ph-download-simple"
                        severity="secondary"
                        outlined
                        size="small"
                        :loading="arquivoOcupado === `baixar:${arquivo.id}`"
                        :aria-label="`${t('acessos.documentos.baixar')}: ${doc.nome}`"
                        :title="t('acessos.documentos.baixar')"
                        @click="baixarArquivo(arquivo.id, arquivo.nome)"
                      />
                    </span>
                  </span>
                </li>
              </ul>
            </UiSecao>

            <!-- Diário: só os dias com anormalidade, dentro da janela liberada. -->
            <UiSecao
              v-if="diarioEstado !== 'OCULTO'"
              id="atd-diario"
              :titulo="t('acessos.diario.title')"
              icone="ph ph-notebook"
              :contagem="diario.length || null"
              :descricao="isGuidanceVisible ? t('acessos.diario.lede') : undefined"
              folha
            >
              <p v-if="diarioVazioTexto" class="ui-vazio">{{ diarioVazioTexto }}</p>

              <ol v-else class="ui-lista">
                <li v-for="entrada in diario" :key="entrada.key" class="dia">
                  <strong class="dia__data ui-num">{{ entrada.data }}</strong>

                  <div v-if="entrada.sintomas.length || entrada.doencas.length" class="dia__selos">
                    <span
                      v-for="(sintoma, index) in entrada.sintomas"
                      :key="`s-${index}`"
                      class="ui-selo ui-selo--atencao"
                    >
                      {{ sintoma }}
                    </span>
                    <span
                      v-for="(doenca, index) in entrada.doencas"
                      :key="`d-${index}`"
                      class="ui-selo ui-selo--risco"
                    >
                      {{ doenca }}
                    </span>
                  </div>

                  <dl v-if="entrada.campos.length" class="pares">
                    <div v-for="campo in entrada.campos" :key="campo.chave">
                      <dt>{{ campo.label }}</dt>
                      <dd>{{ campo.valor }}</dd>
                    </div>
                  </dl>

                  <p v-for="texto in entrada.textos" :key="texto.chave" class="dia__texto">
                    <span>{{ texto.label }}:</span> {{ texto.valor }}
                  </p>

                  <div v-if="entrada.fotoIds.length" class="dia__fotos">
                    <Button
                      v-for="(fotoId, index) in entrada.fotoIds"
                      :key="fotoId"
                      type="button"
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
            </UiSecao>
          </aside>

          <!-- ------------------------------------------------ a anotação e o histórico -->
          <div class="trabalho">
            <section v-if="somenteLeitura" class="faixa faixa--leitura" role="status">
              <span class="faixa__icone" aria-hidden="true"><i class="ph ph-eye" /></span>
              <span class="faixa__texto">
                <strong>{{ t('acessos.anotacao.somenteLeitura.title') }}</strong>
                <span>{{ t('acessos.anotacao.somenteLeitura.body') }}</span>
              </span>
            </section>

            <section v-if="podeAnotar" class="folha ui-folha" aria-labelledby="atd-folha-titulo">
              <header class="folha__cab">
                <h2 id="atd-folha-titulo" class="folha__titulo">
                  <i class="ph ph-note-pencil" aria-hidden="true" />
                  {{ t('acessos.anotacao.title') }}
                </h2>
                <p class="folha__lede">{{ t('acessos.anotacao.lede') }}</p>
              </header>

              <div class="folha__secao">
                <div class="campo">
                  <label for="anot-servico">
                    {{ t('acessos.anotacao.servico') }}
                    <span class="campo__obrigatorio" aria-hidden="true">*</span>
                  </label>
                  <InputText
                    id="anot-servico"
                    v-model="anotacaoForm.servicoRealizado"
                    :maxlength="LIMITES_CAMPOS_LIVRES.servicoRealizado"
                    :placeholder="t('acessos.anotacao.servicoPlaceholder')"
                    :invalid="faltaObrigatorio && !anotacaoForm.servicoRealizado.trim()"
                    aria-required="true"
                  />
                </div>

                <div class="campo">
                  <label for="anot-texto">
                    {{ t('acessos.anotacao.texto') }}
                    <span class="campo__obrigatorio" aria-hidden="true">*</span>
                  </label>
                  <Textarea
                    id="anot-texto"
                    v-model="anotacaoForm.texto"
                    rows="4"
                    auto-resize
                    :maxlength="LIMITES_CAMPOS_LIVRES.texto"
                    :placeholder="t('acessos.anotacao.textoPlaceholder')"
                    :invalid="faltaObrigatorio && !anotacaoForm.texto.trim()"
                    aria-required="true"
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
              <div class="folha__secao">
                <h3 class="folha__subtitulo">
                  <i class="ph ph-user-circle" aria-hidden="true" />
                  {{ t('acessos.anotacao.quemAtendeu') }}
                </h3>
                <div class="folha__duas">
                  <div class="campo">
                    <label for="anot-profissional">{{ t('acessos.anotacao.profissional') }}</label>
                    <InputText
                      id="anot-profissional"
                      v-model="anotacaoForm.profissionalNome"
                      :maxlength="LIMITES_CAMPOS_LIVRES.profissionalNome"
                      :placeholder="t('acessos.anotacao.profissionalPlaceholder')"
                    />
                  </div>

                  <div class="campo">
                    <label id="anot-especialidade-rotulo">
                      {{ t('acessos.anotacao.especialidade') }}
                    </label>
                    <Select
                      label-id="anot-especialidade"
                      aria-labelledby="anot-especialidade-rotulo"
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

                <div v-if="anotacaoForm.especialidade === ESPECIALIDADE_OUTRA" class="campo">
                  <InputText
                    v-model="anotacaoForm.especialidadeOutra"
                    :maxlength="LIMITES_CAMPOS_LIVRES.profissionalEspecialidade"
                    :placeholder="t('acessos.anotacao.especialidadeOutraPlaceholder')"
                    :aria-label="t('acessos.anotacao.especialidade')"
                    :disabled="submittingAnotacao"
                  />
                </div>
              </div>

              <div class="folha__secao">
                <div class="folha__secao-cab">
                  <h3 class="folha__subtitulo">
                    <i class="ph ph-paperclip" aria-hidden="true" />
                    {{ t('acessos.anotacao.anexos', { n: MAX_ANEXOS }) }}
                  </h3>
                  <label v-if="anexosOcupados < MAX_ANEXOS" class="anexar">
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

                <ul v-if="anexosForm.length" class="anexos">
                  <li v-for="(anexo, index) in anexosForm" :key="`${anexo.file.name}-${index}`">
                    <span class="anexos__icone" aria-hidden="true"><i class="ph ph-file" /></span>
                    <span class="anexos__nome">
                      <strong :title="anexo.file.name">{{ anexo.file.name }}</strong>
                      <small class="ui-num">{{ formatBytes(anexo.file.size) }}</small>
                    </span>
                    <label class="sr-only" :for="`anexo-tipo-${index}`">
                      {{ t('acessos.anotacao.tipoDocumento') }}
                    </label>
                    <Select
                      v-model="anexo.tipoDocumento"
                      class="anexos__tipo"
                      :label-id="`anexo-tipo-${index}`"
                      :aria-label="t('acessos.anotacao.tipoDocumento')"
                      :options="tiposDocumentoOptions"
                      option-label="label"
                      option-value="value"
                      :placeholder="t('acessos.anotacao.tipoDocumentoPlaceholder')"
                      show-clear
                    />
                    <Button
                      type="button"
                      icon="ph ph-trash"
                      severity="secondary"
                      text
                      rounded
                      class="anexos__remover"
                      :aria-label="t('acessos.anotacao.removerAnexo')"
                      :title="t('acessos.anotacao.removerAnexo')"
                      @click="removeAnexo(index)"
                    />
                  </li>
                </ul>

                <small v-if="leituraReceita.reservados > 0" class="folha__nota folha__nota--ia">
                  <i class="ph ph-sparkle" aria-hidden="true" />
                  {{
                    t(
                      'acessos.leituraReceita.anexosDaReceita',
                      { n: leituraReceita.reservados },
                      leituraReceita.reservados,
                    )
                  }}
                </small>
                <small class="folha__nota">{{ t('acessos.anotacao.anexoHint') }}</small>
              </div>

              <!-- Rodapé preso à tela enquanto a folha estiver nela: o erro aparece do lado do
                   botão que o causou, e não lá no topo, fora da vista de quem clicou. -->
              <footer class="folha__rodape">
                <p v-if="formError" class="folha__erro" role="alert">
                  <i class="ph ph-warning-circle" aria-hidden="true" />
                  {{ formError }}
                </p>
                <p v-else class="folha__dica">
                  <i class="ph ph-arrow-bend-down-right" aria-hidden="true" />
                  {{ t('acessos.anotacao.rodape', { pet: detalhe.petNome }) }}
                </p>
                <Button
                  type="button"
                  class="folha__enviar"
                  :label="t('acessos.anotacao.enviar')"
                  icon="ph ph-check"
                  :loading="submittingAnotacao"
                  @click="submitAnotacao"
                />
              </footer>
            </section>

            <UiSecao
              id="atd-notes"
              class="historico"
              :titulo="t('acessos.anotacoes.title')"
              icone="ph ph-clock-counter-clockwise"
              :contagem="anotacoesOrdenadas.length || null"
              :descricao="isGuidanceVisible ? t('acessos.anotacoes.lede') : undefined"
              folha
            >
              <div v-if="anotacoesOrdenadas.length === 0" class="ui-vazio">
                <strong>{{ t('acessos.anotacoes.empty') }}</strong>
                <span>
                  {{
                    podeAnotar
                      ? t('acessos.anotacoes.emptyHint')
                      : t('acessos.anotacoes.emptyHintClosed')
                  }}
                </span>
              </div>

              <ol v-else class="ui-lista">
                <li v-for="anotacao in anotacoesOrdenadas" :key="anotacao.id">
                  <article class="nota">
                    <header class="nota__cab">
                      <div class="nota__quem">
                        <h3 class="nota__servico">{{ anotacao.servicoRealizado }}</h3>
                        <p class="nota__autor">
                          <span>{{ anotacao.empresaNome }}</span>
                          <template v-if="autorDaAnotacao(anotacao)">
                            <span aria-hidden="true">·</span>
                            <span>{{ autorDaAnotacao(anotacao) }}</span>
                          </template>
                        </p>
                      </div>
                      <time class="nota__quando ui-num" :datetime="anotacao.criadaEm">{{
                        formatDateTime(anotacao.criadaEm)
                      }}</time>
                    </header>

                    <p class="nota__texto">{{ anotacao.texto }}</p>

                    <AnotacaoEstruturadaView :anotacao="anotacao" />

                    <ul
                      v-if="anotacao.anexos.length"
                      class="nota__anexos"
                      :aria-label="t('acessos.anotacoes.anexosLabel')"
                    >
                      <li v-for="anexo in anotacao.anexos" :key="anexo.id">
                        <button
                          type="button"
                          class="nota__anexo"
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
                          <span class="nota__anexo-nome">{{ anexo.nome }}</span>
                          <small class="ui-num">
                            <template v-if="anexo.tipoDocumento">
                              {{ anexo.tipoDocumento }} ·
                            </template>
                            {{ formatBytes(anexo.tamanhoBytes) }}
                          </small>
                        </button>
                      </li>
                    </ul>
                  </article>
                </li>
              </ol>
            </UiSecao>
          </div>
        </div>
      </div>
    </div>
  </UiPagina>
</template>

<style scoped>
/*
 * A tela escreve em 15 px, com campos generosos (44 px), como o prontuário da Clínica: é onde o
 * profissional registra o atendimento, e campo apertado é onde o dedo erra. Os tokens de cada
 * componente do PrimeVue são reescritos aqui; os botões secundários ganham as cores do Trilha.
 */
.tela-acesso {
  --p-inputtext-padding-y: 10px;
  --p-inputtext-padding-x: 12px;
  --p-textarea-padding-y: 10px;
  --p-textarea-padding-x: 12px;
  --p-select-padding-y: 10px;
  --p-select-padding-x: 12px;
  --p-button-outlined-secondary-border-color: var(--linha-forte);
  --p-button-outlined-secondary-color: var(--tinta);
  --p-button-outlined-secondary-hover-background: var(--superficie-2);
  --p-button-outlined-secondary-active-background: var(--superficie-3);
  --p-button-text-secondary-color: var(--tinta-2);
  --p-button-text-secondary-hover-background: var(--superficie-2);
  --p-button-text-secondary-active-background: var(--superficie-3);
}

.tela-acesso :deep(.p-inputtext),
.tela-acesso :deep(.p-textarea),
.tela-acesso :deep(.p-select-label),
.tela-acesso :deep(.p-inputnumber-input) {
  font-size: 15px;
  line-height: 1.45;
}

.tela-acesso :deep(.p-textarea) {
  line-height: 1.55;
}

/* O InputNumber nasce com a largura do atributo size do input interno e vazava da coluna. */
.tela-acesso :deep(.p-inputnumber) {
  display: flex;
  width: 100%;
}

.tela-acesso :deep(.p-inputnumber-input) {
  width: 100%;
  min-width: 0;
}

.sr-only {
  position: absolute;
  overflow: hidden;
  width: 1px;
  height: 1px;
  clip-path: inset(50%);
  white-space: nowrap;
}

.voltar .ph {
  font-size: 13px;
}

[dir='rtl'] .voltar .ph {
  scale: -1 1;
}

/* ------------------------------------------------------------------ a capa */

.capa {
  display: grid;
  min-width: 0;
  flex: 1 1 640px;
  align-items: center;
  gap: 18px 36px;
  grid-template-columns: minmax(0, 1fr) auto;
}

.capa__quem {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 18px;
}

.capa .capa__rosto {
  box-shadow:
    0 0 0 3px var(--fundo),
    0 0 0 4px var(--linha);
}

.capa[data-status='EXPIRADO'] .capa__rosto,
.capa[data-status='REVOGADO'] .capa__rosto {
  filter: grayscale(0.7);
  opacity: 0.85;
}

.capa__identidade {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.capa__nome {
  margin: 0;
  color: var(--tinta);
  font-size: 30px;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.15;
  overflow-wrap: anywhere;
}

.capa__meta {
  margin: 0;
  color: var(--tinta-2);
  font-size: 14.5px;
}

.capa__selos {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 4px 0 0;
}

.capa__selos .ui-selo {
  height: 26px;
  font-size: 13px;
}

.capa__reserva {
  margin: 0;
  color: var(--tinta);
  font-size: 30px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

/* O peso e o prazo: os dois números da capa, separados por um fio, como na ficha da Clínica. */
.capa__dados {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 12px 0;
  margin: 0;
}

.capa__dado {
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 4px;
  padding-inline: 24px;
  border-inline-start: 1px solid var(--linha);
}

.capa__dado dt {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 550;
}

.capa__dado dd {
  display: grid;
  min-width: 0;
  gap: 4px;
  margin: 0;
}

.capa__numero {
  display: flex !important;
  align-items: baseline;
  gap: 4px;
  color: var(--tinta-2);
  font-size: 14px;
}

.capa__numero strong,
.capa__contagem {
  color: var(--tinta);
  font-size: 28px;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.05;
}

.capa__contagem {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.capa__contagem i {
  font-size: 24px;
}

.capa__barra {
  display: block;
  overflow: hidden;
  width: 11rem;
  max-width: 100%;
  height: 6px;
  margin-block: 2px;
  border-radius: 999px;
  background: var(--superficie-3);
}

.capa__barra > span {
  display: block;
  height: 100%;
  min-inline-size: 4px;
  border-radius: inherit;
  background: var(--salvia);
}

.capa__prazo small {
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.35;
}

.capa__prazo--perto .capa__contagem,
.capa__prazo--perto dt {
  color: var(--atencao-tinta);
}

.capa__prazo--perto .capa__barra > span {
  background: var(--atencao);
}

.capa__desfecho {
  color: var(--tinta-2);
  font-size: 22px;
  font-weight: 600;
  line-height: 1.15;
}

/* ------------------------------------------------------------------ faixas */

.acesso {
  display: grid;
  gap: 18px;
}

.faixa {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
  padding: 12px 16px 12px 12px;
  border: 1px solid var(--faixa-linha, var(--linha));
  border-radius: 14px;
  background: var(--faixa-fundo, var(--superficie-2));
}

.faixa__icone {
  display: grid;
  width: 36px;
  height: 36px;
  flex: none;
  place-items: center;
  border-radius: 10px;
  background: var(--superficie);
  color: var(--faixa-tinta, var(--tinta-2));
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

.faixa__link.ui-mais {
  color: var(--faixa-tinta);
}

.faixa--atencao,
.faixa--leitura {
  --faixa-fundo: var(--atencao-fundo);
  --faixa-linha: color-mix(in oklab, var(--atencao) 40%, var(--linha));
  --faixa-tinta: var(--atencao-tinta);
}

.faixa--encerrado {
  --faixa-fundo: var(--neutro-fundo);
  --faixa-linha: var(--linha);
  --faixa-tinta: var(--neutro-tinta);

  max-width: 860px;
}

/* ------------------------------------------------------------------ a mesa */

/*
 * A ficha ao lado da folha: quem prescreve vê a alergia sem trocar de aba. A forma é decidida
 * pela largura da mesa (container), não da janela: a barra aberta ou fechada muda a conta.
 */
.mesa {
  display: grid;
  gap: 16px;
  container: mesa / inline-size;
}

.mesa__abas {
  display: none;
  justify-self: start;
}

.mesa__abas :deep(.p-togglebutton-content) {
  min-height: 38px;
  padding-inline: 16px;
  font-size: 14.5px;
}

.mesa__grade {
  display: grid;
  align-items: start;
  gap: 28px;
  grid-template-columns: minmax(320px, 400px) minmax(0, 1fr);
}

.mesa[data-ficha='nao'] .mesa__grade {
  max-width: 860px;
  grid-template-columns: minmax(0, 1fr);
}

@container mesa (max-width: 960px) {
  .mesa__abas {
    display: inline-flex;
  }

  .mesa__grade {
    grid-template-columns: minmax(0, 1fr);
  }

  .mesa[data-aba='resumo'] .trabalho,
  .mesa[data-aba='anotacoes'] .ficha {
    display: none;
  }
}

/* ------------------------------------------------------------------ o que foi compartilhado */

.ficha {
  display: grid;
  min-width: 0;
  gap: 22px;
}

.coluna__cab {
  display: grid;
  gap: 6px;
}

.coluna__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.carimbo {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.4;
}

.carimbo i {
  margin-top: 1px;
  font-size: 15px;
}

.carimbo--atualizado {
  justify-self: start;
  padding: 5px 10px;
  border-radius: 8px;
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
  font-weight: 550;
}

/* A mensagem do responsável, como citação: aspas grandes na cor do lugar, texto em corpo de leitura. */
.recado {
  position: relative;
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 18px 20px 16px 52px;
  border: 1px solid color-mix(in oklab, var(--pj-lugar) 28%, var(--linha));
  border-radius: 16px;
  background: color-mix(in oklab, var(--pj-lugar-fundo) 70%, var(--superficie));
}

.recado__aspas {
  position: absolute;
  top: 18px;
  left: 18px;
  width: 22px;
  height: 22px;
  color: var(--pj-lugar);
}

[dir='rtl'] .recado {
  padding: 18px 52px 16px 20px;
}

[dir='rtl'] .recado__aspas {
  right: 18px;
  left: auto;
  scale: -1 1;
}

.recado__texto {
  margin: 0;
  color: var(--tinta);
  font-size: 16px;
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.recado__quem {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--pj-lugar-tinta);
  font-size: 13px;
  font-weight: 550;
}

.observacao {
  display: grid;
  gap: 4px;
  padding: 12px 16px;
  border-inline-start: 3px solid var(--linha-forte);
}

.observacao__titulo {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 550;
}

.observacao__texto {
  margin: 0;
  color: var(--tinta);
  font-size: 14.5px;
  line-height: 1.5;
}

.sem-dados {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  padding: 12px 14px;
  border: 1px dashed var(--linha-forte);
  border-radius: 12px;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.45;
}

.sem-dados i {
  margin-top: 2px;
  font-size: 15px;
}

.vazio-ficha {
  display: grid;
  justify-items: start;
  gap: 8px;
  padding: 20px;
}

.vazio-ficha__icone {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 12px;
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 20px;
}

.vazio-ficha strong {
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
}

.vazio-ficha p {
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
  line-height: 1.5;
}

/* Pares rótulo e valor (tratamento, diário): rótulo pequeno em cima, valor embaixo. */
.pares {
  display: grid;
  gap: 8px 16px;
  margin: 4px 0 0;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
}

.pares dt {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 550;
}

.pares dd {
  margin: 1px 0 0;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.4;
}

/* Tratamento contínuo */
.trat {
  display: flex;
  gap: 12px;
  padding: 14px 16px;
}

.trat__icone {
  width: 20px;
  height: 20px;
  flex: none;
  margin-top: 1px;
  color: var(--risco);
}

.trat__corpo {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.trat__nome {
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
}

.trat__posologia {
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
}

.trat__obs {
  margin: 4px 0 0;
  color: var(--tinta);
  font-size: 13.5px;
  line-height: 1.45;
}

.trat__obs span {
  color: var(--tinta-2);
  font-weight: 550;
}

/* Dados clínicos: uma linha por categoria, que abre. */
.dobra__cabeca {
  margin: 0;
  font: inherit;
}

.dobra__linha {
  display: flex;
  min-height: 58px;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
}

.dobra__botao {
  width: 100%;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: start;
}

.dobra__botao:hover {
  background: var(--superficie-2);
}

.dobra__botao:focus-visible {
  outline: 2px solid var(--pj-lugar);
  outline-offset: -2px;
}

.ui-lista > li:first-child .dobra__botao {
  border-top-left-radius: 15px;
  border-top-right-radius: 15px;
}

.ui-lista > li:last-child .dobra__botao[aria-expanded='false'] {
  border-bottom-left-radius: 15px;
  border-bottom-right-radius: 15px;
}

.dobra__icone {
  display: grid;
  width: 34px;
  height: 34px;
  flex: none;
  place-items: center;
  border-radius: 10px;
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 17px;
}

.dobra[data-tone='warm'] .dobra__icone {
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

.dobra__texto {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 2px;
}

.dobra__titulo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
}

.dobra[data-vazio='true'] .dobra__titulo {
  color: var(--tinta-2);
  font-weight: 550;
}

.dobra__sub {
  overflow: hidden;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dobra[data-vazio='true'] .dobra__sub {
  white-space: normal;
}

.dobra__seta {
  color: var(--tinta-3);
  font-size: 15px;
}

.dobra__itens {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 2px 16px 14px 62px;
  list-style: none;
}

[dir='rtl'] .dobra__itens {
  padding: 2px 62px 14px 16px;
}

.dobra__itens li {
  display: grid;
  gap: 1px;
  line-height: 1.35;
}

.dobra__itens strong {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 550;
}

.dobra__itens span {
  color: var(--tinta-2);
  font-size: 13px;
}

.dobra__item--destaque strong {
  color: var(--risco-tinta);
  font-weight: 650;
}

/* Documentos */
.doc {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 12px;
  padding: 12px 16px;
}

.doc__icone {
  display: grid;
  width: 34px;
  height: 34px;
  flex: none;
  place-items: center;
  border-radius: 10px;
  background: var(--pj-lugar-fundo);
  color: var(--pj-lugar-tinta);
  font-size: 17px;
}

.doc__texto {
  display: grid;
  min-width: 0;
  flex: 1 1 10rem;
  gap: 2px;
  line-height: 1.35;
}

.doc__texto strong {
  overflow: hidden;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doc__texto small {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.doc__sem {
  color: var(--tinta-3);
  font-size: 12.5px;
}

.doc__acoes {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px 12px;
  margin-inline-start: auto;
}

.doc__arquivo {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.doc__arquivo :deep(.p-button) {
  width: 36px;
  height: 36px;
}

.doc__n {
  margin-inline-end: 2px;
  color: var(--tinta-2);
  font-size: 12.5px;
}

/* Diário */
.dia {
  display: grid;
  gap: 8px;
  padding: 14px 16px;
}

.dia__data {
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
}

.dia__selos {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.dia__texto {
  margin: 0;
  color: var(--tinta);
  font-size: 13.5px;
  line-height: 1.45;
}

.dia__texto span {
  color: var(--tinta-2);
  font-weight: 550;
}

.dia__fotos {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* ------------------------------------------------------------------ a folha da anotação */

.trabalho {
  display: grid;
  min-width: 0;
  gap: 24px;
}

.folha {
  --folha-pad-x: 22px;
  --folha-fio: var(--linha);
  --folha-suave: var(--tinta-2);

  min-width: 0;
  container: folha / inline-size;
}

.folha__cab {
  display: grid;
  gap: 4px;
  padding: 20px var(--folha-pad-x) 6px;
}

.folha__titulo {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  color: var(--tinta);
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.folha__titulo i {
  color: var(--pj-lugar-tinta);
  font-size: 22px;
}

.folha__lede {
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
  line-height: 1.5;
}

.folha__secao {
  display: grid;
  gap: 14px;
  padding: 18px var(--folha-pad-x);
  border-top: 1px solid var(--folha-fio);
}

.folha__cab + .folha__secao {
  padding-top: 12px;
  border-top: 0;
}

.folha__secao-cab {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
}

.folha__subtitulo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 15.5px;
  font-weight: 600;
}

.folha__subtitulo i {
  color: var(--pj-lugar-tinta);
  font-size: 18px;
}

.folha__duas {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.campo {
  display: grid;
  min-width: 0;
  gap: 6px;
}

.campo > label {
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 550;
}

.campo__obrigatorio {
  color: var(--risco-tinta);
}

.campo :deep(.p-select) {
  width: 100%;
}

/* Anexar: um rótulo com cara de botão; o input cobre o rótulo para o teclado chegar nele. */
.anexar {
  position: relative;
  display: inline-flex;
  min-height: 38px;
  align-items: center;
  gap: 6px;
  padding: 0 14px;
  border: 1px solid var(--linha-forte);
  border-radius: 10px;
  color: var(--tinta);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.anexar:hover {
  background: var(--superficie-2);
}

.anexar:focus-within {
  outline: 2px solid var(--pj-lugar);
  outline-offset: 2px;
}

.anexar input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
  opacity: 0;
}

.anexar i {
  font-size: 16px;
}

.anexos {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.anexos li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  padding: 8px 8px 8px 12px;
  border: 1px solid var(--linha);
  border-radius: 12px;
  background: var(--superficie-2);
}

.anexos__icone {
  color: var(--tinta-2);
  font-size: 18px;
}

.anexos__nome {
  display: grid;
  min-width: 0;
  flex: 1 1 8rem;
  line-height: 1.3;
}

.anexos__nome strong {
  overflow: hidden;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 550;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.anexos__nome small {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.anexos__tipo {
  width: 14rem;
  max-width: 100%;
}

.folha__nota {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--tinta-2);
  font-size: 12.5px;
}

.folha__nota--ia {
  color: var(--hotel-tinta);
  font-weight: 550;
}

/* Rodapé preso à tela enquanto a folha estiver nela. */
.folha__rodape {
  position: sticky;
  z-index: 2;
  bottom: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 16px;
  padding: 14px var(--folha-pad-x);
  border-top: 1px solid var(--linha);
  border-radius: 0 0 15px 15px;
  background: color-mix(in oklab, var(--superficie) 94%, transparent);
  box-shadow: 0 -10px 20px -18px rgb(0 0 0 / 35%);
  backdrop-filter: blur(8px);
}

.folha__erro,
.folha__dica {
  display: flex;
  min-width: 0;
  flex: 1 1 16rem;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
  font-size: 13.5px;
  line-height: 1.4;
}

.folha__erro {
  color: var(--risco-tinta);
  font-weight: 550;
}

.folha__dica {
  color: var(--tinta-2);
}

.folha__erro i,
.folha__dica i {
  margin-top: 1px;
  font-size: 16px;
}

.folha__enviar.p-button {
  min-height: 44px;
  padding-inline: 20px;
  font-size: 15px;
}

@container folha (max-width: 520px) {
  /* A variável vai nos filhos: a consulta de contêiner não estiliza o próprio contêiner. */
  .folha > * {
    --folha-pad-x: 16px;
  }

  .folha__duas {
    grid-template-columns: minmax(0, 1fr);
  }

  .folha__enviar.p-button {
    width: 100%;
  }

  /* No celular o rodapé preso guarda só o botão (e o erro, quando houver). */
  .folha__dica {
    display: none;
  }
}

/* ------------------------------------------------------------------ histórico de anotações */

.nota {
  display: grid;
  gap: 10px;
  padding: 16px 18px;
}

.nota__cab {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 4px 16px;
}

.nota__quem {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.nota__servico {
  margin: 0;
  color: var(--tinta);
  font-size: 15.5px;
  font-weight: 600;
}

.nota__autor {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 6px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
}

.nota__quando {
  color: var(--tinta-2);
  font-size: 12.5px;
  white-space: nowrap;
}

.nota__texto {
  margin: 0;
  color: var(--tinta);
  font-size: 14.5px;
  line-height: 1.55;
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.nota__anexos {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.nota__anexo {
  display: inline-flex;
  max-width: 100%;
  min-height: 36px;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border: 1px solid var(--linha);
  border-radius: 10px;
  background: var(--superficie-2);
  color: var(--tinta);
  cursor: pointer;
  font: inherit;
  font-size: 13.5px;
}

.nota__anexo:hover:not(:disabled) {
  border-color: var(--linha-forte);
}

.nota__anexo:focus-visible {
  outline: 2px solid var(--pj-lugar);
  outline-offset: 2px;
}

.nota__anexo i {
  color: var(--pj-lugar-tinta);
  font-size: 16px;
}

.nota__anexo-nome {
  overflow: hidden;
  font-weight: 550;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nota__anexo small {
  color: var(--tinta-2);
  font-size: 12px;
  white-space: nowrap;
}

/* ------------------------------------------------------------------ larguras */

@media (max-width: 1100px) {
  .capa {
    grid-template-columns: minmax(0, 1fr);
  }

  .capa__dados {
    padding-inline-start: 90px;
  }

  .capa__dado:first-child {
    padding-inline-start: 0;
    border-inline-start: 0;
  }
}

@media (max-width: 640px) {
  .capa .capa__rosto {
    width: 56px;
    height: 56px;
    font-size: 1.1rem;
  }

  .capa__quem {
    gap: 14px;
  }

  .capa__nome {
    font-size: 24px;
  }

  .capa__dados {
    padding-inline-start: 0;
  }

  .capa__numero strong,
  .capa__contagem {
    font-size: 24px;
  }

  .mesa__abas {
    justify-self: stretch;
  }

  .mesa__abas :deep(.p-togglebutton) {
    flex: 1 1 0;
  }

  .recado {
    padding-inline-start: 46px;
  }

  .recado__aspas {
    left: 14px;
  }
}
</style>
