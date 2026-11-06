/**
 * Documentos clínicos, laudos e cópia do prontuário pela API (E4-06, PJ-0EK0TY): as rotas, a
 * Idempotency-Key e a senha do emitir (que não derruba a sessão), o multipart dos laudos e o filtro
 * dos pedidos de cópia.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

const sessao = vi.hoisted(() => ({ limpar: vi.fn() }))

vi.mock('@/service/auth/auth-session', () => ({
  getAccessToken: () => 'token-de-teste',
  clearAuthSession: sessao.limpar,
}))

const JSON_HEADERS = { 'content-type': 'application/json' }

async function carregar() {
  vi.resetModules()
  vi.stubEnv('VITE_API_URL', 'https://api.exemplo.test')

  return {
    documentos: await import('../documentos-service'),
    copias: await import('../copias-service'),
  }
}

function responder(data: unknown, status = 200) {
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockImplementation(
      async () =>
        new Response(
          JSON.stringify(status >= 400 ? data : { statusCode: status, message: 'ok', data }),
          { status, headers: JSON_HEADERS },
        ),
    )
  vi.stubGlobal('fetch', fetchMock)

  return fetchMock
}

function ultima(fetchMock: ReturnType<typeof responder>) {
  const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1]!
  const endereco = new URL(String(url))
  const headers = new Headers(init?.headers)
  return {
    metodo: init?.method ?? 'GET',
    caminho: `${endereco.pathname}${endereco.search}`,
    corpo: init?.body,
    chave: headers.get('Idempotency-Key'),
    tipo: headers.get('Content-Type'),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  sessao.limpar.mockReset()
})

describe('documentos clínicos pela API', () => {
  it('a lista do paciente leva o atendimento só quando há um', async () => {
    const { documentos } = await carregar()
    const fetchMock = responder({ itens: [], proximoCursor: null })
    await documentos.listarDocumentosDoPaciente('pac-1', { atendimentoId: 'at-1' })
    expect(ultima(fetchMock).caminho).toBe(
      '/parceiro/portal/clinica/pacientes/pac-1/documentos?atendimentoId=at-1&limit=20',
    )
    await documentos.listarDocumentosDoPaciente('pac-1')
    expect(ultima(fetchMock).caminho).toBe(
      '/parceiro/portal/clinica/pacientes/pac-1/documentos?limit=20',
    )
  })

  it('emitir leva a senha, o aceite pelo app e a Idempotency-Key', async () => {
    const { documentos } = await carregar()
    const fetchMock = responder({ id: 'doc-1' })
    await documentos.emitirDocumento('doc-1', { senha: 'segredo', aceitePeloApp: true }, 'chave-1')
    const pedido = ultima(fetchMock)
    expect(pedido).toMatchObject({
      metodo: 'POST',
      caminho: '/parceiro/portal/clinica/documentos/doc-1/emitir',
      chave: 'chave-1',
    })
    expect(JSON.parse(String(pedido.corpo))).toEqual({ senha: 'segredo', aceitePeloApp: true })
  })

  it('a senha errada no emitir não derruba a sessão', async () => {
    const { documentos } = await carregar()
    responder({ statusCode: 401, codigo: 'ASSINATURA_SENHA_INCORRETA', message: 'Senha' }, 401)
    await expect(
      documentos.emitirDocumento('doc-1', { senha: 'errada' }, 'chave-1'),
    ).rejects.toMatchObject({ codigo: 'ASSINATURA_SENHA_INCORRETA' })
    expect(sessao.limpar).not.toHaveBeenCalled()
  })

  it('os laudos vão em multipart, sem Content-Type de JSON', async () => {
    const { documentos } = await carregar()
    const fetchMock = responder({ itens: [] })
    const arquivo = new File(['%PDF-1.4'], 'hemograma.pdf', { type: 'application/pdf' })
    await documentos.anexarLaudos('at-1', {
      arquivos: [arquivo, arquivo],
      nomeDoExame: 'Hemograma',
      dataDoResultado: '2026-11-05',
    })
    const pedido = ultima(fetchMock)
    expect(pedido.caminho).toBe('/parceiro/portal/clinica/atendimentos/at-1/laudos')
    expect(pedido.tipo).toBeNull()
    const form = pedido.corpo as FormData
    expect(form.getAll('file')).toHaveLength(2)
    expect(form.get('nomeDoExame')).toBe('Hemograma')
    expect(form.get('dataDoResultado')).toBe('2026-11-05')
  })
})

describe('cópia do prontuário pela API', () => {
  it('a lista leva a situação e o limite', async () => {
    const { copias } = await carregar()
    const fetchMock = responder({ itens: [], proximoCursor: null })
    await copias.listarPedidosDeCopia({ situacao: 'ENCERRADOS', cursor: 'c2' })
    expect(ultima(fetchMock).caminho).toBe(
      '/parceiro/portal/clinica/pedidos-de-copia?situacao=ENCERRADOS&cursor=c2&limit=30',
    )
  })

  it('gerar com um período manda o de e o até; sem período, um corpo vazio', async () => {
    const { copias } = await carregar()
    const fetchMock = responder({ id: 'pc-1', status: 'GERANDO' }, 202)
    await copias.gerarCopia('pc-1', { de: '2026-01-01', ate: '2026-06-30' })
    let pedido = ultima(fetchMock)
    expect(pedido.caminho).toBe('/parceiro/portal/clinica/pedidos-de-copia/pc-1/gerar')
    expect(JSON.parse(String(pedido.corpo))).toEqual({ de: '2026-01-01', ate: '2026-06-30' })
    await copias.gerarCopia('pc-1')
    pedido = ultima(fetchMock)
    expect(JSON.parse(String(pedido.corpo))).toEqual({})
  })

  it('entregar leva o canal', async () => {
    const { copias } = await carregar()
    const fetchMock = responder({ id: 'pc-1', status: 'ENTREGUE' })
    await copias.entregarCopia('pc-1', 'EMAIL_DO_RESPONSAVEL', { parceiroId: 'p1' })
    const pedido = ultima(fetchMock)
    expect(pedido.caminho).toBe(
      '/parceiro/portal/clinica/pedidos-de-copia/pc-1/entregar?parceiroId=p1',
    )
    expect(JSON.parse(String(pedido.corpo))).toEqual({ canal: 'EMAIL_DO_RESPONSAVEL' })
  })

  it('só os pedidos sem fim pedem ação', async () => {
    const { copias } = await carregar()
    expect(
      (['ABERTO', 'PRORROGADO', 'GERANDO', 'PRONTO'] as const).every(copias.pedidoAberto),
    ).toBe(true)
    expect(
      (['ENTREGUE', 'RECUSADO', 'ENCERRADO_NA_EXCLUSAO'] as const).some(copias.pedidoAberto),
    ).toBe(false)
  })
})
