/**
 * Pet e responsável são **cadastro da casa**, não do módulo.
 *
 * O mesmo labrador que se consulta na clínica é o que se hospeda no hotel, e o mesmo telefone é o
 * que se liga quando ele não come. Um segundo cadastro aqui criaria duas fichas do mesmo animal
 * que divergem no terceiro mês — e a segunda seria a que está desatualizada justamente no dia em
 * que alguém precisa do contato de emergência.
 *
 * Por isso o hotel **lê** o cadastro existente em vez de o duplicar. Quando a API chegar, os dois
 * módulos passam a ler o mesmo endpoint, e esta indireção é o ponto em que isso acontece: nada
 * mais no hotel importa `features/clinico`.
 */

export { petsFixture, tutorsFixture } from '@/features/clinico/data/fixtures/people'
export type { Pet, Tutor } from '@/features/clinico/data/types'
