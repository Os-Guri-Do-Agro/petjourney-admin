/**
 * O lote na hora da aplicação: pode ou não pode, e o que avisar.
 *
 * O estoque (`estoque-vacinas.ts`) olha o lote pela geladeira — quanto vale, quanto vence. Aqui a
 * pergunta é outra, e é feita com o frasco na mão e o animal na mesa: **este frasco pode entrar
 * neste animal agora?**
 *
 * - **Vencido não pode.** Não é aviso, é trava: a dose não protege e a carteira sairia com uma
 *   validade anterior à data da aplicação — o papel denunciando o erro para quem o conferir.
 * - **Perto de vencer pode, e deve.** É o primeiro a sair (primeiro que vence, primeiro que sai),
 *   e a tela diz isso em vez de assustar: a dose dentro da validade vale tanto quanto a de um
 *   lote novo, e o frasco que não sair hoje vira descarte.
 * - **Lote que o estoque não conhece** pode, com aviso: é o frasco de antes do controle, ou o que o
 *   distribuidor mandou sem nota. A aplicação vale; o estoque só não vai baixar dele.
 */

import type { ISODate } from '../data/types'

import { diffDays } from './clinic-time'
import { JANELA_DE_VALIDADE_EM_DIAS, type LoteNoEstoque } from './estoque-vacinas'

/**
 * Janela em que o aviso de validade aparece na aplicação: **a mesma do estoque**.
 *
 * A primeira versão usava trinta dias aqui e sessenta lá, com o argumento de que quem aplica não
 * precisa do aviso com tanta antecedência. O resultado era o mesmo frasco marcado "a vencer" na
 * aba de estoque e sem aviso nenhum no diálogo de aplicação — que é justamente onde o aviso vira
 * ação (usar este antes dos outros). Um conceito, uma janela.
 */
export const AVISO_DE_VALIDADE_NA_APLICACAO_EM_DIAS = JANELA_DE_VALIDADE_EM_DIAS

export type AvaliacaoDoLote =
  | { pode: false; motivo: 'vencido'; dias: number }
  | { pode: false; motivo: 'sem-validade' }
  | { pode: true; aviso: 'vence-hoje' | 'vencendo'; dias: number }
  | { pode: true; aviso: null; dias: number }

export function avaliarValidade(validade: ISODate | null, hoje: ISODate): AvaliacaoDoLote {
  if (!validade) {
    return { pode: false, motivo: 'sem-validade' }
  }

  const dias = diffDays(hoje, validade)

  /* A validade vale até o fim do dia impresso: aplicar no último dia é aplicar dentro dela. */
  if (dias < 0) {
    return { pode: false, motivo: 'vencido', dias }
  }

  if (dias === 0) {
    return { pode: true, aviso: 'vence-hoje', dias }
  }

  return dias <= AVISO_DE_VALIDADE_NA_APLICACAO_EM_DIAS
    ? { pode: true, aviso: 'vencendo', dias }
    : { pode: true, aviso: null, dias }
}

export type LoteParaAplicar = LoteNoEstoque & {
  avaliacao: AvaliacaoDoLote
  /** O que a regra de primeiro-que-vence manda usar. Um só por vacina. */
  sugerido: boolean
}

/**
 * Os lotes que estão na geladeira para uma vacina, na ordem em que devem sair.
 *
 * Entram os que têm dose — **inclusive o vencido**, que continua fisicamente lá até alguém
 * descartar e é exatamente o frasco que pode ir parar na mão de quem aplica. Ele aparece
 * travado, com o motivo, em vez de sumir: um lote que some da lista é um lote que alguém digita
 * à mão.
 */
export function lotesParaAplicar(
  lotes: LoteNoEstoque[],
  vacinaId: string,
  hoje: ISODate,
): LoteParaAplicar[] {
  const naGeladeira = lotes
    .filter((lote) => lote.vacinaId === vacinaId && lote.saldo > 0)
    .map((lote) => ({ ...lote, avaliacao: avaliarValidade(lote.validade, hoje), sugerido: false }))
    .sort((a, b) => a.validade.localeCompare(b.validade))

  const primeiroQueVence = naGeladeira.find((lote) => lote.avaliacao.pode)

  if (primeiroQueVence) {
    primeiroQueVence.sugerido = true
  }

  /* Os que podem primeiro, na ordem de uso; os travados no fim, para não serem o primeiro clique. */
  return [
    ...naGeladeira.filter((lote) => lote.avaliacao.pode),
    ...naGeladeira.filter((lote) => !lote.avaliacao.pode),
  ]
}
