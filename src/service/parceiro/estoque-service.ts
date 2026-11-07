/**
 * Estoque de vacinas pela API (E6-01, PJ-RFFOKT). Guia `portal-parceiro-e6.md`, seções 1 a 13.
 *
 * A API decide o saldo, a situação e a cobertura; a tela só mostra. Datas de entrada e de saída em
 * `AAAA-MM-DD`; dinheiro em centavos inteiros. Custo e valor ficam **ausentes** (não zerados) para
 * quem não tem `estoque.planejar` nem `financeiro.ler`: sem o campo, sem a coluna.
 *
 * - Ler (geladeira, fornecedores, movimentos, análise): `estoque.ler`, inclui a recepção.
 * - Receber, corrigir e dar baixa: `estoque.movimentar`.
 * - Mínimo e estorno: `estoque.planejar` (DONO, GESTOR).
 *
 * Metas do mês (E6-02, PJ-ZXGZ7P, seções 15 e 16): ler é `estoque.ler`; salvar, a sugestão e a
 * simulação do pedido são `estoque.planejar` (levam custo). A situação, o ritmo, o placar, a
 * sugestão e a conta do pedido são do servidor.
 */
import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'
import type {
  AnaliseDto,
  BaixaDto,
  BaixarLoteDto,
  EditarLoteDto,
  FornecedoresDto,
  GeladeiraDto,
  LoteDto,
  MetaDto,
  MetaEntradaDto,
  MetasDto,
  MesFechadoDto,
  MovimentoDto,
  PaginaDeMovimentosDto,
  PedidoDto,
  PlanoDto,
  ProgressoDto,
  ReceberLoteDto,
  SalvarPlanoDto,
  SugestaoDto,
} from '../contrato/openapi'
import { comIdempotencia } from '../idempotencia'

export type Geladeira = GeladeiraDto
export type VacinaNaGeladeira = GeladeiraDto['vacinas'][number]
export type LoteDoEstoque = LoteDto
export type NovoLote = ReceberLoteDto
export type CorrecaoDoLote = EditarLoteDto
export type Baixa = BaixaDto
export type NovaBaixa = BaixarLoteDto
export type MotivoDaBaixa = BaixarLoteDto['motivo']
export type Movimento = MovimentoDto
export type PaginaDeMovimentos = PaginaDeMovimentosDto
export type Analise = AnaliseDto
export type FaixaDeValidade = AnaliseDto['validade']['faixas'][number]['faixa']
export type Metas = MetasDto
export type PlanoDeMetas = PlanoDto
export type Meta = MetaDto
export type TipoDeMeta = MetaDto['tipo']
export type MetaNova = MetaEntradaDto
export type ProgressoDaMeta = ProgressoDto
export type SituacaoDaMeta = ProgressoDto['situacao']
export type SentidoDaMeta = ProgressoDto['sentido']
export type MesFechado = MesFechadoDto
export type SugestaoDeMetas = SugestaoDto
export type ReferenciaDaSugestao = SugestaoDto['referencias'][number]
export type PedidoDeCompra = PedidoDto
export type LinhaDoPedido = PedidoDto['linhas'][number]

export const MOTIVOS_DA_BAIXA: readonly MotivoDaBaixa[] = [
  'QUEBRA',
  'TEMPERATURA',
  'CONTAGEM',
  'VENCIMENTO',
]
export const DOSES_MAX = 999
export const CUSTO_MAX_CENTAVOS = 1_000_000
export const MINIMO_MAX = 9999
export const CODIGO_MAX = 40
/** Letras A a Z, números, espaço, ponto, barra, hífen e sublinhado (a API grava em maiúsculas). */
export const CODIGO_DO_LOTE = /^[A-Za-z0-9 ./_-]{1,40}$/
export const MOTIVO_DO_ESTORNO_MIN = 10
export const MOTIVO_DO_ESTORNO_MAX = 300
export const OBSERVACAO_DA_BAIXA_MAX = 300
/** O lote recebido pode ser registrado até 60 dias depois. */
export const RECEBIDO_DIAS_PARA_TRAS = 60
/** Faixas do alvo da meta (guia e6 15.2). */
export const ALVO_MAX_POR_VACINA = 9999
export const ALVO_MAX_DA_CLINICA = 99_999
export const COMPRAS_MAX_CENTAVOS = 1_000_000_000
export const METAS_MAX = 120
/** A simulação do pedido acompanha o que se digita, com folga (300 por hora por pessoa). */
export const SIMULAR_DEBOUNCE_MS = 400

type ParceiroQuery = { parceiroId?: string | null }

function comQuery(caminho: string, query: Record<string, string | number | null | undefined>) {
  const busca = new URLSearchParams()
  for (const [chave, valor] of Object.entries(query)) {
    if (valor !== undefined && valor !== null && valor !== '') busca.set(chave, String(valor))
  }
  const texto = busca.toString()
  return texto ? `${caminho}?${texto}` : caminho
}

