/**
 * Preço — a metade da conversa da reserva que o balcão precisa fazer na frente do cliente.
 *
 * Tudo em **centavos**, inteiro, do começo ao fim. Guardar reais com casa decimal devolveria o
 * erro de ponto flutuante que centavos existem para evitar, e o total do orçamento deixaria de
 * bater com o da nota por alguns centavos — que é justamente o tipo de diferença que faz o cliente
 * parar de confiar na conta.
 *
 * O orçamento é uma **lista** e não um total, e isso não é detalhe de tela: um total sozinho é uma
 * conta que o cliente não confere e a recepção não defende. Cada linha diz o que é, quantas vezes
 * e quanto.
 */

import type {
  ISODate,
  ISODateTime,
  LinhaDoOrcamento,
  Orcamento,
  PetPorte,
  PoliticaDoHotel,
  Servico,
  ServicoContratado,
  Tarifa,
  Temporada,
} from '../data/types'

import { clockToMinutes, contarDiarias, dataDe, datasEntre, minutosDe } from './hotel-time'

/** Porte não informado paga como médio — o degrau do meio, e o mais comum da casa. */
const PORTE_PADRAO: PetPorte = 'medio'

export function diariaDe(tarifa: Tarifa, porte: PetPorte | null): number {
  return tarifa.diariaPorPorte[porte ?? PORTE_PADRAO]
}

/**
 * Quantas diárias do período caem em temporada.
 *
 * Contadas dia a dia e não pelo cruzamento do intervalo: uma estadia de 28 de dezembro a 4 de
 * janeiro tem parte em alta e parte fora, e cobrar o período inteiro pelo acréscimo — ou nada
 * dele — erra nas duas direções. Quem cobra errado para mais perde o cliente; para menos, perde a
 * margem do único mês que a sustenta.
 */
export function diariasEmTemporada(
  entrada: ISODateTime,
  saida: ISODateTime,
  temporada: Temporada,
): number {
  const dias = datasEntre(dataDe(entrada), dataDe(saida))

  /*
   * O último dia sai da conta: quem chega dia 22 e sai dia 30 paga 8 diárias, e o dia 30 é saída,
   * não pernoite. `datasEntre` devolve 9 datas; a temporada se aplica às 8 primeiras.
   */
  return dias.slice(0, -1).filter((dia) => dia >= temporada.inicio && dia <= temporada.fim).length
}

/**
 * Quanto a saída custa a mais.
 *
 * É a regra que mais gera discussão no balcão, e discussão de balcão se resolve mostrando a regra
 * na tela **antes** de o cliente chegar. Devolve o percentual da diária a acrescentar: 0, meia, ou
 * uma inteira.
 */
export function cobrancaDaSaida(saida: ISODateTime, politica: PoliticaDoHotel): number {
  const minutos = minutosDe(saida)

  if (minutos <= clockToMinutes(politica.horarioDeSaida)) {
    return 0
  }

  if (minutos <= clockToMinutes(politica.limiteMeiaDiaria)) {
    return politica.meiaDiariaPercentual
  }

  return 100
}

export type EntradaDeOrcamento = {
  entrada: ISODateTime
  saida: ISODateTime
  tarifa: Tarifa
  porte: PetPorte | null
  /** Porte do acompanhante. `null` significa reserva de um animal só. */
  porteAcompanhante?: PetPorte | null
  temporadas: Temporada[]
  servicos: ServicoContratado[]
  catalogoDeServicos: Servico[]
  politica: PoliticaDoHotel
  /** O que já foi pago. Entra no saldo, nunca no total. */
  pagoCentavos?: number
}

/**
 * Monta o orçamento de uma reserva.
 *
 * Determinístico e sem relógio: as mesmas entradas dão sempre o mesmo total, que é o que permite
 * congelá-lo na reserva e exibir de novo três semanas depois sem que o número mude sozinho.
 */
