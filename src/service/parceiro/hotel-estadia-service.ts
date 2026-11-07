/**
 * A estadia do hotel pela API (E7-04, PJ-GLOYC4). Guia `portal-parceiro-e7.md`, seções 27, 41 e 45.
 *
 * - Admissão, veterinários do pet e check-in: `hotel.checkin`. Fotos: `hotel.checkin`.
 * - Medicação, cuidado, adaptação e mudar de baia: `hotel.rotina` (manter o orçamento na baia de
 *   outra tarifa: `hotel.valores`).
 * - Acrescentar serviço: `hotel.reserva`.
 * - Conferir pertence, pesar e check-out: `hotel.checkout` (o pagamento junto: `hotel.valores`; a
 *   saída informada: `estabelecimento.editar`).
 * - Hóspedes, estadia e ver foto: `hotel.ler`. Anular a estadia publicada: `estabelecimento.editar`.
 *
 * O check-out é da RESERVA (os dois animais de uma vez). O instante é sempre do servidor.
 */
import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'
import type {
  AdmissaoDaReservaDto,
  AnimalDoCheckinDto,
  BaiaMudadaDto,
  CheckOutDto,
  CuidadoDaEstadiaDto,
  CuidadoDaEstadiaEntradaDto,
  EstadiaDaReservaDto,
  FotoDaHospedagemDto,
  HospedagemDto,
  HospedesDto,
  MedicacaoDaEstadiaDto,
  MedicacaoDaEstadiaEntradaDto,
  ReservaEditadaDto,
  VeterinariosDoPetDto,
} from '../contrato/openapi'
import { comIdempotencia } from '../idempotencia'

export type AdmissaoDaReserva = AdmissaoDaReservaDto
export type AnimalDaAdmissao = AdmissaoDaReservaDto['animais'][number]
export type VeterinariosDoPet = VeterinariosDoPetDto
export type AnimalDoCheckin = AnimalDoCheckinDto
export type EstadiaDaReserva = EstadiaDaReservaDto
export type Hospedagem = HospedagemDto
export type Hospede = HospedesDto['hospedes'][number]
export type Medicacao = MedicacaoDaEstadiaDto
export type NovaMedicacao = MedicacaoDaEstadiaEntradaDto
export type Cuidado = CuidadoDaEstadiaDto
export type NovoCuidado = CuidadoDaEstadiaEntradaDto
export type FotoDaEstadia = FotoDaHospedagemDto
export type Pertence = HospedagemDto['pertences'][number]
export type Via = MedicacaoDaEstadiaEntradaDto['via']
export type Adaptacao = NonNullable<AnimalDoCheckinDto['adaptacao']>
export type Autorizacao = AnimalDoCheckinDto['autorizacoes'][number]['kind']
export type Retirada = CheckOutDto['retirada']
export type DocumentoDeRetirada = NonNullable<Retirada['documentoTipo']>
export type MomentoDaFoto = FotoDaHospedagemDto['momento']

export const VIAS: readonly Via[] = ['ORAL', 'TOPICA', 'OTOLOGICA', 'OFTALMICA', 'SUBCUTANEA']
export const ADAPTACOES: readonly Adaptacao[] = ['TRANQUILO', 'EM_ADAPTACAO', 'ESTRESSADO']
export const AUTORIZACOES: readonly Autorizacao[] = [
  'BANHO',
  'PASSEIO_EXTERNO',
  'RECREACAO_EM_GRUPO',
  'FOTO_EM_REDE_SOCIAL',
  'ATENDIMENTO_VETERINARIO',
  'TRANSPORTE',
]
export const DOCUMENTOS_DE_RETIRADA: readonly DocumentoDeRetirada[] = ['RG', 'CPF', 'CNH', 'OUTRO']
export const MOMENTOS_DA_FOTO: readonly MomentoDaFoto[] = ['ENTRADA', 'ESTADIA', 'SAIDA']

