/**
 * O resultado do mês, pelo mês do atendimento (competência): o que a clínica faturou e o que custou
 * para faturar. É a conta que o dono faz de cabeça ("entrou tanto, saiu tanto"), em linhas:
 *
 *   faturamento − descontos − taxas do cartão − impostos = receita líquida
 *   receita líquida − repasses − custos (vacinas, remédios, laboratório) = margem
 *   margem − despesas fixas (aluguel, equipe, contas) = resultado
 *
 * **Mês em andamento:** a receita vai até hoje, e as despesas do mês entram na proporção dos dias
 * que passaram. Sem isso, o dia 5 (aluguel e salários) faria todo mês parecer prejuízo até o dia 20.
 */
import { addDays, diffDays } from '@/features/clinico/domain/clinic-time'
import type { Fatia } from '@/features/clinico/domain/resumo'

import {
  calcularRepasse,
  devidoDaConta,
  mesAnterior,
  mesDe,
  nomeDoMes,
  primeiroDoMes,
  ROTULO_DO_TIPO,
  taxasDaConta,
  totalBruto,
  totalDaConta,
  ultimoDoMes,
  type CategoriaDeDespesa,
  type Centavos,
  type DataISO,
  type MundoDoFinanceiro,
  type RegraDeRepasse,
  type TipoDeItem,
} from './dados'
import type { Recebivel } from './estado'

export const ALIQUOTA_DO_SIMPLES = 0.06

const CUSTOS: CategoriaDeDespesa[] = ['fornecedores', 'laboratorio']
const FIXAS: CategoriaDeDespesa[] = [
  'aluguel',
  'folha',
  'encargos',
  'consumo',
  'servicos',
  'manutencao',
  'marketing',
  'outros',
]

export type Demonstrativo = {
  mes: string
  parcial: boolean
  diasPassados: number
  diasDoMes: number
  faturamento: Centavos
  descontos: Centavos
  taxas: Centavos
  impostos: Centavos
  receitaLiquida: Centavos
  repasses: Centavos
  custos: Centavos
  margem: Centavos
  fixas: Centavos
  resultado: Centavos
  contas: number
  ticketMedio: Centavos
  porTipo: Fatia[]
  paraOndeFoi: Fatia[]
  /** O que já entrou (pagamentos de contas do mês). */
  recebido: Centavos
}

function fatias(valores: [string, string, number][]): Fatia[] {
  const total = valores.reduce((soma, [, , v]) => soma + Math.max(0, v), 0) || 1
  return valores
    .filter(([, , v]) => v > 0)
    .sort((a, b) => b[2] - a[2])
    .map(([id, rotulo, valor]) => ({ id, rotulo, valor, parte: valor / total }))
}

export function demonstrativo(
  mundo: MundoDoFinanceiro,
  regras: RegraDeRepasse[],
  mes: string,
  hoje: DataISO,
): Demonstrativo {
  const parcial = mes === mesDe(hoje)
  const ate = parcial ? hoje : ultimoDoMes(mes)
  const diasDoMes = Number(ultimoDoMes(mes).slice(8))
  const diasPassados = parcial ? Number(hoje.slice(8)) : diasDoMes
  const proporcao = diasPassados / diasDoMes

  const contas = mundo.contas.filter(
    (c) => mesDe(c.data) === mes && c.data <= ate && c.situacao !== 'correndo',
  )
  const faturamento = contas.reduce((soma, c) => soma + totalBruto(c), 0)
  const descontos = contas.reduce((soma, c) => soma + c.desconto, 0)
  const taxas = contas.reduce((soma, c) => soma + taxasDaConta(c), 0)
  const impostos = Math.round((faturamento - descontos) * ALIQUOTA_DO_SIMPLES)
  const receitaLiquida = faturamento - descontos - taxas - impostos
  const repasses = regras.reduce((soma, regra) => {
    const calculo = calcularRepasse(regra, mes, mundo, ate)
    return soma + calculo.bruto + calculo.aguardando
  }, 0)

  const despesasDoMes = mundo.despesas.filter((d) => mesDe(d.vencimento) === mes)
  const somaDe = (categorias: CategoriaDeDespesa[]) =>
    Math.round(
      despesasDoMes
        .filter((d) => categorias.includes(d.categoria))
        .reduce((soma, d) => soma + d.valor, 0) * proporcao,
    )
  const custos = somaDe(CUSTOS)
  const fixas = somaDe(FIXAS)
  const margem = receitaLiquida - repasses - custos
  const resultado = margem - fixas

  const porTipo = new Map<TipoDeItem, number>()
  for (const c of contas) {
    const fator = 1 - c.desconto / (totalBruto(c) || 1)
    for (const item of c.itens) {
      porTipo.set(item.tipo, (porTipo.get(item.tipo) ?? 0) + item.preco * item.quantidade * fator)
    }
  }

  const somaCategoria = (categoria: CategoriaDeDespesa) => somaDe([categoria])

  return {
    mes,
    parcial,
    diasPassados,
    diasDoMes,
    faturamento,
    descontos,
    taxas,
    impostos,
    receitaLiquida,
    repasses,
    custos,
    margem,
    fixas,
    resultado,
    contas: contas.length,
    ticketMedio: contas.length ? Math.round((faturamento - descontos) / contas.length) : 0,
    porTipo: fatias(
      [...porTipo.entries()].map(([tipo, valor]) => [
        tipo,
        ROTULO_DO_TIPO[tipo],
        Math.round(valor),
      ]),
    ),
    paraOndeFoi: fatias([
      ['repasses', 'Repasses aos veterinários', repasses],
      ['folha', 'Equipe (salários e encargos)', somaCategoria('folha') + somaCategoria('encargos')],
      ['custos', 'Vacinas, remédios e laboratório', custos],
      ['aluguel', 'Aluguel e condomínio', somaCategoria('aluguel')],
      ['impostos', 'Impostos', impostos],
      ['taxas', 'Taxas do cartão', taxas],
      [
        'contas',
        'Contas, serviços e manutenção',
        somaCategoria('consumo') +
          somaCategoria('servicos') +
          somaCategoria('manutencao') +
          somaCategoria('marketing') +
          somaCategoria('outros'),
      ],
    ]),
    recebido: contas.reduce((soma, c) => soma + (totalDaConta(c) - devidoDaConta(c)), 0),
  }
}

