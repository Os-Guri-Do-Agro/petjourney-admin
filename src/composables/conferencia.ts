/**
 * Conferência de pendências: quando a contagem é confiável, e quando refazê-la.
 *
 * Serve aos dois contadores de pendência (`useClinicoPendencias`, `useHotelPendencias`), que
 * alimentam os selos do menu e a pauta da visão geral.
 *
 * ## Confiável: a falha de conferir é informação
 *
 * A versão anterior engolia a falha. Fonte que não respondia virava lista vazia, a lista vazia
 * virava zero, e o zero virava "Nada pedindo ação agora" com a hora da conferência ao lado. Numa
 * tela que existe para dizer o que está parado, a pior forma de dar a notícia "não consegui olhar"
 * é como calma. Por isso cada fonte é consultada separadamente (`consultar`) e o resultado vira
 * uma `SituacaoDaConferencia`.
 *
 * ## Refazer: o que o contador conta envelhece sozinho
 *
 * Os contadores só se refaziam quando o próprio módulo avisava de uma mutação. Só que boa parte do
 * que eles contam envelhece sem ninguém mexer em nada: a refeição das 10h vira atrasada às 10h16,
 * o reforço de vacina vence à meia-noite. Numa estação que fica aberta o expediente inteiro,
 * "Conferido às 08:12" continuava na tela às 15h — um sinal de segurança com cara de atual e
 * conteúdo da manhã. `criarReconferencia` resolve:
 *
 * - A cada 5 minutos, com a aba visível, refaz a contagem.
 * - Ao voltar para a janela (foco ou aba visível de novo), refaz se a última conferência tiver
 *   mais de um minuto — trocar de aba e voltar não dispara uma rodada por clique.
 * - Liga com o primeiro consumidor e desliga com o último. Fora de um escopo de componente (teste,
 *   script) não liga nada: um relógio sem dono é vazamento.
 * - Só roda se algum consumidor tiver o módulo ativo. Um módulo desligado no meio da sessão não
 *   continua pedindo dados que ninguém vai ver.
 */

import { getCurrentScope, onScopeDispose } from 'vue'

/**
 * Como foi a última conferência de um módulo.
 *
 * - `ok`: todas as fontes responderam.
 * - `parcial`: umas responderam e outras não. Os contadores das que falharam mantêm o último valor
 *   conhecido — um número da conferência anterior é mais útil que um zero inventado.
 * - `falhou`: nenhuma respondeu. O que estiver na tela é da conferência anterior, se houve uma.
 */
export type SituacaoDaConferencia = 'ok' | 'parcial' | 'falhou'

export type RespostaDeFonte<T> = { ok: true; valor: T } | { ok: false }

/** Consulta uma fonte e diz se ela respondeu. Nunca rejeita. */
export async function consultar<T>(pedido: () => Promise<T>): Promise<RespostaDeFonte<T>> {
  try {
    return { ok: true, valor: await pedido() }
  } catch {
    return { ok: false }
  }
}

export function situacaoPelasFontes(respostas: readonly { ok: boolean }[]): SituacaoDaConferencia {
  const responderam = respostas.filter((resposta) => resposta.ok).length

  if (responderam === respostas.length) return 'ok'

  return responderam === 0 ? 'falhou' : 'parcial'
}

export const INTERVALO_DE_RECONFERENCIA_MS = 5 * 60_000

/** Idade mínima da conferência para valer a pena refazer ao voltar para a janela. */
export const IDADE_MINIMA_AO_VOLTAR_MS = 60_000

type OpcoesDeReconferencia = {
  recarregar: () => unknown
  /** Hora da última conferência que deu certo, ou `null` se nenhuma deu. */
  conferidoEm: () => Date | null
  /** Já houve ao menos uma tentativa — sem isso não há o que "re"conferir. */
  carregado: () => boolean
}

export function criarReconferencia(opcoes: OpcoesDeReconferencia) {
  /* Um objeto por assinatura: duas assinaturas com a mesma função não se apagam uma à outra. */
  const interessados = new Set<{ ativo: () => boolean }>()
  let relogio: ReturnType<typeof setInterval> | null = null

  function algumAtivo() {
    for (const interessado of interessados) {
      if (interessado.ativo()) return true
    }
    return false
  }

  function podeReconferir() {
    return opcoes.carregado() && algumAtivo() && document.visibilityState === 'visible'
  }

  function aoVoltar() {
    if (!podeReconferir()) return

    const ultima = opcoes.conferidoEm()

    if (!ultima || Date.now() - ultima.getTime() >= IDADE_MINIMA_AO_VOLTAR_MS) {
      void opcoes.recarregar()
    }
  }

  function aCadaIntervalo() {
    if (podeReconferir()) {
      void opcoes.recarregar()
    }
  }

  function ligar() {
    relogio = setInterval(aCadaIntervalo, INTERVALO_DE_RECONFERENCIA_MS)
    window.addEventListener('focus', aoVoltar)
    document.addEventListener('visibilitychange', aoVoltar)
  }

  function desligar() {
    if (relogio) {
      clearInterval(relogio)
      relogio = null
    }
    window.removeEventListener('focus', aoVoltar)
    document.removeEventListener('visibilitychange', aoVoltar)
  }

  /**
   * Registra um consumidor. Chame dentro do `setup` de um componente (ou de outro escopo de
   * efeito): o registro sai sozinho quando o escopo é desfeito.
   */
  function assinar(ativo: () => boolean) {
    if (typeof window === 'undefined' || !getCurrentScope()) {
      return
    }

    const assinatura = { ativo }
    interessados.add(assinatura)

    if (interessados.size === 1) {
      ligar()
    }

    onScopeDispose(() => {
      interessados.delete(assinatura)

      if (interessados.size === 0) {
        desligar()
      }
    })
  }

  return { assinar }
}
