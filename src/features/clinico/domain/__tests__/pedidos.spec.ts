/**
 * As regras do pedido de horário — as que o app, o link e a recepção precisam fazer igual.
 *
 * O que estes testes fixam: o prazo prometido conta só o expediente; o horário oferecido é um que a
 * recepção marcaria sem aviso (e o pedido pendente já ocupa); dois pets da mesma casa saem
 * seguidos com o mesmo profissional; e o "melhor horário" respeita o que a pessoa disse que pode.
 */

import { afterEach, describe, expect, it } from 'vitest'

import { clinicFixture, appointmentTypesFixture, roomsFixture } from '../../data/fixtures'
import type { Appointment, Clinic, PedidoDeHorario } from '../../data/types'
import { addDays, createClinicClock, setClockSkew, wallToEpoch, weekdayOf } from '../clinic-time'
import {
  camposQueFaltam,
  estadoDaClinica,
  melhoresOpcoes,
  ocupacoesDosPedidos,
  opcoesDoDia,
  pedidoPerdeuOSentido,
  prazoEmExpediente,
  situacaoDoPrazo,
} from '../pedidos'

const clock = createClinicClock(clinicFixture.utcOffset)
const clinic: Clinic = { ...clinicFixture, feriados: [] }

/** Uma segunda-feira qualquer — a clínica abre de 08:00 às 19:00. */
const SEGUNDA = '2026-10-19'
const SABADO = '2026-10-17'

function contexto(atendimentos: Appointment[] = []) {
  return {
    clinic,
    clock,
    atendimentos,
    bloqueios: [],
    tipos: appointmentTypesFixture,
    salas: roomsFixture,
    pets: [],
    capacidadeMinutos: 8 * 60,
  }
}

function atendimento(parcial: Partial<Appointment>): Appointment {
  return {
    id: 'apt-x',
    petId: 'pet-outro',
    tutorId: 'tutor-outro',
    professionalId: 'prof-ana',
    roomIds: [],
    typeId: 'tipo-consulta',
    inicio: clock.toIso(SEGUNDA, 9 * 60),
    fim: clock.toIso(SEGUNDA, 9 * 60 + 30),
    status: 'agendado',
    origem: 'recepcao',
    encaixe: false,
    observacao: '',
    chegadaEm: null,
    iniciadoEm: null,
    finalizadoEm: null,
    canceladoEm: null,
    motivoCancelamento: null,
    justificativaDeFalta: null,
    encounterId: null,
    linkedGroupId: null,
    criadoEm: clock.toIso(SEGUNDA, 0),
    atualizadoEm: clock.toIso(SEGUNDA, 0),
    ...parcial,
  }
}

function pedido(parcial: Partial<PedidoDeHorario>): PedidoDeHorario {
  return {
    id: 'pedido-x',
    canal: 'app',
    modo: 'horario-escolhido',
    petId: 'pet-x',
    tutorId: 'tutor-x',
    novoCadastro: null,
    typeId: 'tipo-consulta',
    motivo: 'checkup',
    queixa: '',
    professionalId: 'prof-ana',
    inicio: clock.toIso(SEGUNDA, 10 * 60),
    fim: clock.toIso(SEGUNDA, 10 * 60 + 30),
    preferencia: null,
    grupoId: null,
    remarcaAppointmentId: null,
    status: 'pendente',
    criadoEm: clock.toIso(SEGUNDA, 8 * 60),
    responderAte: clock.toIso(SEGUNDA, 12 * 60),
    respondidoEm: null,
    respondidoPor: null,
    appointmentId: null,
    recusa: null,
    compartilhaHistorico: false,
    ...parcial,
  }
}

