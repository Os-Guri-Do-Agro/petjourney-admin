/**
 * A proposta de rotina, e sobretudo a parede em volta dela.
 *
 * O teste que mais importa aqui não é o que prova que a máquina sugere bem: é o que prova que ela
 * **não consegue** inventar medicação, nem quando o motor tenta.
 */
import { describe, expect, it } from 'vitest'

import type { ClockTime, ISODateTime, ItemDeRotina, MedicacaoDaEstadia } from '../../data/types'
import {
  aprovaveis,
  proporRotina,
  validarProposta,
  type EntradaDaProposta,
} from '../rotina-sugerida'

const AGORA = '2026-09-22T15:00:00-03:00' as ISODateTime

const CASA: ItemDeRotina[] = [
  { id: 'a', kind: 'agua', horarios: ['07:00', '12:00'] as ClockTime[], exigeAutorizacao: null, ativo: true },
  { id: 'h', kind: 'higiene', horarios: ['09:00'] as ClockTime[], exigeAutorizacao: null, ativo: true },
  {
    id: 'p',
    kind: 'passeio',
    horarios: ['10:00'] as ClockTime[],
    exigeAutorizacao: 'passeio-externo',
    ativo: true,
  },
]

const medicacao = (over: Partial<MedicacaoDaEstadia> = {}): MedicacaoDaEstadia => ({
  id: 'med-1',
  hospedagemId: 'h1',
  descricao: 'Apoquel 16 mg',
  via: 'oral',
  doseTexto: '1 comprimido',
  horarios: ['08:00', '20:00'] as ClockTime[],
  inicio: '2026-09-20',
  fim: null,
  receita: 'CRMV-SP 12345',
  observacao: '',
  suspensaEm: null,
  ...over,
})

const entrada = (over: Partial<EntradaDaProposta> = {}): EntradaDaProposta => ({
  hospedagemId: 'h1',
  especie: 'canina',
  adaptacao: 'tranquilo',
  inspecaoDeEntrada: '',
  noites: 3,
  passeioAutorizado: true,
  medicacoes: [],
  horariosDeRefeicao: ['08:00', '18:00'] as ClockTime[],
  rotinaDaCasa: CASA,
  ...over,
})

describe('a parede da medicação', () => {
  it('nunca compõe medicação: quando existe, ela sai transcrita da receita', () => {
    const proposta = proporRotina(entrada({ medicacoes: [medicacao()] }), AGORA)

    const doses = proposta.sugestoes.filter((item) => item.kind === 'medicacao')

    expect(doses).toHaveLength(1)
    expect(doses[0]!.estado).toBe('transcrita')
    expect(doses[0]!.horarios).toEqual(['08:00', '20:00'])
  })

  it('nenhuma sugestão de medicação é aprovável', () => {
    const proposta = proporRotina(entrada({ medicacoes: [medicacao()] }), AGORA)

    expect(aprovaveis(proposta).some((item) => item.kind === 'medicacao')).toBe(false)
  })

  it('a recusa é dita mesmo quando o animal não toma remédio nenhum', () => {
    /* A ausência calada faria quem aprova supor que a máquina olhou e não achou nada. */
    const proposta = proporRotina(entrada({ medicacoes: [] }), AGORA)

    expect(proposta.recusas).toContain('medicacao-nao-se-propoe')
  })

  it('o validador descarta a dose que o motor inventou, e conta', () => {
    /* Simula um modelo que devolveu um fármaco que não está na ficha. */
    const dados = entrada({ medicacoes: [medicacao()] })
    const proposta = proporRotina(dados, AGORA)

    const adulterada = {
      ...proposta,
      sugestoes: [
        ...proposta.sugestoes,
        {
          id: 'inventada',
          kind: 'medicacao' as const,
          horarios: ['06:00'] as ClockTime[],
          estado: 'sugerida' as const,
          porque: [],
        },
      ],
    }

    const limpa = validarProposta(adulterada, dados)

    expect(limpa.sugestoes.find((item) => item.id === 'inventada')).toBeUndefined()
    expect(limpa.descartadas).toBe(1)
  })

  it('o validador descarta horário malformado', () => {
    const dados = entrada()
    const proposta = proporRotina(dados, AGORA)

    const adulterada = {
      ...proposta,
      sugestoes: [
        {
          id: 'torta',
          kind: 'agua' as const,
          horarios: ['99:99'] as ClockTime[],
          estado: 'sugerida' as const,
          porque: [],
        },
      ],
    }

    expect(validarProposta(adulterada, dados).sugestoes).toHaveLength(0)
  })
})

