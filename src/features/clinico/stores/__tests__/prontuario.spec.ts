/**
 * Store do prontuário: o autosave com rede lenta ou caída.
 *
 * As três regras que estes testes guardam falham em silêncio e perdem texto de consulta:
 *
 * 1. **O que se digita durante a gravação fica.** A resposta do servidor trazia o texto enviado e
 *    voltava inteira para a tela: o campo recuava e o que se digitasse em seguida apagava o resto.
 * 2. **Rede caída não tira a folha da tela.** A falha de uma gravação virava erro de página
 *    ("Não foi possível carregar") no meio da consulta; agora vira aviso e nova tentativa.
 * 3. **Finalizar não fecha texto que não foi gravado.**
 */

import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { resetMockConfig, setMockConfig } from '../../data/mock-runtime'
import { getDataset, resetDataset } from '../../data/store'
import type { Encounter } from '../../data/types'
import { useClinicoStore } from '../clinico'
import { useProntuarioStore } from '../prontuario'

/** Latência fixa da gravação: maior que a pausa do autosave, para caber digitação no meio. */
const LATENCIA = 1000
const PAUSA_DO_AUTOSAVE = 800
const NOVA_TENTATIVA = 5000

function rascunhoLivre(): Encounter {
  const encontrado = getDataset().encounters.find(
    (item) => item.status === 'rascunho' && !item.lock,
  )

  if (!encontrado) {
    throw new Error('o dataset precisa de um atendimento aberto e sem dono')
  }

  return encontrado
}

async function abrir() {
  const prontuario = useProntuarioStore()
  const alvo = rascunhoLivre()

  await prontuario.abrirPorId(alvo.id)

  return { prontuario, alvo }
}

function digitarQueixa(texto: string) {
  const prontuario = useProntuarioStore()

  prontuario.atualizar({
    anamnese: { ...prontuario.encounter!.anamnese, queixaPrincipal: texto },
  })
}

describe('autosave do prontuário', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    window.localStorage.clear()
    resetDataset()
    resetMockConfig()
    setMockConfig({ latenciaMs: 0, jitterMs: 0 })
    await useClinicoStore().carregar(true)
    vi.useFakeTimers()
    setMockConfig({ latenciaMs: LATENCIA })
  })

  afterEach(() => {
    vi.useRealTimers()
    resetMockConfig()
  })

  it('mantém o que se digitou enquanto a gravação anterior viajava', async () => {
    const abertura = abrir()

    await vi.advanceTimersByTimeAsync(LATENCIA * 3)

    const { prontuario, alvo } = await abertura

    digitarQueixa('Tosse')
    await vi.advanceTimersByTimeAsync(PAUSA_DO_AUTOSAVE)

    /* A primeira gravação está no ar; a pessoa continua digitando. */
    digitarQueixa('Tosse seca')
    await vi.advanceTimersByTimeAsync(LATENCIA)

    expect(prontuario.encounter?.anamnese.queixaPrincipal).toBe('Tosse seca')

    await vi.advanceTimersByTimeAsync(PAUSA_DO_AUTOSAVE + LATENCIA)

    expect(prontuario.encounter?.anamnese.queixaPrincipal).toBe('Tosse seca')
    expect(
      getDataset().encounters.find((item) => item.id === alvo.id)?.anamnese.queixaPrincipal,
    ).toBe('Tosse seca')
  })

  it('com a rede caída avisa, guarda o texto e grava sozinho quando ela volta', async () => {
    const abertura = abrir()

    await vi.advanceTimersByTimeAsync(LATENCIA * 3)

    const { prontuario, alvo } = await abertura

    setMockConfig({ erroPorOperacao: { 'encounter.salvar': 1 } })
    digitarQueixa('Vômito desde ontem')
    await vi.advanceTimersByTimeAsync(PAUSA_DO_AUTOSAVE + LATENCIA)

    expect(prontuario.falhaAoGravar).toBe(true)
    expect(prontuario.erro).toBe('')
    expect(prontuario.encounter?.anamnese.queixaPrincipal).toBe('Vômito desde ontem')
    expect(window.localStorage.getItem(`clinic.draft.${alvo.id}`)).not.toBeNull()

    setMockConfig({ erroPorOperacao: { 'encounter.salvar': 0 } })
    await vi.advanceTimersByTimeAsync(NOVA_TENTATIVA + LATENCIA)

    expect(prontuario.falhaAoGravar).toBe(false)
    expect(
      getDataset().encounters.find((item) => item.id === alvo.id)?.anamnese.queixaPrincipal,
    ).toBe('Vômito desde ontem')
    expect(window.localStorage.getItem(`clinic.draft.${alvo.id}`)).toBeNull()
  })

  it('não finaliza enquanto houver texto que a rede não levou', async () => {
    const abertura = abrir()

    await vi.advanceTimersByTimeAsync(LATENCIA * 3)

    const { prontuario, alvo } = await abertura

    setMockConfig({ erroPorOperacao: { 'encounter.salvar': 1 } })
    digitarQueixa('Claudicação no posterior esquerdo')

    /* O `catch` já pendurado: a recusa chega enquanto o relógio falso anda. */
    const finalizando = prontuario.finalizar().then(
      () => null,
      (falha: unknown) => falha,
    )

    await vi.advanceTimersByTimeAsync(LATENCIA * 2)

    expect(await finalizando).toBeInstanceOf(Error)

    expect(getDataset().encounters.find((item) => item.id === alvo.id)?.status).toBe('rascunho')
    expect(prontuario.encounter?.anamnese.queixaPrincipal).toBe('Claudicação no posterior esquerdo')
  })
})
