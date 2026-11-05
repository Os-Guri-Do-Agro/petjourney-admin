import { describe, expect, it } from 'vitest'

import { criarUltimaLeitura } from '../ultima-leitura'

describe('criarUltimaLeitura', () => {
  it('só a última leitura pedida vale', () => {
    const vez = criarUltimaLeitura()
    const primeira = vez.nova()
    const segunda = vez.nova()

    expect(vez.valendo(primeira)).toBe(false)
    expect(vez.valendo(segunda)).toBe(true)
  })
})
