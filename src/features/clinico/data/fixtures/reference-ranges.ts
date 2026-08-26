import type { ReferenceRange } from '../types'

/**
 * Faixas de referência por espécie.
 *
 * Faixa ausente para uma combinação não é erro: o status vira `sem-referencia` e a tela mostra
 * o valor sem julgar. Inventar faixa é pior que não ter.
 */
export const referenceRangesFixture: ReferenceRange[] = [
  // Cães
  { vital: 'temperatura', especie: 'canina', min: 37.5, max: 39.2, unidade: '°C', precisao: 1 },
  { vital: 'frequenciaCardiaca', especie: 'canina', min: 70, max: 160, unidade: 'bpm', precisao: 0 },
  { vital: 'frequenciaRespiratoria', especie: 'canina', min: 18, max: 34, unidade: 'mpm', precisao: 0 },
  { vital: 'tempoPreenchimentoCapilar', especie: 'canina', min: 1, max: 2, unidade: 's', precisao: 1 },
  { vital: 'escoreCorporal', especie: 'canina', min: 4, max: 5, unidade: '/9', precisao: 0 },
  { vital: 'pressaoSistolica', especie: 'canina', min: 110, max: 160, unidade: 'mmHg', precisao: 0 },

  // Gatos
  { vital: 'temperatura', especie: 'felina', min: 38.0, max: 39.3, unidade: '°C', precisao: 1 },
  { vital: 'frequenciaCardiaca', especie: 'felina', min: 140, max: 220, unidade: 'bpm', precisao: 0 },
  { vital: 'frequenciaRespiratoria', especie: 'felina', min: 20, max: 40, unidade: 'mpm', precisao: 0 },
  { vital: 'tempoPreenchimentoCapilar', especie: 'felina', min: 1, max: 2, unidade: 's', precisao: 1 },
  { vital: 'escoreCorporal', especie: 'felina', min: 4, max: 5, unidade: '/9', precisao: 0 },
  { vital: 'pressaoSistolica', especie: 'felina', min: 120, max: 160, unidade: 'mmHg', precisao: 0 },

  // Aves
  { vital: 'temperatura', especie: 'ave', min: 40.0, max: 42.0, unidade: '°C', precisao: 1 },
  { vital: 'frequenciaCardiaca', especie: 'ave', min: 200, max: 400, unidade: 'bpm', precisao: 0 },
  { vital: 'frequenciaRespiratoria', especie: 'ave', min: 25, max: 60, unidade: 'mpm', precisao: 0 },

  // Roedores
  { vital: 'temperatura', especie: 'roedor', min: 37.2, max: 39.5, unidade: '°C', precisao: 1 },
  { vital: 'frequenciaCardiaca', especie: 'roedor', min: 230, max: 380, unidade: 'bpm', precisao: 0 },
  { vital: 'frequenciaRespiratoria', especie: 'roedor', min: 40, max: 100, unidade: 'mpm', precisao: 0 },

  // Equinos
  { vital: 'temperatura', especie: 'equina', min: 37.2, max: 38.5, unidade: '°C', precisao: 1 },
  { vital: 'frequenciaCardiaca', especie: 'equina', min: 28, max: 44, unidade: 'bpm', precisao: 0 },
  { vital: 'frequenciaRespiratoria', especie: 'equina', min: 8, max: 16, unidade: 'mpm', precisao: 0 },
]

/** Unidade do peso não depende de espécie e não tem faixa: cada paciente é o próprio normal. */
export const unidadePorVital: Record<string, string> = {
  peso: 'kg',
  temperatura: '°C',
  frequenciaCardiaca: 'bpm',
  frequenciaRespiratoria: 'mpm',
  tempoPreenchimentoCapilar: 's',
  escoreCorporal: '/9',
  pressaoSistolica: 'mmHg',
}
