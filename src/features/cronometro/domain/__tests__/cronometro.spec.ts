/**
 * A conta do cronômetro é a que vira dinheiro. Cada regra do modelo de cobrança por tempo tem
 * um caso aqui — inclusive as que parecem óbvias, porque é justamente a borda do incremento que
 * ninguém confere na tela e todo mundo confere na fatura.
 */

import { describe, expect, it } from 'vitest'

import {
  encerrarSessao,
  formatarDuracao,
  LIMITE_DE_SESSAO_ESQUECIDA_MS,
  medirSessao,
  pausarSessao,
  retomarSessao,
  totalDecorridoMs,
  totalDeMinutosCobraveis,
  unidadesCobraveis,
  type SessaoCronometro,
} from '../cronometro'

const T0 = Date.parse('2026-08-26T09:00:00Z')
const MINUTO = 60_000

function sessao(patch: Partial<SessaoCronometro> = {}): SessaoCronometro {
  return {
    encounterId: 'enc-1',
    rotulo: 'Rex',
    correndoDesde: T0,
    acumuladoMs: 0,
    iniciadaEm: T0,
    blocoMinutos: 15,
    incrementoMinutos: 15,
    ...patch,
  }
}

describe('unidades cobráveis', () => {
  /** Regra do modelo: começar o relógio já compromete uma unidade. */
  it('cobra uma unidade a partir do primeiro segundo', () => {
    expect(unidadesCobraveis(0, 15)).toBe(1)
    expect(unidadesCobraveis(1_000, 15)).toBe(1)
  })

  it('não vira de unidade no minuto exato do incremento', () => {
    expect(unidadesCobraveis(15 * MINUTO, 15)).toBe(1)
    expect(unidadesCobraveis(15 * MINUTO + 1, 15)).toBe(2)
  })

  it('arredonda sempre para cima', () => {
    expect(unidadesCobraveis(16 * MINUTO, 15)).toBe(2)
    expect(unidadesCobraveis(29 * MINUTO, 15)).toBe(2)
    expect(unidadesCobraveis(31 * MINUTO, 15)).toBe(3)
  })

  /** Décimo de hora: a unidade padrão do serviço profissional. */
  it('trabalha em décimos de hora quando o incremento é de seis minutos', () => {
    expect(unidadesCobraveis(6 * MINUTO, 6)).toBe(1)
    expect(unidadesCobraveis(7 * MINUTO, 6)).toBe(2)
    expect(unidadesCobraveis(60 * MINUTO, 6)).toBe(10)
  })

  /** Configuração inválida não pode virar `Infinity` no meio de uma fatura. */
  it('devolve zero em vez de dividir por zero', () => {
    expect(unidadesCobraveis(10 * MINUTO, 0)).toBe(0)
  })
})

