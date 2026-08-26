/**
 * Contrato do passo do prontuário. Fora do SFC porque `<script setup>` não exporta tipo.
 */
import type { EstadoDaEtapa, EtapaId } from '../../domain/encounter-progress'

export type PassoProntuario = {
  id: EtapaId
  rotulo: string
  estado: EstadoDaEtapa
  /** Resumo de uma linha do que já foi registrado. Vazio quando não há nada. */
  resumo: string
}
