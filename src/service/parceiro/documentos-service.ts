/**
 * Documentos clínicos e laudos pela API (E4-06a e E4-06b, PJ-0EK0TY). Guia `portal-parceiro-e4.md`,
 * seções 8, 9 e 14.2.
 *
 * O documento nasce rascunho (o conteúdo do molde do tipo, sem identidade: o servidor lê o cadastro
 * na emissão), se emite com a senha da conta e vira PDF por uma URL de 15 minutos. Os termos
 * (consentimento, recusa, eutanásia) pedem o aceite: no balcão, com a assinatura desenhada, ou pelo
 * app (só consentimento e recusa).
 *
 * Os laudos recebidos se anexam ao atendimento (1 a 4 arquivos por envio) e só aparecem ao
 * responsável com o resumo ou com "liberar".
 */
import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'
import type {
  AceiteNoBalcaoDto,
  AceiteRegistradoDto,
  DocumentoClinicoDto,
  LaudoDto,
  ListaDeLaudosDto,
  PaginaDeDocumentosDto,
  TipoDeDocumentoClinico,
  UrlDoDocumentoDto,
  UrlDoLaudoDto,
} from '../contrato/openapi'
import { comIdempotencia } from '../idempotencia'

export type Documento = DocumentoClinicoDto
export type TipoDeDocumento = TipoDeDocumentoClinico
export type IdiomaDoDocumento = DocumentoClinicoDto['idioma']
export type ConteudoDoDocumento = Record<string, unknown>
export type AceiteNoBalcao = AceiteNoBalcaoDto
export type AceiteRegistrado = AceiteRegistradoDto
export type Laudo = LaudoDto

/** Os tipos que emitem hoje (8.1 e 9.1); o resto dá 422 `DOCUMENTO_TIPO_INDISPONIVEL`. */
export const TIPOS_QUE_EMITEM: readonly TipoDeDocumento[] = [
  'ATESTADO_SAUDE',
  'ATESTADO_VIAGEM',
  'COMPROVANTE_VACINACAO',
  'PEDIDO_EXAME',
  'ENCAMINHAMENTO',
  'DECLARACAO_OBITO',
  'TERMO_CONSENTIMENTO',
  'TERMO_RECUSA',
  'TERMO_EUTANASIA',
]

export const TERMOS: readonly TipoDeDocumento[] = [
  'TERMO_CONSENTIMENTO',
  'TERMO_RECUSA',
  'TERMO_EUTANASIA',
]

/** Motivo de anular: 10 a 500. Motivo de remover um laudo: 10 a 300. */
export const MOTIVO_DE_ANULAR_MIN = 10
export const MOTIVO_DE_ANULAR_MAX = 500
export const MOTIVO_DE_REMOVER_MIN = 10
export const MOTIVO_DE_REMOVER_MAX = 300

/** Laudos: 1 a 4 arquivos por envio, 20 MB cada e 40 MB por envio. */
export const LAUDOS_POR_ENVIO = 4
export const LAUDO_MAX_BYTES = 20 * 1024 * 1024
export const LAUDOS_MAX_BYTES_POR_ENVIO = 40 * 1024 * 1024
export const TIPOS_DE_LAUDO = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const

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

const CLINICA = '/parceiro/portal/clinica'
const doDocumento = (id: string, resto = '') =>
  `${CLINICA}/documentos/${encodeURIComponent(id)}${resto}`
const doLaudo = (id: string, resto: string) => `${CLINICA}/laudos/${encodeURIComponent(id)}${resto}`

function json(method: string, corpo?: unknown): RequestInit {
  return corpo === undefined ? { method } : { method, body: JSON.stringify(corpo) }
}

const SENHA_NAO_E_QUEDA = {
  manterSessaoEm401: (codigo: string | undefined) =>
    Boolean(codigo?.startsWith('ASSINATURA_SENHA')),
}

/* -------------------------------------------------------------------------- documentos */

export function criarDocumento(
  corpo: {
    tipo: TipoDeDocumento
    pacienteId: string
    atendimentoId?: string
    internacaoId?: string
    idioma?: IdiomaDoDocumento
    conteudo?: ConteudoDoDocumento
  },
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<Documento>>(
      comQuery(`${CLINICA}/documentos`, { parceiroId: params?.parceiroId }),
      json('POST', corpo),
    ),
  )
}

