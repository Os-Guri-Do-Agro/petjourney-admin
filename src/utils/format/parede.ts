/**
 * Data e hora como a parede da clínica mostra. A API manda os instantes com o offset da clínica
 * (`2026-11-26T21:45:00-03:00`): os números do texto já são a hora dela. Formatar pelo `Date` usa o
 * fuso do computador, e quem está em outro fuso via a hora errada (26/11/2026: computador em Cuiabá,
 * clínica em São Paulo, a internação inteira uma hora atrás).
 *
 * O truque: ler os números do texto como se fossem UTC e formatar em UTC. Sem offset no texto (`Z`
 * ou nada), não há parede para ler: cai no fuso do computador, como antes.
 */

import { DEFAULT_LOCALE, INTL_LOCALE, isLocale } from '@/i18n/locales'

const COM_OFFSET = /[+-]\d{2}:\d{2}$/

/** A tag do `Intl` pelo mapa do projeto: o código cru (`sr`, `ar`) sai em cirílico ou com ٠١٢. */
export function intlDe(locale: string): string {
  return INTL_LOCALE[isLocale(locale) ? locale : DEFAULT_LOCALE]
}

/** O instante com os números da parede da clínica, para formatar com `timeZone: 'UTC'`. */
function paredeComoUtc(iso: string): Date | null {
  return COM_OFFSET.test(iso) ? new Date(`${iso.slice(0, 19)}Z`) : null
}

/** Formata `iso` na parede da clínica, com as opções do `Intl.DateTimeFormat`. */
export function formatarNaParede(
  iso: string,
  intl: string,
  opcoes: Intl.DateTimeFormatOptions,
): string {
  const parede = paredeComoUtc(iso)
  if (parede) return new Intl.DateTimeFormat(intl, { ...opcoes, timeZone: 'UTC' }).format(parede)
  return new Intl.DateTimeFormat(intl, opcoes).format(new Date(iso))
}

/** `HH:mm` na parede da clínica. */
export function horaNaParede(iso: string, intl: string): string {
  return formatarNaParede(iso, intl, { hour: '2-digit', minute: '2-digit' })
}
