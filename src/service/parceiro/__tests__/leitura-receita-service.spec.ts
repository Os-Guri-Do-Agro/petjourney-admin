/**
 * Leitura de receita com IA no portal: as duas rotas novas e o vínculo no envio da anotação.
 *
 * O vínculo é a parte frágil: a rota de anotação é multipart e ignora campo desconhecido em
 * silêncio, então `leituraReceitaId` fora do form faria a anotação sair sem a receita, sem erro.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { NovaAnotacaoPayload } from '../types'

const JSON_HEADERS = { 'content-type': 'application/json' }

async function loadService() {
  vi.resetModules()
  vi.stubEnv('VITE_API_URL', 'https://api.exemplo.test')

  return import('../compartilhamentos-service')
}

function mockFetch(data: unknown = {}) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify({ statusCode: 201, message: 'ok', data }), {
      headers: JSON_HEADERS,
    }),
  )

  vi.stubGlobal('fetch', fetchMock)

  return fetchMock
}

function chamada(fetchMock: ReturnType<typeof mockFetch>) {
  const [url, init] = fetchMock.mock.calls[0] ?? []

  return { url: String(url), init }
}

function payload(overrides: Partial<NovaAnotacaoPayload> = {}): NovaAnotacaoPayload {
  return {
    servicoRealizado: 'Consulta de rotina',
    texto: 'Retorno em 15 dias.',
    tipoServico: 'CONSULTA',
    ...overrides,
  }
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('criarLeituraReceita', () => {
  it('manda os arquivos no multipart, no campo "arquivos", com o parceiro na query', async () => {
    const fetchMock = mockFetch({ id: 'l1', status: 'PROCESSANDO' })
    const { criarLeituraReceita } = await loadService()
    const paginas = [
      new File(['a'], 'pagina-1.jpg', { type: 'image/jpeg' }),
      new File(['b'], 'pagina-2.jpg', { type: 'image/jpeg' }),
    ]

    const criada = await criarLeituraReceita('c1', paginas, { parceiroId: 'p9' })

    const { url, init } = chamada(fetchMock)
    expect(url).toBe(
      'https://api.exemplo.test/parceiro/portal/compartilhamentos/c1/leitura-receita?parceiroId=p9',
    )
    expect(init?.method).toBe('POST')
    const corpo = init?.body
    expect(corpo).toBeInstanceOf(FormData)
    expect((corpo as FormData).getAll('arquivos')).toHaveLength(2)
    expect(criada).toEqual({ id: 'l1', status: 'PROCESSANDO' })
  })

  it('não força Content-Type: o navegador põe o boundary do multipart', async () => {
    const fetchMock = mockFetch({ id: 'l1', status: 'PROCESSANDO' })
    const { criarLeituraReceita } = await loadService()

    await criarLeituraReceita('c1', [new File(['a'], 'r.pdf', { type: 'application/pdf' })])

    const headers = new Headers(chamada(fetchMock).init?.headers)
    expect(headers.has('Content-Type')).toBe(false)
  })
})

describe('getLeituraReceita', () => {
  it('consulta a leitura pelo id, com o parceiro na query', async () => {
    const fetchMock = mockFetch({ id: 'l1', status: 'AGUARDANDO_CONFIRMACAO' })
    const { getLeituraReceita } = await loadService()

    await getLeituraReceita('c1', 'l1', { parceiroId: 'p9' })

    expect(chamada(fetchMock).url).toBe(
      'https://api.exemplo.test/parceiro/portal/compartilhamentos/c1/leitura-receita/l1?parceiroId=p9',
    )
  })
})

describe('criarAnotacao com a receita lida', () => {
  it('manda o leituraReceitaId e não reenvia o arquivo da receita', async () => {
    const fetchMock = mockFetch()
    const { criarAnotacao } = await loadService()

    await criarAnotacao('c1', payload({ leituraReceitaId: 'l1' }))

    const corpo = chamada(fetchMock).init?.body as FormData
    expect(corpo.get('leituraReceitaId')).toBe('l1')
    expect(corpo.getAll('anexos')).toHaveLength(0)
  })

  it('sem leitura, o campo não entra no form', async () => {
    const fetchMock = mockFetch()
    const { criarAnotacao } = await loadService()

    await criarAnotacao('c1', payload())

    const corpo = chamada(fetchMock).init?.body as FormData
    expect(corpo.has('leituraReceitaId')).toBe(false)
  })
})
