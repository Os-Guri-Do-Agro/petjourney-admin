/**
 * A trilha de auditoria do estabelecimento (E1-05): quem leu, escreveu, publicou ou exportou dado
 * clínico, quando e em nome de quem. Nunca traz o conteúdo, só o nome dos campos.
 *
 * Abre para quem tem `auditoria.ler` (dono e gestão). A trilha de um paciente só (`/pacientes/:id/
 * auditoria`) entra com a tela do paciente, na E2.
 */
import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'
import type { EventoTrilhaDto, PaginaTrilhaDto } from '../contrato/openapi'

export type EventoDaTrilha = EventoTrilhaDto
export type AcaoDaTrilha = EventoTrilhaDto['acao']

export type FiltrosDaTrilha = {
  usuarioId?: string | null
  profissionalId?: string | null
  pacienteId?: string | null
  acao?: AcaoDaTrilha | null
  /** Instantes ISO: a API compara com `em`. */
  de?: string | null
  ate?: string | null
}

export const ACOES_DA_TRILHA: AcaoDaTrilha[] = [
  'LER',
  'CRIAR',
  'ALTERAR',
  'FINALIZAR',
  'ANULAR',
  'PUBLICAR',
  'IMPRIMIR',
  'EXPORTAR',
  'LER_DADO_DO_APP',
]

export async function listarTrilha(
  filtros: FiltrosDaTrilha & { cursor?: string | null; limit?: number },
  params?: { parceiroId?: string | null },
): Promise<PaginaTrilhaDto> {
  const search = new URLSearchParams()
  const entradas = { parceiroId: params?.parceiroId, ...filtros }

  for (const [chave, valor] of Object.entries(entradas)) {
    if (valor != null && valor !== '') {
      search.set(chave, String(valor))
    }
  }

  const query = search.toString()
  const response = await apiFetch<ApiEnvelope<PaginaTrilhaDto>>(
    `/parceiro/portal/auditoria${query ? `?${query}` : ''}`,
  )

  return response.data
}
