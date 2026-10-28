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
  | 'agenda.editar'
  | 'agenda.status'
  | 'agenda.cancelar'
  | 'agenda.bloqueio'
  | 'agenda.reserva'
  /** Busca de horários livres — hoje só o retorno do prontuário a consome. */
  | 'agenda.slots'
  | 'encounter.abrir'
  | 'encounter.salvar'
  | 'encounter.finalizar'
  | 'fila.listar'
  | 'fila.ofertar'
  | 'paciente.listar'
  | 'paciente.historico'
  | 'catalogo.listar'
  /*
   * A internação tem operações próprias porque a granularidade da falha é outra: marcar uma
   * dose como dada precisa poder falhar sozinha, sem derrubar o mapa de leitos junto — é
   * exatamente esse cenário que a enfermagem vive com o wi-fi da sala dos fundos.
   */
  | 'internacao.mapa'
  | 'internacao.paciente'
  | 'internacao.administrar'
  | 'internacao.prescrever'
  | 'internacao.evoluir'
  | 'internacao.passagem'
  | 'internacao.boletim'
  | 'internacao.internar'
  /** Cadastro de leitos: configuração da clínica, não trabalho de plantão. */
  | 'internacao.leitos'
  /** Um lote da importação. Falha sozinho: o lote seguinte espera, e nada do lote que falhou entra. */
  | 'migracao.importar'
  /*
   * Adesão ao tratamento. Registrar a dose é o que o app faz em casa, no 4G de onde estiver; a
   * falha dele não pode levar junto a leitura da ficha.
   */
  | 'tratamento.listar'
  | 'tratamento.registrar'
  /*
   * Estoque de vacinas. Receber lote, dar baixa e salvar metas é escrita de balcão e de gerência; a
   * falha dela não pode apagar a geladeira da tela.
   */
  | 'estoque.listar'
  | 'estoque.registrar'
  /*
   * Agendamento online. A busca de horários é do celular do responsável; a resposta é da
   * recepção. Falham separadas: o 4G de quem pede não derruba a caixa de pedidos da clínica.
   */
  | 'pedido.horarios'
  | 'pedido.enviar'
  | 'pedido.listar'
  | 'pedido.responder'

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
 * Operação em lote custa pelo tamanho do lote: gravar 80 tutores e pets não leva o mesmo que ler
 * uma ficha. O valor é uma fração da latência base por item, para seguir o painel de
 * desenvolvimento e zerar junto nos testes. Com os 220 ms de base, 115 linhas levam uns 4 s: o
 * tempo de ver a barra andar, que antes passava em 0,7 s.
 */
const LATENCIA_POR_ITEM: Partial<Record<MockOperation, number>> = {
  'migracao.importar': 0.14,
}

/**
 * Envelope de toda chamada da camada mocada: paga a latência configurada e sorteia falha
 * conforme a operação. O `produce` roda depois da espera, para que o dado devolvido reflita
 * o estado no momento da "resposta". `itens` é o tamanho do lote, nas operações que têm um.
 */
export async function simularChamada<T>(
  operation: MockOperation,
  produce: () => T,
  itens = 0,
): Promise<T> {
  const porItem = config.latenciaMs * (LATENCIA_POR_ITEM[operation] ?? 0)
  const espera = config.latenciaMs + Math.random() * config.jitterMs + itens * porItem

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
