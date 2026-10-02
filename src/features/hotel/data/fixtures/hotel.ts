/**
 * A casa: hotel, blocos, acomodações, tarifas, serviços, equipe e exigências.
 *
 * Tudo aqui é **cadastro da operação**, não constante de código — a tela de acomodações edita
 * estes mesmos dados. A fixture existe para que o protótipo abra com um hotel plausível, e não
 * para decidir como os hotéis são.
 *
 * O hotel opera no mesmo offset da clínica (`-04:00`) de propósito: quando os dois módulos
 * convivem numa casa só, uma diferença de fuso entre eles produziria um check-in às 8h que aparece
 * às 9h na agenda.
 */

import { CLINIC_UTC_OFFSET } from '@/features/clinico/data/fixtures'

import type {
  Acomodacao,
  Bloco,
  Cuidador,
  Exigencia,
  Hotel,
  Servico,
  Tarifa,
  Temporada,
  TipoDeAcomodacao,
} from '../types'

export const HOTEL_UTC_OFFSET = CLINIC_UTC_OFFSET

export const hotelFixture: Hotel = {
  id: 'hotel-petjourney',
  nome: 'PetJourney Hotel',
  endereco: 'Estrada do Campo Limpo, 2.140 — São Paulo/SP · CEP 05777-001',
  telefone: '(11) 3555-0188',
  utcOffset: HOTEL_UTC_OFFSET,
  politica: {
    /*
     * 12h de saída e 18h de limite: a janela larga entre os dois é deliberada. Quem volta de
     * viagem chega quando o voo deixa, e uma casa que cobra diária cheia às 12h01 troca a receita
     * de meia diária pela conversa mais azeda do balcão.
     */
    horarioDeSaida: '12:00',
    limiteMeiaDiaria: '18:00',
    meiaDiariaPercentual: 50,
    horarioDeEntrada: '08:00',
    sinalPercentual: 30,
    cancelamentoSemCustoDias: 7,
  },
}

export const blocosFixture: Bloco[] = [
  { id: 'bloco-canil-a', nome: 'Canil A', icone: 'cao', ordem: 1 },
  { id: 'bloco-canil-b', nome: 'Canil B', icone: 'cao', ordem: 2 },
  { id: 'bloco-gatil', nome: 'Gatil', icone: 'gato', ordem: 3 },
  { id: 'bloco-jardim', nome: 'Jardim', icone: 'arvore', ordem: 4 },
  { id: 'bloco-isolamento', nome: 'Isolamento', icone: 'escudo', ordem: 5 },
]

export const tarifasFixture: Tarifa[] = [
  {
    id: 'tarifa-padrao',
    nome: 'Padrão',
    diariaPorPorte: {
      mini: 7_900,
      pequeno: 8_900,
      medio: 10_900,
      grande: 13_900,
      gigante: 16_900,
    },
    acompanhantePercentual: 70,
  },
  {
    id: 'tarifa-suite',
    nome: 'Suíte',
    diariaPorPorte: {
      mini: 12_900,
      pequeno: 13_900,
      medio: 16_900,
      grande: 19_900,
      gigante: 23_900,
    },
    acompanhantePercentual: 70,
  },
  {
    id: 'tarifa-gatil',
    nome: 'Gatil',
    diariaPorPorte: {
      mini: 6_900,
      pequeno: 7_500,
      medio: 8_500,
      grande: 8_500,
      gigante: 8_500,
    },
    acompanhantePercentual: 60,
  },
]

/**
 * Temporadas, escritas como **mês e dia** e não como data.
 *
 * Uma fixture com `2026-12-20` cravado apresentaria "alta temporada" como um período que já passou
 * para quem abrir o protótipo em 2027. O seed materializa estas faixas para o ano de hoje — e
 * quebra a virada do ano em duas, porque uma temporada de 20 de dezembro a 5 de janeiro não é um
 * intervalo comparável por texto.
 */
