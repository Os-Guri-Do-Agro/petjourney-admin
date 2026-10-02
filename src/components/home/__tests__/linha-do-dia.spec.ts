import { describe, expect, it } from 'vitest'

import {
  compromissosDoDia,
  contarPorEstado,
  estadoDoAtendimento,
  movimentoAtrasado,
  somarDias,
  type ContaDoDia,
  type EstadoDaConta,
  type MovimentoDoDia,
} from '../linha-do-dia'

/** Um instante na parede da clínica, no dia do teste. */
function iso(relogio: string, dia = '2026-09-28') {
  return `${dia}T${relogio}:00-04:00`
}

function conta(
  id: string,
  inicio: string,
  fim: string,
  estado: EstadoDaConta = 'marcado',
): ContaDoDia {
  return {
    id,
    inicio: iso(inicio),
    fim: iso(fim),
    estado,
    petNome: id,
    petIniciais: '',
    petEspecie: null,
    petFotoUrl: '',
    tipo: '',
    profissional: '',
    chegadaEm: null,
    rota: '',
  }
}

function movimento(id: string, quando: string, tipo: MovimentoDoDia['tipo'] = 'chegada') {
  return {
    id,
    tipo,
    quando: iso(quando),
    petNome: id,
    petIniciais: '',
    petEspecie: null,
    petFotoUrl: '',
    detalhe: '',
    travado: false,
    rota: '',
  } satisfies MovimentoDoDia
}

describe('estadoDoAtendimento', () => {
  it('traduz cada status da agenda para o estado da linha', () => {
    expect(estadoDoAtendimento('finalizado')).toBe('feito')
    expect(estadoDoAtendimento('em-atendimento')).toBe('agora')
    expect(estadoDoAtendimento('aguardando')).toBe('esperando')
    expect(estadoDoAtendimento('falta')).toBe('falta')
    expect(estadoDoAtendimento('agendado')).toBe('marcado')
    expect(estadoDoAtendimento('confirmado')).toBe('marcado')
  })

  it('deixa o cancelado de fora: horário que deixou de existir não enche o dia', () => {
    expect(estadoDoAtendimento('cancelado')).toBeNull()
  })
})

describe('somarDias', () => {
  it('anda para frente e para trás atravessando mês e ano', () => {
    expect(somarDias('2026-09-28', 3)).toBe('2026-10-01')
    expect(somarDias('2026-01-01', -1)).toBe('2025-12-31')
    expect(somarDias('2026-09-28', 0)).toBe('2026-09-28')
  })
})

describe('compromissos do dia', () => {
  const contas = [
    conta('feita', '08:00', '08:30', 'feito'),
    conta('faltou', '08:30', '09:00', 'falta'),
    conta('depois', '11:00', '11:30', 'marcado'),
    conta('esperando', '10:40', '11:00', 'esperando'),
    conta('atendendo', '09:45', '10:30', 'agora'),
  ]

  function ids(lista: ReturnType<typeof compromissosDoDia>) {
    return lista.map((item) => (item.tipo === 'conta' ? item.conta.id : item.movimento.id))
  }

  it('hoje: em atendimento, atraso do hotel, recepção e o que vem, sem o que já terminou', () => {
    const movimentos = [movimento('fim', '17:00'), movimento('manha', '09:00')]

    expect(ids(compromissosDoDia(contas, movimentos, iso('10:12')))).toEqual([
      'atendendo',
      'manha',
      'esperando',
      'depois',
      'fim',
    ])
  })

  it('entre os que esperam, quem chegou primeiro vai primeiro', () => {
    const cedo = { ...conta('cedo', '11:00', '11:30', 'esperando'), chegadaEm: iso('10:20') }
    const tarde = { ...conta('tarde', '10:40', '11:00', 'esperando'), chegadaEm: iso('10:35') }

    expect(ids(compromissosDoDia([tarde, cedo], [], iso('10:50')))).toEqual(['cedo', 'tarde'])
  })

  it('o movimento atrasado vem marcado como atraso; o que ainda vem, não', () => {
    const [atrasado, porVir] = compromissosDoDia(
      [],
      [movimento('tarde', '14:00', 'saida'), movimento('manha', '09:00')],
      iso('10:12'),
    )

    expect(atrasado).toMatchObject({ movimento: { id: 'manha' }, atrasado: true })
    expect(porVir).toMatchObject({ movimento: { id: 'tarde' }, atrasado: false })
  })

  it('em outro dia, tudo pela hora, inclusive o que já terminou', () => {
    expect(ids(compromissosDoDia(contas, [movimento('chegada', '09:15')], null))).toEqual([
      'feita',
      'faltou',
      'chegada',
      'atendendo',
      'esperando',
      'depois',
    ])
  })

  it('conta cada estado', () => {
    expect(contarPorEstado(contas)).toEqual({
      feito: 1,
      agora: 1,
      esperando: 1,
      marcado: 1,
      falta: 1,
    })
  })

  it('movimento do hotel com o horário vencido é atraso', () => {
    expect(movimentoAtrasado(movimento('manha', '09:00'), iso('10:12'))).toBe(true)
    expect(movimentoAtrasado(movimento('tarde', '14:00'), iso('10:12'))).toBe(false)
    expect(movimentoAtrasado(movimento('manha', '09:00'), null)).toBe(false)
  })
})
