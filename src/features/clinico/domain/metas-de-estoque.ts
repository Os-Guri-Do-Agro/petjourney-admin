/**
 * Metas de estoque: o que a clínica combinou para o mês, quanto já fez, e o que comprar para o
 * próximo.
 *
 * O estoque respondia "o que tem na geladeira". Faltava a pergunta de gestão — **o mês está indo
 * para onde combinamos?** — e a que vem logo depois dela: **quanto comprar para o mês que vem**.
 * As duas saem daqui, da mesma conta, pelo mesmo motivo do `estoque-vacinas.ts`: o painel que diz
 * "meta batida" e o pedido que diz "compre 14" não podem fazer contas diferentes do mesmo mês.
 *
 * Quatro regras que este módulo existe para acertar:
 *
 * 1. **Piso e teto não se leem do mesmo jeito.** Aplicação é piso — passar é bom, e o mês em curso
 *    é julgado pelo ritmo. Perda e compra são teto — passar é ruim, e o ritmo não salva ninguém:
 *    quatro doses perdidas num dia de geladeira desligada não viram "no ritmo" diluídas no mês.
 * 2. **Só a aplicação é projetada.** Ela sai todo dia, e o ritmo dos primeiros dias diz alguma coisa
 *    sobre o resto do mês. Perda e compra chegam em bloco; extrapolar uma nota fiscal do dia 3
 *    para o mês inteiro inventaria trinta notas.
 * 3. **A sugestão cita de onde veio.** Cada número sugerido vem com os três dados que o produziram
 *    — o mês atual no ritmo de hoje, a média do trimestre e os reforços que já vencem no mês
 *    planejado. Sugestão sem origem vira número que ninguém defende numa reunião.
 * 4. **O pedido fecha o estoque no mínimo, depois da meta.** Comprar a meta não basta: no último
 *    dia do mês a geladeira tem de ter o piso de cada vacina, senão o mês seguinte começa comprando
 *    às pressas.
 */

import type {
  AplicacaoVacina,
  ISODate,
  LoteDeVacina,
  MetaDeEstoque,
  PlanoDeEstoque,
  TipoDeMeta,
  Vacina,
} from '../data/types'

import type { LoteNoEstoque } from './estoque-vacinas'

/** `YYYY-MM`. */
export type Mes = string

/** Quanto do teto já gasto faz a meta pedir atenção antes de estourar. */
export const PERTO_DO_TETO = 0.8

/** Meses fechados que a média da sugestão olha. Três: um mês fora da curva não decide sozinho. */
export const MESES_DA_MEDIA = 3

// ---------------------------------------------------------------------------
// Calendário
// ---------------------------------------------------------------------------

export function mesDe(data: string): Mes {
  return data.slice(0, 7)
}

function partes(mes: Mes): [number, number] {
  const [ano, numero] = mes.split('-').map(Number)

  return [ano ?? 0, numero ?? 1]
}

function montar(ano: number, numero: number): Mes {
  return `${ano}-${String(numero).padStart(2, '0')}`
}

export function mesSeguinte(mes: Mes): Mes {
  const [ano, numero] = partes(mes)

  return numero === 12 ? montar(ano + 1, 1) : montar(ano, numero + 1)
}

export function mesAnterior(mes: Mes): Mes {
  const [ano, numero] = partes(mes)

  return numero === 1 ? montar(ano - 1, 12) : montar(ano, numero - 1)
}

export function diasNoMes(mes: Mes): number {
  const [ano, numero] = partes(mes)

  /* Dia zero do mês seguinte é o último deste — em UTC, para o fuso não puxar um dia. */
  return new Date(Date.UTC(ano, numero, 0)).getUTCDate()
}

export function primeiroDia(mes: Mes): ISODate {
  return `${mes}-01`
}

export function ultimoDia(mes: Mes): ISODate {
  return `${mes}-${String(diasNoMes(mes)).padStart(2, '0')}`
}

/**
 * Quantos dias do mês já correram, contando hoje.
 *
 * Mês passado está inteiro; mês futuro não começou. É este número que separa "fechado" de "em
 * curso" — e é por ele que o ritmo divide.
 */
