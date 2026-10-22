import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const JSON_HEADERS = { 'content-type': 'application/json' }

async function loadService() {
  vi.resetModules()
  vi.stubEnv('VITE_API_URL', 'https://api.exemplo.test')

  return import('../equipe-service')
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

describe('equipe-service', () => {
  it('lista a equipe do parceiro escolhido', async () => {
    const { listarEquipe } = await loadService()
    const fetchMock = mockFetch({ membros: [], convites: [] })

    await expect(listarEquipe({ parceiroId: 'p1' })).resolves.toEqual({ membros: [], convites: [] })
    expect(chamada(fetchMock).url).toBe(
      'https://api.exemplo.test/parceiro/portal/equipe?parceiroId=p1',
    )
  })

  it('convida com e-mail e papel no corpo', async () => {
    const { convidarParaEquipe } = await loadService()
    const fetchMock = mockFetch({ conviteId: 'c1', papel: 'OPERADOR', status: 'PENDENTE' }, 201)

    await convidarParaEquipe({ email: 'nova@clinica.com', papel: 'OPERADOR' })

    const { url, method, body } = chamada(fetchMock)
    expect(url).toBe('https://api.exemplo.test/parceiro/portal/equipe/convites')
    expect(method).toBe('POST')
    expect(JSON.parse(String(body))).toEqual({ email: 'nova@clinica.com', papel: 'OPERADOR' })
  })

  it('codifica o id do convite antigo (`legado:`) no caminho', async () => {
    const { cancelarConvite, reenviarConvite } = await loadService()
    const fetchMock = mockFetch(null, 204)

    await cancelarConvite('legado:u1', { parceiroId: 'p1' })
    expect(chamada(fetchMock)).toMatchObject({
      url: 'https://api.exemplo.test/parceiro/portal/equipe/convites/legado%3Au1?parceiroId=p1',
      method: 'DELETE',
    })

    const reenvio = mockFetch({ conviteId: 'c2' })
    await reenviarConvite('legado:u1')
    expect(chamada(reenvio)).toMatchObject({
      url: 'https://api.exemplo.test/parceiro/portal/equipe/convites/legado%3Au1/reenviar',
      method: 'POST',
    })
  })

  it('troca o papel com PATCH e remove com DELETE', async () => {
    const { trocarPapelDoMembro, removerDaEquipe } = await loadService()
    const patch = mockFetch({ usuarioId: 'u2', papel: 'DONO' })

    await trocarPapelDoMembro('u2', 'DONO', { parceiroId: 'p1' })
    expect(chamada(patch)).toMatchObject({
      url: 'https://api.exemplo.test/parceiro/portal/equipe/u2?parceiroId=p1',
      method: 'PATCH',
    })
    expect(JSON.parse(String(chamada(patch).body))).toEqual({ papel: 'DONO' })

    const remocao = mockFetch(null, 204)
    await expect(removerDaEquipe('u2')).resolves.toBeUndefined()
    expect(chamada(remocao)).toMatchObject({ method: 'DELETE' })
  })

  it('aceita e recusa pelo link mandando só o token', async () => {
    const { aceitarConvitePorLink, recusarConvitePorLink } = await loadService()
    const aceite = mockFetch({ parceiroId: 'p9', papel: 'OPERADOR' })

    await expect(aceitarConvitePorLink('tok')).resolves.toEqual({
      parceiroId: 'p9',
      papel: 'OPERADOR',
    })
    expect(chamada(aceite).url).toBe(
      'https://api.exemplo.test/parceiro/portal/equipe/convites/aceitar-por-link',
    )
    expect(JSON.parse(String(chamada(aceite).body))).toEqual({ token: 'tok' })

    const recusa = mockFetch(null, 204)
    await recusarConvitePorLink('tok')
    expect(chamada(recusa).url).toBe(
      'https://api.exemplo.test/parceiro/portal/equipe/convites/recusar-por-link',
    )
  })

  it('a caixa de convites é da conta, sem parceiroId', async () => {
    const { listarMeusConvites } = await loadService()
    const fetchMock = mockFetch([])

    await listarMeusConvites()

    expect(chamada(fetchMock).url).toBe(
      'https://api.exemplo.test/parceiro/portal/equipe/meus-convites',
    )
  })

  it('o erro de convite pendente chega com o codigo para a tela decidir', async () => {
    const { convidarParaEquipe } = await loadService()
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              statusCode: 409,
              message: 'Já há convite',
              codigo: 'CONVITE_JA_PENDENTE',
            }),
            { status: 409, headers: JSON_HEADERS },
          ),
        ),
    )

    await expect(
      convidarParaEquipe({ email: 'nova@clinica.com', papel: 'OPERADOR' }),
    ).rejects.toMatchObject({ statusCode: 409, codigo: 'CONVITE_JA_PENDENTE' })
  })
})
