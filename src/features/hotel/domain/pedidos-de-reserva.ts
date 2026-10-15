/**
 * Pedido de reserva — as regras que o app, o link e o balcão do hotel precisam fazer igual.
 *
 * O irmão do pedido de horário da clínica (`features/clinico/domain/pedidos.ts`), com o que muda
 * num hotel: o que se escolhe é o **tipo** de acomodação (a suíte, não a suíte 3), a vaga é medida
 * por noites e não por meia hora, e dois pets da mesma casa dividem a mesma acomodação em vez de
 * irem um depois do outro.
 *
 * A vaga usa a mesma função que pinta o mapa e recusa a reserva (`domain/disponibilidade.ts`):
 * uma terceira conta divergiria no primeiro feriado.
 */

import { addDays, clockToMinutes, createClinicClock } from '@/features/clinico/domain/clinic-time'

import type {
  Acomodacao,
  ClockTime,
  ISODateTime,
  PedidoDeReserva,
  PetPorte,
  PetSpecies,
  Reserva,
  TipoDeAcomodacao,
} from '../data/types'

import { avaliarVaga, porteCabe } from './disponibilidade'
import { cruzam } from './hotel-time'

/** Um pet como a conta da vaga o vê: o porte e a espécie decidem onde cabe. */
export type PetDaVaga = { porte: PetPorte | null; especie: PetSpecies }

/**
 * Dois pets dividem acomodação? Só da mesma espécie — cão e gato da mesma casa ficam em blocos
 * diferentes, por mais que durmam juntos em casa: o gato que ouve latido a noite inteira não come.
 */
export function podemDividir(pets: PetDaVaga[]): boolean {
  return pets.length <= 1 || pets.every((pet) => pet.especie === pets[0]!.especie)
}

/** O maior porte do grupo: é ele que a acomodação precisa comportar. */
function maiorPorte(pets: PetDaVaga[]): PetPorte | null {
  const ordem: PetPorte[] = ['mini', 'pequeno', 'medio', 'grande', 'gigante']
  const portes = pets.map((pet) => pet.porte).filter((porte): porte is PetPorte => porte !== null)

  return portes.sort((a, b) => ordem.indexOf(b) - ordem.indexOf(a))[0] ?? null
}

/**
 * O pedido pendente de tipo escolhido segura uma unidade daquele tipo.
 *
 * Por tipo, e não por unidade: o hotel ainda não decidiu qual suíte é. Sem isto, três pessoas
 * veriam "1 suíte livre" no mesmo fim de semana e três pedidos chegariam para a mesma suíte.
 */
export function pedidosQueSeguram(
  pedidos: PedidoDeReserva[],
  tipoId: string,
  entrada: ISODateTime,
  saida: ISODateTime,
  ignorarPedidoId: string | null = null,
  chegouAntesDe: ISODateTime | null = null,
): number {
  return pedidos.filter(
    (pedido) =>
      pedido.status === 'pendente' &&
      pedido.modo === 'acomodacao-escolhida' &&
      pedido.tipoId === tipoId &&
      pedido.id !== ignorarPedidoId &&
      (chegouAntesDe === null || pedido.criadoEm < chegouAntesDe) &&
      cruzam(entrada, saida, pedido.entrada, pedido.saida),
  ).length
}

export type UnidadeLivre = { acomodacao: Acomodacao; tipo: TipoDeAcomodacao }

/** As unidades que servem a estes pets, neste período, já sem as que um pedido segura. */
export function unidadesLivres(entrada: {
  acomodacoes: Acomodacao[]
  tipos: TipoDeAcomodacao[]
  reservas: Reserva[]
  pedidos: PedidoDeReserva[]
  pets: PetDaVaga[]
  inicio: ISODateTime
  fim: ISODateTime
  tipoIds?: string[]
  ignorarPedidoId?: string | null
  /**
   * Para conferir um pedido que já existe: só seguram vaga os que chegaram antes dele. Quem pediu
   * primeiro leva — o pedido das 9h não perde a suíte para o das 10h.
   */
  chegouAntesDe?: ISODateTime | null
}): UnidadeLivre[] {
  const porte = maiorPorte(entrada.pets)
  const especie = entrada.pets[0]?.especie ?? null
  const servem = entrada.acomodacoes.filter(
    (acomodacao) =>
      (!entrada.tipoIds || entrada.tipoIds.includes(acomodacao.tipoId)) &&
      avaliarVaga({
        acomodacao,
        reservas: entrada.reservas,
        inicio: entrada.inicio,
        fim: entrada.fim,
        porte,
        especie,
        ocupantes: entrada.pets.length,
      }).impedimentos.length === 0,
  )

  /* Desconta, de cada tipo, as unidades que um pedido pendente já segura. */
  const porTipo = new Map<string, Acomodacao[]>()

  for (const acomodacao of servem) {
    porTipo.set(acomodacao.tipoId, [...(porTipo.get(acomodacao.tipoId) ?? []), acomodacao])
  }

  const livres: UnidadeLivre[] = []

  for (const tipo of [...entrada.tipos].sort((a, b) => a.ordem - b.ordem)) {
    const unidades = porTipo.get(tipo.id) ?? []
    const seguradas = pedidosQueSeguram(
      entrada.pedidos,
      tipo.id,
      entrada.inicio,
      entrada.fim,
      entrada.ignorarPedidoId ?? null,
      entrada.chegouAntesDe ?? null,
    )

    for (const acomodacao of unidades.slice(seguradas)) {
      livres.push({ acomodacao, tipo })
    }
  }

  return livres
}

