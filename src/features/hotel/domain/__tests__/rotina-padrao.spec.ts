/**
 * A edição e a publicação da rotina padrão.
 *
 * O que estes testes guardam é a diferença entre um cadastro e uma armadilha: publicar mexe no
 * trabalho de todos os hóspedes de uma vez, e a pessoa precisa saber quanto antes de clicar.
 */
import { describe, expect, it } from 'vitest'

import type { ClockTime, ISODateTime, ItemDeRotina, TarefaDeRotina } from '../../data/types'
import { normalizarHorarios, previsaoDaPublicacao, problemasDoItem, tarefasPorDia } from '../rotina-padrao'
import type { TarefaPlanejada } from '../rotina'

const AGORA = '2026-09-22T15:00:00-03:00' as ISODateTime

const em = (dia: string, hora: string) => `${dia}T${hora}:00-03:00` as ISODateTime

const item = (over: Partial<ItemDeRotina> = {}): ItemDeRotina => ({
  id: 'i1',
  kind: 'agua',
  horarios: ['07:00', '12:00'] as ClockTime[],
  exigeAutorizacao: null,
  ativo: true,
  ...over,
})

const tarefa = (previstaPara: ISODateTime, over: Partial<TarefaDeRotina> = {}): TarefaDeRotina => ({
  id: `t-${previstaPara}`,
  hospedagemId: 'h1',
  kind: 'agua',
  descricao: '',
  origemId: null,
  previstaPara,
  status: 'pendente',
  executadaEm: null,
  executadaPor: null,
  turnoId: null,
  observacao: '',
  ...over,
})

const planejada = (previstaPara: ISODateTime): TarefaPlanejada => ({
  hospedagemId: 'h1',
  kind: 'agua',
  descricao: '',
  origemId: null,
  previstaPara,
})

describe('normalizarHorarios', () => {
  it('ordena e tira repetidos', () => {
    /* Duas trocas de água às 12:00 viram duas fileiras idênticas que leem como defeito. */
    const horarios = ['22:00', '07:00', '12:00', '07:00'] as ClockTime[]

    expect(normalizarHorarios(horarios)).toEqual(['07:00', '12:00', '22:00'])
  })
})

describe('problemasDoItem', () => {
  it('acusa o item ligado que não diz quando acontece', () => {
    expect(problemasDoItem(item({ ativo: true, horarios: [] }))).toContain('sem-horario')
  })

  it('o item desligado sem horário não é problema: é uma linha guardada', () => {
    expect(problemasDoItem(item({ ativo: false, horarios: [] }))).toEqual([])
  })

  it('recusa horário malformado', () => {
    expect(problemasDoItem(item({ horarios: ['25:00'] as ClockTime[] }))).toContain(
      'horario-invalido',
    )
  })
})

describe('tarefasPorDia', () => {
  it('conta só o que está ligado', () => {
    const itens = [
      item({ id: 'a', horarios: ['07:00', '12:00', '18:00'] as ClockTime[] }),
      item({ id: 'b', kind: 'higiene', horarios: ['09:00'] as ClockTime[] }),
      item({ id: 'c', kind: 'pesagem', horarios: ['07:00'] as ClockTime[], ativo: false }),
    ]

    expect(tarefasPorDia(itens)).toBe(4)
  })
})

describe('previsaoDaPublicacao', () => {
  it('conta o que nasce, o que sai e o que fica intocado', () => {
    const hoje = '2026-09-22'

    const existentes = [
      /* já feita: história, nunca sai */
      tarefa(em(hoje, '07:00'), { status: 'feita', executadaPor: 'c1', executadaEm: em(hoje, '07:05') }),
      /* pendente e vencida: é a dívida do turno, também fica */
      tarefa(em(hoje, '12:00')),
      /* pendente e futura, e o plano novo não a prevê: sai */
      tarefa(em(hoje, '18:00')),
    ]

    const planejadas = [
      planejada(em(hoje, '07:00')),
      planejada(em(hoje, '12:00')),
      planejada(em(hoje, '19:00')),
    ]

    const previsao = previsaoDaPublicacao([{ dia: hoje, existentes, planejadas }], AGORA)

    expect(previsao.criadas).toBe(1)
    expect(previsao.retiradas).toBe(1)
    expect(previsao.preservadas).toBe(2)
  })

  it('separa o que cai hoje do que cai depois', () => {
    const hoje = '2026-09-22'
    const amanha = '2026-09-23'

    const previsao = previsaoDaPublicacao(
      [
        { dia: hoje, existentes: [], planejadas: [planejada(em(hoje, '19:00'))] },
        {
          dia: amanha,
          existentes: [],
          planejadas: [planejada(em(amanha, '07:00')), planejada(em(amanha, '12:00'))],
        },
      ],
      AGORA,
    )

    expect(previsao.criadas).toBe(3)
    /* Só a das 19:00 de hoje cai no turno de quem está trabalhando agora. */
    expect(previsao.hoje).toBe(1)
  })

  it('publicar a partir de amanhã não mexe em nada de hoje', () => {
    const hoje = '2026-09-22'

    /* Nenhum dia de hoje entra na lista: a vigência começa amanhã. */
    const previsao = previsaoDaPublicacao(
      [{ dia: '2026-09-23', existentes: [], planejadas: [planejada(em('2026-09-23', '07:00'))] }],
      AGORA,
    )

    expect(previsao.hoje).toBe(0)
    expect(previsao.criadas).toBe(1)
    expect(hoje).toBe('2026-09-22')
  })
})
