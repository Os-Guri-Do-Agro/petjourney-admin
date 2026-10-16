/**
 * Andamento da leitura de receita com IA na anotação de consulta do portal.
 *
 * Os defeitos caros aqui são silenciosos: os remédios entrarem duas vezes na prescrição, uma
 * resposta velha (de uma leitura cancelada) escrever no formulário, a espera nunca parar de
 * perguntar, e o botão continuar na tela depois de a API dizer que o recurso está desligado.
 */

import { effectScope, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LeituraReceitaParceiro } from '@/service/parceiro/types'

type Servico = typeof import('@/service/parceiro/compartilhamentos-service')
type Resultado = { aplicados: number; cortados: number; temConferir: boolean }

const servico = vi.hoisted(() => ({
  criarLeituraReceita: vi.fn<Servico['criarLeituraReceita']>(),
  getLeituraReceita: vi.fn<Servico['getLeituraReceita']>(),
}))

vi.mock('@/service/parceiro/compartilhamentos-service', () => servico)

function leitura(overrides: Partial<LeituraReceitaParceiro> = {}): LeituraReceitaParceiro {
  return {
    id: 'l1',
    status: 'PROCESSANDO',
    anotacaoId: null,
    motivoFalha: null,
    mensagemFalha: null,
    itensFormulario: [],
    confianca: [],
    avisos: [],
    arquivos: [],
    ...overrides,
  }
}

const PRONTA = leitura({
  status: 'AGUARDANDO_CONFIRMACAO',
  itensFormulario: [
    {
      nome: 'Dipirona',
      dose: '1 gota',
      unidade: 'gota',
      frequencia: '8/8h',
      duracaoDias: 3,
      instrucoes: null,
    },
  ],
  confianca: [{ nome: 'ALTA', dose: 'ALTA', frequencia: 'ALTA', duracaoDias: 'ALTA' }],
  arquivos: [{ ordem: 0, mimetype: 'image/jpeg', url: 'https://arquivo' }],
})

const foto = (nome = 'receita.jpg') => new File(['x'], nome, { type: 'image/jpeg' })

