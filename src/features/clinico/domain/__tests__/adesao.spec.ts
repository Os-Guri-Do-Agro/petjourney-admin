/**
 * A conta da adesão, conferida nos casos que a tela não pode errar: a dose sem registro que não
 * vira acusação, a dose que fecha sozinha sem cobrar ninguém, e o alerta que só toca quando um
 * tratamento crítico muda de padrão.
 */

import { describe, expect, it } from 'vitest'

import {
  alertaDeAdesao,
  diasDaFaixa,
  dosesDoTratamento,
  emCurso,
  faixaMostraAConsulta,
  horarioDestoante,
  horariosDoDia,
  resumirAdesao,
  sugerirPrimeiraDose,
  totalDeDoses,
  ultimaDoseEm,
  type DoseNaGrade,
  type RegistroDeDose,
  type TratamentoDoAlerta,
} from '../adesao'

const HORA = 3_600_000

function tratamento(
  parcial: Partial<TratamentoDoAlerta> = {},
): TratamentoDoAlerta & { id: string } {
  return {
    id: 'trat-1',
    inicioEm: '2026-09-01T08:00:00-04:00',
    frequenciaHoras: 12,
    duracaoDias: null,
    encerradoEm: null,
    critico: true,
    contatoEm: null,
    ...parcial,
  }
}

function registro(
  numero: number,
  situacao: RegistroDeDose['situacao'] = 'dada',
  parcial: Partial<RegistroDeDose> = {},
): RegistroDeDose {
  return {
    id: `reg-${numero}`,
    tratamentoId: 'trat-1',
    numero,
    situacao,
    motivo: situacao === 'pulada' ? 'esqueci' : null,
    registradaEm: '2026-09-01T08:10:00-04:00',
    cuidadorId: 'tutor-a',
    ...parcial,
  }
}

/** Registros "dada" para as doses de 1 até `ate`, menos as listadas em `exceto`. */
function dadasAte(ate: number, exceto: number[] = []): RegistroDeDose[] {
  return Array.from({ length: ate }, (_, indice) => indice + 1)
    .filter((numero) => !exceto.includes(numero))
    .map((numero) => registro(numero))
}

