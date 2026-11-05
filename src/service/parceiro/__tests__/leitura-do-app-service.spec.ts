/**
 * A clínica lê o app (E2-03, PJ-AI84L1): as cinco rotas pelo `pacienteId` da clínica, e as
 * recusas iguais nas cinco lidas para a tela.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

async function loadService() {
  vi.resetModules()
  vi.stubEnv('VITE_API_URL', 'https://api.exemplo.test')

  return import('../leitura-do-app-service')
}

function responder(data: unknown) {
  const fetchMock = vi.fn<typeof fetch>().mockImplementation(
    async () =>
      new Response(JSON.stringify({ statusCode: 200, message: 'ok', data }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
  )
  vi.stubGlobal('fetch', fetchMock)

  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('rotas', () => {
  it('resumo, diário, pesos, carteirinha e foto pelo paciente da clínica', async () => {
    const servico = await loadService()
    const fetchMock = responder({})
    const q = { parceiroId: 'p1' }

    await servico.obterResumo('pac1', q)
    await servico.lerDiario('pac1', null, q)
    await servico.lerDiario('pac1', '2026-10-01', q)
    await servico.lerPesos('pac1', null, q)
    await servico.lerCarteirinha('pac1', q)
    await servico.urlDaFoto('pac1', 'f1', q)

    expect(
      fetchMock.mock.calls.map(([url]) => {
        const endereco = new URL(String(url))
        return `${endereco.pathname}${endereco.search}`
      }),
    ).toEqual([
      '/parceiro/portal/pacientes/pac1/resumo?parceiroId=p1',
      '/parceiro/portal/pacientes/pac1/app/diario?parceiroId=p1',
      '/parceiro/portal/pacientes/pac1/app/diario?parceiroId=p1&desde=2026-10-01',
      '/parceiro/portal/pacientes/pac1/app/pesos?parceiroId=p1',
      '/parceiro/portal/pacientes/pac1/app/carteirinha?parceiroId=p1',
      '/parceiro/portal/pacientes/pac1/app/fotos/f1/url?parceiroId=p1',
    ])
  })
})

describe('lerRecusa', () => {
  it('lê as recusas da seção 5.1', async () => {
    const { lerRecusa } = await loadService()
    const { ApiError } = await import('../../api')
    const erro = (statusCode: number, corpo: { codigo?: string } & Record<string, unknown>) => {
      const { codigo, ...detalhes } = corpo
      return new ApiError('x', statusCode, undefined, undefined, { codigo, detalhes })
    }

    expect(lerRecusa(erro(403, { codigo: 'PET_SEM_ACESSO' }), 'g')).toEqual({ tipo: 'semVinculo' })
    expect(lerRecusa(erro(403, { codigo: 'SEM_CONSENTIMENTO', chave: 'peso' }), 'g')).toEqual({
      tipo: 'semConsentimento',
      chave: 'peso',
    })
    expect(
      lerRecusa(erro(429, { codigo: 'LEITURA_APP_TAXA_EXCEDIDA', tenteDeNovoEmSegundos: 30 }), 'g'),
    ).toEqual({ tipo: 'taxa', segundos: 30 })
    expect(lerRecusa(erro(403, {}), 'g')).toEqual({ tipo: 'semAcesso' })
    expect(lerRecusa(new Error(''), 'genérico')).toEqual({ tipo: 'outro', mensagem: 'genérico' })
  })

  it('sinais com risco primeiro', async () => {
    const { sinaisEmOrdem } = await loadService()

    expect(
      sinaisEmOrdem([
        { tipo: 'polifarmacia', severidade: 'atencao', total: 4 },
        { tipo: 'alarme', severidade: 'risco' },
      ]).map((sinal) => sinal.tipo),
    ).toEqual(['alarme', 'polifarmacia'])
  })
})
