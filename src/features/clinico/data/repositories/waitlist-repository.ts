/**
 * Repositório da fila de espera.
 *
 * A fila só ganha sentido se a vaga que abriu chegar até ela: cancelar, remover bloqueio ou
 * marcar falta são os três eventos que produzem oferta. Quem liga esses fios é o store, mas o
 * cálculo de quem é elegível para um horário vive aqui.
 */

import { createClinicClock, clockToMinutes, weekdayOf } from '../../domain/clinic-time'
import { CLINIC_UTC_OFFSET } from '../fixtures'
import { simularChamada } from '../mock-runtime'
import { agoraIso, getDataset, novoId } from '../store'
import type { ISODateTime, WaitlistEntry, WaitlistPriority } from '../types'

const clock = createClinicClock(CLINIC_UTC_OFFSET)

const PESO_PRIORIDADE: Record<WaitlistPriority, number> = {
  urgente: 0,
  preferencial: 1,
  normal: 2,
}

export const OFERTA_MINUTOS = 30

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

  ofertar(id: string, slotInicio: ISODateTime): Promise<WaitlistEntry> {
    return simularChamada('fila.ofertar', () => {
      const entrada = getDataset().waitlist.find((item) => item.id === id)

      if (!entrada) {
        throw new Error(`fila.ofertar: entrada ${id} inexistente`)
      }

      const agora = clock.now()

      entrada.status = 'ofertado'
      entrada.ofertaSlotInicio = slotInicio
      entrada.ofertaExpiraEm = clock.toIso(agora.date, agora.minutes + OFERTA_MINUTOS)

      return { ...entrada }
    })
  },

  responder(id: string, aceitou: boolean): Promise<WaitlistEntry> {
    return simularChamada('fila.ofertar', () => {
      const entrada = getDataset().waitlist.find((item) => item.id === id)

      if (!entrada) {
        throw new Error(`fila.responder: entrada ${id} inexistente`)
      }

      if (aceitou) {
        entrada.status = 'aceito'
      } else {
        entrada.status = 'aguardando'
        entrada.ofertaExpiraEm = null
        entrada.ofertaSlotInicio = null
      }

      return { ...entrada }
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

  adicionar(input: Omit<WaitlistEntry, 'id' | 'status' | 'criadoEm' | 'ofertaExpiraEm' | 'ofertaSlotInicio'>): Promise<WaitlistEntry> {
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
