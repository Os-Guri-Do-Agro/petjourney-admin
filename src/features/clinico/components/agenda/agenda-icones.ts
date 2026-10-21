/**
 * Ícones que a grade do dia e a tabela do dia usam do mesmo jeito.
 *
 * Fonte única para as duas vistas: o losango da alergia na tabela tem de ser o mesmo losango no
 * cartão da linha do tempo, senão a recepção aprende dois vocabulários para a mesma coisa.
 */
import {
  PhBaby,
  PhHandPalm,
  PhHeartbeat,
  PhPill,
  PhShieldWarning,
  PhWallet,
  PhWarningDiamond,
} from '@phosphor-icons/vue'
import type { Component } from 'vue'

import type { Appointment, BlockReason, PetAlertKind } from '../../data/types'

/** Risco do paciente, por categoria — como na lista de pacientes. Vai em peso cheio. */
export const ICONE_DO_ALERTA: Record<PetAlertKind, Component> = {
  alergia: PhWarningDiamond,
  agressivo: PhHandPalm,
  cronico: PhHeartbeat,
  'medicacao-continua': PhPill,
  imunossuprimido: PhShieldWarning,
  gestante: PhBaby,
  inadimplente: PhWallet,
}

/**
 * A origem que vira ícone: só a de quem marcou sozinho, pelo app ou pelo link da clínica. As
 * outras são a própria recepção, e marcá-las em todo atendimento seria textura.
 */
export const ICONE_DA_ORIGEM: Partial<Record<Appointment['origem'], string>> = {
  app: 'ph ph-device-mobile',
  link: 'ph ph-globe-simple',
}

/**
 * Uma marca do cartão de atendimento (risco, aviso, estado, origem, tipo), como o grupo de marcas
 * (`AgendaCartaoMarcas`) a recebe: a chave, o nome por escrito para o "+N" e, se for o caso, o tom
 * de gravidade que o "+N" herda quando ela fica escondida.
 */
export type MarcaDaAgenda = {
  chave: string
  rotulo: string
  tom?: 'risco' | 'atencao'
}

/** O motivo do bloqueio também tem cara: almoço se reconhece pelo garfo antes de se ler. */
export const ICONE_DO_BLOQUEIO: Record<BlockReason, string> = {
  almoco: 'ph ph-fork-knife',
  reuniao: 'ph ph-users-three',
  ferias: 'ph ph-airplane-tilt',
  manutencao: 'ph ph-wrench',
  'bloqueio-pessoal': 'ph ph-lock-simple',
  feriado: 'ph ph-calendar-x',
}
