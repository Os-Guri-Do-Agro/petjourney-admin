/**
 * O módulo ONG do portal pela API (PJ-TJ07TW, guia "ONGs no portal e entrega do pet ao adotante",
 * seção 2): os animais sob o cuidado da ONG, a saúde que ela registra e o convite de adoção.
 *
 * - Todas as rotas exigem o módulo ONG lendo (`MODULO_INATIVO` sem ele; `MODULO_SOMENTE_LEITURA`
 *   com `reason` na escrita) e aceitam `?parceiroId=`, inclusive a lista com os filtros.
 * - Ler é `ong.ler`; cadastrar, editar, registrar saúde, encerrar e retorno, `ong.escrever`; gerar e
 *   cancelar o convite, `ong.entregar` (só DONO e GESTOR).
 * - Ficha de outra ONG e id que não existe dão o mesmo 403 `OWNERSHIP_FORBIDDEN`.
 * - Datas de dia vão e voltam como `AAAA-MM-DD`; `new Date()` desloca um dia no fuso.
 * - O `link` do convite só vem na resposta de gerar: a lista de convites não o traz.
 */
import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'
import type {
  AnimalDaOngDto,
  AnimalDaOngResumoDto,
  AtualizarAnimalDaOngDto,
  CriarAnimalDaOngDto,
  EncerrarAnimalDto,
  EntregaDaOngDto,
  EntregaGeradaDto,
  GerarEntregaDto,
  ListaDeAnimaisDto,
  PerfilDaOngDto,
  PesoDaOngDto,
  RegistroCriadoDto,
  RetornoDaOngDto,
  VacinaDaOngDto,
  VermifugoDaOngDto,
} from '../contrato/openapi'

export type PerfilDaOng = PerfilDaOngDto
export type AnimalDaOng = AnimalDaOngDto
export type AnimalDaOngNaLista = AnimalDaOngResumoDto
export type PaginaDeAnimais = ListaDeAnimaisDto
export type NovoAnimalDaOng = CriarAnimalDaOngDto
export type EdicaoDoAnimalDaOng = AtualizarAnimalDaOngDto
export type VacinaDaOng = VacinaDaOngDto
export type VermifugoDaOng = VermifugoDaOngDto
export type PesoDaOng = PesoDaOngDto
export type ConviteGerado = EntregaGeradaDto
export type ConviteDaOng = EntregaDaOngDto
export type PedidoDeConvite = GerarEntregaDto
export type RetornoDaOng = RetornoDaOngDto

export type StatusDoAnimal = AnimalDaOngDto['status']
export type StatusDoConvite = EntregaDaOngDto['status']
export type OrigemDaEntrada = AnimalDaOngDto['origemDaEntrada']
export type MotivoDoEncerramento = EncerrarAnimalDto['motivo']
export type AvisoDeManejo = NonNullable<CriarAnimalDaOngDto['avisosDeManejo']>[number]
export type TipoDeRegistro = 'vacinas' | 'vermifugos' | 'pesos'

export const STATUS_DO_ANIMAL: readonly StatusDoAnimal[] = ['EM_CUIDADO', 'ENTREGUE', 'ENCERRADO']

export const ORIGENS_DA_ENTRADA: readonly OrigemDaEntrada[] = [
  'RESGATE',
  'DOACAO_DE_RESPONSAVEL',
  'NASCIDO_NA_ONG',
  'TRANSFERENCIA',
  'RETORNO_DE_ADOCAO',
  'OUTRO',
]

export const MOTIVOS_DO_ENCERRAMENTO: readonly MotivoDoEncerramento[] = [
  'OBITO',
  'FUGA',
  'TRANSFERIDO',
  'OUTRO',
]

export const AVISOS_DE_MANEJO: readonly AvisoDeManejo[] = [
  'MORDE',
  'PRECISA_FOCINHEIRA',
  'PRECISA_SEDACAO',
  'AGRESSIVO_COM_ANIMAIS',
  'MEDROSO',
]

/** Busca por nome: de 2 a 60 caracteres (a API recusa fora disso). */
export const BUSCA_MIN = 2
export const BUSCA_MAX = 60

/** Foto do animal: JPEG, PNG ou WebP (lido do conteúdo), até 10 MB. */
export const FOTO_DO_ANIMAL_MAX = 10 * 1024 * 1024
export const FOTO_DO_ANIMAL_TIPOS = ['image/jpeg', 'image/png', 'image/webp']

/** Peso: de 0,01 a 200 kg. */
export const PESO_MIN_KG = 0.01
export const PESO_MAX_KG = 200

type ParceiroQuery = { parceiroId?: string | null }

const ONG = '/parceiro/portal/ong'

