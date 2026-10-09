/**
 * O cenário das metas de estoque.
 *
 * Dois planos, e nenhum para o mês que vem — é a demonstração inteira em três tempos:
 *
 * - **O mês passado**, fechado, com o placar dele. As metas nasceram da mesma sugestão que a tela
 *   oferece hoje (a do mês anterior a ele), então o resultado varia sozinho: umas batidas, outras
 *   não. Plantar metas que todas batem mostraria uma tela que nunca tem o que dizer.
 * - **O mês atual**, em curso: o ritmo contra o combinado, que é o que a gerência abre a tela para
 *   ver no dia 10.
 * - **O mês que vem, sem plano**: é o botão "Planejar" que a demonstração aperta, com os dados
 *   deste mês já preenchidos.
 *
 * O orçamento de compra não sai do pedido sugerido, como na tela: o pedido de um mês passado
 * precisaria do saldo daquele dia, que o dataset não guarda. Ele sai do que de fato se comprou, com
 * folga arredondada para cima — a clínica que planejou compra o que precisava.
 */

import { addDays } from '../domain/clinic-time'
import {
  mesAnterior,
  mesDe,
  realizadoNoMes,
  sugerirPlano,
  ultimoDia,
  type ReforcoPrevisto,
} from '../domain/metas-de-estoque'
import { reforcosDoPaciente } from '../domain/vacinacao'

import { vacinasFixture } from './fixtures/vacinas'
import type { AplicacaoVacina, ISODate, ISODateTime, LoteDeVacina, PlanoDeEstoque } from './types'

/** Quem fecha o plano do mês. A Ana coordena a recepção — é ela quem faz o pedido. */
const QUEM_PLANEJA = 'prof-ana'

/** Centavos de folga sobre a compra real: R$ 100 redondos, que é como orçamento se escreve. */
const DEGRAU_DO_ORCAMENTO = 10_000

function reforcosPrevistos(aplicacoes: AplicacaoVacina[], hoje: ISODate): ReforcoPrevisto[] {
  const porPet = new Map<string, AplicacaoVacina[]>()

  for (const aplicacao of aplicacoes) {
    porPet.set(aplicacao.petId, [...(porPet.get(aplicacao.petId) ?? []), aplicacao])
  }

  return [...porPet.values()].flatMap((doPet) =>
    reforcosDoPaciente(doPet, vacinasFixture, hoje).map((reforco) => ({
      vacinaId: reforco.vacinaId,
      proximaDoseEm: reforco.proximaDoseEm,
    })),
  )
}

function planoDoMes(
  mes: string,
  entrada: {
    hoje: ISODate
    lotes: LoteDeVacina[]
    aplicacoes: AplicacaoVacina[]
    reforcos: ReforcoPrevisto[]
    iso: (data: ISODate, minutos: number) => ISODateTime
  },
): PlanoDeEstoque {
  /*
   * A compra do próprio mês ou a do anterior, a maior: o mês em curso ainda não comprou nada, e um
   * orçamento de R$ 100 para ele seria o plano dizendo que a clínica não pretende repor nada.
   */
  const compraReal = Math.max(
    ...[mes, mesAnterior(mes)].map(
      (qual) =>
        realizadoNoMes({ mes: qual, lotes: entrada.lotes, aplicacoes: entrada.aplicacoes })
          .comprasCentavos,
    ),
  )
  const orcamento =
    Math.ceil((compraReal + DEGRAU_DO_ORCAMENTO / 2) / DEGRAU_DO_ORCAMENTO) * DEGRAU_DO_ORCAMENTO

  const sugestao = sugerirPlano({
    mesPlanejado: mes,
    hoje: entrada.hoje,
    lotes: entrada.lotes,
    aplicacoes: entrada.aplicacoes,
    vacinas: vacinasFixture,
    reforcos: entrada.reforcos,
    orcamentoCentavos: orcamento,
  })

  /* O plano foi fechado no penúltimo dia do mês anterior, no fim da tarde. */
  const fechadoEm = addDays(ultimoDia(mesAnterior(mes)), -1)

  return {
    mes,
    metas: sugestao.metas.map((meta) => ({
      ...meta,
      id: `meta-${mes}-${meta.id.replace('sugestao-', '')}`,
    })),
    baseadoEm: sugestao.mesBase,
    criadoPor: QUEM_PLANEJA,
    atualizadoEm: entrada.iso(fechadoEm, 17 * 60 + 40),
  }
}

export function planosDeEstoquePlantados(entrada: {
  hoje: ISODate
  lotes: LoteDeVacina[]
  aplicacoes: AplicacaoVacina[]
  iso: (data: ISODate, minutos: number) => ISODateTime
}): PlanoDeEstoque[] {
  const atual = mesDe(entrada.hoje)
  const reforcos = reforcosPrevistos(entrada.aplicacoes, entrada.hoje)
  const contexto = { ...entrada, reforcos }

  return [planoDoMes(mesAnterior(atual), contexto), planoDoMes(atual, contexto)]
}
