/**
 * As reservas do hotel pela API (E7-02, PJ-28JU4U). Guia `portal-parceiro-e7.md`, seções 13 a 20
 * e 28 a 34.
 *
 * Datas no corpo em `AAAA-MM-DD` e horas em `HH:mm`, na parede da casa e sem offset; tudo volta em
 * ISO com o offset da casa. O orçamento é sempre o do servidor (o corpo não tem preço nem total).
 *
 * - Mapa, ler reserva, grade, lista e espera: `hotel.ler`.
 * - Simular, criar, editar, cancelar, não comparecimento, comprovantes e espera: `hotel.reserva`.
 * - Registrar pagamento (`confirmar`): `hotel.valores`. Sem ela o dinheiro some da resposta.
 * - Dispensar ou revogar exigência que bloqueia: `estabelecimento.editar`.
 */
import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'
import type {
  CancelarReservaDto,
  ComprovanteDto,
  ConfirmarReservaDto,
  CriarEsperaDto,
  CriarReservaDto,
  DispensaDto,
  EditarReservaDto,
  EsperaDto,
  GradeDto,
  ItemDaListaDto,
  ListaDeEsperaDto,
  MapaDoHotelDto,
  PaginaDeReservasDto,
  RegistrarComprovanteDto,
  ReservaCanceladaDto,
  ReservaDetalheDto,
  ReservaDto,
  ReservaEditadaDto,
  SimulacaoDaReservaDto,
  SimularReservaDto,
} from '../contrato/openapi'
import { comIdempotencia } from '../idempotencia'

export type MapaDoHotel = MapaDoHotelDto
export type VagaDoMapa = MapaDoHotelDto['vagas'][number]
export type SituacaoDaVaga = VagaDoMapa['situacao']
export type Impedimento = VagaDoMapa['impedimentos'][number]
export type Simulacao = SimulacaoDaReservaDto
export type CorpoDaSimulacao = SimularReservaDto
export type Orcamento = NonNullable<SimulacaoDaReservaDto['orcamento']>
export type LinhaDoOrcamento = Orcamento['linhas'][number]
export type Reserva = ReservaDto
export type ReservaDetalhe = ReservaDetalheDto
export type StatusDaReserva = ReservaDto['status']
export type OrigemDaReserva = ReservaDto['origem']
export type OrigemDoBalcao = CriarReservaDto['origem']
export type MotivoDoCancelamento = CancelarReservaDto['motivo']
export type ServicoContratado = NonNullable<CriarReservaDto['servicos']>[number]
export type AdmissaoDoAnimal = ReservaDetalheDto['admissao'][number]
export type ItemDaAdmissao = AdmissaoDoAnimal['itens'][number]
export type SituacaoDaExigencia = ItemDaAdmissao['situacao']
export type ComprovanteDaAdmissao = NonNullable<ItemDaAdmissao['comprovante']>
export type AutorizadoDaReserva = NonNullable<ReservaDetalheDto['autorizados']>[number]
export type ItemDaLista = ItemDaListaDto
export type PaginaDeReservas = PaginaDeReservasDto
export type Grade = GradeDto
export type BarraDaGrade = GradeDto['barras'][number]
export type Espera = EsperaDto
export type StatusDaEspera = EsperaDto['status']

/** Quem retira: alguém do cadastro do cliente ou escrito à mão (até 5; o documento volta só com o final). */
export type AutorizadoNovo =
  | { pessoaAutorizadaId: string }
  | { nome: string; telefone?: string; documento?: string; relacao?: string }

export type NovaReserva = Omit<CriarReservaDto, 'autorizados'> & { autorizados?: AutorizadoNovo[] }
export type EdicaoDaReserva = Omit<EditarReservaDto, 'autorizados'> & {
  autorizados?: AutorizadoNovo[]
}

