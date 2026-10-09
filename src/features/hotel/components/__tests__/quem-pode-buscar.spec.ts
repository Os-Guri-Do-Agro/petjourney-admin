/**
 * A lista de quem pode buscar, montada de verdade.
 *
 * O que se afirma é o comportamento, e não o texto: a caixa que marca, o cadastro que abre, a
 * pessoa que entra marcada e a trava que segura a confirmação enquanto há alguém digitado e não
 * acrescentado. As frases já são guardadas pelo teste de chaves de tradução.
 */

import { flushPromises, mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it } from 'vitest'

import i18n from '@/i18n'

import QuemPodeBuscar from '../reserva/QuemPodeBuscar.vue'
import type { PessoaAutorizada } from '../../data/types'

const COM_I18N = { plugins: [i18n, PrimeVue] }

const CLARA: PessoaAutorizada = {
  id: 'pessoa-daniel-1',
  nome: 'Clara Okamoto',
  telefone: '(11) 99671-2284',
  relacao: 'Irmã',
  documento: 'RG 23.456.789-0',
}

const ROGERIO: PessoaAutorizada = {
  id: 'pessoa-daniel-2',
  nome: 'Rogério Lima',
  telefone: '(11) 98345-9012',
  relacao: 'Vizinho',
  documento: '',
}

beforeEach(() => {
  i18n.global.locale.value = 'pt'
  document.body.innerHTML = ''
})

function montar(marcadas: PessoaAutorizada[] = [CLARA]) {
  return mount(QuemPodeBuscar, {
    global: COM_I18N,
    attachTo: document.body,
    props: {
      responsavel: { nome: 'Daniel Okamoto', telefone: '(11) 99504-3312' },
      conhecidos: [CLARA, ROGERIO],
      modelValue: marcadas,
      'onUpdate:modelValue': () => undefined,
    },
  })
}

/** O último item de uma lista. `at(-1)` não está na `lib` dos testes. */
function ultimo<T>(lista: T[] | undefined): T | undefined {
  return lista?.[lista.length - 1]
}

/** O último valor emitido para o `v-model`, que é o que o diálogo de fora recebe. */
function ultimoValor(wrapper: ReturnType<typeof montar>) {
  return ultimo(wrapper.emitted('update:modelValue'))?.[0] as PessoaAutorizada[] | undefined
}

/** O botão de acrescentar: o último do rodapé do formulário, depois do cancelar. */
function botaoAdicionar(wrapper: ReturnType<typeof montar>) {
  return ultimo(wrapper.findAll('.nova__acoes button'))!
}

describe('quem pode buscar', () => {
  it('o responsável não tem caixa; cada conhecido tem, marcada só para quem vale agora', () => {
    const wrapper = montar()
    const caixas = wrapper.findAll('input[type="checkbox"]')

    /* Duas caixas para dois conhecidos — o responsável é a linha do cadeado. */
    expect(caixas).toHaveLength(2)
    expect(wrapper.find('.pi-lock').exists()).toBe(true)
    expect((caixas[0]!.element as HTMLInputElement).checked).toBe(true)
    expect((caixas[1]!.element as HTMLInputElement).checked).toBe(false)
    expect(wrapper.text()).toContain('Irmã · (11) 99671-2284 · RG 23.456.789-0')
  })

  it('marcar o vizinho devolve os dois, na ordem da lista', async () => {
    const wrapper = montar()

    await wrapper.findAll('input[type="checkbox"]')[1]!.setValue(true)

    expect(ultimoValor(wrapper)?.map((pessoa) => pessoa.id)).toEqual([CLARA.id, ROGERIO.id])
  })

  it('cadastrar recusa sem telefone válido e, com ele, acrescenta a pessoa já marcada', async () => {
    const wrapper = montar()

    await wrapper.find('button.quem__cadastrar').trigger('click')
    await flushPromises()

    const campos = wrapper.findAll('.nova input')

    await campos[0]!.setValue('Neide Okamoto')
    await campos[1]!.setValue('1197777')

    /* Digitado e não acrescentado: o diálogo de fora precisa travar. */
    expect(ultimo(wrapper.emitted('update:pendente'))).toEqual([true])

    const adicionar = botaoAdicionar(wrapper)

    await adicionar.trigger('click')

    /* A máscara entrou enquanto digitava, e o número incompleto é recusado com a razão escrita. */
    expect((campos[1]!.element as HTMLInputElement).value).toBe('(11) 9777-7')
    expect(wrapper.find('.campo__erro').exists()).toBe(true)
    expect(ultimoValor(wrapper)).toBeUndefined()

    await campos[1]!.setValue('11977771234')
    await adicionar.trigger('click')
    await flushPromises()

    const marcadas = ultimoValor(wrapper)

    expect(marcadas?.map((pessoa) => pessoa.nome)).toEqual(['Clara Okamoto', 'Neide Okamoto'])
    /* Id provisório: quem dá o definitivo é o repositório. */
    expect(marcadas?.[1]?.id).toMatch(/^nova-/)
    expect(marcadas?.[1]?.telefone).toBe('(11) 97777-1234')
    expect(wrapper.find('.nova').exists()).toBe(false)
    expect(ultimo(wrapper.emitted('update:pendente'))).toEqual([false])
  })

  it('o telefone de quem já está na lista é recusado, em vez de criar uma segunda pessoa', async () => {
    const wrapper = montar()

    await wrapper.find('button.quem__cadastrar').trigger('click')
    await flushPromises()

    const campos = wrapper.findAll('.nova input')

    await campos[0]!.setValue('Clarinha')
    await campos[1]!.setValue('11996712284')
    await botaoAdicionar(wrapper).trigger('click')

    /* De quem é o número sai de `problemaDaPessoa`, testado no domínio; aqui, que a tela recusa. */
    expect(wrapper.find('.campo__erro').exists()).toBe(true)
    expect(wrapper.find('.nova').exists()).toBe(true)
    expect(ultimoValor(wrapper)).toBeUndefined()
  })
})
