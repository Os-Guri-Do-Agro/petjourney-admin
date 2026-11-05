/**
 * O vínculo com o app (E2-02, PJ-HD8PAB): as rotas de propor (e-mail, código, QR e acesso), a
 * lista, cancelar, o vínculo da ficha, encerrar e os pedidos de correção; e o código do balcão em
 * dois blocos.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

const JSON_HEADERS = { 'content-type': 'application/json' }

async function loadService() {
  vi.resetModules()
  vi.stubEnv('VITE_API_URL', 'https://api.exemplo.test')

  return import('../vinculo-service')
}

function responder(data: unknown, status = 200) {
  const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () =>
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

function chamadas(fetchMock: ReturnType<typeof responder>) {
  return fetchMock.mock.calls.map(([url, init]) => {
    const endereco = new URL(String(url))

    return [
      init?.method ?? 'GET',
      `${endereco.pathname}${endereco.search}`,
      typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    ]
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('vinculo-service', () => {
  it('propõe por e-mail, código, QR e acesso, nas rotas do guia', async () => {
    const servico = await loadService()
    const fetchMock = responder({ id: 'pr1', propostaId: 'pr1', codigo: 'K7MQX3PA' }, 201)
    const q = { parceiroId: 'p1' }

    await servico.proporVinculo('cli1', ['pac1'], 'EMAIL', q)
    await servico.proporVinculo('cli1', ['pac1'], 'CODIGO', q)
    await servico.proporPorQr('9f2c4a7e1b3d5f60718293a4b5c6d7e8', 'pac1', q)
    await servico.proporPorAcesso('ac1', null, q)
    await servico.proporPorAcesso('ac1', 'pac1', q)

    expect(chamadas(fetchMock)).toEqual([
      [
        'POST',
        '/parceiro/portal/clientes/cli1/propostas-de-vinculo?parceiroId=p1',
        { pacienteIds: ['pac1'], canal: 'EMAIL' },
      ],
      [
        'POST',
        '/parceiro/portal/clientes/cli1/propostas-de-vinculo?parceiroId=p1',
        { pacienteIds: ['pac1'], canal: 'CODIGO' },
      ],
      [
        'POST',
        '/parceiro/portal/vinculos/por-qr?parceiroId=p1',
        { publicSlug: '9f2c4a7e1b3d5f60718293a4b5c6d7e8', pacienteId: 'pac1' },
      ],
      ['POST', '/parceiro/portal/compartilhamentos/ac1/propor-vinculo?parceiroId=p1', {}],
      [
        'POST',
        '/parceiro/portal/compartilhamentos/ac1/propor-vinculo?parceiroId=p1',
        { pacienteId: 'pac1' },
      ],
    ])
  })

  it('lista, cancela, lê e encerra o vínculo, e lista e resolve correções', async () => {
    const servico = await loadService()
    const fetchMock = responder([])

    await servico.listarPropostas('cli1')
    await servico.cancelarProposta('pr1')
    await servico.obterVinculo('pac1')
    await servico.encerrarVinculo('pac1', '  mudou de clínica  ')
    await servico.listarCorrecoes(false)
    await servico.listarCorrecoes(true)
    await servico.resolverCorrecao('co1')

    expect(chamadas(fetchMock)).toEqual([
      ['GET', '/parceiro/portal/clientes/cli1/propostas-de-vinculo', undefined],
      ['DELETE', '/parceiro/portal/propostas-de-vinculo/pr1', undefined],
      ['GET', '/parceiro/portal/pacientes/pac1/vinculo', undefined],
      ['POST', '/parceiro/portal/pacientes/pac1/vinculo/encerrar', { motivo: 'mudou de clínica' }],
      ['GET', '/parceiro/portal/pedidos-de-correcao', undefined],
      ['GET', '/parceiro/portal/pedidos-de-correcao?resolvidos=true', undefined],
      ['POST', '/parceiro/portal/pedidos-de-correcao/co1/resolver', undefined],
    ])
  })

  it('o código do balcão sai em dois blocos', async () => {
    const { codigoEmBlocos } = await loadService()

    expect(codigoEmBlocos('K7MQX3PA')).toBe('K7MQ-X3PA')
    expect(codigoEmBlocos('k7mq x3pa')).toBe('K7MQ-X3PA')
    expect(codigoEmBlocos('ABC')).toBe('ABC')
  })
})
