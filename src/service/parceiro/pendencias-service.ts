/**
 * Os contadores de pendência do parceiro (E1-06): os números dos selos do menu e da pauta do
 * Início, calculados no servidor. A rota já filtra pelo que a pessoa pode ver (permissão, CRMV e
 * módulo ligado) e devolve os zerados; quem omite o zero é a tela.
 */
import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'
import type { PendenciaDto } from '../contrato/openapi'

type ParceiroQuery = {
  parceiroId?: string | null
}

export type Pendencia = PendenciaDto
export type ModuloDaPendencia = PendenciaDto['modulo']
export type TomDaPendencia = PendenciaDto['tom']

export async function listarPendencias(
  params?: ParceiroQuery & { modulo?: ModuloDaPendencia },
): Promise<Pendencia[]> {
  const search = new URLSearchParams()

  if (params?.parceiroId) search.set('parceiroId', params.parceiroId)
  if (params?.modulo) search.set('modulo', params.modulo)

  const query = search.toString()
  const response = await apiFetch<ApiEnvelope<Pendencia[]>>(
    `/parceiro/portal/pendencias${query ? `?${query}` : ''}`,
  )

  return response.data
}
