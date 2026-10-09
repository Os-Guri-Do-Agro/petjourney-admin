/**
 * Questionário pós-saque.
 *
 * O pior defeito possível aqui não é o questionário falhar: é ele assustar quem acabou de sacar.
 * Por isso metade destes testes confere silêncio — elegibilidade e dispensa nunca mostram erro — e
 * a outra metade confere a contagem de registros, porque uma dispensa gravada a mais (depois de
 * responder) ou a menos (fechando pelo X) estraga a regra das duas dispensas na API.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { FeedbackSaqueRegistrado } from '@/service/parceiro/types'

type Servico = typeof import('@/service/parceiro/parceiro-portal-service')

const servico = vi.hoisted(() => ({
  getFeedbackElegibilidade: vi.fn<Servico['getFeedbackElegibilidade']>(),
  registrarFeedbackSaque: vi.fn<Servico['registrarFeedbackSaque']>(),
}))

const REGISTRO: FeedbackSaqueRegistrado = { id: 'f1', status: 'RESPONDIDO', createdAt: '' }

vi.mock('@/service/parceiro/parceiro-portal-service', () => servico)

/** O estado é do módulo: cada teste carrega um novo, e o `ApiError` do mesmo grafo. */
async function carregar() {
  vi.resetModules()
  vi.stubEnv('VITE_API_URL', 'https://api.exemplo.test')

  const { ApiError } = await import('@/service/api')
  const { useFeedbackSaque } = await import('../useFeedbackSaque')

  return { ApiError, feedback: useFeedbackSaque() }
}

const RESPOSTA = {
  notaRecomendacao: 9,
  pontosPositivos: ['RAPIDEZ_SAQUE' as const],
  incentivos: [],
  sugestao: '  Mais material  ',
}

function chamadasCom(status: 'RESPONDIDO' | 'DISPENSADO') {
  return servico.registrarFeedbackSaque.mock.calls.filter(([corpo]) => corpo.status === status)
}

/** Promessa que o teste resolve na mão: o envio "em voo". */
function adiada<T>() {
  let resolver!: (valor: T) => void
  let rejeitar!: (motivo: unknown) => void
  const promessa = new Promise<T>((res, rej) => {
    resolver = res
    rejeitar = rej
  })

  return { promessa, resolver, rejeitar }
}

async function abrirQuestionario(feedback: Awaited<ReturnType<typeof carregar>>['feedback']) {
  await feedback.oferecer('s1', 'p1')
  expect(feedback.aberto.value).toBe(true)
}

