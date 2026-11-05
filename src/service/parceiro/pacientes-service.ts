/**
 * Clientes e pacientes do parceiro pela API (E2-01, PJ-ECWI3Z): o cadastro que Clínica e Hotel
 * dividem. Guia `portal-parceiro-e2.md`, seção 1.
 *
 * - Abre com Clínica **ou** Hotel ligado (`modulo: 'QUALQUER'`); com módulo só de consulta, lê e a
 *   escrita dá 403 `MODULO_SOMENTE_LEITURA`.
 * - Ler é `paciente.ler`; escrever (criar, editar, inativar, alertas, autorizados e foto) é
 *   `paciente.escrever`. Mesclar e anonimizar: só DONO ou GESTOR.
 * - Datas de dia chegam como `AAAA-MM-DD` e assim ficam: `new Date()` desloca um dia no fuso.
 * - Telefone volta só com dígitos e DDI (`5511987654321`); a tela formata.
 * - Criar paciente, alerta e autorizado aceita `Idempotency-Key`: uma por clique em "Salvar".
 */
import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'
import type {
  AlertaDto,
  AnonimizarClienteDto,
  AtualizarAlertaDto,
  AtualizarAutorizadoDto,
  AtualizarClienteDto,
  AtualizarPacienteDto,
  AutorizadoDto,
  ClienteAnonimizadoDto,
  ClienteComAutorizadosDto,
  CriarAlertaDto,
  CriarAutorizadoDto,
  CriarClienteDto,
  CriarPacienteDto,
  InativarPacienteDto,
  PacienteDto,
  PacienteResumoDto,
  PaginaPacientesDto,
} from '../contrato/openapi'
import { comIdempotencia } from '../idempotencia'

export type Paciente = PacienteDto
export type PacienteNaLista = PacienteResumoDto
export type PaginaDePacientes = PaginaPacientesDto
export type Cliente = ClienteComAutorizadosDto
export type Alerta = AlertaDto
export type Autorizado = AutorizadoDto
export type NovoPaciente = CriarPacienteDto
export type NovoCliente = CriarClienteDto
export type EdicaoDoPaciente = AtualizarPacienteDto
export type EdicaoDoCliente = AtualizarClienteDto
export type NovoAlerta = CriarAlertaDto
export type EdicaoDoAlerta = AtualizarAlertaDto
export type NovoAutorizado = CriarAutorizadoDto
export type EdicaoDoAutorizado = AtualizarAutorizadoDto
export type Inativacao = InativarPacienteDto
export type Anonimizacao = ClienteAnonimizadoDto

export type Especie = PacienteDto['especie']
export type TipoDeAlerta = AlertaDto['tipo']
export type SeveridadeDoAlerta = AlertaDto['severidade']
export type MotivoDeInativacao = InativarPacienteDto['motivo']
export type ContatoPreferido = ClienteComAutorizadosDto['contatoPreferido']
export type Porte = NonNullable<PacienteDto['porte']>

export const ESPECIES: readonly Especie[] = [
  'CACHORRO',
  'GATO',
  'AVE',
  'ROEDOR',
  'COELHO',
  'PEIXE',
  'REPTIL',
  'OUTRO',
]

export const TIPOS_DE_ALERTA: readonly TipoDeAlerta[] = [
  'ALERGIA',
  'AGRESSIVO',
  'CRONICO',
  'MEDICACAO_CONTINUA',
  'IMUNOSSUPRIMIDO',
  'GESTANTE',
  'INADIMPLENTE',
]

export const SEVERIDADES: readonly SeveridadeDoAlerta[] = ['INFO', 'ATENCAO', 'RISCO']

export const MOTIVOS_DE_INATIVACAO: readonly MotivoDeInativacao[] = [
  'OBITO',
  'TRANSFERIDO',
  'PEDIDO_DO_RESPONSAVEL',
  'OUTRO',
]

export const PORTES: readonly Porte[] = ['MINI', 'PEQUENO', 'MEDIO', 'GRANDE', 'GIGANTE']

export const CONTATOS_PREFERIDOS: readonly ContatoPreferido[] = ['WHATSAPP', 'LIGACAO', 'EMAIL']