export function diasCorridos(mes: Mes, hoje: ISODate): number {
  const atual = mesDe(hoje)

  if (mes < atual) {
    return diasNoMes(mes)
  }

  if (mes > atual) {
    return 0
  }

  return Number(hoje.slice(8, 10))
}

// ---------------------------------------------------------------------------
// O que aconteceu no mês
// ---------------------------------------------------------------------------

export type RealizadoDoMes = {
  mes: Mes
  /** Aplicações daqui, por vacina. Vacina sem dose no mês não aparece. */
  aplicacoesPorVacina: Record<string, number>
  aplicacoes: number
  /** Doses perdidas no mês, por qualquer motivo — a diferença de contagem inclusive. */
  perdas: number
  /** Centavos de lote recebido no mês: quantidade × custo unitário. */
  comprasCentavos: number
  dosesRecebidas: number
}

export function realizadoNoMes(entrada: {
  mes: Mes
  lotes: LoteDeVacina[]
  aplicacoes: AplicacaoVacina[]
}): RealizadoDoMes {
  const { mes } = entrada
  const aplicacoesPorVacina: Record<string, number> = {}
  let aplicacoes = 0

  for (const aplicacao of entrada.aplicacoes) {
    /* Dose externa não gastou frasco daqui, e não conta para a meta da geladeira daqui. */
    if (aplicacao.origem !== 'clinica' || mesDe(aplicacao.aplicadaEm) !== mes) {
      continue
    }

    aplicacoesPorVacina[aplicacao.vacinaId] = (aplicacoesPorVacina[aplicacao.vacinaId] ?? 0) + 1
    aplicacoes += 1
  }

  let perdas = 0
  let comprasCentavos = 0
  let dosesRecebidas = 0

  for (const lote of entrada.lotes) {
    if (mesDe(lote.recebidoEm) === mes) {
      comprasCentavos += lote.quantidadeRecebida * lote.custoUnitario
      dosesRecebidas += lote.quantidadeRecebida
    }

    for (const perda of lote.perdas) {
      if (mesDe(perda.em) === mes) {
        perdas += perda.quantidade
      }
    }
  }

  return { mes, aplicacoesPorVacina, aplicacoes, perdas, comprasCentavos, dosesRecebidas }
}

/** O que uma meta conta, lido do realizado do mês. */
export function valorRealizado(
  meta: Pick<MetaDeEstoque, 'tipo' | 'vacinaId'>,
  realizado: RealizadoDoMes,
) {
  if (meta.tipo === 'perdas') {
    return realizado.perdas
  }

  if (meta.tipo === 'compras') {
    return realizado.comprasCentavos
  }

  return meta.vacinaId === null
    ? realizado.aplicacoes
    : (realizado.aplicacoesPorVacina[meta.vacinaId] ?? 0)
}

// ---------------------------------------------------------------------------
// Progresso
// ---------------------------------------------------------------------------

export type SentidoDaMeta = 'piso' | 'teto'

/**
 * Onde a meta está.
 *
 * Quatro estados para os dois sentidos, e não oito, porque a tela pinta pelo estado e escreve pelo
 * par (sentido, estado): `cumprida` é "batida" no piso e "dentro do limite" no teto; `falhou` é "não
 * batida" e "estourou". A cor tem de dizer a mesma coisa nos dois — bom, atenção, ruim.
 */
export type SituacaoDaMeta = 'cumprida' | 'no-ritmo' | 'atencao' | 'falhou'

export function sentidoDe(tipo: TipoDeMeta): SentidoDaMeta {
  return tipo === 'aplicacoes' ? 'piso' : 'teto'
}

export type ProgressoDaMeta = {
  meta: MetaDeEstoque
  sentido: SentidoDaMeta
  realizado: number
  /**
   * O fim do mês no ritmo de hoje. Só a aplicação é projetada (regra 2); nas outras, e no mês
   * fechado, é o próprio realizado.
   */
  projecao: number
  /** Realizado sobre alvo. Passa de 1 quando a meta foi superada — ou estourada. */
  parte: number
  situacao: SituacaoDaMeta
}

