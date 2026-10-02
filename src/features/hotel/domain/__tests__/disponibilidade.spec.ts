/**
 * Regra R2 — duas estadias não ocupam a mesma acomodação.
 *
 * O defeito que estes testes existem para impedir quase nunca é "duas reservas no mesmo dia": é a
 * saída do dia 20 às 18h contra a entrada do dia 20 às 8h, e a vaga oferecida ao telefone dentro
 * da janela de higienização. Os dois passariam por uma comparação de datas.
 */

import { describe, expect, it } from 'vitest'

import {
  avaliarVaga,
  mapaDoPeriodo,
  porteCabe,
  reservaSegura,
  taxaDeOcupacao,
} from '../disponibilidade'
import type { Acomodacao, Reserva } from '../../data/types'

const OFFSET = '-04:00'

function iso(data: string, hora: string) {
  return `${data}T${hora}:00${OFFSET}`
}

const baia: Acomodacao = {
  id: 'acom-a1',
  nome: 'Baia A1',
  blocoId: 'bloco-a',
  tipoId: 'tipo-baia',
  capacidade: 2,
  porteMaximo: 'grande',
  especiesAceitas: ['canina'],
  recursos: [],
  higienizacaoMinutos: 90,
  tarifaId: 'tarifa-padrao',
  ativa: true,
  motivoInativa: null,
  detalheInativa: '',
  inativaDesde: null,
}

function reserva(entrada: Partial<Reserva> = {}): Reserva {
  return {
    id: 'res-1',
    petId: 'pet-1',
    tutorId: 'tutor-1',
    acompanhantePetId: null,
    acomodacaoId: 'acom-a1',
    entradaPrevista: iso('2026-06-10', '09:00'),
    saidaPrevista: iso('2026-06-14', '10:00'),
    diarias: 4,
    status: 'confirmada',
    origem: 'balcao',
    servicos: [],
    orcamento: { linhas: [], totalCentavos: 0, sinalCentavos: 0, saldoCentavos: 0 },
    pagoCentavos: 0,
    observacao: '',
    autorizadosARetirar: [],
    dispensas: [],
    criadoEm: iso('2026-06-01', '10:00'),
    atualizadoEm: iso('2026-06-01', '10:00'),
    canceladaEm: null,
    motivoCancelamento: null,
    ...entrada,
  }
}

function avaliar(reservas: Reserva[], inicio: string, fim: string, extra = {}) {
  return avaliarVaga({ acomodacao: baia, reservas, inicio, fim, ...extra })
}

describe('sobreposição', () => {
  it('a vaga está livre quando não há nada no período', () => {
    const vaga = avaliar([], iso('2026-07-01', '09:00'), iso('2026-07-05', '10:00'))

    expect(vaga.situacao).toBe('livre')
    expect(vaga.impedimentos).toEqual([])
  })

  it('recusa o período que cruza uma reserva existente', () => {
    const vaga = avaliar([reserva()], iso('2026-06-12', '09:00'), iso('2026-06-16', '10:00'))

    expect(vaga.impedimentos).toContain('ocupada')
    expect(vaga.conflitos).toHaveLength(1)
  })

  it('a ponta encostada não é cruzamento', () => {
    /*
     * Entrar exatamente quando o outro sai **mais a higienização**. Sem as pontas abertas, uma
     * reserva que começa no mesmo minuto em que a anterior libera seria recusada, e a casa perderia
     * uma diária por dia.
     */
    const vaga = avaliar([reserva()], iso('2026-06-14', '11:30'), iso('2026-06-18', '10:00'))

    expect(vaga.situacao).toBe('livre')
  })

  it('a janela de higienização segura a vaga depois da saída', () => {
    /* A saída é às 10h e a limpeza leva 90 min. Entrar às 11h é entrar numa baia suja. */
    const vaga = avaliar([reserva()], iso('2026-06-14', '11:00'), iso('2026-06-18', '10:00'))

    expect(vaga.impedimentos).toContain('higienizacao')
    expect(vaga.situacao).toBe('higienizacao')
  })

  it('a higienização é somada uma vez só, no fim do que já existe', () => {
    /*
     * Somar dos dois lados cobraria a limpeza duas vezes e tiraria do mapa uma vaga que existe: a
     * entrada no mesmo dia da saída de outro, com folga suficiente.
     */
    const vaga = avaliar(
      [reserva({ saidaPrevista: iso('2026-06-14', '08:00') })],
      iso('2026-06-14', '09:31'),
      iso('2026-06-18', '10:00'),
    )

    expect(vaga.situacao).toBe('livre')
  })

  it('reserva cancelada e não comparecida liberam o lugar', () => {
    const canceladas = [
      reserva({ id: 'res-cancelada', status: 'cancelada' }),
      reserva({ id: 'res-faltou', status: 'nao-compareceu' }),
    ]

    expect(
      avaliar(canceladas, iso('2026-06-11', '09:00'), iso('2026-06-13', '10:00')).situacao,
    ).toBe('livre')
    expect(canceladas.every((item) => !reservaSegura(item))).toBe(true)
  })

  it('a própria reserva não conflita consigo mesma ao ser estendida', () => {
    /* Prorrogar é a operação que mais acontece. Sem o `ignorar`, estender um dia seria recusado. */
    const vaga = avaliar([reserva()], iso('2026-06-10', '09:00'), iso('2026-06-16', '10:00'), {
      ignorarReservaId: 'res-1',
    })

    expect(vaga.situacao).toBe('livre')
  })

  it('separa "ocupada" de "reservada": quem está dentro e quem vai chegar', () => {
    const dentro = avaliar(
      [reserva({ status: 'hospedado' })],
      iso('2026-06-11', '09:00'),
      iso('2026-06-13', '10:00'),
    )
    const vaiChegar = avaliar(
      [reserva({ status: 'confirmada' })],
      iso('2026-06-11', '09:00'),
      iso('2026-06-13', '10:00'),
    )

    expect(dentro.situacao).toBe('ocupada')
    expect(vaiChegar.situacao).toBe('reservada')
  })
})