describe('medição da sessão', () => {
  it('mede por relógio de parede, e não por soma de tiques', () => {
    const medicao = medirSessao(sessao(), T0 + 7 * MINUTO + 30_000)

    expect(medicao.decorridoMs).toBe(7 * MINUTO + 30_000)
    expect(medicao.correndo).toBe(true)
  })

  it('congela o decorrido enquanto pausada', () => {
    const pausada = pausarSessao(sessao(), T0 + 5 * MINUTO)

    expect(medirSessao(pausada, T0 + 60 * MINUTO).decorridoMs).toBe(5 * MINUTO)
    expect(medirSessao(pausada, T0 + 60 * MINUTO).correndo).toBe(false)
  })

  /** O tempo fora da sala não é atendimento — é a razão de a pausa existir. */
  it('não conta o intervalo entre pausar e retomar', () => {
    const pausada = pausarSessao(sessao(), T0 + 5 * MINUTO)
    const retomada = retomarSessao(pausada, T0 + 20 * MINUTO)

    expect(medirSessao(retomada, T0 + 23 * MINUTO).decorridoMs).toBe(8 * MINUTO)
  })

  /**
   * Dois cliques no mesmo botão não podem mexer no relógio.
   *
   * Pausar duas vezes descontaria o intervalo entre os cliques; retomar duas vezes reiniciaria o
   * trecho e apagaria o que já corria. As duas chamadas repetidas são inertes: cinco minutos
   * antes da pausa, três depois de retomar.
   */
  it('ignora pausa repetida e retomada repetida', () => {
    const pausada = pausarSessao(pausarSessao(sessao(), T0 + 5 * MINUTO), T0 + 9 * MINUTO)
    const retomada = retomarSessao(retomarSessao(pausada, T0 + 10 * MINUTO), T0 + 12 * MINUTO)

    expect(medirSessao(retomada, T0 + 13 * MINUTO).decorridoMs).toBe(8 * MINUTO)
  })

  describe('bloco contratado', () => {
    it('avisa dois minutos antes de o bloco acabar', () => {
      expect(medirSessao(sessao(), T0 + 12 * MINUTO).estado).toBe('dentro')
      expect(medirSessao(sessao(), T0 + 13 * MINUTO).estado).toBe('no-limite')
      expect(medirSessao(sessao(), T0 + 15 * MINUTO + 1).estado).toBe('excedido')
    })

    it('mede o excedente a partir do fim do bloco', () => {
      const medicao = medirSessao(sessao(), T0 + 18 * MINUTO)

      expect(medicao.excedenteMs).toBe(3 * MINUTO)
    })

    /**
     * Bloco de 15 com incremento de 15, aos 16 minutos: duas unidades no total, **uma** delas
     * excedente. Contar as unidades do excedente isolado daria uma unidade e esconderia que a
     * segunda inteira já foi comprada.
     */
    it('conta como excedente a unidade acima das que o bloco já cobria', () => {
      const medicao = medirSessao(sessao(), T0 + 16 * MINUTO)

      expect(medicao.unidades).toBe(2)
      expect(medicao.unidadesExcedentes).toBe(1)
    })

    it('não tem excedente enquanto está dentro do bloco', () => {
      const medicao = medirSessao(sessao(), T0 + 9 * MINUTO)

      expect(medicao.excedenteMs).toBe(0)
      expect(medicao.unidadesExcedentes).toBe(0)
    })

    it('satura a fração do bloco em um, para servir de barra', () => {
      expect(medirSessao(sessao(), T0 + 30 * MINUTO).fracaoDoBloco).toBe(1)
      expect(medirSessao(sessao(), T0 + 15 * MINUTO / 2).fracaoDoBloco).toBeCloseTo(0.5, 5)
    })

    /** Sem bloco não existe "estourar o bloco" — só o relógio correndo. */
    it('fica sempre dentro quando não há bloco configurado', () => {
      const medicao = medirSessao(sessao({ blocoMinutos: 0 }), T0 + 90 * MINUTO)

      expect(medicao.estado).toBe('dentro')
      expect(medicao.fracaoDoBloco).toBe(0)
    })
  })

  describe('virada da próxima unidade', () => {
    it('conta o incremento inteiro no instante zero', () => {
      expect(medirSessao(sessao(), T0).ateProximaUnidadeMs).toBe(15 * MINUTO)
    })

    it('chega a zero no instante exato da virada', () => {
      expect(medirSessao(sessao(), T0 + 15 * MINUTO).ateProximaUnidadeMs).toBe(0)
    })

    it('recomeça a contar depois de virar', () => {
      expect(medirSessao(sessao(), T0 + 16 * MINUTO).ateProximaUnidadeMs).toBe(14 * MINUTO)
    })
  })

  describe('sessão esquecida', () => {
    it('desconfia do relógio que corre além do plausível', () => {
      expect(medirSessao(sessao(), T0 + LIMITE_DE_SESSAO_ESQUECIDA_MS).esquecida).toBe(true)
      expect(medirSessao(sessao(), T0 + LIMITE_DE_SESSAO_ESQUECIDA_MS - 1).esquecida).toBe(false)
    })

    /** Pausada, alguém já mexeu nela: não foi esquecida, foi deixada de lado. */
    it('não acusa sessão pausada', () => {
      const pausada = pausarSessao(
        sessao(),
        T0 + LIMITE_DE_SESSAO_ESQUECIDA_MS + 10 * MINUTO,
      )

      expect(medirSessao(pausada, T0 + 48 * 60 * MINUTO).esquecida).toBe(false)
    })
  })
})

describe('encerramento', () => {
  it('arquiva o decorrido e o faturável do momento em que parou', () => {
    const resumo = encerrarSessao(sessao(), T0 + 16 * MINUTO, 'cron-1')

    expect(resumo).toMatchObject({
      id: 'cron-1',
      encounterId: 'enc-1',
      rotulo: 'Rex',
      decorridoMs: 16 * MINUTO,
      unidades: 2,
      minutosCobraveis: 30,
      excedenteMs: MINUTO,
      encerradaEm: T0 + 16 * MINUTO,
    })
  })

  it('encerra uma sessão pausada pelo tempo acumulado, não pelo relógio', () => {
    const pausada = pausarSessao(sessao(), T0 + 4 * MINUTO)
    const resumo = encerrarSessao(pausada, T0 + 90 * MINUTO, 'cron-2')

    expect(resumo.decorridoMs).toBe(4 * MINUTO)
    expect(resumo.unidades).toBe(1)
  })
})

describe('totais do dia', () => {
  const sessoes = [
    encerrarSessao(sessao(), T0 + 16 * MINUTO, 'a'),
    encerrarSessao(sessao({ incrementoMinutos: 6 }), T0 + 7 * MINUTO, 'b'),
  ]

  it('soma o decorrido real e o faturável separadamente', () => {
    expect(totalDecorridoMs(sessoes)).toBe(23 * MINUTO)
    /** 30 min faturáveis na primeira (2 × 15) e 12 na segunda (2 × 6). */
    expect(totalDeMinutosCobraveis(sessoes)).toBe(42)
  })
})

describe('formatação', () => {
  it('mostra minutos e segundos até a primeira hora', () => {
    expect(formatarDuracao(0)).toBe('00:00')
    expect(formatarDuracao(9 * MINUTO + 5_000)).toBe('09:05')
    expect(formatarDuracao(59 * MINUTO + 59_000)).toBe('59:59')
  })

  it('acrescenta a hora só quando ela existe', () => {
    expect(formatarDuracao(60 * MINUTO)).toBe('1:00:00')
    expect(formatarDuracao(125 * MINUTO + 7_000)).toBe('2:05:07')
  })

  it('não desenha tempo negativo', () => {
    expect(formatarDuracao(-5_000)).toBe('00:00')
  })
})
