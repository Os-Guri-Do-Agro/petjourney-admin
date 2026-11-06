/**
 * As faltas da Clínica pela API (E3-03, PJ-MVMNOZ). Guia `portal-parceiro-e3.md`, seção 3.
 *
 * O servidor decide tudo: a situação da falta, se aceita reagendar, quem é reincidente e quem falta
 * convidar. Ler (a falta, o painel, o histórico) é `agenda.ler`; marcar, fechar o turno, justificar
 * e reagendar, `agenda.escrever`. O óbito pede também `paciente.escrever`.
 *
 * Painel e histórico têm balde de leitura (300 por pessoa por hora): nada de releitura em laço, só
 * depois de uma escrita.
 */
import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'
import type {
  FaltaDoAgendamentoDto,
  FaltaMarcadaDto,
  FaltaNoHistoricoDto,
  FaltasEmLoteDto,
  FaltasEmLoteRespostaDto,
  HistoricoDeFaltasDto,
  IgnoradoNoLoteDto,
  JustificativaDaClinicaDto,
  JustificativaDeFaltaDto,
  JustificativaRegistradaDto,
  MutacaoDaAgendaDto,
  ObitoRegistradoDto,
  PainelDeFaltasDto,
  ReagendarFaltaDto,
  ResumoDeFaltasDto,
} from '../contrato/openapi'
import { comIdempotencia } from '../idempotencia'

export type FaltaDoAgendamento = FaltaDoAgendamentoDto
export type FaltaMarcada = FaltaMarcadaDto
export type FaltaNoHistorico = FaltaNoHistoricoDto
export type HistoricoDeFaltas = HistoricoDeFaltasDto
export type LoteDeFaltas = FaltasEmLoteDto
export type RespostaDoLote = FaltasEmLoteRespostaDto
export type IgnoradoNoLote = IgnoradoNoLoteDto
export type NovaJustificativa = JustificativaDaClinicaDto
export type Justificativa = JustificativaDeFaltaDto
export type JustificativaRegistrada = JustificativaRegistradaDto
export type Reagendamento = ReagendarFaltaDto
export type ResumoDeFaltas = ResumoDeFaltasDto
export type PainelDeFaltas = PainelDeFaltasDto
export type Obito = ObitoRegistradoDto
export type SituacaoDaFalta = FaltaDoAgendamentoDto['situacao']
export type MotivoDaFalta = NonNullable<JustificativaDaClinicaDto['motivo']>
export type CanalDaJustificativa = JustificativaDaClinicaDto['canal']

/** A ordem do diálogo: o óbito no fim (guia 3.2). */
export const MOTIVOS_DA_FALTA: readonly MotivoDaFalta[] = [
  'ESQUECEU',
  'IMPREVISTO',
  'TRANSPORTE',
  'PACIENTE_MELHOROU',
  'EMERGENCIA',
  'CUSTO',
  'INSATISFACAO',
  'OUTRO',
  'OBITO',
]

/** O canal da clínica: `APP` é só o responsável, pelo app. */
export const CANAIS_DA_CLINICA: readonly CanalDaJustificativa[] = [
  'TELEFONE',
  'WHATSAPP',
  'PRESENCIAL',
  'SEM_RESPOSTA',
]

export const OBSERVACAO_DA_FALTA_MAX = 500

/** Até 100 ids por fechamento de turno. */
export const FALTAS_POR_LOTE = 100

/** O painel lê até 100 por página (padrão 50); o histórico, até 50. */
export const PAINEL_POR_PAGINA = 50
export const HISTORICO_POR_PAGINA = 50

type ParceiroQuery = { parceiroId?: string | null }

const AGENDAMENTOS = '/parceiro/portal/clinica/agendamentos'

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

function json(metodo: string, corpo: unknown): RequestInit {
  return { method: metodo, body: JSON.stringify(corpo) }
}

function doAgendamento(id: string, resto: string) {
  return `${AGENDAMENTOS}/${encodeURIComponent(id)}${resto}`
}

/* -------------------------------------------------------------------------------- marcar */

/**
 * Marca a falta (só depois do início; antes, 409 `FALTA_ANTES_DO_HORARIO`). Com a justificativa
 * junto é uma mutação só, um desfazer só; com óbito não há desfazer.
 */
export function marcarFalta(
  id: string,
  corpo: { versao: number; justificativa?: NovaJustificativa },
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<FaltaMarcada>>(
      comQuery(doAgendamento(id, '/falta'), { parceiroId: params?.parceiroId }),
      json('POST', corpo),
    ),
  )
}

