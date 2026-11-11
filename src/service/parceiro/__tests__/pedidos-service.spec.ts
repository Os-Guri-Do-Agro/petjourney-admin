/**
 * A caixa de pedidos de horário (E3-05, PJ-SVL85R): as rotas do guia, o `parceiroId` que a lista e
 * as sugestões só levam quando não é o parceiro do token (lacuna N22) e a leitura do horário pelo
 * texto do instante.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

const JSON_HEADERS = { 'content-type': 'application/json' }

function tokenCom(parceiroAtivoId: string) {
  const parte = (objeto: unknown) =>
    btoa(JSON.stringify(objeto)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${parte({ alg: 'HS256' })}.${parte({ userId: 'u1', parceiroAtivoId, exp: 4102444800 })}.x`
}

const sessao = { parceiroAtivoId: undefined as string | undefined }
const trocarParaParceiro = vi.fn()

async function loadService(
  parceiroAtivoId: string | undefined = 'p1',
  troca: (parceiroId: string) => Promise<unknown> = async (parceiroId) => {
    sessao.parceiroAtivoId = parceiroId
  },
) {
  vi.resetModules()
  vi.stubEnv('VITE_API_URL', 'https://api.exemplo.test')
  sessao.parceiroAtivoId = parceiroAtivoId
  trocarParaParceiro.mockReset().mockImplementation(troca)
  vi.doMock('../../auth/auth-session', async (original) => ({
    ...(await original<typeof import('../../auth/auth-session')>()),
    getAuthUser: () => ({ userId: 'u1', parceiroAtivoId: sessao.parceiroAtivoId }),
    getAccessToken: () => tokenCom(sessao.parceiroAtivoId ?? ''),
  }))
  vi.doMock('../../auth/auth-service', () => ({ trocarParaParceiro }))

  return import('../pedidos-service')
}

function responder(data: unknown) {
  const fetchMock = vi.fn<typeof fetch>().mockImplementation(
    async () =>
      new Response(JSON.stringify({ statusCode: 200, message: 'ok', data }), {
        status: 200,
        headers: JSON_HEADERS,
      }),
  )
  vi.stubGlobal('fetch', fetchMock)

  return fetchMock
}

function chamadas(fetchMock: ReturnType<typeof responder>) {
  return fetchMock.mock.calls.map(([url, init]) => {
    const endereco = new URL(String(url))
    return [init?.method ?? 'GET', `${endereco.pathname}${endereco.search}`]
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.doUnmock('../../auth/auth-session')
  vi.doUnmock('../../auth/auth-service')
})

describe('rotas da caixa', () => {
  it('lista e sugestões sem o parceiroId quando é o parceiro do token (N22)', async () => {
    const servico = await loadService('p1')
    const fetchMock = responder({ itens: [], proximoCursor: null, sugestoes: [] })
    const q = { parceiroId: 'p1' }

    await servico.listarPedidos({ status: 'PENDENTES' }, q)
    await servico.listarPedidos({ status: 'ACEITOS', cursor: 'c1' }, q)
    await servico.obterPedido('g1', q)
    await servico.sugestoesDoPedido('g1', 6, q)
    await servico.aceitarPedido('g1', {}, q)
    await servico.recusarPedido('g1', { motivo: 'SEM_HORARIO', mensagem: null }, q)
    await servico.obterConfiguracaoOnline(q)

    expect(chamadas(fetchMock)).toEqual([
      ['GET', '/parceiro/portal/clinica/pedidos?status=PENDENTES'],
      ['GET', '/parceiro/portal/clinica/pedidos?status=ACEITOS&cursor=c1'],
      ['GET', '/parceiro/portal/clinica/pedidos/g1?parceiroId=p1'],
      ['GET', '/parceiro/portal/clinica/pedidos/g1/sugestoes?limite=6'],
      ['POST', '/parceiro/portal/clinica/pedidos/g1/aceitar?parceiroId=p1'],
      ['POST', '/parceiro/portal/clinica/pedidos/g1/recusar?parceiroId=p1'],
      ['GET', '/parceiro/portal/clinica/agendamento-online?parceiroId=p1'],
    ])
  })

  it('token sem o claim ou de outra empresa: realinha o token e lista sem o parceiroId', async () => {
    for (const doToken of [undefined, 'p-do-token']) {
      const servico = await loadService(doToken)
      const fetchMock = responder({ itens: [], proximoCursor: null, sugestoes: [] })

      await servico.listarPedidos({ status: 'PENDENTES' }, { parceiroId: 'p2' })
      await servico.sugestoesDoPedido('g1', 6, { parceiroId: 'p2' })

      expect(trocarParaParceiro).toHaveBeenCalledOnce()
      expect(trocarParaParceiro).toHaveBeenCalledWith('p2')
      expect(chamadas(fetchMock)).toEqual([
        ['GET', '/parceiro/portal/clinica/pedidos?status=PENDENTES'],
        ['GET', '/parceiro/portal/clinica/pedidos/g1/sugestoes?limite=6'],
      ])
    }
  })

  it('se o realinhamento falha, o parceiroId vai junto (nunca a caixa de outra empresa)', async () => {
    const servico = await loadService('p-do-token', async () => {
      throw new Error('403')
    })
    const fetchMock = responder({ itens: [], proximoCursor: null })

    await servico.listarPedidos({ status: 'PENDENTES' }, { parceiroId: 'p2' })

    expect(chamadas(fetchMock)).toEqual([
      ['GET', '/parceiro/portal/clinica/pedidos?parceiroId=p2&status=PENDENTES'],
    ])
  })

  it('o PUT da configuração manda só o que ela aceita', async () => {
    const servico = await loadService()
    const fetchMock = responder({})
    const lida = {
      ativo: true,
      permiteEscolherHorario: true,
      permiteMelhorHorario: false,
      aceitaPeloLink: true,
      aceitarSozinho: false,
      mostrarProfissionais: true,
      tipoIds: ['t1'],
      profissionalIds: ['pr1'],
      antecedenciaMinimaHoras: 2,
      horizonteDias: 30,
      prazoDeRespostaHoras: 4,
      perfilPublicado: true,
      slug: 'bem-estar',
      atualizadoEm: null,
    }

    await servico.salvarConfiguracaoOnline(servico.configuracaoParaSalvar(lida), {
      parceiroId: 'p1',
    })

    const corpo = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(Object.keys(corpo).sort()).toEqual(
      [
        'aceitaPeloLink',
        'aceitarSozinho',
        'antecedenciaMinimaHoras',
        'ativo',
        'horizonteDias',
        'mostrarProfissionais',
        'permiteEscolherHorario',
        'permiteMelhorHorario',
        'prazoDeRespostaHoras',
        'profissionalIds',
        'tipoIds',
      ].sort(),
    )
  })
})

describe('leitura do horário', () => {
  it('lê a hora e o dia do próprio texto, sem converter de fuso', async () => {
    const { diaDoInstante, horaDoInstante } = await loadService()

    expect(horaDoInstante('2026-11-06T09:00:00-04:00')).toBe('09:00')
    expect(diaDoInstante('2026-11-06T23:30:00-04:00')).toBe('2026-11-06')
  })

  it('horário escolhido vai do primeiro pet ao último; melhor horário não tem', async () => {
    const { horarioEscolhido, horarioSumiu } = await loadService()
    const pet = (inicio: string, fim: string, sumiu = false) => ({
      pedidoId: inicio,
      nome: 'Pet',
      especie: 'CACHORRO' as const,
      pacienteId: null,
      inicio,
      fim,
      horarioSumiu: sumiu,
      agendamentoId: null,
    })
    const grupo = {
      modo: 'HORARIO_ESCOLHIDO' as const,
      pets: [
        pet('2026-11-06T09:30:00-04:00', '2026-11-06T10:00:00-04:00'),
        pet('2026-11-06T09:00:00-04:00', '2026-11-06T09:30:00-04:00', true),
      ],
    }

    expect(horarioEscolhido(grupo)).toEqual({
      inicio: '2026-11-06T09:00:00-04:00',
      fim: '2026-11-06T10:00:00-04:00',
    })
    expect(horarioSumiu(grupo)).toBe(true)
    expect(horarioEscolhido({ ...grupo, modo: 'MELHOR_HORARIO' })).toBeNull()
  })
})
