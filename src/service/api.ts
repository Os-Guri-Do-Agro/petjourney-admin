import { clearAuthSession, getAccessToken } from './auth/auth-session'

const API_URL = import.meta.env.VITE_API_URL ?? import.meta.env.PUBLIC_API_URL ?? ''

export async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = getAccessToken()
  const headers = new Headers(options?.headers)

  if (!headers.has('Content-Type') && !(options?.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => null)

    if (response.status === 401) {
      clearAuthSession()
    }

    throw new Error(error?.message || `Erro ${response.status}`)
  }

  return response.json()
}
