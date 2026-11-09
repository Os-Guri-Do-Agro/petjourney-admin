/**
 * O diário e as ocorrências da estadia pela API (E7-05b, PJ-21T3ER). Guia `portal-parceiro-e7.md`,
 * seção 43.
 *
 * - Ler o diário, as ocorrências e a URL da foto: `hotel.ler`.
 * - Escrever no diário, registrar ocorrência, tentativa e contato, mudar a gravidade e pedir o
 *   telefone: `hotel.rotina`, com ficha de profissional ativa (403 `PROFISSIONAL_OBRIGATORIO`).
 * - `SEM_RESPOSTA` e descer uma GRAVE: `estabelecimento.editar` (dono e gestor).
 *
 * A R3: ocorrência GRAVE exige contato por voz com o responsável. Enquanto falta, a passagem do
 * turno e o check-out seguram (`travaAPassagem`) e o boletim fica retido (`semContato`). O
 * telefone sai por uma rota própria e cada leitura fica gravada: a tela pede só depois de um toque e
 * não guarda o número.
 */
import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'
import type {
  CanalDoContato,
  ContatoCorpoDto,
  ContatoDoResponsavelDto,
  DestinoDoContato,
  GravidadeOcorrencia,
  ItemDoDiarioDto,
  OcorrenciaCorpoDto,
  OcorrenciaDoHotelDto,
  OcorrenciaKind,
  PaginaDoDiarioDto,
  RegistroDoDiarioCorpoDto,
  RegistroDoDiarioDto,
  RegistroDoDiarioKind,
  TentativaCorpoDto,
  UrlDaFotoDoDiarioDto,
} from '../contrato/openapi'
import { comIdempotencia } from '../idempotencia'

export type KindDoDiario = RegistroDoDiarioKind
export type RegistroDoDiario = RegistroDoDiarioDto
export type NovoRegistroDoDiario = RegistroDoDiarioCorpoDto
export type ItemDoDiario = ItemDoDiarioDto
export type PaginaDoDiario = PaginaDoDiarioDto
export type Ocorrencia = OcorrenciaDoHotelDto
export type NovaOcorrencia = OcorrenciaCorpoDto
export type KindDaOcorrencia = OcorrenciaKind
export type Gravidade = GravidadeOcorrencia
export type CanalDeContato = CanalDoContato
export type DestinoDeContato = DestinoDoContato
export type ContatoDoResponsavel = ContatoDoResponsavelDto
export type NovoContato = ContatoCorpoDto
export type NovaTentativa = TentativaCorpoDto

export const KINDS_DO_DIARIO: readonly KindDoDiario[] = [
  'REFEICAO',
  'PASSEIO',
  'BRINCADEIRA',
  'SONO',
  'ELIMINACAO',
  'BANHO',
  'CARINHO',
  'OBSERVACAO',
]
export const KINDS_DA_OCORRENCIA: readonly KindDaOcorrencia[] = [
  'BRIGA',
  'TENTATIVA_DE_FUGA',
  'LESAO',
  'VOMITO',
  'DIARREIA',
  'RECUSA_ALIMENTAR',
  'APATIA',
  'TOSSE',
  'ESTRESSE',
  'DESTRUICAO',
  'OUTRO',
]
export const GRAVIDADES: readonly Gravidade[] = ['LEVE', 'MODERADA', 'GRAVE']
/** O contato vale por voz: mensagem de texto não conta. */
export const CANAIS_DE_CONTATO: readonly CanalDeContato[] = [
  'TELEFONE',
  'CHAMADA_PELO_APP',
  'PRESENCIAL',
]

/* As faixas do guia (seção 43). */
export const TEXTO_DO_DIARIO_MAX = 500
export const DESCRICAO_DA_OCORRENCIA_MAX = 500
export const CONDUTA_MAX = 300
export const NOTA_SEM_RESPOSTA_MIN = 10
export const NOTA_SEM_RESPOSTA_MAX = 300
export const FOTO_DO_DIARIO_MAX_BYTES = 8 * 1024 * 1024
export const FOTO_DO_DIARIO_ACEITA = 'image/jpeg,image/png,image/webp'

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
const daOcorrencia = (id: string, resto = '') =>
  `${BASE}/ocorrencias/${encodeURIComponent(id)}${resto}`

async function chamar<T>(
  caminho: string,
  init: RequestInit = { method: 'GET' },
  query: Record<string, string | null | undefined> = {},
) {
  const resposta = await apiFetch<ApiEnvelope<T>>(comQuery(caminho, query), init)
  return resposta.data
}

/* ---------------------------------------------------------------------------------- diário */

