/**
 * A clínica lê o app com consentimento (E2-03, PJ-AI84L1). Guia `portal-parceiro-e2.md`, seção 5.
 *
 * Tudo pelo `pacienteId` da clínica, com o módulo Clínica e `prontuario.ler` (VETERINARIO,
 * ENFERMAGEM e o DONO). As recusas são as mesmas nas cinco rotas: 403 sem `codigo` (paciente de
 * outra clínica), `PET_SEM_ACESSO` (sem vínculo ativo), `SEM_CONSENTIMENTO` com a `chave` e o 429
 * `LEITURA_APP_TAXA_EXCEDIDA`. Nada daqui se guarda: o responsável pode desligar a qualquer momento
 * e a próxima leitura já é recusada (`Cache-Control: no-store`).
 */
import { apiFetch, ApiError } from '../api'
import type { ApiEnvelope } from '../api-envelope'
import type {
  CarteirinhaParaClinicaDto,
  DiarioParaClinicaDto,
  EntradaDoDiarioParaClinicaDto,
  PesosParaClinicaDto,
  ResumoDoPacienteDto,
  SinalDoResumoDto,
  UrlDaFotoDto,
} from '../contrato/openapi'

export type ResumoDoPaciente = ResumoDoPacienteDto
export type SinalDoResumo = SinalDoResumoDto
export type DiarioParaClinica = DiarioParaClinicaDto
export type EntradaDoDiario = EntradaDoDiarioParaClinicaDto
export type PesosParaClinica = PesosParaClinicaDto
export type CarteirinhaParaClinica = CarteirinhaParaClinicaDto
export type UrlDaFoto = UrlDaFotoDto

/** O diário se lê até 90 dias para trás (`LEITURA_APP_PERIODO_INVALIDO` com `minimo` e `maximo`). */
export const DIARIO_DIAS_MAX = 90

type ParceiroQuery = { parceiroId?: string | null }

function comQuery(caminho: string, query: Record<string, string | null | undefined>) {
  const busca = new URLSearchParams()
  for (const [chave, valor] of Object.entries(query)) {
    if (valor !== undefined && valor !== null && valor !== '') busca.set(chave, valor)
  }
  const texto = busca.toString()

  return texto ? `${caminho}?${texto}` : caminho
}

async function dados<T>(promise: Promise<ApiEnvelope<T>>) {
  return (await promise).data
}

function base(pacienteId: string) {
  return `/parceiro/portal/pacientes/${encodeURIComponent(pacienteId)}`
}

/** "Este pet em 30 segundos": sempre 200 com vínculo ativo, mesmo sem nada liberado. */
export function obterResumo(pacienteId: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<ResumoDoPaciente>>(
      comQuery(`${base(pacienteId)}/resumo`, { parceiroId: params?.parceiroId }),
    ),
  )
}

/** Sem `desde`: desde o último atendimento finalizado nesta clínica (ou 30 dias). */
export function lerDiario(pacienteId: string, desde: string | null, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<DiarioParaClinica>>(
      comQuery(`${base(pacienteId)}/app/diario`, { parceiroId: params?.parceiroId, desde }),
    ),
  )
}

export function lerPesos(pacienteId: string, desde: string | null, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<PesosParaClinica>>(
      comQuery(`${base(pacienteId)}/app/pesos`, { parceiroId: params?.parceiroId, desde }),
    ),
  )
}

export function lerCarteirinha(pacienteId: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<CarteirinhaParaClinica>>(
      comQuery(`${base(pacienteId)}/app/carteirinha`, { parceiroId: params?.parceiroId }),
    ),
  )
}

/** Um link de 15 minutos: peça na hora de abrir, nunca guarde. */
export function urlDaFoto(pacienteId: string, fotoId: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<UrlDaFoto>>(
      comQuery(`${base(pacienteId)}/app/fotos/${encodeURIComponent(fotoId)}/url`, {
        parceiroId: params?.parceiroId,
      }),
    ),
  )
}

/** Por que a leitura foi recusada, do jeito que a tela mostra. */
export type RecusaDaLeitura =
  | { tipo: 'semVinculo' }
  | { tipo: 'semConsentimento'; chave: string }
  | { tipo: 'semAcesso' }
  | { tipo: 'semPermissao' }
  | { tipo: 'taxa'; segundos: number | null }
  | { tipo: 'outro'; mensagem: string }

export function lerRecusa(err: unknown, generico: string): RecusaDaLeitura {
  if (!(err instanceof ApiError)) {
    return { tipo: 'outro', mensagem: err instanceof Error && err.message ? err.message : generico }
  }

  const detalhes = err.detalhes ?? {}

  switch (err.codigo) {
    case 'PET_SEM_ACESSO':
      return { tipo: 'semVinculo' }
    case 'SEM_CONSENTIMENTO':
      return {
        tipo: 'semConsentimento',
        chave: typeof detalhes.chave === 'string' ? detalhes.chave : 'diarioCompleto',
      }
    case 'SEM_PERMISSAO':
      return { tipo: 'semPermissao' }
    case 'LEITURA_APP_TAXA_EXCEDIDA':
      return {
        tipo: 'taxa',
        segundos:
          typeof detalhes.tenteDeNovoEmSegundos === 'number'
            ? detalhes.tenteDeNovoEmSegundos
            : null,
      }
    default:
      if (err.statusCode === 403 && !err.codigo) return { tipo: 'semAcesso' }
      return { tipo: 'outro', mensagem: err.message || generico }
  }
}

/** Risco primeiro, como a API já manda; a ordem é mantida se ela mudar. */
export function sinaisEmOrdem(sinais: readonly SinalDoResumo[]) {
  return [...sinais].sort(
    (a, b) => (a.severidade === 'risco' ? 0 : 1) - (b.severidade === 'risco' ? 0 : 1),
  )
}
