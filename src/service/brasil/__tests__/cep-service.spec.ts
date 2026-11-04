import { afterEach, describe, expect, it, vi } from 'vitest'

import { buscarCep, digitosDoCep } from '../cep-service'

function mockFetch(corpo: unknown, status = 200) {
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockImplementation(async () => new Response(JSON.stringify(corpo), { status }))

  vi.stubGlobal('fetch', fetchMock)

  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('cep-service', () => {
  it('lê o CEP com ou sem hífen e devolve o endereço', async () => {
    const fetchMock = mockFetch({
      cep: '78005-370',
      logradouro: 'Avenida Presidente Getúlio Vargas',
      bairro: 'Centro-Norte',
      localidade: 'Cuiabá',
      uf: 'MT',
    })

    const endereco = await buscarCep('78005-370')

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('https://viacep.com.br/ws/78005370/json/')
    expect(endereco).toEqual({
      logradouro: 'Avenida Presidente Getúlio Vargas',
      bairro: 'Centro-Norte',
      cidade: 'Cuiabá',
      uf: 'MT',
    })
  })

  it('CEP que não existe é null, com erro booleano ou em texto', async () => {
    mockFetch({ erro: true })
    expect(await buscarCep('00000000')).toBeNull()

    mockFetch({ erro: 'true' })
    expect(await buscarCep('00000000')).toBeNull()
  })

  it('CEP de cidade inteira vem sem rua e sem bairro', async () => {
    mockFetch({ logradouro: '', bairro: '', localidade: 'Chapada dos Guimarães', uf: 'MT' })

    expect(await buscarCep('78195000')).toEqual({
      logradouro: '',
      bairro: '',
      cidade: 'Chapada dos Guimarães',
      uf: 'MT',
    })
  })

  it('CEP incompleto nem chega a pedir', async () => {
    const fetchMock = mockFetch({})

    expect(await buscarCep('7800')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('serviço fora do ar lança: a tela diz "preencha à mão", não "não encontrado"', async () => {
    mockFetch({}, 503)

    await expect(buscarCep('78005370')).rejects.toThrow('ViaCEP respondeu 503')
  })

  it('digitosDoCep tira o que não é número', () => {
    expect(digitosDoCep(' 78.005-370 ')).toBe('78005370')
  })
})
