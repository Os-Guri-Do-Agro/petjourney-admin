import { apiFetch } from '../api'
import type { ApiEnvelope, CursorPage, ExtratoPage } from '../api-envelope'
import { updateAccessToken } from '../auth/auth-session'
import type {
  Carteira,
  CupomParceiro,
  ModoParticipacao,
  ModoStatusBloco,
  PapelParceiro,
  ParceiroCadastro,
  ParceiroCadastroPayload,
  PortalDashboard,
  PortalIndicacao,
  PortalStatus,
  ResgateParceiro,
  SaqueDetalhe,
  SaqueResumo,
  StatusModoParceiro,
  TransacaoCarteira,
  ValidarCupomPayload,
  ValidarCupomResultado,
} from './types'

type ParceiroQuery = {
  parceiroId?: string | null
}

function buildParceiroQuery(params?: ParceiroQuery) {
  const search = new URLSearchParams()

  if (params?.parceiroId) {
    search.set('parceiroId', params.parceiroId)
  }

  const query = search.toString()

  return query ? `?${query}` : ''
}

async function unwrap<T>(promise: Promise<ApiEnvelope<T>>) {
  const response = await promise

  return response.data
}

export function getPortalDashboard(params?: ParceiroQuery) {
  return unwrap(
    apiFetch<ApiEnvelope<PortalDashboard>>(`/parceiro/portal/dashboard${buildParceiroQuery(params)}`),
  )
}

/** Fallback para backend sem os blocos da Parte 9 (deriva do campo legado). */
function deriveModoBloco(status: StatusModoParceiro): ModoStatusBloco {
  return {
    status,
    motivo: null,
    decididoEm: null,
    podeSolicitar: status === 'NAO_SOLICITADO' || status === 'REJEITADO',
  }
}

export async function getPortalStatus(params?: ParceiroQuery) {
  const raw = await unwrap(
    apiFetch<ApiEnvelope<PortalStatus>>(`/parceiro/portal/status${buildParceiroQuery(params)}`),
  )

  return {
    ...raw,
    afiliado: raw.afiliado ?? deriveModoBloco(raw.statusAfiliado),
    participativo: raw.participativo ?? deriveModoBloco(raw.statusParticipativo),
  } satisfies PortalStatus
}

/** Alias alinhado à spec (Parte 5). */
export const getStatus = getPortalStatus

type CadastroParceiroResult = {
  parceiroId: string
  statusAuditoria: 'PENDENTE'
  /** Multi-perfil: token fresco com perfilAtivo/parceiroAtivoId; ausente em backend antigo. */
  access_token?: string
}

