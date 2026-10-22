import { describe, expect, it } from 'vitest'

import pt from '@/locales/pt.json'

import { capacidadeDaCarteira } from '../capacidade-de-saque'
import type { Carteira } from '../types'

const SITUACOES_DA_API: Carteira['capacidadeDeSaque'][] = [
  'BLOQUEADO',
  'SEM_SALDO',
  'TUDO_RETIDO',
  'SO_DONO',
  'SEM_CHAVE_PIX',
  'ABAIXO_DO_MINIMO',
  'LIBERADO',
]

function carteira(capacidadeDeSaque: Carteira['capacidadeDeSaque']): Carteira {
  return {
    saldoTotalCentavos: 10000,
    saldoSacavelCentavos: 10000,
    chavePix: 'pix@exemplo.com',
    totalSacadoCentavos: 0,
    bloqueadoParaSaque: false,
    saqueMinimoCentavos: 5000,
    capacidadeDeSaque,
  }
}

describe('capacidadeDaCarteira', () => {
  it('usa a situação que a API decidiu, sem recalcular pelos saldos', () => {
    /* Saldo acima do mínimo e chave cadastrada, mas a API disse SO_DONO: vale a API. */
    expect(capacidadeDaCarteira(carteira('SO_DONO'))).toBe('soDono')
    expect(capacidadeDaCarteira(carteira('ABAIXO_DO_MINIMO'))).toBe('abaixoDoMinimo')
  })

  it.each(SITUACOES_DA_API)('%s tem frase em inicio.saldo.capacidade', (situacao) => {
    const chave = capacidadeDaCarteira(carteira(situacao))

    expect(pt.inicio.saldo.capacidade[chave]).toEqual(expect.any(String))
  })
})
