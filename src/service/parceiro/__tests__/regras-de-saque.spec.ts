import { describe, expect, it } from 'vitest'

import { capacidadeDeSaque, MIN_SAQUE_CENTAVOS } from '../regras-de-saque'
import type { Carteira } from '../types'

function carteira(parcial: Partial<Carteira> = {}): Carteira {
  return {
    saldoTotalCentavos: 16400,
    saldoSacavelCentavos: 16400,
    chavePix: 'pix@empresa.com',
    totalSacadoCentavos: 0,
    bloqueadoParaSaque: false,
    ...parcial,
  }
}

describe('capacidadeDeSaque', () => {
  it('libera quando o dono tem PIX, saldo liberado acima do mínimo e nada bloqueado', () => {
    expect(capacidadeDeSaque(carteira(), true)).toBe('liberado')
  })

  it('o bloqueio vence qualquer outra condição', () => {
    expect(capacidadeDeSaque(carteira({ bloqueadoParaSaque: true }), true)).toBe('bloqueado')
    expect(capacidadeDeSaque(carteira({ bloqueadoParaSaque: true, chavePix: null }), false)).toBe(
      'bloqueado',
    )
  })

  it('distingue "nada ainda" de "tudo na janela de segurança"', () => {
    expect(
      capacidadeDeSaque(carteira({ saldoTotalCentavos: 0, saldoSacavelCentavos: 0 }), true),
    ).toBe('semSaldo')
    expect(capacidadeDeSaque(carteira({ saldoSacavelCentavos: 0 }), true)).toBe('tudoRetido')
  })

  it('quem não é dono não saca, mesmo com tudo em ordem', () => {
    expect(capacidadeDeSaque(carteira(), false)).toBe('soDono')
  })

  it('pede a chave PIX antes de falar do mínimo', () => {
    expect(capacidadeDeSaque(carteira({ chavePix: null, saldoSacavelCentavos: 1000 }), true)).toBe(
      'semChavePix',
    )
  })

  it('abaixo do mínimo não promete saque', () => {
    expect(
      capacidadeDeSaque(carteira({ saldoSacavelCentavos: MIN_SAQUE_CENTAVOS - 1 }), true),
    ).toBe('abaixoDoMinimo')
    expect(capacidadeDeSaque(carteira({ saldoSacavelCentavos: MIN_SAQUE_CENTAVOS }), true)).toBe(
      'liberado',
    )
  })
})
