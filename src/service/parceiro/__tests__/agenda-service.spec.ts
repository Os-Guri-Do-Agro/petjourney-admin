import { describe, expect, it } from 'vitest'

import { acoesDaSituacao, outrosNoConflito, type Conflito } from '@/service/parceiro/agenda-service'

describe('acoesDaSituacao (guia e3, 2.7)', () => {
  it('antes de chegar, tudo; confirmar só o que ainda não foi confirmado', () => {
    expect(acoesDaSituacao('AGENDADO')).toMatchObject({
      mover: true,
      cancelar: true,
      confirmar: true,
    })
    expect(acoesDaSituacao('CONFIRMADO')).toMatchObject({
      mover: true,
      confirmar: false,
      chegada: true,
    })
  })

  it('aguardando: editar, mover, cancelar e iniciar', () => {
    expect(acoesDaSituacao('AGUARDANDO')).toEqual({
      editar: true,
      mover: true,
      cancelar: true,
      confirmar: false,
      chegada: false,
      iniciar: true,
    })
  })

  it('em atendimento, só editar; encerrado, nada', () => {
    expect(acoesDaSituacao('EM_ATENDIMENTO')).toMatchObject({
      editar: true,
      mover: false,
      cancelar: false,
    })
    for (const status of ['FINALIZADO', 'FALTA', 'CANCELADO'] as const) {
      expect(Object.values(acoesDaSituacao(status)).some(Boolean)).toBe(false)
    }
  })
})

describe('outrosNoConflito', () => {
  function conflito(params: Conflito['params']): Conflito {
    return { kind: 'professional-overlap', severity: 'warning', params }
  }

  it('o primeiro vem por nome; os outros são o "e mais N"', () => {
    expect(
      outrosNoConflito(conflito({ quantidade: 4, agendamentoIds: ['a', 'b', 'c', 'd'] })),
    ).toBe(3)
    expect(
      outrosNoConflito(conflito({ quantidade: 9, agendamentoIds: ['a', 'b', 'c', 'd', 'e'] })),
    ).toBe(8)
    expect(outrosNoConflito(conflito({ quantidade: 1, agendamentoIds: ['a'] }))).toBe(0)
    expect(outrosNoConflito(conflito({ minutos: 30 }))).toBe(0)
  })
})