export function projetar(realizado: number, mes: Mes, hoje: ISODate): number {
  const corridos = diasCorridos(mes, hoje)
  const total = diasNoMes(mes)

  if (corridos === 0) {
    return 0
  }

  return corridos >= total ? realizado : Math.round((realizado / corridos) * total)
}

export function progressoDaMeta(
  meta: MetaDeEstoque,
  realizado: RealizadoDoMes,
  hoje: ISODate,
): ProgressoDaMeta {
  const sentido = sentidoDe(meta.tipo)
  const valor = valorRealizado(meta, realizado)
  const fechado = diasCorridos(realizado.mes, hoje) >= diasNoMes(realizado.mes)
  const projecao = sentido === 'piso' ? projetar(valor, realizado.mes, hoje) : valor
  /*
   * Alvo zero: no piso, a meta nasce batida; no teto ("nenhuma perda"), a barra nasce vazia e
   * qualquer dose perdida a enche de uma vez. Dividir por zero dava o contrário nos dois.
   */
  const parte =
    meta.alvo > 0
      ? valor / meta.alvo
      : valor > 0
        ? Number.POSITIVE_INFINITY
        : sentido === 'piso'
          ? 1
          : 0

  let situacao: SituacaoDaMeta

  if (sentido === 'piso') {
    if (valor >= meta.alvo) {
      situacao = 'cumprida'
    } else if (fechado) {
      situacao = 'falhou'
    } else {
      situacao = projecao >= meta.alvo ? 'no-ritmo' : 'atencao'
    }
  } else if (valor > meta.alvo) {
    situacao = 'falhou'
  } else if (fechado) {
    situacao = 'cumprida'
  } else {
    situacao = meta.alvo > 0 && valor >= meta.alvo * PERTO_DO_TETO ? 'atencao' : 'no-ritmo'
  }

  return { meta, sentido, realizado: valor, projecao, parte, situacao }
}

/**
 * As metas do plano, na ordem em que se leem: o que falhou ou pede atenção primeiro.
 *
 * Dentro do mesmo estado, a ordem é a do plano — que é a ordem em que a clínica as escreveu.
 */
export function progressoDoPlano(
  plano: PlanoDeEstoque,
  realizado: RealizadoDoMes,
  hoje: ISODate,
): ProgressoDaMeta[] {
  const ordem: Record<SituacaoDaMeta, number> = {
    falhou: 0,
    atencao: 1,
    'no-ritmo': 2,
    cumprida: 3,
  }

  return plano.metas
    .map((meta, indice) => ({ indice, progresso: progressoDaMeta(meta, realizado, hoje) }))
    .sort(
      (a, b) => ordem[a.progresso.situacao] - ordem[b.progresso.situacao] || a.indice - b.indice,
    )
    .map((item) => item.progresso)
}

/** Placar do mês: quantas metas estão bem, sobre quantas existem. */
export function placar(progresso: ProgressoDaMeta[]) {
  return {
    total: progresso.length,
    bem: progresso.filter((item) => item.situacao === 'cumprida' || item.situacao === 'no-ritmo')
      .length,
    falhou: progresso.filter((item) => item.situacao === 'falhou').length,
    atencao: progresso.filter((item) => item.situacao === 'atencao').length,
  }
}

// ---------------------------------------------------------------------------
// Sugestão do próximo mês
// ---------------------------------------------------------------------------

/** De onde sai o número sugerido para uma vacina. A tela mostra os três ao lado da sugestão. */
export type ReferenciaDaVacina = {
  vacinaId: string
  nome: string
  /** Aplicadas no mês-base até hoje. */
  noMesBase: number
  /** O mês-base inteiro, no ritmo de hoje. */
  projecaoDoMesBase: number
  /** Média mensal dos meses fechados antes do mês-base. */
  mediaDoTrimestre: number
  /** Reforços que vencem no mês planejado — a demanda que a lista de chamada já conhece. */
  reforcosNoMes: number
  sugestao: number
}

export type SugestaoDePlano = {
  mes: Mes
  mesBase: Mes
  referencias: ReferenciaDaVacina[]
  /** Perdas do mês-base até hoje e a média do trimestre — a base do teto sugerido. */
  perdasNoMesBase: number
  mediaDePerdas: number
  metas: MetaDeEstoque[]
}

