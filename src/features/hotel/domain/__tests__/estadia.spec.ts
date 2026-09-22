/**
 * Regras R3 e R4 — o que trava o turno e o que trava o check-out.
 *
 * As duas só têm valor se forem **difíceis de contornar**. Um teste que apenas confirmasse que a
 * função devolve `true` não protegeria nada; o que está afirmado aqui é o contrário: os caminhos
 * pelos quais alguém passaria sem querer.
 */

import { describe, expect, it } from 'vitest'

import {
  boletimPodeSair,
  exigeContato,
  impedimentosDeSaida,
  ocorrenciasTravadas,
  perdeuPesoRelevante,
  pertencesPendentes,
  tomDaAdaptacao,
  noitesNaCasa,
  tomDaGravidade,
  variacaoDePeso,
} from '../estadia'
import type { Hospedagem, Ocorrencia, Pertence } from '../../data/types'

function ocorrencia(entrada: Partial<Ocorrencia> = {}): Ocorrencia {
  return {
    id: 'ocor-1',
    hospedagemId: 'hosp-1',
    kind: 'briga',
    gravidade: 'grave',
    descricao: '',
    conduta: '',
    registradaEm: '2026-06-10T15:00:00-04:00',
    registradaPor: 'eq-rafael',
    exigeContato: true,
    contatoEm: null,
    contatoPor: null,
    encaminhadaAoVeterinario: false,
    ...entrada,
  }
}

function pertence(entrada: Partial<Pertence> = {}): Pertence {
  return {
    id: 'pert-1',
    descricao: 'Coleira',
    quantidade: 1,
    devolvido: false,
    observacao: '',
    ...entrada,
  }
}

describe('R3 · ocorrência grave exige contato', () => {
  it('só a gravidade decide, e só "grave" exige', () => {
    /*
     * O `kind` não decide sozinho de propósito: uma briga pode ser dois latidos ou um ponto no
     * lábio, e quem estava lá sabe a diferença.
     */
    expect(exigeContato('grave')).toBe(true)
    expect(exigeContato('moderada')).toBe(false)
    expect(exigeContato('leve')).toBe(false)
  })

  it('a grave sem ligação fica na lista de travadas', () => {
    const travadas = ocorrenciasTravadas([
      ocorrencia(),
      ocorrencia({ id: 'ocor-2', gravidade: 'leve', exigeContato: false }),
    ])

    expect(travadas.map((item) => item.id)).toEqual(['ocor-1'])
  })

  it('a grave já comunicada sai da lista', () => {
    const travadas = ocorrenciasTravadas([
      ocorrencia({ contatoEm: '2026-06-10T15:35:00-04:00', contatoPor: 'eq-helena' }),
    ])

    expect(travadas).toEqual([])
  })

  it('o boletim que carrega ocorrência grave não sai sem ligação', () => {
    expect(boletimPodeSair({ exigeContato: true, contatoEm: null })).toBe(false)
    expect(boletimPodeSair({ exigeContato: true, contatoEm: '2026-06-10T16:00:00-04:00' })).toBe(
      true,
    )
    /* Boletim comum sai sempre: a regra não pode transformar rotina em travamento. */
    expect(boletimPodeSair({ exigeContato: false, contatoEm: null })).toBe(true)
  })
})

describe('R4 · o que entrou tem que sair', () => {
  it('o item em branco é o único que trava', () => {
    /*
     * "Resolvido" não é "devolvido": a coleira que se perdeu, e alguém escreveu que se perdeu,
     * está resolvida. O que trava é o campo em branco, porque é o único estado que significa
     * "ninguém olhou".
     */
    const pendentes = pertencesPendentes([
      pertence({ id: 'p1', devolvido: true }),
      pertence({ id: 'p2', devolvido: false, observacao: 'Extraviado. Responsável avisado.' }),
      pertence({ id: 'p3' }),
    ])

    expect(pendentes.map((item) => item.id)).toEqual(['p3'])
  })

  it('observação só de espaços não conta como conferência', () => {
    expect(pertencesPendentes([pertence({ observacao: '   ' })])).toHaveLength(1)
  })
})

