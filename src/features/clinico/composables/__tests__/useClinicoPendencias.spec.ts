/**
 * O contador da clínica diz quando não conseguiu olhar.
 *
 * O que era: fonte que não respondia virava lista vazia, a lista vazia virava zero, e o zero virava
 * "Nada pedindo ação agora" com a hora da conferência ao lado. Estes testes garantem o contrário —
 * falha é falha, parcial é parcial, e um número conhecido não é trocado por um zero inventado.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { resetMockConfig, setMockConfig } from '../../data/mock-runtime'
import { resetDataset } from '../../data/store'
import { limparPendenciasClinicas, useClinicoPendencias } from '../useClinicoPendencias'

beforeEach(() => {
  resetDataset()
  setMockConfig({ latenciaMs: 0, jitterMs: 0 })
  limparPendenciasClinicas()
})

afterEach(() => {
  resetMockConfig()
})

describe('useClinicoPendencias', () => {
  it('com todas as fontes respondendo, a conferência é completa e tem hora', async () => {
    const pendencias = useClinicoPendencias(() => true)
    await pendencias.recarregar()

    expect(pendencias.situacao.value).toBe('ok')
    expect(pendencias.conferidoEm.value).toBeInstanceOf(Date)
  })

  it('uma fonte que falha deixa a conferência parcial', async () => {
    setMockConfig({ erroPorOperacao: { 'internacao.mapa': 1 } })

    const pendencias = useClinicoPendencias(() => true)
    await pendencias.recarregar()

    expect(pendencias.situacao.value).toBe('parcial')
    expect(pendencias.conferidoEm.value).toBeInstanceOf(Date)
  })

  it('numa conferência parcial, o contador da fonte que falhou mantém o último valor', async () => {
    const pendencias = useClinicoPendencias(() => true)
    await pendencias.recarregar()

    const internacaoAntes = pendencias.internacao.value

    setMockConfig({ erroPorOperacao: { 'internacao.mapa': 1 } })
    await pendencias.recarregar()

    expect(pendencias.situacao.value).toBe('parcial')
    expect(pendencias.internacao.value).toEqual(internacaoAntes)
  })

  it('sem nenhuma fonte, a conferência falha e não registra hora', async () => {
    setMockConfig({ offline: true })

    const pendencias = useClinicoPendencias(() => true)
    await pendencias.recarregar()

    expect(pendencias.carregado.value).toBe(true)
    expect(pendencias.situacao.value).toBe('falhou')
    expect(pendencias.conferidoEm.value).toBeNull()
  })

  it('com o módulo desligado, não há situação a mostrar', () => {
    const pendencias = useClinicoPendencias(() => false)

    expect(pendencias.situacao.value).toBeNull()
    expect(pendencias.carregado.value).toBe(false)
  })
})
