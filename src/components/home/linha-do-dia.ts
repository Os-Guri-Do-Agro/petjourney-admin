/**
 * A conta do dia da casa na visão geral — sem Vue e sem repositório.
 *
 * Os blocos dos espaços e a agenda da semana leem o mesmo dia: os atendimentos da clínica e as chegadas e
 * saídas do hotel. Tudo o que decide **em que estado** cada coisa está e **qual** vem primeiro mora
 * aqui, para ser testado com um dia montado no teste, e não com o relógio de verdade.
 *
 * Os instantes são `ISODateTime` da parede da clínica (`YYYY-MM-DDTHH:mm:ss-04:00`): a hora que
 * importa é a escrita na string, a mesma que a agenda mostra. Por isso a hora sai dos caracteres,
 * e não de um `Date` — que converteria para o fuso de quem olha.
 */

/** Espécie, no vocabulário dos dois módulos (clínica e hotel usam o mesmo). */
export type EspecieDoDia = 'canina' | 'felina' | 'ave' | 'roedor' | 'reptil' | 'equina'

/**
 * Em que pé está um atendimento, do ponto de vista de quem olha o dia.
 *
 * - `feito`: finalizado.
 * - `agora`: em atendimento.
 * - `esperando`: o animal chegou e está na recepção.
 * - `marcado`: agendado ou confirmado, ainda por vir.
 * - `falta`: o horário passou e ninguém veio.
 *
 * Cancelado não entra: é um horário que deixou de existir, e desenhá-lo faria o dia parecer mais
 * cheio do que é.
 */
export type EstadoDaConta = 'feito' | 'agora' | 'esperando' | 'marcado' | 'falta'

/** Um atendimento da clínica. */
export type ContaDoDia = {
  id: string
  inicio: string
  fim: string
  estado: EstadoDaConta
  petNome: string
  petIniciais: string
  petEspecie: EspecieDoDia | null
  petFotoUrl: string
  /** Nome do tipo de atendimento, já no idioma da tela. */
  tipo: string
  profissional: string
  /** Quando o animal chegou à recepção. Só existe para quem já chegou. */
  chegadaEm: string | null
  rota: string
}

/**
 * Uma chegada ou saída do hotel **ainda por fazer**.
 *
 * Só entra o que falta acontecer: a chegada é uma reserva que ainda não virou hospedagem,
 * a saída é um hóspede que ainda está na casa. Por isso um movimento cujo horário passou não é
 * passado — é atrasado, e é o que mais precisa aparecer.
 */
export type MovimentoDoDia = {
  id: string
  tipo: 'chegada' | 'saida'
  quando: string
  petNome: string
  petIniciais: string
  petEspecie: EspecieDoDia | null
  petFotoUrl: string
  /** Onde o animal fica: a acomodação. */
  detalhe: string
  /** Tem algo que impede o movimento: documento na chegada, pesagem na saída. */
  travado: boolean
  rota: string
}

/**
 * `YYYY-MM-DD` mais (ou menos) `dias`. A conta é feita ao meio-dia UTC: longe da meia-noite, nenhum
 * fuso vira o dia — a Agenda anda de semana em semana sem pular nem repetir data.
 */
export function somarDias(data: string, dias: number): string {
  const base = new Date(`${data}T12:00:00Z`)
  base.setUTCDate(base.getUTCDate() + dias)

  return base.toISOString().slice(0, 10)
}

/** A hora da parede de um instante, `HH:mm`. */
export function horaDaParede(iso: string): string {
  return iso.slice(11, 16)
}

/** O status da agenda no vocabulário da home. `null` para o que não entra (cancelado). */
export function estadoDoAtendimento(status: string): EstadoDaConta | null {
  switch (status) {
    case 'finalizado':
      return 'feito'
    case 'em-atendimento':
      return 'agora'
    case 'aguardando':
      return 'esperando'
    case 'falta':
      return 'falta'
    case 'agendado':
    case 'confirmado':
      return 'marcado'
    default:
      return null
  }
}

/** Quantos atendimentos há em cada estado. */
export function contarPorEstado(contas: readonly ContaDoDia[]): Record<EstadoDaConta, number> {
  const contagem: Record<EstadoDaConta, number> = {
    feito: 0,
    agora: 0,
    esperando: 0,
    marcado: 0,
    falta: 0,
  }

  for (const conta of contas) {
    contagem[conta.estado] += 1
  }

  return contagem
}

/** O horário passou e o movimento continua por fazer. */
export function movimentoAtrasado(movimento: MovimentoDoDia, agora: string | null): boolean {
  return agora !== null && movimento.quando <= agora
}

/** Um compromisso do dia, antes de virar cartão na agenda. */
export type CompromissoDoDia =
  | { tipo: 'conta'; conta: ContaDoDia }
  | { tipo: 'movimento'; movimento: MovimentoDoDia; atrasado: boolean }

/**
 * Os compromissos do dia, pela hora que a linha mostra.
 *
 * Com `agora` (o dia é hoje), o que já terminou (finalizado, falta) fica de fora: a lista é do que
 * ainda pede alguém. Sem `agora` (outro dia), tudo o que está na agenda. Nos dois, clínica e hotel
 * misturados pela hora. A urgência (em atendimento, atrasado, na recepção) vai no selo da linha, e
 * o que é agora já está nos blocos dos espaços, no topo do Início: ordenar por ela fazia a lista
 * começar às 17:45 e voltar para 09:30, e quem lia de relance achava que estava embaralhada.
 */
export function compromissosDoDia(
  contas: readonly ContaDoDia[],
  movimentos: readonly MovimentoDoDia[],
  agora: string | null,
): CompromissoDoDia[] {
  const itens: { compromisso: CompromissoDoDia; hora: string }[] = []

  for (const conta of contas) {
    const terminou = conta.estado === 'feito' || conta.estado === 'falta'

    if (agora === null || !terminou) {
      itens.push({ compromisso: { tipo: 'conta', conta }, hora: conta.inicio })
    }
  }

  for (const movimento of movimentos) {
    itens.push({
      compromisso: { tipo: 'movimento', movimento, atrasado: movimentoAtrasado(movimento, agora) },
      hora: movimento.quando,
    })
  }

  return itens
    .sort((um, outro) => um.hora.localeCompare(outro.hora))
    .map(({ compromisso }) => compromisso)
}
