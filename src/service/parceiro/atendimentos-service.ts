/**
 * O prontuário da Clínica pela API (E4-01, PJ-QQT1WN). Guia `portal-parceiro-e4.md`, seção 5, e
 * as correções das seções 6.8 (senha) e 11.1 (pré-consulta na anamnese).
 *
 * `RASCUNHO` → `FINALIZADO` → (opcional) `ANULADO`. O rascunho nasce no `iniciar` da agenda ou
 * avulso. A edição tem lock por aba (`dispositivoId`, renovado a cada 5 min) e autosave por seção
 * com `versao`; uma gravação em voo por vez. O status dos vitais vem pronto (nunca calcule).
 * Finalizar e anular pedem a senha da conta quando a janela de 15 min da sessão não está aberta.
 */
import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'
import type {
  AbrirAtendimentoDto,
  AdendoDto,
  AnamneseDadosDto,
  AtendimentoDto,
  AtoDto,
  AtualizarAtendimentoDto,
  CondutaDadosDto,
  CriarAtoDto,
  DescarteDto,
  DiagnosticoDadosDto,
  EstadoDaEdicaoDto,
  ExameFisicoDadosDto,
  GravacaoDaSecaoDto,
  ItemDaLinhaDoTempoDto,
  LiberacaoDoResumoDto,
  LinhaDoTempoDto,
  MarcarRetornoDto,
  MutacaoDaAgendaDto,
  PaginaDeAtendimentosDto,
  PaginaDeRetornosDto,
} from '../contrato/openapi'
import { comIdempotencia } from '../idempotencia'

export type Atendimento = AtendimentoDto
export type StatusDoAtendimento = AtendimentoDto['status']
export type TipoDoAtendimento = AtendimentoDto['tipo']
export type SecaoDoAtendimento = AtualizarAtendimentoDto['secao']
export type DadosDaAnamnese = AnamneseDadosDto
export type DadosDoExame = ExameFisicoDadosDto
export type DadosDoDiagnostico = DiagnosticoDadosDto
export type DadosDaConduta = CondutaDadosDto
export type EstadoDaEdicao = EstadoDaEdicaoDto
export type Gravacao = GravacaoDaSecaoDto
export type PaginaDeAtendimentos = PaginaDeAtendimentosDto
export type ItemDaLista = PaginaDeAtendimentosDto['itens'][number]
export type Adendo = AdendoDto
export type Ato = AtoDto
export type NovoAto = CriarAtoDto
export type Retorno = MarcarRetornoDto
export type RetornosPendentes = PaginaDeRetornosDto
export type RetornoPendente = PaginaDeRetornosDto['itens'][number]
export type LinhaDoTempo = LinhaDoTempoDto
export type ItemDaLinhaDoTempo = ItemDaLinhaDoTempoDto
export type TipoNaLinhaDoTempo = ItemDaLinhaDoTempoDto['tipo']
export type LiberacaoDoResumo = LiberacaoDoResumoDto
export type Mutacao = MutacaoDaAgendaDto

/** O lock vale 10 min; a tela renova a cada 5 com a aba ativa. */
export const RENOVAR_EDICAO_MS = 5 * 60 * 1000
/** O autosave espera 800 ms de silêncio. */
export const AUTOSAVE_MS = 800
/** Motivo de anular (atendimento ou ato): 5 a 500. Adendo para o responsável: até 2000. */
export const MOTIVO_MIN = 5
export const MOTIVO_MAX = 500
export const ADENDO_PARA_O_RESPONSAVEL_MAX = 2000
/** O retorno vai de 1 a 730 dias. */
export const RETORNO_DIAS_MAX = 730

type ParceiroQuery = { parceiroId?: string | null }

const BASE = '/parceiro/portal/clinica/atendimentos'

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

const doAtendimento = (id: string, resto = '') => `${BASE}/${encodeURIComponent(id)}${resto}`

