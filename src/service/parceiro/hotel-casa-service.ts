/**
 * A casa do hotel pela API (E7-01, PJ-OG9YPX). Guia `portal-parceiro-e7.md`, seções 1 a 11.
 *
 * Uma leitura só (`GET /catalogos`, com `ETag`: o navegador revalida sozinho) ao abrir a tela e
 * depois de cada gravação; nada de reler em laço (300 leituras por hora).
 *
 * - Ler a casa e a política: `hotel.ler`.
 * - Dinheiro (tarifas, temporadas, preço do serviço, percentuais da política): `hotel.valores`.
 *   Sem ela, o campo **não vem** (nem zerado): sem o campo, sem a coluna.
 * - Criar, editar, apagar, reativar e salvar a política: `estabelecimento.editar` (com
 *   `hotel.valores` no que é dinheiro).
 * - Desativar uma acomodação: `estabelecimento.editar` ou `hotel.rotina` (o cuidador desativa a
 *   baia quebrada às 3 da manhã, mas não reativa nem apaga).
 */
import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'
import type {
  AcomodacaoDto,
  AtualizarAcomodacaoDto,
  AtualizarExigenciaDto,
  AtualizarServicoDto,
  AtualizarTarifaDto,
  AtualizarTemporadaDto,
  BlocoDto,
  CatalogosDto,
  CriarAcomodacaoDto,
  CriarExigenciaDto,
  CriarServicoDto,
  CriarTarifaDto,
  CriarTemporadaDto,
  ExigenciaDto,
  PoliticaDoHotelDto,
  SalvarPoliticaDoHotelDto,
  ServicoDto,
  TarifaDto,
  TemporadaDto,
  TipoDto,
  VacinaDoCatalogoParaHotelDto,
} from '../contrato/openapi'
import { comIdempotencia } from '../idempotencia'

export type CasaDoHotel = CatalogosDto
export type BlocoDaCasa = BlocoDto
export type TipoDaCasa = TipoDto
export type AcomodacaoDaCasa = AcomodacaoDto
export type NovaAcomodacao = CriarAcomodacaoDto
export type EdicaoDaAcomodacao = AtualizarAcomodacaoDto
export type TarifaDaCasa = TarifaDto
export type NovaTarifa = CriarTarifaDto
export type TemporadaDaCasa = TemporadaDto
export type NovaTemporada = CriarTemporadaDto
export type ServicoDaCasa = ServicoDto
export type PoliticaDaCasa = PoliticaDoHotelDto
export type NovaPolitica = SalvarPoliticaDoHotelDto
export type ExigenciaDaCasa = ExigenciaDto
export type NovaExigencia = CriarExigenciaDto
export type VacinaParaExigencia = VacinaDoCatalogoParaHotelDto

export type IconeDaCasa = BlocoDto['icone']
export type PorteDaCasa = AcomodacaoDto['porteMaximo']
export type EspecieDaCasa = AcomodacaoDto['especiesAceitas'][number]
export type RecursoDaCasa = AcomodacaoDto['recursos'][number]
export type MotivoDeInativa = NonNullable<AcomodacaoDto['motivoInativa']>
export type KindDeServico = ServicoDto['kind']
export type KindDeExigencia = ExigenciaDto['kind']

