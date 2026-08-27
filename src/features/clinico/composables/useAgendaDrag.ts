/**
 * Arraste e redimensionamento na grade do dia.
 *
 * Três decisões que valem registrar:
 *
 * 1. **Arrastar nunca salva sozinho.** O gesto propõe; a confirmação com de → para decide.
 *    Remarcação é conversa com o responsável, não um deslize de mouse.
 * 2. **Todo gesto tem equivalente de teclado.** `Shift + ↑/↓` move de 15 em 15 minutos,
 *    `Shift + ←/→` troca de profissional, e ambos abrem a mesma confirmação. Sem isso o
 *    módulo fica inacessível para quem não usa mouse — e lento para quem usa.
 * 3. **`Esc` cancela.** Enquanto o ponteiro está pressionado, soltar fora ou apertar `Esc`
 *    devolve o card para onde estava.
 */

import { computed, onBeforeUnmount, ref } from 'vue'

import type { Appointment, ISODateTime } from '../data/types'
import { snapMinutes } from '../domain/clinic-time'
import { clinicClock } from '../stores/clinico'

export type ArrasteProposta = {
  appointment: Appointment
  inicio: ISODateTime
  fim: ISODateTime
  professionalId: string
  /** `true` quando só a borda foi puxada: a duração mudou, o início não. */
  redimensionou: boolean
}

export type ModoArraste = 'mover' | 'inicio' | 'fim'

type EstadoArraste = {
  appointment: Appointment
  modo: ModoArraste
  /** Minuto de parede em que o ponteiro pegou o card. */
  ancoraMinuto: number
  inicioOriginal: number
  fimOriginal: number
  colunaOriginal: string
  deltaMinutos: number
  colunaAtual: string
}

/** Menor duração possível de um atendimento: abaixo disso o card some da grade. */
const DURACAO_MINIMA = 10

export function useAgendaDrag(opcoes: {
  data: () => string
  passoMinutos: () => number
  minutoDoPonteiro: (evento: PointerEvent) => number
  colunaDoPonteiro: (evento: PointerEvent) => string | null
  aoPropor: (proposta: ArrasteProposta) => void
}) {
  const estado = ref<EstadoArraste | null>(null)
  const arrastando = computed(() => estado.value !== null)

  /** Deslocamento aplicado ao card enquanto o gesto está em curso, para o retorno visual. */
  const previa = computed(() => {
    if (!estado.value) {
      return null
    }

    const { modo, inicioOriginal, fimOriginal, deltaMinutos, colunaAtual } = estado.value

    if (modo === 'inicio') {
      return {
        id: estado.value.appointment.id,
        inicioMin: Math.min(inicioOriginal + deltaMinutos, fimOriginal - DURACAO_MINIMA),
        fimMin: fimOriginal,
        colunaId: colunaAtual,
      }
    }

    if (modo === 'fim') {
      return {
        id: estado.value.appointment.id,
        inicioMin: inicioOriginal,
        fimMin: Math.max(fimOriginal + deltaMinutos, inicioOriginal + DURACAO_MINIMA),
        colunaId: colunaAtual,
      }
    }

    return {
      id: estado.value.appointment.id,
      inicioMin: inicioOriginal + deltaMinutos,
      fimMin: fimOriginal + deltaMinutos,
      colunaId: colunaAtual,
    }
  })

  function limpar() {
    estado.value = null
    window.removeEventListener('pointermove', aoMover)
    window.removeEventListener('pointerup', aoSoltar)
    window.removeEventListener('keydown', aoTeclarDurante, true)
  }

  function aoTeclarDurante(evento: KeyboardEvent) {
    if (evento.key === 'Escape') {
      evento.preventDefault()
      limpar()
    }
  }

  function aoMover(evento: PointerEvent) {
    const atual = estado.value

    if (!atual) {
      return
    }

    const minuto = opcoes.minutoDoPonteiro(evento)
    const bruto = minuto - atual.ancoraMinuto
    const coluna = opcoes.colunaDoPonteiro(evento)

    estado.value = {
      ...atual,
      deltaMinutos: snapMinutes(bruto, opcoes.passoMinutos()),
      colunaAtual: atual.modo === 'mover' && coluna ? coluna : atual.colunaAtual,
    }
  }

  function aoSoltar() {
    const atual = estado.value

    if (!atual) {
      return
    }

    const alvo = previa.value

    limpar()

    if (!alvo) {
      return
    }

    const semMudanca =
      alvo.inicioMin === atual.inicioOriginal &&
      alvo.fimMin === atual.fimOriginal &&
      alvo.colunaId === atual.colunaOriginal

    if (semMudanca) {
      return
    }

    opcoes.aoPropor({
      appointment: atual.appointment,
      inicio: clinicClock.toIso(opcoes.data(), alvo.inicioMin),
      fim: clinicClock.toIso(opcoes.data(), alvo.fimMin),
      professionalId: alvo.colunaId,
      redimensionou: atual.modo !== 'mover',
    })
  }

  function iniciar(
    evento: PointerEvent,
    appointment: Appointment,
    modo: ModoArraste,
    colunaId: string,
  ) {
    /** Botão direito e clique com modificador ficam de fora: são menu, não arraste. */
    if (evento.button !== 0 || evento.ctrlKey || evento.metaKey) {
      return
    }

    const data = opcoes.data()

    estado.value = {
      appointment,
      modo,
      ancoraMinuto: opcoes.minutoDoPonteiro(evento),
      inicioOriginal: clinicClock.minutesFrom(appointment.inicio, data),
      fimOriginal: clinicClock.minutesFrom(appointment.fim, data),
      colunaOriginal: colunaId,
      colunaAtual: colunaId,
      deltaMinutos: 0,
    }

    window.addEventListener('pointermove', aoMover)
    window.addEventListener('pointerup', aoSoltar)
    window.addEventListener('keydown', aoTeclarDurante, true)
  }

  /**
   * Equivalente de teclado. Mesma proposta, mesma confirmação — a única diferença é o
   * dispositivo que a originou.
   */
  function moverPorTeclado(
    appointment: Appointment,
    passos: number,
    colunas: string[],
    deltaColuna = 0,
  ) {
    const data = opcoes.data()
    const inicioMin = clinicClock.minutesFrom(appointment.inicio, data)
    const fimMin = clinicClock.minutesFrom(appointment.fim, data)
    const deslocamento = passos * opcoes.passoMinutos()

    const indiceAtual = colunas.indexOf(appointment.professionalId)
    const novoIndice = Math.min(
      Math.max(indiceAtual + deltaColuna, 0),
      Math.max(colunas.length - 1, 0),
    )

    opcoes.aoPropor({
      appointment,
      inicio: clinicClock.toIso(data, inicioMin + deslocamento),
      fim: clinicClock.toIso(data, fimMin + deslocamento),
      professionalId: colunas[novoIndice] ?? appointment.professionalId,
      redimensionou: false,
    })
  }

  onBeforeUnmount(limpar)

  return { arrastando, previa, iniciar, moverPorTeclado, cancelar: limpar }
}
