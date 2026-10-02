/**
 * Resumo — a única leitura do módulo que olha para trás.
 *
 * Tudo aqui é derivado das reservas e das estadias, sem estado próprio. É a decisão que evita o
 * defeito clássico de painel: um contador gravado que envelhece errado e passa meses mentindo com
 * ar de autoridade, porque a mutação que deveria atualizá-lo esqueceu de uma rota.
 */

import { addDays } from '@/features/clinico/domain/clinic-time'

import { datasEntre, dataDe } from '../../domain/hotel-time'
import { simularChamada } from '../mock-runtime'
import { getDataset, hojeIso } from '../store'
import type { ISODate, OcorrenciaKind, ReservaOrigem, ServicoKind } from '../types'

export type PontoDeOcupacao = {
  data: ISODate
  ocupadas: number
  /** Quantas operavam naquele dia. Denominador explícito: a casa cresce e encolhe. */
  operando: number
  taxa: number
}

export type FatiaPorOrigem = {
  origem: ReservaOrigem
  reservas: number
  receitaCentavos: number
}

export type FatiaDeServico = {
  kind: ServicoKind
  vezes: number
  receitaCentavos: number
}

export type ContagemDeOcorrencia = {
  kind: OcorrenciaKind
  total: number
  graves: number
}

export type ResumoDoHotel = {
  de: ISODate
  ate: ISODate
  ocupacaoPorDia: PontoDeOcupacao[]
  ocupacaoMedia: number
  receitaCentavos: number
  /** Receita dividida pelas diárias vendidas — o número que compara dois meses de tamanhos. */
  diariaMediaCentavos: number
  diariasVendidas: number
  porOrigem: FatiaPorOrigem[]
  porServico: FatiaDeServico[]
  ocorrencias: ContagemDeOcorrencia[]
  /** Reservas encerradas de quem já havia se hospedado antes. É o número que mede a casa. */
  taxaDeRetorno: number
  taxaDeCancelamento: number
  taxaDeNaoComparecimento: number
}

