/**
 * Contrato da `LinhaDoDia`. Fora do SFC pela mesma razão que `table-types.ts` do módulo
 * clínico: `<script setup>` não é lugar de exportar tipo, e quem monta o trilho precisa
 * declarar as marcas com tipagem.
 */

import type { ISODateTime, PetSpecies } from '../../data/types'

export type MarcaDoDia = {
  id: string
  /** `chegada` sobe, `saida` desce: são movimentos opostos, feitos por pessoas diferentes. */
  tipo: 'chegada' | 'saida'
  quando: ISODateTime
  petNome: string
  petIniciais: string
  /** Espécie e retrato, para o avatar acompanhar o nome também no trilho do dia. */
  petEspecie: PetSpecies | null
  petFotoUrl: string
  /** Onde ele fica — acomodação, normalmente. O que a marca mostra ao passar o mouse. */
  detalhe: string
  /** Tem algo que impede: documento, pesagem, pertence. A marca ganha contorno de atenção. */
  travado: boolean
  rota: string
}
