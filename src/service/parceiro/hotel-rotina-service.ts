/**
 * A rotina do hotel pela API (E7-05, PJ-21T3ER). Guia `portal-parceiro-e7.md`, seções 42, 43 e 45.
 *
 * - Prancheta: ler é `hotel.ler` (o veterinário também); marcar, ronda e desfazer são
 *   `hotel.rotina` e pedem ficha de profissional ativa (403 `PROFISSIONAL_OBRIGATORIO`).
 * - Rotina da casa: ler é `hotel.ler`; prever, publicar e desfazer são `estabelecimento.editar`.
 * - Ajustes e proposta de um hóspede, e o turno do hotel: `hotel.rotina`.
 *
 * A tarefa é registro do servidor: a situação (na janela, atrasada), o tempo e a ordem de andar a
 * casa vêm prontos. Nenhuma regra de atraso mora no portal. Quem fez vem da sessão, nunca do corpo.
 */
import { apiFetch } from '../api'
import type { ApiEnvelope } from '../api-envelope'
import type {
  AjusteDeRotinaCorpoDto,
  AjusteDeRotinaDto,
  AjustesDaHospedagemDto,
  AprovacaoDaPropostaDto,
  EntregaDoTurnoDoHotelDto,
  HospedeDaPranchetaDto,
  ItemDaRotinaDigitadoDto,
  ItemDaRotinaDto,
  MarcarTarefaDto,
  MotivoTarefaNaoFeita,
  PassagemRecebidaDoHotelDto,
  PendenciaRecebidaDoHotelDto,
  PranchetaDto,
  PrevisaoDaRotinaDto,
  PropostaDeRotinaDto,
  PublicacaoDaRotinaDto,
  RondaDaPranchetaDto,
  RondaFeitaDto,
  RotinaPadraoDto,
  SugestaoDeRotinaDto,
  TarefaDaPranchetaDto,
  TarefaKind,
  TurnoAtualDoHotelDto,
  TurnoDoHotelDto,
} from '../contrato/openapi'
import { comIdempotencia } from '../idempotencia'

/**
 * O progresso da prancheta, como o guia 42 descreve (`{ total, resolvidas }`). No contrato o nome
 * `ProgressoDto` colide com o progresso das metas do estoque (E6-02) e o tipo gerado é o outro
 * (lacuna N37): o tipo local fica até o schema ganhar nome próprio.
 */
export type ProgressoDaPrancheta = { total: number; resolvidas: number }

export type HospedeDaPrancheta = Omit<HospedeDaPranchetaDto, 'progresso'> & {
  progresso: ProgressoDaPrancheta
}
export type Prancheta = Omit<PranchetaDto, 'progresso' | 'hospedes'> & {
  progresso: ProgressoDaPrancheta
  hospedes: HospedeDaPrancheta[]
}
export type TarefaDaPrancheta = TarefaDaPranchetaDto
export type RondaDaPrancheta = RondaDaPranchetaDto
export type RondaFeita = RondaFeitaDto
export type KindDaTarefa = TarefaKind
export type MotivoDaTarefa = MotivoTarefaNaoFeita
export type Marcacao = MarcarTarefaDto
export type SituacaoDaTarefa = TarefaDaPranchetaDto['situacao']

export type RotinaDaCasa = RotinaPadraoDto
export type ItemDaRotina = ItemDaRotinaDto
export type ItemDigitado = ItemDaRotinaDigitadoDto
export type KindDaCasa = ItemDaRotinaDigitadoDto['kind']
export type PrevisaoDaRotina = PrevisaoDaRotinaDto
export type PublicacaoDaRotina = PublicacaoDaRotinaDto

export type Ajuste = AjusteDeRotinaDto
export type AjustesDoHospede = AjustesDaHospedagemDto
export type NovoAjuste = AjusteDeRotinaCorpoDto
export type PropostaDeRotina = PropostaDeRotinaDto
export type SugestaoDeRotina = SugestaoDeRotinaDto
export type AprovacaoDaProposta = AprovacaoDaPropostaDto

/**
 * O `statusAgora` da passagem recebida vem como objeto vazio no contrato gerado (lacuna N37); o
 * guia 43 diz que é o status da tarefa, `RETIRADA` ou `NAO_REGISTRADA`.
 */
export type PendenciaRecebida = Omit<PendenciaRecebidaDoHotelDto, 'statusAgora'> & {
  statusAgora: string
}
export type PassagemRecebida = Omit<PassagemRecebidaDoHotelDto, 'pendencias'> & {
  pendencias: PendenciaRecebida[]
}
export type TurnoAtual = Omit<TurnoAtualDoHotelDto, 'passagemRecebida'> & {
  passagemRecebida: PassagemRecebida | null
}
export type TurnoDoHotel = TurnoDoHotelDto
export type PendenciaDoTurno = TurnoAtualDoHotelDto['pendencias'][number]
export type EntregaDoTurno = EntregaDoTurnoDoHotelDto