export const resumoRepository = {
  carregar(de: ISODate, ate: ISODate): Promise<ResumoDoHotel> {
    return simularChamada('resumo.carregar', () => {
      const dataset = getDataset()
      const dias = datasEntre(de, ate)

      /*
       * A ocupação é contada **por dia**, percorrendo as reservas: contá-la pelo número de
       * estadias abertas hoje responderia outra pergunta — quantas há agora —, e o resumo existe
       * justamente para a pergunta que o painel não responde.
       */
      const operando = dataset.acomodacoes.filter((item) => item.ativa).length

      const ocupacaoPorDia = dias.map<PontoDeOcupacao>((data) => {
        const ocupadas = dataset.reservas.filter((reserva) => {
          if (reserva.status === 'cancelada' || reserva.status === 'nao-compareceu') {
            return false
          }

          return dataDe(reserva.entradaPrevista) <= data && data < dataDe(reserva.saidaPrevista)
        }).length

        return {
          data,
          ocupadas,
          operando,
          taxa: operando === 0 ? 0 : ocupadas / operando,
        }
      })

      const noPeriodo = dataset.reservas.filter((reserva) => {
        const entrada = dataDe(reserva.entradaPrevista)

        return entrada >= de && entrada <= ate
      })

      const faturadas = noPeriodo.filter(
        (reserva) => reserva.status === 'encerrada' || reserva.status === 'hospedado',
      )

      const receitaCentavos = faturadas.reduce(
        (total, reserva) => total + reserva.orcamento.totalCentavos,
        0,
      )
      const diariasVendidas = faturadas.reduce((total, reserva) => total + reserva.diarias, 0)

      const origens = new Map<ReservaOrigem, FatiaPorOrigem>()

      for (const reserva of faturadas) {
        const atual = origens.get(reserva.origem) ?? {
          origem: reserva.origem,
          reservas: 0,
          receitaCentavos: 0,
        }

        origens.set(reserva.origem, {
          origem: reserva.origem,
          reservas: atual.reservas + 1,
          receitaCentavos: atual.receitaCentavos + reserva.orcamento.totalCentavos,
        })
      }

      const servicos = new Map<ServicoKind, FatiaDeServico>()

      for (const reserva of faturadas) {
        for (const linha of reserva.orcamento.linhas) {
          if (linha.kind !== 'servico' || !linha.servicoKind) {
            continue
          }

          const atual = servicos.get(linha.servicoKind) ?? {
            kind: linha.servicoKind,
            vezes: 0,
            receitaCentavos: 0,
          }

          servicos.set(linha.servicoKind, {
            kind: linha.servicoKind,
            vezes: atual.vezes + linha.quantidade,
            receitaCentavos: atual.receitaCentavos + linha.totalCentavos,
          })
        }
      }

      const ocorrencias = new Map<OcorrenciaKind, ContagemDeOcorrencia>()

      for (const ocorrencia of dataset.ocorrencias) {
        if (dataDe(ocorrencia.registradaEm) < de || dataDe(ocorrencia.registradaEm) > ate) {
          continue
        }

        const atual = ocorrencias.get(ocorrencia.kind) ?? {
          kind: ocorrencia.kind,
          total: 0,
          graves: 0,
        }

        ocorrencias.set(ocorrencia.kind, {
          kind: ocorrencia.kind,
          total: atual.total + 1,
          graves: atual.graves + (ocorrencia.gravidade === 'grave' ? 1 : 0),
        })
      }

      /*
       * Retorno é medido por **responsável**, não por animal: a casa que agradou a Rita recebe o
       * gato dela e, depois, o cachorro novo. Contar por animal esconderia metade da fidelidade.
       */
      const responsaveisAnteriores = new Set(
        dataset.reservas
          .filter((reserva) => dataDe(reserva.entradaPrevista) < de && reservaEfetivada(reserva))
          .map((reserva) => reserva.tutorId),
      )

      const retornos = faturadas.filter((reserva) =>
        responsaveisAnteriores.has(reserva.tutorId),
      ).length

      const canceladas = noPeriodo.filter((reserva) => reserva.status === 'cancelada').length
      const faltas = noPeriodo.filter((reserva) => reserva.status === 'nao-compareceu').length

      return {
        de,
        ate,
        ocupacaoPorDia,
        ocupacaoMedia:
          ocupacaoPorDia.length === 0
            ? 0
            : ocupacaoPorDia.reduce((total, ponto) => total + ponto.taxa, 0) /
              ocupacaoPorDia.length,
        receitaCentavos,
        diariasVendidas,
        diariaMediaCentavos:
          diariasVendidas === 0 ? 0 : Math.round(receitaCentavos / diariasVendidas),
        porOrigem: [...origens.values()].sort(
          (um, outro) => outro.receitaCentavos - um.receitaCentavos,
        ),
        porServico: [...servicos.values()].sort(
          (um, outro) => outro.receitaCentavos - um.receitaCentavos,
        ),
        ocorrencias: [...ocorrencias.values()].sort((um, outro) => outro.total - um.total),
        taxaDeRetorno: faturadas.length === 0 ? 0 : retornos / faturadas.length,
        taxaDeCancelamento: noPeriodo.length === 0 ? 0 : canceladas / noPeriodo.length,
        taxaDeNaoComparecimento: noPeriodo.length === 0 ? 0 : faltas / noPeriodo.length,
      }
    })
  },

  /** O período padrão da tela: os últimos trinta dias, terminando hoje. */
  periodoPadrao(): { de: ISODate; ate: ISODate } {
    const ate = hojeIso()

    return { de: addDays(ate, -30), ate }
  },
}

function reservaEfetivada(reserva: { status: string }) {
  return reserva.status === 'encerrada' || reserva.status === 'hospedado'
}
