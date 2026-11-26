/**
 * A caixa de pedidos de horário (E3-05, PJ-SVL85R): as rotas do guia, o `parceiroId` em toda
 * chamada (a API aceita desde as lacunas N22/N34), a leitura do horário pelo texto do instante e o
 * horário que o aceite marcou (N24).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

const JSON_HEADERS = { 'content-type': 'application/json' }

async function loadService() {
  vi.resetModules()
  vi.stubEnv('VITE_API_URL', 'https://api.exemplo.test')

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
})

describe('rotas da caixa', () => {
  it('toda rota leva o parceiroId da empresa em uso (N22)', async () => {
    const servico = await loadService()
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
      ['GET', '/parceiro/portal/clinica/pedidos?parceiroId=p1&status=PENDENTES'],
      ['GET', '/parceiro/portal/clinica/pedidos?parceiroId=p1&status=ACEITOS&cursor=c1'],
      ['GET', '/parceiro/portal/clinica/pedidos/g1?parceiroId=p1'],
      ['GET', '/parceiro/portal/clinica/pedidos/g1/sugestoes?parceiroId=p1&limite=6'],
      ['POST', '/parceiro/portal/clinica/pedidos/g1/aceitar?parceiroId=p1'],
      ['POST', '/parceiro/portal/clinica/pedidos/g1/recusar?parceiroId=p1'],
      ['GET', '/parceiro/portal/clinica/agendamento-online?parceiroId=p1'],
    ])
  })

  it('o encaixe confirma a sobreposição e o dia fechado juntos (N23)', async () => {
    const servico = await loadService()
    const fetchMock = responder({ pedido: {}, agendamentoIds: [], conflitos: [] })

    await servico.aceitarPedido(
      'g1',
      { confirmarConflitos: ['professional-overlap', 'holiday-closed'] },
      { parceiroId: 'p1' },
    )

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      confirmarConflitos: ['professional-overlap', 'holiday-closed'],
    })
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
      agendamento: null,
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

describe('o horário marcado (N24)', () => {
  const agendamento = (id: string, inicio: string, fim: string) => ({
    id,
    inicio,
    fim,
    profissionalId: 'pr1',
    profissionalNome: 'Dra. Ana',
    status: 'AGENDADO' as const,
  })
  const pet = (marcado: ReturnType<typeof agendamento> | null) => ({ agendamento: marcado })

  it('vai do primeiro agendamento do grupo ao fim do último', async () => {
    const { horarioMarcado } = await loadService()

    expect(
      horarioMarcado({
        pets: [
          pet(agendamento('a2', '2026-11-06T10:30:00-04:00', '2026-11-06T11:00:00-04:00')),
          pet(agendamento('a1', '2026-11-06T10:00:00-04:00', '2026-11-06T10:30:00-04:00')),
        ],
      } as never),
    ).toEqual({
      ...agendamento('a1', '2026-11-06T10:00:00-04:00', '2026-11-06T10:30:00-04:00'),
      fim: '2026-11-06T11:00:00-04:00',
    })
  })

  it('sem agendamento (o pedido ainda não aceito), nada', async () => {
    const { horarioMarcado } = await loadService()

    expect(horarioMarcado({ pets: [pet(null)] } as never)).toBeNull()
  })
})
