import { describe, expect, it } from 'vitest'

import { noPrototipoDeSaudePublica, saudePublicaNoMenu } from '../prototipo'

describe('Saúde pública no menu', () => {
  it('fora da produção, fica no menu em qualquer tela', () => {
    expect(saudePublicaNoMenu('/inicio', true)).toBe(true)
    expect(saudePublicaNoMenu('/clinica/agenda', true)).toBe(true)
  })

  it('em produção, só enquanto se está numa tela do protótipo', () => {
    expect(saudePublicaNoMenu('/inicio', false)).toBe(false)
    expect(saudePublicaNoMenu('/saude-publica', false)).toBe(true)
    expect(saudePublicaNoMenu('/saude-publica/piloto', false)).toBe(true)
  })

  it('reconhece só as telas do protótipo', () => {
    expect(noPrototipoDeSaudePublica('/saude-publica-x')).toBe(false)
    expect(noPrototipoDeSaudePublica('/saude-publica/relatorio')).toBe(true)
  })
})
