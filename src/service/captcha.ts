/**
 * Captcha das escritas públicas (E1-04, D6): Cloudflare Turnstile. O widget gera um token, que
 * vai no cabeçalho `X-Captcha-Token` do pedido; a API confere com a Cloudflare antes de gravar.
 *
 * Erros da API: 400 `CAPTCHA_INVALIDO` (refazer o widget) e 503 `CAPTCHA_INDISPONIVEL`
 * ("tente de novo").
 */

export const CABECALHO_DO_CAPTCHA = 'X-Captcha-Token'

/** Chave pública de teste da Cloudflare: aprova qualquer pedido. A API de dev aceita qualquer token. */
const CHAVE_DE_TESTE = '1x00000000000000000000AA'

/**
 * A site key do widget. Em produção vem do build (`VITE_TURNSTILE_SITE_KEY`); sem ela, só o
 * ambiente de desenvolvimento cai na chave de teste, e produção fica sem captcha (`null`), o que a
 * API recusa: melhor um erro visível que um widget que aprova tudo.
 */
export function chaveDoCaptcha(): string | null {
  const daBuild = (import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '').trim()

  if (daBuild) {
    return daBuild
  }

  return import.meta.env.DEV ? CHAVE_DE_TESTE : null
}

export function comCaptcha(token: string, init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers)
  headers.set(CABECALHO_DO_CAPTCHA, token)

  return { ...init, headers }
}
