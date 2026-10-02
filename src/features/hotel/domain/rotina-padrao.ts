/**
 * A rotina padrão da casa: as regras de editá-la e de prever o que publicá-la faz.
 *
 * A materialização mora em `materializacao.ts` e a geração em `rotina.ts`. O que fica aqui é o que
 * só interessa a quem está **editando o cadastro**: normalizar o que a pessoa digitou, recusar o
 * que não pode ser publicado, e responder à única pergunta que importa antes de salvar — **o que
 * isto vai fazer com a casa cheia de animais que já está lá dentro?**
 *
 * Tudo é função pura. O instante entra como parâmetro.
 */

import type {
  AjusteDeRotina,
  ClockTime,
  ISODateTime,
  ItemDeRotina,
  TarefaDeRotina,
} from '../data/types'

import { reconciliarDia } from './materializacao'
import type { TarefaPlanejada } from './rotina'

/** Quantos horários uma linha da rotina aceita. */
export const MAX_HORARIOS_POR_ITEM = 12

/**
 * Ordena e remove repetidos.
 *
 * Duas trocas de água às 12:00 não são duas trocas: são a mesma tarefa gravada duas vezes, e na
 * prancheta viram duas fileiras idênticas que leem como defeito de renderização. O horário é
 * `HH:MM` de largura fixa, então ordenar como texto é ordenar como hora.
 */
export function normalizarHorarios(horarios: ClockTime[]): ClockTime[] {
  return [...new Set(horarios)].sort((um, outro) => um.localeCompare(outro))
}

/**
 * Lê horários como se fossem ditados ao telefone: `"8:00, 20:00"`.
 *
 * É a forma que o check-in já usava, e ela vem de observar o trabalho: quem preenche a ficha no
 * balcão está repetindo o que o responsável está falando, e um seletor de relógio por horário
 * transforma quatro palavras em doze toques. O que não casa com `H:MM` é descartado em silêncio,
 * porque a pessoa ainda está digitando enquanto a lista já aparece.
 *
 * Mora no domínio, e não no componente, porque agora são **dois** os lugares que leem horário — o
 * check-in e o cadastro da rotina. Mapa copiado é mapa que diverge.
 */
export function lerHorarios(texto: string): ClockTime[] {
  const horarios = texto
    .split(/[,;]/)
    .map((item) => item.trim())
    .filter((item) => /^\d{1,2}:\d{2}$/.test(item))
    .map((item) => item.padStart(5, '0') as ClockTime)
    .filter((item) => /^([01]\d|2[0-3]):[0-5]\d$/.test(item))

  return normalizarHorarios(horarios)
}

/** O inverso: a lista como se escreve. */
export function escreverHorarios(horarios: ClockTime[]): string {
  return horarios.join(', ')
}

export type ProblemaDoItem = 'sem-horario' | 'horarios-demais' | 'horario-invalido'

/**
 * O que impede uma linha de ser publicada.
 *
 * Um item **ativo e sem horário nenhum** é o caso interessante: não é erro de digitação, é uma
 * contradição — a casa declarou que faz aquilo e não disse quando. Ele não trava a publicação;
 * simplesmente não gera tarefa. O que devolvemos aqui é o que a tela precisa dizer, não uma
 * proibição: recusar salvar por causa disso obrigaria a pessoa a desligar a linha para poder sair
 * da tela, e ninguém desliga a linha — a pessoa abandona a edição.
 */
export function problemasDoItem(item: ItemDeRotina): ProblemaDoItem[] {
  const problemas: ProblemaDoItem[] = []

  if (item.ativo && item.horarios.length === 0) {
    problemas.push('sem-horario')
  }

  if (item.horarios.length > MAX_HORARIOS_POR_ITEM) {
    problemas.push('horarios-demais')
  }

  if (item.horarios.some((hora) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora))) {
    problemas.push('horario-invalido')
  }

  return problemas
}

