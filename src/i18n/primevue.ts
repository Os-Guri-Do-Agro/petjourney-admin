/**
 * O PrimeVue falando o idioma do portal.
 *
 * Sem isto, os textos que o próprio PrimeVue escreve ficavam no inglês de fábrica numa tela em
 * português: "No results found" na busca de paciente, "October" e "Su Mo Tu" no calendário,
 * "Close" no leitor de tela de todo diálogo. Cada um é pequeno; juntos, dizem que a tela foi
 * montada e não traduzida.
 *
 * Os nomes de mês e de dia saem do `Intl`, na mesma tag que formata as datas do portal — assim
 * o calendário e a data escrita ao lado nunca discordam. As mensagens saem do `vue-i18n`, em
 * `primevue.*`, e seguem a troca de idioma sem recarregar.
 */
import type { App } from 'vue'
import { watch } from 'vue'

import i18n from './index'
import { INTL_LOCALE, type Locale } from './locales'

/** Primeira letra maiúscula: o `Intl` devolve "outubro", e o cabeçalho do calendário é título. */
function capitalizar(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase() + texto.slice(1)
}

/** "out." vira "out": o ponto da abreviação sobra numa grade de dias. */
function semPonto(texto: string): string {
  return texto.replace(/\.$/, '')
}

function nomes(tag: string) {
  const meses = Array.from({ length: 12 }, (_, mes) => new Date(Date.UTC(2024, mes, 15)))
  // 7 de janeiro de 2024 foi um domingo: o PrimeVue espera a semana começando no domingo.
  const dias = Array.from({ length: 7 }, (_, dia) => new Date(Date.UTC(2024, 0, 7 + dia)))
  const formatar = (opcoes: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(tag, { ...opcoes, timeZone: 'UTC' })

  const mesLongo = formatar({ month: 'long' })
  const mesCurto = formatar({ month: 'short' })
  const diaLongo = formatar({ weekday: 'long' })
  const diaCurto = formatar({ weekday: 'short' })

  const abreviados = dias.map((data) => capitalizar(semPonto(diaCurto.format(data))))

  return {
    monthNames: meses.map((data) => capitalizar(mesLongo.format(data))),
    monthNamesShort: meses.map((data) => capitalizar(semPonto(mesCurto.format(data)))),
    dayNames: dias.map((data) => capitalizar(diaLongo.format(data))),
    dayNamesShort: abreviados,
    dayNamesMin: abreviados,
  }
}

/**
 * A ordem da data digitada, no formato do PrimeVue (`yy` é o ano com quatro dígitos).
 *
 * Sem isto o calendário ficava no `mm/dd/yy` de fábrica em todo idioma: 7 de outubro aparecia
 * como "10/07/2026" numa tela em português, e a validade de um lote digitada como se lê no frasco
 * entrava trocada — o "válido até 10/07" de julho virava outubro, três meses a mais de prateleira
 * para um frasco que já devia estar no descarte. Fixo por idioma, e não deduzido do `Intl`, porque
 * o árabe devolve marcas de direção no meio dos separadores, e o campo precisa digitar o que mostra.
 */
const FORMATO_DE_DATA: Record<Locale, string> = {
  pt: 'dd/mm/yy',
  en: 'mm/dd/yy',
  'en-GB': 'dd/mm/yy',
  es: 'dd/mm/yy',
  sr: 'dd.mm.yy',
  ar: 'dd/mm/yy',
}

export function textosDoPrimeVue(locale: Locale) {
  const { t } = i18n.global
  /* O `{0}` é do PrimeVue, não do vue-i18n: passa de volta como argumento de lista. */
  const comMarcador = (chave: string) => t(chave, ['{0}'])

  return {
    ...nomes(INTL_LOCALE[locale]),
    dateFormat: FORMATO_DE_DATA[locale],
    today: t('primevue.today'),
    clear: t('primevue.clear'),
    weekHeader: t('primevue.weekHeader'),
    prevMonth: t('primevue.prevMonth'),
    nextMonth: t('primevue.nextMonth'),
    emptyFilterMessage: t('primevue.emptyFilterMessage'),
    emptyMessage: t('primevue.emptyMessage'),
    emptySearchMessage: t('primevue.emptySearchMessage'),
    emptySelectionMessage: t('primevue.emptySelectionMessage'),
    searchMessage: comMarcador('primevue.searchMessage'),
    selectionMessage: comMarcador('primevue.selectionMessage'),
    aria: {
      close: t('primevue.aria.close'),
      previous: t('primevue.aria.previous'),
      next: t('primevue.aria.next'),
      selectAll: t('primevue.aria.selectAll'),
      unselectAll: t('primevue.aria.unselectAll'),
      navigation: t('primevue.aria.navigation'),
    },
  }
}

/** Liga o locale do PrimeVue ao do portal, agora e a cada troca de idioma. */
export function sincronizarPrimeVue(app: App) {
  const config = app.config.globalProperties.$primevue.config

  watch(
    () => i18n.global.locale.value as Locale,
    (locale) => {
      const textos = textosDoPrimeVue(locale)

      config.locale = {
        ...config.locale,
        ...textos,
        aria: { ...config.locale?.aria, ...textos.aria },
      } as typeof config.locale
    },
    { immediate: true },
  )
}