/** Auto-cadastro (Parte 9). Também reenvia um cadastro REJEITADO (semântica replace: mande o form completo). */
export async function cadastrarParceiro(payload: ParceiroCadastroPayload) {
  const data = await unwrap(
    apiFetch<ApiEnvelope<CadastroParceiroResult>>('/parceiro/portal/cadastro', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  )

  /* Troca imediata do access_token (o refresh do device não muda): as próximas
     chamadas do portal já saem com o claim do parceiro recém-criado, sem relogin. */
  if (data.access_token) {
    updateAccessToken(data.access_token)
  }

  return data
}

export function getParceiroCadastro(params?: ParceiroQuery) {
  return unwrap(
    apiFetch<ApiEnvelope<ParceiroCadastro>>(
      `/parceiro/portal/cadastro${buildParceiroQuery(params)}`,
    ),
  )
}

/** Edição parcial (PENDENTE/APROVADO). Em REJEITADO o reenvio é `cadastrarParceiro`. */
export function atualizarParceiroCadastro(
  payload: Partial<ParceiroCadastroPayload>,
  params?: ParceiroQuery,
) {
  return unwrap(
    apiFetch<ApiEnvelope<ParceiroCadastro>>(
      `/parceiro/portal/cadastro${buildParceiroQuery(params)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
    ),
  )
}

export function getPortalIndicacao(params?: ParceiroQuery) {
  return unwrap(
    apiFetch<ApiEnvelope<PortalIndicacao>>(`/parceiro/portal/indicacao${buildParceiroQuery(params)}`),
  )
}

export function getPortalCupons(params?: ParceiroQuery & { cursor?: string; limit?: number }) {
  const search = new URLSearchParams()

  if (params?.parceiroId) {
    search.set('parceiroId', params.parceiroId)
  }

  if (params?.cursor) {
    search.set('cursor', params.cursor)
  }

  if (params?.limit) {
    search.set('limit', String(params.limit))
  }

  const query = search.toString()

  return unwrap(
    apiFetch<ApiEnvelope<CursorPage<CupomParceiro>>>(
      `/parceiro/portal/cupons${query ? `?${query}` : ''}`,
    ),
  )
}

export function getPortalResgates(params?: ParceiroQuery & { cursor?: string; limit?: number }) {
  const search = new URLSearchParams()

  if (params?.parceiroId) {
    search.set('parceiroId', params.parceiroId)
  }

  if (params?.cursor) {
    search.set('cursor', params.cursor)
  }

  if (params?.limit) {
    search.set('limit', String(params.limit))
  }

  const query = search.toString()

  return unwrap(
    apiFetch<ApiEnvelope<CursorPage<ResgateParceiro>>>(
      `/parceiro/portal/resgates${query ? `?${query}` : ''}`,
    ),
  )
}

/** Efetiva o resgate no balcão. Um POST de sucesso = um resgate consumido. */
export function validarCupom(payload: ValidarCupomPayload, params?: ParceiroQuery) {
  return unwrap(
    apiFetch<ApiEnvelope<ValidarCupomResultado>>(
      `/parceiro/portal/cupons/validar${buildParceiroQuery(params)}`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),
  )
}

export function getCarteira(params?: ParceiroQuery) {
  return unwrap(
    apiFetch<ApiEnvelope<Carteira>>(`/parceiro/portal/carteira${buildParceiroQuery(params)}`),
  )
}

export function getCarteiraExtrato(
  params?: ParceiroQuery & { cursor?: string; limit?: number },
) {
  const search = new URLSearchParams()

  if (params?.parceiroId) {
    search.set('parceiroId', params.parceiroId)
  }

  if (params?.cursor) {
    search.set('cursor', params.cursor)
  }

  if (params?.limit) {
    search.set('limit', String(params.limit))
  }

  const query = search.toString()

  return unwrap(
    apiFetch<ApiEnvelope<ExtratoPage & { items: TransacaoCarteira[] }>>(
      `/parceiro/portal/carteira/extrato${query ? `?${query}` : ''}`,
    ),
  )
}

export function updateCarteiraPix(chavePix: string, params?: ParceiroQuery) {
  return unwrap(
    apiFetch<ApiEnvelope<{ parceiroId: string; chavePix: string }>>(
      `/parceiro/portal/carteira/pix${buildParceiroQuery(params)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ chavePix }),
      },
    ),
  )
}

export function solicitarSaque(valorCentavos: number, params?: ParceiroQuery) {
  return unwrap(
    apiFetch<ApiEnvelope<SaqueResumo>>(`/parceiro/portal/saques${buildParceiroQuery(params)}`, {
      method: 'POST',
      body: JSON.stringify({ valorCentavos }),
    }),
  )
}

export function getSaques(params?: ParceiroQuery) {
  return unwrap(
    apiFetch<ApiEnvelope<SaqueResumo[]>>(`/parceiro/portal/saques${buildParceiroQuery(params)}`),
  )
}

export function getSaqueDetalhe(id: string, params?: ParceiroQuery) {
  return unwrap(
    apiFetch<ApiEnvelope<SaqueDetalhe>>(
      `/parceiro/portal/saques/${id}${buildParceiroQuery(params)}`,
    ),
  )
}

export function solicitarModo(modo: ModoParticipacao, params?: ParceiroQuery) {
  return unwrap(
    apiFetch<ApiEnvelope<{ modo: ModoParticipacao; status: 'SOLICITADO' }>>(
      `/parceiro/portal/modos/${modo}/solicitar${buildParceiroQuery(params)}`,
      {
        method: 'POST',
        // Nest rejeita POST com Content-Type JSON e body ausente; `{}` é o body vazio válido.
        body: JSON.stringify({}),
      },
    ),
  )
}

export function convidarMembroEquipe(
  payload: { email: string; papel: PapelParceiro },
  params?: ParceiroQuery,
) {
  return unwrap(
    apiFetch<ApiEnvelope<{ parceiroId: string; usuarioId: string; papel: PapelParceiro; status: 'PENDENTE' }>>(
      `/parceiro/portal/equipe/convites${buildParceiroQuery(params)}`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),
  )
}

export function aceitarConviteEquipe(parceiroId: string) {
  return unwrap(
    apiFetch<ApiEnvelope<{ parceiroId: string; status: 'ACEITO' }>>(
      `/parceiro/portal/equipe/convites/aceitar?parceiroId=${encodeURIComponent(parceiroId)}`,
      { method: 'PATCH' },
    ),
  )
}

export function removerMembroEquipe(usuarioId: string, params?: ParceiroQuery) {
  return apiFetch<void>(
    `/parceiro/portal/equipe/${usuarioId}${buildParceiroQuery(params)}`,
    { method: 'DELETE' },
  )
}
