import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'

export type InactiveReason = {
  id: string
  label: string
  description?: string
  isCustomAllowed: boolean
}

export type InactivatePayload = {
  reasonId: string
  customReason?: string
}

export type ReactivateProfile = 'tutor' | 'veterinario'

export type ReactivatePayload = {
  profile: ReactivateProfile
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  return value as Record<string, unknown>
}

function normalizeReason(raw: unknown): InactiveReason | null {
  const record = asRecord(raw)

  if (!record || typeof record.id !== 'string' || typeof record.label !== 'string') {
    return null
  }

  return {
    id: record.id,
    label: record.label,
    description: typeof record.description === 'string' ? record.description : undefined,
    isCustomAllowed: Boolean(record.isCustomAllowed),
  }
}

/** Aceita `data` como array ou envelope auxiliar `{ reasons | items | data }`. */
export function normalizeInactiveReasons(raw: unknown): InactiveReason[] {
  if (Array.isArray(raw)) {
    return raw.map(normalizeReason).filter((item): item is InactiveReason => item != null)
  }

  const record = asRecord(raw)
  if (!record) {
    return []
  }

  const candidate = record.reasons ?? record.items ?? record.data
  if (Array.isArray(candidate)) {
    return candidate.map(normalizeReason).filter((item): item is InactiveReason => item != null)
  }

  return []
}

export async function getUsersMeInactiveReasons() {
  const response = await apiFetch<ApiEnvelope<unknown>>('/users/me/inactive-reasons')
  return normalizeInactiveReasons(response.data)
}

export async function postUsersMeInactivate(payload: InactivatePayload) {
  return apiFetch<ApiEnvelope<unknown>>('/users/me/inactivate', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function postUsersMeReactivate(payload: ReactivatePayload) {
  return apiFetch<ApiEnvelope<unknown>>('/users/me/reactivate', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
