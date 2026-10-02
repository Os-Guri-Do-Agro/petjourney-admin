/**
 * Teste de fumaça do dataset — o mesmo que validou a camada de dados antes de qualquer
 * componente existir.
 *
 * Dois invariantes importam: o dia âncora nasce com exatamente 40 atendimentos e nenhum dos
 * 12 casos difíceis está faltando. Se este teste passar de manhã e falhar à tarde, o sorteio
 * de status voltou a consumir do mesmo gerador do posicionamento.
 */

import { afterEach, describe, expect, it } from 'vitest'

import { createClinicClock, setClockSkew } from '../../domain/clinic-time'
import { CLINIC_UTC_OFFSET } from '../fixtures'
import {
  ATENDIMENTOS_NO_DIA_ANCORA,
  calcularAncora,
  contarNoDia,
  gerarDataset,
  type CasoId,
} from '../seed'

const clock = createClinicClock(CLINIC_UTC_OFFSET)

const CASOS_ESPERADOS: CasoId[] = [
  'sobreposicao',
  'encaixe',
  'duas-salas',
  'atravessa-almoco',
  'bloqueio-recorrente',
  'dia-fechado',
  'falta-reincidente',
  'cancelado-visivel',
  'fila-expirando',
  'alergia-prescricao',
  'nomes-extremos',
  'retorno-sem-horario',
  /* Internação: ancorados no plantão corrente, e por isso presentes a qualquer hora do dia. */
  'internacao-piora',
  'internacao-troca-plantao',
  'internacao-boletim-horario',
  /* O resumo "Este pet em 30 segundos": perda de peso, diário cheio e paciente sem histórico. */
  'resumo-perda-de-peso',
  'resumo-diario-cheio',
  'resumo-pet-novo',
  /* Adesão ao tratamento: dá e não registra, crítico com queda, várias vezes ao dia. */
  'adesao-sem-registro',
  'adesao-critico',
  'adesao-varias-vezes',
]

afterEach(() => {
  setClockSkew(0)
})

describe('seed do módulo clínico', () => {
  it('produz 40 atendimentos no dia âncora', () => {
    const dataset = gerarDataset()

    expect(contarNoDia(dataset, dataset.ancora)).toBe(ATENDIMENTOS_NO_DIA_ANCORA)
  })

  /**
   * Este é o teste que pegou a armadilha do gerador único: com `rngStatus` consumindo do mesmo
   * fluxo do posicionamento, o dia âncora nascia com 40 atendimentos de manhã e 38 à tarde.
   *
   * O deslocamento é calculado para cair em 08:00 e 18:00 **do mesmo dia da clínica** — passar
   * da meia-noite move o dia âncora de propósito, e aí a comparação seria outra coisa.
   */
  it('mantém os 40 e os mesmos horários em qualquer hora do mesmo dia', () => {
    setClockSkew(0)

    const minutosAgora = clock.now().minutes
    const paraHora = (hora: number) => (hora * 60 - minutosAgora) * 60_000

    setClockSkew(paraHora(8))
    const manha = gerarDataset()

    setClockSkew(paraHora(18))
    const tarde = gerarDataset()

    expect(manha.ancora).toBe(tarde.ancora)
    expect(contarNoDia(manha, manha.ancora)).toBe(ATENDIMENTOS_NO_DIA_ANCORA)
    expect(contarNoDia(tarde, tarde.ancora)).toBe(ATENDIMENTOS_NO_DIA_ANCORA)
    expect(tarde.appointments.map((item) => item.id)).toEqual(
      manha.appointments.map((item) => item.id),
    )
    expect(tarde.appointments.map((item) => item.inicio)).toEqual(
      manha.appointments.map((item) => item.inicio),
    )
  })

  it('move o dia âncora quando o relógio atravessa a meia-noite, e mantém os 40 lá', () => {
    setClockSkew(0)
    const hoje = gerarDataset()

    /**
     * Três dias à frente. Vinte e quatro horas não bastariam: numa sexta o salto cai no
     * sábado, que o gerador empurra para segunda, e um domingo empurraria para a mesma
     * segunda — o âncora não mudaria e o teste passaria por acidente.
     */
    setClockSkew(72 * 60 * 60_000)
    const amanha = gerarDataset()

    expect(amanha.ancora).not.toBe(hoje.ancora)
    expect(contarNoDia(amanha, amanha.ancora)).toBe(ATENDIMENTOS_NO_DIA_ANCORA)
  })

  it('é determinístico para a mesma semente', () => {
    const a = gerarDataset(1234)
    const b = gerarDataset(1234)

    expect(a.appointments.map((item) => `${item.id}@${item.inicio}`)).toEqual(
      b.appointments.map((item) => `${item.id}@${item.inicio}`),
    )
  })

  it('entrega os 21 casos difíceis, cada um com rota própria', () => {
    const dataset = gerarDataset()
    const ids = dataset.casos.map((caso) => caso.id)

    for (const esperado of CASOS_ESPERADOS) {
      expect(ids).toContain(esperado)
    }

    expect(dataset.casos).toHaveLength(CASOS_ESPERADOS.length)
    expect(dataset.casos.every((caso) => caso.rota.startsWith('/'))).toBe(true)
  })

  it('nunca cai em fim de semana', () => {
    const dataset = gerarDataset()

    expect(calcularAncora(dataset.ancora)).toBe(dataset.ancora)
    expect([1, 2, 3, 4, 5]).toContain(new Date(`${dataset.ancora}T12:00:00Z`).getUTCDay())
  })

  it('planta a cirurgia de duas salas ligada pelo mesmo grupo', () => {
    const dataset = gerarDataset()
    const grupo = dataset.appointments.filter(
      (item) => item.linkedGroupId === 'grupo-cirurgia-bento',
    )

    expect(grupo).toHaveLength(2)
    expect(new Set(grupo.map((item) => item.roomIds[0]))).toEqual(
      new Set(['sala-cirurgia', 'sala-recuperacao']),
    )
  })

  it('mantém o cancelado no dia, em vez de sumir com ele', () => {
    const dataset = gerarDataset()
    const cancelado = dataset.appointments.find((item) => item.id === 'apt-cancelado')

    expect(cancelado?.status).toBe('cancelado')
    expect(cancelado ? clock.dateOf(cancelado.inicio) : null).toBe(dataset.ancora)
  })

  it('acumula faltas suficientes para caracterizar reincidência', () => {
    const dataset = gerarDataset()
    const faltas = dataset.appointments.filter(
      (item) => item.status === 'falta' && item.petId === 'pet-jack',
    )

    expect(faltas.length).toBeGreaterThanOrEqual(3)
  })
})
