/**
 * Os pedidos de reserva que o balcão encontra ao abrir a tela.
 *
 * - **Thor** e **Cacau** — suíte escolhida para o mesmo fim de semana, e cabem.
 * - **Luna** — também quer suíte, mas pediu depois: com o Maximiliano na S2 e os dois pedidos
 *   anteriores segurando as outras, não sobra suíte. É o "esgotou enquanto eu pedia" do hotel, e a
 *   linha já sugere a baia que serve.
 * - **Bento e Açaí** — os dois da casa do João, na mesma acomodação, e o hotel escolhe.
 * - **Bolota** — pelo link, de quem não tem o app: cadastro mínimo e primeira hospedagem.
 * - **Nina** e **Zeus** — respondidos hoje: uma reserva aceita esperando sinal, uma recusa por
 *   vacina vencida.
 *
 * A Luciana (Mel e Amora, dois cães que dividem baia) e a Renata (Fubá, primeira estadia e
 * cadastro sem porte) ficam de fora: são as duas pessoas da demonstração no celular.
 */

import { addDays, createClinicClock } from '@/features/clinico/domain/clinic-time'
import { contasSoNoApp as contasDaClinica } from '@/features/clinico/data/seed-pedidos'

import { prazoNoBalcao } from '../domain/pedidos-de-reserva'
import { contarDiarias } from '../domain/hotel-time'
import { montarOrcamento } from '../domain/tarifas'

import { HOTEL_UTC_OFFSET } from './fixtures'
import type { Pet, Tutor } from '@/features/clinico/data/types'

import type {
  Acomodacao,
  Hotel,
  ISODate,
  ISODateTime,
  PedidoDeReserva,
  Reserva,
  ReservaOnline,
  Servico,
  Tarifa,
  Temporada,
} from './types'

const clock = createClinicClock(HOTEL_UTC_OFFSET)

export const SLUG_DO_HOTEL = 'petjourney-hotel'

export function reservaOnlinePadrao(): ReservaOnline {
  return {
    ativo: true,
    permiteEscolherAcomodacao: true,
    permiteHotelEscolhe: true,
    tipoIds: ['tipo-baia', 'tipo-suite', 'tipo-gatil', 'tipo-coletiva'],
    antecedenciaMinimaHoras: 24,
    horizonteDias: 90,
    prazoDeRespostaHoras: 3,
    balcao: { abre: '08:00', fecha: '20:00' },
    slug: SLUG_DO_HOTEL,
    urgencia: {
      telefone: '(11) 3555-0188',
      whatsapp: '(11) 95555-0188',
      orientacao:
        'Para hoje ou amanhã, ligue: a recepção vê na hora se há vaga e o que o pet precisa trazer. Carteira de vacinação em mãos ajuda.',
    },
  }
}

/**
 * A conta do app que o hotel ainda não conhece: a mesma Renata da clínica, com o Fubá sem porte
 * no cadastro. O hotel precisa do porte para saber onde ele cabe — é o "cadastro incompleto" daqui.
 */
export function contasSoNoAppDoHotel(): Array<{ tutor: Tutor; pets: Pet[] }> {
  return contasDaClinica()
}

function minutosAntes(agora: ISODateTime, minutos: number): ISODateTime {
  const parede = clock.toWall(agora)

  return clock.toIso(parede.date, parede.minutes - minutos)
}

function em(data: ISODate, hora: number): ISODateTime {
  return clock.toIso(data, hora * 60)
}

type Entrada = {
  ancora: ISODate
  agora: ISODateTime
  hotel: Hotel
  configuracao: ReservaOnline
  acomodacoes: Acomodacao[]
  tarifas: Tarifa[]
  temporadas: Temporada[]
  servicos: Servico[]
  pets: Pet[]
}

function base(
  entrada: Entrada,
  dados: Partial<PedidoDeReserva> &
    Pick<PedidoDeReserva, 'id' | 'canal' | 'modo' | 'entrada' | 'saida' | 'criadoEm'>,
): PedidoDeReserva {
  return {
    petId: null,
    acompanhantePetId: null,
    tutorId: null,
    novoCadastro: null,
    tipoId: null,
    aceitaMudarUmDia: false,
    servicos: [],
    observacao: '',
    status: 'pendente',
    responderAte: prazoNoBalcao(
      dados.criadoEm,
      entrada.configuracao.prazoDeRespostaHoras,
      entrada.configuracao.balcao,
    ),
    respondidoEm: null,
    respondidoPor: null,
    reservaId: null,
    recusa: null,
    ...dados,
  }
}

