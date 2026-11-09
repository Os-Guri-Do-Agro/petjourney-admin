import { describe, expect, it } from 'vitest'

import { ApiError } from '@/service/api'
import type { RondaDaPrancheta, TarefaDaPrancheta } from '@/service/parceiro/hotel-rotina-service'

import {
  diasEntre,
  emLotes,
  esperaAntesDeTentarDeNovo,
  horaDaParede,
  idsParaARonda,
  lerHorarios,
  ocorrenciasNaOrdem,
  pedeLigacao,
  podeDesfazerTarefa,
  podeRebaixarGrave,
  recorteDasProximasHoras,
  rondasPorTempo,
  somarDias,
  tarefasPorId,
  tempoDaRonda,
} from '../rotina-do-hotel'

function tarefa(parcial: Partial<TarefaDaPrancheta> = {}): TarefaDaPrancheta {
  return {
    id: 't1',
    hospedagemId: 'h1',
    pacienteNome: 'Thor',
    especie: 'CACHORRO',
    acomodacaoId: 'a1',
    acomodacaoNome: 'Baia 1',
    blocoId: 'b1',
    kind: 'AGUA',
    descricao: 'Água',
    previstaPara: '2026-11-09T12:00:00-03:00',
    dia: '2026-11-09',
    hora: '12:00',
    status: 'PENDENTE',
    situacao: 'NA_JANELA',
    tempo: 'AGORA',
    motivo: null,
    observacao: null,
    executadaEm: null,
    executadaPorNome: null,
    ...parcial,
  }
}

function ronda(linhas: TarefaDaPrancheta[], parcial: Partial<RondaDaPrancheta> = {}) {
  return {
    chave: 'AGUA-12:00',
    dia: '2026-11-09',
    hora: '12:00',
    kind: 'AGUA',
    total: linhas.length,
    pendentes: linhas.filter((l) => l.status === 'PENDENTE').length,
    aceitaLote: true,
    grupos: [{ blocoId: 'b1', nome: 'Bloco A', linhas }],
    ...parcial,
  } as RondaDaPrancheta
}

describe('ROTINA_OCUPADA', () => {
  const ocupada = (segundos?: number) =>
    new ApiError('ocupada', 503, undefined, undefined, {
      codigo: 'ROTINA_OCUPADA',
      detalhes: segundos === undefined ? {} : { tenteDeNovoEmSegundos: segundos },
    })

  it('espera o tempo pedido e tenta de novo em silêncio na primeira vez', () => {
    expect(esperaAntesDeTentarDeNovo(ocupada(3), 0)).toBe(3000)
  })

  it('mostra o erro na segunda vez', () => {
    expect(esperaAntesDeTentarDeNovo(ocupada(3), 1)).toBeNull()
  })

  it('sem o tempo, espera 5 s; nunca mais de um minuto', () => {
    expect(esperaAntesDeTentarDeNovo(ocupada(), 0)).toBe(5000)
    expect(esperaAntesDeTentarDeNovo(ocupada(600), 0)).toBe(60_000)
  })

  it('outro erro não é ocupada', () => {
    const outro = new ApiError('x', 409, undefined, undefined, { codigo: 'TAREFA_SUSPENSA' })
    expect(esperaAntesDeTentarDeNovo(outro, 0)).toBeNull()
    expect(esperaAntesDeTentarDeNovo(new Error('rede'), 0)).toBeNull()
  })
})

describe('recorte das próximas horas', () => {
  it('lê a hora da parede da casa no ISO, sem converter fuso', () => {
    expect(horaDaParede('2026-11-09T14:20:00-03:00')).toBe(14)
    expect(horaDaParede('lixo')).toBeNull()
  })

  it('vai de uma hora antes a quatro depois', () => {
    expect(recorteDasProximasHoras(14)).toEqual({ de: '13:00', ate: '19:00' })
  })

  it('não começa antes da meia-noite', () => {
    expect(recorteDasProximasHoras(0)).toEqual({ de: '00:00', ate: '05:00' })
  })

  it('perto do fim do dia vai até o fim, sem 24:00', () => {
    expect(recorteDasProximasHoras(20)).toEqual({ de: '19:00' })
    expect(recorteDasProximasHoras(18)).toEqual({ de: '17:00', ate: '23:00' })
  })
})

describe('dias', () => {
  it('soma e conta dias no calendário', () => {
    expect(somarDias('2026-11-01', -1)).toBe('2026-10-31')
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(diasEntre('2026-11-09', '2026-11-08')).toBe(-1)
    expect(diasEntre('2026-11-09', '2026-11-11')).toBe(2)
  })
})

