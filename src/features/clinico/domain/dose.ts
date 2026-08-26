/**
 * Cálculo de dose.
 *
 * A dose aparece **por extenso** na prescrição: mg por administração, quantidade da
 * apresentação, frequência e total. Número solto em campo de formulário é onde erro de
 * vírgula vira erro de paciente.
 */

import type {
  DoseCalc,
  Medication,
  Pet,
  PetAlert,
  PetSpecies,
  Prescription,
} from '../data/types'
import { doseDaEspecie, especieProibida } from './bulario'

export type DoseInput = {
  medicamento: Medication
  pesoKg: number | null
  mgPorKg: number
  frequenciaHoras: number
  duracaoDias: number
  /** Espécie do paciente. Sem ela a conferência cai na faixa geral do bulário. */
  especie?: PetSpecies | null
}

export function calcularDose(input: DoseInput): DoseCalc | null {
  const { medicamento, pesoKg, mgPorKg, frequenciaHoras, duracaoDias } = input

  if (pesoKg === null || pesoKg <= 0 || mgPorKg <= 0 || frequenciaHoras <= 0) {
    return null
  }

  const mgPorAdministracao = round(pesoKg * mgPorKg, 2)
  const quantidade =
    medicamento.concentracao > 0
      ? round(
          mgPorAdministracao / medicamento.concentracao,
          medicamento.unidadeApresentacao === 'ml' ? 2 : 2,
        )
      : 0

  const administracoesPorDia = 24 / frequenciaHoras

  return {
    medicamentoId: medicamento.id,
    mgPorKg,
    pesoKg,
    mgPorAdministracao,
    quantidadeApresentacao: quantidade,
    frequenciaHoras,
    duracaoDias,
    totalAdministracoes: Math.max(1, Math.round(administracoesPorDia * Math.max(duracaoDias, 0))),
  }
}

function round(value: number, casas: number) {
  const fator = 10 ** casas

  return Math.round(value * fator) / fator
}

export type DoseAviso =
  | 'abaixo-da-usual'
  | 'acima-da-usual'
  | 'peso-ausente'
  | 'especie-proibida'

export function avaliarDose(input: DoseInput): DoseAviso | null {
  if (input.pesoKg === null || input.pesoKg <= 0) {
    return 'peso-ausente'
  }

  /*
   * A faixa da espécie tem precedência sobre a geral.
   *
   * Conferindo 0,1 mg/kg de meloxicam contra a faixa geral (0,1–0,2), a tela dava o dobro da
   * dose felina de manutenção como "dentro do usual" e não dizia nada.
   */
  const daEspecie = input.especie ? doseDaEspecie(input.medicamento, input.especie) : null

  if (input.especie && especieProibida(input.medicamento, input.especie)) {
    return 'especie-proibida'
  }

  const faixa = daEspecie && !daEspecie.proibido ? daEspecie.mgPorKg : input.medicamento.doseUsualMgKg

  if (input.mgPorKg < faixa.min) {
    return 'abaixo-da-usual'
  }

  if (input.mgPorKg > faixa.max) {
    return 'acima-da-usual'
  }

  return null
}

/** A faixa que a tela deve exibir ao lado do campo de dose. */
export function faixaDeReferencia(medicamento: Medication, especie: PetSpecies | null) {
  const daEspecie = especie ? doseDaEspecie(medicamento, especie) : null

  return daEspecie && !daEspecie.proibido ? daEspecie.mgPorKg : medicamento.doseUsualMgKg
}

/**
 * Alergia registrada ao princípio ativo. A prescrição segue possível — o que a interface
 * exige é confirmação explícita, não proibição.
 */
export function alergiaConflitante(pet: Pet, medicamento: Medication): PetAlert | null {
  const alvo = medicamento.principioAtivo.trim().toLowerCase()

  return (
    pet.alertas.find(
      (alerta) =>
        alerta.kind === 'alergia' &&
        alerta.detalhe.trim().toLowerCase().includes(alvo),
    ) ?? null
  )
}

export function prescricaoPendenteDeConfirmacao(
  prescricao: Prescription,
  pet: Pet,
  medicamento: Medication,
): boolean {
  return Boolean(alergiaConflitante(pet, medicamento)) && !prescricao.alergiaConfirmada
}
