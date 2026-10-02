/**
 * Vacinação no dataset.
 *
 * A lista de chamada é argumento de venda: ela precisa abrir com **as quatro situações
 * representadas**, senão a tela mostra uma pilha só e não há o que apontar numa demonstração.
 * Nada disso quebra a tela se sumir — só esvazia o argumento, em silêncio.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { createClinicClock } from '../../domain/clinic-time'
import { reforcosDoPaciente } from '../../domain/vacinacao'
import { CLINIC_UTC_OFFSET, vacinasFixture } from '../fixtures'
import { getDataset, resetDataset } from '../store'

const clock = createClinicClock(CLINIC_UTC_OFFSET)

function situacoesNoDataset() {
  const dataset = getDataset()
  const hoje = clock.today()
  const porPet = new Map<string, typeof dataset.aplicacoesDeVacina>()

  for (const aplicacao of dataset.aplicacoesDeVacina) {
    porPet.set(aplicacao.petId, [...(porPet.get(aplicacao.petId) ?? []), aplicacao])
  }

  return [...porPet.values()]
    .flatMap((aplicacoes) => reforcosDoPaciente(aplicacoes, vacinasFixture, hoje))
    .map((item) => item.situacao)
}

describe('dataset de vacinação', () => {
  beforeEach(() => {
    resetDataset()
  })

  it('tem aplicações registradas', () => {
    expect(getDataset().aplicacoesDeVacina.length).toBeGreaterThan(0)
  })

  it('cobre as quatro situações da lista de chamada', () => {
    /** Sem um caso de cada, a tela de recall abre com uma pilha e o argumento some. */
    const situacoes = new Set(situacoesNoDataset())

    expect(situacoes.has('vencido'), 'vencido').toBe(true)
    expect(situacoes.has('proximo'), 'a vencer').toBe(true)
    expect(situacoes.has('serie-incompleta'), 'série aberta').toBe(true)
    expect(situacoes.has('em-dia'), 'em dia').toBe(true)
  })

  it('toda aplicação aponta para vacina do catálogo', () => {
    const ids = new Set(vacinasFixture.map((vacina) => vacina.id))

    for (const aplicacao of getDataset().aplicacoesDeVacina) {
      expect(ids.has(aplicacao.vacinaId), aplicacao.vacinaId).toBe(true)
    }
  })

  it('a vacina aplicada é compatível com a espécie do paciente', () => {
    /** Gato não toma V10. Um dataset que erra isso ensina a tela a oferecer errado. */
    const dataset = getDataset()

    for (const aplicacao of dataset.aplicacoesDeVacina) {
      const pet = dataset.pets.find((item) => item.id === aplicacao.petId)
      const vacina = vacinasFixture.find((item) => item.id === aplicacao.vacinaId)

      expect(pet, aplicacao.petId).toBeDefined()
      expect(vacina!.especies).toContain(pet!.especie)
    }
  })

  it('toda aplicação da clínica tem lote e validade', () => {
    /** Sem os dois, o comprovante volta a não servir para viagem — que é para o que ele existe. */
    const daClinica = getDataset().aplicacoesDeVacina.filter((item) => item.origem === 'clinica')

    for (const aplicacao of daClinica) {
      expect(aplicacao.lote?.length ?? 0, aplicacao.id).toBeGreaterThan(0)
      expect(aplicacao.validadeLote, aplicacao.id).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('a dose externa não tem lote, e diz onde foi e como a clínica sabe', () => {
    const externas = getDataset().aplicacoesDeVacina.filter((item) => item.origem === 'externa')
    const procedencias = new Set(externas.map((item) => item.externa?.procedencia))

    /* Os dois jeitos de saber precisam existir na demonstração: é a diferença que ela mostra. */
    expect(procedencias.has('comprovante')).toBe(true)
    expect(procedencias.has('relato')).toBe(true)

    for (const aplicacao of externas) {
      expect(aplicacao.lote, aplicacao.id).toBeNull()
      expect(aplicacao.validadeLote, aplicacao.id).toBeNull()
      expect(aplicacao.professionalId, aplicacao.id).toBe('')
    }
  })

  it('o tamanho da série vai congelado em cada aplicação', () => {
    for (const aplicacao of getDataset().aplicacoesDeVacina) {
      expect(aplicacao.dosesNaSerie, aplicacao.id).toBeGreaterThanOrEqual(1)
      expect(aplicacao.dose, aplicacao.id).toBeLessThanOrEqual(aplicacao.dosesNaSerie)
    }
  })

  it('existe paciente com alerta de medicação contínua', () => {
    /**
     * O terceiro alerta que o requisito da fundação nomeia, ao lado de alergia e comorbidade.
     * Sem um caso no dataset, o cabeçalho nunca o demonstra.
     */
    const comAlerta = getDataset().pets.filter((pet) =>
      pet.alertas.some((alerta) => alerta.kind === 'medicacao-continua'),
    )

    expect(comAlerta.length).toBeGreaterThan(0)
  })
})
