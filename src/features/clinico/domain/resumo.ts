/**
 * Resumo da clínica: o que aconteceu no período.
 *
 * Todas as contas vivem aqui, longe da tela, por dois motivos. O primeiro é teste: número de
 * painel que ninguém consegue verificar é número que ninguém deveria mostrar. O segundo é
 * coerência — a taxa de comparecimento do cartão do topo e a barra do gráfico do meio saem da
 * **mesma** função, então não existe a situação clássica de dois lugares discordando na mesma
 * tela.
 *
 * Uma decisão que atravessa o arquivo: **cancelado não conta como falta**. Quem avisou que não
 * vem liberou o horário; quem não apareceu queimou. Somar os dois é o jeito mais rápido de
 * fazer a clínica desconfiar do painel inteiro.
 */

import type {
  Appointment,
  AppointmentType,
  Clinic,
  Encounter,
  ISODate,
  Professional,
} from '../data/types'

import { addDays, type ClinicClock, diffDays, isWeekend, weekdayOf } from './clinic-time'
import { cargaDoDia } from './load'
import { ocupaHorario } from './conflicts'

export const PERIODOS = ['hoje', 'semana', 'semana-passada', 'trinta-dias'] as const
export type PeriodoId = (typeof PERIODOS)[number]

export type ResumoFiltro = {
  periodo: PeriodoId
  professionalId: string | null
  typeId: string | null
}

export const FILTRO_RESUMO_PADRAO: ResumoFiltro = {
  periodo: 'semana',
  professionalId: null,
  typeId: null,
}

export type Intervalo = { inicio: ISODate; fim: ISODate }

/**
 * A semana começa na segunda.
 *
 * Domingo-como-primeiro-dia é convenção de calendário americano; clínica brasileira lê a semana
 * de segunda a domingo, e a barra de "sábado" precisa cair no fim do gráfico, não no começo.
 */
export function inicioDaSemana(data: ISODate): ISODate {
  const diaDaSemana = weekdayOf(data)
  const recuo = (diaDaSemana + 6) % 7

  return addDays(data, -recuo)
}

export function intervaloDoPeriodo(periodo: PeriodoId, ancora: ISODate): Intervalo {
  if (periodo === 'hoje') {
    return { inicio: ancora, fim: ancora }
  }

  if (periodo === 'trinta-dias') {
    return { inicio: addDays(ancora, -29), fim: ancora }
  }

  const segunda = inicioDaSemana(ancora)

  if (periodo === 'semana-passada') {
    return { inicio: addDays(segunda, -7), fim: addDays(segunda, -1) }
  }

  return { inicio: segunda, fim: addDays(segunda, 6) }
}

export function diasDoIntervalo(intervalo: Intervalo): ISODate[] {
  const total = diffDays(intervalo.inicio, intervalo.fim)
  const dias: ISODate[] = []

  for (let i = 0; i <= total; i += 1) {
    dias.push(addDays(intervalo.inicio, i))
  }

  return dias
}

export type ResumoIndicadores = {
  /** Atendimentos que chegaram ao fim. */
  finalizados: number
  /** Ainda por acontecer dentro do período — só faz sentido em período que alcança o futuro. */
  previstos: number
  faltas: number
  cancelados: number
  encaixes: number
  /** Finalizados sobre finalizados + faltas. Cancelado fica de fora de propósito. */
  comparecimento: number
  /** Média da ocupação dos dias em que a clínica abriu. */
  ocupacaoMedia: number
  horasAtendidas: number
  /** Pacientes cujo primeiro atendimento da base cai neste período. */
  novosPacientes: number
}

export type PontoDoDia = {
  data: ISODate
  finalizados: number
  previstos: number
  faltas: number
  cancelados: number
  ocupacao: number
  fechado: boolean
}

export type Fatia = {
  id: string
  rotulo: string
  valor: number
  /** Fração do total, de 0 a 1. */
  parte: number
}

