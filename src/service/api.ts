import i18n from '@/i18n'

import { clearAuthSession, getAccessToken } from './auth/auth-session'

// Fonte única: o Vite escolhe .env.development no dev e .env.production no build.
const API_URL = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '')

export class ApiError extends Error {
  readonly statusCode: number
  readonly error?: string
  /** Código estável de erro do funil de parceiro (Parte 9). Roteie UX por ele, nunca pela message. */
  readonly reason?: string

  constructor(message: string, statusCode: number, error?: string, reason?: string) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.error = error
    this.reason = reason
  }
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

export async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
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

  const response = await fetch(`${requireApiUrl()}${endpoint}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const errorBody = isJsonResponse(response) ? await response.json().catch(() => null) : null

    if (response.status === 401) {
      clearAuthSession()
    }

    throw new ApiError(
      errorBody?.message ||
        String(i18n.global.t('errors.api.genericStatus', { status: response.status })),
      response.status,
      errorBody?.error,
      typeof errorBody?.reason === 'string' ? errorBody.reason : undefined,
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
