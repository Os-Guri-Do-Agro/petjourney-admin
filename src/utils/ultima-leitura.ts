/**
 * Só a última leitura vale: quem troca de aba, de filtro ou de pedido antes de a resposta chegar
 * não pode ver a resposta velha por cima da nova (nem agir sobre ela).
 *
 *   const vez = criarUltimaLeitura()
 *   const minha = vez.nova()
 *   const dados = await ler()
 *   if (!vez.valendo(minha)) return
 */
export function criarUltimaLeitura() {
  let atual = 0

  return {
    /** Começa uma leitura nova; as anteriores deixam de valer. */
    nova() {
      atual += 1
      return atual
    },
    /** A vez de agora, sem começar outra: para continuar a mesma lista ("ver mais"). */
    atual() {
      return atual
    },
    /** A leitura ainda é a última pedida. */
    valendo(vez: number) {
      return vez === atual
    },
  }
}
