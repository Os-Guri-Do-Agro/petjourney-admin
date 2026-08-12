import { describe, expect, it } from 'vitest'

import { calcularTempoRestante, parseInstante } from '@/utils/format/expiracao'

const EXPIRA = '2026-08-15T17:47:49.810Z'

describe('parseInstante', () => {
  it('lê o instante com Z como UTC', () => {
    expect(parseInstante(EXPIRA)).toBe(Date.UTC(2026, 7, 15, 17, 47, 49, 810))
  })

  it('lê offset explícito sem mexer no instante', () => {
    expect(parseInstante('2026-08-15T14:47:49.810-03:00')).toBe(parseInstante(EXPIRA))
  })

  it('trata data-hora sem fuso como UTC, e não como hora local', () => {
    expect(parseInstante('2026-08-15T17:47:49.810')).toBe(parseInstante(EXPIRA))
    expect(parseInstante('2026-08-15 17:47:49.810')).toBe(parseInstante(EXPIRA))
  })

  it('devolve NaN para vazio ou lixo', () => {
    expect(Number.isNaN(parseInstante(''))).toBe(true)
    expect(Number.isNaN(parseInstante('nao é data'))).toBe(true)
  })
})

describe('calcularTempoRestante', () => {
  /** Cenário real conferido na tela: relógio 12/08 11:49 em UTC-3 = 14:49Z. */
  it('reproduz o badge "3d 2h" do atendimento', () => {
    const agora = Date.parse('2026-08-12T14:49:00.000Z')

    expect(calcularTempoRestante(EXPIRA, agora)).toEqual({ estado: 'dias', dias: 3, horas: 2 })
  })

  it('dá o mesmo resultado para qualquer fuso do usuário no mesmo instante', () => {
    /** O mesmo momento escrito com três offsets diferentes. */
    const mesmoInstante = [
      '2026-08-12T14:49:00.000Z',
      '2026-08-12T11:49:00.000-03:00',
      '2026-08-12T23:49:00.000+09:00',
    ].map((iso) => calcularTempoRestante(EXPIRA, Date.parse(iso)))

    expect(mesmoInstante[0]).toEqual({ estado: 'dias', dias: 3, horas: 2 })
    expect(mesmoInstante[1]).toEqual(mesmoInstante[0])
    expect(mesmoInstante[2]).toEqual(mesmoInstante[0])
  })

  it('atravessa a virada de horário de verão sem pular hora', () => {
    /** DST dos EUA em 2026-11-01: 24h de relógio, 25h reais. A diferença é absoluta. */
    const agora = Date.parse('2026-10-31T12:00:00.000Z')

    expect(calcularTempoRestante('2026-11-01T12:00:00.000Z', agora)).toEqual({
      estado: 'dias',
      dias: 1,
      horas: 0,
    })
  })

  it('cai para horas e minutos abaixo de um dia', () => {
    const agora = Date.parse('2026-08-15T14:00:00.000Z')

    expect(calcularTempoRestante(EXPIRA, agora)).toEqual({
      estado: 'horas',
      horas: 3,
      minutos: 47,
    })
  })

  it('mostra minutos na última hora e nunca zera antes de expirar', () => {
    expect(
      calcularTempoRestante(EXPIRA, Date.parse('2026-08-15T17:30:00.000Z')),
    ).toEqual({ estado: 'minutos', minutos: 17 })

    /** 40 segundos restantes ainda é acesso vivo. */
    expect(
      calcularTempoRestante(EXPIRA, Date.parse('2026-08-15T17:47:09.810Z')),
    ).toEqual({ estado: 'minutos', minutos: 1 })
  })

  it('marca expirado no instante do vencimento e depois dele', () => {
    expect(calcularTempoRestante(EXPIRA, Date.parse(EXPIRA))).toEqual({ estado: 'expirado' })
    expect(
      calcularTempoRestante(EXPIRA, Date.parse('2026-08-15T17:47:50.000Z')),
    ).toEqual({ estado: 'expirado' })
  })

  it('data inválida não vira contagem', () => {
    expect(calcularTempoRestante('', Date.now())).toEqual({ estado: 'invalido' })
  })

  it('arredonda para baixo: nunca promete mais tempo do que existe', () => {
    /** Faltam 2d 23h 59min: mostrar 3d seria mentira favorável. */
    const agora = Date.parse('2026-08-12T17:48:49.810Z')

    expect(calcularTempoRestante(EXPIRA, agora)).toEqual({ estado: 'dias', dias: 2, horas: 23 })
  })
})
