/**
 * Estoque de vacinas: o que tem na geladeira, o que vence antes de sair, e o que falta comprar.
 *
 * A tela de vacinas já respondia "o que foi aplicado" e "quem chamar". Falta a terceira
 * pergunta, e é a que custa dinheiro: **vacina é o único insumo da clínica que estraga sozinho
 * na prateleira**. Frasco parado além da validade vira prejuízo puro — já pago, nunca faturado
 * — e frasco de menos cancela a consulta que o recall trouxe de volta.
 *
 * Quatro regras que este módulo existe para acertar:
 *
 * 1. **O consumo não é um campo, é uma conta.** As doses que saíram são as aplicações que citam
 *    o código do lote. Guardar um contador no lote criaria uma segunda verdade sobre o mesmo
 *    fato, e as duas divergiriam no primeiro registro que falhasse no meio.
 * 2. **Vencendo não é vencido.** O lote a vencer ainda é dinheiro recuperável: usado primeiro,
 *    vira faturamento; ignorado, vira descarte. São duas conversas, e misturá-las faz a clínica
 *    tratar como perda o que ainda dava para vender.
 * 3. **Saldo sozinho não decide compra.** Trinta doses é muito para giárdia e pouco para
 *    antirrábica. O que decide é a **cobertura** — quantos dias o saldo aguenta no ritmo real de
 *    saída — e é por isso que o consumo médio entra na conta do que falta.
 * 4. **Dinheiro em centavos, sempre.** Custo unitário é inteiro. Multiplicação de real com casa
 *    decimal por contagem de doses acumula erro e o total do painel deixa de bater com o da nota.
 */

import type {
  AplicacaoVacina,
  ISODate,
  LoteDeVacina,
  MotivoDePerda,
  PerdaDeLote,
  Vacina,
} from '../data/types'

import { addDays, diffDays } from './clinic-time'

/**
 * Dias de validade restante a partir dos quais o lote entra na lista de "usar primeiro".
 *
 * Sessenta e não trinta: um lote de vacina leva semanas para girar, e avisar com trinta dias
 * deixaria a clínica sem tempo de fazer nada além de assistir ao descarte.
 */
export const JANELA_DE_VALIDADE_EM_DIAS = 60

/** Meses de histórico que o gráfico de consumo desenha. */
export const MESES_DE_CONSUMO = 12

/**
 * Situação de um lote. A ordem é a da urgência, e é ela que ordena a lista.
 *
 * `esgotado` vem por último de propósito: lote sem saldo não pede ação nenhuma, mas continua na
 * base porque é o que responde à farmacovigilância quando ela pergunta por um código antigo.
 */
export type SituacaoDoLote = 'vencido' | 'vencendo' | 'ativo' | 'esgotado'

export type LoteNoEstoque = {
  id: string
  vacinaId: string
  vacinaNome: string
  codigo: string
  fornecedor: string
  recebidoEm: ISODate
  validade: ISODate
  quantidadeRecebida: number
  custoUnitario: number
  /** Doses que entraram em paciente. Contadas pelas aplicações que citam o código. */
  aplicadas: number
  /** Doses que saíram sem entrar em paciente. */
  perdidas: number
  saldo: number
  situacao: SituacaoDoLote
  /** Negativo quando o lote já venceu. */
  diasParaVencer: number
  /** Centavos parados neste lote: saldo × custo unitário. */
  valorParado: number
}

/** Situação do saldo de uma vacina contra o próprio piso. */
export type SituacaoDoSaldo = 'zerado' | 'abaixo' | 'ok'

export type SaldoDaVacina = {
  vacinaId: string
  nome: string
  saldo: number
  minimo: number
  /** Doses por mês, média da janela de consumo. Zero quando a vacina não saiu no período. */
  consumoMensal: number
  /** Dias que o saldo cobre no ritmo atual. `null` quando não houve consumo para medir. */
  coberturaEmDias: number | null
  situacao: SituacaoDoSaldo
  valorParado: number
  /** Doses presas em lote que vence dentro da janela — o que precisa sair primeiro. */
  vencendo: number
}

/** Um mês do gráfico de consumo. */
export type MesDeConsumo = {
  /** `YYYY-MM`. */
  mes: string
  /** Doses por vacina, na chave do catálogo. Vacina sem saída no mês vem zerada. */
  porVacina: Record<string, number>
  total: number
}

export type IndicadoresDeEstoque = {
  dosesEmEstoque: number
  /** Centavos parados na geladeira. */
  valorParado: number
  dosesVencendo: number
  lotesVencendo: number
  /** Centavos em lote que vence dentro da janela — o que está em risco de virar descarte. */
  valorEmRisco: number
  vacinasAbaixoDoMinimo: number
  dosesPerdidas: number
  /** Doses perdidas sobre doses recebidas, de 0 a 1. */
  perdaPercentual: number
}

