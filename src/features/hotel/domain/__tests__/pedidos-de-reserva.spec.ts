/**
 * As regras do pedido de reserva: quem divide acomodação, o tipo que um pedido anterior segura, a
 * unidade mais justa para o porte, e o prazo que só anda no horário do balcão.
 */

import { describe, expect, it } from 'vitest'

import { acomodacoesFixture, tiposDeAcomodacaoFixture } from '../../data/fixtures'
import type { PedidoDeReserva } from '../../data/types'
import {
  ehUrgente,
  melhoresAcomodacoes,
  pedidosQueSeguram,
  podemDividir,
  prazoNoBalcao,
  situacaoDoPrazoDaReserva,
  unidadesLivres,
} from '../pedidos-de-reserva'

const OFFSET = '-04:00'
const inicio = `2026-11-10T10:00:00${OFFSET}`
const fim = `2026-11-13T12:00:00${OFFSET}`
const acomodacoes = acomodacoesFixture.filter((item) => item.ativa)

function pedido(parcial: Partial<PedidoDeReserva>): PedidoDeReserva {
  return {
    id: 'p1',
    canal: 'app',
    modo: 'acomodacao-escolhida',
    petId: 'pet-x',
    acompanhantePetId: null,
    tutorId: 't',
    novoCadastro: null,
    entrada: inicio,
    saida: fim,
    tipoId: 'tipo-suite',
    aceitaMudarUmDia: false,
    servicos: [],
    observacao: '',
    status: 'pendente',
    criadoEm: `2026-11-01T09:00:00${OFFSET}`,
    responderAte: `2026-11-01T12:00:00${OFFSET}`,
    respondidoEm: null,
    respondidoPor: null,
    reservaId: null,
    recusa: null,
    ...parcial,
  }
}

function livres(
  pedidos: PedidoDeReserva[],
  extra: Partial<Parameters<typeof unidadesLivres>[0]> = {},
) {
  return unidadesLivres({
    acomodacoes,
    tipos: tiposDeAcomodacaoFixture,
    reservas: [],
    pedidos,
    pets: [{ especie: 'canina', porte: 'medio' }],
    inicio,
    fim,
    ...extra,
  })
}

describe('podemDividir', () => {
  it('dois cães da mesma casa dividem; cão e gato não', () => {
    expect(
      podemDividir([
        { especie: 'canina', porte: 'grande' },
        { especie: 'canina', porte: 'pequeno' },
      ]),
    ).toBe(true)
    expect(
      podemDividir([
        { especie: 'canina', porte: 'grande' },
        { especie: 'felina', porte: null },
      ]),
    ).toBe(false)
  })
})

describe('o pedido pendente segura uma unidade do tipo', () => {
  it('desconta das unidades livres para quem vem depois', () => {
    const semPedido = livres([]).filter((item) => item.tipo.id === 'tipo-suite').length
    const comPedido = livres([pedido({})]).filter((item) => item.tipo.id === 'tipo-suite').length

    expect(comPedido).toBe(semPedido - 1)
  })

  it('quem pediu primeiro leva: o pedido mais novo não tira vaga do mais antigo', () => {
    const antigo = pedido({ id: 'antigo', criadoEm: `2026-11-01T09:00:00${OFFSET}` })
    const novo = pedido({ id: 'novo', criadoEm: `2026-11-01T10:00:00${OFFSET}` })

    expect(
      pedidosQueSeguram([antigo, novo], 'tipo-suite', inicio, fim, 'antigo', antigo.criadoEm),
    ).toBe(0)
    expect(
      pedidosQueSeguram([antigo, novo], 'tipo-suite', inicio, fim, 'novo', novo.criadoEm),
    ).toBe(1)
  })

  it('o pedido que não cruza o período não segura nada', () => {
    const outroMes = pedido({
      entrada: `2026-12-10T10:00:00${OFFSET}`,
      saida: `2026-12-12T10:00:00${OFFSET}`,
    })

    expect(pedidosQueSeguram([outroMes], 'tipo-suite', inicio, fim)).toBe(0)
  })
})

describe('melhoresAcomodacoes', () => {
  it('o tipo pedido vem primeiro', () => {
    const [primeira] = melhoresAcomodacoes({
      acomodacoes,
      tipos: tiposDeAcomodacaoFixture,
      reservas: [],
      pedidos: [],
      pets: [{ especie: 'canina', porte: 'medio' }],
      inicio,
      fim,
      tipoPreferido: 'tipo-suite',
      aceitaMudarUmDia: false,
      limite: 3,
    })

    expect(primeira?.tipo.id).toBe('tipo-suite')
  })

  it('sem preferência, a mais justa para o porte: o cão pequeno não ocupa a baia de gigante', () => {
    const [primeira] = melhoresAcomodacoes({
      acomodacoes,
      tipos: tiposDeAcomodacaoFixture,
      reservas: [],
      pedidos: [],
      pets: [{ especie: 'canina', porte: 'pequeno' }],
      inicio,
      fim,
      tipoPreferido: null,
      aceitaMudarUmDia: false,
      limite: 3,
    })

    expect(primeira?.acomodacao.porteMaximo).toBe('medio')
  })

  it('gato só vai para onde aceita gato', () => {
    const sugestoes = melhoresAcomodacoes({
      acomodacoes,
      tipos: tiposDeAcomodacaoFixture,
      reservas: [],
      pedidos: [],
      pets: [{ especie: 'felina', porte: null }],
      inicio,
      fim,
      tipoPreferido: null,
      aceitaMudarUmDia: false,
      limite: 10,
    })

    expect(sugestoes.length).toBeGreaterThan(0)
    expect(
      sugestoes.every(
        (item) =>
          item.acomodacao.especiesAceitas.includes('felina') ||
          item.acomodacao.especiesAceitas.length === 0,
      ),
    ).toBe(true)
  })
})

describe('prazo e urgência', () => {
  const balcao = { abre: '08:00', fecha: '20:00' }

  it('o pedido da noite vence na manhã seguinte', () => {
    expect(prazoNoBalcao(`2026-11-02T19:00:00${OFFSET}`, 3, balcao)).toBe(
      `2026-11-03T10:00:00${OFFSET}`,
    )
  })

  it('o pedido da madrugada começa a contar quando o balcão abre', () => {
    expect(prazoNoBalcao(`2026-11-02T03:00:00${OFFSET}`, 3, balcao)).toBe(
      `2026-11-02T11:00:00${OFFSET}`,
    )
  })

  it('situação do prazo: meia hora final chama atenção', () => {
    const p = pedido({ responderAte: `2026-11-02T12:00:00${OFFSET}` })

    expect(situacaoDoPrazoDaReserva(p, `2026-11-02T11:00:00${OFFSET}`)).toBe('no-prazo')
    expect(situacaoDoPrazoDaReserva(p, `2026-11-02T11:45:00${OFFSET}`)).toBe('vencendo')
    expect(situacaoDoPrazoDaReserva(p, `2026-11-02T12:05:00${OFFSET}`)).toBe('atrasado')
  })

  it('entrada antes da antecedência é urgência — vai por telefone', () => {
    expect(ehUrgente(`2026-11-02T20:00:00${OFFSET}`, `2026-11-02T08:00:00${OFFSET}`, 24)).toBe(true)
    expect(ehUrgente(`2026-11-04T20:00:00${OFFSET}`, `2026-11-02T08:00:00${OFFSET}`, 24)).toBe(
      false,
    )
  })
})
