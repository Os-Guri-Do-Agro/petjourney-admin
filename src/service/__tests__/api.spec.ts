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

  it('guarda o codigo e o resto do corpo de erro (PJ-4BI7TE)', async () => {
    const { apiFetch } = await loadApi('https://api.exemplo.test')
    mockFetch(
      new Response(
        JSON.stringify({
          statusCode: 429,
          timestamp: '2026-10-28T22:00:00.000Z',
          path: '/auth/reset-password-authenticated',
          message: 'Muitas tentativas de senha. Aguarde alguns minutos e tente de novo.',
          codigo: 'SENHA_TENTATIVAS_EXCEDIDAS',
          tenteDeNovoEmSegundos: 840,
        }),
        { status: 429, headers: JSON_HEADERS },
      ),
    )

    const error = await apiFetch('/auth/reset-password-authenticated', {
      method: 'POST',
      body: '{}',
    }).catch((reason: unknown) => reason)

    expect(error).toMatchObject({
      statusCode: 429,
      codigo: 'SENHA_TENTATIVAS_EXCEDIDAS',
      detalhes: { tenteDeNovoEmSegundos: 840 },
    })
  })

  it('não tenta parsear corpo de erro quando o gateway devolve HTML', async () => {
    const { apiFetch } = await loadApi('https://api.exemplo.test')
    mockFetch(new Response('<html>502 Bad Gateway</html>', { status: 502, headers: HTML_HEADERS }))

    const error = await apiFetch('/auth/login').catch((reason: unknown) => reason)

    expect(error).toMatchObject({ statusCode: 502 })
    // A message é a frase traduzida do servidor fora do ar, nunca o HTML do gateway.
    expect((error as Error).message).not.toContain('<html>')
    expect((error as Error).message).not.toBe('')
  })

  it('5xx genérico não mostra o texto do servidor em inglês', async () => {
    const { apiFetch } = await loadApi('https://api.exemplo.test')
    mockFetch(
      new Response(JSON.stringify({ statusCode: 500, message: 'Internal server error' }), {
        status: 500,
        headers: JSON_HEADERS,
      }),
    )

    const error = await apiFetch('/parceiro/portal/dashboard').catch((reason: unknown) => reason)

    expect(error).toMatchObject({ statusCode: 500 })
    expect((error as Error).message).not.toContain('Internal server error')
  })

  it('5xx com codigo mantém a mensagem da API, que já vem traduzida', async () => {
    const { apiFetch } = await loadApi('https://api.exemplo.test')
    mockFetch(
      new Response(JSON.stringify({ message: 'Serviço de QR fora do ar.', codigo: 'QR_FORA' }), {
        status: 503,
        headers: JSON_HEADERS,
      }),
    )

    await expect(apiFetch('/parceiro/portal/indicacao')).rejects.toMatchObject({
      statusCode: 503,
      codigo: 'QR_FORA',
      message: 'Serviço de QR fora do ar.',
    })
  })

  it('lista do validador (400) vira frase da casa, sem o texto técnico em inglês', async () => {
    const { apiFetch } = await loadApi('https://api.exemplo.test')
    mockFetch(
      new Response(
        JSON.stringify({
          statusCode: 400,
          message: ['token must be longer than or equal to 16 characters'],
          error: 'Bad Request',
        }),
        { status: 400, headers: JSON_HEADERS },
      ),
    )

    const error = await apiFetch('/parceiro/portal/equipe/convites/previa-por-link', {
      method: 'POST',
      body: '{"token":"abc"}',
    }).catch((reason: unknown) => reason)

    expect(error).toMatchObject({ statusCode: 400, error: 'Bad Request' })
    expect((error as Error).message).not.toContain('token must')
  })
})

describe('apiFetch — 401 com sessão aberta', () => {
  /** Token que só expira em 2100: o 401 é da API, não do relógio. */
  const TOKEN = `x.${btoa(JSON.stringify({ userId: 'u-1', exp: 4102444800 }))}.y`

  function resposta401() {
    return new Response(JSON.stringify({ message: 'A senha antiga está incorreta' }), {
      status: 401,
      headers: JSON_HEADERS,
    })
  }

  it('sessão que caiu: limpa o token e avisa a raiz', async () => {
    const { apiFetch, EVENTO_SESSAO_EXPIRADA } = await loadApi('https://api.exemplo.test')
    localStorage.setItem('access_token', TOKEN)
    mockFetch(resposta401())
    const ouvinte = vi.fn<() => void>()
    window.addEventListener(EVENTO_SESSAO_EXPIRADA, ouvinte)

    await expect(apiFetch('/parceiro/portal/status')).rejects.toMatchObject({ statusCode: 401 })

    expect(localStorage.getItem('access_token')).toBeNull()
    expect(ouvinte).toHaveBeenCalledTimes(1)
    window.removeEventListener(EVENTO_SESSAO_EXPIRADA, ouvinte)
  })

  it('senha atual errada na troca de senha: o 401 é do campo e a sessão fica', async () => {
    const { apiFetch, EVENTO_SESSAO_EXPIRADA } = await loadApi('https://api.exemplo.test')
    localStorage.setItem('access_token', TOKEN)
    mockFetch(resposta401())
    const ouvinte = vi.fn<() => void>()
    window.addEventListener(EVENTO_SESSAO_EXPIRADA, ouvinte)

    await expect(
      apiFetch(
        '/auth/reset-password-authenticated',
        { method: 'POST', body: '{}' },
        { manterSessaoEm401: true },
      ),
    ).rejects.toMatchObject({ statusCode: 401, message: 'A senha antiga está incorreta' })

    expect(localStorage.getItem('access_token')).toBe(TOKEN)
    expect(ouvinte).not.toHaveBeenCalled()
    window.removeEventListener(EVENTO_SESSAO_EXPIRADA, ouvinte)
  })

  it('401 do login, sem sessão, não dispara o aviso de sessão expirada', async () => {
    const { apiFetch, EVENTO_SESSAO_EXPIRADA } = await loadApi('https://api.exemplo.test')
    mockFetch(resposta401())
    const ouvinte = vi.fn<() => void>()
    window.addEventListener(EVENTO_SESSAO_EXPIRADA, ouvinte)

    await expect(apiFetch('/auth/login', { method: 'POST', body: '{}' })).rejects.toMatchObject({
      statusCode: 401,
    })

    expect(ouvinte).not.toHaveBeenCalled()
    window.removeEventListener(EVENTO_SESSAO_EXPIRADA, ouvinte)
  })
})
