/**
 * A fila de espera na tela (E3-04), sem tela: os dias da semana no idioma da sessão e as janelas
 * que a API já devolve agrupadas ("seg. a sex. 14:00 a 18:00"). Nada de ordenar nem agrupar aqui:
 * a ordem e o agrupamento são do servidor.
 */
import type { FaixaDeJanelas } from '@/service/parceiro/fila-service'

/** Um domingo qualquer, para o nome do dia sair do `Intl`. */
const UM_DOMINGO = Date.UTC(2026, 9, 18, 12)

export function nomeDoDia(diaSemana: number, locale: string, formato: 'short' | 'long' = 'short') {
  const data = new Date(UM_DOMINGO + diaSemana * 24 * 60 * 60 * 1000)
  return new Intl.DateTimeFormat(locale, { weekday: formato, timeZone: 'UTC' }).format(data)
}

/** "seg. a sex. 14:00 a 18:00"; um dia só, "sáb. 08:00 a 12:00". */
export function textoDaFaixa(
  faixa: FaixaDeJanelas,
  locale: string,
  t: (chave: string, valores: Record<string, string>) => string,
) {
  const dias =
    faixa.de === faixa.ate
      ? nomeDoDia(faixa.de, locale)
      : t('fila.diasDe', { de: nomeDoDia(faixa.de, locale), ate: nomeDoDia(faixa.ate, locale) })

  return t('fila.faixa', { dias, inicio: faixa.inicio, fim: faixa.fim })
}

/** "Sex., 06/11 · 11:00" a partir do instante com offset, lido do próprio texto. */
export function quandoCurto(iso: string, locale: string) {
  const dia = iso.slice(0, 10)
  const hora = /T(\d{2}:\d{2})/.exec(iso)?.[1] ?? ''
  const texto = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(`${dia}T12:00:00Z`))

  return `${texto.charAt(0).toLocaleUpperCase(locale)}${texto.slice(1)} · ${hora}`
}