function opcoesDaSegunda(
  entrada: Partial<Parameters<typeof opcoesDoDia>[0]> = {},
  atendimentos: Appointment[] = [],
) {
  return opcoesDoDia(
    {
      data: SEGUNDA,
      typeId: 'tipo-consulta',
      duracaoMinutos: 30,
      petIds: ['pet-x'],
      professionalIds: ['prof-ana'],
      aPartirDe: clock.toIso(SEGUNDA, 0),
      ...entrada,
    },
    contexto(atendimentos),
  )
}

afterEach(() => {
  setClockSkew(0)
})

describe('prazoEmExpediente', () => {
  it('conta dentro do dia quando o expediente comporta', () => {
    expect(prazoEmExpediente(clock.toIso(SEGUNDA, 9 * 60), 4, clinic, clock)).toBe(
      clock.toIso(SEGUNDA, 13 * 60),
    )
  })

  it('o pedido da noite vence na manhã seguinte, não de madrugada', () => {
    /* 18:30 de segunda: meia hora até fechar, três e meia na terça a partir das 08:00. */
    expect(prazoEmExpediente(clock.toIso(SEGUNDA, 18 * 60 + 30), 4, clinic, clock)).toBe(
      clock.toIso(addDays(SEGUNDA, 1), 11 * 60 + 30),
    )
  })

  it('pula o domingo fechado', () => {
    /* Sábado 12:00: uma hora até as 13:00, o domingo não conta, três horas na segunda. */
    expect(weekdayOf(SABADO)).toBe(6)
    expect(prazoEmExpediente(clock.toIso(SABADO, 12 * 60), 4, clinic, clock)).toBe(
      clock.toIso(SEGUNDA, 11 * 60),
    )
  })

  it('pula o feriado fechado', () => {
    const comFeriado: Clinic = {
      ...clinic,
      feriados: [{ date: addDays(SEGUNDA, 1), nome: 'Feriado', fechado: true }],
    }

    expect(prazoEmExpediente(clock.toIso(SEGUNDA, 18 * 60), 2, comFeriado, clock)).toBe(
      clock.toIso(addDays(SEGUNDA, 2), 9 * 60),
    )
  })
})

describe('situacaoDoPrazo e pedidoPerdeuOSentido', () => {
  it('chama atenção só na meia hora final, e vira atraso depois do prazo', () => {
    const p = pedido({ responderAte: clock.toIso(SEGUNDA, 12 * 60) })

    expect(situacaoDoPrazo(p, clock.toIso(SEGUNDA, 11 * 60))).toBe('no-prazo')
    expect(situacaoDoPrazo(p, clock.toIso(SEGUNDA, 11 * 60 + 40))).toBe('vencendo')
    expect(situacaoDoPrazo(p, clock.toIso(SEGUNDA, 12 * 60 + 1))).toBe('atrasado')
  })

  it('atraso da clínica não expira o pedido; o horário que passou, sim', () => {
    const p = pedido({ inicio: clock.toIso(SEGUNDA, 10 * 60) })

    expect(pedidoPerdeuOSentido(p, clock.toIso(SEGUNDA, 9 * 60))).toBe(false)
    expect(pedidoPerdeuOSentido(p, clock.toIso(SEGUNDA, 10 * 60))).toBe(true)
  })

  it('o melhor horário expira quando a janela acaba', () => {
    const p = pedido({
      modo: 'melhor-horario',
      inicio: null,
      fim: null,
      professionalId: null,
      preferencia: { de: SEGUNDA, ate: addDays(SEGUNDA, 2), periodos: [], professionalId: null },
    })

    expect(pedidoPerdeuOSentido(p, clock.toIso(addDays(SEGUNDA, 2), 18 * 60))).toBe(false)
    expect(pedidoPerdeuOSentido(p, clock.toIso(addDays(SEGUNDA, 3), 8 * 60))).toBe(true)
  })
})

