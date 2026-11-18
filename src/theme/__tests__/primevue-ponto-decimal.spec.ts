import { mount, type VueWrapper } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import InputNumber from 'primevue/inputnumber'
import { describe, expect, it } from 'vitest'

import { aceitarPontoComoDecimal } from '../primevue-ponto-decimal'

/**
 * Parte de um número já digitado: no jsdom a primeira tecla num campo vazio se perde (no navegador
 * não), e o que importa aqui é o que vem depois dele.
 */
function montarCampo(valor: number, props: Record<string, unknown>) {
  const wrapper: VueWrapper = mount(InputNumber, {
    attachTo: document.body,
    global: { plugins: [PrimeVue] },
    props: {
      locale: 'pt-BR',
      modelValue: valor,
      'onUpdate:modelValue': (novo: unknown) => wrapper.setProps({ modelValue: novo }),
      ...props,
    },
  })

  return wrapper
}

/**
 * Cursor logo depois do último algarismo da parte inteira, como quem acabou de digitá-lo, e uma
 * tecla por vez.
 */
async function digitar(wrapper: VueWrapper, texto: string) {
  const campo = wrapper.find('input')
  const elemento = campo.element as HTMLInputElement
  elemento.focus()
  await wrapper.vm.$nextTick()
  const fim = elemento.value.replace(/,\d+/, '').search(/\d(?!.*\d)/) + 1
  elemento.setSelectionRange(fim, fim)

  for (const tecla of texto) {
    await campo.trigger('keypress', { key: tecla })
  }

  /* O InputNumber só entrega o número ao `v-model` quando o campo perde o foco. */
  await campo.trigger('blur')
}

function valor(wrapper: VueWrapper) {
  return (wrapper.props() as { modelValue?: unknown }).modelValue
}

describe('Ponto como decimal no InputNumber', () => {
  it('o peso com ponto vira 2,5 e não 25', async () => {
    aceitarPontoComoDecimal()
    const wrapper = montarCampo(2, { maxFractionDigits: 2, suffix: ' kg' })

    await digitar(wrapper, '.5')

    expect(valor(wrapper)).toBe(2.5)
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('2,5 kg')
    wrapper.unmount()
  })

  it('a vírgula continua funcionando', async () => {
    aceitarPontoComoDecimal()
    const wrapper = montarCampo(25, { maxFractionDigits: 2 })

    await digitar(wrapper, ',6')

    expect(valor(wrapper)).toBe(25.6)
    wrapper.unmount()
  })

  it('campo só de inteiros ignora o ponto, como antes', async () => {
    aceitarPontoComoDecimal()
    const wrapper = montarCampo(2, {})

    await digitar(wrapper, '.5')

    expect(valor(wrapper)).toBe(25)
    wrapper.unmount()
  })

  it('dinheiro mantém o ponto como milhar', async () => {
    aceitarPontoComoDecimal()
    const wrapper = montarCampo(1, { mode: 'currency', currency: 'BRL' })

    await digitar(wrapper, '.500')

    expect(valor(wrapper)).toBe(1500)
    wrapper.unmount()
  })

  it('aplicar duas vezes não embrulha o método de novo', () => {
    aceitarPontoComoDecimal()
    const metodos = (InputNumber as unknown as { methods: { onInputKeyPress: unknown } }).methods
    const antes = metodos.onInputKeyPress
    aceitarPontoComoDecimal()

    expect(metodos.onInputKeyPress).toBe(antes)
  })
})
