/**
 * Pedido de horário — as regras que o app, o link público e a recepção têm de concordar.
 *
 * O responsável pede, a clínica responde. Para isso dar certo, três telas precisam fazer a mesma
 * conta sem conversar entre si: o app que oferece horários, a página pública que oferece os mesmos
 * horários a quem não tem conta, e a recepção que aceita ou procura o melhor horário. Uma conta em
 * cada tela seria o app oferecendo 10:30 e a recepção dizendo que 10:30 nunca existiu.
 *
 * Funções puras: quem chama entrega o dataset do momento. O servidor de mentira
 * (`data/agendamento-online.ts`) e a API de verdade fazem as mesmas chamadas.
 */

import type {
  Appointment,
  AppointmentTypeKind,
  ClockTime,
  Clinic,
  ConflictKind,
  ISODate,
  ISODateTime,
  MotivoDoPedido,
  PedidoDeHorario,
  PeriodoDoDia,
  Pet,
  PreferenciaDoPedido,
} from '../data/types'

import { addDays, clockToMinutes, minutesToClock, weekdayOf, type ClinicClock } from './clinic-time'
import { detectarConflitos, type ConflictContext } from './conflicts'

/** Um horário que dá para oferecer: um profissional, e um intervalo por pet. */
export type OpcaoDeHorarioInterna = {
  professionalId: string
  inicio: ISODateTime
  fim: ISODateTime
  porPet: Array<{ petId: string; inicio: ISODateTime; fim: ISODateTime }>
}

/** A sugestão da recepção para o pedido de melhor horário. */
export type SugestaoDoPedido = OpcaoDeHorarioInterna & {
  /** Caiu fora do que o responsável disse que pode — a recepção oferece, não marca calada. */
  foraDaPreferencia: boolean
}

/** O que o motivo vira na agenda. Sintoma e check-up são consulta; o resto tem tipo próprio. */
export const TIPO_DO_MOTIVO: Record<MotivoDoPedido, AppointmentTypeKind> = {
  checkup: 'consulta',
  sintoma: 'consulta',
  outro: 'consulta',
  vacina: 'vacina',
  retorno: 'retorno',
  exame: 'exame',
  banho: 'banho',
}

/** Até o meio-dia é manhã. O almoço da clínica separa os dois sem ninguém precisar dizer. */
export const FIM_DA_MANHA_EM_MINUTOS = 12 * 60

export function periodoDe(minutos: number): PeriodoDoDia {
  return minutos < FIM_DA_MANHA_EM_MINUTOS ? 'manha' : 'tarde'
}

/**
 * De quanto em quanto o app oferece horário.
 *
 * A grade da recepção anda de 15 em 15, e oferecer isso ao responsável seria uma parede de 40
 * botões por profissional. Atendimento de meia hora ou mais começa na hora cheia ou na meia; a
 * vacina, curta, anda de 15 em 15.
 */
export function passoDaOferta(duracaoMinutos: number): number {
  return duracaoMinutos >= 30 ? 30 : 15
}

/**
 * O que ainda não é atendimento mas já ocupa a agenda: o pedido pendente de horário escolhido.
 *
 * Vira um atendimento de mentira para entrar na mesma checagem de conflito que a agenda usa. Sem
 * isso, dois responsáveis pediriam o mesmo 10:30 e a clínica descobriria ao aceitar o segundo.
 * `ignorarGrupo` deixa o próprio pedido de fora — senão ele colidiria consigo ao ser aceito.
 */
export function ocupacoesDosPedidos(
  pedidos: PedidoDeHorario[],
  ignorarGrupo: string | null = null,
): Appointment[] {
  return pedidos
    .filter(
      (pedido) =>
        pedido.status === 'pendente' &&
        pedido.modo === 'horario-escolhido' &&
        pedido.inicio !== null &&
        pedido.fim !== null &&
        pedido.professionalId !== null &&
        (ignorarGrupo === null || (pedido.grupoId ?? pedido.id) !== ignorarGrupo),
    )
    .map((pedido) => ({
      id: `pedido@${pedido.id}`,
      petId: pedido.petId ?? `novo@${pedido.id}`,
      tutorId: pedido.tutorId ?? '',
      professionalId: pedido.professionalId!,
      roomIds: [],
      typeId: pedido.typeId,
      inicio: pedido.inicio!,
      fim: pedido.fim!,
      status: 'agendado',
      origem: pedido.canal,
      encaixe: false,
      observacao: '',
      chegadaEm: null,
      iniciadoEm: null,
      finalizadoEm: null,
      canceladoEm: null,
      motivoCancelamento: null,
      justificativaDeFalta: null,
      encounterId: null,
      linkedGroupId: null,
      criadoEm: pedido.criadoEm,
      atualizadoEm: pedido.criadoEm,
    }))
}

