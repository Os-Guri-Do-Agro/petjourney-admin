/**
 * Repositório do estoque de vacinas: o que entra, o que sai sem ser aplicado, e o que se combina
 * para o mês.
 *
 * A leitura da geladeira continua em `vacinaRepository.estoque()` — é a mesma conta que o diálogo
 * de aplicação usa para escolher o frasco. Aqui ficam as **escritas** que faltavam, e as leituras
 * que só a gestão do estoque faz:
 *
 * - **Receber lote.** Até aqui, lote só existia se a semente o plantasse. A clínica que comprava não
 *   tinha onde dar entrada, e o frasco novo não aparecia para ser aplicado.
 * - **Dar baixa.** Quebra, geladeira fora da faixa, vencimento e a diferença da contagem. Sem ela, o
 *   frasco que caiu no chão continuava "na geladeira" até alguém tentar aplicá-lo.
 * - **Mínimo por vacina.** O piso vinha de fábrica. Quem decide o piso é o giro da clínica, e o giro
 *   muda com a estação.
 * - **Metas do mês.** O que a clínica combinou, quanto já fez, o que sugerir para o próximo mês com
 *   os dados deste, e o pedido de compra que sai das metas — ver `domain/metas-de-estoque.ts`.
 */

import { createClinicClock, diffDays } from '../../domain/clinic-time'
import {
  movimentosDoEstoque,
  resumirEstoque,
  type MovimentoDeEstoque,
} from '../../domain/estoque-vacinas'
import {
  custoDoPedido,
  mesDe,
  mesSeguinte,
  pedidoDeCompra,
  progressoDoPlano,
  realizadoNoMes,
  sugerirPlano,
  type LinhaDoPedido,
  type Mes,
  type ProgressoDaMeta,
  type RealizadoDoMes,
  type ReforcoPrevisto,
  type SugestaoDePlano,
} from '../../domain/metas-de-estoque'
import { reforcosDoPaciente } from '../../domain/vacinacao'
import { CLINIC_UTC_OFFSET } from '../fixtures'
import { simularChamada } from '../mock-runtime'
import { agoraIso, getDataset, novoId } from '../store'
import type {
  AplicacaoVacina,
  ISODate,
  LoteDeVacina,
  MetaDeEstoque,
  MotivoDePerda,
  PerdaDeLote,
  PlanoDeEstoque,
  TipoDeMeta,
} from '../types'

import { catalogoComPiso } from './vacina-repository'

const clock = createClinicClock(CLINIC_UTC_OFFSET)

/** Teto do piso e da meta de doses. Ninguém guarda mil doses de uma vacina; o número é erro de digitação. */
export const LIMITE_DE_DOSES = 999

/**
 * Recusa de uma escrita no estoque.
 *
 * `kind` traduzível, como o `AplicacaoRecusadaError`: a tela escreve a frase, o repositório só diz
 * qual regra.
 */
export class EstoqueRecusadoError extends Error {
  readonly kind:
    | 'vacina-desconhecida'
    | 'lote-desconhecido'
    | 'codigo-repetido'
    | 'codigo-vazio'
    | 'validade-passada'
    | 'recebido-no-futuro'
    | 'quantidade-invalida'
    | 'custo-invalido'
    | 'acima-do-saldo'
    | 'contagem-acima-do-saldo'
    | 'contagem-sem-diferenca'
    | 'data-invalida'
    | 'minimo-invalido'
    | 'meta-invalida'
    | 'meta-repetida'
    | 'mes-fechado'

  constructor(kind: EstoqueRecusadoError['kind']) {
    super(`estoque: ${kind}`)
    this.name = 'EstoqueRecusadoError'
    this.kind = kind
  }
}

/** Um mês com o plano dele, o que aconteceu e onde cada meta está. */
export type MesDoPlano = {
  mes: Mes
  plano: PlanoDeEstoque | null
  realizado: RealizadoDoMes
  progresso: ProgressoDaMeta[]
}

export type PainelDeMetas = {
  hoje: ISODate
  atual: MesDoPlano
  proximo: { mes: Mes; plano: PlanoDeEstoque | null }
  /** O plano sugerido para o próximo mês, com os dados do atual. */
  sugestao: SugestaoDePlano
  /** O pedido do próximo mês: pelas metas do plano quando há plano, pela sugestão quando não há. */
  pedido: LinhaDoPedido[]
  /** Meses fechados que tiveram plano, do mais recente para o mais antigo. */
  historico: MesDoPlano[]
}

/** Uma meta como a tela a envia: sem id, que é o repositório quem dá. */
export type MetaNova = { tipo: TipoDeMeta; vacinaId: string | null; alvo: number }

function copiaDoPlano(plano: PlanoDeEstoque): PlanoDeEstoque {
  return { ...plano, metas: plano.metas.map((meta) => ({ ...meta })) }
}

