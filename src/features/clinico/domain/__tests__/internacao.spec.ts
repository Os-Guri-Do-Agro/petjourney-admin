/**
 * As regras da internação, cobertas onde elas decidem alguma coisa.
 *
 * O foco não é cobertura de linha: é a lista curta de comportamentos que, ao quebrarem em
 * silêncio, produzem dano de verdade — uma dose que some na troca de plantão, e uma notícia
 * grave que sai por notificação antes de alguém ligar.
 */

import { describe, expect, it } from 'vitest'

import { createClinicClock } from '../clinic-time'
import {
  administracoesDoPlantao,
  atrasoEmMinutos,
  atravessaAPassagem,
  boletinsPorDia,
  dentroDoSilencioNoturno,
  exigeLigacaoAntes,
  horariosDaPrescricao,
  idDoPlantao,
  impedimentoDeEnvio,
  JANELA_TOLERANCIA_MINUTOS,
  limitesDoPlantao,
  mapaDeLeitos,
  pendenciasDaPassagem,
  piorou,
  plantaoAnterior,
  plantaoDe,
  plantaoSeguinte,
  podeEnviar,
  proximoBoletimEm,
  situacaoDaAdministracao,
  taxaDeOcupacao,
} from '../internacao'
import type {
  AdministracaoAgendada,
  BoletimAoTutor,
  Internacao,
  Leito,
  PrescricaoDeInternacao,
} from '../../data/types'

const OFFSET = '-04:00'
const clock = createClinicClock(OFFSET)

function iso(data: string, hora: number, minuto = 0): string {
  return clock.toIso(data, hora * 60 + minuto)
}

function prescricao(patch: Partial<PrescricaoDeInternacao> = {}): PrescricaoDeInternacao {
  return {
    id: 'presc-1',
    internacaoId: 'int-1',
    kind: 'medicamento',
    medicamentoId: 'med-dipirona',
    descricao: 'Dipirona',
    via: 'intravenosa',
    doseTexto: '25 mg/kg',
    frequenciaHoras: 8,
    continuo: false,
    primeiroHorario: iso('2026-09-09', 8),
    encerraEm: null,
    prescritoPor: 'prof-ana',
    prescritoEm: iso('2026-09-09', 7),
    suspensaEm: null,
    motivoSuspensao: '',
    observacao: '',
    ...patch,
  }
}

function administracao(patch: Partial<AdministracaoAgendada> = {}): AdministracaoAgendada {
  return {
    id: 'adm-1',
    internacaoId: 'int-1',
    prescricaoId: 'presc-1',
    previstaPara: iso('2026-09-09', 14),
    status: 'pendente',
    executadaEm: null,
    executadaPor: null,
    plantaoId: null,
    observacao: '',
    ...patch,
  }
}

function leito(
  id: string,
  nome: string,
  kind: Leito['kind'],
  ativo = true,
): Leito {
  return {
    id,
    nome,
    roomId: kind === 'isolamento' ? 'iso' : 'sala',
    kind,
    ativo,
    motivoInativo: ativo ? null : 'manutencao',
    detalheInativo: '',
    inativoDesde: null,
  }
}

function boletim(patch: Partial<BoletimAoTutor> = {}): BoletimAoTutor {
  return {
    id: 'bol-1',
    internacaoId: 'int-1',
    origem: 'automatico',
    status: 'liberado',
    gravidade: 'estavel',
    texto: 'Tudo bem por aqui.',
    foto: null,
    fotoLegenda: '',
    geradoEm: iso('2026-09-09', 14),
    autorId: null,
    enviadoEm: null,
    exigeLigacao: false,
    ligacaoEm: null,
    ligacaoPor: null,
    ...patch,
  }
}

describe('aprazamento', () => {
  it('gera os horários da frequência a partir do primeiro, até o limite', () => {
    const horarios = horariosDaPrescricao(
      prescricao({ frequenciaHoras: 8, primeiroHorario: iso('2026-09-09', 8) }),
      iso('2026-09-10', 8),
      clock,
    )

    expect(horarios).toEqual([
      iso('2026-09-09', 8),
      iso('2026-09-09', 16),
      iso('2026-09-10', 0),
      iso('2026-09-10', 8),
    ])
  })

  it('respeita o fim da prescrição mesmo quando o horizonte é maior', () => {
    const horarios = horariosDaPrescricao(
      prescricao({ frequenciaHoras: 6, encerraEm: iso('2026-09-09', 20) }),
      iso('2026-09-12', 8),
      clock,
    )

    expect(horarios).toHaveLength(3)
    expect(horarios[horarios.length - 1]).toBe(iso('2026-09-09', 20))
  })

  it('atravessa a virada do dia sem perder horário', () => {
    const horarios = horariosDaPrescricao(
      prescricao({ frequenciaHoras: 4, primeiroHorario: iso('2026-09-09', 22) }),
      iso('2026-09-10', 6),
      clock,
    )

    expect(horarios).toEqual([
      iso('2026-09-09', 22),
      iso('2026-09-10', 2),
      iso('2026-09-10', 6),
    ])
  })

  it('o contínuo também produz horários — é a conferência da bomba, não a dose', () => {
    const horarios = horariosDaPrescricao(
      prescricao({ kind: 'fluido', continuo: true, frequenciaHoras: 4 }),
      iso('2026-09-09', 20),
      clock,
    )

    expect(horarios.length).toBeGreaterThan(1)
  })
})

