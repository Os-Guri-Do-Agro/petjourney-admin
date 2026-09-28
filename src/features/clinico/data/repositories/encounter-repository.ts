/**
 * Repositório do prontuário.
 *
 * Duas regras vivem aqui e não na tela:
 * 1. **Um dispositivo edita por vez.** O segundo entra em leitura e precisa de transferência
 *    explícita — nada de dois profissionais gravando por cima do outro em silêncio.
 * 2. **`versao` incrementa a cada gravação.** É o que permite comparar campo a campo quando
 *    o segundo dispositivo assume a edição.
 */

import { createClinicClock } from '../../domain/clinic-time'
import { CLINIC_UTC_OFFSET } from '../fixtures'
import { simularChamada } from '../mock-runtime'
import { encounterVazio } from '../seed'
import { agoraIso, getDataset, novoId } from '../store'
import type {
  Encounter,
  EncounterLock,
  EncounterPatch,
  TimelineEvent,
} from '../types'

const clock = createClinicClock(CLINIC_UTC_OFFSET)

export class EncounterLockedError extends Error {
  readonly lock: EncounterLock

  constructor(lock: EncounterLock) {
    super('encounter.salvar: em edição por outro dispositivo')
    this.name = 'EncounterLockedError'
    this.lock = lock
  }
}

function encontrar(encounterId: string): Encounter {
  const encounter = getDataset().encounters.find((item) => item.id === encounterId)

  if (!encounter) {
    throw new Error(`encounter: ${encounterId} inexistente`)
  }

  return encounter
}

