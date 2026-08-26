/**
 * Sobreposição e empacotamento em faixas.
 *
 * A grade do dia precisa mostrar dois atendimentos no mesmo horário lado a lado sem que um
 * cubra o outro. O algoritmo agrupa por cadeia de sobreposição e distribui cada item na
 * primeira faixa livre — o mesmo que um calendário de mesa faz.
 */

export type Span = {
  id: string
  inicioMin: number
  fimMin: number
}

export type SpanLayout = {
  id: string
  inicioMin: number
  fimMin: number
  /** Faixa (coluna interna) ocupada, começando em 0. */
  lane: number
  /** Total de faixas no grupo de sobreposição — divide a largura da coluna. */
  lanes: number
  /** Quantos outros itens compartilham horário com este. */
  concorrentes: number
}

export function overlaps(a: Span, b: Span): boolean {
  return a.inicioMin < b.fimMin && b.inicioMin < a.fimMin
}

export function overlapMinutes(a: Span, b: Span): number {
  return Math.max(0, Math.min(a.fimMin, b.fimMin) - Math.max(a.inicioMin, b.inicioMin))
}

function sortSpans(spans: Span[]): Span[] {
  return [...spans].sort((a, b) => a.inicioMin - b.inicioMin || a.fimMin - b.fimMin)
}

/**
 * Quebra a lista em grupos de sobreposição encadeada: A cruza B, B cruza C, logo os três
 * dividem a mesma largura, mesmo que A e C não se toquem.
 */
export function groupOverlapping(spans: Span[]): Span[][] {
  const ordered = sortSpans(spans)
  const groups: Span[][] = []
  let current: Span[] = []
  let limite = Number.NEGATIVE_INFINITY

  for (const span of ordered) {
    if (current.length > 0 && span.inicioMin >= limite) {
      groups.push(current)
      current = []
      limite = Number.NEGATIVE_INFINITY
    }

    current.push(span)
    limite = Math.max(limite, span.fimMin)
  }

  if (current.length > 0) {
    groups.push(current)
  }

  return groups
}

export function layoutSpans(spans: Span[]): SpanLayout[] {
  const layouts: SpanLayout[] = []

  for (const group of groupOverlapping(spans)) {
    /** Fim de cada faixa já aberta; a primeira que terminou antes recebe o próximo item. */
    const laneEnds: number[] = []
    const assigned: Array<{ span: Span; lane: number }> = []

    for (const span of group) {
      let lane = laneEnds.findIndex((fim) => fim <= span.inicioMin)

      if (lane === -1) {
        lane = laneEnds.length
      }

      laneEnds[lane] = span.fimMin
      assigned.push({ span, lane })
    }

    const lanes = laneEnds.length

    for (const { span, lane } of assigned) {
      layouts.push({
        id: span.id,
        inicioMin: span.inicioMin,
        fimMin: span.fimMin,
        lane,
        lanes,
        concorrentes: group.filter((other) => other.id !== span.id && overlaps(other, span)).length,
      })
    }
  }

  return layouts
}
