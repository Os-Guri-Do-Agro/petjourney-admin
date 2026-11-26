/**
 * O QR da coleira lido no portal (N19, guia de 25/11): o texto que a câmera ou o leitor de mão
 * leu vai como veio para `GET /parceiro/portal/carteirinha/resolver?qr=`, e a API devolve o
 * `publicSlug` da carteirinha, que segue para a proposta de vínculo (`POST vinculos/por-qr`).
 *
 * A API aceita as três formas do QR: o link curto do serviço de QR (`.../q/<código>`), só o
 * código, e o link antigo (`/public/<slug>` ou `/carteirinha/<slug>`). O portal não interpreta o
 * texto: o link curto não traz o slug, e o navegador não segue o redirecionamento de outro domínio.
 *
 * Erros pelo `codigo`: 404 `CARTEIRINHA_NAO_ENCONTRADA` (o mesmo para QR desconhecido, que não é
 * de carteirinha, pet inativo, de ONG ou com o dono saindo) e 429 `CARTEIRINHA_TAXA_EXCEDIDA`
 * (30 leituras por minuto por pessoa, com `tenteDeNovoEmSegundos`). Exige `paciente.ler`.
 */
import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'
import type { CarteirinhaResolvidaDto } from '../contrato/openapi'

type ParceiroQuery = { parceiroId?: string | null }

export async function resolverCarteirinha(
  lido: string,
  params?: ParceiroQuery,
): Promise<CarteirinhaResolvidaDto> {
  const busca = new URLSearchParams()

  if (params?.parceiroId) busca.set('parceiroId', params.parceiroId)
  busca.set('qr', lido.trim())

  const resposta = await apiFetch<ApiEnvelope<CarteirinhaResolvidaDto>>(
    `/parceiro/portal/carteirinha/resolver?${busca.toString()}`,
  )

  return resposta.data
}
