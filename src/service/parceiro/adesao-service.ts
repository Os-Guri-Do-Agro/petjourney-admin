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
        parceiroId: params?.parceiroId,
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

/**
 * Os dias da faixa, cada um com as doses dele, da primeira dose à última (o dia sem dose no meio
 * fica vazio, mas fica). A ficha manda os 42 dias até hoje: começar no dia 0 deixava um vão de
 * semanas antes de um tratamento novo, com a data de 42 dias atrás na ponta (26/11/2026).
 */
export function diasDaFaixa(faixa: FaixaDeDoses) {
  const doses = dosesDaFaixa(faixa)
  if (!doses.length) return []
  const primeiro = Math.min(...doses.map((dose) => dose.dia))
  const ultimo = Math.max(...doses.map((dose) => dose.dia))
  return Array.from({ length: ultimo - primeiro + 1 }, (_, i) => ({
    dia: primeiro + i,
    doses: doses.filter((dose) => dose.dia === primeiro + i),
  }))
}

const DIA_MS = 86_400_000

/**
 * O dia (`AAAA-MM-DD`) de `faixa.desde` na parede da clínica. `desde` é a meia-noite da clínica,
 * que fica a menos de 12 h da meia-noite UTC do mesmo dia: arredondar para a meia-noite UTC mais
 * próxima dá o dia certo em qualquer fuso de -11 a +11, sem saber qual é. O fuso do navegador
 * não serve: a clínica pode estar em outro (26/11/2026, a dose de 26/11 aparecia em 25/11).
 */
export function diaDaClinica(desde: string): string {
  const meiaNoite = Math.round(Date.parse(desde) / DIA_MS) * DIA_MS
  return new Date(meiaNoite).toISOString().slice(0, 10)
}

/**
 * Hoje (`AAAA-MM-DD`) na parede da clínica. A distância entre `desde` (a meia-noite dela) e a
 * meia-noite UTC mais próxima é o fuso da clínica: o relógio menos ele dá a hora da parede.
 */
export function hojeNaClinica(desde: string, agora = Date.now()): string {
  const fuso = Date.parse(desde) - Math.round(Date.parse(desde) / DIA_MS) * DIA_MS
  return new Date(agora - fuso).toISOString().slice(0, 10)
}

/** `AAAA-MM-DD` mais `n` dias (negativo volta), sem fuso. */
export function somarDias(dia: string, n: number): string {
  return new Date(Date.parse(`${dia}T00:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10)
}

/** Quantos dias da clínica separam `desde` (a meia-noite da faixa) de um instante: negativo é antes. */
export function diasDesde(desde: string, instante: string): number {
  return Math.floor((Date.parse(instante) - Date.parse(desde)) / DIA_MS)
}