/** Um reforço da lista de chamada, só com o que a sugestão precisa. */
export type ReforcoPrevisto = { vacinaId: string; proximaDoseEm: ISODate }

/**
 * O plano que a tela abre preenchido.
 *
 * A meta de aplicação de cada vacina é o **maior** de três números: o mês atual no ritmo de hoje, a
 * média do trimestre e os reforços que já vencem no mês planejado. O ritmo diz o que a clínica está
 * fazendo; a média segura um começo de mês fraco (seis dias de outubro não falam pelo mês); e os
 * reforços dizem o que ela pode fazer se chamar quem vence — meta abaixo da demanda conhecida é
 * meta que se bate sem ligar para ninguém.
 *
 * O teto de perdas é **metade** da perda de referência: a perda zero é o objetivo, e propor zero
 * logo de cara é propor a meta que todo mundo ignora no dia 3.
 */
export function sugerirPlano(entrada: {
  mesPlanejado: Mes
  hoje: ISODate
  lotes: LoteDeVacina[]
  aplicacoes: AplicacaoVacina[]
  vacinas: Vacina[]
  reforcos: ReforcoPrevisto[]
  /** O orçamento sugerido — o custo do pedido de compra do mês planejado. */
  orcamentoCentavos: number
}): SugestaoDePlano {
  const { mesPlanejado, hoje, lotes, aplicacoes, vacinas } = entrada
  const mesBase = mesAnterior(mesPlanejado)
  const base = realizadoNoMes({ mes: mesBase, lotes, aplicacoes })

  const fechados: RealizadoDoMes[] = []
  let cursor = mesAnterior(mesBase)

  for (let i = 0; i < MESES_DA_MEDIA; i += 1) {
    fechados.push(realizadoNoMes({ mes: cursor, lotes, aplicacoes }))
    cursor = mesAnterior(cursor)
  }

  const referencias = vacinas.map<ReferenciaDaVacina>((vacina) => {
    const noMesBase = base.aplicacoesPorVacina[vacina.id] ?? 0
    const projecaoDoMesBase = projetar(noMesBase, mesBase, hoje)
    const mediaDoTrimestre =
      fechados.reduce((soma, mes) => soma + (mes.aplicacoesPorVacina[vacina.id] ?? 0), 0) /
      MESES_DA_MEDIA
    const reforcosNoMes = entrada.reforcos.filter(
      (reforco) => reforco.vacinaId === vacina.id && mesDe(reforco.proximaDoseEm) === mesPlanejado,
    ).length

    return {
      vacinaId: vacina.id,
      nome: vacina.nome,
      noMesBase,
      projecaoDoMesBase,
      mediaDoTrimestre: Math.round(mediaDoTrimestre * 10) / 10,
      reforcosNoMes,
      sugestao: Math.max(projecaoDoMesBase, reforcosNoMes, Math.round(mediaDoTrimestre)),
    }
  })

  const mediaDePerdas = fechados.reduce((soma, mes) => soma + mes.perdas, 0) / MESES_DA_MEDIA
  const referenciaDePerda = Math.max(base.perdas, mediaDePerdas)

  const metas: MetaDeEstoque[] = [
    ...referencias
      .filter((item) => item.sugestao > 0)
      .map<MetaDeEstoque>((item) => ({
        id: `sugestao-aplicacoes-${item.vacinaId}`,
        tipo: 'aplicacoes',
        vacinaId: item.vacinaId,
        alvo: item.sugestao,
      })),
    {
      id: 'sugestao-perdas',
      tipo: 'perdas',
      vacinaId: null,
      alvo: Math.floor(referenciaDePerda / 2),
    },
  ]

  if (entrada.orcamentoCentavos > 0) {
    metas.push({
      id: 'sugestao-compras',
      tipo: 'compras',
      vacinaId: null,
      alvo: entrada.orcamentoCentavos,
    })
  }

  return {
    mes: mesPlanejado,
    mesBase,
    referencias,
    perdasNoMesBase: base.perdas,
    mediaDePerdas: Math.round(mediaDePerdas * 10) / 10,
    metas,
  }
}

// ---------------------------------------------------------------------------
// Pedido de compra
// ---------------------------------------------------------------------------