/** Fechar o turno: viram falta só os que já acabaram e não chegaram; o resto volta em `ignorados`. */
export function marcarFaltasEmLote(lote: LoteDeFaltas, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<RespostaDoLote>>(
      comQuery(`${AGENDAMENTOS}/faltas-em-lote`, { parceiroId: params?.parceiroId }),
      json('POST', lote),
    ),
  )
}

/* ---------------------------------------------------------------------------- justificar */

/** Cada registro fica; a última com contato vale. Até 20 por falta. */
export function justificarFalta(id: string, corpo: NovaJustificativa, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<JustificativaRegistrada>>(
      comQuery(doAgendamento(id, '/justificativas'), { parceiroId: params?.parceiroId }),
      json('POST', corpo),
    ),
  )
}

/** A falta inteira de um agendamento: todas as justificativas, com o nome de quem registrou. */
export function obterFalta(id: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<FaltaDoAgendamento>>(
      comQuery(doAgendamento(id, '/falta'), { parceiroId: params?.parceiroId }),
    ),
  )
}

/* ----------------------------------------------------------------------------- reagendar */

/** Cria pelo `criar` da agenda, ligado à falta (`remarcadoDeId`). Mande a `Idempotency-Key`. */
export function reagendarFalta(
  id: string,
  corpo: Reagendamento,
  chave: string,
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<MutacaoDaAgendaDto>>(
      comQuery(doAgendamento(id, '/reagendar'), { parceiroId: params?.parceiroId }),
      comIdempotencia(chave, json('POST', corpo)),
    ),
  )
}

/* -------------------------------------------------------------------- painel e histórico */

export type FiltroDoPainel = {
  de?: string | null
  ate?: string | null
  reincidentes?: boolean
  semJustificativa?: boolean
  cursor?: string | null
  limit?: number
}

/** Por responsável e paciente, mais faltas primeiro. Período de até 366 dias (padrão: o último ano). */
export function listarFaltas(filtro: FiltroDoPainel = {}, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<PainelDeFaltas>>(
      comQuery('/parceiro/portal/clinica/faltas', {
        parceiroId: params?.parceiroId,
        de: filtro.de,
        ate: filtro.ate,
        reincidentes: filtro.reincidentes ? true : undefined,
        semJustificativa: filtro.semJustificativa ? true : undefined,
        cursor: filtro.cursor,
        limit: filtro.limit ?? PAINEL_POR_PAGINA,
      }),
    ),
  )
}

/** As faltas de um responsável (o cliente da clínica), da mais recente. */
export function historicoDeFaltas(
  clienteId: string,
  filtro: { cursor?: string | null; limit?: number } = {},
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<HistoricoDeFaltas>>(
      comQuery(`/parceiro/portal/clientes/${encodeURIComponent(clienteId)}/faltas`, {
        parceiroId: params?.parceiroId,
        cursor: filtro.cursor,
        limit: filtro.limit ?? HISTORICO_POR_PAGINA,
      }),
    ),
  )
}

/* -------------------------------------------------------------------------------- regras */

/**
 * O que a justificativa precisa ter (guia 3.3): com contato, o motivo; sem resposta, sem motivo; a
 * data do óbito só com óbito e nunca depois de hoje. O servidor confere de novo (400
 * `JUSTIFICATIVA_INVALIDA`); aqui é só para não mandar o que ele vai recusar.
 */
export function problemaDaJustificativa(
  corpo: NovaJustificativa,
  hoje: string,
): 'motivo' | 'obitoNoFuturo' | null {
  if (corpo.canal !== 'SEM_RESPOSTA' && !corpo.motivo) return 'motivo'
  if (corpo.motivo === 'OBITO' && corpo.obitoEm && corpo.obitoEm > hoje) return 'obitoNoFuturo'
  return null
}

/** O corpo limpo: sem motivo em "sem resposta", a data só no óbito, a observação aparada. */
export function justificativaParaEnviar(corpo: NovaJustificativa): NovaJustificativa {
  const observacao = corpo.observacao?.trim()
  return {
    canal: corpo.canal,
    ...(corpo.canal !== 'SEM_RESPOSTA' && corpo.motivo ? { motivo: corpo.motivo } : {}),
    ...(observacao ? { observacao } : {}),
    ...(corpo.motivo === 'OBITO' && corpo.canal !== 'SEM_RESPOSTA' && corpo.obitoEm
      ? { obitoEm: corpo.obitoEm }
      : {}),
  }
}
