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

describe('questionário pós-saque', () => {
  it('consulta a elegibilidade com o parceiro do contexto', async () => {
    const { getFeedbackElegibilidade } = await loadService()
    const fetchMock = mockFetch({ exibir: true })

    await expect(getFeedbackElegibilidade({ parceiroId: 'p1' })).resolves.toEqual({ exibir: true })
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://api.exemplo.test/parceiro/portal/feedback/elegibilidade?parceiroId=p1',
    )
  })

  it('só abre com `exibir: true` literal', async () => {
    const { getFeedbackElegibilidade } = await loadService()
    mockFetch({ exibir: 'true' })

    await expect(getFeedbackElegibilidade()).resolves.toEqual({ exibir: false })
  })

  it('grava a resposta com POST no corpo e o parceiro na query', async () => {
    const { registrarFeedbackSaque } = await loadService()
    const fetchMock = mockFetch({ id: 'f1', status: 'RESPONDIDO', createdAt: '2026-10-09' })

    const registro = await registrarFeedbackSaque(
      {
        saqueId: 's1',
        status: 'RESPONDIDO',
        versaoQuestionario: 1,
        notaRecomendacao: 9,
        pontosPositivos: ['RAPIDEZ_SAQUE'],
        incentivos: [],
      },
      { parceiroId: 'p1' },
    )

    expect(registro.id).toBe('f1')
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://api.exemplo.test/parceiro/portal/feedback?parceiroId=p1',
    )
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('POST')
    expect(corpoEnviado(fetchMock)).toEqual({
      saqueId: 's1',
      status: 'RESPONDIDO',
      versaoQuestionario: 1,
      notaRecomendacao: 9,
      pontosPositivos: ['RAPIDEZ_SAQUE'],
      incentivos: [],
    })
  })

  it('devolve o `reason` do 409 para a tela decidir', async () => {
    const { registrarFeedbackSaque } = await loadService()
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            statusCode: 409,
            message: 'Fora do prazo.',
            reason: 'FEEDBACK_FORA_DO_PRAZO',
          }),
          { status: 409, headers: JSON_HEADERS },
        ),
      ),
    )

    await expect(
      registrarFeedbackSaque({ saqueId: 's1', status: 'DISPENSADO', versaoQuestionario: 1 }),
    ).rejects.toMatchObject({ statusCode: 409, reason: 'FEEDBACK_FORA_DO_PRAZO' })
  })
})