export type CelulaDeHora = {
  weekday: number
  hora: number
  valor: number
}

export type ResumoDaClinica = {
  intervalo: Intervalo
  indicadores: ResumoIndicadores
  porDia: PontoDoDia[]
  porTipo: Fatia[]
  porProfissional: Fatia[]
  porOrigem: Fatia[]
  porHora: CelulaDeHora[]
  diagnosticos: Fatia[]
  /** Maior valor da grade de horários — a escala de cor do mapa sai daqui. */
  picoDaHora: number
}

export type EntradaDoResumo = {
  appointments: Appointment[]
  encounters: Encounter[]
  clinic: Clinic
  profissionais: Professional[]
  tipos: AppointmentType[]
  filtro: ResumoFiltro
  ancora: ISODate
  clock: ClinicClock
}

function fatiar(
  contagem: Map<string, number>,
  rotulo: (id: string) => string,
  limite = 0,
): Fatia[] {
  const total = [...contagem.values()].reduce((soma, valor) => soma + valor, 0)

  const fatias = [...contagem.entries()]
    .map(([id, valor]) => ({
      id,
      rotulo: rotulo(id),
      valor,
      parte: total > 0 ? valor / total : 0,
    }))
    .sort((a, b) => b.valor - a.valor)

  return limite > 0 ? fatias.slice(0, limite) : fatias
}

function incrementar(mapa: Map<string, number>, chave: string) {
  mapa.set(chave, (mapa.get(chave) ?? 0) + 1)
}

