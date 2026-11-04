/**
 * A tela do link do convite para a equipe (E0-01, prévia do PJ-4BI7TE).
 *
 * Com o token guardado, a tela diz de que empresa é o convite, quem convidou, o papel e até
 * quando vale, e só então libera aceitar e recusar. Link vencido ou já usado sai da tela com a
 * mensagem da API e mostra os convites que ainda valem. Prévia que falha por outro motivo não
 * impede o aceite: o convite continua, só sem o nome da empresa.
 *
 * Conta que já é da equipe (PJ-VK5P13): com um convite que foi para outro e-mail, a tela diz que o
 * convite é para outra conta e troca de conta sem perder o token; com o próprio convite, seguir
 * para o portal fecha o convite.
 */

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import i18n from '@/i18n'
import { ApiError } from '@/service/api'
import { guardarTokenDoConvite, lerTokenDoConvite } from '@/service/parceiro/convite-pendente'
import { useParceiroStore } from '@/stores/parceiro'

import ConvitePage from '../convite.vue'

type Equipe = typeof import('@/service/parceiro/equipe-service')

const equipe = vi.hoisted(() => ({
  previaDoConvitePorLink: vi.fn<Equipe['previaDoConvitePorLink']>(),
  aceitarConvitePorLink: vi.fn<Equipe['aceitarConvitePorLink']>(),
  recusarConvitePorLink: vi.fn<Equipe['recusarConvitePorLink']>(),
  listarMeusConvites: vi.fn<Equipe['listarMeusConvites']>(),
}))

vi.mock('@/service/parceiro/equipe-service', async (importOriginal) => ({
  ...(await importOriginal<Equipe>()),
  ...equipe,
}))

const avisos = vi.hoisted(() => ({
  add: vi.fn<
    (aviso: { severity: string; summary: string; detail?: string; life?: number }) => void
  >(),
}))

vi.mock('primevue/usetoast', () => ({ useToast: () => avisos }))

/** O aviso de sucesso do aceite: o que a pessoa lê depois de entrar na equipe. */
function ultimoAviso() {
  return avisos.add.mock.lastCall?.[0]
}

i18n.global.locale.value = 'pt'

const Vazio = { render: () => null }
const montados: VueWrapper[] = []

const PREVIA = {
  conviteId: 'convite-1',
  parceiro: { id: 'parceiro-1', nome: 'Aurora Clínica e Hotel Veterinário', logoUrl: null },
  papel: 'OPERADOR' as const,
  convidadoPorNome: 'Helena Prado',
  expiraEm: '2026-11-11T15:00:00.000Z',
  contaConectada: { jaFazParte: false, papelAtual: null, paraEstaConta: null },
}

async function abrirTela() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/parceiro/convite', component: ConvitePage },
      { path: '/:resto(.*)*', component: Vazio },
    ],
  })

  await router.push('/parceiro/convite')
  await router.isReady()

  const tela = mount(ConvitePage, {
    global: { plugins: [router, i18n, PrimeVue, ToastService] },
    attachTo: document.body,
  })

  montados.push(tela)
  await flushPromises()

  return tela
}

function botao(tela: VueWrapper, rotulo: string) {
  const achado = tela.findAll('button').find((b) => b.text().includes(rotulo))

  if (!achado) {
    throw new Error(`sem o botão "${rotulo}"`)
  }

  return achado
}

beforeEach(() => {
  setActivePinia(createPinia())
  sessionStorage.clear()
  vi.clearAllMocks()
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('rede desligada no teste'))),
  )
  document.body.innerHTML = ''
})

afterEach(() => {
  while (montados.length) {
    montados.pop()?.unmount()
  }

  vi.unstubAllGlobals()
})