export function montarOrcamento(entrada: EntradaDeOrcamento): Orcamento {
  const diarias = contarDiarias(entrada.entrada, entrada.saida)
  const diaria = diariaDe(entrada.tarifa, entrada.porte)
  const linhas: LinhaDoOrcamento[] = []

  linhas.push({
    kind: 'diaria',
    servicoKind: null,
    quantidade: diarias,
    valorUnitarioCentavos: diaria,
    totalCentavos: diaria * diarias,
  })

  if (entrada.porteAcompanhante !== undefined && entrada.porteAcompanhante !== null) {
    const cheia = diariaDe(entrada.tarifa, entrada.porteAcompanhante)
    const unitario = Math.round((cheia * entrada.tarifa.acompanhantePercentual) / 100)

    linhas.push({
      kind: 'acompanhante',
      servicoKind: null,
      quantidade: diarias,
      valorUnitarioCentavos: unitario,
      totalCentavos: unitario * diarias,
    })
  }

  /*
   * O acréscimo de temporada é uma linha **à parte**, e não uma diária mais cara. O cliente que
   * reserva o Natal precisa ver quanto do preço é o Natal: embutido na diária, o acréscimo vira
   * uma suspeita de que o hotel aumentou o preço, que é a mesma coisa vista pelo lado ruim.
   */
  for (const temporada of entrada.temporadas) {
    const diasNaTemporada = diariasEmTemporada(entrada.entrada, entrada.saida, temporada)

    if (diasNaTemporada === 0) {
      continue
    }

    const base = linhas
      .filter((linha) => linha.kind === 'diaria' || linha.kind === 'acompanhante')
      .reduce((total, linha) => total + linha.valorUnitarioCentavos, 0)

    const unitario = Math.round((base * temporada.acrescimoPercentual) / 100)

    linhas.push({
      kind: 'temporada',
      servicoKind: null,
      quantidade: diasNaTemporada,
      valorUnitarioCentavos: unitario,
      totalCentavos: unitario * diasNaTemporada,
    })
  }

  for (const contratado of entrada.servicos) {
    const servico = entrada.catalogoDeServicos.find((item) => item.id === contratado.servicoId)

    if (!servico) {
      continue
    }

    const vezes = servico.porDiaria ? contratado.quantidade * diarias : contratado.quantidade

    linhas.push({
      kind: 'servico',
      servicoKind: servico.kind,
      quantidade: vezes,
      valorUnitarioCentavos: contratado.precoUnitarioCentavos,
      totalCentavos: contratado.precoUnitarioCentavos * vezes,
    })
  }

  const percentualDaSaida = cobrancaDaSaida(entrada.saida, entrada.politica)

  if (percentualDaSaida > 0) {
    const unitario = Math.round((diaria * percentualDaSaida) / 100)

    linhas.push({
      kind: 'meia-diaria',
      servicoKind: null,
      quantidade: 1,
      valorUnitarioCentavos: unitario,
      totalCentavos: unitario,
    })
  }

  const totalCentavos = linhas.reduce((total, linha) => total + linha.totalCentavos, 0)
  const sinalCentavos = Math.round((totalCentavos * entrada.politica.sinalPercentual) / 100)

  return {
    linhas,
    totalCentavos,
    sinalCentavos,
    saldoCentavos: totalCentavos - (entrada.pagoCentavos ?? 0),
  }
}

/**
 * O sinal volta se a reserva for cancelada hoje?
 *
 * Política da casa, aplicada aqui e não na tela, porque é a conta que a recepção faz no telefone
 * com o cliente irritado — e a resposta precisa ser a mesma independentemente de quem atende.
 */
export function sinalReembolsavel(
  entradaPrevista: ISODate,
  hoje: ISODate,
  politica: PoliticaDoHotel,
): boolean {
  const dias = Math.round(
    (Date.parse(`${entradaPrevista}T12:00:00Z`) - Date.parse(`${hoje}T12:00:00Z`)) / 86_400_000,
  )

  return dias >= politica.cancelamentoSemCustoDias
}