export const encounterRepository = {
  /** Abre o prontuário do atendimento, criando o registro em rascunho na primeira vez. */
  abrir(appointmentId: string, device: EncounterLock): Promise<Encounter> {
    return simularChamada('encounter.abrir', () => {
      const dataset = getDataset()
      const appointment = dataset.appointments.find((item) => item.id === appointmentId)

      if (!appointment) {
        throw new Error(`encounter.abrir: atendimento ${appointmentId} inexistente`)
      }

      let encounter = dataset.encounters.find((item) => item.appointmentId === appointmentId)

      if (!encounter) {
        encounter = encounterVazio(appointment, agoraIso())
        dataset.encounters.push(encounter)
        appointment.encounterId = encounter.id
      }

      if (encounter.status === 'rascunho' && !encounter.lock) {
        encounter.lock = device
      }

      return { ...encounter }
    })
  },

  obter(encounterId: string): Promise<Encounter> {
    return simularChamada('encounter.abrir', () => ({ ...encontrar(encounterId) }))
  },

  /**
   * Autosave. **Não invalida nada**: gravar direto no registro em edição é o que impede a
   * tela de piscar a cada pausa de digitação.
   */
  salvar(encounterId: string, patch: EncounterPatch, deviceId: string): Promise<Encounter> {
    return simularChamada('encounter.salvar', () => {
      const encounter = encontrar(encounterId)

      if (encounter.lock && encounter.lock.deviceId !== deviceId) {
        throw new EncounterLockedError(encounter.lock)
      }

      Object.assign(encounter, patch)
      encounter.versao += 1

      return { ...encounter }
    })
  },

  /** Transferência explícita da edição: o segundo dispositivo só assume quando alguém manda. */
  assumirEdicao(encounterId: string, device: EncounterLock): Promise<Encounter> {
    return simularChamada('encounter.salvar', () => {
      const encounter = encontrar(encounterId)

      encounter.lock = device

      return { ...encounter }
    })
  },

  liberarEdicao(encounterId: string, deviceId: string): Promise<void> {
    return simularChamada('encounter.salvar', () => {
      const encounter = encontrar(encounterId)

      if (encounter.lock?.deviceId === deviceId) {
        encounter.lock = null
      }
    })
  },

  /**
   * Libera o resumo do atendimento para o responsável ver no app.
   *
   * Passo separado de finalizar: finalizar fecha o prontuário, que é da clínica; liberar entrega
   * ao responsável o que ele leva para casa. Só atendimento finalizado libera — resumo de
   * consulta ainda aberta mudaria na mão de quem já leu. Liberar de novo não muda o instante: o
   * responsável já foi avisado da primeira vez.
   */
  liberarResumo(encounterId: string): Promise<Encounter> {
    return simularChamada('encounter.salvar', () => {
      const encounter = encontrar(encounterId)

      if (encounter.status !== 'finalizado') {
        throw new Error('encounter.liberarResumo: atendimento ainda não finalizado')
      }

      encounter.resumoLiberadoEm ??= agoraIso()

      return { ...encounter }
    })
  },

  finalizar(encounterId: string): Promise<Encounter> {
    return simularChamada('encounter.finalizar', () => {
      const dataset = getDataset()
      const encounter = encontrar(encounterId)

      encounter.status = 'finalizado'
      encounter.finalizadoEm = agoraIso()
      encounter.lock = null
      encounter.versao += 1

      const appointment = dataset.appointments.find(
        (item) => item.id === encounter.appointmentId,
      )

      if (appointment && appointment.status !== 'cancelado') {
        appointment.status = 'finalizado'
        appointment.finalizadoEm = encounter.finalizadoEm
      }

      const evento: TimelineEvent = {
        id: novoId('tl'),
        petId: encounter.petId,
        kind: 'consulta',
        em: encounter.finalizadoEm,
        titulo: encounter.diagnosticos[0]?.descricao ?? encounter.anamnese.queixaPrincipal,
        resumo: encounter.conduta.orientacoes,
        encounterId: encounter.id,
        appointmentId: encounter.appointmentId,
      }

      dataset.timeline = [evento, ...dataset.timeline]

      return { ...encounter }
    })
  },

  /**
   * A consulta anterior do mesmo paciente. O retorno abre mostrando ela ao lado: sem isso o
   * profissional relê o histórico inteiro para lembrar o que prescreveu há duas semanas.
   */
  consultaAnterior(petId: string, antesDe: string): Promise<Encounter | null> {
    return simularChamada('encounter.abrir', () => {
      const anteriores = getDataset()
        .encounters.filter(
          (encounter) =>
            encounter.petId === petId &&
            encounter.status === 'finalizado' &&
            (encounter.finalizadoEm ?? encounter.abertoEm) < antesDe,
        )
        .sort((a, b) =>
          (b.finalizadoEm ?? b.abertoEm).localeCompare(a.finalizadoEm ?? a.abertoEm),
        )

      const anterior = anteriores[0]

      return anterior ? { ...anterior } : null
    })
  },

  historico(petId: string): Promise<TimelineEvent[]> {
    return simularChamada('paciente.historico', () =>
      getDataset()
        .timeline.filter((evento) => evento.petId === petId)
        .sort((a, b) => b.em.localeCompare(a.em)),
    )
  },

  listarRascunhos(professionalId: string | null): Promise<Encounter[]> {
    return simularChamada('encounter.abrir', () =>
      getDataset().encounters.filter(
        (encounter) =>
          encounter.status === 'rascunho' &&
          (professionalId === null || encounter.professionalId === professionalId),
      ),
    )
  },

  /**
   * Prontuários finalizados com retorno indicado e **sem horário marcado**.
   *
   * Consulta própria, sem limite, de propósito: antes as telas pediam "os N mais recentes" e
   * filtravam depois, então um retorno combinado há três semanas — justamente o mais atrasado —
   * caía fora da janela e a pendência sumia. Pendência que envelhece até desaparecer é a pior
   * espécie de pendência.
   */
  listarRetornosPendentes(): Promise<Encounter[]> {
    return simularChamada('encounter.abrir', () =>
      getDataset()
        .encounters.filter(
          (encounter) =>
            encounter.status === 'finalizado' &&
            encounter.conduta.retorno.emDias !== null &&
            encounter.conduta.retorno.appointmentId === null,
        )
        .sort((a, b) =>
          (a.finalizadoEm ?? a.abertoEm).localeCompare(b.finalizadoEm ?? b.abertoEm),
        ),
    )
  },

  /** Prontuários finalizados, do mais recente para o mais antigo. */
  listarFinalizados(limite = 40): Promise<Encounter[]> {
    return simularChamada('encounter.abrir', () =>
      getDataset()
        .encounters.filter((encounter) => encounter.status === 'finalizado')
        .sort((a, b) =>
          (b.finalizadoEm ?? b.abertoEm).localeCompare(a.finalizadoEm ?? a.abertoEm),
        )
        .slice(0, limite),
    )
  },

  dataDe(encounter: Encounter) {
    return clock.dateOf(encounter.finalizadoEm ?? encounter.abertoEm)
  },
}
