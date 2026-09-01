/**
 * Porte, faixa etária e a resolução da faixa de referência.
 *
 * O motivo de tudo isto existir cabe numa frase: faixa por espécie sozinha erra. Um yorkshire
 * de 3 kg a 140 bpm está em repouso; um são-bernardo a 140 bpm está taquicárdico. A faixa
 * canina geral (70–160) não acusa nenhum dos dois, e uma tela que nunca acusa ensina o
 * profissional a ignorar o destaque — que é o pior desfecho possível para o realce.
 */

import { describe, expect, it } from 'vitest'

import { referenceRangesFixture } from '../../data/fixtures/reference-ranges'
import type { Pet, ReferenceRange } from '../../data/types'
import { faixaEtariaDoPaciente, idadeEmMeses, porteDoPaciente } from '../porte'
import { encontrarFaixa, statusDaMedicao } from '../ranges'

const HOJE = '2026-08-31'

function pet(patch: Partial<Pet> = {}): Pet {
  return {
    id: 'pet-teste',
    nome: 'Teste',
    especie: 'canina',
    raca: 'SRD',
    sexo: 'macho',
    nascimento: '2020-08-31',
    castrado: false,
    porte: null,
    pesoKg: 12,
    tutorId: 'tutor-teste',
    alertas: [],
    iniciais: 'TE',
    ...patch,
  }
}

describe('porteDoPaciente', () => {
  it('respeita o porte informado acima do peso', () => {
    /**
     * O caso que justifica o campo existir: filhote de raça gigante pesa pouco e continua
     * sendo gigante. Estimar por peso aqui aplicaria a faixa de um cão médio.
     */
    const filhoteGigante = pet({ porte: 'gigante', pesoKg: 10 })

    expect(porteDoPaciente(filhoteGigante)).toBe('gigante')
  })

  it('estima por peso quando o porte não foi informado', () => {
    expect(porteDoPaciente(pet({ porte: null, pesoKg: 3 }))).toBe('mini')
    expect(porteDoPaciente(pet({ porte: null, pesoKg: 12 }))).toBe('pequeno')
    expect(porteDoPaciente(pet({ porte: null, pesoKg: 22 }))).toBe('medio')
    expect(porteDoPaciente(pet({ porte: null, pesoKg: 40 }))).toBe('grande')
    expect(porteDoPaciente(pet({ porte: null, pesoKg: 70 }))).toBe('gigante')
  })

  it('não atribui porte a espécie em que ele não muda a referência', () => {
    expect(porteDoPaciente(pet({ especie: 'felina', pesoKg: 4 }))).toBeNull()
    expect(porteDoPaciente(pet({ especie: 'ave', pesoKg: 0.1 }))).toBeNull()
  })

  it('devolve nulo quando não há porte nem peso', () => {
    expect(porteDoPaciente(pet({ porte: null, pesoKg: null }))).toBeNull()
  })
})

describe('faixaEtariaDoPaciente', () => {
  it('reconhece filhote abaixo de um ano', () => {
    expect(faixaEtariaDoPaciente(pet({ nascimento: '2026-03-01' }), HOJE)).toBe('filhote')
  })

  it('faz o cão grande envelhecer antes do pequeno', () => {
    /**
     * Mesma data de nascimento, oito anos: gigante já é idoso, mini ainda é adulto. É o dado
     * que mais surpreende quem vem da medicina humana, e o motivo de a faixa etária depender
     * do porte.
     */
    const nascimento = '2018-08-31'

    expect(faixaEtariaDoPaciente(pet({ nascimento, porte: 'gigante' }), HOJE)).toBe('idoso')
    expect(faixaEtariaDoPaciente(pet({ nascimento, porte: 'mini' }), HOJE)).toBe('adulto')
  })

  it('devolve nulo quando o nascimento é desconhecido', () => {
    /**
     * Resultado legítimo, não falha: marcar consulta por telefone quase nunca tem a data
     * exata, e chutar "adulto" julgaria um filhote pela régua de um adulto.
     */
    expect(faixaEtariaDoPaciente(pet({ nascimento: null }), HOJE)).toBeNull()
  })

  it('conta idade em meses sem passar do dia do aniversário', () => {
    expect(idadeEmMeses('2026-07-31', '2026-08-30')).toBe(0)
    expect(idadeEmMeses('2026-07-31', '2026-08-31')).toBe(1)
  })
})