export function semearPedidosDeReserva(entrada: Entrada): {
  pedidos: PedidoDeReserva[]
  reservas: Reserva[]
  tokens: Record<string, string>
} {
  const { ancora, agora } = entrada
  const fimDeSemana = { entrada: em(addDays(ancora, 9), 10), saida: em(addDays(ancora, 12), 18) }

  const pedidos: PedidoDeReserva[] = [
    base(entrada, {
      id: 'pedido-res-thor',
      canal: 'app',
      modo: 'acomodacao-escolhida',
      petId: 'pet-thor',
      tutorId: 'tutor-eduardo',
      tipoId: 'tipo-suite',
      ...fimDeSemana,
      servicos: ['banho'],
      observacao: 'Ele tem medo de trovão. Se chover, deixa a luz acesa, por favor.',
      criadoEm: minutosAntes(agora, 170),
    }),
    base(entrada, {
      id: 'pedido-res-cacau',
      canal: 'app',
      modo: 'acomodacao-escolhida',
      petId: 'pet-cacau',
      tutorId: 'tutor-ana-lu',
      tipoId: 'tipo-suite',
      entrada: em(addDays(ancora, 10), 9),
      saida: em(addDays(ancora, 12), 12),
      criadoEm: minutosAntes(agora, 95),
    }),
    base(entrada, {
      id: 'pedido-res-luna',
      canal: 'app',
      modo: 'acomodacao-escolhida',
      petId: 'pet-luna',
      tutorId: 'tutor-marina',
      tipoId: 'tipo-suite',
      ...fimDeSemana,
      observacao: 'Primeira vez dela num hotel, prefiro suíte com câmera.',
      criadoEm: minutosAntes(agora, 35),
    }),
    base(entrada, {
      id: 'pedido-res-joao',
      canal: 'app',
      modo: 'hotel-escolhe',
      petId: 'pet-bento',
      acompanhantePetId: 'pet-acai',
      tutorId: 'tutor-joao',
      entrada: em(addDays(ancora, 5), 8),
      saida: em(addDays(ancora, 8), 17),
      aceitaMudarUmDia: true,
      servicos: ['passeio-extra'],
      observacao: 'Os dois dormem juntos em casa.',
      criadoEm: minutosAntes(agora, 60),
    }),
    base(entrada, {
      id: 'pedido-res-bolota',
      canal: 'link',
      modo: 'acomodacao-escolhida',
      tipoId: 'tipo-baia',
      novoCadastro: {
        nome: 'Marcos Tavares',
        telefone: '(11) 96655-2210',
        petNome: 'Bolota',
        especie: 'canina',
        porte: 'pequeno',
      },
      entrada: em(addDays(ancora, 20), 9),
      saida: em(addDays(ancora, 23), 18),
      servicos: ['banho', 'tosa'],
      observacao: 'Nunca ficou em hotel. Come ração úmida.',
      criadoEm: minutosAntes(agora, 140),
    }),
  ]

  /* Nina: aceita hoje cedo, numa baia do canil B — a reserva espera o sinal. */
  const nina = entrada.pets.find((pet) => pet.id === 'pet-nina')
  const baiaB = entrada.acomodacoes.find((item) => item.id === 'acom-b3')
  const tarifa = entrada.tarifas.find((item) => item.id === baiaB?.tarifaId)
  const reservas: Reserva[] = []

  if (nina && baiaB && tarifa) {
    const periodo = { entrada: em(addDays(ancora, 30), 9), saida: em(addDays(ancora, 33), 12) }
    const criadoEm = minutosAntes(agora, 240)
    const respondidoEm = minutosAntes(agora, 200)
    const orcamento = montarOrcamento({
      entrada: periodo.entrada,
      saida: periodo.saida,
      tarifa,
      porte: nina.porte,
      temporadas: entrada.temporadas,
      servicos: [],
      catalogoDeServicos: entrada.servicos,
      politica: entrada.hotel.politica,
    })

    reservas.push({
      id: 'res-do-pedido-nina',
      petId: nina.id,
      tutorId: nina.tutorId,
      acompanhantePetId: null,
      acomodacaoId: baiaB.id,
      entradaPrevista: periodo.entrada,
      saidaPrevista: periodo.saida,
      diarias: contarDiarias(periodo.entrada, periodo.saida),
      status: 'pendente',
      origem: 'app',
      servicos: [],
      orcamento,
      pagoCentavos: 0,
      observacao: '',
      autorizadosARetirar: [],
      dispensas: [],
      criadoEm: respondidoEm,
      atualizadoEm: respondidoEm,
      canceladaEm: null,
      motivoCancelamento: null,
    })

    pedidos.push(
      base(entrada, {
        id: 'pedido-res-nina',
        canal: 'app',
        modo: 'acomodacao-escolhida',
        petId: nina.id,
        tutorId: nina.tutorId,
        tipoId: 'tipo-baia',
        ...periodo,
        criadoEm,
        status: 'aceito',
        respondidoEm,
        respondidoPor: 'recepcao',
        reservaId: 'res-do-pedido-nina',
      }),
    )
  }

  pedidos.push(
    base(entrada, {
      id: 'pedido-res-zeus',
      canal: 'app',
      modo: 'hotel-escolhe',
      petId: 'pet-zeus',
      tutorId: 'tutor-rita',
      entrada: em(addDays(ancora, 6), 9),
      saida: em(addDays(ancora, 9), 12),
      criadoEm: minutosAntes(agora, 300),
      status: 'recusado',
      respondidoEm: minutosAntes(agora, 280),
      respondidoPor: 'recepcao',
      recusa: {
        motivo: 'exigencias',
        mensagem:
          'Oi, Rita! A antirrábica do Zeus vence antes da entrada, e sem ela não podemos receber. Com a dose em dia, é só pedir de novo que a vaga ainda está aberta.',
      },
    }),
  )

  return { pedidos, reservas, tokens: { 'pedido-res-bolota': 'h4m8x2' } }
}
