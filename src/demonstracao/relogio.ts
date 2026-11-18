/**
 * O relógio da demonstração.
 *
 * A clínica de exemplo fica em São Paulo, no fuso de quem olha (ver `FUSO`). Clínica e agenda
 * montam o dia pela hora em que a página abre: às 21h todo mundo já foi atendido e a tela sai vazia.
 * Por isso, ao entrar, o relógio do navegador é deslocado para as **10:40 de hoje** (`?hora=HH:MM`
 * escolhe outra hora; `?hora=agora` deixa o relógio de verdade). O tempo continua andando a partir
 * dali. A hora escolhida fica gravada na aba (sessionStorage) até outra ser pedida.
 *
 * Todas as datas dos dados de exemplo saem daqui, relativas a esse "agora".
 */

const MINUTO = 60 * 1000

/*
 * O fuso da clínica de exemplo é o de quem olha: a tela mostra hora local em alguns pontos e a hora
 * da API em outros, e com fusos diferentes uma consulta das 10:00 apareceria às 09:00. O endereço
 * continua em São Paulo; o fuso acompanha o navegador (lido antes do deslocamento, que não o muda).
 */
const DESLOCAMENTO_DO_NAVEGADOR = -new Date().getTimezoneOffset()

export const FUSO = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo'
  } catch {
    return 'America/Sao_Paulo'
  }
})()

export const OFFSET = (() => {
  const sinal = DESLOCAMENTO_DO_NAVEGADOR < 0 ? '-' : '+'
  const total = Math.abs(DESLOCAMENTO_DO_NAVEGADOR)
  return `${sinal}${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
})()

const OFFSET_MS = DESLOCAMENTO_DO_NAVEGADOR * MINUTO
const DIA = 24 * 60 * MINUTO

export const HORA_PADRAO = '10:40'
const CHAVE_DA_HORA = 'pj.demonstracao.hora'

/* ------------------------------------------------------------------------- o deslocamento */

let instalado = false

function horaPedida(): string | null {
  let pedida: string | null = null

  try {
    pedida = new URLSearchParams(window.location.search).get('hora')
  } catch {
    pedida = null
  }

  try {
    if (pedida) {
      window.sessionStorage.setItem(CHAVE_DA_HORA, pedida)
      return pedida
    }
    return window.sessionStorage.getItem(CHAVE_DA_HORA)
  } catch {
    return pedida
  }
}

/**
 * Desloca o `Date` global para a hora da demonstração. Roda uma vez, antes do app montar: quem
 * cria `new Date()` depois já recebe a hora deslocada.
 */
export function instalarRelogio() {
  if (instalado || typeof window === 'undefined') return
  instalado = true

  const pedida = horaPedida() ?? HORA_PADRAO
  if (pedida === 'agora' || !/^\d{1,2}:\d{2}$/.test(pedida)) return

  const DataReal = Date
  const [h, m] = pedida.split(':').map(Number) as [number, number]
  const hojeReal = dataDe(new DataReal())
  const alvo = DataReal.parse(`${hojeReal}T${dois(h)}:${dois(m)}:00${OFFSET}`)
  const desvio = alvo - DataReal.now()

  class DataDaDemonstracao extends DataReal {
    constructor(...args: unknown[]) {
      if (args.length === 0) {
        super(DataReal.now() + desvio)
      } else {
        // @ts-expect-error repassa os argumentos do construtor original como vieram
        super(...args)
      }
    }

    static override now() {
      return DataReal.now() + desvio
    }
  }

  ;(globalThis as { Date: DateConstructor }).Date = DataDaDemonstracao as DateConstructor
}

/* ------------------------------------------------------------------------------ as contas */

function dois(n: number) {
  return String(n).padStart(2, '0')
}

/** O "agora" da demonstração. */
export function agora(): Date {
  return new Date()
}

/** O dia, `AAAA-MM-DD`, na hora da clínica. */
export function dataDe(instante: Date): string {
  return new Date(instante.getTime() + OFFSET_MS).toISOString().slice(0, 10)
}

/** A hora, `HH:MM`, na hora da clínica. */
export function horaDe(instante: Date): string {
  return new Date(instante.getTime() + OFFSET_MS).toISOString().slice(11, 16)
}

/** Hoje na clínica, `AAAA-MM-DD`. */
export function hoje(): string {
  return dataDe(agora())
}

/** `AAAA-MM-DD` mais `n` dias (negativo volta). */
export function somarDias(data: string, n: number): string {
  return new Date(Date.parse(`${data}T12:00:00Z`) + n * DIA).toISOString().slice(0, 10)
}

/** Dias de `de` até `ate` (positivo quando `ate` é depois). */
export function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / DIA)
}

/** 0 = domingo ... 6 = sábado. */
export function diaDaSemana(data: string): number {
  return new Date(`${data}T12:00:00Z`).getUTCDay()
}

/** O instante ISO com o fuso da clínica: `2026-11-18T10:40:00-03:00`. */
export function instante(data: string, hora: string): string {
  const [h = 0, m = 0] = hora.split(':').map(Number)
  return `${data}T${dois(h)}:${dois(m)}:00${OFFSET}`
}

/** Um `Date` escrito no fuso da clínica, como a API escreve. */
export function isoDe(quando: Date): string {
  const local = new Date(quando.getTime() + OFFSET_MS).toISOString()
  return `${local.slice(0, 19)}${OFFSET}`
}

/** O agora, no formato da API. */
export function agoraIso(): string {
  return isoDe(agora())
}

/** `iso` mais `minutos` (negativo volta), no formato da API. */
export function somarMinutos(iso: string, minutos: number): string {
  return isoDe(new Date(Date.parse(iso) + minutos * MINUTO))
}

/** Minutos do dia (0 a 1439) de um `HH:MM`. */
export function minutosDe(hora: string): number {
  const [h = 0, m = 0] = hora.split(':').map(Number)
  return h * 60 + m
}

/** `HH:MM` de minutos do dia. */
export function horaDosMinutos(minutos: number): string {
  return `${dois(Math.floor(minutos / 60))}:${dois(minutos % 60)}`
}

/** Minutos de agora até `iso` (negativo quando já passou). */
export function minutosAte(iso: string): number {
  return Math.round((Date.parse(iso) - agora().getTime()) / MINUTO)
}

/** Antes de agora. */
export function jaPassou(iso: string): boolean {
  return Date.parse(iso) <= agora().getTime()
}
