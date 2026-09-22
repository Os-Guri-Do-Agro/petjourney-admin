/**
 * A rotina do turno — a prancheta.
 *
 * Duas coisas moram aqui, e nenhuma delas pode morar na tela.
 *
 * A primeira é a **geração**: as tarefas de um dia nascem da ficha da estadia (refeições,
 * medicação, passeio, higiene) e são materializadas como registros, não derivadas na leitura.
 * Derivar faria "servida por Helena às 8h05" pendurar em nada — e alterar o plano alimentar
 * amanhã apagaria as refeições de ontem, que é justamente o que alguém vai procurar quando o
 * animal voltar magro.
 *
 * A segunda é a **situação contra o relógio**: `atrasada` é uma leitura, nunca um estado gravado.
 * Uma refeição marcada como atrasada às 8h continuaria atrasada depois de servida às 8h10.
 */

import type {
  ClockTime,
  ISODate,
  ISODateTime,
  MedicacaoDaEstadia,
  PlanoAlimentar,
  Servico,
  ServicoContratado,
  ServicoKind,
  SituacaoDaTarefa,
  TarefaDeRotina,
  TarefaKind,
  TarefaStatus,
} from '../data/types'

import { addDays, clockToMinutes, dataDe, instante, minutosDe } from './hotel-time'

/** Soma minutos a um horário de parede, sem virar o dia: o catálogo não tem serviço à meia-noite. */
function somarMinutos(hora: ClockTime, minutos: number): ClockTime {
  const total = clockToMinutes(hora) + minutos
  const hh = String(Math.floor(total / 60) % 24).padStart(2, '0')
  const mm = String(total % 60).padStart(2, '0')

  return `${hh}:${mm}` as ClockTime
}

/**
 * De quantos minutos é a janela em que a tarefa está "na hora".
 *
 * Trinta: quem alimenta dezoito animais não serve os dezoito às 8h em ponto, e uma prancheta que
 * pinta de vermelho tudo o que passou do minuto exato ensina a ignorar o vermelho — que é o pior
 * desfecho possível para um destaque.
 */
export const JANELA_MINUTOS = 30

export function situacaoDaTarefa(
  tarefa: Pick<TarefaDeRotina, 'status' | 'previstaPara'>,
  agora: ISODateTime,
): SituacaoDaTarefa {
  if (tarefa.status !== 'pendente') {
    return tarefa.status
  }

  const minutos = Math.round((Date.parse(tarefa.previstaPara) - Date.parse(agora)) / 60_000)

  if (minutos > JANELA_MINUTOS) {
    return 'futura'
  }

  return minutos >= -JANELA_MINUTOS ? 'na-janela' : 'atrasada'
}

/** Cobra ação agora: está na janela ou já passou dela. */
export function cobraAcao(situacao: SituacaoDaTarefa): boolean {
  return situacao === 'na-janela' || situacao === 'atrasada'
}

/** Os três tempos em que a prancheta se reparte. */
export type TempoDaPrancheta = 'agora' | 'adiante' | 'passado'

export function tempoDaTarefa(situacao: SituacaoDaTarefa): TempoDaPrancheta {
  if (cobraAcao(situacao)) return 'agora'

  return situacao === 'futura' ? 'adiante' : 'passado'
}

/**
 * Reparte os blocos de horário num dos três tempos, **tarefa por tarefa**.
 *
 * Mora no domínio, e não na tela, porque a primeira versão morava na tela e estava errada: ela
 * classificava o **bloco inteiro** pelo que a tarefa mais urgente dele pedia. Bastava uma tarefa
 * cobrando ação às 07:00 para todas as outras daquele horário irem junto para "Para agora" —
 * medido na tela, a seção tinha 21 linhas das quais 16 já estavam feitas.
 *
 * A consequência de repartir por tarefa é que **um mesmo horário pode sair em dois tempos**: as
 * cinco das 07:00 que faltam ficam em "agora", as dezesseis já resolvidas descem para o
 * recolhido. Um bloco que fica sem linhas naquele tempo não sai — senão a tela ganharia
 * horários vazios.
 */
export function repartirPorTempo<
  Linha extends { situacao: SituacaoDaTarefa },
  Bloco extends { linhas: Linha[] },
>(blocos: Bloco[], tempo: TempoDaPrancheta): Bloco[] {
  return blocos
    .map((bloco) => ({
      ...bloco,
      linhas: bloco.linhas.filter((linha) => tempoDaTarefa(linha.situacao) === tempo),
    }))
    .filter((bloco) => bloco.linhas.length > 0)
}

