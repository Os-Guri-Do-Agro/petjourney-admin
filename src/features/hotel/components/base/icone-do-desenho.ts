import type { IconeDeAcomodacao } from '../../data/types'

/**
 * O traço de cada desenho que a casa escolhe para um corredor ou um tipo de acomodação.
 *
 * `Record<…>` fechado: acrescentar um desenho ao domínio sem dar ícone a ele passa a ser erro de
 * compilação, e não um quadrado vazio descoberto em produção. O nome do tipo e do corredor é
 * cadastro da casa; o que continua nosso é a biblioteca de formas entre as quais ela escolhe.
 */
export const ICONE_DO_DESENHO: Record<IconeDeAcomodacao, string> = {
  casa: 'ph ph-house-line',
  cama: 'ph ph-bed',
  gato: 'ph ph-cat',
  cao: 'ph ph-dog',
  grupo: 'ph ph-users-three',
  escudo: 'ph ph-shield-check',
  arvore: 'ph ph-tree',
  passaro: 'ph ph-bird',
  coelho: 'ph ph-rabbit',
}
