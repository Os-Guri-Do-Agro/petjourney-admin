/**
 * Faixas de referência de sinais vitais.
 *
 * O status é **sempre recalculado** a partir do valor e da faixa, nunca digitado nem
 * persistido pela tela. Se fosse digitado, editar o peso do paciente deixaria a leitura
 * antiga marcada como "dentro" para sempre.
 */

import type {
  Measurement,
  PetSpecies,
  RangeStatus,
  ReferenceRange,
  VitalKey,
} from '../data/types'

export function encontrarFaixa(
  faixas: ReferenceRange[],
  vital: VitalKey,
  especie: PetSpecies,
): ReferenceRange | null {
  return faixas.find((faixa) => faixa.vital === vital && faixa.especie === especie) ?? null
}

export function statusDaMedicao(
  medicao: Measurement | undefined,
  faixa: ReferenceRange | null,
): RangeStatus {
  if (!medicao) {
    return 'nao-aferido'
  }

  if (medicao.naoAferido) {
    return 'nao-aferido'
  }

  if (medicao.valor === null || Number.isNaN(medicao.valor)) {
    return 'nao-aferido'
  }

  if (!faixa) {
    return 'sem-referencia'
  }

  if (medicao.valor < faixa.min) {
    return 'abaixo'
  }

  if (medicao.valor > faixa.max) {
    return 'acima'
  }

  return 'dentro'
}

/** Fora da faixa é o que muda conduta; o resto é contexto. */
export function foraDaFaixa(status: RangeStatus): boolean {
  return status === 'abaixo' || status === 'acima'
}

export function medicaoVazia(): Measurement {
  return { valor: null, naoAferido: false }
}

/** `não aferido` precisa ser distinguível de vazio, na interface e no dado. */
export function medicaoPreenchida(medicao: Measurement | undefined): boolean {
  if (!medicao) {
    return false
  }

  return medicao.naoAferido || medicao.valor !== null
}

/**
 * Quão longe do limite mais próximo, em proporção da largura da faixa. Serve para graduar a
 * intensidade do realce sem inventar uma escala nova em cada componente.
 */
export function desvioRelativo(medicao: Measurement, faixa: ReferenceRange | null): number {
  if (!faixa || medicao.valor === null || medicao.naoAferido) {
    return 0
  }

  const largura = Math.max(faixa.max - faixa.min, 0.0001)

  if (medicao.valor < faixa.min) {
    return (faixa.min - medicao.valor) / largura
  }

  if (medicao.valor > faixa.max) {
    return (medicao.valor - faixa.max) / largura
  }

  return 0
}
