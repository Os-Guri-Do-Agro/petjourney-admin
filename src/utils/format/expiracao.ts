export type TempoRestante =
  | { estado: 'invalido' }
  | { estado: 'expirado' }
  | { estado: 'dias'; dias: number; horas: number }
  | { estado: 'horas'; horas: number; minutos: number }
  | { estado: 'minutos'; minutos: number }

const TEM_FUSO = /(?:[zZ]|[+-]\d{2}:?\d{2})$/
const TEM_HORA = /\d{2}:\d{2}/

/**
 * A API grava em UTC e devolve com `Z`. Se algum dia vier sem designador de fuso,
 * `new Date()` leria como horário **local** e a contagem erraria pelo offset do usuário
 * (3h no Brasil, 9h no Japão). Normalizar para UTC mantém o mesmo instante em qualquer fuso.
 */
export function parseInstante(valor: string): number {
  const bruto = valor?.trim()

  if (!bruto) {
    return Number.NaN
  }

  const normalizado =
    TEM_HORA.test(bruto) && !TEM_FUSO.test(bruto) ? `${bruto.replace(' ', 'T')}Z` : bruto

  return new Date(normalizado).getTime()
}

/**
 * Tempo que falta até `expiraEm`. Trabalha com dois instantes absolutos, então o resultado
 * é o mesmo em qualquer fuso e atravessa horário de verão sem pular hora.
 *
 * Arredonda **para baixo** de propósito: num acesso que vai fechar, prometer mais tempo do
 * que existe é pior do que prometer menos.
 */
export function calcularTempoRestante(expiraEm: string, agoraMs: number): TempoRestante {
  const diffMs = parseInstante(expiraEm) - agoraMs

  if (Number.isNaN(diffMs)) {
    return { estado: 'invalido' }
  }

  if (diffMs <= 0) {
    return { estado: 'expirado' }
  }

  const totalMinutos = Math.floor(diffMs / 60_000)
  const dias = Math.floor(totalMinutos / 1440)
  const horas = Math.floor((totalMinutos % 1440) / 60)
  const minutos = totalMinutos % 60

  if (dias > 0) {
    return { estado: 'dias', dias, horas }
  }

  if (horas > 0) {
    return { estado: 'horas', horas, minutos }
  }

  /** Menos de 1 min ainda é acesso vivo: mostrar "0min" faria parecer encerrado. */
  return { estado: 'minutos', minutos: Math.max(minutos, 1) }
}