describe('convite pelo link', () => {
  it('a prévia diz a empresa, quem convidou, o papel e o prazo', async () => {
    guardarTokenDoConvite('token-1')
    equipe.previaDoConvitePorLink.mockResolvedValue(PREVIA)

    const tela = await abrirTela()

    expect(equipe.previaDoConvitePorLink).toHaveBeenCalledWith('token-1')
    expect(tela.find('.convite-linha__empresa').text()).toBe('Aurora Clínica e Hotel Veterinário')
    expect(tela.find('.convite-linha').text()).toContain('Helena Prado convidou você como operador')
    expect(tela.find('.convite-linha').text()).toContain('Vale até 11 de novembro')
    expect(botao(tela, 'Aceitar convite').attributes('disabled')).toBeUndefined()
  })

  it('link vencido na prévia: o token sai e a caixa diz o motivo com a mensagem da API', async () => {
    guardarTokenDoConvite('token-velho')
    equipe.previaDoConvitePorLink.mockRejectedValue(
      new ApiError('Este convite venceu.', 410, undefined, undefined, {
        codigo: 'CONVITE_EXPIRADO',
      }),
    )
    equipe.listarMeusConvites.mockResolvedValue([])

    const tela = await abrirTela()

    expect(lerTokenDoConvite()).toBeNull()
    expect(tela.find('.caixa__aviso').text()).toContain('Este convite não vale mais')
    expect(tela.find('.caixa__aviso').text()).toContain('Este convite venceu.')
    expect(tela.text()).toContain('Nenhum convite pendente')
  })

  it('prévia fora do ar: o convite segue, sem o nome, e o aceite funciona', async () => {
    guardarTokenDoConvite('token-1')
    equipe.previaDoConvitePorLink.mockRejectedValue(new ApiError('Internal server error', 500))
    equipe.aceitarConvitePorLink.mockResolvedValue({
      parceiroId: 'parceiro-1',
      papel: 'OPERADOR',
      jaEraMembro: false,
    })

    const tela = await abrirTela()

    expect(tela.find('.convite-linha__sem-previa').exists()).toBe(true)

    await botao(tela, 'Aceitar convite').trigger('click')
    await flushPromises()

    expect(equipe.aceitarConvitePorLink).toHaveBeenCalledWith('token-1')
    expect(lerTokenDoConvite()).toBeNull()
    expect(ultimoAviso()).toMatchObject({
      summary: 'Convite aceito',
      detail: 'Agora você faz parte da equipe.',
    })
  })

  it('quem entra agora lê o nome da empresa no aviso', async () => {
    guardarTokenDoConvite('token-1')
    equipe.previaDoConvitePorLink.mockResolvedValue(PREVIA)
    equipe.aceitarConvitePorLink.mockResolvedValue({
      parceiroId: 'parceiro-1',
      papel: 'OPERADOR',
      jaEraMembro: false,
    })

    const tela = await abrirTela()
    await botao(tela, 'Aceitar convite').trigger('click')
    await flushPromises()

    expect(ultimoAviso()).toMatchObject({
      summary: 'Convite aceito',
      detail: 'Agora você faz parte da equipe da Aurora Clínica e Hotel Veterinário.',
    })
    expect(useParceiroStore().parceiroId).toBe('parceiro-1')
  })

  it('recusar esquece o token e mostra que o convite foi recusado', async () => {
    guardarTokenDoConvite('token-1')
    equipe.previaDoConvitePorLink.mockResolvedValue(PREVIA)
    equipe.recusarConvitePorLink.mockResolvedValue(undefined)

    const tela = await abrirTela()
    await botao(tela, 'Recusar').trigger('click')
    await flushPromises()

    expect(equipe.recusarConvitePorLink).toHaveBeenCalledWith('token-1')
    expect(lerTokenDoConvite()).toBeNull()
    expect(tela.find('h1').text()).toBe('Convite recusado')
  })
})

describe('depois da decisão', () => {
  async function recusar(outros: Awaited<ReturnType<Equipe['listarMeusConvites']>> = []) {
    guardarTokenDoConvite('token-1')
    equipe.previaDoConvitePorLink.mockResolvedValue(PREVIA)
    equipe.recusarConvitePorLink.mockResolvedValue(undefined)
    equipe.listarMeusConvites.mockResolvedValue(outros)

    const tela = await abrirTela()
    await botao(tela, 'Recusar').trigger('click')
    await flushPromises()

    return tela
  }

  it('o convite recusado fica na tela com o selo, e a faixa diz a quem pedir outro', async () => {
    const tela = await recusar()

    expect(tela.find('.desfecho .convite-linha__empresa').text()).toBe(
      'Aurora Clínica e Hotel Veterinário',
    )
    expect(tela.find('.desfecho .ui-selo').text()).toBe('Recusado')
    expect(tela.text()).toContain('Se mudar de ideia, peça um convite novo a Helena Prado.')
    expect(tela.find('#convite-outros').exists()).toBe(false)
  })

  it('conta sem empresa: o próximo passo é cadastrar a sua', async () => {
    useParceiroStore().semAcessoParceiro = true

    const tela = await recusar()
    const acoes = tela.findAll('.desfecho__acoes a').map((a) => a.text())

    expect(tela.find('.desfecho__nota').exists()).toBe(true)
    expect(acoes).toEqual(['Cadastrar minha empresa', 'Ir para o portal'])
  })

  it('conta com empresa: só volta ao portal', async () => {
    const tela = await recusar()

    expect(tela.find('.desfecho__nota').exists()).toBe(false)
    expect(tela.findAll('.desfecho__acoes a').map((a) => a.text())).toEqual(['Ir para o portal'])
  })

  it('os convites que ainda esperam aparecem embaixo', async () => {
    const tela = await recusar([
      {
        conviteId: 'convite-2',
        parceiro: { id: 'parceiro-2', nome: 'Clínica Veterinária Boa Vista', logoUrl: null },
        papel: 'OPERADOR',
        convidadoPorNome: 'Bia Souza',
        expiraEm: '2026-11-09T15:00:00.000Z',
        aceitaPor: 'LINK',
      },
    ])

    expect(tela.find('#convite-outros').text()).toContain('Outros convites')
    expect(tela.find('.caixa').text()).toContain('Clínica Veterinária Boa Vista')
  })
})

