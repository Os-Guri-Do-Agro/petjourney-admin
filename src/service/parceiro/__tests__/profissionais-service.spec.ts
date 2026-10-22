import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const JSON_HEADERS = { 'content-type': 'application/json' }

async function loadService() {
  vi.resetModules()
  vi.stubEnv('VITE_API_URL', 'https://api.exemplo.test')

  return import('../profissionais-service')
}

function mockFetch(data: unknown = {}) {
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
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

describe('profissionais-service', () => {
  it('lista com os filtros que a agenda usa', async () => {
    const { listarProfissionais } = await loadService()
    const fetchMock = mockFetch([])

    await listarProfissionais({ parceiroId: 'p1', ativo: true, atendeNaAgenda: true })

    expect(chamada(fetchMock).url).toBe(
      'https://api.exemplo.test/parceiro/portal/profissionais?parceiroId=p1&ativo=true&atendeNaAgenda=true',
    )
  })

  it('cadastra com o conselho e o login no corpo', async () => {
    const { cadastrarProfissional } = await loadService()
    const fetchMock = mockFetch({ id: 'f1' })

    await cadastrarProfissional({
      nome: 'Bia',
      conselho: 'CRMV',
      registro: '12345',
      uf: 'MT',
      usuarioId: null,
    })

    const { method, body } = chamada(fetchMock)
    expect(method).toBe('POST')
    expect(JSON.parse(String(body))).toEqual({
      nome: 'Bia',
      conselho: 'CRMV',
      registro: '12345',
      uf: 'MT',
      usuarioId: null,
    })
  })

  it('reativa pelo PATCH e desativa pela rota própria', async () => {
    const { alterarProfissional, desativarProfissional } = await loadService()
    const patch = mockFetch({ id: 'f1', ativo: true })

    await alterarProfissional('f1', { ativo: true })
    expect(chamada(patch)).toMatchObject({
      url: 'https://api.exemplo.test/parceiro/portal/profissionais/f1',
      method: 'PATCH',
    })

    const desativa = mockFetch({ id: 'f1', ativo: false })
    await desativarProfissional('f1', { parceiroId: 'p1' })
    expect(chamada(desativa)).toMatchObject({
      url: 'https://api.exemplo.test/parceiro/portal/profissionais/f1/desativar?parceiroId=p1',
      method: 'POST',
    })
  })
})
