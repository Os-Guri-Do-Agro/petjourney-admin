import { describe, expect, it } from 'vitest'

import { indicesAnexosSemTipo } from '../anotacao-diario'

describe('indicesAnexosSemTipo', () => {
  it('todos com tipo: nenhum índice', () => {
    expect(indicesAnexosSemTipo(['Receita Médica', 'Outro'])).toEqual([])
  })

  it('sem anexos: nenhum índice', () => {
    expect(indicesAnexosSemTipo([])).toEqual([])
  })

  it('aponta os anexos com tipo null, vazio, só espaços ou indefinido', () => {
    expect(indicesAnexosSemTipo(['Raio-X', null, '', '   ', undefined, 'Ultrassom'])).toEqual([
      1, 2, 3, 4,
    ])
  })
})