/** Teto de alertas ativos por paciente (409 `ALERTAS_NO_LIMITE` acima disso, seção 1.7). */
export const ALERTAS_ATIVOS_MAX = 50
/** Alertas que o cadastro do paciente novo leva junto. */
export const ALERTAS_NO_CADASTRO_MAX = 20
/** Motivo da exclusão a pedido do titular (seção 1.11). */
export const MOTIVO_DA_EXCLUSAO_MIN = 10
export const MOTIVO_DA_EXCLUSAO_MAX = 500
/** Foto do paciente: JPG, PNG, WEBP ou HEIC, até 8 MB (seção 1.9). */
export const FOTO_TAMANHO_MAX = 8 * 1024 * 1024
export const FOTO_TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

type ParceiroQuery = { parceiroId?: string | null }

const PACIENTES = '/parceiro/portal/pacientes'
const CLIENTES = '/parceiro/portal/clientes'

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

function doParceiro(caminho: string, params?: ParceiroQuery) {
  return comQuery(caminho, { parceiroId: params?.parceiroId })
}

async function dados<T>(promise: Promise<ApiEnvelope<T>>) {
  return (await promise).data
}

function json(metodo: string, corpo: unknown, chave?: string): RequestInit {
  const init: RequestInit = { method: metodo, body: JSON.stringify(corpo) }

  return chave ? comIdempotencia(chave, init) : init
}

/* ---------------------------------------------------------------------------- lista e busca */

export type FiltroDaLista = {
  /** Nome do paciente ou do cliente; ou, só com 3 dígitos ou mais, telefone, CPF ou microchip. */
  q?: string
  especie?: Especie | null
  /** `false` lista os inativos (óbito, transferido, mesclado, pedido do responsável). */
  ativo?: boolean
  cursor?: string | null
  limit?: number
}

/**
 * O termo que a API filtra: com letras, o nome; só números, a partir de 3 dígitos (com ou sem
 * máscara). Menos que isso não filtra, então nem vai: não repete o defeito de filtrar telefone com
 * termo sem dígito (D2 do doc 08).
 */
export function termoDaBusca(texto: string): string {
  const limpo = texto.trim()

  if (!limpo) return ''
  if (/\p{L}/u.test(limpo)) return limpo

  const digitos = limpo.replace(/\D/g, '')

  return digitos.length >= 3 ? limpo : ''
}

export function listarPacientes(filtro: FiltroDaLista = {}, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<PaginaDePacientes>>(
      comQuery(PACIENTES, {
        parceiroId: params?.parceiroId,
        q: filtro.q ? termoDaBusca(filtro.q) : undefined,
        especie: filtro.especie ?? undefined,
        ativo: filtro.ativo === false ? false : undefined,
        cursor: filtro.cursor ?? undefined,
        limit: filtro.limit,
      }),
    ),
  )
}

/* ------------------------------------------------------------------------------ o paciente */

export function obterPaciente(id: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Paciente>>(doParceiro(`${PACIENTES}/${encodeURIComponent(id)}`, params)),
  )
}

export function criarPaciente(paciente: NovoPaciente, chave: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Paciente>>(doParceiro(PACIENTES, params), json('POST', paciente, chave)),
  )
}

export function editarPaciente(id: string, edicao: EdicaoDoPaciente, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Paciente>>(
      doParceiro(`${PACIENTES}/${encodeURIComponent(id)}`, params),
      json('PATCH', edicao),
    ),
  )
}

export function inativarPaciente(id: string, inativacao: Inativacao, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Paciente>>(
      doParceiro(`${PACIENTES}/${encodeURIComponent(id)}/inativar`, params),
      json('POST', inativacao),
    ),
  )
}

export function reativarPaciente(id: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Paciente>>(
      doParceiro(`${PACIENTES}/${encodeURIComponent(id)}/reativar`, params),
      { method: 'POST' },
    ),
  )
}

/** O da rota fica; o histórico do `comPacienteId` passa para ele (seção 1.10). */
export function mesclarPaciente(id: string, comPacienteId: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Paciente>>(
      doParceiro(`${PACIENTES}/${encodeURIComponent(id)}/mesclar`, params),
      json('POST', { comPacienteId }),
    ),
  )
}

/** Multipart só com o campo `file` (seção 1.9). Responde a ficha com a `fotoUrl` nova. */
export function enviarFoto(id: string, arquivo: File, params?: ParceiroQuery) {
  const corpo = new FormData()
  corpo.set('file', arquivo)

  return dados(
    apiFetch<ApiEnvelope<Paciente>>(
      doParceiro(`${PACIENTES}/${encodeURIComponent(id)}/foto`, params),
      { method: 'POST', body: corpo },
    ),
  )
}

