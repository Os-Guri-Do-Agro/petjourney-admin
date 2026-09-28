/**
 * Do vocabulário do responsável para o do veterinário.
 *
 * O responsável responde no app com os enums do Diário Pet (`ConsumoDiario`, `AspectoFezes`,
 * `EstadoUrina`...) — são os que ele já usa todo dia, e é por isso que o contrato os adotou em
 * vez de inventar escala nova. O vet escreve a anamnese com o vocabulário clínico
 * (`Anamnese['apetite']`...). Este arquivo é a ponte, e ela é **deliberadamente incompleta**:
 * "com sangue" não é um grau de evacuação, é um achado — vira `''` aqui e aparece para o vet
 * como texto, para ele ler e decidir. Converter tudo à força perderia justo o que mais importa.
 *
 * Usada pelo painel da pré-consulta no prontuário e pelo resumo "Este pet em 30 segundos",
 * que abre o atendimento com o diário na anamnese.
 */

import type {
  AspectoFezes,
  ConsumoDiario,
  EstadoUrina,
  EvolucaoDaQueixa,
} from '../contrato/responsavel'
import type { Anamnese } from '../data/types'

const APETITE: Record<ConsumoDiario, Anamnese['apetite']> = {
  MUITO: 'aumentado',
  NORMAL: 'normal',
  POUCO: 'reduzido',
  NADA: 'ausente',
  RECUSOU: 'ausente',
  /* Comeu e vomitou: o apetite pode ser normal. É achado para o vet ler, não grau para aplicar. */
  VOMITOU_APOS: '',
}

const EVACUACAO: Record<AspectoFezes, Anamnese['evacuacao']> = {
  NORMAL: 'normal',
  MOLE: 'diarreia',
  PASTOSA: 'diarreia',
  DIARREIA: 'diarreia',
  RESSECADA: 'constipacao',
  NAO_DEFECOU: 'constipacao',
  COM_SANGUE: '',
  COM_MUCO: '',
  COM_VERMES: '',
  ESCURA: '',
  CLARA: '',
}

const MICCAO: Record<EstadoUrina, Anamnese['miccao']> = {
  NORMAL: 'normal',
  MUITO: 'aumentada',
  POUCO: 'reduzida',
  NADA: 'reduzida',
  COM_DIFICULDADE: 'disuria',
  COM_SANGUE: '',
  ESCURA: '',
  COM_ODOR_FORTE: '',
}

const EVOLUCAO: Record<EvolucaoDaQueixa, Anamnese['evolucao']> = {
  PIORANDO: 'piorando',
  ESTAVEL: 'estavel',
  MELHORANDO: 'melhorando',
  VAI_E_VOLTA: 'intermitente',
}

export function apetiteDaAnamnese(valor: ConsumoDiario | null): Anamnese['apetite'] {
  return valor ? APETITE[valor] : ''
}

export function evacuacaoDaAnamnese(valor: AspectoFezes | null): Anamnese['evacuacao'] {
  return valor ? EVACUACAO[valor] : ''
}

export function miccaoDaAnamnese(valor: EstadoUrina | null): Anamnese['miccao'] {
  return valor ? MICCAO[valor] : ''
}

export function evolucaoDaAnamnese(valor: EvolucaoDaQueixa | null): Anamnese['evolucao'] {
  return valor ? EVOLUCAO[valor] : ''
}