/** Substitui o conteúdo inteiro do rascunho (o último a gravar vence). */
export function editarDocumento(
  id: string,
  corpo: { conteudo: ConteudoDoDocumento; idioma?: IdiomaDoDocumento },
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<Documento>>(
      comQuery(doDocumento(id), { parceiroId: params?.parceiroId }),
      json('PATCH', corpo),
    ),
  )
}

export function descartarDocumento(id: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<{ id: string; descartado: boolean }>>(
      comQuery(doDocumento(id), { parceiroId: params?.parceiroId }),
      json('DELETE'),
    ),
  )
}

export function lerDocumento(id: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Documento>>(comQuery(doDocumento(id), { parceiroId: params?.parceiroId })),
  )
}

export function listarDocumentosDoPaciente(
  pacienteId: string,
  filtro: { atendimentoId?: string | null; cursor?: string | null; limit?: number } = {},
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<PaginaDeDocumentosDto>>(
      comQuery(`${CLINICA}/pacientes/${encodeURIComponent(pacienteId)}/documentos`, {
        atendimentoId: filtro.atendimentoId,
        cursor: filtro.cursor,
        limit: filtro.limit ?? 20,
        parceiroId: params?.parceiroId,
      }),
    ),
  )
}

/** A senha sempre; a chave faz o duplo toque receber o mesmo documento. */
export function emitirDocumento(
  id: string,
  corpo: { senha: string; aceitePeloApp?: boolean },
  chave: string,
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<Documento>>(
      comQuery(doDocumento(id, '/emitir'), { parceiroId: params?.parceiroId }),
      comIdempotencia(chave, json('POST', corpo)),
      SENHA_NAO_E_QUEDA,
    ),
  )
}

export function pdfDoDocumento(id: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<UrlDoDocumentoDto>>(
      comQuery(doDocumento(id, '/pdf'), { parceiroId: params?.parceiroId }),
    ),
  )
}

export function anularDocumento(
  id: string,
  corpo: { motivo: string; confirmarOutroResponsavel?: boolean },
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<Documento>>(
      comQuery(doDocumento(id, '/anular'), { parceiroId: params?.parceiroId }),
      json('POST', corpo),
    ),
  )
}

/** O aceite do termo no balcão, com a assinatura desenhada (PNG em base64). Vale o primeiro. */
export function registrarAceiteNoBalcao(id: string, corpo: AceiteNoBalcao, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<AceiteRegistrado>>(
      comQuery(doDocumento(id, '/aceite-no-balcao'), { parceiroId: params?.parceiroId }),
      json('POST', corpo),
    ),
  )
}

/* ------------------------------------------------------------------------------- laudos */

export function listarLaudos(atendimentoId: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<ListaDeLaudosDto>>(
      comQuery(`${CLINICA}/atendimentos/${encodeURIComponent(atendimentoId)}/laudos`, {
        parceiroId: params?.parceiroId,
      }),
    ),
  )
}

/** Multipart: `file` repetido, o exame do catálogo ou pelo nome e o dia do resultado. */
export function anexarLaudos(
  atendimentoId: string,
  envio: { arquivos: File[]; tipoExameId?: string; nomeDoExame?: string; dataDoResultado: string },
  params?: ParceiroQuery,
) {
  const form = new FormData()
  for (const arquivo of envio.arquivos) form.append('file', arquivo)
  if (envio.tipoExameId) form.append('tipoExameId', envio.tipoExameId)
  if (envio.nomeDoExame) form.append('nomeDoExame', envio.nomeDoExame)
  form.append('dataDoResultado', envio.dataDoResultado)
  return dados(
    apiFetch<ApiEnvelope<ListaDeLaudosDto>>(
      comQuery(`${CLINICA}/atendimentos/${encodeURIComponent(atendimentoId)}/laudos`, {
        parceiroId: params?.parceiroId,
      }),
      { method: 'POST', body: form },
    ),
  )
}

export function urlDoLaudo(id: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<UrlDoLaudoDto>>(
      comQuery(doLaudo(id, '/url'), { parceiroId: params?.parceiroId }),
    ),
  )
}

export function liberarLaudo(id: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Laudo>>(
      comQuery(doLaudo(id, '/liberar'), { parceiroId: params?.parceiroId }),
      json('POST'),
    ),
  )
}

export function removerLaudo(id: string, motivo: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Laudo>>(
      comQuery(doLaudo(id, '/remover'), { parceiroId: params?.parceiroId }),
      json('POST', { motivo }),
    ),
  )
}
