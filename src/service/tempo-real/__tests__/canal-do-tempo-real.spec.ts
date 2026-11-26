/**
 * O canal de tempo real (PJ-3SO0WX, guia do front seção 2): ticket novo a cada abertura, espera
 * crescente com sorteio, vigia de 60 s, os motivos do `canal.encerrado` e as respostas do ticket.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  CanalDoTempoReal,
  type AvisoDoTempoReal,
  type FonteDeEventos,
} from '../canal-do-tempo-real'

class FonteFalsa implements FonteDeEventos {
  onmessage: ((evento: MessageEvent) => void) | null = null
  onerror: ((evento: Event) => void) | null = null
  fechada = false

  constructor(readonly ticket: string) {}

  close() {
    this.fechada = true
  }

  mandar(mensagem: unknown) {
    this.onmessage?.(mensagemDoCanal(mensagem))
  }

  falhar() {
    this.onerror?.(new Event('error'))
  }
}

function mensagemDoCanal(mensagem: unknown) {
  return new MessageEvent('message', {
    data: typeof mensagem === 'string' ? mensagem : JSON.stringify(mensagem),
  })
}

function erroDaApi(statusCode: number, detalhes: Record<string, unknown> = {}) {
  return Object.assign(new Error(`HTTP ${statusCode}`), { statusCode, detalhes })
}

let fontes: FonteFalsa[]
let tickets: string[]
let pedirTicket: ReturnType<typeof vi.fn<(parceiroId: string) => Promise<{ ticket: string }>>>
let sessao: boolean
let sorteio: number
let avisos: AvisoDoTempoReal[]
let releituras: number
let aoVivo: boolean[]
let acessoPerdido: number

function criar() {
  return new CanalDoTempoReal(
    {
      pedirTicket,
      abrirFonte: (ticket) => {
        const fonte = new FonteFalsa(ticket)
        fontes.push(fonte)
        return fonte
      },
      temSessao: () => sessao,
      sortear: () => sorteio,
    },
    {
      aoAvisar: (aviso) => avisos.push(aviso),
      aoReler: () => (releituras += 1),
      aoMudarAoVivo: (valor) => aoVivo.push(valor),
      aoPerderAcesso: () => (acessoPerdido += 1),
    },
  )
}

const ultima = () => fontes[fontes.length - 1]!

/** Espera as promessas do ticket e da abertura (sem andar o relógio). */
async function assentar() {
  for (let i = 0; i < 5; i += 1) await Promise.resolve()
}

async function abertoEPronto(canal: CanalDoTempoReal, parceiroId = 'p1') {
  canal.ligar(parceiroId)
  await assentar()
  ultima().mandar({ tipo: 'canal.pronto' })
  return ultima()
}

