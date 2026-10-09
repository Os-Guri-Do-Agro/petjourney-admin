/**
 * Como uma meta de estoque se escreve na tela.
 *
 * Fica num lugar só porque a mesma meta aparece em três lugares — o mês em curso, o histórico e o
 * diálogo de planejamento — e "Perdas · no máximo 2 doses" escrito de dois jeitos faria a pessoa
 * achar que são duas metas diferentes.
 */

import { useI18n } from 'vue-i18n'

import type { AlertSeverity, MetaDeEstoque, TipoDeMeta, Vacina } from '../data/types'
import type { SentidoDaMeta, SituacaoDaMeta } from '../domain/metas-de-estoque'

import { useClinicFormat } from './useClinicFormat'

export function useRotulosDoEstoque() {
  const { t } = useI18n()
  const formato = useClinicFormat()

  /** "V10 (múltipla canina)", "Todas as vacinas", "Perdas", "Compras". */
  function nomeDaMeta(meta: Pick<MetaDeEstoque, 'tipo' | 'vacinaId'>, vacinas: Vacina[]): string {
    if (meta.tipo !== 'aplicacoes') {
      return t(`clinico.estoque.metas.tipo.${meta.tipo}`)
    }

    if (meta.vacinaId === null) {
      return t('clinico.estoque.metas.todasAsVacinas')
    }

    return vacinas.find((vacina) => vacina.id === meta.vacinaId)?.nome ?? meta.vacinaId
  }

  /** O que a meta mede, em poucas palavras: "doses aplicadas", "no máximo, em doses"… */
  function oQueMede(tipo: TipoDeMeta): string {
    return t(`clinico.estoque.metas.mede.${tipo}`)
  }

  /**
   * "1 dose", "4 doses" — e as formas do sérvio e do árabe. Toda frase com contagem de doses recebe
   * o número já assim: "Saem {doses}" com o número cru escrevia "Saem 1 doses".
   */
  function doses(n: number): string {
    return t('clinico.estoque.metas.doses', { n }, n)
  }

  /** Valor com a unidade certa: dinheiro em compras, doses no resto. */
  function valor(tipo: TipoDeMeta, quantidade: number): string {
    return tipo === 'compras' ? formato.moeda(quantidade) : doses(quantidade)
  }

  /** "Batida", "No ritmo", "Estourou"… — o par (sentido, situação) decide a palavra. */
  function situacao(sentido: SentidoDaMeta, qual: SituacaoDaMeta): string {
    return t(`clinico.estoque.metas.situacao.${sentido}.${qual}`)
  }

  /**
   * A mesma escala de severidade das outras listas do módulo.
   *
   * `cumprida` e `no-ritmo` ficam em `info` — a meta que está bem não pede nada de ninguém, e
   * pintá-la de verde faria a lista inteira competir com o que pede atenção.
   */
  function tom(qual: SituacaoDaMeta): AlertSeverity {
    if (qual === 'falhou') {
      return 'risco'
    }

    return qual === 'atencao' ? 'atencao' : 'info'
  }

  return { nomeDaMeta, oQueMede, doses, valor, situacao, tom }
}
