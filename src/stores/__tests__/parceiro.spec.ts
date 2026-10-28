import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/service/api'
import type { PortalDashboard, PortalStatus } from '@/service/parceiro/types'
import { useParceiroStore } from '@/stores/parceiro'

const getPortalDashboard = vi.fn<(query?: unknown) => Promise<PortalDashboard>>()
const getPortalStatus = vi.fn<(query?: unknown) => Promise<PortalStatus>>()

vi.mock('@/service/parceiro/parceiro-portal-service', () => ({
  getPortalDashboard: (...args: unknown[]) => getPortalDashboard(...args),
  getPortalStatus: (...args: unknown[]) => getPortalStatus(...args),
}))

function dashboardDe(id: string) {
  return {
    parceiro: { id, nome: 'Clínica Teste' },
    papel: 'DONO',
  } as unknown as PortalDashboard
}

const STATUS_OK = {
  statusAuditoria: 'APROVADO',
  podeOperar: true,
  afiliado: { status: 'ATIVO', motivo: null, decididoEm: null, podeSolicitar: false },
  participativo: { status: 'ATIVO', motivo: null, decididoEm: null, podeSolicitar: false },
  statusAfiliado: 'ATIVO',
  statusParticipativo: 'ATIVO',
} as unknown as PortalStatus

function respondeOk(id = 'p-vivo') {
  getPortalDashboard.mockResolvedValue(dashboardDe(id))
  getPortalStatus.mockResolvedValue(STATUS_OK)
}

function respondeForbidden() {
  getPortalDashboard.mockRejectedValue(new ApiError('forbidden', 403))
  getPortalStatus.mockRejectedValue(new ApiError('forbidden', 403))
}

describe('store parceiro: exclusão lógica do parceiro', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    window.localStorage.clear()
    getPortalDashboard.mockReset()
    getPortalStatus.mockReset()
  })

  it('403 no parceiro guardado retenta sem o id e segue com o parceiro que sobrou', async () => {
    const store = useParceiroStore()
    store.setParceiroId('p-excluido')

    getPortalDashboard
      .mockRejectedValueOnce(new ApiError('forbidden', 403))
      .mockResolvedValueOnce(dashboardDe('p-vivo'))
    getPortalStatus
      .mockRejectedValueOnce(new ApiError('forbidden', 403))
      .mockResolvedValueOnce(STATUS_OK)

    await store.bootstrap(true)

    expect(store.loadState).toBe('ready')
    expect(store.parceiroId).toBe('p-vivo')
    expect(store.semAcessoParceiro).toBe(false)
    expect(store.acessoEncerrado).toBe(false)
    expect(getPortalDashboard).toHaveBeenNthCalledWith(1, { parceiroId: 'p-excluido' })
    expect(getPortalDashboard).toHaveBeenNthCalledWith(2, undefined)
  })

  it('403 depois da retentativa, sem contexto anterior, é conta sem acesso', async () => {
    const store = useParceiroStore()
    store.setParceiroId('p-excluido')
    respondeForbidden()

    await expect(store.bootstrap(true)).rejects.toBeInstanceOf(ApiError)

    expect(store.semAcessoParceiro).toBe(true)
    expect(store.acessoEncerrado).toBe(false)
    expect(store.parceiroId).toBeNull()
    expect(window.localStorage.getItem('petjourney-parceiro-id')).toBeNull()
  })

  it('403 depois de o portal ter carregado marca acesso encerrado e limpa o contexto', async () => {
    const store = useParceiroStore()
    respondeOk()
    await store.bootstrap(true)
    expect(store.dashboard).not.toBeNull()

    respondeForbidden()
    await expect(store.bootstrap(true)).rejects.toBeInstanceOf(ApiError)

    expect(store.acessoEncerrado).toBe(true)
    expect(store.semAcessoParceiro).toBe(true)
    expect(store.dashboard).toBeNull()
    expect(store.status).toBeNull()
  })

  it('400 continua pedindo escolha explícita de parceiro', async () => {
    const store = useParceiroStore()
    getPortalDashboard.mockRejectedValue(new ApiError('bad request', 400))
    getPortalStatus.mockRejectedValue(new ApiError('bad request', 400))

    await expect(store.bootstrap(true)).rejects.toBeInstanceOf(ApiError)

    expect(store.needsParceiroSelection).toBe(true)
    expect(store.semAcessoParceiro).toBe(false)
    expect(store.acessoEncerrado).toBe(false)
  })

  it('revalidarAcesso ignora erro que não é 403', async () => {
    const store = useParceiroStore()

    await expect(store.revalidarAcesso(new ApiError('conflito', 409))).resolves.toBe(false)
    await expect(store.revalidarAcesso(new Error('offline'))).resolves.toBe(false)
    expect(getPortalDashboard).not.toHaveBeenCalled()
  })

  it('revalidarAcesso devolve false quando o 403 era só de permissão (contexto segue vivo)', async () => {
    const store = useParceiroStore()
    respondeOk()
    await store.bootstrap(true)

    await expect(store.revalidarAcesso(new ApiError('forbidden', 403))).resolves.toBe(false)
    expect(store.loadState).toBe('ready')
    expect(store.acessoEncerrado).toBe(false)
  })

  it('revalidarAcesso devolve true quando o contexto também caiu', async () => {
    const store = useParceiroStore()
    respondeOk()
    await store.bootstrap(true)

    respondeForbidden()

    await expect(store.revalidarAcesso(new ApiError('forbidden', 403))).resolves.toBe(true)
    expect(store.acessoEncerrado).toBe(true)
  })
})

