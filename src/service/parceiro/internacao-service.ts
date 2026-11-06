/**
 * Leitos e internação pela API (E5-01, PJ-7G0NQI). Guia `portal-parceiro-e5.md`, seções 1 a 12,
 * 21 e 22.
 *
 * - Leitos (`estabelecimento.editar`; desativar também com `internacao.executar`): a API decide o
 *   nome sugerido e o que pode (apagar só o que nunca recebeu paciente).
 * - Internar e editar o caso (`internacao.prescrever`, com CRMV); mudar de leito, gravidade e
 *   previsão de alta (`internacao.executar`); detalhe e mapa (`prontuario.ler`); vagas
 *   (`agenda.ler`, a recepção).
 * - Encerrar (alta, transferência, óbito) com CRMV; o administrativo só sem veterinário apto.
 *
 * Internar, criar leito e encerrar aceitam `Idempotency-Key`: o duplo toque devolve o mesmo.
 */
import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'
import type {
  CelulaDoMapaDto,
  EditarInternacaoDto,
  EncerrarInternacaoDto,
  InternacaoDto,
  InternadoDoMapaDto,
  InternarDto,
  LeitoDto,
  ListaDeLeitosDto,
  MapaDto,
  MudarLeitoDto,
  VagasDto,
} from '../contrato/openapi'
import { comIdempotencia } from '../idempotencia'

export type Leito = LeitoDto
export type KindDoLeito = LeitoDto['kind']
export type MotivoDoLeitoInativo = NonNullable<LeitoDto['motivoInativo']>
export type ListaDeLeitos = ListaDeLeitosDto
export type Mapa = MapaDto
export type CelulaDoMapa = CelulaDoMapaDto
export type InternadoDoMapa = InternadoDoMapaDto
export type Vagas = VagasDto
export type Internacao = InternacaoDto
export type Gravidade = InternacaoDto['gravidade']
export type StatusDaInternacao = InternacaoDto['status']
export type NovaInternacao = InternarDto
export type Desfecho = EncerrarInternacaoDto['desfecho']
export type AvisoDeLeito = NonNullable<InternarDto['confirmarAvisos']>[number]
export type NivelDeUrgencia = InternadoDoMapaDto['urgencia']['nivel']
export type MotivoDeUrgencia = InternadoDoMapaDto['urgencia']['motivos'][number]

/** Na ordem da planta: a UTI primeiro (o mais grave do plantão), o resto como o cadastro. */
export const KINDS_DO_LEITO: readonly KindDoLeito[] = ['UTI', 'GERAL', 'FELINO', 'ISOLAMENTO']
export const MOTIVOS_DO_LEITO_INATIVO: readonly MotivoDoLeitoInativo[] = [
  'MANUTENCAO',
  'DESINFECCAO',
  'REFORMA',
  'EQUIPAMENTO',
  'OUTRO',
]
export const GRAVIDADES: readonly Gravidade[] = ['ESTAVEL', 'ATENCAO', 'CRITICO']
/** Na tela, o esperado primeiro e o grave por último (guia 10). */
export const DESFECHOS: readonly Desfecho[] = ['ALTA', 'TRANSFERIDO', 'OBITO']

export const NOME_DO_LEITO_MAX = 40
export const DETALHE_DO_LEITO_MAX = 200
export const MOTIVO_DA_INTERNACAO_MAX = 300
export const PESO_MIN = 0.01
export const PESO_MAX = 999.99
export const ORIENTACAO_MIN = 10
export const ORIENTACAO_MAX = 2000
export const MOTIVO_ADMINISTRATIVO_MIN = 20
export const MOTIVO_ADMINISTRATIVO_MAX = 500
/** O mapa se relê no máximo a cada 30 s (o teto de leitura é 1200 por hora por pessoa). */
export const RELER_MAPA_MS = 30_000

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
const LEITOS = `${CLINICA}/leitos`
const INTERNACOES = `${CLINICA}/internacoes`
const doLeito = (id: string, resto = '') => `${LEITOS}/${encodeURIComponent(id)}${resto}`
const daInternacao = (id: string, resto = '') => `${INTERNACOES}/${encodeURIComponent(id)}${resto}`

/* ------------------------------------------------------------------------------- leitos */

export function listarLeitos(params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<ListaDeLeitos>>(comQuery(LEITOS, { parceiroId: params?.parceiroId })),
  )
}

export function criarLeito(
  corpo: { salaId: string; nome: string; kind: KindDoLeito },
  chave: string,
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<Leito>>(
      comQuery(LEITOS, { parceiroId: params?.parceiroId }),
      comIdempotencia(chave, json('POST', corpo)),
    ),
  )
}

