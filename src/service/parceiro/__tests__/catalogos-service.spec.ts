import { describe, expect, it } from 'vitest'

import { doseDaEspecie, numeroDoPasso, type Medicamento } from '../catalogos-service'

const medicamento = {
  doseUsualMgKg: { min: 10, max: 20 },
  doses: [
    {
      id: 'd1',
      especie: 'CACHORRO',
      mgKgMin: 12,
      mgKgMax: 22,
      frequenciaHoras: 12,
      duracaoUsualDias: 7,
      proibido: false,
      nota: null,
    },
    {
      id: 'd2',
      especie: 'GATO',
      mgKgMin: 0,
      mgKgMax: 0,
      frequenciaHoras: 24,
      duracaoUsualDias: null,
      proibido: true,
      nota: 'Tóxico para gatos',
    },
  ],
} as unknown as Medicamento

describe('catálogos clínicos', () => {
  it('usa a faixa da espécie quando o bulário a traz', () => {
    expect(doseDaEspecie(medicamento, 'CACHORRO')).toMatchObject({
      mgKgMin: 12,
      mgKgMax: 22,
      origem: 'ESPECIE',
    })
    expect(doseDaEspecie(medicamento, 'GATO')).toMatchObject({ proibido: true, origem: 'ESPECIE' })
  })

  it('cai na faixa geral sem a espécie ou sem paciente', () => {
    expect(doseDaEspecie(medicamento, 'AVE')).toMatchObject({
      mgKgMin: 10,
      mgKgMax: 20,
      origem: 'GERAL',
    })
    expect(doseDaEspecie(medicamento, null).origem).toBe('GERAL')
  })

  it('lê os números dos passos da conta e ignora o que não é número', () => {
    expect(numeroDoPasso({ pesoKg: 12.4, mg: '124' }, 'pesoKg')).toBe(12.4)
    expect(numeroDoPasso({ mg: '124' }, 'mg')).toBeNull()
    expect(numeroDoPasso({}, 'total')).toBeNull()
  })
})
