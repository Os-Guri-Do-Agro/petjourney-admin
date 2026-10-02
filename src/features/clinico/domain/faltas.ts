/**
 * O que a clínica faz — e deixa de fazer — depois de saber por que o paciente não veio.
 *
 * O módulo existe por causa de um motivo só. Quase toda justificativa de falta **continua** a
 * conversa: quem esqueceu recebe lembrete, quem não teve transporte recebe um horário no fim da
 * tarde, quem achou caro recebe um orçamento. O óbito faz o contrário — ele encerra —, e é o
 * único caso em que insistir não é ineficiência, é crueldade.
 *
 * Por isso a regra mora aqui e não espalhada em `v-if` pelas telas: são três lugares que
 * precisam concordar (a agenda ao marcar a falta, o painel ao listar, o diálogo ao escrever a
 * mensagem), e um `motivo === 'obito'` esquecido em qualquer um deles é a clínica perguntando a
 * um responsável de luto por que ele não apareceu.
 */

import type { Appointment, JustificativaDeFalta } from '../data/types'

/**
 * Este motivo encerra o caso?
 *
 * Hoje só o óbito. A função existe em vez da comparação direta para que o dia em que houver um
 * segundo motivo terminal — transferência definitiva para outra clínica, por exemplo — ele entre
 * num lugar só, e não em cada tela que hoje lembra de testar.
 */
export function motivoEncerraOCaso(motivo: JustificativaDeFalta['motivo']): boolean {
  return motivo === 'obito'
}

/**
 * Esta falta ainda comporta oferecer um novo horário?
 *
 * Falta sem motivo comporta: ninguém sabe ainda o que houve, e a remarcação é justamente o que
 * se oferece ao ligar. O que não comporta é a falta já apurada como óbito.
 */
export function aceitaReagendamento(appointment: Appointment): boolean {
  const justificativa = appointment.justificativaDeFalta

  return !justificativa || !motivoEncerraOCaso(justificativa.motivo)
}
