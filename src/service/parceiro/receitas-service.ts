/**
 * Receita digital da Clínica pela API (E4-03, PJ-L3V7JK). Guia `portal-parceiro-e4.md`, seções 6.1
 * a 6.8.
 *
 * A prescrição é uma gravação do rascunho do atendimento: usa a mesma `versao` e o mesmo
 * `dispositivoId` do PATCH (cada gravação devolve a versão nova). O servidor faz a conta da dose e
 * confere; a tela mostra a conta e manda as confirmações que o veterinário deu.
 *
 * A receita nasce como rascunho com a prévia (`itens`, `foraDoPdf` com a instrução pronta) e se
 * assina com a senha da conta, sempre (a janela de 15 min do prontuário não vale aqui). Assinada,
 * o PDF abre por uma URL de 15 minutos.
 */
import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'
import type {
  AtualizarPrescricaoDto,
  AvisoDaPrescricaoDto,
  CriarPrescricaoDto,
  ForaDoPdfDto,
  GravacaoDaPrescricaoDto,
  ItemDaReceitaDto,
  ListaDePrescricoesDto,
  ListaDeReceitasDto,
  PrescricaoDto,
  ReceitaDto,
  RepeticaoDaReceitaDto,
  UrlDaReceitaDto,
} from '../contrato/openapi'
import { comIdempotencia } from '../idempotencia'

export type Prescricao = PrescricaoDto
export type NovaPrescricao = CriarPrescricaoDto
export type EdicaoDaPrescricao = AtualizarPrescricaoDto
export type GravacaoDaPrescricao = GravacaoDaPrescricaoDto
export type AvisoDaPrescricao = AvisoDaPrescricaoDto
export type Receita = ReceitaDto
export type ItemDaReceita = ItemDaReceitaDto
export type ForaDoPdf = ForaDoPdfDto
export type Repeticao = RepeticaoDaReceitaDto
export type UrlDaReceita = UrlDaReceitaDto
export type ViaDaPrescricao = PrescricaoDto['via']
export type UnidadeDaDose = PrescricaoDto['unidade']

/** P15: até 10 prescrições vivas por atendimento; uma receita leva de 1 a 10. */
export const PRESCRICOES_MAX = 10
/** Motivo do cancelamento: 10 a 500. */
export const MOTIVO_DO_CANCELAMENTO_MIN = 10
export const MOTIVO_DO_CANCELAMENTO_MAX = 500
/** A frequência vai de 1 a 720 horas (24 = uma vez ao dia). */
export const FREQUENCIA_MAX_HORAS = 720

export const VIAS: readonly ViaDaPrescricao[] = [
  'ORAL',
  'SUBCUTANEA',
  'INTRAMUSCULAR',
  'INTRAVENOSA',
  'TOPICA',
  'OTOLOGICA',
  'OFTALMICA',
  'INTRANASAL',
]

export const UNIDADES: readonly UnidadeDaDose[] = ['COMPRIMIDO', 'ML', 'GOTA', 'APLICACAO']

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

const CLINICA = '/parceiro/portal/clinica'
const doAtendimento = (id: string, resto: string) =>
  `${CLINICA}/atendimentos/${encodeURIComponent(id)}${resto}`
const daReceita = (id: string, resto = '') =>
  `${CLINICA}/receitas/${encodeURIComponent(id)}${resto}`

function json(method: string, corpo?: unknown): RequestInit {
  return corpo === undefined ? { method } : { method, body: JSON.stringify(corpo) }
}

/**
 * O 401 da senha da assinatura (`ASSINATURA_SENHA_*`) não é queda de sessão: a gaveta mostra o
 * erro no campo. Qualquer outro 401 continua derrubando a sessão.
 */
const SENHA_NAO_E_QUEDA = {
  manterSessaoEm401: (codigo: string | undefined) =>
    Boolean(codigo?.startsWith('ASSINATURA_SENHA')),
}

/* -------------------------------------------------------------------------- prescrição */

