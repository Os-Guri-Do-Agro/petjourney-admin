import i18n from '@/i18n'
import { API_LOCALE, DEFAULT_LOCALE, isLocale } from '@/i18n/locales'

import { clearAuthSession, getAccessToken } from './auth/auth-session'

// Fonte única: o Vite escolhe .env.development no dev e .env.production no build.
const API_URL = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '')

export class ApiError extends Error {
  readonly statusCode: number
  readonly error?: string
  /** Código estável de erro do funil de parceiro (Parte 9). Roteie UX por ele, nunca pela message. */
  readonly reason?: string
  /**
   * Código estável das rotas novas do portal (equipe, módulos, Clínica, Hotel): decide a tela; a
   * `message` só se mostra. String e não enum porque o `openapi.json` ainda não exporta a lista.
   */
  readonly codigo?: string
  /** O resto do corpo de erro, que alguns códigos trazem: `faltando`, `permissao`, `campo`... */
  readonly detalhes: Readonly<Record<string, unknown>>

  constructor(
    message: string,
    statusCode: number,
    error?: string,
    reason?: string,
    extra: { codigo?: string; detalhes?: Record<string, unknown> } = {},
  ) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.error = error
    this.reason = reason
    this.codigo = extra.codigo
    this.detalhes = extra.detalhes ?? {}
  }
}

/** O que sobra do corpo de erro depois dos campos que o `ApiError` já tem com nome. */
function detalhesDoErro(corpo: Record<string, unknown> | null) {
  if (!corpo) {
    return {}
  }

  const {
    message: _message,
    statusCode: _statusCode,
    error: _error,
    reason: _reason,
    codigo: _codigo,
    timestamp: _timestamp,
    path: _path,
    ...detalhes
  } = corpo

  return detalhes
}

export function getApiUrl() {
  return API_URL
}

/**
 * Build sem `VITE_API_URL` deixa a base vazia: o fetch cai na origem do painel, o fallback do SPA
 * devolve index.html com 200 e o erro só aparece no `JSON.parse`. Falhe aqui, com causa nomeada.
 */
export function requireApiUrl() {
  if (!API_URL) {
    throw new ApiError(
      String(i18n.global.t('errors.api.missingBaseUrl')),
      0,
      'API_URL_MISSING',
      'API_URL_MISSING',
    )
  }

  return API_URL
}

/**
 * Locale da sessão na tag BCP 47 que o backend normaliza (`pt` → `pt-BR`, `es` → `es-419`,
 * `sr` → `sr-Latn`, `ar` → `ar`).
 * O `@Locale()` do Nest lê `Accept-Language` em toda rota de conteúdo localizado; sem o
 * header, o portal recebia tudo em pt-BR mesmo com a sessão em outro idioma.
 */
function acceptLanguage() {
  const atual = i18n.global.locale.value

  return API_LOCALE[isLocale(atual) ? atual : DEFAULT_LOCALE]
}

function isJsonResponse(response: Response) {
  return (response.headers.get('content-type') ?? '').toLowerCase().includes('json')
}

function hasNoBody(response: Response) {
  return (
    response.status === 204 ||
    response.status === 205 ||
    response.headers.get('content-length') === '0'
  )
}

export interface ApiFetchOpcoes {
  /**
   * 401 que quer dizer "a senha digitada não confere", e não "a sessão caiu". A troca de senha da
   * API anterior ao PJ-4BI7TE responde 401 para a senha atual errada: limpar a sessão ali derrubava
   * a pessoa no meio da tela, sem o menu e sem aviso.
   */
  manterSessaoEm401?: boolean
}

/** Avisa a raiz (App.vue) que a sessão caiu no meio do uso, para levar de volta à entrada. */
export const EVENTO_SESSAO_EXPIRADA = 'petjourney:sessao-expirada'

export async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit,
  opcoes?: ApiFetchOpcoes,
): Promise<T> {
  const token = getAccessToken()
  const headers = new Headers(options?.headers)
  const hasBody = options?.body != null && options.body !== ''

  // Evita Nest 400: Content-Type application/json com body ausente.
  if (hasBody && !headers.has('Content-Type') && !(options?.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  // Chamador que já definiu o header manda o dele.
  if (!headers.has('Accept-Language')) {
    headers.set('Accept-Language', acceptLanguage())
  }

  const response = await fetch(`${requireApiUrl()}${endpoint}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const errorBody = isJsonResponse(response) ? await response.json().catch(() => null) : null

    if (response.status === 401 && !opcoes?.manterSessaoEm401) {
      clearAuthSession()

      /* Só quem tinha sessão perde a sessão: o 401 do login (senha errada) não é queda. */
      if (token && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(EVENTO_SESSAO_EXPIRADA))
      }
    }

    throw new ApiError(
      errorBody?.message ||
        String(i18n.global.t('errors.api.genericStatus', { status: response.status })),
      response.status,
      errorBody?.error,
      typeof errorBody?.reason === 'string' ? errorBody.reason : undefined,
      {
        codigo: typeof errorBody?.codigo === 'string' ? errorBody.codigo : undefined,
        detalhes: detalhesDoErro(errorBody),
      },
    )
  }

  if (hasNoBody(response)) {
    return undefined as T
  }

  // 200 com HTML = requisição atendida pelo próprio SPA (base errada, proxy ou rewrite catch-all).
  if (!isJsonResponse(response)) {
    throw new ApiError(
      String(i18n.global.t('errors.api.invalidResponse')),
      response.status,
      'INVALID_CONTENT_TYPE',
      'RESPOSTA_NAO_JSON',
    )
  }

  return response.json() as Promise<T>
}
