/**
 * O widget do Turnstile com a API da Cloudflare de mentira: o token chega por `v-model:token`,
 * vencer zera, e `reset()` zera e pede outro desafio.
 */

import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import i18n from '@/i18n'

import CaptchaTurnstile from '../CaptchaTurnstile.vue'

i18n.global.locale.value = 'pt'

type Opcoes = {
  callback: (token: string) => void
  'expired-callback': () => void
  'error-callback': () => void
}

let opcoes: Opcoes | null = null
const reset = vi.fn()
const remove = vi.fn()

beforeEach(() => {
  opcoes = null
  window.turnstile = {
    render: (_elemento, recebidas) => {
      opcoes = recebidas
      return 'w-1'
    },
    reset,
    remove,
  }
})

afterEach(() => {
  delete window.turnstile
  vi.clearAllMocks()
})

async function montar() {
  const wrapper = mount(CaptchaTurnstile, {
    props: { token: null, 'onUpdate:token': (valor: string | null) => wrapper.setProps({ token: valor }) },
    global: { plugins: [i18n] },
  })
  await flushPromises()

  return wrapper
}

describe('CaptchaTurnstile', () => {
  it('entrega o token e o zera quando vence', async () => {
    const wrapper = await montar()

    opcoes?.callback('tok-1')
    await flushPromises()
    expect(wrapper.props('token')).toBe('tok-1')

    opcoes?.['expired-callback']()
    await flushPromises()
    expect(wrapper.props('token')).toBeNull()
  })

  it('reset zera o token e pede outro desafio', async () => {
    const wrapper = await montar()
    opcoes?.callback('tok-1')

    ;(wrapper.vm as unknown as { reset: () => void }).reset()
    await flushPromises()

    expect(wrapper.props('token')).toBeNull()
    expect(reset).toHaveBeenCalledWith('w-1')
  })

  it('erro do widget avisa na tela', async () => {
    const wrapper = await montar()

    opcoes?.['error-callback']()
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toContain('verificação de segurança')
  })

  it('sai de cena removendo o widget', async () => {
    const wrapper = await montar()

    wrapper.unmount()

    expect(remove).toHaveBeenCalledWith('w-1')
  })
})
