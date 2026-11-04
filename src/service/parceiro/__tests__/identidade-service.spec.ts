import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const JSON_HEADERS = { 'content-type': 'application/json' }

async function loadService() {
  vi.resetModules()
  vi.stubEnv('VITE_API_URL', 'https://api.exemplo.test')

  return import('../identidade-service')
}

function mockFetch(data: unknown = {}) {
  /* Uma resposta nova a cada chamada: o corpo de uma Response só se lê uma vez. */
  const fetchMock = vi.fn<typeof fetch>().mockImplementation(
    async () =>
      new Response(JSON.stringify({ statusCode: 200, message: 'ok', data }), {
        headers: JSON_HEADERS,
      }),
  )

  vi.stubGlobal('fetch', fetchMock)

  return fetchMock
}

function arquivo(nome: string, tipo: string) {
  return new File(['x'], nome, { type: tipo })
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('identidade-service', () => {
  it('é da pessoa: as rotas não levam ?parceiroId=', async () => {
    const { obterIdentidade, obterAvisoDaIdentidade } = await loadService()
    const fetchMock = mockFetch({
      verificacao: null,
      exigencias: [],
      consentimentoVersaoAtual: 'v',
    })

    await obterIdentidade()
    await obterAvisoDaIdentidade('2026-10-31')

    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      'https://api.exemplo.test/parceiro/portal/eu/identidade',
      'https://api.exemplo.test/parceiro/portal/eu/identidade/consentimento/2026-10-31',
    ])
  })

  it('envia multipart com o CPF só em dígitos e a versão do aviso lido', async () => {
    const { enviarIdentidade } = await loadService()
    const fetchMock = mockFetch({ verificacao: { status: 'EM_ANALISE' } })
    const documento = arquivo('cnh.pdf', 'application/pdf')
    const selfie = arquivo('selfie.jpg', 'image/jpeg')

    await enviarIdentidade({
      cpf: '103.371.700-29',
      nomeCompleto: '  Daniel Rocha ',
      consentimentoVersao: '2026-10-31',
      documento,
      selfie,
    })

    const [url, init] = fetchMock.mock.calls[0] ?? []
    const corpo = init?.body as FormData

    expect(String(url)).toBe('https://api.exemplo.test/parceiro/portal/eu/identidade')
    expect(init?.method).toBe('POST')
    expect(corpo).toBeInstanceOf(FormData)
    expect(corpo.get('cpf')).toBe('10337170029')
    expect(corpo.get('nomeCompleto')).toBe('Daniel Rocha')
    expect(corpo.get('consentimentoVersao')).toBe('2026-10-31')
    expect((corpo.get('documento') as File).name).toBe('cnh.pdf')
    expect((corpo.get('selfie') as File).name).toBe('selfie.jpg')
    /* Sem verso, o campo não vai: é opcional na API. */
    expect(corpo.has('documentoVerso')).toBe(false)
    /* O navegador põe o boundary do multipart; um Content-Type fixo quebraria o envio. */
    expect(new Headers(init?.headers).has('Content-Type')).toBe(false)
  })

  it('cancelar é o DELETE da mesma rota', async () => {
    const { cancelarIdentidade } = await loadService()
    const fetchMock = mockFetch(null)

    await cancelarIdentidade()

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(String(url)).toBe('https://api.exemplo.test/parceiro/portal/eu/identidade')
    expect(init?.method).toBe('DELETE')
  })

  it('nada de HEIC: o documento aceita PDF, a selfie só foto', async () => {
    const { TIPOS_DA_FOTO, TIPOS_DO_DOCUMENTO, TAMANHO_MAXIMO } = await loadService()

    expect(TIPOS_DA_FOTO).not.toMatch(/heic/i)
    expect(TIPOS_DO_DOCUMENTO).toContain('application/pdf')
    expect(TIPOS_DA_FOTO).not.toContain('application/pdf')
    expect(TAMANHO_MAXIMO).toBe(8 * 1024 * 1024)
  })
})
