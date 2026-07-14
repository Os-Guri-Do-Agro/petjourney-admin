import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'
import {
  type AuthTokens,
  type AuthUser,
  clearAuthSession,
  decodeJwtPayload,
  getAuthUser,
  getRefreshToken,
  setAuthSession,
} from './auth-session'

type LoginCredentials = {
  email: string
  senha: string
}

type LoginOptions = {
  rememberAccess?: boolean
}

export type LoginProfileFlags = {
  tutorInactive: boolean
  veterinarioInactive: boolean
}

export type LoginResult = LoginProfileFlags & {
  tokens: AuthTokens
  rememberAccess: boolean
  user: AuthUser | null
}

/** DTO real da API: `oldPassword` / `newPassword`. */
export type ChangePasswordAuthenticatedPayload = {
  oldPassword: string
  newPassword: string
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  return value as Record<string, unknown>
}

function extractAuthTokens(data: unknown): AuthTokens {
  const record = asRecord(data)

  if (
    !record ||
    typeof record.access_token !== 'string' ||
    typeof record.refresh_token !== 'string'
  ) {
    throw new Error('Resposta de autenticação inválida.')
  }

  return {
    access_token: record.access_token,
    refresh_token: record.refresh_token,
  }
}

function readInactiveFlag(data: Record<string, unknown>, keys: string[]) {
  return keys.some((key) => data[key] === true)
}

export function resolveLoginProfileFlags(
  data: unknown,
  user: AuthUser | null,
): LoginProfileFlags {
  const record = asRecord(data) ?? {}

  const tutorInactive =
    readInactiveFlag(record, ['tutorInactive', 'tutor_inactive']) || user?.tutorActive === false

  const veterinarioInactive =
    readInactiveFlag(record, ['veterinarioInactive', 'veterinario_inactive']) ||
    user?.veterinarioActive === false

  return { tutorInactive, veterinarioInactive }
}

function preferLocalStorageForRefresh() {
  if (typeof window === 'undefined') {
    return true
  }

  return Boolean(window.localStorage.getItem('refresh_token'))
}

let refreshInFlight: Promise<AuthTokens> | null = null

export async function login(data: LoginCredentials, options?: LoginOptions): Promise<LoginResult> {
  const rememberAccess = options?.rememberAccess ?? true
  const res = await apiFetch<ApiEnvelope<unknown>>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  })

  const tokens = extractAuthTokens(res.data)
  const userFromToken = decodeJwtPayload<AuthUser>(tokens.access_token)
  const flags = resolveLoginProfileFlags(res.data, userFromToken)

  // Perfil inativo ainda autentica; não exigir veterinarioId até reativar.
  setAuthSession(tokens, rememberAccess, {
    requireVeterinario: !flags.veterinarioInactive,
  })

  return {
    tokens,
    rememberAccess,
    user: getAuthUser(),
    ...flags,
  }
}

export async function changePasswordAuthenticated(payload: ChangePasswordAuthenticatedPayload) {
  return apiFetch<ApiEnvelope<unknown>>('/auth/reset-password-authenticated', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/**
 * Renova access/refresh tokens. Single-flight para evitar corrida pós-reativação.
 */
export async function refreshAuthSession(rememberAccess = preferLocalStorageForRefresh()) {
  if (refreshInFlight) {
    return refreshInFlight
  }

  refreshInFlight = (async () => {
    const refreshToken = getRefreshToken()

    if (!refreshToken) {
      clearAuthSession()
      throw new Error('Sessão expirada. Faça login novamente.')
    }

    const res = await apiFetch<ApiEnvelope<unknown>>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    })

    const tokens = extractAuthTokens(res.data)
    setAuthSession(tokens, rememberAccess, { requireVeterinario: false })
    return tokens
  })()

  try {
    return await refreshInFlight
  } finally {
    refreshInFlight = null
  }
}