export function listarPrescricoes(atendimentoId: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<ListaDePrescricoesDto>>(
      comQuery(doAtendimento(atendimentoId, '/prescricoes'), { parceiroId: params?.parceiroId }),
    ),
  )
}

export function criarPrescricao(
  atendimentoId: string,
  corpo: NovaPrescricao,
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<GravacaoDaPrescricao>>(
      comQuery(doAtendimento(atendimentoId, '/prescricoes'), { parceiroId: params?.parceiroId }),
      json('POST', corpo),
    ),
  )
}

export function atualizarPrescricao(
  atendimentoId: string,
  prescricaoId: string,
  corpo: EdicaoDaPrescricao,
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<GravacaoDaPrescricao>>(
      comQuery(doAtendimento(atendimentoId, `/prescricoes/${encodeURIComponent(prescricaoId)}`), {
        parceiroId: params?.parceiroId,
      }),
      json('PATCH', corpo),
    ),
  )
}

/** 200 com a versão nova (não 204: a tela precisa dela para a próxima gravação). */
export function removerPrescricao(
  atendimentoId: string,
  prescricaoId: string,
  lock: { versao: number; dispositivoId: string },
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<{ versao: number }>>(
      comQuery(doAtendimento(atendimentoId, `/prescricoes/${encodeURIComponent(prescricaoId)}`), {
        versao: lock.versao,
        dispositivoId: lock.dispositivoId,
        parceiroId: params?.parceiroId,
      }),
      json('DELETE'),
    ),
  )
}

/* ----------------------------------------------------------------------------- receita */

export function listarReceitas(atendimentoId: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<ListaDeReceitasDto>>(
      comQuery(doAtendimento(atendimentoId, '/receitas'), { parceiroId: params?.parceiroId }),
    ),
  )
}

/** O rascunho com a prévia: o que sai no PDF e o que fica só na clínica, com a instrução. */
export function criarReceita(
  atendimentoId: string,
  prescricaoIds: string[],
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<Receita>>(
      comQuery(doAtendimento(atendimentoId, '/receitas'), { parceiroId: params?.parceiroId }),
      json('POST', { prescricaoIds }),
    ),
  )
}

export function descartarReceita(id: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<{ versao: number }>>(
      comQuery(daReceita(id), { parceiroId: params?.parceiroId }),
      json('DELETE'),
    ),
  )
}

/**
 * Assinar pede a senha sempre e a `Idempotency-Key` (o duplo toque recebe a mesma receita). A
 * senha nunca entra no hash da chave.
 */
export function assinarReceita(id: string, senha: string, chave: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Receita>>(
      comQuery(daReceita(id, '/assinar'), { parceiroId: params?.parceiroId }),
      comIdempotencia(chave, json('POST', { senha })),
      SENHA_NAO_E_QUEDA,
    ),
  )
}

/** URL assinada de 15 minutos. Rascunho: 409 `RECEITA_NAO_ASSINADA`; cancelada: `RECEITA_JA_CANCELADA`. */
export function pdfDaReceita(id: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<UrlDaReceita>>(
      comQuery(daReceita(id, '/pdf'), { parceiroId: params?.parceiroId }),
    ),
  )
}

export function cancelarReceita(
  id: string,
  corpo: { motivo: string; confirmarOutroResponsavel?: boolean },
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<Receita>>(
      comQuery(daReceita(id, '/cancelar'), { parceiroId: params?.parceiroId }),
      json('POST', corpo),
    ),
  )
}

/** P13: no atendimento de destino já aberto (rascunho) do mesmo paciente. */
export function repetirReceita(
  id: string,
  destino: { atendimentoId: string; versao: number; dispositivoId: string },
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<Repeticao>>(
      comQuery(daReceita(id, '/repetir'), { parceiroId: params?.parceiroId }),
      json('POST', destino),
    ),
  )
}

/* -------------------------------------------------------------------------------- leitura */

/** As prescrições que ainda não estão numa receita (as que "Fazer a receita" leva). */
export function prescricoesLivres(prescricoes: readonly Prescricao[]) {
  return prescricoes.filter((item) => !item.receitaId)
}
