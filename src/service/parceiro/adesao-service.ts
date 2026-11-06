/**
 * Tratamentos em casa e adesão, lado da clínica (E4-05b, PJ-LU09N7). Guia `portal-parceiro-e4.md`,
 * seção 7b.
 *
 * A API devolve contagens e códigos, nunca porcentagem: a tela não calcula. "Sem registro" não é
 * dose perdida (a faixa o desenha em cinza neutro). O alerta é só da equipe: `PULADAS` (duas ou
 * mais puladas em 72 h) e `QUEDA` ("pode ser que tenham parado de registrar", nunca "o remédio não
 * foi dado").
 *
 * Toda rota leva `X-Timezone`: os dias da faixa contam no fuso. O portal manda o fuso do navegador,
 * que é o da clínica para quem trabalha nela.
 */
import { apiFetch } from '../api'
import { getAuthUser } from '../auth/auth-session'
import type { ApiEnvelope } from '../api-envelope'
import type {
  AdesaoDoPacienteDto,
  AdesaoParaClinicaDto,
  ContatoRegistradoDto,
  CriticoAlteradoDto,
  DosesParaClinicaDto,
  FaixaDeDosesDto,
  PaginaDeTratamentosDto,
  ResumoDeAdesaoDto,
  TratamentoNaListaDto,
} from '../contrato/openapi'

export type AdesaoDoPaciente = AdesaoDoPacienteDto
export type Tratamento = AdesaoParaClinicaDto
export type TratamentoNaLista = TratamentoNaListaDto
export type PaginaDeTratamentos = PaginaDeTratamentosDto
export type DosesDoTratamento = DosesParaClinicaDto
export type FaixaDeDoses = FaixaDeDosesDto
export type ResumoDaAdesao = ResumoDeAdesaoDto
export type MotivoDoAlerta = NonNullable<TratamentoNaListaDto['alerta']>

/** A faixa vai até 90 dias por leitura; sem período, 42 dias até hoje. */
export const FAIXA_MAX_DIAS = 90
export const FAIXA_PADRAO_DIAS = 42
/** A nota do contato vai de 1 a 500 caracteres e nunca sai da clínica. */
export const NOTA_MAX = 500

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

function fusoDoNavegador() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo'
  } catch {
    return 'America/Sao_Paulo'
  }
}

/** O fuso vai em toda chamada desta seção. */
function comFuso(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers)
  headers.set('X-Timezone', fusoDoNavegador())
  return { ...init, headers }
}

const TRATAMENTOS = '/parceiro/portal/clinica/tratamentos'
const doTratamento = (id: string, resto = '') => `${TRATAMENTOS}/${encodeURIComponent(id)}${resto}`

/** A adesão do paciente na ficha: até 20 tratamentos, ao vivo (a rota mais cara: 120 por hora). */
export function lerAdesaoDoPaciente(pacienteId: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<AdesaoDoPaciente>>(
      comQuery(`/parceiro/portal/pacientes/${encodeURIComponent(pacienteId)}/tratamentos`, {
        parceiroId: params?.parceiroId,
      }),
      comFuso(),
    ),
  )
}

/**
 * Lacuna N34 (a mesma da N22): a lista recusa `?parceiroId=` (400 "property parceiroId should not
 * exist"). Sem ele, a API usa o parceiro ativo do token: só se omite quando é o mesmo parceiro.
 */
function parceiroDaQueryDaLista(params?: ParceiroQuery) {
  const parceiroId = params?.parceiroId
  return parceiroId && parceiroId === getAuthUser()?.parceiroAtivoId ? undefined : parceiroId
}

/** A lista da clínica; `PEDEM_ATENCAO` = os críticos com alerta aberto (o que o cron gravou). */
export function listarTratamentos(
  filtro: { pedemAtencao?: boolean; cursor?: string | null; limit?: number } = {},
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<PaginaDeTratamentos>>(
      comQuery(TRATAMENTOS, {
        filtro: filtro.pedemAtencao ? 'PEDEM_ATENCAO' : undefined,
        cursor: filtro.cursor,
        limit: filtro.limit ?? 30,
        parceiroId: parceiroDaQueryDaLista(params),
      }),
      comFuso(),
    ),
  )
}

/** A faixa de um tratamento, de `desde` a `ate` (dias na parede da clínica, até 90). */
export function lerDoses(
  tratamentoId: string,
  periodo: { desde?: string; ate?: string } = {},
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<DosesDoTratamento>>(
      comQuery(doTratamento(tratamentoId, '/doses'), {
        desde: periodo.desde,
        ate: periodo.ate,
        parceiroId: params?.parceiroId,
      }),
      comFuso(),
    ),
  )
}

/** Idempotente. Desligar apaga o alerta; encerrado: 409 `TRATAMENTO_ENCERRADO`. */
export function marcarCritico(tratamentoId: string, critico: boolean, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<CriticoAlteradoDto>>(
      comQuery(doTratamento(tratamentoId), { parceiroId: params?.parceiroId }),
      comFuso({ method: 'PATCH', body: JSON.stringify({ critico }) }),
    ),
  )
}

/** "Já falei com a família": a nota interna apaga o alerta até a próxima dose que faltar. */
export function registrarContato(tratamentoId: string, nota: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<ContatoRegistradoDto>>(
      comQuery(doTratamento(tratamentoId, '/contato'), { parceiroId: params?.parceiroId }),
      comFuso({ method: 'POST', body: JSON.stringify({ nota }) }),
    ),
  )
}

/* ------------------------------------------------------------------------------- leitura */

export type EstadoDaDose = 'D' | 'P' | 'S' | 'A'

export type DoseNaFaixa = {
  indice: number
  /** O dia (0 = o de `desde`) e o minuto do dia, na parede da clínica. */
  dia: number
  minutoDoDia: number
  estado: EstadoDaDose
  quem: string
}

/**
 * As doses da faixa, por dia. `desde` é a meia-noite da clínica: o dia e a hora de cada dose saem
 * dos minutos, sem conta de fuso na tela.
 */
export function dosesDaFaixa(faixa: FaixaDeDoses): DoseNaFaixa[] {
  return faixa.minutos.map((minutos, indice) => ({
    indice,
    dia: Math.floor(minutos / 1440),
    minutoDoDia: minutos % 1440,
    estado: (faixa.estados[indice] ?? 'S') as EstadoDaDose,
    quem: faixa.quem[indice] ?? '-',
  }))
}

/** Os dias da faixa, cada um com as doses dele (o dia sem dose fica vazio, mas fica). */
export function diasDaFaixa(faixa: FaixaDeDoses) {
  const doses = dosesDaFaixa(faixa)
  const ultimo = doses.reduce((maior, dose) => Math.max(maior, dose.dia), -1)
  return Array.from({ length: ultimo + 1 }, (_, dia) => ({
    dia,
    doses: doses.filter((dose) => dose.dia === dia),
  }))
}
