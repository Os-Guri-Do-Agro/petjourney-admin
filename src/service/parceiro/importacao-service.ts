/**
 * O migrador da base da clínica pela API (E2-05, PJ-NSCETD). Guia `portal-parceiro-e2.md`, seção 4.
 *
 * O arquivo continua no navegador: ler o `.csv` e o `.xlsx`, achar o cabeçalho, ligar as colunas e o
 * de-para de espécie são do portal. A base da clínica não desce mais: o plano, as dúvidas de
 * duplicidade, a gravação em lotes (um job no servidor), o relatório, o desfazer e as propostas de
 * vínculo são da API. Tudo pede `importacao.executar` (DONO e GESTOR), em qualquer módulo.
 */
import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'
import type {
  AjusteDaLinhaDto,
  CamposDaLinhaDto,
  CandidatoDaDuvidaDto,
  ContagemPorCodigoDto,
  CriarImportacaoDeBaseDto,
  DuvidaDto,
  ImportacaoDeBaseCriadaDto,
  ImportacaoDeBaseDto,
  LadoDaDuvidaDto,
  LinhaDoRelatorioDto,
  LinhaEnviadaDto,
  LinhasRecebidasDto,
  PaginaDuvidasDto,
  PaginaImportacoesDeBaseDto,
  PaginaLinhasDto,
  PropostasEmLoteDto,
  RespostaDaDuvidaDto,
  RespostasRegistradasDto,
  ResumoDaImportacaoDto,
} from '../contrato/openapi'
import { comIdempotencia } from '../idempotencia'

export type Importacao = ImportacaoDeBaseDto
export type ImportacaoCriada = ImportacaoDeBaseCriadaDto
export type NovaImportacao = CriarImportacaoDeBaseDto
export type StatusDaImportacao = ImportacaoDeBaseDto['status']
export type CamposDaLinha = CamposDaLinhaDto
export type CampoDaLinha = keyof CamposDaLinhaDto
export type LinhaEnviada = LinhaEnviadaDto
export type LinhasRecebidas = LinhasRecebidasDto
export type EspecieDaApi = NonNullable<LinhaEnviadaDto['especieEscolhida']>
export type Duvida = DuvidaDto
export type LadoDaDuvida = LadoDaDuvidaDto
export type CandidatoDaDuvida = CandidatoDaDuvidaDto
export type PaginaDeDuvidas = PaginaDuvidasDto
export type RespostaDaDuvida = RespostaDaDuvidaDto
export type OpcaoDaDuvida = RespostaDaDuvidaDto['resposta']
export type RespostasRegistradas = RespostasRegistradasDto
export type ResumoDaImportacao = ResumoDaImportacaoDto
export type ContagemPorCodigo = ContagemPorCodigoDto
export type CodigoDaLinha = ContagemPorCodigoDto['codigo']
export type LinhaDoRelatorio = LinhaDoRelatorioDto
export type AjusteDaLinha = AjusteDaLinhaDto
export type DestinoDaLinha = LinhaDoRelatorioDto['destino']
export type DesfechoDaLinha = NonNullable<LinhaDoRelatorioDto['desfecho']>
export type PaginaDeLinhas = PaginaLinhasDto
export type PropostasEmLote = PropostasEmLoteDto

/** Os tetos da seção 4.1: 10.000 linhas por importação e até 500 por chamada. */
export const LINHAS_POR_IMPORTACAO = 10_000
export const LINHAS_POR_CHAMADA = 500

/** O job grava em segundo plano: a tela pergunta a cada 1,5 s enquanto ele anda. */
export const INTERVALO_DO_ACOMPANHAMENTO_MS = 1500

/** Enquanto o servidor trabalha sozinho (gravando ou desfazendo). */
export const STATUS_EM_ANDAMENTO: readonly StatusDaImportacao[] = ['PROCESSANDO', 'DESFAZENDO']

/** Começada e não acabada: a tela retoma por ela ao abrir. */
export const STATUS_ABERTOS: readonly StatusDaImportacao[] = [
  'RECEBENDO_LINHAS',
  'COM_DUVIDAS',
  'PRONTA',
  'PROCESSANDO',
  'PAUSADA',
  'FALHOU',
  'DESFAZENDO',
]

type ParceiroQuery = { parceiroId?: string | null }

const IMPORTACOES = '/parceiro/portal/importacoes'

function comQuery(
  caminho: string,
  query: Record<string, string | number | boolean | null | undefined>,
) {
  const busca = new URLSearchParams()
  for (const [chave, valor] of Object.entries(query)) {
    if (valor !== undefined && valor !== null && valor !== '') busca.set(chave, String(valor))
  }
  const texto = busca.toString()

  return texto ? `${caminho}?${texto}` : caminho
}

