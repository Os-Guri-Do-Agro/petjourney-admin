/**
 * O sino do portal (N8): "marcar todas" vai para a API com o parceiro aberto e marca também os
 * avisos que a lista ainda não carregou; o número do sino volta da resposta.
 */
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, reactive } from 'vue'

import type { Aviso, PaginaDeAvisos } from '@/service/parceiro/avisos-service'

import { useAvisosDoParceiro } from '../useAvisosDoParceiro'

type Servico = typeof import('@/service/parceiro/avisos-service')

const servico = vi.hoisted(() => ({
  listarAvisos: vi.fn<Servico['listarAvisos']>(),
  abrirAviso: vi.fn<Servico['abrirAviso']>(),
  marcarAvisosDoParceiroComoLidos: vi.fn<Servico['marcarAvisosDoParceiroComoLidos']>(),
}))
const loja = vi.hoisted(() => ({ parceiroId: 'p1' as string | null }))

vi.mock('@/service/parceiro/avisos-service', () => servico)
vi.mock('@/stores/parceiro', async () => {
  const { reactive: reativo } = await import('vue')
  const estado = reativo(loja)
  return { useParceiroStore: () => estado }
})
vi.mock('@/composables/conferencia', () => ({
  criarReconferencia: () => ({ assinar: vi.fn() }),
}))

function aviso(id: string, lida: boolean): Aviso {
  return {
    id,
    tipo: 'VINCULO_RESPONDIDO',
    titulo: 'Proposta de vínculo respondida',
    corpo: 'A Marina aceitou.',
    dados: { parceiroId: 'p1', url: '/screens/notifications' },
    criadoEm: '2026-11-25T12:00:00.000Z',
    lidaEm: lida ? '2026-11-25T13:00:00.000Z' : null,
  }
}

function pagina(itens: Aviso[], naoLidasDoParceiro: number): PaginaDeAvisos {
  return { itens, proximoCursor: 'n2', naoLidas: naoLidasDoParceiro + 4, naoLidasDoParceiro }
}

function montar() {
  let sino!: ReturnType<typeof useAvisosDoParceiro>
  const ligado = reactive({ valor: true })

  mount(
    defineComponent({
      setup() {
        sino = useAvisosDoParceiro(() => ligado.valor)
        return () => null
      },
    }),
  )

  return sino
}

beforeEach(() => {
  loja.parceiroId = 'p1'
  servico.listarAvisos.mockReset()
  servico.abrirAviso.mockReset()
  servico.marcarAvisosDoParceiroComoLidos.mockReset()
  servico.listarAvisos.mockResolvedValue(pagina([aviso('n1', false), aviso('n2', true)], 7))
})

describe('useAvisosDoParceiro', () => {
  it('"marcar todas" manda o parceiro aberto e zera o sino pela resposta', async () => {
    servico.marcarAvisosDoParceiroComoLidos.mockResolvedValue({
      atualizadas: 7,
      naoLidas: 4,
      naoLidasDoParceiro: 0,
    })

    const sino = montar()
    await sino.carregarLista()
    expect(sino.naoLidas.value).toBe(7)

    await sino.marcarTodasComoLidas()

    expect(servico.marcarAvisosDoParceiroComoLidos).toHaveBeenCalledExactlyOnceWith('p1')
    expect(sino.avisos.value.every((item) => item.lidaEm)).toBe(true)
    expect(sino.naoLidas.value).toBe(0)
    expect(sino.naoLidasNaLista.value).toBe(0)
  })

  it('sem parceiro aberto, não chama a rota (ela marcaria a conta inteira)', async () => {
    const sino = montar()
    await flushPromises()
    loja.parceiroId = null

    await sino.marcarTodasComoLidas()

    expect(servico.marcarAvisosDoParceiroComoLidos).not.toHaveBeenCalled()
  })

  it('se a API recusa, a lista fica como estava e o número é conferido de novo', async () => {
    servico.marcarAvisosDoParceiroComoLidos.mockRejectedValue(new Error('rede'))

    const sino = montar()
    await sino.carregarLista()
    servico.listarAvisos.mockClear()

    await sino.marcarTodasComoLidas()

    expect(sino.naoLidasNaLista.value).toBe(1)
    expect(servico.listarAvisos).toHaveBeenCalledWith({ parceiroId: 'p1', limit: 1 })
  })
})