/* As faixas do guia (seções 42 e 43). */
export const KINDS_DA_CASA: readonly KindDaCasa[] = ['AGUA', 'HIGIENE', 'PASSEIO', 'PESAGEM']
export const MOTIVOS_DA_TAREFA: readonly MotivoDaTarefa[] = [
  'RECUSOU',
  'NAO_COMEU',
  'ANIMAL_DOENTE',
  'SEM_CONDICAO_DO_TEMPO',
  'ORDEM_DO_RESPONSAVEL',
  'ORDEM_VETERINARIA',
  'OUTRO',
]
export const OBSERVACAO_DA_TAREFA_MAX = 300
export const HORARIOS_DA_ROTINA_MAX = 12
export const RONDA_MAX = 60
export const MOTIVO_DO_AJUSTE_MIN = 10
export const MOTIVO_DO_AJUSTE_MAX = 300
export const NOTA_DA_PASSAGEM_MAX = 1000
/** De hoje-7 a hoje+2 (400 `PRANCHETA_DIA_INVALIDO` fora disso). */
export const DIAS_PARA_TRAS = 7
export const DIAS_PARA_FRENTE = 2

type ParceiroQuery = { parceiroId?: string | null }

function comQuery(caminho: string, query: Record<string, string | number | null | undefined>) {
  const busca = new URLSearchParams()
  for (const [chave, valor] of Object.entries(query)) {
    if (valor !== undefined && valor !== null && valor !== '') busca.set(chave, String(valor))
  }
  const texto = busca.toString()
  return texto ? `${caminho}?${texto}` : caminho
}

function json(method: string, corpo?: unknown): RequestInit {
  return corpo === undefined ? { method } : { method, body: JSON.stringify(corpo) }
}

const BASE = '/parceiro/portal/hotel'
const daTarefa = (id: string, resto: string) => `${BASE}/tarefas/${encodeURIComponent(id)}${resto}`
const daHospedagem = (id: string, resto: string) =>
  `${BASE}/hospedagens/${encodeURIComponent(id)}${resto}`

async function chamar<T>(
  caminho: string,
  init: RequestInit = { method: 'GET' },
  params?: ParceiroQuery & Record<string, string | number | null | undefined>,
) {
  const resposta = await apiFetch<ApiEnvelope<T>>(comQuery(caminho, { ...params }), init)
  return resposta.data
}

/* ------------------------------------------------------------------------------- prancheta */

export type RecorteDaPrancheta = { dia?: string; de?: string; ate?: string }

/**
 * O dia em rondas, com as pendentes atrasadas de antes da janela (até 7 dias). `de` (inclusive) e
 * `ate` (exclusive) recortam por hora: o tablet que se relê sozinho pede as próximas horas.
 */
export function lerPrancheta(recorte: RecorteDaPrancheta = {}, params?: ParceiroQuery) {
  return chamar<Prancheta>(`${BASE}/prancheta`, undefined, {
    dia: recorte.dia,
    de: recorte.de,
    ate: recorte.ate,
    parceiroId: params?.parceiroId,
  })
}

/** A repetição com a mesma chave devolve a tarefa como está agora. */
export function marcarTarefa(id: string, corpo: Marcacao, chave: string, params?: ParceiroQuery) {
  return chamar<TarefaDaPrancheta>(
    daTarefa(id, '/marcar'),
    comIdempotencia(chave, json('POST', corpo)),
    { parceiroId: params?.parceiroId },
  )
}

/**
 * Só os ids que a tela mostrou (de 1 a 60), mesmo tipo, mesmo horário, já na janela, nunca
 * medicação. Marca uma por vez e para na primeira que não pega: as anteriores ficam marcadas.
 */
export function marcarRonda(tarefaIds: string[], chave: string, params?: ParceiroQuery) {
  return chamar<RondaFeita>(
    `${BASE}/tarefas/ronda`,
    comIdempotencia(chave, json('POST', { tarefaIds, status: 'FEITA' })),
    { parceiroId: params?.parceiroId },
  )
}

/** Só quem registrou, no mesmo turno do hotel e em até 12 h (403 `DESFAZER_NEGADO`). */
export function desfazerTarefa(id: string, params?: ParceiroQuery) {
  return chamar<TarefaDaPrancheta>(
    daTarefa(id, '/desfazer'),
    { method: 'POST' },
    {
      parceiroId: params?.parceiroId,
    },
  )
}

/* --------------------------------------------------------------------------- rotina da casa */

