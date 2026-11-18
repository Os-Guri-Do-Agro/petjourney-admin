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
import type {
  EfeitoDoDesligarDto,
  EuNoParceiroDto,
  ModuloDesligadoDto,
  ModuloDoPortalDto,
  ModuloLigadoDto,
} from '../contrato/openapi'

type ParceiroQuery = {
  parceiroId?: string | null
}

export type EuNoParceiro = EuNoParceiroDto
export type ModuloDoPortal = ModuloDoPortalDto
export type NomeDoModulo = ModuloDoPortalDto['modulo']
export type Permissao = EuNoParceiroDto['permissoes'][number]
export type ModuloLigado = ModuloLigadoDto
export type ModuloDesligado = ModuloDesligadoDto
export type EfeitoDoDesligar = EfeitoDoDesligarDto

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

/** `:modulo` vai em minúsculas na rota (`clinica`, `hotel`), como no `solicitar`. */
function rotaDoModulo(modulo: NomeDoModulo, acao: string, params?: ParceiroQuery) {
  return `/parceiro/portal/modulos/${modulo.toLowerCase()}/${acao}${buildParceiroQuery(params)}`
}

/**
 * Ligar pelo próprio DONO (pedidos de 17/11): o módulo que nunca teve, ou que está `SOLICITADO`,
 * ganha o teste grátis (`acao: 'TESTE_GRATIS'`); o que ele mesmo desligou volta ao status de antes,
 * com o mesmo prazo (`acao: 'RELIGADO'`). A tela só chama com `podeLigar`.
 */
export async function ligarModulo(modulo: NomeDoModulo, params?: ParceiroQuery) {
  const resposta = await apiFetch<ApiEnvelope<ModuloLigadoDto>>(
    rotaDoModulo(modulo, 'ligar', params),
    { method: 'POST', body: JSON.stringify({}) },
  )

  return resposta.data
}

/** A prévia do desligar: o que fica só para consulta (nada é cancelado nem apagado). */
export async function efeitoDoDesligar(modulo: NomeDoModulo, params?: ParceiroQuery) {
  const resposta = await apiFetch<ApiEnvelope<EfeitoDoDesligarDto>>(
    rotaDoModulo(modulo, 'efeito-do-desligar', params),
  )

  return resposta.data
}

/** Desligar pelo DONO (`podeDesligar`): o módulo vira `DESLIGADO`, a leitura continua. */
export async function desligarModulo(modulo: NomeDoModulo, params?: ParceiroQuery) {
  const resposta = await apiFetch<ApiEnvelope<ModuloDesligadoDto>>(
    rotaDoModulo(modulo, 'desligar', params),
    { method: 'POST', body: JSON.stringify({}) },
  )

  return resposta.data
}
