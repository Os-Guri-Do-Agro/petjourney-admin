/**
 * Avisos enviados ao responsável.
 *
 * Antes, o texto da remarcação era digitado, confirmado e **sumia**. Não ficava registro de que
 * a pessoa foi avisada, quando, nem do quê — numa tela cujo requisito diz *"errar aqui liga
 * para o tutor errado"*, o comprovante é parte do fluxo, não um extra.
 *
 * O registro é por atendimento, e é o que permite a recepção responder "já avisamos?" sem
 * depender da memória de quem estava no balcão.
 *
 * **Sobre a persistência.** O envio de verdade é do backend, que ainda não existe; aqui o
 * aviso vive em `localStorage` com a mesma forma que a API terá. Guardar só em memória faria o
 * comprovante desaparecer no F5 — que é justamente o momento em que alguém vai conferir se
 * avisou.
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { ISODateTime } from '../data/types'

import { clinicClock } from './clinico'

export type AvisoKind = 'reagendamento' | 'remarcacao' | 'cancelamento' | 'oferta-de-vaga'

export type AvisoEnviado = {
  id: string
  appointmentId: string
  tutorId: string
  /** `kind` traduzível, nunca texto pronto — o portal tem quatro idiomas. */
  kind: AvisoKind
  /** O texto exato que saiu, já com os ajustes de quem enviou. */
  texto: string
  enviadoEm: ISODateTime
}

const CHAVE = 'clinic.avisos'
/** Teto do histórico local. Comprovante velho não vale o espaço nem o tempo de leitura. */
const LIMITE = 200

function ler(): AvisoEnviado[] {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const bruto = window.localStorage.getItem(CHAVE)

    return bruto ? (JSON.parse(bruto) as AvisoEnviado[]) : []
  } catch {
    window.localStorage.removeItem(CHAVE)

    return []
  }
}

export const useAvisosStore = defineStore('clinico-avisos', () => {
  const enviados = ref<AvisoEnviado[]>(ler())

  function gravar() {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(CHAVE, JSON.stringify(enviados.value.slice(0, LIMITE)))
  }

  /**
   * Registra o aviso. Mais recente primeiro — é essa a ordem em que se pergunta "e o último?".
   */
  function registrar(input: {
    appointmentId: string
    tutorId: string
    kind: AvisoKind
    texto: string
  }) {
    const aviso: AvisoEnviado = {
      id: `aviso-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      appointmentId: input.appointmentId,
      tutorId: input.tutorId,
      kind: input.kind,
      texto: input.texto.trim(),
      enviadoEm: clinicClock.nowIso(),
    }

    enviados.value = [aviso, ...enviados.value].slice(0, LIMITE)
    gravar()

    return aviso
  }

  function doAtendimento(appointmentId: string): AvisoEnviado[] {
    return enviados.value.filter((aviso) => aviso.appointmentId === appointmentId)
  }

  function doResponsavel(tutorId: string): AvisoEnviado[] {
    return enviados.value.filter((aviso) => aviso.tutorId === tutorId)
  }

  const total = computed(() => enviados.value.length)

  return { enviados, total, registrar, doAtendimento, doResponsavel }
})
