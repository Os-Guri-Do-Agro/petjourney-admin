/**
 * A tela de Acessos com o cadastro em análise.
 *
 * Quem cria a conta de parceiro pela página do acesso chega aqui em análise, com o código na mão
 * (`?vincular=`). O modal abre do mesmo jeito, guarda o código, e o aviso de espera aparece em
 * cima da lista. Na aprovação o acesso entra na lista e o aviso some; o que venceu antes vira o
 * aviso de vencido. A leitura dos avisos é recado: falhou, a lista segue como se nada houvesse.
 */

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import i18n from '@/i18n'
import type {
  CompartilhamentoResumo,
  PortalDashboard,
  PortalStatus,
  ReivindicacaoAcesso,
  SituacaoReivindicacao,
} from '@/service/parceiro/types'

import AcessosPage from '../index.vue'

type Servico = typeof import('@/service/parceiro/compartilhamentos-service')
type Portal = typeof import('@/service/parceiro/parceiro-portal-service')

const servico = vi.hoisted(() => ({
  getCompartilhamentos: vi.fn<Servico['getCompartilhamentos']>(),
  getReivindicacoes: vi.fn<Servico['getReivindicacoes']>(),
  reivindicarCompartilhamento: vi.fn<Servico['reivindicarCompartilhamento']>(),
  vincularCompartilhamento: vi.fn<Servico['vincularCompartilhamento']>(),
}))

const portal = vi.hoisted(() => ({
  getPortalDashboard: vi.fn<Portal['getPortalDashboard']>(),
  getPortalStatus: vi.fn<Portal['getPortalStatus']>(),
}))

vi.mock('@/service/parceiro/compartilhamentos-service', async (importOriginal) => ({
  ...(await importOriginal<Servico>()),
  ...servico,
}))

vi.mock('@/service/parceiro/parceiro-portal-service', async (importOriginal) => ({
  ...(await importOriginal<Portal>()),
  ...portal,
}))

i18n.global.locale.value = 'pt'

const Vazio = { render: () => null }

const montados: VueWrapper[] = []

const BLOCO = { status: 'NAO_SOLICITADO', motivo: null, decididoEm: null, podeSolicitar: true }

function cadastro(statusAuditoria: PortalStatus['statusAuditoria'], podeOperar: boolean) {
  portal.getPortalDashboard.mockResolvedValue({
    parceiro: { id: 'parceiro-1', nome: 'Clínica Teste' },
    papel: 'DONO',
  } as unknown as PortalDashboard)
  portal.getPortalStatus.mockResolvedValue({
    statusAuditoria,
    podeOperar,
    afiliado: BLOCO,
    participativo: BLOCO,
    statusAfiliado: 'NAO_SOLICITADO',
    statusParticipativo: 'NAO_SOLICITADO',
  } as PortalStatus)
}

function reivindicacao(situacao: SituacaoReivindicacao, petNome = 'Thor'): ReivindicacaoAcesso {
  return {
    id: `r-${petNome}`,
    petNome,
    situacao,
    criadaEm: '2026-10-20T12:00:00.000Z',
    resolvidaEm: situacao === 'AGUARDANDO_APROVACAO' ? null : '2026-10-21T12:00:00.000Z',
  }
}

function acesso(petNome: string): CompartilhamentoResumo {
  const daquiAUmaSemana = new Date(Date.now() + 7 * 24 * 3_600_000).toISOString()
  const ontem = new Date(Date.now() - 24 * 3_600_000).toISOString()

  return {
    id: `acesso-${petNome}`,
    petNome,
    especie: 'CACHORRO',
    especieLabel: 'Cachorro',
    petFoto: null,
    tipoServico: 'CONSULTA',
    servicoOutroLabel: null,
    status: 'ATIVO',
    expiraEm: daquiAUmaSemana,
    vinculadoEm: ontem,
    criadoEm: ontem,
    totalAnotacoes: 0,
    totalDocumentos: 0,
    temDiario: false,
    snapshotAtualizadoEm: null,
  }
}

function lista(...itens: CompartilhamentoResumo[]) {
  servico.getCompartilhamentos.mockResolvedValue({ data: itens, meta: { proximoCursor: null } })
}

async function abrirTela(url = '/parceiro/acessos'): Promise<{ router: Router; tela: VueWrapper }> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/parceiro/acessos', component: AcessosPage },
      { path: '/parceiro/acessos/:id', component: Vazio },
      { path: '/:resto(.*)*', component: Vazio },
    ],
  })

  await router.push(url)
  await router.isReady()

  const tela = mount(AcessosPage, {
    global: { plugins: [router, i18n, PrimeVue, ToastService] },
    attachTo: document.body,
  })

  montados.push(tela)
  await flushPromises()

  return { router, tela }
}

function avisos() {
  return [...document.body.querySelectorAll('.reivindicacoes__texto')].map((linha) =>
    linha.textContent?.trim(),
  )
}

function modal() {
  return document.body.querySelector<HTMLButtonElement>('.vincular-dialog__enviar')
}