export const ICONES_DA_CASA: readonly IconeDaCasa[] = [
  'CASA',
  'CAMA',
  'GATO',
  'CAO',
  'GRUPO',
  'ESCUDO',
  'ARVORE',
  'PASSARO',
  'COELHO',
]
export const PORTES: readonly PorteDaCasa[] = ['MINI', 'PEQUENO', 'MEDIO', 'GRANDE', 'GIGANTE']
export const ESPECIES: readonly EspecieDaCasa[] = [
  'CACHORRO',
  'GATO',
  'AVE',
  'ROEDOR',
  'COELHO',
  'PEIXE',
  'REPTIL',
  'OUTRO',
]
export const RECURSOS: readonly RecursoDaCasa[] = [
  'CAMERA',
  'CLIMATIZACAO',
  'AREA_EXTERNA',
  'PISO_AQUECIDO',
  'JANELA',
]
export const MOTIVOS_DE_INATIVA: readonly MotivoDeInativa[] = [
  'MANUTENCAO',
  'DESINFECCAO',
  'REFORMA',
  'EQUIPAMENTO',
  'OUTRO',
]
export const KINDS_DE_SERVICO: readonly KindDeServico[] = [
  'BANHO',
  'TOSA',
  'PASSEIO_EXTRA',
  'RECREACAO_INDIVIDUAL',
  'TRANSPORTE',
  'ADESTRAMENTO',
  'MEDICACAO_ASSISTIDA',
]
export const KINDS_DE_EXIGENCIA: readonly KindDeExigencia[] = [
  'VACINA_POLIVALENTE',
  'VACINA_ANTIRRABICA',
  'VACINA_TOSSE_CANIS',
  'VACINA_GIARDIA',
  'VERMIFUGO',
  'ANTIPULGAS',
  'EXAME_PARASITOLOGICO',
  'TERMO_RESPONSABILIDADE',
]

/* As faixas do guia (seções 3 a 10). */
export const NOME_MAX = 60
export const DIARIA_MAX_CENTAVOS = 2_000_000
export const PRECO_MAX_CENTAVOS = 2_000_000
export const CAPACIDADE_MAX = 20
export const HIGIENIZACAO_MAX_MINUTOS = 1440
export const ACRESCIMO_MAX = 300
export const CANCELAMENTO_MAX_DIAS = 365
export const VALIDADE_MAX_MESES = 60
/** Ao menos uma letra ou número (de qualquer alfabeto). */
export const NOME_VALIDO = /[\p{L}\p{N}]/u

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
const de = (recurso: string, id: string, resto = '') =>
  `${BASE}/${recurso}/${encodeURIComponent(id)}${resto}`

function chamar<T>(caminho: string, init: RequestInit, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<T>>(comQuery(caminho, { parceiroId: params?.parceiroId }), init),
  )
}

async function apagar(caminho: string, params?: ParceiroQuery) {
  await apiFetch<unknown>(comQuery(caminho, { parceiroId: params?.parceiroId }), {
    method: 'DELETE',
  })
}

export function lerCasa(params?: ParceiroQuery) {
  return chamar<CasaDoHotel>(`${BASE}/catalogos`, { method: 'GET' }, params)
}

/* ---------------------------------------------------------------------- blocos e tipos */

type Agrupamento = 'blocos' | 'tipos'
type ItemDoAgrupamento<A extends Agrupamento> = A extends 'blocos' ? BlocoDaCasa : TipoDaCasa

export function criarAgrupamento<A extends Agrupamento>(
  qual: A,
  corpo: { nome: string; icone: IconeDaCasa },
  params?: ParceiroQuery,
) {
  return chamar<ItemDoAgrupamento<A>>(`${BASE}/${qual}`, json('POST', corpo), params)
}

export function editarAgrupamento<A extends Agrupamento>(
  qual: A,
  id: string,
  corpo: { nome?: string; icone?: IconeDaCasa },
  params?: ParceiroQuery,
) {
  return chamar<ItemDoAgrupamento<A>>(de(qual, id), json('PATCH', corpo), params)
}

export function apagarAgrupamento(qual: Agrupamento, id: string, params?: ParceiroQuery) {
  return apagar(de(qual, id), params)
}

/** No extremo nada muda (200). Responde a lista já na nova ordem. */
export function moverAgrupamento<A extends Agrupamento>(
  qual: A,
  id: string,
  direcao: 'SOBE' | 'DESCE',
  params?: ParceiroQuery,
) {
  return chamar<{ itens: ItemDoAgrupamento<A>[] }>(
    de(qual, id, '/mover'),
    json('POST', { direcao }),
    params,
  )
}

/* ------------------------------------------------------------------------------ tarifas */

export function criarTarifa(corpo: NovaTarifa, chave: string, params?: ParceiroQuery) {
  return chamar<TarifaDaCasa>(
    `${BASE}/tarifas`,
    comIdempotencia(chave, json('POST', corpo)),
    params,
  )
}

