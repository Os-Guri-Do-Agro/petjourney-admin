/**
 * Faixas de referência, dose e carga.
 *
 * O que estes testes protegem: status de sinal vital nunca vira dado persistido, `não aferido`
 * nunca se confunde com vazio, e a dose acompanha o peso do dia.
 */

import { describe, expect, it } from 'vitest'

import { medicationsFixture, petsFixture, referenceRangesFixture } from '../../data/fixtures'
import type { Appointment, Clinic, Medication, Pet, Professional } from '../../data/types'
import { createClinicClock } from '../clinic-time'
import { alergiaConflitante, avaliarDose, calcularDose } from '../dose'
import { cargaDoDia, faixaDeOcupacao, resumirFaltas } from '../load'
import {
  desvioRelativo,
  encontrarFaixa,
  foraDaFaixa,
  medicaoPreenchida,
  medicaoVazia,
  statusDaMedicao,
} from '../ranges'

const clock = createClinicClock('-04:00')
const DATA = '2026-08-21'

describe('faixas de referência', () => {
  const faixaCanina = encontrarFaixa(referenceRangesFixture, 'temperatura', 'canina')

  it('encontra a faixa pela espécie', () => {
    expect(faixaCanina?.min).toBe(37.5)
    expect(encontrarFaixa(referenceRangesFixture, 'temperatura', 'felina')?.min).toBe(38)
  })

  it('recalcula o status a partir do valor, sempre', () => {
    expect(statusDaMedicao({ valor: 38.4, naoAferido: false }, faixaCanina)).toBe('dentro')
    expect(statusDaMedicao({ valor: 40.1, naoAferido: false }, faixaCanina)).toBe('acima')
    expect(statusDaMedicao({ valor: 36.9, naoAferido: false }, faixaCanina)).toBe('abaixo')
  })

  it('distingue `não aferido` de vazio', () => {
    const naoAferido = { valor: null, naoAferido: true }
    const vazio = medicaoVazia()

    expect(statusDaMedicao(naoAferido, faixaCanina)).toBe('nao-aferido')
    expect(statusDaMedicao(vazio, faixaCanina)).toBe('nao-aferido')

    /** O status coincide, mas o dado não: um foi decidido, o outro não foi preenchido. */
    expect(medicaoPreenchida(naoAferido)).toBe(true)
    expect(medicaoPreenchida(vazio)).toBe(false)
  })

  it('não inventa faixa quando não existe uma para a espécie', () => {
    const semFaixa = encontrarFaixa(referenceRangesFixture, 'pressaoSistolica', 'reptil')

    expect(semFaixa).toBeNull()
    expect(statusDaMedicao({ valor: 120, naoAferido: false }, semFaixa)).toBe('sem-referencia')
  })

  it('mede o desvio em proporção da largura da faixa', () => {
    expect(foraDaFaixa('acima')).toBe(true)
    expect(foraDaFaixa('dentro')).toBe(false)
    /** Faixa 37,5–39,2 tem 1,7 de largura; 40,05 está 0,85 acima, ou meia largura. */
    expect(desvioRelativo({ valor: 40.05, naoAferido: false }, faixaCanina)).toBeCloseTo(0.5, 2)
  })
})

describe('cálculo de dose', () => {
  const dipirona = medicationsFixture.find(
    (item) => item.principioAtivo === 'Dipirona',
  ) as Medication

  it('converte mg/kg em quantidade da apresentação', () => {
    const calculo = calcularDose({
      medicamento: dipirona,
      pesoKg: 20,
      mgPorKg: 25,
      frequenciaHoras: 8,
      duracaoDias: 5,
    })

    expect(calculo?.mgPorAdministracao).toBe(500)
    /** 500 mg numa apresentação de 500 mg/mL: 1 mL por administração. */
    expect(calculo?.quantidadeApresentacao).toBe(1)
    expect(calculo?.totalAdministracoes).toBe(15)
  })

  it('não calcula sem peso — e diz o porquê', () => {
    expect(
      calcularDose({
        medicamento: dipirona,
        pesoKg: null,
        mgPorKg: 25,
        frequenciaHoras: 8,
        duracaoDias: 5,
      }),
    ).toBeNull()

    expect(
      avaliarDose({
        medicamento: dipirona,
        pesoKg: null,
        mgPorKg: 25,
        frequenciaHoras: 8,
        duracaoDias: 5,
      }),
    ).toBe('peso-ausente')
  })

  it('avisa fora da dose usual, nos dois sentidos', () => {
    const base = { medicamento: dipirona, pesoKg: 10, frequenciaHoras: 8, duracaoDias: 3 }

    expect(avaliarDose({ ...base, mgPorKg: 5 })).toBe('abaixo-da-usual')
    expect(avaliarDose({ ...base, mgPorKg: 40 })).toBe('acima-da-usual')
    expect(avaliarDose({ ...base, mgPorKg: 20 })).toBeNull()
  })

  /**
   * A faixa da espécie tem precedência sobre a geral.
   *
   * Conferindo 0,1 mg/kg de meloxicam contra a faixa geral (0,1–0,2), a tela dava o **dobro** da
   * dose felina de manutenção como "dentro do usual" e não dizia nada. É o erro que o bulário
   * por espécie existe para pegar.
   */
  it('confere a dose contra a faixa da espécie do paciente', () => {
    const meloxicam = medicationsFixture.find((item) => item.id === 'med-meloxicam') as Medication
    const base = { medicamento: meloxicam, pesoKg: 4, frequenciaHoras: 24, duracaoDias: 3 }

    expect(avaliarDose({ ...base, mgPorKg: 0.1 })).toBeNull()
    expect(avaliarDose({ ...base, mgPorKg: 0.1, especie: 'canina' })).toBeNull()
    expect(avaliarDose({ ...base, mgPorKg: 0.1, especie: 'felina' })).toBe('acima-da-usual')
  })

  it('avisa espécie proibida antes de olhar a dose', () => {
    const carprofeno = medicationsFixture.find((item) => item.id === 'med-carprofeno') as Medication

    expect(
      avaliarDose({
        medicamento: carprofeno,
        pesoKg: 4,
        mgPorKg: 3,
        frequenciaHoras: 24,
        duracaoDias: 3,
        especie: 'felina',
      }),
    ).toBe('especie-proibida')
  })

  it('encontra a alergia registrada pelo princípio ativo', () => {
    const luna = petsFixture.find((pet) => pet.id === 'pet-luna') as Pet
    const amoxicilina = medicationsFixture.find(
      (item) => item.principioAtivo === 'Amoxicilina',
    ) as Medication

    expect(alergiaConflitante(luna, amoxicilina)?.kind).toBe('alergia')
    expect(alergiaConflitante(luna, dipirona)).toBeNull()
  })
})

