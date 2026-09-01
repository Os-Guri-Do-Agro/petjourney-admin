/**
 * Ordenação da tabela clínica.
 *
 * Fora do componente porque é regra, não apresentação — e porque regra de ordenação é o tipo
 * de coisa que só se confere com teste.
 *
 * Três decisões que a tabela clínica cobra e que o `Array.prototype.sort` cru não entrega:
 *
 * 1. **Estabilidade sob empate.** Trinta pacientes com uma falta cada precisam manter entre si
 *    a ordem em que chegaram. `sort` é estável desde o ES2019, mas só enquanto o comparador
 *    devolve `0` no empate — e é justamente aí que a comparação por texto costuma escorregar.
 * 2. **Vazio vai para o fim nas duas direções.** Paciente sem última falta registrada não
 *    compete por posição; inverter a ordem não pode trazê-lo para o topo, senão a primeira
 *    tela vira uma lista de traços.
 * 3. **Texto compara por localidade.** "Ácido" e "Acido" precisam ficar juntos, e `<` compara
 *    por ponto de código: em português isso joga toda palavra acentuada para depois do Z.
 */

export type DirecaoOrdenacao = 'asc' | 'desc'

export type ValorOrdenavel = string | number | null | undefined

function vazio(valor: ValorOrdenavel): boolean {
  return valor === null || valor === undefined || valor === ''
}

/**
 * Compara dois valores de coluna.
 *
 * Devolve sempre a comparação **crescente**; a direção é aplicada por quem chama, para que a
 * regra de vazio-por-último não seja invertida junto.
 */
export function compararValores(
  a: ValorOrdenavel,
  b: ValorOrdenavel,
  colator: Intl.Collator,
): number {
  const aVazio = vazio(a)
  const bVazio = vazio(b)

  if (aVazio && bVazio) {
    return 0
  }

  /** Vazio sempre depois, independente da direção — por isso não entra na inversão. */
  if (aVazio) {
    return 1
  }

  if (bVazio) {
    return -1
  }

  if (typeof a === 'number' && typeof b === 'number') {
    return a - b
  }

  return colator.compare(String(a), String(b))
}

/**
 * Ordena preservando a ordem original nos empates.
 *
 * O índice viaja junto porque o desempate por posição precisa acontecer **depois** de a
 * direção ser aplicada: desempatar antes faria a ordem dos empatados inverter junto com a
 * coluna, que é exatamente o embaralhamento que a estabilidade existe para evitar.
 */
export function ordenarLinhas<T>(
  linhas: T[],
  valorDe: (linha: T) => ValorOrdenavel,
  direcao: DirecaoOrdenacao,
  locale: string,
): T[] {
  const colator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' })
  const sinal = direcao === 'asc' ? 1 : -1

  return linhas
    .map((linha, indice) => ({ linha, indice, valor: valorDe(linha) }))
    .sort((a, b) => {
      const comparacao = compararValores(a.valor, b.valor, colator)

      if (comparacao !== 0) {
        /*
         * Vazio já foi resolvido em `compararValores` e não pode ser invertido aqui: se um dos
         * dois é vazio, a comparação vale como está.
         */
        if (vazio(a.valor) || vazio(b.valor)) {
          return comparacao
        }

        return comparacao * sinal
      }

      return a.indice - b.indice
    })
    .map((item) => item.linha)
}

/**
 * Próximo estado ao clicar num cabeçalho.
 *
 * Ciclo de três: primeira direção → direção oposta → **sem ordenação**. O terceiro passo
 * existe porque a ordem em que os dados chegam costuma ser significativa — a fila de espera
 * chega por prioridade e antiguidade, e não há como voltar a ela se o único jeito de sair de
 * uma coluna for entrar em outra.
 */
export function proximaOrdenacao(
  atual: { coluna: string | null; direcao: DirecaoOrdenacao },
  colunaId: string,
  ordemInicial: DirecaoOrdenacao,
): { coluna: string | null; direcao: DirecaoOrdenacao } {
  if (atual.coluna !== colunaId) {
    return { coluna: colunaId, direcao: ordemInicial }
  }

  if (atual.direcao === ordemInicial) {
    return { coluna: colunaId, direcao: ordemInicial === 'asc' ? 'desc' : 'asc' }
  }

  return { coluna: null, direcao: ordemInicial }
}
