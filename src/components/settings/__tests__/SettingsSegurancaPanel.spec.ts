/**
 * Segurança: a resposta da API à troca de senha (PJ-4BI7TE).
 *
 * A senha atual que não confere volta como 400 `SENHA_ATUAL_INCORRETA` e aparece no campo dela,
 * com a mensagem da API; a sessão não cai. O 429 das senhas erradas mostra a mensagem da API; o do
 * limite da rota, que vem com o texto técnico do servidor, mostra a frase do portal.
 */

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import { afterEach, describe, expect, it, vi } from 'vitest'

import i18n from '@/i18n'
import { ApiError } from '@/service/api'

import SettingsSegurancaPanel from '../SettingsSegurancaPanel.vue'

type Auth = typeof import('@/service/auth/auth-service')

const auth = vi.hoisted(() => ({
  changePasswordAuthenticated: vi.fn<Auth['changePasswordAuthenticated']>(),
}))

const toast = vi.hoisted(() => ({ add: vi.fn<(mensagem: Record<string, unknown>) => void>() }))

vi.mock('@/service/auth/auth-service', async (importOriginal) => ({
  ...(await importOriginal<Auth>()),
  ...auth,
}))

vi.mock('primevue/usetoast', () => ({ useToast: () => toast }))

i18n.global.locale.value = 'pt'

const montados: VueWrapper[] = []

afterEach(() => {
  montados.splice(0).forEach((w) => w.unmount())
  vi.clearAllMocks()
})

async function enviarComSenhaAtualErrada() {
  const wrapper = mount(SettingsSegurancaPanel, {
    global: { plugins: [i18n, PrimeVue, ToastService] },
    attachTo: document.body,
  })
  montados.push(wrapper)

  await wrapper.find('#settings-senha-atual').setValue('NaoEstaSenha#2026')
  await wrapper.find('#settings-nova-senha').setValue('OutraSenha#2026')
  await wrapper.find('#settings-confirmar-senha').setValue('OutraSenha#2026')
  await wrapper.find('form').trigger('submit')
  await flushPromises()

  return wrapper
}

describe('Segurança: troca de senha', () => {
  it('senha atual errada: a mensagem da API fica no campo, sem aviso', async () => {
    auth.changePasswordAuthenticated.mockRejectedValue(
      new ApiError(
        'A senha atual não confere. Confira e tente de novo.',
        400,
        'Bad Request',
        undefined,
        {
          codigo: 'SENHA_ATUAL_INCORRETA',
        },
      ),
    )

    const wrapper = await enviarComSenhaAtualErrada()

    expect(wrapper.find('#settings-senha-atual-nota').text()).toBe(
      'A senha atual não confere. Confira e tente de novo.',
    )
    expect(toast.add).not.toHaveBeenCalled()
  })

  it('429 das senhas erradas: o aviso traz a mensagem da API', async () => {
    auth.changePasswordAuthenticated.mockRejectedValue(
      new ApiError(
        'Muitas tentativas de senha. Aguarde alguns minutos e tente de novo.',
        429,
        undefined,
        undefined,
        {
          codigo: 'SENHA_TENTATIVAS_EXCEDIDAS',
        },
      ),
    )

    await enviarComSenhaAtualErrada()

    expect(toast.add).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        detail: 'Muitas tentativas de senha. Aguarde alguns minutos e tente de novo.',
      }),
    )
  })

  it('429 do limite da rota: a frase do portal no lugar do texto do servidor', async () => {
    auth.changePasswordAuthenticated.mockRejectedValue(
      new ApiError('ThrottlerException: Too Many Requests', 429),
    )

    await enviarComSenhaAtualErrada()

    expect(toast.add).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
      }),
    )
  })
})