export type ResumoDoEstoque = {
  indicadores: IndicadoresDeEstoque
  lotes: LoteNoEstoque[]
  saldos: SaldoDaVacina[]
  consumo: MesDeConsumo[]
  /** Doses perdidas por motivo, do maior para o menor. Só motivos com perda entram. */
  perdasPorMotivo: Array<{ motivo: MotivoDePerda; doses: number }>
}

export type EntradaDoEstoque = {
  lotes: LoteDeVacina[]
  vacinas: Vacina[]
  aplicacoes: AplicacaoVacina[]
  hoje: ISODate
  /** Meses de histórico do gráfico de consumo. */
  meses?: number
}

/** `2026-09-21` → `2026-09`. */
function mesDe(data: string): string {
  return data.slice(0, 7)
}

/**
 * Os últimos `meses` meses, do mais antigo para o mais novo, terminando no mês de `hoje`.
 *
 * Andar de 28 em 28 dias e não "subtrair um do mês" evita o clássico 31 de março menos um mês
 * virar 3 de março; a chave sai do texto da data, então o passo só precisa ser curto o
 * bastante para nunca pular um mês inteiro.
 */
function mesesAte(hoje: ISODate, meses: number): string[] {
  const chaves: string[] = []
  let cursor = hoje

  while (chaves.length < meses) {
    const chave = mesDe(cursor)

    if (chaves[0] !== chave) {
      chaves.unshift(chave)
    }

    cursor = addDays(cursor, -14)
  }

  return chaves
}

function perdasDoLote(lote: LoteDeVacina): number {
  return lote.perdas.reduce((total, perda) => total + perda.quantidade, 0)
}

/**
 * Em que estado está o lote.
 *
 * A ordem das perguntas é a ordem da ação. **Vencido vem antes de esgotado** porque um lote
 * vencido com saldo é dinheiro a descartar e precisa ser visto; e **esgotado vem antes de
 * vencendo** porque frasco vazio não tem o que ser usado primeiro — avisar a validade de um
 * lote sem dose é ruído que empurra para baixo os lotes que ainda dão para salvar.
 */
export function situacaoDoLote(validade: ISODate, saldo: number, hoje: ISODate): SituacaoDoLote {
  const dias = diffDays(hoje, validade)

  if (dias < 0) {
    return saldo > 0 ? 'vencido' : 'esgotado'
  }

  if (saldo <= 0) {
    return 'esgotado'
  }

  return dias <= JANELA_DE_VALIDADE_EM_DIAS ? 'vencendo' : 'ativo'
}

const ORDEM_DA_SITUACAO: Record<SituacaoDoLote, number> = {
  vencido: 0,
  vencendo: 1,
  ativo: 2,
  esgotado: 3,
}

/**
 * O estoque inteiro, em uma passada.
 *
 * Sai daqui tudo o que a tela desenha, do mesmo recorte, porque o clássico "o cartão diz uma
 * coisa e o gráfico diz outra" nasce de cada pedaço da tela fazer a própria conta.
 */
