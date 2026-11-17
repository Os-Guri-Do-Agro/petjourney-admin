/**
 * O resultado do atendimento em campo, em texto e selo (17/11/2026, "status do atendimento: se
 * conseguiu ou não e o motivo"): o que falta preencher, o nome da situação, a frase de cada
 * procedimento e o que de fato foi feito, para a ficha, a etiqueta e os cuidados.
 */
import {
  motivo,
  procedimento,
  situacaoDoAtendimento,
  type AtendimentoDoPiloto,
  type Procedimento,
  type ResultadoDoProcedimento,
  type SituacaoDoAtendimento,
} from '@/features/saude-publica/dados'

/** O que falta para o resultado valer: o motivo de quem não deu, e a frase do "Outro motivo". */
export function faltasDoResultado(resultados: readonly ResultadoDoProcedimento[]) {
  return resultados.flatMap((item) => {
    if (item.feito) return []
    const nome = procedimento(item.procedimento).rotulo.toLowerCase()
    if (!item.motivo) return [`Diga por que não deu: ${nome}.`]
    if (item.motivo === 'outro' && !item.observacao?.trim()) {
      return [`Escreva o outro motivo: ${nome}.`]
    }
    return []
  })
}

export const SITUACOES: Record<
  SituacaoDoAtendimento,
  { rotulo: string; icone: string; classe: string }
> = {
  realizado: { rotulo: 'Realizado', icone: 'ph ph-check-circle', classe: 'ui-selo--ok' },
  parcial: { rotulo: 'Parcial', icone: 'ph ph-circle-half', classe: 'ui-selo--atencao' },
  'nao-realizado': { rotulo: 'Não realizado', icone: 'ph ph-x-circle', classe: 'ui-selo--risco' },
}

/** O motivo em texto: o rótulo, ou a frase escrita no "Outro motivo". */
export function textoDoMotivo(item: Pick<ResultadoDoProcedimento, 'motivo' | 'observacao'>) {
  if (!item.motivo) return ''
  if (item.motivo === 'outro') return item.observacao?.trim() || motivo('outro').rotulo
  return motivo(item.motivo).rotulo
}

/** "Castração: não deu (Prenhe ou no cio)" ou "Antirrábica: feita". */
export function fraseDoResultado(item: ResultadoDoProcedimento) {
  const nome = procedimento(item.procedimento).rotulo
  return item.feito ? `${nome}: feito` : `${nome}: não deu (${textoDoMotivo(item)})`
}

/**
 * O selo do atendimento numa linha de lista: "Realizado", "Parcial · motivo" ou "Não realizado ·
 * motivo" (o primeiro motivo, que é o que a equipe precisa ver de relance).
 */
export function seloDoResultado(resultados: readonly ResultadoDoProcedimento[]) {
  const situacao = situacaoDoAtendimento(resultados)
  const definicao = SITUACOES[situacao]
  const primeiro = resultados.find((item) => !item.feito)
  return {
    situacao,
    ...definicao,
    texto: primeiro ? `${definicao.rotulo}: ${textoDoMotivo(primeiro)}` : definicao.rotulo,
  }
}

/** Os resultados de um atendimento do piloto: os anotados, ou tudo feito (os de antes do resultado). */
export function resultadosDoAtendimento(
  atendimento: Pick<AtendimentoDoPiloto, 'procedimentos' | 'resultados'>,
): ResultadoDoProcedimento[] {
  return (
    atendimento.resultados ??
    atendimento.procedimentos.map((id) => ({ procedimento: id, feito: true }))
  )
}

/** O que de fato foi feito: é o que a ficha, a etiqueta e os próximos cuidados mostram. */
export function feitosDoAtendimento(
  atendimento: Pick<AtendimentoDoPiloto, 'procedimentos' | 'resultados'>,
): Procedimento[] {
  return atendimento.resultados
    ? atendimento.resultados.filter((item) => item.feito).map((item) => item.procedimento)
    : atendimento.procedimentos
}
