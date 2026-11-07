/**
 * O resumo e o faturamento do hotel pela API (E7-06, PJ-62YZHU, parte do portal). Guia
 * `portal-parceiro-e7.md`, seções 20 e 20.1.
 *
 * - `GET /resumo` (`hotel.ler`): ocupação, cancelamento, não comparecimento, origem, retorno e
 *   ocorrências, tudo em contagens e razões 0..1 com o denominador ao lado. O bloco `receita` só
 *   vem para quem tem `hotel.faturamento`; para os outros a chave não existe.
 * - `GET /resumo/receita` (`hotel.faturamento`): só o dinheiro, para o financeiro, que não tem
 *   `hotel.ler` e leva 403 no `/resumo`.
 *
 * Sem nada, o período é o dos últimos 30 dias até hoje (o da clínica é HOJE). O limite é de 10
 * pedidos por minuto por pessoa, somadas as duas rotas: a tela não repete sozinha.
 */
import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'
import type { components } from '../contrato/openapi'

type Schemas = components['schemas']

export type ResumoDoHotel = Schemas['ResumoDoHotelDto']
export type ReceitaDoHotel = Schemas['ReceitaDoHotelDto']
export type ReceitaDoHotelResposta = Schemas['ReceitaDoHotelRespostaDto']
export type TaxaComBase = Schemas['TaxaComBaseDto']
export type PontoDaOcupacao = Schemas['PontoDaOcupacaoDto']
export type OrigemDoResumo = Schemas['OrigemDoHotelDto']['origem']
export type OcorrenciasDoTipo = Schemas['OcorrenciasDoTipoDto']

export const PERIODOS_DO_HOTEL = {
  hoje: 'HOJE',
  semana: 'SEMANA',
  'semana-passada': 'SEMANA_PASSADA',
  'trinta-dias': 'TRINTA_DIAS',
} as const

export type PeriodoDoHotel = keyof typeof PERIODOS_DO_HOTEL

/** O período livre vai até 90 dias, os dois lados inclusive (guia 20). */
export const RESUMO_DO_HOTEL_MAX_DIAS = 90

export type FiltroDoResumoDoHotel = { periodo: PeriodoDoHotel } | { de: string; ate: string }

type ParceiroQuery = { parceiroId?: string | null }

const BASE = '/parceiro/portal/hotel/resumo'

function comQuery(caminho: string, query: Record<string, string | null | undefined>) {
  const busca = new URLSearchParams()
  for (const [chave, valor] of Object.entries(query)) {
    if (valor !== undefined && valor !== null && valor !== '') busca.set(chave, valor)
  }
  const texto = busca.toString()
  return texto ? `${caminho}?${texto}` : caminho
}

function caminho(rota: string, filtro: FiltroDoResumoDoHotel, params?: ParceiroQuery) {
  return comQuery(rota, {
    periodo: 'periodo' in filtro ? PERIODOS_DO_HOTEL[filtro.periodo] : undefined,
    de: 'de' in filtro ? filtro.de : undefined,
    ate: 'ate' in filtro ? filtro.ate : undefined,
    parceiroId: params?.parceiroId,
  })
}

async function dados<T>(promise: Promise<ApiEnvelope<T>>) {
  return (await promise).data
}

/** O resumo da casa; `receita` só vem para quem tem `hotel.faturamento`. */
export function lerResumoDoHotel(filtro: FiltroDoResumoDoHotel, params?: ParceiroQuery) {
  return dados(apiFetch<ApiEnvelope<ResumoDoHotel>>(caminho(BASE, filtro, params)))
}

/** Só o faturamento: a rota do financeiro (o dono e o gestor também podem chamá-la). */
export function lerReceitaDoHotel(filtro: FiltroDoResumoDoHotel, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<ReceitaDoHotelResposta>>(caminho(`${BASE}/receita`, filtro, params)),
  )
}
