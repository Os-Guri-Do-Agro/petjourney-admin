import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

async function loadService() {
  vi.resetModules()
  vi.stubEnv('VITE_API_URL', 'https://api.exemplo.test')

  return import('../auditoria-service')
}

function mockFetch() {
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      new Response(
        JSON.stringify({
          statusCode: 200,
          message: 'ok',
          data: { eventos: [], proximoCursor: null },
        }),
        { headers: { 'content-type': 'application/json' } },
      ),
    )

  vi.stubGlobal('fetch', fetchMock)

  return fetchMock
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('auditoria-service', () => {
  it('manda só os filtros escolhidos, com o cursor da página seguinte', async () => {
    const { listarTrilha } = await loadService()
    const fetchMock = mockFetch()

    await listarTrilha(
      {
        acao: 'ALTERAR',
        usuarioId: 'u1',
        profissionalId: null,
        de: '2026-10-15T04:00:00.000Z',
        ate: null,
        cursor: 'e5',
        limit: 50,
      },
      { parceiroId: 'p1' },
    )

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'https://api.exemplo.test/parceiro/portal/auditoria?parceiroId=p1&acao=ALTERAR&usuarioId=u1&de=2026-10-15T04%3A00%3A00.000Z&cursor=e5&limit=50',
    )
  })
})
