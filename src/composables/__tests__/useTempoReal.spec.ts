/**
 * As telas no canal de tempo real (PJ-3SO0WX, guia do front seções 2.3.5, 3 e 4): um canal por aba
 * com o parceiro em uso, a rajada de avisos em 500 ms vira uma releitura, só os avisos da tela
 * chamam, e o polling de reserva escolhe o intervalo pelo canal.
 */
import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, reactive, ref, type Ref } from 'vue'

import { authSessionVersion } from '@/service/auth/auth-session'
import { useParceiroStore } from '@/stores/parceiro'

import { useReleituraDeReserva, useTempoReal, type OpcoesDoTempoReal } from '../useTempoReal'

const servico = vi.hoisted(() => ({
  pedirTicketDoTempoReal: vi.fn<(parceiroId: string) => Promise<{ ticket: string }>>(),
  enderecoDoCanal: (ticket: string) => `https://api.teste/eventos?ticket=${ticket}`,
}))
const sessao = vi.hoisted(() => ({ token: 'jwt' as string | null }))
const loja = vi.hoisted(() => ({
  parceiroId: 'p1' as string | null,
  bootstrap: vi.fn<(forcar?: boolean) => Promise<void>>(async () => {}),
}))

vi.mock('@/service/tempo-real/tempo-real-service', () => servico)
vi.mock('@/service/auth/auth-session', async () => {
  const { ref: criarRef } = await import('vue')
  return { authSessionVersion: criarRef(0), getAccessToken: () => sessao.token }
})
vi.mock('@/stores/parceiro', async () => {
  const { reactive: reativo } = await import('vue')
  const estado = reativo(loja)
  return { useParceiroStore: () => estado }
})

class EventSourceFalso {
  static todas: EventSourceFalso[] = []
  onmessage: ((evento: MessageEvent) => void) | null = null
  onerror: ((evento: Event) => void) | null = null
  fechada = false

  constructor(readonly url: string) {
    EventSourceFalso.todas.push(this)
  }

  close() {
    this.fechada = true
  }

  mandar(mensagem: unknown) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(mensagem) }))
  }
}

const abertas = () => EventSourceFalso.todas.filter((fonte) => !fonte.fechada)
const ultima = () => EventSourceFalso.todas[EventSourceFalso.todas.length - 1]!

async function assentar() {
  for (let i = 0; i < 8; i += 1) await Promise.resolve()
}

const montadas: VueWrapper[] = []

function desmontar(wrapper: VueWrapper) {
  montadas.splice(montadas.indexOf(wrapper), 1)
  wrapper.unmount()
}

function tela(opcoes: Partial<OpcoesDoTempoReal> & { aoMudar: () => void }) {
  let aoVivo!: ReturnType<typeof useTempoReal>['aoVivo']
  const wrapper = mount(
    defineComponent({
      setup() {
        aoVivo = useTempoReal({ tipos: ['internacao.checklist'], ...opcoes }).aoVivo
        return () => null
      },
    }),
  )
  montadas.push(wrapper)
  return { wrapper, aoVivo: () => aoVivo.value }
}

async function pronto() {
  await assentar()
  ultima().mandar({ tipo: 'canal.pronto' })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('EventSource', EventSourceFalso)
  EventSourceFalso.todas = []
  let n = 0
  servico.pedirTicketDoTempoReal.mockReset()
  servico.pedirTicketDoTempoReal.mockImplementation(async () => ({ ticket: `t${(n += 1)}` }))
  loja.bootstrap.mockClear()
})

