import { createI18n } from 'vue-i18n'

import en from '@/locales/en.json'
import enGB from '@/locales/en-GB.json'
import es from '@/locales/es.json'
import pt from '@/locales/pt.json'

import { DEFAULT_LOCALE, type Locale } from './locales'
import { getInitialLocale, setStoredLocale } from './resolve'

const i18n = createI18n({
  legacy: false,
  locale: getInitialLocale(),
  fallbackLocale: DEFAULT_LOCALE,
  messages: {
    pt,
    en,
    'en-GB': enGB,
    es,
  },
  missingWarn: false,
  fallbackWarn: false,
})

export async function changeLocale(locale: Locale) {
  i18n.global.locale.value = locale
  setStoredLocale(locale)

  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale === 'pt' ? 'pt-BR' : locale
  }
}

export function syncDocumentLang() {
  const locale = i18n.global.locale.value as Locale
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale === 'pt' ? 'pt-BR' : locale
  }
}

export default i18n
