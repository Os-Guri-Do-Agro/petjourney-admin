/**
 * Estado de preenchimento do prontuário, por etapa.
 *
 * Serve a duas telas ao mesmo tempo: o passo mostra o que já foi registrado, e o diálogo de
 * finalizar nomeia o que falta. Como é a mesma conta, fica fora do componente — dois cálculos
 * separados divergiriam no primeiro campo novo.
 *
 * Nada aqui impede finalizar. "Falta" é informação, não tranca.
 */

import type { Encounter, Medication, Pet } from '../data/types'
import { alergiaAoPrincipio } from './bulario'
import { medicaoPreenchida } from './ranges'

export type EtapaId = 'anamnese' | 'exame' | 'diagnostico' | 'conduta' | 'resumo'

export type EstadoDaEtapa = 'vazio' | 'parcial' | 'completo' | 'alerta'

export type ProgressoDaEtapa = {
  id: EtapaId
  estado: EstadoDaEtapa
  /** Quantos itens relevantes já foram registrados. */
  preenchidos: number
  total: number
}

function classificar(preenchidos: number, total: number, temAlerta = false): EstadoDaEtapa {
  if (temAlerta) {
    return 'alerta'
  }

  if (preenchidos === 0) {
    return 'vazio'
  }

  return preenchidos >= total ? 'completo' : 'parcial'
}

export function progressoDaAnamnese(encounter: Encounter): ProgressoDaEtapa {
  const { anamnese } = encounter
  const campos = [
    anamnese.queixaPrincipal.trim(),
    anamnese.historia.trim(),
    anamnese.duracaoSintomas.trim(),
    anamnese.apetite,
    anamnese.hidratacao,
  ]

  const preenchidos = campos.filter(Boolean).length

  return { id: 'anamnese', estado: classificar(preenchidos, campos.length), preenchidos, total: campos.length }
}

export function progressoDoExame(encounter: Encounter): ProgressoDaEtapa {
  const vitais = Object.values(encounter.exameFisico.vitais)
  const preenchidos = vitais.filter((vital) => medicaoPreenchida(vital)).length
  const sistemasAvaliados = Object.values(encounter.exameFisico.sistemas).filter(
    (sistema) => sistema.status !== 'nao-avaliado',
  ).length

  /** Um exame conta como completo com os vitais aferidos e ao menos um sistema avaliado. */
  const total = vitais.length + 1

  return {
    id: 'exame',
    estado: classificar(preenchidos + Math.min(sistemasAvaliados, 1), total),
    preenchidos,
    total: vitais.length,
  }
}

export function progressoDoDiagnostico(encounter: Encounter): ProgressoDaEtapa {
  const quantidade = encounter.diagnosticos.length

  return {
    id: 'diagnostico',
    estado: quantidade === 0 ? 'vazio' : 'completo',
    preenchidos: quantidade,
    total: 1,
  }
}

/**
 * A conduta é a única etapa que pode ficar em `alerta`: prescrição que encosta numa alergia
 * registrada e ainda não foi confirmada não é "incompleta", é arriscada.
 */
export function progressoDaConduta(
  encounter: Encounter,
  pet: Pet | null,
  medicamentoPorId: (id: string) => Medication | null,
): ProgressoDaEtapa {
  const { conduta } = encounter
  const itens = [
    conduta.orientacoes.trim().length > 0,
    conduta.prescricoes.length > 0,
    conduta.examesSolicitados.length > 0 || conduta.retorno.emDias !== null,
  ]

  const preenchidos = itens.filter(Boolean).length

  return {
    id: 'conduta',
    estado: classificar(preenchidos, itens.length, alergiaNaoConfirmada(encounter, pet, medicamentoPorId)),
    preenchidos,
    total: itens.length,
  }
}

export function alergiaNaoConfirmada(
  encounter: Encounter,
  pet: Pet | null,
  medicamentoPorId: (id: string) => Medication | null,
): boolean {
  if (!pet) {
    return false
  }

  return encounter.conduta.prescricoes.some((prescricao) => {
    if (prescricao.alergiaConfirmada) {
      return false
    }

    const medicamento = medicamentoPorId(prescricao.medicamentoId)

    if (!medicamento) {
      return false
    }

    return Boolean(alergiaAoPrincipio(pet, medicamento))
  })
}

/**
 * Resumo não é etapa de preenchimento — é de conferência.
 *
 * O estado dela **espelha o atendimento inteiro**: fica "alerta" enquanto houver prescrição em
 * conflito com alergia sem aceite, "completo" quando as quatro etapas anteriores estão completas,
 * e "parcial" no meio do caminho. Contar campos próprios daria a um passo de leitura uma barra de
 * progresso que ele não tem como encher.
 */
export function progressoDoResumo(anteriores: ProgressoDaEtapa[]): ProgressoDaEtapa {
  const completos = anteriores.filter((etapa) => etapa.estado === 'completo').length
  const temAlerta = anteriores.some((etapa) => etapa.estado === 'alerta')
  const vazio = anteriores.every((etapa) => etapa.estado === 'vazio')

  return {
    id: 'resumo',
    estado: temAlerta
      ? 'alerta'
      : vazio
        ? 'vazio'
        : completos === anteriores.length
          ? 'completo'
          : 'parcial',
    preenchidos: completos,
    total: anteriores.length,
  }
}

export function progressoDoAtendimento(
  encounter: Encounter,
  pet: Pet | null,
  medicamentoPorId: (id: string) => Medication | null,
): ProgressoDaEtapa[] {
  const anteriores = [
    progressoDaAnamnese(encounter),
    progressoDoExame(encounter),
    progressoDoDiagnostico(encounter),
    progressoDaConduta(encounter, pet, medicamentoPorId),
  ]

  return [...anteriores, progressoDoResumo(anteriores)]
}