/** Quantas tarefas a casa faz por hóspede num dia, com este cadastro. */
export function tarefasPorDia(itens: ItemDeRotina[]): number {
  return itens
    .filter((item) => item.ativo)
    .reduce((total, item) => total + item.horarios.length, 0)
}

/**
 * A rotina de **um hóspede**: a da casa, com os ajustes dele por cima.
 *
 * **Substituição inteira, nunca fusão.** O ajuste de água não acrescenta um horário à lista da
 * casa: ele troca a lista. Fundir produziria resultados que ninguém consegue prever olhando a tela
 * — "a casa faz 4, o ajuste diz 2, então o Thor tem 5" é uma conta que só o código sabe fazer, e
 * numa prancheta impressa às 6h da manhã isso vira uma discussão sem resposta.
 *
 * Ajuste revogado não conta: ele fica no registro para explicar o que existiu, e para de valer.
 * `suspende` é substituição por lista vazia — a casa faz, este animal não.
 *
 * Refeição, medicação e serviço vendido não passam por aqui: não são `TarefaDaCasaKind`.
 */
export function rotinaEfetiva(itens: ItemDeRotina[], ajustes: AjusteDeRotina[]): ItemDeRotina[] {
  const vigentes = new Map(
    ajustes.filter((ajuste) => !ajuste.revogadoEm).map((ajuste) => [ajuste.kind, ajuste]),
  )

  return itens.map((item) => {
    const ajuste = vigentes.get(item.kind)

    if (!ajuste) return item

    return {
      ...item,
      horarios: ajuste.acao === 'suspende' ? [] : normalizarHorarios(ajuste.horarios),
      ativo: ajuste.acao === 'suspende' ? false : item.ativo,
    }
  })
}

export type PrevisaoDaPublicacao = {
  /** Tarefas que nascem. */
  criadas: number
  /** Tarefas que saem: futuro intocado que o plano novo não prevê mais. */
  retiradas: number
  /** Tudo o que a publicação não encosta — inclusive tudo o que já foi feito. */
  preservadas: number
  /** Quantas das criadas e retiradas caem **hoje**. É o número que assusta, e deve assustar. */
  hoje: number
}

/**
 * O que a publicação vai fazer, antes de ela acontecer.
 *
 * Existe porque publicar uma rotina é a única operação deste módulo que altera o trabalho de
 * **todos os hóspedes de uma vez**. Trocar um horário de água numa casa de quarenta mexe em
 * quarenta tarefas, e uma tela que só diz "salvar" pede um ato de fé que ninguém deveria ter de
 * dar. Os três números são o que transforma a publicação em decisão informada.
 *
 * `hoje` vem separado porque é uma classe de susto diferente: mudanças que valem a partir de
 * amanhã são planejamento, e mudanças que caem no turno de quem está trabalhando agora são a lista
 * mudando debaixo da mão de alguém.
 *
 * Recebe os dias já montados — quem sabe quais hóspedes existem e o que cada um tem planejado é o
 * repositório, não o domínio.
 */
export function previsaoDaPublicacao(
  dias: { dia: string; existentes: TarefaDeRotina[]; planejadas: TarefaPlanejada[] }[],
  agora: ISODateTime,
): PrevisaoDaPublicacao {
  const hojeIso = agora.slice(0, 10)

  let criadas = 0
  let retiradas = 0
  let preservadas = 0
  let hoje = 0

  for (const entrada of dias) {
    const resultado = reconciliarDia({
      existentes: entrada.existentes,
      planejadas: entrada.planejadas,
      agora,
    })

    criadas += resultado.criar.length
    retiradas += resultado.retirar.length
    preservadas += resultado.preservadas.length

    if (entrada.dia === hojeIso) {
      hoje += resultado.criar.length + resultado.retirar.length
    }
  }

  return { criadas, retiradas, preservadas, hoje }
}