describe('store parceiro: a carga que a tela inteira pede junto', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    window.localStorage.clear()
    getPortalDashboard.mockReset()
    getPortalStatus.mockReset()
  })

  it('moldura, Início e blocos pedindo ao mesmo tempo viram um só par de pedidos', async () => {
    const store = useParceiroStore()
    respondeOk()

    await Promise.all([store.bootstrap(), store.bootstrap(), store.bootstrap(), store.bootstrap()])

    expect(getPortalDashboard).toHaveBeenCalledTimes(1)
    expect(getPortalStatus).toHaveBeenCalledTimes(1)
    expect(store.loadState).toBe('ready')
  })

  it('o forçado ainda pede de novo, mesmo com uma carga em andamento', async () => {
    const store = useParceiroStore()
    respondeOk()

    await Promise.all([store.bootstrap(), store.bootstrap(true)])

    expect(getPortalDashboard).toHaveBeenCalledTimes(2)
  })

  it('guarda o nome da empresa para o topo da barra da próxima sessão, e esquece ao sair', async () => {
    const store = useParceiroStore()
    respondeOk()

    await store.bootstrap()
    expect(window.localStorage.getItem('petjourney-parceiro-nome')).toBe('Clínica Teste')

    setActivePinia(createPinia())
    expect(useParceiroStore().parceiroNome).toBe('Clínica Teste')

    useParceiroStore().reset()
    expect(window.localStorage.getItem('petjourney-parceiro-nome')).toBeNull()
  })
})

describe('store parceiro: aprovação vista pela primeira vez', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    window.localStorage.clear()
    getPortalDashboard.mockReset()
    getPortalStatus.mockReset()
  })

  it('PENDENTE numa sessão e APROVADO na seguinte: avisa uma vez', async () => {
    getPortalDashboard.mockResolvedValue(dashboardDe('p-1'))
    getPortalStatus.mockResolvedValueOnce({
      ...STATUS_OK,
      statusAuditoria: 'PENDENTE',
    } as PortalStatus)

    await useParceiroStore().bootstrap()
    expect(useParceiroStore().aprovacaoRecente).toBe(false)

    setActivePinia(createPinia())
    getPortalStatus.mockResolvedValueOnce(STATUS_OK)
    const depois = useParceiroStore()
    await depois.bootstrap()

    expect(depois.aprovacaoRecente).toBe(true)
    depois.aprovacaoAvisada()

    setActivePinia(createPinia())
    getPortalStatus.mockResolvedValueOnce(STATUS_OK)
    const outraVez = useParceiroStore()
    await outraVez.bootstrap()
    expect(outraVez.aprovacaoRecente).toBe(false)
  })
})
