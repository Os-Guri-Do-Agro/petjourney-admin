/**
 * O questionário pós-saque na tela: a nota vai de 0 a 5 (seis casas) e o corpo enviado carrega
 * `escalaMax: 5` e a versão 2 das perguntas.
 */

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import i18n from '@/i18n'

type Servico = typeof import('@/service/parceiro/parceiro-portal-service')

const servico = vi.hoisted(() => ({
  getFeedbackElegibilidade: vi.fn<Servico['getFeedbackElegibilidade']>(),
  registrarFeedbackSaque: vi.fn<Servico['registrarFeedbackSaque']>(),
}))

vi.mock('@/service/parceiro/parceiro-portal-service', () => servico)

i18n.global.locale.value = 'pt'

const montados: VueWrapper[] = []

async function abrir() {
  vi.resetModules()
  const { useFeedbackSaque } = await import('@/composables/useFeedbackSaque')
  const { default: FeedbackSaqueDialog } = await import('../FeedbackSaqueDialog.vue')

  servico.getFeedbackElegibilidade.mockResolvedValue({ exibir: true })
  servico.registrarFeedbackSaque.mockResolvedValue({
    id: 'f1',
    status: 'RESPONDIDO',
    createdAt: '',
  })

  const wrapper = mount(FeedbackSaqueDialog, {
    global: { plugins: [i18n, PrimeVue, ToastService] },
    attachTo: document.body,
  })
  montados.push(wrapper)

  await useFeedbackSaque().oferecer('s1', 'p1')
  await flushPromises()

  return wrapper
}

const casas = () => Array.from(document.body.querySelectorAll<HTMLElement>('[role="radio"]'))

beforeEach(() => {
  servico.getFeedbackElegibilidade.mockReset()
  servico.registrarFeedbackSaque.mockReset()
})

afterEach(() => {
  montados.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
})

describe('FeedbackSaqueDialog', () => {
  it('mostra seis casas, de 0 a 5, com "Nota N" e a pergunta de 0 a 5', async () => {
    await abrir()

    expect(casas().map((casa) => casa.textContent?.trim())).toEqual(['0', '1', '2', '3', '4', '5'])
    expect(casas().map((casa) => casa.getAttribute('aria-label'))).toEqual([
      'Nota 0',
      'Nota 1',
      'Nota 2',
      'Nota 3',
      'Nota 4',
      'Nota 5',
    ])
    expect(casas().every((casa) => casa.getAttribute('aria-checked') === 'false')).toBe(true)
    expect(document.body.textContent).toContain('De 0 a 5, quanto você recomendaria')
    expect(document.body.textContent).toContain('0 = nada provável, 5 = muito provável')
    expect(document.body.textContent).toContain('Escolha uma nota de 0 a 5 para enviar.')
    expect(document.body.textContent).not.toMatch(/(^|\D)10(\D|$)/)
  })

  it('marca a casa escolhida e envia nota, escalaMax 5 e versão 2', async () => {
    await abrir()

    casas()[5]?.click()
    await flushPromises()
    expect(casas()[5]?.getAttribute('aria-checked')).toBe('true')

    const enviar = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find(
      (botao) => botao.textContent?.trim() === i18n.global.t('common.send'),
    )
    enviar?.click()
    await flushPromises()

    expect(servico.registrarFeedbackSaque).toHaveBeenCalledTimes(1)
    expect(servico.registrarFeedbackSaque.mock.calls[0]?.[0]).toEqual({
      saqueId: 's1',
      status: 'RESPONDIDO',
      versaoQuestionario: 2,
      escalaMax: 5,
      notaRecomendacao: 5,
      pontosPositivos: [],
      incentivos: [],
    })
  })
})
