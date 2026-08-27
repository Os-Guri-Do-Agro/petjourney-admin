/**
 * Contrato dos documentos emitidos pelo prontuário. Fora do SFC porque `<script setup>` não
 * exporta tipo.
 */
export type DocumentoId =
  | 'prontuario'
  | 'receituario'
  | 'atestado-saude'
  | 'atestado-comparecimento'