function daImportacao(id: string, resto = '') {
  return `${IMPORTACOES}/${encodeURIComponent(id)}${resto}`
}

async function dados<T>(promise: Promise<ApiEnvelope<T>>) {
  return (await promise).data
}

function json(metodo: string, corpo: unknown): RequestInit {
  return { method: metodo, body: JSON.stringify(corpo) }
}

function acao<T>(id: string, nome: string, params?: ParceiroQuery, corpo: unknown = {}) {
  return dados(
    apiFetch<ApiEnvelope<T>>(
      comQuery(daImportacao(id, `/${nome}`), { parceiroId: params?.parceiroId }),
      json('POST', corpo),
    ),
  )
}

/** O último ano, a mais nova primeiro. */
export function listarImportacoes(
  pagina: { limite?: number; cursor?: string | null } = {},
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<PaginaImportacoesDeBaseDto>>(
      comQuery(IMPORTACOES, {
        parceiroId: params?.parceiroId,
        limite: pagina.limite ?? 10,
        cursor: pagina.cursor,
      }),
    ),
  )
}

export function obterImportacao(id: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Importacao>>(
      comQuery(daImportacao(id), { parceiroId: params?.parceiroId }),
    ),
  )
}

/** Com `jaImportadoEm`, o mesmo arquivo (pelo hash) já entrou antes: a clínica decide. */
export function criarImportacao(nova: NovaImportacao, chave: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<ImportacaoCriada>>(
      comQuery(IMPORTACOES, { parceiroId: params?.parceiroId }),
      comIdempotencia(chave, json('POST', nova)),
    ),
  )
}

/** Até 500 linhas por chamada, uma chave por chamada: se a rede cair, repete-se a mesma. */
export function enviarLinhas(
  id: string,
  linhas: LinhaEnviada[],
  chave: string,
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<LinhasRecebidas>>(
      comQuery(daImportacao(id, '/linhas'), { parceiroId: params?.parceiroId }),
      comIdempotencia(chave, json('POST', { linhas })),
    ),
  )
}

export function listarDuvidas(
  id: string,
  filtro: { pendentes: boolean; cursor?: string | null; limite?: number },
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<PaginaDeDuvidas>>(
      comQuery(daImportacao(id, '/duvidas'), {
        parceiroId: params?.parceiroId,
        pendentes: filtro.pendentes,
        cursor: filtro.cursor,
        limite: filtro.limite ?? 20,
      }),
    ),
  )
}

/** O plano roda de novo a cada resposta: a tela relê as dúvidas depois. */
export function responderDuvidas(
  id: string,
  respostas: RespostaDaDuvida[],
  params?: ParceiroQuery,
) {
  return acao<RespostasRegistradas>(id, 'respostas', params, { respostas })
}

export function obterResumo(id: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<ResumoDaImportacao>>(
      comQuery(daImportacao(id, '/resumo'), { parceiroId: params?.parceiroId }),
    ),
  )
}

/** O relatório por linha, até 100 por página; o cursor é o número da última linha. */
export function listarLinhas(
  id: string,
  filtro: {
    destino?: DestinoDaLinha | null
    motivo?: CodigoDaLinha | null
    desfecho?: DesfechoDaLinha | null
    cursor?: number | null
    limite?: number
  },
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<PaginaDeLinhas>>(
      comQuery(daImportacao(id, '/linhas'), {
        parceiroId: params?.parceiroId,
        destino: filtro.destino,
        motivo: filtro.motivo,
        desfecho: filtro.desfecho,
        cursor: filtro.cursor,
        limite: filtro.limite ?? 100,
      }),
    ),
  )
}

/** Refaz o plano com a base de agora e congela; a gravação vira um job (`PROCESSANDO`). */
export function confirmarImportacao(id: string, params?: ParceiroQuery) {
  return acao<Importacao>(id, 'confirmar', params)
}

export function pausarImportacao(id: string, params?: ParceiroQuery) {
  return acao<Importacao>(id, 'pausar', params)
}

/** De `PAUSADA` ou `FALHOU`, do mesmo lote (ou do mesmo ponto do desfazer). */
export function continuarImportacao(id: string, params?: ParceiroQuery) {
  return acao<Importacao>(id, 'continuar', params)
}

/** Antes de importar: nada foi gravado, e as linhas saem do servidor. */
export function descartarImportacao(id: string, params?: ParceiroQuery) {
  return acao<Importacao>(id, 'descartar', params)
}

export function desfazerImportacao(id: string, params?: ParceiroQuery) {
  return acao<Importacao>(id, 'desfazer', params)
}

/** Só de `CONCLUIDA`: proposta por e-mail a cada cliente que a importação criou. */
export function proporVinculos(id: string, params?: ParceiroQuery) {
  return acao<PropostasEmLote>(id, 'propor-vinculos', params)
}
