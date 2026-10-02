/**
 * Regra R1 — a porta de entrada é sanitária.
 *
 * O que estes testes protegem é o caso que o módulo inteiro existe para não errar: a carteira que
 * **vale hoje e vence antes da saída**. Checar contra hoje aprova a reserva e devolve o problema
 * três dias depois, com o responsável a 600 km dali — e a tela não teria como saber que errou.
 */

import { describe, expect, it } from 'vitest'

import { addDays } from '@/features/clinico/domain/clinic-time'

import { avaliarAdmissao, piorSituacao, validadeDe } from '../admissao'
import type { Comprovante, Exigencia } from '../../data/types'

const HOJE = '2026-06-10'

const antirrabica: Exigencia = {
  kind: 'vacina-antirrabica',
  especies: ['canina', 'felina'],
  validadeMeses: 12,
  bloqueia: true,
}

const giardia: Exigencia = {
  kind: 'vacina-giardia',
  especies: ['canina'],
  validadeMeses: 12,
  bloqueia: false,
}

const termo: Exigencia = {
  kind: 'termo-responsabilidade',
  especies: [],
  validadeMeses: null,
  bloqueia: true,
}

function comprovante(kind: Comprovante['kind'], validoAte: string | null): Comprovante {
  return {
    id: `comp-${kind}`,
    petId: 'pet-1',
    kind,
    apresentadoEm: addDays(HOJE, -30),
    validoAte,
    documento: 'Lote X',
    observacao: '',
  }
}

function avaliar(comprovantes: Comprovante[], saida: string, exigencias = [antirrabica]) {
  return avaliarAdmissao({
    exigencias,
    comprovantes,
    petId: 'pet-1',
    especie: 'canina',
    saidaPrevista: saida,
    hoje: HOJE,
  })
}

describe('a validade é medida contra a saída, não contra hoje', () => {
  it('libera o que cobre o período inteiro', () => {
    const resultado = avaliar(
      [comprovante('vacina-antirrabica', addDays(HOJE, 40))],
      addDays(HOJE, 20),
    )

    expect(resultado.liberada).toBe(true)
    expect(resultado.itens[0]?.situacao).toBe('ok')
  })

  it('marca como "vence-durante" o que vale hoje e não alcança a saída', () => {
    /*
     * O caso. A vacina está válida — se a checagem fosse contra hoje, a reserva passaria. Vence no
     * dia 17 e a estadia vai até o dia 25.
     */
    const resultado = avaliar(
      [comprovante('vacina-antirrabica', addDays(HOJE, 7))],
      addDays(HOJE, 15),
    )

    expect(resultado.itens[0]?.situacao).toBe('vence-durante')
    expect(resultado.itens[0]?.diasDeFolga).toBe(-8)
  })

  it('"vence-durante" avisa e **não** bloqueia', () => {
    /*
     * De propósito: o animal pode entrar, basta que o reforço aconteça antes da data. Travar a
     * entrada de hoje por uma validade que expira daqui a cinco dias empurraria a casa a dispensar
     * a exigência inteira — que é o comportamento que a dispensa nominal existe para tornar raro.
     */
    const resultado = avaliar(
      [comprovante('vacina-antirrabica', addDays(HOJE, 3))],
      addDays(HOJE, 10),
    )

    expect(resultado.liberada).toBe(true)
    expect(resultado.avisos).toHaveLength(1)
    expect(resultado.impedimentos).toHaveLength(0)
  })

  it('bloqueia o que já venceu de verdade', () => {
    const resultado = avaliar(
      [comprovante('vacina-antirrabica', addDays(HOJE, -1))],
      addDays(HOJE, 10),
    )

    expect(resultado.itens[0]?.situacao).toBe('vencido')
    expect(resultado.liberada).toBe(false)
  })

  it('bloqueia o que nunca foi apresentado', () => {
    const resultado = avaliar([], addDays(HOJE, 10))

    expect(resultado.itens[0]?.situacao).toBe('ausente')
    expect(resultado.liberada).toBe(false)
  })
})

