import { ref } from 'vue'

export type AuthTokens = {
  access_token: string
  refresh_token: string
}

export type AuthUser = {
  userId: string
  email: string
  nome: string
  tutorId?: string
  tutorActive?: boolean
  veterinarioId?: string
  veterinarioActive?: boolean
  isSystemAdmin?: boolean
  /** Claims informativos do multi-perfil (ausentes em login normal e tokens antigos). Nunca use para permissão. */
  perfilAtivo?: 'TUTOR' | 'PARCEIRO'
  parceiroAtivoId?: string
  iat: number
  exp: number
}

const ACCESS_TOKEN_KEY = 'access_token'
const REFRESH_TOKEN_KEY = 'refresh_token'
const VETERINARIO_ID_KEY = 'veterinario_id'
const EXPIRATION_SKEW_SECONDS = 30

export const authSessionVersion = ref(0)

function notifyAuthSessionChange() {
  authSessionVersion.value += 1
}

function getAvailableStorages() {
  if (typeof window === 'undefined') {
    return []
  }

  return [window.sessionStorage, window.localStorage]
}

function decodeBase64Url(value: string) {
  const normalizedValue = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = '='.repeat((4 - (normalizedValue.length % 4)) % 4)
  const binaryValue = window.atob(`${normalizedValue}${padding}`)
  const bytes = Uint8Array.from(binaryValue, (char) => char.charCodeAt(0))

  return new TextDecoder().decode(bytes)
}

export function decodeJwtPayload<T>(token: string): T | null {
  try {
    const [, payload] = token.split('.')

    if (!payload) {
      return null
    }

    return JSON.parse(decodeBase64Url(payload)) as T
  } catch {
    return null
  }
}

function isExpired(payload: Pick<AuthUser, 'exp'>) {
  const currentTimeInSeconds = Math.floor(Date.now() / 1000)

  return payload.exp <= currentTimeInSeconds + EXPIRATION_SKEW_SECONDS
}

function getStoredAccessToken() {
  for (const storage of getAvailableStorages()) {
    const token = storage.getItem(ACCESS_TOKEN_KEY)

    if (token) {
      return token
    }
  }

  return null
}

export function clearAuthSession() {
  for (const storage of getAvailableStorages()) {
    storage.removeItem(ACCESS_TOKEN_KEY)
    storage.removeItem(REFRESH_TOKEN_KEY)
    storage.removeItem(VETERINARIO_ID_KEY)
  }

  notifyAuthSessionChange()
}

/** Conta sem perfil veterinário (prestador/parceiro) também entra no painel (Parte 9). */
export function setAuthSession(tokens: AuthTokens, rememberAccess = true) {
  const payload = decodeJwtPayload<AuthUser>(tokens.access_token)

  if (!payload || isExpired(payload)) {
    clearAuthSession()
    throw new Error('Token de autenticação inválido ou expirado.')
  }

  clearAuthSession()

  const storage = rememberAccess ? window.localStorage : window.sessionStorage
  storage.setItem(ACCESS_TOKEN_KEY, tokens.access_token)
  storage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token)

  if (payload.veterinarioId) {
    storage.setItem(VETERINARIO_ID_KEY, payload.veterinarioId)
  }

  notifyAuthSessionChange()
}

/**
 * Cadastro logado (ex.: POST /parceiro/portal/cadastro) devolve só um access_token
 * novo com claims frescos. Troca o access no storage atual e preserva o refresh.
 */
export function updateAccessToken(accessToken: string) {
  const payload = decodeJwtPayload<AuthUser>(accessToken)

  if (!payload || isExpired(payload)) {
    return
  }

  const storages = getAvailableStorages()
  const currentStorage =
    storages.find((storage) => storage.getItem(ACCESS_TOKEN_KEY)) ?? storages[1] ?? storages[0]

  if (!currentStorage) {
    return
  }

  currentStorage.setItem(ACCESS_TOKEN_KEY, accessToken)

  if (payload.veterinarioId) {
    currentStorage.setItem(VETERINARIO_ID_KEY, payload.veterinarioId)
  }

  notifyAuthSessionChange()
}

export function getAccessToken() {
  const token = getStoredAccessToken()

  if (!token) {
    return null
  }

  const payload = decodeJwtPayload<AuthUser>(token)

  if (!payload || isExpired(payload)) {
    clearAuthSession()
    return null
  }

  return token
}

export function getRefreshToken() {
  for (const storage of getAvailableStorages()) {
    const token = storage.getItem(REFRESH_TOKEN_KEY)

    if (token) {
      return token
    }
  }

  return null
}

export function getVeterinarioId() {
  for (const storage of getAvailableStorages()) {
    const veterinarioId = storage.getItem(VETERINARIO_ID_KEY)

    if (veterinarioId) {
      return veterinarioId
    }
  }

  const user = getAuthUser()

  return user?.veterinarioId ?? null
}

export function getAuthUser() {
  const token = getAccessToken()

  return token ? decodeJwtPayload<AuthUser>(token) : null
}

export function isAuthenticated() {
  return Boolean(getAccessToken())
}

export function hasVeterinarioProfile() {
  return Boolean(getVeterinarioId())
}

export function isSystemAdmin() {
  return Boolean(getAuthUser()?.isSystemAdmin)
}
