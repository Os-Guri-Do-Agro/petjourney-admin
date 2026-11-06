/**
 * A agenda da Clínica pela API (E3-02, PJ-4BS8TK). Guia `portal-parceiro-e3.md`, seção 2.
 *
 * As regras são do servidor: conflitos, carga, sugestões e prazos chegam prontos. Ler é
 * `agenda.ler`; escrever (inclusive simular e desfazer) é `agenda.escrever`. Toda ação sobre um
 * agendamento manda a `versao` que a tela tem: divergiu, 409 `AGENDAMENTO_ALTERADO` com `atual`.
 * Toda mutação devolve `desfazerToken` (15 s no servidor; a tela mostra 8 s).
 */
import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'
import type {
  AgendaDiaDto,
  AgendaIntervaloDto,
  AgendaSemanaDto,
  AgendamentoDaAgendaDto,
  AlternativaDto,
  CancelarAgendamentoDto,
  ColunaDaAgendaDto,
  ConflitoDto,
  CriarAgendamentoDto,
  DestinoDto,
  DiaCargaDto,
  EditarAgendamentoDto,
  HorarioSugeridoDto,
  MoverAgendamentoDto,
  MutacaoDaAgendaDto,
  ProfissionalNaAgendaDto,
  ReservaNaAgendaDto,
  SalaNaAgendaDto,
  SimulacaoDto,
  SugestoesDto,
} from '../contrato/openapi'
import { comIdempotencia } from '../idempotencia'

/**
 * O contrato gerado diz `FaixaDto { min, max }` no expediente, no almoço e nas faixas do dia (o nome
 * colide com outra faixa); a rota manda `{ inicio, fim }` em `HH:mm`, como o guia 2.2 (lacuna N27).
 */
export type FaixaDoDia = { inicio: string; fim: string }
export type ProfissionalNaAgenda = Omit<ProfissionalNaAgendaDto, 'faixas'> & {
  faixas: FaixaDoDia[]
}
export type AgendaDoDia = Omit<AgendaDiaDto, 'expediente' | 'almoco' | 'profissionais'> & {
  expediente: FaixaDoDia | null
  almoco: FaixaDoDia | null
  profissionais: ProfissionalNaAgenda[]
}
export type AgendaDaSemana = AgendaSemanaDto
export type AgendaDoIntervalo = AgendaIntervaloDto
export type Agendamento = AgendamentoDaAgendaDto
export type StatusDoAgendamento = AgendamentoDaAgendaDto['status']
export type OrigemDoAgendamento = AgendamentoDaAgendaDto['origem']
export type ColunaDaAgenda = ColunaDaAgendaDto
export type SalaNaAgenda = SalaNaAgendaDto
export type ReservaNaAgenda = ReservaNaAgendaDto
export type Conflito = ConflitoDto
export type KindDoConflito = ConflitoDto['kind']
export type CargaDoDia = DiaCargaDto
export type Sugestoes = SugestoesDto
export type HorarioSugerido = HorarioSugeridoDto
export type NovoAgendamento = CriarAgendamentoDto
export type Simulacao = SimulacaoDto
export type Alternativa = AlternativaDto
export type Mutacao = MutacaoDaAgendaDto
export type EdicaoDoAgendamento = EditarAgendamentoDto
export type Movimento = MoverAgendamentoDto
export type Destino = DestinoDto
export type Cancelamento = CancelarAgendamentoDto
export type MotivoDoCancelamento = CancelarAgendamentoDto['motivo']
export type Agrupamento = AgendaDiaDto['agrupar']

export const MOTIVOS_DE_CANCELAMENTO: readonly MotivoDoCancelamento[] = [
  'RESPONSAVEL_DESMARCOU',
  'CLINICA_REMARCOU',
  'PACIENTE_INDISPONIVEL',
  'DUPLICADO',
  'OUTRO',
]

/** A tela mostra o "Desfazer" por 8 s (o servidor aceita 15). */
export const DESFAZER_NA_TELA_MS = 8000

/** Até 31 dias por leitura de intervalo, 200 agendamentos por página. */
export const DIAS_POR_INTERVALO = 31

/** Quantas sugestões pedir: o padrão da rota é 6, até 20. */
export const SUGESTOES_PADRAO = 6

type ParceiroQuery = { parceiroId?: string | null }

const AGENDA = '/parceiro/portal/clinica/agenda'
const AGENDAMENTOS = '/parceiro/portal/clinica/agendamentos'

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

function json(metodo: string, corpo: unknown): RequestInit {
  return { method: metodo, body: JSON.stringify(corpo) }
}

function doAgendamento(id: string, resto = '') {
  return `${AGENDAMENTOS}/${encodeURIComponent(id)}${resto}`
}

/* ------------------------------------------------------------------------------- leitura */

/** Um dia, em colunas por profissional ou por sala, já com os conflitos de cada agendamento. */
export function obterDia(data: string, agrupar: Agrupamento, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<AgendaDoDia>>(
      comQuery(`${AGENDA}/dia`, { parceiroId: params?.parceiroId, data, agrupar }),
    ),
  )
}

/** Segunda a domingo da semana de `data`, com a carga de cada dia e de cada profissional. */
export function obterSemana(data: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<AgendaDaSemana>>(
      comQuery(`${AGENDA}/semana`, { parceiroId: params?.parceiroId, data }),
    ),
  )
}

