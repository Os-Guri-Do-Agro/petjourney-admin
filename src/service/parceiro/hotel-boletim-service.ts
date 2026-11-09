/**
 * O boletim do hotel ao responsável pela API (E7-05c, PJ-21T3ER). Guia `portal-parceiro-e7.md`,
 * seção 44.
 *
 * Tudo é `hotel.rotina` (o veterinário, só com `hotel.ler`, recebe 403). A casa compõe, o servidor
 * decide se pode sair e o push vai sem conteúdo. O que retém é a R3: ocorrência GRAVE da estadia
 * sem contato por voz com o responsável (409 `BOLETIM_EXIGE_CONTATO`). Um aberto por estadia
 * (409 `BOLETIM_HOTEL_JA_ABERTO`); o texto não muda depois de gravado: descarte e escreva de novo.
 */
import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'
import type {
  BoletimDoHotelDaCasaDto,
  ComporBoletimDoHotelDto,
  ConversaDoBoletimDoHotelDto,
  EnvioDoBoletimDoHotelDto,
  ModelosDoBoletimDoHotelDto,
  PreferenciaDeBoletimDoHotelDto,
  PreferenciaDeBoletimDoHotelEntradaDto,
} from '../contrato/openapi'
import { comIdempotencia } from '../idempotencia'

export type BoletimDoHotel = BoletimDoHotelDaCasaDto
export type ConversaDoBoletimDoHotel = ConversaDoBoletimDoHotelDto
export type ModelosDoBoletimDoHotel = ModelosDoBoletimDoHotelDto
export type NovoBoletimDoHotel = ComporBoletimDoHotelDto
export type PreferenciaDoBoletimDoHotel = PreferenciaDeBoletimDoHotelDto
export type NovaPreferenciaDoBoletimDoHotel = PreferenciaDeBoletimDoHotelEntradaDto
export type EnvioDoBoletimDoHotel = EnvioDoBoletimDoHotelDto
export type StatusDoBoletimDoHotel = BoletimDoHotelDaCasaDto['status']

export const TEXTO_DO_BOLETIM_DO_HOTEL_MAX = 2000
export const FOTOS_DO_BOLETIM_MAX = 3
export const FREQUENCIAS_DO_BOLETIM_DO_HOTEL = [12, 24, 48] as const

/** Rascunho, retido ou liberado esperando: o que impede compor outro. */
export function boletimDoHotelAberto(status: StatusDoBoletimDoHotel) {
  return status === 'RASCUNHO' || status === 'RETIDO' || status === 'LIBERADO'
}

type ParceiroQuery = { parceiroId?: string | null }

function comQuery(caminho: string, query: Record<string, string | null | undefined>) {
  const busca = new URLSearchParams()
  for (const [chave, valor] of Object.entries(query)) {
    if (valor !== undefined && valor !== null && valor !== '') busca.set(chave, valor)
  }
  const texto = busca.toString()
  return texto ? `${caminho}?${texto}` : caminho
}

function json(method: string, corpo?: unknown): RequestInit {
  return corpo === undefined ? { method } : { method, body: JSON.stringify(corpo) }
}

const BASE = '/parceiro/portal/hotel'
const daHospedagem = (id: string, resto: string) =>
  `${BASE}/hospedagens/${encodeURIComponent(id)}${resto}`
const doBoletim = (id: string, resto: string) =>
  `${BASE}/boletins/${encodeURIComponent(id)}${resto}`

async function chamar<T>(
  caminho: string,
  init: RequestInit = { method: 'GET' },
  query: Record<string, string | null | undefined> = {},
) {
  const resposta = await apiFetch<ApiEnvelope<T>>(comQuery(caminho, query), init)
  return resposta.data
}

/** A conversa da casa, do mais recente, 30 por página. */
export function lerConversaDoHotel(
  hospedagemId: string,
  cursor?: string | null,
  params?: ParceiroQuery,
) {
  return chamar<ConversaDoBoletimDoHotel>(daHospedagem(hospedagemId, '/boletins'), undefined, {
    cursor,
    parceiroId: params?.parceiroId,
  })
}

/** Sugestões no idioma do responsável, as contagens do período e o diário (texto interno). */
export function lerModelosDoBoletimDoHotel(hospedagemId: string, params?: ParceiroQuery) {
  return chamar<ModelosDoBoletimDoHotel>(
    daHospedagem(hospedagemId, '/boletins/modelos'),
    undefined,
    { parceiroId: params?.parceiroId },
  )
}

/** Nasce `RASCUNHO`, ou `RETIDO` se há grave do período sem contato. */
export function comporBoletimDoHotel(
  hospedagemId: string,
  corpo: NovoBoletimDoHotel,
  chave: string,
  params?: ParceiroQuery,
) {
  return chamar<BoletimDoHotel>(
    daHospedagem(hospedagemId, '/boletins'),
    comIdempotencia(chave, json('POST', corpo)),
    { parceiroId: params?.parceiroId },
  )
}

/** Repetir com a mesma chave devolve o mesmo comprovante, um push só. */
export function enviarBoletimDoHotel(id: string, chave: string, params?: ParceiroQuery) {
  return chamar<EnvioDoBoletimDoHotel>(
    doBoletim(id, '/enviar'),
    comIdempotencia(chave, { method: 'POST' }),
    { parceiroId: params?.parceiroId },
  )
}

/** Fica na conversa como cancelado e nunca vai ao app. */
export function descartarBoletimDoHotel(id: string, params?: ParceiroQuery) {
  return chamar<BoletimDoHotel>(
    doBoletim(id, '/descartar'),
    { method: 'POST' },
    {
      parceiroId: params?.parceiroId,
    },
  )
}

export function lerPreferenciaDoHotel(hospedagemId: string, params?: ParceiroQuery) {
  return chamar<PreferenciaDoBoletimDoHotel>(
    daHospedagem(hospedagemId, '/preferencias'),
    undefined,
    { parceiroId: params?.parceiroId },
  )
}

/** Gravada pelo balcão (`definidaPor: HOTEL`): o responsável pediu por telefone ou pessoalmente. */
export function salvarPreferenciaDoHotel(
  hospedagemId: string,
  corpo: NovaPreferenciaDoBoletimDoHotel,
  params?: ParceiroQuery,
) {
  return chamar<PreferenciaDoBoletimDoHotel>(
    daHospedagem(hospedagemId, '/preferencias'),
    json('PUT', corpo),
    { parceiroId: params?.parceiroId },
  )
}
