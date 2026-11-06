import { describe, expect, it } from 'vitest'

import {
  aplicarMutacao,
  cartoesDaColuna,
  chaveDoConflito,
  destinoDoArraste,
  fundoDaColuna,
  horaDe,
  horaNoFuso,
  janelaDoDia,
  minutosAgoraNoFuso,
  minutosDe,
  minutosDoInstante,
  noPasso,
  ordenarConflitos,
  segundaDe,
  somarDias,
  tocaODia,
  trechoNoDia,
} from '@/components/agendamentos/leitura-da-agenda'
import type { OcorrenciaDeBloqueio } from '@/service/parceiro/agenda-config-service'
import type { AgendaDoDia, Agendamento, ColunaDaAgenda } from '@/service/parceiro/agenda-service'

const DATA = '2026-11-06'

function agendamento(parcial: Partial<Agendamento> & { id: string }): Agendamento {
  return {
    versao: 1,
    status: 'AGENDADO',
    origem: 'RECEPCAO',
    encaixe: false,
    inicio: `${DATA}T09:00:00-04:00`,
    fim: `${DATA}T09:30:00-04:00`,
    duracaoMinutos: 30,
    paciente: {
      id: 'p',
      nome: 'Bolota',
      especie: 'CACHORRO',
      clienteId: 'c',
      clienteNome: 'Marina',
    },
    profissionalId: 'ana',
    tipoId: 't',
    salaIds: ['sala-1'],
    grupoId: null,
    observacao: null,
    confirmadoEm: null,
    confirmadoPor: null,
    chegadaEm: null,
    iniciadoEm: null,
    finalizadoEm: null,
    canceladoEm: null,
    motivoCancelamento: null,
    canceladoPor: null,
    atendimentoId: null,
    pedidoId: null,
    remarcadoDeId: null,
    faltaEm: null,
    reagendadoComoId: null,
    criadoPorId: null,
    criadoEm: `${DATA}T08:00:00-04:00`,
    atualizadoEm: `${DATA}T08:00:00-04:00`,
    conflitos: [],
    ...parcial,
  }
}

function bloqueio(parcial: Partial<OcorrenciaDeBloqueio>): OcorrenciaDeBloqueio {
  return {
    bloqueioId: 'b',
    data: DATA,
    inicio: `${DATA}T12:00:00-04:00`,
    fim: `${DATA}T13:00:00-04:00`,
    profissionalId: null,
    salaId: null,
    motivo: 'ALMOCO',
    detalhe: null,
    recorrente: true,
    ...parcial,
  } as OcorrenciaDeBloqueio
}

function dia(parcial: Partial<AgendaDoDia> = {}): AgendaDoDia {
  return {
    data: DATA,
    fuso: 'America/Cuiaba',
    agrupar: 'PROFISSIONAL',
    clinicaFechada: false,
    feriado: null,
    expediente: { inicio: '08:00', fim: '18:00' },
    almoco: null,
    colunas: [{ tipo: 'PROFISSIONAL', id: 'ana', nome: 'Ana' }],
    profissionais: [
      {
        id: 'ana',
        nome: 'Ana',
        corIndice: 0,
        salaPadraoId: null,
        ativo: true,
        trabalhaNoDia: true,
        origemDoExpediente: 'ESTABELECIMENTO',
        faixas: [
          { inicio: '08:00', fim: '12:00' },
          { inicio: '13:00', fim: '17:00' },
        ],
      },
    ],
    salas: [],
    agendamentos: [],
    bloqueios: [],
    reservas: [],
    ...parcial,
  }
}

const ANA: ColunaDaAgenda = { tipo: 'PROFISSIONAL', id: 'ana', nome: 'Ana' }

describe('minutos', () => {
  it('lê a hora da parede pelo texto do instante', () => {
    expect(minutosDe('09:30')).toBe(570)
    expect(horaDe(570)).toBe('09:30')
    expect(minutosDoInstante('2026-11-06T09:30:00-04:00')).toBe(570)
  })

  it('o trecho que vem de outro dia começa à meia-noite', () => {
    expect(trechoNoDia(DATA, '2026-11-05T22:00:00-04:00', `${DATA}T06:00:00-04:00`)).toEqual({
      inicioMin: 0,
      fimMin: 360,
    })
    expect(trechoNoDia(DATA, `${DATA}T22:00:00-04:00`, '2026-11-07T06:00:00-04:00')).toEqual({
      inicioMin: 1320,
      fimMin: 1440,
    })
  })

  it('o arraste cai no passo da grade', () => {
    expect(noPasso(547, 10)).toBe(550)
    expect(noPasso(-20, 10)).toBe(0)
  })
})

describe('janelaDoDia', () => {
  it('é o expediente esticado até o agendamento mais tarde, em horas cheias', () => {
    const lido = dia({
      agendamentos: [
        agendamento({ id: 'a', inicio: `${DATA}T18:30:00-04:00`, fim: `${DATA}T19:10:00-04:00` }),
      ],
    })
    expect(janelaDoDia(lido)).toEqual({ inicio: 480, fim: 1200 })
  })
})