/* As faixas do guia (seções 27 e 41). */
export const PESO_MIN = 0.05
export const PESO_MAX = 250
export const TEXTO_MAX = 500
export const PERTENCES_MAX = 20
export const PERTENCE_DESCRICAO_MAX = 80
export const QUANTIDADE_MAX = 99
export const PORCAO_MAX = 5000
export const HORARIOS_MAX = 12
export const ITENS_MAX = 10
export const MOTIVO_SEM_RECEITA_MIN = 10
export const MOTIVO_SEM_RECEITA_MAX = 300
export const OBSERVACAO_DO_PERTENCE_MIN = 5
export const OBSERVACAO_DO_PERTENCE_MAX = 200
export const SEM_PESO_MIN = 10
export const SEM_PESO_MAX = 300
export const MOTIVO_DA_BAIA_MIN = 5
export const MOTIVO_DA_BAIA_MAX = 200
export const MOTIVO_DA_ANULACAO_MIN = 10
export const MOTIVO_DA_ANULACAO_MAX = 300
export const SAIDA_INFORMADA_MAX_HORAS = 72
export const LEGENDA_MAX = 120
export const FOTO_MAX_BYTES = 8 * 1024 * 1024
export const FOTO_ACEITA = 'image/jpeg,image/png,image/webp'

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

const BASE = '/parceiro/portal/hotel'
const daReserva = (id: string, resto = '') => `${BASE}/reservas/${encodeURIComponent(id)}${resto}`
const daHospedagem = (id: string, resto = '') =>
  `${BASE}/hospedagens/${encodeURIComponent(id)}${resto}`

function chamar<T>(caminho: string, init: RequestInit = { method: 'GET' }, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<T>>(comQuery(caminho, { parceiroId: params?.parceiroId }), init),
  )
}

/* ------------------------------------------------------------------------------ entrada */

/** A R1 contra o último dia da estadia, lendo a carteirinha do app. Não grava nada. */
export function lerAdmissao(reservaId: string, params?: ParceiroQuery) {
  return chamar<AdmissaoDaReserva>(daReserva(reservaId, '/admissao'), undefined, params)
}

export function lerVeterinariosDoPet(
  reservaId: string,
  pacienteId: string,
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<VeterinariosDoPet>>(
      comQuery(daReserva(reservaId, '/veterinarios'), {
        pacienteId,
        parceiroId: params?.parceiroId,
      }),
    ),
  )
}

/** Um item por animal da reserva, com a versão dela. Aceita o duplo toque (Idempotency-Key). */
export function fazerCheckIn(
  reservaId: string,
  corpo: { versao: number; animais: AnimalDoCheckin[] },
  chave: string,
  params?: ParceiroQuery,
) {
  return chamar<EstadiaDaReserva>(
    daReserva(reservaId, '/check-in'),
    comIdempotencia(chave, json('POST', corpo)),
    params,
  )
}

export function lerEstadia(reservaId: string, params?: ParceiroQuery) {
  return chamar<EstadiaDaReserva>(daReserva(reservaId, '/estadia'), undefined, params)
}

/* ---------------------------------------------------------------------- hóspedes e estadia */

export function listarHospedes(cursor?: string | null, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<HospedesDto>>(
      comQuery(`${BASE}/hospedes`, { cursor, limit: 50, parceiroId: params?.parceiroId }),
    ),
  )
}

export function lerHospedagem(id: string, params?: ParceiroQuery) {
  return chamar<Hospedagem>(daHospedagem(id), undefined, params)
}

export function registrarMedicacao(id: string, corpo: NovaMedicacao, params?: ParceiroQuery) {
  return chamar<Medicacao>(daHospedagem(id, '/medicacoes'), json('POST', corpo), params)
}

export function suspenderMedicacao(id: string, medicacaoId: string, params?: ParceiroQuery) {
  return chamar<Medicacao>(
    daHospedagem(id, `/medicacoes/${encodeURIComponent(medicacaoId)}/suspender`),
    { method: 'POST' },
    params,
  )
}

export function registrarCuidado(id: string, corpo: NovoCuidado, params?: ParceiroQuery) {
  return chamar<Cuidado>(daHospedagem(id, '/cuidados'), json('POST', corpo), params)
}