/**
 * A melhor unidade para um pedido.
 *
 * Na ordem: o tipo que a pessoa escolheu; a acomodação mais justa para o porte (a suíte de gigante
 * não vai para um pinscher quando há baia que serve); a ordem física da casa. No `hotel-escolhe`
 * sem vaga nas datas, e com a pessoa aceitando, tenta um dia antes e um depois — marcado, para o
 * balcão oferecer sabendo que mexeu na data.
 */
export type SugestaoDeAcomodacao = UnidadeLivre & {
  inicio: ISODateTime
  fim: ISODateTime
  /** Mexeu um dia na data. */
  mudouAData: boolean
}

export function melhoresAcomodacoes(
  entrada: Parameters<typeof unidadesLivres>[0] & {
    tipoPreferido: string | null
    aceitaMudarUmDia: boolean
    limite: number
  },
): SugestaoDeAcomodacao[] {
  const ordem: PetPorte[] = ['mini', 'pequeno', 'medio', 'grande', 'gigante']
  const folga = (acomodacao: Acomodacao) => ordem.indexOf(acomodacao.porteMaximo)

  function ordenar(lista: UnidadeLivre[]) {
    return [...lista].sort(
      (a, b) =>
        (a.tipo.id === entrada.tipoPreferido ? 0 : 1) -
          (b.tipo.id === entrada.tipoPreferido ? 0 : 1) ||
        folga(a.acomodacao) - folga(b.acomodacao) ||
        a.tipo.ordem - b.tipo.ordem ||
        a.acomodacao.nome.localeCompare(b.acomodacao.nome),
    )
  }

  const nasDatas = ordenar(unidadesLivres(entrada)).map((unidade) => ({
    ...unidade,
    inicio: entrada.inicio,
    fim: entrada.fim,
    mudouAData: false,
  }))

  if (nasDatas.length > 0 || !entrada.aceitaMudarUmDia) {
    return nasDatas.slice(0, entrada.limite)
  }

  const deslocadas: SugestaoDeAcomodacao[] = []

  for (const dias of [-1, 1]) {
    const inicio = deslocarDias(entrada.inicio, dias)
    const fim = deslocarDias(entrada.fim, dias)

    for (const unidade of ordenar(unidadesLivres({ ...entrada, inicio, fim }))) {
      deslocadas.push({ ...unidade, inicio, fim, mudouAData: true })
    }
  }

  return deslocadas.slice(0, entrada.limite)
}

function deslocarDias(iso: ISODateTime, dias: number): ISODateTime {
  const offset = iso.slice(19)
  const relogio = createClinicClock(offset)
  const parede = relogio.toWall(iso)

  return relogio.toIso(addDays(parede.date, dias), parede.minutes)
}

/** O tipo com a menor folga de porte que serve a estes pets — o que a tabela de preço mostra. */
export function cabeNoTipo(acomodacoes: Acomodacao[], tipoId: string, pets: PetDaVaga[]): boolean {
  const porte = maiorPorte(pets)

  return acomodacoes.some(
    (acomodacao) =>
      acomodacao.tipoId === tipoId &&
      acomodacao.ativa &&
      acomodacao.capacidade >= pets.length &&
      porteCabe(porte, acomodacao.porteMaximo) &&
      (acomodacao.especiesAceitas.length === 0 ||
        acomodacao.especiesAceitas.includes(pets[0]?.especie ?? 'canina')),
  )
}

// ---------------------------------------------------------------------------
// Prazo e urgência
// ---------------------------------------------------------------------------

/**
 * Até quando o balcão responde, contando só o horário do balcão.
 *
 * O hotel funciona a noite inteira, mas quem responde pedido é a recepção — e o pedido das 23h
 * vence no meio da manhã, não às 2h, quando o plantão está com os hóspedes.
 */
export function prazoNoBalcao(
  criadoEm: ISODateTime,
  horas: number,
  balcao: { abre: ClockTime; fecha: ClockTime },
): ISODateTime {
  const relogio = createClinicClock(criadoEm.slice(19))
  const abre = clockToMinutes(balcao.abre)
  const fecha = clockToMinutes(balcao.fecha)
  const partida = relogio.toWall(criadoEm)
  let restante = Math.round(horas * 60)
  let data = partida.date
  let minuto = partida.minutes

  for (let dia = 0; dia < 14 && restante > 0; dia += 1) {
    const comeco = Math.max(minuto, abre)

    if (comeco < fecha) {
      const cabe = fecha - comeco

      if (restante <= cabe) {
        return relogio.toIso(data, comeco + restante)
      }

      restante -= cabe
    }

    data = addDays(data, 1)
    minuto = 0
  }

  return relogio.toIso(data, minuto)
}

export type SituacaoDoPrazoDaReserva = 'no-prazo' | 'vencendo' | 'atrasado'

export function situacaoDoPrazoDaReserva(
  pedido: Pick<PedidoDeReserva, 'responderAte'>,
  agora: ISODateTime,
): SituacaoDoPrazoDaReserva {
  const faltam = (Date.parse(pedido.responderAte) - Date.parse(agora)) / 60_000

  if (faltam < 0) {
    return 'atrasado'
  }

  return faltam <= 30 ? 'vencendo' : 'no-prazo'
}

/** Entrada antes da antecedência mínima: não é pedido, é telefonema. */
export function ehUrgente(
  entrada: ISODateTime,
  agora: ISODateTime,
  antecedenciaHoras: number,
): boolean {
  return Date.parse(entrada) - Date.parse(agora) < antecedenciaHoras * 3_600_000
}

/** A data de entrada chegou sem resposta: o pedido perdeu o sentido. */
export function pedidoDeReservaPerdeuOSentido(
  pedido: PedidoDeReserva,
  agora: ISODateTime,
): boolean {
  return pedido.status === 'pendente' && Date.parse(pedido.entrada) <= Date.parse(agora)
}
