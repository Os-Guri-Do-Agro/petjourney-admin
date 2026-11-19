/**
 * Cadastro com várias categorias (pedido 3 do guia de 17/11): a multi-seleção lê `categorias` do
 * GET, manda só `categorias` (a principal na frente), não deixa esvaziar a lista de quem já tinha
 * categoria e leva o foco ao campo que o 409 aponta.
 */

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import MultiSelect from 'primevue/multiselect'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import i18n from '@/i18n'
import type { CategoriaParceiro, ParceiroCadastro } from '@/service/parceiro/types'

import PortalParceiroCadastroForm from '../PortalParceiroCadastroForm.vue'

i18n.global.locale.value = 'pt'

const montados: VueWrapper[] = []

function cadastro(categorias: CategoriaParceiro[], campos: Partial<ParceiroCadastro> = {}) {
  return {
    parceiroId: 'p1',
    nome: 'Clínica Bem-Estar',
    categoria: categorias[0] ?? null,
    categorias,
    cnpj: '11222333000181',
    telefoneComercial: '(11) 98888-7777',
    crmv: null,
    logoUrl: null,
    statusAuditoria: 'APROVADO',
    motivoAuditoria: null,
    ...campos,
  } satisfies ParceiroCadastro
}

beforeEach(() => {
  setActivePinia(createPinia())
  document.body.innerHTML = ''
})

afterEach(() => {
  while (montados.length) {
    montados.pop()?.unmount()
  }
})

function montar(initial: ParceiroCadastro | null) {
  const wrapper = mount(PortalParceiroCadastroForm, {
    props: { initial, submitLabel: 'Salvar alterações' },
    global: { plugins: [i18n, PrimeVue] },
    attachTo: document.body,
  })

  montados.push(wrapper)

  return wrapper
}

async function escolher(wrapper: VueWrapper, categorias: CategoriaParceiro[]) {
  wrapper.findComponent(MultiSelect).vm.$emit('update:modelValue', categorias)
  await nextTick()
}

async function enviar(wrapper: VueWrapper) {
  await wrapper.find('form').trigger('submit')
  await flushPromises()

  const enviados = wrapper.emitted('submit') ?? []

  return enviados[enviados.length - 1]?.[0] as Record<string, unknown> | undefined
}

/** "Nome · Principal" ou "Nome · Tornar principal", na ordem da tela. */
function itensDaOrdem(wrapper: VueWrapper) {
  return wrapper.findAll('.cad-categorias__item').map((item) => {
    const nome = item.find('.cad-categorias__nome').text()
    const acao = (
      item.find('.ui-selo').exists() ? item.find('.ui-selo') : item.find('button')
    ).text()

    return `${nome} · ${acao}`
  })
}

