/**
 * Store da fila de espera.
 *
 * A fila só tem sentido se a vaga que abriu chegar até ela. Três eventos produzem vaga —
 * cancelar, marcar falta e remover bloqueio — e é a agenda que os dispara; aqui fica o que
 * fazer quando isso acontece: achar quem cabe naquela janela e oferecer.
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { waitlistRepository } from '../data/repositories'
import type { ISODateTime, WaitlistEntry, WaitlistPriority, WaitlistWindow } from '../data/types'
import { posicoesDaFila } from '../domain/waitlist'

import { clinicClock, useClinicoStore } from './clinico'

export type VagaAberta = {
  inicio: ISODateTime
  professionalId: string
  candidatos: WaitlistEntry[]
}

export const useFilaStore = defineStore('clinico-fila', () => {
  const clinico = useClinicoStore()

  const entradas = ref<WaitlistEntry[]>([])
  const carregando = ref(false)
  const salvando = ref(false)
  const erro = ref('')
  const vagaAberta = ref<VagaAberta | null>(null)

  const aguardando = computed(() =>
    entradas.value.filter((entrada) => entrada.status === 'aguardando'),
  )

  const ofertadas = computed(() =>
    entradas.value.filter((entrada) => entrada.status === 'ofertado'),
  )

  const ativas = computed(() =>
    entradas.value.filter((entrada) => entrada.status !== 'removido'),
  )

  const vazio = computed(() => !carregando.value && !erro.value && ativas.value.length === 0)

  /**
   * Posição de cada entrada que aguarda. É o que responde "sou o quantos?" no telefone.
   *
   * Fica na store, e não na tela, porque a agenda também precisa dela: a oferta de vaga mostra
   * os candidatos e a posição é o que justifica a ordem em que eles aparecem.
   */
  const posicoes = computed(() => posicoesDaFila(entradas.value))

  function posicaoDe(id: string): number | null {
    return posicoes.value.get(id) ?? null
  }

  async function carregar() {
    carregando.value = true
    erro.value = ''

    try {
      entradas.value = await waitlistRepository.listar()
    } catch {
      erro.value = 'clinico.erros.fila'
    } finally {
      carregando.value = false
    }
  }

  /** Chamado pela agenda quando um horário volta a ficar livre. */
  async function aoLiberarHorario(inicio: ISODateTime, professionalId: string) {
    try {
      const candidatos = await waitlistRepository.elegiveisPara(inicio, professionalId)

      vagaAberta.value = candidatos.length > 0 ? { inicio, professionalId, candidatos } : null
    } catch {
      vagaAberta.value = null
    }
  }

  function dispensarVaga() {
    vagaAberta.value = null
  }

  async function ofertar(id: string, slotInicio: ISODateTime) {
    salvando.value = true

    try {
      await waitlistRepository.ofertar(id, slotInicio)
      clinico.invalidarTudo()
      await carregar()
      vagaAberta.value = null
    } catch {
      erro.value = 'clinico.erros.mutacao'
    } finally {
      salvando.value = false
    }
  }

  async function responder(id: string, aceitou: boolean) {
    salvando.value = true

    try {
      await waitlistRepository.responder(id, aceitou)
      clinico.invalidarTudo()
      await carregar()
    } catch {
      erro.value = 'clinico.erros.mutacao'
    } finally {
      salvando.value = false
    }
  }

  /**
   * Entrada manual na fila.
   *
   * O caminho que fechava o ciclo e não existia: sem horário bom, o responsável entra na fila
   * ali mesmo, sem trocar de tela e sem a recepção anotar num papel.
   */
  async function adicionar(input: {
    petId: string
    tutorId: string
    typeId: string
    professionalId: string | null
    prioridade: WaitlistPriority
    janelas: WaitlistWindow[]
    observacao: string
  }) {
    salvando.value = true

    try {
      const criada = await waitlistRepository.adicionar(input)

      clinico.invalidarTudo()
      await carregar()

      return criada
    } catch {
      erro.value = 'clinico.erros.mutacao'

      return null
    } finally {
      salvando.value = false
    }
  }

  async function remover(id: string) {
    salvando.value = true

    try {
      await waitlistRepository.remover(id)
      clinico.invalidarTudo()
      await carregar()
    } catch {
      erro.value = 'clinico.erros.mutacao'
    } finally {
      salvando.value = false
    }
  }

  /** Minutos restantes de uma oferta — a tela mostra o relógio correndo. */
  function minutosParaExpirar(entrada: WaitlistEntry): number | null {
    if (!entrada.ofertaExpiraEm) {
      return null
    }

    return Math.round((Date.parse(entrada.ofertaExpiraEm) - Date.parse(clinicClock.nowIso())) / 60_000)
  }

  return {
    entradas,
    aguardando,
    ofertadas,
    ativas,
    carregando,
    salvando,
    erro,
    vazio,
    vagaAberta,
    posicoes,
    posicaoDe,
    adicionar,
    carregar,
    aoLiberarHorario,
    dispensarVaga,
    ofertar,
    responder,
    remover,
    minutosParaExpirar,
  }
})
