import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  criarAnotacaoEstruturadaForm,
  montarAnotacaoEstruturada,
} from '@/utils/parceiro/anotacao-estruturada'

import type { NovaAnotacaoPayload } from '../types'

const JSON_HEADERS = { 'content-type': 'application/json' }

async function loadService() {
  vi.resetModules()
  vi.stubEnv('VITE_API_URL', 'https://api.exemplo.test')

  return import('../compartilhamentos-service')
}

function mockFetch() {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify({ statusCode: 201, message: 'ok', data: {} }), {
      headers: JSON_HEADERS,
    }),
  )

  vi.stubGlobal('fetch', fetchMock)

  return fetchMock
}

function corpoEnviado(fetchMock: ReturnType<typeof mockFetch>): FormData {
  const body = fetchMock.mock.calls[0]?.[1]?.body

  if (!(body instanceof FormData)) {
    throw new Error('esperado FormData no corpo da requisição')
  }

  return body
}

function payload(overrides: Partial<NovaAnotacaoPayload> = {}): NovaAnotacaoPayload {
  return {
    servicoRealizado: 'Consulta de rotina',
    texto: 'Retorno em 15 dias.',
    tipoServico: 'CONSULTA',
    ...overrides,
  }
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('criarAnotacao — multipart estruturado', () => {
  it('não manda nenhum campo estruturado quando o formulário está vazio', async () => {
    const { criarAnotacao } = await loadService()
    const fetchMock = mockFetch()

    await criarAnotacao('c1', payload())

    const form = corpoEnviado(fetchMock)

    expect([...form.keys()]).toEqual(['servicoRealizado', 'texto'])
  })

  it('manda escalares como texto simples', async () => {
    const { criarAnotacao } = await loadService()
    const fetchMock = mockFetch()

    await criarAnotacao(
      'c1',
      payload({
        estruturado:
          montarAnotacaoEstruturada('CONSULTA', {
            ...criarAnotacaoEstruturadaForm(),
            motivo: 'Vômito há 2 dias',
            pesoKg: 12.4,
          }) ?? undefined,
      }),
    )

    const form = corpoEnviado(fetchMock)

    expect(form.get('motivo')).toBe('Vômito há 2 dias')
    expect(form.get('pesoKg')).toBe('12.4')
  })

  it('manda as listas como JSON string, nunca como campo repetido', async () => {
    const { criarAnotacao } = await loadService()
    const fetchMock = mockFetch()

    await criarAnotacao(
      'c1',
      payload({
        estruturado:
          montarAnotacaoEstruturada('CONSULTA', {
            ...criarAnotacaoEstruturadaForm(),
            prescricaoItens: [
              {
                nome: 'Omeprazol',
                dose: '10',
                unidade: 'mg',
                frequencia: '1x ao dia',
                duracaoDias: 7,
                instrucoes: '',
              },
            ],
            examesSolicitados: [{ nome: 'Hemograma', observacao: 'Em jejum' }],
          }) ?? undefined,
      }),
    )

    const form = corpoEnviado(fetchMock)

    expect(form.getAll('prescricaoItens')).toHaveLength(1)
    expect(JSON.parse(String(form.get('prescricaoItens')))).toEqual([
      { nome: 'Omeprazol', dose: '10', unidade: 'mg', frequencia: '1x ao dia', duracaoDias: 7 },
    ])
    expect(JSON.parse(String(form.get('examesSolicitados')))).toEqual([
      { nome: 'Hemograma', observacao: 'Em jejum' },
    ])
  })

  it('derruba campo incompatível com o tipo do acesso antes de ir para o fio', async () => {
    const { criarAnotacao } = await loadService()
    const fetchMock = mockFetch()

    // Payload já montado à mão, com campo clínico num acesso de banho.
    await criarAnotacao(
      'c1',
      payload({
        tipoServico: 'BANHO',
        estruturado: { produtos: 'Shampoo neutro', pesoKg: 12, motivo: 'Vômito' },
      }),
    )

    const form = corpoEnviado(fetchMock)

    expect(form.get('produtos')).toBe('Shampoo neutro')
    expect(form.has('pesoKg')).toBe(false)
    expect(form.has('motivo')).toBe(false)
  })

  it('OUTRO nunca leva campo estruturado', async () => {
    const { criarAnotacao } = await loadService()
    const fetchMock = mockFetch()

    await criarAnotacao('c1', payload({ tipoServico: 'OUTRO', estruturado: { motivo: 'Vômito' } }))

    expect([...corpoEnviado(fetchMock).keys()]).toEqual(['servicoRealizado', 'texto'])
  })

  it('mantém o campo de arquivo como `anexos`, com tiposDocumento paralelo', async () => {
    const { criarAnotacao } = await loadService()
    const fetchMock = mockFetch()

    await criarAnotacao(
      'c1',
      payload({
        anexos: [new File(['x'], 'laudo.pdf', { type: 'application/pdf' })],
        tiposDocumento: ['Ultrassom'],
      }),
    )

    const form = corpoEnviado(fetchMock)

    expect(form.getAll('anexos')).toHaveLength(1)
    expect(JSON.parse(String(form.get('tiposDocumento')))).toEqual(['Ultrassom'])
  })
})
