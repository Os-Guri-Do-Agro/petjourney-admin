/**
 * Os avisos do parceiro no sino do portal (E1-06): o inbox da conta (`/notificacao`) recortado
 * pelos avisos daquele parceiro (`?parceiroId=`).
 *
 * O contador do sino é `naoLidasDoParceiro`; `naoLidas` é o total da conta, que é o selo do app.
 * O "marcar todas" da API (`PATCH /notificacao/read-all`) marca a conta inteira, inclusive os avisos
 * dos pets no app, por isso o portal marca um por um.
 *
 * A lista não tem schema no contrato (`docs/integracao-portal-parceiro/lacunas-da-api.md`, L3): o
 * formato abaixo é o de `NotificacaoLista` em `notificacao-inbox.service.ts` da API.
 */
import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'

export type Aviso = {
  id: string
  tipo: string
  /** Título e corpo já no idioma da sessão. */
  titulo: string
  corpo: string
  /** O retrato do evento. Sempre traz `parceiroId`; o resto depende do tipo. */
  dados: Record<string, unknown>
  criadoEm: string
  lidaEm: string | null
}

export type PaginaDeAvisos = {
  itens: Aviso[]
  proximoCursor: string | null
  /** Não lidas da conta inteira (o selo do app). */
  naoLidas: number
  /** Não lidas deste parceiro: o número do sino. Só vem com `?parceiroId=`. */
  naoLidasDoParceiro?: number
}

export async function listarAvisos(params: {
  parceiroId?: string | null
  cursor?: string | null
  limit?: number
}): Promise<PaginaDeAvisos> {
  const search = new URLSearchParams()

  if (params.parceiroId) search.set('parceiroId', params.parceiroId)
  if (params.cursor) search.set('cursor', params.cursor)
  if (params.limit) search.set('limit', String(params.limit))

  const query = search.toString()
  const response = await apiFetch<ApiEnvelope<PaginaDeAvisos>>(
    `/notificacao${query ? `?${query}` : ''}`,
  )

  return response.data
}

/** Quem abriu o aviso na lista: grava o toque (origem INBOX) e marca como lido. */
export async function abrirAviso(id: string) {
  const response = await apiFetch<ApiEnvelope<{ naoLidas: number }>>(
    `/notificacao/${encodeURIComponent(id)}/toque`,
    { method: 'PATCH', body: JSON.stringify({ origem: 'INBOX' }) },
  )

  return response.data
}

/** Marca um aviso como lido sem contar como toque. Idempotente. */
export async function marcarAvisoComoLido(id: string) {
  const response = await apiFetch<ApiEnvelope<{ id: string; lidaEm: string; naoLidas: number }>>(
    `/notificacao/${encodeURIComponent(id)}/read`,
    { method: 'PATCH' },
  )

  return response.data
}