beforeEach(() => {
  servico.getFeedbackElegibilidade.mockReset().mockResolvedValue({ exibir: true })
  servico.registrarFeedbackSaque.mockReset().mockResolvedValue(REGISTRO)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('oferecer — quando o questionário abre', () => {
  it('abre com `exibir` e consulta o parceiro do saque', async () => {
    const { feedback } = await carregar()

    await feedback.oferecer('s1', 'p1')

    expect(servico.getFeedbackElegibilidade).toHaveBeenCalledWith({ parceiroId: 'p1' })
    expect(feedback.aberto.value).toBe(true)
    expect(feedback.pedido.value).toEqual({ saqueId: 's1', parceiroId: 'p1' })
  })

  it('não abre sem `exibir`', async () => {
    const { feedback } = await carregar()
    servico.getFeedbackElegibilidade.mockResolvedValue({ exibir: false })

    await feedback.oferecer('s1', 'p1')

    expect(feedback.aberto.value).toBe(false)
  })

  it('engole erro da elegibilidade, sem abrir e sem lançar', async () => {
    const { ApiError, feedback } = await carregar()
    servico.getFeedbackElegibilidade.mockRejectedValue(new ApiError('Proibido', 403))

    await expect(feedback.oferecer('s1', 'p1')).resolves.toBeUndefined()
    expect(feedback.aberto.value).toBe(false)

    servico.getFeedbackElegibilidade.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(feedback.oferecer('s1', 'p1')).resolves.toBeUndefined()
    expect(feedback.aberto.value).toBe(false)
  })

  it('espera o diálogo do saque sair de cena antes de abrir', async () => {
    const { feedback } = await carregar()
    const saqueSaiu = adiada<void>()

    const oferta = feedback.oferecer('s1', 'p1', { depoisDe: saqueSaiu.promessa })
    await Promise.resolve()

    expect(feedback.aberto.value).toBe(false)

    saqueSaiu.resolver()
    await oferta

    expect(feedback.aberto.value).toBe(true)
  })

  it('não abre por cima de outra tela', async () => {
    const { feedback } = await carregar()
    const aoAbrir = vi.fn<() => void>()

    await feedback.oferecer('s1', 'p1', { aindaNaTela: () => false, aoAbrir })

    expect(feedback.aberto.value).toBe(false)
    expect(aoAbrir).not.toHaveBeenCalled()
  })

  it('avisa quem ofereceu quando abre de fato', async () => {
    const { feedback } = await carregar()
    const aoAbrir = vi.fn<() => void>()

    await feedback.oferecer('s1', 'p1', { aoAbrir })

    expect(aoAbrir).toHaveBeenCalledOnce()
  })

  it('não consulta nada sem o id do saque', async () => {
    const { feedback } = await carregar()

    await feedback.oferecer('', 'p1')

    expect(servico.getFeedbackElegibilidade).not.toHaveBeenCalled()
  })
})

describe('fechar sem enviar — a dispensa', () => {
  it('grava exatamente um DISPENSADO por saque', async () => {
    const { feedback } = await carregar()
    await abrirQuestionario(feedback)

    feedback.fechar()
    feedback.fechar()

    expect(feedback.aberto.value).toBe(false)
    expect(chamadasCom('DISPENSADO')).toEqual([
      [{ saqueId: 's1', status: 'DISPENSADO', versaoQuestionario: 1 }, { parceiroId: 'p1' }],
    ])
  })

  it('falha da dispensa não vira erro na tela', async () => {
    const { feedback } = await carregar()
    servico.registrarFeedbackSaque.mockRejectedValue(new TypeError('Failed to fetch'))
    await abrirQuestionario(feedback)

    feedback.fechar()
    await Promise.resolve()

    expect(feedback.erro.value).toBeNull()
  })

  it('o saque seguinte tem a própria dispensa', async () => {
    const { feedback } = await carregar()
    await abrirQuestionario(feedback)
    feedback.fechar()

    await feedback.oferecer('s2', 'p1')
    feedback.fechar()

    expect(chamadasCom('DISPENSADO').map(([corpo]) => corpo.saqueId)).toEqual(['s1', 's2'])
  })
})

describe('enviar — a resposta', () => {
  it('grava RESPONDIDO com a sugestão aparada, fecha e não dispensa depois', async () => {
    const { feedback } = await carregar()
    await abrirQuestionario(feedback)

    await expect(feedback.enviar(RESPOSTA)).resolves.toBe(true)
    feedback.fechar()

    expect(feedback.aberto.value).toBe(false)
    expect(chamadasCom('DISPENSADO')).toHaveLength(0)
    expect(chamadasCom('RESPONDIDO')[0]?.[0]).toEqual({
      saqueId: 's1',
      status: 'RESPONDIDO',
      versaoQuestionario: 1,
      notaRecomendacao: 9,
      pontosPositivos: ['RAPIDEZ_SAQUE'],
      incentivos: [],
      sugestao: 'Mais material',
    })
  })

  it('sugestão só de espaço não vai', async () => {
    const { feedback } = await carregar()
    await abrirQuestionario(feedback)

    await feedback.enviar({ ...RESPOSTA, sugestao: '   ' })

    expect(chamadasCom('RESPONDIDO')[0]?.[0].sugestao).toBeUndefined()
  })

  it('fechar durante o envio fecha na hora e não dispensa', async () => {
    const { feedback } = await carregar()
    const envio = adiada<FeedbackSaqueRegistrado>()
    await abrirQuestionario(feedback)
    servico.registrarFeedbackSaque.mockReturnValueOnce(envio.promessa)

    const enviado = feedback.enviar(RESPOSTA)
    feedback.fechar()

    expect(feedback.aberto.value).toBe(false)

    envio.resolver(REGISTRO)

    await expect(enviado).resolves.toBe(true)
    expect(chamadasCom('DISPENSADO')).toHaveLength(0)
  })

  it('falha depois de fechar durante o envio não mostra nada', async () => {
    const { feedback } = await carregar()
    const envio = adiada<FeedbackSaqueRegistrado>()
    await abrirQuestionario(feedback)
    servico.registrarFeedbackSaque.mockReturnValueOnce(envio.promessa)

    const enviado = feedback.enviar(RESPOSTA)
    feedback.fechar()
    envio.rejeitar(new TypeError('Failed to fetch'))

    await expect(enviado).resolves.toBe(false)
    expect(feedback.erro.value).toBeNull()
  })

  it('erro de rede mantém aberto, avisa e deixa tentar de novo', async () => {
    const { feedback } = await carregar()
    await abrirQuestionario(feedback)
    servico.registrarFeedbackSaque.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    await expect(feedback.enviar(RESPOSTA)).resolves.toBe(false)

    expect(feedback.aberto.value).toBe(true)
    expect(feedback.erro.value).toEqual({ tipo: 'envio' })

    await expect(feedback.enviar(RESPOSTA)).resolves.toBe(true)
    expect(feedback.erro.value).toBeNull()
    expect(feedback.aberto.value).toBe(false)
  })

  it('409 "já registrado" fecha em silêncio e não dispensa depois', async () => {
    const { ApiError, feedback } = await carregar()
    await abrirQuestionario(feedback)
    servico.registrarFeedbackSaque.mockRejectedValueOnce(
      new ApiError('Já registrado.', 409, undefined, 'FEEDBACK_JA_REGISTRADO'),
    )

    await feedback.enviar(RESPOSTA)
    feedback.fechar()

    expect(feedback.aberto.value).toBe(false)
    expect(feedback.erro.value).toBeNull()
    expect(chamadasCom('DISPENSADO')).toHaveLength(0)
  })

  it('409 "fora do prazo" mostra a frase da API e não deixa reenviar nem dispensar', async () => {
    const { ApiError, feedback } = await carregar()
    await abrirQuestionario(feedback)
    servico.registrarFeedbackSaque.mockRejectedValueOnce(
      new ApiError('O prazo terminou.', 409, undefined, 'FEEDBACK_FORA_DO_PRAZO'),
    )

    await feedback.enviar(RESPOSTA)

    expect(feedback.aberto.value).toBe(true)
    expect(feedback.erro.value).toEqual({ tipo: 'prazo', mensagem: 'O prazo terminou.' })

    await expect(feedback.enviar(RESPOSTA)).resolves.toBe(false)
    feedback.fechar()

    expect(servico.registrarFeedbackSaque).toHaveBeenCalledTimes(1)
  })

  it('toque duplo em Enviar manda uma resposta só', async () => {
    const { feedback } = await carregar()
    await abrirQuestionario(feedback)

    await Promise.all([feedback.enviar(RESPOSTA), feedback.enviar(RESPOSTA)])

    expect(chamadasCom('RESPONDIDO')).toHaveLength(1)
  })
})