export function resumirClinica(entrada: EntradaDoResumo): ResumoDaClinica {
  const { appointments, encounters, clinic, profissionais, tipos, filtro, ancora, clock } = entrada

  const intervalo = intervaloDoPeriodo(filtro.periodo, ancora)
  const dias = diasDoIntervalo(intervalo)
  const diasNoIntervalo = new Set(dias)

  const noPeriodo = appointments.filter((appointment) => {
    const data = clock.dateOf(appointment.inicio)

    if (!diasNoIntervalo.has(data)) {
      return false
    }

    if (filtro.professionalId && appointment.professionalId !== filtro.professionalId) {
      return false
    }

    return !filtro.typeId || appointment.typeId === filtro.typeId
  })

  /*
   * A ocupação usa os profissionais do filtro, não os cinco da clínica.
   *
   * Filtrando por um profissional e dividindo pela capacidade de todos, a ocupação caía para um
   * quinto e o painel dizia "clínica vazia" no dia mais cheio da agenda de alguém.
   */
  const equipe = filtro.professionalId
    ? profissionais.filter((item) => item.id === filtro.professionalId)
    : profissionais

  const porDia: PontoDoDia[] = dias.map((data) => {
    const doDia = noPeriodo.filter((item) => clock.dateOf(item.inicio) === data)
    const carga = cargaDoDia(data, doDia, clinic, equipe, clock)
    const feriado = clinic.feriados.some((item) => item.date === data)

    return {
      data,
      finalizados: doDia.filter((item) => item.status === 'finalizado').length,
      previstos: doDia.filter((item) =>
        ['agendado', 'confirmado', 'aguardando', 'em-atendimento'].includes(item.status),
      ).length,
      faltas: doDia.filter((item) => item.status === 'falta').length,
      cancelados: doDia.filter((item) => item.status === 'cancelado').length,
      ocupacao: carga.ocupacao,
      fechado: feriado || carga.capacidadeMinutos === 0,
    }
  })

  const abertos = porDia.filter((ponto) => !ponto.fechado)
  const finalizados = porDia.reduce((soma, ponto) => soma + ponto.finalizados, 0)
  const faltas = porDia.reduce((soma, ponto) => soma + ponto.faltas, 0)

  const minutosAtendidos = noPeriodo
    .filter((item) => item.status === 'finalizado')
    .reduce((soma, item) => soma + clock.durationMinutes(item.inicio, item.fim), 0)

  /** Primeiro atendimento de cada paciente **na base inteira**, não só no período. */
  const estreia = new Map<string, string>()

  for (const appointment of appointments) {
    const atual = estreia.get(appointment.petId)

    if (!atual || appointment.inicio < atual) {
      estreia.set(appointment.petId, appointment.inicio)
    }
  }

  const novosPacientes = [...estreia.values()].filter((inicio) =>
    diasNoIntervalo.has(clock.dateOf(inicio)),
  ).length

  const porTipoContagem = new Map<string, number>()
  const porProfissionalContagem = new Map<string, number>()
  const porOrigemContagem = new Map<string, number>()
  const porHoraContagem = new Map<string, number>()

  for (const appointment of noPeriodo) {
    if (appointment.status === 'cancelado') {
      continue
    }

    incrementar(porTipoContagem, appointment.typeId)
    incrementar(porProfissionalContagem, appointment.professionalId)
    incrementar(porOrigemContagem, appointment.origem)

    const data = clock.dateOf(appointment.inicio)
    const hora = Math.floor(clock.minutesOf(appointment.inicio) / 60)

    incrementar(porHoraContagem, `${weekdayOf(data)}:${hora}`)
  }

  const porHora: CelulaDeHora[] = [...porHoraContagem.entries()].map(([chave, valor]) => {
    const [weekday, hora] = chave.split(':').map(Number)

    return { weekday: weekday ?? 0, hora: hora ?? 0, valor }
  })

  const diagnosticosContagem = new Map<string, number>()

  for (const encounter of encounters) {
    const data = clock.dateOf(encounter.finalizadoEm ?? encounter.abertoEm)

    if (encounter.status !== 'finalizado' || !diasNoIntervalo.has(data)) {
      continue
    }

    if (filtro.professionalId && encounter.professionalId !== filtro.professionalId) {
      continue
    }

    const principal = encounter.diagnosticos[0]

    if (principal) {
      diagnosticosContagem.set(
        principal.descricao,
        (diagnosticosContagem.get(principal.descricao) ?? 0) + 1,
      )
    }
  }

  const nomeDoTipo = (id: string) => tipos.find((tipo) => tipo.id === id)?.nome ?? id
  const nomeDoProfissional = (id: string) =>
    profissionais.find((item) => item.id === id)?.nome ?? id

  return {
    intervalo,
    indicadores: {
      finalizados,
      previstos: porDia.reduce((soma, ponto) => soma + ponto.previstos, 0),
      faltas,
      cancelados: porDia.reduce((soma, ponto) => soma + ponto.cancelados, 0),
      encaixes: noPeriodo.filter((item) => item.encaixe && ocupaHorario(item)).length,
      comparecimento: finalizados + faltas > 0 ? finalizados / (finalizados + faltas) : 0,
      ocupacaoMedia:
        abertos.length > 0
          ? abertos.reduce((soma, ponto) => soma + ponto.ocupacao, 0) / abertos.length
          : 0,
      horasAtendidas: minutosAtendidos / 60,
      novosPacientes,
    },
    porDia,
    porTipo: fatiar(porTipoContagem, nomeDoTipo),
    porProfissional: fatiar(porProfissionalContagem, nomeDoProfissional),
    porOrigem: fatiar(porOrigemContagem, (id) => id),
    porHora,
    diagnosticos: fatiar(diagnosticosContagem, (id) => id, 6),
    picoDaHora: porHora.reduce((maior, celula) => Math.max(maior, celula.valor), 0),
  }
}

/**
 * Dias úteis do intervalo que ainda não aconteceram — usado para separar "o que foi" de "o que
 * vem" nos períodos que cruzam hoje.
 */
export function diasFuturos(intervalo: Intervalo, ancora: ISODate): ISODate[] {
  return diasDoIntervalo(intervalo).filter((data) => data > ancora && !isWeekend(data))
}