function comQuery(caminho: string, query: Record<string, string | number | null | undefined>) {
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

function doAnimal(id: string, resto = '') {
  return `${ONG}/animais/${encodeURIComponent(id)}${resto}`
}

async function dados<T>(promise: Promise<ApiEnvelope<T>>) {
  return (await promise).data
}

function json(metodo: string, corpo: unknown): RequestInit {
  return { method: metodo, body: JSON.stringify(corpo) }
}

/** O termo que vai para a API: aparado, e só de 2 a 60 caracteres (curto demais nem vai). */
export function termoDaBuscaDaOng(termo: string) {
  const limpo = termo.trim().replace(/\s+/g, ' ')

  return limpo.length >= BUSCA_MIN ? limpo.slice(0, BUSCA_MAX) : ''
}

export function obterPerfilDaOng(params?: ParceiroQuery) {
  return dados(apiFetch<ApiEnvelope<PerfilDaOng>>(doParceiro(`${ONG}/perfil`, params)))
}

export function listarAnimaisDaOng(
  filtro: {
    status?: StatusDoAnimal | null
    busca?: string
    cursor?: string | null
    limit?: number
  },
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<PaginaDeAnimais>>(
      comQuery(`${ONG}/animais`, {
        parceiroId: params?.parceiroId,
        status: filtro.status,
        busca: termoDaBuscaDaOng(filtro.busca ?? ''),
        cursor: filtro.cursor,
        limit: filtro.limit,
      }),
    ),
  )
}

export function obterAnimalDaOng(id: string, params?: ParceiroQuery) {
  return dados(apiFetch<ApiEnvelope<AnimalDaOng>>(doParceiro(doAnimal(id), params)))
}

export function cadastrarAnimalDaOng(corpo: NovoAnimalDaOng, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<AnimalDaOng>>(doParceiro(`${ONG}/animais`, params), json('POST', corpo)),
  )
}

export function editarAnimalDaOng(id: string, corpo: EdicaoDoAnimalDaOng, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<AnimalDaOng>>(doParceiro(doAnimal(id), params), json('PATCH', corpo)),
  )
}

/** Multipart só com o campo `file`. Responde a ficha com a `fotoUrl` nova. */
export function enviarFotoDoAnimal(id: string, arquivo: File, params?: ParceiroQuery) {
  const corpo = new FormData()
  corpo.set('file', arquivo)

  return dados(
    apiFetch<ApiEnvelope<AnimalDaOng>>(doParceiro(doAnimal(id, '/foto'), params), {
      method: 'POST',
      body: corpo,
    }),
  )
}

export function registrarVacina(id: string, corpo: VacinaDaOng, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<RegistroCriadoDto>>(
      doParceiro(doAnimal(id, '/vacinas'), params),
      json('POST', corpo),
    ),
  )
}

export function registrarVermifugo(id: string, corpo: VermifugoDaOng, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<RegistroCriadoDto>>(
      doParceiro(doAnimal(id, '/vermifugos'), params),
      json('POST', corpo),
    ),
  )
}

export function registrarPeso(id: string, corpo: PesoDaOng, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<RegistroCriadoDto>>(
      doParceiro(doAnimal(id, '/pesos'), params),
      json('POST', corpo),
    ),
  )
}

/** Apaga um registro que a ONG gravou (vacina, vermífugo ou peso): 204. */
export async function removerRegistro(
  id: string,
  tipo: TipoDeRegistro,
  registroId: string,
  params?: ParceiroQuery,
) {
  await apiFetch<unknown>(
    doParceiro(doAnimal(id, `/${tipo}/${encodeURIComponent(registroId)}`), params),
    { method: 'DELETE' },
  )
}

export function encerrarAnimal(id: string, motivo: MotivoDoEncerramento, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<AnimalDaOng>>(
      doParceiro(doAnimal(id, '/encerrar'), params),
      json('POST', { motivo }),
    ),
  )
}

/** Animal entregue que voltou: nasce uma ficha nova em cuidado (`retornoDeId` aponta a antiga). */
export function registrarRetorno(id: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<RetornoDaOng>>(doParceiro(doAnimal(id, '/retorno'), params), {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  )
}

/** Gera o convite de adoção (7 dias). Vale o último: o pendente anterior do animal deixa de valer. */
export function gerarConvite(id: string, corpo: PedidoDeConvite, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<ConviteGerado>>(
      doParceiro(doAnimal(id, '/entregas'), params),
      json('POST', corpo),
    ),
  )
}

/** Os 20 convites mais novos do animal, com `EXPIRADA` derivada. */
export function listarConvites(id: string, params?: ParceiroQuery) {
  return dados(apiFetch<ApiEnvelope<ConviteDaOng[]>>(doParceiro(doAnimal(id, '/entregas'), params)))
}

/** Cancela o convite pendente: 204. Já respondido ou de outra ONG: o mesmo 403. */
export async function cancelarConvite(entregaId: string, params?: ParceiroQuery) {
  await apiFetch<unknown>(doParceiro(`${ONG}/entregas/${encodeURIComponent(entregaId)}`, params), {
    method: 'DELETE',
  })
}
