import { apiFetch } from '../api'
import type { ApiEnvelope, CursorPage } from '../api-envelope'
import type {
  Anotacao,
  CompartilhamentoDetalhe,
  CompartilhamentoResumo,
  NovaAnotacaoPayload,
  StatusCompartilhamento,
} from './types'

type ParceiroQuery = {
  parceiroId?: string | null
}

const BASE = '/parceiro/portal/compartilhamentos'

async function unwrap<T>(promise: Promise<ApiEnvelope<T>>) {
  const response = await promise

  return response.data
}

function buildQuery(entries: Record<string, string | number | null | undefined>) {
  const search = new URLSearchParams()

  for (const [key, value] of Object.entries(entries)) {
    if (value != null && value !== '') {
      search.set(key, String(value))
    }
  }

  const query = search.toString()

  return query ? `?${query}` : ''
}

/** O backend aceita espaços/hífens no código, mas normalizamos para validar os 6 dígitos localmente. */
export function normalizarCodigoVinculo(raw: string) {
  return raw.replace(/\D/g, '')
}

export function isCodigoVinculoValido(codigo: string) {
  return /^\d{6}$/.test(codigo)
}

/** Vincula (claim) o compartilhamento pelo código. Idempotente; resposta já é o detalhe completo. */
export function vincularCompartilhamento(codigo: string, params?: ParceiroQuery) {
  return unwrap(
    apiFetch<ApiEnvelope<CompartilhamentoDetalhe>>(
      `${BASE}/vincular${buildQuery({ parceiroId: params?.parceiroId })}`,
      {
        method: 'POST',
        body: JSON.stringify({ codigo }),
      },
    ),
  )
}

export function getCompartilhamentos(
  params?: ParceiroQuery & {
    status?: StatusCompartilhamento
    cursor?: string
    limit?: number
  },
) {
  return unwrap(
    apiFetch<ApiEnvelope<CursorPage<CompartilhamentoResumo>>>(
      `${BASE}${buildQuery({
        parceiroId: params?.parceiroId,
        status: params?.status,
        cursor: params?.cursor,
        limit: params?.limit,
      })}`,
    ),
  )
}

export function getCompartilhamentoDetalhe(id: string, params?: ParceiroQuery) {
  return unwrap(
    apiFetch<ApiEnvelope<CompartilhamentoDetalhe>>(
      `${BASE}/${id}${buildQuery({ parceiroId: params?.parceiroId })}`,
    ),
  )
}

/** Anotação autenticada. `empresaNome` sai do cadastro do parceiro (não enviar). */
export function criarAnotacao(id: string, payload: NovaAnotacaoPayload, params?: ParceiroQuery) {
  const form = new FormData()
  form.set('servicoRealizado', payload.servicoRealizado)
  form.set('texto', payload.texto)

  if (payload.profissionalNome?.trim()) {
    form.set('profissionalNome', payload.profissionalNome.trim())
  }

  if (payload.anexos?.length) {
    for (const file of payload.anexos) {
      form.append('anexos', file)
    }

    if (payload.tiposDocumento?.length) {
      form.set('tiposDocumento', JSON.stringify(payload.tiposDocumento))
    }
  }

  return unwrap(
    apiFetch<ApiEnvelope<Anotacao>>(
      `${BASE}/${id}/anotacoes${buildQuery({ parceiroId: params?.parceiroId })}`,
      {
        method: 'POST',
        body: form,
      },
    ),
  )
}

/** Signed URL de anexo (15 min). Gerar on-demand a cada abertura; nunca persistir a URL. */
export function getAnexoSignedUrl(id: string, anexoId: string, params?: ParceiroQuery) {
  return unwrap(
    apiFetch<ApiEnvelope<{ signedUrl: string; expiresIn: number }>>(
      `${BASE}/${id}/anexos/${anexoId}/url${buildQuery({ parceiroId: params?.parceiroId })}`,
    ),
  )
}