describe('opcoesDoDia', () => {
  it('oferece de meia em meia hora, sem o almoço e sem passar do expediente', () => {
    const opcoes = opcoesDaSegunda()
    const horas = opcoes.map((opcao) => clock.minutesOf(opcao.inicio))

    expect(horas[0]).toBe(8 * 60)
    expect(horas.every((minuto) => minuto % 30 === 0)).toBe(true)
    /* O almoço (12:00–13:00) dá aviso na agenda: não é oferecido. */
    expect(horas).not.toContain(12 * 60)
    expect(horas).not.toContain(12 * 60 + 30)
    expect(Math.max(...horas)).toBe(18 * 60 + 30)
  })

  it('não oferece nada em dia fechado', () => {
    expect(opcoesDaSegunda({ data: addDays(SEGUNDA, -1) })).toEqual([])
  })

  it('respeita a antecedência mínima', () => {
    const opcoes = opcoesDaSegunda({ aPartirDe: clock.toIso(SEGUNDA, 15 * 60 + 10) })

    expect(clock.minutesOf(opcoes[0]!.inicio)).toBe(15 * 60 + 30)
  })

  it('o horário ocupado não aparece', () => {
    const opcoes = opcoesDaSegunda({}, [atendimento({})])
    const horas = opcoes.map((opcao) => clock.minutesOf(opcao.inicio))

    expect(horas).not.toContain(9 * 60)
    expect(horas).toContain(9 * 60 + 30)
  })

  it('o pedido pendente de horário escolhido ocupa — dois responsáveis não pedem o mesmo 10:00', () => {
    const ocupado = ocupacoesDosPedidos([pedido({})])
    const horas = opcoesDaSegunda({}, ocupado).map((opcao) => clock.minutesOf(opcao.inicio))

    expect(horas).not.toContain(10 * 60)
  })

  it('o pedido não ocupa o próprio horário quando é ele que está sendo aceito', () => {
    const ocupado = ocupacoesDosPedidos([pedido({ id: 'p1' })], 'p1')

    expect(ocupado).toEqual([])
  })

  it('dois pets da mesma casa saem seguidos, com o mesmo profissional', () => {
    const opcoes = opcoesDaSegunda({ petIds: ['pet-a', 'pet-b'] }, [
      atendimento({ inicio: clock.toIso(SEGUNDA, 8 * 60 + 30), fim: clock.toIso(SEGUNDA, 9 * 60) }),
    ])
    const [primeira] = opcoes

    /* 08:00 não cabe: o segundo pet cairia no 08:30 ocupado. */
    expect(clock.minutesOf(primeira!.inicio)).toBe(9 * 60)
    expect(primeira!.porPet.map((trecho) => clock.minutesOf(trecho.inicio))).toEqual([
      9 * 60,
      9 * 60 + 30,
    ])
    expect(clock.minutesOf(primeira!.fim)).toBe(10 * 60)
  })

  it('a carga do dia não tira horário — é planejamento, não ocupação', () => {
    const dia = Array.from({ length: 9 }, (_, indice) =>
      atendimento({
        id: `apt-${indice}`,
        inicio: clock.toIso(SEGUNDA, 8 * 60 + indice * 60),
        fim: clock.toIso(SEGUNDA, 8 * 60 + indice * 60 + 55),
      }),
    ).filter((item) => clock.minutesOf(item.inicio) !== 12 * 60)

    const livres = opcoesDoDia(
      {
        data: SEGUNDA,
        typeId: 'tipo-vacina',
        duracaoMinutos: 15,
        petIds: ['pet-x'],
        professionalIds: ['prof-ana'],
        aPartirDe: clock.toIso(SEGUNDA, 0),
      },
      { ...contexto(dia), capacidadeMinutos: 60 },
    )

    expect(livres.length).toBeGreaterThan(0)
  })
})

