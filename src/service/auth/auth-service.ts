import { apiFetch } from '../api'
import { type AuthTokens, setAuthSession } from './auth-session'

type LoginCredentials = {
  email: string
  senha: string
}

type LoginResponse = {
  statusCode: number
  message: string
  data: AuthTokens
}

type LoginOptions = {
  rememberAccess?: boolean
}

export async function login(data: LoginCredentials, options?: LoginOptions) {
  const res = await apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  })

  setAuthSession(res.data, options?.rememberAccess)

  return res
}
