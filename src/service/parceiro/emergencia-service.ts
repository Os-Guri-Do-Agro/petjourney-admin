/**
 * Ficha de emergência pelo QR da coleira (PJ-4NARE1, L6): o pet chega sem o responsável, o
 * veterinário com CRMV conferido informa o motivo e recebe uma ficha curta (alergias, remédios
 * contínuos, condições e peso). A API grava a abertura e avisa o responsável na hora.
 *
 * `POST /parceiro/portal/emergencia/ficha` com `{ publicSlug, motivo }`. Não depende de módulo: o
 * filtro é o selo do CRMV do próprio login, conferido na API (403 `EMERGENCIA_SEM_CRMV_CONFERIDO`).
 * Os outros erros, pelo código: 404 `EMERGENCIA_FICHA_INDISPONIVEL` (o mesmo para QR inexistente,
 * pet inativo, ficha desligada, pet sem responsável e clínica bloqueada), 429 `EMERGENCIA_LIMITE`
 * (10 por pessoa e 30 por clínica em 24 h) e 400 (motivo fora de 10 a 300 caracteres).
 */
import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'
import type { FichaDeEmergenciaDto } from '../contrato/openapi'

export type FichaDeEmergencia = FichaDeEmergenciaDto

type ParceiroQuery = { parceiroId?: string | null }

/** O responsável lê o motivo no app: obrigatório, de 10 a 300 caracteres (D2). */
export const MOTIVO_MIN = 10
export const MOTIVO_MAX = 300

export function motivoValido(motivo: string) {
  const tamanho = motivo.trim().length

  return tamanho >= MOTIVO_MIN && tamanho <= MOTIVO_MAX
}

/** O slug da carteirinha: 4 a 64 caracteres (hoje, 32 em hexadecimal). */
const SLUG = /^[A-Za-z0-9_-]{4,64}$/

export type LeituraDoQr =
  | { slug: string }
  /** O QR do responsável (`/tutor/<slug>`): a lista dos pets, não a carteirinha de um. */
  | { problema: 'qrDoResponsavel' }
  /** Outro endereço, como o link curto do QR, que não traz o slug da carteirinha. */
  | { problema: 'linkSemCarteirinha' }
  | { problema: 'vazio' }

/**
 * O slug do que a pessoa colou: o endereço da carteirinha (`petjourney.health/carteirinha/<slug>`
 * ou o antigo `/public/<slug>`) ou o próprio slug.
 *
 * O QR da coleira aponta para um link curto do serviço de QR, que só depois redireciona para a
 * carteirinha; por isso o que serve é o endereço da página que o QR abre, não o link curto.
 */
export function lerQr(texto: string): LeituraDoQr {
  const valor = texto.trim()

  if (!valor) return { problema: 'vazio' }
  if (SLUG.test(valor)) return { slug: valor }

  let url: URL

  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(valor) ? valor : `https://${valor}`)
  } catch {
    return { problema: 'linkSemCarteirinha' }
  }

  const partes = url.pathname.split('/').filter(Boolean)

  if (partes[0] === 'tutor' || (partes[0] === 'public' && partes[1] === 'tutor')) {
    return { problema: 'qrDoResponsavel' }
  }

  const slug = partes[0] === 'carteirinha' || partes[0] === 'public' ? partes[1] : undefined

  return slug && SLUG.test(slug) ? { slug } : { problema: 'linkSemCarteirinha' }
}

export async function abrirFichaDeEmergencia(
  entrada: { publicSlug: string; motivo: string },
  params?: ParceiroQuery,
): Promise<FichaDeEmergencia> {
  const caminho = params?.parceiroId
    ? `/parceiro/portal/emergencia/ficha?parceiroId=${encodeURIComponent(params.parceiroId)}`
    : '/parceiro/portal/emergencia/ficha'

  const resposta = await apiFetch<ApiEnvelope<FichaDeEmergencia>>(caminho, {
    method: 'POST',
    body: JSON.stringify({ publicSlug: entrada.publicSlug, motivo: entrada.motivo.trim() }),
  })

  return resposta.data
}
