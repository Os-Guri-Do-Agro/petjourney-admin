/**
 * O vínculo entre o paciente da clínica e o pet do app (E2-02, PJ-HD8PAB). Guia
 * `portal-parceiro-e2.md`, seções 2.1 e 2.2; o convite por link, WhatsApp e QR é o pedido 4 do
 * guia `pedidos-luis-17-11.md`.
 *
 * Nenhuma proposta aparece para uma conta sem prova de posse: o link do convite, o código do
 * balcão, o acesso temporário que a própria pessoa criou ou o QR do pet dela. A clínica nunca sabe
 * se a proposta chegou a alguém: a resposta é a mesma, e a lista mostra "não respondida".
 */
import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'
import type {
  PedidoDeCorrecaoDto,
  PropostaCriadaDto,
  ProporVinculoDto,
  PropostaDoParceiroDto,
  PropostaEnviadaDto,
  VinculoDoPacienteDto,
} from '../contrato/openapi'
import { listarPacientes } from './pacientes-service'

export type PropostaCriada = PropostaCriadaDto
export type CanalDoConvite = ProporVinculoDto['canal']
export type Proposta = PropostaDoParceiroDto
export type Vinculo = VinculoDoPacienteDto
export type PedidoDeCorrecao = PedidoDeCorrecaoDto
export type CanalDoVinculo = PropostaDoParceiroDto['canal']
export type StatusDaProposta = PropostaDoParceiroDto['status']

/** Motivo de encerrar o vínculo: de 3 a 300 caracteres. */
export const MOTIVO_DO_ENCERRAMENTO_MIN = 3
export const MOTIVO_DO_ENCERRAMENTO_MAX = 300

type ParceiroQuery = { parceiroId?: string | null }

const PORTAL = '/parceiro/portal'

function comParceiro(caminho: string, params?: ParceiroQuery, extra: Record<string, string> = {}) {
  const busca = new URLSearchParams()
  if (params?.parceiroId) busca.set('parceiroId', params.parceiroId)
  for (const [chave, valor] of Object.entries(extra)) busca.set(chave, valor)
  const texto = busca.toString()

  return texto ? `${PORTAL}${caminho}?${texto}` : `${PORTAL}${caminho}`
}

async function dados<T>(promise: Promise<ApiEnvelope<T>>) {
  return (await promise).data
}

function post(corpo: unknown): RequestInit {
  return { method: 'POST', body: JSON.stringify(corpo) }
}

/* ------------------------------------------------------------------------------- propor */

/**
 * O convite da clínica, que vale 7 dias. Vale o último: a API cancela os pendentes do cliente cujos
 * pacientes estão todos neste convite e devolve quantos em `canceladas`.
 *
 * - `LINK`: link e código juntos, com a `mensagem` pronta no idioma do portal e o `whatsappUrl`
 *   com o telefone do cadastro. O portal não monta a mensagem.
 * - `EMAIL`: a API manda o link ao e-mail do cadastro (sem e-mail, 400 `CLIENTE_SEM_EMAIL`) e não
 *   devolve link nem código.
 * - `CODIGO`: o mesmo convite do `LINK` (atalho antigo).
 */
export function proporVinculo(
  clienteId: string,
  pacienteIds: string[],
  canal: CanalDoConvite,
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<PropostaCriada>>(
      comParceiro(`/clientes/${encodeURIComponent(clienteId)}/propostas-de-vinculo`, params),
      post({ pacienteIds, canal }),
    ),
  )
}

/** Pelo QR da carteirinha do pet: a resposta é sempre `{ propostaId }`, exista o pet ou não. */
export function proporPorQr(publicSlug: string, pacienteId: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<PropostaEnviadaDto>>(
      comParceiro('/vinculos/por-qr', params),
      post({ publicSlug, pacienteId }),
    ),
  )
}

/**
 * Pelo acesso temporário que este parceiro reivindicou, enquanto ele vale. Sem `pacienteId`, a API
 * cria cliente e paciente pelo cabeçalho do acesso ("Responsável de {pet}").
 */
