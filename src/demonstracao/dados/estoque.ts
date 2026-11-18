/**
 * O estoque de vacinas da demonstração como as telas o leem: a geladeira, os movimentos, a análise
 * e as metas do mês. Tudo é conta feita na hora sobre os lotes, as baixas e as aplicações de
 * `vacinas.ts`: aplicar, anular, receber, dar baixa e estornar mudam os números na mesma sessão.
 *
 * O que este arquivo exporta (para as agregadoras):
 * - `vacinasAbaixoDoMinimo()`: as vacinas com saldo menor que o mínimo (`VacinaNaGeladeira[]`);
 * - `lotesVencendo(dias = 30)`: os lotes com dose que vencem em até `dias` (`LoteDoEstoque[]`);
 * - `lotesVencidosComDose()`: o descarte pendente (`LoteDoEstoque[]`);
 * - `geladeira()`, `movimentos(filtro)`, `fornecedores()`, `analise(meses)`, `metas()`,
 *   `sugestao(mes)`, `pedidoDoMes(mes, metas, comTexto)` e `salvarPlanoDoMes(...)`: as respostas
 *   das rotas;
 * - `minimoDe(vacinaId)`: o mínimo que vale (o da clínica ou o padrão do catálogo).
 */
import type {
  Analise,
  Geladeira,
  LinhaDoPedido,
  LoteDoEstoque,
  Meta,
  MetaNova,
  Metas,
  MesFechado,
  Movimento,
  PaginaDeMovimentos,
  PedidoDeCompra,
  PlanoDeMetas,
  ProgressoDaMeta,
  SugestaoDeMetas,
  VacinaNaGeladeira,
} from '@/service/parceiro/estoque-service'

import { PARCEIRO_NOME } from '../base/clinica'
import { paciente } from '../base/cadastro'
import { agoraIso, diaDaSemana, diasEntre, hoje, instante, somarDias } from '../relogio'
import {
  aplicacoesEntre,
  BAIXAS,
  diasParaVencerDo,
  LOTES,
  loteDto,
  MINIMOS_DA_CLINICA,
  saldoDoLote,
  vacinaDoCatalogoPorId,
  vacinasDoCatalogo,
  vigentes,
  type LoteDaDemo,
  RAIVA,
  V10,
  V4,
} from './vacinas'

/* ---------------------------------------------------------------------------- contas */

function umaCasa(n: number) {
  return Math.round(n * 10) / 10
}

function quatroCasas(n: number) {
  return Math.round(n * 10_000) / 10_000
}

function mesDe(dia: string) {
  return dia.slice(0, 7)
}

