/**
 * Runtime da camada mocada: latência, falha por operação e sorteio determinístico.
 *
 * TypeScript puro, sem Vue: o painel de desenvolvimento lê e escreve aqui, os repositórios
 * consomem, e nada disso muda quando a API real entrar no lugar.
 */

export type MockOperation =
  | 'agenda.dia'
  | 'agenda.semana'
  | 'agenda.criar'
  | 'agenda.mover'
  | 'agenda.status'
  | 'agenda.cancelar'
  | 'agenda.bloqueio'
  | 'agenda.reserva'
  | 'encounter.abrir'
  | 'encounter.salvar'
  | 'encounter.finalizar'
  | 'fila.listar'
  | 'fila.ofertar'
  | 'paciente.listar'
  | 'paciente.historico'
  | 'catalogo.listar'

export class MockError extends Error {
  /** `kind` traduzível, nunca texto pronto de servidor. */
  readonly kind: string

  constructor(kind: string, operation: MockOperation) {
    super(`[mock] ${operation} falhou: ${kind}`)
    this.name = 'MockError'
    this.kind = kind
  }
}

export type MockRuntimeConfig = {
  /** Latência base de cada chamada, em ms. */
  latenciaMs: number
  /** Variação aleatória somada à latência. */
  jitterMs: number
  /** Probabilidade de falha (0..1) por operação. */
  erroPorOperacao: Partial<Record<MockOperation, number>>
  /** Derruba tudo de uma vez, para exercitar a faixa de erro do frame. */
  offline: boolean
}

const config: MockRuntimeConfig = {
  latenciaMs: 220,
  jitterMs: 140,
  erroPorOperacao: {},
  offline: false,
}

export function getMockConfig(): MockRuntimeConfig {
  return { ...config, erroPorOperacao: { ...config.erroPorOperacao } }
}

export function setMockConfig(patch: Partial<MockRuntimeConfig>) {
  if (patch.latenciaMs !== undefined) {
    config.latenciaMs = Math.max(0, patch.latenciaMs)
  }

  if (patch.jitterMs !== undefined) {
    config.jitterMs = Math.max(0, patch.jitterMs)
  }

  if (patch.offline !== undefined) {
    config.offline = patch.offline
  }

  if (patch.erroPorOperacao) {
    config.erroPorOperacao = { ...config.erroPorOperacao, ...patch.erroPorOperacao }
  }
}

export function resetMockConfig() {
  config.latenciaMs = 220
  config.jitterMs = 140
  config.erroPorOperacao = {}
  config.offline = false
}

/**
 * PRNG determinístico (mulberry32). Mesma semente, mesma sequência — é o que garante que o
 * dia âncora nasça sempre com o mesmo conjunto de atendimentos.
 */
export function createPrng(seed: number): () => number {
  let state = seed >>> 0

  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function pickFrom<T>(rng: () => number, items: readonly T[], fallback: T): T {
  if (items.length === 0) {
    return fallback
  }

  return items[Math.floor(rng() * items.length)] ?? fallback
}

export function intBetween(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

/** Semente estável a partir de texto — usada para derivar sementes por eixo de sorteio. */
export function hashSeed(text: string): number {
  let hash = 2166136261

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * Envelope de toda chamada da camada mocada: paga a latência configurada e sorteia falha
 * conforme a operação. O `produce` roda depois da espera, para que o dado devolvido reflita
 * o estado no momento da "resposta".
 */
export async function simularChamada<T>(
  operation: MockOperation,
  produce: () => T,
): Promise<T> {
  const espera = config.latenciaMs + Math.random() * config.jitterMs

  await sleep(espera)

  if (config.offline) {
    throw new MockError('offline', operation)
  }

  const taxa = config.erroPorOperacao[operation] ?? 0

  if (taxa > 0 && Math.random() < taxa) {
    throw new MockError('falha-servidor', operation)
  }

  return produce()
}
