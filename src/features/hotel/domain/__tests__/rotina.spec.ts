/**
 * A rotina do turno.
 *
 * O que estes testes guardam é a decisão de **não gravar "atrasada"**. Uma tarefa marcada como
 * atrasada às 8h continuaria atrasada depois de servida às 8h10, e a prancheta passaria o dia
 * inteiro vermelha para trabalho que foi feito.
 */

import { describe, expect, it } from 'vitest'

import {
  agruparEmRondas,
  agruparPorHorario,
  atrasadasAgora,
  descricaoDaRefeicao,
  JANELA_MINUTOS,
  pendenciasDoTurno,
  pendentesAgora,
  planejarDia,
  proximaEmMinutos,
  repartirPorTempo,
  RONDA_ABRE_ATE,
  situacaoDaTarefa,
  tarefasDoDia,
} from '../rotina'
import type { TempoDaPrancheta } from '../rotina'
import type { MedicacaoDaEstadia, PlanoAlimentar, TarefaDeRotina } from '../../data/types'

const OFFSET = '-04:00'
const AGORA = `2026-06-10T12:00:00${OFFSET}`

function iso(hora: string, dia = '2026-06-10') {
  return `${dia}T${hora}:00${OFFSET}`
}

function tarefa(entrada: Partial<TarefaDeRotina> = {}): TarefaDeRotina {
  return {
    id: 'tarefa-1',
    hospedagemId: 'hosp-1',
    kind: 'refeicao',
    descricao: '',
    origemId: null,
    previstaPara: iso('12:00'),
    status: 'pendente',
    executadaEm: null,
    executadaPor: null,
    turnoId: null,
    observacao: '',
    ...entrada,
  }
}

describe('situação contra o relógio', () => {
  it('o que já foi marcado devolve o próprio estado, sem olhar a hora', () => {
    expect(situacaoDaTarefa(tarefa({ status: 'feita', previstaPara: iso('08:00') }), AGORA)).toBe(
      'feita',
    )
    expect(
      situacaoDaTarefa(tarefa({ status: 'recusada', previstaPara: iso('08:00') }), AGORA),
    ).toBe('recusada')
  })

  it('a janela tem meia hora para cada lado', () => {
    /*
     * Quem alimenta dezoito animais não serve os dezoito às 8h em ponto. Uma prancheta que pinta
     * de vermelho tudo o que passou do minuto exato ensina a ignorar o vermelho.
     */
    expect(situacaoDaTarefa(tarefa({ previstaPara: iso('12:29') }), AGORA)).toBe('na-janela')
    expect(situacaoDaTarefa(tarefa({ previstaPara: iso('11:31') }), AGORA)).toBe('na-janela')
    expect(JANELA_MINUTOS).toBe(30)
  })

  it('fora da janela, é futura de um lado e atrasada do outro', () => {
    expect(situacaoDaTarefa(tarefa({ previstaPara: iso('14:00') }), AGORA)).toBe('futura')
    expect(situacaoDaTarefa(tarefa({ previstaPara: iso('10:00') }), AGORA)).toBe('atrasada')
  })
})

describe('o que cobra ação', () => {
  const lista = [
    tarefa({ id: 't-futura', previstaPara: iso('18:00') }),
    tarefa({ id: 't-janela', previstaPara: iso('12:10') }),
    tarefa({ id: 't-atrasada', previstaPara: iso('09:00') }),
    tarefa({ id: 't-feita', previstaPara: iso('08:00'), status: 'feita' }),
    tarefa({ id: 't-recusada', previstaPara: iso('07:00'), status: 'recusada' }),
  ]

  it('conta a janela e o atraso, e nada mais', () => {
    expect(pendentesAgora(lista, AGORA).map((item) => item.id)).toEqual(['t-janela', 't-atrasada'])
    expect(atrasadasAgora(lista, AGORA).map((item) => item.id)).toEqual(['t-atrasada'])
  })

  it('a recusa não é trabalho parado', () => {
    /*
     * Não comeu **é** informação — vai para o boletim e, repetida, vira ocorrência —, mas ninguém
     * precisa voltar lá. Contá-la como pendente faria a prancheta mostrar trabalho inexistente.
     */
    expect(
      pendentesAgora([tarefa({ status: 'recusada', previstaPara: iso('07:00') })], AGORA),
    ).toEqual([])
  })

  it('a próxima é a mais perto à frente', () => {
    expect(proximaEmMinutos(lista, AGORA)).toBe(10)
    expect(proximaEmMinutos([tarefa({ previstaPara: iso('09:00') })], AGORA)).toBeNull()
  })
})