/** `diariaPorPorte` vai inteira (os 5 portes). */
export function editarTarifa(id: string, corpo: AtualizarTarifaDto, params?: ParceiroQuery) {
  return chamar<TarifaDaCasa>(de('tarifas', id), json('PATCH', corpo), params)
}

export function apagarTarifa(id: string, params?: ParceiroQuery) {
  return apagar(de('tarifas', id), params)
}

/* -------------------------------------------------------------------------- acomodações */

export function criarAcomodacao(corpo: NovaAcomodacao, chave: string, params?: ParceiroQuery) {
  return chamar<AcomodacaoDaCasa>(
    `${BASE}/acomodacoes`,
    comIdempotencia(chave, json('POST', corpo)),
    params,
  )
}

export function editarAcomodacao(id: string, corpo: EdicaoDaAcomodacao, params?: ParceiroQuery) {
  return chamar<AcomodacaoDaCasa>(de('acomodacoes', id), json('PATCH', corpo), params)
}

export function desativarAcomodacao(
  id: string,
  corpo: { motivo: MotivoDeInativa; detalhe?: string },
  params?: ParceiroQuery,
) {
  return chamar<AcomodacaoDaCasa>(de('acomodacoes', id, '/desativar'), json('POST', corpo), params)
}

export function reativarAcomodacao(id: string, params?: ParceiroQuery) {
  return chamar<AcomodacaoDaCasa>(de('acomodacoes', id, '/reativar'), json('POST'), params)
}

export function apagarAcomodacao(id: string, params?: ParceiroQuery) {
  return apagar(de('acomodacoes', id), params)
}

/* --------------------------------------------------------------------------- temporadas */

export function criarTemporada(corpo: NovaTemporada, params?: ParceiroQuery) {
  return chamar<TemporadaDaCasa>(`${BASE}/temporadas`, json('POST', corpo), params)
}

export function editarTemporada(id: string, corpo: AtualizarTemporadaDto, params?: ParceiroQuery) {
  return chamar<TemporadaDaCasa>(de('temporadas', id), json('PATCH', corpo), params)
}

export function apagarTemporada(id: string, params?: ParceiroQuery) {
  return apagar(de('temporadas', id), params)
}

/* ----------------------------------------------------------------------------- serviços */

export function criarServico(corpo: CriarServicoDto, params?: ParceiroQuery) {
  return chamar<ServicoDaCasa>(`${BASE}/servicos`, json('POST', corpo), params)
}

/** Não há apagar: tirar de venda é `ativo: false`. */
export function editarServico(id: string, corpo: AtualizarServicoDto, params?: ParceiroQuery) {
  return chamar<ServicoDaCasa>(de('servicos', id), json('PATCH', corpo), params)
}

/* ----------------------------------------------------------------------------- política */

export function lerPolitica(params?: ParceiroQuery) {
  return chamar<PoliticaDaCasa>(`${BASE}/politica`, { method: 'GET' }, params)
}

/** A política inteira (os 6 campos). O mesmo corpo de novo é seguro. */
export function salvarPolitica(corpo: NovaPolitica, params?: ParceiroQuery) {
  return chamar<PoliticaDaCasa>(`${BASE}/politica`, json('PUT', corpo), params)
}

/* --------------------------------------------------------------------------- exigências */

export function criarExigencia(corpo: NovaExigencia, params?: ParceiroQuery) {
  return chamar<ExigenciaDaCasa>(`${BASE}/exigencias`, json('POST', corpo), params)
}

export function editarExigencia(id: string, corpo: AtualizarExigenciaDto, params?: ParceiroQuery) {
  return chamar<ExigenciaDaCasa>(de('exigencias', id), json('PATCH', corpo), params)
}

export function apagarExigencia(id: string, params?: ParceiroQuery) {
  return apagar(de('exigencias', id), params)
}

/** A vacina global ou da própria casa, para a exigência de vacina (até 200). */
export function listarVacinasParaExigencia(especie?: EspecieDaCasa | null, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<VacinaParaExigencia[]>>(
      comQuery(`${BASE}/vacinas-do-catalogo`, { especie, parceiroId: params?.parceiroId }),
    ),
  )
}