describe('o que bloqueia e o que apenas avisa', () => {
  it('exigência não bloqueante ausente vira aviso, não impedimento', () => {
    const resultado = avaliar(
      [comprovante('vacina-antirrabica', addDays(HOJE, 60))],
      addDays(HOJE, 5),
      [antirrabica, giardia],
    )

    expect(resultado.liberada).toBe(true)
    expect(resultado.avisos.map((item) => item.kind)).toEqual(['vacina-giardia'])
  })

  it('exigência de outra espécie não entra na conta', () => {
    /* Tosse dos canis é só para cão; um gato não pode ser recusado por não tê-la. */
    const resultado = avaliarAdmissao({
      exigencias: [giardia],
      comprovantes: [],
      petId: 'pet-1',
      especie: 'felina',
      saidaPrevista: addDays(HOJE, 5),
      hoje: HOJE,
    })

    expect(resultado.itens).toHaveLength(0)
    expect(resultado.liberada).toBe(true)
  })

  it('documento sem validade basta ter sido apresentado', () => {
    const resultado = avaliar([comprovante('termo-responsabilidade', null)], addDays(HOJE, 300), [
      termo,
    ])

    expect(resultado.itens[0]?.situacao).toBe('ok')
  })
})

describe('dispensa nominal', () => {
  it('libera o bloqueio, e guarda quem autorizou', () => {
    const resultado = avaliarAdmissao({
      exigencias: [antirrabica],
      comprovantes: [],
      petId: 'pet-1',
      especie: 'canina',
      saidaPrevista: addDays(HOJE, 5),
      hoje: HOJE,
      dispensas: [
        {
          kind: 'vacina-antirrabica',
          motivo: 'Carteira em poder do veterinário; foto conferida por WhatsApp.',
          autorizadaPor: 'eq-helena',
          autorizadaEm: `${HOJE}T09:00:00-04:00`,
        },
      ],
    })

    expect(resultado.liberada).toBe(true)
    expect(resultado.itens[0]?.situacao).toBe('dispensado')
    /** O ponto da dispensa: ela não apaga o fato de não haver papel. */
    expect(resultado.itens[0]?.comprovante).toBeNull()
    expect(resultado.itens[0]?.dispensa?.autorizadaPor).toBe('eq-helena')
  })
})

describe('o comprovante que vale é o mais recente', () => {
  it('o reforço deste ano manda, e não a carteira do ano passado', () => {
    const antigo = comprovante('vacina-antirrabica', addDays(HOJE, -200))
    const novo: Comprovante = {
      ...comprovante('vacina-antirrabica', addDays(HOJE, 300)),
      id: 'comp-novo',
      apresentadoEm: addDays(HOJE, -5),
    }

    /* Fora de ordem de propósito: a ordenação é do domínio, não do chamador. */
    const resultado = avaliar([novo, antigo], addDays(HOJE, 10))

    expect(resultado.itens[0]?.situacao).toBe('ok')
    expect(resultado.itens[0]?.comprovante?.id).toBe('comp-novo')
  })
})

describe('a pior situação do conjunto', () => {
  it('põe o que nunca chegou à frente do que só precisa ser renovado', () => {
    /* Documento ausente depende de alguém achar um papel; vencido depende de uma data. */
    const resultado = avaliar([], addDays(HOJE, 5), [antirrabica, giardia])

    expect(piorSituacao(resultado.itens)).toBe('ausente')
  })

  it('devolve "ok" para o conjunto vazio', () => {
    expect(piorSituacao([])).toBe('ok')
  })
})

describe('validade a partir da apresentação', () => {
  it('doze meses caem perto de um ano', () => {
    /* 12 × 30,4 dias arredonda para 365 — perto o bastante, e sem 29 de fevereiro no caminho. */
    expect(validadeDe('2026-03-14', 12)).toBe('2027-03-14')
    expect(validadeDe('2026-03-14', 6)).toBe('2026-09-12')
  })

  it('sem validade em meses, não há data', () => {
    expect(validadeDe('2026-03-14', null)).toBeNull()
  })
})
