/**
 * Ordem da fila de espera.
 *
 * A fila só é fila se tiver ordem, e a ordem precisa ser **explicável ao telefone**: quando o
 * responsável pergunta "sou o quantos?", a resposta tem que sair sem ninguém abrir planilha, e
 * tem que continuar valendo amanhã.
 *
 * Duas regras, nessa ordem:
 *
 * 1. **Prioridade primeiro.** Urgente na frente de preferencial, preferencial na frente de
 *    normal. Não é fila de banco: quem chega antes espera menos, mas quem está mal espera
 *    menos ainda.
 * 2. **Antiguidade dentro da prioridade.** Entre iguais, quem entrou primeiro sai primeiro —
 *    e nada mais desempata. Qualquer critério além destes dois é impossível de justificar por
 *    telefone.
 *
 * Quem já recebeu oferta **sai da contagem**: o horário dele está reservado, e continuar
 * contando-o empurraria todo mundo uma posição para trás por algo que já foi resolvido.
 */

import type {
  ClockTime,
  WaitlistEntry,
  WaitlistPriority,
  WaitlistWindow,
  WeekdayIndex,
} from '../data/types'

/** Menor é mais na frente. */
const PESO: Record<WaitlistPriority, number> = {
  urgente: 0,
  preferencial: 1,
  normal: 2,
}

export function ordenarFila(entradas: WaitlistEntry[]): WaitlistEntry[] {
  return [...entradas].sort(
    (a, b) => PESO[a.prioridade] - PESO[b.prioridade] || a.criadoEm.localeCompare(b.criadoEm),
  )
}

/**
 * Posição de cada entrada que ainda aguarda, começando em 1.
 *
 * Devolve um mapa, e não uma lista ordenada, porque a tabela mostra a fila na ordem que a
 * pessoa escolheu — pode estar ordenada por nome — e ainda assim precisa dizer a posição certa
 * de cada linha.
 */
export function posicoesDaFila(entradas: WaitlistEntry[]): Map<string, number> {
  const aguardando = ordenarFila(entradas.filter((entrada) => entrada.status === 'aguardando'))

  return new Map(aguardando.map((entrada, indice) => [entrada.id, indice + 1]))
}

/**
 * Quantos estão na frente desta entrada **na mesma prioridade ou acima**.
 *
 * É o número que responde de verdade à pergunta do telefone. "Você é o oitavo" desanima; "há
 * dois casos urgentes antes do seu" explica.
 */
export function aFrenteDe(entradas: WaitlistEntry[], id: string): number {
  const posicoes = posicoesDaFila(entradas)

  return Math.max((posicoes.get(id) ?? 1) - 1, 0)
}

/** Dias seguidos, com o mesmo horário, que a disponibilidade diz de uma vez. */
export type FaixaDeJanelas = {
  de: WeekdayIndex
  ate: WeekdayIndex
  inicio: ClockTime
  fim: ClockTime
}

/** Segunda primeiro, domingo por último: a semana como a recepção a lê. */
function posicaoNaSemana(dia: WeekdayIndex): number {
  return (dia + 6) % 7
}

/**
 * Janelas de dias seguidos com o mesmo horário viram uma faixa: "seg.–sex. 14:00–18:00".
 *
 * Cinco janelas iguais escritas uma a uma ocupavam três linhas da tabela para dizer "tardes de
 * dia útil" — e a linha mais alta da fila parecia a mais importante. Só junta o que é igual e
 * vizinho; dia com dois horários continua escrito por extenso.
 */
export function agruparJanelas(janelas: WaitlistWindow[]): FaixaDeJanelas[] {
  const ordenadas = [...janelas].sort(
    (a, b) =>
      posicaoNaSemana(a.weekday) - posicaoNaSemana(b.weekday) || a.inicio.localeCompare(b.inicio),
  )
  const faixas: FaixaDeJanelas[] = []

  for (const janela of ordenadas) {
    const ultima = faixas[faixas.length - 1]

    if (
      ultima &&
      ultima.inicio === janela.inicio &&
      ultima.fim === janela.fim &&
      posicaoNaSemana(janela.weekday) === posicaoNaSemana(ultima.ate) + 1
    ) {
      ultima.ate = janela.weekday
      continue
    }

    faixas.push({ de: janela.weekday, ate: janela.weekday, inicio: janela.inicio, fim: janela.fim })
  }

  return faixas
}