export const ORIGENS_DO_BALCAO: readonly OrigemDoBalcao[] = [
  'BALCAO',
  'TELEFONE',
  'WHATSAPP',
  'RETORNO',
  'INDICACAO',
]
/** `EXCLUSAO_DO_TITULAR` e `OBITO_DO_ANIMAL` são só do sistema: não entram no seletor. */
export const MOTIVOS_DO_CANCELAMENTO: readonly MotivoDoCancelamento[] = [
  'RESPONSAVEL_DESISTIU',
  'VIAGEM_CANCELADA',
  'ANIMAL_DOENTE',
  'HOTEL_INDISPONIVEL',
  'PRECO',
  'OUTRO',
]
export const SERVICOS_MAX = 20
export const QUANTIDADE_MAX = 99
export const OBSERVACAO_MAX = 500
export const AUTORIZADOS_MAX = 5
export const MOTIVO_MIN = 10
export const MOTIVO_MAX = 300
export const NOITES_MAX = 120
export const GRADE_DIAS = 14
export const GRADE_DIAS_MAX = 45
export const DOCUMENTO_MAX_BYTES = 8 * 1024 * 1024
export const DOCUMENTO_ACEITO = 'image/jpeg,image/png,image/webp,application/pdf'
export const OFERTA_HORAS_PADRAO = 24
export const OFERTA_HORAS_MAX = 72

type ParceiroQuery = { parceiroId?: string | null }

function comQuery(
  caminho: string,
  query: Record<string, string | number | boolean | null | undefined>,
) {
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

function chamar<T>(caminho: string, init: RequestInit = { method: 'GET' }, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<T>>(comQuery(caminho, { parceiroId: params?.parceiroId }), init),
  )
}

/* ------------------------------------------------------------------------- mapa e reserva */

export type FiltroDoMapa = {
  entradaData: string
  saidaData: string
  entradaHora?: string | null
  saidaHora?: string | null
  /** `pacienteId` ou `porte` + `especie` (os dois ou nenhum). */
  pacienteId?: string | null
  porte?: string | null
  especie?: string | null
  ocupantes?: number | null
}

/** O mapa do período (balde próprio: é a rota do polling do mapa, não o `GET /catalogos`). */
export function lerMapa(filtro: FiltroDoMapa, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<MapaDoHotel>>(
      comQuery(`${BASE}/mapa`, { ...filtro, parceiroId: params?.parceiroId }),
    ),
  )
}

/** Com `reservaId`, simula a edição e devolve a `diferenca`. */
export function simularReserva(corpo: CorpoDaSimulacao, params?: ParceiroQuery) {
  return chamar<Simulacao>(`${BASE}/reservas/simular`, json('POST', corpo), params)
}

/** Sempre com `Idempotency-Key`: repetir devolve a mesma reserva. Nasce `PENDENTE`. */
export function criarReserva(corpo: NovaReserva, chave: string, params?: ParceiroQuery) {
  return chamar<Reserva>(`${BASE}/reservas`, comIdempotencia(chave, json('POST', corpo)), params)
}

export function lerReserva(id: string, params?: ParceiroQuery) {
  return chamar<ReservaDetalhe>(daReserva(id), { method: 'GET' }, params)
}

/** Com a `versao` aberta; outra pessoa no meio dá 409 `RESERVA_ALTERADA` (`versaoAtual`). */
export function editarReserva(id: string, corpo: EdicaoDaReserva, params?: ParceiroQuery) {
  return chamar<ReservaEditadaDto>(daReserva(id), json('PATCH', corpo), params)
}

/** `pagoCentavos` é o TOTAL pago acumulado, não o desta vez. Baixar pede `motivo`. */
export function confirmarReserva(id: string, corpo: ConfirmarReservaDto, params?: ParceiroQuery) {
  return chamar<Reserva>(daReserva(id, '/confirmar'), json('POST', corpo), params)
}

export function cancelarReserva(id: string, motivo: MotivoDoCancelamento, params?: ParceiroQuery) {
  return chamar<ReservaCanceladaDto>(daReserva(id, '/cancelar'), json('POST', { motivo }), params)
}

/** Sem corpo e sem `Content-Type`. Só a partir do fim do dia da entrada. */
export function marcarNaoCompareceu(id: string, params?: ParceiroQuery) {
  return chamar<Reserva>(daReserva(id, '/nao-compareceu'), { method: 'POST' }, params)
}

/* ---------------------------------------------------------------------------- lista e grade */