export function lerRotinaDaCasa(params?: ParceiroQuery) {
  return chamar<RotinaDaCasa>(`${BASE}/rotina-padrao`, undefined, {
    parceiroId: params?.parceiroId,
  })
}

/** Não grava: quantas tarefas nascem, saem e ficam, e quantas mudanças caem hoje. */
export function preverRotinaDaCasa(itens: ItemDigitado[], params?: ParceiroQuery) {
  return chamar<PrevisaoDaRotina>(`${BASE}/rotina-padrao/previsao`, json('POST', { itens }), {
    parceiroId: params?.parceiroId,
  })
}

/**
 * Numa casa grande pode levar cerca de 1 minuto: a tela segura "Publicando..." até a resposta (o
 * `apiFetch` não corta a requisição por tempo).
 */
export function publicarRotinaDaCasa(
  corpo: { itens: ItemDigitado[]; versaoBase: number },
  chave: string,
  params?: ParceiroQuery,
) {
  return chamar<PublicacaoDaRotina>(
    `${BASE}/rotina-padrao/publicar`,
    comIdempotencia(chave, json('POST', corpo)),
    { parceiroId: params?.parceiroId },
  )
}

/** Só a última publicação, uma vez (`podeDesfazer`). */
export function desfazerRotinaDaCasa(versaoBase: number, chave: string, params?: ParceiroQuery) {
  return chamar<PublicacaoDaRotina>(
    `${BASE}/rotina-padrao/desfazer`,
    comIdempotencia(chave, json('POST', { versaoBase })),
    { parceiroId: params?.parceiroId },
  )
}

/* -------------------------------------------------------------------- a rotina de um hóspede */

export function lerAjustes(hospedagemId: string, params?: ParceiroQuery) {
  return chamar<AjustesDoHospede>(daHospedagem(hospedagemId, '/ajustes'), undefined, {
    parceiroId: params?.parceiroId,
  })
}

/** Substitui a lista inteira do tipo ou suspende; o novo revoga o anterior do mesmo tipo. */
export function ajustarRotina(hospedagemId: string, corpo: NovoAjuste, params?: ParceiroQuery) {
  return chamar<AjustesDoHospede>(daHospedagem(hospedagemId, '/ajustes'), json('POST', corpo), {
    parceiroId: params?.parceiroId,
  })
}

/** 204, também na repetição. */
export async function revogarAjuste(
  hospedagemId: string,
  ajusteId: string,
  params?: ParceiroQuery,
) {
  await apiFetch<unknown>(
    comQuery(daHospedagem(hospedagemId, `/ajustes/${encodeURIComponent(ajusteId)}`), {
      parceiroId: params?.parceiroId,
    }),
    { method: 'DELETE' },
  )
}

/** Regras, não IA: nada é gravado. */
export function lerProposta(hospedagemId: string, params?: ParceiroQuery) {
  return chamar<PropostaDeRotina>(daHospedagem(hospedagemId, '/proposta-de-rotina'), undefined, {
    parceiroId: params?.parceiroId,
  })
}

/** O servidor recalcula: sugestão que não existe mais dá 409 `SUGESTAO_DESCONHECIDA` e nada grava. */
export function aprovarProposta(
  hospedagemId: string,
  sugestaoIds: string[],
  chave: string,
  params?: ParceiroQuery,
) {
  return chamar<AprovacaoDaProposta>(
    daHospedagem(hospedagemId, '/proposta-de-rotina/aprovar'),
    comIdempotencia(chave, json('POST', { sugestaoIds })),
    { parceiroId: params?.parceiroId },
  )
}

/* ------------------------------------------------------------------------- turno do hotel */

export function lerTurnoAtual(params?: ParceiroQuery) {
  return chamar<TurnoAtual>(`${BASE}/turnos/atual`, undefined, { parceiroId: params?.parceiroId })
}

/** Abre o da grade (faltando menos de 1 h para acabar, o seguinte). */
export function assumirTurno(chave: string, params?: ParceiroQuery) {
  return chamar<TurnoDoHotel>(
    `${BASE}/turnos/assumir`,
    comIdempotencia(chave, { method: 'POST' }),
    {
      parceiroId: params?.parceiroId,
    },
  )
}

/** Quem recebe é a ficha de alguém da casa com `hotel.rotina`, diferente de quem entrega. */
export function entregarTurno(
  turnoId: string,
  corpo: { recebidoPorId: string; nota: string },
  chave: string,
  params?: ParceiroQuery,
) {
  return chamar<EntregaDoTurno>(
    `${BASE}/turnos/${encodeURIComponent(turnoId)}/entregar`,
    comIdempotencia(chave, json('POST', corpo)),
    { parceiroId: params?.parceiroId },
  )
}
