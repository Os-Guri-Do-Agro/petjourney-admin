import type { AnotacaoDiarioInput, TipoServicoPrestador } from '@/service/parceiro/types'

/**
 * Espelho do contrato do Diário do pet na anotação (API: campo `diario` do multipart).
 * Campo enviado para o tipo de serviço errado é 400 na API, então o filtro mora aqui,
 * num lugar só e testado.
 */
export type CampoDiario = keyof AnotacaoDiarioInput

export const CAMPOS_DIARIO_UNICOS = ['vitalidade', 'alimentacao', 'hidratacao', 'fezes', 'urina'] as const
export const CAMPOS_DIARIO_MULTIPLOS = ['temperamento', 'sintomas'] as const

/** HOTEL: tudo. BANHO/TOSA: humor, comportamento e sintomas. Outros tipos: nada. */
export const CAMPOS_DIARIO_POR_TIPO: Partial<Record<TipoServicoPrestador, readonly CampoDiario[]>> = {
  HOTEL: ['vitalidade', 'alimentacao', 'hidratacao', 'fezes', 'urina', 'temperamento', 'sintomas'],
  BANHO: ['vitalidade', 'temperamento', 'sintomas'],
  TOSA: ['vitalidade', 'temperamento', 'sintomas'],
}

/** Teto da descrição do anexo na API (em caracteres). */
export const MAX_DESCRICAO_ANEXO = 120

export function camposDiarioDoTipo(tipo: TipoServicoPrestador | undefined | null): readonly CampoDiario[] {
  return (tipo && CAMPOS_DIARIO_POR_TIPO[tipo]) || []
}

/** Só as chaves preenchidas e aceitas pelo tipo; `null` quando nada sobra (não mandar o campo). */
export function filtrarDiarioPorTipo(
  tipo: TipoServicoPrestador | undefined | null,
  diario: AnotacaoDiarioInput | undefined,
): AnotacaoDiarioInput | null {
  if (!diario) return null
  const aceitos = camposDiarioDoTipo(tipo)
  const saida: Record<string, unknown> = {}
  for (const campo of aceitos) {
    const valor = diario[campo]
    if (valor == null) continue
    if (Array.isArray(valor)) {
      if (valor.length) saida[campo] = [...valor]
      continue
    }
    if (String(valor).trim()) saida[campo] = valor
  }
  return Object.keys(saida).length ? (saida as AnotacaoDiarioInput) : null
}

/** Descrições alinhadas aos anexos: texto aparado ou `null`; `null` total quando nenhuma tem texto. */
export function normalizarDescricoesAnexos(
  descricoes: (string | null | undefined)[] | undefined,
  totalAnexos: number,
): (string | null)[] | null {
  if (!descricoes || totalAnexos === 0) return null
  const alinhadas = Array.from({ length: totalAnexos }, (_, i) => {
    const t = descricoes[i]?.trim()
    return t ? t.slice(0, MAX_DESCRICAO_ANEXO) : null
  })
  return alinhadas.some((d) => d != null) ? alinhadas : null
}

/**
 * Posições dos anexos sem tipo de documento. O tipo é obrigatório em cada anexo (a API recusa
 * com 400 e o site também barra): sem ele o documento cai bagunçado no cofre do responsável.
 */
export function indicesAnexosSemTipo(tipos: readonly (string | null | undefined)[]): number[] {
  const indices: number[] = []
  tipos.forEach((tipo, i) => {
    if (!tipo || !tipo.trim()) indices.push(i)
  })
  return indices
}
