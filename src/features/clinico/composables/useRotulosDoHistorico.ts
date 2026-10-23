/**
 * As palavras do histórico que viaja com o pet, num lugar só.
 *
 * A regra do requisito mora no texto: **consentimento sem juridiquês** e **encerrar sem
 * constrangimento**. Por isso a clínica lê "o acesso terminou" — nunca "revogado", nem por quem —
 * e o responsável lê o que a clínica vê e quem abriu, com nome e hora, em vez de um termo.
 *
 * A página da clínica, as gavetas e o celular da prévia passam por aqui, para que "valendo",
 * "terminou" e "quem abriu" queiram dizer a mesma coisa em todos.
 */
import { useI18n } from 'vue-i18n'

import { DEFAULT_LOCALE, INTL_LOCALE, isLocale } from '@/i18n/locales'

import type { ISODateTime } from '../data/types'
import type {
  AberturaDoHistorico,
  CategoriaDoHistorico,
  ItemDoHistorico,
} from '../domain/historico-compartilhado'
import { clinicClock } from '../stores/clinico'

import { useClinicFormat } from './useClinicFormat'

export function useRotulosDoHistorico() {
  const { t, locale } = useI18n()
  const formato = useClinicFormat()

  function lista(itens: string[]): string {
    const tag = INTL_LOCALE[isLocale(locale.value) ? locale.value : DEFAULT_LOCALE]

    return new Intl.ListFormat(tag, { type: 'conjunction' }).format(itens)
  }

  function categoria(valor: CategoriaDoHistorico): string {
    return t(`clinico.historicoLiberado.categorias.${valor}`)
  }

  /** "alergias, vacinas e peso" — em minúscula, para entrar no meio da frase. */
  function categorias(valores: CategoriaDoHistorico[]): string {
    return lista(valores.map((valor) => categoria(valor).toLocaleLowerCase()))
  }

  function data(iso: ISODateTime): string {
    return formato.dataCurtaComAno(clinicClock.dateOf(iso))
  }

  /** De onde veio o item: o nome da clínica, ou "Anotado pelo responsável no app". */
  function origem(item: ItemDoHistorico): string {
    return item.origem.tipo === 'RESPONSAVEL'
      ? t('clinico.historicoLiberado.origem.responsavel')
      : item.origem.local
  }

  function quandoDoItem(item: ItemDoHistorico): string {
    return item.em ? formato.dataCurtaComAno(item.em) : t('clinico.historicoLiberado.semData')
  }

  function marcador(item: ItemDoHistorico): string {
    return item.marcador ? t(`clinico.historicoLiberado.marcador.${item.marcador}`) : ''
  }

  /** O que a pessoa fez, na voz do registro: "abriu alergias e vacinas" ou a ficha de emergência. */
  function oQueAbriu(abertura: AberturaDoHistorico): string {
    return abertura.canal === 'EMERGENCIA'
      ? t('clinico.historicoLiberado.app.quemAbriu.emergencia')
      : t('clinico.historicoLiberado.app.quemAbriu.ficha', {
          lista: categorias(abertura.categorias),
        })
  }

  return {
    lista,
    categoria,
    categorias,
    data,
    origem,
    quandoDoItem,
    marcador,
    oQueAbriu,
  }
}
