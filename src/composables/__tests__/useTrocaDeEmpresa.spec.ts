/**
 * As empresas da conta e a troca entre elas (seletor do topo da barra e tela "Trocar de empresa").
 *
 * A empresa "em uso" é a que o portal opera, não a do token: o aceite de um convite troca a empresa
 * sem pedir token novo, e o `parceiroAtivoId` do token fica apontando a anterior.
 */

import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import i18n from '@/i18n'
import { useParceiroStore } from '@/stores/parceiro'

import { useTrocaDeEmpresa } from '../useTrocaDeEmpresa'

type Auth = typeof import('@/service/auth/auth-service')

const auth = vi.hoisted(() => ({
  getPerfis: vi.fn<Auth['getPerfis']>(),
  trocarParaParceiro: vi.fn<Auth['trocarParaParceiro']>(),
}))

vi.mock('@/service/auth/auth-service', async (importOriginal) => ({
  ...(await importOriginal<Auth>()),
  ...auth,
}))

const sessao = vi.hoisted(() => ({ parceiroAtivoId: 'parceiro-antigo' as string | null }))

vi.mock('@/service/auth/auth-session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/service/auth/auth-session')>()),
  getAuthUser: () => ({ userId: 'u1', parceiroAtivoId: sessao.parceiroAtivoId }),
}))

i18n.global.locale.value = 'pt'

const PERFIS = {
  usuarioId: 'u1',
  tutor: null,
  parceiros: [
    {
      parceiroId: 'parceiro-antigo',
      nome: 'Clínica Antiga',
      papel: 'DONO' as const,
      status: 'APROVADO' as const,
    },
    {
      parceiroId: 'parceiro-novo',
      nome: 'Hotel Novo',
      papel: 'OPERADOR' as const,
      status: 'APROVADO' as const,
    },
  ],
}

async function montar() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:qualquer(.*)*', component: { render: () => null } }],
  })
  await router.push('/parceiro/equipe')

  let api!: ReturnType<typeof useTrocaDeEmpresa>
  mount(
    defineComponent({
      setup() {
        api = useTrocaDeEmpresa()
        return () => h('div')
      },
    }),
    { global: { plugins: [router, i18n, PrimeVue, ToastService] } },
  )

  return { api, router }
}

beforeEach(() => {
  /* A store lembra a empresa escolhida no navegador: cada teste começa sem nenhuma. */
  localStorage.clear()
  sessionStorage.clear()
  setActivePinia(createPinia())
  vi.clearAllMocks()
  sessao.parceiroAtivoId = 'parceiro-antigo'
  auth.getPerfis.mockResolvedValue(PERFIS)
})

describe('useTrocaDeEmpresa', () => {
  it('marca como em uso a empresa do portal, mesmo com o token apontando a anterior', async () => {
    useParceiroStore().setParceiroId('parceiro-novo')
    const { api } = await montar()

    await api.carregar()

    expect(api.opcoes.value.find((opcao) => opcao.ativo)?.nome).toBe('Hotel Novo')
  })

  it('sem empresa escolhida no portal, vale a do token', async () => {
    const { api } = await montar()

    await api.carregar()

    expect(api.opcoes.value.find((opcao) => opcao.ativo)?.nome).toBe('Clínica Antiga')
  })

  it('troca: token novo, a empresa no portal e o Início dela', async () => {
    const store = useParceiroStore()
    vi.spyOn(store, 'bootstrap').mockResolvedValue(undefined)
    auth.trocarParaParceiro.mockResolvedValue({ access_token: 'a', refresh_token: 'r' })
    const { api, router } = await montar()

    expect(await api.trocar('parceiro-novo', false)).toBe(true)
    await flushPromises()

    expect(auth.trocarParaParceiro).toHaveBeenCalledWith('parceiro-novo')
    expect(store.parceiroId).toBe('parceiro-novo')
    expect(router.currentRoute.value.path).toBe('/inicio')
  })

  it('a empresa em uso não troca de novo', async () => {
    const { api } = await montar()

    expect(await api.trocar('parceiro-antigo', true)).toBe(false)
    expect(auth.trocarParaParceiro).not.toHaveBeenCalled()
  })
})
