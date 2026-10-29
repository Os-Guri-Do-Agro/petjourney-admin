/**
 * Quem entrou pelo código do parceiro (E0-03).
 *
 * A lista diz, por pessoa, se assinou, o plano, o dia e quanto rendeu de participação. O filtro é
 * da API: trocar recomeça do zero, "Carregar mais" segue o cursor e cursor recusado (400) volta ao
 * topo. OPERADOR (403) e parceiro fora de operação (409) viram o estado da página.
 */

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import i18n from '@/i18n'
import { ApiError } from '@/service/api'
import type { IndicadoDoParceiroDto } from '@/service/contrato/openapi'
import type { PortalDashboard } from '@/service/parceiro/types'
import { useParceiroStore } from '@/stores/parceiro'

import IndicadosPage from '../indicados.vue'

type Portal = typeof import('@/service/parceiro/parceiro-portal-service')

const portal = vi.hoisted(() => ({
  getPortalIndicados: vi.fn<Portal['getPortalIndicados']>(),
}))

vi.mock('@/service/parceiro/parceiro-portal-service', async (importOriginal) => ({
  ...(await importOriginal<Portal>()),
  ...portal,
}))

i18n.global.locale.value = 'pt'

const Vazio = { render: () => null }
const montados: VueWrapper[] = []

function indicado(parcial: Partial<IndicadoDoParceiroDto>): IndicadoDoParceiroDto {
  return {
    nome: 'Bruno Teixeira',
    cadastradoEm: '2026-10-29T13:00:00.000Z',
    status: 'SEM_ASSINATURA',
    assinouEm: null,
    plano: null,
    participacaoCentavos: 0,
    ...parcial,
  }
}

const ANA = indicado({
  nome: 'Ana Ribeiro',
  status: 'COM_ASSINATURA',
  assinouEm: '2026-09-03T10:00:00.000Z',
  plano: 'ANUAL',
  participacaoCentavos: 2394,
})
const BRUNO = indicado({})
const CARLA = indicado({
  nome: 'Carla Mendes',
  status: 'CANCELADO',
  assinouEm: '2026-09-05T10:00:00.000Z',
  plano: 'MENSAL',
  participacaoCentavos: 399,
})

function pagina(data: IndicadoDoParceiroDto[], total: number, proximoCursor?: string) {
  return { data, meta: { total, ...(proximoCursor ? { proximoCursor } : {}) } }
}

async function abrirTela() {
  const router: Router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/parceiro/indicados', component: IndicadosPage },
      { path: '/:resto(.*)*', component: Vazio },
    ],
  })

  await router.push('/parceiro/indicados')
  await router.isReady()

  const tela = mount(IndicadosPage, {
    global: { plugins: [router, i18n, PrimeVue, ToastService] },
    attachTo: document.body,
  })

  montados.push(tela)
  await flushPromises()

  return { tela, router }
}

function botao(tela: VueWrapper, rotulo: string) {
  const achado = tela.findAll('button').find((b) => b.text().trim() === rotulo)

  if (!achado) {
    throw new Error(`sem o botão "${rotulo}"`)
  }

  return achado
}

function nomes(tela: VueWrapper) {
  return tela.findAll('.indicado .ui-linha__titulo').map((n) => n.text())
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('rede desligada no teste'))),
  )
  document.body.innerHTML = ''

  const store = useParceiroStore()
  store.parceiroId = 'parceiro-1'
  store.dashboard = { papel: 'DONO' } as PortalDashboard
  store.loadState = 'ready'
})

afterEach(() => {
  while (montados.length) {
    montados.pop()?.unmount()
  }

  vi.unstubAllGlobals()
})

