import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const JSON_HEADERS = { 'content-type': 'application/json' }

async function loadServices() {
  vi.resetModules()
  vi.stubEnv('VITE_API_URL', 'https://api.exemplo.test')

  return {
    ...(await import('../pendencias-service')),
    ...(await import('../avisos-service')),
  }
}

function mockFetch(data: unknown = {}) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify({ statusCode: 200, message: 'ok', data }), {
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

describe('pendencias-service', () => {
  it('pede o menu inteiro numa chamada, pelo parceiro', async () => {
    const { listarPendencias } = await loadServices()
    const fetchMock = mockFetch([])

    await listarPendencias({ parceiroId: 'p1' })

    expect(chamada(fetchMock).url).toBe(
      'https://api.exemplo.test/parceiro/portal/pendencias?parceiroId=p1',
    )
  })
})

describe('avisos-service', () => {
  it('recorta o inbox pelo parceiro e pagina pelo cursor', async () => {
    const { listarAvisos } = await loadServices()
    const fetchMock = mockFetch({ itens: [], proximoCursor: null, naoLidas: 3 })

    await listarAvisos({ parceiroId: 'p1', cursor: 'n9', limit: 20 })

    expect(chamada(fetchMock).url).toBe(
      'https://api.exemplo.test/notificacao?parceiroId=p1&cursor=n9&limit=20',
    )
  })

  it('abrir um aviso grava o toque como vindo da lista', async () => {
    const { abrirAviso } = await loadServices()
    const fetchMock = mockFetch({ naoLidas: 0 })

    await abrirAviso('n1')

    const { url, method, body } = chamada(fetchMock)
    expect(url).toBe('https://api.exemplo.test/notificacao/n1/toque')
    expect(method).toBe('PATCH')
    expect(JSON.parse(String(body))).toEqual({ origem: 'INBOX' })
  })

  it('marca um por um, nunca pela rota que marca a conta inteira', async () => {
    const { marcarAvisoComoLido } = await loadServices()
    const fetchMock = mockFetch({ id: 'n1', lidaEm: '2026-10-22T10:00:00Z', naoLidas: 0 })

    await marcarAvisoComoLido('n1')

    expect(chamada(fetchMock)).toMatchObject({
      url: 'https://api.exemplo.test/notificacao/n1/read',
      method: 'PATCH',
    })
  })
})
