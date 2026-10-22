/**
 * O estabelecimento do parceiro (E1-01): o perfil público, o fuso, os horários da semana, os dias
 * especiais, o endereço da página (slug) e a publicação. Qualquer membro lê; só o DONO escreve
 * (`podeEditar` vem pronto da API).
 *
 * Os tipos são escritos aqui porque o contrato gera os campos que podem ser nulos como objeto vazio
 * (`docs/integracao-portal-parceiro/lacunas-da-api.md`, L2). O formato é o de
 * `EstabelecimentoInternoDto`.
 */
import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'
import type {
  DiaEspecialRespostaDto,
  FeriadosCopiadosDto,
  FuncionamentoDto,
  HorarioDiaRespostaDto,
} from '../contrato/openapi'

type ParceiroQuery = {
  parceiroId?: string | null
}

/** O idioma em que a clínica escreveu os textos livres. A página pública não os traduz. */
export type IdiomaDosTextos = 'pt-BR' | 'en-US' | 'en-GB' | 'es-419' | 'sr-Latn' | 'ar'

export type PerfilDoEstabelecimento = {
  nomePublico: string
  descricao: string | null
  idiomaDosTextos: IdiomaDosTextos
  /** Fuso IANA (`America/Cuiaba`), nunca offset fixo. */
  fusoHorario: string
  telefonePublico: string | null
  whatsappPublico: string | null
  /** Plantão fora do expediente; `null` é sem plantão. */
  telefonePlantao: string | null
  emailPublico: string | null
  site: string | null
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  pais: string
  latitude: number | null
  longitude: number | null
  mostrarMapa: boolean
  /** `false`: a página pública mostra só bairro, cidade e UF, sem mapa. */
  mostrarEndereco: boolean
  mensagemForaDoHorario: string | null
  orientacaoEmergencia: string | null
  publicado: boolean
  publicadoEm: string | null
}

/**
 * O corpo do `PUT`: o perfil inteiro, porque o que não vier vira `null` na API. A exceção é
 * `mostrarEndereco`: omitido, fica o que está gravado.
 */
export type DadosDoEstabelecimento = Omit<
  PerfilDoEstabelecimento,
  'publicado' | 'publicadoEm' | 'mostrarEndereco'
> & { mostrarEndereco?: boolean }

export type HorarioDoDia = HorarioDiaRespostaDto
export type DiaEspecial = DiaEspecialRespostaDto & { id: string }
export type Funcionamento = FuncionamentoDto

/** O que impede publicar. `telefone` vale qualquer um dos três telefones. */
export type PendenciaParaPublicar = 'APROVACAO' | 'nomePublico' | 'fusoHorario' | 'telefone'

export type Estabelecimento = {
  /** `null` antes do primeiro salvamento. */
  perfil: PerfilDoEstabelecimento | null
  /** `null` até o cadastro ser aprovado. */
  slug: string | null
  horarios: HorarioDoDia[]
  /** De 30 dias atrás em diante. */
  diasEspeciais: DiaEspecial[]
  /** Publicado e com o parceiro aprovado e ativo: o que o público vê agora. */
  visivelPublicamente: boolean
  pendenciasParaPublicar: PendenciaParaPublicar[]
  funcionamento: Funcionamento
  podeEditar: boolean
}

export type NovoDiaEspecial = {
  /** `AAAA-MM-DD`. */
  data: string
  nome: string
  fechado: boolean
  abre?: string | null
  fecha?: string | null
}

const BASE = '/parceiro/portal/estabelecimento'

function comParceiro(caminho: string, params?: ParceiroQuery) {
  return params?.parceiroId
    ? `${BASE}${caminho}?parceiroId=${encodeURIComponent(params.parceiroId)}`
    : `${BASE}${caminho}`
}

async function dados<T>(promise: Promise<ApiEnvelope<T>>) {
  const response = await promise

  return response.data
}

export function obterEstabelecimento(params?: ParceiroQuery) {
  return dados(apiFetch<ApiEnvelope<Estabelecimento>>(comParceiro('', params)))
}

export function salvarPerfil(perfil: DadosDoEstabelecimento, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Estabelecimento>>(comParceiro('', params), {
      method: 'PUT',
      body: JSON.stringify(perfil),
    }),
  )
}

/** Os 7 dias, de domingo (0) a sábado (6). */
export function salvarHorarios(dias: HorarioDoDia[], params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Estabelecimento>>(comParceiro('/horarios', params), {
      method: 'PUT',
      body: JSON.stringify({ dias }),
    }),
  )
}

/** A mesma data de novo dá 409 (`ESTABELECIMENTO_DIA_ESPECIAL_JA_EXISTE`): o duplo clique não duplica. */
export function criarDiaEspecial(dia: NovoDiaEspecial, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<DiaEspecial>>(comParceiro('/dias-especiais', params), {
      method: 'POST',
      body: JSON.stringify(dia),
    }),
  )
}

export async function removerDiaEspecial(id: string, params?: ParceiroQuery) {
  await apiFetch<unknown>(comParceiro(`/dias-especiais/${encodeURIComponent(id)}`, params), {
    method: 'DELETE',
  })
}

export function copiarFeriadosNacionais(ano: number, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<FeriadosCopiadosDto>>(
      comParceiro('/dias-especiais/feriados-nacionais', params),
      { method: 'POST', body: JSON.stringify({ ano }) },
    ),
  )
}

export function trocarSlug(slug: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Estabelecimento>>(comParceiro('/slug', params), {
      method: 'PUT',
      body: JSON.stringify({ slug }),
    }),
  )
}

export function publicarEstabelecimento(params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Estabelecimento>>(comParceiro('/publicar', params), { method: 'POST' }),
  )
}

export function despublicarEstabelecimento(params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Estabelecimento>>(comParceiro('/despublicar', params), {
      method: 'POST',
    }),
  )
}
