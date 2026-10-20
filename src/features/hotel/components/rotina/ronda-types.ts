import type { TarefaNaPrancheta } from '../../data/repositories/hospedagem-repository'
import type { SituacaoDaTarefa, TarefaKind } from '../../data/types'

/**
 * Uma linha da prancheta já classificada contra o relógio.
 *
 * Vive num arquivo próprio, e não dentro do componente da ronda, porque a página também precisa
 * dela para tipar as rondas que monta — e importar tipo de dentro de um `.vue` faz o tipo
 * depender de o componente continuar existindo com aquele nome.
 */
export type LinhaDaRonda = TarefaNaPrancheta & { situacao: SituacaoDaTarefa }

/**
 * O estado de um horário da linha do tempo, que é a cor do nó no trilho: remédio atrasado, algo
 * atrasado, na hora, tudo resolvido, ou ainda por vir.
 */
export type EstadoDoHorario = 'remedio' | 'atrasada' | 'janela' | 'feita' | 'futura'

/** Uma ronda já pronta para desenhar: o que ela é, quem está nela, e se está aberta. */
export type RondaNoHorario = {
  chave: string
  kind: TarefaKind
  linhas: LinhaDaRonda[]
  /** Quantas do mesmo serviço, no mesmo horário, já estão resolvidas. */
  resolvidas: number
  aberta: boolean
}
