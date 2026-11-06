/**
 * Prontuário pela API (E4-01, PJ-QQT1WN): as rotas, a Idempotency-Key do finalizar e do retorno,
 * e o 401 da senha da assinatura, que não derruba a sessão.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

const sessao = vi.hoisted(() => ({ limpar: vi.fn() }))

vi.mock('@/service/auth/auth-session', () => ({
  getAccessToken: () => 'token-de-teste',
  clearAuthSession: sessao.limpar,
}))

const JSON_HEADERS = { 'content-type': 'application/json' }

async function loadService() {
  vi.resetModules()
  vi.stubEnv('VITE_API_URL', 'https://api.exemplo.test')

  return import('../atendimentos-service')
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
  return {
    metodo: init?.method ?? 'GET',
    caminho: `${endereco.pathname}${endereco.search}`,
    corpo: init?.body ? JSON.parse(String(init.body)) : undefined,
    chave: new Headers(init?.headers).get('Idempotency-Key'),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  sessao.limpar.mockReset()
})

describe('prontuário pela API', () => {
  it('lista com o filtro e o parceiro, sem mandar o que está vazio', async () => {
    const { listarAtendimentos } = await loadService()
    const fetchMock = responder({ itens: [], proximoCursor: null })
    await listarAtendimentos({ status: 'RASCUNHO', profissionalId: null }, { parceiroId: 'p1' })
    expect(ultima(fetchMock).caminho).toBe(
      '/parceiro/portal/clinica/atendimentos?status=RASCUNHO&limit=20&parceiroId=p1',
    )
  })

  it('a linha do tempo junta os tipos por vírgula', async () => {
    const { lerLinhaDoTempo } = await loadService()
    const fetchMock = responder({ itens: [], proximoCursor: null, tipos: [], contagens: null })
    await lerLinhaDoTempo('pac-1', { tipos: ['ATENDIMENTO', 'ATO'] })
    expect(ultima(fetchMock).caminho).toBe(
      '/parceiro/portal/pacientes/pac-1/linha-do-tempo?tipos=ATENDIMENTO%2CATO&limit=20',
    )
  })

  it('os retornos pendentes só mandam somenteVencidos quando ligado', async () => {
    const { listarRetornosPendentes } = await loadService()
    const fetchMock = responder({ itens: [], proximoCursor: null, hoje: '2026-11-06' })
    await listarRetornosPendentes({ somenteVencidos: true })
    expect(ultima(fetchMock).caminho).toBe(
      '/parceiro/portal/clinica/retornos-pendentes?somenteVencidos=true&limit=50',
    )
    await listarRetornosPendentes()
    expect(ultima(fetchMock).caminho).toBe('/parceiro/portal/clinica/retornos-pendentes?limit=50')
  })

  it('a gravação é PATCH com a seção, a versão e a aba', async () => {
    const { gravarSecao } = await loadService()
    const fetchMock = responder({ id: 'at-1', secao: 'CONDUTA', versao: 5, semMudanca: false })
    await gravarSecao('at-1', {
      secao: 'CONDUTA',
      dados: { orientacoes: 'Repouso' },
      versao: 4,
      dispositivoId: 'aba-12345678',
    })
    expect(ultima(fetchMock)).toMatchObject({
      metodo: 'PATCH',
      caminho: '/parceiro/portal/clinica/atendimentos/at-1',
      corpo: { secao: 'CONDUTA', dados: { orientacoes: 'Repouso' }, versao: 4 },
    })
  })

  it('finalizar e marcar o retorno levam a Idempotency-Key', async () => {
    const { finalizarAtendimento, marcarRetorno } = await loadService()
    const fetchMock = responder({})
    await finalizarAtendimento('at-1', { versao: 5, dispositivoId: 'aba-12345678' }, 'chave-1')
    expect(ultima(fetchMock)).toMatchObject({
      metodo: 'POST',
      caminho: '/parceiro/portal/clinica/atendimentos/at-1/finalizar',
      chave: 'chave-1',
    })
    await marcarRetorno('at-1', {}, 'chave-2')
    expect(ultima(fetchMock)).toMatchObject({
      caminho: '/parceiro/portal/clinica/atendimentos/at-1/retorno',
      chave: 'chave-2',
    })
  })

  it('o 401 da senha da assinatura não derruba a sessão; outro 401 derruba', async () => {
    const { anularAtendimento } = await loadService()
    responder({ statusCode: 401, codigo: 'ASSINATURA_SENHA_EXIGIDA', message: 'Senha' }, 401)
    await expect(anularAtendimento('at-1', { motivo: 'Paciente errado' })).rejects.toMatchObject({
      codigo: 'ASSINATURA_SENHA_EXIGIDA',
    })
    expect(sessao.limpar).not.toHaveBeenCalled()

    responder({ statusCode: 401, message: 'Unauthorized' }, 401)
    await expect(anularAtendimento('at-1', { motivo: 'Paciente errado' })).rejects.toBeTruthy()
    expect(sessao.limpar).toHaveBeenCalledTimes(1)
  })
})