/** O estado do `ApiError` é do módulo: cada teste carrega um grafo novo. */
async function carregar(anexos = 0) {
  vi.resetModules()
  vi.stubEnv('VITE_API_URL', 'https://api.exemplo.test')

  const { ApiError } = await import('@/service/api')
  const { useLeituraReceitaParceiro } = await import('../useLeituraReceitaParceiro')

  const anexosDoFormulario = ref(anexos)
  const aoLer = vi.fn<(lida: LeituraReceitaParceiro) => Resultado>(() => ({
    aplicados: 1,
    cortados: 0,
    temConferir: false,
  }))
  const aoEncerrarAcesso = vi.fn<() => void>()
  const aoFicarIndisponivel = vi.fn<(mensagem: string) => void>()
  const escopo = effectScope()
  const estado = escopo.run(() =>
    useLeituraReceitaParceiro({
      compartilhamentoId: 'c1',
      parceiroQuery: () => ({ parceiroId: 'p9' }),
      anexosDoFormulario,
      aoLer,
      aoEncerrarAcesso,
      aoFicarIndisponivel,
      reduzirImagem: async (arquivo) => arquivo,
    }),
  )!

  return {
    ApiError,
    estado,
    escopo,
    anexosDoFormulario,
    aoLer,
    aoEncerrarAcesso,
    aoFicarIndisponivel,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  servico.criarLeituraReceita.mockReset()
  servico.getLeituraReceita.mockReset()
  servico.criarLeituraReceita.mockResolvedValue({ id: 'l1', status: 'PROCESSANDO' })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('fluxo da leitura', () => {
  it('escolhe, manda, espera com recuo e põe os remédios uma vez só', async () => {
    const { estado, aoLer } = await carregar()
    servico.getLeituraReceita.mockResolvedValueOnce(leitura()).mockResolvedValue(PRONTA)

    await estado.adicionarArquivos([foto()])
    expect(estado.etapa).toBe('escolhendo')
    expect(estado.reservados).toBe(1)
    expect(estado.ocupada).toBe(true)

    await estado.enviar()
    expect(servico.criarLeituraReceita).toHaveBeenCalledWith('c1', [expect.any(File)], {
      parceiroId: 'p9',
    })
    expect(estado.etapa).toBe('lendo')

    await vi.advanceTimersByTimeAsync(2000)
    expect(servico.getLeituraReceita).toHaveBeenCalledTimes(1)
    expect(estado.etapa).toBe('lendo')

    await vi.advanceTimersByTimeAsync(2000)
    expect(estado.etapa).toBe('pronta')
    expect(aoLer).toHaveBeenCalledTimes(1)
    expect(estado.leituraReceitaId).toBe('l1')
    expect(estado.reservados).toBe(1)
    expect(estado.ocupada).toBe(false)
    expect(estado.resultado).toMatchObject({ lidos: 1, aplicados: 1, cortados: 0 })

    // Pronta, a espera para: nada mais é consultado nem aplicado.
    await vi.advanceTimersByTimeAsync(30_000)
    expect(servico.getLeituraReceita).toHaveBeenCalledTimes(2)
    expect(aoLer).toHaveBeenCalledTimes(1)
  })

  it('para de perguntar por volta de 60 s (na consulta que passa do prazo) e "Ver de novo" volta a consultar', async () => {
    const { estado } = await carregar()
    servico.getLeituraReceita.mockResolvedValue(leitura())

    await estado.adicionarArquivos([foto()])
    await estado.enviar()
    await vi.advanceTimersByTimeAsync(56_000)
    expect(estado.etapa).toBe('lendo')
    // Consultas aos 2, 4, 7, 12... 57 s; a dos 62 s já passou do prazo.
    await vi.advanceTimersByTimeAsync(7_000)
    expect(estado.etapa).toBe('demorou')
    const consultas = servico.getLeituraReceita.mock.calls.length

    await vi.advanceTimersByTimeAsync(30_000)
    expect(servico.getLeituraReceita.mock.calls.length).toBe(consultas)

    servico.getLeituraReceita.mockResolvedValue(PRONTA)
    estado.verDeNovo()
    expect(estado.etapa).toBe('lendo')
    await vi.advanceTimersByTimeAsync(2000)
    expect(estado.etapa).toBe('pronta')
  })

  it('falha da leitura mostra a mensagem da API', async () => {
    const { estado, aoLer } = await carregar()
    servico.getLeituraReceita.mockResolvedValue(
      leitura({ status: 'FALHOU', mensagemFalha: 'A foto está ilegível.' }),
    )

    await estado.adicionarArquivos([foto()])
    await estado.enviar()
    await vi.advanceTimersByTimeAsync(2000)

    expect(estado.etapa).toBe('falhou')
    expect(estado.mensagemFalha).toBe('A foto está ilegível.')
    expect(estado.reservados).toBe(0)
    expect(aoLer).not.toHaveBeenCalled()
  })

  it('cancelar no meio da espera ignora a resposta que chegar depois', async () => {
    const { estado, aoLer } = await carregar()
    let responder!: (valor: LeituraReceitaParceiro) => void
    servico.getLeituraReceita.mockReturnValue(new Promise((r) => (responder = r)))

    await estado.adicionarArquivos([foto()])
    await estado.enviar()
    await vi.advanceTimersByTimeAsync(2000)
    estado.limpar()
    responder(PRONTA)
    await vi.advanceTimersByTimeAsync(0)

    expect(estado.etapa).toBe('inicial')
    expect(aoLer).not.toHaveBeenCalled()
  })

  it('três falhas de rede seguidas param a espera com o erro', async () => {
    const { estado } = await carregar()
    servico.getLeituraReceita.mockRejectedValue(new Error('Sem conexão'))

    await estado.adicionarArquivos([foto()])
    await estado.enviar()
    await vi.advanceTimersByTimeAsync(2000 + 2000 + 3000)

    expect(estado.etapa).toBe('erroConsulta')
    expect(estado.erroConsulta).toBe('Sem conexão')
  })
})

describe('arquivos e teto de anexos', () => {
  it('HEIC vira aviso e não entra na lista', async () => {
    const { estado } = await carregar()

    await estado.adicionarArquivos([new File(['x'], 'IMG_0001.HEIC', { type: 'image/heic' })])

    expect(estado.arquivos).toHaveLength(0)
    expect(estado.etapa).toBe('inicial')
    expect(estado.aviso).toMatchObject({ tipo: 'problema', problema: 'HEIC' })
  })

  it('com 3 anexos no formulário não há lugar para a receita', async () => {
    const { estado } = await carregar(3)

    await estado.adicionarArquivos([foto()])

    expect(estado.arquivos).toHaveLength(0)
    expect(estado.aviso).toEqual({ tipo: 'semVaga' })
  })

  it('a receita só cabe nas vagas que sobram', async () => {
    const { estado } = await carregar(2)

    await estado.adicionarArquivos([foto('a.jpg'), foto('b.jpg')])

    expect(estado.arquivos).toHaveLength(1)
    expect(estado.aviso).toMatchObject({ problema: 'LIMITE', maximo: 1 })
  })
})

describe('erros do envio', () => {
  it('503 esconde o botão e avisa com a mensagem da API', async () => {
    const { ApiError, estado, aoFicarIndisponivel } = await carregar()
    servico.criarLeituraReceita.mockRejectedValue(new ApiError('Recurso indisponível', 503))

    await estado.adicionarArquivos([foto()])
    await estado.enviar()

    expect(estado.disponivel).toBe(false)
    expect(estado.etapa).toBe('inicial')
    expect(aoFicarIndisponivel).toHaveBeenCalledWith('Recurso indisponível')
  })

  it('409 no envio ou na consulta: o acesso encerrou', async () => {
    const { ApiError, estado, aoEncerrarAcesso } = await carregar()
    servico.getLeituraReceita.mockRejectedValue(new ApiError('Encerrado', 409))

    await estado.adicionarArquivos([foto()])
    await estado.enviar()
    await vi.advanceTimersByTimeAsync(2000)

    expect(aoEncerrarAcesso).toHaveBeenCalledTimes(1)
    expect(estado.etapa).toBe('inicial')
  })

  it('429 do limite do dia mostra a mensagem e mantém os arquivos para tentar de novo', async () => {
    const { ApiError, estado } = await carregar()
    servico.criarLeituraReceita.mockRejectedValue(
      new ApiError(
        'A equipe já usou as leituras de hoje.',
        429,
        undefined,
        'LEITURA_RECEITA_LIMITE_DIARIO_PARCEIRO',
      ),
    )

    await estado.adicionarArquivos([foto()])
    await estado.enviar()

    expect(estado.etapa).toBe('escolhendo')
    expect(estado.arquivos).toHaveLength(1)
    expect(estado.aviso).toEqual({
      tipo: 'mensagem',
      texto: 'A equipe já usou as leituras de hoje.',
    })
    expect(estado.disponivel).toBe(true)
  })
})
