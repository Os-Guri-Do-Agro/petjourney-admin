import { describe, expect, it } from 'vitest'

import {
  chaveDaRecusa,
  chaveDoConflito,
  chaveDoMotivo,
  comMaiuscula,
  conflitosQueAvisam,
  diaCurto,
  diaLongo,
} from '../leitura-do-pedido'

describe('leitura do pedido', () => {
  it('o dia sai da data civil, sem fuso do navegador', () => {
    expect(diaLongo('2026-11-06', 'pt-BR')).toBe('sexta-feira, 6 de novembro')
    expect(comMaiuscula(diaLongo('2026-11-06', 'pt-BR'), 'pt-BR')).toBe(
      'Sexta-feira, 6 de novembro',
    )
    expect(diaCurto('2026-11-09', 'pt-BR')).toMatch(/^Seg\.?, 09\/11$/)
  })

  it('motivo e recusa caem nas chaves dos textos da demonstração', () => {
    expect(chaveDoMotivo('CHECKUP')).toBe('clinico.pedidos.motivo.checkup')
    expect(chaveDaRecusa('SEM_HORARIO')).toBe('clinico.pedidos.recusa.motivo.sem-horario')
    expect(chaveDaRecusa('SERVICO_INDISPONIVEL')).toBe(
      'clinico.pedidos.recusa.motivo.servico-indisponivel',
    )
  })

  it('conflito pelo kind, com genérico para o desconhecido; info não avisa', () => {
    expect(chaveDoConflito({ kind: 'professional-overlap' })).toBe(
      'pedidos.caixa.conflito.professional-overlap',
    )
    expect(chaveDoConflito({ kind: 'novo-kind' as never })).toBe('pedidos.caixa.conflito.outro')
    expect(
      conflitosQueAvisam([
        { kind: 'lunch-overlap', severity: 'info', params: {} },
        { kind: 'outside-hours', severity: 'warning', params: {} },
      ]).map((conflito) => conflito.kind),
    ).toEqual(['outside-hours'])
  })
})
