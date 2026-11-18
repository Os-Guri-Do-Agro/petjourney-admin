/**
 * O lembrete de vacina pela API (N42, guia `pedidos-luis-17-11.md` seção 5): as rotas, o 409 sem
 * canal no app, o estado lido do item da chamada e a limpeza do que ficou no navegador antes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LembreteDaVacinaDto } from '../../contrato/openapi'

async function loadService() {
  vi.resetModules()
  vi.stubEnv('VITE_API_URL', 'https://api.exemplo.test')

  return import('../lembrete-de-vacina-service')
}

function responder(status: number, corpo: unknown) {
  const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () =>
    status === 204
      ? new Response(null, { status })
      : new Response(JSON.stringify(corpo), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
  )
  vi.stubGlobal('fetch', fetchMock)

  return fetchMock
}

const chamadas = (fetchMock: ReturnType<typeof responder>) =>
  fetchMock.mock.calls.map(([url, init]) => {
    const endereco = new URL(String(url))
    return [init?.method ?? 'GET', `${endereco.pathname}${endereco.search}`, init?.body ?? null]
  })

const LEMBRETE: LembreteDaVacinaDto = {
  aplicacaoId: 'ap1',
  ligadoEm: '2026-11-17T11:05:31-03:00',
  ligadoPorId: 'u1',
  ultimoEnvioEm: '2026-11-17T11:05:40-03:00',
  proximoEnvioEm: '2026-12-06T09:00:00-03:00',
  envios: 1,
  entrega: 'ENTREGUE',
  motivoSemEnvio: null,
}

beforeEach(() => localStorage.clear())

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('rotas do lembrete', () => {
  it('liga com POST e corpo vazio, e desliga com DELETE, na aplicação da chamada', async () => {
    const servico = await loadService()
    const fetchMock = responder(201, { statusCode: 201, message: 'ok', data: LEMBRETE })
    fetchMock.mockImplementation(async (_url, init) =>
      init?.method === 'DELETE'
        ? new Response(null, { status: 204 })
        : new Response(JSON.stringify({ statusCode: 201, message: 'ok', data: LEMBRETE }), {
            status: 201,
            headers: { 'content-type': 'application/json' },
          }),
    )

    const ligado = await servico.ligarLembreteDaVacina('ap 1', { parceiroId: 'p1' })
    expect(ligado).toEqual(LEMBRETE)
    await expect(
      servico.desligarLembreteDaVacina('ap1', { parceiroId: 'p1' }),
    ).resolves.toBeUndefined()

    expect(chamadas(fetchMock)).toEqual([
      ['POST', '/parceiro/portal/clinica/aplicacoes/ap%201/lembrete?parceiroId=p1', '{}'],
      ['DELETE', '/parceiro/portal/clinica/aplicacoes/ap1/lembrete?parceiroId=p1', null],
    ])
    expect(servico.LEMBRETE_NA_API).toBe(true)
  })

  it('sem parceiro no contexto, a rota sai sem o parâmetro', async () => {
    const servico = await loadService()
    const fetchMock = responder(204, null)

    await servico.desligarLembreteDaVacina('ap1')

    expect(chamadas(fetchMock)).toEqual([
      ['DELETE', '/parceiro/portal/clinica/aplicacoes/ap1/lembrete', null],
    ])
  })

  it('o 409 sem canal no app chega com o código, para a tela trocar o botão', async () => {
    const servico = await loadService()
    responder(409, {
      statusCode: 409,
      codigo: 'SEM_CANAL_NO_APP',
      message: 'O paciente não tem um responsável com o app.',
    })

    await expect(servico.ligarLembreteDaVacina('ap1')).rejects.toMatchObject({
      statusCode: 409,
      codigo: 'SEM_CANAL_NO_APP',
    })
  })

  it('o 409 fora da chamada traz a situação', async () => {
    const servico = await loadService()
    responder(409, {
      statusCode: 409,
      codigo: 'LEMBRETE_FORA_DA_CHAMADA',
      situacao: 'EM_DIA',
      message: 'Esta dose não está mais na lista de chamada.',
    })

    await expect(servico.ligarLembreteDaVacina('ap1')).rejects.toMatchObject({
      codigo: 'LEMBRETE_FORA_DA_CHAMADA',
      detalhes: { situacao: 'EM_DIA' },
    })
  })
})

describe('estado pela chamada', () => {
  it('o lembrete vem do item; sem o campo (API anterior ao N42), nenhum', async () => {
    const servico = await loadService()
    expect(servico.lembreteDoItem({ lembrete: LEMBRETE })).toEqual(LEMBRETE)
    expect(servico.lembreteDoItem({ lembrete: null })).toBeNull()
    expect(servico.lembreteDoItem({} as { lembrete: null })).toBeNull()
  })

  it('só o responsável fora do app, sem lembrete ligado, troca o botão pelo telefone', async () => {
    const servico = await loadService()
    expect(servico.semCanalNoApp({ lembrete: null, responsavelNoApp: false })).toBe(true)
    expect(servico.semCanalNoApp({ lembrete: null, responsavelNoApp: true })).toBe(false)
    /* Ligado antes de o vínculo cair: o botão fica, para ver e desligar. */
    expect(servico.semCanalNoApp({ lembrete: LEMBRETE, responsavelNoApp: false })).toBe(false)
    /* Sem o campo, a API é anterior ao N42: o botão fica. */
    expect(servico.semCanalNoApp({ lembrete: null } as never)).toBe(false)
  })

  it('a situação: entrega, o motivo só quando não saiu e o próximo envio', async () => {
    const servico = await loadService()
    expect(servico.situacaoDoLembrete(LEMBRETE)).toEqual({
      entrega: 'ENTREGUE',
      motivo: null,
      proximoEnvioEm: '2026-12-06T09:00:00-03:00',
    })
    expect(
      servico.situacaoDoLembrete({
        ...LEMBRETE,
        entrega: 'FALHOU',
        motivoSemEnvio: 'TETO_DO_DIA',
        proximoEnvioEm: null,
      }),
    ).toEqual({ entrega: 'FALHOU', motivo: 'TETO_DO_DIA', proximoEnvioEm: null })
    /* Motivo que a tela não explica (ou sem FALHOU): fica só a entrega. */
    expect(
      servico.situacaoDoLembrete({ ...LEMBRETE, entrega: 'FALHOU', motivoSemEnvio: 'NAO_AVISAR' })
        .motivo,
    ).toBeNull()
    expect(
      servico.situacaoDoLembrete({ ...LEMBRETE, entrega: 'ENVIADO', motivoSemEnvio: 'SUPERADO' })
        .motivo,
    ).toBeNull()
  })
})

describe('o que ficou no navegador antes do N42', () => {
  it('apaga os lembretes guardados de todo parceiro e mais nada', async () => {
    const servico = await loadService()
    localStorage.setItem('pj.lembretes-de-vacina.p1', '{"ap1":{}}')
    localStorage.setItem('pj.lembretes-de-vacina.ativo', '{}')
    localStorage.setItem('pj.outra-coisa', 'fica')

    expect(servico.apagarLembretesGuardados()).toBe(2)
    expect(localStorage.getItem('pj.lembretes-de-vacina.p1')).toBeNull()
    expect(localStorage.getItem('pj.lembretes-de-vacina.ativo')).toBeNull()
    expect(localStorage.getItem('pj.outra-coisa')).toBe('fica')
    expect(servico.apagarLembretesGuardados()).toBe(0)
  })
})
