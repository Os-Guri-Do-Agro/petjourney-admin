import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'
import type { PapelParceiro, StatusAuditoriaParceiro } from '../parceiro/types'
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

export type PerfilParceiro = {
  parceiroId: string
  nome: string
  papel: PapelParceiro
  status: StatusAuditoriaParceiro
}

/**
 * Perfis da conta. O payload traz também `veterinario`, espelho de legado dormente que
 * a UI ignora sempre (vet do produto é Parceiro com categoria `CLINICA_VETERINARIA`).
 * Por isso o campo não é tipado aqui.
 */
export type PerfisConta = {
  usuarioId: string
  tutor: { id: string; ativo: boolean } | null
  parceiros: PerfilParceiro[]
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

  setAuthSession(tokens, rememberAccess)

  return {
    tokens,
    rememberAccess,
    user: getAuthUser(),
    ...flags,
  }
}

export async function changePasswordAuthenticated(payload: ChangePasswordAuthenticatedPayload) {
  /*
   * Senha atual errada: 400 `SENHA_ATUAL_INCORRETA` desde o PJ-4BI7TE. A API anterior, que ainda
   * roda na produção, responde 401; até ela subir, esse 401 não derruba a sessão.
   */
  return apiFetch<ApiEnvelope<unknown>>(
    '/auth/reset-password-authenticated',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    { manterSessaoEm401: true },
  )
}

/** Público — anti-enumeração: API responde 200 mesmo se o e-mail não existir. */
export async function recoveryPassword(email: string) {
  return apiFetch<ApiEnvelope<unknown>>('/auth/recovery-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export function extractResetToken(data: unknown): string {
  const record = asRecord(data)

  if (!record || typeof record.reset_token !== 'string' || !record.reset_token.trim()) {
    throw new Error('Resposta de verificação inválida.')
  }

  return record.reset_token
}

/** Público — valida PIN e devolve JWT de reset (~10 min). */
export async function verifyRecoveryPin(payload: { email: string; pin: string }) {
  const res = await apiFetch<ApiEnvelope<unknown>>('/auth/verify-recovery-pin', {
    method: 'POST',
    body: JSON.stringify({
      email: payload.email,
      pin: payload.pin,
    }),
  })

  return extractResetToken(res.data)
}

/** Público — redefine senha com o `reset_token` da verificação. Sem auto-login. */
export async function resetPasswordWithToken(payload: {
  reset_token: string
  newPassword: string
}) {
  return apiFetch<ApiEnvelope<unknown>>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({
      reset_token: payload.reset_token,
      newPassword: payload.newPassword,
    }),
  })
}

/** Perfis da conta logada: fonte do seletor de empresa do portal. */
export async function getPerfis() {
  const res = await apiFetch<ApiEnvelope<PerfisConta>>('/auth/perfis')

  return res.data
}

/**
 * Troca o perfil ativo e grava o **par** novo de tokens. O portal só troca para PARCEIRO:
 * `TUTOR` não tem tela aqui e `VETERINARIO` é legado que o front nunca envia.
 * O `parceiroId` vai sempre — com uma membership só o backend auto-resolve.
 */
export async function trocarParaParceiro(parceiroId: string) {
  const res = await apiFetch<ApiEnvelope<unknown>>('/auth/trocar-perfil', {
    method: 'POST',
    body: JSON.stringify({ perfil: 'PARCEIRO', parceiroId }),
  })

  const tokens = extractAuthTokens(res.data)
  setAuthSession(tokens, preferLocalStorageForRefresh())

  return tokens
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
    setAuthSession(tokens, rememberAccess)
    return tokens
  })()

  try {
    return await refreshInFlight
  } finally {
    refreshInFlight = null
  }
}
