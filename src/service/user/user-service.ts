import { ApiError, apiFetch, getApiUrl } from '../api'
import { type AuthTokens, setAuthSession } from '../auth/auth-session'

type ApiEnvelope<T> = {
  statusCode: number
  message: string
  data: T
}

export type VeterinarioSignupPayload = {
  email: string
  nome: string
  senha: string
  ativo: true
  telefone?: string
  telefoneWhatsApp?: string
  cpf?: string
  veterinario: {
    crmv: string
    especialidade: string
    foto?: string
  }
}

type AvailabilityField = 'email' | 'cpf'

type AvailabilityResult = {
  available: boolean
  field: AvailabilityField
}

async function checkAvailability(field: AvailabilityField, value: string): Promise<AvailabilityResult> {
  const query = new URLSearchParams({ [field]: value })
  const response = await fetch(`${getApiUrl()}/usuario/verificar?${query.toString()}`)

  if (response.status === 409) {
    return { available: false, field }
  }

  if (response.ok) {
    return { available: true, field }
  }

  const errorBody = await response.json().catch(() => null)

  throw new ApiError(
    errorBody?.message || `Erro ${response.status}`,
    response.status,
    errorBody?.error,
  )
}

export function checkEmailAvailability(email: string) {
  return checkAvailability('email', email.trim())
}

export function checkCpfAvailability(cpf: string) {
  return checkAvailability('cpf', cpf)
}

type RegisterOptions = {
  rememberAccess?: boolean
}

export async function registerVeterinarian(
  payload: VeterinarioSignupPayload,
  options?: RegisterOptions,
) {
  const response = await apiFetch<ApiEnvelope<AuthTokens>>('/usuario', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  setAuthSession(response.data, options?.rememberAccess ?? true)

  return response
}
