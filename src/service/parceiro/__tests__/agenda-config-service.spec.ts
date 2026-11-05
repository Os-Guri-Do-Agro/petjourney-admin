/**
 * Configuração da agenda (E3-01, PJ-GL3IVL): o horário do bloqueio vai em ISO com o offset do fuso
 * da clínica, a duração do tipo vai de 5 a 480 de 5 em 5, e as rotas levam `somenteEm` só quando é
 * "só neste dia".
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

const JSON_HEADERS = { 'content-type': 'application/json' }

async function loadService() {
  vi.resetModules()
  vi.stubEnv('VITE_API_URL', 'https://api.exemplo.test')

  return import('../agenda-config-service')
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
    return [init?.method ?? 'GET', `${endereco.pathname}${endereco.search}`]
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('horário do bloqueio no fuso da clínica', () => {
  it('monta o ISO com o offset do fuso naquele dia', async () => {
    const { instanteNoFuso, offsetDoFuso } = await loadService()

    expect(offsetDoFuso('America/Cuiaba', '2026-11-09', '12:00')).toBe('-04:00')
    expect(offsetDoFuso('America/Sao_Paulo', '2026-11-09', '12:00')).toBe('-03:00')
    expect(offsetDoFuso('Europe/Lisbon', '2026-07-01', '09:00')).toBe('+01:00')
    expect(offsetDoFuso('UTC', '2026-07-01', '09:00')).toBe('+00:00')
    expect(instanteNoFuso('America/Cuiaba', '2026-11-09', '12:30')).toBe(
      '2026-11-09T12:30:00-04:00',
    )
  })

  it('diaLocal sai em AAAA-MM-DD', async () => {
    const { diaLocal } = await loadService()

    expect(diaLocal(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('duracaoValida', () => {
  it('aceita de 5 a 480, de 5 em 5', async () => {
    const { duracaoValida } = await loadService()

    expect(duracaoValida(5)).toBe(true)
    expect(duracaoValida(480)).toBe(true)
    expect(duracaoValida(30)).toBe(true)
    expect(duracaoValida(0)).toBe(false)
    expect(duracaoValida(485)).toBe(false)
    expect(duracaoValida(32)).toBe(false)
    expect(duracaoValida(null)).toBe(false)
  })
})

describe('rotas', () => {
  it('salas, tipos, política e bloqueios nas rotas do guia', async () => {
    const servico = await loadService()
    const fetchMock = responder({ fuso: 'America/Cuiaba', ocorrencias: [] })
    const q = { parceiroId: 'p1' }

    await servico.listarSalas({ ...q, ativas: true })
    await servico.listarTipos(q)
    await servico.obterPolitica(q)
    await servico.listarBloqueios({ de: '2026-11-05', ate: '2026-12-02', salaId: 's1' }, q)
    await servico.editarBloqueio('b1', { motivo: 'REUNIAO' }, '2026-11-09', q)
    await servico.apagarBloqueio('b1', '2026-11-10', q)
    await servico.apagarBloqueio('b1', null, q)

    expect(chamadas(fetchMock)).toEqual([
      ['GET', '/parceiro/portal/clinica/salas?parceiroId=p1&ativas=true'],
      ['GET', '/parceiro/portal/clinica/tipos-de-atendimento?parceiroId=p1'],
      ['GET', '/parceiro/portal/clinica/politica?parceiroId=p1'],
      [
        'GET',
        '/parceiro/portal/clinica/bloqueios?parceiroId=p1&de=2026-11-05&ate=2026-12-02&salaId=s1',
      ],
      ['PATCH', '/parceiro/portal/clinica/bloqueios/b1?parceiroId=p1&somenteEm=2026-11-09'],
      ['DELETE', '/parceiro/portal/clinica/bloqueios/b1?parceiroId=p1&somenteEm=2026-11-10'],
      ['DELETE', '/parceiro/portal/clinica/bloqueios/b1?parceiroId=p1'],
    ])
  })

  it('expediente fica em profissionais e salva com PUT', async () => {
    const servico = await loadService()
    const fetchMock = responder({ profissionalId: 'pr1', dias: [] })
    const q = { parceiroId: 'p1' }

    await servico.obterExpediente('pr1', q)
    await servico.salvarExpediente('pr1', { dias: [], salaPadraoId: null }, q)

    expect(chamadas(fetchMock)).toEqual([
      ['GET', '/parceiro/portal/profissionais/pr1/expediente?parceiroId=p1'],
      ['PUT', '/parceiro/portal/profissionais/pr1/expediente?parceiroId=p1'],
    ])
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      dias: [],
      salaPadraoId: null,
    })
  })

  it('criar sala, tipo e bloqueio leva a Idempotency-Key', async () => {
    const servico = await loadService()
    const fetchMock = responder({ id: 'x' }, 201)

    await servico.criarSala({ nome: 'Consultório 1', tipo: 'CONSULTORIO' }, 'k1')
    await servico.criarTipo({ nome: 'Consulta', kind: 'CONSULTA', duracaoMinutos: 30 }, 'k2')
    await servico.criarBloqueio(
      { inicio: '2026-11-09T12:00:00-04:00', fim: '2026-11-09T13:00:00-04:00', motivo: 'ALMOCO' },
      'k3',
    )

    const chaves = fetchMock.mock.calls.map(([, init]) =>
      new Headers(init?.headers).get('Idempotency-Key'),
    )
    expect(chaves).toEqual(['k1', 'k2', 'k3'])
  })
})