describe('situação de uma administração', () => {
  const agora = iso('2026-09-09', 14)

  it('é futura antes da janela e entra na janela ao encostar nela', () => {
    expect(
      situacaoDaAdministracao(administracao({ previstaPara: iso('2026-09-09', 16) }), agora),
    ).toBe('futura')

    expect(
      situacaoDaAdministracao(
        administracao({ previstaPara: iso('2026-09-09', 14, JANELA_TOLERANCIA_MINUTOS) }),
        agora,
      ),
    ).toBe('na-janela')
  })

  it('vira atraso só depois da tolerância, e não no minuto seguinte ao previsto', () => {
    const dentro = administracao({
      previstaPara: iso('2026-09-09', 13, 60 - JANELA_TOLERANCIA_MINUTOS),
    })
    const fora = administracao({ previstaPara: iso('2026-09-09', 13, 20) })

    expect(situacaoDaAdministracao(dentro, agora)).toBe('na-janela')
    expect(situacaoDaAdministracao(fora, agora)).toBe('atrasada')
    expect(atrasoEmMinutos(fora, agora)).toBe(40)
    expect(atrasoEmMinutos(dentro, agora)).toBe(0)
  })

  /**
   * O que já foi resolvido não volta a ser julgado pelo relógio.
   *
   * É a razão de `atrasada` não ser um status persistido: uma dose dada com 40 minutos de atraso
   * é "feita", e continua feita amanhã.
   */
  it('o que foi resolvido responde por si, e o relógio não o desfaz', () => {
    for (const status of ['feita', 'pulada', 'recusada', 'suspensa'] as const) {
      expect(
        situacaoDaAdministracao(
          administracao({ status, previstaPara: iso('2026-09-08', 3) }),
          agora,
        ),
      ).toBe(status)
    }
  })
})

describe('plantão', () => {
  it('a madrugada pertence à noite que começou no dia anterior', () => {
    expect(plantaoDe(iso('2026-09-09', 2, 30), clock)).toEqual({
      kind: 'noite',
      data: '2026-09-08',
    })
  })

  it('reconhece os três turnos pelos seus limites', () => {
    expect(plantaoDe(iso('2026-09-09', 7), clock).kind).toBe('manha')
    expect(plantaoDe(iso('2026-09-09', 12, 59), clock).kind).toBe('manha')
    expect(plantaoDe(iso('2026-09-09', 13), clock).kind).toBe('tarde')
    expect(plantaoDe(iso('2026-09-09', 19), clock).kind).toBe('noite')
  })

  it('a noite termina às 7h do dia seguinte', () => {
    expect(limitesDoPlantao('noite', '2026-09-09', clock)).toEqual({
      inicio: iso('2026-09-09', 19),
      fim: iso('2026-09-10', 7),
    })
  })

  it('encadeia os turnos nos dois sentidos, virando o dia na ponta', () => {
    expect(plantaoSeguinte('noite', '2026-09-09')).toEqual({ kind: 'manha', data: '2026-09-10' })
    expect(plantaoAnterior('manha', '2026-09-09')).toEqual({ kind: 'noite', data: '2026-09-08' })
  })

  it('recorta as administrações previstas para dentro da janela do turno', () => {
    const itens = [
      administracao({ id: 'a', previstaPara: iso('2026-09-09', 12, 59) }),
      administracao({ id: 'b', previstaPara: iso('2026-09-09', 13) }),
      administracao({ id: 'c', previstaPara: iso('2026-09-09', 18, 59) }),
      administracao({ id: 'd', previstaPara: iso('2026-09-09', 19) }),
    ]

    expect(
      administracoesDoPlantao(itens, 'tarde', '2026-09-09', clock).map((item) => item.id),
    ).toEqual(['b', 'c'])
  })

  it('nomeia o plantão de forma estável', () => {
    expect(idDoPlantao('tarde', '2026-09-09')).toBe('plantao-2026-09-09-tarde')
  })
})

