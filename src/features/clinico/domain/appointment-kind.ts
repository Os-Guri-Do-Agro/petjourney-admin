/**
 * Aparência do tipo de atendimento: ícone e acento de cor.
 *
 * Fonte única. O card da grade, a legenda e qualquer lista que mostre tipo leem daqui — dois
 * mapas separados divergem na primeira vez que alguém acrescenta um tipo, e aí a legenda passa
 * a explicar uma cor que a grade não usa mais.
 *
 * **O ícone não é enfeite: é o que torna a codificação legível sem depender de cor.** Sete
 * acentos pastel a 3 px de largura são indistinguíveis em escala de cinza, e a clínica tem
 * gente que não os distingue nem em cor. Cor localiza de relance, ícone confirma, nome resolve.
 *
 * O acento é sempre `var(--clinic-tipo-*)`, nunca cor literal: o módulo troca a paleta inteira
 * no tema escuro.
 */

import type { AppointmentTypeKind } from '../data/types'

export type AparenciaDoTipo = {
  /** Classe do Phosphor (fonte `@phosphor-icons/web`, peso regular). */
  icone: string
  /** Token CSS do acento — `var(...)` pronto para ir ao `style`. */
  cor: string
}

/**
 * Ícones escolhidos para não colidirem com os que já marcam **estado** no card: o triângulo é
 * alerta de risco do paciente, o círculo com exclamação é conflito, o elo é atendimento em
 * duas salas. Tipo de atendimento não pode usar nenhum dos três.
 */
const APARENCIA: Record<AppointmentTypeKind, AparenciaDoTipo> = {
  consulta: { icone: 'ph ph-heart', cor: 'var(--clinic-tipo-consulta)' },
  retorno: { icone: 'ph ph-arrow-counter-clockwise', cor: 'var(--clinic-tipo-retorno)' },
  vacina: { icone: 'ph ph-shield', cor: 'var(--clinic-tipo-vacina)' },
  exame: { icone: 'ph ph-magnifying-glass', cor: 'var(--clinic-tipo-exame)' },
  cirurgia: { icone: 'ph ph-plus-circle', cor: 'var(--clinic-tipo-cirurgia)' },
  banho: { icone: 'ph ph-sparkle', cor: 'var(--clinic-tipo-banho)' },
  emergencia: { icone: 'ph ph-lightning', cor: 'var(--clinic-tipo-emergencia)' },
}

/** Ordem da legenda: rotina primeiro, procedimento depois, emergência por último. */
export const TIPOS_EM_ORDEM: AppointmentTypeKind[] = [
  'consulta',
  'retorno',
  'vacina',
  'exame',
  'cirurgia',
  'banho',
  'emergencia',
]

/**
 * Aparência de um tipo. Aceita `null` porque o card pode renderizar antes de o catálogo
 * chegar — nesse instante o tipo é desconhecido e o acento cai no neutro, sem ícone falso.
 */
export function aparenciaDoTipo(kind: AppointmentTypeKind | null | undefined): AparenciaDoTipo {
  if (!kind || !(kind in APARENCIA)) {
    return { icone: '', cor: 'var(--clinic-line-strong)' }
  }

  return APARENCIA[kind]
}
