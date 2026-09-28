/**
 * Repositório da fila de espera.
 *
 * A fila só ganha sentido se a vaga que abriu chegar até ela: cancelar, remover bloqueio ou
 * marcar falta são os três eventos que produzem oferta. Quem liga esses fios é o store, mas o
 * cálculo de quem é elegível para um horário vive aqui.
 */

import { createClinicClock, clockToMinutes, weekdayOf } from '../../domain/clinic-time'
import { vagaLivre } from '../../domain/politica'
import {
  appointmentTypesFixture,
  CLINIC_UTC_OFFSET,
  politicaDaClinicaFixture,
  professionalsFixture,
  roomsFixture,
} from '../fixtures'
import { simularChamada } from '../mock-runtime'
import { agoraIso, getDataset, novoId } from '../store'
import type {
  Appointment,
  ConfirmacaoDePresenca,
  ISODateTime,
  WaitlistEntry,
  WaitlistPriority,
} from '../types'

const clock = createClinicClock(CLINIC_UTC_OFFSET)

const PESO_PRIORIDADE: Record<WaitlistPriority, number> = {
  urgente: 0,
  preferencial: 1,
  normal: 2,
}

/** O prazo da oferta é da clínica (`PoliticaDaClinica`). Exportado para a mensagem da oferta. */
export const OFERTA_MINUTOS = politicaDaClinicaFixture.ofertaDeVagaMinutos

/** O prazo da oferta passou antes do aceite. A vaga voltou para a clínica. */
export class OfertaExpiradaError extends Error {
  constructor() {
    super('[mock] a oferta de vaga expirou antes do aceite')
    this.name = 'OfertaExpiradaError'
  }
}

/**
 * A vaga foi ocupada entre a oferta e o aceite — a recepção encaixou alguém no balcão. O aceite
 * não cria o horário por cima: devolve a entrada à fila, na mesma posição.
 */
export class VagaJaPreenchidaError extends Error {
  constructor() {
    super('[mock] a vaga oferecida já foi preenchida')
    this.name = 'VagaJaPreenchidaError'
  }
}

/** A sala do profissional, quando serve ao tipo; senão, a primeira que serve. */
function salaPara(professionalId: string, typeId: string): string[] {
  const tipo = appointmentTypesFixture.find((item) => item.id === typeId)
  const salaPadraoId = professionalsFixture.find((item) => item.id === professionalId)?.salaPadraoId
  const propria = roomsFixture.find((room) => room.id === salaPadraoId)

  if (!tipo || tipo.salasCompativeis.length === 0) {
    return propria ? [propria.id] : []
  }

  if (propria && tipo.salasCompativeis.includes(propria.kind)) {
    return [propria.id]
  }

  const compativel = roomsFixture.find((room) => tipo.salasCompativeis.includes(room.kind))

  return compativel ? [compativel.id] : []
}

function expirarOfertasVencidas(): WaitlistEntry[] {
  const dataset = getDataset()
  const agora = agoraIso()

  for (const entrada of dataset.waitlist) {
    if (
      entrada.status === 'ofertado' &&
      entrada.ofertaExpiraEm !== null &&
      entrada.ofertaExpiraEm <= agora
    ) {
      entrada.status = 'expirado'
    }
  }

  return dataset.waitlist
}