describe('rondas', () => {
  it('a ronda com uma linha da vez fica inteira em "agora"', () => {
    const r = ronda([
      tarefa({ id: 'a', status: 'FEITA', situacao: 'FEITA', tempo: 'PASSADO' }),
      tarefa({ id: 'b' }),
    ])
    expect(tempoDaRonda(r)).toBe('AGORA')
  })

  it('reparte por tempo', () => {
    const agora = ronda([tarefa()])
    const adiante = ronda([tarefa({ situacao: 'FUTURA', tempo: 'ADIANTE' })], { chave: 'x' })
    const passado = ronda([tarefa({ status: 'FEITA', situacao: 'FEITA', tempo: 'PASSADO' })], {
      chave: 'y',
    })
    const partes = rondasPorTempo([adiante, passado, agora])
    expect(partes.AGORA).toEqual([agora])
    expect(partes.ADIANTE).toEqual([adiante])
    expect(partes.PASSADO).toEqual([passado])
  })

  it('manda só as pendentes que a tela mostrou, já na janela', () => {
    const r = ronda([
      tarefa({ id: 'a' }),
      tarefa({ id: 'b', situacao: 'ATRASADA' }),
      tarefa({ id: 'c', status: 'FEITA', situacao: 'FEITA', tempo: 'PASSADO' }),
    ])
    expect(idsParaARonda(r)).toEqual(['a', 'b'])
  })

  it('não oferece lote para medicação, ronda de um ou ronda adiantada', () => {
    expect(
      idsParaARonda(ronda([tarefa({ id: 'a' }), tarefa({ id: 'b' })], { aceitaLote: false })),
    ).toEqual([])
    expect(
      idsParaARonda(
        ronda([tarefa({ id: 'a', kind: 'MEDICACAO' }), tarefa({ id: 'b', kind: 'MEDICACAO' })], {
          kind: 'MEDICACAO',
        }),
      ),
    ).toEqual([])
    expect(idsParaARonda(ronda([tarefa({ id: 'a' })]))).toEqual([])
    expect(
      idsParaARonda(
        ronda([tarefa({ id: 'a' }), tarefa({ id: 'b', situacao: 'FUTURA', tempo: 'ADIANTE' })]),
      ),
    ).toEqual([])
  })

  it('divide em lotes de 60', () => {
    const ids = Array.from({ length: 130 }, (_, i) => `t${i}`)
    const lotes = emLotes(ids, 60)
    expect(lotes.map((lote) => lote.length)).toEqual([60, 60, 10])
    expect(lotes.flat()).toEqual(ids)
  })

  it('acha a tarefa do foco pelo id', () => {
    const mapa = tarefasPorId([ronda([tarefa({ id: 'foco' })])])
    expect(mapa.get('foco')?.pacienteNome).toBe('Thor')
  })
})

describe('desfazer', () => {
  const agora = Date.parse('2026-11-09T15:00:00-03:00')
  const feita = tarefa({
    status: 'FEITA',
    situacao: 'FEITA',
    executadaPorNome: 'Daniel',
    executadaEm: '2026-11-09T12:05:00-03:00',
  })

  it('só quem registrou, em até 12 h', () => {
    expect(podeDesfazerTarefa(feita, 'Daniel', agora)).toBe(true)
    expect(podeDesfazerTarefa(feita, 'Ana', agora)).toBe(false)
    expect(podeDesfazerTarefa(feita, null, agora)).toBe(false)
    expect(podeDesfazerTarefa(feita, 'Daniel', agora + 12 * 3600 * 1000)).toBe(false)
  })

  it('pendente e suspensa não se desfazem', () => {
    expect(podeDesfazerTarefa(tarefa(), 'Daniel', agora)).toBe(false)
    expect(podeDesfazerTarefa({ ...feita, status: 'SUSPENSA' }, 'Daniel', agora)).toBe(false)
  })
})

describe('horários', () => {
  it('ordena e tira os repetidos', () => {
    expect(lerHorarios('18:00, 07:00 12:00;07:00')).toEqual({
      horarios: ['07:00', '12:00', '18:00'],
      erro: '',
    })
  })

  it('recusa 9:00 e 24:00', () => {
    expect(lerHorarios('9:00').erro).toBe('FORMATO')
    expect(lerHorarios('24:00').erro).toBe('FORMATO')
  })

  it('no máximo 12', () => {
    const treze = Array.from({ length: 13 }, (_, i) => `${String(i + 6).padStart(2, '0')}:00`)
    expect(lerHorarios(treze.join(',')).erro).toBe('DEMAIS')
    expect(lerHorarios('').horarios).toEqual([])
  })
})

describe('ocorrências e a R3', () => {
  const grave = {
    gravidade: 'GRAVE' as const,
    exigeContato: true,
    semContato: true,
    travaAPassagem: true,
    tentativas: 0,
    contato: null,
    semResposta: null,
  }

  it('a grave sem contato pede a ligação, mesmo com o sem resposta', () => {
    expect(pedeLigacao(grave)).toBe(true)
    expect(pedeLigacao({ ...grave, semContato: false })).toBe(false)
  })

  it('a grave só desce antes da primeira tentativa', () => {
    expect(podeRebaixarGrave(grave)).toBe(true)
    expect(podeRebaixarGrave({ ...grave, tentativas: 1 })).toBe(false)
    expect(
      podeRebaixarGrave({ ...grave, semResposta: { nota: 'tentamos', em: '2026-11-09T10:00' } }),
    ).toBe(false)
    expect(podeRebaixarGrave({ ...grave, gravidade: 'MODERADA' })).toBe(false)
  })

  it('as que travam a passagem vêm primeiro, depois as que retêm o boletim', () => {
    const lista = [
      { id: 'leve', travaAPassagem: false, semContato: false },
      { id: 'retém', travaAPassagem: false, semContato: true },
      { id: 'trava', travaAPassagem: true, semContato: true },
    ]
    expect(ocorrenciasNaOrdem(lista).map((item) => item.id)).toEqual(['trava', 'retém', 'leve'])
  })
})
