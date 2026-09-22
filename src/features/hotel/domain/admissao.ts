/**
 * Regra R1 — a porta de entrada do hotel é sanitária.
 *
 * Mora no domínio, e não na tela, porque é regra de servidor: se vivesse no formulário de
 * check-in, bastaria outra tela — ou uma rota de API amanhã — para um hóspede com a antirrábica
 * vencida entrar e dividir o gramado com outros trinta.
 *
 * O ponto que o módulo inteiro existe para não errar: a exigência é checada contra o **último dia
 * da estadia**, nunca contra hoje. Uma antirrábica que vence no dia 27 não serve para uma reserva
 * que sai no dia 30, e descobrir isso no dia 27 significa telefonar para alguém que está a 600 km
 * dali.
 */

import type {
  Comprovante,
  DispensaDeExigencia,
  Exigencia,
  ExigenciaKind,
  ISODate,
  PetSpecies,
  SituacaoDaExigencia,
} from '../data/types'

import { addDays, diffDays } from './hotel-time'

/** Uma exigência resolvida para um pet e um período. */
export type ExigenciaAvaliada = {
  kind: ExigenciaKind
  /** Vencida impede a entrada, ou apenas avisa? Ver `Exigencia.bloqueia`. */
  bloqueia: boolean
  situacao: SituacaoDaExigencia
  /** O comprovante que sustenta a situação. `null` quando não há nenhum. */
  comprovante: Comprovante | null
  /** A dispensa que a liberou. `null` quando não foi dispensada. */
  dispensa: DispensaDeExigencia | null
  /**
   * Dias entre a validade e a saída prevista.
   *
   * Negativo significa que o comprovante vence **antes** da saída — é o número que a tela mostra
   * em `vence-durante`, e é ele que transforma um selo âmbar numa frase acionável ("vence 3 dias
   * antes da saída").
   */
  diasDeFolga: number | null
}

/**
 * O que a admissão inteira diz sobre uma reserva.
 *
 * `liberada` é o único campo que o check-in consulta. Os outros existem para a tela conseguir
 * explicar **por que** — e uma recusa sem motivo numa tela de balcão faz a recepção tentar de
 * novo exatamente do mesmo jeito.
 */
export type AvaliacaoDeAdmissao = {
  itens: ExigenciaAvaliada[]
  liberada: boolean
  /** Exigências bloqueantes por resolver. É a lista que a tela mostra ao recusar o check-in. */
  impedimentos: ExigenciaAvaliada[]
  /** Não bloqueiam, mas alguém precisa ver: vencem durante, ou não bloqueiam e faltam. */
  avisos: ExigenciaAvaliada[]
}

function comprovanteMaisRecente(
  comprovantes: Comprovante[],
  petId: string,
  kind: ExigenciaKind,
): Comprovante | null {
  /*
   * O mais recente e não o primeiro que casar: um animal apresenta a mesma vacina a cada ano, e a
   * carteira do ano passado continua no registro. Ordenar pela apresentação é o que faz a reserva
   * de dezembro olhar para o reforço de novembro.
   */
  return (
    comprovantes
      .filter((item) => item.petId === petId && item.kind === kind)
      .sort((um, outro) => outro.apresentadoEm.localeCompare(um.apresentadoEm))[0] ?? null
  )
}

/**
 * A situação de **uma** exigência para um período.
 *
 * Exposta em separado porque a tela de reserva a chama por linha, e porque é o pedaço que o teste
 * quer exercer sem montar um hotel inteiro em volta.
 */
export function avaliarExigencia(
  exigencia: Exigencia,
  comprovantes: Comprovante[],
  petId: string,
  saidaPrevista: ISODate,
  dispensas: DispensaDeExigencia[] = [],
): ExigenciaAvaliada {
  const dispensa = dispensas.find((item) => item.kind === exigencia.kind) ?? null
  const comprovante = comprovanteMaisRecente(comprovantes, petId, exigencia.kind)

  const base: Omit<ExigenciaAvaliada, 'situacao'> = {
    kind: exigencia.kind,
    bloqueia: exigencia.bloqueia,
    comprovante,
    dispensa,
    diasDeFolga: null,
  }

  /*
   * A dispensa vem antes de tudo, inclusive de "ausente". É o ponto dela: alguém com nome decidiu
   * aceitar o hóspede sem o papel, e a decisão substitui o papel — sem apagar o registro de que
   * não havia papel nenhum (`comprovante` continua na avaliação).
   */
  if (dispensa) {
    return { ...base, situacao: 'dispensado' }
  }

  if (!comprovante) {
    return { ...base, situacao: 'ausente' }
  }

  /* Documento sem validade — o termo assinado. Apresentado é o bastante. */
  if (!comprovante.validoAte) {
    return { ...base, situacao: 'ok' }
  }

  const folga = diffDays(saidaPrevista, comprovante.validoAte)

  if (folga < 0) {
    /*
     * Já vencido **em relação à saída**. Pode estar válido hoje: é exatamente o caso que a regra
     * existe para pegar, e é por isso que `vencido` e `vence-durante` se separam pelo dia de hoje
     * e não pelo dia da saída.
     */
    return { ...base, situacao: 'vencido', diasDeFolga: folga }
  }

  return { ...base, situacao: 'ok', diasDeFolga: folga }
}

/**
 * A admissão de uma reserva inteira.
 *
 * `hoje` entra como parâmetro e não é lido do relógio aqui dentro: função de domínio que consulta
 * o relógio é função que não se testa sem congelar o tempo do processo — e o módulo clínico já
 * pagou esse preço uma vez.
 */
