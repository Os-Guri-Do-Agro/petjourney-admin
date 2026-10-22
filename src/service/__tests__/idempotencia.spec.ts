import { describe, expect, it } from 'vitest'

import {
  CABECALHO_DE_IDEMPOTENCIA,
  comIdempotencia,
  criarChaveadorDeIdempotencia,
} from '../idempotencia'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('criarChaveadorDeIdempotencia', () => {
  it('repete a chave nos retries da mesma ação', () => {
    const chaveador = criarChaveadorDeIdempotencia()
    const primeira = chaveador.para({ nome: 'Sala 1' })

    expect(primeira).toMatch(UUID_V4)
    expect(chaveador.para({ nome: 'Sala 1' })).toBe(primeira)
  })

  it('corpo diferente é outra ação, com outra chave', () => {
    const chaveador = criarChaveadorDeIdempotencia()
    const primeira = chaveador.para({ nome: 'Sala 1' })

    expect(chaveador.para({ nome: 'Sala 2' })).not.toBe(primeira)
  })

  it('depois de concluir, a mesma ação de novo ganha chave nova', () => {
    const chaveador = criarChaveadorDeIdempotencia()
    const primeira = chaveador.para({ nome: 'Sala 1' })

    chaveador.concluir()

    expect(chaveador.para({ nome: 'Sala 1' })).not.toBe(primeira)
  })
})

describe('comIdempotencia', () => {
  it('põe a chave no cabeçalho sem perder os outros', () => {
    const init = comIdempotencia('c-1', { method: 'POST', headers: { 'Accept-Language': 'pt-BR' } })
    const headers = new Headers(init.headers)

    expect(init.method).toBe('POST')
    expect(headers.get(CABECALHO_DE_IDEMPOTENCIA)).toBe('c-1')
    expect(headers.get('Accept-Language')).toBe('pt-BR')
  })
})
