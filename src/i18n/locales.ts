export const LOCALES = ['pt', 'en', 'en-GB', 'es', 'sr', 'ar'] as const

export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'pt'

/**
 * Tag usada no `Intl` (datas, números, ordenação).
 *
 * `sr-Latn-RS`: sem o `-Latn` o Intl formata o mês em cirílico ("септембар").
 * `ar-u-nu-latn`: dígitos 0-9, os mesmos da copy (sem o `-u-nu-latn` alguns motores usam ٠١٢).
 */
export const INTL_LOCALE: Record<Locale, string> = {
  pt: 'pt-BR',
  en: 'en-US',
  'en-GB': 'en-GB',
  es: 'es',
  sr: 'sr-Latn-RS',
  ar: 'ar-u-nu-latn',
}

/** Tag enviada à API (`Accept-Language`), no formato que o backend normaliza. */
export const API_LOCALE: Record<Locale, string> = {
  pt: 'pt-BR',
  en: 'en-US',
  'en-GB': 'en-GB',
  es: 'es',
  sr: 'sr-Latn',
  ar: 'ar',
}

/** Valor de `<html lang>`. */
export const HTML_LANG: Record<Locale, string> = {
  pt: 'pt-BR',
  en: 'en',
  'en-GB': 'en-GB',
  es: 'es',
  sr: 'sr-Latn',
  ar: 'ar',
}

/** Idiomas escritos da direita para a esquerda: o layout inteiro espelha. */
export const RTL_LOCALES: readonly Locale[] = ['ar']

export function isRTLLocale(locale: Locale): boolean {
  return RTL_LOCALES.includes(locale)
}

export const STORAGE_KEY = 'APP_LOCALE'

export function isLocale(value: string | null | undefined): value is Locale {
  return (LOCALES as readonly string[]).includes(value ?? '')
}
