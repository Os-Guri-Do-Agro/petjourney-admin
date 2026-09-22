/**
 * Estado mutável em memória da camada mocada do hotel.
 *
 * É o "banco" do módulo: os repositórios leem e escrevem aqui, e nada mais no app conhece este
 * arquivo. Trocar por HTTP é substituir os repositórios, não a interface.
 */

import { createClinicClock } from '@/features/clinico/domain/clinic-time'

import { HOTEL_UTC_OFFSET } from './fixtures'
import { gerarDataset, SEMENTE_PADRAO, type SeedResult } from './seed'
import type { ISODateTime } from './types'

const clock = createClinicClock(HOTEL_UTC_OFFSET)

let dataset: SeedResult | null = null
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
  sequencia = 0

  return dataset
}

export function getSemente() {
  return sementeAtual
}

/**
 * Identificador estável e sequencial — nada de `Math.random` em id de registro.
 *
 * O sufixo com a âncora existe para que dois datasets gerados em dias diferentes não produzam o
 * mesmo id: sem ele, um registro criado hoje e um criado ontem colidiriam no primeiro contador, e
 * a colisão apareceria como "a reserva mudou sozinha".
 */
export function novoId(prefixo: string): string {
  sequencia += 1

  return `${prefixo}-${sequencia.toString(36)}-${getDataset().ancora.replace(/-/g, '')}`
}

export function agoraIso(): ISODateTime {
  return clock.nowIso()
}

export function hojeIso() {
  return clock.today()
}

export { clock as hotelClock }