export type EntradaDasOpcoes = {
  data: ISODate
  typeId: string
  duracaoMinutos: number
  /**
   * Um id por pet, na ordem em que entram. Mais de um é a casa com dois pets: o mesmo
   * profissional, um horário logo depois do outro. Pet que a clínica ainda não conhece entra com
   * qualquer id que não colida com ninguém.
   */
  petIds: string[]
  professionalIds: string[]
  /** Nada antes disto: a antecedência mínima da clínica, já somada a agora. */
  aPartirDe: ISODateTime
}

/** O dia fecha? Feriado com a porta fechada conta igual ao domingo. */
export function diaFechado(
  clinic: Clinic,
  data: ISODate,
): { fechado: boolean; feriado: string | null } {
  const feriado = clinic.feriados.find((item) => item.date === data && item.fechado) ?? null
  const horario = clinic.horarios.find((item) => item.weekday === weekdayOf(data))

  return {
    fechado: Boolean(feriado) || !horario || horario.fechado,
    feriado: feriado?.nome ?? null,
  }
}

/**
 * O aviso de carga não ocupa horário.
 *
 * "Ana passou de 8 h de agenda hoje" é sinal de planejamento — a barra de carga da agenda —, não
 * um horário tomado. Contado como conflito, um aceite qualquer de manhã fazia o pedido da tarde
 * aparecer como "ocupado depois do pedido" sem ninguém ter marcado nada ali.
 */
const CONFLITOS_QUE_NAO_OCUPAM: ConflictKind[] = ['over-capacity']

/**
 * Os horários de um dia que nenhum aviso de agenda atrapalha.
 *
 * Só entra o que passa sem conflito, nem o informativo do almoço: o responsável não tem como pesar
 * "invade dez minutos do almoço", e a recepção não quer aceitar o que ela própria não marcaria. A
 * exceção é a carga do dia (`CONFLITOS_QUE_NAO_OCUPAM`).
 */
export function opcoesDoDia(
  entrada: EntradaDasOpcoes,
  contexto: Omit<ConflictContext, 'data'>,
): OpcaoDeHorarioInterna[] {
  const { clinic, clock } = contexto

  if (diaFechado(clinic, entrada.data).fechado || entrada.petIds.length === 0) {
    return []
  }

  const horario = clinic.horarios.find((item) => item.weekday === weekdayOf(entrada.data))!
  const abre = clockToMinutes(horario.expediente.inicio)
  const fecha = clockToMinutes(horario.expediente.fim)
  const passo = passoDaOferta(entrada.duracaoMinutos)
  const limite = Date.parse(entrada.aPartirDe)
  const total = entrada.duracaoMinutos * entrada.petIds.length
  const ctx: ConflictContext = { ...contexto, data: entrada.data }
  const opcoes: OpcaoDeHorarioInterna[] = []

  for (const professionalId of entrada.professionalIds) {
    for (let minuto = abre; minuto + total <= fecha; minuto += passo) {
      if (Date.parse(clock.toIso(entrada.data, minuto)) < limite) {
        continue
      }

      const porPet = entrada.petIds.map((petId, indice) => ({
        petId,
        inicio: clock.toIso(entrada.data, minuto + indice * entrada.duracaoMinutos),
        fim: clock.toIso(entrada.data, minuto + (indice + 1) * entrada.duracaoMinutos),
      }))

      const livre = porPet.every(
        (trecho) =>
          detectarConflitos(
            {
              petId: trecho.petId,
              professionalId,
              roomIds: [],
              typeId: entrada.typeId,
              inicio: trecho.inicio,
              fim: trecho.fim,
            },
            ctx,
          ).filter((conflito) => !CONFLITOS_QUE_NAO_OCUPAM.includes(conflito.kind)).length === 0,
      )

      if (livre) {
        opcoes.push({
          professionalId,
          inicio: porPet[0]!.inicio,
          fim: porPet[porPet.length - 1]!.fim,
          porPet,
        })
      }
    }
  }

  return opcoes.sort(
    (a, b) =>
      a.inicio.localeCompare(b.inicio) ||
      entrada.professionalIds.indexOf(a.professionalId) -
        entrada.professionalIds.indexOf(b.professionalId),
  )
}

/**
 * Onde a clínica marcaria um pedido de melhor horário.
 *
 * "Melhor" é, nesta ordem: dentro do que a pessoa disse que pode; o dia mais cedo; quem já atende
 * o pet (continuidade vale mais que meia hora de diferença); o horário mais cedo — ou o mais perto
 * do que ela tinha escolhido, quando o pedido era de horário escolhido. Uma sugestão por
 * profissional por dia — três sugestões de 09:00, 09:30 e 10:00 com a mesma pessoa não são três
 * escolhas, são uma.
 *
 * Se a janela pedida não tem nada, a busca continua depois dela e marca a sugestão como fora da
 * preferência: a recepção oferece, em vez de recusar um pedido que dá para atender dois dias depois.
 */