export function avaliarAdmissao(entrada: {
  exigencias: Exigencia[]
  comprovantes: Comprovante[]
  petId: string
  especie: PetSpecies
  saidaPrevista: ISODate
  hoje: ISODate
  dispensas?: DispensaDeExigencia[]
}): AvaliacaoDeAdmissao {
  const aplicaveis = entrada.exigencias.filter(
    (exigencia) => exigencia.especies.length === 0 || exigencia.especies.includes(entrada.especie),
  )

  const itens = aplicaveis.map((exigencia) => {
    const avaliada = avaliarExigencia(
      exigencia,
      entrada.comprovantes,
      entrada.petId,
      entrada.saidaPrevista,
      entrada.dispensas ?? [],
    )

    /*
     * A separação entre "vencido" e "vence durante": o comprovante que ainda vale hoje mas não
     * alcança a saída é âmbar, não vermelho. Tratá-lo como vencido recusaria no balcão um animal
     * que pode entrar — basta que o reforço aconteça antes da data.
     */
    if (
      avaliada.situacao === 'vencido' &&
      avaliada.comprovante?.validoAte &&
      diffDays(entrada.hoje, avaliada.comprovante.validoAte) >= 0
    ) {
      return { ...avaliada, situacao: 'vence-durante' as const }
    }

    return avaliada
  })

  /*
   * Só `vencido` e `ausente` travam, e só quando a exigência é bloqueante. `vence-durante` avisa e
   * não trava de propósito: o animal **pode** entrar, e travar a entrada de hoje por uma validade
   * que expira daqui a cinco dias empurraria a casa a dispensar a exigência inteira — que é
   * exatamente o comportamento que a dispensa nominal existe para tornar raro.
   */
  const impedimentos = itens.filter(
    (item) => item.bloqueia && (item.situacao === 'vencido' || item.situacao === 'ausente'),
  )

  const avisos = itens.filter(
    (item) =>
      item.situacao === 'vence-durante' ||
      (!item.bloqueia && (item.situacao === 'vencido' || item.situacao === 'ausente')),
  )

  return { itens, liberada: impedimentos.length === 0, impedimentos, avisos }
}

/**
 * A pior situação de um conjunto, para o selo de uma linha de tabela.
 *
 * A ordem não é alfabética nem a de declaração: é a ordem em que a recepção precisa reagir.
 * `ausente` vem antes de `vencido` porque documento que nunca chegou dá mais trabalho do que
 * documento a renovar — o primeiro depende de alguém achar um papel, o segundo, de uma data.
 */
const SEVERIDADE: SituacaoDaExigencia[] = [
  'ausente',
  'vencido',
  'vence-durante',
  'dispensado',
  'ok',
]

/**
 * A situação que vale como **selo** numa lista.
 *
 * Não é a pior de todas: é a pior das que **mudam uma decisão**. A diferença apareceu na primeira
 * captura de tela do módulo e era gritante — o painel do dia acusava "chega hoje sem a
 * documentação exigida" para **todos** os hóspedes, porque `piorSituacao` somava ao veredito os
 * comprovantes não bloqueantes que quase ninguém tem (antipulgas, parasitológico). Um alarme que
 * dispara para todo mundo não é um alarme: é ruído que ensina a ignorar a coluna.
 *
 * A ordem aqui é a da consequência:
 *
 * 1. **Impede a entrada** — falta ou venceu um documento bloqueante.
 * 2. **Vence no meio da estadia** — entra hoje e deixa de valer antes de sair.
 * 3. **Dispensado** — alguém com nome assumiu a falta.
 * 4. **Em dia** — nada que impeça o animal de entrar.
 *
 * O que não bloqueia e está faltando continua aparecendo como aviso **na tela da reserva**, que é
 * onde alguém pode fazer algo a respeito. Só não sobe para o selo da lista.
 */
export function situacaoParaSelo(avaliacao: AvaliacaoDeAdmissao): SituacaoDaExigencia {
  if (avaliacao.impedimentos.length > 0) {
    return avaliacao.impedimentos.some((item) => item.situacao === 'ausente')
      ? 'ausente'
      : 'vencido'
  }

  if (avaliacao.itens.some((item) => item.situacao === 'vence-durante')) {
    return 'vence-durante'
  }

  return avaliacao.itens.some((item) => item.situacao === 'dispensado') ? 'dispensado' : 'ok'
}

export function piorSituacao(itens: ExigenciaAvaliada[]): SituacaoDaExigencia {
  for (const situacao of SEVERIDADE) {
    if (itens.some((item) => item.situacao === situacao)) {
      return situacao
    }
  }

  return 'ok'
}

/**
 * A data em que um comprovante vence, a partir da apresentação.
 *
 * Existe para o cadastro não pedir duas datas ao balcão: quem digita a carteira tem a data da
 * aplicação na mão, não a da validade, e fazer a conta de cabeça em "12 meses a partir de 14 de
 * março" é onde o erro entra.
 */
export function validadeDe(apresentadoEm: ISODate, validadeMeses: number | null): ISODate | null {
  if (validadeMeses === null) {
    return null
  }

  /*
   * Em dias e não em meses de calendário: 12 meses a partir de 29 de fevereiro não tem resposta
   * óbvia, e a diferença de um ou dois dias não muda nenhuma decisão do hotel. O que mudaria uma
   * decisão é a conta não existir.
   */
  return addDays(apresentadoEm, Math.round(validadeMeses * 30.4))
}
