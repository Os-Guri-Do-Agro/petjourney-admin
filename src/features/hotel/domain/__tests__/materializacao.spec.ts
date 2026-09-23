/**
 * A fronteira de materialização.
 *
 * O que estes testes guardam é uma frase só — **o passado não se reescreve** — e ela vale dinheiro:
 * é o registro de quem serviu, a que horas, para qual animal. Um defeito aqui não quebra a tela;
 * apaga a prova de que a casa fez o trabalho.
 */
import { describe, expect, it } from 'vitest'

import type { ISODateTime, TarefaDeRotina, TarefaKind, TarefaStatus } from '../../data/types'
import {
  chaveDaTarefa,
  conflitosReais,
  particionarPorImutabilidade,
  reconciliarDia,
} from '../materializacao'
import type { TarefaPlanejada } from '../rotina'

const AGORA = '2026-09-22T15:00:00-03:00' as ISODateTime

const DIA = '2026-09-22'

/** Uma hora do dia da fixture, como instante. */
const em = (hora: string) => `${DIA}T${hora}:00-03:00` as ISODateTime

function tarefa(over: Partial<TarefaDeRotina> & { previstaPara: ISODateTime }): TarefaDeRotina {
  return {
    id: `t-${over.kind ?? 'agua'}-${over.previstaPara}-${over.hospedagemId ?? 'h1'}`,
    hospedagemId: 'h1',
    kind: 'agua' as TarefaKind,
    descricao: '',
    origemId: null,
    status: 'pendente' as TarefaStatus,
    executadaEm: null,
    executadaPor: null,
    turnoId: null,
    observacao: '',
    ...over,
  }
}

function planejada(over: Partial<TarefaPlanejada> & { previstaPara: ISODateTime }): TarefaPlanejada {
  return {
    hospedagemId: 'h1',
    kind: 'agua' as TarefaKind,
    descricao: '',
    origemId: null,
    ...over,
  }
}

describe('chaveDaTarefa', () => {
  it('distingue duas medicações diferentes no mesmo instante', () => {
    /* Sem `origemId` na chave, uma dose engoliria a outra — e o animal tomaria só um dos remédios. */
    const uma = tarefa({ kind: 'medicacao', previstaPara: em('08:00'), origemId: 'med-a' })
    const outra = tarefa({ kind: 'medicacao', previstaPara: em('08:00'), origemId: 'med-b' })

    expect(chaveDaTarefa(uma)).not.toBe(chaveDaTarefa(outra))
  })

  it('não depende do id: a mesma tarefa gerada duas vezes tem a mesma chave', () => {
    const primeira = tarefa({ previstaPara: em('07:00') })
    const segunda = { ...primeira, id: 'outro-id-qualquer' }

    expect(chaveDaTarefa(segunda)).toBe(chaveDaTarefa(primeira))
  })
})

describe('particionarPorImutabilidade', () => {
  it('a tarefa já feita nunca é retirável', () => {
    const feita = tarefa({
      previstaPara: em('18:00'),
      status: 'feita',
      executadaEm: em('18:04'),
      executadaPor: 'cuidador-1',
    })

    expect(particionarPorImutabilidade([feita], AGORA).retiraveis).toEqual([])
  })

  it('a atrasada fica: apagá-la esconderia a dívida do turno', () => {
    /* Pendente, mas com a hora já vencida. É o caso que mais se esquece e o mais caro. */
    const atrasada = tarefa({ previstaPara: em('09:00') })

    const { retiraveis, historia } = particionarPorImutabilidade([atrasada], AGORA)

    expect(retiraveis).toEqual([])
    expect(historia).toEqual([atrasada])
  })

  it('a que nasceu de um registro fica, mesmo pendente e futura', () => {
    const dose = tarefa({ kind: 'medicacao', previstaPara: em('20:00'), origemId: 'med-a' })
    const banho = tarefa({ kind: 'banho', previstaPara: em('16:00'), origemId: 'serv-banho' })

    expect(particionarPorImutabilidade([dose, banho], AGORA).retiraveis).toEqual([])
  })

  it('refeição nunca é retirável: o horário é do responsável, não da casa', () => {
    const refeicao = tarefa({ kind: 'refeicao', previstaPara: em('19:00') })

    expect(particionarPorImutabilidade([refeicao], AGORA).retiraveis).toEqual([])
  })

  it('a água pendente de mais tarde é retirável', () => {
    const futura = tarefa({ previstaPara: em('18:00') })

    expect(particionarPorImutabilidade([futura], AGORA).retiraveis).toEqual([futura])
  })
})

