/**
 * A fila de espera da Clínica pela API (E3-04, PJ-07YV9I). Guia `portal-parceiro-e3.md`, seção 5.
 *
 * A posição, quem cabe numa vaga e as janelas agrupadas são do servidor: a tela não ordena nem
 * calcula nada (a regra de `domain/waitlist.ts` fica só para a demonstração). Ler é `agenda.ler`;
 * entrar, remover, ofertar e registrar o sim ou o não do telefone é `fila.gerir`; o sim também pede
 * `agenda.escrever` (ele cria o agendamento).
 */
import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'
import type {
  AceiteDaRecepcaoDto,
  DetalheDaEntradaDto,
  EntradaNaFilaDto,
  EntrarNaFilaDto,
  FaixaDeJanelasDto,
  JanelaDaFilaDto,
  OfertaFeitaDto,
  OfertarVagaDto,
  PaginaDaFilaDto,
  VagaDaFilaDto,
  VagasDaFilaDto,
} from '../contrato/openapi'
import { comIdempotencia } from '../idempotencia'

export type EntradaNaFila = EntradaNaFilaDto
export type DetalheDaEntrada = DetalheDaEntradaDto
export type PaginaDaFila = PaginaDaFilaDto
export type JanelaDaFila = JanelaDaFilaDto
export type FaixaDeJanelas = FaixaDeJanelasDto
export type VagaDaFila = VagaDaFilaDto
export type VagasDaFila = VagasDaFilaDto
export type NovaEntrada = EntrarNaFilaDto
export type Oferta = OfertarVagaDto
export type OfertaFeita = OfertaFeitaDto
export type AceiteDaRecepcao = AceiteDaRecepcaoDto
export type PrioridadeDaFila = EntradaNaFilaDto['prioridade']
export type CandidatoDaVaga = VagaDaFilaDto['candidatos'][number]

export const SITUACOES_DA_FILA = ['ATIVAS', 'NAO_RESPONDERAM'] as const
export type SituacaoDaFila = (typeof SITUACOES_DA_FILA)[number]

export const PRIORIDADES: readonly PrioridadeDaFila[] = ['NORMAL', 'PREFERENCIAL', 'URGENTE']

/** De 1 a 14 janelas por entrada; observação e mensagem até 500 code points. */
export const JANELAS_MAX = 14
export const TEXTO_MAX = 500

type ParceiroQuery = { parceiroId?: string | null }

const FILA = '/parceiro/portal/clinica/fila'

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

/** ATIVAS (padrão) na ordem da fila; NAO_RESPONDERAM, as que venceram nos últimos 7 dias. */
export function listarFila(
  filtro: { situacao: SituacaoDaFila; cursor?: string | null },
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<PaginaDaFila>>(
      comQuery(FILA, {
        parceiroId: params?.parceiroId,
        situacao: filtro.situacao,
        cursor: filtro.cursor,
      }),
    ),
  )
}

export function obterEntrada(id: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<DetalheDaEntrada>>(
      comQuery(`${FILA}/${encodeURIComponent(id)}`, { parceiroId: params?.parceiroId }),
    ),
  )
}

export function entrarNaFila(entrada: NovaEntrada, chave: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<EntradaNaFila>>(
      comQuery(FILA, { parceiroId: params?.parceiroId }),
      comIdempotencia(chave, json('POST', entrada)),
    ),
  )
}

/** Tira da fila e retira a oferta aberta. Já removida: 204 sem mudar nada. */
export async function removerDaFila(id: string, params?: ParceiroQuery) {
  await apiFetch<unknown>(
    comQuery(`${FILA}/${encodeURIComponent(id)}`, { parceiroId: params?.parceiroId }),
    { method: 'DELETE' },
  )
}

/** As vagas liberadas ainda livres e no futuro, com alguém que cabe (padrão: 14 dias). */
export function listarVagas(periodo: { de?: string; ate?: string } = {}, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<VagasDaFila>>(
      comQuery(`${FILA}/vagas`, {
        parceiroId: params?.parceiroId,
        de: periodo.de,
        ate: periodo.ate,
      }),
    ),
  )
}

/** A mensagem é da clínica, revista na tela, com o prazo dentro; nunca vai ao push. */
export function ofertar(entradaId: string, oferta: Oferta, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<OfertaFeita>>(
      comQuery(`${FILA}/${encodeURIComponent(entradaId)}/ofertar`, {
        parceiroId: params?.parceiroId,
      }),
      json('POST', oferta),
    ),
  )
}

/** O "sim" do telefone: cria o agendamento CONFIRMADO (origem FILA), sem desfazer. */
export function registrarAceite(entradaId: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<AceiteDaRecepcao>>(
      comQuery(`${FILA}/${encodeURIComponent(entradaId)}/oferta/aceitar`, {
        parceiroId: params?.parceiroId,
      }),
      { method: 'POST' },
    ),
  )
}

/** O "não" do telefone: volta a aguardar com a mesma vez. */
export function registrarRecusa(entradaId: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<EntradaNaFila>>(
      comQuery(`${FILA}/${encodeURIComponent(entradaId)}/oferta/recusar`, {
        parceiroId: params?.parceiroId,
      }),
      { method: 'POST' },
    ),
  )
}

/* -------------------------------------------------------------------------------- leitura */

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/
const FIM = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/

function minutos(hora: string) {
  const [hh, mm] = hora.split(':').map(Number)
  return (hh ?? 0) * 60 + (mm ?? 0)
}

/** O mesmo que a API confere (`FILA_INVALIDA`): hora válida, fim depois do início, sem repetir. */
export function problemaNasJanelas(
  janelas: readonly JanelaDaFila[],
): 'VAZIA' | 'HORA_INVALIDA' | 'JANELA_INVERTIDA' | 'JANELA_REPETIDA' | null {
  if (!janelas.length) return 'VAZIA'

  const vistas = new Set<string>()
  for (const janela of janelas) {
    if (!HORA.test(janela.inicio) || !FIM.test(janela.fim)) return 'HORA_INVALIDA'
    if (minutos(janela.fim) <= minutos(janela.inicio)) return 'JANELA_INVERTIDA'
    const chave = `${janela.diaSemana}-${janela.inicio}-${janela.fim}`
    if (vistas.has(chave)) return 'JANELA_REPETIDA'
    vistas.add(chave)
  }

  return null
}

/** O horário de um instante com offset, lido do próprio texto (sem converter de fuso). */
export function horaDoInstante(iso: string) {
  return /T(\d{2}:\d{2})/.exec(iso)?.[1] ?? ''
}

export function diaDoInstante(iso: string) {
  return iso.slice(0, 10)
}
