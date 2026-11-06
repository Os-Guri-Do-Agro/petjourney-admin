/**
 * O cuidado da internação pela API (E5-02, PJ-2HGJUX). Guia `portal-parceiro-e5.md`, seções 13 a
 * 16 e 20.
 *
 * - Prescrever, listar e suspender (`internacao.prescrever` com CRMV; a enfermagem lê com
 *   `internacao.executar`). A dose é estruturada: o servidor faz a conta sobre o peso de entrada e
 *   pede as confirmações como na receita (alergia, espécie, arredondamento, faixa, peso).
 * - O checklist da internação e o do plantão inteiro: os textos vêm em dicionários
 *   (`prescricoes`, `profissionais`, `internacoes`) ao lado das linhas.
 * - Registrar (dei, pulei, recusou; "conferi" na bomba de fluido) e desfazer. Registrar leva
 *   `Idempotency-Key`; quem deu vem do login.
 * - O plantão: o atual, assumir e entregar (a passagem, com o dono de cada dose em cima da troca).
 * - A evolução: uma por plantão, com a gravidade vista e a versão lida (a tela velha não estraga).
 */
import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'
import type {
  ChecklistDaInternacaoDto,
  ChecklistDoPlantaoDto,
  DoseRegistradaDeInternacaoDto,
  EntregaDoPlantaoDto,
  EntregarPlantaoDto,
  EvolucaoDeInternacaoDto,
  EvolucaoSalvaDto,
  ListaDeEvolucoesDto,
  ListaDePrescricoesDaInternacaoDto,
  PlantaoAtualDaInternacaoDto,
  PlantaoDaInternacaoDto,
  PrescreverNaInternacaoDto,
  PrescricaoDeInternacaoCriadaDto,
  PrescricaoDeInternacaoDto,
  PrescricaoDeInternacaoSuspensaDto,
  RegistrarDoseDeInternacaoDto,
  SalvarEvolucaoDto,
  VersoesDaEvolucaoDto,
} from '../contrato/openapi'
import { comIdempotencia } from '../idempotencia'

export type PrescricaoDaInternacao = PrescricaoDeInternacaoDto
export type PrescricaoCriada = PrescricaoDeInternacaoCriadaDto
export type ListaDePrescricoes = ListaDePrescricoesDaInternacaoDto
export type NovaPrescricaoNaInternacao = PrescreverNaInternacaoDto
export type KindDoItem = PrescreverNaInternacaoDto['kind']
export type ViaNaInternacao = NonNullable<PrescreverNaInternacaoDto['via']>
export type ChecklistDaInternacao = ChecklistDaInternacaoDto
export type ChecklistDoPlantao = ChecklistDoPlantaoDto
export type DoseNoChecklist = ChecklistDaInternacaoDto['grupos'][number]['itens'][number]
export type DoseDoPlantao = ChecklistDoPlantaoDto['grupos'][number]['itens'][number]
export type PrescricaoNoChecklist = ChecklistDaInternacaoDto['prescricoes'][number]
export type SituacaoDaDose = DoseNoChecklist['situacao']
export type Registro = RegistrarDoseDeInternacaoDto
export type DoseRegistrada = DoseRegistradaDeInternacaoDto
export type MotivoDaNaoDada = NonNullable<RegistrarDoseDeInternacaoDto['motivo']>
export type PlantaoAtual = PlantaoAtualDaInternacaoDto
export type Plantao = PlantaoDaInternacaoDto
export type Passagem = EntregarPlantaoDto
export type Entrega = EntregaDoPlantaoDto
export type Evolucao = EvolucaoDeInternacaoDto
export type EvolucaoSalva = EvolucaoSalvaDto
export type NovaEvolucao = SalvarEvolucaoDto
export type VersoesDaEvolucao = VersoesDaEvolucaoDto

/** Na ordem do formulário: o mais comum primeiro. */
export const KINDS_DO_ITEM: readonly KindDoItem[] = [
  'MEDICAMENTO',
  'FLUIDO',
  'ALIMENTACAO',
  'MONITORAMENTO',
  'PROCEDIMENTO',
]
export const VIAS_NA_INTERNACAO: readonly ViaNaInternacao[] = [
  'INTRAVENOSA',
  'SUBCUTANEA',
  'INTRAMUSCULAR',
  'ORAL',
  'TOPICA',
  'OTOLOGICA',
  'OFTALMICA',
  'INTRANASAL',
]
export const MOTIVOS_DA_NAO_DADA: readonly MotivoDaNaoDada[] = [
  'RECUSOU',
  'CUSPIU_OU_VOMITOU',
  'JEJUM',
  'PROCEDIMENTO_EM_CURSO',
  'ORDEM_VETERINARIA',
  'SEM_ESTOQUE',
  'OUTRO',
]
/** As frequências que a tela oferece; "de 8 em 8 h" é tempo decorrido. */
export const FREQUENCIAS_NA_INTERNACAO = [1, 2, 4, 6, 8, 12, 24, 48] as const