function post(corpo?: unknown): RequestInit {
  return corpo === undefined ? { method: 'POST' } : { method: 'POST', body: JSON.stringify(corpo) }
}

/* ------------------------------------------------------------------------------- ler */

export function listarAtendimentos(
  filtro: {
    status?: StatusDoAtendimento | null
    profissionalId?: string | null
    cursor?: string | null
    limit?: number
  } = {},
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<PaginaDeAtendimentos>>(
      comQuery(BASE, { ...filtro, limit: filtro.limit ?? 20, parceiroId: params?.parceiroId }),
    ),
  )
}

/** Leitura pura: não toma lock. Com `dispositivoId`, diz se o lock é desta aba. */
export function obterAtendimento(id: string, dispositivoId?: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Atendimento>>(
      comQuery(doAtendimento(id), { dispositivoId, parceiroId: params?.parceiroId }),
    ),
  )
}

/** O avulso (fora da agenda). Mande `Idempotency-Key`: sem ela, o duplo toque cria dois. */
export function abrirAvulso(corpo: AbrirAtendimentoDto, chave: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Atendimento>>(
      comQuery(BASE, { parceiroId: params?.parceiroId }),
      comIdempotencia(chave, post(corpo)),
    ),
  )
}

/* --------------------------------------------------------------------------- edição */

export function abrirEdicao(
  id: string,
  dispositivo: { dispositivoId: string; dispositivoRotulo?: string },
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<EstadoDaEdicao>>(
      comQuery(doAtendimento(id, '/abrir-edicao'), { parceiroId: params?.parceiroId }),
      post(dispositivo),
    ),
  )
}

export function assumirEdicao(
  id: string,
  dispositivo: { dispositivoId: string; dispositivoRotulo?: string },
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<EstadoDaEdicao>>(
      comQuery(doAtendimento(id, '/assumir-edicao'), { parceiroId: params?.parceiroId }),
      post(dispositivo),
    ),
  )
}

export function liberarEdicao(id: string, dispositivoId: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<EstadoDaEdicao>>(
      comQuery(doAtendimento(id, '/liberar-edicao'), { parceiroId: params?.parceiroId }),
      post({ dispositivoId }),
    ),
  )
}

/** Uma seção por vez. Campo ausente fica; `null` limpa; lista presente substitui a lista inteira. */
export function gravarSecao(id: string, corpo: AtualizarAtendimentoDto, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Gravacao>>(
      comQuery(doAtendimento(id), { parceiroId: params?.parceiroId }),
      { method: 'PATCH', body: JSON.stringify(corpo) },
    ),
  )
}

/* ------------------------------------------------------------------ fechar e corrigir */

/**
 * O 401 da senha da assinatura (`ASSINATURA_SENHA_EXIGIDA`, `_INCORRETA`) não é queda de sessão:
 * a tela abre o diálogo de senha. Qualquer outro 401 continua derrubando a sessão.
 */
const SENHA_NAO_E_QUEDA = {
  manterSessaoEm401: (codigo: string | undefined) =>
    Boolean(codigo?.startsWith('ASSINATURA_SENHA')),
}

export function finalizarAtendimento(
  id: string,
  corpo: {
    versao: number
    dispositivoId: string
    confirmarOutroResponsavel?: boolean
    senha?: string
  },
  chave: string,
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<Atendimento>>(
      comQuery(doAtendimento(id, '/finalizar'), { parceiroId: params?.parceiroId }),
      comIdempotencia(chave, post(corpo)),
      SENHA_NAO_E_QUEDA,
    ),
  )
}

export function anularAtendimento(
  id: string,
  corpo: { motivo: string; confirmarOutroResponsavel?: boolean; senha?: string },
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<Atendimento>>(
      comQuery(doAtendimento(id, '/anular'), { parceiroId: params?.parceiroId }),
      post(corpo),
      SENHA_NAO_E_QUEDA,
    ),
  )
}