export function encerrarCuidado(id: string, cuidadoId: string, params?: ParceiroQuery) {
  return chamar<Cuidado>(
    daHospedagem(id, `/cuidados/${encodeURIComponent(cuidadoId)}/encerrar`),
    { method: 'POST' },
    params,
  )
}

export function mudarAdaptacao(id: string, adaptacao: Adaptacao, params?: ParceiroQuery) {
  return chamar<Hospedagem>(daHospedagem(id, '/adaptacao'), json('PATCH', { adaptacao }), params)
}

/** Com a versão da RESERVA. Responde a reserva editada (a diferença só com `hotel.valores`). */
export function acrescentarServico(
  id: string,
  corpo: { versao: number; servico: string; quantidade: number; observacao?: string },
  params?: ParceiroQuery,
) {
  return chamar<ReservaEditadaDto>(daHospedagem(id, '/servicos'), json('POST', corpo), params)
}

/* ---------------------------------------------------------------------------------- saída */

/** Não devolvido exige observação (5 a 200). Conferir de novo substitui. */
export function conferirPertence(
  id: string,
  pertenceId: string,
  corpo: { devolvido: boolean; observacao?: string },
  params?: ParceiroQuery,
) {
  return chamar<Hospedagem>(
    daHospedagem(id, `/pertences/${encodeURIComponent(pertenceId)}/conferir`),
    json('POST', corpo),
    params,
  )
}

/** O peso ou o motivo de não pesar. Mais de 30% de variação pede `confirmarPesoFora`. */
export function pesarNaSaida(
  id: string,
  corpo: { pesoKg?: number; confirmarPesoFora?: boolean; semPesoMotivo?: string },
  params?: ParceiroQuery,
) {
  return chamar<Hospedagem>(daHospedagem(id, '/pesar-na-saida'), json('POST', corpo), params)
}

/** Da reserva inteira. O `pagoCentavos` é o total acumulado (nunca abaixo do registrado). */
export function fazerCheckOut(
  reservaId: string,
  corpo: CheckOutDto,
  chave: string,
  params?: ParceiroQuery,
) {
  return chamar<EstadiaDaReserva>(
    daReserva(reservaId, '/check-out'),
    comIdempotencia(chave, json('POST', corpo)),
    params,
  )
}

export function mudarDeBaia(
  reservaId: string,
  corpo: { acomodacaoId: string; motivo: string; versao: number; manterOrcamento?: boolean },
  params?: ParceiroQuery,
) {
  return chamar<BaiaMudadaDto>(daReserva(reservaId, '/mudar-de-baia'), json('POST', corpo), params)
}

/** Tira do app a estadia e o peso de cada animal. */
export function anularEstadiaPublicada(reservaId: string, motivo: string, params?: ParceiroQuery) {
  return chamar<{ reservaId: string; anuladas: number }>(
    daReserva(reservaId, '/anular-estadia-publicada'),
    json('POST', { motivo }),
    params,
  )
}

/* ---------------------------------------------------------------------------------- fotos */

export function enviarFoto(
  id: string,
  arquivo: File,
  momento: MomentoDaFoto,
  legenda: string,
  params?: ParceiroQuery,
) {
  const form = new FormData()
  form.set('file', arquivo)
  form.set('momento', momento)
  if (legenda.trim()) form.set('legenda', legenda.trim())
  return chamar<FotoDaEstadia>(daHospedagem(id, '/fotos'), { method: 'POST', body: form }, params)
}

/** URL assinada de 5 minutos: peça ao abrir a foto, não guarde. */
export function urlDaFoto(id: string, fotoId: string, params?: ParceiroQuery) {
  return chamar<{ url: string; expiraEm: string }>(
    daHospedagem(id, `/fotos/${encodeURIComponent(fotoId)}/url`),
    undefined,
    params,
  )
}

export async function apagarFoto(id: string, fotoId: string, params?: ParceiroQuery) {
  await apiFetch<unknown>(
    comQuery(daHospedagem(id, `/fotos/${encodeURIComponent(fotoId)}`), {
      parceiroId: params?.parceiroId,
    }),
    { method: 'DELETE' },
  )
}
