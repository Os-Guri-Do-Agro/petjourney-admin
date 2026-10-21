/**
 * Bandeira e nome nativo de cada idioma, para os seletores (o do login, o das Configurações e a
 * lista do menu da conta).
 */
import flagAE from 'country-flag-icons/string/3x2/AE'
import flagBR from 'country-flag-icons/string/3x2/BR'
import flagES from 'country-flag-icons/string/3x2/ES'
import flagGB from 'country-flag-icons/string/3x2/GB'
import flagRS from 'country-flag-icons/string/3x2/RS'
import flagUS from 'country-flag-icons/string/3x2/US'

import type { Locale } from './locales'

export const BANDEIRA_DO_IDIOMA: Record<Locale, string> = {
  pt: flagBR,
  en: flagUS,
  'en-GB': flagGB,
  es: flagES,
  sr: flagRS,
  /* O árabe atende vários países: os Emirados representam o idioma no seletor. */
  ar: flagAE,
}

export const NOME_NATIVO_DO_IDIOMA: Record<Locale, string> = {
  pt: 'Português',
  en: 'English (US)',
  'en-GB': 'English (UK)',
  es: 'Español',
  sr: 'Srpski',
  ar: 'العربية',
}
