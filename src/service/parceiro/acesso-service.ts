/**
 * O que esta conta pode fazer neste parceiro (E1-02 e E1-03): módulos ligados no servidor,
 * papel, papéis operacionais, a ficha de profissional e as permissões da matriz.
 *
 * O menu do portal sai daqui: um destino de Clínica ou Hotel aparece quando o módulo tem
 * `podeLer` **e** a conta tem a permissão daquela tela. Botão de criar ou alterar também exige
 * `podeEscrever`. Nada disso se recalcula no portal.
 */
import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'
import type { EuNoParceiroDto, ModuloDoPortalDto } from '../contrato/openapi'

type ParceiroQuery = {
  parceiroId?: string | null
}

export type EuNoParceiro = EuNoParceiroDto
export type ModuloDoPortal = ModuloDoPortalDto
export type NomeDoModulo = ModuloDoPortalDto['modulo']
export type Permissao = EuNoParceiroDto['permissoes'][number]

function buildParceiroQuery(params?: ParceiroQuery) {
  return params?.parceiroId ? `?parceiroId=${encodeURIComponent(params.parceiroId)}` : ''
}

export async function obterEuNoParceiro(params?: ParceiroQuery) {
  const resposta = await apiFetch<ApiEnvelope<EuNoParceiroDto>>(
    `/parceiro/portal/eu${buildParceiroQuery(params)}`,
  )

  return resposta.data
}

/** Só o DONO, e só com `podeSolicitar`; a resposta é `{ modulo, status: 'SOLICITADO' }`. */
export async function solicitarModulo(modulo: NomeDoModulo, params?: ParceiroQuery) {
  const resposta = await apiFetch<ApiEnvelope<{ modulo: NomeDoModulo; status: 'SOLICITADO' }>>(
    `/parceiro/portal/modulos/${modulo.toLowerCase()}/solicitar${buildParceiroQuery(params)}`,
    { method: 'POST', body: JSON.stringify({}) },
  )

  return resposta.data
}
