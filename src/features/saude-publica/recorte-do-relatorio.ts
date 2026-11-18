/**
 * O recorte dos Relatórios de Saúde pública (17/11/2026, "organizar melhor os filtros do recorte"):
 * um estado só para as abas "Atendimentos por lugar" e "Equipe", então trocar de aba mantém o que
 * foi escolhido. Fica na memória da aba, como o resto da demonstração.
 *
 * Duas fileiras na tela (`RecorteDoRelatorio.vue`): o quê e quando (de onde, quando, animais,
 * situação e equipe) e onde (região, bairro ou CEP, um modo por vez; só o modo escolhido filtra).
 * Como agrupar fica fora daqui: é da caixa do resultado de cada aba.
 */
import { computed, ref, watch } from 'vue'

import { cepNaTela, type FiltroDoRelatorio } from '@/features/saude-publica/campo'
import {
  CAMPANHAS,
  dataCurta,
  EQUIPE,
  REGIOES,
  tipoDeCampanha,
  type IdDaRegiao,
  type SituacaoDoAtendimento,
} from '@/features/saude-publica/dados'
import type { Especie } from '@/features/saude-publica/serie'

/** O que o relatório cobre: os 90 dias do programa e março, onde ficam as campanhas agendadas. */
export const LIMITE_DO_RELATORIO = { inicio: '2026-12-01', fim: '2027-03-31' }
export const PERIODO_PADRAO = { de: '2026-12-01', ate: '2027-02-28' }

export type OndeDoRecorte = 'regiao' | 'bairro' | 'cep'

const TODOS = 'todos'

/* ---------------------------------------------------------------------------- as opções */

const campanhasEmOrdem = [...CAMPANHAS].sort((uma, outra) => uma.data.localeCompare(outra.data))

export const OPCOES_DE_ORIGEM = [
  { valor: TODOS, rotulo: 'Todos os atendimentos', icone: 'ph ph-squares-four' },
  { valor: 'piloto', rotulo: 'Consultório Móvel (piloto)', icone: 'ph ph-van' },
  { valor: 'campanhas', rotulo: 'Todas as campanhas', icone: 'ph ph-megaphone' },
  ...campanhasEmOrdem.map((campanha) => ({
    valor: campanha.id,
    rotulo: `${tipoDeCampanha(campanha.tipo).rotulo} · ${dataCurta(campanha.data).slice(0, 5)}`,
    icone: tipoDeCampanha(campanha.tipo).icone,
  })),
]

export const ESPECIES_DO_RECORTE: { valor: Especie; rotulo: string; icone: string }[] = [
  { valor: 'todos', rotulo: 'Cães e gatos', icone: 'ph ph-paw-print' },
  { valor: 'caes', rotulo: 'Só cães', icone: 'ph ph-dog' },
  { valor: 'gatos', rotulo: 'Só gatos', icone: 'ph ph-cat' },
]

export const SITUACOES_DO_RECORTE: {
  valor: SituacaoDoAtendimento
  rotulo: string
  icone: string
}[] = [
  { valor: 'realizado', rotulo: 'Realizado', icone: 'ph ph-check-circle' },
  { valor: 'parcial', rotulo: 'Parcial', icone: 'ph ph-circle-half' },
  { valor: 'nao-realizado', rotulo: 'Não realizado', icone: 'ph ph-x-circle' },
]

/* ----------------------------------------------------------------------------- o estado */

const origem = ref<string>(TODOS)
const de = ref(PERIODO_PADRAO.de)
const ate = ref(PERIODO_PADRAO.ate)
const especie = ref<Especie>('todos')
const situacao = ref<SituacaoDoAtendimento | null>(null)
const equipe = ref<string[]>([])

const onde = ref<OndeDoRecorte>('regiao')
const regioes = ref<IdDaRegiao[]>([])
const bairros = ref<string[]>([])
/** Só os dígitos: 8 é o CEP inteiro; de 3 a 7, o começo (a faixa). */
const ceps = ref<string[]>([])