export function melhoresOpcoes(
  entrada: Omit<EntradaDasOpcoes, 'data'> & {
    preferencia: PreferenciaDoPedido
    hoje: ISODate
    /** Quem atendeu o pet por último, para a continuidade. */
    profissionalDaCasa: string | null
    limite: number
    /** Dias depois do fim da janela em que ainda vale procurar. */
    alemDaJanelaDias: number
    /**
     * O horário que a pessoa tinha escolhido, em minutos do dia. Com ele, "melhor" passa a ser o
     * mais perto dele — a alternativa ao horário que sumiu é a mais parecida, não a mais cedo.
     */
    alvoEmMinutos?: number | null
  },
  contexto: Omit<ConflictContext, 'data'>,
  opcoesPorDia: (data: ISODate, professionalIds: string[]) => OpcaoDeHorarioInterna[] = (
    data,
    professionalIds,
  ) => opcoesDoDia({ ...entrada, data, professionalIds }, contexto),
): SugestaoDoPedido[] {
  const { preferencia } = entrada
  const profissionais = preferencia.professionalId
    ? entrada.professionalIds.filter((id) => id === preferencia.professionalId)
    : entrada.professionalIds
  const inicio = preferencia.de > entrada.hoje ? preferencia.de : entrada.hoje
  const ultimo = addDays(preferencia.ate, entrada.alemDaJanelaDias)
  const sugestoes: SugestaoDoPedido[] = []

  for (
    let data = inicio;
    data <= ultimo && sugestoes.length < entrada.limite;
    data = addDays(data, 1)
  ) {
    const foraDaPreferencia = data > preferencia.ate

    /* Fora da janela, quem já achou alguma coisa dentro dela para de procurar. */
    if (foraDaPreferencia && sugestoes.length > 0) {
      break
    }

    const doDia = opcoesPorDia(data, profissionais).filter(
      (opcao) =>
        preferencia.periodos.length === 0 ||
        preferencia.periodos.includes(periodoDe(contexto.clock.minutesOf(opcao.inicio))),
    )

    /* Distância até o horário que a pessoa queria; sem alvo, o mais cedo ganha. */
    const distancia = (opcao: OpcaoDeHorarioInterna) =>
      entrada.alvoEmMinutos === null || entrada.alvoEmMinutos === undefined
        ? contexto.clock.minutesOf(opcao.inicio)
        : Math.abs(contexto.clock.minutesOf(opcao.inicio) - entrada.alvoEmMinutos)

    const melhorDeCada = new Map<string, OpcaoDeHorarioInterna>()

    for (const opcao of doDia) {
      const atual = melhorDeCada.get(opcao.professionalId)

      if (!atual || distancia(opcao) < distancia(atual)) {
        melhorDeCada.set(opcao.professionalId, opcao)
      }
    }

    const ordenadas = [...melhorDeCada.values()].sort((a, b) => {
      const casaA = a.professionalId === entrada.profissionalDaCasa ? 0 : 1
      const casaB = b.professionalId === entrada.profissionalDaCasa ? 0 : 1

      return casaA - casaB || distancia(a) - distancia(b) || a.inicio.localeCompare(b.inicio)
    })

    for (const opcao of ordenadas) {
      if (sugestoes.length >= entrada.limite) {
        break
      }

      sugestoes.push({ ...opcao, foraDaPreferencia })
    }
  }

  return sugestoes
}

// ---------------------------------------------------------------------------
// Prazo de resposta
// ---------------------------------------------------------------------------

/**
 * Até quando a clínica responde, contando só o expediente.
 *
 * "Respondemos em até 4 h" dito a quem pediu às 22h não pode vencer às 2h da manhã: a recepção
 * está em casa. O prazo anda só enquanto a clínica está aberta — o pedido da noite vence no meio
 * da manhã seguinte, que é quando alguém de fato pode respondê-lo.
 */
export function prazoEmExpediente(
  criadoEm: ISODateTime,
  horas: number,
  clinic: Clinic,
  clock: ClinicClock,
): ISODateTime {
  let restante = Math.round(horas * 60)
  const partida = clock.toWall(criadoEm)
  let data = partida.date
  let minuto = partida.minutes

  for (let dia = 0; dia < 21 && restante > 0; dia += 1) {
    const { fechado } = diaFechado(clinic, data)
    const horario = clinic.horarios.find((item) => item.weekday === weekdayOf(data))

    if (!fechado && horario) {
      const abre = clockToMinutes(horario.expediente.inicio)
      const fecha = clockToMinutes(horario.expediente.fim)
      const comeco = Math.max(minuto, abre)

      if (comeco < fecha) {
        const cabe = fecha - comeco

        if (restante <= cabe) {
          return clock.toIso(data, comeco + restante)
        }

        restante -= cabe
      }
    }

    data = addDays(data, 1)
    minuto = 0
  }

  return clock.toIso(data, minuto)
}

