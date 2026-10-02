/**
 * Repositório da agenda — assinatura de API, implementação em memória.
 *
 * Toda mutação devolve, além do registro, um `undoToken`: o desfazer de 8 segundos da
 * interface precisa de um ponto de restauração, e ele nasce aqui e não na tela.
 */

import { materializarBloqueios } from '../../domain/conflicts'
import { slotsLivres } from '../../domain/slots'
import { CAPACIDADE_MINUTOS_POR_PROFISSIONAL, cargaDoDia } from '../../domain/load'
import { addDays, createClinicClock, weekDates, weekdayOf } from '../../domain/clinic-time'
import {
  appointmentTypesFixture,
  CLINIC_UTC_OFFSET,
  professionalsFixture,
  roomsFixture,
} from '../fixtures'
import { simularChamada } from '../mock-runtime'
import {
  agoraIso,
  criarReserva,
  getDataset,
  liberarReserva,
  listarReservas,
  novoId,
} from '../store'
import type {
  AgendaDia,
  Appointment,
  AppointmentStatus,
  Block,
  BlockReason,
  CancelReason,
  ConfirmacaoDePresenca,
  JustificativaDeFalta,
  DiaCarga,
  Encounter,
  SlotSugestao,
  Hold,
  ISODate,
  ISODateTime,
  WeekdayIndex,
} from '../types'

const clock = createClinicClock(CLINIC_UTC_OFFSET)

/**
 * O que a tela informa ao justificar uma falta.
 *
 * Quem registrou e quando **não** vêm daqui: são carimbados na gravação, como o `canceladoEm`
 * do cancelamento. Deixar a tela mandar o instante seria deixá-la mandar um instante errado.
 */
export type EntradaDeJustificativa = {
  motivo: JustificativaDeFalta['motivo']
  canal: JustificativaDeFalta['canal']
  observacao: string
  professionalId: string
}

function montarJustificativa(
  entrada: EntradaDeJustificativa,
  agora: ISODateTime,
): JustificativaDeFalta {
  return {
    motivo: entrada.motivo,
    canal: entrada.canal,
    observacao: entrada.observacao.trim(),
    professionalId: entrada.professionalId,
    registradaEm: agora,
  }
}

/** Pilha de restauração do desfazer. Curta de propósito: 8 segundos não guardam história. */
const desfazerPorToken = new Map<string, () => void>()

function registrarDesfazer(snapshot: Appointment[]): string {
  const token = novoId('undo')
  const copia = snapshot.map((appointment) => ({ ...appointment }))

  desfazerPorToken.set(token, () => {
    const dataset = getDataset()

    for (const anterior of copia) {
      const indice = dataset.appointments.findIndex((item) => item.id === anterior.id)

      if (indice >= 0) {
        dataset.appointments[indice] = { ...anterior }
      } else {
        dataset.appointments.push({ ...anterior })
      }
    }
  })

  setTimeout(() => desfazerPorToken.delete(token), 30_000)

  return token
}

export type MutacaoAgenda = {
  atendimentos: Appointment[]
  undoToken: string
}

function atendimentosDoDia(data: ISODate): Appointment[] {
  return getDataset()
    .appointments.filter((appointment) => clock.dateOf(appointment.inicio) === data)
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
}

export type NovoAtendimento = {
  petId: string
  tutorId: string
  professionalId: string
  roomIds: string[]
  typeId: string
  inicio: ISODateTime
  fim: ISODateTime
  encaixe: boolean
  observacao: string
  origem: Appointment['origem']
}

/**
 * Um atendimento novo, no formato que `criar` grava.
 *
 * Exportado para quem marca horário **como consequência de outro registro** — a próxima dose
 * da vacina, marcada na mesma gravação da aplicação. Chamar `criar` de dentro de outra chamada
 * pagaria a latência duas vezes e deixaria uma janela em que a dose existe e o horário não.
 */