export const waitlistRepository = {
  listar(): Promise<WaitlistEntry[]> {
    return simularChamada('fila.listar', () =>
      [...expirarOfertasVencidas()].sort(
        (a, b) =>
          PESO_PRIORIDADE[a.prioridade] - PESO_PRIORIDADE[b.prioridade] ||
          a.criadoEm.localeCompare(b.criadoEm),
      ),
    )
  },

  /**
   * Quem cabe num horário que acabou de vagar: janela do responsável compatível, profissional
   * compatível e ainda aguardando. A ordem é prioridade e depois antiguidade — quem espera há
   * mais tempo não perde a vez para quem entrou hoje.
   */
  elegiveisPara(inicio: ISODateTime, professionalId: string): Promise<WaitlistEntry[]> {
    return simularChamada('fila.listar', () => {
      const wall = clock.toWall(inicio)
      const weekday = weekdayOf(wall.date)

      return expirarOfertasVencidas()
        .filter((entrada) => entrada.status === 'aguardando')
        .filter(
          (entrada) => entrada.professionalId === null || entrada.professionalId === professionalId,
        )
        .filter((entrada) =>
          entrada.janelas.some(
            (janela) =>
              janela.weekday === weekday &&
              wall.minutes >= clockToMinutes(janela.inicio) &&
              wall.minutes < clockToMinutes(janela.fim),
          ),
        )
        .sort(
          (a, b) =>
            PESO_PRIORIDADE[a.prioridade] - PESO_PRIORIDADE[b.prioridade] ||
            a.criadoEm.localeCompare(b.criadoEm),
        )
    })
  },

  ofertar(id: string, slotInicio: ISODateTime, professionalId: string): Promise<WaitlistEntry> {
    return simularChamada('fila.ofertar', () => {
      const dataset = getDataset()
      const entrada = dataset.waitlist.find((item) => item.id === id)

      if (!entrada) {
        throw new Error(`fila.ofertar: entrada ${id} inexistente`)
      }

      const agora = clock.now()

      entrada.status = 'ofertado'
      entrada.ofertaSlotInicio = slotInicio
      entrada.ofertaProfessionalId = professionalId
      entrada.ofertaExpiraEm = clock.toIso(
        agora.date,
        agora.minutes + dataset.politica.ofertaDeVagaMinutos,
      )

      return { ...entrada }
    })
  },

  /**
   * A resposta do responsável à oferta — pela recepção, que registra o que ouviu no telefone,
   * ou pelo app, quando ele toca "Aceitar".
   *
   * **Aceitar cria o horário.** Antes o aceite só mudava o status da entrada, e a vaga continuava
   * vazia na grade até alguém lembrar de marcar à mão: a fila fechava sem fechar o ciclo. Agora
   * o atendimento nasce com origem `fila` e já confirmado — quem acabou de aceitar uma vaga
   * confirmou presença no mesmo gesto.
   *
   * Duas recusas de verdade, que a tela precisa distinguir: a oferta venceu
   * (`OfertaExpiradaError`) ou a vaga foi ocupada no meio-tempo (`VagaJaPreenchidaError`). Na
   * segunda, a entrada volta a aguardar sem perder a vez.
   */
  responder(
    id: string,
    aceitou: boolean,
    por: ConfirmacaoDePresenca['por'] = 'recepcao',
  ): Promise<{ entrada: WaitlistEntry; atendimento: Appointment | null }> {
    return simularChamada('fila.ofertar', () => {
      const dataset = getDataset()
      const entrada = dataset.waitlist.find((item) => item.id === id)

      if (!entrada) {
        throw new Error(`fila.responder: entrada ${id} inexistente`)
      }

      if (!aceitou) {
        entrada.status = 'aguardando'
        entrada.ofertaExpiraEm = null
        entrada.ofertaSlotInicio = null
        entrada.ofertaProfessionalId = null

        return { entrada: { ...entrada }, atendimento: null }
      }

      const agora = agoraIso()
      const vencida =
        entrada.ofertaExpiraEm !== null && Date.parse(entrada.ofertaExpiraEm) <= Date.parse(agora)

      if (entrada.status !== 'ofertado' || !entrada.ofertaSlotInicio || vencida) {
        if (entrada.status === 'ofertado') {
          entrada.status = 'expirado'
        }

        throw new OfertaExpiradaError()
      }

      const professionalId = entrada.ofertaProfessionalId ?? entrada.professionalId
      const tipo = appointmentTypesFixture.find((item) => item.id === entrada.typeId)

      if (!professionalId || !tipo) {
        throw new Error(`fila.responder: oferta ${id} sem profissional ou tipo`)
      }

      const inicio = entrada.ofertaSlotInicio
      const fim = clock.toIso(clock.dateOf(inicio), clock.minutesOf(inicio) + tipo.duracaoMinutos)
      const vaga = { professionalId, petId: entrada.petId, inicio, fim }

      if (!vagaLivre(dataset.appointments, vaga)) {
        entrada.status = 'aguardando'
        entrada.ofertaExpiraEm = null
        entrada.ofertaSlotInicio = null
        entrada.ofertaProfessionalId = null

        throw new VagaJaPreenchidaError()
      }

      const atendimento: Appointment = {
        id: novoId('apt'),
        petId: entrada.petId,
        tutorId: entrada.tutorId,
        professionalId,
        roomIds: salaPara(professionalId, tipo.id),
        typeId: tipo.id,
        inicio,
        fim,
        status: 'confirmado',
        origem: 'fila',
        encaixe: false,
        observacao: entrada.observacao,
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
        confirmacao: { em: agora, por },
      }

      dataset.appointments.push(atendimento)
      entrada.status = 'aceito'
      entrada.appointmentId = atendimento.id

      return { entrada: { ...entrada }, atendimento: { ...atendimento } }
    })
  },

  remover(id: string): Promise<void> {
    return simularChamada('fila.ofertar', () => {
      const entrada = getDataset().waitlist.find((item) => item.id === id)

      if (entrada) {
        entrada.status = 'removido'
      }
    })
  },

  adicionar(
    input: Omit<
      WaitlistEntry,
      | 'id'
      | 'status'
      | 'criadoEm'
      | 'ofertaExpiraEm'
      | 'ofertaSlotInicio'
      | 'ofertaProfessionalId'
      | 'appointmentId'
    >,
  ): Promise<WaitlistEntry> {
    return simularChamada('fila.ofertar', () => {
      const entrada: WaitlistEntry = {
        ...input,
        id: novoId('fila'),
        status: 'aguardando',
        criadoEm: agoraIso(),
        ofertaExpiraEm: null,
        ofertaSlotInicio: null,
      }

      getDataset().waitlist.push(entrada)

      return entrada
    })
  },
}