/** O lote com o saldo de agora — a mesma conta da geladeira, para a baixa nunca discordar dela. */
function loteComSaldo(loteId: string) {
  const dataset = getDataset()
  const { lotes } = resumirEstoque({
    lotes: dataset.lotesDeVacina,
    vacinas: catalogoComPiso(),
    aplicacoes: dataset.aplicacoesDeVacina,
    hoje: clock.today(),
  })

  return lotes.find((lote) => lote.id === loteId) ?? null
}

/** Os reforços de todo paciente, só com o que a sugestão precisa. */
function reforcosPrevistos(aplicacoes: AplicacaoVacina[], hoje: ISODate): ReforcoPrevisto[] {
  const porPet = new Map<string, AplicacaoVacina[]>()

  for (const aplicacao of aplicacoes) {
    porPet.set(aplicacao.petId, [...(porPet.get(aplicacao.petId) ?? []), aplicacao])
  }

  return [...porPet.values()].flatMap((doPet) =>
    reforcosDoPaciente(doPet, catalogoComPiso(), hoje).map((reforco) => ({
      vacinaId: reforco.vacinaId,
      proximaDoseEm: reforco.proximaDoseEm,
    })),
  )
}

function mesDoPlano(mes: Mes, hoje: ISODate): MesDoPlano {
  const dataset = getDataset()
  const plano = dataset.planosDeEstoque.find((item) => item.mes === mes) ?? null
  const realizado = realizadoNoMes({
    mes,
    lotes: dataset.lotesDeVacina,
    aplicacoes: dataset.aplicacoesDeVacina,
  })

  return {
    mes,
    plano: plano ? copiaDoPlano(plano) : null,
    realizado,
    progresso: plano ? progressoDoPlano(plano, realizado, hoje) : [],
  }
}

/** Meta por vacina das metas de aplicação — a entrada do pedido de compra. */
function metaPorVacina(metas: Array<Pick<MetaDeEstoque, 'tipo' | 'vacinaId' | 'alvo'>>) {
  const mapa: Record<string, number> = {}

  for (const meta of metas) {
    if (meta.tipo === 'aplicacoes' && meta.vacinaId) {
      mapa[meta.vacinaId] = meta.alvo
    }
  }

  return mapa
}

function calcularPedido(mes: Mes, metas: Record<string, number>): LinhaDoPedido[] {
  const dataset = getDataset()
  const hoje = clock.today()
  const vacinas = catalogoComPiso()
  const { lotes } = resumirEstoque({
    lotes: dataset.lotesDeVacina,
    vacinas,
    aplicacoes: dataset.aplicacoesDeVacina,
    hoje,
  })

  return pedidoDeCompra({
    mesPlanejado: mes,
    hoje,
    lotes,
    vacinas,
    metaPorVacina: metas,
    aplicadasNoMesAtual: realizadoNoMes({
      mes: mesDe(hoje),
      lotes: dataset.lotesDeVacina,
      aplicacoes: dataset.aplicacoesDeVacina,
    }).aplicacoesPorVacina,
  })
}

function inteiroNaFaixa(valor: number, minimo: number, maximo: number): boolean {
  return Number.isInteger(valor) && valor >= minimo && valor <= maximo
}