describe('impedimentos de saída', () => {
  it('devolve todos, não só o primeiro', () => {
    const impedimentos = impedimentosDeSaida({
      pertences: [pertence()],
      ocorrencias: [ocorrencia()],
      pesoSaidaKg: null,
    })

    expect(impedimentos).toEqual(['pertences', 'ocorrencia-sem-contato', 'peso-de-saida'])
  })

  it('a pesagem de saída é obrigatória, e é a mais esquecida', () => {
    /* É a única prova do que aconteceu, e ela deixa de existir quando o carro sai. */
    expect(
      impedimentosDeSaida({
        pertences: [pertence({ devolvido: true })],
        ocorrencias: [],
        pesoSaidaKg: null,
      }),
    ).toEqual(['peso-de-saida'])
  })

  it('tudo conferido libera a saída', () => {
    expect(
      impedimentosDeSaida({
        pertences: [pertence({ devolvido: true })],
        ocorrencias: [ocorrencia({ contatoEm: '2026-06-10T16:00:00-04:00' })],
        pesoSaidaKg: 12.1,
      }),
    ).toEqual([])
  })
})

describe('peso', () => {
  const hospedagem = {
    pesoEntradaKg: 20,
    pesoSaidaKg: null,
  } as Hospedagem

  it('sem pesagem de saída não há variação', () => {
    expect(variacaoDePeso(hospedagem)).toBeNull()
    expect(perdeuPesoRelevante(hospedagem)).toBe(false)
  })

  it('a perda é medida em percentual, não em quilos', () => {
    /*
     * 400 g é irrelevante num são-bernardo e é alerta num yorkshire. Uma tela que mostrasse os dois
     * com o mesmo destaque ensinaria a ignorar o destaque.
     */
    const saoBernardo = { pesoEntradaKg: 60, pesoSaidaKg: 59.6 } as Hospedagem
    const yorkshire = { pesoEntradaKg: 3, pesoSaidaKg: 2.6 } as Hospedagem

    expect(perdeuPesoRelevante(saoBernardo)).toBe(false)
    expect(perdeuPesoRelevante(yorkshire)).toBe(true)
  })

  it('ganhar peso nunca é alerta', () => {
    expect(perdeuPesoRelevante({ pesoEntradaKg: 20, pesoSaidaKg: 22 } as Hospedagem)).toBe(false)
  })
})

describe('tons', () => {
  it('"em adaptação" é atenção, não risco', () => {
    /* No primeiro dia é o normal. Pintar de vermelho o esperado ensina a não olhar para a cor. */
    expect(tomDaAdaptacao('tranquilo')).toBe('neutro')
    expect(tomDaAdaptacao('em-adaptacao')).toBe('atencao')
    expect(tomDaAdaptacao('estressado')).toBe('risco')
  })

  it('a gravidade sobe na mesma escada', () => {
    expect(tomDaGravidade('leve')).toBe('neutro')
    expect(tomDaGravidade('moderada')).toBe('atencao')
    expect(tomDaGravidade('grave')).toBe('risco')
  })
})

describe('noites na casa', () => {
  const entrada = '2026-06-10T14:00:00-04:00'

  function estadia(saidaEm: string | null = null) {
    return { entradaEm: entrada, saidaEm } as Hospedagem
  }

  it('conta meia-noite atravessada, e não bloco de 24 horas', () => {
    /*
     * Quem entrou às 14h e está aqui à 1h da manhã do dia seguinte dormiu **uma** noite. A conta
     * por horas devolvia zero, e a grade de ocupação — que conta por data — desenhava a barra
     * ocupando aquela mesma noite. Duas contas para a mesma palavra é como se perde a confiança.
     */
    expect(noitesNaCasa(estadia(), '2026-06-10T23:00:00-04:00')).toBe(0)
    expect(noitesNaCasa(estadia(), '2026-06-11T01:00:00-04:00')).toBe(1)
    expect(noitesNaCasa(estadia(), '2026-06-13T09:00:00-04:00')).toBe(3)
  })

  it('a estadia encerrada conta até a saída, não até agora', () => {
    expect(noitesNaCasa(estadia('2026-06-12T10:00:00-04:00'), '2026-06-20T10:00:00-04:00')).toBe(2)
  })

  it('nunca é negativa', () => {
    expect(noitesNaCasa(estadia(), '2026-06-01T10:00:00-04:00')).toBe(0)
  })
})
