export const LOCALES = ['pt', 'en', 'en-GB', 'es'] as const

export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'pt'

export const INTL_LOCALE: Record<Locale, string> = {
  pt: 'pt-BR',
  en: 'en-US',
  'en-GB': 'en-GB',
  es: 'es',
}

export const STORAGE_KEY = 'APP_LOCALE'

export function isLocale(value: string | null | undefined): value is Locale {
  return (LOCALES as readonly string[]).includes(value ?? '')
}
