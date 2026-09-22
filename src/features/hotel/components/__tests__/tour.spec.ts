/**
 * O tutorial de tela.
 *
 * A regra que este arquivo guarda é a que não se vê olhando a tela cheia: **um passo cujo alvo não
 * está no DOM não entra no roteiro**. As telas do hotel têm seções condicionais — a faixa de
 * véspera só existe quando alguém chega sem documento, a acomodação parada só existe quando há
 * uma —, e um roteiro fixo apontaria para o vazio num dia calmo. Pior: o contador diria "3 de 5"
 * e o destaque não teria onde pousar.
 *
 * Como o filtro depende do DOM real, os alvos aqui são montados à mão no `document.body`. É o que
 * permite afirmar os dois lados: o passo que acha o alvo fica, o que não acha sai, e o contador
 * fala do roteiro filtrado e não da lista que a página escreveu.
 */

import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it } from 'vitest'

import i18n from '@/i18n'

import HotelTour from '../base/HotelTour.vue'
import type { PassoDoTour } from '../base/tour-types'

const COM_I18N = { plugins: [i18n, PrimeVue] }

/** O último `update:aberto` emitido. Índice, e não `at`, que a lib dos testes não traz. */
function ultimoEmitido(tela: ReturnType<typeof montar>) {
  const emitidos = tela.emitted('update:aberto')

  return emitidos?.[emitidos.length - 1]
}

const PASSOS: PassoDoTour[] = [
  { alvo: '#existe-um', titulo: 'Primeiro', texto: 'Texto do primeiro passo.' },
  { alvo: '#nao-existe', titulo: 'Fantasma', texto: 'Aponta para o que não está na tela.' },
  { alvo: '#existe-dois', titulo: 'Segundo', texto: 'Texto do segundo passo.' },
]

function montar(passos: PassoDoTour[] = PASSOS) {
  return mount(HotelTour, {
    props: { aberto: true, passos },
    global: COM_I18N,
    attachTo: document.body,
  })
}

beforeEach(() => {
  i18n.global.locale.value = 'pt'

  document.body.innerHTML = '<div id="existe-um"></div><div id="existe-dois"></div>'
})

describe('o roteiro só tem passos com alvo na tela', () => {
  it('o passo que aponta para o que não existe fica de fora', async () => {
    const tela = montar()

    await tela.vm.$nextTick()

    const cartao = document.querySelector('.tour__cartao')

    expect(cartao?.textContent).toContain('Primeiro')
    expect(cartao?.textContent).not.toContain('Fantasma')
  })

  it('o contador fala do roteiro filtrado, não da lista da página', async () => {
    const tela = montar()

    await tela.vm.$nextTick()

    /* Três passos escritos, dois com alvo: o contador precisa dizer dois. */
    expect(document.querySelector('.tour__contador')?.textContent?.trim()).toBe('1 de 2')
  })

  it('um passo sem alvo nenhum sempre entra — é o que abre e o que fecha o roteiro', async () => {
    const tela = montar([
      { titulo: 'Abertura', texto: 'Sem alvo, no centro da tela.' },
      { alvo: '#nao-existe', titulo: 'Fantasma', texto: 'Some.' },
    ])

    await tela.vm.$nextTick()

    expect(document.querySelector('.tour__contador')?.textContent?.trim()).toBe('1 de 1')
    expect(document.querySelector('.tour__cartao')?.textContent).toContain('Abertura')
  })
})

describe('a navegação', () => {
  it('avança para o próximo passo que sobrou', async () => {
    const tela = montar()

    await tela.vm.$nextTick()

    const botoes = document.querySelectorAll('.tour__navegacao button')
    const proximo = botoes[botoes.length - 1] as HTMLElement

    proximo.click()
    await tela.vm.$nextTick()

    expect(document.querySelector('.tour__cartao')?.textContent).toContain('Segundo')
    expect(document.querySelector('.tour__contador')?.textContent?.trim()).toBe('2 de 2')
  })

  it('o último passo fecha em vez de avançar para o nada', async () => {
    const tela = montar([{ titulo: 'Único', texto: 'Só este.' }])

    await tela.vm.$nextTick()

    const botoes = document.querySelectorAll('.tour__navegacao button')
    const botao = botoes[botoes.length - 1] as HTMLElement

    botao.click()
    await tela.vm.$nextTick()

    expect(ultimoEmitido(tela)).toEqual([false])
  })

  it('Esc fecha — quem já sabe não deve ter de procurar o botão', async () => {
    const tela = montar()

    await tela.vm.$nextTick()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await tela.vm.$nextTick()

    expect(ultimoEmitido(tela)).toEqual([false])
  })
})

describe('o roteiro é remontado a cada abertura', () => {
  it('um alvo que apareceu depois entra na abertura seguinte', async () => {
    const tela = mount(HotelTour, {
      props: { aberto: false, passos: PASSOS },
      global: COM_I18N,
      attachTo: document.body,
    })

    /*
     * A seção condicional nasce entre uma abertura e outra. Se o roteiro fosse calculado na
     * montagem, ela nunca entraria — e é justamente a faixa de véspera, que só existe quando há o
     * que avisar.
     */
    document.body.insertAdjacentHTML('beforeend', '<div id="nao-existe"></div>')

    await tela.setProps({ aberto: true })
    await tela.vm.$nextTick()

    expect(document.querySelector('.tour__contador')?.textContent?.trim()).toBe('1 de 3')
  })
})
