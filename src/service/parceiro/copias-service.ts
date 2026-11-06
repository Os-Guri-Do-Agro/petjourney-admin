/**
 * Cópia do prontuário pela API (E4-06c, PJ-0EK0TY). Guia `portal-parceiro-e4.md`, seções 10 e 14.1.
 *
 * O pedido chega pelo app (o dono) ou pelo balcão; vence em 5 dias úteis (o servidor conta). Gerar
 * roda em segundo plano (202, `GERANDO`): a tela relê a cada 2 ou 3 segundos até sair desse status.
 * O PDF fica 7 dias; entregar fecha o pedido. Prorrogar e recusar são do responsável técnico (pedem
 * o CRMV de quem clica). Quem entra: `copia.gerir` (o dono e o gestor).
 */
import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'
import type {
  PaginaDePedidosDeCopiaDto,
  PedidoDeCopiaDto,
  PedidoDeCopiaRegistradoDto,
  UrlDaCopiaDto,
} from '../contrato/openapi'

export type PedidoDeCopia = PedidoDeCopiaDto
export type StatusDaCopia = PedidoDeCopiaDto['status']
export type UrlDaCopia = UrlDaCopiaDto

/** Justificativa de prorrogar e motivo de recusar: 20 a 1000. */
export const TEXTO_MIN = 20
export const TEXTO_MAX = 1000
/** A tela relê o pedido que está gerando nesse ritmo. */
export const RELER_GERACAO_MS = 2500

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

const BASE = '/parceiro/portal/clinica/pedidos-de-copia'
const doPedido = (id: string, resto = '') => `${BASE}/${encodeURIComponent(id)}${resto}`

function post(corpo?: unknown): RequestInit {
  return corpo === undefined ? { method: 'POST' } : { method: 'POST', body: JSON.stringify(corpo) }
}

export function listarPedidosDeCopia(
  filtro: { situacao: 'ABERTOS' | 'ENCERRADOS'; cursor?: string | null; limit?: number },
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<PaginaDePedidosDeCopiaDto>>(
      comQuery(BASE, {
        situacao: filtro.situacao,
        cursor: filtro.cursor,
        limit: filtro.limit ?? 30,
        parceiroId: params?.parceiroId,
      }),
    ),
  )
}

export function lerPedidoDeCopia(id: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<PedidoDeCopia>>(
      comQuery(doPedido(id), { parceiroId: params?.parceiroId }),
    ),
  )
}

/** O pedido do balcão. Já aberto do mesmo paciente e período: o mesmo (`jaExistia`). */
export function registrarPedidoDeCopia(
  corpo: {
    pacienteId: string
    solicitanteNome: string
    solicitanteDocumento: string
    de?: string
    ate?: string
  },
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<PedidoDeCopiaRegistradoDto>>(
      comQuery(BASE, { parceiroId: params?.parceiroId }),
      post(corpo),
    ),
  )
}

export function prorrogarPedidoDeCopia(id: string, justificativa: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<PedidoDeCopia>>(
      comQuery(doPedido(id, '/prorrogar'), { parceiroId: params?.parceiroId }),
      post({ justificativa }),
    ),
  )
}

export function recusarPedidoDeCopia(id: string, motivo: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<PedidoDeCopia>>(
      comQuery(doPedido(id, '/recusar'), { parceiroId: params?.parceiroId }),
      post({ motivo }),
    ),
  )
}

/** 202: o pedido vai a `GERANDO`. O período opcional troca o do pedido. */
export function gerarCopia(
  id: string,
  periodo: { de?: string; ate?: string } = {},
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<PedidoDeCopia>>(
      comQuery(doPedido(id, '/gerar'), { parceiroId: params?.parceiroId }),
      post(periodo),
    ),
  )
}

export function pdfDaCopia(id: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<UrlDaCopia>>(
      comQuery(doPedido(id, '/pdf'), { parceiroId: params?.parceiroId }),
    ),
  )
}

export function entregarCopia(
  id: string,
  canal: 'MAOS' | 'EMAIL_DO_RESPONSAVEL',
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<PedidoDeCopia>>(
      comQuery(doPedido(id, '/entregar'), { parceiroId: params?.parceiroId }),
      post({ canal }),
    ),
  )
}

/** O pedido ainda pede ação (os encerrados não têm botão). */
export function pedidoAberto(status: StatusDaCopia) {
  return (
    status === 'ABERTO' || status === 'PRORROGADO' || status === 'GERANDO' || status === 'PRONTO'
  )
}