/**
 * O caso difícil que o requisito nomeia: a troca de plantão no meio de uma medicação.
 *
 * A dose das 19h com a passagem às 19h não é de ninguém — e é assim que ela some. Estes testes
 * fixam a definição estreita: encavala a troca quem cai dentro da tolerância do instante da
 * passagem, e mais ninguém.
 */
describe('a dose em cima da troca de plantão', () => {
  const fim = iso('2026-09-09', 19)

  it('reconhece a dose prevista no minuto exato da passagem', () => {
    expect(atravessaAPassagem(administracao({ previstaPara: fim }), fim)).toBe(true)
  })

  it('reconhece dos dois lados da troca, dentro da tolerância', () => {
    expect(
      atravessaAPassagem(administracao({ previstaPara: iso('2026-09-09', 18, 35) }), fim),
    ).toBe(true)
    expect(
      atravessaAPassagem(administracao({ previstaPara: iso('2026-09-09', 19, 25) }), fim),
    ).toBe(true)
  })

  it('não marca a tarde inteira — fora da tolerância é pendência comum', () => {
    expect(
      atravessaAPassagem(administracao({ previstaPara: iso('2026-09-09', 17) }), fim),
    ).toBe(false)
  })

  it('o que já foi dado não encavala coisa nenhuma', () => {
    expect(atravessaAPassagem(administracao({ previstaPara: fim, status: 'feita' }), fim)).toBe(
      false,
    )
  })

  it('a passagem separa o que se explica do que se decide a dois', () => {
    const pendencias = pendenciasDaPassagem({
      administracoes: [
        administracao({ id: 'atrasada', previstaPara: iso('2026-09-09', 15) }),
        administracao({ id: 'na-troca', previstaPara: iso('2026-09-09', 19) }),
        administracao({ id: 'feita', previstaPara: iso('2026-09-09', 14), status: 'feita' }),
      ],
      kind: 'tarde',
      data: '2026-09-09',
      clock,
      agora: iso('2026-09-09', 18, 45),
      internacoesAbertas: ['int-1', 'int-2'],
      internacoesComEvolucaoNoTurno: ['int-1'],
    })

    expect(pendencias.atrasadas.map((item) => item.id)).toEqual(['atrasada'])
    expect(pendencias.emCimaDaTroca.map((item) => item.id)).toEqual(['na-troca'])
    expect(pendencias.semEvolucao).toEqual(['int-2'])
  })

  /**
   * A dose prevista para **depois** do fim da janela ainda encavala a troca — e precisa aparecer
   * para quem sai. Uma pendência que só o turno seguinte enxerga é uma pendência que ninguém
   * explica.
   */
  it('enxerga a dose logo depois do fim do turno, que a janela do turno não pegaria', () => {
    const pendencias = pendenciasDaPassagem({
      administracoes: [administracao({ id: 'depois', previstaPara: iso('2026-09-09', 19, 20) })],
      kind: 'tarde',
      data: '2026-09-09',
      clock,
      agora: iso('2026-09-09', 18, 50),
      internacoesAbertas: [],
      internacoesComEvolucaoNoTurno: [],
    })

    expect(pendencias.emCimaDaTroca.map((item) => item.id)).toEqual(['depois'])
  })
})

describe('ocupação de leitos', () => {
  const leitos: Leito[] = [
    leito('l1', 'R1', 'geral'),
    leito('l2', 'R2', 'geral'),
    leito('l3', 'I1', 'isolamento', false),
  ]

  const internado: Internacao = {
    id: 'int-1',
    petId: 'pet-1',
    tutorId: 'tutor-1',
    leitoId: 'l1',
    responsavelId: 'prof-ana',
    encounterId: null,
    motivo: 'Pós-operatório',
    diagnostico: 'Fratura',
    entradaEm: iso('2026-09-08', 10),
    altaPrevistaEm: null,
    altaEm: null,
    status: 'internado',
    gravidade: 'estavel',
    pesoEntradaKg: 12,
    observacao: '',
  }

  it('o leito vazio ocupa lugar no mapa — é a informação que falta na lista de internados', () => {
    const mapa = mapaDeLeitos(leitos, [internado])

    expect(mapa).toHaveLength(3)
    expect(mapa[0]?.internacao?.id).toBe('int-1')
    expect(mapa[1]?.internacao).toBeNull()
  })

  it('paciente com alta devolve o leito', () => {
    const mapa = mapaDeLeitos(leitos, [{ ...internado, status: 'alta' }])

    expect(mapa.every((item) => item.internacao === null)).toBe(true)
  })

  it('leito fora de operação não entra na conta de ocupação', () => {
    expect(taxaDeOcupacao(leitos, [internado])).toBe(0.5)
  })
})

