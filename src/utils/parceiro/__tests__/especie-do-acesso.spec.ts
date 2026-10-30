import { describe, expect, it } from 'vitest'

import { rotuloDaEspecie } from '@/utils/parceiro/especie-do-acesso'

describe('rotuloDaEspecie', () => {
  it('pet OUTRO mostra o que o responsável digitou, com inicial maiúscula como as outras espécies', () => {
    expect(rotuloDaEspecie({ especie: 'OUTRO', especieLabel: 'Outro', tipoEspecie: 'furão' })).toBe(
      'Furão',
    )
    expect(
      rotuloDaEspecie({
        especie: 'OUTRO',
        especieLabel: 'Outro',
        tipoEspecie: 'Porquinho-da-índia',
      }),
    ).toBe('Porquinho-da-índia')
  })

  it('sem o tipo digitado, ou só com espaço, fica o rótulo do enum', () => {
    expect(rotuloDaEspecie({ especie: 'OUTRO', especieLabel: 'Outro', tipoEspecie: null })).toBe(
      'Outro',
    )
    expect(rotuloDaEspecie({ especie: 'OUTRO', especieLabel: 'Outro', tipoEspecie: '  ' })).toBe(
      'Outro',
    )
    // A API de produção ainda não manda o campo.
    expect(rotuloDaEspecie({ especie: 'OUTRO', especieLabel: 'Outro' })).toBe('Outro')
  })

  it('outra espécie nunca troca o rótulo, mesmo com tipoEspecie', () => {
    expect(
      rotuloDaEspecie({ especie: 'CACHORRO', especieLabel: 'Cachorro', tipoEspecie: 'furão' }),
    ).toBe('Cachorro')
  })
})
