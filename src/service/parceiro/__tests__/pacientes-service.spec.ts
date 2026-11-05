/**
 * Clientes e pacientes pela API (E2-01, PJ-ECWI3Z): a busca só manda o termo que filtra, a lista
 * anda pelo cursor, a criação leva a `Idempotency-Key`, e as datas de dia e os telefones chegam à
 * tela sem passar pelo fuso.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

const JSON_HEADERS = { 'content-type': 'application/json' }

async function loadService() {
  vi.resetModules()
  vi.stubEnv('VITE_API_URL', 'https://api.exemplo.test')

  return import('../pacientes-service')
}

function responder(data: unknown, status = 200) {
  /* Uma resposta nova por chamada: o corpo de uma Response só se lê uma vez. */
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

function chamada(fetchMock: ReturnType<typeof responder>, indice = 0) {
  const [url, init] = fetchMock.mock.calls[indice] ?? []
  const headers = new Headers(init?.headers)

  return {
    url: String(url),
    metodo: init?.method ?? 'GET',
    corpo: typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body,
    chave: headers.get('Idempotency-Key'),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('termoDaBusca', () => {
  it('com letras vai como está; só números, a partir de 3 dígitos', async () => {
    const { termoDaBusca } = await loadService()

    expect(termoDaBusca(' josé ')).toBe('josé')
    expect(termoDaBusca('(65) 9')).toBe('(65) 9')
    expect(termoDaBusca('65')).toBe('')
    expect(termoDaBusca('--')).toBe('')
    expect(termoDaBusca('')).toBe('')
  })
})

describe('listarPacientes', () => {
  it('manda a busca, a espécie, os inativos e o cursor, e não manda o termo curto', async () => {
    const { listarPacientes } = await loadService()
    const fetchMock = responder({ itens: [], proximoCursor: null })

    await listarPacientes(
      { q: 'bolota', especie: 'CACHORRO', ativo: false, cursor: 'c1', limit: 30 },
      { parceiroId: 'p1' },
    )
    await listarPacientes({ q: '65' })

    const primeira = new URL(chamada(fetchMock, 0).url)
    expect(primeira.pathname).toBe('/parceiro/portal/pacientes')
    expect(Object.fromEntries(primeira.searchParams)).toEqual({
      parceiroId: 'p1',
      q: 'bolota',
      especie: 'CACHORRO',
      ativo: 'false',
      cursor: 'c1',
      limit: '30',
    })
    expect(new URL(chamada(fetchMock, 1).url).search).toBe('')
  })
})

describe('criarPaciente', () => {
  it('leva a Idempotency-Key da ação e o cliente novo no mesmo corpo', async () => {
    const { criarPaciente } = await loadService()
    const fetchMock = responder({ id: 'pac1', nome: 'Tofu' }, 201)

    const criado = await criarPaciente(
      { nome: 'Tofu', especie: 'GATO', cliente: { nome: 'Ana Lima', telefone: '(65) 99988-7766' } },
      'chave-1',
      { parceiroId: 'p1' },
    )

    expect(chamada(fetchMock)).toMatchObject({
      url: 'https://api.exemplo.test/parceiro/portal/pacientes?parceiroId=p1',
      metodo: 'POST',
      chave: 'chave-1',
      corpo: { nome: 'Tofu', especie: 'GATO', cliente: { nome: 'Ana Lima' } },
    })
    expect(criado).toMatchObject({ id: 'pac1' })
  })
})

describe('as outras rotas do cadastro', () => {
  it('inativar com óbito, encerrar alerta, mesclar e anonimizar vão para as rotas certas', async () => {
    const servico = await loadService()
    const fetchMock = responder({})

    await servico.inativarPaciente('pac1', { motivo: 'OBITO', obitoEm: '2026-11-03' })
    await servico.editarAlerta('pac1', 'al1', { ativo: false })
    await servico.mesclarPaciente('pac1', 'pac2')
    await servico.mesclarCliente('cli1', 'cli2')
    await servico.anonimizarCliente('cli1', '  pedido por e-mail no balcão  ')

    expect(
      fetchMock.mock.calls.map((_, i) => [
        chamada(fetchMock, i).metodo,
        new URL(chamada(fetchMock, i).url).pathname,
        chamada(fetchMock, i).corpo,
      ]),
    ).toEqual([
      [
        'POST',
        '/parceiro/portal/pacientes/pac1/inativar',
        { motivo: 'OBITO', obitoEm: '2026-11-03' },
      ],
      ['PATCH', '/parceiro/portal/pacientes/pac1/alertas/al1', { ativo: false }],
      ['POST', '/parceiro/portal/pacientes/pac1/mesclar', { comPacienteId: 'pac2' }],
      ['POST', '/parceiro/portal/clientes/cli1/mesclar', { comClienteId: 'cli2' }],
      [
        'POST',
        '/parceiro/portal/clientes/cli1/anonimizar',
        { motivo: 'pedido por e-mail no balcão' },
      ],
    ])
  })

  it('a foto vai em multipart só com o campo file', async () => {
    const { enviarFoto } = await loadService()
    const fetchMock = responder({ id: 'pac1' })
    const arquivo = new File(['x'], 'tofu.jpg', { type: 'image/jpeg' })

    await enviarFoto('pac1', arquivo)

    const corpo = fetchMock.mock.calls[0]?.[1]?.body as FormData
    expect(corpo).toBeInstanceOf(FormData)
    expect([...corpo.keys()]).toEqual(['file'])
  })
})

describe('formatos', () => {
  it('telefone com DDI vira o da tela; internacional fica com o "+"', async () => {
    const { telefoneNaTela } = await loadService()

    expect(telefoneNaTela('5565999887766')).toBe('(65) 99988-7766')
    expect(telefoneNaTela('556532221100')).toBe('(65) 3222-1100')
    expect(telefoneNaTela('351912345678')).toBe('+351912345678')
    expect(telefoneNaTela(null)).toBe('')
  })

  it('a idade sai da data de dia sem passar pelo fuso', async () => {
    const { idadeEmMeses } = await loadService()
    const hoje = new Date(2026, 10, 5)

    expect(idadeEmMeses('2020-05-10', hoje)).toBe(77)
    expect(idadeEmMeses('2026-11-05', hoje)).toBe(0)
    expect(idadeEmMeses('2026-10-06', hoje)).toBe(0)
    expect(idadeEmMeses('2026-10-05', hoje)).toBe(1)
    expect(idadeEmMeses(null, hoje)).toBeNull()
  })
})
