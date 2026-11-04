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
})