export type TemporadaSazonal = Omit<Temporada, 'inicio' | 'fim'> & {
  /** `MM-DD`. */
  inicioMesDia: string
  /** `MM-DD`. Menor que o início significa que a faixa atravessa a virada do ano. */
  fimMesDia: string
}

export const temporadasFixture: TemporadaSazonal[] = [
  {
    id: 'temporada-fim-de-ano',
    nome: 'Fim de ano',
    inicioMesDia: '12-20',
    fimMesDia: '01-05',
    acrescimoPercentual: 35,
  },
  {
    id: 'temporada-julho',
    nome: 'Férias de julho',
    inicioMesDia: '07-01',
    fimMesDia: '07-31',
    acrescimoPercentual: 20,
  },
  {
    id: 'temporada-carnaval',
    nome: 'Carnaval',
    inicioMesDia: '02-10',
    fimMesDia: '02-20',
    acrescimoPercentual: 25,
  },
]

export const servicosFixture: Servico[] = [
  { id: 'servico-banho', kind: 'banho', precoCentavos: 8_900, porDiaria: false, ativo: true },
  { id: 'servico-tosa', kind: 'tosa', precoCentavos: 12_900, porDiaria: false, ativo: true },
  {
    id: 'servico-passeio',
    kind: 'passeio-extra',
    precoCentavos: 3_500,
    porDiaria: true,
    ativo: true,
  },
  {
    id: 'servico-recreacao',
    kind: 'recreacao-individual',
    precoCentavos: 4_500,
    porDiaria: true,
    ativo: true,
  },
  {
    id: 'servico-transporte',
    kind: 'transporte',
    precoCentavos: 6_900,
    porDiaria: false,
    ativo: true,
  },
  {
    id: 'servico-adestramento',
    kind: 'adestramento',
    precoCentavos: 9_900,
    porDiaria: true,
    ativo: true,
  },
  /*
   * Medicação assistida é serviço e não cortesia: dar remédio na hora certa a um animal que não
   * quer tomar custa tempo de alguém, e a casa que não cobra por isso acaba não fazendo direito.
   */
  {
    id: 'servico-medicacao',
    kind: 'medicacao-assistida',
    precoCentavos: 2_500,
    porDiaria: true,
    ativo: true,
  },
]

/**
 * Os tipos que esta casa cadastrou.
 *
 * Eram cinco palavras nossas numa união fechada do domínio. Viraram dado: é a casa que nomeia o
 * que ela tem, e quem hospeda aves ou coelhos cadastra os próprios nomes em vez de escolher entre
 * "baia" e "gatil". O que continua sendo nosso é só o desenho, que é vocabulário visual.
 */
export const tiposDeAcomodacaoFixture: TipoDeAcomodacao[] = [
  { id: 'tipo-baia', nome: 'Baia', icone: 'casa', ordem: 1 },
  { id: 'tipo-suite', nome: 'Suíte', icone: 'cama', ordem: 2 },
  { id: 'tipo-gatil', nome: 'Gatil', icone: 'gato', ordem: 3 },
  { id: 'tipo-coletiva', nome: 'Coletiva', icone: 'grupo', ordem: 4 },
  { id: 'tipo-isolamento', nome: 'Isolamento', icone: 'escudo', ordem: 5 },
]

