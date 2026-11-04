import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { ApiError } from '@/service/api'
import type { EuNoParceiro } from '@/service/parceiro/acesso-service'
import { useParceiroStore } from '@/stores/parceiro'

import { motivoDaRecusa, useSeloDeAssinatura } from '../useSeloDeAssinatura'

function erro(codigo: string, reason?: string) {
  return new ApiError('recusado', 403, 'Forbidden', reason, { codigo })
}

describe('motivoDaRecusa', () => {
  it('lê o reason do 403 CRMV_NAO_CONFERIDO', () => {
    expect(motivoDaRecusa(erro('CRMV_NAO_CONFERIDO', 'SEM_IDENTIDADE'))).toBe('SEM_IDENTIDADE')
    expect(motivoDaRecusa(erro('CRMV_NAO_CONFERIDO', 'VENCIDO'))).toBe('VENCIDO')
    expect(motivoDaRecusa(erro('CRMV_NAO_CONFERIDO', 'SEM_SELO'))).toBe('SEM_SELO')
  })

  it('reason desconhecido ainda é falta de selo, e CRMV_OBRIGATORIO tem caminho próprio', () => {
    expect(motivoDaRecusa(erro('CRMV_NAO_CONFERIDO', 'OUTRO'))).toBe('SEM_SELO')
    expect(motivoDaRecusa(erro('CRMV_OBRIGATORIO'))).toBe('CRMV_OBRIGATORIO')
  })

  it('outro erro não é do selo', () => {
    expect(motivoDaRecusa(erro('PACIENTE_NAO_ENCONTRADO'))).toBeNull()
    expect(motivoDaRecusa(new Error('rede'))).toBeNull()
  })
})

describe('useSeloDeAssinatura', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('lê permissões, atos e motivo do /eu', () => {
    const store = useParceiroStore()
    store.eu = {
      aguardandoConferencia: ['receita.assinar'],
      atosAguardandoConferencia: ['INICIAR_ESCUTA', 'ASSINAR_RECEITA'],
      motivoDaConferencia: 'SEM_IDENTIDADE',
      identidade: { status: 'RECUSADA' },
    } as unknown as EuNoParceiro

    const selo = useSeloDeAssinatura()

    expect(selo.permissaoAguarda('receita.assinar')).toBe(true)
    expect(selo.permissaoAguarda('prontuario.escrever')).toBe(false)
    expect(selo.atoAguarda('INICIAR_ESCUTA')).toBe(true)
    expect(selo.atoAguarda('FINALIZAR')).toBe(false)
    expect(selo.motivo.value).toBe('SEM_IDENTIDADE')
    expect(selo.identidade.value).toBe('RECUSADA')
  })

  it('sem /eu, nada aguarda', () => {
    const selo = useSeloDeAssinatura()

    expect(selo.permissaoAguarda('receita.assinar')).toBe(false)
    expect(selo.motivo.value).toBeNull()
  })
})