export function resumirEstoque(entrada: EntradaDoEstoque): ResumoDoEstoque {
  const { lotes, vacinas, hoje } = entrada
  const meses = entrada.meses ?? MESES_DE_CONSUMO
  /*
   * Só o que saiu **desta** geladeira. A dose externa — a do pet shop, a da campanha — entra na
   * carteira do animal, mas não gastou frasco daqui: contá-la no giro faria a clínica comprar
   * para um consumo que não é dela.
   */
  const aplicacoes = entrada.aplicacoes.filter((aplicacao) => aplicacao.origem === 'clinica')

  const vacinaPorId = new Map(vacinas.map((vacina) => [vacina.id, vacina]))

  /*
   * As doses que saíram, por código de lote.
   *
   * O código é a chave e não o par (vacina, código), porque é assim que ele está impresso no
   * frasco e escrito na carteira do animal — e é por ele, sozinho, que a farmacovigilância
   * pergunta.
   */
  const aplicadasPorCodigo = new Map<string, number>()

  for (const aplicacao of aplicacoes) {
    if (aplicacao.lote) {
      aplicadasPorCodigo.set(aplicacao.lote, (aplicadasPorCodigo.get(aplicacao.lote) ?? 0) + 1)
    }
  }

  const noEstoque: LoteNoEstoque[] = lotes.map((lote) => {
    const aplicadas = aplicadasPorCodigo.get(lote.codigo) ?? 0
    const perdidas = perdasDoLote(lote)
    /*
     * O piso em zero não é defensivo à toa: aplicação registrada com o código digitado à mão
     * pode passar do que o lote recebeu, e um saldo negativo entraria somando ao contrário no
     * total da clínica — o painel mostraria menos doses do que existem e ninguém saberia por quê.
     */
    const saldo = Math.max(0, lote.quantidadeRecebida - aplicadas - perdidas)

    return {
      id: lote.id,
      vacinaId: lote.vacinaId,
      vacinaNome: vacinaPorId.get(lote.vacinaId)?.nome ?? lote.vacinaId,
      codigo: lote.codigo,
      fornecedor: lote.fornecedor,
      recebidoEm: lote.recebidoEm,
      validade: lote.validade,
      quantidadeRecebida: lote.quantidadeRecebida,
      custoUnitario: lote.custoUnitario,
      aplicadas,
      perdidas,
      saldo,
      situacao: situacaoDoLote(lote.validade, saldo, hoje),
      diasParaVencer: diffDays(hoje, lote.validade),
      valorParado: saldo * lote.custoUnitario,
    }
  })

  /* Urgência primeiro; dentro da mesma urgência, o que vence antes — que é a ordem do uso. */
  noEstoque.sort(
    (a, b) =>
      ORDEM_DA_SITUACAO[a.situacao] - ORDEM_DA_SITUACAO[b.situacao] ||
      a.validade.localeCompare(b.validade),
  )

  // ------------------------------------------------------------------ consumo por mês

  const chaves = mesesAte(hoje, meses)
  const indicePorMes = new Map(chaves.map((chave, indice) => [chave, indice]))
  const consumo: MesDeConsumo[] = chaves.map((mes) => ({
    mes,
    porVacina: Object.fromEntries(vacinas.map((vacina) => [vacina.id, 0])),
    total: 0,
  }))

  /** Doses aplicadas por vacina dentro da janela — o denominador da média mensal. */
  const consumoNaJanela = new Map<string, number>()

  for (const aplicacao of aplicacoes) {
    const indice = indicePorMes.get(mesDe(aplicacao.aplicadaEm))

    if (indice === undefined) {
      continue
    }

    const ponto = consumo[indice]!

    /* Aplicação de vacina fora do catálogo não entra: viraria uma série sem nome na legenda. */
    if (!(aplicacao.vacinaId in ponto.porVacina)) {
      continue
    }

    ponto.porVacina[aplicacao.vacinaId]! += 1
    ponto.total += 1
    consumoNaJanela.set(aplicacao.vacinaId, (consumoNaJanela.get(aplicacao.vacinaId) ?? 0) + 1)
  }

  // ------------------------------------------------------------------ saldo por vacina

  const saldos: SaldoDaVacina[] = vacinas.map((vacina) => {
    const daVacina = noEstoque.filter((lote) => lote.vacinaId === vacina.id)
    const saldo = daVacina.reduce((total, lote) => total + lote.saldo, 0)
    const consumoMensal = (consumoNaJanela.get(vacina.id) ?? 0) / meses

    return {
      vacinaId: vacina.id,
      nome: vacina.nome,
      saldo,
      minimo: vacina.estoqueMinimo,
      consumoMensal,
      /*
       * Cobertura só existe quando houve consumo. Sem saída na janela, dividir por zero daria
       * infinito e a tela escreveria "cobertura de ∞ dias" para um frasco parado há um ano —
       * que é o oposto do que aconteceu.
       */
      coberturaEmDias: consumoMensal > 0 ? Math.round((saldo / consumoMensal) * 30) : null,
      situacao: saldo <= 0 ? 'zerado' : saldo < vacina.estoqueMinimo ? 'abaixo' : 'ok',
      valorParado: daVacina.reduce((total, lote) => total + lote.valorParado, 0),
      vencendo: daVacina
        .filter((lote) => lote.situacao === 'vencendo')
        .reduce((total, lote) => total + lote.saldo, 0),
    }
  })

  /* O que falta comprar primeiro: zerado, depois abaixo do piso, depois menor cobertura. */
  saldos.sort((a, b) => {
    const ordem = { zerado: 0, abaixo: 1, ok: 2 } as const

    return (
      ordem[a.situacao] - ordem[b.situacao] ||
      (a.coberturaEmDias ?? Number.MAX_SAFE_INTEGER) -
        (b.coberturaEmDias ?? Number.MAX_SAFE_INTEGER)
    )
  })

  // ------------------------------------------------------------------ perdas e indicadores

  const porMotivo = new Map<MotivoDePerda, number>()

  for (const lote of lotes) {
    for (const perda of lote.perdas) {
      porMotivo.set(perda.motivo, (porMotivo.get(perda.motivo) ?? 0) + perda.quantidade)
    }
  }

  const perdasPorMotivo = [...porMotivo]
    .map(([motivo, doses]) => ({ motivo, doses }))
    .sort((a, b) => b.doses - a.doses)

  const recebidas = lotes.reduce((total, lote) => total + lote.quantidadeRecebida, 0)
  const perdidas = noEstoque.reduce((total, lote) => total + lote.perdidas, 0)
  const vencendo = noEstoque.filter((lote) => lote.situacao === 'vencendo')

  return {
    indicadores: {
      dosesEmEstoque: noEstoque.reduce((total, lote) => total + lote.saldo, 0),
      valorParado: noEstoque.reduce((total, lote) => total + lote.valorParado, 0),
      dosesVencendo: vencendo.reduce((total, lote) => total + lote.saldo, 0),
      lotesVencendo: vencendo.length,
      valorEmRisco: vencendo.reduce((total, lote) => total + lote.valorParado, 0),
      vacinasAbaixoDoMinimo: saldos.filter((item) => item.situacao !== 'ok').length,
      dosesPerdidas: perdidas,
      perdaPercentual: recebidas > 0 ? perdidas / recebidas : 0,
    },
    lotes: noEstoque,
    saldos,
    consumo,
    perdasPorMotivo,
  }
}

