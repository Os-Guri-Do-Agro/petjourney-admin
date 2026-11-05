/**
 * A configuração da agenda da Clínica pela API (E3-01, PJ-GL3IVL). Guia `portal-parceiro-e3.md`,
 * seção 1: salas, tipos de atendimento, bloqueios e a política da clínica.
 *
 * Tudo exige o módulo Clínica. Ler é `agenda.ler`; escrever salas, tipos e política é
 * `estabelecimento.editar` (DONO ou GESTOR); bloqueios, `agenda.escrever`. Nada se apaga (sala e
 * tipo desativam), menos o bloqueio. Recurso de outra clínica (ou inexistente) volta 403 sem
 * `codigo`: "não encontrado ou sem acesso".
 */
import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'
import type {
  AtualizarBloqueioDto,
  AtualizarSalaDto,
  AtualizarTipoDeAtendimentoDto,
  BloqueioDto,
  BloqueiosDoPeriodoDto,
  CriarBloqueioDto,
  CriarSalaDto,
  CriarTipoDeAtendimentoDto,
  DiaDeExpedienteDto,
  ExpedienteDto,
  OcorrenciaDeBloqueioDto,
  PoliticaDto,
  SalaDto,
  SalvarExpedienteDto,
  SalvarPoliticaDto,
  TipoDeAtendimentoDto,
} from '../contrato/openapi'
import { comIdempotencia } from '../idempotencia'

export type Sala = SalaDto
export type TipoDeSala = SalaDto['tipo']
export type TipoDeAtendimento = TipoDeAtendimentoDto
export type KindDoAtendimento = TipoDeAtendimentoDto['kind']
export type Politica = PoliticaDto
export type PoliticaSalva = SalvarPoliticaDto
export type Bloqueio = BloqueioDto
export type OcorrenciaDeBloqueio = OcorrenciaDeBloqueioDto
export type BloqueiosDoPeriodo = BloqueiosDoPeriodoDto
export type MotivoDoBloqueio = BloqueioDto['motivo']
export type NovoBloqueio = CriarBloqueioDto
export type EdicaoDoBloqueio = AtualizarBloqueioDto

export const TIPOS_DE_SALA: readonly TipoDeSala[] = [
  'CONSULTORIO',
  'CIRURGIA',
  'BANHO',
  'INTERNACAO',
  'EXAME',
]

export const KINDS: readonly KindDoAtendimento[] = [
  'CONSULTA',
  'RETORNO',
  'VACINA',
  'EXAME',
  'CIRURGIA',
  'BANHO',
  'EMERGENCIA',
]

/** Cirurgia e emergência nunca vão para o pedido online (400 `TIPO_NAO_OFERTAVEL_ONLINE`). */
export const KINDS_FORA_DO_ONLINE: readonly KindDoAtendimento[] = ['CIRURGIA', 'EMERGENCIA']

export const MOTIVOS_DO_BLOQUEIO: readonly MotivoDoBloqueio[] = [
  'ALMOCO',
  'REUNIAO',
  'FERIAS',
  'MANUTENCAO',
  'BLOQUEIO_PESSOAL',
  'OUTRO',
]

/** Nome da sala: 2 a 60 caracteres. Duração do tipo: 5 a 480 min, de 5 em 5. */
export const NOME_DA_SALA_MIN = 2
export const NOME_DA_SALA_MAX = 60
export const DURACAO_MIN = 5
export const DURACAO_MAX = 480
export const DURACAO_PASSO = 5
export const DETALHE_DO_BLOQUEIO_MAX = 200
/** Leitura de bloqueios: até 62 dias por vez. */
export const PERIODO_MAX_DIAS = 62

type ParceiroQuery = { parceiroId?: string | null }

const CLINICA = '/parceiro/portal/clinica'

