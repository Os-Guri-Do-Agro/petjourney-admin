/**
 * O protocolo do paciente: a sequência inteira, e onde ele está nela.
 *
 * As três regras que fazem o plano servir para o filhote e não atrapalhar o adulto — série pela
 * idade em que começou, idade mínima que não é atraso, opcional que não é pendência — e a regra
 * que o faz concordar com o app: atraso só depois da carência.
 */

import { describe, expect, it } from 'vitest'

import { vacinasFixture } from '../../data/fixtures/vacinas'
import type { AplicacaoVacina, Pet } from '../../data/types'
import { addDays } from '../clinic-time'
import {
  doseSeguinte,
  LIMITE_DA_SERIE_DE_FILHOTE_EM_DIAS,
  montarPlanoVacinal,
  planoDaVacina,
  tipoDeSerie,
} from '../protocolo-vacinal'
import { CARENCIA_DE_ATRASO_EM_DIAS, proximaDose } from '../vacinacao'

const HOJE = '2026-09-29'
const V10 = vacinasFixture.find((item) => item.id === 'vac-v10')!
const ANTIRRABICA = vacinasFixture.find((item) => item.id === 'vac-antirrabica-canina')!
const GIARDIA = vacinasFixture.find((item) => item.id === 'vac-giardia')!

function filhote(diasDeVida: number): Pick<Pet, 'id' | 'especie' | 'nascimento'> {
  return { id: 'pet-filhote', especie: 'canina', nascimento: addDays(HOJE, -diasDeVida) }
}

function aplicacao(patch: Partial<AplicacaoVacina> & { em: string }): AplicacaoVacina {
  const { em, ...resto } = patch
  const dose = resto.dose ?? 1
  const dosesNaSerie = resto.dosesNaSerie ?? 3

  return {
    id: `apl-${em}-${dose}`,
    petId: 'pet-filhote',
    vacinaId: 'vac-v10',
    origem: 'clinica',
    professionalId: 'prof-ana',
    aplicadaEm: `${em}T10:00:00-04:00`,
    lote: 'V10-A',
    validadeLote: '2027-06-30',
    dose,
    dosesNaSerie,
    via: 'subcutanea',
    proximaDoseEm: proximaDose(V10, dose, em, dosesNaSerie),
    agendamentoDaProximaId: null,
    encounterId: null,
    externa: null,
    observacao: '',
    ...resto,
  }
}

describe('a série depende da idade em que começou', () => {
  it('antes de dezesseis semanas é de filhote; depois, de adulto', () => {
    const nascimento = addDays(HOJE, -100)

    expect(tipoDeSerie(nascimento, HOJE)).toBe('filhote')
    expect(tipoDeSerie(nascimento, addDays(nascimento, LIMITE_DA_SERIE_DE_FILHOTE_EM_DIAS))).toBe(
      'adulto',
    )
  })

  it('sem nascimento, adulto — a série mais curta', () => {
    expect(tipoDeSerie(null, HOJE)).toBe('adulto')
  })

  it('a nova série sai do tamanho da idade de hoje', () => {
    expect(doseSeguinte(V10, addDays(HOJE, -60), [], HOJE)).toEqual({
      dose: 1,
      total: 3,
      tipo: 'filhote',
      reforco: false,
    })
    expect(doseSeguinte(V10, addDays(HOJE, -800), [], HOJE)).toEqual({
      dose: 1,
      total: 2,
      tipo: 'adulto',
      reforco: false,
    })
  })

  it('a série aberta continua com o tamanho congelado, mesmo que o animal tenha crescido', () => {
    /* Começou filhote há quatro meses: hoje é adulto, mas a série dele continua sendo de três. */
    const nascimento = addDays(HOJE, -200)
    const primeira = aplicacao({ em: addDays(HOJE, -150), dose: 1, dosesNaSerie: 3 })

    expect(doseSeguinte(V10, nascimento, [primeira], HOJE)).toMatchObject({
      dose: 2,
      total: 3,
      tipo: 'filhote',
    })
  })

  it('série fechada: a próxima é reforço', () => {
    const fechada = aplicacao({ em: addDays(HOJE, -300), dose: 3, dosesNaSerie: 3 })

    expect(doseSeguinte(V10, addDays(HOJE, -900), [fechada], HOJE)).toMatchObject({
      reforco: true,
      total: 3,
    })
  })
})

describe('onde o filhote está na sequência', () => {
  it('mostra a série inteira, marca a dose da vez e fecha com o reforço', () => {
    const plano = planoDaVacina({
      vacina: V10,
      nascimento: addDays(HOJE, -80),
      aplicacoes: [aplicacao({ em: addDays(HOJE, -28), dose: 1 })],
      agendamentos: [],
      hoje: HOJE,
    })!

    expect(plano.doses.map((dose) => [dose.tipo, dose.numero, dose.estado])).toEqual([
      ['serie', 1, 'aplicada'],
      ['serie', 2, 'devida'],
      ['serie', 3, 'prevista'],
      ['reforco', 3, 'prevista'],
    ])
    expect(plano.proxima?.numero).toBe(2)
    expect(plano.situacao).toBe('devida')
    /* A terceira cai 28 dias depois da segunda prevista; o reforço, um ano depois da terceira. */
    expect(plano.doses[2]?.em).toBe(addDays(HOJE, 28))
    expect(plano.doses[3]?.em).toBe(addDays(HOJE, 28 + 365))
  })

  it('a dose de fora conta para a posição', () => {
    const plano = planoDaVacina({
      vacina: V10,
      nascimento: addDays(HOJE, -80),
      aplicacoes: [
        aplicacao({
          em: addDays(HOJE, -28),
          dose: 1,
          origem: 'externa',
          professionalId: '',
          lote: null,
          validadeLote: null,
        }),
      ],
      agendamentos: [],
      hoje: HOJE,
    })!

    expect(plano.aplicadasNaSerie).toBe(1)
    expect(plano.proxima?.numero).toBe(2)
  })

  it('a dose marcada na agenda aparece como marcada — a cancelada, não', () => {
    const primeira = aplicacao({
      em: addDays(HOJE, -10),
      dose: 1,
      agendamentoDaProximaId: 'apt-1',
    })
    const entrada = {
      vacina: V10,
      nascimento: addDays(HOJE, -60),
      aplicacoes: [primeira],
      hoje: HOJE,
    }
    const inicio = `${addDays(HOJE, 18)}T09:30:00-04:00`

    expect(
      planoDaVacina({ ...entrada, agendamentos: [{ id: 'apt-1', inicio, cancelado: false }] })
        ?.proxima?.agendamento,
    ).toEqual({ id: 'apt-1', inicio })
    expect(
      planoDaVacina({ ...entrada, agendamentos: [{ id: 'apt-1', inicio, cancelado: true }] })
        ?.proxima?.agendamento,
    ).toBeNull()
  })
})

