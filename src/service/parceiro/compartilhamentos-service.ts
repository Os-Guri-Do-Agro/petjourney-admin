import { CAMPOS_LISTA, filtrarEstruturadoPorTipo } from '@/utils/parceiro/anotacao-estruturada'

import { apiFetch } from '../api'
import type { ApiEnvelope, CursorPage } from '../api-envelope'
import type {
  Anotacao,
  CompartilhamentoDetalhe,
  CompartilhamentoResumo,
  CompartilhamentosQuery,
  NovaAnotacaoPayload,
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

/**
 * Listagem paginada por cursor (keyset), com filtros resolvidos no servidor.
 * `status: 'ENCERRADO'` agrupa EXPIRADO + REVOGADO num cursor só — não paginar
 * os dois separadamente e juntar no cliente, que fura a ordem entre páginas.
 */
export function getCompartilhamentos(params?: ParceiroQuery & CompartilhamentosQuery) {
  return unwrap(
    apiFetch<ApiEnvelope<CursorPage<CompartilhamentoResumo>>>(
      `${BASE}${buildQuery({
        parceiroId: params?.parceiroId,
        status: params?.status,
        q: params?.q,
        especie: params?.especie,
        tipoServico: params?.tipoServico,
        ordenarPor: params?.ordenarPor,
        // Só quando ligado: `comProntuario=false` na URL chega como a string
        // "false" no backend, que é truthy antes do @Transform e ligaria o
        // filtro justamente ao desligá-lo. Omitir é o desligado.
        comProntuario: params?.comProntuario ? 'true' : undefined,
        vinculadoDe: params?.vinculadoDe,
        vinculadoAte: params?.vinculadoAte,
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

/**
 * Campos estruturados no multipart: escalares como texto simples, as duas listas
 * como **JSON string**. Lista mandada em campos repetidos (`prescricaoItens[0][nome]`)
 * ou como objeto falha em SILÊNCIO — o backend responde 201 e grava a anotação sem
 * a prescrição. Por isso a serialização é `JSON.stringify` e mora só aqui.
 */
function appendEstruturado(form: FormData, payload: NovaAnotacaoPayload) {
  const estruturado = filtrarEstruturadoPorTipo(payload.tipoServico, payload.estruturado)

  if (!estruturado) {
    return
  }

  for (const [campo, valor] of Object.entries(estruturado)) {
    if (valor == null) {
      continue
    }

    if ((CAMPOS_LISTA as readonly string[]).includes(campo)) {
      form.set(campo, JSON.stringify(valor))
      continue
    }

    form.set(campo, String(valor))
  }
}

/** Anotação autenticada. `empresaNome` sai do cadastro do parceiro (não enviar). */
export function criarAnotacao(id: string, payload: NovaAnotacaoPayload, params?: ParceiroQuery) {
  const form = new FormData()
  form.set('servicoRealizado', payload.servicoRealizado)
  form.set('texto', payload.texto)

  if (payload.profissionalNome?.trim()) {
    form.set('profissionalNome', payload.profissionalNome.trim())
  }

  // Campo ausente não entra no form, pela mesma razão dos estruturados: o backend precisa
  // poder distinguir "não mandou" de "mandou vazio".
  if (payload.profissionalEspecialidade?.trim()) {
    form.set('profissionalEspecialidade', payload.profissionalEspecialidade.trim())
  }

  appendEstruturado(form, payload)

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

/**
 * Signed URL de um arquivo do prontuário compartilhado (documentos do snapshot).
 * Rota separada da de anexo de anotação: o anexo é da própria empresa e sobrevive
 * ao encerramento, o cofre do prontuário é expurgado ao expirar/revogar — aqui a
 * API responde 409 assim que o acesso deixa de estar ATIVO.
 * Uma URL por clique: pedir em lote transformaria o acesso em coleta de tudo.
 */
export function getArquivoSignedUrl(id: string, arquivoId: string, params?: ParceiroQuery) {
  return unwrap(
    apiFetch<ApiEnvelope<{ signedUrl: string; expiresIn: number }>>(
      `${BASE}/${id}/arquivos/${arquivoId}/url${buildQuery({ parceiroId: params?.parceiroId })}`,
    ),
  )
}
