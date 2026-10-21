/**
 * O modal de vincular aberto pelo link do acesso.
 *
 * O "Entrar no portal" da página do acesso, no site, traz o código até a tela de acessos
 * (`?vincular=`). A promessa é que a pessoa só confirme: as seis caixas chegam preenchidas e o
 * botão já está liberado. Sem código — o "Vincular código" de sempre — as caixas abrem vazias.
 */

import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import i18n from '@/i18n'

import VincularCodigoDialog from '../VincularCodigoDialog.vue'

const COM_I18N = { plugins: [i18n, PrimeVue] }

beforeEach(() => {
  setActivePinia(createPinia())

  /* O diálogo é teleportado para o `body`; sem limpar, o de um teste sobra no seguinte. */
  document.body.innerHTML = ''
})

/** Monta fechado e abre depois: é a abertura que lê o código, como na tela de acessos. */
async function abrir(codigoInicial?: string) {
  const wrapper = mount(VincularCodigoDialog, {
    props: { visible: false, codigoInicial },
    global: COM_I18N,
    attachTo: document.body,
  })

  await wrapper.setProps({ visible: true })
  await nextTick()

  return wrapper
}

function digitos() {
  return [...document.body.querySelectorAll<HTMLInputElement>('.vincular-dialog__digit')].map(
    (campo) => campo.value,
  )
}

function botaoDeVincular() {
  return document.body.querySelector<HTMLButtonElement>('.vincular-dialog__enviar')
}

describe('código que chega pelo link', () => {
  it('abre com as seis caixas preenchidas e o botão liberado', async () => {
    await abrir('123456')

    expect(digitos()).toEqual(['1', '2', '3', '4', '5', '6'])
    expect(botaoDeVincular()?.disabled).toBe(false)
  })

  it('aceita o código com hífen, do jeito que o prestador o vê', async () => {
    await abrir('123-456')

    expect(digitos()).toEqual(['1', '2', '3', '4', '5', '6'])
  })

  it('código fora do formato não entra nas caixas', async () => {
    await abrir('12a')

    expect(digitos().every((valor) => !valor)).toBe(true)
    expect(botaoDeVincular()?.disabled).toBe(true)
  })
})

describe('abertura de sempre', () => {
  it('sem código, as caixas abrem vazias e o botão espera', async () => {
    await abrir()

    expect(digitos()).toHaveLength(6)
    expect(digitos().every((valor) => !valor)).toBe(true)
    expect(botaoDeVincular()?.disabled).toBe(true)
  })
})
