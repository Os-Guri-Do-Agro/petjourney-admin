/**
 * Anamnese estruturada e linha do tempo, no dataset.
 *
 * Os dois casos que estes testes guardam são de **demonstração**, e o modo de falhar deles é
 * silencioso: se a pré-consulta deixar de ser plantada, o painel simplesmente não aparece; se
 * nenhuma internação existir, o filtro abre com uma opção a menos. Nos dois casos a tela
 * continua funcionando e a funcionalidade some sem erro nenhum.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { examCatalogFixture } from '../fixtures'
import { getDataset, resetDataset } from '../store'

describe('anamnese estruturada', () => {
  beforeEach(() => {
    resetDataset()
  })

  it('todo prontuário nasce com evolução e antecedentes', () => {
    const dataset = getDataset()

    expect(dataset.encounters.length).toBeGreaterThan(0)

    for (const encounter of dataset.encounters) {
      expect(encounter.anamnese).toHaveProperty('evolucao')
      expect(Array.isArray(encounter.anamnese.antecedentes)).toBe(true)
    }
  })

  it('há um prontuário com antecedente de medicação contínua', () => {
    /**
     * O antecedente que mais muda a prescrição. Sem um exemplo no dataset, a lista de
     * antecedentes seria demonstrada sempre vazia.
     */
    const comAntecedente = getDataset().encounters.find((encounter) =>
      encounter.anamnese.antecedentes.some((item) => item.kind === 'medicacao-continua'),
    )

    expect(comAntecedente).toBeDefined()
  })
})

describe('pré-consulta vinda do app', () => {
  beforeEach(() => {
    resetDataset()
  })

  it('existe um atendimento do dia com respostas do responsável', () => {
    const comPre = getDataset().encounters.find((encounter) => encounter.preConsulta !== null)

    expect(comPre).toBeDefined()
    expect(comPre!.preConsulta!.queixaPrincipal).not.toBe('')
  })

  it('a pré-consulta não preenche a anamnese sozinha', () => {
    /**
     * A regra que sustenta o componente: chega como sugestão, nunca como valor aplicado. Um
     * campo que já vem escrito é um campo que ninguém relê — e quem assina o prontuário é o
     * veterinário, não o responsável.
     */
    const comPre = getDataset().encounters.find((encounter) => encounter.preConsulta !== null)!

    expect(comPre.anamnese.queixaPrincipal).toBe('')
    expect(comPre.anamnese.evolucao).toBe('')
  })

  it('o atendimento de origem veio mesmo do app', () => {
    const dataset = getDataset()
    const comPre = dataset.encounters.find((encounter) => encounter.preConsulta !== null)!
    const appointment = dataset.appointments.find(
      (item) => item.id === comPre.preConsulta!.appointmentId,
    )

    expect(appointment?.origem).toBe('app')
  })
})

describe('linha do tempo', () => {
  beforeEach(() => {
    resetDataset()
  })

  it('inclui internações', () => {
    const internacoes = getDataset().timeline.filter((evento) => evento.kind === 'internacao')

    expect(internacoes.length).toBeGreaterThan(0)
  })

  it('toda internação cai num paciente que existe', () => {
    const dataset = getDataset()
    const ids = new Set(dataset.pets.map((pet) => pet.id))

    for (const evento of dataset.timeline.filter((item) => item.kind === 'internacao')) {
      expect(ids.has(evento.petId)).toBe(true)
    }
  })

  it('tem pelo menos três tipos distintos, para o filtro fazer sentido', () => {
    /** Filtro com uma ficha só não filtra nada — o componente o esconde nesse caso. */
    const tipos = new Set(getDataset().timeline.map((evento) => evento.kind))

    expect(tipos.size).toBeGreaterThanOrEqual(3)
  })
})

describe('conduta: exames solicitados', () => {
  beforeEach(() => {
    resetDataset()
  })

  it('guarda id do catálogo, nunca o nome do exame', () => {
    /**
     * Um caso plantado gravava `'Radiografia de quadril'` no lugar de
     * `'exame-raiox-quadril'`. O `MultiSelect` compara por id, não achava opção nenhuma e
     * desenhava **fichas vazias** — só o botão de remover, sem texto. Não quebrava nada, não
     * aparecia no console, e a tela ficava com dois chips fantasmas.
     */
    const dataset = getDataset()
    const idsValidos = new Set(examCatalogFixture.map((exame) => exame.id))

    for (const encounter of dataset.encounters) {
      for (const exame of encounter.conduta.examesSolicitados) {
        expect(idsValidos.has(exame), `exame "${exame}" fora do catálogo`).toBe(true)
      }
    }
  })
})
