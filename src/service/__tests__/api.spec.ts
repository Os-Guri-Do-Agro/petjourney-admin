import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const JSON_HEADERS = { 'content-type': 'application/json' }
const HTML_HEADERS = { 'content-type': 'text/html; charset=utf-8' }

async function loadApi(baseUrl: string | undefined) {
  vi.resetModules()

  vi.stubEnv('VITE_API_URL', baseUrl ?? '')

  return import('../api')
}

function mockFetch(response: Response) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response)
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

describe('apiFetch', () => {
  it('falha com causa nomeada quando a build não tem base URL', async () => {
    const { apiFetch, ApiError } = await loadApi(undefined)
    const fetchMock = mockFetch(new Response('{}', { headers: JSON_HEADERS }))

    await expect(apiFetch('/auth/login')).rejects.toMatchObject({
      reason: 'API_URL_MISSING',
    })
    await expect(apiFetch('/auth/login')).rejects.toBeInstanceOf(ApiError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejeita 200 que devolve HTML em vez de JSON (fallback do SPA)', async () => {
    const { apiFetch } = await loadApi('https://api.exemplo.test')
    mockFetch(new Response('<!DOCTYPE html><html></html>', { headers: HTML_HEADERS }))

    await expect(apiFetch('/auth/login', { method: 'POST', body: '{}' })).rejects.toMatchObject({
      statusCode: 200,
      reason: 'RESPOSTA_NAO_JSON',
    })
  })

  it('remove barra final da base para não gerar // no path', async () => {
    const { apiFetch } = await loadApi('https://api.exemplo.test/')
    const fetchMock = mockFetch(new Response('{"ok":true}', { headers: JSON_HEADERS }))

    await apiFetch('/auth/login')

    expect(fetchMock).toHaveBeenCalledWith('https://api.exemplo.test/auth/login', expect.anything())
  })

  it('aceita resposta sem corpo (204 de DELETE)', async () => {
    const { apiFetch } = await loadApi('https://api.exemplo.test')
    mockFetch(new Response(null, { status: 204 }))

    await expect(apiFetch('/parceiro/portal/equipe/1', { method: 'DELETE' })).resolves.toBeUndefined()
  })

  it('usa a message do backend quando o erro vem em JSON', async () => {
    const { apiFetch } = await loadApi('https://api.exemplo.test')
    mockFetch(
      new Response(JSON.stringify({ message: 'Credenciais inválidas', reason: 'INVALID_CREDENTIALS' }), {
        status: 401,
        headers: JSON_HEADERS,
      }),
    )

    await expect(apiFetch('/auth/login')).rejects.toMatchObject({
      statusCode: 401,
      message: 'Credenciais inválidas',
      reason: 'INVALID_CREDENTIALS',
    })
  })

  it('expõe o codigo das rotas novas e o resto do corpo de erro', async () => {
    const { apiFetch } = await loadApi('https://api.exemplo.test')
    mockFetch(
      new Response(
        JSON.stringify({
          statusCode: 400,
          message: 'Faltam dados para publicar',
          codigo: 'ESTABELECIMENTO_INCOMPLETO',
          faltando: ['nomePublico', 'telefone'],
          timestamp: '2026-10-22T12:00:00.000Z',
          path: '/parceiro/portal/estabelecimento/publicar',
        }),
        { status: 400, headers: JSON_HEADERS },
      ),
    )

    const error = await apiFetch('/parceiro/portal/estabelecimento/publicar', {
      method: 'POST',
    }).catch((reason: unknown) => reason)

    expect(error).toMatchObject({
      statusCode: 400,
      codigo: 'ESTABELECIMENTO_INCOMPLETO',
      detalhes: { faltando: ['nomePublico', 'telefone'] },
    })
    expect((error as { detalhes: object }).detalhes).not.toHaveProperty('timestamp')
  })

  it('erro sem codigo (rotas antigas) fica sem codigo e sem detalhes', async () => {
    const { apiFetch } = await loadApi('https://api.exemplo.test')
    mockFetch(
      new Response(JSON.stringify({ statusCode: 404, message: 'Não encontrado' }), {
        status: 404,
        headers: JSON_HEADERS,
      }),
    )

    const error = await apiFetch('/parceiro/portal/saques/x').catch((reason: unknown) => reason)

    expect(error).toMatchObject({ statusCode: 404, codigo: undefined, detalhes: {} })
  })

  it('não tenta parsear corpo de erro quando o gateway devolve HTML', async () => {
    const { apiFetch } = await loadApi('https://api.exemplo.test')
    mockFetch(new Response('<html>502 Bad Gateway</html>', { status: 502, headers: HTML_HEADERS }))

    const error = await apiFetch('/auth/login').catch((reason: unknown) => reason)

    expect(error).toMatchObject({ statusCode: 502 })
    // A message é traduzida; o que importa é o status interpolado, não o idioma do teste.
    expect((error as Error).message).toContain('502')
  })
})