/** Uma ronda: o mesmo serviço, no mesmo horário, para vários animais. */
export type Ronda<Linha> = { kind: TarefaKind; chave: string; linhas: Linha[] }

/**
 * Agrupa as tarefas de um horário em rondas.
 *
 * **A unidade de trabalho do canil não é a hora, é a ronda.** Às 18:00 alguém serve a ração de
 * vinte cães e só depois volta para trocar a água dos vinte — não faz uma coisa de cada animal
 * antes de passar ao seguinte. Enquanto a casa tinha cinco hóspedes isso não aparecia: cinco
 * linhas soltas num horário se leem como uma lista. Medido com a casa cheia, o bloco das 18:00
 * tinha **29 linhas de dois tipos misturados**, e a página inteira passou de 3740 px — quatro
 * telas de rolagem para um dia. Num hotel de quarenta, são dez.
 *
 * Agrupado, o mesmo horário vira duas linhas — "Refeição, 20 animais" e "Água, 9" —, e as vinte
 * ficam a um toque de distância para quem quiser conferir nome por nome.
 *
 * A ordem das rondas é a de aparição, que é a ordem em que a prancheta já vinha: mexer nela
 * inventaria uma prioridade entre ração e água que a casa não declarou.
 */
export function agruparEmRondas<Linha extends { tarefa: Pick<TarefaDeRotina, 'kind'> }>(
  hora: string,
  linhas: Linha[],
): Ronda<Linha>[] {
  const porKind = new Map<TarefaKind, Linha[]>()

  for (const linha of linhas) {
    const atual = porKind.get(linha.tarefa.kind)

    atual ? atual.push(linha) : porKind.set(linha.tarefa.kind, [linha])
  }

  return [...porKind].map(([kind, doKind]) => ({
    kind,
    chave: `${hora}|${kind}`,
    linhas: doKind,
  }))
}

/**
 * Até quantos animais uma ronda nasce aberta.
 *
 * É o número que faz a mesma tela servir a uma casa de cinco e a uma de cinquenta. Num hotel
 * pequeno toda ronda cabe aqui e a tela abre como sempre abriu — lista de tarefas, nada
 * recolhido, nada a clicar. Num hotel grande só as rondas curtas ficam abertas, e a ronda de
 * medicação com dois animais continua à vista enquanto a de ração com quarenta espera ser aberta.
 *
 * Seis porque é o que cabe em duas colunas sem virar parede, e porque abaixo disso o cabeçalho da
 * ronda custaria mais linhas do que economiza.
 */
export const RONDA_ABRE_ATE = 6

/**
 * A recusa conta como pendência resolvida.
 *
 * Não comeu **é** informação — vira conteúdo do boletim e, repetida, vira ocorrência —, mas não é
 * trabalho parado: ninguém precisa voltar lá. Contá-la como pendente faria a prancheta do fim do
 * turno mostrar trabalho que não existe, e é assim que se ensina alguém a entregar o turno sem
 * olhar a lista.
 */
export function pendentesAgora(tarefas: TarefaDeRotina[], agora: ISODateTime): TarefaDeRotina[] {
  return tarefas.filter((tarefa) => cobraAcao(situacaoDaTarefa(tarefa, agora)))
}

export function atrasadasAgora(tarefas: TarefaDeRotina[], agora: ISODateTime): TarefaDeRotina[] {
  return tarefas.filter((tarefa) => situacaoDaTarefa(tarefa, agora) === 'atrasada')
}

/** A próxima à frente, em minutos. `null` quando não há nenhuma. */
export function proximaEmMinutos(tarefas: TarefaDeRotina[], agora: ISODateTime): number | null {
  const futuras = tarefas
    .filter((tarefa) => tarefa.status === 'pendente' && tarefa.previstaPara > agora)
    .map((tarefa) => Math.round((Date.parse(tarefa.previstaPara) - Date.parse(agora)) / 60_000))
    .sort((um, outro) => um - outro)

  return futuras[0] ?? null
}

// ---------------------------------------------------------------------------
// Geração
// ---------------------------------------------------------------------------

/** Uma tarefa a criar, antes de ganhar identificador. */
export type TarefaPlanejada = Omit<
  TarefaDeRotina,
  'id' | 'status' | 'executadaEm' | 'executadaPor' | 'turnoId' | 'observacao'
>

/**
 * Higiene da acomodação e troca de água, nos horários fixos da casa.
 *
 * Fixos e não configuráveis nesta rodada de propósito: são a rotina que não muda por hóspede, e
 * transformá-los em cadastro agora acrescentaria uma tela de configuração antes de existir alguém
 * pedindo para mudá-los.
 */
