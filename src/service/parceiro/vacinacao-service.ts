/**
 * A vacinação conectada da Clínica pela API (E4-04, PJ-VQVQ0C). Guia `portal-parceiro-e4.md`,
 * seção 3.
 *
 * A tela não calcula dose, série, próxima dose, situação nem validade: a API faz a conta e congela
 * na aplicação. O lote vencido trava no servidor; a idade mínima pede confirmação; a próxima dose
 * pode ser marcada no mesmo gesto (só com `agenda.escrever`).
 *
 * Quem entra: plano e histórico, `paciente.ler`; aplicar, registrar de outro lugar, anular e
 * lotes, `vacina.aplicar`; aplicadas e lista de chamada, `agenda.ler`.
 */
import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'
import type {
  AplicacaoDeVacinaDto,
  AplicarVacinaDto,
  ChamadaDto,
  HistoricoDeVacinasDto,
  LotesParaAplicarDto,
  PaginaDeAplicadasDto,
  PaginaDeChamadaDto,
  PlanoVacinalDto,
  RegistrarExternaDto,
  ResultadoDaAplicacaoDto,
} from '../contrato/openapi'
import { comIdempotencia } from '../idempotencia'

export type PlanoVacinal = PlanoVacinalDto
export type VacinaNoPlano = PlanoVacinalDto['vacinas'][number]
export type DoseNoPlano = VacinaNoPlano['doses'][number]
export type Aplicacao = AplicacaoDeVacinaDto
export type HistoricoDeVacinas = HistoricoDeVacinasDto
export type NovaAplicacao = AplicarVacinaDto
export type ResultadoDaAplicacao = ResultadoDaAplicacaoDto
export type DoseExterna = RegistrarExternaDto
export type LotesParaAplicar = LotesParaAplicarDto
export type LoteParaAplicar = LotesParaAplicarDto['lotes'][number]
export type PaginaDeChamada = PaginaDeChamadaDto
export type Chamada = ChamadaDto
export type PaginaDeAplicadas = PaginaDeAplicadasDto
export type ViaDaVacina = AplicarVacinaDto['via']
export type SituacaoDaChamada = ChamadaDto['situacao']

/** O código do lote: até 40, letras, números, espaço, ponto, barra, hífen e sublinhado. */
export const CODIGO_DO_LOTE = /^[A-Za-z0-9 ./_-]{1,40}$/

/** O motivo da anulação vai de 5 a 500 caracteres. */
export const MOTIVO_DA_ANULACAO_MIN = 5
export const MOTIVO_DA_ANULACAO_MAX = 500

/** A aplicação vale até 30 dias para trás; as aplicadas, até 92 dias por leitura. */
export const APLICACAO_DIAS_PARA_TRAS = 30
export const APLICADAS_MAX_DIAS = 92

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

const doPaciente = (id: string, resto: string) =>
  `/parceiro/portal/pacientes/${encodeURIComponent(id)}/vacinas${resto}`

/** O plano do paciente, cortado na dose da vez e na seguinte (com `truncado` acima de 64 KB). */
export function lerPlano(pacienteId: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<PlanoVacinal>>(
      comQuery(doPaciente(pacienteId, '/plano'), { parceiroId: params?.parceiroId }),
    ),
  )
}

/** O histórico, do mais recente, com as anuladas (até 300). */
export function lerHistorico(pacienteId: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<HistoricoDeVacinas>>(
      comQuery(doPaciente(pacienteId, ''), { parceiroId: params?.parceiroId }),
    ),
  )
}

/** Uma chave por clique em "Aplicar e registrar": a repetição devolve a mesma aplicação. */
export function aplicarVacina(
  pacienteId: string,
  corpo: NovaAplicacao,
  chave: string,
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<ResultadoDaAplicacao>>(
      comQuery(doPaciente(pacienteId, '/aplicar'), { parceiroId: params?.parceiroId }),
      comIdempotencia(chave, { method: 'POST', body: JSON.stringify(corpo) }),
    ),
  )
}

/** A dose de outro lugar: sem lote, pela data do papel; não vai ao app como vacina da clínica. */
export function registrarExterna(
  pacienteId: string,
  corpo: DoseExterna,
  chave: string,
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<Aplicacao>>(
      comQuery(doPaciente(pacienteId, '/externa'), { parceiroId: params?.parceiroId }),
      comIdempotencia(chave, { method: 'POST', body: JSON.stringify(corpo) }),
    ),
  )
}

/** Sem estoque, os lotes já digitados nesta clínica nos últimos 180 dias (até 20). */
export function lotesParaAplicar(vacinaId: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<LotesParaAplicar>>(
      comQuery(
        `/parceiro/portal/clinica/vacinas/${encodeURIComponent(vacinaId)}/lotes-para-aplicar`,
        {
          parceiroId: params?.parceiroId,
        },
      ),
    ),
  )
}

/** Nada se apaga: a aplicação fica riscada e a dose anterior volta a cobrar. */
export function anularAplicacao(id: string, motivo: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Aplicacao>>(
      comQuery(`/parceiro/portal/clinica/aplicacoes/${encodeURIComponent(id)}/anular`, {
        parceiroId: params?.parceiroId,
      }),
      { method: 'POST', body: JSON.stringify({ motivo }) },
    ),
  )
}

/** Do mais atrasado ao menos: vencidos, série aberta e reforço em até 30 dias. */
export function lerChamada(
  filtro: { situacao?: SituacaoDaChamada | null; cursor?: string | null; limit?: number } = {},
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<PaginaDeChamada>>(
      comQuery('/parceiro/portal/clinica/vacinas/chamada', {
        situacao: filtro.situacao,
        cursor: filtro.cursor,
        limit: filtro.limit ?? 50,
        parceiroId: params?.parceiroId,
      }),
    ),
  )
}

/** O que a clínica aplicou num período de até 92 dias (farmacovigilância, conferência de lote). */
export function lerAplicadas(
  filtro: { de: string; ate: string; cursor?: string | null; limit?: number },
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<PaginaDeAplicadas>>(
      comQuery('/parceiro/portal/clinica/vacinas/aplicadas', {
        de: filtro.de,
        ate: filtro.ate,
        cursor: filtro.cursor,
        limit: filtro.limit ?? 50,
        parceiroId: params?.parceiroId,
      }),
    ),
  )
}

/** Os pontos de uma vacina no plano: as dadas e as que faltam até o `total` (o plano vem cortado). */
export function pontosDaSerie(vacina: Pick<VacinaNoPlano, 'aplicadasNaSerie' | 'total'>) {
  return Array.from({ length: Math.max(vacina.total, vacina.aplicadasNaSerie) }, (_, indice) =>
    indice < vacina.aplicadasNaSerie ? 'dada' : 'falta',
  )
}