describe('melhoresOpcoes', () => {
  const base = {
    typeId: 'tipo-consulta',
    duracaoMinutos: 30,
    petIds: ['pet-x'],
    professionalIds: ['prof-ana', 'prof-helena'],
    aPartirDe: clock.toIso(SEGUNDA, 0),
    hoje: SEGUNDA,
    profissionalDaCasa: null,
    limite: 4,
    alemDaJanelaDias: 7,
  }

  it('respeita o período pedido', () => {
    const sugestoes = melhoresOpcoes(
      {
        ...base,
        preferencia: { de: SEGUNDA, ate: SEGUNDA, periodos: ['tarde'], professionalId: null },
      },
      contexto(),
    )

    expect(sugestoes.length).toBeGreaterThan(0)
    expect(sugestoes.every((item) => clock.minutesOf(item.inicio) >= 12 * 60)).toBe(true)
  })

  it('uma sugestão por profissional por dia, e quem já atende o pet primeiro', () => {
    const sugestoes = melhoresOpcoes(
      {
        ...base,
        profissionalDaCasa: 'prof-helena',
        preferencia: { de: SEGUNDA, ate: SEGUNDA, periodos: [], professionalId: null },
      },
      contexto(),
    )

    expect(sugestoes.map((item) => item.professionalId)).toEqual(['prof-helena', 'prof-ana'])
  })

  it('o horário escolhido que sumiu é trocado pelo mais perto dele, não pelo mais cedo', () => {
    const sugestoes = melhoresOpcoes(
      {
        ...base,
        professionalIds: ['prof-ana'],
        alvoEmMinutos: 17 * 60,
        preferencia: { de: SEGUNDA, ate: SEGUNDA, periodos: ['tarde'], professionalId: null },
      },
      contexto([
        atendimento({
          inicio: clock.toIso(SEGUNDA, 17 * 60),
          fim: clock.toIso(SEGUNDA, 17 * 60 + 30),
        }),
      ]),
    )

    expect([16 * 60 + 30, 17 * 60 + 30]).toContain(clock.minutesOf(sugestoes[0]!.inicio))
  })

  it('sem nada na janela, procura depois dela e marca como fora do que pediu', () => {
    const fechado: Clinic = {
      ...clinic,
      feriados: [{ date: SEGUNDA, nome: 'Feriado', fechado: true }],
    }

    const sugestoes = melhoresOpcoes(
      { ...base, preferencia: { de: SEGUNDA, ate: SEGUNDA, periodos: [], professionalId: null } },
      { ...contexto(), clinic: fechado },
    )

    expect(sugestoes.length).toBeGreaterThan(0)
    expect(sugestoes.every((item) => item.foraDaPreferencia)).toBe(true)
  })
})

describe('estadoDaClinica', () => {
  function emPe(data: string, minutos: number) {
    setClockSkew(0)
    setClockSkew(wallToEpoch({ date: data, minutes: minutos }, clinic.utcOffset) - Date.now())
  }

  it('aberta, com a hora em que fecha', () => {
    emPe(SEGUNDA, 10 * 60)

    expect(estadoDaClinica(clinic, clock)).toEqual({
      abertaAgora: true,
      fechaAs: '19:00',
      abreEm: null,
    })
  })

  it('fechada no domingo: abre segunda às 08:00', () => {
    emPe(addDays(SEGUNDA, -1), 10 * 60)

    expect(estadoDaClinica(clinic, clock)).toEqual({
      abertaAgora: false,
      fechaAs: null,
      abreEm: clock.toIso(SEGUNDA, 8 * 60),
    })
  })

  it('antes de abrir, abre no mesmo dia', () => {
    emPe(SEGUNDA, 6 * 60)

    expect(estadoDaClinica(clinic, clock).abreEm).toBe(clock.toIso(SEGUNDA, 8 * 60))
  })
})

describe('camposQueFaltam', () => {
  it('pede só nascimento e sexo — o que muda a consulta', () => {
    expect(camposQueFaltam({ nascimento: null, sexo: null })).toEqual(['nascimento', 'sexo'])
    expect(camposQueFaltam({ nascimento: '2026-01-01', sexo: 'femea' })).toEqual([])
  })
})
