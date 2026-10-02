/**
 * As colunas da planilha aberta no migrador, como a pessoa as conhece: a letra do Excel, o título,
 * o começo do conteúdo e para onde cada uma vai.
 *
 * Usado pelo painel de colunas, pela pergunta "qual coluna tem o nome do animal?" e pela nota do
 * resumo ("usamos 18 de 20 colunas"). Coluna vazia não conta em nenhum deles: não há o que perder
 * nela, e listá-la só faria a conta parecer pior do que é.
 */
import { computed } from 'vue'

import { exemplosDaColuna, preenchidasNaColuna, type MapeamentoDaColuna } from '../domain/migracao'
import { letraDaColuna } from '../domain/planilha'
import { useMigracaoStore } from '../stores/migracao'

import { useRotulosDaMigracao } from './useRotulosDaMigracao'

export type ColunaDaPlanilha = MapeamentoDaColuna & {
  titulo: string
  letra: string
  exemplos: string[]
  preenchidas: number
}

export function useColunasDaPlanilha() {
  const migracao = useMigracaoStore()
  const rotulos = useRotulosDaMigracao()

  const colunas = computed<ColunaDaPlanilha[]>(() => {
    const planilha = migracao.planilha

    if (!planilha) {
      return []
    }

    return migracao.mapeamento.map((item) => ({
      ...item,
      titulo: rotulos.coluna(item.coluna, planilha.cabecalhos[item.coluna] ?? ''),
      letra: letraDaColuna(item.coluna),
      exemplos: exemplosDaColuna(planilha, item.coluna),
      preenchidas: preenchidasNaColuna(planilha, item.coluna),
    }))
  })

  const comConteudo = computed(() => colunas.value.filter((coluna) => coluna.preenchidas > 0))
  const usadas = computed(() => colunas.value.filter((coluna) => coluna.destino !== null))
  const deFora = computed(() => comConteudo.value.filter((coluna) => coluna.destino === null))

  return { colunas, comConteudo, usadas, deFora }
}