export const acomodacoesFixture: Acomodacao[] = [
  // ------------------------------------------------------------------ Canil A · baias padrão
  ...['A1', 'A2', 'A3', 'A4', 'A5', 'A6'].map<Acomodacao>((nome, indice) => ({
    id: `acom-${nome.toLowerCase()}`,
    nome: `Baia ${nome}`,
    blocoId: 'bloco-canil-a',
    tipoId: 'tipo-baia',
    capacidade: 2,
    porteMaximo: indice < 2 ? 'gigante' : 'grande',
    especiesAceitas: ['canina'],
    recursos: indice < 2 ? ['climatizacao', 'area-externa'] : ['climatizacao'],
    higienizacaoMinutos: 90,
    tarifaId: 'tarifa-padrao',
    ativa: true,
    motivoInativa: null,
    detalheInativa: '',
    inativaDesde: null,
  })),

  // ------------------------------------------------------------------ Canil B · portes menores
  ...['B1', 'B2', 'B3', 'B4'].map<Acomodacao>((nome) => ({
    id: `acom-${nome.toLowerCase()}`,
    nome: `Baia ${nome}`,
    blocoId: 'bloco-canil-b',
    tipoId: 'tipo-baia',
    capacidade: 2,
    porteMaximo: 'medio',
    especiesAceitas: ['canina'],
    recursos: ['climatizacao', 'piso-aquecido'],
    higienizacaoMinutos: 60,
    tarifaId: 'tarifa-padrao',
    ativa: true,
    motivoInativa: null,
    detalheInativa: '',
    inativaDesde: null,
  })),

  // ------------------------------------------------------------------ Jardim · suítes
  ...['S1', 'S2', 'S3'].map<Acomodacao>((nome) => ({
    id: `acom-${nome.toLowerCase()}`,
    nome: `Suíte ${nome}`,
    blocoId: 'bloco-jardim',
    tipoId: 'tipo-suite',
    capacidade: 2,
    porteMaximo: 'gigante',
    especiesAceitas: ['canina'],
    recursos: ['camera', 'climatizacao', 'area-externa', 'janela'],
    higienizacaoMinutos: 120,
    tarifaId: 'tarifa-suite',
    ativa: true,
    motivoInativa: null,
    detalheInativa: '',
    inativaDesde: null,
  })),

  // ------------------------------------------------------------------ Gatil
  ...['G1', 'G2', 'G3', 'G4'].map<Acomodacao>((nome) => ({
    id: `acom-${nome.toLowerCase()}`,
    nome: `Gatil ${nome}`,
    blocoId: 'bloco-gatil',
    tipoId: 'tipo-gatil',
    capacidade: 2,
    porteMaximo: 'medio',
    /*
     * Gatil não aceita cão, e isto é dado e não comentário: um gato que ouve latido a noite inteira
     * não come, e a regra de vaga precisa recusar a oferta antes de a recepção fazê-la.
     */
    especiesAceitas: ['felina'],
    recursos: ['climatizacao', 'janela', 'piso-aquecido'],
    higienizacaoMinutos: 60,
    tarifaId: 'tarifa-gatil',
    ativa: true,
    motivoInativa: null,
    detalheInativa: '',
    inativaDesde: null,
  })),

  // ------------------------------------------------------------------ Convivência
  {
    id: 'acom-coletiva-1',
    nome: 'Convivência Norte',
    blocoId: 'bloco-jardim',
    tipoId: 'tipo-coletiva',
    capacidade: 4,
    porteMaximo: 'medio',
    especiesAceitas: ['canina'],
    recursos: ['area-externa'],
    /* Coletiva é lavada entre turnos, não entre hóspedes: a janela é zero de propósito. */
    higienizacaoMinutos: 0,
    tarifaId: 'tarifa-padrao',
    ativa: true,
    motivoInativa: null,
    detalheInativa: '',
    inativaDesde: null,
  },

  // ------------------------------------------------------------------ Isolamento
  {
    id: 'acom-iso-1',
    nome: 'Isolamento 1',
    blocoId: 'bloco-isolamento',
    tipoId: 'tipo-isolamento',
    capacidade: 1,
    porteMaximo: 'gigante',
    especiesAceitas: [],
    recursos: ['climatizacao'],
    higienizacaoMinutos: 240,
    tarifaId: 'tarifa-padrao',
    ativa: true,
    motivoInativa: null,
    detalheInativa: '',
    inativaDesde: null,
  },

  /*
   * Uma acomodação parada, de propósito.
   *
   * O protótipo precisa mostrar o estado "fora de operação" sem que alguém tenha que criá-lo à
   * mão — e precisa mostrar, junto, quanto tempo faz: parada há duas horas é manutenção, parada há
   * três semanas é uma vaga que a casa esqueceu que tinha. A data é reescrita pelo seed.
   */
  {
    id: 'acom-a7',
    nome: 'Baia A7',
    blocoId: 'bloco-canil-a',
    tipoId: 'tipo-baia',
    capacidade: 2,
    porteMaximo: 'grande',
    especiesAceitas: ['canina'],
    recursos: ['climatizacao'],
    higienizacaoMinutos: 90,
    tarifaId: 'tarifa-padrao',
    ativa: false,
    motivoInativa: 'reforma',
    detalheInativa: 'Troca do piso e do ralo',
    inativaDesde: null,
  },
]

