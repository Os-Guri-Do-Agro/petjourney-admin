/**
 * A fronteira por onde toda tarefa nasce e morre.
 *
 * Uma tarefa de rotina é **registro materializado**, e não uma derivação da ficha lida na hora.
 * `domain/rotina.ts` explica por que, e a razão é curta: derivar faria "servida por Helena às
 * 8h05" pendurar em nada, e alterar o plano alimentar amanhã apagaria as refeições de ontem.
 *
 * O preço dessa escolha é que passa a existir uma pergunta difícil: **o que acontece com o que já
 * foi materializado quando o plano muda?** Enquanto o plano da casa era três constantes no código,
 * a pergunta não aparecia — mudar o horário da água era um deploy. Com a casa cadastrando os
 * próprios horários, ela passa a acontecer numa terça-feira às 15h, com dezoito animais na casa e
 * meio turno já marcado.
 *
 * Este arquivo é a resposta, e ele tem uma regra só, que vale para tudo:
 *
 * > **O passado não se reescreve. Só o futuro intocado se reorganiza.**
 *
 * Tudo aqui é função pura sobre listas, sem relógio próprio: o instante entra como parâmetro,
 * porque função de domínio que lê o relógio é função que não se testa sem congelar o tempo do
 * processo.
 */

import type { ISODateTime, TarefaDeRotina } from '../data/types'
import { ehTarefaDaCasa } from '../data/types'

import type { TarefaPlanejada } from './rotina'

/**
 * A identidade de uma tarefa **sem o id**.
 *
 * É o que torna materializar idempotente: reexecutar o planejamento de um dia não pode duplicar
 * nada, e a única defesa possível é reconhecer que a tarefa já existe. O id não serve — ele nasce
 * na criação, então duas execuções produziriam dois ids para a mesma dose.
 *
 * Os quatro campos são exatamente os que definem "a mesma tarefa": para quem, o quê, quando, e de
 * que registro veio. `origemId` entra porque duas medicações diferentes às 08:00 do mesmo animal
 * **são** duas tarefas, e sem ele uma engoliria a outra — que é a classe de defeito que este
 * módulo não pode ter.
 */
export function chaveDaTarefa(
  tarefa: Pick<TarefaDeRotina, 'hospedagemId' | 'kind' | 'previstaPara' | 'origemId'>,
): string {
  return [tarefa.hospedagemId, tarefa.kind, tarefa.previstaPara, tarefa.origemId ?? ''].join('|')
}

/** O que pode ser retirado por uma mudança de plano, e o que é história. */
export type ParticaoDeTarefas = {
  /** Futuro intocado, nascido do plano da casa: só isto se reorganiza. */
  retiraveis: TarefaDeRotina[]
  /** Tudo o mais. Sobrevive a qualquer publicação, sempre. */
  historia: TarefaDeRotina[]
}

/**
 * Separa o que uma mudança de plano pode mexer do que ela nunca pode tocar.
 *
 * Quatro condições, e **todas** precisam valer para a tarefa ser retirável:
 *
 * 1. **Ainda pendente.** Feita, recusada e pulada são fatos com hora e autor. Retirá-las apagaria
 *    o trabalho de alguém.
 * 2. **Ainda no futuro.** Uma tarefa pendente cuja hora já passou é uma **dívida do turno** — o
 *    que a prancheta chama de atrasada. Apagá-la ao publicar um horário novo seria resolver o
 *    atraso escondendo-o, e é o pior desfecho que este módulo pode produzir: a casa deixaria de
 *    ver o que não fez. Ela fica, e quem assume o turno a recebe.
 * 3. **Sem origem.** `origemId` preenchido significa que a tarefa nasceu de um registro — uma
 *    medicação da estadia, um serviço vendido na reserva. Retirá-la apagaria a dose de uma receita
 *    ou o banho que o cliente pagou, e nenhum dos dois é assunto do plano da casa.
 * 4. **De um tipo da casa.** Refeição e medicação não são cadastráveis; ver `TarefaDaCasaKind`.
 *
 * A condição 2 é a que costuma ser esquecida, e é a mais cara.
 */
export function particionarPorImutabilidade(
  tarefas: TarefaDeRotina[],
  agora: ISODateTime,
): ParticaoDeTarefas {
  const retiraveis: TarefaDeRotina[] = []
  const historia: TarefaDeRotina[] = []

  for (const tarefa of tarefas) {
    const podeSair =
      tarefa.status === 'pendente' &&
      tarefa.previstaPara > agora &&
      tarefa.origemId === null &&
      ehTarefaDaCasa(tarefa.kind)

    podeSair ? retiraveis.push(tarefa) : historia.push(tarefa)
  }

  return { retiraveis, historia }
}

