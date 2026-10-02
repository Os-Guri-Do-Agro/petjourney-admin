/**
 * O avatar do hóspede.
 *
 * Duas coisas são afirmadas aqui, e as duas são invisíveis num teste de renderização comum.
 *
 * A primeira é que **a cor é derivada do nome**: a mesma Mel precisa ter o mesmo tom na lista, no
 * mapa, na prancheta e no cabeçalho da estadia. Cor que muda entre telas é pior que cor nenhuma,
 * porque ensina a não confiar nela — e é o tipo de regressão que passa despercebida, já que cada
 * tela testada em separado mostra *uma* cor plausível.
 *
 * A segunda é que a foto, quando existe, **substitui** o desenho em vez de conviver com ele.
 */

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import PetAvatar from '../base/PetAvatar.vue'

function montar(props: Record<string, unknown>) {
  return mount(PetAvatar, {
    props: { nome: 'Mel', iniciais: 'ME', ...props },
  })
}

/** A classe de tom que o componente escolheu, sem depender do valor da cor. */
function tomDe(tela: ReturnType<typeof montar>) {
  return (tela.attributes('class') ?? '')
    .split(' ')
    .find((classe) => classe.startsWith('avatar--tom-'))
}

describe('a cor identifica o animal', () => {
  it('o mesmo nome dá sempre o mesmo tom', () => {
    expect(tomDe(montar({}))).toBe(tomDe(montar({ iniciais: 'M', tamanho: 'lg' })))
  })

  it('e o tom não depende do tamanho nem da espécie', () => {
    const naLista = montar({ tamanho: 'xs', especie: 'canina' })
    const noCabecalho = montar({ tamanho: 'lg', especie: 'felina' })

    expect(tomDe(naLista)).toBe(tomDe(noCabecalho))
  })

  it('nomes diferentes se espalham pelos seis tons', () => {
    const nomes = ['Mel', 'Thor', 'Bento', 'Tofu', 'Nina', 'Zeus', 'Bidu', 'Pandora']
    const tons = new Set(nomes.map((nome) => tomDe(montar({ nome }))))

    /*
     * Não exige seis: com oito nomes o pombo cai em algum tom repetido, e exigir todos faria o
     * teste quebrar ao renomear um hóspede da semente. O que importa é não colapsar num só.
     */
    expect(tons.size).toBeGreaterThan(2)
  })
})

describe('a foto, quando existe, é o avatar', () => {
  it('sem foto, desenha as iniciais', () => {
    const tela = montar({ especie: 'canina' })

    expect(tela.find('img').exists()).toBe(false)
    expect(tela.text()).toBe('ME')
  })

  it('com foto, o desenho sai de cena', () => {
    const tela = montar({ fotoUrl: '/retratos/mel.jpg' })

    expect(tela.find('img').attributes('src')).toBe('/retratos/mel.jpg')
    expect(tela.text()).toBe('')
  })
})

describe('o avatar não é anunciado duas vezes', () => {
  it('fica escondido do leitor de tela, porque o nome está sempre ao lado', () => {
    /* Sem isto, cada linha da lista seria lida como "Mel, Mel". */
    expect(montar({}).attributes('aria-hidden')).toBe('true')
  })
})

describe('a silhueta da espécie', () => {
  it('aparece para cão e gato, que se distinguem em 16 pixels', () => {
    expect(montar({ especie: 'canina' }).find('svg').exists()).toBe(true)
    expect(montar({ especie: 'felina' }).find('svg').exists()).toBe(true)
  })

  it('e some no resto, em vez de virar um borrão genérico', () => {
    expect(montar({ especie: 'ave' }).find('svg').exists()).toBe(false)
    expect(montar({ especie: null }).find('svg').exists()).toBe(false)
  })
})
