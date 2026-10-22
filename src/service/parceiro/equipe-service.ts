/**
 * A equipe do parceiro (E0-01): lista, convite por e-mail, convite aceito só pelo link, troca de
 * papel, remoção e saída. Guia: `docs/integracao-portal-parceiro/guias/portal-parceiro-e0.md`.
 *
 * O convite novo só se aceita pelo token do link do e-mail; a caixa (`meus-convites`) é aviso,
 * e só o convite antigo (`aceitaPor: 'CAIXA'`) aceita por lá.
 */
import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'
import type {
  ConviteAceitoDto,
  ConviteCriadoDto,
  EquipeParceiroDto,
  MembroAtualizadoDto,
  MeuConviteDto,
  PapeisDoMembroDto,
} from '../contrato/openapi'
import type { PapelParceiro } from './types'

type ParceiroQuery = {
  parceiroId?: string | null
}

/** As funções operacionais da matriz de permissão (recepção, veterinário, enfermagem...). */
export type PapelOperacional = PapeisDoMembroDto['papeisOperacionais'][number]

const BASE = '/parceiro/portal/equipe'

function buildParceiroQuery(params?: ParceiroQuery) {
  return params?.parceiroId ? `?parceiroId=${encodeURIComponent(params.parceiroId)}` : ''
}

async function unwrap<T>(promise: Promise<ApiEnvelope<T>>) {
  const response = await promise

  return response.data
}

/* O id do convite antigo é `legado:<id>`: os dois-pontos vão codificados no caminho. */
function idNoCaminho(id: string) {
  return encodeURIComponent(id)
}

export function listarEquipe(params?: ParceiroQuery) {
  return unwrap(apiFetch<ApiEnvelope<EquipeParceiroDto>>(`${BASE}${buildParceiroQuery(params)}`))
}

export function convidarParaEquipe(
  payload: { email: string; papel: PapelParceiro },
  params?: ParceiroQuery,
) {
  return unwrap(
    apiFetch<ApiEnvelope<ConviteCriadoDto>>(`${BASE}/convites${buildParceiroQuery(params)}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  )
}

export function cancelarConvite(conviteId: string, params?: ParceiroQuery) {
  return apiFetch<void>(`${BASE}/convites/${idNoCaminho(conviteId)}${buildParceiroQuery(params)}`, {
    method: 'DELETE',
  })
}

export function reenviarConvite(conviteId: string, params?: ParceiroQuery) {
  return unwrap(
    apiFetch<ApiEnvelope<ConviteCriadoDto>>(
      `${BASE}/convites/${idNoCaminho(conviteId)}/reenviar${buildParceiroQuery(params)}`,
      { method: 'POST', body: JSON.stringify({}) },
    ),
  )
}

export function trocarPapelDoMembro(
  usuarioId: string,
  papel: PapelParceiro,
  params?: ParceiroQuery,
) {
  return unwrap(
    apiFetch<ApiEnvelope<MembroAtualizadoDto>>(
      `${BASE}/${idNoCaminho(usuarioId)}${buildParceiroQuery(params)}`,
      { method: 'PATCH', body: JSON.stringify({ papel }) },
    ),
  )
}

export function removerDaEquipe(usuarioId: string, params?: ParceiroQuery) {
  return apiFetch<void>(`${BASE}/${idNoCaminho(usuarioId)}${buildParceiroQuery(params)}`, {
    method: 'DELETE',
  })
}

export function sairDaEquipe(params?: ParceiroQuery) {
  return apiFetch<void>(`${BASE}/sair${buildParceiroQuery(params)}`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

/** Os convites que chegaram para a conta logada, mesmo sem ela ser membro de parceiro nenhum. */
export function listarMeusConvites() {
  return unwrap(apiFetch<ApiEnvelope<MeuConviteDto[]>>(`${BASE}/meus-convites`))
}

/** Só o convite antigo (`aceitaPor: 'CAIXA'`); o novo responde 403 `CONVITE_EXIGE_LINK`. */
export function aceitarConviteDaCaixa(conviteId: string) {
  return unwrap(
    apiFetch<ApiEnvelope<ConviteAceitoDto>>(
      `${BASE}/meus-convites/${idNoCaminho(conviteId)}/aceitar`,
      { method: 'POST', body: JSON.stringify({}) },
    ),
  )
}

export function recusarConviteDaCaixa(conviteId: string) {
  return apiFetch<void>(`${BASE}/meus-convites/${idNoCaminho(conviteId)}/recusar`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export function aceitarConvitePorLink(token: string) {
  return unwrap(
    apiFetch<ApiEnvelope<ConviteAceitoDto>>(`${BASE}/convites/aceitar-por-link`, {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
  )
}

export function recusarConvitePorLink(token: string) {
  return apiFetch<void>(`${BASE}/convites/recusar-por-link`, {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
}

/**
 * As funções do membro na clínica ou no hotel (E1-03): substitui a lista inteira. Só DONO.
 * OPERADOR sem função continua vendo só o portal comercial.
 */
export function definirFuncoesDoMembro(
  usuarioId: string,
  papeisOperacionais: PapelOperacional[],
  params?: ParceiroQuery,
) {
  return unwrap(
    apiFetch<ApiEnvelope<PapeisDoMembroDto>>(
      `${BASE}/${idNoCaminho(usuarioId)}/papeis${buildParceiroQuery(params)}`,
      { method: 'PUT', body: JSON.stringify({ papeisOperacionais }) },
    ),
  )
}