export const cuidadoresFixture: Cuidador[] = [
  {
    id: 'eq-helena',
    nome: 'Helena Barros',
    iniciais: 'HB',
    funcao: 'gerente',
    corIndice: 0,
    ativo: true,
  },
  {
    id: 'eq-rafael',
    nome: 'Rafael Lima',
    iniciais: 'RL',
    funcao: 'cuidador',
    corIndice: 1,
    ativo: true,
  },
  {
    id: 'eq-tais',
    nome: 'Taís Moreira',
    iniciais: 'TM',
    funcao: 'cuidador',
    corIndice: 2,
    ativo: true,
  },
  {
    id: 'eq-caio',
    nome: 'Caio Prado',
    iniciais: 'CP',
    funcao: 'cuidador',
    corIndice: 3,
    ativo: true,
  },
  {
    id: 'eq-bruna',
    nome: 'Bruna Setti',
    iniciais: 'BS',
    funcao: 'recepcao',
    corIndice: 4,
    ativo: true,
  },
  {
    id: 'eq-igor',
    nome: 'Igor Salles',
    iniciais: 'IS',
    funcao: 'banhista',
    corIndice: 5,
    ativo: true,
  },
  {
    id: 'eq-vet',
    nome: 'Dra. Paula Ramos',
    iniciais: 'PR',
    funcao: 'veterinario',
    corIndice: 2,
    ativo: true,
  },
]

/**
 * O que esta casa exige para aceitar um hóspede.
 *
 * `bloqueia` separa o que é lei do que é boa prática. Tratar as duas como bloqueio faria o balcão
 * dispensar as duas com a mesma leveza — e dispensa que vira rotina deixa de ser decisão.
 */
export const exigenciasFixture: Exigencia[] = [
  {
    kind: 'vacina-antirrabica',
    especies: ['canina', 'felina'],
    validadeMeses: 12,
    bloqueia: true,
  },
  {
    kind: 'vacina-polivalente',
    especies: ['canina', 'felina'],
    validadeMeses: 12,
    bloqueia: true,
  },
  /* Tosse dos canis é só para cão, e é o motivo mais comum de recusa num hotel cheio. */
  { kind: 'vacina-tosse-canis', especies: ['canina'], validadeMeses: 12, bloqueia: true },
  { kind: 'vacina-giardia', especies: ['canina'], validadeMeses: 12, bloqueia: false },
  { kind: 'vermifugo', especies: ['canina', 'felina'], validadeMeses: 6, bloqueia: false },
  { kind: 'antipulgas', especies: ['canina', 'felina'], validadeMeses: 1, bloqueia: false },
  {
    kind: 'exame-parasitologico',
    especies: ['canina', 'felina'],
    validadeMeses: 6,
    bloqueia: false,
  },
  /* O termo não vence: assinado uma vez, vale enquanto o cadastro existir. */
  { kind: 'termo-responsabilidade', especies: [], validadeMeses: null, bloqueia: true },
]
