import { describe, expect, it } from 'vitest'

import { documentoDaPessoaValido } from '../documento-da-pessoa'

describe('documentoDaPessoaValido', () => {
  it('aceita o que a API aceita: letras sem acento, números, ponto, hífen, barra e espaço', () => {
    expect(documentoDaPessoaValido('123.456.789-09')).toBe(true)
    expect(documentoDaPessoaValido('RG 12.345.678-9 SSP/SP')).toBe(true)
  })

  it('recusa o que levava 400 da API: parêntese, acento e menos de 4 caracteres', () => {
    expect(documentoDaPessoaValido('RG 12.345.678-9 (teste)')).toBe(false)
    expect(documentoDaPessoaValido('Passaporte nº 123')).toBe(false)
    expect(documentoDaPessoaValido(' 12 ')).toBe(false)
  })
})