function somarMeses(mes: string, n: number) {
  const [ano = 2026, m = 1] = mes.split('-').map(Number)
  const total = ano * 12 + (m - 1) + n
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

function diasNoMes(mes: string) {
  const [ano = 2026, m = 1] = mes.split('-').map(Number)
  return new Date(Date.UTC(ano, m, 0)).getUTCDate()
}

function ultimoDia(mes: string) {
  return `${mes}-${String(diasNoMes(mes)).padStart(2, '0')}`
}

function nomeDaVacina(id: string) {
  return vacinaDoCatalogoPorId(id)?.nome ?? id
}

export function minimoDe(vacinaId: string) {
  return (
    MINIMOS_DA_CLINICA.get(vacinaId) ?? vacinaDoCatalogoPorId(vacinaId)?.estoqueMinimoPadrao ?? 0
  )
}

/** As vacinas que a clínica guarda: tem lote ou mínimo próprio. */
function vacinasGuardadas() {
  return vacinasDoCatalogo().filter(
    (v) => LOTES.some((l) => l.vacinaId === v.id) || MINIMOS_DA_CLINICA.has(v.id),
  )
}

function lotesDa(vacinaId: string) {
  return LOTES.filter((l) => l.vacinaId === vacinaId)
}

/** Doses aplicadas aqui de uma vacina (ou de todas) entre dois dias. */
function aplicadasDe(vacinaId: string | null, de: string, ate: string) {
  return aplicacoesEntre(de, ate).filter((a) => !vacinaId || a.vacinaId === vacinaId).length
}

function perdidasEntre(de: string, ate: string) {
  return BAIXAS.filter((b) => !b.estorno && b.em >= de && b.em <= ate)
}

function recebidosEntre(de: string, ate: string) {
  return LOTES.filter((l) => l.recebidoEm >= de && l.recebidoEm <= ate)
}

function custoDaBaixa(loteId: string, quantidade: number) {
  const l = LOTES.find((x) => x.id === loteId)
  return l ? l.custoUnitarioCentavos * quantidade : 0
}

/* ------------------------------------------------------------------------- a geladeira */

const ORDEM_DA_SITUACAO = { ABAIXO_DO_MINIMO: 0, PERTO_DE_VENCER: 1, OK: 2 } as const

function vacinaNaGeladeira(vacinaId: string, diasDeConsumo = 90): VacinaNaGeladeira {
  const v = vacinaDoCatalogoPorId(vacinaId)
  const dia = hoje()
  let saldo = 0
  let dosesVencendo = 0
  let dosesVencidas = 0
  let valorParado = 0
  let valorEmRisco = 0
  for (const l of lotesDa(vacinaId)) {
    const doses = saldoDoLote(l)
    const dias = diasParaVencerDo(l)
    if (dias < 0) {
      dosesVencidas += doses
      valorEmRisco += doses * l.custoUnitarioCentavos
      continue
    }
    saldo += doses
    valorParado += doses * l.custoUnitarioCentavos
    if (dias <= 60) {
      dosesVencendo += doses
      valorEmRisco += doses * l.custoUnitarioCentavos
    }
  }
  const minimo = minimoDe(vacinaId)
  const abaixoDoMinimo = minimo > 0 && saldo < minimo
  const consumo = aplicadasDe(vacinaId, somarDias(dia, -(diasDeConsumo - 1)), dia)
  return {
    vacinaId,
    nome: v?.nome ?? vacinaId,
    fabricante: v?.fabricante ?? null,
    saldo,
    minimo,
    minimoPadrao: v?.estoqueMinimoPadrao ?? 0,
    minimoDaClinica: MINIMOS_DA_CLINICA.has(vacinaId),
    situacao: abaixoDoMinimo ? 'ABAIXO_DO_MINIMO' : dosesVencendo > 0 ? 'PERTO_DE_VENCER' : 'OK',
    abaixoDoMinimo,
    zerado: saldo === 0,
    pertoDeVencer: dosesVencendo > 0,
    dosesVencendo,
    dosesVencidas,
    coberturaEmDias: consumo ? Math.floor(saldo / (consumo / diasDeConsumo)) : null,
    consumoMensal: umaCasa((consumo / diasDeConsumo) * 30),
    valorParadoCentavos: valorParado,
    valorEmRiscoCentavos: valorEmRisco,
  }
}

function ordenarVacinas(lista: VacinaNaGeladeira[]) {
  return lista.sort(
    (x, y) =>
      ORDEM_DA_SITUACAO[x.situacao] - ORDEM_DA_SITUACAO[y.situacao] ||
      Number(y.zerado) - Number(x.zerado) ||
      x.nome.localeCompare(y.nome),
  )
}

const ORDEM_DO_LOTE: Record<LoteDoEstoque['situacao'], number> = {
  VENCIDO: 0,
  VENCENDO: 1,
  ATIVO: 2,
  ESGOTADO: 3,
}

export function geladeira(): Geladeira {
  const dia = hoje()
  const vacinas = ordenarVacinas(vacinasGuardadas().map((v) => vacinaNaGeladeira(v.id)))
  const lotes = LOTES.filter((l) => l.validade >= somarDias(dia, -180))
    .map(loteDto)
    .sort(
      (x, y) =>
        ORDEM_DO_LOTE[x.situacao] - ORDEM_DO_LOTE[y.situacao] ||
        x.validade.localeCompare(y.validade),
    )
  const comDose = lotes.filter((l) => l.saldo > 0)
  return {
    hoje: dia,
    indicadores: {
      dosesEmEstoque: vacinas.reduce((s, v) => s + v.saldo, 0),
      dosesVencendo: vacinas.reduce((s, v) => s + v.dosesVencendo, 0),
      lotesVencendo: comDose.filter((l) => l.situacao === 'VENCENDO').length,
      dosesVencidas: vacinas.reduce((s, v) => s + v.dosesVencidas, 0),
      lotesVencidos: comDose.filter((l) => l.situacao === 'VENCIDO').length,
      vacinasAbaixoDoMinimo: vacinas.filter((v) => v.abaixoDoMinimo).length,
      valorParadoCentavos: vacinas.reduce((s, v) => s + (v.valorParadoCentavos ?? 0), 0),
      valorEmRiscoCentavos: vacinas.reduce((s, v) => s + (v.valorEmRiscoCentavos ?? 0), 0),
    },
    vacinas,
    lotes,
    truncado: false,
  }
}

export function vacinasAbaixoDoMinimo(): VacinaNaGeladeira[] {
  return geladeira().vacinas.filter((v) => v.abaixoDoMinimo)
}

export function lotesVencendo(dias = 30): LoteDoEstoque[] {
  return LOTES.filter((l) => {
    const faltam = diasParaVencerDo(l)
    return saldoDoLote(l) > 0 && faltam >= 0 && faltam <= dias
  }).map(loteDto)
}

export function lotesVencidosComDose(): LoteDoEstoque[] {
  return LOTES.filter((l) => saldoDoLote(l) > 0 && diasParaVencerDo(l) < 0).map(loteDto)
}

export function fornecedores(): string[] {
  const vistos = new Map<string, string>()
  for (const l of [...LOTES].sort((x, y) => Date.parse(y.criadoEm) - Date.parse(x.criadoEm))) {
    if (!l.fornecedor) continue
    const chave = l.fornecedor.toLocaleLowerCase('pt-BR')
    if (!vistos.has(chave)) vistos.set(chave, l.fornecedor)
  }
  return [...vistos.values()].slice(0, 50)
}

/* ----------------------------------------------------------------------- os movimentos */

function entradaDo(l: LoteDaDemo): Movimento {
  return {
    id: l.id,
    tipo: 'ENTRADA',
    em: l.recebidoEm,
    criadoEm: l.criadoEm,
    loteId: l.id,
    codigo: l.codigo,
    vacina: { id: l.vacinaId, nome: nomeDaVacina(l.vacinaId) },
    quantidade: l.quantidadeRecebida,
    motivo: null,
    fornecedor: l.fornecedor,
    notaFiscal: l.notaFiscal,
    observacao: null,
    quemNome: l.quemNome,
    conferidoPor: l.conferidoPor,
    estorno: null,
    valorCentavos: l.quantidadeRecebida * l.custoUnitarioCentavos,
  }
}

function todosOsMovimentos(): Movimento[] {
  const lista = LOTES.map(entradaDo)
  for (const b of BAIXAS) {
    const l = LOTES.find((x) => x.id === b.loteId)
    if (!l) continue
    lista.push({
      id: b.id,
      tipo: 'BAIXA',
      em: b.em,
      criadoEm: b.criadaEm,
      loteId: l.id,
      codigo: l.codigo,
      vacina: { id: l.vacinaId, nome: nomeDaVacina(l.vacinaId) },
      quantidade: b.quantidade,
      motivo: b.motivo,
      fornecedor: null,
      notaFiscal: null,
      observacao: b.observacao,
      quemNome: b.quemNome,
      conferidoPor: null,
      estorno: b.estorno,
      valorCentavos: custoDaBaixa(l.id, b.quantidade),
    })
  }
  return lista.sort((x, y) => Date.parse(y.criadoEm) - Date.parse(x.criadoEm))
}

/**
 * Entradas e baixas do período, da mais recente. Sem período, do primeiro dia de três meses atrás
 * até hoje. O cursor leva a posição e o período (`posição|de|ate`), como o da API.
 */
export function movimentos(filtro: {
  tipo: Movimento['tipo'] | null
  de: string | null
  ate: string | null
  cursor: string | null
  limite: number
}): PaginaDeMovimentos {
  const dia = hoje()
  let inicio = 0
  let de = filtro.de ?? `${somarMeses(mesDe(dia), -3)}-01`
  let ate = filtro.ate ?? dia
  if (filtro.cursor) {
    const [posicao, deDoCursor, ateDoCursor] = filtro.cursor.split('|')
    inicio = Number(posicao) || 0
    de = deDoCursor || de
    ate = ateDoCursor || ate
  }
  const lista = todosOsMovimentos().filter(
    (m) => (!filtro.tipo || m.tipo === filtro.tipo) && m.em >= de && m.em <= ate,
  )
  const itens = lista.slice(inicio, inicio + filtro.limite)
  const fim = inicio + filtro.limite
  return { de, ate, itens, proximoCursor: fim < lista.length ? `${fim}|${de}|${ate}` : null }
}

/* -------------------------------------------------------------------------- a análise */

export function analise(meses: number): Analise {
  const dia = hoje()
  const atual = mesDe(dia)
  const primeiro = somarMeses(atual, -(meses - 1))
  const de = `${primeiro}-01`
  const daJanela = aplicacoesEntre(de, dia)

  const listaDeMeses = Array.from({ length: meses }, (_, i) => somarMeses(primeiro, i))
  const giroDosMeses = listaDeMeses.map((mes) => {
    const doMes = daJanela.filter((a) => mesDe(a.aplicadaEm) === mes)
    const porVacina = new Map<string, number>()
    for (const a of doMes) porVacina.set(a.vacinaId, (porVacina.get(a.vacinaId) ?? 0) + 1)
    return {
      mes,
      parcial: mes === atual,
      total: doMes.length,
      porVacina: [...porVacina.entries()]
        .map(([vacinaId, doses]) => ({ vacinaId, doses }))
        .sort((x, y) => y.doses - x.doses),
    }
  })

  const porVacina = new Map<string, number>()
  for (const a of daJanela) porVacina.set(a.vacinaId, (porVacina.get(a.vacinaId) ?? 0) + 1)
  const diasDaJanela = Math.max(1, diasEntre(de, dia) + 1)

  const saldoContraMinimo = ordenarVacinas(
    vacinasGuardadas().map((v) => vacinaNaGeladeira(v.id, diasDaJanela)),
  ).map((v) => ({
    vacinaId: v.vacinaId,
    nome: v.nome,
    saldo: v.saldo,
    minimo: v.minimo,
    situacao: v.situacao,
    abaixoDoMinimo: v.abaixoDoMinimo,
    zerado: v.zerado,
    coberturaEmDias: v.coberturaEmDias,
  }))

  const perdidas = perdidasEntre(de, dia)
  const porMotivo = new Map<NonNullable<Movimento['motivo']>, { doses: number; valor: number }>()
  for (const b of perdidas) {
    const atualDoMotivo = porMotivo.get(b.motivo) ?? { doses: 0, valor: 0 }
    atualDoMotivo.doses += b.quantidade
    atualDoMotivo.valor += custoDaBaixa(b.loteId, b.quantidade)
    porMotivo.set(b.motivo, atualDoMotivo)
  }
  const dosesRecebidas = recebidosEntre(de, dia).reduce((s, l) => s + l.quantidadeRecebida, 0)
  const dosesPerdidas = perdidas.reduce((s, b) => s + b.quantidade, 0)

  const faixas = {
    VENCIDO: { lotes: 0, doses: 0, valor: 0 },
    ATE_30_DIAS: { lotes: 0, doses: 0, valor: 0 },
    DE_31_A_60_DIAS: { lotes: 0, doses: 0, valor: 0 },
    ACIMA_DE_60_DIAS: { lotes: 0, doses: 0, valor: 0 },
  }
  for (const l of LOTES) {
    const doses = saldoDoLote(l)
    if (!doses) continue
    const dias = diasParaVencerDo(l)
    const faixa =
      dias < 0
        ? faixas.VENCIDO
        : dias <= 30
          ? faixas.ATE_30_DIAS
          : dias <= 60
            ? faixas.DE_31_A_60_DIAS
            : faixas.ACIMA_DE_60_DIAS
    faixa.lotes++
    faixa.doses += doses
    faixa.valor += doses * l.custoUnitarioCentavos
  }

  return {
    hoje: dia,
    meses,
    de,
    giro: {
      meses: giroDosMeses,
      vacinas: [...porVacina.entries()]
        .map(([vacinaId, doses]) => ({
          vacinaId,
          nome: nomeDaVacina(vacinaId),
          doses,
          mediaMensal: umaCasa(doses / meses),
        }))
        .sort((x, y) => y.doses - x.doses || x.nome.localeCompare(y.nome)),
    },
    saldoContraMinimo,
    perdas: {
      dosesRecebidas,
      dosesPerdidas,
      perdaPercentual: dosesRecebidas ? quatroCasas(dosesPerdidas / dosesRecebidas) : 0,
      porMotivo: [...porMotivo.entries()]
        .map(([motivo, conta]) => ({ motivo, doses: conta.doses, valorCentavos: conta.valor }))
        .sort((x, y) => y.doses - x.doses),
      valorPerdidoCentavos: perdidas.reduce((s, b) => s + custoDaBaixa(b.loteId, b.quantidade), 0),
    },
    validade: {
      faixas: (Object.keys(faixas) as Array<keyof typeof faixas>).map((faixa) => ({
        faixa,
        lotes: faixas[faixa].lotes,
        doses: faixas[faixa].doses,
        valorCentavos: faixas[faixa].valor,
      })),
      valorEmRiscoCentavos:
        faixas.VENCIDO.valor + faixas.ATE_30_DIAS.valor + faixas.DE_31_A_60_DIAS.valor,
    },
    truncado: false,
  }
}

/* ------------------------------------------------------------------------------ as metas */

type PlanoDaDemo = {
  mes: string
  versao: number
  baseadoEm: string | null
  atualizadoEm: string
  metas: Meta[]
}

const PLANOS = new Map<string, PlanoDaDemo>()
let sequenciaDeMeta = 0

const ORDEM_DO_TIPO: Record<Meta['tipo'], number> = { APLICACOES: 0, PERDAS: 1, COMPRAS: 2 }

function ordenarMetas(metas: Meta[]) {
  return metas.sort(
    (x, y) =>
      ORDEM_DO_TIPO[x.tipo] - ORDEM_DO_TIPO[y.tipo] ||
      Number(Boolean(x.vacinaId)) - Number(Boolean(y.vacinaId)) ||
      (x.vacinaNome ?? '').localeCompare(y.vacinaNome ?? ''),
  )
}

function meta(tipo: Meta['tipo'], vacinaId: string | null, alvo: number): Meta {
  return {
    id: `demo-meta-${++sequenciaDeMeta}`,
    tipo,
    vacinaId,
    vacinaNome: vacinaId ? nomeDaVacina(vacinaId) : null,
    alvo,
  }
}

function planoDto(plano: PlanoDaDemo): PlanoDeMetas {
  return {
    mes: plano.mes,
    versao: plano.versao,
    baseadoEm: plano.baseadoEm,
    atualizadoEm: plano.atualizadoEm,
    metas: ordenarMetas([...plano.metas]),
  }
}

/** O que o mês fez até `ate` (o mês inteiro, quando já fechou). */
function realizadoDo(mes: string, ate = ultimoDia(mes)) {
  const de = `${mes}-01`
  const recebidos = recebidosEntre(de, ate)
  return {
    aplicacoes: aplicadasDe(null, de, ate),
    perdas: perdidasEntre(de, ate).reduce((s, b) => s + b.quantidade, 0),
    dosesRecebidas: recebidos.reduce((s, l) => s + l.quantidadeRecebida, 0),
    comprasCentavos: recebidos.reduce(
      (s, l) => s + l.quantidadeRecebida * l.custoUnitarioCentavos,
      0,
    ),
  }
}

function realizadoDaMeta(m: Pick<Meta, 'tipo' | 'vacinaId'>, mes: string, ate: string) {
  if (m.tipo === 'APLICACOES') return aplicadasDe(m.vacinaId, `${mes}-01`, ate)
  const r = realizadoDo(mes, ate)
  return m.tipo === 'PERDAS' ? r.perdas : r.comprasCentavos
}

const ORDEM_DO_PROGRESSO: Record<ProgressoDaMeta['situacao'], number> = {
  falhou: 0,
  atencao: 1,
  'no-ritmo': 2,
  cumprida: 3,
}

function progressoDo(plano: PlanoDaDemo, fechado: boolean): ProgressoDaMeta[] {
  const dia = hoje()
  const ate = fechado ? ultimoDia(plano.mes) : dia
  const corridos = fechado ? diasNoMes(plano.mes) : Number(dia.slice(8, 10))
  return plano.metas
    .map((m): ProgressoDaMeta => {
      const sentido = m.tipo === 'APLICACOES' ? 'piso' : 'teto'
      const realizado = realizadoDaMeta(m, plano.mes, ate)
      const projecao =
        sentido === 'piso' && !fechado
          ? Math.round((realizado / Math.max(1, corridos)) * diasNoMes(plano.mes))
          : realizado
      const parte = m.alvo > 0 ? quatroCasas(realizado / m.alvo) : realizado > 0 ? null : 0
      let situacao: ProgressoDaMeta['situacao']
      if (sentido === 'piso') {
        situacao =
          realizado >= m.alvo
            ? 'cumprida'
            : fechado
              ? 'falhou'
              : projecao >= m.alvo
                ? 'no-ritmo'
                : 'atencao'
      } else {
        situacao =
          realizado > m.alvo
            ? 'falhou'
            : fechado
              ? 'cumprida'
              : m.alvo > 0 && realizado >= 0.8 * m.alvo
                ? 'atencao'
                : 'no-ritmo'
      }
      return { meta: { ...m }, sentido, realizado, projecao, parte, situacao }
    })
    .sort((x, y) => ORDEM_DO_PROGRESSO[x.situacao] - ORDEM_DO_PROGRESSO[y.situacao])
}

function placarDe(progresso: ProgressoDaMeta[]) {
  return {
    total: progresso.length,
    bem: progresso.filter((p) => p.situacao === 'cumprida' || p.situacao === 'no-ritmo').length,
    falhou: progresso.filter((p) => p.situacao === 'falhou').length,
    atencao: progresso.filter((p) => p.situacao === 'atencao').length,
  }
}

export function metas(): Metas {
  const dia = hoje()
  const atual = mesDe(dia)
  const proximo = somarMeses(atual, 1)
  const planoAtual = PLANOS.get(atual) ?? null
  const progresso = planoAtual ? progressoDo(planoAtual, false) : []
  const corridos = Number(dia.slice(8, 10))

  const historico: MesFechado[] = [...PLANOS.values()]
    .filter((p) => p.mes < atual)
    .sort((x, y) => y.mes.localeCompare(x.mes))
    .slice(0, 6)
    .map((p) => {
      const fechado = progressoDo(p, true)
      return {
        mes: p.mes,
        versao: p.versao,
        baseadoEm: p.baseadoEm,
        atualizadoEm: p.atualizadoEm,
        realizado: realizadoDo(p.mes),
        progresso: fechado,
        placar: placarDe(fechado),
      }
    })

  const planoDoProximo = PLANOS.get(proximo) ?? null
  return {
    hoje: dia,
    dinheiro: true,
    atual: {
      mes: atual,
      diasNoMes: diasNoMes(atual),
      diasCorridos: corridos,
      diasRestantes: diasNoMes(atual) - corridos,
      plano: planoAtual ? planoDto(planoAtual) : null,
      realizado: realizadoDo(atual, dia),
      progresso,
      placar: placarDe(progresso),
    },
    proximo: {
      mes: proximo,
      plano: planoDoProximo ? planoDto(planoDoProximo) : null,
      convite: !planoDoProximo,
    },
    historico,
    truncado: false,
  }
}

export type ErroDasMetas = { status: number; codigo: string; mensagem: string; extra?: object }

/** Grava o plano inteiro do mês (o em curso ou o seguinte), com a versão que a tela abriu. */
export function salvarPlanoDoMes(
  mes: string,
  corpo: { metas?: MetaNova[]; baseadoEm?: string | null; versao?: number | null },
): PlanoDeMetas | ErroDasMetas {
  const atual = mesDe(hoje())
  if (mes !== atual && mes !== somarMeses(atual, 1)) {
    return {
      status: 400,
      codigo: 'MES_FORA_DA_JANELA',
      mensagem: 'Só o mês em curso ou o seguinte.',
    }
  }
  const existente = PLANOS.get(mes)
  const versaoAtual = existente?.versao ?? 0
  if ((corpo.versao ?? 0) !== versaoAtual) {
    return {
      status: 409,
      codigo: 'PLANO_ALTERADO',
      mensagem: 'Outra pessoa mudou as metas deste mês enquanto você editava.',
      extra: { versao: versaoAtual },
    }
  }
  const entradas = corpo.metas ?? []
  if (entradas.length > 120) {
    return { status: 400, codigo: 'PLANO_METAS_DEMAIS', mensagem: 'Até 120 metas por mês.' }
  }
  for (const m of entradas) {
    const invalida =
      (m.tipo !== 'APLICACOES' && m.vacinaId) ||
      !Number.isInteger(m.alvo) ||
      m.alvo < 0 ||
      (m.vacinaId && !vacinaDoCatalogoPorId(m.vacinaId))
    if (invalida) {
      return { status: 400, codigo: 'META_INVALIDA', mensagem: 'Uma das metas não vale.' }
    }
  }
  const plano: PlanoDaDemo = {
    mes,
    versao: versaoAtual + 1,
    baseadoEm: corpo.baseadoEm ?? null,
    atualizadoEm: agoraIso(),
    metas: entradas.map((m) => meta(m.tipo, m.vacinaId ?? null, m.alvo)),
  }
  PLANOS.set(mes, plano)
  return planoDto(plano)
}

/* -------------------------------------------------------------------- sugestão e pedido */

/** A média mensal dos três meses fechados antes de `mes`. */
function mediaDoTrimestre(mes: string, conta: (m: string) => number) {
  const meses = [1, 2, 3].map((n) => somarMeses(mes, -n))
  return umaCasa(meses.reduce((s, m) => s + conta(m), 0) / 3)
}

/** O pedido de compra que as metas de aplicação de `mes` pedem. Não grava nada. */
export function pedidoDoMes(mes: string, entradas: MetaNova[], comTexto: boolean): PedidoDeCompra {
  const dia = hoje()
  const atual = mesDe(dia)
  const ehOProximo = mes === somarMeses(atual, 1)
  const corridos = Number(dia.slice(8, 10))
  const restantes = diasNoMes(atual) - corridos
  const valeAte = ehOProximo ? `${mes}-01` : dia

  const ids = new Set(vacinasGuardadas().map((v) => v.id))
  for (const m of entradas) if (m.tipo === 'APLICACOES' && m.vacinaId) ids.add(m.vacinaId)

  const linhas: LinhaDoPedido[] = [...ids].map((vacinaId) => {
    const lotes = lotesDa(vacinaId)
    const saldoUtil = lotes
      .filter((l) => l.validade >= valeAte)
      .reduce((s, l) => s + saldoDoLote(l), 0)
    const noMes = aplicadasDe(vacinaId, `${atual}-01`, dia)
    const saidaAteVirar = ehOProximo ? Math.round((noMes / Math.max(1, corridos)) * restantes) : 0
    const sobra = Math.max(0, saldoUtil - saidaAteVirar)
    const alvo = entradas.find((m) => m.tipo === 'APLICACOES' && m.vacinaId === vacinaId)?.alvo ?? 0
    const minimo = minimoDe(vacinaId)
    const comprar = Math.max(0, alvo + minimo - sobra)
    const recente = [...lotes].sort((x, y) => y.recebidoEm.localeCompare(x.recebidoEm))[0]
    const custo = recente?.custoUnitarioCentavos ?? 0
    return {
      vacinaId,
      nome: nomeDaVacina(vacinaId),
      saldoUtil,
      saidaAteVirar,
      sobra,
      meta: alvo,
      minimo,
      comprar,
      conta: `${alvo} + ${minimo} - ${sobra} = ${alvo + minimo - sobra}`,
      fornecedor: recente?.fornecedor ?? null,
      custoUnitarioCentavos: custo,
      custoEstimadoCentavos: comprar * custo,
      semCusto: !recente,
    }
  })
  linhas.sort((x, y) => y.comprar - x.comprar || x.nome.localeCompare(y.nome))

  const pedido: PedidoDeCompra = {
    mes,
    hoje: dia,
    linhas,
    custoTotalCentavos: linhas
      .filter((l) => !l.semCusto)
      .reduce((s, l) => s + l.custoEstimadoCentavos, 0),
    vacinasSemCusto: linhas
      .filter((l) => l.semCusto && l.comprar > 0)
      .map((l) => ({ vacinaId: l.vacinaId, nome: l.nome, comprar: l.comprar })),
    truncado: false,
  }
  if (comTexto) pedido.texto = textoDoPedido(mes, linhas)
  return pedido
}

function nomeDoMes(mes: string) {
  const [ano = 2026, m = 1] = mes.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(Date.UTC(ano, m - 1, 1))
}

/** O pedido para copiar, por fornecedor, sem preço. */
function textoDoPedido(mes: string, linhas: LinhaDoPedido[]) {
  const porFornecedor = new Map<string, LinhaDoPedido[]>()
  for (const l of linhas.filter((x) => x.comprar > 0)) {
    const chave = l.fornecedor ?? 'Sem fornecedor definido'
    porFornecedor.set(chave, [...(porFornecedor.get(chave) ?? []), l])
  }
  const blocos = [...porFornecedor.entries()].map(([fornecedor, itens]) =>
    [
      fornecedor,
      ...itens.map((l) => `- ${l.nome}: ${l.comprar} ${l.comprar === 1 ? 'dose' : 'doses'}`),
    ].join('\n'),
  )
  return [
    `Pedido de vacinas para ${nomeDoMes(mes)}`,
    PARCEIRO_NOME,
    '',
    ...blocos.flatMap((b) => [b, '']),
  ]
    .join('\n')
    .trim()
}

/** A sugestão de metas para `mes` (sem mês, o seguinte), pelo ritmo, pela média e pelos reforços. */
export function sugestao(mesPedido: string | null): SugestaoDeMetas {
  const dia = hoje()
  const atual = mesDe(dia)
  const mes = mesPedido ?? somarMeses(atual, 1)
  const mesBase = somarMeses(mes, -1)
  const baseEmCurso = mesBase === atual
  const corridos = Number(dia.slice(8, 10))
  const ateNaBase = baseEmCurso ? dia : ultimoDia(mesBase)

  const reforcos = new Map<string, number>()
  for (const a of vigentes()) {
    if (a.dose < a.dosesNaSerie || mesDe(a.proximaDoseEm) !== mes) continue
    if (!paciente(a.pacienteId)?.ativo) continue
    reforcos.set(a.vacinaId, (reforcos.get(a.vacinaId) ?? 0) + 1)
  }

  const referencias = vacinasDoCatalogo()
    .map((v) => {
      const noMesBase = aplicadasDe(v.id, `${mesBase}-01`, ateNaBase)
      const projecaoDoMesBase = baseEmCurso
        ? Math.round((noMesBase / Math.max(1, corridos)) * diasNoMes(mesBase))
        : noMesBase
      const media = mediaDoTrimestre(mesBase, (m) => aplicadasDe(v.id, `${m}-01`, ultimoDia(m)))
      const reforcosNoMes = reforcos.get(v.id) ?? 0
      const sugestaoDaVacina = Math.ceil(Math.max(projecaoDoMesBase, media, reforcosNoMes))
      const origem =
        sugestaoDaVacina === 0
          ? null
          : projecaoDoMesBase >= media && projecaoDoMesBase >= reforcosNoMes
            ? ('RITMO' as const)
            : media >= reforcosNoMes
              ? ('MEDIA' as const)
              : ('REFORCOS' as const)
      return {
        vacinaId: v.id,
        nome: v.nome,
        noMesBase,
        projecaoDoMesBase,
        mediaDoTrimestre: media,
        reforcosNoMes,
        sugestao: sugestaoDaVacina,
        origem,
      }
    })
    .filter((r) => r.sugestao > 0)
    .sort((x, y) => y.sugestao - x.sugestao || x.nome.localeCompare(y.nome))

  const perdasNoMesBase = realizadoDo(mesBase, ateNaBase).perdas
  const mediaDePerdas = mediaDoTrimestre(mesBase, (m) => realizadoDo(m).perdas)
  const mesesComDado = [1, 2, 3].filter(
    (n) =>
      aplicadasDe(null, `${somarMeses(mesBase, -n)}-01`, ultimoDia(somarMeses(mesBase, -n))) > 0,
  ).length

  const deAplicacao: MetaNova[] = referencias.map((r) => ({
    tipo: 'APLICACOES',
    vacinaId: r.vacinaId,
    alvo: r.sugestao,
  }))
  const pedido = pedidoDoMes(mes, deAplicacao, false)
  const total = referencias.reduce((s, r) => s + r.sugestao, 0)

  const metasSugeridas = [
    { tipo: 'APLICACOES' as const, vacinaId: null, vacinaNome: null, alvo: total },
    ...referencias.map((r) => ({
      tipo: 'APLICACOES' as const,
      vacinaId: r.vacinaId,
      vacinaNome: r.nome,
      alvo: r.sugestao,
    })),
    {
      tipo: 'PERDAS' as const,
      vacinaId: null,
      vacinaNome: null,
      alvo: Math.ceil(Math.max(perdasNoMesBase, mediaDePerdas) / 2),
    },
    ...(pedido.custoTotalCentavos > 0
      ? [
          {
            tipo: 'COMPRAS' as const,
            vacinaId: null,
            vacinaNome: null,
            alvo: pedido.custoTotalCentavos,
          },
        ]
      : []),
  ]

  return {
    mes,
    mesBase,
    hoje: dia,
    referencias,
    perdasNoMesBase,
    mediaDePerdas,
    mesesComDado,
    metas: metasSugeridas,
    orcamentoSugeridoCentavos: pedido.custoTotalCentavos,
    pedido,
    truncado: false,
  }
}

/* ---------------------------------------------------------------------- a carga das metas */

function arredondar(valor: number, passo: number) {
  return Math.max(passo, Math.round(valor / passo) * passo)
}

function diaUtilDoMes(mes: string, dia: number) {
  let data = `${mes}-${String(dia).padStart(2, '0')}`
  while (diaDaSemana(data) === 0 || diaDaSemana(data) === 6) data = somarDias(data, 1)
  return data
}

/**
 * Os planos já combinados: o do mês em curso (no ritmo, uma vacina pedindo atenção e as compras
 * perto do teto) e os dois meses fechados (um pouco de cada: cumpridas e falhas).
 */
function montarMetas() {
  const dia = hoje()
  const atual = mesDe(dia)
  const corridos = Math.max(1, Number(dia.slice(8, 10)))
  const projecao = (vacinaId: string | null) =>
    (aplicadasDe(vacinaId, `${atual}-01`, dia) / corridos) * diasNoMes(atual)

  for (const [n, versao] of [
    [2, 3],
    [1, 2],
  ] as const) {
    const mes = somarMeses(atual, -n)
    const feito = (vacinaId: string | null) => aplicadasDe(vacinaId, `${mes}-01`, ultimoDia(mes))
    const r = realizadoDo(mes)
    const metasDoMes = [
      meta('APLICACOES', null, Math.max(5, feito(null) - 2)),
      meta('APLICACOES', V10, n === 1 ? feito(V10) + 2 : Math.max(1, feito(V10) - 1)),
      meta('APLICACOES', RAIVA, Math.max(1, feito(RAIVA) - 1)),
      meta('PERDAS', null, 2),
      meta('COMPRAS', null, arredondar(r.comprasCentavos * (n === 1 ? 0.9 : 1.2), 5000)),
    ]
    PLANOS.set(mes, {
      mes,
      versao,
      baseadoEm: somarMeses(mes, -1),
      atualizadoEm: instante(diaUtilDoMes(mes, 2), '10:12'),
      metas: metasDoMes,
    })
  }

  const compras = realizadoDo(atual, dia).comprasCentavos
  PLANOS.set(atual, {
    mes: atual,
    versao: 2,
    baseadoEm: somarMeses(atual, -1),
    atualizadoEm: instante(diaUtilDoMes(atual, 2), '09:48'),
    metas: [
      meta('APLICACOES', null, arredondar(projecao(null) * 0.95, 5)),
      meta('APLICACOES', V10, Math.max(4, Math.ceil(projecao(V10) * 1.35))),
      meta('APLICACOES', RAIVA, Math.max(4, Math.round(projecao(RAIVA) * 0.9))),
      meta('APLICACOES', V4, Math.max(2, Math.round(projecao(V4)))),
      meta('PERDAS', null, 3),
      meta('COMPRAS', null, arredondar(compras * 1.12, 5000)),
    ],
  })
}

montarMetas()
