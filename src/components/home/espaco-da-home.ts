import type { RouteLocationRaw } from 'vue-router'

/**
 * As peças do bloco de um espaço no Início (`HomeEspaco`): os números do agora, o atalho do título e
 * o próximo passo. Moram aqui, e não no componente, para os blocos de cada espaço montarem os dados
 * sem importar tipo de dentro de um `.vue`.
 */

export type TomDoNumero = 'risco' | 'atencao' | 'ok' | 'lugar' | 'neutro' | 'apagado'

export type NumeroDoEspaco = {
  id: string
  /** `null` enquanto carrega. Texto quando é dinheiro ou quando não se sabe ("–"). */
  valor: number | string | null
  rotulo: string
  /** Uma linha curta de quem ou de quê: "Ni, Nina", "1 passou do prazo". */
  meta?: string
  tom?: TomDoNumero
  to: RouteLocationRaw
}

export type PassoDoEspaco = {
  rotulo: string
  icone: string
  /** Sem `to`, o passo é um botão e o bloco emite `passo`. */
  to?: RouteLocationRaw
}

export type AtalhoDoEspaco = {
  rotulo: string
  icone: string
  /** Sem `to`, o atalho é um botão e o bloco emite `atalho`. */
  to?: RouteLocationRaw
}

export type AndamentoDoEspaco = {
  texto: string
  percentual: number
}

/** O que a seção do código (`HomeIndique`) sabe e o bloco do Portal mostra. */
export type IndicacaoNoBloco = {
  carregando: boolean
  podeIndicar: boolean
  temQr: boolean
  resumo: { semana: number | null; total: number | null; indisponivel: boolean }
}
