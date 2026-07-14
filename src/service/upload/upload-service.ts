import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  return value as Record<string, unknown>
}

/** Extrai URL pública das shapes comuns do envelope de upload. */
export function extractUploadUrl(raw: unknown): string {
  if (typeof raw === 'string' && /^https?:\/\//i.test(raw.trim())) {
    return raw.trim()
  }

  const record = asRecord(raw)
  if (!record) {
    throw new Error('Resposta de upload sem URL.')
  }

  const candidates = [
    record.url,
    record.secure_url,
    record.location,
    record.path,
    record.fileUrl,
    record.file_url,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && /^https?:\/\//i.test(candidate.trim())) {
      return candidate.trim()
    }
  }

  const nested = asRecord(record.file) ?? asRecord(record.data)
  if (nested) {
    return extractUploadUrl(nested)
  }

  throw new Error('Resposta de upload sem URL.')
}

/**
 * Upload autenticado de arquivo do usuário.
 * `POST /upload/file-usuario` — multipart campo `file`.
 */
export async function uploadUsuarioFile(file: File) {
  const body = new FormData()
  body.append('file', file)

  const response = await apiFetch<ApiEnvelope<unknown>>('/upload/file-usuario', {
    method: 'POST',
    body,
  })

  return extractUploadUrl(response.data)
}
