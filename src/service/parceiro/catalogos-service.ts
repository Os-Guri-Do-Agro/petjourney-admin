/**
 * Os catálogos clínicos da Clínica pela API (E4-02, PJ-7JRYWN). Guia `portal-parceiro-e4.md`,
 * seção 1.
 *
 * O catálogo global é da PetJourney e só leitura; a clínica acrescenta o que é dela. Todo o
 * conteúdo já vem traduzido pelo `Accept-Language`. A regra mora no servidor: a busca (com
 * indicação e erro de digitação), a faixa do paciente e a conta da dose. O front só monta as
 * frases.
 *
 * Quem entra: pacote, busca e faixas pedem `prontuario.ler`; acréscimos, `catalogo.gerir` (DONO e
 * GESTOR); a dose, `prontuario.escrever` com CRMV (sem CRMV: 403 `CRMV_OBRIGATORIO`).
 */
import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'
import type {
  AcrescimosDto,
  AtualizarMedicamentoDto,
  CalcularDoseDto,
  CriarDiagnosticoDto,
  CriarExameDto,
  CriarMedicamentoDto,
  CriarVacinaDto,
  DiagnosticoDto,
  ExameDto,
  FaixasDoPacienteDto,
  MedicamentoDto,
  PacoteDeCatalogosDto,
  ResultadoDaDoseDto,
  VacinaDto,
} from '../contrato/openapi'
import { comIdempotencia } from '../idempotencia'

export type Medicamento = MedicamentoDto
export type Diagnostico = DiagnosticoDto
export type Exame = ExameDto
export type Vacina = VacinaDto
export type PacoteDeCatalogos = PacoteDeCatalogosDto
export type FaixasDoPaciente = FaixasDoPacienteDto
export type ResultadoDaDose = ResultadoDaDoseDto
export type PedidoDeDose = CalcularDoseDto
export type Acrescimos = AcrescimosDto
export type NovoMedicamento = CriarMedicamentoDto
export type EdicaoDeMedicamento = AtualizarMedicamentoDto
export type NovaVacina = CriarVacinaDto
export type NovoExame = CriarExameDto
export type NovoDiagnostico = CriarDiagnosticoDto
export type EspecieDoCatalogo = MedicamentoDto['doses'][number]['especie']
export type ClasseDoMedicamento = MedicamentoDto['classe']
export type AvisoDaDose = ResultadoDaDoseDto['avisos'][number]

export type TipoDeAcrescimo = 'medicamentos' | 'vacinas' | 'exames' | 'diagnosticos'

/** A busca vai até 50 itens (padrão 12) e o texto até 60 caracteres. */
export const BUSCA_LIMITE = 12
export const BUSCA_TEXTO_MAX = 60

/** Até 2.000 medicamentos próprios por clínica (o 2.001º dá 409). */
export const MEDICAMENTOS_PROPRIOS_MAX = 2000

export const ESPECIES_DO_CATALOGO: readonly EspecieDoCatalogo[] = [
  'CACHORRO',
  'GATO',
  'AVE',
  'ROEDOR',
  'COELHO',
  'PEIXE',
  'REPTIL',
  'OUTRO',
]

type ParceiroQuery = { parceiroId?: string | null }

const BASE = '/parceiro/portal/clinica'

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

/** Faixas, exames, vacinas e classes. Da clínica e do idioma: o cache leva os dois. */
export function lerPacote(params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<PacoteDeCatalogos>>(
      comQuery(`${BASE}/catalogos`, { parceiroId: params?.parceiroId }),
    ),
  )
}

/**
 * Nome, princípio, sinônimo ou indicação, com tolerância a erro de digitação. Só o global revisado
 * e os acréscimos da clínica: hoje, sem nada revisado, só os da clínica (esperado, D2).
 */
export function buscarMedicamentos(
  filtro: { q?: string; especie?: EspecieDoCatalogo | null; limite?: number },
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<Medicamento[]>>(
      comQuery(`${BASE}/catalogos/medicamentos`, {
        q: filtro.q?.trim().slice(0, BUSCA_TEXTO_MAX),
        especie: filtro.especie,
        limite: filtro.limite ?? BUSCA_LIMITE,
        parceiroId: params?.parceiroId,
      }),
    ),
  )
}