/**
 * A regra central: notícia grave não chega por aplicativo sem alguém falar antes.
 */
describe('boletim ao responsável', () => {
  it('piora em qualquer degrau cobra ligação antes', () => {
    expect(exigeLigacaoAntes('estavel', 'atencao')).toBe(true)
    expect(exigeLigacaoAntes('atencao', 'critico')).toBe(true)
    expect(exigeLigacaoAntes('estavel', 'critico')).toBe(true)
    expect(piorou('estavel', 'critico')).toBe(true)
  })

  it('melhora e estabilidade não cobram ligação', () => {
    expect(exigeLigacaoAntes('critico', 'atencao')).toBe(false)
    expect(exigeLigacaoAntes('atencao', 'atencao')).toBe(false)
    expect(exigeLigacaoAntes('estavel', 'estavel')).toBe(false)
  })

  /**
   * Seguir crítico não cobra ligação nova a cada boletim.
   *
   * Exigi-la de hora em hora faria a clínica desligar os boletins do paciente que mais precisa
   * deles — que é como uma regra de segurança acaba produzindo o dano que queria evitar.
   */
  it('seguir crítico não cobra ligação a cada boletim', () => {
    expect(exigeLigacaoAntes('critico', 'critico')).toBe(false)
  })

  it('o primeiro boletim de um paciente que já entrou crítico cobra ligação', () => {
    expect(exigeLigacaoAntes(null, 'critico')).toBe(true)
    expect(exigeLigacaoAntes(null, 'atencao')).toBe(false)
  })

  it('boletim retido não sai enquanto a ligação não for registrada', () => {
    const retido = boletim({ status: 'retido', exigeLigacao: true })

    expect(podeEnviar(retido)).toBe(false)
    expect(impedimentoDeEnvio(retido)).toBe('ligacao-pendente')

    const liberado = { ...retido, status: 'liberado' as const, ligacaoEm: iso('2026-09-09', 15) }

    expect(podeEnviar(liberado)).toBe(true)
  })

  it('boletim já enviado não é enviado de novo', () => {
    expect(impedimentoDeEnvio(boletim({ status: 'enviado' }))).toBe('ja-enviado')
  })
})

describe('frequência do boletim', () => {
  it('reconhece a faixa de silêncio noturno', () => {
    expect(dentroDoSilencioNoturno(iso('2026-09-09', 23), clock)).toBe(true)
    expect(dentroDoSilencioNoturno(iso('2026-09-09', 3), clock)).toBe(true)
    expect(dentroDoSilencioNoturno(iso('2026-09-09', 7), clock)).toBe(false)
    expect(dentroDoSilencioNoturno(iso('2026-09-09', 21, 59), clock)).toBe(false)
  })

  it('de hora em hora sai de hora em hora quando o dia permite', () => {
    expect(
      proximoBoletimEm({
        frequenciaHoras: 1,
        silencioNoturno: true,
        desde: iso('2026-09-09', 14),
        clock,
      }),
    ).toBe(iso('2026-09-09', 15))
  })

  /**
   * O silêncio **junta**, não pula: nove horas sem notícia nenhuma seria pior que a espera.
   */
  it('o que cai na madrugada é adiado para as 7h, não descartado', () => {
    expect(
      proximoBoletimEm({
        frequenciaHoras: 1,
        silencioNoturno: true,
        desde: iso('2026-09-09', 23, 30),
        clock,
      }),
    ).toBe(iso('2026-09-10', 7))

    expect(
      proximoBoletimEm({
        frequenciaHoras: 4,
        silencioNoturno: true,
        desde: iso('2026-09-09', 22),
        clock,
      }),
    ).toBe(iso('2026-09-10', 7))
  })

  it('sem silêncio noturno, a madrugada não muda nada', () => {
    expect(
      proximoBoletimEm({
        frequenciaHoras: 2,
        silencioNoturno: false,
        desde: iso('2026-09-09', 23),
        clock,
      }),
    ).toBe(iso('2026-09-10', 1))
  })

  /** O número que a tela mostra ao lado da escolha, para o susto vir antes de confirmar. */
  it('conta quantas mensagens por dia cada frequência produz', () => {
    expect(boletinsPorDia(1, false)).toBe(24)
    expect(boletinsPorDia(6, false)).toBe(4)
    expect(boletinsPorDia(1, true)).toBe(16)
  })
})