beforeEach(() => {
  setActivePinia(createPinia())
  window.localStorage.clear()
  vi.clearAllMocks()

  /* Rede de segurança: nada destes testes pode sair para uma API de verdade. */
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

describe('cadastro em análise', () => {
  it('o código do link abre o modal, fica guardado e o aviso de espera aparece', async () => {
    cadastro('PENDENTE', false)
    lista()
    servico.getReivindicacoes.mockResolvedValueOnce({ itens: [] })
    servico.reivindicarCompartilhamento.mockResolvedValue({
      reivindicado: true,
      vinculado: false,
      vinculaNaAprovacao: true,
    })

    await abrirTela('/parceiro/acessos?vincular=123456')

    expect(modal()?.textContent).toContain('Guardar código')
    expect(avisos()).toEqual([])

    servico.getReivindicacoes.mockResolvedValueOnce({
      itens: [reivindicacao('AGUARDANDO_APROVACAO')],
    })
    modal()?.click()
    await flushPromises()

    expect(servico.reivindicarCompartilhamento).toHaveBeenCalledWith('123456', {
      parceiroId: 'parceiro-1',
    })
    expect(servico.vincularCompartilhamento).not.toHaveBeenCalled()
    expect(servico.getReivindicacoes).toHaveBeenCalledTimes(2)
    expect(avisos()).toEqual(['O acesso de Thor aparece aqui quando o seu cadastro for aprovado.'])
  })

  it('o botão "Vincular código" fica liberado', async () => {
    cadastro('PENDENTE', false)
    lista()
    servico.getReivindicacoes.mockResolvedValue({ itens: [] })

    const { tela } = await abrirTela()

    const vincular = tela.findAll('button').filter((b) => b.text().includes('Vincular código'))

    expect(vincular.length).toBeGreaterThan(0)
    expect(vincular.every((b) => b.attributes('disabled') === undefined)).toBe(true)
  })
})

describe('depois da aprovação', () => {
  it('o acesso está na lista e o aviso de espera sumiu', async () => {
    cadastro('APROVADO', true)
    lista(acesso('Thor'))
    servico.getReivindicacoes.mockResolvedValue({ itens: [reivindicacao('VINCULADO')] })

    const { tela } = await abrirTela()

    expect(tela.text()).toContain('Thor')
    expect(avisos()).toEqual([])
  })

  it('o código que venceu antes da aprovação mostra o aviso de vencido', async () => {
    cadastro('APROVADO', true)
    lista()
    servico.getReivindicacoes.mockResolvedValue({ itens: [reivindicacao('VENCIDO')] })

    await abrirTela()

    expect(avisos()).toEqual([
      'O acesso de Thor venceu antes da aprovação do seu cadastro. Peça um novo código ao responsável.',
    ])
  })

  it('cadastro aprovado continua vinculando, e não guardando', async () => {
    cadastro('APROVADO', true)
    lista()
    servico.getReivindicacoes.mockResolvedValue({ itens: [] })

    await abrirTela('/parceiro/acessos?vincular=123456')

    expect(modal()?.textContent).toContain('Vincular')
    expect(modal()?.textContent).not.toContain('Guardar código')
  })
})

describe('falha na leitura dos avisos', () => {
  it('não quebra a tela: sem aviso, sem erro, e a lista segue', async () => {
    cadastro('APROVADO', true)
    lista(acesso('Mel'))
    servico.getReivindicacoes.mockRejectedValue(new Error('falhou'))

    const { tela } = await abrirTela()

    expect(avisos()).toEqual([])
    expect(tela.find('[role="alert"]').exists()).toBe(false)
    expect(tela.text()).toContain('Mel')
  })

  it('guardou e a releitura falhou: o aviso genérico responde a quem guardou', async () => {
    cadastro('PENDENTE', false)
    lista()
    servico.getReivindicacoes.mockResolvedValueOnce({ itens: [] })
    servico.reivindicarCompartilhamento.mockResolvedValue({
      reivindicado: true,
      vinculado: false,
      vinculaNaAprovacao: true,
    })

    await abrirTela('/parceiro/acessos?vincular=123456')

    servico.getReivindicacoes.mockRejectedValueOnce(new Error('falhou'))
    modal()?.click()
    await flushPromises()

    expect(avisos()).toEqual([
      'Código guardado. O acesso aparece aqui quando o seu cadastro for aprovado.',
    ])
  })
})

describe('recusado ou suspenso', () => {
  it.each(['SUSPENSO', 'REJEITADO'] as const)(
    '%s: o link não abre o modal e o botão segue bloqueado',
    async (auditoria) => {
      cadastro(auditoria, false)
      lista()
      servico.getReivindicacoes.mockResolvedValue({ itens: [] })

      const { tela } = await abrirTela('/parceiro/acessos?vincular=123456')

      const vincular = tela.findAll('button').filter((b) => b.text().includes('Vincular código'))

      expect(modal()).toBeNull()
      expect(vincular.length).toBeGreaterThan(0)
      expect(vincular.every((b) => b.attributes('disabled') !== undefined)).toBe(true)
    },
  )
})
