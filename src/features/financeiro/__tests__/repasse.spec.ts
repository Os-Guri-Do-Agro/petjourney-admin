import { describe, expect, it } from 'vitest'

import {
  calcularRepasse,
  devidoDaConta,
  totalDaConta,
  type Conta,
  type ItemDaConta,
  type Pagamento,
  type RegraDeRepasse,
} from '../dados'

function item(
  tipo: ItemDaConta['tipo'],
  preco: number,
  profissionalId: string | null,
  quantidade = 1,
): ItemDaConta {
  return {
    id: `${tipo}-${preco}`,
    precoId: tipo,
    nome: tipo,
    tipo,
    quantidade,
    preco,
    profissionalId,
  }
}

function pagamento(valor: number, forma: Pagamento['forma'] = 'pix', taxa = 0): Pagamento {
  return {
    id: `p-${valor}`,
    forma,
    valor,
    parcelas: 1,
    data: '2026-11-10',
    hora: '10:00',
    taxa,
    por: 'teste',
  }
}

function conta(dados: Partial<Conta> & Pick<Conta, 'itens'>): Conta {
  return {
    id: `c-${Math.random()}`,
    data: '2026-11-10',
    hora: '10:00',
    origem: 'atendimento',
    petId: 'pet',
    petNome: 'Luna',
    especie: 'canina',
    fotoUrl: '',
    tutorId: 'tutor',
    tutorNome: 'Marina',
    profissionalId: 'vet',
    desconto: 0,
    pagamentos: [],
    situacao: 'paga',
    vencimento: null,
    lembretes: [],
    reciboNoApp: true,
    nota: true,
    ...dados,
  }
}

const base: RegraDeRepasse = {
  profissionalId: 'vet',
  vinculo: 'PJ',
  modelo: 'percentual',
  percentuais: { consulta: 0.4, exame: 0.2 },
  valorPorDia: 0,
  valorPorProcedimento: 0,
  procedimento: 'consulta',
  base: 'liquido',
  chavePix: 'x',
}

describe('repasse do veterinário', () => {
  it('tira o desconto e a taxa do cartão antes da porcentagem, e só conta o que é dele', () => {
    const c = conta({
      itens: [
        item('consulta', 20000, 'vet'),
        item('exame', 10000, 'vet'),
        item('produto', 5000, null),
      ],
      desconto: 3500, // 10% de 35.000
      pagamentos: [pagamento(31500, 'credito', 0.03)],
    })
    const r = calcularRepasse(base, '2026-11', { contas: [c], adiantamentos: [] }, '2026-11-30')
    // consulta: 20.000 × 0,9 × 0,97 × 40% = 6.984; exame: 10.000 × 0,9 × 0,97 × 20% = 1.746
    expect(r.bruto).toBe(6984 + 1746)
    expect(r.producao).toBe(30000)
    expect(r.aguardando).toBe(0)
  })

  it('conta em aberto aparece no extrato, mas só entra quando o cliente paga', () => {
    const paga = conta({ itens: [item('consulta', 18000, 'vet')], pagamentos: [pagamento(18000)] })
    const aberta = conta({
      itens: [item('consulta', 18000, 'vet')],
      situacao: 'em-aberto',
      vencimento: '2026-11-25',
    })
    const r = calcularRepasse(
      { ...base, base: 'cobrado' },
      '2026-11',
      { contas: [paga, aberta], adiantamentos: [] },
      '2026-11-30',
    )
    expect(r.linhas).toHaveLength(2)
    expect(r.bruto).toBe(7200)
    expect(r.aguardando).toBe(7200)
  })

  it('o adiantamento sai do mês', () => {
    const c = conta({ itens: [item('consulta', 18000, 'vet')], pagamentos: [pagamento(18000)] })
    const r = calcularRepasse(
      { ...base, base: 'cobrado' },
      '2026-11',
      {
        contas: [c],
        adiantamentos: [
          { id: 'a', profissionalId: 'vet', data: '2026-11-05', valor: 5000, nota: '' },
        ],
      },
      '2026-11-30',
    )
    expect(r.aReceber).toBe(7200 - 5000)
  })

  it('por dia: um valor fixo por dia com atendimento, não importa quantos', () => {
    const contas = [
      conta({ data: '2026-11-03', itens: [item('consulta', 26000, 'vet')] }),
      conta({ data: '2026-11-03', itens: [item('exame', 32000, 'vet')] }),
      conta({ data: '2026-11-05', itens: [item('consulta', 26000, 'vet')] }),
    ]
    const r = calcularRepasse(
      { ...base, modelo: 'por-dia', valorPorDia: 70000 },
      '2026-11',
      { contas, adiantamentos: [] },
      '2026-11-30',
    )
    expect(r.linhas).toHaveLength(2)
    expect(r.bruto).toBe(140000)
  })

  it('por procedimento: só o procedimento combinado, vezes a quantidade', () => {
    const c = conta({ itens: [item('anestesia', 35000, 'vet', 2), item('medicacao', 3500, 'vet')] })
    const r = calcularRepasse(
      {
        ...base,
        modelo: 'por-procedimento',
        procedimento: 'anestesia',
        valorPorProcedimento: 25000,
      },
      '2026-11',
      { contas: [c], adiantamentos: [] },
      '2026-11-30',
    )
    expect(r.bruto).toBe(50000)
  })
})

describe('conta', () => {
  it('o devido é o total menos o que entrou; "em aberto" não é pagamento', () => {
    const c = conta({
      itens: [item('consulta', 18000, 'vet'), item('produto', 4500, null, 2)],
      desconto: 2000,
      pagamentos: [pagamento(10000), { ...pagamento(5000), forma: 'em-aberto' }],
    })
    expect(totalDaConta(c)).toBe(25000)
    expect(devidoDaConta(c)).toBe(15000)
  })
})