afterEach(async () => {
  for (const wrapper of montadas.splice(0)) wrapper.unmount()
  /* A sessão acaba entre um teste e outro: o canal esquece o que valia só para ela. */
  sessao.token = null
  authSessionVersion.value += 1
  await assentar()
  sessao.token = 'jwt'
  useParceiroStore().parceiroId = 'p1'
  await assentar()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('useTempoReal: o canal da aba', () => {
  it('duas telas escutando: um canal só, com o parceiro em uso; fecha quando a última sai', async () => {
    const fila = tela({ tipos: ['fila.oferta'], aoMudar: vi.fn<() => void>() })
    const checklist = tela({ aoMudar: vi.fn<() => void>() })
    await assentar()

    expect(servico.pedirTicketDoTempoReal).toHaveBeenCalledTimes(1)
    expect(servico.pedirTicketDoTempoReal).toHaveBeenCalledWith('p1')
    expect(abertas()).toHaveLength(1)
    expect(ultima().url).toBe('https://api.teste/eventos?ticket=t1')

    desmontar(fila.wrapper)
    await assentar()
    expect(abertas()).toHaveLength(1)

    desmontar(checklist.wrapper)
    await assentar()
    expect(abertas()).toHaveLength(0)
  })

  it('trocar de parceiro fecha o canal e abre outro com o parceiroId novo', async () => {
    tela({ aoMudar: vi.fn<() => void>() })
    await pronto()
    const primeira = ultima()

    useParceiroStore().parceiroId = 'p2'
    await assentar()

    expect(primeira.fechada).toBe(true)
    expect(servico.pedirTicketDoTempoReal).toHaveBeenLastCalledWith('p2')
    expect(abertas()).toHaveLength(1)
  })

  it('sair da conta fecha o canal e não reabre', async () => {
    tela({ aoMudar: vi.fn<() => void>() })
    await pronto()

    useParceiroStore().parceiroId = null
    sessao.token = null
    authSessionVersion.value += 1
    await vi.advanceTimersByTimeAsync(120_000)

    expect(abertas()).toHaveLength(0)
    expect(servico.pedirTicketDoTempoReal).toHaveBeenCalledTimes(1)
  })

  it('sem a permissão do aviso a tela não abre canal; com ela, abre', async () => {
    const pode = reactive({ valor: false })
    const checklist = tela({ ativo: () => pode.valor, aoMudar: vi.fn<() => void>() })
    await assentar()

    expect(servico.pedirTicketDoTempoReal).not.toHaveBeenCalled()
    expect(checklist.aoVivo()).toBe(false)

    pode.valor = true
    await pronto()
    expect(abertas()).toHaveLength(1)
    expect(checklist.aoVivo()).toBe(true)
  })

  it('aoVivo: só depois do canal.pronto, e cai com o erro', async () => {
    const checklist = tela({ aoMudar: vi.fn<() => void>() })
    await assentar()
    expect(checklist.aoVivo()).toBe(false)

    ultima().mandar({ tipo: 'canal.pronto' })
    expect(checklist.aoVivo()).toBe(true)

    ultima().onerror?.(new Event('error'))
    expect(checklist.aoVivo()).toBe(false)
  })

  it('ACESSO_REVOGADO: relê o contexto (a moldura segue o fluxo de sem acesso)', async () => {
    tela({ aoMudar: vi.fn<() => void>() })
    await pronto()
    ultima().mandar({ tipo: 'canal.encerrado', motivo: 'ACESSO_REVOGADO' })

    expect(loja.bootstrap).toHaveBeenCalledWith(true)
    expect(abertas()).toHaveLength(0)
  })
})

describe('useTempoReal: os avisos da tela', () => {
  it('o canal.pronto relê a tela uma vez, depois da janela de 500 ms', async () => {
    const aoMudar = vi.fn<() => void>()
    tela({ aoMudar })
    await pronto()

    await vi.advanceTimersByTimeAsync(499)
    expect(aoMudar).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(aoMudar).toHaveBeenCalledTimes(1)
  })

  it('vários avisos em menos de 500 ms viram uma releitura; o seguinte, outra', async () => {
    const aoMudar = vi.fn<() => void>()
    tela({ filtro: (aviso) => aviso.id === 'int1', aoMudar })
    await pronto()
    await vi.advanceTimersByTimeAsync(500)
    aoMudar.mockClear()

    for (let i = 0; i < 5; i += 1) {
      ultima().mandar({ tipo: 'internacao.checklist', id: 'int1' })
      await vi.advanceTimersByTimeAsync(80)
    }
    await vi.advanceTimersByTimeAsync(500)
    expect(aoMudar).toHaveBeenCalledTimes(1)

    ultima().mandar({ tipo: 'internacao.checklist', id: 'int1' })
    await vi.advanceTimersByTimeAsync(500)
    expect(aoMudar).toHaveBeenCalledTimes(2)
  })

  it('aviso de outra internação, de outro tipo ou de tipo desconhecido não chama a tela', async () => {
    const aoMudar = vi.fn<() => void>()
    tela({ filtro: (aviso) => aviso.id === 'int1', aoMudar })
    await pronto()
    await vi.advanceTimersByTimeAsync(500)
    aoMudar.mockClear()

    ultima().mandar({ tipo: 'internacao.checklist', id: 'int2' })
    ultima().mandar({ tipo: 'fila.oferta', id: 'int1' })
    ultima().mandar({ tipo: 'tipo.que.nao.existe', id: 'int1' })
    await vi.advanceTimersByTimeAsync(1_000)

    expect(aoMudar).not.toHaveBeenCalled()
  })

  it('cada tela recebe o tipo dela; o canal.releia relê as duas', async () => {
    const fila = vi.fn<() => void>()
    const plantao = vi.fn<() => void>()
    tela({ tipos: ['fila.oferta'], aoMudar: fila })
    tela({ aoMudar: plantao })
    await pronto()
    await vi.advanceTimersByTimeAsync(500)
    fila.mockClear()
    plantao.mockClear()

    ultima().mandar({ tipo: 'fila.oferta', id: 'e1' })
    await vi.advanceTimersByTimeAsync(500)
    expect(fila).toHaveBeenCalledTimes(1)
    expect(plantao).not.toHaveBeenCalled()

    ultima().mandar({ tipo: 'canal.releia' })
    await vi.advanceTimersByTimeAsync(500)
    expect(fila).toHaveBeenCalledTimes(2)
    expect(plantao).toHaveBeenCalledTimes(1)
  })

  it('a tela que saiu durante a janela não relê', async () => {
    const aoMudar = vi.fn<() => void>()
    const checklist = tela({ aoMudar })
    await pronto()
    desmontar(checklist.wrapper)
    await vi.advanceTimersByTimeAsync(1_000)

    expect(aoMudar).not.toHaveBeenCalled()
  })
})

describe('useReleituraDeReserva', () => {
  function relogio(aoVivo: Ref<boolean>) {
    const reler = vi.fn<() => void>()
    montadas.push(
      mount(
        defineComponent({
          setup() {
            useReleituraDeReserva(reler, aoVivo, { aoVivoMs: 120_000, foraMs: 60_000 })
            return () => null
          },
        }),
      ),
    )
    return reler
  }

  it('com o canal fora, o intervalo de sempre; com ele entregando, o longo', async () => {
    const visibilidade = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    const aoVivo = ref(false)
    const reler = relogio(aoVivo)

    await vi.advanceTimersByTimeAsync(60_000)
    expect(reler).toHaveBeenCalledTimes(1)

    aoVivo.value = true
    await assentar()
    await vi.advanceTimersByTimeAsync(119_999)
    expect(reler).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(reler).toHaveBeenCalledTimes(2)

    aoVivo.value = false
    await assentar()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(reler).toHaveBeenCalledTimes(3)
    visibilidade.mockRestore()
  })

  it('com a aba escondida não relê; ao sair da tela, para', async () => {
    const aoVivo = ref(false)
    const reler = relogio(aoVivo)
    const visibilidade = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')

    await vi.advanceTimersByTimeAsync(180_000)
    expect(reler).not.toHaveBeenCalled()

    visibilidade.mockReturnValue('visible')
    montadas.pop()!.unmount()
    await vi.advanceTimersByTimeAsync(180_000)
    expect(reler).not.toHaveBeenCalled()
    visibilidade.mockRestore()
  })
})
