/**
 * Os avisos do parceiro no sino do portal (E1-06): o inbox da conta (`/notificacao`) recortado
 * pelos avisos daquele parceiro (`?parceiroId=`).
 *
 * O contador do sino é `naoLidasDoParceiro`; `naoLidas` é o total da conta, que é o selo do app.
 * "Marcar todas" vai com o mesmo recorte (`PATCH /notificacao/read-all?parceiroId=`, N8): marca só
 * os avisos daquele parceiro, nunca os de outra empresa nem os dos pets no app.
 *
 * Os formatos são os do contrato (`InboxDeNotificacoesDto`, `TodasLidasDto`, N8). A rota do
 * aviso vem em `dados.url` e é rota do app (`/screens/...`): o portal não navega por ela.
 */
import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'
import type {
  InboxDeNotificacoesDto,
  NotificacaoDoInboxDto,
  TodasLidasDto,
} from '../contrato/openapi'

/**
 * Um aviso da lista. O `tipo` fica aberto: um tipo novo da API, antes de os tipos do contrato
 * serem gerados de novo, aparece no sino com o título e o corpo que vieram.
 */
export type Aviso = Omit<NotificacaoDoInboxDto, 'tipo'> & { tipo: string }

export type PaginaDeAvisos = Omit<InboxDeNotificacoesDto, 'itens'> & { itens: Aviso[] }

export type AvisosLidos = TodasLidasDto

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

/**
 * Marca como lidos todos os avisos deste parceiro, inclusive os que a lista ainda não carregou.
 * Sem o parceiro, a rota marcaria a conta inteira: o portal nunca chama sem ele.
 */
export async function marcarAvisosDoParceiroComoLidos(parceiroId: string): Promise<AvisosLidos> {
  const response = await apiFetch<ApiEnvelope<AvisosLidos>>(
    `/notificacao/read-all?${new URLSearchParams({ parceiroId }).toString()}`,
    { method: 'PATCH' },
  )

  return response.data
}
