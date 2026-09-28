/**
 * As regras de prazo que o app do responsável obedece e o portal mostra.
 *
 * Moram num lugar só porque **o relógio é um só**. Se o app calculasse "ainda dá para cancelar"
 * por conta própria e a API por outra, o botão apareceria e a API recusaria — o pior tipo de
 * erro, porque a pessoa fez tudo certo. No contrato, o servidor manda `podeCancelar` e
 * `cancelarAte` prontos; aqui é onde o mock do portal os calcula, com a mesma regra que a API
 * vai ter.
 *
 * A política é da clínica (`PoliticaDaClinica`, no contrato): quantas horas antes se cancela
 * pelo app, quando a pré-consulta abre, quanto dura a oferta de vaga. Nada disso é número solto
 * na tela.
 */

import type { PoliticaDaClinica, ResumoDaPreConsulta } from '../contrato/responsavel'
import type { Appointment, ISODateTime, PreConsulta } from '../data/types'

import { epochToWall, wallToIso } from './clinic-time'
import { ocupaHorario } from './conflicts'

const HORA_MS = 60 * 60 * 1000

/** Enquanto o horário ainda não começou, estes são os estados em que o responsável mexe nele. */
const AINDA_POR_ACONTECER: Appointment['status'][] = ['agendado', 'confirmado']

function menosHoras(iso: ISODateTime, horas: number, utcOffset: string): ISODateTime {
  return wallToIso(epochToWall(Date.parse(iso) - horas * HORA_MS, utcOffset), utcOffset)
}

/**
 * Até quando o responsável cancela ou remarca pelo app. `null` quando a pergunta já não se
 * aplica — horário que aconteceu, faltou ou foi cancelado.
 */
export function cancelarAte(
  appointment: Appointment,
  politica: PoliticaDaClinica,
  utcOffset: string,
): ISODateTime | null {
  if (!AINDA_POR_ACONTECER.includes(appointment.status)) {
    return null
  }

  return menosHoras(appointment.inicio, politica.cancelarAteHorasAntes, utcOffset)
}

/**
 * Depois do prazo, só por telefone. Não é castigo: é o horário que a clínica já não consegue
 * reaproveitar, e a ligação é onde se combina o que fazer com ele.
 */
export function podeCancelarPeloApp(
  appointment: Appointment,
  politica: PoliticaDaClinica,
  agora: ISODateTime,
  utcOffset: string,
): boolean {
  const limite = cancelarAte(appointment, politica, utcOffset)

  return limite !== null && Date.parse(agora) < Date.parse(limite)
}

/** Quanto antes do horário a confirmação de presença abre: a véspera, com folga para o sábado. */
export const CONFIRMACAO_ABRE_HORAS_ANTES = 48

/**
 * Confirmar é para horário marcado que ainda não foi confirmado, perto o bastante para a
 * confirmação dizer alguma coisa. Confirmar um horário de daqui a três semanas não confirma
 * nada — a vida muda até lá.
 */
export function podeConfirmarPresenca(appointment: Appointment, agora: ISODateTime): boolean {
  if (appointment.status !== 'agendado') {
    return false
  }

  const faltam = Date.parse(appointment.inicio) - Date.parse(agora)

  return faltam > 0 && faltam <= CONFIRMACAO_ABRE_HORAS_ANTES * HORA_MS
}

export function janelaDaPreConsulta(
  appointment: Appointment,
  politica: PoliticaDaClinica,
  utcOffset: string,
): { abreEm: ISODateTime; fechaEm: ISODateTime } {
  return {
    abreEm: menosHoras(appointment.inicio, politica.preConsultaAbreHorasAntes, utcOffset),
    /* Fecha quando a consulta começa: dali em diante, quem pergunta é o vet, na sala. */
    fechaEm: appointment.inicio,
  }
}

/**
 * Onde está a pré-consulta deste horário.
 *
 * `FECHADA` ganha de `RESPONDIDA` depois que a consulta começa: a resposta continua existindo
 * (e o vet a vê), mas o responsável já não edita — a conversa agora é na sala.
 */
export function situacaoDaPreConsulta(
  appointment: Appointment,
  preConsulta: PreConsulta | null,
  politica: PoliticaDaClinica,
  agora: ISODateTime,
  utcOffset: string,
): ResumoDaPreConsulta['situacao'] {
  const { abreEm, fechaEm } = janelaDaPreConsulta(appointment, politica, utcOffset)
  const instante = Date.parse(agora)

  if (!AINDA_POR_ACONTECER.includes(appointment.status) || instante >= Date.parse(fechaEm)) {
    return 'FECHADA'
  }

  if (instante < Date.parse(abreEm)) {
    return 'AINDA_NAO_ABRIU'
  }

  return preConsulta ? 'RESPONDIDA' : 'ABERTA'
}

/**
 * A vaga ainda está livre para quem aceitou a oferta?
 *
 * O aceite chega minutos depois da oferta, e nesse meio-tempo a recepção pode ter encaixado
 * alguém no balcão. Profissional ocupado ou o próprio pet já marcado no mesmo intervalo: a vaga
 * não serve mais, e o aceite precisa dizer isso em vez de criar um conflito na grade.
 */
export function vagaLivre(
  appointments: Appointment[],
  vaga: { professionalId: string; petId: string; inicio: ISODateTime; fim: ISODateTime },
): boolean {
  const inicio = Date.parse(vaga.inicio)
  const fim = Date.parse(vaga.fim)

  return !appointments.some(
    (appointment) =>
      ocupaHorario(appointment) &&
      (appointment.professionalId === vaga.professionalId || appointment.petId === vaga.petId) &&
      Date.parse(appointment.inicio) < fim &&
      inicio < Date.parse(appointment.fim),
  )
}