beforeEach(() => {
  vi.useFakeTimers()
  fontes = []
  tickets = []
  sessao = true
  sorteio = 1
  avisos = []
  releituras = 0
  aoVivo = []
  acessoPerdido = 0
  let n = 0
  pedirTicket = vi.fn<(parceiroId: string) => Promise<{ ticket: string }>>(async (parceiroId) => {
    n += 1
    const ticket = `t${n}-${parceiroId}`
    tickets.push(ticket)
    return { ticket }
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('abrir', () => {
  it('pede o ticket com o parceiro e abre a fonte com ele; o canal.pronto relê e põe ao vivo', async () => {
    const canal = criar()
    const fonte = await abertoEPronto(canal)

    expect(pedirTicket).toHaveBeenCalledWith('p1')
    expect(fonte.ticket).toBe('t1-p1')
    expect(releituras).toBe(1)
    expect(canal.estaAoVivo).toBe(true)
    expect(aoVivo).toEqual([true])
  })

  it('sem login nesta aba nem pede o ticket', async () => {
    sessao = false
    const canal = criar()
    canal.ligar('p1')
    await assentar()

    expect(pedirTicket).not.toHaveBeenCalled()
    expect(canal.motivoDaParada).toBe('SEM_SESSAO')
  })

  it('ligar de novo com o mesmo parceiro não abre outra conexão', async () => {
    const canal = criar()
    await abertoEPronto(canal)
    canal.ligar('p1')
    await assentar()

    expect(pedirTicket).toHaveBeenCalledTimes(1)
    expect(fontes).toHaveLength(1)
  })

  it('outro parceiro: fecha o canal do anterior e abre com o novo parceiroId', async () => {
    const canal = criar()
    const primeira = await abertoEPronto(canal, 'p1')
    canal.ligar('p2')
    await assentar()

    expect(primeira.fechada).toBe(true)
    expect(pedirTicket).toHaveBeenLastCalledWith('p2')
    expect(ultima().ticket).toBe('t2-p2')
    expect(canal.estaAoVivo).toBe(false)
  })

  it('desligar fecha a fonte e cancela a reabertura que estava marcada', async () => {
    const canal = criar()
    const fonte = await abertoEPronto(canal)
    fonte.falhar()
    canal.desligar()
    await vi.advanceTimersByTimeAsync(120_000)

    expect(fonte.fechada).toBe(true)
    expect(pedirTicket).toHaveBeenCalledTimes(1)
    expect(canal.estaAoVivo).toBe(false)
  })

  it('a resposta de um ticket pedido antes de desligar não abre nada', async () => {
    let soltar!: (valor: { ticket: string }) => void
    pedirTicket.mockImplementationOnce(() => new Promise((resolve) => (soltar = resolve)))
    const canal = criar()
    canal.ligar('p1')
    canal.desligar()
    soltar({ ticket: 'velho' })
    await assentar()

    expect(fontes).toHaveLength(0)
  })
})

describe('mensagens', () => {
  it('o aviso segue com tipo e id; o canal.releia relê; o batimento não faz nada', async () => {
    const canal = criar()
    const fonte = await abertoEPronto(canal)
    fonte.mandar({ tipo: 'internacao.checklist', id: 'int1' })
    fonte.mandar({ tipo: 'canal.batimento' })
    fonte.mandar({ tipo: 'canal.releia' })

    expect(avisos).toEqual([{ tipo: 'internacao.checklist', id: 'int1' }])
    expect(releituras).toBe(2)
  })

  it('ignora o que não é JSON, sem tipo, sem id e o controle que não conhece', async () => {
    const canal = criar()
    const fonte = await abertoEPronto(canal)
    fonte.mandar('isto não é json')
    fonte.mandar({ id: 'x' })
    fonte.mandar({ tipo: 'fila.oferta' })
    fonte.mandar({ tipo: 'canal.novidade', id: 'x' })
    fonte.mandar('null')

    expect(avisos).toEqual([])
    expect(releituras).toBe(1)
  })

  it('aviso de tipo novo segue (cada tela só ouve os tipos dela)', async () => {
    const canal = criar()
    const fonte = await abertoEPronto(canal)
    fonte.mandar({ tipo: 'convite.respondido', id: 'c1' })

    expect(avisos).toEqual([{ tipo: 'convite.respondido', id: 'c1' }])
  })

  it('mensagem da fonte velha, depois da reabertura, não chega', async () => {
    const canal = criar()
    const velha = await abertoEPronto(canal)
    const manipulador = velha.onmessage!
    velha.mandar({ tipo: 'canal.encerrado', motivo: 'RENOVAR' })
    await assentar()
    manipulador(mensagemDoCanal({ tipo: 'fila.oferta', id: 'e1' }))

    expect(avisos).toEqual([])
    expect(fontes).toHaveLength(2)
  })
})

describe('espera crescente', () => {
  it('cada erro fecha a fonte (a reconexão do EventSource levaria 401) e espera 1, 2, 4... até 60 s', async () => {
    const canal = criar()
    canal.ligar('p1')
    await assentar()

    const esperas = [1_000, 2_000, 4_000, 8_000, 16_000, 32_000, 60_000, 60_000]
    for (const espera of esperas) {
      const fonte = ultima()
      const pedidos = pedirTicket.mock.calls.length
      fonte.falhar()
      expect(fonte.fechada).toBe(true)

      await vi.advanceTimersByTimeAsync(espera - 1)
      expect(pedirTicket).toHaveBeenCalledTimes(pedidos)
      await vi.advanceTimersByTimeAsync(1)
      expect(pedirTicket).toHaveBeenCalledTimes(pedidos + 1)
      await assentar()
    }

    /* Ticket novo em toda abertura. */
    expect(new Set(fontes.map((fonte) => fonte.ticket)).size).toBe(fontes.length)
  })

  it('o sorteio tira até metade da espera', async () => {
    sorteio = 0
    const canal = criar()
    canal.ligar('p1')
    await assentar()
    ultima().falhar()
    await vi.advanceTimersByTimeAsync(499)
    expect(pedirTicket).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(pedirTicket).toHaveBeenCalledTimes(2)

    await assentar()
    ultima().falhar()
    await vi.advanceTimersByTimeAsync(999)
    expect(pedirTicket).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(pedirTicket).toHaveBeenCalledTimes(3)
  })

  it('o canal.pronto zera a espera', async () => {
    const canal = criar()
    canal.ligar('p1')
    await assentar()
    ultima().falhar()
    await vi.advanceTimersByTimeAsync(1_000)
    await assentar()
    ultima().falhar()
    await vi.advanceTimersByTimeAsync(2_000)
    await assentar()
    ultima().mandar({ tipo: 'canal.pronto' })

    const pedidos = pedirTicket.mock.calls.length
    expect(pedidos).toBe(3)
    ultima().falhar()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(pedirTicket).toHaveBeenCalledTimes(pedidos + 1)
  })

  it('ticket que falha pela rede ou 5xx também espera e tenta de novo', async () => {
    pedirTicket.mockRejectedValueOnce(erroDaApi(0)).mockRejectedValueOnce(erroDaApi(500))
    const canal = criar()
    canal.ligar('p1')
    await assentar()
    expect(fontes).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(1_000)
    expect(pedirTicket).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(2_000)
    expect(pedirTicket).toHaveBeenCalledTimes(3)
    await assentar()
    expect(fontes).toHaveLength(1)
  })
})

describe('vigia', () => {
  it('60 s sem nenhuma mensagem: fecha e reabre', async () => {
    const canal = criar()
    const fonte = await abertoEPronto(canal)
    await vi.advanceTimersByTimeAsync(59_999)
    expect(fonte.fechada).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    expect(fonte.fechada).toBe(true)
    expect(canal.estaAoVivo).toBe(false)

    await vi.advanceTimersByTimeAsync(1_000)
    expect(pedirTicket).toHaveBeenCalledTimes(2)
  })

  it('o batimento a cada 25 s mantém a conexão', async () => {
    const canal = criar()
    const fonte = await abertoEPronto(canal)
    for (let i = 0; i < 10; i += 1) {
      await vi.advanceTimersByTimeAsync(25_000)
      fonte.mandar({ tipo: 'canal.batimento' })
    }

    expect(fonte.fechada).toBe(false)
    expect(pedirTicket).toHaveBeenCalledTimes(1)
  })

  it('a abertura que fica sem resposta também cai no vigia', async () => {
    const canal = criar()
    canal.ligar('p1')
    await assentar()
    await vi.advanceTimersByTimeAsync(60_000)

    expect(ultima().fechada).toBe(true)
  })
})

describe('canal.encerrado', () => {
  it('RENOVAR: reabre na hora, com ticket novo', async () => {
    const canal = criar()
    const fonte = await abertoEPronto(canal)
    fonte.mandar({ tipo: 'canal.encerrado', motivo: 'RENOVAR' })
    await assentar()

    expect(fonte.fechada).toBe(true)
    expect(pedirTicket).toHaveBeenCalledTimes(2)
    expect(ultima().ticket).toBe('t2-p1')
  })

  it('LENTO: reabre com espera', async () => {
    const canal = criar()
    const fonte = await abertoEPronto(canal)
    fonte.mandar({ tipo: 'canal.encerrado', motivo: 'LENTO' })
    await assentar()
    expect(fonte.fechada).toBe(true)
    expect(pedirTicket).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1_000)
    expect(pedirTicket).toHaveBeenCalledTimes(2)
  })

  it('SESSAO_ENCERRADA com o login valendo: pede ticket e volta', async () => {
    const canal = criar()
    const fonte = await abertoEPronto(canal)
    fonte.mandar({ tipo: 'canal.encerrado', motivo: 'SESSAO_ENCERRADA' })
    await assentar()

    expect(pedirTicket).toHaveBeenCalledTimes(2)
    ultima().mandar({ tipo: 'canal.pronto' })
    expect(canal.estaAoVivo).toBe(true)
  })

  it('SESSAO_ENCERRADA sem login: para', async () => {
    const canal = criar()
    const fonte = await abertoEPronto(canal)
    sessao = false
    fonte.mandar({ tipo: 'canal.encerrado', motivo: 'SESSAO_ENCERRADA' })
    await vi.advanceTimersByTimeAsync(120_000)

    expect(pedirTicket).toHaveBeenCalledTimes(1)
    expect(canal.motivoDaParada).toBe('SEM_SESSAO')
  })

  it('SESSAO_ENCERRADA e o ticket dá 401: para', async () => {
    const canal = criar()
    const fonte = await abertoEPronto(canal)
    pedirTicket.mockRejectedValueOnce(erroDaApi(401))
    fonte.mandar({ tipo: 'canal.encerrado', motivo: 'SESSAO_ENCERRADA' })
    await vi.advanceTimersByTimeAsync(120_000)

    expect(pedirTicket).toHaveBeenCalledTimes(2)
    expect(fontes).toHaveLength(1)
    expect(canal.motivoDaParada).toBe('SEM_SESSAO')
  })

  it('ACESSO_REVOGADO: para, avisa e não tenta de novo com esse parceiro (com outro, sim)', async () => {
    const canal = criar()
    const fonte = await abertoEPronto(canal, 'p1')
    fonte.mandar({ tipo: 'canal.encerrado', motivo: 'ACESSO_REVOGADO' })
    await vi.advanceTimersByTimeAsync(120_000)

    expect(acessoPerdido).toBe(1)
    expect(canal.motivoDaParada).toBe('SEM_ACESSO')
    canal.ligar('p1')
    await assentar()
    expect(pedirTicket).toHaveBeenCalledTimes(1)

    canal.ligar('p2')
    await assentar()
    expect(pedirTicket).toHaveBeenLastCalledWith('p2')
  })

  it('SUBSTITUIDA: não reconecta, nem ao religar, até a sessão acabar', async () => {
    const canal = criar()
    const fonte = await abertoEPronto(canal)
    fonte.mandar({ tipo: 'canal.encerrado', motivo: 'SUBSTITUIDA' })
    await vi.advanceTimersByTimeAsync(120_000)

    expect(fonte.fechada).toBe(true)
    expect(canal.motivoDaParada).toBe('SUBSTITUIDA')
    expect(canal.estaAoVivo).toBe(false)

    canal.desligar()
    canal.ligar('p1')
    canal.ligar('p2')
    await assentar()
    expect(pedirTicket).toHaveBeenCalledTimes(1)

    canal.encerrarSessao()
    canal.ligar('p1')
    await assentar()
    expect(pedirTicket).toHaveBeenCalledTimes(2)
  })

  it('motivo que não conhece: reabre com espera', async () => {
    const canal = criar()
    const fonte = await abertoEPronto(canal)
    fonte.mandar({ tipo: 'canal.encerrado', motivo: 'OUTRO' })
    await vi.advanceTimersByTimeAsync(1_000)

    expect(pedirTicket).toHaveBeenCalledTimes(2)
  })
})

describe('respostas do ticket', () => {
  it('404: o canal está desligado no ambiente; não tenta mais nesta sessão', async () => {
    pedirTicket.mockRejectedValueOnce(erroDaApi(404))
    const canal = criar()
    canal.ligar('p1')
    await vi.advanceTimersByTimeAsync(300_000)

    expect(pedirTicket).toHaveBeenCalledTimes(1)
    expect(canal.motivoDaParada).toBe('DESLIGADO')

    canal.ligar('p2')
    await assentar()
    expect(pedirTicket).toHaveBeenCalledTimes(1)
  })

  it('403: não tenta de novo com esse parceiro', async () => {
    pedirTicket.mockRejectedValueOnce(erroDaApi(403))
    const canal = criar()
    canal.ligar('p1')
    await vi.advanceTimersByTimeAsync(300_000)

    expect(pedirTicket).toHaveBeenCalledTimes(1)
    expect(canal.motivoDaParada).toBe('SEM_ACESSO')
    expect(acessoPerdido).toBe(0)
  })

  it('401: o login acabou; para', async () => {
    pedirTicket.mockRejectedValueOnce(erroDaApi(401))
    const canal = criar()
    canal.ligar('p1')
    await vi.advanceTimersByTimeAsync(300_000)

    expect(pedirTicket).toHaveBeenCalledTimes(1)
    expect(canal.motivoDaParada).toBe('SEM_SESSAO')
  })

  it('429: espera o tenteDeNovoEmSegundos antes de pedir de novo', async () => {
    pedirTicket.mockRejectedValueOnce(erroDaApi(429, { tenteDeNovoEmSegundos: 90 }))
    const canal = criar()
    canal.ligar('p1')
    await assentar()

    await vi.advanceTimersByTimeAsync(89_999)
    expect(pedirTicket).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(pedirTicket).toHaveBeenCalledTimes(2)
  })

  it('a sessão nova esquece o "desligado" da anterior', async () => {
    pedirTicket.mockRejectedValueOnce(erroDaApi(404))
    const canal = criar()
    canal.ligar('p1')
    await assentar()
    canal.encerrarSessao()
    canal.ligar('p1')
    await assentar()

    expect(pedirTicket).toHaveBeenCalledTimes(2)
    expect(fontes).toHaveLength(1)
  })
})
