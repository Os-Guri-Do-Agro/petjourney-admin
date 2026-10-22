import { describe, expect, it } from 'vitest'

import type { Pendencia } from '@/service/parceiro/pendencias-service'

import {
  pendenciasComValor,
  rotaNoPortal,
  selosPorRota,
  tomDaPendencia,
} from '../usePendenciasDoPortal'

function pendencia(extra: Partial<Pendencia> & Pick<Pendencia, 'chave'>): Pendencia {
  return { modulo: 'PORTAL', valor: 1, tom: 'NEUTRO', rota: '/parceiro/equipe', ...extra }
}

describe('usePendenciasDoPortal', () => {
  it('deixa de fora o zero e o contador que falhou', () => {
    const lista = [
      pendencia({ chave: 'convitesPendentes', valor: 0 }),
      pendencia({ chave: 'acessosTemporariosAtivos', valor: null, rota: '/parceiro/acessos' }),
      pendencia({ chave: 'agendamentosSemConfirmacao', valor: 3, rota: '/clinica/agenda' }),
    ]

    expect(pendenciasComValor(lista).map((item) => item.chave)).toEqual([
      'agendamentosSemConfirmacao',
    ])
    expect([...selosPorRota(lista).keys()]).toEqual(['/clinica/agenda'])
  })

  it('soma os contadores da mesma rota e fica com o tom mais grave', () => {
    const selos = selosPorRota([
      pendencia({ chave: 'pedidos', valor: 2, tom: 'ATENCAO', rota: '/clinica/agenda' }),
      pendencia({ chave: 'atrasados', valor: 1, tom: 'RISCO', rota: '/clinica/agenda' }),
      pendencia({ chave: 'convitesPendentes', valor: 1 }),
    ])

    expect(selos.get('/clinica/agenda')).toEqual({
      total: 3,
      tom: 'risco',
      partes: [
        { chave: 'pedidos', total: 2 },
        { chave: 'atrasados', total: 1 },
      ],
    })
    expect(selos.get('/parceiro/equipe')).toMatchObject({ total: 1, tom: 'neutro' })
  })

  it('traduz o tom da API para a escada do portal', () => {
    expect(tomDaPendencia('NEUTRO')).toBe('neutro')
    expect(tomDaPendencia('ATENCAO')).toBe('atencao')
    expect(tomDaPendencia('RISCO')).toBe('risco')
  })

  it('leva a rota antiga da clínica ao endereço atual, e só ela', () => {
    expect(rotaNoPortal('/veterinario/agenda')).toBe('/clinica/agenda')
    expect(rotaNoPortal('/veterinario')).toBe('/clinica')
    expect(rotaNoPortal('/veterinarios/agenda')).toBe('/veterinarios/agenda')
    expect(rotaNoPortal('/parceiro/equipe')).toBe('/parceiro/equipe')
  })
})
