/**
 * Porte e faixa etária do paciente.
 *
 * Existem para qualificar a faixa de referência. Faixa por espécie sozinha erra em cão: um
 * yorkshire de 3 kg bate 140 bpm em repouso e um são-bernardo de 70 kg bate 70 — a mesma faixa
 * marcaria um dos dois como alterado sempre.
 *
 * Nada aqui é persistido: porte é campo do paciente (que a clínica informa) e a faixa etária é
 * **sempre derivada** do nascimento. Guardar "idoso" no cadastro criaria um paciente que
 * envelhece só quando alguém edita a ficha.
 */

import type { FaixaEtaria, Pet, PetPorte, PetSpecies } from '../data/types'

/**
 * Estimativa de porte pelo peso, para quando a clínica não informou.
 *
 * É **palpite explícito**, e o chamador precisa saber disso: um filhote de dogue alemão pesa
 * 10 kg e cai em "médio" aqui, quando é gigante. Serve para não deixar o paciente sem
 * qualificador nenhum; não serve para substituir o campo.
 *
 * Limites usuais da clínica de pequenos animais, em quilos.
 */
const LIMITES_DE_PORTE: { ate: number; porte: PetPorte }[] = [
  { ate: 6, porte: 'mini' },
  { ate: 15, porte: 'pequeno' },
  { ate: 25, porte: 'medio' },
  { ate: 45, porte: 'grande' },
  { ate: Number.POSITIVE_INFINITY, porte: 'gigante' },
]

/**
 * Porte só faz sentido clínico onde a variação intraespécie é grande o bastante para mudar a
 * referência. Em gato, ave e roedor a dispersão não justifica — e inventar porte para eles
 * criaria faixas que ninguém preencheria.
 */
export const ESPECIES_COM_PORTE: PetSpecies[] = ['canina']

export function porteDoPaciente(pet: Pick<Pet, 'especie' | 'porte' | 'pesoKg'>): PetPorte | null {
  if (!ESPECIES_COM_PORTE.includes(pet.especie)) {
    return null
  }

  /** O informado sempre vence: é o único que conhece a raça adulta. */
  if (pet.porte) {
    return pet.porte
  }

  if (pet.pesoKg === null) {
    return null
  }

  return LIMITES_DE_PORTE.find((limite) => pet.pesoKg! <= limite.ate)?.porte ?? null
}

/**
 * Idade em que o paciente passa a ser idoso, em meses.
 *
 * Cão grande envelhece antes — é o dado que mais surpreende quem vem da medicina humana, e é
 * por isso que a faixa etária depende do porte e não só da espécie.
 */
const IDOSO_EM_MESES: Record<PetPorte, number> = {
  mini: 132, // 11 anos
  pequeno: 120, // 10 anos
  medio: 96, // 8 anos
  grande: 84, // 7 anos
  gigante: 72, // 6 anos
}

const IDOSO_PADRAO_POR_ESPECIE: Partial<Record<PetSpecies, number>> = {
  felina: 132, // 11 anos
  canina: 96,
  equina: 180, // 15 anos
  ave: 96,
  roedor: 24,
  reptil: 120,
}

/** Fim da fase de filhote, em meses. Espécie pequena amadurece mais cedo. */
const FIM_DO_FILHOTE_EM_MESES: Partial<Record<PetSpecies, number>> = {
  canina: 12,
  felina: 12,
  ave: 6,
  roedor: 3,
  reptil: 24,
  equina: 36,
}

export function idadeEmMeses(nascimento: string | null, hoje: string): number | null {
  if (!nascimento) {
    return null
  }

  const nasceu = new Date(`${nascimento}T12:00:00Z`)
  const agora = new Date(`${hoje}T12:00:00Z`)

  if (Number.isNaN(nasceu.getTime()) || Number.isNaN(agora.getTime())) {
    return null
  }

  const meses =
    (agora.getUTCFullYear() - nasceu.getUTCFullYear()) * 12 +
    (agora.getUTCMonth() - nasceu.getUTCMonth()) -
    (agora.getUTCDate() < nasceu.getUTCDate() ? 1 : 0)

  return Math.max(meses, 0)
}

/**
 * Faixa etária do paciente.
 *
 * Devolve `null` quando o nascimento é desconhecido — e isso é resultado legítimo, não falha:
 * marcar consulta por telefone quase nunca tem a data exata, e chutar "adulto" faria a faixa
 * de referência julgar um filhote pela régua de um adulto.
 */
export function faixaEtariaDoPaciente(
  pet: Pick<Pet, 'especie' | 'porte' | 'pesoKg' | 'nascimento'>,
  hoje: string,
): FaixaEtaria | null {
  const meses = idadeEmMeses(pet.nascimento, hoje)

  if (meses === null) {
    return null
  }

  if (meses < (FIM_DO_FILHOTE_EM_MESES[pet.especie] ?? 12)) {
    return 'filhote'
  }

  const porte = porteDoPaciente(pet)
  const limite = porte
    ? IDOSO_EM_MESES[porte]
    : (IDOSO_PADRAO_POR_ESPECIE[pet.especie] ?? 96)

  return meses >= limite ? 'idoso' : 'adulto'
}