describe('pendências do turno', () => {
  it('o que está previsto para depois do fim do turno não é dívida de quem sai', () => {
    const fim = iso('14:00')
    const lista = [
      tarefa({ id: 't-dentro', previstaPara: iso('11:00') }),
      tarefa({ id: 't-depois', previstaPara: iso('16:00') }),
    ]

    expect(pendenciasDoTurno(lista, fim, AGORA).map((item) => item.id)).toEqual(['t-dentro'])
  })

  it('a lista sai em ordem de relógio, não na ordem em que as tarefas nasceram', () => {
    /*
     * As tarefas nascem agrupadas por estadia — as três do Thor, depois as três do Bento —, e a
     * passagem saía nessa ordem. Quem assume o turno não pergunta "o que falta do Thor": pergunta
     * o que vem primeiro. Numa lista de treze itens, a ordem errada é a diferença entre varrer e
     * reler.
     */
    /* As três precisam cobrar ação agora: futura demais sai pelo filtro, não pela ordem. */
    const fim = iso('14:00')
    const lista = [
      tarefa({ id: 't-meio-dia', previstaPara: iso('12:15') }),
      tarefa({ id: 't-sete', previstaPara: iso('07:00') }),
      tarefa({ id: 't-onze', previstaPara: iso('11:00') }),
    ]

    expect(pendenciasDoTurno(lista, fim, AGORA).map((item) => item.id)).toEqual([
      't-sete',
      't-onze',
      't-meio-dia',
    ])
  })
})

describe('planejamento do dia', () => {
  const plano: PlanoAlimentar = {
    racaoPropria: true,
    marca: 'Premier',
    porcaoGramas: 180,
    horarios: ['08:00', '18:00'],
    restricoes: '',
    petiscos: '',
  }

  const medicacao: MedicacaoDaEstadia = {
    id: 'med-1',
    hospedagemId: 'hosp-1',
    descricao: 'Benazepril 5 mg',
    via: 'oral',
    doseTexto: '1/2 comprimido',
    horarios: ['08:00', '20:00'],
    inicio: '2026-06-10',
    fim: null,
    receita: '',
    observacao: '',
    suspensaEm: null,
  }

  function planejar(extra: Partial<Parameters<typeof planejarDia>[0]> = {}) {
    return planejarDia({
      hospedagemId: 'hosp-1',
      dia: '2026-06-10',
      utcOffset: OFFSET,
      planoAlimentar: plano,
      medicacoes: [medicacao],
      passeioAutorizado: true,
      entradaEm: iso('00:00'),
      saidaPrevistaEm: iso('23:59'),
      ...extra,
    })
  }

  it('gera refeição, medicação, passeio, higiene e água, em ordem de horário', () => {
    const tarefas = planejar()
    const kinds = new Set(tarefas.map((item) => item.kind))

    expect(kinds).toEqual(new Set(['refeicao', 'medicacao', 'passeio', 'higiene', 'agua']))

    /* Ordenada: a prancheta agrupa por horário, e um planejamento fora de ordem a embaralharia. */
    const horarios = tarefas.map((item) => item.previstaPara)

    expect(horarios).toEqual([...horarios].sort())
  })

  it('nada é planejado fora da janela da estadia', () => {
    /* Quem entra às 15h não tem a refeição das 8h nascendo atrasada. */
    const tarefas = planejar({ entradaEm: iso('15:00') })

    expect(tarefas.every((item) => item.previstaPara >= iso('15:00'))).toBe(true)
    expect(tarefas.some((item) => item.kind === 'refeicao')).toBe(true)
  })

  it('sem autorização, não há passeio', () => {
    expect(planejar({ passeioAutorizado: false }).some((item) => item.kind === 'passeio')).toBe(
      false,
    )
  })

  it('medicação suspensa ou fora da janela não entra', () => {
    expect(
      planejar({ medicacoes: [{ ...medicacao, suspensaEm: iso('07:00') }] }).some(
        (item) => item.kind === 'medicacao',
      ),
    ).toBe(false)

    expect(
      planejar({ medicacoes: [{ ...medicacao, fim: '2026-06-09' }] }).some(
        (item) => item.kind === 'medicacao',
      ),
    ).toBe(false)
  })

  it('a medicação carrega a dose na descrição, e aponta para a prescrição', () => {
    const dose = planejar().find((item) => item.kind === 'medicacao')

    expect(dose?.descricao).toBe('Benazepril 5 mg · 1/2 comprimido')
    expect(dose?.origemId).toBe('med-1')
  })

  it('a descrição da refeição é congelada no planejamento', () => {
    /* Trocar a ração no terceiro dia não pode reescrever o que foi servido no primeiro. */
    expect(descricaoDaRefeicao(plano)).toBe('Premier · 180 g')
    expect(descricaoDaRefeicao({ ...plano, racaoPropria: false })).toBe('180 g')
  })
})

describe('a prancheta agrupa por horário, não por hóspede', () => {
  it('junta hóspedes diferentes no mesmo horário', () => {
    /* Às 8h alguém alimenta os dezoito; por hóspede, atravessaria o corredor dezoito vezes. */
    const blocos = agruparPorHorario([
      tarefa({ id: 'a', hospedagemId: 'hosp-1', previstaPara: iso('08:00') }),
      tarefa({ id: 'b', hospedagemId: 'hosp-2', previstaPara: iso('08:00') }),
      tarefa({ id: 'c', hospedagemId: 'hosp-1', previstaPara: iso('18:00') }),
    ])

    expect(blocos.map((bloco) => bloco.hora)).toEqual(['08:00', '18:00'])
    expect(blocos[0]?.tarefas).toHaveLength(2)
  })

  it('a prancheta é sempre de um dia', () => {
    const lista = [
      tarefa({ id: 'hoje', previstaPara: iso('08:00') }),
      tarefa({ id: 'amanha', previstaPara: iso('08:00', '2026-06-11') }),
    ]

    expect(tarefasDoDia(lista, '2026-06-10').map((item) => item.id)).toEqual(['hoje'])
  })
})

