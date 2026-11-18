/**
 * Ligar e desligar pelo próprio DONO (pedidos de 17/11): as três rotas novas no molde do
 * `solicitar`, com o módulo em minúsculas, o `?parceiroId=` e o corpo `{}`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const JSON_HEADERS = { 'content-type': 'application/json' }

async function loadService() {
  vi.resetModules()
  vi.stubEnv('VITE_API_URL', 'https://api.exemplo.test')

  return import('../acesso-service')
}

function mockFetch(corpo: unknown, status = 200) {
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(JSON.stringify(corpo), { status, headers: JSON_HEADERS }))

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

describe('acesso-service: ligar e desligar módulo', () => {
  it('liga com POST e corpo vazio, o módulo em minúsculas e o parceiro na query', async () => {
    const { ligarModulo } = await loadService()
    const ligado = {
      modulo: 'CLINICA',
      status: 'TESTE',
      origem: 'TESTE_GRATUITO',
      ativoAte: '2026-12-17T12:00:00.000Z',
      acao: 'TESTE_GRATIS',
    }
    const fetchMock = mockFetch({ statusCode: 200, message: 'ok', data: ligado })

    await expect(ligarModulo('CLINICA', { parceiroId: 'p1' })).resolves.toEqual(ligado)

    const { url, method, body } = chamada(fetchMock)
    expect(url).toBe('https://api.exemplo.test/parceiro/portal/modulos/clinica/ligar?parceiroId=p1')
    expect(method).toBe('POST')
    expect(JSON.parse(String(body))).toEqual({})
  })

  it('lê a prévia do desligar com GET', async () => {
    const { efeitoDoDesligar } = await loadService()
    const efeito = {
      modulo: 'HOTEL',
      agendamentosFuturos: 0,
      internacoesAbertas: 0,
      reservasFuturas: 2,
      hospedagensAbertas: 1,
      total: 3,
    }
    const fetchMock = mockFetch({ statusCode: 200, message: 'ok', data: efeito })

    await expect(efeitoDoDesligar('HOTEL')).resolves.toEqual(efeito)
    expect(chamada(fetchMock)).toMatchObject({
      url: 'https://api.exemplo.test/parceiro/portal/modulos/hotel/efeito-do-desligar',
      method: 'GET',
    })
  })

  it('desliga com POST e corpo vazio', async () => {
    const { desligarModulo } = await loadService()
    const efeito = {
      modulo: 'CLINICA',
      agendamentosFuturos: 3,
      internacoesAbertas: 1,
      reservasFuturas: 0,
      hospedagensAbertas: 0,
      total: 4,
    }
    const fetchMock = mockFetch({
      statusCode: 200,
      message: 'ok',
      data: { modulo: 'CLINICA', status: 'DESLIGADO', efeito },
    })

    await expect(desligarModulo('CLINICA', { parceiroId: 'p1' })).resolves.toMatchObject({
      status: 'DESLIGADO',
      efeito: { total: 4 },
    })

    const { url, method, body } = chamada(fetchMock)
    expect(url).toBe(
      'https://api.exemplo.test/parceiro/portal/modulos/clinica/desligar?parceiroId=p1',
    )
    expect(method).toBe('POST')
    expect(JSON.parse(String(body))).toEqual({})
  })

  it('o 409 chega como ApiError com o `codigo` e a `message` da API', async () => {
    const { ligarModulo } = await loadService()
    mockFetch(
      {
        statusCode: 409,
        message:
          'O teste grátis deste módulo já foi usado. Para continuar com ele, fale com a equipe PetJourney.',
        codigo: 'MODULO_TESTE_JA_USADO',
      },
      409,
    )

    await expect(ligarModulo('HOTEL')).rejects.toMatchObject({
      name: 'ApiError',
      statusCode: 409,
      codigo: 'MODULO_TESTE_JA_USADO',
      message:
        'O teste grátis deste módulo já foi usado. Para continuar com ele, fale com a equipe PetJourney.',
    })
  })

  it('o 429 traz o limite e a espera nos detalhes', async () => {
    const { desligarModulo } = await loadService()
    mockFetch(
      {
        statusCode: 429,
        message: 'Muitas trocas neste módulo em pouco tempo. Tente de novo daqui a pouco.',
        codigo: 'MODULO_TAXA_EXCEDIDA',
        limite: 20,
        tenteDeNovoEmSegundos: 1800,
      },
      429,
    )

    await expect(desligarModulo('CLINICA')).rejects.toMatchObject({
      statusCode: 429,
      codigo: 'MODULO_TAXA_EXCEDIDA',
      detalhes: { limite: 20, tenteDeNovoEmSegundos: 1800 },
    })
  })
})
