/**
 * A ordem de andar a casa.
 *
 * O que estes testes guardam não é "a função ordena": é que ela ordena pelas duas coisas que a
 * pessoa de fato usa para andar — o bloco primeiro, o número da acomodação depois — e que nenhuma
 * tarefa se perde no caminho, que é o único erro aqui que custa um animal sem comer.
 */
import { describe, expect, it } from 'vitest'

import { agruparPelaCasa } from '../ronda-ordem'

type Linha = { id: string; blocoId: string; acomodacaoNome: string }

const BLOCOS = new Map([
  ['gatil', { nome: 'Gatil', ordem: 3 }],
  ['canil-a', { nome: 'Canil A', ordem: 1 }],
  ['canil-b', { nome: 'Canil B', ordem: 2 }],
])

const linha = (id: string, blocoId: string, acomodacaoNome: string): Linha => ({
  id,
  blocoId,
  acomodacaoNome,
})

describe('agruparPelaCasa', () => {
  it('põe os blocos na ordem física da casa, e não na ordem em que chegaram', () => {
    const grupos = agruparPelaCasa(
      [linha('1', 'gatil', 'Gatil G1'), linha('2', 'canil-b', 'Baia B1'), linha('3', 'canil-a', 'Baia A1')],
      BLOCOS,
    )

    expect(grupos.map((grupo) => grupo.nome)).toEqual(['Canil A', 'Canil B', 'Gatil'])
  })

  it('ordena a acomodação pelo número, não pelo texto', () => {
    /* Sem comparação numérica, "Baia A10" viria antes de "Baia A2" — e o corredor sai fora de ordem. */
    const grupos = agruparPelaCasa(
      [
        linha('1', 'canil-a', 'Baia A10'),
        linha('2', 'canil-a', 'Baia A2'),
        linha('3', 'canil-a', 'Baia A1'),
      ],
      BLOCOS,
    )

    expect(grupos[0]!.linhas.map((item) => item.acomodacaoNome)).toEqual([
      'Baia A1',
      'Baia A2',
      'Baia A10',
    ])
  })

  it('não perde nenhuma linha', () => {
    const entrada = [
      linha('1', 'canil-a', 'Baia A1'),
      linha('2', 'gatil', 'Gatil G1'),
      linha('3', 'desconhecido', 'Sala X'),
      linha('4', 'canil-a', 'Baia A2'),
    ]

    const ids = agruparPelaCasa(entrada, BLOCOS)
      .flatMap((grupo) => grupo.linhas)
      .map((item) => item.id)

    expect([...ids].sort()).toEqual(['1', '2', '3', '4'])
  })

  it('manda o bloco desconhecido para o fim, e não para a frente do primeiro canil', () => {
    const grupos = agruparPelaCasa(
      [linha('1', 'fantasma', 'Sala X'), linha('2', 'canil-a', 'Baia A1')],
      BLOCOS,
    )

    expect(grupos.map((grupo) => grupo.blocoId)).toEqual(['canil-a', 'fantasma'])
    expect(grupos[grupos.length - 1]!.nome).toBe('')
  })

  it('numa casa que nunca preencheu a ordem, desempata pelo nome do bloco', () => {
    /* Todos em zero: sem desempate a ordem viraria a de inserção, que é a de criação dos registros. */
    const semOrdem = new Map([
      ['gatil', { nome: 'Gatil', ordem: 0 }],
      ['canil', { nome: 'Canil', ordem: 0 }],
    ])

    const grupos = agruparPelaCasa(
      [linha('1', 'gatil', 'Gatil G1'), linha('2', 'canil', 'Baia A1')],
      semOrdem,
    )

    expect(grupos.map((grupo) => grupo.nome)).toEqual(['Canil', 'Gatil'])
  })
})
