/**
 * A fila de espera pela API (E3-04, PJ-07YV9I): as rotas do guia, a `Idempotency-Key` no entrar e
 * a conferência das janelas igual à da API.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

async function loadService() {
  vi.resetModules()
  vi.stubEnv('VITE_API_URL', 'https://api.exemplo.test')

  return import('../fila-service')
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

describe('rotas da fila', () => {
  it('listar, vagas, entrar, ofertar, o sim, o não e remover', async () => {
    const servico = await loadService()
    const fetchMock = responder({ itens: [] })
    const q = { parceiroId: 'p1' }

    await servico.listarFila({ situacao: 'ATIVAS' }, q)
    await servico.listarFila({ situacao: 'NAO_RESPONDERAM', cursor: 'c1' }, q)
    await servico.listarVagas({}, q)
    await servico.entrarNaFila(
      {
        pacienteId: 'pac1',
        tipoId: 't1',
        prioridade: 'NORMAL',
        janelas: [{ diaSemana: 5, inicio: '08:00', fim: '12:00' }],
      },
      'chave-1',
      q,
    )
    await servico.ofertar('e1', { inicio: '2026-11-06T09:00:00-04:00', profissionalId: 'pr1' }, q)
    await servico.registrarAceite('e1', q)
    await servico.registrarRecusa('e1', q)
    await servico.removerDaFila('e1', q)

    const feitas = fetchMock.mock.calls.map(([url, init]) => {
      const endereco = new URL(String(url))
      return [init?.method ?? 'GET', `${endereco.pathname}${endereco.search}`]
    })
    expect(feitas).toEqual([
      ['GET', '/parceiro/portal/clinica/fila?parceiroId=p1&situacao=ATIVAS'],
      ['GET', '/parceiro/portal/clinica/fila?parceiroId=p1&situacao=NAO_RESPONDERAM&cursor=c1'],
      ['GET', '/parceiro/portal/clinica/fila/vagas?parceiroId=p1'],
      ['POST', '/parceiro/portal/clinica/fila?parceiroId=p1'],
      ['POST', '/parceiro/portal/clinica/fila/e1/ofertar?parceiroId=p1'],
      ['POST', '/parceiro/portal/clinica/fila/e1/oferta/aceitar?parceiroId=p1'],
      ['POST', '/parceiro/portal/clinica/fila/e1/oferta/recusar?parceiroId=p1'],
      ['DELETE', '/parceiro/portal/clinica/fila/e1?parceiroId=p1'],
    ])
    expect(new Headers(fetchMock.mock.calls[3]?.[1]?.headers).get('Idempotency-Key')).toBe(
      'chave-1',
    )
  })
})

describe('problemaNasJanelas', () => {
  it('confere como a API: vazia, hora, invertida e repetida', async () => {
    const { problemaNasJanelas } = await loadService()
    const janela = (inicio: string, fim: string, diaSemana = 1) => ({ diaSemana, inicio, fim })

    expect(problemaNasJanelas([])).toBe('VAZIA')
    expect(problemaNasJanelas([janela('8:00', '12:00')])).toBe('HORA_INVALIDA')
    expect(problemaNasJanelas([janela('12:00', '08:00')])).toBe('JANELA_INVERTIDA')
    expect(problemaNasJanelas([janela('08:00', '12:00'), janela('08:00', '12:00')])).toBe(
      'JANELA_REPETIDA',
    )
    expect(problemaNasJanelas([janela('20:00', '24:00'), janela('08:00', '12:00', 2)])).toBeNull()
  })
})