/** Até 31 dias, 200 por página: siga o `proximoCursor` até vir `null`. */
export function obterIntervalo(
  filtro: { de: string; ate: string; profissionalId?: string | null; cursor?: string | null },
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<AgendaDoIntervalo>>(
      comQuery(`${AGENDA}/intervalo`, {
        parceiroId: params?.parceiroId,
        de: filtro.de,
        ate: filtro.ate,
        profissionalId: filtro.profissionalId,
        cursor: filtro.cursor,
      }),
    ),
  )
}

/**
 * Horários sem aviso nenhum, do mais cedo ao mais tarde. Com `profissionalId`, o retorno com quem
 * atendeu; reagendar é a mesma rota a partir do dia seguinte ao da falta. Só no gesto: a rota tem
 * teto de 300 buscas por pessoa por hora.
 */
export function obterSugestoes(
  filtro: {
    pacienteId: string
    tipoId: string
    profissionalId?: string | null
    aPartirDe?: string | null
    quantidade?: number
  },
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<Sugestoes>>(
      comQuery(`${AGENDA}/sugestoes`, {
        parceiroId: params?.parceiroId,
        pacienteId: filtro.pacienteId,
        tipoId: filtro.tipoId,
        profissionalId: filtro.profissionalId,
        aPartirDe: filtro.aPartirDe,
        quantidade: filtro.quantidade ?? SUGESTOES_PADRAO,
      }),
    ),
  )
}

/* -------------------------------------------------------------------------------- escrita */

/** O mesmo corpo do criar, sem gravar: os avisos de cada perna e as 5 melhores do mesmo dia. */
export function simularAgendamento(novo: NovoAgendamento, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Simulacao>>(
      comQuery(`${AGENDAMENTOS}/simular`, { parceiroId: params?.parceiroId }),
      json('POST', novo),
    ),
  )
}

/** Dia especial fechado: 409 `CONFLITO_BLOQUEANTE`; confirmado, de novo com `confirmarConflitos`. */
export function criarAgendamento(novo: NovoAgendamento, chave: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Mutacao>>(
      comQuery(AGENDAMENTOS, { parceiroId: params?.parceiroId }),
      comIdempotencia(chave, json('POST', novo)),
    ),
  )
}

/** Só o alvo; as outras pernas do grupo ficam. */
export function editarAgendamento(id: string, edicao: EdicaoDoAgendamento, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Mutacao>>(
      comQuery(doAgendamento(id), { parceiroId: params?.parceiroId }),
      json('PATCH', edicao),
    ),
  )
}

/**
 * Arrastar: por profissional, `destino.profissionalId`; por sala, `destino.trocarSala` (troca só a
 * sala da coluna de origem). O grupo anda junto pelo mesmo deslocamento.
 */
export function moverAgendamento(id: string, movimento: Movimento, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Mutacao>>(
      comQuery(doAgendamento(id, '/mover'), { parceiroId: params?.parceiroId }),
      json('POST', movimento),
    ),
  )
}

/** Vale para o grupo inteiro; o card fica no dia, riscado. */
export function cancelarAgendamento(
  id: string,
  cancelamento: Cancelamento,
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<Mutacao>>(
      comQuery(doAgendamento(id, '/cancelar'), { parceiroId: params?.parceiroId }),
      json('POST', cancelamento),
    ),
  )
}

type AcaoSimples = 'confirmar-presenca' | 'chegada' | 'iniciar'

/** Confirmar presença (a recepção ligou), chegada (sala de espera) e iniciar (só a perna). */
export function agirNoAgendamento(
  id: string,
  acao: AcaoSimples,
  versao: number,
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<Mutacao>>(
      comQuery(doAgendamento(id, `/${acao}`), { parceiroId: params?.parceiroId }),
      json('POST', { versao }),
    ),
  )
}

/** Volta o estado (versão nova) ou apaga o que foi criado (`removidos`). Vencido: 409 `DESFAZER_EXPIRADO`. */
export function desfazerNaAgenda(token: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Mutacao>>(
      comQuery(`${AGENDA}/desfazer`, { parceiroId: params?.parceiroId }),
      json('POST', { token }),
    ),
  )
}

/* -------------------------------------------------------------------------------- leitura */

/**
 * O que cabe fazer com o agendamento na situação dele (a tabela da seção 2.7): antes de chegar,
 * tudo; aguardando, editar, mover, cancelar e iniciar; em atendimento, só editar; encerrado, nada.
 */
export function acoesDaSituacao(status: StatusDoAgendamento) {
  switch (status) {
    case 'AGENDADO':
    case 'CONFIRMADO':
      return {
        editar: true,
        mover: true,
        cancelar: true,
        confirmar: status === 'AGENDADO',
        chegada: true,
        iniciar: true,
      }
    case 'AGUARDANDO':
      return {
        editar: true,
        mover: true,
        cancelar: true,
        confirmar: false,
        chegada: false,
        iniciar: true,
      }
    case 'EM_ATENDIMENTO':
      return {
        editar: true,
        mover: false,
        cancelar: false,
        confirmar: false,
        chegada: false,
        iniciar: false,
      }
    default:
      return {
        editar: false,
        mover: false,
        cancelar: false,
        confirmar: false,
        chegada: false,
        iniciar: false,
      }
  }
}

/**
 * O conflito agregado (v0.3) descreve o primeiro sobreposto nos `params`; os outros são o "e mais
 * {n}" ("Sobrepõe com Rex às 09:00 e mais 3"). Para ver todos, abre-se o dia.
 */
export function outrosNoConflito(conflito: Conflito): number {
  const quantidade = Number(conflito.params.quantidade ?? 0)
  return Number.isFinite(quantidade) ? Math.max(0, quantidade - 1) : 0
}
