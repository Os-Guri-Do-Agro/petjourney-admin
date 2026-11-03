/**
 * Como um acesso aparece numa lista: o ícone do serviço e a silhueta do avatar do pet. A tela de
 * Acessos e as áreas do Portal no Início desenham a mesma linha, com o mesmo ícone.
 */
import type { PetSpecies } from '@/features/clinico/data/types'
import type { TipoServicoPrestador } from '@/service/parceiro/types'

/** A silhueta do avatar: só cão e gato têm desenho, o resto fica nas iniciais. */
export const ESPECIE_DO_AVATAR: Partial<Record<string, PetSpecies>> = {
  CACHORRO: 'canina',
  GATO: 'felina',
  AVE: 'ave',
  ROEDOR: 'roedor',
  REPTIL: 'reptil',
}

/** O mesmo ícone do serviço que a folha da anotação usa. */
export const ICONE_DO_SERVICO: Record<TipoServicoPrestador, string> = {
  CONSULTA: 'ph ph-stethoscope',
  EXAME: 'ph ph-microscope',
  BANHO: 'ph ph-drop',
  TOSA: 'ph ph-scissors',
  HOTEL: 'ph ph-bed',
  OUTRO: 'ph ph-paw-print',
}
