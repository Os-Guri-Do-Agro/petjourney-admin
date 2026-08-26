/**
 * Contratos da `ClinicFilterBar`. Fora do SFC porque `<script setup>` não exporta tipo.
 */
export type OpcaoDeFiltro = {
  valor: string
  rotulo: string
  /** Quantos itens da lista atendem esta opção. Ausente quando não faz sentido contar. */
  contagem?: number
}

export type GrupoDeFiltro = {
  id: string
  rotulo: string
  opcoes: OpcaoDeFiltro[]
}
