import type { ReferenceRange } from '../types'

/**
 * Faixas de referência.
 *
 * Faixa ausente para uma combinação não é erro: o status vira `sem-referencia` e a tela mostra
 * o valor sem julgar. Inventar faixa é pior que não ter.
 *
 * **Como o catálogo é organizado.** Cada vital tem uma faixa de espécie sem qualificador
 * nenhum, que é a rede de segurança, e faixas mais específicas por porte e idade onde a
 * diferença é clínica. A resolução (`domain/ranges.ts`) escolhe a mais específica que casa com
 * o paciente e cai na geral quando nenhuma casa.
 *
 * Só cão recebe recorte por porte, e é deliberado: é a espécie em que a dispersão de tamanho
 * desloca a referência de verdade. Encher gato e ave de porte criaria linhas que ninguém
 * preencheria e uma precisão que o catálogo não tem.
 */
export const referenceRangesFixture: ReferenceRange[] = [
  // ------------------------------------------------------------------ cães (geral)
  { vital: 'temperatura', especie: 'canina', min: 37.5, max: 39.2, unidade: '°C', precisao: 1 },
  { vital: 'frequenciaCardiaca', especie: 'canina', min: 70, max: 160, unidade: 'bpm', precisao: 0 },
  { vital: 'frequenciaRespiratoria', especie: 'canina', min: 18, max: 34, unidade: 'mpm', precisao: 0 },
  { vital: 'tempoPreenchimentoCapilar', especie: 'canina', min: 1, max: 2, unidade: 's', precisao: 1 },
  { vital: 'escoreCorporal', especie: 'canina', min: 4, max: 5, unidade: '/9', precisao: 0 },
  { vital: 'pressaoSistolica', especie: 'canina', min: 110, max: 160, unidade: 'mmHg', precisao: 0 },

  /*
   * --------------------------------------------------- cães, frequência cardíaca por porte
   *
   * O recorte que mais muda conduta. Um yorkshire de 3 kg em 140 bpm está em repouso; um
   * são-bernardo em 140 bpm está taquicárdico. A faixa geral acima (70–160) não acusa nenhum
   * dos dois — e é justamente por isso que ela sozinha ensina o profissional a ignorar o
   * destaque.
   */
  { vital: 'frequenciaCardiaca', especie: 'canina', porte: 'mini', min: 100, max: 180, unidade: 'bpm', precisao: 0 },
  { vital: 'frequenciaCardiaca', especie: 'canina', porte: 'pequeno', min: 90, max: 160, unidade: 'bpm', precisao: 0 },
  { vital: 'frequenciaCardiaca', especie: 'canina', porte: 'medio', min: 70, max: 140, unidade: 'bpm', precisao: 0 },
  { vital: 'frequenciaCardiaca', especie: 'canina', porte: 'grande', min: 60, max: 120, unidade: 'bpm', precisao: 0 },
  { vital: 'frequenciaCardiaca', especie: 'canina', porte: 'gigante', min: 55, max: 110, unidade: 'bpm', precisao: 0 },

  /*
   * ---------------------------------------------------- cães, filhote e idoso
   *
   * Filhote bate mais alto que qualquer adulto, independente do porte — por isso a faixa de
   * idade vem sem porte e a resolução a escolhe quando não há uma de porte+idade.
   */
  { vital: 'frequenciaCardiaca', especie: 'canina', faixaEtaria: 'filhote', min: 110, max: 220, unidade: 'bpm', precisao: 0 },
  { vital: 'frequenciaRespiratoria', especie: 'canina', faixaEtaria: 'filhote', min: 20, max: 40, unidade: 'mpm', precisao: 0 },
  { vital: 'temperatura', especie: 'canina', faixaEtaria: 'filhote', min: 37.8, max: 39.5, unidade: '°C', precisao: 1 },
  /** Idoso perde tolerância pressórica: a hipertensão aparece antes e cobra investigação. */
  { vital: 'pressaoSistolica', especie: 'canina', faixaEtaria: 'idoso', min: 110, max: 150, unidade: 'mmHg', precisao: 0 },

  /*
   * ---------------------------------------------- cães, o cruzamento porte + idade
   *
   * **Os cinco portes, todos.** A tentação é cadastrar só onde a diferença parece grande e
   * deixar o desempate da resolução arbitrar o resto — e é aí que ela erra: para um filhote
   * mini existiriam a faixa de "mini" e a de "filhote", o porte pesa mais, e o paciente seria
   * julgado pela régua de um adulto. Filhote corre mais em **qualquer** porte; deixar um
   * buraco na tabela transforma isso num julgamento errado silencioso.
   *
   * Cobrir a combinação inteira é mais barato que confiar no desempate.
   */
  { vital: 'frequenciaCardiaca', especie: 'canina', porte: 'mini', faixaEtaria: 'filhote', min: 120, max: 220, unidade: 'bpm', precisao: 0 },
  { vital: 'frequenciaCardiaca', especie: 'canina', porte: 'pequeno', faixaEtaria: 'filhote', min: 110, max: 200, unidade: 'bpm', precisao: 0 },
  { vital: 'frequenciaCardiaca', especie: 'canina', porte: 'medio', faixaEtaria: 'filhote', min: 100, max: 190, unidade: 'bpm', precisao: 0 },
  { vital: 'frequenciaCardiaca', especie: 'canina', porte: 'grande', faixaEtaria: 'filhote', min: 90, max: 180, unidade: 'bpm', precisao: 0 },
  { vital: 'frequenciaCardiaca', especie: 'canina', porte: 'gigante', faixaEtaria: 'filhote', min: 80, max: 170, unidade: 'bpm', precisao: 0 },

  // Gatos
  { vital: 'temperatura', especie: 'felina', min: 38.0, max: 39.3, unidade: '°C', precisao: 1 },
  { vital: 'frequenciaCardiaca', especie: 'felina', min: 140, max: 220, unidade: 'bpm', precisao: 0 },
  { vital: 'frequenciaRespiratoria', especie: 'felina', min: 20, max: 40, unidade: 'mpm', precisao: 0 },
  { vital: 'tempoPreenchimentoCapilar', especie: 'felina', min: 1, max: 2, unidade: 's', precisao: 1 },
  { vital: 'escoreCorporal', especie: 'felina', min: 4, max: 5, unidade: '/9', precisao: 0 },
  { vital: 'pressaoSistolica', especie: 'felina', min: 120, max: 160, unidade: 'mmHg', precisao: 0 },
  /** Gato filhote também corre mais que gato adulto; porte não entra, a dispersão é pequena. */
  { vital: 'frequenciaCardiaca', especie: 'felina', faixaEtaria: 'filhote', min: 160, max: 240, unidade: 'bpm', precisao: 0 },
  /** Hipertensão do idoso é achado frequente em gato e cobra fundo de olho. */
  { vital: 'pressaoSistolica', especie: 'felina', faixaEtaria: 'idoso', min: 120, max: 150, unidade: 'mmHg', precisao: 0 },

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