const HIGIENE: ClockTime[] = ['09:00', '16:00']
const AGUA: ClockTime[] = ['07:00', '12:00', '18:00', '22:00']
const PASSEIO: ClockTime[] = ['10:00', '15:00']

/**
 * O serviço vendido, na prancheta de quem vai executá-lo.
 *
 * Sem este mapa, banho, tosa, passeio extra e recreação eram cobrados na reserva e **nunca
 * chegavam a ninguém**: o orçamento somava R$ 89,00 de banho e a rotina do turno não mencionava
 * banho nenhum. O animal ia embora sem o serviço, e a conta ia junto.
 *
 * `transporte` e `medicacao-assistida` ficam de fora, e não por esquecimento. Transporte não é
 * trabalho de canil: acontece fora da casa, no dia da entrada ou da saída. Medicação assistida é a
 * **taxa** por administrar o remédio; a tarefa já nasce da medicação registrada no check-in, e
 * gerar outra aqui faria a mesma dose aparecer duas vezes na lista.
 */
const HORA_DO_SERVICO: Partial<Record<ServicoKind, { kind: TarefaKind; hora: ClockTime }>> = {
  banho: { kind: 'banho', hora: '14:00' },
  tosa: { kind: 'tosa', hora: '14:30' },
  'passeio-extra': { kind: 'passeio', hora: '17:00' },
  'recreacao-individual': { kind: 'recreacao', hora: '11:00' },
  adestramento: { kind: 'adestramento', hora: '16:30' },
}

/**
 * As tarefas de um dia para uma estadia.
 *
 * `dia` é a data da parede do hotel e entra como parâmetro: a função não consulta relógio nenhum,
 * porque função de domínio que lê o relógio é função que não se testa sem congelar o tempo do
 * processo.
 */
export function planejarDia(entrada: {
  hospedagemId: string
  dia: ISODate
  utcOffset: string
  planoAlimentar: PlanoAlimentar
  medicacoes: MedicacaoDaEstadia[]
  /** Passeio e recreação só acontecem com autorização do responsável. */
  passeioAutorizado: boolean
  /** Entrada e saída da estadia: nada é planejado fora delas. */
  entradaEm: ISODateTime
  saidaPrevistaEm: ISODateTime
  /**
   * O que foi vendido na reserva, para virar tarefa.
   *
   * Opcional porque a chamada antiga não passava nada — e uma estadia sem serviço contratado é o
   * caso comum, não uma exceção.
   */
  servicos?: ServicoContratado[]
  /** O catálogo, para saber se o serviço é por diária ou uma vez só. */
  catalogoDeServicos?: Servico[]
}): TarefaPlanejada[] {
  const planejadas: TarefaPlanejada[] = []

  const dentroDaEstadia = (iso: ISODateTime) =>
    iso >= entrada.entradaEm && iso <= entrada.saidaPrevistaEm

  const acrescentar = (
    kind: TarefaKind,
    hora: ClockTime,
    descricao: string,
    origemId: string | null = null,
  ) => {
    const previstaPara = instante(entrada.dia, hora, entrada.utcOffset)

    if (dentroDaEstadia(previstaPara)) {
      planejadas.push({
        hospedagemId: entrada.hospedagemId,
        kind,
        descricao,
        origemId,
        previstaPara,
      })
    }
  }

  for (const hora of entrada.planoAlimentar.horarios) {
    acrescentar('refeicao', hora, descricaoDaRefeicao(entrada.planoAlimentar))
  }

  for (const medicacao of entrada.medicacoes) {
    if (medicacao.suspensaEm) {
      continue
    }

    /* A medicação tem janela própria dentro da estadia: começou depois, ou acabou antes. */
    if (entrada.dia < medicacao.inicio || (medicacao.fim && entrada.dia > medicacao.fim)) {
      continue
    }

    for (const hora of medicacao.horarios) {
      acrescentar(
        'medicacao',
        hora,
        `${medicacao.descricao} · ${medicacao.doseTexto}`,
        medicacao.id,
      )
    }
  }

  if (entrada.passeioAutorizado) {
    for (const hora of PASSEIO) {
      acrescentar('passeio', hora, '')
    }
  }

  for (const hora of HIGIENE) {
    acrescentar('higiene', hora, '')
  }

  for (const hora of AGUA) {
    acrescentar('agua', hora, '')
  }

  /*
   * Os serviços vendidos.
   *
   * O que é **por diária** entra todo dia da estadia; o que é cobrado uma vez entra uma vez, no
   * primeiro dia inteiro. "Primeiro dia inteiro" e não o dia da entrada: quem chega às 17h não
   * toma banho às 14h daquele mesmo dia, e uma tarefa que nasce no passado nasce atrasada.
   */
  const primeiroDiaInteiro = addDays(dataDe(entrada.entradaEm), 1)

  for (const contratado of entrada.servicos ?? []) {
    const servico = (entrada.catalogoDeServicos ?? []).find(
      (item) => item.id === contratado.servicoId,
    )
    const planta = servico ? HORA_DO_SERVICO[servico.kind] : undefined

    if (!servico || !planta) {
      continue
    }

    if (!servico.porDiaria && entrada.dia !== primeiroDiaInteiro) {
      continue
    }

    /* Quantidade maior que um, no mesmo dia, vira uma tarefa por unidade — meia hora entre elas. */
    const vezes = servico.porDiaria ? 1 : Math.max(1, contratado.quantidade)

    for (let indice = 0; indice < vezes; indice += 1) {
      acrescentar(
        planta.kind,
        somarMinutos(planta.hora, indice * 30),
        contratado.observacao,
        contratado.servicoId,
      )
    }
  }

  return planejadas.sort((um, outro) => um.previstaPara.localeCompare(outro.previstaPara))
}

