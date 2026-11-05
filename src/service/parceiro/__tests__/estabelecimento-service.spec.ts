import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const JSON_HEADERS = { 'content-type': 'application/json' }

async function loadService() {
  vi.resetModules()
  vi.stubEnv('VITE_API_URL', 'https://api.exemplo.test')

  return import('../estabelecimento-service')
}

function mockFetch(data: unknown = {}, status = 200) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
    status === 204
      ? new Response(null, { status })
      : new Response(JSON.stringify({ statusCode: status, message: 'ok', data }), {
          status,
          headers: JSON_HEADERS,
        }),
  )

  vi.stubGlobal('fetch', fetchMock)

  return fetchMock
}

function chamada(fetchMock: ReturnType<typeof mockFetch>) {
  const [url, init] = fetchMock.mock.calls[0] ?? []

  return { url: String(url), method: init?.method ?? 'GET', body: init?.body }
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('estabelecimento-service', () => {
  it('lê o estabelecimento do parceiro', async () => {
    const { obterEstabelecimento } = await loadService()
    const fetchMock = mockFetch({ perfil: null })

    await obterEstabelecimento({ parceiroId: 'p1' })

    expect(chamada(fetchMock).url).toBe(
      'https://api.exemplo.test/parceiro/portal/estabelecimento?parceiroId=p1',
    )
  })

  it('manda a semana inteira num PUT só', async () => {
    const { salvarHorarios } = await loadService()
    const fetchMock = mockFetch({})
    const dia = {
      diaSemana: 1,
      fechado: false,
      abre: '08:00',
      fecha: '18:00',
      intervaloInicio: null,
      intervaloFim: null,
    }

    await salvarHorarios([dia], { parceiroId: 'p1' })

    const { url, method, body } = chamada(fetchMock)
    expect(url).toBe(
      'https://api.exemplo.test/parceiro/portal/estabelecimento/horarios?parceiroId=p1',
    )
    expect(method).toBe('PUT')
    expect(JSON.parse(String(body))).toEqual({ dias: [dia] })
  })

  it('copia os feriados pelo ano e remove o dia especial pelo id', async () => {
    const { copiarFeriadosNacionais, removerDiaEspecial } = await loadService()
    const copia = mockFetch({ copiados: 10, jaExistiam: 0 })

    await expect(copiarFeriadosNacionais(2026)).resolves.toEqual({ copiados: 10, jaExistiam: 0 })
    expect(JSON.parse(String(chamada(copia).body))).toEqual({ ano: 2026 })

    const remocao = mockFetch(null, 204)
    await removerDiaEspecial('d1', { parceiroId: 'p1' })
    expect(chamada(remocao)).toMatchObject({
      url: 'https://api.exemplo.test/parceiro/portal/estabelecimento/dias-especiais/d1?parceiroId=p1',
      method: 'DELETE',
    })
  })

  it('remove em lote num pedido só; os não encontrados contam como removidos (PJ-HZC7C6)', async () => {
    const { removerDiasEspeciais } = await loadService()
    const fetchMock = mockFetch({ removidos: ['d1', 'd2'], naoEncontrados: ['sumiu'] })

    const resultado = await removerDiasEspeciais(['d1', 'sumiu', 'd2', 'd1'], { parceiroId: 'p1' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(chamada(fetchMock)).toMatchObject({
      url: 'https://api.exemplo.test/parceiro/portal/estabelecimento/dias-especiais/remover?parceiroId=p1',
      method: 'POST',
    })
    /* O id repetido vai uma vez só. */
    expect(JSON.parse(String(chamada(fetchMock).body))).toEqual({ ids: ['d1', 'sumiu', 'd2'] })
    expect([...resultado.removidos].sort()).toEqual(['d1', 'd2', 'sumiu'])
    expect(resultado.falharam).toEqual([])
    expect(resultado.erro).toBeNull()
  })

  it('mais de 500 dias vão em pedidos de 500', async () => {
    const { removerDiasEspeciais } = await loadService()
    const ids = Array.from({ length: 1201 }, (_, i) => `d${i}`)
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      const { ids: lote } = JSON.parse(String(init?.body)) as { ids: string[] }

      return new Response(
        JSON.stringify({
          statusCode: 200,
          message: 'ok',
          data: { removidos: lote, naoEncontrados: [] },
        }),
        { status: 200, headers: JSON_HEADERS },
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const resultado = await removerDiasEspeciais(ids)

    const tamanhos = fetchMock.mock.calls.map(
      ([, init]) => (JSON.parse(String(init?.body)) as { ids: string[] }).ids.length,
    )
    expect(tamanhos).toEqual([500, 500, 201])
    expect(resultado.removidos).toHaveLength(1201)
  })

  it('OPERADOR (403): nada sai, todos ficam em falharam e o erro vai para a tela', async () => {
    const { removerDiasEspeciais } = await loadService()
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          statusCode: 403,
          message: 'Só o dono edita o estabelecimento.',
          codigo: 'ESTABELECIMENTO_APENAS_DONO',
        }),
        { status: 403, headers: JSON_HEADERS },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const resultado = await removerDiasEspeciais(
      Array.from({ length: 700 }, (_, i) => `d${i}`),
      { parceiroId: 'p1' },
    )

    /* O segundo pedido nem sai: falharia do mesmo jeito. */
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(resultado.removidos).toEqual([])
    expect(resultado.falharam).toHaveLength(700)
    expect(resultado.erro).toMatchObject({ codigo: 'ESTABELECIMENTO_APENAS_DONO' })
  })
})