describe('conta que já é da equipe', () => {
  it('convite para outro e-mail: diz que é para outra conta, sem aceitar, e troca de conta sem perder o token', async () => {
    guardarTokenDoConvite('token-1')
    equipe.previaDoConvitePorLink.mockResolvedValue({
      ...PREVIA,
      contaConectada: { jaFazParte: true, papelAtual: 'DONO', paraEstaConta: false },
    })

    const tela = await abrirTela()

    expect(tela.find('h1').text()).toBe('Este convite é para outra conta')
    expect(tela.text()).toContain(
      'Você entrou com uma conta que já faz parte da equipe da Aurora Clínica e Hotel Veterinário',
    )
    expect(tela.findAll('button').some((b) => b.text().includes('Aceitar convite'))).toBe(false)
    expect(tela.find('.desfecho .ui-selo').exists()).toBe(false)
    expect(tela.find('.desfecho .convite-linha').text()).toContain('Convite como operador')
    expect(tela.find('.desfecho .convite-linha').text()).not.toContain('convidou você')
    expect(tela.find('.desfecho__acoes a').text()).toBe('Ir para o portal')

    await botao(tela, 'Entrar com outra conta').trigger('click')
    await flushPromises()

    expect(tela.vm.$router.currentRoute.value.path).toBe('/auth/login')
    expect(lerTokenDoConvite()).toBe('token-1')
    expect(equipe.aceitarConvitePorLink).not.toHaveBeenCalled()
  })

  it('sem prévia, o 409 do aceite leva à mesma tela, sem o nome da empresa, e o token fica', async () => {
    guardarTokenDoConvite('token-1')
    equipe.previaDoConvitePorLink.mockRejectedValue(new ApiError('Internal server error', 500))
    equipe.aceitarConvitePorLink.mockRejectedValue(
      new ApiError('Este convite é para outra conta.', 409, undefined, undefined, {
        codigo: 'CONVITE_CONTA_JA_NA_EQUIPE',
      }),
    )

    const tela = await abrirTela()
    await botao(tela, 'Aceitar convite').trigger('click')
    await flushPromises()

    expect(tela.find('h1').text()).toBe('Este convite é para outra conta')
    expect(tela.text()).toContain('já faz parte desta equipe, e o convite foi enviado para outro')
    expect(lerTokenDoConvite()).toBe('token-1')
    expect(avisos.add).not.toHaveBeenCalled()
  })

  it('o próprio convite: diz que já faz parte, e ir para o portal fecha o convite', async () => {
    guardarTokenDoConvite('token-1')
    equipe.previaDoConvitePorLink.mockResolvedValue({
      ...PREVIA,
      contaConectada: { jaFazParte: true, papelAtual: 'OPERADOR', paraEstaConta: true },
    })
    equipe.aceitarConvitePorLink.mockResolvedValue({
      parceiroId: 'parceiro-1',
      papel: 'OPERADOR',
      jaEraMembro: true,
    })

    const tela = await abrirTela()

    expect(tela.find('.desfecho .ui-selo').text()).toBe('Já está na equipe')
    expect(tela.text()).toContain(
      'Você já faz parte da equipe da Aurora Clínica e Hotel Veterinário.',
    )
    expect(tela.findAll('button').some((b) => b.text().includes('Aceitar convite'))).toBe(false)

    await botao(tela, 'Ir para o portal').trigger('click')
    await flushPromises()

    expect(equipe.aceitarConvitePorLink).toHaveBeenCalledWith('token-1')
    expect(lerTokenDoConvite()).toBeNull()
    expect(ultimoAviso()).toMatchObject({
      summary: 'Já está na equipe',
      detail:
        'Você já fazia parte desta equipe. O convite foi fechado e seu acesso continua o mesmo.',
    })
  })
})