describe('carga do dia', () => {
  const profissionais: Professional[] = [
    {
      id: 'prof-ana',
      nome: 'Ana',
      iniciais: 'AR',
      conselho: '',
      especialidade: '',
      corIndice: 0,
      salaPadraoId: null,
      ativo: true,
    },
  ]

  const clinic: Clinic = {
    id: 'c',
    nome: 'Teste',
  endereco: 'Rua Teste, 1',
  telefone: '(11) 0000-0000',
    utcOffset: '-04:00',
    slotMinutos: 15,
    horarios: [
      { weekday: 0, fechado: true, expediente: { inicio: '00:00', fim: '00:00' }, almoco: null },
      ...([1, 2, 3, 4, 5] as const).map((weekday) => ({
        weekday,
        fechado: false,
        expediente: { inicio: '08:00', fim: '19:00' },
        almoco: { inicio: '12:00', fim: '13:00' },
      })),
      { weekday: 6, fechado: false, expediente: { inicio: '08:00', fim: '13:00' }, almoco: null },
    ],
    feriados: [],
  }

  function appointment(id: string, inicioMin: number, duracao: number, patch: Partial<Appointment> = {}): Appointment {
    return {
      id,
      petId: 'pet-luna',
      tutorId: 'tutor-marina',
      professionalId: 'prof-ana',
      roomIds: [],
      typeId: 'tipo-consulta',
      inicio: clock.toIso(DATA, inicioMin),
      fim: clock.toIso(DATA, inicioMin + duracao),
      status: 'confirmado',
      origem: 'recepcao',
      encaixe: false,
      observacao: '',
      chegadaEm: null,
      iniciadoEm: null,
      finalizadoEm: null,
      canceladoEm: null,
      motivoCancelamento: null,
      encounterId: null,
      linkedGroupId: null,
      criadoEm: clock.toIso(DATA, 480),
      atualizadoEm: clock.toIso(DATA, 480),
      ...patch,
    }
  }

  it('desconta o almoço da capacidade', () => {
    const carga = cargaDoDia(DATA, [], clinic, profissionais, clock)

    /** 08:00–19:00 são 660 min; menos 60 de almoço, 600. */
    expect(carga.capacidadeMinutos).toBe(600)
    expect(carga.ocupacao).toBe(0)
  })

  it('conta só o que ocupa horário, mas registra a falta', () => {
    const carga = cargaDoDia(
      DATA,
      [
        appointment('a', 540, 60),
        appointment('b', 660, 60, { status: 'falta' }),
        appointment('c', 780, 30, { encaixe: true }),
      ],
      clinic,
      profissionais,
      clock,
    )

    expect(carga.ocupadoMinutos).toBe(90)
    expect(carga.agendados).toBe(2)
    expect(carga.faltas).toBe(1)
    expect(carga.encaixes).toBe(1)
  })

  it('classifica a ocupação em faixas legíveis', () => {
    expect(faixaDeOcupacao(0)).toBe('vazio')
    expect(faixaDeOcupacao(0.4)).toBe('tranquilo')
    expect(faixaDeOcupacao(0.9)).toBe('cheio')
    expect(faixaDeOcupacao(1.2)).toBe('excedido')
  })

  it('resume faltas com quantas **e quanto**', () => {
    const resumo = resumirFaltas(
      [
        appointment('a', 540, 60, { status: 'falta' }),
        appointment('b', 660, 30, { status: 'falta' }),
        appointment('c', 780, 30),
      ],
      clock,
      2,
    )

    expect(resumo).toHaveLength(1)
    expect(resumo[0]?.faltas).toBe(2)
    expect(resumo[0]?.minutosPerdidos).toBe(90)
    expect(resumo[0]?.reincidente).toBe(true)
  })
})