/** Só o rascunho em que ninguém gravou; devolve o agendamento a AGUARDANDO. */
export function descartarAtendimento(id: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<DescarteDto>>(
      comQuery(doAtendimento(id, '/descartar'), { parceiroId: params?.parceiroId }),
      post(),
    ),
  )
}

export function criarAdendo(
  id: string,
  corpo: { texto: string; paraOResponsavel?: boolean },
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<Adendo>>(
      comQuery(doAtendimento(id, '/adendos'), { parceiroId: params?.parceiroId }),
      post(corpo),
    ),
  )
}

export function listarAdendos(id: string, cursor?: string | null, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<{ itens: Adendo[]; proximoCursor: string | null }>>(
      comQuery(doAtendimento(id, '/adendos'), {
        cursor,
        limit: 20,
        parceiroId: params?.parceiroId,
      }),
    ),
  )
}

/** Idempotente. Sem vínculo, com óbito ou removido: `publicado: false` com o motivo. */
export function liberarResumo(id: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<LiberacaoDoResumo>>(
      comQuery(doAtendimento(id, '/liberar-resumo'), { parceiroId: params?.parceiroId }),
      post(),
    ),
  )
}

/* ---------------------------------------------------------------------------- retorno */

/** Sem `inicio`, a API escolhe o primeiro horário livre de quem atendeu a partir do vencimento. */
export function marcarRetorno(id: string, corpo: Retorno, chave: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Mutacao>>(
      comQuery(doAtendimento(id, '/retorno'), { parceiroId: params?.parceiroId }),
      comIdempotencia(chave, post(corpo)),
    ),
  )
}

export function listarRetornosPendentes(
  filtro: { somenteVencidos?: boolean; cursor?: string | null; limit?: number } = {},
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<RetornosPendentes>>(
      comQuery('/parceiro/portal/clinica/retornos-pendentes', {
        ...filtro,
        limit: filtro.limit ?? 50,
        parceiroId: params?.parceiroId,
      }),
    ),
  )
}

/* ------------------------------------------------------------------------------- atos */

/** No rascunho. A resposta traz `versaoDoAtendimento`: o próximo PATCH usa esta versão. */
export function registrarAto(id: string, corpo: NovoAto, chave: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Ato>>(
      comQuery(doAtendimento(id, '/atos'), { parceiroId: params?.parceiroId }),
      comIdempotencia(chave, post(corpo)),
    ),
  )
}

export function anularAto(id: string, motivo: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Ato>>(
      comQuery(`/parceiro/portal/atos/${encodeURIComponent(id)}/anular`, {
        parceiroId: params?.parceiroId,
      }),
      post({ motivo }),
    ),
  )
}

/* --------------------------------------------------------------------- linha do tempo */

export function lerLinhaDoTempo(
  pacienteId: string,
  filtro: { tipos?: TipoNaLinhaDoTempo[]; cursor?: string | null; limit?: number } = {},
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<LinhaDoTempo>>(
      comQuery(`/parceiro/portal/pacientes/${encodeURIComponent(pacienteId)}/linha-do-tempo`, {
        tipos: filtro.tipos?.join(','),
        cursor: filtro.cursor,
        limit: filtro.limit ?? 20,
        parceiroId: params?.parceiroId,
      }),
    ),
  )
}

/* ------------------------------------------------------------------------ dispositivo */

const CHAVE_DO_DISPOSITIVO = 'pj.prontuario.dispositivo'

/**
 * Um id por aba (`[A-Za-z0-9-]{8,64}`), guardado na sessão da aba: recarregar mantém o lock; outra
 * aba ganha outro e entra em leitura.
 */
export function dispositivoDaAba(): string {
  try {
    const guardado = sessionStorage.getItem(CHAVE_DO_DISPOSITIVO)
    if (guardado && /^[A-Za-z0-9-]{8,64}$/.test(guardado)) return guardado
    const novo = crypto.randomUUID()
    sessionStorage.setItem(CHAVE_DO_DISPOSITIVO, novo)
    return novo
  } catch {
    return crypto.randomUUID()
  }
}
