import type { PoliticaDaClinica } from '../../contrato/responsavel'
import type { AppointmentType, Clinic, Professional, Room } from '../types'

/**
 * A clínica opera em `-04:00`. O offset é dado, não inferido do navegador: quem abre o portal
 * de outro fuso precisa ler o mesmo 09:00 que está escrito na porta da sala.
 */
export const CLINIC_UTC_OFFSET = '-04:00'

export const clinicFixture: Clinic = {
  id: 'clinic-petjourney',
  nome: 'PetJourney Clínica Veterinária',
  endereco: 'Rua das Acácias, 421 — Vila Madalena, São Paulo/SP · CEP 05435-020',
  telefone: '(11) 3555-0142',
  utcOffset: CLINIC_UTC_OFFSET,
  slotMinutos: 15,
  horarios: [
    { weekday: 0, fechado: true, expediente: { inicio: '00:00', fim: '00:00' }, almoco: null },
    {
      weekday: 1,
      fechado: false,
      expediente: { inicio: '08:00', fim: '19:00' },
      almoco: { inicio: '12:00', fim: '13:00' },
    },
    {
      weekday: 2,
      fechado: false,
      expediente: { inicio: '08:00', fim: '19:00' },
      almoco: { inicio: '12:00', fim: '13:00' },
    },
    {
      weekday: 3,
      fechado: false,
      expediente: { inicio: '08:00', fim: '19:00' },
      almoco: { inicio: '12:00', fim: '13:00' },
    },
    {
      weekday: 4,
      fechado: false,
      expediente: { inicio: '08:00', fim: '19:00' },
      almoco: { inicio: '12:00', fim: '13:00' },
    },
    {
      weekday: 5,
      fechado: false,
      expediente: { inicio: '08:00', fim: '19:00' },
      almoco: { inicio: '12:00', fim: '13:00' },
    },
    {
      weekday: 6,
      fechado: false,
      expediente: { inicio: '08:00', fim: '13:00' },
      almoco: null,
    },
  ],
  /**
   * Feriados relativos ao ano corrente são materializados no seed — data fixa aqui morreria
   * na virada do ano. Estes são os de referência para o caso difícil de dia fechado.
   */
  feriados: [],
}

/**
 * Os prazos que a clínica combina com quem marca pelo app.
 *
 * Configuração da clínica, não do app: é ela que sabe quanto antes consegue reaproveitar um
 * horário cancelado. O app recebe estes números pelo contrato e nunca os fixa. A oferta de vaga
 * é de 30 minutos — as conversas com o time do app falavam em 15, e o número que vale é o daqui.
 */
export const politicaDaClinicaFixture: PoliticaDaClinica = {
  cancelarAteHorasAntes: 2,
  reservaMinutos: 5,
  preConsultaAbreHorasAntes: 72,
  ofertaDeVagaMinutos: 30,
}

export const professionalsFixture: Professional[] = [
  {
    id: 'prof-ana',
    nome: 'Ana Ribeiro',
    iniciais: 'AR',
    conselho: 'CRMV-SP 41208',
    especialidade: 'clinicaGeral',
    corIndice: 0,
    salaPadraoId: 'sala-1',
    ativo: true,
  },
  {
    id: 'prof-caio',
    nome: 'Caio Nogueira',
    iniciais: 'CN',
    conselho: 'CRMV-SP 39877',
    especialidade: 'cirurgia',
    corIndice: 1,
    salaPadraoId: 'sala-cirurgia',
    ativo: true,
  },
  {
    id: 'prof-helena',
    nome: 'Helena Vasconcelos Prado',
    iniciais: 'HP',
    conselho: 'CRMV-SP 45610',
    especialidade: 'dermatologia',
    corIndice: 2,
    salaPadraoId: 'sala-2',
    ativo: true,
  },
  {
    id: 'prof-tiago',
    nome: 'Tiago Sá',
    iniciais: 'TS',
    conselho: 'CRMV-SP 50133',
    especialidade: 'cardiologia',
    corIndice: 3,
    salaPadraoId: 'sala-3',
    ativo: true,
  },
  {
    id: 'prof-marcia',
    nome: 'Márcia Do Espírito Santo Albuquerque',
    iniciais: 'MA',
    conselho: 'CRMV-SP 33914',
    especialidade: 'anestesiologia',
    corIndice: 4,
    salaPadraoId: 'sala-cirurgia',
    ativo: true,
  },
]

export const roomsFixture: Room[] = [
  { id: 'sala-1', nome: 'Consultório 1', kind: 'consultorio' },
  { id: 'sala-2', nome: 'Consultório 2', kind: 'consultorio' },
  { id: 'sala-3', nome: 'Consultório 3', kind: 'consultorio' },
  { id: 'sala-cirurgia', nome: 'Centro cirúrgico', kind: 'cirurgia' },
  { id: 'sala-recuperacao', nome: 'Recuperação', kind: 'internacao' },
  /*
   * O isolamento é sala à parte, e não um leito marcado dentro da recuperação.
   *
   * Parvovirose e felino com coriza não dividem ar com pós-cirúrgico, e uma clínica que
   * representa isolamento como "a jaula do canto" acaba oferecendo a vaga errada quando o
   * mapa aperta — que é justamente quando ele mais aperta.
   */
  { id: 'sala-isolamento', nome: 'Isolamento', kind: 'internacao' },
  { id: 'sala-banho', nome: 'Banho e tosa', kind: 'banho' },
  { id: 'sala-exame', nome: 'Imagem', kind: 'exame' },
]

export const appointmentTypesFixture: AppointmentType[] = [
  {
    id: 'tipo-consulta',
    nome: 'Consulta',
    duracaoMinutos: 30,
    kind: 'consulta',
    salasCompativeis: ['consultorio'],
    permiteEncaixe: true,
  },
  {
    id: 'tipo-retorno',
    nome: 'Retorno',
    duracaoMinutos: 20,
    kind: 'retorno',
    salasCompativeis: ['consultorio'],
    permiteEncaixe: true,
  },
  {
    id: 'tipo-vacina',
    nome: 'Vacinação',
    duracaoMinutos: 15,
    kind: 'vacina',
    salasCompativeis: ['consultorio'],
    permiteEncaixe: true,
  },
  {
    id: 'tipo-exame',
    nome: 'Exame de imagem',
    duracaoMinutos: 45,
    kind: 'exame',
    salasCompativeis: ['exame'],
    permiteEncaixe: false,
  },
  {
    id: 'tipo-cirurgia',
    nome: 'Cirurgia',
    duracaoMinutos: 120,
    kind: 'cirurgia',
    salasCompativeis: ['cirurgia', 'internacao'],
    permiteEncaixe: false,
  },
  {
    id: 'tipo-banho',
    nome: 'Banho e tosa',
    duracaoMinutos: 90,
    kind: 'banho',
    salasCompativeis: ['banho'],
    permiteEncaixe: true,
  },
  {
    id: 'tipo-emergencia',
    nome: 'Emergência',
    duracaoMinutos: 40,
    kind: 'emergencia',
    salasCompativeis: [],
    permiteEncaixe: true,
  },
]
