/**
 * O agendamento online visto da recepção (E3-05, PJ-SVL85R, parte do portal). Guia
 * `portal-parceiro-e3.md`, seções 6.2, 6.5, 6.9 e 6.12.
 *
 * - A configuração (`GET`/`PUT .../agendamento-online`): ler com `agenda.ler`, salvar com
 *   `estabelecimento.editar`. O `PUT` substitui tudo.
 * - A caixa (`.../pedidos`): um item por grupo (até 3 pets), 50 por página, pede `pedido.responder`;
 *   aceitar pede também `agenda.escrever`.
 *
 * O pedido não segura o horário (decisão 25, 29/10): aceitar pode dar 409 `HORARIO_JA_TOMADO`, e a
 * tela leva às sugestões, à recusa ou ao encaixe de propósito (`professional-overlap`).
 */
import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'
import type {
  AceitarPedidoDto,
  AgendamentoOnlineConfigDto,
  ConflitoDto,
  DetalheDoPedidoDto,
  PaginaDaCaixaDto,
  PedidoNaCaixaDto,
  RecusarPedidoDto,
  RespostaDoPedidoDto,
  SalvarAgendamentoOnlineDto,
  SugestaoDoPedidoDto,
  SugestoesDoPedidoDto,
} from '../contrato/openapi'

import { parceiroPeloToken } from './parceiro-do-token'

export type ConfiguracaoOnline = AgendamentoOnlineConfigDto
export type ConfiguracaoOnlineSalva = SalvarAgendamentoOnlineDto
export type PedidoNaCaixa = PedidoNaCaixaDto
export type DetalheDoPedido = DetalheDoPedidoDto
export type PaginaDaCaixa = PaginaDaCaixaDto
export type SugestaoDoPedido = SugestaoDoPedidoDto
export type SugestoesDoPedido = SugestoesDoPedidoDto
export type Aceite = AceitarPedidoDto
export type RespostaDoPedido = RespostaDoPedidoDto
export type Recusa = RecusarPedidoDto
export type MotivoDaRecusa = RecusarPedidoDto['motivo']
export type MotivoDoPedido = PedidoNaCaixaDto['motivo']
export type Conflito = ConflitoDto

export const ABAS_DA_CAIXA = ['PENDENTES', 'ACEITOS', 'RECUSADOS', 'ENCERRADOS'] as const
export type AbaDaCaixa = (typeof ABAS_DA_CAIXA)[number]

export const MOTIVOS_DA_RECUSA: readonly MotivoDaRecusa[] = [
  'SEM_HORARIO',
  'PRECISA_AVALIAR',
  'SERVICO_INDISPONIVEL',
  'EMERGENCIA',
  'OUTRO',
]

/** Faixas da configuração (6.2). Até 30 serviços e 30 profissionais. */
export const ANTECEDENCIA_MAX_HORAS = 168
export const HORIZONTE_MIN_DIAS = 1
export const HORIZONTE_MAX_DIAS = 90
export const PRAZO_MIN_HORAS = 1
export const PRAZO_MAX_HORAS = 72
export const ITENS_DA_CONFIGURACAO_MAX = 30
/** A mensagem da clínica ao responsável. */
export const MENSAGEM_MAX = 500

type ParceiroQuery = { parceiroId?: string | null }

const CLINICA = '/parceiro/portal/clinica'

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

/* ---------------------------------------------------------------------------- configuração */

export function obterConfiguracaoOnline(params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<ConfiguracaoOnline>>(
      comQuery(`${CLINICA}/agendamento-online`, { parceiroId: params?.parceiroId }),
    ),
  )
}

export function salvarConfiguracaoOnline(
  configuracao: ConfiguracaoOnlineSalva,
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<ConfiguracaoOnline>>(
      comQuery(`${CLINICA}/agendamento-online`, { parceiroId: params?.parceiroId }),
      json('PUT', configuracao),
    ),
  )
}

/** O que o `PUT` aceita: a leitura traz também `perfilPublicado`, `slug` e `atualizadoEm`. */
export function configuracaoParaSalvar(atual: ConfiguracaoOnline): ConfiguracaoOnlineSalva {
  return {
    ativo: atual.ativo,
    permiteEscolherHorario: atual.permiteEscolherHorario,
    permiteMelhorHorario: atual.permiteMelhorHorario,
    aceitaPeloLink: atual.aceitaPeloLink,
    aceitarSozinho: atual.aceitarSozinho,
    mostrarProfissionais: atual.mostrarProfissionais,
    tipoIds: [...atual.tipoIds],
    profissionalIds: [...atual.profissionalIds],
    antecedenciaMinimaHoras: atual.antecedenciaMinimaHoras,
    horizonteDias: atual.horizonteDias,
    prazoDeRespostaHoras: atual.prazoDeRespostaHoras,
  }
}