function comQuery(caminho: string, query: Record<string, string | boolean | null | undefined>) {
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

function json(metodo: string, corpo: unknown, chave?: string): RequestInit {
  const init: RequestInit = { method: metodo, body: JSON.stringify(corpo) }
  return chave ? comIdempotencia(chave, init) : init
}

/* ---------------------------------------------------------------------------------- salas */

/** Sem `ativas`, vêm todas (a configuração); com `ativas`, só as ativas (a agenda). */
export function listarSalas(params?: ParceiroQuery & { ativas?: boolean }) {
  return dados(
    apiFetch<ApiEnvelope<Sala[]>>(
      comQuery(`${CLINICA}/salas`, {
        parceiroId: params?.parceiroId,
        ativas: params?.ativas ? true : undefined,
      }),
    ),
  )
}

export function criarSala(sala: CriarSalaDto, chave: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Sala>>(
      comQuery(`${CLINICA}/salas`, { parceiroId: params?.parceiroId }),
      json('POST', sala, chave),
    ),
  )
}

export function editarSala(id: string, edicao: AtualizarSalaDto, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Sala>>(
      comQuery(`${CLINICA}/salas/${encodeURIComponent(id)}`, { parceiroId: params?.parceiroId }),
      json('PATCH', edicao),
    ),
  )
}

/* -------------------------------------------------------------------- tipos de atendimento */

export function listarTipos(params?: ParceiroQuery & { ativos?: boolean }) {
  return dados(
    apiFetch<ApiEnvelope<TipoDeAtendimento[]>>(
      comQuery(`${CLINICA}/tipos-de-atendimento`, {
        parceiroId: params?.parceiroId,
        ativos: params?.ativos ? true : undefined,
      }),
    ),
  )
}

export function criarTipo(tipo: CriarTipoDeAtendimentoDto, chave: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<TipoDeAtendimento>>(
      comQuery(`${CLINICA}/tipos-de-atendimento`, { parceiroId: params?.parceiroId }),
      json('POST', tipo, chave),
    ),
  )
}

export function editarTipo(
  id: string,
  edicao: AtualizarTipoDeAtendimentoDto,
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<TipoDeAtendimento>>(
      comQuery(`${CLINICA}/tipos-de-atendimento/${encodeURIComponent(id)}`, {
        parceiroId: params?.parceiroId,
      }),
      json('PATCH', edicao),
    ),
  )
}

/** Duração aceita: de 5 a 480, de 5 em 5. */
export function duracaoValida(minutos: number | null | undefined) {
  return (
    typeof minutos === 'number' &&
    minutos >= DURACAO_MIN &&
    minutos <= DURACAO_MAX &&
    minutos % DURACAO_PASSO === 0
  )
}

/* -------------------------------------------------------------------------------- política */

export function obterPolitica(params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Politica>>(
      comQuery(`${CLINICA}/politica`, { parceiroId: params?.parceiroId }),
    ),
  )
}

export function salvarPolitica(politica: PoliticaSalva, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Politica>>(
      comQuery(`${CLINICA}/politica`, { parceiroId: params?.parceiroId }),
      json('PUT', politica),
    ),
  )
}

/* ------------------------------------------------------------------------------- bloqueios */

/**
 * As ocorrências já materializadas no fuso da clínica, de `de` a `ate` (até 62 dias). Filtrar por
 * profissional ou sala traz também os da clínica toda. Filtro vazio é 400: omita.
 */
export function listarBloqueios(
  periodo: { de: string; ate: string; profissionalId?: string | null; salaId?: string | null },
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<BloqueiosDoPeriodo>>(
      comQuery(`${CLINICA}/bloqueios`, {
        parceiroId: params?.parceiroId,
        de: periodo.de,
        ate: periodo.ate,
        profissionalId: periodo.profissionalId ?? undefined,
        salaId: periodo.salaId ?? undefined,
      }),
    ),
  )
}

export function obterBloqueio(id: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Bloqueio>>(
      comQuery(`${CLINICA}/bloqueios/${encodeURIComponent(id)}`, {
        parceiroId: params?.parceiroId,
      }),
    ),
  )
}

