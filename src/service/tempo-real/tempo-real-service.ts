/**
 * As duas rotas do canal de tempo real (PJ-3SO0WX). O ticket sai com o login; o stream abre só com
 * ele, porque o `EventSource` do navegador não manda cabeçalho (nem `withCredentials`).
 */
import { apiFetch, getApiUrl } from '@/service/api'
import type { ApiEnvelope } from '@/service/api-envelope'
import type { TicketDoTempoRealDto } from '@/service/contrato/openapi'

/**
 * `POST /eventos/ticket`: uso único, 60 s. O portal manda sempre o parceiro (o canal da equipe).
 * 403 `OWNERSHIP_FORBIDDEN` (não é membro ativo), 429 `TEMPO_REAL_TAXA_EXCEDIDA` (40 em 10 min),
 * 404 (canal desligado no ambiente).
 */
export async function pedirTicketDoTempoReal(parceiroId: string) {
  const resposta = await apiFetch<ApiEnvelope<TicketDoTempoRealDto>>('/eventos/ticket', {
    method: 'POST',
    body: JSON.stringify({ parceiroId }),
  })

  return resposta.data
}

/** `GET /eventos?ticket=`: o stream (`text/event-stream`). */
export function enderecoDoCanal(ticket: string) {
  return `${getApiUrl()}/eventos?ticket=${encodeURIComponent(ticket)}`
}
