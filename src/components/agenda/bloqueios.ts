/**
 * A lista de bloqueios (E3-01, seção 1.5) sem repetir a série. A leitura do período devolve uma
 * ocorrência por dia; o bloqueio que se repete toda semana aparece aqui uma vez só, com os dias
 * dele guardados (para mudar ou tirar só um). O bloqueio único fica no dia em que começa.
 */
import type { OcorrenciaDeBloqueio } from '@/service/parceiro/agenda-config-service'

export type SerieDaLista = {
  bloqueioId: string
  /** A primeira ocorrência no período: o horário, o motivo e de quem é valem para todas. */
  primeira: OcorrenciaDeBloqueio
  /** Os dias da série no período, na ordem do calendário (sem os dias cancelados). */
  dias: OcorrenciaDeBloqueio[]
}

export type DiaDaLista = { data: string; itens: OcorrenciaDeBloqueio[] }

function horaDe(item: OcorrenciaDeBloqueio) {
  return item.inicio.slice(11, 16)
}

/** As séries uma vez cada, na ordem da hora do dia; os bloqueios únicos agrupados por dia. */
export function separarBloqueios(ocorrencias: readonly OcorrenciaDeBloqueio[]) {
  const ordenadas = [...ocorrencias].sort((a, b) => a.inicio.localeCompare(b.inicio))
  const series = new Map<string, SerieDaLista>()
  const dias = new Map<string, OcorrenciaDeBloqueio[]>()

  for (const item of ordenadas) {
    if (item.recorrente) {
      const serie = series.get(item.bloqueioId)
      if (serie) serie.dias.push(item)
      else
        series.set(item.bloqueioId, { bloqueioId: item.bloqueioId, primeira: item, dias: [item] })
      continue
    }

    const lista = dias.get(item.data) ?? []
    lista.push(item)
    dias.set(item.data, lista)
  }

  return {
    series: [...series.values()].sort(
      (a, b) =>
        horaDe(a.primeira).localeCompare(horaDe(b.primeira)) ||
        a.primeira.inicio.localeCompare(b.primeira.inicio),
    ),
    dias: [...dias.entries()].map(([data, itens]): DiaDaLista => ({ data, itens })),
  }
}

/** O dia da semana (0 domingo a 6 sábado) de uma data `AAAA-MM-DD`. */
export function diaDaSemanaDe(data: string) {
  const [ano, mes, dia] = data.split('-').map(Number)
  return new Date(Date.UTC(ano!, mes! - 1, dia!)).getUTCDay()
}

/** Os dias da semana em que a série aparece no período: o retrato quando a regra não veio. */
export function diasDaSemanaNoPeriodo(serie: SerieDaLista) {
  return [...new Set(serie.dias.map((item) => diaDaSemanaDe(item.data)))]
}

/** A semana de trabalho começa na segunda: "Seg a Sex", "Sáb e Dom". */
const ORDEM = [1, 2, 3, 4, 5, 6, 0] as const

export type ParteDosDias =
  | { tipo: 'todos' }
  | { tipo: 'faixa'; de: number; ate: number }
  | { tipo: 'dia'; dia: number }

/**
 * Os dias da semana em pedaços para ler: três ou mais seguidos viram uma faixa ("Seg a Sex"), os
 * outros vão um a um ("Seg, Qua e Sex"). Os sete juntos são "todos os dias".
 */
export function partesDosDias(dias: readonly number[]): ParteDosDias[] {
  const posicoes = [...new Set(dias)]
    .map((dia) => ORDEM.indexOf(dia as (typeof ORDEM)[number]))
    .filter((posicao) => posicao >= 0)
    .sort((a, b) => a - b)

  if (posicoes.length === ORDEM.length) return [{ tipo: 'todos' }]

  const partes: ParteDosDias[] = []
  let inicio = 0

  while (inicio < posicoes.length) {
    let fim = inicio
    while (fim + 1 < posicoes.length && posicoes[fim + 1] === posicoes[fim]! + 1) fim += 1

    if (fim - inicio >= 2) {
      partes.push({ tipo: 'faixa', de: ORDEM[posicoes[inicio]!]!, ate: ORDEM[posicoes[fim]!]! })
    } else {
      for (let i = inicio; i <= fim; i += 1) partes.push({ tipo: 'dia', dia: ORDEM[posicoes[i]!]! })
    }

    inicio = fim + 1
  }

  return partes
}