/**
 * O que a prancheta lê na linha de uma refeição.
 *
 * Montado aqui e gravado na tarefa, não derivado na leitura: trocar a ração no terceiro dia não
 * pode reescrever o que foi servido no primeiro.
 */
export function descricaoDaRefeicao(plano: PlanoAlimentar): string {
  const marca = plano.racaoPropria ? plano.marca : ''

  return [marca, plano.porcaoGramas > 0 ? `${plano.porcaoGramas} g` : '']
    .filter(Boolean)
    .join(' · ')
}

/**
 * Agrupa por horário, e não por hóspede.
 *
 * É a decisão que faz a tela servir para quem está no canil: às 8h alguém alimenta os dezoito, não
 * percorre dezoito fichas. Agrupar por hóspede produziria a mesma informação numa ordem que obriga
 * a atravessar o corredor dezoito vezes.
 */
export type BlocoDeHorario = {
  hora: ClockTime
  minutos: number
  tarefas: TarefaDeRotina[]
}

export function agruparPorHorario(tarefas: TarefaDeRotina[]): BlocoDeHorario[] {
  const porHora = new Map<ClockTime, TarefaDeRotina[]>()

  for (const tarefa of tarefas) {
    const hora = tarefa.previstaPara.slice(11, 16)

    porHora.set(hora, [...(porHora.get(hora) ?? []), tarefa])
  }

  return [...porHora.entries()]
    .map(([hora, lista]) => ({ hora, minutos: clockToMinutes(hora), tarefas: lista }))
    .sort((um, outro) => um.minutos - outro.minutos)
}

/** As tarefas de um dia específico. A prancheta é sempre de um dia. */
export function tarefasDoDia(tarefas: TarefaDeRotina[], dia: ISODate): TarefaDeRotina[] {
  return tarefas.filter((tarefa) => dataDe(tarefa.previstaPara) === dia)
}

/**
 * As tarefas que atravessam a troca de turno.
 *
 * A passagem é o momento em que a informação mais se perde, e a pergunta de quem entrega não é "o
 * que está pendente" — é "o que **eu** deixo pendente". Uma tarefa prevista para depois do fim do
 * turno não é dívida de quem sai.
 */
export function pendenciasDoTurno(
  tarefas: TarefaDeRotina[],
  fimDoTurno: ISODateTime,
  agora: ISODateTime,
): TarefaDeRotina[] {
  return (
    tarefas
      .filter(
        (tarefa) =>
          tarefa.status === 'pendente' &&
          tarefa.previstaPara <= fimDoTurno &&
          cobraAcao(situacaoDaTarefa(tarefa, agora)),
      )
      /*
       * Em ordem de relógio, e não na ordem em que as tarefas foram criadas.
       * A lista saía agrupada por hóspede — as três do Thor, depois as três do Bento —, e quem
       * assume o turno não pergunta "o que falta do Thor": pergunta o que vem primeiro.
       */
      .sort((um, outro) => um.previstaPara.localeCompare(outro.previstaPara))
  )
}

/** Status que a tela oferece ao marcar. `pendente` não está aqui: é o estado de partida. */
export const STATUS_MARCAVEIS: Exclude<TarefaStatus, 'pendente'>[] = ['feita', 'recusada', 'pulada']

/** Minutos da tarefa na parede, para ordenar sem reparsear o ISO. */
export function minutosDaTarefa(tarefa: TarefaDeRotina): number {
  return minutosDe(tarefa.previstaPara)
}