describe('atraso é o mesmo dos dois lados', () => {
  function comProximaEm(dias: number) {
    return planoDaVacina({
      vacina: ANTIRRABICA,
      nascimento: addDays(HOJE, -900),
      aplicacoes: [
        aplicacao({
          em: addDays(HOJE, -365 + dias),
          vacinaId: ANTIRRABICA.id,
          dose: 1,
          dosesNaSerie: 1,
          proximaDoseEm: addDays(HOJE, dias),
        }),
      ],
      agendamentos: [],
      hoje: HOJE,
    })!
  }

  it('dentro da carência a dose é de hoje, não atrasada', () => {
    expect(comProximaEm(0).situacao).toBe('devida')
    expect(comProximaEm(-(CARENCIA_DE_ATRASO_EM_DIAS - 1)).situacao).toBe('devida')
  })

  it('passada a carência, atrasada', () => {
    expect(comProximaEm(-CARENCIA_DE_ATRASO_EM_DIAS).situacao).toBe('atrasada')
  })

  it('a menos de um mês, a vencer; mais longe, em dia', () => {
    expect(comProximaEm(20).situacao).toBe('a-vencer')
    expect(comProximaEm(120).situacao).toBe('em-dia')
  })
})

describe('o plano do paciente', () => {
  it('antes da idade mínima a dose aguarda — não está pendente nem atrasada', () => {
    const plano = montarPlanoVacinal({
      pet: filhote(60),
      vacinas: vacinasFixture,
      aplicacoes: [],
      agendamentos: [],
      hoje: HOJE,
    })
    const antirrabica = plano.vacinas.find((item) => item.vacina.id === ANTIRRABICA.id)!

    expect(antirrabica.situacao).toBe('aguarda-idade')
    expect(antirrabica.proxima?.em).toBe(addDays(HOJE, ANTIRRABICA.idadeMinimaDias - 60))
    expect(plano.atrasadas).toBe(0)
  })

  it('essencial que ninguém começou entra; opcional fica recolhida', () => {
    const plano = montarPlanoVacinal({
      pet: filhote(70),
      vacinas: vacinasFixture,
      aplicacoes: [],
      agendamentos: [],
      hoje: HOJE,
    })

    expect(plano.vacinas.map((item) => item.vacina.id)).toContain(V10.id)
    expect(plano.vacinas.map((item) => item.vacina.id)).not.toContain(GIARDIA.id)
    expect(plano.opcionaisNaoIniciadas.map((item) => item.id)).toContain(GIARDIA.id)
    /* Nunca começou não é atraso: não há data prevista que tenha passado. */
    expect(plano.vacinas.find((item) => item.vacina.id === V10.id)?.situacao).toBe('nao-iniciada')
  })

  it('opcional iniciada entra no plano', () => {
    const plano = montarPlanoVacinal({
      pet: filhote(90),
      vacinas: vacinasFixture,
      aplicacoes: [
        aplicacao({ em: addDays(HOJE, -20), vacinaId: GIARDIA.id, dose: 1, dosesNaSerie: 2 }),
      ],
      agendamentos: [],
      hoje: HOJE,
    })

    expect(plano.vacinas.map((item) => item.vacina.id)).toContain(GIARDIA.id)
    expect(plano.opcionaisNaoIniciadas.map((item) => item.id)).not.toContain(GIARDIA.id)
  })

  it('só vacinas da espécie: gato não tem V10 no plano', () => {
    const plano = montarPlanoVacinal({
      pet: { id: 'gato', especie: 'felina', nascimento: addDays(HOJE, -900) },
      vacinas: vacinasFixture,
      aplicacoes: [],
      agendamentos: [],
      hoje: HOJE,
    })

    expect(plano.vacinas.map((item) => item.vacina.id)).not.toContain(V10.id)
  })

  it('o que pede ação vem primeiro', () => {
    const plano = montarPlanoVacinal({
      pet: filhote(900),
      vacinas: vacinasFixture,
      aplicacoes: [
        aplicacao({ em: addDays(HOJE, -100), dose: 3, dosesNaSerie: 3 }),
        aplicacao({
          em: addDays(HOJE, -400),
          vacinaId: ANTIRRABICA.id,
          dose: 1,
          dosesNaSerie: 1,
          proximaDoseEm: addDays(HOJE, -35),
        }),
      ],
      agendamentos: [],
      hoje: HOJE,
    })

    expect(plano.vacinas[0]?.vacina.id).toBe(ANTIRRABICA.id)
    expect(plano.atrasadas).toBe(1)
  })
})