describe('cartoesDaColuna', () => {
  it('dois no mesmo horário ficam lado a lado', () => {
    const lido = dia({ agendamentos: [agendamento({ id: 'a' }), agendamento({ id: 'b' })] })
    const cartoes = cartoesDaColuna(lido, ANA)
    expect(cartoes.map((cartao) => [cartao.faixa, cartao.faixas])).toEqual([
      [0, 2],
      [1, 2],
    ])
  })

  it('por profissional, o atendimento em duas salas aparece uma vez', () => {
    const lido = dia({
      agendamentos: [
        agendamento({ id: 'g', grupoId: 'g', salaIds: ['cirurgia'] }),
        agendamento({ id: 'perna', grupoId: 'g', salaIds: ['recuperacao'] }),
      ],
    })
    expect(cartoesDaColuna(lido, ANA).map((cartao) => cartao.agendamento.id)).toEqual(['g'])
  })

  it('pode esconder o cancelado e a falta', () => {
    const lido = dia({
      agendamentos: [agendamento({ id: 'a', status: 'CANCELADO' }), agendamento({ id: 'b' })],
    })
    expect(cartoesDaColuna(lido, ANA, { ocultarRiscados: true })).toHaveLength(1)
    expect(cartoesDaColuna(lido, ANA)).toHaveLength(2)
  })
})

describe('fundoDaColuna', () => {
  it('fora do expediente, bloqueio da clínica e o de sala que não pesa no profissional', () => {
    const lido = dia({
      bloqueios: [bloqueio({}), bloqueio({ bloqueioId: 'sala', salaId: 'sala-1' })],
    })
    const fundo = fundoDaColuna(lido, ANA, { inicio: 480, fim: 1080 })

    expect(fundo.filter((item) => item.tipo === 'fora')).toEqual([
      { inicioMin: 720, fimMin: 780, tipo: 'fora' },
      { inicioMin: 1020, fimMin: 1080, tipo: 'fora' },
    ])
    expect(
      fundo.filter((item) => item.tipo === 'bloqueio').map((item) => item.bloqueio?.bloqueioId),
    ).toEqual(['b'])
  })
})

describe('destinoDoArraste (guia 2.7)', () => {
  const SALA_1: ColunaDaAgenda = { tipo: 'SALA', id: 'sala-1', nome: 'Sala 1' }
  const SALA_2: ColunaDaAgenda = { tipo: 'SALA', id: 'sala-2', nome: 'Sala 2' }

  it('por profissional, vai o profissional da coluna onde caiu', () => {
    expect(destinoDoArraste({ profissionalId: 'ana' }, ANA, { ...ANA, id: 'beto' })).toEqual({
      profissionalId: 'beto',
    })
  })

  it('por sala, troca só a sala de onde saiu, nunca o profissional', () => {
    expect(destinoDoArraste({ profissionalId: 'ana' }, SALA_1, SALA_2)).toEqual({
      trocarSala: { de: 'sala-1', para: 'sala-2' },
    })
  })

  it('na mesma coluna, só o horário muda', () => {
    expect(destinoDoArraste({ profissionalId: 'ana' }, SALA_1, SALA_1)).toBeUndefined()
  })
})

describe('dias e fuso', () => {
  it('soma dias pelo calendário, atravessando o mês', () => {
    expect(somarDias('2026-11-30', 1)).toBe('2026-12-01')
    expect(somarDias('2026-11-01', -1)).toBe('2026-10-31')
  })

  it('a semana começa na segunda', () => {
    expect(segundaDe('2026-11-06')).toBe('2026-11-02')
    expect(segundaDe('2026-11-08')).toBe('2026-11-02')
    expect(segundaDe('2026-11-02')).toBe('2026-11-02')
  })

  it('lê a hora na parede da clínica, venha o instante em UTC ou com offset', () => {
    expect(horaNoFuso('2026-11-06T13:05:00Z', 'America/Cuiaba')).toBe('09:05')
    expect(horaNoFuso('2026-11-06T09:05:00-04:00', 'America/Cuiaba')).toBe('09:05')
    expect(minutosAgoraNoFuso('America/Cuiaba', new Date('2026-11-06T13:05:00Z'))).toBe(545)
  })
})

describe('aplicarMutacao', () => {
  it('troca o que voltou, tira os removidos e põe o novo que cabe no dia', () => {
    const lido = dia({ agendamentos: [agendamento({ id: 'a' }), agendamento({ id: 'b' })] })
    const movido = agendamento({ id: 'a', versao: 2, inicio: `${DATA}T10:00:00-04:00` })
    const novo = agendamento({ id: 'c' })
    const longe = agendamento({
      id: 'd',
      inicio: '2026-11-09T09:00:00-04:00',
      fim: '2026-11-09T09:30:00-04:00',
    })

    const depois = aplicarMutacao(
      lido,
      { agendamentos: [movido, novo, longe], removidos: ['b'] },
      (item) => tocaODia(item, DATA),
    )

    expect(depois.agendamentos.map((item) => [item.id, item.versao])).toEqual([
      ['a', 2],
      ['c', 1],
    ])
  })

  it('o que foi para outro dia sai da tela', () => {
    const lido = dia({ agendamentos: [agendamento({ id: 'a' })] })
    const outroDia = agendamento({
      id: 'a',
      inicio: '2026-11-07T09:00:00-04:00',
      fim: '2026-11-07T09:30:00-04:00',
    })
    expect(
      aplicarMutacao(lido, { agendamentos: [outroDia], removidos: [] }, (item) =>
        tocaODia(item, DATA),
      ).agendamentos,
    ).toEqual([])
  })
})

describe('conflitos', () => {
  it('o mais grave primeiro e a frase pelo motivo', () => {
    const ordem = ordenarConflitos([
      { kind: 'lunch-overlap', severity: 'info', params: {} },
      { kind: 'holiday-closed', severity: 'blocking', params: {} },
      { kind: 'professional-overlap', severity: 'warning', params: {} },
    ])
    expect(ordem.map((item) => item.severity)).toEqual(['blocking', 'warning', 'info'])
    expect(
      chaveDoConflito({ kind: 'outside-hours', severity: 'warning', params: { motivo: 'FOLGA' } }),
    ).toBe('agendamentos.conflito.outside-hours.FOLGA')
  })
})