// ---------------------------------------------------------------------- movimentos

/**
 * Um movimento da geladeira que **não** é aplicação: a caixa que chegou e a dose que saiu sem
 * entrar em paciente.
 *
 * A aplicação fica de fora de propósito. Ela já tem lista própria (Vacinas → Aplicadas), e são
 * noventa linhas que afogariam as seis que pedem conferência — o recebimento sem nota e a baixa
 * sem explicação são o que a gerência abre esta lista para achar.
 */
export type MovimentoDeEstoque = {
  id: string
  tipo: 'entrada' | 'baixa'
  em: ISODate
  loteId: string
  codigo: string
  vacinaId: string
  vacinaNome: string
  /** Sempre positivo: o sentido é o `tipo`. */
  quantidade: number
  /** O motivo da baixa; nulo na entrada. */
  motivo: MotivoDePerda | null
  /** Centavos que o movimento representa: custo da caixa na entrada, prejuízo na baixa. */
  valor: number
  /** Profissional que registrou. Vazio no que veio de antes do registro por pessoa. */
  quem: string
  /** Nota fiscal na entrada, observação na baixa. */
  detalhe: string
  fornecedor: string
}

function baixaComoMovimento(
  lote: LoteDeVacina,
  perda: PerdaDeLote,
  indice: number,
  vacinaNome: string,
): MovimentoDeEstoque {
  return {
    id: `${lote.id}-baixa-${indice}`,
    tipo: 'baixa',
    em: perda.em,
    loteId: lote.id,
    codigo: lote.codigo,
    vacinaId: lote.vacinaId,
    vacinaNome,
    quantidade: perda.quantidade,
    motivo: perda.motivo,
    valor: perda.quantidade * lote.custoUnitario,
    quem: perda.registradaPor ?? '',
    detalhe: perda.observacao ?? '',
    fornecedor: lote.fornecedor,
  }
}

/**
 * Entradas e baixas, do mais recente para o mais antigo.
 *
 * Baixa de quantidade zero não entra: é registro vazio (a semente tem um, de propósito, para o
 * gráfico de perdas aprender a ignorá-lo), e uma linha "0 doses" na conferência só ensina a pular
 * linhas.
 */
export function movimentosDoEstoque(
  lotes: LoteDeVacina[],
  vacinas: Vacina[],
): MovimentoDeEstoque[] {
  const nomePorId = new Map(vacinas.map((vacina) => [vacina.id, vacina.nome]))
  const movimentos: MovimentoDeEstoque[] = []

  for (const lote of lotes) {
    const vacinaNome = nomePorId.get(lote.vacinaId) ?? lote.vacinaId

    movimentos.push({
      id: `${lote.id}-entrada`,
      tipo: 'entrada',
      em: lote.recebidoEm,
      loteId: lote.id,
      codigo: lote.codigo,
      vacinaId: lote.vacinaId,
      vacinaNome,
      quantidade: lote.quantidadeRecebida,
      motivo: null,
      valor: lote.quantidadeRecebida * lote.custoUnitario,
      quem: lote.recebidoPor ?? '',
      detalhe: lote.notaFiscal ?? '',
      fornecedor: lote.fornecedor,
    })

    lote.perdas.forEach((perda, indice) => {
      if (perda.quantidade > 0) {
        movimentos.push(baixaComoMovimento(lote, perda, indice, vacinaNome))
      }
    })
  }

  /* Mesmo dia: a baixa antes da entrada, porque a ordem é decrescente e a caixa chegou primeiro. */
  return movimentos.sort(
    (a, b) => b.em.localeCompare(a.em) || (a.tipo === b.tipo ? 0 : a.tipo === 'baixa' ? -1 : 1),
  )
}
