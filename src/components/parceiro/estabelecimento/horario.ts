/**
 * Regras e leitura dos horários do estabelecimento (E1-01), sem tela.
 *
 * Horário é "de parede": `HH:mm` no fuso do estabelecimento. `24:00` só vale como fim (expediente
 * de 24 h é `00:00` a `24:00`), e o dia que atravessa a meia-noite se escreve como dois dias. A
 * conferência é a mesma da API (`regras/horario.ts`), para o erro aparecer no dia certo antes de
 * enviar; a API confere de novo.
 *
 * Os instantes que a API devolve (`fechaEm`, `proximaAbertura`) já vêm com o offset do fuso do
 * estabelecimento: a hora é lida do próprio texto, sem converter para o fuso do navegador.
 */
import type { HorarioDoDia } from '@/service/parceiro/estabelecimento-service'

export type ProblemaDeHorario =
  | 'HORA_INVALIDA'
  | 'ABRE_E_FECHA_OBRIGATORIOS'
  | 'ABRE_DEPOIS_DE_FECHA'
  | 'INTERVALO_INCOMPLETO'
  | 'INTERVALO_FORA_DO_EXPEDIENTE'
  | 'SEMANA_INCOMPLETA'

/** De domingo (0) a sábado (6), como a API conta. */
export const DIAS_DA_SEMANA = [0, 1, 2, 3, 4, 5, 6] as const

const INICIO = /^([01]\d|2[0-3]):[0-5]\d$/
const FIM = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/

function minutos(hora: string) {
  const [hh, mm] = hora.split(':').map(Number)

  return (hh ?? 0) * 60 + (mm ?? 0)
}

/** O que está errado num dia, ou `null`. A mesma régua para o dia da semana e o dia especial. */
export function problemaNoDia(dia: {
  fechado: boolean
  abre: string | null
  fecha: string | null
  intervaloInicio?: string | null
  intervaloFim?: string | null
}): ProblemaDeHorario | null {
  if (dia.fechado) return null
  if (!dia.abre || !dia.fecha) return 'ABRE_E_FECHA_OBRIGATORIOS'
  if (!INICIO.test(dia.abre) || !FIM.test(dia.fecha)) return 'HORA_INVALIDA'
  if (minutos(dia.abre) >= minutos(dia.fecha)) return 'ABRE_DEPOIS_DE_FECHA'

  const inicio = dia.intervaloInicio || null
  const fim = dia.intervaloFim || null

  if (!inicio && !fim) return null
  if (!inicio || !fim) return 'INTERVALO_INCOMPLETO'
  if (!INICIO.test(inicio) || !FIM.test(fim)) return 'HORA_INVALIDA'
  if (minutos(inicio) >= minutos(fim)) return 'ABRE_DEPOIS_DE_FECHA'
  if (minutos(inicio) <= minutos(dia.abre) || minutos(fim) >= minutos(dia.fecha)) {
    return 'INTERVALO_FORA_DO_EXPEDIENTE'
  }

  return null
}

/** A semana como a API guarda: os 7 dias, na ordem, com um dia fechado para o que faltar. */
export function semanaCompleta(horarios: readonly HorarioDoDia[]): HorarioDoDia[] {
  return DIAS_DA_SEMANA.map(
    (diaSemana) =>
      horarios.find((dia) => dia.diaSemana === diaSemana) ?? {
        diaSemana,
        fechado: true,
        abre: null,
        fecha: null,
        intervaloInicio: null,
        intervaloFim: null,
      },
  )
}

/** Há algum horário de verdade, ou a semana é só o "fechado" de quando nada foi cadastrado. */
export function temHorario(horarios: readonly HorarioDoDia[]) {
  return horarios.some((dia) => !dia.fechado)
}

/**
 * As faixas de um dia aberto: "08:00–18:00", ou "08:00–12:00" e "14:00–18:00" com intervalo.
 * O traço é o de intervalo (–), sem espaço, como em qualquer horário de funcionamento.
 */
export function faixasDoDia(dia: {
  fechado: boolean
  abre: string | null
  fecha: string | null
  intervaloInicio?: string | null
  intervaloFim?: string | null
}): string[] {
  if (dia.fechado || !dia.abre || !dia.fecha) return []

  if (dia.intervaloInicio && dia.intervaloFim) {
    return [`${dia.abre}–${dia.intervaloInicio}`, `${dia.intervaloFim}–${dia.fecha}`]
  }

  return [`${dia.abre}–${dia.fecha}`]
}

/** A hora de parede de um instante que a API mandou com offset (`2026-10-21T18:00:00-04:00`). */
export function horaDoInstante(iso: string) {
  return /T(\d{2}:\d{2})/.exec(iso)?.[1] ?? ''
}

/** O dia de parede do mesmo instante, `AAAA-MM-DD`. */
export function dataDoInstante(iso: string) {
  return iso.slice(0, 10)
}

/** `AAAA-MM-DD` como data do calendário, sem fuso: meio-dia em UTC não vira o dia anterior. */
export function dataCivil(data: string) {
  return new Date(`${data}T12:00:00Z`)
}

/** A data de hoje no fuso dado, `AAAA-MM-DD`. */
export function hojeNoFuso(fuso: string, agora = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: fuso,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(agora)
  } catch {
    return agora.toISOString().slice(0, 10)
  }
}

/** O offset do fuso agora, como "UTC−04:00". Fuso desconhecido: vazio. */
export function offsetDoFuso(fuso: string, agora = new Date()) {
  try {
    const partes = new Intl.DateTimeFormat('en-US', {
      timeZone: fuso,
      timeZoneName: 'longOffset',
    }).formatToParts(agora)
    const nome = partes.find((parte) => parte.type === 'timeZoneName')?.value ?? ''

    if (nome === 'GMT') return 'UTC+00:00'

    return nome.replace('GMT', 'UTC').replace('-', '−')
  } catch {
    return ''
  }
}

/** Os fusos IANA que o navegador conhece. A API aceita os mesmos nomes. */
export function fusosDisponiveis(): string[] {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (chave: string) => string[] }

  try {
    return intl.supportedValuesOf?.('timeZone') ?? []
  } catch {
    return []
  }
}

/** O fuso do navegador, para sugerir no primeiro salvamento. */
export function fusoDoNavegador() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo'
  } catch {
    return 'America/Sao_Paulo'
  }
}

/** "America/Sao_Paulo" para ler: "America/Sao Paulo". */
export function nomeDoFuso(fuso: string) {
  return fuso.replace(/_/g, ' ')
}