describe('compatibilidade', () => {
  it('recusa o porte que não cabe, e devolve **todos** os impedimentos', () => {
    /*
     * Todos, e não só o primeiro: uma tela que diz "não aceita gatos" e, corrigido isso, diz
     * "porte" faz a recepção tentar duas vezes ao telefone.
     */
    const vaga = avaliar([], iso('2026-07-01', '09:00'), iso('2026-07-03', '10:00'), {
      porte: 'gigante',
      especie: 'felina',
      ocupantes: 3,
    })

    expect(vaga.impedimentos).toEqual(['porte', 'especie', 'capacidade'])
  })

  it('porte não informado cabe em qualquer lugar', () => {
    /* Recusar por cadastro incompleto faria a recepção inventar um valor para poder vender. */
    expect(porteCabe(null, 'mini')).toBe(true)

    const vaga = avaliar([], iso('2026-07-01', '09:00'), iso('2026-07-03', '10:00'), {
      porte: null,
    })

    expect(vaga.situacao).toBe('livre')
  })

  it('acomodação fora de operação nunca é livre', () => {
    const vaga = avaliarVaga({
      acomodacao: { ...baia, ativa: false, motivoInativa: 'reforma' },
      reservas: [],
      inicio: iso('2026-07-01', '09:00'),
      fim: iso('2026-07-03', '10:00'),
    })

    expect(vaga.situacao).toBe('fora-de-operacao')
    expect(vaga.impedimentos).toContain('inativa')
  })
})

describe('o mapa e a ocupação', () => {
  const acomodacoes: Acomodacao[] = [
    baia,
    { ...baia, id: 'acom-a2', nome: 'Baia A2' },
    { ...baia, id: 'acom-g1', nome: 'Gatil G1', tipoId: 'tipo-gatil', especiesAceitas: ['felina'] },
    { ...baia, id: 'acom-a7', nome: 'Baia A7', ativa: false },
  ]

  it('filtra por tipo quando pedido', () => {
    const vagas = mapaDoPeriodo({
      acomodacoes,
      reservas: [],
      inicio: iso('2026-07-01', '09:00'),
      fim: iso('2026-07-03', '10:00'),
      tipos: ['tipo-gatil'],
    })

    expect(vagas.map((vaga) => vaga.acomodacao.id)).toEqual(['acom-g1'])
  })

  it('a ocupação ignora o que não está em operação', () => {
    /*
     * O denominador é o que opera. Contar a baia em reforma como "livre" faria a casa parecer
     * menos cheia do que está — e é com esse número que se decide abrir ou não no feriado.
     */
    const vagas = mapaDoPeriodo({
      acomodacoes,
      reservas: [reserva({ status: 'hospedado' })],
      inicio: iso('2026-06-11', '09:00'),
      fim: iso('2026-06-13', '10:00'),
    })

    expect(taxaDeOcupacao(vagas)).toBeCloseTo(1 / 3)
  })
})