describe('reconciliarDia', () => {
  it('trocar o plano inteiro não toca no que já foi executado', () => {
    /*
     * O teste que fecha a questão. Vinte tarefas no dia, doze marcadas com executor e hora; o
     * plano é substituído por outro sem um único horário em comum. As doze precisam sair do outro
     * lado com o mesmo id, o mesmo executor, a mesma hora de execução e a mesma descrição.
     */
    const horas = ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '16:00']

    const existentes = [
      ...horas.map((hora, indice) =>
        tarefa({
          previstaPara: em(hora),
          status: indice < 6 ? 'feita' : 'pendente',
          executadaEm: indice < 6 ? em(hora) : null,
          executadaPor: indice < 6 ? `cuidador-${indice}` : null,
          descricao: `água ${hora}`,
        }),
      ),
      ...horas.map((hora, indice) =>
        tarefa({
          kind: 'higiene',
          previstaPara: em(hora),
          status: indice < 6 ? 'feita' : 'pendente',
          executadaEm: indice < 6 ? em(hora) : null,
          executadaPor: indice < 6 ? `cuidador-${indice}` : null,
          descricao: `higiene ${hora}`,
        }),
      ),
    ]

    const executadas = existentes.filter((item) => item.status === 'feita')

    expect(executadas).toHaveLength(12)

    /* Um plano sem nenhum horário em comum com o anterior. */
    const plano = ['19:00', '20:00', '21:00'].map((hora) => planejada({ previstaPara: em(hora) }))

    const { preservadas, retirar } = reconciliarDia({ existentes, planejadas: plano, agora: AGORA })

    for (const antes of executadas) {
      const depois = preservadas.find((item) => item.id === antes.id)

      expect(depois, `a tarefa ${antes.id} sumiu`).toBeDefined()
      expect(depois).toEqual(antes)
    }

    /* E nenhuma delas entrou na lista de retirada. */
    const idsRetirados = new Set(retirar.map((item) => item.id))

    for (const antes of executadas) {
      expect(idsRetirados.has(antes.id)).toBe(false)
    }
  })

  it('não cria nada no passado', () => {
    /* O remédio registrado às 15h40 com horários 08:00 e 20:00: nasce a das 20:00, não a das 08:00. */
    const plano = [
      planejada({ kind: 'medicacao', previstaPara: em('08:00'), origemId: 'med-a' }),
      planejada({ kind: 'medicacao', previstaPara: em('20:00'), origemId: 'med-a' }),
    ]

    const { criar } = reconciliarDia({ existentes: [], planejadas: plano, agora: AGORA })

    expect(criar.map((item) => item.previstaPara)).toEqual([em('20:00')])
  })

  it('reexecutar não duplica nada', () => {
    const plano = [planejada({ previstaPara: em('18:00') }), planejada({ previstaPara: em('22:00') })]

    const primeira = reconciliarDia({ existentes: [], planejadas: plano, agora: AGORA })

    expect(primeira.criar).toHaveLength(2)

    /* O que a primeira criou, materializado, entra como existente na segunda. */
    const materializadas = primeira.criar.map((item) => tarefa({ ...item }))

    const segunda = reconciliarDia({ existentes: materializadas, planejadas: plano, agora: AGORA })

    expect(segunda.criar).toEqual([])
    expect(segunda.retirar).toEqual([])
  })

  it('publicar não toca em serviço vendido', () => {
    const banho = tarefa({ kind: 'banho', previstaPara: em('16:00'), origemId: 'serv-banho' })

    /* O plano da casa não prevê banho nenhum — e mesmo assim o banho pago sobrevive. */
    const { retirar, preservadas } = reconciliarDia({
      existentes: [banho],
      planejadas: [planejada({ previstaPara: em('18:00') })],
      agora: AGORA,
    })

    expect(retirar).toEqual([])
    expect(preservadas).toContainEqual(banho)
  })

  it('retira só o futuro intocado que o plano novo não prevê mais', () => {
    const some = tarefa({ previstaPara: em('18:00') })
    const fica = tarefa({ previstaPara: em('22:00') })

    const { retirar, criar } = reconciliarDia({
      existentes: [some, fica],
      planejadas: [planejada({ previstaPara: em('22:00') }), planejada({ previstaPara: em('23:00') })],
      agora: AGORA,
    })

    expect(retirar).toEqual([some])
    expect(criar.map((item) => item.previstaPara)).toEqual([em('23:00')])
  })
})

describe('conflitosReais', () => {
  it('duas doses do mesmo remédio no mesmo instante são conflito', () => {
    const uma = tarefa({ kind: 'medicacao', previstaPara: em('20:00'), origemId: 'med-a' })
    const outra = { ...uma, id: 'outra' }

    expect(conflitosReais([uma, outra])).toHaveLength(1)
  })

  it('refeição e água no mesmo horário não são conflito: é a ronda funcionando', () => {
    const refeicao = tarefa({ kind: 'refeicao', previstaPara: em('07:00') })
    const agua = tarefa({ kind: 'agua', previstaPara: em('07:00') })

    expect(conflitosReais([refeicao, agua])).toEqual([])
  })

  it('a mesma hora em animais diferentes não é conflito', () => {
    const um = tarefa({ previstaPara: em('07:00'), hospedagemId: 'h1' })
    const outro = tarefa({ previstaPara: em('07:00'), hospedagemId: 'h2' })

    expect(conflitosReais([um, outro])).toEqual([])
  })
})
