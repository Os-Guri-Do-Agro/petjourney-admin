/**
 * Motor de recall de vacinação.
 *
 * É a conta que transforma vacinação em recorrência — "quem eu chamo esta semana" —, e por isso
 * o modo de falhar dela é comercial, não visual: uma regra errada aqui não quebra tela nenhuma,
 * só faz a clínica deixar de ligar para quem deveria.
 */

import { describe, expect, it } from 'vitest'

import type { AplicacaoVacina, Vacina } from '../../data/types'
import { addDays } from '../clinic-time'
import {
  JANELA_DE_AVISO_EM_DIAS,
  listaDeChamada,
  proximaDose,
  reforcosDoPaciente,
  situacaoDoReforco,
} from '../vacinacao'

const HOJE = '2026-09-02'

const V10: Vacina = {
  id: 'vac-v10',
  nome: 'V10',
  fabricante: 'Zoetis',
  especies: ['canina'],
  dosesNaSerie: 3,
  intervaloReforcoDias: 365,
  obrigatoria: false,
}

const ANTIRRABICA: Vacina = {
  id: 'vac-antirrabica-canina',
  nome: 'Antirrábica',
  fabricante: 'Boehringer',
  especies: ['canina', 'felina'],
  dosesNaSerie: 1,
  intervaloReforcoDias: 365,
  obrigatoria: true,
}

function aplicacao(patch: Partial<AplicacaoVacina> = {}): AplicacaoVacina {
  return {
    id: 'apl-1',
    petId: 'pet-luna',
    vacinaId: 'vac-v10',
    professionalId: 'prof-ana',
    aplicadaEm: `${HOJE}T10:00:00-04:00`,
    lote: 'L2026-A',
    validadeLote: '2027-06-30',
    dose: 1,
    via: 'subcutanea',
    proximaDoseEm: addDays(HOJE, 28),
    observacao: '',
    ...patch,
  }
}

describe('proximaDose', () => {
  it('usa o intervalo curto dentro da série inicial', () => {
    /** Filhote na 1ª de 3: volta em ~28 dias, não daqui a um ano. */
    expect(proximaDose(V10, 1, HOJE)).toBe(addDays(HOJE, 28))
    expect(proximaDose(V10, 2, HOJE)).toBe(addDays(HOJE, 28))
  })

  it('passa para o reforço anual quando a série fecha', () => {
    expect(proximaDose(V10, 3, HOJE)).toBe(addDays(HOJE, 365))
  })

  it('vacina de dose única já nasce anual', () => {
    expect(proximaDose(ANTIRRABICA, 1, HOJE)).toBe(addDays(HOJE, 365))
  })
})

describe('situacaoDoReforco', () => {
  it('marca vencido quando a data passou', () => {
    expect(situacaoDoReforco(addDays(HOJE, -1), HOJE, false)).toBe('vencido')
  })

  it('avisa dentro da janela', () => {
    expect(situacaoDoReforco(addDays(HOJE, JANELA_DE_AVISO_EM_DIAS - 1), HOJE, false)).toBe(
      'proximo',
    )
  })

  it('fica em dia fora da janela', () => {
    expect(situacaoDoReforco(addDays(HOJE, 200), HOJE, false)).toBe('em-dia')
  })

  it('série incompleta tem situação própria, mesmo com data distante', () => {
    /**
     * Um filhote que tomou a 1ª de 3 e sumiu não é "em dia" — é um caso perdido no meio da
     * série, e a clínica trata isso de forma diferente de um anual que vence em três semanas.
     */
    expect(situacaoDoReforco(addDays(HOJE, 200), HOJE, true)).toBe('serie-incompleta')
  })

  it('vencido vence série incompleta', () => {
    /** Já passou da data: isso é mais urgente que a informação de série aberta. */
    expect(situacaoDoReforco(addDays(HOJE, -5), HOJE, true)).toBe('vencido')
  })
})

describe('reforcosDoPaciente', () => {
  it('conta só a última aplicação de cada vacina', () => {
    /**
     * Sem isto, um paciente com três doses de V10 apareceria três vezes na lista de chamada —
     * uma por dose já tomada.
     */
    const pendentes = reforcosDoPaciente(
      [
        aplicacao({ id: 'a1', dose: 1, aplicadaEm: '2025-01-10T10:00:00-04:00' }),
        aplicacao({ id: 'a2', dose: 2, aplicadaEm: '2025-02-10T10:00:00-04:00' }),
        aplicacao({
          id: 'a3',
          dose: 3,
          aplicadaEm: '2025-03-10T10:00:00-04:00',
          proximaDoseEm: '2026-03-10',
        }),
      ],
      [V10],
      HOJE,
    )

    expect(pendentes).toHaveLength(1)
    expect(pendentes[0]?.doseSeguinte).toBeNull()
  })

  it('indica a dose seguinte quando a série está aberta', () => {
    const pendentes = reforcosDoPaciente([aplicacao({ dose: 1 })], [V10], HOJE)

    expect(pendentes[0]?.doseSeguinte).toBe(2)
    expect(pendentes[0]?.situacao).toBe('serie-incompleta')
  })

  it('ordena do mais atrasado para o menos', () => {
    const pendentes = reforcosDoPaciente(
      [
        aplicacao({ id: 'a1', vacinaId: 'vac-v10', dose: 3, proximaDoseEm: addDays(HOJE, 10) }),
        aplicacao({
          id: 'a2',
          vacinaId: 'vac-antirrabica-canina',
          dose: 1,
          proximaDoseEm: addDays(HOJE, -40),
        }),
      ],
      [V10, ANTIRRABICA],
      HOJE,
    )

    expect(pendentes[0]?.vacinaId).toBe('vac-antirrabica-canina')
  })

  it('ignora vacina que saiu do catálogo', () => {
    expect(reforcosDoPaciente([aplicacao({ vacinaId: 'sumiu' })], [V10], HOJE)).toEqual([])
  })
})

describe('listaDeChamada', () => {
  it('deixa de fora quem está em dia', () => {
    /** Lista de chamada com todo mundo é lista que ninguém abre. */
    const pendentes = reforcosDoPaciente(
      [aplicacao({ dose: 3, proximaDoseEm: addDays(HOJE, 300) })],
      [V10],
      HOJE,
    )

    expect(pendentes[0]?.situacao).toBe('em-dia')
    expect(listaDeChamada(pendentes)).toEqual([])
  })
})