export const estoqueRepository = {
  /** Entradas e baixas, do mais recente para o mais antigo. */
  movimentos(): Promise<MovimentoDeEstoque[]> {
    return simularChamada('estoque.listar', () =>
      movimentosDoEstoque(getDataset().lotesDeVacina, catalogoComPiso()),
    )
  },

  /**
   * Os fornecedores que já entregaram aqui, em ordem alfabética.
   *
   * Síncrono, como o `catalogo`: é a lista que o campo oferece enquanto a pessoa digita, e o mesmo
   * fornecedor escrito de três jeitos partiria o histórico de compra em três.
   */
  fornecedores(): string[] {
    return [...new Set(getDataset().lotesDeVacina.map((lote) => lote.fornecedor))]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
  },

  /**
   * Dá entrada numa caixa.
   *
   * O código é a chave que liga a aplicação ao lote, e por isso não pode repetir: duas caixas com o
   * mesmo código somariam as aplicações de uma no saldo da outra. Validade vencida não entra —
   * receber frasco vencido é devolver ao fornecedor, não guardar na geladeira.
   */
  receberLote(input: {
    vacinaId: string
    codigo: string
    fornecedor: string
    recebidoEm: ISODate
    validade: ISODate
    quantidade: number
    /** Centavos por dose. */
    custoUnitario: number
    notaFiscal: string
    recebidoPor: string
  }): Promise<LoteDeVacina> {
    return simularChamada('estoque.registrar', () => {
      const dataset = getDataset()
      const hoje = clock.today()
      const codigo = input.codigo.trim()

      if (!catalogoComPiso().some((vacina) => vacina.id === input.vacinaId)) {
        throw new EstoqueRecusadoError('vacina-desconhecida')
      }

      if (!codigo) {
        throw new EstoqueRecusadoError('codigo-vazio')
      }

      if (
        dataset.lotesDeVacina.some(
          (lote) => lote.codigo.toLocaleUpperCase('pt-BR') === codigo.toLocaleUpperCase('pt-BR'),
        )
      ) {
        throw new EstoqueRecusadoError('codigo-repetido')
      }

      if (!input.recebidoEm || input.recebidoEm > hoje) {
        throw new EstoqueRecusadoError('recebido-no-futuro')
      }

      if (!input.validade || input.validade <= hoje) {
        throw new EstoqueRecusadoError('validade-passada')
      }

      if (!inteiroNaFaixa(input.quantidade, 1, LIMITE_DE_DOSES)) {
        throw new EstoqueRecusadoError('quantidade-invalida')
      }

      if (!Number.isInteger(input.custoUnitario) || input.custoUnitario < 0) {
        throw new EstoqueRecusadoError('custo-invalido')
      }

      const lote: LoteDeVacina = {
        id: novoId('lote'),
        vacinaId: input.vacinaId,
        codigo,
        fornecedor: input.fornecedor.trim(),
        recebidoEm: input.recebidoEm,
        validade: input.validade,
        quantidadeRecebida: input.quantidade,
        custoUnitario: input.custoUnitario,
        perdas: [],
        notaFiscal: input.notaFiscal.trim(),
        recebidoPor: input.recebidoPor,
      }

      dataset.lotesDeVacina.push(lote)

      return { ...lote, perdas: [] }
    })
  },

  /**
   * Tira doses do lote sem aplicá-las.
   *
   * Na **contagem**, quem fala é a geladeira: a pessoa diz quantas doses achou, e a baixa é a
   * diferença para o saldo do sistema. Contar mais do que o sistema tem é recusado, e não vira
   * entrada — dose a mais quase sempre é aplicação registrada no lote errado, e "corrigir" pelo
   * saldo esconderia o erro na carteira do animal.
   */
  registrarBaixa(input: {
    loteId: string
    motivo: MotivoDePerda
    /** Doses que saíram. Ignorado na contagem. */
    quantidade: number
    /** Doses achadas na geladeira. Só na contagem. */
    contadas: number | null
    em: ISODate
    registradaPor: string
    observacao: string
  }): Promise<PerdaDeLote> {
    return simularChamada('estoque.registrar', () => {
      const dataset = getDataset()
      const lote = dataset.lotesDeVacina.find((item) => item.id === input.loteId)
      const calculado = loteComSaldo(input.loteId)

      if (!lote || !calculado) {
        throw new EstoqueRecusadoError('lote-desconhecido')
      }

      if (!input.em || input.em > clock.today() || input.em < lote.recebidoEm) {
        throw new EstoqueRecusadoError('data-invalida')
      }

      let quantidade = input.quantidade

      if (input.motivo === 'contagem') {
        const contadas = input.contadas ?? -1

        if (!inteiroNaFaixa(contadas, 0, LIMITE_DE_DOSES)) {
          throw new EstoqueRecusadoError('quantidade-invalida')
        }

        if (contadas > calculado.saldo) {
          throw new EstoqueRecusadoError('contagem-acima-do-saldo')
        }

        if (contadas === calculado.saldo) {
          throw new EstoqueRecusadoError('contagem-sem-diferenca')
        }

        quantidade = calculado.saldo - contadas
      } else if (!inteiroNaFaixa(quantidade, 1, LIMITE_DE_DOSES)) {
        throw new EstoqueRecusadoError('quantidade-invalida')
      } else if (quantidade > calculado.saldo) {
        throw new EstoqueRecusadoError('acima-do-saldo')
      }

      const perda: PerdaDeLote = {
        em: input.em,
        quantidade,
        motivo: input.motivo,
        registradaPor: input.registradaPor,
        observacao: input.observacao.trim(),
      }

      lote.perdas.push(perda)

      return { ...perda }
    })
  },

  /** Muda o piso de uma vacina. Zero é aceito: é a vacina que a clínica decidiu não manter. */
  ajustarMinimo(vacinaId: string, minimo: number): Promise<void> {
    return simularChamada('estoque.registrar', () => {
      if (!catalogoComPiso().some((vacina) => vacina.id === vacinaId)) {
        throw new EstoqueRecusadoError('vacina-desconhecida')
      }

      if (!inteiroNaFaixa(minimo, 0, LIMITE_DE_DOSES)) {
        throw new EstoqueRecusadoError('minimo-invalido')
      }

      getDataset().estoqueMinimo[vacinaId] = minimo
    })
  },

  /**
   * O painel das metas: o mês atual com o progresso, o próximo com plano ou sugestão, e os meses
   * fechados que tiveram plano.
   *
   * A sugestão é calculada duas vezes de propósito: o orçamento sugerido é o custo do pedido, e o
   * pedido depende das metas de aplicação sugeridas. Na primeira passada saem as metas; na
   * segunda, o orçamento que elas custam.
   */
  metas(): Promise<PainelDeMetas> {
    return simularChamada('estoque.listar', () => {
      const dataset = getDataset()
      const hoje = clock.today()
      const mesAtual = mesDe(hoje)
      const proximoMes = mesSeguinte(mesAtual)
      const proximo = dataset.planosDeEstoque.find((item) => item.mes === proximoMes) ?? null
      const entradaDaSugestao = {
        mesPlanejado: proximoMes,
        hoje,
        lotes: dataset.lotesDeVacina,
        aplicacoes: dataset.aplicacoesDeVacina,
        vacinas: catalogoComPiso(),
        reforcos: reforcosPrevistos(dataset.aplicacoesDeVacina, hoje),
      }

      const rascunho = sugerirPlano({ ...entradaDaSugestao, orcamentoCentavos: 0 })
      const pedidoSugerido = calcularPedido(proximoMes, metaPorVacina(rascunho.metas))
      const sugestao = sugerirPlano({
        ...entradaDaSugestao,
        orcamentoCentavos: custoDoPedido(pedidoSugerido),
      })

      const historico = dataset.planosDeEstoque
        .filter((item) => item.mes < mesAtual)
        .sort((a, b) => b.mes.localeCompare(a.mes))
        .map((item) => mesDoPlano(item.mes, hoje))

      return {
        hoje,
        atual: mesDoPlano(mesAtual, hoje),
        proximo: { mes: proximoMes, plano: proximo ? copiaDoPlano(proximo) : null },
        sugestao,
        pedido: proximo ? calcularPedido(proximoMes, metaPorVacina(proximo.metas)) : pedidoSugerido,
        historico,
      }
    })
  },

  /**
   * O pedido para um conjunto de metas, sem gravar nada.
   *
   * Síncrono, como a `vaga` da agenda: o diálogo de planejamento refaz o pedido a cada número
   * digitado, e é esse pedido refeito que mostra o custo da meta antes de ela ser combinada.
   */
  simularPedido(mes: Mes, metas: MetaNova[]): LinhaDoPedido[] {
    return calcularPedido(mes, metaPorVacina(metas))
  },

  /**
   * Grava o plano de um mês, inteiro.
   *
   * O plano substitui o anterior do mesmo mês em vez de somar metas a ele: é assim que a tela o
   * edita — abre tudo, muda o que quer, salva tudo. Mês fechado não aceita plano, porque meta
   * escrita depois do resultado não é meta.
   */
  salvarPlano(input: {
    mes: Mes
    metas: MetaNova[]
    baseadoEm: Mes | null
    criadoPor: string
  }): Promise<PlanoDeEstoque> {
    return simularChamada('estoque.registrar', () => {
      const dataset = getDataset()
      const hoje = clock.today()

      if (input.mes < mesDe(hoje)) {
        throw new EstoqueRecusadoError('mes-fechado')
      }

      const vacinas = catalogoComPiso()
      const vistas = new Set<string>()

      for (const meta of input.metas) {
        const limite = meta.tipo === 'compras' ? Number.MAX_SAFE_INTEGER : LIMITE_DE_DOSES
        const daClinica = meta.tipo !== 'aplicacoes'

        if (
          !inteiroNaFaixa(meta.alvo, 0, limite) ||
          (daClinica && meta.vacinaId !== null) ||
          (meta.vacinaId !== null && !vacinas.some((vacina) => vacina.id === meta.vacinaId))
        ) {
          throw new EstoqueRecusadoError('meta-invalida')
        }

        const chave = `${meta.tipo}:${meta.vacinaId ?? '*'}`

        if (vistas.has(chave)) {
          throw new EstoqueRecusadoError('meta-repetida')
        }

        vistas.add(chave)
      }

      const plano: PlanoDeEstoque = {
        mes: input.mes,
        metas: input.metas.map((meta) => ({ ...meta, id: novoId('meta') })),
        baseadoEm: input.baseadoEm,
        criadoPor: input.criadoPor,
        atualizadoEm: agoraIso(),
      }

      dataset.planosDeEstoque = [
        ...dataset.planosDeEstoque.filter((item) => item.mes !== input.mes),
        plano,
      ]

      return copiaDoPlano(plano)
    })
  },
}

/** Dias de prateleira que restam a um lote — o diálogo de entrada avisa a validade curta. */
export function diasDeValidade(validade: ISODate): number {
  return diffDays(clock.today(), validade)
}
