import { describe, expect, it } from 'vitest'

import { horarioDoItem, iniciaisDe } from '@/components/meu-dia/useMeuDiaDaClinica'

import { PERIODOS_DO_RESUMO, totalDoBloco } from '../painel-service'

describe('painéis da clínica', () => {
  it('bloco ausente, que falhou ou sem total não vira zero', () => {
    expect(totalDoBloco(undefined)).toBeNull()
    expect(totalDoBloco({ total: null, itens: [], truncado: false, falhou: true })).toBeNull()
    expect(totalDoBloco({ total: 3, itens: [], truncado: false, falhou: false })).toBe('3')
    expect(totalDoBloco({ total: 500, itens: [], truncado: true, falhou: false })).toBe('500+')
  })

  it('os literais do portal viram o enum da API em maiúsculo', () => {
    expect(PERIODOS_DO_RESUMO['trinta-dias']).toBe('TRINTA_DIAS')
    expect(PERIODOS_DO_RESUMO['semana-passada']).toBe('SEMANA_PASSADA')
  })

  it('o item do Meu dia vira o horário do desenho, com a chegada da sala de espera', () => {
    const chegadas = new Map([['a1', '2026-11-06T09:05:00-04:00']])
    expect(
      horarioDoItem(
        { id: 'a1', pacienteId: 'p1', quando: '2026-11-06T09:00:00-04:00', status: 'AGUARDANDO' },
        chegadas,
      ),
    ).toEqual({
      id: 'a1',
      petId: 'p1',
      status: 'aguardando',
      inicio: '2026-11-06T09:00:00-04:00',
      chegadaEm: '2026-11-06T09:05:00-04:00',
      iniciadoEm: null,
    })
    expect(horarioDoItem({ id: 'a2', status: 'EM_ATENDIMENTO' }, chegadas).status).toBe(
      'em-atendimento',
    )
  })

  it('as iniciais pegam o primeiro e o último nome', () => {
    expect(iniciaisDe('Bob Esponja')).toBe('BE')
    expect(iniciaisDe('Paçoca')).toBe('P')
    expect(iniciaisDe('Thor da Silva Teste')).toBe('TT')
  })
})
