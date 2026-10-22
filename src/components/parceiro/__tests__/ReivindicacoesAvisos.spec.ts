/**
 * Os avisos dos códigos guardados com o cadastro em análise, em cima da lista de Acessos.
 *
 * Cada situação que a API devolve vira uma frase com o nome do pet, menos `VINCULADO`: esse
 * acesso já está na lista, e o aviso tem de sumir quando a aprovação o vincula.
 */

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import i18n from '@/i18n'
import type { ReivindicacaoAcesso, SituacaoReivindicacao } from '@/service/parceiro/types'

import ReivindicacoesAvisos from '../ReivindicacoesAvisos.vue'

i18n.global.locale.value = 'pt'

function item(situacao: SituacaoReivindicacao | string, petNome = 'Thor'): ReivindicacaoAcesso {
  return {
    id: `r-${situacao}-${petNome}`,
    petNome,
    situacao: situacao as SituacaoReivindicacao,
    criadaEm: '2026-10-20T12:00:00.000Z',
    resolvidaEm: null,
  }
}

function montar(itens: ReivindicacaoAcesso[], codigoGuardado = false) {
  return mount(ReivindicacoesAvisos, {
    props: { itens, codigoGuardado },
    global: { plugins: [i18n] },
  })
}

function avisos(wrapper: ReturnType<typeof montar>) {
  return wrapper.findAll('.reivindicacoes__texto').map((linha) => linha.text())
}

describe('uma situação, um aviso', () => {
  it.each([
    ['AGUARDANDO_APROVACAO', 'O acesso de Thor aparece aqui quando o seu cadastro for aprovado.'],
    [
      'VENCIDO',
      'O acesso de Thor venceu antes da aprovação do seu cadastro. Peça um novo código ao responsável.',
    ],
    ['ENCERRADO', 'O responsável encerrou o acesso de Thor antes da aprovação do seu cadastro.'],
    ['JA_VINCULADO', 'O acesso de Thor já foi aberto por outro estabelecimento.'],
  ])('%s', (situacao, texto) => {
    expect(avisos(montar([item(situacao)]))).toEqual([texto])
  })

  it('VINCULADO não avisa nada: o acesso já está na lista', () => {
    const wrapper = montar([item('VINCULADO')])

    expect(wrapper.find('.reivindicacoes').exists()).toBe(false)
  })

  it('situação que o portal ainda não conhece fica sem aviso, em vez de mostrar uma chave', () => {
    const wrapper = montar([item('NOVA_SITUACAO')])

    expect(wrapper.find('.reivindicacoes').exists()).toBe(false)
  })

  it('um aviso por código, na ordem da API, cada um com o seu pet', () => {
    const wrapper = montar([
      item('AGUARDANDO_APROVACAO', 'Mel'),
      item('VINCULADO', 'Thor'),
      item('VENCIDO', 'Bob'),
    ])

    expect(avisos(wrapper)).toEqual([
      'O acesso de Mel aparece aqui quando o seu cadastro for aprovado.',
      'O acesso de Bob venceu antes da aprovação do seu cadastro. Peça um novo código ao responsável.',
    ])
  })

  it('só o vencido pede ação, e só ele vem em âmbar', () => {
    const wrapper = montar([item('VENCIDO'), item('ENCERRADO', 'Mel')])
    const [vencido, encerrado] = wrapper.findAll('.ui-ladrilho')

    expect(vencido?.classes()).toContain('ui-ladrilho--atencao')
    expect(encerrado?.classes()).not.toContain('ui-ladrilho--atencao')
  })
})

describe('a aprovação', () => {
  it('o código guardado vira acesso e o aviso de espera some', async () => {
    const wrapper = montar([item('AGUARDANDO_APROVACAO')])
    expect(avisos(wrapper)).toHaveLength(1)

    await wrapper.setProps({ itens: [item('VINCULADO')] })

    expect(wrapper.find('.reivindicacoes').exists()).toBe(false)
  })

  it('o código que venceu antes da aprovação troca a espera pelo aviso de vencido', async () => {
    const wrapper = montar([item('AGUARDANDO_APROVACAO')])

    await wrapper.setProps({ itens: [item('VENCIDO')] })

    expect(avisos(wrapper)).toEqual([
      'O acesso de Thor venceu antes da aprovação do seu cadastro. Peça um novo código ao responsável.',
    ])
  })
})

describe('código guardado sem a lista', () => {
  it('a releitura falhou: um aviso sem o nome do pet responde a quem acabou de guardar', () => {
    expect(avisos(montar([], true))).toEqual([
      'Código guardado. O acesso aparece aqui quando o seu cadastro for aprovado.',
    ])
  })

  it('com o aviso de espera na lista, o genérico não se repete', () => {
    expect(avisos(montar([item('AGUARDANDO_APROVACAO')], true))).toEqual([
      'O acesso de Thor aparece aqui quando o seu cadastro for aprovado.',
    ])
  })
})
