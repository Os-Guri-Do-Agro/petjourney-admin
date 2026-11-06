/**
 * A pré-consulta que o responsável respondeu no app, lida pela clínica (E3-07, PJ-OKGQZP). Guia
 * `portal-parceiro-e3.md`, seção 7.7.
 *
 * É sugestão, nunca prontuário: o peso de casa não vai aos vitais, e "do diário" marca o que o app
 * puxou sem o responsável mexer. Quem tem `prontuario.ler` recebe tudo (`completa: true`); a
 * recepção, só a situação, o motivo e a queixa. Cada leitura com resposta fica na trilha
 * (`LER_DADO_DO_APP`) e o responsável a vê em Acessos: por isso a tela só lê quando alguém pede.
 */
import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'
import type { PreConsultaDaClinicaDto } from '../contrato/openapi'

export type PreConsultaDaClinica = PreConsultaDaClinicaDto
export type SituacaoDaPreConsulta = PreConsultaDaClinicaDto['situacao']
export type CampoDoDiario = NonNullable<PreConsultaDaClinicaDto['camposDoDiario']>[number]

type ParceiroQuery = { parceiroId?: string | null }

export function lerPreConsulta(agendamentoId: string, params?: ParceiroQuery) {
  const busca = params?.parceiroId ? `?parceiroId=${encodeURIComponent(params.parceiroId)}` : ''
  return apiFetch<ApiEnvelope<PreConsultaDaClinica>>(
    `/parceiro/portal/clinica/agendamentos/${encodeURIComponent(agendamentoId)}/pre-consulta${busca}`,
  ).then((resposta) => resposta.data)
}

/** Editada depois da primeira resposta (o portal marca "editada"). */
export function foiEditada(pre: Pick<PreConsultaDaClinica, 'respondidaEm' | 'atualizadaEm'>) {
  if (!pre.respondidaEm || !pre.atualizadaEm) return false
  return new Date(pre.atualizadaEm).getTime() > new Date(pre.respondidaEm).getTime()
}

/** Alguma foto com a URL de 15 minutos vencida (ou a vencer em 30 s): hora de pedir de novo. */
export function fotosVencidas(pre: Pick<PreConsultaDaClinica, 'fotos'>, agora = Date.now()) {
  return (pre.fotos ?? []).some(
    (foto) => foto.expiraEm !== null && new Date(foto.expiraEm).getTime() - 30_000 <= agora,
  )
}

/** Os campos de casa, na ordem em que o veterinário lê. */
export const CAMPOS_DE_CASA = [
  'sintomas',
  'alimentacao',
  'hidratacao',
  'fezes',
  'urina',
  'vitalidade',
] as const
