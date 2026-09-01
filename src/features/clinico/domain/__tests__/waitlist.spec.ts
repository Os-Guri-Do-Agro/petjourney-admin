/**
 * Ordem e posição da fila de espera.
 *
 * A regra existe para ser dita ao telefone. Se a posição não puder ser explicada em uma frase
 * — "há dois urgentes na frente" —, ela não serve, e o responsável desliga achando que a fila
 * é arbitrária.
 */

import { describe, expect, it } from 'vitest'

import type { WaitlistEntry, WaitlistPriority, WaitlistStatus } from '../../data/types'
import { aFrenteDe, ordenarFila, posicoesDaFila } from '../waitlist'

function entrada(
  id: string,
  prioridade: WaitlistPriority,
  criadoEm: string,
  status: WaitlistStatus = 'aguardando',
): WaitlistEntry {
  return {
    id,
    petId: `pet-${id}`,
    tutorId: `tutor-${id}`,
    typeId: 'tipo-consulta',
    professionalId: null,
    prioridade,
    janelas: [],
    status,
    criadoEm,
    ofertaExpiraEm: null,
    ofertaSlotInicio: null,
    observacao: '',
  }
}

const FILA = [
  entrada('c', 'normal', '2026-08-01T09:00:00-04:00'),
  entrada('a', 'urgente', '2026-08-03T09:00:00-04:00'),
  entrada('d', 'normal', '2026-08-02T09:00:00-04:00'),
  entrada('b', 'preferencial', '2026-08-04T09:00:00-04:00'),
]

describe('ordenarFila', () => {
  it('põe prioridade acima de antiguidade', () => {
    /**
     * O urgente entrou por último e sai primeiro. Não é fila de banco: quem chega antes espera
     * menos, mas quem está mal espera menos ainda.
     */
    expect(ordenarFila(FILA).map((item) => item.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('desempata por antiguidade dentro da mesma prioridade', () => {
    const normais = ordenarFila(FILA).filter((item) => item.prioridade === 'normal')

    expect(normais.map((item) => item.id)).toEqual(['c', 'd'])
  })

  it('não altera a lista recebida', () => {
    const copia = [...FILA]

    ordenarFila(FILA)

    expect(FILA).toEqual(copia)
  })
})

describe('posicoesDaFila', () => {
  it('numera a partir de 1', () => {
    const posicoes = posicoesDaFila(FILA)

    expect(posicoes.get('a')).toBe(1)
    expect(posicoes.get('b')).toBe(2)
    expect(posicoes.get('c')).toBe(3)
    expect(posicoes.get('d')).toBe(4)
  })

  it('tira da contagem quem já recebeu oferta', () => {
    /**
     * O horário de quem foi ofertado está reservado. Continuar contando-o empurraria a fila
     * inteira uma posição para trás por algo que já foi resolvido — e a pessoa que ligasse
     * ouviria um número pior do que o real.
     */
    const comOferta = [
      { ...FILA[0]!, id: 'c' },
      { ...FILA[1]!, id: 'a', status: 'ofertado' as WaitlistStatus },
      FILA[2]!,
      FILA[3]!,
    ]

    const posicoes = posicoesDaFila(comOferta)

    expect(posicoes.has('a')).toBe(false)
    expect(posicoes.get('b')).toBe(1)
  })

  it('ignora removidos e expirados', () => {
    const comSaidas = [
      entrada('x', 'normal', '2026-08-01T09:00:00-04:00', 'removido'),
      entrada('y', 'normal', '2026-08-02T09:00:00-04:00', 'expirado'),
      entrada('z', 'normal', '2026-08-03T09:00:00-04:00'),
    ]

    const posicoes = posicoesDaFila(comSaidas)

    expect(posicoes.size).toBe(1)
    expect(posicoes.get('z')).toBe(1)
  })
})

describe('aFrenteDe', () => {
  it('conta quantos passam na frente', () => {
    expect(aFrenteDe(FILA, 'a')).toBe(0)
    expect(aFrenteDe(FILA, 'd')).toBe(3)
  })
})