describe('categorias do cadastro', () => {
  it('lê `categorias` do GET e manda só `categorias`, na mesma ordem', async () => {
    const wrapper = montar(cadastro(['PET_SHOP', 'CLINICA_VETERINARIA', 'BANHO_TOSA']))

    const payload = await enviar(wrapper)

    expect(payload?.categorias).toEqual(['PET_SHOP', 'CLINICA_VETERINARIA', 'BANHO_TOSA'])
    expect(payload).not.toHaveProperty('categoria')
  })

  it('com duas ou mais, mostra "Principal" na primeira e "Tornar principal" nas outras', async () => {
    const wrapper = montar(cadastro(['PET_SHOP', 'CLINICA_VETERINARIA']))

    expect(itensDaOrdem(wrapper)).toEqual([
      'Pet shop · Principal',
      'Clínica veterinária · Tornar principal',
    ])

    await wrapper.find('.cad-categorias__item button').trigger('click')

    expect(itensDaOrdem(wrapper)[0]).toBe('Clínica veterinária · Principal')
    expect((await enviar(wrapper))?.categorias).toEqual(['CLINICA_VETERINARIA', 'PET_SHOP'])
  })

  it('com uma só, não mostra a ordem', () => {
    const wrapper = montar(cadastro(['CLINICA_VETERINARIA']))

    expect(wrapper.find('.cad-categorias').exists()).toBe(false)
    expect(wrapper.text()).toContain('Escolha uma ou mais. A primeira é a principal.')
  })

  it('a nova escolhida entra no fim; a principal continua a primeira', async () => {
    const wrapper = montar(cadastro(['CLINICA_VETERINARIA']))

    await escolher(wrapper, ['CLINICA_VETERINARIA', 'HOTEL_CRECHE'])

    expect((await enviar(wrapper))?.categorias).toEqual(['CLINICA_VETERINARIA', 'HOTEL_CRECHE'])
  })

  it('quem já tinha categoria não esvazia a lista: "Escolha pelo menos uma categoria."', async () => {
    const wrapper = montar(cadastro(['CLINICA_VETERINARIA']))

    await escolher(wrapper, [])
    await enviar(wrapper)

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.find('#cad-categorias-error').text()).toBe('Escolha pelo menos uma categoria.')
  })

  it('cadastro sem categoria continua opcional: vazio, o campo não vai', async () => {
    const wrapper = montar(cadastro([]))

    const payload = await enviar(wrapper)

    expect(payload).toBeDefined()
    expect(payload).not.toHaveProperty('categorias')
    expect(payload).not.toHaveProperty('categoria')
  })

  it('API sem `categorias`: a principal de `categoria` entra na lista', async () => {
    const antigo = cadastro([], { categoria: 'FARMACIA' }) as Partial<ParceiroCadastro>
    delete antigo.categorias
    const wrapper = montar(antigo as ParceiroCadastro)

    expect((await enviar(wrapper))?.categorias).toEqual(['FARMACIA'])
  })

  it('o veterinário autônomo é opção separada da clínica, logo depois dela', () => {
    const wrapper = montar(cadastro(['PET_SHOP']))
    const opcoes = (wrapper.findComponent(MultiSelect).props('options') as { value: string }[]).map(
      (opcao) => opcao.value,
    )

    expect(opcoes.slice(0, 2)).toEqual(['CLINICA_VETERINARIA', 'VETERINARIO'])
  })

  it('o CRMV só aparece com Veterinário autônomo marcado e vai no corpo, sem espaços', async () => {
    const semVeterinario = montar(cadastro(['PET_SHOP'], { crmv: 'CRMV-SP 123' }))
    expect(semVeterinario.find('#cad-crmv').exists()).toBe(false)
    /* Escondido, o CRMV gravado volta como veio: o PATCH substitui o cadastro inteiro. */
    expect((await enviar(semVeterinario))?.crmv).toBe('CRMV-SP 123')

    const comVeterinario = montar(cadastro(['VETERINARIO', 'PET_SHOP'], { crmv: 'CRMV-SP 123' }))
    expect(itensDaOrdem(comVeterinario)[0]).toBe('Veterinário autônomo · Principal')
    const campo = comVeterinario.find<HTMLInputElement>('#cad-crmv')
    expect(campo.element.value).toBe('CRMV-SP 123')

    await campo.setValue('  12345/SP ')
    const enviado = await enviar(comVeterinario)
    expect(enviado?.categorias).toEqual(['VETERINARIO', 'PET_SHOP'])
    expect(enviado?.crmv).toBe('12345/SP')

    await campo.setValue('   ')
    expect((await enviar(comVeterinario))?.crmv).toBeNull()
  })
})

describe('foco pelo erro do backend', () => {
  it('409 de CNPJ: o foco vai ao CNPJ; de CRMV: ao CRMV', async () => {
    const wrapper = montar(cadastro(['PET_SHOP', 'CLINICA_VETERINARIA', 'VETERINARIO']))

    await wrapper.setProps({ errorField: 'cnpj' })
    await flushPromises()
    expect(document.activeElement?.id).toBe('cad-cnpj')

    await wrapper.setProps({ errorField: null })
    await wrapper.setProps({ errorField: 'crmv' })
    await flushPromises()
    expect(document.activeElement?.id).toBe('cad-crmv')

    await wrapper.setProps({ errorField: null })
    await wrapper.setProps({ errorField: 'categorias' })
    await flushPromises()
    expect(document.activeElement?.id).toBe('cad-categorias')
  })
})
