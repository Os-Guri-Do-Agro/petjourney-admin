import i18n from '@/i18n'

import { ApiError, apiFetch, requireApiUrl } from '../api'
import type { ApiEnvelope } from '../api-envelope'
import { type AuthTokens, setAuthSession } from '../auth/auth-session'

/**
 * Signup mínimo (sem `tutor` e sem `veterinario`): toda conta nova deste painel
 * é parceiro; CRMV/especialidade são opcionais e entram depois pelo Perfil.
 */
export type UsuarioSignupPayload = {
  email: string
  nome: string
  senha: string
  ativo: true
  telefone?: string
  telefoneWhatsApp?: string
  cpf?: string
}

export type VeterinarioPerfil = {
  id?: string
  crmv?: string | null
  especialidade?: string | null
  foto?: string | null
}

export type UsuarioProfile = {
  id: string
  email: string
  nome: string
  telefone?: string | null
  telefoneWhatsApp?: string | null
  cpf?: string | null
  ativo?: boolean
  veterinarioPerfil?: VeterinarioPerfil | null
}

export type UpdateUsuarioPayload = {
  nome?: string
  telefone?: string
  telefoneWhatsApp?: string
  cpf?: string
  veterinario?: {
    foto?: string
    crmv?: string
    especialidade?: string
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  return value as Record<string, unknown>
}

function asOptionalString(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeVeterinarioPerfil(raw: unknown): VeterinarioPerfil | null {
  const record = asRecord(raw)

  if (!record) {
    return null
  }

  return {
    id: asOptionalString(record.id) ?? undefined,
    crmv: asOptionalString(record.crmv),
    especialidade: asOptionalString(record.especialidade),
    foto: asOptionalString(record.foto),
  }
}

/** Normaliza envelope/allInformations para um shape estável na UI. */
export function normalizeUsuarioProfile(raw: unknown, fallbackId: string): UsuarioProfile {
  const root = asRecord(raw) ?? {}
  const nestedUsuario = asRecord(root.usuario) ?? asRecord(root.user)
  const source = nestedUsuario ?? root

  const veterinarioPerfil =
    normalizeVeterinarioPerfil(source.veterinarioPerfil) ??
    normalizeVeterinarioPerfil(source.veterinario) ??
    normalizeVeterinarioPerfil(root.veterinarioPerfil) ??
    normalizeVeterinarioPerfil(root.veterinario)

  return {
    id: asOptionalString(source.id) ?? asOptionalString(root.id) ?? fallbackId,
    email: asOptionalString(source.email) ?? '',
    nome: asOptionalString(source.nome) ?? '',
    telefone: asOptionalString(source.telefone),
    telefoneWhatsApp: asOptionalString(source.telefoneWhatsApp),
    cpf: asOptionalString(source.cpf),
    ativo: typeof source.ativo === 'boolean' ? source.ativo : undefined,
    veterinarioPerfil,
  }
}

type AvailabilityField = 'email' | 'cpf'

type AvailabilityResult = {
  available: boolean
  field: AvailabilityField
}

async function checkAvailability(field: AvailabilityField, value: string): Promise<AvailabilityResult> {
  const query = new URLSearchParams({ [field]: value })
  const response = await fetch(`${requireApiUrl()}/usuario/verificar?${query.toString()}`)

  if (response.status === 409) {
    return { available: false, field }
  }

  if (response.ok) {
    return { available: true, field }
  }

  const errorBody = await response.json().catch(() => null)

  throw new ApiError(
    errorBody?.message || String(i18n.global.t('errors.api.genericStatus', { status: response.status })),
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

export async function registerUsuario(
  payload: UsuarioSignupPayload,
  options?: RegisterOptions,
) {
  const response = await apiFetch<ApiEnvelope<AuthTokens>>('/usuario', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  setAuthSession(response.data, options?.rememberAccess ?? true)

  return response
}

export async function getUsuarioAllInformations(userId: string) {
  const response = await apiFetch<ApiEnvelope<unknown>>(`/usuario/allInformations/${userId}`)
  return normalizeUsuarioProfile(response.data, userId)
}

export async function updateUsuario(userId: string, payload: UpdateUsuarioPayload) {
  const response = await apiFetch<ApiEnvelope<unknown>>(`/usuario/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

  return normalizeUsuarioProfile(response.data, userId)
}
