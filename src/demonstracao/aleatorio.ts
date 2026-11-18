/**
 * Sorteio com semente: os dados de exemplo saem iguais a cada carga (as mesmas pessoas, os mesmos
 * horários), e cada área tem a sua semente, para uma não mexer na sorte da outra.
 */

function hashDe(texto: string): number {
  let h = 2166136261
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export type Sorteio = ReturnType<typeof criarSorteio>

export function criarSorteio(semente: string) {
  let estado = hashDe(semente) || 1

  /** Número em [0, 1). mulberry32. */
  function numero(): number {
    estado = (estado + 0x6d2b79f5) | 0
    let t = estado
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** Inteiro em [min, max], os dois inclusos. */
  function inteiro(min: number, max: number): number {
    return min + Math.floor(numero() * (max - min + 1))
  }

  function chance(p: number): boolean {
    return numero() < p
  }

  function escolher<T>(lista: readonly T[]): T {
    if (!lista.length) throw new Error('sorteio: lista vazia')
    return lista[Math.floor(numero() * lista.length)] as T
  }

  /** Escolhe pelo peso: `[[valor, peso], ...]`. */
  function pesado<T>(opcoes: ReadonlyArray<readonly [T, number]>): T {
    const total = opcoes.reduce((soma, [, peso]) => soma + peso, 0)
    let alvo = numero() * total
    for (const [valor, peso] of opcoes) {
      alvo -= peso
      if (alvo < 0) return valor
    }
    return (opcoes[opcoes.length - 1] as readonly [T, number])[0]
  }

  function embaralhar<T>(lista: readonly T[]): T[] {
    const copia = [...lista]
    for (let i = copia.length - 1; i > 0; i--) {
      const j = Math.floor(numero() * (i + 1))
      ;[copia[i], copia[j]] = [copia[j] as T, copia[i] as T]
    }
    return copia
  }

  /** `n` itens distintos da lista. */
  function alguns<T>(lista: readonly T[], n: number): T[] {
    return embaralhar(lista).slice(0, Math.max(0, Math.min(n, lista.length)))
  }

  return { numero, inteiro, chance, escolher, pesado, embaralhar, alguns }
}

/** Um id estável e legível: `prefixo-0001`. */
export function idDe(prefixo: string, n: number): string {
  return `${prefixo}-${String(n).padStart(4, '0')}`
}
