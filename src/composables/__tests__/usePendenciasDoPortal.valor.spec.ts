/**
 * O valor que a última conferência deu a um contador (`valorConferido`): é por ele que a caixa de
 * pedidos vê se o selo concorda com a lista que acabou de ler.
 */
import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, type EffectScope } from 'vue'

import type { Pendencia } from '@/service/parceiro/pendencias-service'

const listarPendencias = vi.hoisted(() => vi.fn())

vi.mock('@/service/parceiro/pendencias-service', async (original) => ({
  ...(await original<typeof import('@/service/parceiro/pendencias-service')>()),
  listarPendencias,
}))

import {
  limparPendenciasDoPortal,
  usePendenciasDoPortal,
  valorConferido,
} from '../usePendenciasDoPortal'

function pendencia(extra: Partial<Pendencia> & Pick<Pendencia, 'chave'>): Pendencia {
  return { modulo: 'CLINICA', valor: 1, tom: 'ATENCAO', rota: '/clinica/pedidos', ...extra }
}

let escopo: EffectScope

beforeEach(() => {
  setActivePinia(createPinia())
  limparPendenciasDoPortal()
  escopo = effectScope()
})

afterEach(() => {
  escopo.stop()
  limparPendenciasDoPortal()
  listarPendencias.mockReset()
})

describe('valorConferido', () => {
  it('é nulo antes da primeira conferência', () => {
    expect(valorConferido('pedidos')).toBeNull()
  })

  it('devolve o número de cada contador, o zero inclusive', async () => {
    listarPendencias.mockResolvedValue([
      pendencia({ chave: 'pedidos', valor: 1 }),
      pendencia({ chave: 'fila', valor: 0, rota: '/clinica/fila' }),
    ])

    escopo.run(() => usePendenciasDoPortal(() => true))
    await flushPromises()

    expect(valorConferido('pedidos')).toBe(1)
    expect(valorConferido('fila')).toBe(0)
  })

  it('é nulo para o contador que falhou no servidor e para o que não veio', async () => {
    listarPendencias.mockResolvedValue([pendencia({ chave: 'pedidos', valor: null })])

    escopo.run(() => usePendenciasDoPortal(() => true))
    await flushPromises()

    expect(valorConferido('pedidos')).toBeNull()
    expect(valorConferido('naoExiste')).toBeNull()
  })
})