/** 30 por página, do mais recente: os registros e as ocorrências LEVES e MODERADAS. */
export function lerDiario(hospedagemId: string, cursor?: string | null, params?: ParceiroQuery) {
  return chamar<PaginaDoDiario>(daHospedagem(hospedagemId, '/diario'), undefined, {
    cursor,
    parceiroId: params?.parceiroId,
  })
}

/** O texto em JSON primeiro; a foto depois, noutra chamada (o texto não se perde se ela falhar). */
export function escreverNoDiario(
  hospedagemId: string,
  corpo: NovoRegistroDoDiario,
  chave: string,
  params?: ParceiroQuery,
) {
  return chamar<RegistroDoDiario>(
    daHospedagem(hospedagemId, '/diario'),
    comIdempotencia(chave, json('POST', corpo)),
    { parceiroId: params?.parceiroId },
  )
}

/** Uma foto por entrada, só de quem escreveu, uma vez. */
export function enviarFotoDoDiario(
  hospedagemId: string,
  registroId: string,
  arquivo: File,
  params?: ParceiroQuery,
) {
  const form = new FormData()
  form.set('file', arquivo)
  return chamar<RegistroDoDiario>(
    daHospedagem(hospedagemId, `/diario/${encodeURIComponent(registroId)}/foto`),
    { method: 'POST', body: form },
    { parceiroId: params?.parceiroId },
  )
}

/** URL assinada de 5 minutos: peça ao abrir, não guarde. */
export function urlDaFotoDoDiario(
  hospedagemId: string,
  registroId: string,
  params?: ParceiroQuery,
) {
  return chamar<UrlDaFotoDoDiarioDto>(
    daHospedagem(hospedagemId, `/diario/${encodeURIComponent(registroId)}/foto/url`),
    undefined,
    { parceiroId: params?.parceiroId },
  )
}

/* ----------------------------------------------------------------------------- ocorrências */

/** As da estadia (até 200), a mais recente primeiro. */
export function listarOcorrencias(hospedagemId: string, params?: ParceiroQuery) {
  return chamar<Ocorrencia[]>(daHospedagem(hospedagemId, '/ocorrencias'), undefined, {
    parceiroId: params?.parceiroId,
  })
}

export function lerOcorrencia(id: string, params?: ParceiroQuery) {
  return chamar<Ocorrencia>(daOcorrencia(id), undefined, { parceiroId: params?.parceiroId })
}

/** A GRAVE nasce com `exigeContato`. */
export function registrarOcorrencia(
  hospedagemId: string,
  corpo: NovaOcorrencia,
  chave: string,
  params?: ParceiroQuery,
) {
  return chamar<Ocorrencia>(
    daHospedagem(hospedagemId, '/ocorrencias'),
    comIdempotencia(chave, json('POST', corpo)),
    { parceiroId: params?.parceiroId },
  )
}

/**
 * O telefone para ligar. Só de GRAVE ainda sem contato, de estadia em andamento. Cada leitura fica
 * gravada antes de o número sair, com limite por pessoa (429 `ROTINA_TAXA_EXCEDIDA`).
 */
export function lerContatoDoResponsavel(id: string, params?: ParceiroQuery) {
  return chamar<ContatoDoResponsavel>(daOcorrencia(id, '/contato-do-responsavel'), undefined, {
    parceiroId: params?.parceiroId,
  })
}

/** O contato por voz com o responsável. O primeiro vale; de novo devolve o registrado. */
export function registrarContato(id: string, corpo: NovoContato, params?: ParceiroQuery) {
  return chamar<Ocorrencia>(daOcorrencia(id, '/contato'), json('POST', corpo), {
    parceiroId: params?.parceiroId,
  })
}

/** Uma ligação. Ao responsável que atendeu, já registra o contato junto. */
export function registrarTentativa(
  id: string,
  corpo: NovaTentativa,
  chave: string,
  params?: ParceiroQuery,
) {
  return chamar<Ocorrencia>(
    daOcorrencia(id, '/tentativas'),
    comIdempotencia(chave, json('POST', corpo)),
    { parceiroId: params?.parceiroId },
  )
}

/** Libera a passagem e o check-out, nunca o boletim. */
export function registrarSemResposta(id: string, nota: string, params?: ParceiroQuery) {
  return chamar<Ocorrencia>(daOcorrencia(id, '/sem-resposta'), json('POST', { nota }), {
    parceiroId: params?.parceiroId,
  })
}

/** Subir é livre; descer pede motivo (e, da GRAVE, gestor ou dono antes da primeira ligação). */
export function mudarGravidade(
  id: string,
  corpo: { gravidade: Gravidade; motivo?: string },
  params?: ParceiroQuery,
) {
  return chamar<Ocorrencia>(daOcorrencia(id, '/gravidade'), json('POST', corpo), {
    parceiroId: params?.parceiroId,
  })
}