/* A campanha escolhida fora do período: o período estica até ela, para o recorte não vir vazio. */
watch(origem, (valor) => {
  const campanha = CAMPANHAS.find((item) => item.id === valor)
  if (!campanha) return
  if (campanha.data < de.value) de.value = campanha.data
  if (campanha.data > ate.value) ate.value = campanha.data
})

const filtro = computed<FiltroDoRelatorio>(() => ({
  origem: origem.value === TODOS ? null : origem.value,
  de: de.value,
  ate: ate.value,
  especie: especie.value,
  situacao: situacao.value,
  equipe: equipe.value,
  regioes: onde.value === 'regiao' ? regioes.value : [],
  bairros: onde.value === 'bairro' ? bairros.value : [],
  ceps: onde.value === 'cep' ? ceps.value : [],
}))

/* --------------------------------------------------------------------------- os textos */

/** "01/12/2026 a 28/02/2027". */
const intervalo = computed(() => `${dataCurta(de.value)} a ${dataCurta(ate.value)}`)

/** "01/12/26 a 28/02/27": cabe no botão da grade. */
const intervaloCurto = computed(() => {
  const curta = (valor: string) => {
    const [ano, mes, dia] = valor.split('-')
    return `${dia}/${mes}/${ano!.slice(2)}`
  }
  return `${curta(de.value)} a ${curta(ate.value)}`
})

/** "79094-000", ou "79094-… (faixa)" para o começo do CEP. */
export function rotuloDoCep(cep: string) {
  return cep.length === 8 ? cepNaTela(cep) : `${cepNaTela(cep)}… (faixa)`
}

/** Até três nomes e "e mais N". */
function lista(nomes: string[]) {
  if (nomes.length <= 3) return nomes.join(', ')
  return `${nomes.slice(0, 3).join(', ')} e mais ${nomes.length - 3}`
}

const ondeNaFrase = computed(() => {
  if (onde.value === 'regiao' && regioes.value.length) {
    return `regiões: ${lista(regioes.value.map((id) => REGIOES.find((r) => r.id === id)!.nome))}`
  }
  if (onde.value === 'bairro' && bairros.value.length) return `bairros: ${lista(bairros.value)}`
  if (onde.value === 'cep' && ceps.value.length)
    return `CEPs: ${lista(ceps.value.map(rotuloDoCep))}`
  return 'a cidade inteira'
})

/** O recorte numa linha, na tela e no papel. */
const recorteNaFrase = computed(() =>
  [
    OPCOES_DE_ORIGEM.find((item) => item.valor === origem.value)!.rotulo,
    intervalo.value,
    ESPECIES_DO_RECORTE.find((item) => item.valor === especie.value)!.rotulo,
    situacao.value
      ? `só ${SITUACOES_DO_RECORTE.find((item) => item.valor === situacao.value)!.rotulo.toLowerCase()}`
      : '',
    equipe.value.length
      ? `equipe: ${lista(equipe.value.map((id) => EQUIPE.find((p) => p.id === id)?.nome ?? id))}`
      : '',
    ondeNaFrase.value,
  ]
    .filter(Boolean)
    .join(' · '),
)

/** Quantos filtros saíram do padrão: o "Limpar filtros (N)" só aparece com algum. */
const ativos = computed(
  () =>
    Number(origem.value !== TODOS) +
    Number(de.value !== PERIODO_PADRAO.de || ate.value !== PERIODO_PADRAO.ate) +
    Number(especie.value !== 'todos') +
    Number(situacao.value !== null) +
    Number(equipe.value.length > 0) +
    Number(ondeNaFrase.value !== 'a cidade inteira'),
)

function limpar() {
  origem.value = TODOS
  de.value = PERIODO_PADRAO.de
  ate.value = PERIODO_PADRAO.ate
  especie.value = 'todos'
  situacao.value = null
  equipe.value = []
  regioes.value = []
  bairros.value = []
  ceps.value = []
}

export function useRecorteDoRelatorio() {
  return {
    origem,
    de,
    ate,
    especie,
    situacao,
    equipe,
    onde,
    regioes,
    bairros,
    ceps,
    filtro,
    intervalo,
    intervaloCurto,
    recorteNaFrase,
    ativos,
    limpar,
  }
}
