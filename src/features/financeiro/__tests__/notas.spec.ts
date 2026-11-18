import { describe, expect, it } from 'vitest'

import type { Conta, ItemDaConta } from '../dados'
import {
  configuracaoInicial,
  gerarNotas,
  issDaNota,
  prazoParaCancelar,
  precisaDeNota,
  problemaDoTomador,
  RECUSA_CPF_INVALIDO,
  RECUSA_SEM_CPF,
  valorDosServicos,
  type NotaFiscal,
  type TomadorDaNota,
} from '../notas'

const HOJE = '2026-11-18'
const CPF_VALIDO = '529.982.247-25'

function item(tipo: ItemDaConta['tipo'], preco: number, quantidade = 1): ItemDaConta {
  return {
    id: `${tipo}-${preco}`,
    precoId: tipo,
    nome: tipo === 'produto' ? 'Antipulgas' : `Serviço ${tipo}`,
    tipo,
    quantidade,
    preco,
    profissionalId: tipo === 'produto' ? null : 'vet',
  }
}

function conta(dados: Partial<Conta> & Pick<Conta, 'id'>): Conta {
  return {
    data: '2026-11-10',
    hora: '10:00',
    origem: 'atendimento',
    petId: 'pet',
    petNome: 'Luna',
    especie: 'canina',
    fotoUrl: '',
    tutorId: 'tutor',
    tutorNome: 'Marina Alves',
    profissionalId: 'vet',
    itens: [item('consulta', 18000)],
    desconto: 0,
    pagamentos: [
      {
        id: `p-${dados.id}`,
        forma: 'pix',
        valor: 18000,
        parcelas: 1,
        data: dados.data ?? '2026-11-10',
        hora: '10:35',
        taxa: 0,
        por: 'recepção',
      },
    ],
    situacao: 'paga',
    vencimento: null,
    lembretes: [],
    reciboNoApp: true,
    nota: true,
    ...dados,
  }
}

function nota(dados: Partial<NotaFiscal>): NotaFiscal {
  return {
    id: 'n',
    contaId: 'c',
    numero: 1,
    serieRps: 'A',
    numeroRps: 1,
    emitidaEm: HOJE,
    hora: '10:00',
    competencia: HOJE,
    tomador: { nome: 'Marina', cpf: CPF_VALIDO, email: '', tutorId: 'tutor' },
    petNome: 'Luna',
    itens: [],
    foraDaNota: [],
    codigoDoServico: '5.01',
    valorDosServicos: 18000,
    desconto: 0,
    aliquota: 0.0201,
    codigoDeVerificacao: 'ABCD-EFGH',
    situacao: 'autorizada',
    recusa: null,
    cancelamento: null,
    envio: null,
    substitui: null,
    ...dados,
  }
}

/** Dez dias de contas pagas, seis por dia, a última de cada dia com desconto. */
function semanaDeContas(): Conta[] {
  const contas: Conta[] = []
  for (let d = 9; d >= 0; d--) {
    const data = `2026-11-${String(18 - d).padStart(2, '0')}`
    for (let i = 0; i < 6; i++) {
      const id = `c-${data}-${i}`
      const hora = `${String(9 + i).padStart(2, '0')}:00`
      contas.push(
        conta({
          id,
          data,
          hora,
          itens: [item('consulta', 18000), item('exame', 7500), item('produto', 12900)],
          desconto: i === 5 ? 1000 : 0,
          pagamentos: [
            {
              id: `p-${id}`,
              forma: 'pix',
              valor: 37400,
              parcelas: 1,
              data,
              hora: `${String(9 + i).padStart(2, '0')}:30`,
              taxa: 0,
              por: 'recepção',
            },
          ],
        }),
      )
    }
  }
  return contas
}

const tomadorDe = (c: Conta): TomadorDaNota => ({
  nome: c.tutorNome,
  cpf: CPF_VALIDO,
  email: 'marina@exemplo.com',
  tutorId: c.tutorId,
})

