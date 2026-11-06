/**
 * A agenda do dia lida da API (E3-02, guia e3 seção 2) em coisas que a grade desenha.
 *
 * Nada aqui decide regra de agenda: conflito, carga e sugestão chegam prontos do servidor. O que
 * fica no front é apresentação: em que minuto da parede da clínica cada coisa cai, em que coluna, e
 * as faixas lado a lado quando dois cartões dividem o horário (`layoutSpans`, o mesmo da
 * demonstração, que o guia manda manter).
 */
import { layoutSpans } from '@/features/clinico/domain/overlap'
import type { OcorrenciaDeBloqueio } from '@/service/parceiro/agenda-config-service'
import type {
  AgendaDoDia,
  Agendamento,
  Agrupamento,
  ColunaDaAgenda,
  Conflito,
  Destino,
  Mutacao,
  ReservaNaAgenda,
} from '@/service/parceiro/agenda-service'

/* ------------------------------------------------------------------------------- minutos */

/** `HH:mm` → minutos do dia. */
export function minutosDe(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

/** Minutos do dia → `HH:mm`. */
export function horaDe(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** O instante com offset lido na parede da clínica, pelo próprio texto (o offset é o dela). */
export function minutosDoInstante(iso: string): number {
  const partes = /T(\d{2}):(\d{2})/.exec(iso)
  return partes ? Number(partes[1]) * 60 + Number(partes[2]) : 0
}

/** O trecho de um instante a outro dentro do dia `data`: o que começa antes vem da meia-noite. */
export function trechoNoDia(data: string, inicio: string, fim: string) {
  const comecaHoje = inicio.slice(0, 10) === data
  const terminaHoje = fim.slice(0, 10) === data
  return {
    inicioMin: comecaHoje ? minutosDoInstante(inicio) : 0,
    fimMin: terminaHoje ? minutosDoInstante(fim) : 24 * 60,
  }
}

/** No passo da grade (a granularidade da política): o arraste e o clique caem em horário cheio. */
export function noPasso(minutos: number, passo: number): number {
  const p = passo > 0 ? passo : 5
  return Math.max(0, Math.min(24 * 60 - p, Math.round(minutos / p) * p))
}

/** `AAAA-MM-DD` mais `n` dias, pelo calendário (sem fuso). */
export function somarDias(data: string, n: number): string {
  const [ano, mes, dia] = data.split('-').map(Number)
  return new Date(Date.UTC(ano!, mes! - 1, dia! + n)).toISOString().slice(0, 10)
}

/** A segunda-feira da semana de `data` (a semana da API vai de segunda a domingo). */
export function segundaDe(data: string): string {
  const [ano, mes, dia] = data.split('-').map(Number)
  const diaDaSemana = new Date(Date.UTC(ano!, mes! - 1, dia!)).getUTCDay()
  return somarDias(data, -((diaDaSemana + 6) % 7))
}

/** As horas e os minutos de um instante na parede de um fuso (`agora`, `confirmadoEm`...). */
function partesNoFuso(instante: Date, fuso: string) {
  try {
    const partes = new Intl.DateTimeFormat('en-GB', {
      timeZone: fuso,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(instante)
    const valor = (tipo: string) => Number(partes.find((parte) => parte.type === tipo)?.value ?? 0)
    return { h: valor('hour'), m: valor('minute') }
  } catch {
    return { h: instante.getHours(), m: instante.getMinutes() }
  }
}

/** Os minutos de agora na parede da clínica: a linha do "agora" na grade. */
export function minutosAgoraNoFuso(fuso: string, agora = new Date()): number {
  const { h, m } = partesNoFuso(agora, fuso)
  return h * 60 + m
}

/** `HH:mm` de um instante na parede da clínica, venha ele com offset ou em UTC. */
export function horaNoFuso(iso: string, fuso: string): string {
  const { h, m } = partesNoFuso(new Date(iso), fuso)
  return horaDe(h * 60 + m)
}

/* -------------------------------------------------------------------------------- janela */

/**
 * O pedaço do dia que a grade mostra: o expediente (ou 08:00 às 18:00), esticado para caber todo
 * agendamento e toda faixa de profissional, em horas cheias.
 */
export function janelaDoDia(dia: AgendaDoDia): { inicio: number; fim: number } {
  let inicio = dia.expediente ? minutosDe(dia.expediente.inicio) : 8 * 60
  let fim = dia.expediente ? minutosDe(dia.expediente.fim) : 18 * 60

  for (const profissional of dia.profissionais) {
    for (const faixa of profissional.faixas) {
      inicio = Math.min(inicio, minutosDe(faixa.inicio))
      fim = Math.max(fim, minutosDe(faixa.fim))
    }
  }

  for (const agendamento of dia.agendamentos) {
    const trecho = trechoNoDia(dia.data, agendamento.inicio, agendamento.fim)
    inicio = Math.min(inicio, trecho.inicioMin)
    fim = Math.max(fim, trecho.fimMin)
  }

  return {
    inicio: Math.max(0, Math.floor(inicio / 60) * 60),
    fim: Math.min(24 * 60, Math.max(Math.ceil(fim / 60) * 60, Math.floor(inicio / 60) * 60 + 60)),
  }
}

/* ------------------------------------------------------------------------------- colunas */

/** O agendamento mora na coluna: por profissional, o dele; por sala, cada sala dele. */
export function estaNaColuna(agendamento: Agendamento, coluna: ColunaDaAgenda): boolean {
  return coluna.tipo === 'PROFISSIONAL'
    ? agendamento.profissionalId === coluna.id
    : agendamento.salaIds.includes(coluna.id)
}

/**
 * Por profissional, o atendimento em duas salas aparece uma vez (a perna principal, cujo id é o
 * `grupoId`): as pernas têm o mesmo horário e o mesmo profissional. Por sala, cada perna na sua.
 */
function visivelNoAgrupamento(agendamento: Agendamento, agrupar: Agrupamento) {
  if (agrupar === 'SALA' || !agendamento.grupoId) return true
  return agendamento.grupoId === agendamento.id
}

export type CartaoNaGrade = {
  agendamento: Agendamento
  inicioMin: number
  fimMin: number
  /** A faixa ocupada (0 em diante) e quantas dividem a largura da coluna. */
  faixa: number
  faixas: number
}

/** Cancelado e falta ficam no dia, riscados; com `ocultarEncerrados`, saem da grade. */
export const STATUS_RISCADOS: readonly Agendamento['status'][] = ['CANCELADO', 'FALTA']

export function cartoesDaColuna(
  dia: AgendaDoDia,
  coluna: ColunaDaAgenda,
  opcoes: { ocultarRiscados?: boolean } = {},
): CartaoNaGrade[] {
  const daColuna = dia.agendamentos.filter(
    (agendamento) =>
      estaNaColuna(agendamento, coluna) &&
      visivelNoAgrupamento(agendamento, dia.agrupar) &&
      !(opcoes.ocultarRiscados && STATUS_RISCADOS.includes(agendamento.status)),
  )

  const porId = new Map(daColuna.map((agendamento) => [agendamento.id, agendamento]))
  const trechos = daColuna.map((agendamento) => ({
    id: agendamento.id,
    ...(({ inicioMin, fimMin }) => ({ inicioMin, fimMin: Math.max(fimMin, inicioMin + 5) }))(
      trechoNoDia(dia.data, agendamento.inicio, agendamento.fim),
    ),
  }))

  return layoutSpans(trechos)
    .map((layout) => ({
      agendamento: porId.get(layout.id)!,
      inicioMin: layout.inicioMin,
      fimMin: layout.fimMin,
      faixa: layout.lane,
      faixas: layout.lanes,
    }))
    .sort((a, b) => a.inicioMin - b.inicioMin || a.faixa - b.faixa)
}

export type FaixaDeFundo = {
  inicioMin: number
  fimMin: number
  tipo: 'bloqueio' | 'fora' | 'reserva'
  bloqueio?: OcorrenciaDeBloqueio
  reserva?: ReservaNaAgenda
}

/**
 * O bloqueio vale para a coluna: o da clínica toda vale para todas; o do profissional, na coluna
 * dele; o da sala, na coluna da sala (por profissional, o de sala não pesa: guia 2.3).
 */
export function bloqueioNaColuna(bloqueio: OcorrenciaDeBloqueio, coluna: ColunaDaAgenda): boolean {
  if (!bloqueio.profissionalId && !bloqueio.salaId) return true
  return coluna.tipo === 'PROFISSIONAL'
    ? bloqueio.profissionalId === coluna.id
    : bloqueio.salaId === coluna.id
}

/**
 * O que fica atrás dos cartões na coluna: o fora do expediente do profissional, os bloqueios e os
 * horários segurados por pedido online ou oferta da fila.
 */
export function fundoDaColuna(
  dia: AgendaDoDia,
  coluna: ColunaDaAgenda,
  janela: { inicio: number; fim: number },
): FaixaDeFundo[] {
  const fundo: FaixaDeFundo[] = []

  if (coluna.tipo === 'PROFISSIONAL') {
    const profissional = dia.profissionais.find((item) => item.id === coluna.id)
    const faixas = (profissional?.trabalhaNoDia ? profissional.faixas : [])
      .map((faixa) => ({ inicio: minutosDe(faixa.inicio), fim: minutosDe(faixa.fim) }))
      .sort((a, b) => a.inicio - b.inicio)

    let cursor = janela.inicio
    for (const faixa of faixas) {
      if (faixa.inicio > cursor)
        fundo.push({ inicioMin: cursor, fimMin: faixa.inicio, tipo: 'fora' })
      cursor = Math.max(cursor, faixa.fim)
    }
    if (cursor < janela.fim) fundo.push({ inicioMin: cursor, fimMin: janela.fim, tipo: 'fora' })

    for (const reserva of dia.reservas.filter((item) => item.profissionalId === coluna.id)) {
      fundo.push({
        ...trechoNoDia(dia.data, reserva.inicio, reserva.fim),
        tipo: 'reserva',
        reserva,
      })
    }
  }

  for (const bloqueio of dia.bloqueios.filter((item) => bloqueioNaColuna(item, coluna))) {
    fundo.push({
      ...trechoNoDia(dia.data, bloqueio.inicio, bloqueio.fim),
      tipo: 'bloqueio',
      bloqueio,
    })
  }

  return fundo
    .map((item) => ({
      ...item,
      inicioMin: Math.max(item.inicioMin, janela.inicio),
      fimMin: Math.min(item.fimMin, janela.fim),
    }))
    .filter((item) => item.fimMin > item.inicioMin)
}

/* -------------------------------------------------------------------------------- mover */

/**
 * O destino tipado do arraste (guia 2.7). Por profissional, o profissional da coluna onde caiu; por
 * sala, troca só a sala da coluna de onde saiu pela da coluna onde caiu (nunca o profissional).
 * Mesma coluna: sem destino, só o horário muda.
 */
export function destinoDoArraste(
  agendamento: Pick<Agendamento, 'profissionalId'>,
  origem: ColunaDaAgenda,
  destino: ColunaDaAgenda,
): Destino | undefined {
  if (origem.tipo !== destino.tipo || origem.id === destino.id) return undefined
  if (destino.tipo === 'PROFISSIONAL') {
    return destino.id === agendamento.profissionalId ? undefined : { profissionalId: destino.id }
  }
  return { trocarSala: { de: origem.id, para: destino.id } }
}

/* ------------------------------------------------------------------------------ mutação */

/**
 * A resposta de uma escrita aplicada no que a tela tem, antes de reler: os agendamentos que voltaram
 * trocam os de mesmo id (se ainda cabem no período da tela) e os `removidos` saem. A releitura que
 * vem logo depois traz os avisos dos outros cartões.
 */
export function aplicarMutacao<T extends { agendamentos: Agendamento[] }>(
  lido: T,
  mutacao: Pick<Mutacao, 'agendamentos' | 'removidos'>,
  cabe: (agendamento: Agendamento) => boolean,
): T {
  const novos = new Map(mutacao.agendamentos.map((agendamento) => [agendamento.id, agendamento]))
  const sai = new Set(mutacao.removidos)

  const ficam = lido.agendamentos
    .filter((agendamento) => !sai.has(agendamento.id))
    .map((agendamento) => novos.get(agendamento.id) ?? agendamento)
    .filter((agendamento) => !novos.has(agendamento.id) || cabe(agendamento))
  const vistos = new Set(ficam.map((agendamento) => agendamento.id))
  const entram = mutacao.agendamentos.filter(
    (agendamento) => !vistos.has(agendamento.id) && !sai.has(agendamento.id) && cabe(agendamento),
  )

  return { ...lido, agendamentos: [...ficam, ...entram] }
}

/** O agendamento toca o dia: começa, termina ou atravessa. */
export function tocaODia(agendamento: Pick<Agendamento, 'inicio' | 'fim'>, data: string): boolean {
  return agendamento.inicio.slice(0, 10) <= data && agendamento.fim.slice(0, 10) >= data
}

/* ----------------------------------------------------------------------------- conflitos */

const PESO: Record<Conflito['severity'], number> = { blocking: 3, warning: 2, info: 1 }

/** O mais grave primeiro: o bloqueante, os avisos, as informações. */
export function ordenarConflitos(conflitos: readonly Conflito[]): Conflito[] {
  return [...conflitos].sort((a, b) => PESO[b.severity] - PESO[a.severity])
}

export function severidadeMaxima(conflitos: readonly Conflito[]): Conflito['severity'] | null {
  return ordenarConflitos(conflitos)[0]?.severity ?? null
}

/** Os tipos que mudam de frase pelo `motivo` (sem motivo, a frase `padrao`). */
const PELO_MOTIVO: readonly Conflito['kind'][] = ['outside-hours', 'type-room-mismatch']

/** A chave da frase do conflito. */
export function chaveDoConflito(conflito: Conflito): string {
  if (PELO_MOTIVO.includes(conflito.kind)) {
    const motivo = typeof conflito.params.motivo === 'string' ? conflito.params.motivo : 'padrao'
    return `agendamentos.conflito.${conflito.kind}.${motivo}`
  }
  return `agendamentos.conflito.${conflito.kind}`
}
