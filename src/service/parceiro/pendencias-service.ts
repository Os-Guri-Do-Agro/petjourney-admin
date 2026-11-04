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

/**
 * A rota do contador como o portal a conhece. Parte dos contadores da Clínica ainda manda
 * `/veterinario/...`, o endereço de antes de a Clínica virar `/clinica` (lacuna N4): o selo precisa
 * da rota de hoje para achar o item do menu.
 */
export function rotaDoPortal(rota: string) {
  return rota.replace(/^\/veterinario(?=[/?#]|$)/, '/clinica')
}

/**
 * A tela do contador, sem a busca: `/clinica/tratamentos?filtro=PEDEM_ATENCAO` é a tela de
 * Tratamentos.
 */
export function telaDaRota(rota: string) {
  return rota.split(/[?#]/, 1)[0] ?? rota
}

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

  return response.data.map((item) => ({ ...item, rota: rotaDoPortal(item.rota) }))
}
