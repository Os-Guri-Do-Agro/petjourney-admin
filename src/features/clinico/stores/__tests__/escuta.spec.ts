/**
 * Store da anamnese por voz, de ponta a ponta com a consulta de demonstração.
 *
 * O que estes testes guardam são as regras que a tela promete e que nenhum teste de motor vê:
 *
 * 1. **Nada grava sem autorização**, e o sim fica registrado com nome.
 * 2. **Nada nasce marcado** na revisão; corrigir já marca.
 * 3. **Só o marcado vai para o prontuário.**
 * 4. **Cada fase abre com a vista que serve a ela** — ouvindo com a conversa, revisão sem ela,
 *    aplicada recolhida —, e a pessoa manda dentro da fase.
 * 5. **Sair da tela fecha o microfone** sem perder o que foi ouvido.
 */

import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Anamnese } from '../../data/types'
import { useEscutaStore } from '../escuta'

const ANAMNESE_VAZIA: Anamnese = {
  queixaPrincipal: '',
  historia: '',
  duracaoSintomas: '',
  evolucao: '',
  antecedentes: [],
  apetite: '',
  evacuacao: '',
  miccao: '',
  ambiente: '',
  vacinacaoEmDia: null,
  vermifugacaoEmDia: null,
}

function comecar() {
  const escuta = useEscutaStore()

  escuta.escolherFonte('demonstracao')
  escuta.pedirGravacao('enc-demo')
  escuta.iniciar({
    encounterId: 'enc-demo',
    responsavel: 'Camila',
    pet: 'Nina',
    sexo: 'femea',
    reduzirMovimento: true,
  })

  return escuta
}

describe('store da escuta', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    useEscutaStore().$limpar()
    vi.useRealTimers()
  })

  it('pede autorização antes de ouvir, e registra quem autorizou', () => {
    const escuta = useEscutaStore()

    escuta.pedirGravacao('enc-demo')

    expect(escuta.autorizacaoAberta).toBe(true)
    expect(escuta.fase).toBe('inativa')

    comecar()

    expect(escuta.fase).toBe('gravando')
    expect(escuta.autorizacaoAberta).toBe(false)
    expect(escuta.autorizacao?.responsavel).toBe('Camila')
  })

  it('ouvindo, a conversa chega trecho a trecho e as propostas acompanham', () => {
    const escuta = comecar()

    expect(escuta.trechos).toHaveLength(0)

    vi.advanceTimersByTime(4000)

    expect(escuta.trechos.length).toBeGreaterThan(0)
    expect(escuta.propostas.some((proposta) => proposta.campo === 'queixaPrincipal')).toBe(true)
    expect(escuta.tempoMs).toBeGreaterThan(0)
  })

  it('na revisão nada nasce marcado; corrigir marca; só o marcado vai para o prontuário', () => {
    const escuta = comecar()

    escuta.adiantar()
    escuta.encerrar()

    expect(escuta.fase).toBe('revisao')
    expect(escuta.propostas).toHaveLength(12)
    expect(escuta.marcadas).toHaveLength(0)

    /* O latido fez "dois" virar "dez": o veterinário corrige sem regravar. */
    escuta.corrigir('duracaoSintomas', { valor: '2 dias' })
    escuta.marcar('queixaPrincipal', true)

    expect(escuta.decisoes.duracaoSintomas).toMatchObject({ incluir: true, corrigida: true })

    const patch = escuta.aplicar(ANAMNESE_VAZIA, () => 'ant-1')

    expect(patch).toEqual({ queixaPrincipal: 'Vômito, apatia', duracaoSintomas: '2 dias' })
    expect(escuta.fase).toBe('aplicada')
  })

  it('cada fase abre com a vista dela, e a pessoa muda dentro da fase', () => {
    const escuta = comecar()

    /* Ouvindo: tudo aberto, com a conversa. */
    expect(escuta.recolhida).toBe(false)
    expect(escuta.conversaAberta).toBe(true)

    /* Quem recolhe durante a conversa vê a seção recolhida até a fase mudar. */
    escuta.alternarRecolhida()
    expect(escuta.recolhida).toBe(true)

    escuta.adiantar()
    escuta.encerrar()

    /* Revisão: reabre, sem a conversa — a decisão é sobre os campos. */
    expect(escuta.recolhida).toBe(false)
    expect(escuta.conversaAberta).toBe(false)

    /* "Ver na conversa" abre a conversa, e a seção junto se estiver recolhida. */
    escuta.alternarRecolhida()
    escuta.abrirConversa()
    expect(escuta.recolhida).toBe(false)
    expect(escuta.conversaAberta).toBe(true)

    escuta.marcar('queixaPrincipal', true)
    escuta.aplicar(ANAMNESE_VAZIA, () => 'ant-1')

    /* Aplicada: vira uma linha. */
    expect(escuta.recolhida).toBe(true)
    expect(escuta.conversaAberta).toBe(false)
  })

  it('sair da tela no meio da conversa fecha a escuta e guarda o que foi ouvido', () => {
    const escuta = comecar()

    vi.advanceTimersByTime(8000)

    const ouvidos = escuta.trechos.length

    escuta.suspender()

    expect(escuta.fase).toBe('revisao')
    expect(escuta.trechos).toHaveLength(ouvidos)

    /* A fonte foi solta: o relógio não anda mais. */
    const tempo = escuta.tempoMs

    vi.advanceTimersByTime(5000)
    expect(escuta.tempoMs).toBe(tempo)
    expect(escuta.trechos).toHaveLength(ouvidos)
  })

  it('descartar joga fora a gravação inteira e volta ao começo', () => {
    const escuta = comecar()

    escuta.adiantar()
    escuta.encerrar()
    escuta.descartar()

    expect(escuta.fase).toBe('inativa')
    expect(escuta.trechos).toHaveLength(0)
    expect(escuta.autorizacao).toBeNull()
  })
})
