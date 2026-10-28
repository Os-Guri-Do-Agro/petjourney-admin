import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import Select from 'primevue/select'
import { describe, expect, it, vi } from 'vitest'

import { deixarEscPassarPeloSelectFechado } from '../primevue-esc-do-select'

function montarSelect() {
  return mount(Select, {
    attachTo: document.body,
    global: { plugins: [PrimeVue] },
    props: { options: ['Consulta', 'Retorno'] },
  })
}

describe('Esc no Select fechado', () => {
  it('chega ao document, onde o Dialog e o Drawer escutam', async () => {
    deixarEscPassarPeloSelectFechado()
    const wrapper = montarSelect()
    const ouvinte = vi.fn<(evento: KeyboardEvent) => void>()
    document.addEventListener('keydown', ouvinte)

    await wrapper.find('[role="combobox"]').trigger('keydown', { code: 'Escape', key: 'Escape' })

    expect(ouvinte).toHaveBeenCalledTimes(1)
    document.removeEventListener('keydown', ouvinte)
    wrapper.unmount()
  })

  it('com a lista aberta, fecha só a lista', async () => {
    deixarEscPassarPeloSelectFechado()
    const wrapper = montarSelect()
    const ouvinte = vi.fn<(evento: KeyboardEvent) => void>()
    document.addEventListener('keydown', ouvinte)
    ;(wrapper.vm as unknown as { show: () => void }).show()
    await wrapper.vm.$nextTick()
    await wrapper.find('[role="combobox"]').trigger('keydown', { code: 'Escape', key: 'Escape' })
    /* O `hide` do Select fecha num `setTimeout(0)`. */
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(ouvinte).not.toHaveBeenCalled()
    expect((wrapper.vm as unknown as { overlayVisible: boolean }).overlayVisible).toBe(false)
    document.removeEventListener('keydown', ouvinte)
    wrapper.unmount()
  })

  it('aplicar duas vezes não embrulha o método de novo', () => {
    deixarEscPassarPeloSelectFechado()
    const antes = (Select as unknown as { methods: { onEscapeKey: unknown } }).methods.onEscapeKey
    deixarEscPassarPeloSelectFechado()

    expect((Select as unknown as { methods: { onEscapeKey: unknown } }).methods.onEscapeKey).toBe(
      antes,
    )
  })
})