export type LinhaDoPedido = {
  vacinaId: string
  nome: string
  /** Saldo de hoje que ainda está na validade quando o mês planejado começa. */
  saldoUtil: number
  /** O que ainda sai até o fim do mês atual, no ritmo de hoje. */
  saidaAteVirar: number
  /** O que sobra para o mês planejado: saldo útil menos a saída até virar. */
  sobra: number
  /** A meta de aplicações do mês planejado. Zero quando não há meta para a vacina. */
  meta: number
  minimo: number
  comprar: number
  /** Custo do lote mais recente, em centavos — o preço que o fornecedor praticou por último. */
  custoUnitario: number
  custoEstimado: number
  /** O fornecedor do lote mais recente. */
  fornecedor: string
}

/**
 * Quanto comprar para o mês planejado, vacina a vacina.
 *
 * A conta é a da regra 4: o mês termina com o mínimo **depois** de aplicar a meta. Logo,
 * `comprar = meta + mínimo − sobra`, nunca negativo.
 *
 * O saldo útil descarta o lote que vence antes de o mês planejado começar: dose que vai para o
 * descarte no dia 28 não aplica ninguém em novembro. O lote que vence **durante** o mês conta — é
 * o que a PEPS usa primeiro, e é exatamente para isso que ele existe.
 */
export function pedidoDeCompra(entrada: {
  mesPlanejado: Mes
  hoje: ISODate
  lotes: LoteNoEstoque[]
  vacinas: Vacina[]
  /** Meta de aplicações por vacina no mês planejado. */
  metaPorVacina: Record<string, number>
  /** Aplicadas no mês atual até hoje, por vacina — para estimar o que ainda sai até virar. */
  aplicadasNoMesAtual: Record<string, number>
}): LinhaDoPedido[] {
  const { mesPlanejado, hoje, lotes, vacinas } = entrada
  const mesAtual = mesDe(hoje)
  const inicio = primeiroDia(mesPlanejado)

  return vacinas
    .map<LinhaDoPedido>((vacina) => {
      const daVacina = lotes.filter((lote) => lote.vacinaId === vacina.id)
      const saldoUtil = daVacina
        .filter((lote) => lote.validade >= inicio)
        .reduce((soma, lote) => soma + lote.saldo, 0)

      /*
       * Só existe "até virar" quando o mês planejado é o seguinte ao atual. Planejar dezembro em
       * outubro pularia novembro inteiro na conta, e o pedido sairia curto um mês.
       */
      let saidaAteVirar = 0

      if (mesSeguinte(mesAtual) === mesPlanejado) {
        const feitas = entrada.aplicadasNoMesAtual[vacina.id] ?? 0

        saidaAteVirar = Math.max(0, projetar(feitas, mesAtual, hoje) - feitas)
      }

      const sobra = Math.max(0, saldoUtil - saidaAteVirar)
      const meta = entrada.metaPorVacina[vacina.id] ?? 0
      const comprar = Math.max(0, meta + vacina.estoqueMinimo - sobra)
      const recente = [...daVacina].sort((a, b) => b.recebidoEm.localeCompare(a.recebidoEm))[0]
      const custoUnitario = recente?.custoUnitario ?? 0

      return {
        vacinaId: vacina.id,
        nome: vacina.nome,
        saldoUtil,
        saidaAteVirar,
        sobra,
        meta,
        minimo: vacina.estoqueMinimo,
        comprar,
        custoUnitario,
        custoEstimado: comprar * custoUnitario,
        fornecedor: recente?.fornecedor ?? '',
      }
    })
    .sort((a, b) => b.comprar - a.comprar || a.nome.localeCompare(b.nome))
}

/** O custo do pedido inteiro, em centavos. */
export function custoDoPedido(linhas: LinhaDoPedido[]): number {
  return linhas.reduce((soma, linha) => soma + linha.custoEstimado, 0)
}

/** Dias que ainda faltam no mês, sem contar hoje — quanto ainda dá para correr atrás da meta. */
export function diasRestantes(mes: Mes, hoje: ISODate): number {
  return Math.max(0, diasNoMes(mes) - diasCorridos(mes, hoje))
}