export function proporPorAcesso(
  acessoId: string,
  pacienteId: string | null,
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<PropostaEnviadaDto>>(
      comParceiro(`/compartilhamentos/${encodeURIComponent(acessoId)}/propor-vinculo`, params),
      post(pacienteId ? { pacienteId } : {}),
    ),
  )
}

type PacienteDoConvite = { id: string; nome: string }

/**
 * Quem entra no convite: o paciente da tela, primeiro, e os outros do mesmo cliente que estão ativos
 * e sem vínculo. A API não lista os pacientes de um cliente: a busca pelo nome dele traz os pets da
 * casa, e ficam só os do mesmo `cliente.id`. Busca que falha deixa o convite só com o da tela; o
 * vínculo que não deu para ler deixa aquele pet de fora (nada de 409 por dúvida).
 */
export async function pacientesDoConvite(
  paciente: PacienteDoConvite & { cliente: { id: string; nome: string } },
  params?: ParceiroQuery,
): Promise<PacienteDoConvite[]> {
  const atual = { id: paciente.id, nome: paciente.nome }

  try {
    const pagina = await listarPacientes({ q: paciente.cliente.nome, limit: 50 }, params)
    const irmaos = pagina.itens.filter(
      (item) =>
        item.cliente.id === paciente.cliente.id &&
        item.id !== paciente.id &&
        item.ativo &&
        !item.obitoEm,
    )
    const livres = await Promise.all(
      irmaos.map(async (item) => {
        try {
          return (await obterVinculo(item.id, params)) ? null : { id: item.id, nome: item.nome }
        } catch {
          return null
        }
      }),
    )

    return [atual, ...livres.filter((item): item is PacienteDoConvite => item !== null)]
  } catch {
    return [atual]
  }
}

export function listarPropostas(clienteId: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Proposta[]>>(
      comParceiro(`/clientes/${encodeURIComponent(clienteId)}/propostas-de-vinculo`, params),
    ),
  )
}

/** Só a pendente se cancela. */
export async function cancelarProposta(id: string, params?: ParceiroQuery) {
  await apiFetch<unknown>(comParceiro(`/propostas-de-vinculo/${encodeURIComponent(id)}`, params), {
    method: 'DELETE',
  })
}

/* ------------------------------------------------------------------------------ o vínculo */

/** `null` quando o paciente não está ligado a um pet do app. */
export function obterVinculo(pacienteId: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Vinculo | null>>(
      comParceiro(`/pacientes/${encodeURIComponent(pacienteId)}/vinculo`, params),
    ),
  )
}

export async function encerrarVinculo(pacienteId: string, motivo: string, params?: ParceiroQuery) {
  await apiFetch<unknown>(
    comParceiro(`/pacientes/${encodeURIComponent(pacienteId)}/vinculo/encerrar`, params),
    post({ motivo: motivo.trim() }),
  )
}

/* ------------------------------------------------------------- pedidos de correção */

export function listarCorrecoes(resolvidos: boolean, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<PedidoDeCorrecao[]>>(
      comParceiro('/pedidos-de-correcao', params, resolvidos ? { resolvidos: 'true' } : {}),
    ),
  )
}

export async function resolverCorrecao(id: string, params?: ParceiroQuery) {
  await apiFetch<unknown>(
    comParceiro(`/pedidos-de-correcao/${encodeURIComponent(id)}/resolver`, params),
    { method: 'POST' },
  )
}

/* ---------------------------------------------------------------------------- formatos */

/** `K7MQX3PA` → `K7MQ-X3PA`: o responsável lê em dois blocos. */
export function codigoEmBlocos(codigo: string) {
  const limpo = codigo.replace(/[^A-Za-z0-9]/g, '').toUpperCase()

  return limpo.length === 8 ? `${limpo.slice(0, 4)}-${limpo.slice(4)}` : limpo
}
