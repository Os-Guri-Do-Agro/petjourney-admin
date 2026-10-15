/**
 * As frases do pedido de horário, nos seis idiomas.
 *
 * O pedido viaja como dado — motivo, período, horário — e só vira frase aqui, para a recepção e
 * para o celular da demonstração dizerem a mesma coisa do mesmo jeito: "de manhã, 14/10 a 17/10"
 * na caixa de pedidos e no resumo do que o responsável enviou.
 */

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { DEFAULT_LOCALE, INTL_LOCALE, isLocale } from '@/i18n/locales'

import type { ISODateTime, PreferenciaDoPedido } from '../data/types'
import { clinicClock } from '../stores/clinico'

import { useClinicFormat } from './useClinicFormat'

export function useRotulosDoPedido() {
  const { t, locale } = useI18n()
  const formato = useClinicFormat()

  const localeIntl = computed(
    () => INTL_LOCALE[isLocale(locale.value) ? locale.value : DEFAULT_LOCALE],
  )

  /** "Nina e Oliver", "Nina, Oliver e Thor" — a conjunção do idioma de quem lê. */
  function nomes(lista: string[]): string {
    return new Intl.ListFormat(localeIntl.value, { style: 'long', type: 'conjunction' }).format(
      lista.filter(Boolean),
    )
  }

  /** "qua., 14/10 · 13:00" — o dia da semana na frente, porque é ele que a pessoa confere. */
  function quando(iso: ISODateTime): string {
    const data = clinicClock.dateOf(iso)

    return `${formato.diaDaSemanaCurto(data)}, ${formato.dataCurta(data)} · ${formato.hora(iso)}`
  }

  /** "qua., 14/10" */
  function dia(data: string): string {
    return `${formato.diaDaSemanaCurto(data)}, ${formato.dataCurta(data)}`
  }

  /** "de manhã · 14/10 a 17/10" — a janela que o responsável disse que pode. */
  function preferencia(valor: PreferenciaDoPedido): string {
    const periodo =
      valor.periodos.length === 1
        ? t(`clinico.pedidos.periodo.${valor.periodos[0]}`)
        : t('clinico.pedidos.periodo.qualquer')
    const janela =
      valor.de === valor.ate
        ? dia(valor.de)
        : t('clinico.pedidos.janela', {
            de: formato.dataCurta(valor.de),
            ate: formato.dataCurta(valor.ate),
          })

    return `${periodo} · ${janela}`
  }

  return { nomes, quando, dia, preferencia }
}