describe('nota fiscal de serviço', () => {
  it('recusa o tomador sem CPF ou com CPF que não confere', () => {
    expect(problemaDoTomador({ cpf: '' })).toBe(RECUSA_SEM_CPF)
    expect(problemaDoTomador({ cpf: '529.982.247-52' })).toBe(RECUSA_CPF_INVALIDO)
    expect(problemaDoTomador({ cpf: CPF_VALIDO })).toBeNull()
  })

  it('deixa o produto fora e leva para a nota só a parte do desconto que é dos serviços', () => {
    const c = conta({
      id: 'x',
      itens: [item('consulta', 18000), item('produto', 2000)],
      desconto: 1000,
    })
    expect(valorDosServicos(c)).toEqual({ servicos: 18000, desconto: 900 })
  })

  it('calcula o ISS sobre o valor com desconto, arredondado ao centavo', () => {
    expect(issDaNota({ valorDosServicos: 18000, desconto: 900, aliquota: 0.0201 })).toBe(344)
  })

  it('deixa cancelar até o dia 10 do mês seguinte ao da emissão', () => {
    expect(prazoParaCancelar({ emitidaEm: '2026-11-18' })).toBe('2026-12-10')
    expect(prazoParaCancelar({ emitidaEm: '2026-12-02' })).toBe('2027-01-10')
  })

  it('põe na fila só a conta paga, com serviço e sem nota de pé', () => {
    const paga = conta({ id: 'a' })
    expect(precisaDeNota(paga, [])).toBe(true)
    expect(precisaDeNota(paga, [nota({ situacao: 'autorizada' })])).toBe(false)
    expect(precisaDeNota(paga, [nota({ situacao: 'rejeitada' })])).toBe(false)
    const porErro = nota({
      situacao: 'cancelada',
      cancelamento: { tipo: 'erro', motivo: 'x', data: HOJE, hora: '10:00', por: 'x' },
    })
    expect(precisaDeNota(paga, [porErro])).toBe(true)
    const naoPrestado = nota({
      situacao: 'cancelada',
      cancelamento: { tipo: 'nao-prestado', motivo: 'x', data: HOJE, hora: '10:00', por: 'x' },
    })
    expect(precisaDeNota(paga, [naoPrestado])).toBe(false)
    expect(precisaDeNota(conta({ id: 'b', itens: [item('produto', 4500)] }), [])).toBe(false)
    expect(precisaDeNota(conta({ id: 'c', situacao: 'em-aberto' }), [])).toBe(false)
  })

  it('gera as notas do protótipo com um pouco de cada situação, sempre iguais', () => {
    const config = configuracaoInicial(HOJE)
    const primeira = gerarNotas(semanaDeContas(), HOJE, { ...config }, tomadorDe)
    const segunda = gerarNotas(semanaDeContas(), HOJE, { ...config }, tomadorDe)
    expect(segunda.notas).toEqual(primeira.notas)

    const quantas = (s: NotaFiscal['situacao']) =>
      primeira.notas.filter((n) => n.situacao === s).length
    expect(quantas('processando')).toBe(2)
    expect(quantas('rejeitada')).toBe(2)
    expect(quantas('cancelada')).toBe(1)
    expect(primeira.notas.filter((n) => n.substitui)).toHaveLength(1)
    /* 60 contas, 4 sem nota, e a cancelada ganhou a nota certa: 57 notas. */
    expect(primeira.notas).toHaveLength(57)

    const recusas = primeira.notas.filter((n) => n.situacao === 'rejeitada').map((n) => n.recusa)
    expect(recusas.sort()).toEqual([RECUSA_CPF_INVALIDO, RECUSA_SEM_CPF].sort())
  })

  it('numera o RPS de todas e o número da nota só das que a prefeitura autorizou', () => {
    const config = configuracaoInicial(HOJE)
    const { notas, proximoRps, proximoNumero } = gerarNotas(
      semanaDeContas(),
      HOJE,
      { ...config },
      tomadorDe,
    )
    const rps = notas.map((n) => n.numeroRps)
    expect(rps).toEqual(rps.map((_, i) => config.proximoRps + i))
    expect(proximoRps).toBe(config.proximoRps + notas.length)

    const numeradas = notas.filter((n) => n.numero !== null)
    expect(numeradas.every((n) => n.situacao === 'autorizada' || n.situacao === 'cancelada')).toBe(
      true,
    )
    expect(new Set(numeradas.map((n) => n.numero)).size).toBe(numeradas.length)
    expect(proximoNumero).toBe(Math.max(...numeradas.map((n) => n.numero!)) + 1)
    expect(numeradas.every((n) => /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(n.codigoDeVerificacao!))).toBe(
      true,
    )
  })

  it('marca sem nota as contas da fila "A emitir"', () => {
    const contas = semanaDeContas()
    gerarNotas(contas, HOJE, configuracaoInicial(HOJE), tomadorDe)
    const semNota = contas.filter((c) => !c.nota)
    expect(semNota).toHaveLength(4)
    expect(semNota.every((c) => c.data >= '2026-11-15' && c.data < HOJE)).toBe(true)
  })
})
