/**
 * Regra de ordenação da tabela clínica.
 *
 * As três coisas que `Array.prototype.sort` cru não entrega e que a tabela clínica cobra:
 * empate estável, vazio no fim das duas direções, e texto comparado por localidade.
 */

import { describe, expect, it } from 'vitest'

import { ordenarLinhas, proximaOrdenacao } from '../table-sort'

type Linha = { nome: string; faltas: number | null; ultima: string | null }

const LINHAS: Linha[] = [
  { nome: 'Bento', faltas: 1, ultima: '2026-01-10' },
  { nome: 'Ácaro', faltas: 3, ultima: null },
  { nome: 'Zeca', faltas: 1, ultima: '2026-02-01' },
  { nome: 'Ana', faltas: null, ultima: '2026-03-01' },
  { nome: 'Caio', faltas: 1, ultima: null },
]

describe('ordenarLinhas', () => {
  it('ordena número em ordem crescente e decrescente', () => {
    const asc = ordenarLinhas(LINHAS, (linha) => linha.faltas, 'asc', 'pt-BR')
    const desc = ordenarLinhas(LINHAS, (linha) => linha.faltas, 'desc', 'pt-BR')

    expect(asc.map((linha) => linha.faltas)).toEqual([1, 1, 1, 3, null])
    expect(desc.map((linha) => linha.faltas)).toEqual([3, 1, 1, 1, null])
  })

  it('mantém a ordem original entre empatados', () => {
    const asc = ordenarLinhas(LINHAS, (linha) => linha.faltas, 'asc', 'pt-BR')
    const empatados = asc.filter((linha) => linha.faltas === 1).map((linha) => linha.nome)

    /** Os três com uma falta chegaram nesta ordem e continuam nela. */
    expect(empatados).toEqual(['Bento', 'Zeca', 'Caio'])
  })

  it('inverter a direção não embaralha os empatados', () => {
    const desc = ordenarLinhas(LINHAS, (linha) => linha.faltas, 'desc', 'pt-BR')
    const empatados = desc.filter((linha) => linha.faltas === 1).map((linha) => linha.nome)

    expect(empatados).toEqual(['Bento', 'Zeca', 'Caio'])
  })

  it('joga o vazio para o fim nas duas direções', () => {
    const asc = ordenarLinhas(LINHAS, (linha) => linha.ultima, 'asc', 'pt-BR')
    const desc = ordenarLinhas(LINHAS, (linha) => linha.ultima, 'desc', 'pt-BR')

    /**
     * O ponto do teste: inverter a coluna não pode trazer os sem-valor para o topo, senão a
     * primeira tela vira uma lista de traços.
     */
    expect(asc.slice(-2).every((linha) => linha.ultima === null)).toBe(true)
    expect(desc.slice(-2).every((linha) => linha.ultima === null)).toBe(true)
  })

  it('compara texto acentuado como o português espera', () => {
    const asc = ordenarLinhas(LINHAS, (linha) => linha.nome, 'asc', 'pt-BR')

    /** Com `<` cru, "Ácaro" cairia depois de "Zeca" — o acento vale mais que o Z em UTF-16. */
    expect(asc.map((linha) => linha.nome)).toEqual(['Ácaro', 'Ana', 'Bento', 'Caio', 'Zeca'])
  })

  it('não altera o array recebido', () => {
    const copia = [...LINHAS]

    ordenarLinhas(LINHAS, (linha) => linha.nome, 'desc', 'pt-BR')

    expect(LINHAS).toEqual(copia)
  })
})

describe('proximaOrdenacao', () => {
  it('entra na coluna pela direção inicial dela', () => {
    expect(proximaOrdenacao({ coluna: null, direcao: 'asc' }, 'faltas', 'desc')).toEqual({
      coluna: 'faltas',
      direcao: 'desc',
    })
  })

  it('inverte no segundo clique', () => {
    expect(proximaOrdenacao({ coluna: 'faltas', direcao: 'desc' }, 'faltas', 'desc')).toEqual({
      coluna: 'faltas',
      direcao: 'asc',
    })
  })

  it('volta para a ordem de chegada no terceiro clique', () => {
    /**
     * O terceiro passo existe porque a ordem de chegada é significativa — a fila de espera
     * chega por prioridade e antiguidade, e sem este passo não haveria como voltar a ela.
     */
    expect(proximaOrdenacao({ coluna: 'faltas', direcao: 'asc' }, 'faltas', 'desc')).toEqual({
      coluna: null,
      direcao: 'desc',
    })
  })

  it('trocar de coluna recomeça o ciclo', () => {
    expect(proximaOrdenacao({ coluna: 'faltas', direcao: 'asc' }, 'nome', 'asc')).toEqual({
      coluna: 'nome',
      direcao: 'asc',
    })
  })
})
