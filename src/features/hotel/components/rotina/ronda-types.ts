import type { TarefaNaPrancheta } from '../../data/repositories/hospedagem-repository'
import type { SituacaoDaTarefa } from '../../data/types'

/**
 * Uma linha da prancheta já classificada contra o relógio.
 *
 * Vive num arquivo próprio, e não dentro do componente da ronda, porque a página também precisa
 * dela para tipar as rondas que monta — e importar tipo de dentro de um `.vue` faz o tipo
 * depender de o componente continuar existindo com aquele nome.
 */
export type LinhaDaRonda = TarefaNaPrancheta & { situacao: SituacaoDaTarefa }
