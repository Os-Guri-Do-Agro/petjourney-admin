/**
 * O pedido do pé da barra: aparece enquanto falta a identidade ou o CRMV para assinar, leva ao
 * lugar certo e, fechado, fica fechado até o fim da sessão, a menos que o que falta mude.
 */

import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import i18n from '@/i18n'
import type { EuNoParceiro } from '@/service/parceiro/acesso-service'
import { useParceiroStore } from '@/stores/parceiro'

import ShellPendencia from '../ShellPendencia.vue'

i18n.global.locale.value = 'pt'

type Situacao = {
  aguardandoCrmv?: string[]
  motivoDaConferencia?: 'SEM_SELO' | 'VENCIDO' | 'SEM_IDENTIDADE' | null
  identidade?: { status: string } | null
}

function comEu(situacao: Situacao) {
  const store = useParceiroStore()
  store.loadState = 'ready'
  store.eu = {
    aguardandoCrmv: [],
    aguardandoConferencia: [],
    atosAguardandoConferencia: [],
    motivoDaConferencia: null,
    identidade: null,
    ...situacao,
  } as unknown as EuNoParceiro
  return store
}

function montar(recolhida = false) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:qualquer(.*)*', component: { template: '<div />' } }],
  })

  return mount(ShellPendencia, {
    props: { recolhida },
    global: { plugins: [i18n, PrimeVue, router] },
  })
}

beforeEach(() => {
  setActivePinia(createPinia())
  window.sessionStorage.clear()
})

describe('ShellPendencia', () => {
  it('sem nada faltando, não aparece', () => {
    comEu({ identidade: { status: 'APROVADA' } })

    expect(montar().find('.pendencia').exists()).toBe(false)
  })

  it('quem não assina nada (sem CRMV pendente nem motivo do selo) não vê o pedido', () => {
    comEu({ identidade: null })

    expect(montar().find('.pendencia').exists()).toBe(false)
  })

  it('falta só a identidade: leva à gaveta da identidade', () => {
    comEu({ motivoDaConferencia: 'SEM_IDENTIDADE', identidade: null })
    const wrapper = montar()

    expect(wrapper.find('.pendencia__titulo').text()).toBe('Confirme sua identidade')
    expect(wrapper.find('.pendencia__acao').text()).toBe('Verificar identidade')
    expect(wrapper.find('.pendencia__acao').attributes('href')).toBe('/settings?identidade=enviar')
  })

  it('identidade recusada: o pedido é para enviar de novo', () => {
    comEu({ motivoDaConferencia: 'SEM_IDENTIDADE', identidade: { status: 'RECUSADA' } })
    const wrapper = montar()

    expect(wrapper.find('.pendencia__frase').text()).toContain('não foi aprovado')
    expect(wrapper.find('.pendencia__acao').text()).toBe('Enviar de novo')
  })

  it('identidade em análise e CRMV faltando: só o CRMV, que leva às fichas', () => {
    comEu({ aguardandoCrmv: ['receita.assinar'], identidade: { status: 'EM_ANALISE' } })
    const wrapper = montar()

    expect(wrapper.find('.pendencia__titulo').text()).toBe('Cadastre seu CRMV')
    expect(wrapper.find('.pendencia__acao').attributes('href')).toBe('/parceiro/profissionais')
  })

  it('as duas faltando: um pedido só, com o primeiro passo (a identidade)', () => {
    comEu({ aguardandoCrmv: ['receita.assinar'], identidade: null })
    const wrapper = montar()

    expect(wrapper.find('.pendencia__titulo').text()).toBe('Falta pouco para você assinar')
    expect(wrapper.find('.pendencia__acao').attributes('href')).toBe('/settings?identidade=enviar')
  })

  it('fechado, fica fechado na sessão; muda o que falta, volta', async () => {
    const store = comEu({ aguardandoCrmv: ['receita.assinar'], identidade: null })
    const wrapper = montar()

    await wrapper.find('.pendencia__fechar').trigger('click')
    await nextTick()
    expect(wrapper.find('.pendencia').exists()).toBe(false)

    /* Outra montagem na mesma sessão (outra tela, recarga): segue fechado. */
    expect(montar().find('.pendencia').exists()).toBe(false)

    /* Mandou a identidade: o pedido agora é outro (só o CRMV) e aparece. */
    store.eu = { ...store.eu!, identidade: { status: 'EM_ANALISE' } } as EuNoParceiro
    await nextTick()
    expect(wrapper.find('.pendencia__titulo').text()).toBe('Cadastre seu CRMV')
  })

  it('recolhida: só o ícone, que leva ao mesmo lugar', () => {
    comEu({ motivoDaConferencia: 'SEM_IDENTIDADE', identidade: null })
    const wrapper = montar(true)

    expect(wrapper.find('.pendencia').exists()).toBe(false)
    expect(wrapper.find('.pendencia-icone').attributes('href')).toBe('/settings?identidade=enviar')
  })
})
