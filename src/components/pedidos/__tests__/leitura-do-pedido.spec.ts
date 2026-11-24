import { describe, expect, it } from 'vitest'

import type { PacienteNaLista } from '@/service/parceiro/pacientes-service'

import {
  chaveDaRecusa,
  chaveDoConflito,
  chaveDoMotivo,
  clientesDoTelefone,
  comMaiuscula,
  conflitosQueAvisam,
  diaCurto,
  diaLongo,
  fichasParecidas,
  mesmoTelefone,
  vinculoDoAceite,
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

function paciente(
  id: string,
  nome: string,
  cliente: { id: string; nome: string; telefone: string | null },
  extra: Partial<PacienteNaLista> = {},
): PacienteNaLista {
  return {
    id,
    nome,
    especie: 'CACHORRO',
    especieOutra: null,
    raca: null,
    sexo: null,
    nascimento: null,
    nascimentoEstimado: false,
    porte: null,
    ativo: true,
    inativoMotivo: null,
    obitoEm: null,
    temFoto: false,
    fotoUrl: null,
    codigoNaOrigem: null,
    cliente: { ...cliente, contatoPreferido: 'WHATSAPP' },
    alertas: [],
    ...extra,
  }
}

describe('o cadastro que a clínica já tem (pedido pelo link)', () => {
  const ana = { id: 'c-ana', nome: 'Ana Souza', telefone: '5511970002411' }
  const copia = { id: 'c-copia', nome: 'Ana  souza', telefone: '11970002411' }
  const outro = { id: 'c-outro', nome: 'Bruno', telefone: '5511970002412' }

  it('o telefone é o mesmo com ou sem o código do país, e nunca sem DDD', () => {
    expect(mesmoTelefone('5511970002411', '(11) 97000-2411')).toBe(true)
    expect(mesmoTelefone('5511970002411', '5511970002412')).toBe(false)
    expect(mesmoTelefone('970002411', '5511970002411')).toBe(false)
    expect(mesmoTelefone(null, '5511970002411')).toBe(false)
  })

  it('agrupa as fichas ativas por cliente do mesmo telefone, com o de nome igual primeiro', () => {
    const clientes = clientesDoTelefone(
      [
        paciente('p-outro', 'Rex', outro),
        paciente('p-copia', 'Paçoca', copia),
        paciente('p-pacoca', 'Paçoca', ana),
        paciente('p-nina', 'Nina', ana, { especie: 'GATO' }),
        paciente('p-velho', 'Tico', ana, { ativo: false }),
      ],
      '5511970002411',
      'ANA SOUZA',
    )

    expect(clientes.map((cliente) => cliente.id)).toEqual(['c-copia', 'c-ana'])
    expect(clientes[1]!.fichas.map((ficha) => ficha.id)).toEqual(['p-pacoca', 'p-nina'])
  })

  it('liga cada pet à ficha de mesmo nome e espécie, sem repetir a ficha', () => {
    const fichas = [
      { id: 'p-pacoca', nome: 'Paçoca', especie: 'CACHORRO' as const, fotoUrl: null },
      { id: 'p-nina', nome: 'Nina', especie: 'GATO' as const, fotoUrl: null },
    ]

    expect(
      fichasParecidas(
        [
          { pedidoId: 'g1', nome: 'pacoca', especie: 'CACHORRO' },
          { pedidoId: 'g2', nome: 'Paçoca', especie: 'CACHORRO' },
          { pedidoId: 'g3', nome: 'Nina', especie: 'CACHORRO' },
        ],
        fichas,
      ),
    ).toEqual({ g1: 'p-pacoca', g2: null, g3: null })
  })

  it('o vincularA leva o cliente e só as fichas que já existem; sem cliente, nada', () => {
    expect(vinculoDoAceite('c-ana', { g1: 'p-pacoca', g2: null })).toEqual({
      clienteId: 'c-ana',
      pacientes: [{ pedidoId: 'g1', pacienteId: 'p-pacoca' }],
    })
    expect(vinculoDoAceite('c-ana', { g1: null })).toEqual({ clienteId: 'c-ana' })
    expect(vinculoDoAceite(null, { g1: 'p-pacoca' })).toBeUndefined()
  })
})
