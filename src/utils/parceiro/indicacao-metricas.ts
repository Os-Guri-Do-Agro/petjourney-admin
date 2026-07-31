import { ApiError } from '@/service/api'
import type { IndicacaoScanPorDia } from '@/service/parceiro/types'

/**
 * Métricas de leitura do QR de indicação (`GET /parceiro/portal/indicacao/metricas`).
 * Dois erros são esperados e não são falha da tela:
 *  - `409` parceiro ainda não operável (o gate de 2026-07-29 vale aqui também);
 *  - `503` `QR_INDISPONIVEL`, serviço de QR fora do ar.
 * Qualquer outro vira erro genérico com retry.
 */
export type MetricasEstadoErro = 'naoOperavel' | 'indisponivel' | 'erro'

export function resolveMetricasErro(error: unknown): MetricasEstadoErro {
  if (!(error instanceof ApiError)) {
    return 'erro'
  }

  if (error.statusCode === 409) {
    return 'naoOperavel'
  }

  if (error.statusCode === 503) {
    return 'indisponivel'
  }

  return 'erro'
}

/** Quantos dias da série cabem no gráfico sem virar sopa de barras. */
export const MAX_DIAS_SERIE = 14

export type BarraSerie = {
  day: string
  count: number
  /** Altura relativa ao dia de maior contagem, em %. */
  percent: number
}

/**
 * Normaliza a série para o gráfico: ordena por dia, corta nos últimos
 * `MAX_DIAS_SERIE` e escala pela maior contagem. Série toda zerada devolve
 * barras em 0% (e não NaN, que sumiria com o eixo).
 */
export function montarSerie(
  byDay: IndicacaoScanPorDia[] | undefined,
  maxDias = MAX_DIAS_SERIE,
): BarraSerie[] {
  if (!byDay?.length) {
    return []
  }

  const ordenada = [...byDay].sort((a, b) => a.day.localeCompare(b.day)).slice(-maxDias)
  const maior = Math.max(...ordenada.map((item) => item.count))

  return ordenada.map((item) => ({
    day: item.day,
    count: item.count,
    percent: maior > 0 ? Math.round((item.count / maior) * 100) : 0,
  }))
}

/**
 * Reduz o user-agent ao aparelho, que é o que interessa ao parceiro. Não é
 * detecção completa de navegador: é rótulo curto, com `null` quando não dá para
 * afirmar — melhor não mostrar nada do que mostrar errado.
 */
export function resumirUserAgent(userAgent: string | null | undefined): string | null {
  if (!userAgent?.trim()) {
    return null
  }

  const ua = userAgent.toLowerCase()

  // iPadOS recente se anuncia como Macintosh; o toque desempata.
  if (/iphone|ipod/.test(ua)) return 'iPhone'
  if (/ipad/.test(ua)) return 'iPad'
  if (/android/.test(ua)) return 'Android'
  if (/windows/.test(ua)) return 'Windows'
  if (/mac os|macintosh/.test(ua)) return 'Mac'
  if (/linux/.test(ua)) return 'Linux'

  return null
}