describe('indicados do parceiro', () => {
  it('cada linha diz a situação, o plano, o dia e a participação quando houver', async () => {
    portal.getPortalIndicados.mockResolvedValue(pagina([ANA, BRUNO, CARLA], 3))

    const { tela } = await abrirTela()

    expect(portal.getPortalIndicados).toHaveBeenCalledWith({
      parceiroId: 'parceiro-1',
      status: undefined,
      limit: 20,
    })
    expect(tela.find('.indicados__total').text()).toBe('3 pessoas')

    const [ana, bruno, carla] = tela.findAll('.indicado')

    expect(ana!.text()).toContain('Assinou')
    expect(ana!.text()).toContain('Plano anual · Assinou em 3 de set. de 2026')
    expect(ana!.find('.indicado__participacao').text()).toMatch(/R\$\s23,94\s*de participação/)

    expect(bruno!.text()).toContain('Não assinou')
    expect(bruno!.text()).toContain('Entrou em 29 de out. de 2026')
    expect(bruno!.find('.indicado__participacao').text()).toBe('')

    expect(carla!.text()).toContain('Cancelou')
    expect(carla!.text()).toContain('Plano mensal')
    expect(tela.text()).toContain('Quem apaga a conta sai da lista.')
  })

  it('trocar o filtro recomeça a lista do zero com o recorte da API', async () => {
    portal.getPortalIndicados.mockResolvedValueOnce(pagina([ANA, BRUNO, CARLA], 3, 'c-2'))
    portal.getPortalIndicados.mockResolvedValueOnce(pagina([ANA, CARLA], 2))

    const { tela } = await abrirTela()

    await botao(tela, 'Já assinaram').trigger('click')
    await flushPromises()

    expect(portal.getPortalIndicados).toHaveBeenLastCalledWith({
      parceiroId: 'parceiro-1',
      status: 'COM_ASSINATURA',
      limit: 20,
    })
    expect(nomes(tela)).toEqual(['Ana Ribeiro', 'Carla Mendes'])
    expect(tela.find('.indicados__total').text()).toBe('2 pessoas')
    expect(tela.find('.indicados__mais').exists()).toBe(false)
  })

  it('"Carregar mais" segue o cursor e some na última página', async () => {
    portal.getPortalIndicados.mockResolvedValueOnce(pagina([ANA], 2, 'c-2'))
    portal.getPortalIndicados.mockResolvedValueOnce(pagina([BRUNO], 2))

    const { tela } = await abrirTela()

    await botao(tela, 'Carregar mais').trigger('click')
    await flushPromises()

    expect(portal.getPortalIndicados).toHaveBeenLastCalledWith({
      parceiroId: 'parceiro-1',
      status: undefined,
      cursor: 'c-2',
      limit: 20,
    })
    expect(nomes(tela)).toEqual(['Ana Ribeiro', 'Bruno Teixeira'])
    expect(tela.find('.indicados__mais').exists()).toBe(false)
  })

  it('cursor recusado (400) volta ao topo da lista', async () => {
    portal.getPortalIndicados.mockResolvedValueOnce(pagina([ANA], 2, 'c-velho'))
    portal.getPortalIndicados.mockRejectedValueOnce(new ApiError('cursor inválido', 400))
    portal.getPortalIndicados.mockResolvedValueOnce(pagina([ANA, BRUNO], 2))

    const { tela } = await abrirTela()

    await botao(tela, 'Carregar mais').trigger('click')
    await flushPromises()

    expect(portal.getPortalIndicados).toHaveBeenCalledTimes(3)
    expect(portal.getPortalIndicados).toHaveBeenLastCalledWith({
      parceiroId: 'parceiro-1',
      status: undefined,
      limit: 20,
    })
    expect(nomes(tela)).toEqual(['Ana Ribeiro', 'Bruno Teixeira'])
  })

  it('outra falha no "Carregar mais" fica no pé da lista, com tentar de novo', async () => {
    portal.getPortalIndicados.mockResolvedValueOnce(pagina([ANA], 2, 'c-2'))
    portal.getPortalIndicados.mockRejectedValueOnce(new ApiError('fora do ar', 503))

    const { tela } = await abrirTela()

    await botao(tela, 'Carregar mais').trigger('click')
    await flushPromises()

    expect(tela.find('.indicados__erro-mais').text()).toContain(
      'Não deu para carregar o resto da lista.',
    )
    expect(nomes(tela)).toEqual(['Ana Ribeiro'])
  })

  it('operador (403) vê que a lista é só do dono, sem filtros', async () => {
    portal.getPortalIndicados.mockRejectedValue(new ApiError('Acesso restrito', 403))

    const { tela } = await abrirTela()

    expect(tela.text()).toContain('Só quem é dono da conta vê esta lista')
    expect(tela.find('.indicados__filtros').exists()).toBe(false)
  })

  it('parceiro fora de operação (409) diz que a lista volta quando o cadastro voltar', async () => {
    portal.getPortalIndicados.mockRejectedValue(new ApiError('Parceiro não operável', 409))

    const { tela } = await abrirTela()

    expect(tela.text()).toContain('Lista indisponível no momento')
  })

  it('ninguém ainda: a página diz isso e leva ao código e ao QR', async () => {
    portal.getPortalIndicados.mockResolvedValue(pagina([], 0))

    const { tela, router } = await abrirTela()

    expect(tela.text()).toContain('Ninguém entrou pelo seu código ainda')
    expect(tela.find('.indicados__filtros').exists()).toBe(false)

    await botao(tela, 'Ver meu código e QR').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/parceiro/divulgacao#indicacao')
  })

  it('recorte vazio explica o recorte e deixa os filtros à mão', async () => {
    portal.getPortalIndicados.mockResolvedValueOnce(pagina([BRUNO], 1))
    portal.getPortalIndicados.mockResolvedValueOnce(pagina([], 0))

    const { tela } = await abrirTela()

    await botao(tela, 'Cancelaram').trigger('click')
    await flushPromises()

    expect(tela.find('.indicados__vazio').text()).toContain('Ninguém cancelou')
    expect(tela.find('.indicados__filtros').exists()).toBe(true)
    expect(tela.find('.indicados__total').text()).toBe('0 pessoas')
  })

  it('resposta atrasada de um filtro antigo não pisa na lista nova', async () => {
    let soltarPrimeira: (valor: ReturnType<typeof pagina>) => void = () => undefined

    portal.getPortalIndicados.mockResolvedValueOnce(pagina([ANA, BRUNO, CARLA], 3))
    portal.getPortalIndicados.mockReturnValueOnce(
      new Promise((resolve) => {
        soltarPrimeira = resolve
      }),
    )
    portal.getPortalIndicados.mockResolvedValueOnce(pagina([BRUNO], 1))

    const { tela } = await abrirTela()

    await botao(tela, 'Já assinaram').trigger('click')
    await botao(tela, 'Não assinaram').trigger('click')
    await flushPromises()

    soltarPrimeira(pagina([ANA, CARLA], 2))
    await flushPromises()

    expect(nomes(tela)).toEqual(['Bruno Teixeira'])
  })
})
