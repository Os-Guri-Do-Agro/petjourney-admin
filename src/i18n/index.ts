import { createI18n } from 'vue-i18n'

import ar from '@/locales/ar.json'
import en from '@/locales/en.json'
import enGB from '@/locales/en-GB.json'
import es from '@/locales/es.json'
import pt from '@/locales/pt.json'
import sr from '@/locales/sr.json'

import { DEFAULT_LOCALE, HTML_LANG, isRTLLocale, type Locale } from './locales'
import { PLURAL_RULES } from './plural'
import { getInitialLocale, setStoredLocale } from './resolve'

const i18n = createI18n({
  legacy: false,
  locale: getInitialLocale(),
  /* Quem lê sérvio ou árabe entende inglês, não português. */
  fallbackLocale: {
    sr: ['en', DEFAULT_LOCALE],
    ar: ['en', DEFAULT_LOCALE],
    default: [DEFAULT_LOCALE],
  },
  messages: {
    pt,
    en,
    'en-GB': enGB,
    es,
    sr,
    ar,
  },
  pluralRules: PLURAL_RULES,
  missingWarn: false,
  fallbackWarn: false,
})

/** `<html lang dir>`: o `dir` espelha o layout inteiro no árabe, sem recarregar. */
function applyDocumentLocale(locale: Locale) {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.lang = HTML_LANG[locale]
  document.documentElement.dir = isRTLLocale(locale) ? 'rtl' : 'ltr'

  /*
   * O rótulo do "marcar todos" do MultiSelect, para o CSS.
   *
   * O PrimeVue desenha aquele primeiro item só com a caixa de seleção, sem texto: no meio de uma
   * lista de serviços, a linha em branco parece opção quebrada, não "todos". O componente não
   * aceita rótulo por prop, e o slot `header` renderiza **acima** da linha, então o texto viria
   * como título de seção em vez de etiqueta da caixa.
   *
   * Publicar aqui resolve os quatro MultiSelect do projeto de uma vez e segue a troca de idioma,
   * que é justamente o que esta função já existe para fazer. `JSON.stringify` entrega a string
   * entre aspas, que é a forma que o `content` do CSS exige.
   */
  document.documentElement.style.setProperty(
    '--rotulo-marcar-todos',
    JSON.stringify(i18n.global.t('common.selectAll')),
  )
}

export async function changeLocale(locale: Locale) {
  i18n.global.locale.value = locale
  setStoredLocale(locale)
  applyDocumentLocale(locale)
}

export function syncDocumentLang() {
  applyDocumentLocale(i18n.global.locale.value as Locale)
}

export default i18n