/** Faturamento até o mesmo dia do mês (para comparar o mês em andamento com o anterior). */
export function faturamentoAteODia(mundo: MundoDoFinanceiro, mes: string, dia: number) {
  const limite = `${mes}-${String(Math.min(dia, Number(ultimoDoMes(mes).slice(8)))).padStart(2, '0')}`
  return mundo.contas
    .filter((c) => mesDe(c.data) === mes && c.data <= limite && c.situacao !== 'correndo')
    .reduce((soma, c) => soma + totalDaConta(c), 0)
}

export type PontoDoMes = {
  mes: string
  rotulo: string
  entrou: Centavos
  saiu: Centavos
  resultado: Centavos
  parcial: boolean
}

export function mesAMes(
  mundo: MundoDoFinanceiro,
  regras: RegraDeRepasse[],
  hoje: DataISO,
  quantos = 6,
): PontoDoMes[] {
  const atual = mesDe(hoje)
  return Array.from({ length: quantos }, (_, i) => mesAnterior(atual, quantos - 1 - i)).map(
    (mes) => {
      const d = demonstrativo(mundo, regras, mes, hoje)
      const entrou = d.faturamento - d.descontos
      return {
        mes,
        rotulo: nomeDoMes(mes).slice(0, 3),
        entrou,
        saiu: entrou - d.resultado,
        resultado: d.resultado,
        parcial: d.parcial,
      }
    },
  )
}

export type Previsao = {
  dias: number
  entra: Centavos
  entraCartao: Centavos
  entraClientes: Centavos
  sai: Centavos
  saiVencido: Centavos
  saldo: Centavos
}

/** Os próximos dias: o que a maquininha deposita e os clientes devem, contra o que vence. */
export function previsao(
  mundo: MundoDoFinanceiro,
  recebiveis: Recebivel[],
  hoje: DataISO,
  dias = 30,
): Previsao {
  const limite = addDays(hoje, dias)
  const entraCartao = recebiveis
    .filter((r) => r.data <= limite)
    .reduce((soma, r) => soma + r.liquido, 0)
  const entraClientes = mundo.contas
    .filter((c) => c.situacao === 'em-aberto' && (c.vencimento ?? c.data) <= limite)
    .reduce((soma, c) => soma + devidoDaConta(c), 0)
  const abertas = mundo.despesas.filter((d) => !d.pagaEm && d.vencimento <= limite)
  const sai = abertas.reduce((soma, d) => soma + d.valor, 0)
  const saiVencido = abertas
    .filter((d) => d.vencimento < hoje)
    .reduce((soma, d) => soma + d.valor, 0)
  return {
    dias,
    entra: entraCartao + entraClientes,
    entraCartao,
    entraClientes,
    sai,
    saiVencido,
    saldo: entraCartao + entraClientes - sai,
  }
}

/** Os meses que a tela oferece: do atual para trás, até seis. */
export function mesesDisponiveis(hoje: DataISO, quantos = 6) {
  const atual = mesDe(hoje)
  return Array.from({ length: quantos }, (_, i) => mesAnterior(atual, i))
}

export function intervaloDoMes(mes: string, hoje: DataISO) {
  const inicio = primeiroDoMes(mes)
  const fim = mes === mesDe(hoje) ? hoje : ultimoDoMes(mes)
  return { inicio, fim, dias: diffDays(inicio, fim) + 1 }
}