export async function removerFoto(id: string, params?: ParceiroQuery) {
  await apiFetch<unknown>(doParceiro(`${PACIENTES}/${encodeURIComponent(id)}/foto`, params), {
    method: 'DELETE',
  })
}

/* --------------------------------------------------------------------------------- alertas */

export function criarAlerta(
  pacienteId: string,
  alerta: NovoAlerta,
  chave: string,
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<Alerta>>(
      doParceiro(`${PACIENTES}/${encodeURIComponent(pacienteId)}/alertas`, params),
      json('POST', alerta, chave),
    ),
  )
}

/** `ativo: false` encerra; `ativo: true` reativa (409 `ALERTAS_NO_LIMITE` com 50 ativos). */
export function editarAlerta(
  pacienteId: string,
  alertaId: string,
  edicao: EdicaoDoAlerta,
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<Alerta>>(
      doParceiro(
        `${PACIENTES}/${encodeURIComponent(pacienteId)}/alertas/${encodeURIComponent(alertaId)}`,
        params,
      ),
      json('PATCH', edicao),
    ),
  )
}

/* -------------------------------------------------------------------------------- clientes */

export function obterCliente(id: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Cliente>>(doParceiro(`${CLIENTES}/${encodeURIComponent(id)}`, params)),
  )
}

export function editarCliente(id: string, edicao: EdicaoDoCliente, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Cliente>>(
      doParceiro(`${CLIENTES}/${encodeURIComponent(id)}`, params),
      json('PATCH', edicao),
    ),
  )
}

/** Pacientes, autorizados e o CPF vão para o que fica; o que divergia no duplicado se perde. */
export function mesclarCliente(id: string, comClienteId: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Cliente>>(
      doParceiro(`${CLIENTES}/${encodeURIComponent(id)}/mesclar`, params),
      json('POST', { comClienteId }),
    ),
  )
}

/** Exclusão a pedido do titular (LGPD, seção 1.11). Não tem volta. */
export function anonimizarCliente(id: string, motivo: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Anonimizacao>>(
      doParceiro(`${CLIENTES}/${encodeURIComponent(id)}/anonimizar`, params),
      json('POST', { motivo: motivo.trim() } satisfies AnonimizarClienteDto),
    ),
  )
}

export function criarAutorizado(
  clienteId: string,
  autorizado: NovoAutorizado,
  chave: string,
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<Autorizado>>(
      doParceiro(`${CLIENTES}/${encodeURIComponent(clienteId)}/autorizados`, params),
      json('POST', autorizado, chave),
    ),
  )
}

export function editarAutorizado(
  clienteId: string,
  autorizadoId: string,
  edicao: EdicaoDoAutorizado,
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<Autorizado>>(
      doParceiro(
        `${CLIENTES}/${encodeURIComponent(clienteId)}/autorizados/${encodeURIComponent(autorizadoId)}`,
        params,
      ),
      json('PATCH', edicao),
    ),
  )
}

export async function removerAutorizado(
  clienteId: string,
  autorizadoId: string,
  params?: ParceiroQuery,
) {
  await apiFetch<unknown>(
    doParceiro(
      `${CLIENTES}/${encodeURIComponent(clienteId)}/autorizados/${encodeURIComponent(autorizadoId)}`,
      params,
    ),
    { method: 'DELETE' },
  )
}

/* ------------------------------------------------------------------------------- formatos */

/** `5511987654321` → `+55 (11) 98765-4321`; internacional fica com o "+" e os dígitos. */
export function telefoneNaTela(digitos: string | null | undefined): string {
  if (!digitos) return ''

  const so = digitos.replace(/\D/g, '')

  if (so.startsWith('55') && (so.length === 12 || so.length === 13)) {
    const ddd = so.slice(2, 4)
    const numero = so.slice(4)
    const meio = numero.length === 9 ? 5 : 4

    return `(${ddd}) ${numero.slice(0, meio)}-${numero.slice(meio)}`
  }

  return `+${so}`
}

/** `AAAA-MM-DD` → a idade de hoje, em anos e meses (sem `new Date()` na data do dia). */
export function idadeEmMeses(nascimento: string | null, hoje = new Date()): number | null {
  if (!nascimento) return null

  const [ano, mes, dia] = nascimento.split('-').map(Number)
  if (!ano || !mes || !dia) return null

  let meses = (hoje.getFullYear() - ano) * 12 + (hoje.getMonth() + 1 - mes)
  if (hoje.getDate() < dia) meses -= 1

  return meses < 0 ? null : meses
}
