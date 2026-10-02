/**
 * Um passo do tutorial de tela.
 *
 * Fica em arquivo próprio, e não dentro do componente, pela mesma razão de `table-types.ts`:
 * `<script setup>` não exporta tipo, e quem monta os passos é a página, não o componente.
 */
export type PassoDoTour = {
  /**
   * Seletor CSS do que este passo aponta.
   *
   * Opcional porque nem todo passo tem alvo: o primeiro costuma apresentar a tela inteira, e o
   * último costuma ser o fecho. Sem alvo, o cartão fica no centro e nada é recortado.
   *
   * Um seletor que **não encontra nada** não é erro: a tela tem seções condicionais — a faixa de
   * véspera só existe quando há documento pendente. O passo simplesmente não entra no roteiro,
   * porque apontar para o vazio é pior do que não apontar.
   */
  alvo?: string
  titulo: string
  texto: string
}
