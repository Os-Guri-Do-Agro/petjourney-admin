/**
 * Os painéis da Clínica pela API (E3-08, PJ-W2RB1D). Guia `portal-parceiro-e3.md`, seção 8.
 *
 * Só leitura. Três rotas: o Meu dia (blocos do dia, por escopo), as Atividades (as pilhas do que
 * ficou para trás, da clínica toda) e o resumo (os números de um período). Bloco ou pilha ausente
 * NÃO é zero: é falta de permissão, e a tela não mostra nada no lugar. `falhou: true` é só aquele
 * bloco que passou do tempo de leitura; o resto vem normal.
 *
 * Tetos de leitura por pessoa: 600 por hora no Meu dia (a tela atualiza no máximo de 10 em 10 s),
 * 300 nas atividades e no resumo, e 10 resumos por minuto. Passou: 429
 * `PAINEL_LEITURA_TAXA_EXCEDIDA` com `tenteDeNovoEmSegundos`.
 */
import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'
import type {
  AtividadesDto,
  BlocoDoPainelDto,
  ItemDoPainelDto,
  MeuDiaDto,
  ResumoDaClinicaDto,
} from '../contrato/openapi'

export type MeuDiaDaClinica = MeuDiaDto
export type AtividadesDaClinica = AtividadesDto
export type ResumoDaClinica = ResumoDaClinicaDto
export type BlocoDoPainel = BlocoDoPainelDto
export type ItemDoPainel = ItemDoPainelDto
export type EscopoDoMeuDia = MeuDiaDto['escopo']

/** Os períodos prontos do resumo: o literal do portal e o enum da API (maiúsculo). */
export const PERIODOS_DO_RESUMO = {
  hoje: 'HOJE',
  semana: 'SEMANA',
  'semana-passada': 'SEMANA_PASSADA',
  'trinta-dias': 'TRINTA_DIAS',
} as const

export type PeriodoDoPortal = keyof typeof PERIODOS_DO_RESUMO

/** O período livre vai até 90 dias, os dois lados inclusive. */
export const RESUMO_MAX_DIAS = 90

export type FiltroDoResumo =
  | { periodo: PeriodoDoPortal; profissionalId?: string | null; tipoId?: string | null }
  | { de: string; ate: string; profissionalId?: string | null; tipoId?: string | null }

type ParceiroQuery = { parceiroId?: string | null }

const BASE = '/parceiro/portal/clinica'

function comQuery(caminho: string, query: Record<string, string | null | undefined>) {
  const busca = new URLSearchParams()
  for (const [chave, valor] of Object.entries(query)) {
    if (valor) busca.set(chave, valor)
  }
  const texto = busca.toString()
  return texto ? `${caminho}?${texto}` : caminho
}

async function dados<T>(promise: Promise<ApiEnvelope<T>>) {
  return (await promise).data
}

/**
 * O dia de quem pede. Sem escopo, o servidor decide: ficha de profissional ativa vê o dia dela;
 * sem ficha, a clínica. `CLINICA` explícito vale para quem tem `agenda.ler`.
 */
export function lerMeuDia(
  filtro: { escopo?: EscopoDoMeuDia | null; profissionalId?: string | null } = {},
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<MeuDiaDaClinica>>(
      comQuery(`${BASE}/meu-dia`, {
        escopo: filtro.escopo ?? undefined,
        profissionalId: filtro.profissionalId ?? undefined,
        parceiroId: params?.parceiroId,
      }),
    ),
  )
}

export function lerAtividades(params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<AtividadesDaClinica>>(
      comQuery(`${BASE}/atividades`, { parceiroId: params?.parceiroId }),
    ),
  )
}

export function lerResumo(filtro: FiltroDoResumo, params?: ParceiroQuery) {
  const periodo = 'periodo' in filtro ? PERIODOS_DO_RESUMO[filtro.periodo] : undefined
  return dados(
    apiFetch<ApiEnvelope<ResumoDaClinica>>(
      comQuery(`${BASE}/resumo`, {
        periodo,
        de: 'de' in filtro ? filtro.de : undefined,
        ate: 'ate' in filtro ? filtro.ate : undefined,
        profissionalId: filtro.profissionalId,
        tipoId: filtro.tipoId,
        parceiroId: params?.parceiroId,
      }),
    ),
  )
}

/** O número de um bloco como a tela escreve: "12", "pelo menos 500" vira "500+", falhou vira null. */
export function totalDoBloco(bloco: BlocoDoPainel | undefined): string | null {
  if (!bloco || bloco.falhou || bloco.total === null) return null
  return bloco.truncado ? `${bloco.total}+` : String(bloco.total)
}

/** O status do agendamento da API no literal da tela (o mesmo da demonstração). */
export const STATUS_DO_PAINEL = {
  AGENDADO: 'agendado',
  CONFIRMADO: 'confirmado',
  AGUARDANDO: 'aguardando',
  EM_ATENDIMENTO: 'em-atendimento',
  FINALIZADO: 'finalizado',
  FALTA: 'falta',
  CANCELADO: 'cancelado',
} as const
