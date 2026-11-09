/**
 * As contas da tela da rotina do hotel (E7-05, guia e7 42 a 44), sem Vue: o que a prancheta pede
 * ao servidor, o que vai numa ronda, quando tentar de novo em silêncio, quem pode desfazer e os
 * horários digitados. A situação de cada tarefa (na janela, atrasada) **não** se calcula aqui: vem
 * pronta do servidor.
 */
import { ApiError } from '@/service/api'
import type {
  HospedeDaPrancheta,
  RondaDaPrancheta,
  TarefaDaPrancheta,
} from '@/service/parceiro/hotel-rotina-service'
import type { Ocorrencia } from '@/service/parceiro/hotel-ocorrencias-service'

/* ------------------------------------------------------------------- ler sem assustar ninguém */

/** Quanto esperar quando a API não diz (`tenteDeNovoEmSegundos` ausente), e o teto. */
const ESPERA_PADRAO_S = 5
const ESPERA_MAX_S = 60

/**
 * A prancheta ocupada (503 `ROTINA_OCUPADA`): o tablet que se relê sozinho espera o tempo que a
 * API pediu e tenta de novo, **sem mostrar erro na primeira vez**. Devolve os milissegundos de
 * espera, ou `null` quando é hora de mostrar o erro (outro erro, ou já tentou de novo em silêncio).
 */
export function esperaAntesDeTentarDeNovo(err: unknown, tentativasSilenciosas: number) {
  if (!(err instanceof ApiError) || err.codigo !== 'ROTINA_OCUPADA') return null
  if (tentativasSilenciosas > 0) return null
  const pedido = Number(err.detalhes.tenteDeNovoEmSegundos)
  const segundos = Number.isFinite(pedido) && pedido > 0 ? pedido : ESPERA_PADRAO_S
  return Math.min(segundos, ESPERA_MAX_S) * 1000
}

/* -------------------------------------------------------------------------------- o recorte */

/** A hora da parede da casa num ISO com o offset dela (`2026-11-09T14:20:00-03:00` → 14). */
export function horaDaParede(iso: string) {
  const texto = iso.slice(11, 13)
  if (!/^\d{2}$/.test(texto)) return null
  const hora = Number(texto)
  return hora <= 23 ? hora : null
}

/** O dia da parede da casa (`AAAA-MM-DD`). */
export function diaDaParede(iso: string) {
  return iso.slice(0, 10)
}

const doisDigitos = (n: number) => String(n).padStart(2, '0')

/**
 * As próximas horas para o tablet (guia 42, "Recorte por hora"): de uma hora antes da hora de
 * agora até quatro horas depois. `ate` é exclusivo e não passa da meia-noite: perto do fim do dia
 * ele some e o recorte vai até o fim. As pendentes atrasadas de antes do `de` vêm sempre.
 */
export function recorteDasProximasHoras(hora: number, antes = 1, depois = 4) {
  const de = Math.max(0, hora - antes)
  const fim = hora + depois + 1
  return fim <= 23
    ? { de: `${doisDigitos(de)}:00`, ate: `${doisDigitos(fim)}:00` }
    : {
        de: `${doisDigitos(de)}:00`,
      }
}

/** Soma dias a um `AAAA-MM-DD`, no calendário (sem fuso). */
export function somarDias(dia: string, dias: number) {
  const [ano, mes, d] = dia.split('-').map(Number)
  const data = new Date(Date.UTC(ano ?? 1970, (mes ?? 1) - 1, (d ?? 1) + dias))
  return data.toISOString().slice(0, 10)
}

/** Quantos dias de `hoje` até `dia` (ontem: -1; amanhã: 1). */
export function diasEntre(hoje: string, dia: string) {
  const [a1, m1, d1] = hoje.split('-').map(Number)
  const [a2, m2, d2] = dia.split('-').map(Number)
  const um = Date.UTC(a1 ?? 1970, (m1 ?? 1) - 1, d1 ?? 1)
  const outro = Date.UTC(a2 ?? 1970, (m2 ?? 1) - 1, d2 ?? 1)
  return Math.round((outro - um) / 86_400_000)
}

/* -------------------------------------------------------------------------------- as rondas */

export type TempoDaRonda = 'AGORA' | 'ADIANTE' | 'PASSADO'

export function linhasDaRonda(ronda: RondaDaPrancheta) {
  return ronda.grupos.flatMap((grupo) => grupo.linhas)
}

/**
 * Em que parte da tela a ronda mora. Uma ronda com alguma linha da vez fica em "agora" inteira:
 * a linha que acabou de ser marcada continua no lugar e não some debaixo do dedo.
 */
export function tempoDaRonda(ronda: RondaDaPrancheta): TempoDaRonda {
  const linhas = linhasDaRonda(ronda)
  if (linhas.some((linha) => linha.tempo === 'AGORA')) return 'AGORA'
  if (linhas.some((linha) => linha.tempo === 'ADIANTE')) return 'ADIANTE'
  return 'PASSADO'
}

export function rondasPorTempo(rondas: readonly RondaDaPrancheta[]) {
  const partes: Record<TempoDaRonda, RondaDaPrancheta[]> = { AGORA: [], ADIANTE: [], PASSADO: [] }
  for (const ronda of rondas) partes[tempoDaRonda(ronda)].push(ronda)
  return partes
}

/**
 * Os ids que "marcar a ronda" manda: **só os que a tela mostrou**, pendentes e já na janela (ou
 * atrasados). Medicação nunca (`aceitaLote: false`), e ronda de uma linha só não precisa de lote.
 * Vazio quando a ronda não oferece o botão.
 */
