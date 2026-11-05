/**
 * Ficha de emergência pelo QR (PJ-4NARE1): o slug sai do endereço que o QR abre (ou do próprio
 * código), o motivo vai aparado e os erros chegam com o código para a tela decidir.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

const JSON_HEADERS = { 'content-type': 'application/json' }
const SLUG = '9f2c4a7e1b3d5f60718293a4b5c6d7e8'

async function loadService() {
  vi.resetModules()
  vi.stubEnv('VITE_API_URL', 'https://api.exemplo.test')

  return import('../emergencia-service')
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('lerQr', () => {
  it('lê o slug da carteirinha, do endereço antigo e do código sozinho', async () => {
    const { lerQr } = await loadService()

    expect(lerQr(`https://petjourney.health/carteirinha/${SLUG}`)).toEqual({ slug: SLUG })
    expect(lerQr(`petjourney.health/carteirinha/${SLUG}?x=1`)).toEqual({ slug: SLUG })
    expect(lerQr(`https://petjourney.health/public/${SLUG}`)).toEqual({ slug: SLUG })
    expect(lerQr(`  ${SLUG}  `)).toEqual({ slug: SLUG })
  })

  it('o QR do responsável e outros endereços não servem, cada um com o seu motivo', async () => {
    const { lerQr } = await loadService()

    expect(lerQr(`https://petjourney.health/public/tutor/${SLUG}`)).toEqual({
      problema: 'qrDoResponsavel',
    })
    expect(lerQr(`https://petjourney.health/tutor/${SLUG}`)).toEqual({
      problema: 'qrDoResponsavel',
    })
    expect(lerQr('https://qr.exemplo.test/r/AbC12')).toEqual({ problema: 'linkSemCarteirinha' })
    expect(lerQr('isto não é um link')).toEqual({ problema: 'linkSemCarteirinha' })
    expect(lerQr('   ')).toEqual({ problema: 'vazio' })
  })
})

describe('motivoValido', () => {
  it('pede de 10 a 300 caracteres, sem contar os espaços das pontas', async () => {
    const { motivoValido } = await loadService()

    expect(motivoValido('curto')).toBe(false)
    expect(motivoValido('          ')).toBe(false)
    expect(motivoValido('  atropelado  ')).toBe(true)
    expect(motivoValido('x'.repeat(300))).toBe(true)
    expect(motivoValido('x'.repeat(301))).toBe(false)
  })
})

describe('abrirFichaDeEmergencia', () => {
  it('manda o slug e o motivo aparado para o parceiro da sessão', async () => {
    const { abrirFichaDeEmergencia } = await loadService()
    const ficha = {
      acessoId: 'a1',
      petNome: 'Rex',
      alergias: [],
      tratamentosContinuos: [],
      condicoes: [],
    }
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ statusCode: 200, message: 'ok', data: ficha }), {
        status: 200,
        headers: JSON_HEADERS,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const resposta = await abrirFichaDeEmergencia(
      { publicSlug: SLUG, motivo: '  atropelamento, chegou inconsciente  ' },
      { parceiroId: 'p1' },
    )

    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toBe(
      'https://api.exemplo.test/parceiro/portal/emergencia/ficha?parceiroId=p1',
    )
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({
      publicSlug: SLUG,
      motivo: 'atropelamento, chegou inconsciente',
    })
    expect(resposta).toMatchObject({ acessoId: 'a1', petNome: 'Rex' })
  })

  it('sem o selo, o 403 chega com o código', async () => {
    const { abrirFichaDeEmergencia } = await loadService()
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            statusCode: 403,
            message: 'Precisa do CRMV conferido.',
            codigo: 'EMERGENCIA_SEM_CRMV_CONFERIDO',
          }),
          { status: 403, headers: JSON_HEADERS },
        ),
      ),
    )

    await expect(
      abrirFichaDeEmergencia({ publicSlug: SLUG, motivo: 'atropelamento grave' }),
    ).rejects.toMatchObject({ statusCode: 403, codigo: 'EMERGENCIA_SEM_CRMV_CONFERIDO' })
  })
})
