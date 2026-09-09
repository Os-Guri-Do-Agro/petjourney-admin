/**
 * A busca global do módulo.
 *
 * O que se afirma aqui é o comportamento que faz dela um atalho e não mais uma tela: ela abre
 * já mostrando as telas do módulo, acha paciente pelo nome de quem responde por ele, e leva ao
 * destino pelo teclado — que é como quem tem as duas mãos ocupadas com um animal a usa.
 */

import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import i18n from '@/i18n'
import type { AppNavigationSection } from '@/composables/useAppNavigation'

import ClinicBuscaGlobal from '../ClinicBuscaGlobal.vue'
import { setMockConfig } from '../../../data/mock-runtime'
import { resetDataset } from '../../../data/store'

const empurrar = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: empurrar }),
}))

const SECOES: AppNavigationSection[] = [
  {
    id: 'clinical',
    label: 'Clínica',
    icon: 'pi pi-calendar',
    items: [
      { label: 'Meu dia', to: '/veterinario/meu-dia', icon: 'pi pi-sun' },
      { label: 'Internação', to: '/veterinario/internacao', icon: 'pi pi-building' },
    ],
    blocos: [
      {
        id: 'agora',
        label: 'Agora',
        items: [{ label: 'Meu dia', to: '/veterinario/meu-dia', icon: 'pi pi-sun' }],
      },
      {
        id: 'em-curso',
        label: 'Em curso',
        items: [
          { label: 'Internação', to: '/veterinario/internacao', icon: 'pi pi-building' },
        ],
      },
    ],
  },
  {
    id: 'portal',
    label: 'Portal',
    icon: 'pi pi-briefcase',
    items: [{ label: 'Programas', to: '/parceiro/programas', icon: 'pi pi-th-large' }],
  },
]

const COM_I18N = { plugins: [i18n, PrimeVue] }

function montar() {
  return mount(ClinicBuscaGlobal, {
    props: { aberto: true, secoes: SECOES },
    global: COM_I18N,
    attachTo: document.body,
  })
}

function itens() {
  return [...document.body.querySelectorAll('.busca__item')] as HTMLElement[]
}

async function digitar(wrapper: ReturnType<typeof montar>, texto: string) {
  const campo = document.body.querySelector('input') as HTMLInputElement

  campo.value = texto
  campo.dispatchEvent(new Event('input'))

  await wrapper.vm.$nextTick()
  /* A busca de pacientes é adiada; o avanço do relógio falso é o que a dispara. */
  await vi.advanceTimersByTimeAsync(300)
  await nextTick()
}

beforeEach(() => {
  setActivePinia(createPinia())
  resetDataset()
  setMockConfig({ latenciaMs: 0, jitterMs: 0 })
  document.body.innerHTML = ''
  empurrar.mockClear()
})

describe('busca global do módulo clínico', () => {
  it('abre listando as telas, sem ninguém digitar nada', async () => {
    const wrapper = montar()
    await nextTick()

    const texto = document.body.textContent ?? ''

    expect(texto).toContain('Meu dia')
    expect(texto).toContain('Internação')
    /* O bloco vira a legenda da tela: é ele que diz quando aquela tela é usada. */
    expect(texto).toContain('Em curso')
    expect(texto).not.toContain('clinico.busca')

    wrapper.unmount()
  })

  /* Portal não é assunto desta busca: ela promete a clínica, e só ela. */
  it('não oferece telas de fora do módulo', async () => {
    const wrapper = montar()
    await nextTick()

    expect(document.body.textContent).not.toContain('Programas')

    wrapper.unmount()
  })

  it('leva ao destino pela seta e pelo Enter', async () => {
    const wrapper = montar()
    await nextTick()

    const corpo = document.body.querySelector('.busca__corpo') as HTMLElement

    corpo.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    await nextTick()
    corpo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await nextTick()

    expect(empurrar).toHaveBeenCalledWith('/veterinario/internacao')
    expect(wrapper.emitted('fechar')).toHaveLength(1)

    wrapper.unmount()
  })

  describe('com o relógio na mão', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    /**
     * O caso do balcão: quem liga é o responsável, e é o nome **dele** que a recepção tem.
     * Uma busca que só casa o nome do animal obriga a lembrar do animal a partir da pessoa.
     */
    it('acha o paciente pelo nome de quem responde por ele', async () => {
      const wrapper = montar()
      await nextTick()

      await digitar(wrapper, 'Rita')

      const rotulos = itens().map((item) => item.textContent ?? '')

      expect(rotulos.some((rotulo) => rotulo.includes('Rita'))).toBe(true)

      vi.useRealTimers()
      wrapper.unmount()
    })

    it('uma letra só não dispara busca de paciente', async () => {
      const wrapper = montar()
      await nextTick()

      await digitar(wrapper, 'a')

      /* Só telas sobram — e "a" casa o rótulo de alguma delas ou nenhuma; paciente, nenhum. */
      expect(document.body.querySelectorAll('.busca__grupo')).toHaveLength(1)

      vi.useRealTimers()
      wrapper.unmount()
    })

    it('diz que não achou, em vez de mostrar uma lista vazia', async () => {
      const wrapper = montar()
      await nextTick()

      await digitar(wrapper, 'zzzzqq')

      expect(document.body.textContent).toContain(
        i18n.global.t('clinico.busca.semResultado', { termo: 'zzzzqq' }),
      )

      vi.useRealTimers()
      wrapper.unmount()
    })
  })
})
