/**
 * A caixa de pedidos de hospedagem e a configuração da reserva online pela API (E7-03, PJ-6B946W,
 * parte do portal). Guia `portal-parceiro-e7.md`, seções 21, 22 e 35 a 40.
 *
 * O pedido não segura vaga: a vaga só fica garantida no aceite, que reconfere sob a trava e pode
 * dar 409 `SEM_VAGA_NO_ACEITE` (aí: outra acomodação pelas sugestões, outra data pelas noites, ou
 * a recusa com mensagem). Nenhum texto diz "vaga reservada" para pedido.
 *
 * - Caixa, detalhe, sugestões, noites, aceitar e recusar: `hotel.reserva`.
 * - Estimativa (dinheiro): `hotel.valores`. Copiar a observação no aceite: `paciente.ler`.
 * - Configuração: ler com `hotel.ler`, salvar com `estabelecimento.editar`.
 */
import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'
import type {
  AceiteDoPedidoDto,
  AceitarPedidoDeReservaDto,
  DetalheDoPedidoDoHotelDto,
  EstimativaDoPedidoDto,
  NoitesDoPedidoDto,
  PaginaDaCaixaDoHotelDto,
  RecusarPedidoDeReservaDto,
  ReservaOnlineConfigDto,
  SalvarReservaOnlineDto,
  SugestoesDoPedidoDeReservaDto,
} from '../contrato/openapi'
import { comIdempotencia } from '../idempotencia'

export type PaginaDaCaixa = PaginaDaCaixaDoHotelDto
export type PedidoDoHotel = PaginaDaCaixaDoHotelDto['itens'][number]
export type DetalheDoPedido = DetalheDoPedidoDoHotelDto
export type SugestaoDoPedido = SugestoesDoPedidoDeReservaDto['itens'][number]
export type NoiteDoPedido = NoitesDoPedidoDto['noites'][number]
export type Estimativa = EstimativaDoPedidoDto
export type Aceite = AceiteDoPedidoDto
export type MotivoDaRecusa = RecusarPedidoDeReservaDto['motivo']
export type ReservaOnline = ReservaOnlineConfigDto
export type NovaReservaOnline = SalvarReservaOnlineDto

export const ABAS_DA_CAIXA = ['PENDENTES', 'ACEITOS', 'RECUSADOS', 'ENCERRADOS'] as const
export type AbaDaCaixaDoHotel = (typeof ABAS_DA_CAIXA)[number]
export const MOTIVOS_DA_RECUSA: readonly MotivoDaRecusa[] = [
  'SEM_VAGA',
  'EXIGENCIAS',
  'PERFIL',
  'OUTRO',
]
export const MENSAGEM_MAX = 500
export const SUGESTOES_MAX = 10
export const TIPOS_ONLINE_MAX = 30
export const ANTECEDENCIA_MAX_HORAS = 720
export const HORIZONTE_MAX_DIAS = 365
export const PRAZO_MAX_HORAS = 72
export const ORIENTACAO_MAX = 300
/** O balcão aberto por pelo menos uma hora. */
export const BALCAO_MIN_MINUTOS = 60

type ParceiroQuery = { parceiroId?: string | null }

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

async function dados<T>(promise: Promise<ApiEnvelope<T>>) {
  return (await promise).data
}

function json(method: string, corpo?: unknown): RequestInit {
  return corpo === undefined ? { method } : { method, body: JSON.stringify(corpo) }
}

const BASE = '/parceiro/portal/hotel'
const doPedido = (id: string, resto = '') => `${BASE}/pedidos/${encodeURIComponent(id)}${resto}`

/** Pendentes do mais antigo; os outros, do mais recente. O cursor só vale no mesmo filtro. */
export function listarPedidosDoHotel(
  filtro: { status: AbaDaCaixaDoHotel; cursor?: string | null; limit?: number },
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<PaginaDaCaixa>>(
      comQuery(`${BASE}/pedidos`, {
        status: filtro.status,
        cursor: filtro.cursor,
        limit: filtro.limit ?? 50,
        parceiroId: params?.parceiroId,
      }),
    ),
  )
}

export function lerPedidoDoHotel(id: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<DetalheDoPedido>>(
      comQuery(doPedido(id), { parceiroId: params?.parceiroId }),
    ),
  )
}

/** Até 10 acomodações livres que servem; sem vaga e com "aceita mudar um dia", as de ±1. */
export function sugestoesDoPedido(id: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<SugestoesDoPedidoDeReservaDto>>(
      comQuery(doPedido(id, '/sugestoes'), {
        limite: SUGESTOES_MAX,
        parceiroId: params?.parceiroId,
      }),
    ),
  )
}

/** O calendário do tipo pedido, noite a noite (padrão: 3 dias antes da entrada, 14 noites). */
export function noitesDoPedido(id: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<NoitesDoPedidoDto>>(
      comQuery(doPedido(id, '/noites'), { parceiroId: params?.parceiroId }),
    ),
  )
}

/** O orçamento que o aceite gravaria, sem gravar. Só `hotel.valores`. */
export function estimativaDoPedido(
  id: string,
  filtro: { acomodacaoId: string; entradaData?: string | null; saidaData?: string | null },
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<Estimativa>>(
      comQuery(doPedido(id, '/estimativa'), { ...filtro, parceiroId: params?.parceiroId }),
    ),
  )
}

/** Cria a reserva PENDENTE (o sinal vem depois, pelo fluxo da reserva). */
export function aceitarPedidoDoHotel(
  id: string,
  corpo: AceitarPedidoDeReservaDto,
  chave: string,
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<Aceite>>(
      comQuery(doPedido(id, '/aceitar'), { parceiroId: params?.parceiroId }),
      comIdempotencia(chave, json('POST', corpo)),
    ),
  )
}

/** A mensagem vai para a página do token e o e-mail, nunca para o push. Obrigatória em `OUTRO`. */
export function recusarPedidoDoHotel(
  id: string,
  corpo: RecusarPedidoDeReservaDto,
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<DetalheDoPedido>>(
      comQuery(doPedido(id, '/recusar'), { parceiroId: params?.parceiroId }),
      json('POST', corpo),
    ),
  )
}

export function lerReservaOnline(params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<ReservaOnline>>(
      comQuery(`${BASE}/reserva-online`, { parceiroId: params?.parceiroId }),
    ),
  )
}

/** O corpo inteiro. Ligar exige página publicada, um modo, um tipo com acomodação e o balcão. */
export function salvarReservaOnline(corpo: NovaReservaOnline, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<ReservaOnline>>(
      comQuery(`${BASE}/reserva-online`, { parceiroId: params?.parceiroId }),
      json('PUT', corpo),
    ),
  )
}
