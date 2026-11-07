/**
 * Como uma meta de estoque se escreve na tela (E6-02): a mesma meta aparece no mês em curso, no
 * próximo, no histórico e na gaveta de planejar, e escrita de dois jeitos pareceria outra meta.
 * Dinheiro em centavos (o orçamento de compras); o resto em doses.
 */
import { useI18n } from 'vue-i18n'

import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import type {
  Meta,
  SentidoDaMeta,
  SituacaoDaMeta,
  TipoDeMeta,
} from '@/service/parceiro/estoque-service'
import { formatCentavosToBrl } from '@/utils/format/money'

export function useRotulosDasMetas() {
  const { t, locale } = useI18n()

  function intl() {
    return INTL_LOCALE[locale.value as Locale]
  }

  /** "V10 (múltipla canina)", "Todas as vacinas", "Perdas", "Compras". */
  function nome(meta: Pick<Meta, 'tipo' | 'vacinaId' | 'vacinaNome'>) {
    if (meta.tipo !== 'APLICACOES') return t(`estoque.metas.tipo.${meta.tipo}`)
    if (!meta.vacinaId) return t('estoque.metas.todasAsVacinas')
    return meta.vacinaNome ?? meta.vacinaId
  }

  function oQueMede(tipo: TipoDeMeta) {
    return t(`estoque.metas.mede.${tipo}`)
  }

  function doses(n: number) {
    return t('estoque.metas.doses', { n }, n)
  }

  function dinheiro(centavos: number) {
    return formatCentavosToBrl(centavos, intl())
  }

  /** Dinheiro em compras, doses no resto. */
  function valor(tipo: TipoDeMeta, quantidade: number) {
    return tipo === 'COMPRAS' ? dinheiro(quantidade) : doses(quantidade)
  }

  function situacao(sentido: SentidoDaMeta, qual: SituacaoDaMeta) {
    return t(`estoque.metas.situacao.${sentido}.${qual}`)
  }

  /** `AAAA-MM` por extenso: "novembro"; com o ano, "novembro de 2026" (o histórico). */
  function mes(valorDoMes: string, comAno = false) {
    const [ano, m] = valorDoMes.split('-').map(Number)
    if (!ano || !m) return ''
    return new Intl.DateTimeFormat(intl(), {
      month: 'long',
      ...(comAno ? { year: 'numeric' as const } : {}),
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(ano!, m! - 1, 15)))
  }

  function numero(n: number, casas = 0) {
    return new Intl.NumberFormat(intl(), { maximumFractionDigits: casas }).format(n)
  }

  return { nome, oQueMede, doses, dinheiro, valor, situacao, mes, numero }
}
