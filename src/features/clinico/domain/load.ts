/**
 * Carga da agenda: quanto do dia já está comprometido.
 *
 * A ocupação sai como número, não só como barra: em escala de cinza uma barra sozinha não
 * diz nada, e a visão de semana precisa ser lida de relance.
 */

import type {
  Appointment,
  CargaDoProfissional,
  Clinic,
  DiaCarga,
  ISODate,
  NoShowSummary,
  Professional,
} from '../data/types'

import { clockToMinutes, type ClinicClock, weekdayOf } from './clinic-time'
import { ocupaHorario } from './conflicts'

/**
 * Capacidade diária por profissional acima da qual a carga vira aviso.
 *
 * Mora no domínio porque tanto a store quanto o repositório precisam dela — e repositório
 * importando store seria a camada de dados dependendo da de apresentação.
 */
export const CAPACIDADE_MINUTOS_POR_PROFISSIONAL = 8 * 60

export function capacidadeDoDia(
  clinic: Clinic,
  data: ISODate,
  profissionais: Professional[],
): number {
  const horario = clinic.horarios.find((item) => item.weekday === weekdayOf(data))

  if (!horario || horario.fechado) {
    return 0
  }

  const bruto = clockToMinutes(horario.expediente.fim) - clockToMinutes(horario.expediente.inicio)
  const almoco = horario.almoco
    ? clockToMinutes(horario.almoco.fim) - clockToMinutes(horario.almoco.inicio)
    : 0

  return Math.max(0, bruto - almoco) * Math.max(1, profissionais.length)
}

export function cargaDoDia(
  data: ISODate,
  atendimentos: Appointment[],
  clinic: Clinic,
  profissionais: Professional[],
  clock: ClinicClock,
): DiaCarga {
  const doDia = atendimentos.filter((appointment) => clock.dateOf(appointment.inicio) === data)
  const ocupado = doDia
    .filter(ocupaHorario)
    .reduce(
      (total, appointment) => total + clock.durationMinutes(appointment.inicio, appointment.fim),
      0,
    )

  const capacidade = capacidadeDoDia(clinic, data, profissionais)
  /** Capacidade de **uma** coluna: o total é dela vezes o número de profissionais. */
  const porPessoa = profissionais.length > 0 ? capacidade / profissionais.length : 0

  return {
    data,
    agendados: doDia.filter(ocupaHorario).length,
    capacidadeMinutos: capacidade,
    ocupadoMinutos: ocupado,
    ocupacao: capacidade > 0 ? Math.min(ocupado / capacidade, 2) : 0,
    faltas: doDia.filter((appointment) => appointment.status === 'falta').length,
    encaixes: doDia.filter((appointment) => appointment.encaixe && ocupaHorario(appointment)).length,
    porProfissional: cargaPorProfissional(doDia, profissionais, porPessoa, clock),
  }
}

/** Meio-dia divide manhã e tarde. Não é regra clínica: é como a pergunta chega no balcão. */
const MEIO_DIA_EM_MINUTOS = 12 * 60

/**
 * Ocupação de cada profissional no dia, e dentro dele por período.
 *
 * O período sai do **início** do atendimento, não do intervalo que ele cobre. Uma cirurgia que
 * começa 11h30 e vai até 14h conta inteira na manhã, e é assim que quem atende no balcão a
 * enxerga: "a Ana está em cirurgia desde a manhã". Ratear o bloco entre os dois períodos daria
 * um número mais exato e uma resposta pior.
 */
function cargaPorProfissional(
  doDia: Appointment[],
  profissionais: Professional[],
  capacidadePorPessoa: number,
  clock: ClinicClock,
): CargaDoProfissional[] {
  return profissionais.map((professional) => {
    const seus = doDia.filter(
      (appointment) => appointment.professionalId === professional.id && ocupaHorario(appointment),
    )

    let ocupado = 0
    let manha = 0
    let tarde = 0

    for (const appointment of seus) {
      const minutos = clock.durationMinutes(appointment.inicio, appointment.fim)

      ocupado += minutos

      if (clock.minutesOf(appointment.inicio) < MEIO_DIA_EM_MINUTOS) {
        manha += minutos
      } else {
        tarde += minutos
      }
    }

    const proporcao = (valor: number) =>
      capacidadePorPessoa > 0 ? Math.min(valor / capacidadePorPessoa, 2) : 0

    return {
      professionalId: professional.id,
      agendados: seus.length,
      ocupadoMinutos: ocupado,
      ocupacao: proporcao(ocupado),
      /*
       * Manhã e tarde comparam contra **meio** expediente cada, não contra o dia inteiro —
       * senão uma manhã lotada apareceria como 50% e pareceria haver espaço.
       */
      ocupacaoManha: capacidadePorPessoa > 0 ? Math.min(manha / (capacidadePorPessoa / 2), 2) : 0,
      ocupacaoTarde: capacidadePorPessoa > 0 ? Math.min(tarde / (capacidadePorPessoa / 2), 2) : 0,
    }
  })
}

export type FaixaOcupacao = 'vazio' | 'tranquilo' | 'cheio' | 'excedido'

export function faixaDeOcupacao(ocupacao: number): FaixaOcupacao {
  if (ocupacao <= 0) {
    return 'vazio'
  }

  if (ocupacao < 0.7) {
    return 'tranquilo'
  }

  if (ocupacao <= 1) {
    return 'cheio'
  }

  return 'excedido'
}

/**
 * Resumo de faltas por responsável e paciente. O painel mostra quantas **e quanto**: a
 * conversa com o responsável muda quando a clínica sabe quantos minutos de agenda ficaram
 * parados.
 */
export function resumirFaltas(
  atendimentos: Appointment[],
  clock: ClinicClock,
  limiteReincidencia: number,
): NoShowSummary[] {
  const porChave = new Map<string, NoShowSummary>()

  for (const appointment of atendimentos) {
    if (appointment.status !== 'falta') {
      continue
    }

    const chave = `${appointment.tutorId}|${appointment.petId}`
    const atual = porChave.get(chave) ?? {
      tutorId: appointment.tutorId,
      petId: appointment.petId,
      faltas: 0,
      minutosPerdidos: 0,
      ultimaFaltaEm: null,
      reincidente: false,
    }

    atual.faltas += 1
    atual.minutosPerdidos += clock.durationMinutes(appointment.inicio, appointment.fim)

    if (!atual.ultimaFaltaEm || appointment.inicio > atual.ultimaFaltaEm) {
      atual.ultimaFaltaEm = appointment.inicio
    }

    atual.reincidente = atual.faltas >= limiteReincidencia
    porChave.set(chave, atual)
  }

  return [...porChave.values()].sort(
    (a, b) => b.faltas - a.faltas || b.minutosPerdidos - a.minutosPerdidos,
  )
}
