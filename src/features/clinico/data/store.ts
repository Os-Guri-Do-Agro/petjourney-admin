/**
 * Estado mutável em memória da camada mocada.
 *
 * É o "banco" do módulo: os repositórios leem e escrevem aqui, e nada mais no app conhece
 * este arquivo. Trocar por HTTP é substituir os repositórios, não a interface.
 */

import { createClinicClock } from '../domain/clinic-time'

import { CLINIC_UTC_OFFSET } from './fixtures'
import { gerarDataset, SEMENTE_PADRAO, type SeedResult } from './seed'
import type { Hold, ISODateTime } from './types'

const clock = createClinicClock(CLINIC_UTC_OFFSET)

let dataset: SeedResult | null = null
let holds: Hold[] = []
let sementeAtual = SEMENTE_PADRAO
let sequencia = 0

export function getDataset(): SeedResult {
  if (!dataset) {
    dataset = gerarDataset(sementeAtual)
  }

  return dataset
}

/** Recria o dataset inteiro. O painel usa para voltar ao ponto zero sem recarregar a página. */
export function resetDataset(semente: number = sementeAtual): SeedResult {
  sementeAtual = semente
  dataset = gerarDataset(semente)
  holds = []
  sequencia = 0

  return dataset
}

export function getSemente() {
  return sementeAtual
}

/** Identificador estável e sequencial — nada de `Math.random` em id de registro. */
export function novoId(prefixo: string): string {
  sequencia += 1

  return `${prefixo}-${sequencia.toString(36)}-${getDataset().ancora.replace(/-/g, '')}`
}

export function agoraIso(): ISODateTime {
  return clock.nowIso()
}

// ---------------------------------------------------------------------------
// Reservas provisórias
// ---------------------------------------------------------------------------

export const HOLD_DURACAO_MINUTOS = 5

/**
 * A reserva provisória precisa ser devolvida. Se ela nascer ao escolher o horário e ninguém
 * chamar `liberarReserva`, voltar da confirmação deixa o horário preso, invisível para a
 * clínica e para os outros. Toda leitura já limpa o que expirou, para que um bug de tela não
 * vire horário perdido para sempre.
 */
export function listarReservas(): Hold[] {
  const agora = Date.parse(agoraIso())

  holds = holds.filter((hold) => Date.parse(hold.expiraEm) > agora)

  return [...holds]
}

export function criarReserva(hold: Omit<Hold, 'id' | 'expiraEm'>): Hold {
  listarReservas()

  const agora = clock.now()
  const novo: Hold = {
    ...hold,
    id: novoId('hold'),
    expiraEm: clock.toIso(agora.date, agora.minutes + HOLD_DURACAO_MINUTOS),
  }

  holds.push(novo)

  return novo
}

export function liberarReserva(id: string) {
  holds = holds.filter((hold) => hold.id !== id)
}

export function liberarTodasAsReservas() {
  holds = []
}