describe('os três tempos da prancheta', () => {
  /*
   * Um horário só, com as três situações dentro. É o caso que a versão anterior errava: ela
   * classificava o bloco inteiro pela tarefa mais urgente, e as já resolvidas iam junto para
   * "Para agora".
   */
  const umHorario = [
    {
      hora: '07:00',
      linhas: [
        { id: 'atrasada', situacao: 'atrasada' as const },
        { id: 'na-janela', situacao: 'na-janela' as const },
        { id: 'feita', situacao: 'feita' as const },
        { id: 'recusada', situacao: 'recusada' as const },
        { id: 'pulada', situacao: 'pulada' as const },
        { id: 'futura', situacao: 'futura' as const },
      ],
    },
  ]

  function ids(tempo: TempoDaPrancheta) {
    return repartirPorTempo(umHorario, tempo).flatMap((bloco) =>
      bloco.linhas.map((linha) => linha.id),
    )
  }

  it('"agora" leva só o que cobra ação, e nunca o que já foi resolvido', () => {
    expect(ids('agora')).toEqual(['atrasada', 'na-janela'])
  })

  it('recusada e pulada contam como passado, e não como trabalho parado', () => {
    /* Não comeu é informação, mas ninguém precisa voltar lá — ver `pendentesAgora`. */
    expect(ids('passado')).toEqual(['feita', 'recusada', 'pulada'])
  })

  it('"adiante" é só o que ainda não chegou', () => {
    expect(ids('adiante')).toEqual(['futura'])
  })

  it('o mesmo horário sai em mais de um tempo, com as linhas repartidas', () => {
    /*
     * As 07:00 aparecem em cima com o que falta e embaixo, no recolhido, com o que já foi. É a
     * consequência de repartir por tarefa, e é ela que esvazia o ruído de "Para agora".
     */
    expect(repartirPorTempo(umHorario, 'agora')[0]?.hora).toBe('07:00')
    expect(repartirPorTempo(umHorario, 'passado')[0]?.hora).toBe('07:00')
  })

  it('horário que fica sem linhas naquele tempo não vira bloco vazio', () => {
    const soResolvidas = [{ hora: '09:00', linhas: [{ id: 'x', situacao: 'feita' as const }] }]

    expect(repartirPorTempo(soResolvidas, 'agora')).toEqual([])
  })
})

describe('as rondas de um horário', () => {
  function linha(id: string, kind: TarefaDeRotina['kind']) {
    return { tarefa: { kind }, id }
  }

  it('junta o mesmo serviço e separa serviços diferentes', () => {
    /* Às 18:00 alguém serve a ração dos três e só depois volta para a água. Duas rondas. */
    const rondas = agruparEmRondas('18:00', [
      linha('a', 'refeicao'),
      linha('b', 'agua'),
      linha('c', 'refeicao'),
      linha('d', 'refeicao'),
    ])

    expect(rondas.map((r) => [r.kind, r.linhas.length])).toEqual([
      ['refeicao', 3],
      ['agua', 1],
    ])
  })

  it('a ordem é a de aparição, e não uma prioridade inventada', () => {
    const rondas = agruparEmRondas('08:00', [
      linha('a', 'agua'),
      linha('b', 'medicacao'),
      linha('c', 'refeicao'),
    ])

    expect(rondas.map((r) => r.kind)).toEqual(['agua', 'medicacao', 'refeicao'])
  })

  it('a chave carrega hora e tipo, para o aberto/fechado não vazar entre horários', () => {
    /*
     * Sem a hora na chave, abrir a ronda de refeição das 08:00 abriria junto a das 18:00 — e
     * quem está no corredor às 8h não pediu para ver o jantar.
     */
    const manha = agruparEmRondas('08:00', [linha('a', 'refeicao')])
    const noite = agruparEmRondas('18:00', [linha('b', 'refeicao')])

    expect(manha[0]?.chave).toBe('08:00|refeicao')
    expect(noite[0]?.chave).toBe('18:00|refeicao')
  })

  it('o limite de abertura automática cobre o hotel pequeno inteiro', () => {
    /*
     * É o número que faz a mesma tela servir a uma casa de cinco e a uma de cinquenta: abaixo
     * dele nada se recolhe, e um hotel pequeno nunca vê uma ronda fechada. Medido na tela com
     * cinco hóspedes, as doze rondas do dia nascem todas abertas.
     */
    expect(RONDA_ABRE_ATE).toBeGreaterThanOrEqual(5)
  })
})