export function editarLeito(
  id: string,
  corpo: { salaId?: string; nome?: string; kind?: KindDoLeito },
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<Leito>>(
      comQuery(doLeito(id), { parceiroId: params?.parceiroId }),
      json('PATCH', corpo),
    ),
  )
}

export function desativarLeito(
  id: string,
  corpo: { motivo: MotivoDoLeitoInativo; detalhe?: string },
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<Leito>>(
      comQuery(doLeito(id, '/desativar'), { parceiroId: params?.parceiroId }),
      json('POST', corpo),
    ),
  )
}

export function reativarLeito(id: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Leito>>(
      comQuery(doLeito(id, '/reativar'), { parceiroId: params?.parceiroId }),
      json('POST'),
    ),
  )
}

/** 204: nada no corpo. */
export async function apagarLeito(id: string, params?: ParceiroQuery) {
  await apiFetch<unknown>(comQuery(doLeito(id), { parceiroId: params?.parceiroId }), {
    method: 'DELETE',
  })
}

/* ------------------------------------------------------------------------ mapa e vagas */

export function lerMapa(params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Mapa>>(
      comQuery(`${CLINICA}/internacao/mapa`, { parceiroId: params?.parceiroId }),
    ),
  )
}

export function lerVagas(params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Vagas>>(
      comQuery(`${CLINICA}/internacao/vagas`, { parceiroId: params?.parceiroId }),
    ),
  )
}

/* ---------------------------------------------------------------------------- internar */

export function internar(corpo: NovaInternacao, chave: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Internacao>>(
      comQuery(INTERNACOES, { parceiroId: params?.parceiroId }),
      comIdempotencia(chave, json('POST', corpo)),
    ),
  )
}

export function lerInternacao(id: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Internacao>>(
      comQuery(daInternacao(id), { parceiroId: params?.parceiroId }),
    ),
  )
}

export function editarInternacao(id: string, corpo: EditarInternacaoDto, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Internacao>>(
      comQuery(daInternacao(id), { parceiroId: params?.parceiroId }),
      json('PATCH', corpo),
    ),
  )
}

export function mudarDeLeito(id: string, corpo: MudarLeitoDto, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Internacao>>(
      comQuery(daInternacao(id, '/mudar-leito'), { parceiroId: params?.parceiroId }),
      json('POST', corpo),
    ),
  )
}

/** A mesma gravidade: 200 com `semMudanca: true`, nada gravado. */
export function mudarGravidade(id: string, gravidade: Gravidade, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Internacao>>(
      comQuery(daInternacao(id, '/gravidade'), { parceiroId: params?.parceiroId }),
      json('POST', { gravidade }),
    ),
  )
}

/** `null` limpa; o campo vai sempre no corpo. */
export function mudarPrevisaoDeAlta(
  id: string,
  altaPrevistaEm: string | null,
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<Internacao>>(
      comQuery(daInternacao(id, '/previsao-de-alta'), { parceiroId: params?.parceiroId }),
      json('POST', { altaPrevistaEm }),
    ),
  )
}

/* ---------------------------------------------------------------------------- encerrar */

export function encerrarInternacao(
  id: string,
  corpo: EncerrarInternacaoDto,
  chave: string,
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<Internacao>>(
      comQuery(daInternacao(id, '/encerrar'), { parceiroId: params?.parceiroId }),
      comIdempotencia(chave, json('POST', corpo)),
    ),
  )
}

/** Só sem veterinário ativo com CRMV em dia (senão 409); DONO ou GESTOR, sem CRMV. */
export function encerrarAdministrativo(
  id: string,
  motivo: string,
  chave: string,
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<Internacao>>(
      comQuery(daInternacao(id, '/encerrar-administrativo'), { parceiroId: params?.parceiroId }),
      comIdempotencia(chave, json('POST', { motivo })),
    ),
  )
}

/* ----------------------------------------------------------------------------- datas */

/**
 * Um instante no formato que a API pede (ISO com o offset). O navegador manda o próprio offset; a
 * API compara os instantes, então a hora certa na parede de quem digitou é a hora certa.
 */
export function instanteComOffset(data: Date) {
  const pad = (n: number) => String(Math.abs(Math.trunc(n))).padStart(2, '0')
  const offset = -data.getTimezoneOffset()
  const sinal = offset >= 0 ? '+' : '-'
  return (
    `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}` +
    `T${pad(data.getHours())}:${pad(data.getMinutes())}:00` +
    `${sinal}${pad(offset / 60)}:${pad(offset % 60)}`
  )
}

/** A internação ainda pede ação (as encerradas só se leem). */
export function emCurso(status: StatusDaInternacao) {
  return status === 'INTERNADO'
}