/* --------------------------------------------------------------------------------- a caixa */

/**
 * Lacuna N22: a lista da caixa e as sugestões recusam `?parceiroId=` (400 "property parceiroId
 * should not exist"), embora o contrato o declare. Elas usam o parceiro ativo do token, que é
 * realinhado à empresa em uso antes da chamada (`parceiroPeloToken`).
 */

/** PENDENTES vêm do mais antigo; o resto, do mais recente. `cursor` é o `proximoCursor`. */
export async function listarPedidos(
  filtro: { status: AbaDaCaixa; cursor?: string | null },
  params?: ParceiroQuery,
) {
  const parceiroId = await parceiroPeloToken(params?.parceiroId)

  return dados(
    apiFetch<ApiEnvelope<PaginaDaCaixa>>(
      comQuery(`${CLINICA}/pedidos`, {
        parceiroId,
        status: filtro.status,
        cursor: filtro.cursor,
      }),
    ),
  )
}

export function obterPedido(id: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<DetalheDoPedido>>(
      comQuery(`${CLINICA}/pedidos/${encodeURIComponent(id)}`, { parceiroId: params?.parceiroId }),
    ),
  )
}

/**
 * Dentro do que a pessoa pediu (ou perto do horário que sumiu), um por profissional por dia. Sem
 * nada, até 7 dias depois com `foraDaPreferencia` (ofereça, não marque calado).
 */
export async function sugestoesDoPedido(id: string, limite: number, params?: ParceiroQuery) {
  const parceiroId = await parceiroPeloToken(params?.parceiroId)

  return dados(
    apiFetch<ApiEnvelope<SugestoesDoPedido>>(
      comQuery(`${CLINICA}/pedidos/${encodeURIComponent(id)}/sugestoes`, {
        parceiroId,
        limite,
      }),
    ),
  )
}

/**
 * Vazio aceita o horário escolhido; com `inicio` (e `profissionalId`) marca outro. O melhor horário
 * exige `inicio`. Cria os agendamentos do grupo juntos ou nenhum.
 */
export function aceitarPedido(id: string, aceite: Aceite, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<RespostaDoPedido>>(
      comQuery(`${CLINICA}/pedidos/${encodeURIComponent(id)}/aceitar`, {
        parceiroId: params?.parceiroId,
      }),
      json('POST', aceite),
    ),
  )
}

/** A mensagem vai citada no app, na página do token e no e-mail; nunca no push. */
export function recusarPedido(id: string, recusa: Recusa, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<DetalheDoPedido>>(
      comQuery(`${CLINICA}/pedidos/${encodeURIComponent(id)}/recusar`, {
        parceiroId: params?.parceiroId,
      }),
      json('POST', recusa),
    ),
  )
}

/* --------------------------------------------------------------------------------- leitura */

/** O horário de um instante com offset (`2026-11-10T10:00:00-04:00`), lido do próprio texto. */
export function horaDoInstante(iso: string) {
  return /T(\d{2}:\d{2})/.exec(iso)?.[1] ?? ''
}

/** O dia (`AAAA-MM-DD`) de um instante com offset, lido do próprio texto. */
export function diaDoInstante(iso: string) {
  return iso.slice(0, 10)
}

/** O pedido tem algum pet cujo horário escolhido foi ocupado depois (a folhinha riscada). */
export function horarioSumiu(pedido: Pick<PedidoNaCaixa, 'pets'>) {
  return pedido.pets.some((pet) => pet.horarioSumiu)
}

/** O horário que a pessoa escolheu: o do primeiro pet ao último. `null` no melhor horário. */
export function horarioEscolhido(pedido: Pick<PedidoNaCaixa, 'modo' | 'pets'>) {
  if (pedido.modo !== 'HORARIO_ESCOLHIDO') return null

  const inicios = pedido.pets.map((pet) => pet.inicio).filter((valor): valor is string => !!valor)
  const fins = pedido.pets.map((pet) => pet.fim).filter((valor): valor is string => !!valor)
  if (!inicios.length || !fins.length) return null

  return { inicio: inicios.sort()[0]!, fim: fins.sort()[fins.length - 1]! }
}
