/**
 * A situação do saque na língua das telas.
 *
 * A regra é da API (E0-02): `GET /parceiro/portal/carteira` devolve `capacidadeDeSaque` já
 * decidida para quem está logado, e `saqueMinimoCentavos`, o mesmo mínimo que o `POST` de saque
 * usa. O portal não recalcula nada: aqui só se traduz o valor da API para as chaves de texto e de
 * tom que as telas já usavam, sem renomeá-las nos seis idiomas.
 */

import type { Carteira } from './types'

/** As chaves de `inicio.saldo.capacidade.*`, uma por situação. */
export type CapacidadeDeSaque =
  | 'bloqueado'
  | 'semSaldo'
  | 'tudoRetido'
  | 'soDono'
  | 'semChavePix'
  | 'abaixoDoMinimo'
  | 'liberado'

const CHAVE_DA_CAPACIDADE: Record<Carteira['capacidadeDeSaque'], CapacidadeDeSaque> = {
  BLOQUEADO: 'bloqueado',
  SEM_SALDO: 'semSaldo',
  TUDO_RETIDO: 'tudoRetido',
  SO_DONO: 'soDono',
  SEM_CHAVE_PIX: 'semChavePix',
  ABAIXO_DO_MINIMO: 'abaixoDoMinimo',
  LIBERADO: 'liberado',
}

export function capacidadeDaCarteira(carteira: Carteira): CapacidadeDeSaque {
  return CHAVE_DA_CAPACIDADE[carteira.capacidadeDeSaque]
}