export function criarBloqueio(bloqueio: NovoBloqueio, chave: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Bloqueio>>(
      comQuery(`${CLINICA}/bloqueios`, { parceiroId: params?.parceiroId }),
      json('POST', bloqueio, chave),
    ),
  )
}

/** Com `somenteEm`, só aquele dia sai da série e volta como bloqueio único novo (outro id). */
export function editarBloqueio(
  id: string,
  edicao: EdicaoDoBloqueio,
  somenteEm: string | null,
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<Bloqueio>>(
      comQuery(`${CLINICA}/bloqueios/${encodeURIComponent(id)}`, {
        parceiroId: params?.parceiroId,
        somenteEm: somenteEm ?? undefined,
      }),
      json('PATCH', edicao),
    ),
  )
}

/** Com `somenteEm`, cancela só aquele dia da série; sem ele, apaga a série inteira. */
export async function apagarBloqueio(id: string, somenteEm: string | null, params?: ParceiroQuery) {
  await apiFetch<unknown>(
    comQuery(`${CLINICA}/bloqueios/${encodeURIComponent(id)}`, {
      parceiroId: params?.parceiroId,
      somenteEm: somenteEm ?? undefined,
    }),
    { method: 'DELETE' },
  )
}

/* -------------------------------------------------------------------------------- datas */

/** `AAAA-MM-DD` de uma data local. */
export function diaLocal(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(
    data.getDate(),
  ).padStart(2, '0')}`
}

/**
 * O offset (`-03:00`) de um fuso IANA num dia: o bloqueio vai em ISO **com offset**, montado com o
 * fuso que a leitura devolve.
 */
export function offsetDoFuso(fuso: string, dia: string, hora: string) {
  const [ano, mes, d] = dia.split('-').map(Number)
  const [h, m] = hora.split(':').map(Number)
  const instante = Date.UTC(ano!, mes! - 1, d!, h!, m!)
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: fuso,
    timeZoneName: 'longOffset',
  }).formatToParts(new Date(instante))
  const nome = partes.find((parte) => parte.type === 'timeZoneName')?.value ?? 'GMT'
  const achado = /GMT([+-]\d{2}):?(\d{2})?/.exec(nome)

  return achado ? `${achado[1]}:${achado[2] ?? '00'}` : '+00:00'
}

/** `2026-11-10` + `12:00` no fuso → `2026-11-10T12:00:00-04:00`. */
export function instanteNoFuso(fuso: string, dia: string, hora: string) {
  return `${dia}T${hora}:00${offsetDoFuso(fuso, dia, hora)}`
}

/* ------------------------------------------------------------------- expediente (seção 1.4) */

export type Expediente = ExpedienteDto
export type DiaDoExpediente = ExpedienteDto['dias'][number]
export type DiaProprio = DiaDeExpedienteDto

/**
 * O expediente é exceção ao horário da clínica: os 7 dias vêm resolvidos, cada um com a `origem`
 * (`PROFISSIONAL` ou `ESTABELECIMENTO`). Mora em `/parceiro/portal/profissionais`, mas também exige
 * a Clínica.
 */
export function obterExpediente(profissionalId: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Expediente>>(
      comQuery(`/parceiro/portal/profissionais/${encodeURIComponent(profissionalId)}/expediente`, {
        parceiroId: params?.parceiroId,
      }),
    ),
  )
}

/**
 * Só os dias que diferem da clínica; `dias: []` volta tudo a seguir a clínica. `salaPadraoId`
 * omitido fica como está; `null` tira a sala padrão (nunca `""`).
 */
export function salvarExpediente(
  profissionalId: string,
  expediente: SalvarExpedienteDto,
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<Expediente>>(
      comQuery(`/parceiro/portal/profissionais/${encodeURIComponent(profissionalId)}/expediente`, {
        parceiroId: params?.parceiroId,
      }),
      json('PUT', expediente),
    ),
  )
}
