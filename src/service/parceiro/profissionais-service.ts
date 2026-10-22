/**
 * Os profissionais do parceiro (E1-03): quem atende, aplica, prescreve ou cuida, com o conselho
 * (CRMV), as especialidades e a cor da coluna na agenda. A ficha existe com ou sem login: o
 * plantonista que não usa o portal também é profissional.
 *
 * Nunca se apaga: desativar guarda a ficha (o prontuário cita quem atendeu). Trocar o número ou a
 * UF, ou ligar uma ficha sem login a um login, tira o selo de "CRMV conferido".
 */
import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'
import type { ProfissionalDto } from '../contrato/openapi'

type ParceiroQuery = {
  parceiroId?: string | null
}

export type Profissional = ProfissionalDto
export type ConselhoProfissional = ProfissionalDto['conselho']

/**
 * O corpo de criar e alterar. Os campos que podem ser nulos estão declarados aqui porque o
 * contrato os gera como objeto vazio (`docs/integracao-portal-parceiro/lacunas-da-api.md`, L2).
 */
export type DadosDoProfissional = {
  nome?: string
  conselho?: ConselhoProfissional
  registro?: string | null
  uf?: string | null
  especialidades?: string[]
  corIndice?: number
  atendeNaAgenda?: boolean
  usuarioId?: string | null
  /** Só no alterar: reativa (`true`) ou desativa (`false`). */
  ativo?: boolean
}

const BASE = '/parceiro/portal/profissionais'

function buildQuery(entries: Record<string, string | boolean | null | undefined>) {
  const search = new URLSearchParams()

  for (const [chave, valor] of Object.entries(entries)) {
    if (valor != null && valor !== '') {
      search.set(chave, String(valor))
    }
  }

  const query = search.toString()

  return query ? `?${query}` : ''
}

async function unwrap<T>(promise: Promise<ApiEnvelope<T>>) {
  const response = await promise

  return response.data
}

export function listarProfissionais(
  params?: ParceiroQuery & { ativo?: boolean; atendeNaAgenda?: boolean },
) {
  return unwrap(
    apiFetch<ApiEnvelope<Profissional[]>>(
      `${BASE}${buildQuery({
        parceiroId: params?.parceiroId,
        ativo: params?.ativo,
        atendeNaAgenda: params?.atendeNaAgenda,
      })}`,
    ),
  )
}

export function cadastrarProfissional(dados: DadosDoProfissional, params?: ParceiroQuery) {
  return unwrap(
    apiFetch<ApiEnvelope<Profissional>>(
      `${BASE}${buildQuery({ parceiroId: params?.parceiroId })}`,
      {
        method: 'POST',
        body: JSON.stringify(dados),
      },
    ),
  )
}

export function alterarProfissional(
  id: string,
  dados: DadosDoProfissional,
  params?: ParceiroQuery,
) {
  return unwrap(
    apiFetch<ApiEnvelope<Profissional>>(
      `${BASE}/${encodeURIComponent(id)}${buildQuery({ parceiroId: params?.parceiroId })}`,
      { method: 'PATCH', body: JSON.stringify(dados) },
    ),
  )
}

export function desativarProfissional(id: string, params?: ParceiroQuery) {
  return unwrap(
    apiFetch<ApiEnvelope<Profissional>>(
      `${BASE}/${encodeURIComponent(id)}/desativar${buildQuery({ parceiroId: params?.parceiroId })}`,
      { method: 'POST', body: JSON.stringify({}) },
    ),
  )
}
