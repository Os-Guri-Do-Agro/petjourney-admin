import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ModoStatusBloco, PortalStatus, StatusModoParceiro } from '../types'

const JSON_HEADERS = { 'content-type': 'application/json' }

async function loadService() {
  vi.resetModules()
  vi.stubEnv('VITE_API_URL', 'https://api.exemplo.test')

  return import('../parceiro-portal-service')
}

function mockFetch(data: unknown) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify({ statusCode: 200, message: 'ok', data }), {
      headers: JSON_HEADERS,
    }),
  )

  vi.stubGlobal('fetch', fetchMock)

  return fetchMock
}

function bloco(status: StatusModoParceiro, podeSolicitar = false): ModoStatusBloco {
  return { status, motivo: null, decididoEm: null, podeSolicitar }
}

function statusPayload(overrides: Partial<PortalStatus> = {}): PortalStatus {
  return {
    statusAuditoria: 'PENDENTE',
    podeOperar: false,
    afiliado: bloco('SOLICITADO'),
    participativo: bloco('NAO_SOLICITADO', true),
    statusAfiliado: 'SOLICITADO',
    statusParticipativo: 'NAO_SOLICITADO',
    ...overrides,
  }
}

/** `updateAccessToken` só grava token decodificável e não expirado. */
function fakeJwt() {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const exp = Math.floor(new Date('2099-01-01T00:00:00Z').getTime() / 1000)

  return `${encode({ alg: 'HS256' })}.${encode({ sub: 'u1', parceiroAtivoId: 'p1', exp })}.assinatura`
}

function corpoEnviado(fetchMock: ReturnType<typeof mockFetch>) {
  const body = fetchMock.mock.calls[0]?.[1]?.body

  return typeof body === 'string' ? (JSON.parse(body) as Record<string, unknown>) : null
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('cadastrarParceiro — programas no cadastro', () => {
  it('manda os programas declarados junto do cadastro', async () => {
    const { cadastrarParceiro } = await loadService()
    const fetchMock = mockFetch({
      parceiroId: 'p1',
      statusAuditoria: 'PENDENTE',
      programasSolicitados: ['afiliado'],
    })

    await cadastrarParceiro({ nome: 'Pet Shop do Bairro', programas: ['afiliado'] })

    expect(corpoEnviado(fetchMock)?.programas).toEqual(['afiliado'])
  })

  it('devolve `programasSolicitados` do backend, que é a fonte de verdade da confirmação', async () => {
    const { cadastrarParceiro } = await loadService()
    mockFetch({
      parceiroId: 'p1',
      statusAuditoria: 'PENDENTE',
      /* O backend pode ignorar o que foi mandado: quem manda na confirmação é a resposta. */
      programasSolicitados: [],
    })

    const resultado = await cadastrarParceiro({
      nome: 'Pet Shop do Bairro',
      programas: ['afiliado', 'participativo'],
    })

    expect(resultado.programasSolicitados).toEqual([])
  })

  it('troca o access_token em uso pelo que veio no cadastro', async () => {
    const { cadastrarParceiro } = await loadService()
    const tokenNovo = fakeJwt()
    mockFetch({ parceiroId: 'p1', statusAuditoria: 'PENDENTE', access_token: tokenNovo })

    await cadastrarParceiro({ nome: 'Pet Shop do Bairro' })

    expect(JSON.stringify(localStorage)).toContain(tokenNovo)
  })
})

describe('getPortalStatus — blocos por programa', () => {
  it('preserva o bloco do backend, inclusive SOLICITADO com cadastro PENDENTE', async () => {
    const { getPortalStatus } = await loadService()
    mockFetch(statusPayload())

    const status = await getPortalStatus()

    expect(status.statusAuditoria).toBe('PENDENTE')
    expect(status.afiliado.status).toBe('SOLICITADO')
    expect(status.afiliado.podeSolicitar).toBe(false)
    expect(status.participativo.podeSolicitar).toBe(true)
  })

  it('status desconhecido cai em NAO_SOLICITADO sem reabrir o botão de solicitar', async () => {
    const { getPortalStatus } = await loadService()
    mockFetch(
      statusPayload({
        afiliado: bloco('EM_ANALISE_MANUAL' as StatusModoParceiro, false),
      }),
    )

    const status = await getPortalStatus()

    expect(status.afiliado.status).toBe('NAO_SOLICITADO')
    // `podeSolicitar` continua sendo do backend: recalcular aqui geraria pedido duplicado.
    expect(status.afiliado.podeSolicitar).toBe(false)
  })

  it('deriva os blocos do campo legado quando o backend não manda os novos', async () => {
    const { getPortalStatus } = await loadService()
    mockFetch({
      statusAuditoria: 'APROVADO',
      podeOperar: true,
      statusAfiliado: 'REJEITADO',
      statusParticipativo: 'ATIVO',
    })

    const status = await getPortalStatus()

    expect(status.afiliado).toEqual(bloco('REJEITADO', true))
    expect(status.participativo).toEqual(bloco('ATIVO', false))
  })
})