/** Por código ("GE-01" ou "ge01") e por descrição, em qualquer idioma. */
export function buscarDiagnosticos(
  filtro: { q?: string; limite?: number },
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<Diagnostico[]>>(
      comQuery(`${BASE}/catalogos/diagnosticos`, {
        q: filtro.q?.trim().slice(0, BUSCA_TEXTO_MAX),
        limite: filtro.limite ?? BUSCA_LIMITE,
        parceiroId: params?.parceiroId,
      }),
    ),
  )
}

/** A faixa de cada sinal vital do paciente, resolvida no servidor (`faixa: null` = sem referência). */
export function faixasDoPaciente(pacienteId: string, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<FaixasDoPaciente>>(
      comQuery(`${BASE}/catalogos/faixas/paciente/${encodeURIComponent(pacienteId)}`, {
        parceiroId: params?.parceiroId,
      }),
    ),
  )
}

/**
 * A conta da dose que o veterinário escolheu. A API não sugere dose: faz a conta, mostra a faixa
 * ao lado e os avisos. `calculo` nulo sem peso; `exigeConfirmacao` com aviso bloqueante.
 */
export function calcularDose(pedido: PedidoDeDose, params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<ResultadoDaDose>>(
      comQuery(`${BASE}/dose/calcular`, { parceiroId: params?.parceiroId }),
      { method: 'POST', body: JSON.stringify(pedido) },
    ),
  )
}

/* -------------------------------------------------------------------------- acréscimos */

/** Os itens da própria clínica, ativos e inativos, com as traduções cruas (para editar). */
export function listarAcrescimos(params?: ParceiroQuery) {
  return dados(
    apiFetch<ApiEnvelope<Acrescimos>>(
      comQuery(`${BASE}/catalogos/acrescimos`, { parceiroId: params?.parceiroId }),
    ),
  )
}

type CorpoDoAcrescimo = NovoMedicamento | NovaVacina | NovoExame | NovoDiagnostico

/** Uma chave por clique em "Salvar" (`Idempotency-Key`). */
export function criarAcrescimo<T>(
  tipo: TipoDeAcrescimo,
  corpo: CorpoDoAcrescimo,
  chave: string,
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<T>>(
      comQuery(`${BASE}/catalogos/${tipo}`, { parceiroId: params?.parceiroId }),
      comIdempotencia(chave, { method: 'POST', body: JSON.stringify(corpo) }),
    ),
  )
}

/** Só o que muda; `ativo: false` desativa (nada se apaga). No medicamento, `doses` substitui a lista. */
export function editarAcrescimo<T>(
  tipo: TipoDeAcrescimo,
  id: string,
  edicao: Record<string, unknown>,
  params?: ParceiroQuery,
) {
  return dados(
    apiFetch<ApiEnvelope<T>>(
      comQuery(`${BASE}/catalogos/${tipo}/${encodeURIComponent(id)}`, {
        parceiroId: params?.parceiroId,
      }),
      { method: 'PATCH', body: JSON.stringify(edicao) },
    ),
  )
}

/* ----------------------------------------------------------------------- as frases */

/** A faixa de dose que vale para a espécie: a da espécie, ou a geral (com a marca). */
export function doseDaEspecie(medicamento: Medicamento, especie: EspecieDoCatalogo | null) {
  const daEspecie = especie ? medicamento.doses.find((dose) => dose.especie === especie) : null
  if (daEspecie) return { ...daEspecie, origem: 'ESPECIE' as const }
  return {
    mgKgMin: medicamento.doseUsualMgKg.min,
    mgKgMax: medicamento.doseUsualMgKg.max,
    proibido: false,
    nota: null,
    frequenciaHoras: null,
    duracaoUsualDias: null,
    origem: 'GERAL' as const,
  }
}

/** Os parâmetros de um passo da conta, como número (a API manda `unknown`). */
export function numeroDoPasso(params: Record<string, unknown>, chave: string): number | null {
  const valor = params[chave]
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null
}