export type Reconciliacao = {
  /** A criar. Nunca contém nada no passado. */
  criar: TarefaPlanejada[]
  /** A retirar: futuro intocado que o plano novo não prevê mais. */
  retirar: TarefaDeRotina[]
  /** O que fica como está — história mais o futuro que os dois planos têm em comum. */
  preservadas: TarefaDeRotina[]
}

/**
 * Compara o que existe com o que o plano prevê, e devolve os três baldes.
 *
 * É a única função que decide criar ou retirar tarefa, e serve aos dois usos:
 *
 * - **Preencher uma lacuna** (o dia que ninguém gerou): `existentes` vem vazio, e tudo o que o
 *   plano prevê para a frente é criado.
 * - **Publicar um plano novo**: `existentes` vem cheio, e a diferença entre os dois planos vira
 *   um punhado de criações e retiradas — nunca um dia inteiro refeito.
 *
 * **Nada nasce no passado.** Uma tarefa criada com hora já vencida nasceria atrasada, e uma
 * atrasada que ninguém teve chance de fazer é uma acusação falsa: ela diz que a casa falhou com um
 * animal num horário em que a tarefa ainda não existia. O caso concreto é o remédio registrado às
 * 15h40 com horários 08:00 e 20:00 — a dose das 20:00 nasce, a das 08:00 não.
 */
export function reconciliarDia(entrada: {
  existentes: TarefaDeRotina[]
  planejadas: TarefaPlanejada[]
  agora: ISODateTime
}): Reconciliacao {
  const { retiraveis, historia } = particionarPorImutabilidade(entrada.existentes, entrada.agora)

  const chavesQueExistem = new Set(entrada.existentes.map(chaveDaTarefa))
  const chavesPlanejadas = new Set(entrada.planejadas.map(chaveDaTarefa))

  const criar = entrada.planejadas.filter(
    (planejada) =>
      planejada.previstaPara > entrada.agora && !chavesQueExistem.has(chaveDaTarefa(planejada)),
  )

  const retirar = retiraveis.filter((tarefa) => !chavesPlanejadas.has(chaveDaTarefa(tarefa)))
  const mantidas = retiraveis.filter((tarefa) => chavesPlanejadas.has(chaveDaTarefa(tarefa)))

  return {
    criar,
    retirar,
    preservadas: [...historia, ...mantidas].sort((um, outro) =>
      um.previstaPara.localeCompare(outro.previstaPara),
    ),
  }
}

/** Duas tarefas iguais, para o mesmo animal, no mesmo instante. */
export type ConflitoDeTarefas = {
  hospedagemId: string
  previstaPara: ISODateTime
  tarefas: TarefaDeRotina[]
}

/**
 * Os conflitos que são conflito de verdade.
 *
 * **Mesmo animal, mesmo tipo, mesmo instante.** E só isso.
 *
 * Refeição às 07:00 e água às 07:00 no mesmo animal não é conflito: é a ronda funcionando, e a
 * prancheta já separa as duas por tipo. Uma revisão que listasse isso como problema mostraria
 * dezoito "conflitos" num dia comum, e uma lista de avisos que está sempre cheia ensina a aprovar
 * sem ler — que é exatamente o contrário do que uma revisão serve.
 *
 * O caso que importa é o outro: duas doses do mesmo remédio no mesmo minuto, ou duas trocas de
 * água às 12:00 vindas de dois lugares. Esses são erro, e ninguém os vê na prancheta — viram duas
 * fileiras iguais que parecem defeito de renderização.
 *
 * O sistema **não resolve sozinho**. Deslocar uma dose em trinta minutos é alterar uma prescrição
 * em silêncio. `planejarDia` desloca banho repetido, porque banho é serviço da casa; dose, não.
 */
export function conflitosReais(tarefas: TarefaDeRotina[]): ConflitoDeTarefas[] {
  const porChave = new Map<string, TarefaDeRotina[]>()

  for (const tarefa of tarefas) {
    const chave = `${tarefa.hospedagemId}|${tarefa.kind}|${tarefa.previstaPara}`

    porChave.set(chave, [...(porChave.get(chave) ?? []), tarefa])
  }

  return [...porChave.values()]
    .filter((grupo) => grupo.length > 1)
    .map((grupo) => ({
      hospedagemId: grupo[0]!.hospedagemId,
      previstaPara: grupo[0]!.previstaPara,
      tarefas: grupo,
    }))
    .sort((um, outro) => um.previstaPara.localeCompare(outro.previstaPara))
}