export function atendimentoNovo(input: NovoAtendimento, agora: ISODateTime): Appointment {
  return {
    id: novoId('apt'),
    petId: input.petId,
    tutorId: input.tutorId,
    professionalId: input.professionalId,
    roomIds: input.roomIds,
    typeId: input.typeId,
    inicio: input.inicio,
    fim: input.fim,
    status: 'agendado',
    origem: input.origem,
    encaixe: input.encaixe,
    observacao: input.observacao,
    chegadaEm: null,
    iniciadoEm: null,
    finalizadoEm: null,
    canceladoEm: null,
    motivoCancelamento: null,
    justificativaDeFalta: null,
    encounterId: null,
    linkedGroupId: null,
    criadoEm: agora,
    atualizadoEm: agora,
  }
}

export const agendaRepository = {
  obterDia(data: ISODate): Promise<AgendaDia> {
    return simularChamada('agenda.dia', () => {
      const dataset = getDataset()
      const horario = dataset.clinic.horarios.find((item) => item.weekday === weekdayOf(data))
      const feriado = dataset.clinic.feriados.find((item) => item.date === data) ?? null

      return {
        data,
        clinicaFechada: Boolean(horario?.fechado) || Boolean(feriado?.fechado),
        feriado,
        expediente: horario?.expediente ?? { inicio: '08:00', fim: '19:00' },
        almoco: horario?.almoco ?? null,
        profissionais: professionalsFixture.filter((professional) => professional.ativo),
        atendimentos: atendimentosDoDia(data),
        bloqueios: materializarBloqueios(dataset.blocks, data, clock),
      }
    })
  },

  obterSemana(data: ISODate): Promise<{ dias: DiaCarga[]; atendimentos: Appointment[] }> {
    return simularChamada('agenda.semana', () => {
      const dataset = getDataset()
      const dias = weekDates(data)
      const ativos = professionalsFixture.filter((professional) => professional.ativo)
      const atendimentos = dataset.appointments.filter((appointment) =>
        dias.includes(clock.dateOf(appointment.inicio)),
      )

      return {
        dias: dias.map((dia) =>
          cargaDoDia(dia, atendimentos, dataset.clinic, ativos, clock),
        ),
        atendimentos,
      }
    })
  },

  /**
   * Tudo que aconteceu entre duas datas, atendimentos e prontuários juntos.
   *
   * O painel de resumo precisa dos dois lados na mesma janela — contagem de atendimento vem do
   * agendamento, diagnóstico vem do prontuário —, e buscar em duas chamadas abriria espaço para
   * as duas metades caírem em intervalos diferentes.
   */
  obterIntervalo(
    inicio: ISODate,
    fim: ISODate,
  ): Promise<{ atendimentos: Appointment[]; prontuarios: Encounter[] }> {
    return simularChamada('agenda.semana', () => {
      const dataset = getDataset()
      const dentro = (iso: string) => {
        const data = clock.dateOf(iso)

        return data >= inicio && data <= fim
      }

      return {
        atendimentos: dataset.appointments.filter((appointment) => dentro(appointment.inicio)),
        prontuarios: dataset.encounters.filter((encounter) =>
          dentro(encounter.finalizadoEm ?? encounter.abertoEm),
        ),
      }
    })
  },
  /**
   * Horários livres para o retorno sugerido no prontuário.
   *
   * Mora no repositório, e não na tela, porque é conta de agenda inteira: precisa dos
   * atendimentos, dos bloqueios e do expediente de **outro dia**, e a store da agenda só tem o
   * dia que está na tela. Na API real esta busca é do servidor pelo mesmo motivo.
   *
   * A data alvo é uma sugestão, não uma exigência: se ela cair em dia fechado ou já lotado, a
   * busca **avança** dia a dia dentro da janela de tolerância. Retorno em 15 dias que cai num
   * feriado não vira "não há horário" — vira 16.
   */
  /**
   * O mesmo motor serve ao reagendamento de uma falta.
   *
   * Reagendar uma falta é a mesma pergunta que sugerir um retorno — "quando este paciente cabe
   * de novo na agenda desta pessoa?" — só que a data de partida é a da falta e a distância
   * costuma ser curta. Duplicar a busca criaria duas listas que divergem na primeira vez que
   * alguém mexer nas regras de conflito.
   */
  sugerirReagendamento(input: {
    petId: string
    professionalId: string
    typeId: string
    /** Data da falta. */
    aPartirDe: ISODate
    /** Dias adiante em que a recepção aceita reoferecer. Curto de propósito. */
    emDias?: number
    tolerancia?: number
    limite?: number
  }): Promise<SlotSugestao[]> {
    return agendaRepository.sugerirRetorno({
      ...input,
      /* Reagendamento começa no dia seguinte, não semanas depois. */
      emDias: input.emDias ?? 1,
      tolerancia: input.tolerancia ?? 14,
    })
  },

  sugerirRetorno(input: {
    petId: string
    professionalId: string
    typeId: string
    /** Data do atendimento que originou o retorno. */
    aPartirDe: ISODate
    emDias: number
    /** Dias após a data alvo em que ainda vale procurar. */
    tolerancia?: number
    limite?: number
  }): Promise<SlotSugestao[]> {
    return simularChamada('agenda.slots', () => {
      const dataset = getDataset()
      const tipo = appointmentTypesFixture.find((item) => item.id === input.typeId)
      const duracaoMinutos = tipo?.duracaoMinutos ?? 30
      const tolerancia = input.tolerancia ?? 7
      const limite = input.limite ?? 6
      const encontrados: SlotSugestao[] = []

      for (let offset = 0; offset <= tolerancia && encontrados.length < limite; offset += 1) {
        const data = addDays(input.aPartirDe, input.emDias + offset)
        const horario = dataset.clinic.horarios.find((item) => item.weekday === weekdayOf(data))
        const feriado = dataset.clinic.feriados.find((item) => item.date === data) ?? null

        if (horario?.fechado || feriado?.fechado) {
          continue
        }

        const livres = slotsLivres(
          {
            petId: input.petId,
            typeId: input.typeId,
            duracaoMinutos,
            /** O retorno é com quem atendeu: continuidade vale mais que horário cedo. */
            professionalIds: [input.professionalId],
            roomIds: [],
            preferenciaMinutos: null,
            data,
          },
          {
            clinic: dataset.clinic,
            clock,
            data,
            atendimentos: atendimentosDoDia(data),
            bloqueios: materializarBloqueios(dataset.blocks, data, clock),
            tipos: appointmentTypesFixture,
            salas: roomsFixture,
            pets: dataset.pets,
            capacidadeMinutos: CAPACIDADE_MINUTOS_POR_PROFISSIONAL,
          },
          limite - encontrados.length,
        )

        encontrados.push(...livres)
      }

      return encontrados.slice(0, limite)
    })
  },

  criar(input: NovoAtendimento): Promise<MutacaoAgenda> {
    return simularChamada('agenda.criar', () => {
      const dataset = getDataset()
      const novo = atendimentoNovo(input, agoraIso())

      /** Nada a restaurar: desfazer de uma criação é apagar. */
      const token = novoId('undo')

      desfazerPorToken.set(token, () => {
        const dados = getDataset()
        dados.appointments = dados.appointments.filter((item) => item.id !== novo.id)
      })
      setTimeout(() => desfazerPorToken.delete(token), 30_000)

      dataset.appointments.push(novo)

      return { atendimentos: [novo], undoToken: token }
    })
  },

  /**
   * Move o atendimento — e, quando ele pertence a um grupo ligado, move o grupo inteiro pelo
   * mesmo delta. A cirurgia que ocupa duas salas arrasta junto: separar as pernas produziria
   * uma sala reservada para um paciente que já saiu.
   */
  mover(
    id: string,
    destino: {
      inicio: ISODateTime
      fim: ISODateTime
      professionalId?: string
      /** Trocar de coluna no agrupamento por sala muda a sala, não quem atende. */
      roomIds?: string[]
    },
  ): Promise<MutacaoAgenda> {
    return simularChamada('agenda.mover', () => {
      const dataset = getDataset()
      const alvo = dataset.appointments.find((appointment) => appointment.id === id)

      if (!alvo) {
        throw new Error('agenda.mover: atendimento inexistente')
      }

      const grupo =
        alvo.linkedGroupId === null
          ? [alvo]
          : dataset.appointments.filter(
              (appointment) => appointment.linkedGroupId === alvo.linkedGroupId,
            )

      const token = registrarDesfazer(grupo)
      const delta = Date.parse(destino.inicio) - Date.parse(alvo.inicio)
      const agora = agoraIso()
      const movidos: Appointment[] = []

      for (const appointment of grupo) {
        const ehAlvo = appointment.id === alvo.id

        appointment.inicio = ehAlvo
          ? destino.inicio
          : deslocar(appointment.inicio, delta)
        appointment.fim = ehAlvo ? destino.fim : deslocar(appointment.fim, delta)

        if (ehAlvo && destino.professionalId) {
          appointment.professionalId = destino.professionalId
        }

        /*
         * Só o alvo troca de sala. O par ligado (a recuperação de uma cirurgia) acompanha o
         * horário, nunca a sala — é justamente por estar em outra sala que ele existe.
         */
        if (ehAlvo && destino.roomIds) {
          appointment.roomIds = [...destino.roomIds]
        }

        appointment.atualizadoEm = agora
        movidos.push({ ...appointment })
      }

      return { atendimentos: movidos, undoToken: token }
    })
  },

  /**
   * Edição de um atendimento que já existe.
   *
   * Até aqui só dava para **mover** (arraste) e **cancelar**. Tipo, sala e observação eram
   * imutáveis: marcou "Consulta" quando era "Retorno", o único caminho era cancelar e criar de
   * novo — o que dispara aviso de cancelamento para quem não teve atendimento nenhum cancelado,
   * e parte o histórico do paciente em dois registros para um atendimento só.
   *
   * O paciente fica de fora de propósito. Trocar quem é atendido não é editar este atendimento,
   * é criar outro: o tutor é diferente, o histórico é de outro bicho e o aviso vai para outro
   * telefone. Deixar isso num `Select` é convidar o engano que nenhuma tela desfaz depois.
   *
   * O grupo ligado acompanha o horário pelo mesmo delta de `mover`, e pela mesma razão: a
   * cirurgia que ocupa centro e recuperação não pode ter as pernas separadas no tempo. Já tipo,
   * sala e observação valem **só para o alvo** — é justamente por serem diferentes que as duas
   * pernas existem.
   */
  editar(
    id: string,
    dados: {
      typeId: string
      professionalId: string
      roomIds: string[]
      inicio: ISODateTime
      fim: ISODateTime
      observacao: string
    },
  ): Promise<MutacaoAgenda> {
    return simularChamada('agenda.editar', () => {
      const dataset = getDataset()
      const alvo = dataset.appointments.find((appointment) => appointment.id === id)

      if (!alvo) {
        throw new Error('agenda.editar: atendimento inexistente')
      }

      const grupo =
        alvo.linkedGroupId === null
          ? [alvo]
          : dataset.appointments.filter(
              (appointment) => appointment.linkedGroupId === alvo.linkedGroupId,
            )

      const token = registrarDesfazer(grupo)
      const delta = Date.parse(dados.inicio) - Date.parse(alvo.inicio)
      const agora = agoraIso()
      const alterados: Appointment[] = []

      for (const appointment of grupo) {
        const ehAlvo = appointment.id === alvo.id

        appointment.inicio = ehAlvo ? dados.inicio : deslocar(appointment.inicio, delta)
        appointment.fim = ehAlvo ? dados.fim : deslocar(appointment.fim, delta)

        if (ehAlvo) {
          appointment.typeId = dados.typeId
          appointment.professionalId = dados.professionalId
          appointment.roomIds = [...dados.roomIds]
          appointment.observacao = dados.observacao
        }

        appointment.atualizadoEm = agora
        alterados.push({ ...appointment })
      }

      return { atendimentos: alterados, undoToken: token }
    })
  },

  /**
   * Muda o status. Com `justificativa`, a falta já nasce com o motivo vinculado.
   *
   * O motivo entra **na mesma mutação** e não numa chamada seguinte, por causa do desfazer: duas
   * chamadas gerariam dois tokens, e o Z da recepção desfaria só o segundo — devolvendo um
   * atendimento em falta sem motivo, que é um estado que ninguém pediu.
   *
   * Ele continua opcional porque marcar falta e saber o porquê acontecem em momentos
   * diferentes: o horário passa às nove, a ligação sai à tarde. Ver `justificarFalta`.
   */
  alterarStatus(
    id: string,
    status: AppointmentStatus,
    justificativa?: EntradaDeJustificativa | null,
  ): Promise<MutacaoAgenda> {
    return simularChamada('agenda.status', () => {
      const dataset = getDataset()
      const alvo = dataset.appointments.find((appointment) => appointment.id === id)

      if (!alvo) {
        throw new Error('agenda.status: atendimento inexistente')
      }

      const token = registrarDesfazer([alvo])
      const agora = agoraIso()

      alvo.status = status
      alvo.atualizadoEm = agora

      if (status === 'falta' && justificativa) {
        alvo.justificativaDeFalta = montarJustificativa(justificativa, agora)
      }

      if (status === 'aguardando' && !alvo.chegadaEm) {
        alvo.chegadaEm = agora
      }

      if (status === 'em-atendimento' && !alvo.iniciadoEm) {
        alvo.iniciadoEm = agora
      }

      if (status === 'finalizado') {
        alvo.finalizadoEm = agora
      }

      return { atendimentos: [{ ...alvo }], undoToken: token }
    })
  },

  /**
   * Presença confirmada — pela recepção, que ligou e ouviu "vou, sim", ou pelo app, quando o
   * responsável toca "Confirmar" na véspera.
   *
   * O "por onde" viaja junto (`confirmacao.por`): confirmação dada no app às dez da noite e
   * confirmação arrancada numa ligação pesam diferente na hora de decidir se vale ligar de novo.
   * Só horário que ainda vai acontecer confirma; o resto é erro de quem chamou.
   */
  confirmarPresenca(id: string, por: ConfirmacaoDePresenca['por']): Promise<MutacaoAgenda> {
    return simularChamada('agenda.status', () => {
      const dataset = getDataset()
      const alvo = dataset.appointments.find((appointment) => appointment.id === id)

      if (!alvo) {
        throw new Error('agenda.confirmar: atendimento inexistente')
      }

      if (alvo.status !== 'agendado' && alvo.status !== 'confirmado') {
        throw new Error('agenda.confirmar: atendimento que já não vai acontecer')
      }

      const token = registrarDesfazer([alvo])
      const agora = agoraIso()

      alvo.status = 'confirmado'
      alvo.confirmacao = { em: agora, por }
      alvo.atualizadoEm = agora

      return { atendimentos: [{ ...alvo }], undoToken: token }
    })
  },

  /**
   * Registra por que o paciente não veio, depois que a falta já existe.
   *
   * É o caminho normal, e não a exceção: quem marca a falta é o horário que passou, quem
   * descobre o motivo é a ligação que sai depois. O status não é tocado aqui — justificar não
   * desfaz a falta, e confundir as duas coisas apagaria da conta da clínica um horário que
   * continua tendo sido queimado.
   *
   * Registrar de novo **sobrescreve**: a segunda ligação sabe mais que a primeira, e guardar as
   * duas transformaria a linha do painel numa thread que ninguém vai ler.
   */
  justificarFalta(id: string, entrada: EntradaDeJustificativa): Promise<MutacaoAgenda> {
    return simularChamada('agenda.status', () => {
      const dataset = getDataset()
      const alvo = dataset.appointments.find((appointment) => appointment.id === id)

      if (!alvo) {
        throw new Error('agenda.justificar: atendimento inexistente')
      }

      if (alvo.status !== 'falta') {
        throw new Error('agenda.justificar: atendimento não está em falta')
      }

      const token = registrarDesfazer([alvo])
      const agora = agoraIso()

      alvo.justificativaDeFalta = montarJustificativa(entrada, agora)
      alvo.atualizadoEm = agora

      return { atendimentos: [{ ...alvo }], undoToken: token }
    })
  },

  /**
   * Falta e cancelamento liberam o horário, mas o card **continua no dia**, com opacidade
   * reduzida e riscado. Sumir da grade é como a recepção perde a informação de que o horário
   * vagou.
   */
  cancelar(id: string, motivo: CancelReason): Promise<MutacaoAgenda> {
    return simularChamada('agenda.cancelar', () => {
      const dataset = getDataset()
      const alvo = dataset.appointments.find((appointment) => appointment.id === id)

      if (!alvo) {
        throw new Error('agenda.cancelar: atendimento inexistente')
      }

      const token = registrarDesfazer([alvo])

      alvo.status = 'cancelado'
      alvo.canceladoEm = agoraIso()
      alvo.motivoCancelamento = motivo
      alvo.atualizadoEm = alvo.canceladoEm

      return { atendimentos: [{ ...alvo }], undoToken: token }
    })
  },

  criarBloqueio(input: {
    professionalId: string | null
    roomId: string | null
    inicio: ISODateTime
    fim: ISODateTime
    motivo: BlockReason
    detalhe: string
    weekdaysRecorrentes: WeekdayIndex[] | null
  }): Promise<Block> {
    return simularChamada('agenda.bloqueio', () => {
      const dataset = getDataset()
      const bloqueio: Block = {
        id: novoId('bloco'),
        professionalId: input.professionalId,
        roomId: input.roomId,
        inicio: input.inicio,
        fim: input.fim,
        motivo: input.motivo,
        detalhe: input.detalhe,
        recorrencia: input.weekdaysRecorrentes
          ? { kind: 'weekly', weekdays: input.weekdaysRecorrentes, ate: null }
          : null,
        materializadoDe: null,
      }

      dataset.blocks.push(bloqueio)

      return bloqueio
    })
  },

  removerBloqueio(id: string): Promise<void> {
    return simularChamada('agenda.bloqueio', () => {
      const dataset = getDataset()
      /** Ocorrência materializada carrega o id original depois do `@`. */
      const alvo = id.includes('@') ? id.slice(0, id.indexOf('@')) : id

      dataset.blocks = dataset.blocks.filter((bloqueio) => bloqueio.id !== alvo)
    })
  },

  reservar(professionalId: string, inicio: ISODateTime, fim: ISODateTime): Promise<Hold> {
    return simularChamada('agenda.reserva', () =>
      criarReserva({ professionalId, inicio, fim }),
    )
  },

  liberar(holdId: string): Promise<void> {
    return simularChamada('agenda.reserva', () => {
      liberarReserva(holdId)
    })
  },

  reservasAtivas(): Hold[] {
    return listarReservas()
  },

  desfazer(token: string): Promise<boolean> {
    return simularChamada('agenda.status', () => {
      const restaurar = desfazerPorToken.get(token)

      if (!restaurar) {
        return false
      }

      restaurar()
      desfazerPorToken.delete(token)

      return true
    })
  },

  /** Dias com vaga próxima para o mesmo tipo — usado pela sugestão de remarcação. */
  proximosDias(data: ISODate, quantidade = 5): ISODate[] {
    return Array.from({ length: quantidade }, (_, index) => addDays(data, index + 1))
  },
}

function deslocar(iso: ISODateTime, deltaMs: number): ISODateTime {
  const wall = clock.toWall(iso)

  return clock.toIso(wall.date, wall.minutes + Math.round(deltaMs / 60_000))
}

