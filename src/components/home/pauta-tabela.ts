import type { RouteLocationRaw } from 'vue-router'

import type { TomDePendencia } from '@/features/clinico/composables/useClinicoPendencias'
import type { PetSpecies } from '@/features/clinico/data/types'

/** Uma linha de `UiPauta`: o assunto, de que ele é feito, a gravidade e onde se resolve. */
export type LinhaDaTabela = {
  id: string
  to: RouteLocationRaw
  frase: string
  /** De que a linha é feita, em texto de apoio. Vazio quando não há. */
  detalhe?: string
  tom: TomDePendencia
  /** A tela aonde a linha leva, já traduzida. */
  onde: string
  /**
   * O paciente de quem a linha fala, quando é um só: a linha mostra o rosto dele no lugar do
   * quadradinho. Linha que junta vários (os retornos atrasados) fica sem.
   */
  pet?: { nome: string; iniciais: string; especie?: PetSpecies | null; fotoUrl?: string }
}

/** Risco primeiro, depois atenção, depois o neutro — a ordem de quem precisa de alguém antes. */
const PESO_DO_TOM: Record<TomDePendencia, number> = { risco: 0, atencao: 1, neutro: 2 }

/** Ordena por gravidade sem desfazer a ordem de quem tem a mesma. */
export function porGravidade<T extends { tom: TomDePendencia }>(linhas: T[]): T[] {
  return [...linhas].sort((uma, outra) => PESO_DO_TOM[uma.tom] - PESO_DO_TOM[outra.tom])
}

/**
 * O título do Hoje diz qual é o assunto, e não só quantos (18/11/2026: "texto avisa que tem
 * assunto, mas não aponta qual o assunto", sobre "1 assunto esperando você"). Vale o primeiro, na
 * ordem da gravidade, com quem espera na recepção logo depois dos urgentes, e quantos mais há.
 */
export function tituloDoDia(
  t: (chave: string, valores?: Record<string, unknown>, plural?: number) => string,
  linhas: Pick<LinhaDaTabela, 'frase' | 'tom'>[],
  naRecepcao: number,
): string {
  const recepcao = naRecepcao
    ? [t('clinico.meuDia.resumo.recepcao', { total: naRecepcao }, naRecepcao)]
    : []
  const assuntos = [
    ...linhas.filter((linha) => linha.tom === 'risco').map((linha) => linha.frase),
    ...recepcao,
    ...linhas.filter((linha) => linha.tom !== 'risco').map((linha) => linha.frase),
  ]
  const [primeiro, ...outros] = assuntos
  if (!primeiro) return t('clinico.meuDia.resumo.emDia')
  const assunto = primeiro.charAt(0).toLocaleUpperCase() + primeiro.slice(1)
  if (!outros.length) return assunto
  return t('clinico.meuDia.resumo.eMais', { assunto, total: outros.length }, outros.length)
}
