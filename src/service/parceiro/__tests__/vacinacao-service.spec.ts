import { afterEach, describe, expect, it, vi } from 'vitest'

import { CODIGO_DO_LOTE, corpoDaEdicao, pontosDaSerie } from '../vacinacao-service'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('editar registro (N42)', () => {
  const atual = { observacao: 'Reação leve no local', via: 'SUBCUTANEA' as const }

  it('sem mudança, nada a mandar (o "Salvar" fica desabilitado)', () => {
    expect(
      corpoDaEdicao(atual, { observacao: 'Reação leve no local', via: 'SUBCUTANEA' }, 'x'),
    ).toBeNull()
    /* Espaço em volta não é mudança. */
    expect(
      corpoDaEdicao(atual, { observacao: '  Reação leve no local ', via: 'SUBCUTANEA' }, 'x'),
    ).toBeNull()
    expect(
      corpoDaEdicao({ observacao: null, via: null }, { observacao: '', via: null }, 'x'),
    ).toBeNull()
  })

  it('só os campos que mudaram, com o motivo aparado', () => {
    expect(
      corpoDaEdicao(atual, { observacao: 'Sem reação', via: 'SUBCUTANEA' }, ' Digitada errada '),
    ).toEqual({ observacao: 'Sem reação', motivo: 'Digitada errada' })
    expect(
      corpoDaEdicao(
        atual,
        { observacao: 'Reação leve no local', via: 'INTRAMUSCULAR' },
        'Via errada',
      ),
    ).toEqual({ via: 'INTRAMUSCULAR', motivo: 'Via errada' })
  })

  it('observação vazia apaga (null); a via nunca vai nula', () => {
    expect(corpoDaEdicao(atual, { observacao: '   ', via: null }, 'Apagar a nota')).toEqual({
      observacao: null,
      motivo: 'Apagar a nota',
    })
  })

  it('PATCH na aplicação, com o parceiro', async () => {
    vi.resetModules()
    vi.stubEnv('VITE_API_URL', 'https://api.exemplo.test')
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(
      async () =>
        new Response(JSON.stringify({ statusCode: 200, message: 'ok', data: { id: 'ap1' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const { editarAplicacao } = await import('../vacinacao-service')

    await editarAplicacao('ap1', { via: 'ORAL', motivo: 'Via errada' }, { parceiroId: 'p1' })

    const [url, init] = fetchMock.mock.calls[0]!
    const endereco = new URL(String(url))
    expect(init?.method).toBe('PATCH')
    expect(`${endereco.pathname}${endereco.search}`).toBe(
      '/parceiro/portal/clinica/aplicacoes/ap1?parceiroId=p1',
    )
    expect(JSON.parse(String(init?.body))).toEqual({ via: 'ORAL', motivo: 'Via errada' })
  })
})

describe('vacinação conectada', () => {
  it('desenha os pontos da série pelo total, com as dadas primeiro', () => {
    expect(pontosDaSerie({ aplicadasNaSerie: 1, total: 3 })).toEqual(['dada', 'falta', 'falta'])
    expect(pontosDaSerie({ aplicadasNaSerie: 0, total: 1 })).toEqual(['falta'])
  })

  it('não some ponto quando a série encurta abaixo do que já foi dado', () => {
    expect(pontosDaSerie({ aplicadasNaSerie: 3, total: 2 })).toEqual(['dada', 'dada', 'dada'])
  })

  it('aceita o código do lote como a API (letras, números, espaço, . / - _)', () => {
    expect(CODIGO_DO_LOTE.test('AB-123/2026')).toBe(true)
    expect(CODIGO_DO_LOTE.test('LOTE 7_A.1')).toBe(true)
    expect(CODIGO_DO_LOTE.test('lote#1')).toBe(false)
    expect(CODIGO_DO_LOTE.test('')).toBe(false)
  })
})
