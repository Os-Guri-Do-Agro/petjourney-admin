/**
 * O boletim da internação ao responsável pela API (E5-03, PJ-XW4PBB). Guia `portal-parceiro-e5.md`,
 * seções 17, 18, 19 e 21.
 *
 * A retenção é do servidor: o boletim de piora (ou de quem entrou crítico) só sai depois que alguém
 * da clínica liga. A tela mostra o que a API devolve, nunca decide sozinha.
 *
 * - `boletim.compor` (veterinário, enfermagem e DONO): a conversa, os modelos, escrever, descartar,
 *   a foto e a preferência.
 * - `boletim.enviar` (os mesmos e a recepção): registrar a ligação e enviar; a fila da recepção.
 */
import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'
import type {
  BoletimDaClinicaDto,
  BoletinsPendentesDto,
  ComporBoletimDto,
  ConversaDoBoletimDto,
  EnvioDoBoletimDto,
  FotoDoBoletimDto,
  LigacaoDaInternacaoDto,
  ModelosDoBoletimDto,
  PreferenciaDeBoletimDto,
  PreferenciaDeBoletimEntradaDto,
} from '../contrato/openapi'
import { comIdempotencia } from '../idempotencia'

export type Boletim = BoletimDaClinicaDto
export type StatusDoBoletim = BoletimDaClinicaDto['status']
export type ConversaDoBoletim = ConversaDoBoletimDto
export type ModelosDoBoletim = ModelosDoBoletimDto
export type EnvioDoBoletim = EnvioDoBoletimDto
export type PreferenciaDoBoletim = PreferenciaDeBoletimDto
export type NovaPreferenciaDoBoletim = PreferenciaDeBoletimEntradaDto
export type BoletinsPendentes = BoletinsPendentesDto
export type BoletimPendente = BoletinsPendentesDto['itens'][number]
export type LigacaoDaInternacao = LigacaoDaInternacaoDto

export const FREQUENCIAS_DO_BOLETIM = [1, 2, 4, 6, 8, 12, 24] as const
export const TEXTO_DO_BOLETIM_MAX = 2000
export const LEGENDA_DA_FOTO_MAX = 200
export const FOTO_MAX_BYTES = 12 * 1024 * 1024
export const TIPOS_DE_FOTO = ['image/jpeg', 'image/png', 'image/webp'] as const

type ParceiroQuery = { parceiroId?: string | null }

function comQuery(caminho: string, query: Record<string, string | number | null | undefined>) {
  const busca = new URLSearchParams()
  for (const [chave, valor] of Object.entries(query)) {
    if (valor !== undefined && valor !== null && valor !== '') busca.set(chave, String(valor))
  }
  const texto = busca.toString()
  return texto ? `${caminho}?${texto}` : caminho
}

async function dados<T>(promise: Promise<ApiEnvelope<T>>) {
  return (await promise).data
}

function json(method: string, corpo?: unknown): RequestInit {
  return corpo === undefined ? { method } : { method, body: JSON.stringify(corpo) }
}

const CLINICA = '/parceiro/portal/clinica'
const daInternacao = (id: string, resto = '') =>
  `${CLINICA}/internacoes/${encodeURIComponent(id)}${resto}`
const doBoletim = (id: string, resto = '') =>
  `${CLINICA}/boletins/${encodeURIComponent(id)}${resto}`

/* -------------------------------------------------------------------------- a conversa */

export function lerConversaDoBoletim(
  internacaoId: string,
  cursor?: string | null,
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<ConversaDoBoletim>>(
      comQuery(daInternacao(internacaoId, '/boletins'), { cursor, parceiroId: params?.parceiroId }),
    ),
  )
}

export function lerModelosDoBoletim(internacaoId: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<ModelosDoBoletim>>(
      comQuery(daInternacao(internacaoId, '/boletins/modelos'), { parceiroId: params?.parceiroId }),
    ),
  )
}

export function comporBoletim(
  internacaoId: string,
  corpo: ComporBoletimDto,
  chave: string,
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<Boletim>>(
      comQuery(daInternacao(internacaoId, '/boletins'), { parceiroId: params?.parceiroId }),
      comIdempotencia(chave, json('POST', corpo)),
    ),
  )
}

export function descartarBoletim(boletimId: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Boletim>>(
      comQuery(doBoletim(boletimId, '/descartar'), { parceiroId: params?.parceiroId }),
      json('POST'),
    ),
  )
}

/** A ligação é autodeclaração: quem ligou e quando (sem `em`, "liguei agora"). */
export function registrarLigacaoDoBoletim(
  boletimId: string,
  corpo: { porProfissionalId: string; em?: string },
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<Boletim>>(
      comQuery(doBoletim(boletimId, '/ligacao'), { parceiroId: params?.parceiroId }),
      json('POST', corpo),
    ),
  )
}

/** O paciente sem app não ganha boletim: a ligação se registra na internação. */
export function registrarLigacaoDaInternacao(
  internacaoId: string,
  corpo: { porProfissionalId: string; em?: string },
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<LigacaoDaInternacao>>(
      comQuery(daInternacao(internacaoId, '/ligacao'), { parceiroId: params?.parceiroId }),
      json('POST', corpo),
    ),
  )
}

export function enviarBoletim(boletimId: string, chave: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<EnvioDoBoletim>>(
      comQuery(doBoletim(boletimId, '/enviar'), { parceiroId: params?.parceiroId }),
      comIdempotencia(chave, json('POST')),
    ),
  )
}

/* ------------------------------------------------------------------------------- a foto */

export function enviarFotoDoBoletim(
  boletimId: string,
  arquivo: File,
  legenda: string,
  params?: ParceiroQuery,
) {
  const form = new FormData()
  form.append('file', arquivo)
  if (legenda.trim()) form.append('legenda', legenda.trim())
  return dados(
    apiFetch<ApiEnvelope<Boletim>>(
      comQuery(doBoletim(boletimId, '/foto'), { parceiroId: params?.parceiroId }),
      { method: 'POST', body: form },
    ),
  )
}

export async function tirarFotoDoBoletim(boletimId: string, params?: ParceiroQuery) {
  await apiFetch<unknown>(
    comQuery(doBoletim(boletimId, '/foto'), { parceiroId: params?.parceiroId }),
    {
      method: 'DELETE',
    },
  )
}

export function lerFotoDoBoletim(boletimId: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<FotoDoBoletimDto>>(
      comQuery(doBoletim(boletimId, '/foto'), { parceiroId: params?.parceiroId }),
    ),
  )
}

/* -------------------------------------------------------------------------- preferência */

export function lerPreferenciaDoBoletim(internacaoId: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<PreferenciaDoBoletim>>(
      comQuery(daInternacao(internacaoId, '/preferencias'), { parceiroId: params?.parceiroId }),
    ),
  )
}

export function salvarPreferenciaDoBoletim(
  internacaoId: string,
  corpo: NovaPreferenciaDoBoletim,
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<PreferenciaDoBoletim>>(
      comQuery(daInternacao(internacaoId, '/preferencias'), { parceiroId: params?.parceiroId }),
      json('PUT', corpo),
    ),
  )
}

/* ---------------------------------------------------------------- a fila da recepção */

export function listarBoletinsPendentes(params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<BoletinsPendentes>>(
      comQuery(`${CLINICA}/internacao/boletins-pendentes`, { parceiroId: params?.parceiroId }),
    ),
  )
}

/** O boletim ainda aceita ação (os enviados e cancelados só se leem). */
export function boletimAberto(status: StatusDoBoletim) {
  return status === 'RASCUNHO' || status === 'RETIDO' || status === 'LIBERADO'
}
