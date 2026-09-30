/**
 * Quando os ganhos de indicação podem virar saque.
 *
 * A regra morava só na tela de saque (`PortalCarteiraVisaoPanel`): dono da conta, chave PIX
 * cadastrada, saque não bloqueado e pelo menos R$ 50,00. A visão geral mostrava o mesmo saldo com
 * "disponível para saque" sem olhar nada disso — e prometia um saque que a tela seguinte recusava.
 * Agora as duas leem daqui.
 */

import type { Carteira } from './types'

/** Menor saque aceito, em centavos. */
export const MIN_SAQUE_CENTAVOS = 5000

/**
 * O que impede (ou não) o saque agora, na ordem em que a pessoa precisaria resolver.
 *
 * - `bloqueado`: o backend bloqueou o saque desta conta; o motivo está na carteira.
 * - `semSaldo`: ainda não entrou participação nenhuma.
 * - `tudoRetido`: há saldo, mas todo ele ainda está na janela de segurança.
 * - `soDono`: há saldo liberado, mas quem está logado não é o dono da conta.
 * - `semChavePix`: falta cadastrar a chave PIX.
 * - `abaixoDoMinimo`: o liberado ainda não chega ao saque mínimo.
 * - `liberado`: dá para pedir o saque.
 */
export type CapacidadeDeSaque =
  | 'bloqueado'
  | 'semSaldo'
  | 'tudoRetido'
  | 'soDono'
  | 'semChavePix'
  | 'abaixoDoMinimo'
  | 'liberado'

export function capacidadeDeSaque(carteira: Carteira, ehDono: boolean): CapacidadeDeSaque {
  if (carteira.bloqueadoParaSaque) return 'bloqueado'
  if (carteira.saldoTotalCentavos <= 0) return 'semSaldo'
  if (carteira.saldoSacavelCentavos <= 0) return 'tudoRetido'
  if (!ehDono) return 'soDono'
  if (!carteira.chavePix) return 'semChavePix'
  if (carteira.saldoSacavelCentavos < MIN_SAQUE_CENTAVOS) return 'abaixoDoMinimo'

  return 'liberado'
}