export type FiltroDaLista = {
  status?: StatusDaReserva[] | null
  pacienteId?: string | null
  historico?: boolean
  de?: string | null
  ate?: string | null
  cursor?: string | null
  limit?: number
}

/** Abre "a partir de ontem" na casa; `historico` tira o piso. O cursor só vale para o mesmo filtro. */
export function listarReservas(filtro: FiltroDaLista, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<PaginaDeReservas>>(
      comQuery(`${BASE}/reservas`, {
        status: filtro.status?.length ? filtro.status.join(',') : null,
        pacienteId: filtro.pacienteId,
        historico: filtro.historico ? true : null,
        de: filtro.de,
        ate: filtro.ate,
        cursor: filtro.cursor,
        limit: filtro.limit ?? 30,
        parceiroId: params?.parceiroId,
      }),
    ),
  )
}

/** Até 45 dias; prefira janelas de 14. O selo custa: peça só fora do polling. */
export function lerGrade(de: string, ate: string, comSelo: boolean, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Grade>>(
      comQuery(`${BASE}/grade`, { de, ate, comSelo, parceiroId: params?.parceiroId }),
    ),
  )
}

/* ------------------------------------------------------------------ comprovantes e dispensas */

/** O "visto no balcão", sem arquivo. Na exigência que bloqueia: 422 `COMPROVANTE_EXIGE_DOCUMENTO`. */
export function registrarComprovante(
  reservaId: string,
  corpo: RegistrarComprovanteDto,
  params?: ParceiroQuery,
) {
  return chamar<ComprovanteDto>(daReserva(reservaId, '/comprovantes'), json('POST', corpo), params)
}

/** Com a foto (JPG, PNG, WEBP) ou o PDF, até 8 MB, no campo `file`. */
export function registrarComprovanteComDocumento(
  reservaId: string,
  corpo: RegistrarComprovanteDto,
  arquivo: File,
  params?: ParceiroQuery,
) {
  const form = new FormData()
  form.set('file', arquivo)
  for (const [chave, valor] of Object.entries(corpo)) {
    if (valor !== undefined && valor !== null && valor !== '') form.set(chave, String(valor))
  }
  return chamar<ComprovanteDto>(
    daReserva(reservaId, '/comprovantes/com-documento'),
    { method: 'POST', body: form },
    params,
  )
}

export function anularComprovante(id: string, motivo: string, params?: ParceiroQuery) {
  return chamar<ComprovanteDto>(
    `${BASE}/comprovantes/${encodeURIComponent(id)}/anular`,
    json('POST', { motivo }),
    params,
  )
}

export function dispensarExigencia(
  reservaId: string,
  corpo: { kind: ItemDaAdmissao['kind']; pacienteId?: string; motivo: string },
  params?: ParceiroQuery,
) {
  return chamar<DispensaDto>(daReserva(reservaId, '/dispensas'), json('POST', corpo), params)
}

export function revogarDispensa(id: string, params?: ParceiroQuery) {
  return chamar<DispensaDto>(
    `${BASE}/dispensas/${encodeURIComponent(id)}/revogar`,
    { method: 'POST' },
    params,
  )
}

/* ------------------------------------------------------------------------- lista de espera */

export function listarEspera(status?: StatusDaEspera | null, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<ListaDeEsperaDto>>(
      comQuery(`${BASE}/espera`, { status, parceiroId: params?.parceiroId }),
    ),
  )
}

export function criarEspera(corpo: CriarEsperaDto, params?: ParceiroQuery) {
  return chamar<Espera>(`${BASE}/espera`, json('POST', corpo), params)
}

/** Não segura a baia: o primeiro que reservar leva. */
export function ofertarEspera(id: string, validadeHoras: number, params?: ParceiroQuery) {
  return chamar<Espera>(
    `${BASE}/espera/${encodeURIComponent(id)}/ofertar`,
    json('POST', { validadeHoras }),
    params,
  )
}

/** Desistiu: a linha fica, e repetir dá 204. */
export async function desistirDaEspera(id: string, params?: ParceiroQuery) {
  await apiFetch<unknown>(
    comQuery(`${BASE}/espera/${encodeURIComponent(id)}`, { parceiroId: params?.parceiroId }),
    { method: 'DELETE' },
  )
}