async function dados<T>(promise: Promise<ApiEnvelope<T>>) {
  return (await promise).data
}

function json(method: string, corpo?: unknown): RequestInit {
  return corpo === undefined ? { method } : { method, body: JSON.stringify(corpo) }
}

const BASE = '/parceiro/portal/clinica/estoque'
const doLote = (id: string, resto = '') => `${BASE}/lotes/${encodeURIComponent(id)}${resto}`

export function lerGeladeira(params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Geladeira>>(
      comQuery(`${BASE}/geladeira`, { parceiroId: params?.parceiroId }),
    ),
  )
}

export function listarFornecedores(params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<FornecedoresDto>>(
      comQuery(`${BASE}/fornecedores`, { parceiroId: params?.parceiroId }),
    ),
  )
}

export function receberLote(corpo: NovoLote, chave: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<LoteDoEstoque>>(
      comQuery(`${BASE}/lotes`, { parceiroId: params?.parceiroId }),
      comIdempotencia(chave, json('POST', corpo)),
    ),
  )
}

/** Só fornecedor, nota e custo (o custo só com `estoque.planejar` ou `financeiro.ler`). */
export function corrigirLote(id: string, corpo: CorrecaoDoLote, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<LoteDoEstoque>>(
      comQuery(doLote(id), { parceiroId: params?.parceiroId }),
      json('PATCH', corpo),
    ),
  )
}

export function darBaixa(id: string, corpo: NovaBaixa, chave: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Baixa>>(
      comQuery(doLote(id, '/baixa'), { parceiroId: params?.parceiroId }),
      comIdempotencia(chave, json('POST', corpo)),
    ),
  )
}

export function estornarBaixa(baixaId: string, motivo: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Baixa>>(
      comQuery(`${BASE}/baixas/${encodeURIComponent(baixaId)}/estornar`, {
        parceiroId: params?.parceiroId,
      }),
      json('POST', { motivo }),
    ),
  )
}

/** `0` é "não me avise"; o `minimoPadrao` volta ao do catálogo (não há DELETE). */
export function definirMinimo(vacinaId: string, minimo: number, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<{ vacinaId: string; minimo: number; minimoPadrao: number }>>(
      comQuery(`${BASE}/minimos/${encodeURIComponent(vacinaId)}`, {
        parceiroId: params?.parceiroId,
      }),
      json('PUT', { minimo }),
    ),
  )
}

/**
 * Entradas e baixas, da mais recente. O cursor carrega o período da primeira página: nas
 * seguintes, só o cursor (e o mesmo `tipo`).
 */
export function listarMovimentos(
  filtro: {
    tipo?: Movimento['tipo'] | null
    de?: string | null
    ate?: string | null
    cursor?: string | null
    limit?: number
  },
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<PaginaDeMovimentos>>(
      comQuery(`${BASE}/movimentos`, {
        tipo: filtro.tipo,
        de: filtro.cursor ? null : filtro.de,
        ate: filtro.cursor ? null : filtro.ate,
        cursor: filtro.cursor,
        limit: filtro.limit ?? 30,
        parceiroId: params?.parceiroId,
      }),
    ),
  )
}

export function lerAnalise(meses: number, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Analise>>(
      comQuery(`${BASE}/analise`, { meses, parceiroId: params?.parceiroId }),
    ),
  )
}

/* ---------------------------------------------------------------------------- metas */

export function lerMetas(params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Metas>>(comQuery(`${BASE}/metas`, { parceiroId: params?.parceiroId })),
  )
}

/**
 * Substitui o plano inteiro do mês (`AAAA-MM`, o em curso ou o seguinte): meta omitida é meta
 * apagada e `metas: []` esvazia. `versao` é a que a tela abriu (0 sem plano); outra pessoa no meio
 * dá 409 `PLANO_ALTERADO`.
 */
export function salvarPlano(mes: string, corpo: SalvarPlanoDto, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<PlanoDeMetas>>(
      comQuery(`${BASE}/metas/${encodeURIComponent(mes)}`, { parceiroId: params?.parceiroId }),
      json('PUT', corpo),
    ),
  )
}

/** Sem `mes`, o seguinte. O `pedido` vem sem `texto`: para copiar, simule. */
export function lerSugestao(mes?: string | null, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<SugestaoDeMetas>>(
      comQuery(`${BASE}/metas/sugestao`, { mes, parceiroId: params?.parceiroId }),
    ),
  )
}

/** Não grava nada. Só as metas de aplicação por vacina entram na conta. */
export function simularPedido(mes: string, metas: MetaNova[], params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<PedidoDeCompra>>(
      comQuery(`${BASE}/metas/${encodeURIComponent(mes)}/simular-pedido`, {
        parceiroId: params?.parceiroId,
      }),
      json('POST', { metas }),
    ),
  )
}