export const DESCRICAO_MAX = 200
export const MG_POR_KG_MAX = 1000
export const MOTIVO_DE_SUSPENDER_MAX = 300
export const OBSERVACAO_DA_DOSE_MAX = 300
export const NOTA_DA_PASSAGEM_MAX = 1000
export const TEXTO_DA_EVOLUCAO_MAX = 1000
/** O checklist se relê a cada minuto com a aba visível (a situação é lida na hora). */
export const RELER_CHECKLIST_MS = 60_000

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
const daInternacao = (id: string, resto = '') =>
  `${CLINICA}/internacoes/${encodeURIComponent(id)}${resto}`
const daDose = (id: string, resto: string) =>
  `${CLINICA}/administracoes/${encodeURIComponent(id)}${resto}`

/* -------------------------------------------------------------------------- prescrições */

export function listarPrescricoesDaInternacao(internacaoId: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<ListaDePrescricoes>>(
      comQuery(daInternacao(internacaoId, '/prescricoes'), { parceiroId: params?.parceiroId }),
    ),
  )
}

export function prescreverNaInternacao(
  internacaoId: string,
  corpo: NovaPrescricaoNaInternacao,
  chave: string,
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<PrescricaoCriada>>(
      comQuery(daInternacao(internacaoId, '/prescricoes'), { parceiroId: params?.parceiroId }),
      comIdempotencia(chave, json('POST', corpo)),
    ),
  )
}

export function suspenderPrescricaoDaInternacao(
  internacaoId: string,
  prescricaoId: string,
  motivo: string,
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<PrescricaoDeInternacaoSuspensaDto>>(
      comQuery(
        daInternacao(internacaoId, `/prescricoes/${encodeURIComponent(prescricaoId)}/suspender`),
        { parceiroId: params?.parceiroId },
      ),
      json('POST', { motivo }),
    ),
  )
}

/* ---------------------------------------------------------------------------- checklists */

export function lerChecklistDaInternacao(
  internacaoId: string,
  periodo: { de?: string; ate?: string } = {},
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<ChecklistDaInternacao>>(
      comQuery(daInternacao(internacaoId, '/checklist'), {
        de: periodo.de,
        ate: periodo.ate,
        parceiroId: params?.parceiroId,
      }),
    ),
  )
}

/** Sem período: o plantão da grade em que estamos (manhã, tarde, noite). */
export function lerChecklistDoPlantao(
  periodo: { de?: string; ate?: string } = {},
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<ChecklistDoPlantao>>(
      comQuery(`${CLINICA}/internacao/checklist`, {
        de: periodo.de,
        ate: periodo.ate,
        parceiroId: params?.parceiroId,
      }),
    ),
  )
}

/* -------------------------------------------------------------------- registrar a dose */

export function registrarDose(
  doseId: string,
  corpo: Registro,
  chave: string,
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<DoseRegistrada>>(
      comQuery(daDose(doseId, '/registrar'), { parceiroId: params?.parceiroId }),
      comIdempotencia(chave, json('POST', corpo)),
    ),
  )
}

export function desfazerDose(doseId: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<DoseRegistrada>>(
      comQuery(daDose(doseId, '/desfazer'), { parceiroId: params?.parceiroId }),
      json('POST'),
    ),
  )
}

/* ------------------------------------------------------------------------------ plantão */

export function lerPlantaoAtual(params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<PlantaoAtual>>(
      comQuery(`${CLINICA}/turnos/atual`, { parceiroId: params?.parceiroId }),
    ),
  )
}

export function assumirPlantao(chave: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Plantao>>(
      comQuery(`${CLINICA}/turnos/assumir`, { parceiroId: params?.parceiroId }),
      comIdempotencia(chave, json('POST')),
    ),
  )
}

export function entregarPlantao(
  plantaoId: string,
  corpo: Passagem,
  chave: string,
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<Entrega>>(
      comQuery(`${CLINICA}/turnos/${encodeURIComponent(plantaoId)}/entregar`, {
        parceiroId: params?.parceiroId,
      }),
      comIdempotencia(chave, json('POST', corpo)),
    ),
  )
}

/* ----------------------------------------------------------------------------- evolução */

export function listarEvolucoes(
  internacaoId: string,
  cursor?: string | null,
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<ListaDeEvolucoesDto>>(
      comQuery(daInternacao(internacaoId, '/evolucoes'), {
        cursor,
        parceiroId: params?.parceiroId,
      }),
    ),
  )
}

export function salvarEvolucao(internacaoId: string, corpo: NovaEvolucao, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<EvolucaoSalva>>(
      comQuery(daInternacao(internacaoId, '/evolucoes'), { parceiroId: params?.parceiroId }),
      json('POST', corpo),
    ),
  )
}

export function listarVersoesDaEvolucao(
  internacaoId: string,
  evolucaoId: string,
  cursor?: string | null,
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<VersoesDaEvolucao>>(
      comQuery(daInternacao(internacaoId, `/evolucoes/${encodeURIComponent(evolucaoId)}/versoes`), {
        cursor,
        parceiroId: params?.parceiroId,
      }),
    ),
  )
}

/* -------------------------------------------------------------------------- utilidades */

/** A dose ainda pede registro (as outras só se leem). */
export function aRegistrar(situacao: SituacaoDaDose) {
  return situacao === 'futura' || situacao === 'na-janela' || situacao === 'atrasada'
}