describe('encontrarFaixa', () => {
  const fc = (qualificadores: Parameters<typeof encontrarFaixa>[3]) =>
    encontrarFaixa(referenceRangesFixture, 'frequenciaCardiaca', 'canina', qualificadores)

  it('cai na faixa da espécie quando não há qualificador', () => {
    const faixa = fc({})

    expect(faixa).not.toBeNull()
    expect(faixa?.porte).toBeUndefined()
    expect(faixa?.faixaEtaria).toBeUndefined()
  })

  it('prefere a faixa do porte à da espécie', () => {
    expect(fc({ porte: 'gigante' })?.porte).toBe('gigante')
    expect(fc({ porte: 'mini' })?.porte).toBe('mini')
  })

  it('prefere porte mais idade quando as duas casam', () => {
    const faixa = fc({ porte: 'grande', faixaEtaria: 'filhote' })

    expect(faixa?.porte).toBe('grande')
    expect(faixa?.faixaEtaria).toBe('filhote')
  })

  it('nunca devolve faixa de um porte que não é o do paciente', () => {
    /**
     * Existe faixa de porte grande + filhote. Para um filhote **mini** ela contradiz o
     * paciente e precisa ser descartada, mesmo sendo a mais específica da tabela.
     */
    const faixa = fc({ porte: 'mini', faixaEtaria: 'filhote' })

    expect(faixa?.porte).not.toBe('grande')
    expect(faixa?.porte).toBe('mini')
    expect(faixa?.faixaEtaria).toBe('filhote')
  })

  it('todo filhote canino tem faixa que reconhece que ele é filhote', () => {
    /**
     * Este teste guarda uma armadilha de catálogo, não de código.
     *
     * O porte pesa mais que a idade no desempate. Se faltar a combinação porte + filhote para
     * algum porte, o filhote daquele porte cai na faixa do **adulto** do mesmo porte — e
     * passa a ser julgado por uma régua que não é a dele, sem erro nenhum na tela. Cobrir os
     * cinco portes é o que impede isso.
     */
    const portes = ['mini', 'pequeno', 'medio', 'grande', 'gigante'] as const

    for (const porte of portes) {
      const faixa = fc({ porte, faixaEtaria: 'filhote' })

      expect(faixa?.faixaEtaria, `porte ${porte}`).toBe('filhote')
    }
  })

  it('devolve nulo para vital sem faixa cadastrada na espécie', () => {
    expect(encontrarFaixa(referenceRangesFixture, 'pressaoSistolica', 'reptil')).toBeNull()
  })
})

describe('o efeito clínico da qualificação', () => {
  /** 140 bpm: o mesmo número, dois julgamentos, porque os pacientes são diferentes. */
  const medicao = { valor: 140, naoAferido: false }

  function faixaPara(alvo: Pet): ReferenceRange | null {
    return encontrarFaixa(referenceRangesFixture, 'frequenciaCardiaca', alvo.especie, {
      porte: porteDoPaciente(alvo),
      faixaEtaria: faixaEtariaDoPaciente(alvo, HOJE),
    })
  }

  it('140 bpm é normal no cão mini e alto no gigante', () => {
    const yorkshire = pet({ porte: 'mini', pesoKg: 3, nascimento: '2020-08-31' })
    const saoBernardo = pet({ porte: 'gigante', pesoKg: 70, nascimento: '2022-08-31' })

    expect(statusDaMedicao(medicao, faixaPara(yorkshire))).toBe('dentro')
    expect(statusDaMedicao(medicao, faixaPara(saoBernardo))).toBe('acima')
  })

  it('a faixa geral da espécie não distinguiria os dois', () => {
    /** A prova de que o recorte por porte é o que faz o destaque funcionar. */
    const geral = encontrarFaixa(referenceRangesFixture, 'frequenciaCardiaca', 'canina')

    expect(statusDaMedicao(medicao, geral)).toBe('dentro')
  })
})
