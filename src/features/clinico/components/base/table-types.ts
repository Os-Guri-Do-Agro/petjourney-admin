/**
 * Contrato de coluna da `ClinicDataTable`.
 *
 * Vive fora do SFC porque `<script setup>` não exporta tipo, e quem monta a tabela precisa
 * declarar as colunas com tipagem.
 */
export type ColunaTabela = {
  id: string
  rotulo: string
  /** Qualquer unidade válida de `grid-template-columns`. */
  largura?: string
  /** Alinha e aplica numeral tabular — coluna de número não pode dançar na vertical. */
  numerico?: boolean
  alinharAoFim?: boolean
  /** Perde a trilha abaixo de 1024; a informação continua no detalhe da linha. */
  ocultarEmTelaEstreita?: boolean
}