export type SituacaoDoPrazo = 'no-prazo' | 'vencendo' | 'atrasado'

/** A meia hora final do prazo é quando a linha precisa chamar atenção — não antes. */
export const MINUTOS_PARA_VENCER = 30

export function situacaoDoPrazo(pedido: PedidoDeHorario, agora: ISODateTime): SituacaoDoPrazo {
  const faltam = (Date.parse(pedido.responderAte) - Date.parse(agora)) / 60_000

  if (faltam < 0) {
    return 'atrasado'
  }

  return faltam <= MINUTOS_PARA_VENCER ? 'vencendo' : 'no-prazo'
}

/**
 * O pedido perdeu o sentido? O horário escolhido já passou, ou a janela acabou.
 *
 * Só isso expira. Atraso da clínica não: some com o pedido, e o atraso some junto.
 */
export function pedidoPerdeuOSentido(pedido: PedidoDeHorario, agora: ISODateTime): boolean {
  if (pedido.status !== 'pendente') {
    return false
  }

  if (pedido.modo === 'horario-escolhido') {
    return pedido.inicio !== null && Date.parse(pedido.inicio) <= Date.parse(agora)
  }

  return pedido.preferencia !== null && pedido.preferencia.ate < agora.slice(0, 10)
}

// ---------------------------------------------------------------------------
// A clínica agora — o que a tela de emergência diz
// ---------------------------------------------------------------------------

export type EstadoDaClinica = {
  abertaAgora: boolean
  /** Hoje, quando fecha. `null` com a clínica fechada. */
  fechaAs: ClockTime | null
  /** Quando abre de novo. `null` com a clínica aberta. */
  abreEm: ISODateTime | null
}

export function estadoDaClinica(clinic: Clinic, clock: ClinicClock): EstadoDaClinica {
  const agora = clock.now()
  const hoje = clinic.horarios.find((item) => item.weekday === weekdayOf(agora.date))

  if (hoje && !diaFechado(clinic, agora.date).fechado) {
    const abre = clockToMinutes(hoje.expediente.inicio)
    const fecha = clockToMinutes(hoje.expediente.fim)

    if (agora.minutes >= abre && agora.minutes < fecha) {
      return { abertaAgora: true, fechaAs: minutesToClock(fecha), abreEm: null }
    }

    if (agora.minutes < abre) {
      return { abertaAgora: false, fechaAs: null, abreEm: clock.toIso(agora.date, abre) }
    }
  }

  for (let dia = 1; dia <= 14; dia += 1) {
    const data = addDays(agora.date, dia)
    const horario = clinic.horarios.find((item) => item.weekday === weekdayOf(data))

    if (horario && !diaFechado(clinic, data).fechado) {
      return {
        abertaAgora: false,
        fechaAs: null,
        abreEm: clock.toIso(data, clockToMinutes(horario.expediente.inicio)),
      }
    }
  }

  return { abertaAgora: false, fechaAs: null, abreEm: null }
}

// ---------------------------------------------------------------------------
// O pet que chega
// ---------------------------------------------------------------------------

export type CampoQueFalta = 'nascimento' | 'sexo'

/**
 * O que o app pergunta antes de seguir.
 *
 * Só o que muda a consulta: a idade decide a vacina e a dose, o sexo decide a pergunta que o
 * veterinário faz primeiro. Raça, pelagem e microchip a recepção completa no balcão — pedir tudo
 * no celular é o que faz alguém desistir no terceiro campo.
 */
export function camposQueFaltam(pet: Pick<Pet, 'nascimento' | 'sexo'>): CampoQueFalta[] {
  const faltam: CampoQueFalta[] = []

  if (!pet.nascimento) {
    faltam.push('nascimento')
  }

  if (!pet.sexo) {
    faltam.push('sexo')
  }

  return faltam
}

/** Os pedidos de um envio, juntos. O pedido sem grupo é um grupo de um. */
export function agruparPedidos(pedidos: PedidoDeHorario[]): PedidoDeHorario[][] {
  const grupos = new Map<string, PedidoDeHorario[]>()

  for (const pedido of pedidos) {
    const chave = pedido.grupoId ?? pedido.id

    grupos.set(chave, [...(grupos.get(chave) ?? []), pedido])
  }

  return [...grupos.values()].map((grupo) =>
    grupo.sort((a, b) => (a.inicio ?? '').localeCompare(b.inicio ?? '')),
  )
}