describe('a grade de doses', () => {
  it('de 8 em 8 horas atravessa a meia-noite sem perder o fuso da clínica', () => {
    const grade = dosesDoTratamento(
      tratamento({ inicioEm: '2026-09-01T07:00:00-04:00', frequenciaHoras: 8, duracaoDias: 2 }),
      [],
      '2026-09-01T06:00:00-04:00',
      '2026-09-05T00:00:00-04:00',
    )

    expect(grade.map((dose) => dose.previstaEm)).toEqual([
      '2026-09-01T07:00:00-04:00',
      '2026-09-01T15:00:00-04:00',
      '2026-09-01T23:00:00-04:00',
      '2026-09-02T07:00:00-04:00',
      '2026-09-02T15:00:00-04:00',
      '2026-09-02T23:00:00-04:00',
    ])
    expect(grade.map((dose) => dose.numero)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('catorze dias uma vez por dia são catorze doses; uso contínuo não tem total nem última', () => {
    expect(totalDeDoses({ frequenciaHoras: 24, duracaoDias: 14 })).toBe(14)
    expect(totalDeDoses({ frequenciaHoras: 8, duracaoDias: 10 })).toBe(30)
    expect(totalDeDoses({ frequenciaHoras: 24, duracaoDias: null })).toBeNull()
    expect(ultimaDoseEm(tratamento())).toBeNull()
    expect(ultimaDoseEm(tratamento({ frequenciaHoras: 24, duracaoDias: 14 }))).toBe(
      '2026-09-14T08:00:00-04:00',
    )
  })

  it('a dose da vez abre uma hora antes e fecha na hora da seguinte', () => {
    const doses = (agora: string) =>
      dosesDoTratamento(tratamento(), [], agora, '2026-09-01T23:59:00-04:00')

    expect(doses('2026-09-01T06:30:00-04:00')[0]!.situacao).toBe('prevista')
    expect(doses('2026-09-01T07:00:00-04:00')[0]!.situacao).toBe('aberta')
    expect(doses('2026-09-01T19:59:00-04:00')[0]!.situacao).toBe('aberta')
    expect(doses('2026-09-01T20:00:00-04:00')[0]!.situacao).toBe('sem-registro')
    expect(doses('2026-09-01T20:00:00-04:00')[0]!.registravelAte).toBe('2026-09-01T20:00:00-04:00')
  })

  it('a dose que ninguém marcou vira "sem registro" — nunca "pulada"', () => {
    const [dose] = dosesDoTratamento(
      tratamento(),
      [],
      '2026-09-03T08:00:00-04:00',
      '2026-09-01T08:00:00-04:00',
    )

    expect(dose!.situacao).toBe('sem-registro')
    expect(dose!.registro).toBeNull()
  })

  it('o registro manda na situação, qualquer que seja a hora', () => {
    const doses = dosesDoTratamento(
      tratamento(),
      [registro(1), registro(2, 'pulada', { motivo: 'cuspiu' })],
      '2026-09-05T08:00:00-04:00',
      '2026-09-01T20:00:00-04:00',
    )

    expect(doses.map((dose) => dose.situacao)).toEqual(['dada', 'pulada'])
    expect(doses[1]!.registro?.motivo).toBe('cuspiu')
  })

  it('encerrado antes do fim, a grade para ali — e o tratamento sai de curso', () => {
    const encerrado = tratamento({ encerradoEm: '2026-09-02T12:00:00-04:00' })
    const doses = dosesDoTratamento(
      encerrado,
      [],
      '2026-09-10T08:00:00-04:00',
      '2026-09-10T08:00:00-04:00',
    )

    expect(doses).toHaveLength(3)
    expect(emCurso(encerrado, '2026-09-10T08:00:00-04:00')).toBe(false)
    expect(emCurso(tratamento(), '2027-09-10T08:00:00-04:00')).toBe(true)
  })

  it('com fim, continua em curso até o prazo de registro da última dose passar', () => {
    const curto = tratamento({ frequenciaHoras: 24, duracaoDias: 2 })

    expect(emCurso(curto, '2026-09-02T09:00:00-04:00')).toBe(true)
    expect(emCurso(curto, '2026-09-03T08:00:00-04:00')).toBe(false)
  })
})

describe('o resumo do período', () => {
  const grade = (registros: RegistroDeDose[], agora: string) =>
    dosesDoTratamento(
      tratamento({ frequenciaHoras: 8, inicioEm: '2026-09-01T07:00:00-04:00' }),
      registros,
      agora,
      agora,
    )

  it('conta sem registro à parte, e a dose ainda aberta fica fora da conta', () => {
    /* Às 8h do dia 3, a dose 7 (7h) é a da vez; a 3 passou sem ninguém marcar. */
    const agora = '2026-09-03T08:00:00-04:00'
    const doses = grade(
      [
        ...dadasAte(4, [3]),
        registro(5, 'dada', { cuidadorId: 'membro-b' }),
        registro(6, 'pulada', { motivo: 'acabou' }),
      ],
      agora,
    )
    const resumo = resumirAdesao(doses, '2026-09-01T00:00:00-04:00', agora, 8)

    expect(resumo).toMatchObject({ dadas: 4, puladas: 1, semRegistro: 1, abertas: 1, fechadas: 6 })
    expect(resumo.motivos).toEqual([{ motivo: 'acabou', vezes: 1 }])
    expect(resumo.porCuidador).toEqual([
      { cuidadorId: 'tutor-a', registros: 4 },
      { cuidadorId: 'membro-b', registros: 1 },
    ])
  })

  it('separa por horário do dia — e acha a dose da noite que fica para trás', () => {
    /* Às 8h do dia 6, a dose das 7h é a da vez e fica fora; as quinze de antes estão fechadas. */
    const agora = '2026-09-06T08:00:00-04:00'
    /* 15 doses fechadas: as das 23h (3, 6, 9, 12, 15) quase nunca aparecem. */
    const doses = grade(dadasAte(15, [3, 6, 9, 15]), agora)
    const resumo = resumirAdesao(doses, '2026-09-01T00:00:00-04:00', agora, 8)

    expect(resumo.porHorario).toEqual([
      { horario: '07:00', dadas: 5, fechadas: 5 },
      { horario: '15:00', dadas: 5, fechadas: 5 },
      { horario: '23:00', dadas: 1, fechadas: 5 },
    ])
    expect(horarioDestoante(resumo)?.horario).toBe('23:00')
  })

  it('sem horário destoante quando tudo cai por igual', () => {
    const agora = '2026-09-06T08:00:00-04:00'
    const resumo = resumirAdesao(grade(dadasAte(15), agora), '2026-09-01T00:00:00-04:00', agora, 8)

    expect(horarioDestoante(resumo)).toBeNull()
  })

  it('frequência que não fecha o dia não separa por horário', () => {
    const doses = dosesDoTratamento(
      tratamento({ frequenciaHoras: 36 }),
      [],
      '2026-09-10T00:00:00-04:00',
      '2026-09-10T00:00:00-04:00',
    )

    expect(
      resumirAdesao(doses, '2026-09-01T00:00:00-04:00', '2026-09-10T00:00:00-04:00', 36).porHorario,
    ).toEqual([])
  })
})

describe('o alerta da clínica', () => {
  /**
   * De 12 em 12 horas desde 01/09 às 8h. Às 20h do dia 14, a dose 27 (08h do dia 14) é a última
   * fechada; a janela de 72 h pega das 20h do dia 11 em diante (doses 22 a 27).
   */
  const agora = '2026-09-14T20:00:00-04:00'

  function alerta(registros: RegistroDeDose[], parcial: Partial<TratamentoDoAlerta> = {}) {
    const trat = tratamento(parcial)

    return alertaDeAdesao(trat, dosesDoTratamento(trat, registros, agora, agora), agora)
  }

  it('duas puladas em três dias: alerta, com o motivo que a casa deu', () => {
    const resultado = alerta([
      ...dadasAte(25),
      registro(26, 'pulada', { motivo: 'acabou' }),
      registro(27, 'pulada', { motivo: 'acabou' }),
    ])

    expect(resultado?.motivo).toBe('puladas')
    expect(resultado?.motivos).toEqual([{ motivo: 'acabou', vezes: 2 }])
    expect(resultado?.desde).toBe('2026-09-13T20:00:00-04:00')
    expect(resultado?.antes).toEqual({ dadas: 14, fechadas: 14 })
  })

  it('quem registrava tudo e parou: alerta de queda', () => {
    const resultado = alerta(dadasAte(23))

    expect(resultado?.motivo).toBe('queda')
    expect(resultado?.janela).toMatchObject({ dadas: 2, semRegistro: 4, puladas: 0 })
  })

  it('quem nunca registrou não dispara nada: não há queda sem padrão', () => {
    expect(alerta([])).toBeNull()
  })

  it('tratamento que não é crítico não alerta, por pior que esteja', () => {
    expect(alerta([registro(26, 'pulada'), registro(27, 'pulada')], { critico: false })).toBeNull()
  })

  it('a ligação da clínica apaga o alerta — até a próxima dose que faltar', () => {
    const registros = [
      ...dadasAte(25),
      registro(26, 'pulada', { motivo: 'acabou' }),
      registro(27, 'pulada', { motivo: 'acabou' }),
    ]

    expect(alerta(registros, { contatoEm: '2026-09-14T10:00:00-04:00' })).toBeNull()
    expect(alerta(registros, { contatoEm: '2026-09-14T07:00:00-04:00' })?.motivo).toBe('puladas')
  })

  it('tratamento que já terminou não alerta', () => {
    expect(alerta([registro(1, 'pulada'), registro(2, 'pulada')], { duracaoDias: 1 })).toBeNull()
  })

  it('a dose da vez não conta: ainda dá para marcar', () => {
    const trat = tratamento()
    const doses: DoseNaGrade[] = dosesDoTratamento(trat, dadasAte(27), agora, agora)

    expect(doses[doses.length - 1]!.situacao).toBe('aberta')
    expect(alertaDeAdesao(trat, doses, agora)).toBeNull()
  })
})

describe('o primeiro horário', () => {
  it('de 12 em 12 às 14h10: espera até as 18h para a segunda não cair às 3h', () => {
    expect(sugerirPrimeiraDose(12, '2026-09-01T14:10:00-04:00')).toBe('2026-09-01T18:00:00-04:00')
  })

  it('de 8 em 8 às 14h10: 15h já deixa a madrugada livre (15h, 23h, 7h)', () => {
    expect(sugerirPrimeiraDose(8, '2026-09-01T14:10:00-04:00')).toBe('2026-09-01T15:00:00-04:00')
  })

  it('uma vez por dia, de madrugada: sugere as 6h', () => {
    expect(sugerirPrimeiraDose(24, '2026-09-01T02:30:00-04:00')).toBe('2026-09-01T06:00:00-04:00')
  })

  it('de 6 em 6 não tem como: fica na próxima hora cheia', () => {
    expect(sugerirPrimeiraDose(6, '2026-09-01T14:10:00-04:00')).toBe('2026-09-01T15:00:00-04:00')
  })

  it('os horários de um dia da grade', () => {
    expect(horariosDoDia('2026-09-01T15:00:00-04:00', 8)).toEqual(['15:00', '23:00', '07:00'])
    expect(horariosDoDia('2026-09-01T08:00:00-04:00', 24)).toEqual(['08:00'])
  })
})

it('a grade não vaza de hora quando o intervalo é fracionado', () => {
  const doses = dosesDoTratamento(
    tratamento({ frequenciaHoras: 12 }),
    [],
    '2026-09-01T08:00:00-04:00',
    '2026-09-02T08:00:00-04:00',
  )

  expect(Date.parse(doses[1]!.previstaEm) - Date.parse(doses[0]!.previstaEm)).toBe(12 * HORA)
})

describe('a janela da faixa', () => {
  it('seis semanas, ou o bastante para a última consulta caber — até três meses', () => {
    expect(diasDaFaixa(null, '2026-09-30')).toBe(42)
    expect(diasDaFaixa('2026-09-20T10:00:00-04:00', '2026-09-30')).toBe(42)
    expect(diasDaFaixa('2026-08-19T10:00:00-04:00', '2026-09-30')).toBe(44)
    expect(diasDaFaixa('2026-03-01T10:00:00-04:00', '2026-09-30')).toBe(90)
  })

  it('o fio da consulta só é prometido quando ele cai depois do primeiro dia da faixa', () => {
    const doses = dosesDoTratamento(
      tratamento({ frequenciaHoras: 24, inicioEm: '2026-08-01T20:00:00-04:00' }),
      [],
      '2026-09-30T15:00:00-04:00',
      '2026-09-30T15:00:00-04:00',
    )

    /* A consulta foi no dia em que o tratamento começou: não há "antes" para separar. */
    expect(faixaMostraAConsulta(doses, '2026-08-01T10:30:00-04:00', 61)).toBe(false)
    expect(faixaMostraAConsulta(doses, '2026-09-10T10:30:00-04:00', 42)).toBe(true)
    expect(faixaMostraAConsulta(doses, null, 42)).toBe(false)
  })
})
