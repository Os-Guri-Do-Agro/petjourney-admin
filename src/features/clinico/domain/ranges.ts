/**
 * Faixas de referência de sinais vitais.
 *
 * O status é **sempre recalculado** a partir do valor e da faixa, nunca digitado nem
 * persistido pela tela. Se fosse digitado, editar o peso do paciente deixaria a leitura
 * antiga marcada como "dentro" para sempre.
 */

import type {
  FaixaEtaria,
  Measurement,
  PetPorte,
  PetSpecies,
  RangeStatus,
  ReferenceRange,
  VitalKey,
} from '../data/types'

/**
 * Qualificadores do paciente que refinam a faixa. Ausentes viram "qualquer".
 */
export type QualificadoresDaFaixa = {
  porte?: PetPorte | null
  faixaEtaria?: FaixaEtaria | null
}

/**
 * Quão específica é a faixa para **este** paciente.
 *
 * Peso 2 para porte e 1 para idade, somados. Porte pesa mais porque em cão ele desloca a
 * frequência cardíaca mais do que a idade adulta desloca — e quando as duas competem, a faixa
 * do porte certo erra menos que a da idade certa.
 *
 * Devolve `null` quando a faixa **contradiz** o paciente: faixa de cão gigante não serve para
 * um mini, e cair nela por falta de opção melhor seria pior que não ter faixa.
 */
function especificidade(
  faixa: ReferenceRange,
  qualificadores: QualificadoresDaFaixa,
): number | null {
  let pontos = 0

  if (faixa.porte) {
    if (faixa.porte !== qualificadores.porte) {
      return null
    }

    pontos += 2
  }

  if (faixa.faixaEtaria) {
    if (faixa.faixaEtaria !== qualificadores.faixaEtaria) {
      return null
    }

    pontos += 1
  }

  return pontos
}

/**
 * Faixa de referência do vital para o paciente.
 *
 * Resolve do mais específico para o mais geral: porte e idade, depois porte, depois idade,
 * depois a faixa da espécie inteira. Nenhuma serve? `null`, e a tela mostra o valor sem
 * julgar — **inventar faixa é pior que não ter**.
 *
 * Os qualificadores são opcionais em quem chama porque nem todo paciente os tem: nascimento
 * desconhecido é comum, e nesse caso a busca simplesmente ignora o eixo da idade em vez de
 * chutar "adulto".
 */
export function encontrarFaixa(
  faixas: ReferenceRange[],
  vital: VitalKey,
  especie: PetSpecies,
  qualificadores: QualificadoresDaFaixa = {},
): ReferenceRange | null {
  let melhor: ReferenceRange | null = null
  let melhorPontuacao = -1

  for (const faixa of faixas) {
    if (faixa.vital !== vital || faixa.especie !== especie) {
      continue
    }

    const pontos = especificidade(faixa, qualificadores)

    if (pontos !== null && pontos > melhorPontuacao) {
      melhor = faixa
      melhorPontuacao = pontos
    }
  }

  return melhor
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