export function idsParaARonda(ronda: RondaDaPrancheta) {
  if (!ronda.aceitaLote || ronda.kind === 'MEDICACAO') return []
  const pendentes = linhasDaRonda(ronda).filter((linha) => linha.status === 'PENDENTE')
  if (pendentes.length < 2) return []
  if (pendentes.some((linha) => linha.tempo !== 'AGORA')) return []
  return pendentes.map((linha) => linha.id)
}

/** A API aceita de 1 a 60 ids por ronda: a ronda maior vai em lotes, um depois do outro. */
export function emLotes<T>(itens: readonly T[], tamanho: number) {
  const lotes: T[][] = []
  for (let i = 0; i < itens.length; i += tamanho) lotes.push(itens.slice(i, i + tamanho))
  return lotes
}

/** O mapa de tarefas por id, para achar a do `focoId` de cada hóspede. */
export function tarefasPorId(rondas: readonly RondaDaPrancheta[]) {
  return new Map(
    rondas.flatMap((ronda) => linhasDaRonda(ronda)).map((linha) => [linha.id, linha] as const),
  )
}

export const REGISTRADAS = new Set(['FEITA', 'RECUSADA', 'PULADA'])

/** Uma linha que ainda pede registro (pendente, na janela, atrasada ou futura). */
export function pedeRegistro(tarefa: Pick<TarefaDaPrancheta, 'status'>) {
  return tarefa.status === 'PENDENTE'
}

/**
 * Quem pode desfazer: só quem registrou, em até 12 h (o turno a API confere). A linha da prancheta
 * traz o nome da ficha de quem registrou e não o id (lacuna N38): a tela compara com o nome da
 * ficha da sessão e deixa a API dizer `DESFAZER_NEGADO` no caso raro de dois nomes iguais.
 */
export function podeDesfazerTarefa(
  tarefa: Pick<TarefaDaPrancheta, 'status' | 'executadaPorNome' | 'executadaEm'>,
  meuNome: string | null | undefined,
  agoraMs: number,
) {
  if (!REGISTRADAS.has(tarefa.status)) return false
  if (!meuNome || tarefa.executadaPorNome !== meuNome) return false
  if (!tarefa.executadaEm) return false
  const quando = Date.parse(tarefa.executadaEm)
  return Number.isFinite(quando) && agoraMs - quando < 12 * 3600 * 1000
}

/** Os hóspedes com a rotina parada vêm primeiro (a API já ordena); o tom do cartão. */
export function tomDoHospede(hospede: Pick<HospedeDaPrancheta, 'urgencia'>) {
  if (hospede.urgencia === 'URGENTE') return 'risco'
  if (hospede.urgencia === 'ATENCAO') return 'atencao'
  return ''
}

/* ------------------------------------------------------------------------------- horários */

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/

export type HorariosLidos = { horarios: string[]; erro: '' | 'FORMATO' | 'DEMAIS' }

/**
 * "07:00, 12:00 18:00" → `['07:00', '12:00', '18:00']`: repetidos saem e a lista volta ordenada,
 * como a API grava. `9:00` e `24:00` não passam (a API dá 400). Mais de `maximo`, erro.
 */
export function lerHorarios(texto: string, maximo = 12): HorariosLidos {
  const partes = texto
    .split(/[\s,;]+/)
    .map((parte) => parte.trim())
    .filter(Boolean)
  if (partes.some((parte) => !HORA.test(parte))) return { horarios: [], erro: 'FORMATO' }
  const horarios = [...new Set(partes)].sort()
  if (horarios.length > maximo) return { horarios, erro: 'DEMAIS' }
  return { horarios, erro: '' }
}

export function escreverHorarios(horarios: readonly string[]) {
  return horarios.join(', ')
}

/* ---------------------------------------------------------------------------- ocorrências */

/**
 * A R3 na tela: a GRAVE sem contato de verdade ainda pede a ligação (o `SEM_RESPOSTA` libera a
 * passagem e o check-out, mas o boletim continua retido até o contato).
 */
export function pedeLigacao(ocorrencia: Pick<Ocorrencia, 'exigeContato' | 'semContato'>) {
  return ocorrencia.exigeContato && ocorrencia.semContato
}

/**
 * Descer uma GRAVE: só antes da primeira tentativa de ligação e nunca depois do contato ou do
 * `SEM_RESPOSTA`. A permissão (gestor ou dono) a tela confere à parte.
 */
export function podeRebaixarGrave(
  ocorrencia: Pick<Ocorrencia, 'gravidade' | 'tentativas' | 'contato' | 'semResposta'>,
) {
  return (
    ocorrencia.gravidade === 'GRAVE' &&
    ocorrencia.tentativas === 0 &&
    !ocorrencia.contato &&
    !ocorrencia.semResposta
  )
}

/** As graves que seguram a passagem primeiro; dentro de cada parte, a ordem da API. */
export function ocorrenciasNaOrdem<T extends Pick<Ocorrencia, 'travaAPassagem' | 'semContato'>>(
  lista: readonly T[],
) {
  const peso = (item: T) => (item.travaAPassagem ? 0 : item.semContato ? 1 : 2)
  return lista
    .map((item, indice) => ({ item, indice }))
    .sort((a, b) => peso(a.item) - peso(b.item) || a.indice - b.indice)
    .map(({ item }) => item)
}