describe('toda sugestão cita um registro da casa', () => {
  it('a higiene extra cita a frase da inspeção de entrada', () => {
    const proposta = proporRotina(
      entrada({ inspecaoDeEntrada: 'Pelo sujo, patas com barro' }),
      AGORA,
    )

    const sugerida = aprovaveis(proposta).find((item) => item.kind === 'higiene')

    expect(sugerida).toBeDefined()
    expect(sugerida!.porque[0]!.fonte).toBe('inspecao-de-entrada')
    expect(sugerida!.porque[0]!.valor).toContain('barro')
  })

  it('sem sujeira na inspeção, não propõe higiene extra', () => {
    const proposta = proporRotina(entrada({ inspecaoDeEntrada: 'Sem alterações' }), AGORA)

    expect(aprovaveis(proposta).some((item) => item.kind === 'higiene')).toBe(false)
  })

  it('a pesagem do meio cita a duração da estadia', () => {
    const proposta = proporRotina(entrada({ noites: 8 }), AGORA)

    const pesagem = aprovaveis(proposta).find((item) => item.kind === 'pesagem')

    expect(pesagem).toBeDefined()
    expect(pesagem!.porque[0]!.fonte).toBe('estadia-longa')
  })

  it('estadia curta não ganha pesagem no meio', () => {
    expect(
      aprovaveis(proporRotina(entrada({ noites: 2 }), AGORA)).some(
        (item) => item.kind === 'pesagem',
      ),
    ).toBe(false)
  })
})

describe('o que a casa já faz entra como contexto, não como decisão', () => {
  it('a rotina da casa vem herdada e não é aprovável', () => {
    const proposta = proporRotina(entrada(), AGORA)

    const herdadas = proposta.sugestoes.filter((item) => item.estado === 'herdada')

    expect(herdadas.length).toBeGreaterThan(0)
    expect(aprovaveis(proposta).some((item) => item.estado === 'herdada')).toBe(false)
  })

  it('passeio não é herdado por quem não tem autorização', () => {
    const proposta = proporRotina(entrada({ passeioAutorizado: false }), AGORA)

    expect(proposta.sugestoes.some((item) => item.kind === 'passeio')).toBe(false)
  })

  it('o motor se identifica', () => {
    /* A tela mostra qual motor falou. Hoje é a simulação; amanhã é o nome do modelo. */
    expect(proporRotina(entrada(), AGORA).motor).toBe('simulacao-local')
  })
})

describe('as sugestões discutíveis, que são o motivo de a revisão existir', () => {
  it('o carrapato achado na chegada pede um olhar a mais na acomodação', () => {
    /* Não é só sujeira: parasita que entrou com o animal pode estar na caminha e na baia. */
    const proposta = proporRotina(
      entrada({ inspecaoDeEntrada: 'Carrapato na orelha direita, removido na chegada.' }),
      AGORA,
    )

    const higiene = aprovaveis(proposta).find((item) => item.kind === 'higiene')

    expect(higiene).toBeDefined()
    expect(higiene!.porque[0]!.valor).toContain('Carrapato')
  })

  it('o animal em adaptação ganha uma proposta de passeio — que pode muito bem ser recusada', () => {
    const proposta = proporRotina(entrada({ adaptacao: 'em-adaptacao' }), AGORA)

    expect(aprovaveis(proposta).some((item) => item.kind === 'passeio')).toBe(true)
  })

  it('sem autorização do responsável, passeio não é proposto nem para quem se adapta', () => {
    /* A autorização é parede: a casa não decide passeio por ninguém. */
    const proposta = proporRotina(
      entrada({ adaptacao: 'estressado', passeioAutorizado: false }),
      AGORA,
    )

    expect(aprovaveis(proposta).some((item) => item.kind === 'passeio')).toBe(false)
  })

  it('o animal tranquilo não recebe proposta de passeio', () => {
    expect(
      aprovaveis(proporRotina(entrada({ adaptacao: 'tranquilo' }), AGORA)).some(
        (item) => item.kind === 'passeio',
      ),
    ).toBe(false)
  })
})
