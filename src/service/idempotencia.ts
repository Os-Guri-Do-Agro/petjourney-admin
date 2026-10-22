/**
 * `Idempotency-Key` nas criações que a pessoa pode repetir: duplo clique, rede que cai no meio,
 * "tentar de novo" (E1-04, D4). A API guarda a resposta da primeira chamada por 24 h e devolve a
 * mesma nas repetições, sem criar duas vezes.
 *
 * A chave é de uma **ação**, não de uma tentativa: nasce na primeira vez que a ação é enviada e se
 * repete nos retries dessa mesma ação. Se o formulário mudar entre uma tentativa e outra, é outra
 * ação, com chave nova: a API recusa a mesma chave com corpo diferente
 * (422 `CHAVE_DE_IDEMPOTENCIA_REUSADA`). Depois que a ação deu certo, a próxima é outra.
 */

export const CABECALHO_DE_IDEMPOTENCIA = 'Idempotency-Key'

export function novaChaveDeIdempotencia(): string {
  return crypto.randomUUID()
}

/** O mesmo `RequestInit`, com a chave no cabeçalho. */
export function comIdempotencia(chave: string, init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers)
  headers.set(CABECALHO_DE_IDEMPOTENCIA, chave)

  return { ...init, headers }
}

/**
 * Guarda a chave de uma ação entre as tentativas.
 *
 * `para(corpo)` devolve a mesma chave enquanto o corpo for o mesmo; `concluir()` encerra a ação
 * (deu certo), e a próxima chamada já é uma ação nova.
 */
export function criarChaveadorDeIdempotencia() {
  let atual: { corpo: string; chave: string } | null = null

  return {
    para(corpo: unknown) {
      const serializado = JSON.stringify(corpo ?? null)

      if (!atual || atual.corpo !== serializado) {
        atual = { corpo: serializado, chave: novaChaveDeIdempotencia() }
      }

      return atual.chave
    },
    concluir() {
      atual = null
    },
  }
}
