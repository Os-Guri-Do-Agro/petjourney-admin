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
