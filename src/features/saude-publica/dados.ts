/**
 * Os dados do protótipo de Saúde pública. **Ilustrativos**: simulam os 90 primeiros dias do
 * programa do Ofício 001/2026 em Campo Grande, para mostrar como o painel, as campanhas e o
 * relatório ficam. Nenhum número daqui é medido, a não ser os casos humanos de leishmaniose, que
 * são os da Sesau citados no ofício (`CONTEXTO_LEISHMANIOSE`).
 *
 * A geografia é a oficial até onde ela é certa: as 7 regiões urbanas e a posição de cada uma em
 * volta do Centro, e nomes de bairros da lista oficial. O protótipo não diz em que região fica cada
 * bairro (as fontes públicas se contradizem); o ranking de bairros é uma lista à parte.
 *
 * Tudo sem identificar ninguém: o painel só mostra contagens e percentuais, e bairro com menos de
 * `MINIMO_POR_BAIRRO` animais não aparece (LGPD, Lei nº 13.709/2018).
 */

/* ---------------------------------------------------------------------------- o período */

/** A simulação: 90 dias de programa, de 01/12/2026 a 28/02/2027. "Hoje" é o fim do período. */
export const PERIODO = {
  inicio: '2026-12-01',
  fim: '2027-02-28',
  hoje: '2027-02-28',
  dias: 90,
}

export const MINIMO_POR_BAIRRO = 20

/* ------------------------------------------------------------------------- os indicadores */

export type Indicador = 'antirrabica' | 'leishmaniose' | 'coleira' | 'castracao'

export type DefinicaoDoIndicador = {
  id: Indicador
  rotulo: string
  /** Como o indicador se lê numa frase: "com a antirrábica em dia". */
  frase: string
  icone: string
  publico: 'caes' | 'caes-e-gatos'
  /** O que conta como "em dia". */
  regra: string
}

export const INDICADORES: DefinicaoDoIndicador[] = [
  {
    id: 'leishmaniose',
    rotulo: 'Exame de leishmaniose',
    frase: 'cães com exame de leishmaniose em dia',
    icone: 'ph ph-test-tube',
    publico: 'caes',
    regra: 'Cães com exame nos últimos 12 meses.',
  },
  {
    id: 'coleira',
    rotulo: 'Coleira repelente',
    frase: 'cães com a coleira repelente no prazo',
    icone: 'ph ph-shield-check',
    publico: 'caes',
    regra: 'Cães com a coleira trocada dentro do prazo do fabricante.',
  },
  {
    id: 'antirrabica',
    rotulo: 'Antirrábica',
    frase: 'cães e gatos com a antirrábica em dia',
    icone: 'ph ph-syringe',
    publico: 'caes-e-gatos',
    regra: 'Cães e gatos com a dose dos últimos 12 meses.',
  },
  {
    id: 'castracao',
    rotulo: 'Castração',
    frase: 'cães e gatos castrados',
    icone: 'ph ph-gender-neuter',
    publico: 'caes-e-gatos',
    regra: 'Cães e gatos com a castração registrada.',
  },
]

export function indicador(id: Indicador) {
  return INDICADORES.find((item) => item.id === id)!
}

export type Cobertura = Record<Indicador, number>

/* ---------------------------------------------------------------------------- as regiões */

export type IdDaRegiao =
  | 'centro'
  | 'segredo'
  | 'prosa'
  | 'bandeira'
  | 'anhanduizinho'
  | 'lagoa'
  | 'imbirussu'

/** A posição da região em volta do Centro, como no mapa da cidade. */
export type Posicao = 'centro' | 'n' | 'ne' | 'se' | 's' | 'sw' | 'nw'

export type Regiao = {
  id: IdDaRegiao
  nome: string
  posicao: Posicao
  caes: number
  gatos: number
  tutores: number
  /** Percentual em dia, hoje (fim do período). */
  cobertura: Cobertura
  /** Percentual em dia no começo do programa. */
  inicio: Cobertura
}

export const REGIOES: Regiao[] = [
  {
    id: 'segredo',
    nome: 'Segredo',
    posicao: 'n',
    caes: 4680,
    gatos: 1720,
    tutores: 4720,
    cobertura: { antirrabica: 72, leishmaniose: 41, coleira: 49, castracao: 50 },
    inicio: { antirrabica: 65, leishmaniose: 29, coleira: 33, castracao: 46 },
  },
  {
    id: 'prosa',
    nome: 'Prosa',
    posicao: 'ne',
    caes: 3020,
    gatos: 1650,
    tutores: 3410,
    cobertura: { antirrabica: 83, leishmaniose: 56, coleira: 62, castracao: 68 },
    inicio: { antirrabica: 78, leishmaniose: 44, coleira: 49, castracao: 64 },
  },
  {
    id: 'bandeira',
    nome: 'Bandeira',
    posicao: 'se',
    caes: 4910,
    gatos: 2030,
    tutores: 5060,
    cobertura: { antirrabica: 77, leishmaniose: 46, coleira: 53, castracao: 57 },
    inicio: { antirrabica: 71, leishmaniose: 34, coleira: 38, castracao: 53 },
  },
  {
    id: 'anhanduizinho',
    nome: 'Anhanduizinho',
    posicao: 's',
    caes: 8240,
    gatos: 2910,
    tutores: 8030,
    cobertura: { antirrabica: 66, leishmaniose: 33, coleira: 39, castracao: 43 },
    inicio: { antirrabica: 58, leishmaniose: 19, coleira: 22, castracao: 39 },
  },
  {
    id: 'lagoa',
    nome: 'Lagoa',
    posicao: 'sw',
    caes: 5120,
    gatos: 1880,
    tutores: 5050,
    cobertura: { antirrabica: 69, leishmaniose: 36, coleira: 44, castracao: 46 },
    inicio: { antirrabica: 61, leishmaniose: 23, coleira: 26, castracao: 42 },
  },
  {
    id: 'imbirussu',
    nome: 'Imbirussu',
    posicao: 'nw',
    caes: 4130,
    gatos: 1460,
    tutores: 4040,
    cobertura: { antirrabica: 70, leishmaniose: 37, coleira: 45, castracao: 48 },
    inicio: { antirrabica: 63, leishmaniose: 25, coleira: 29, castracao: 44 },
  },
  {
    id: 'centro',
    nome: 'Centro',
    posicao: 'centro',
    caes: 1980,
    gatos: 1240,
    tutores: 2310,
    cobertura: { antirrabica: 85, leishmaniose: 58, coleira: 64, castracao: 73 },
    inicio: { antirrabica: 80, leishmaniose: 47, coleira: 51, castracao: 70 },
  },
]

/** Quantos animais contam para o indicador numa região (cães, ou cães e gatos). */
export function publicoDaRegiao(regiao: Pick<Regiao, 'caes' | 'gatos'>, id: Indicador) {
  return indicador(id).publico === 'caes' ? regiao.caes : regiao.caes + regiao.gatos
}

/** O percentual da cidade: a média das regiões pesada pelo público do indicador. */
export function coberturaDaCidade(id: Indicador, momento: 'cobertura' | 'inicio' = 'cobertura') {
  let soma = 0
  let total = 0
  for (const regiao of REGIOES) {
    const publico = publicoDaRegiao(regiao, id)
    soma += regiao[momento][id] * publico
    total += publico
  }
  return Math.round(soma / total)
}

export const TOTAIS = {
  caes: REGIOES.reduce((soma, regiao) => soma + regiao.caes, 0),
  gatos: REGIOES.reduce((soma, regiao) => soma + regiao.gatos, 0),
  tutores: REGIOES.reduce((soma, regiao) => soma + regiao.tutores, 0),
  /** Avisos de vacina, retorno e troca de coleira que os tutores receberam no período. */
  avisosEnviados: 61_840,
  /** Tutores que usam o plano completo dos 3 meses gratuitos. */
  planoCompleto: 27_310,
}

/* ---------------------------------------------------------------------------- os bairros */

export type Bairro = {
  nome: string
  caes: number
  gatos: number
  cobertura: Cobertura
}

/* Nomes da lista oficial de bairros; os números são ilustrativos. */
const BAIRROS_CRUS: [string, number, number, number, number, number, number][] = [
  // nome, cães, gatos, antirrábica, leishmaniose, coleira, castração
  ['Aero Rancho', 1460, 470, 61, 24, 31, 38],
  ['Nova Lima', 1390, 420, 64, 27, 35, 41],
  ['Los Angeles', 980, 310, 60, 22, 28, 37],
  ['Centro Oeste', 870, 290, 65, 29, 34, 42],
  ['Moreninha', 940, 330, 67, 31, 37, 44],
  ['Tiradentes', 720, 280, 71, 38, 45, 51],
  ['Coronel Antonino', 810, 300, 70, 35, 43, 47],
  ['Santo Amaro', 640, 210, 66, 30, 39, 45],
  ['Caiobá', 760, 260, 64, 28, 36, 43],
  ['Tijuca', 690, 250, 68, 33, 41, 46],
  ['Nova Campo Grande', 820, 280, 63, 26, 33, 40],
  ['Lageado', 610, 190, 59, 21, 27, 36],
  ['Jacy', 430, 150, 68, 34, 40, 45],
  ['Pioneiros', 700, 230, 65, 29, 36, 42],
  ['Universitário', 790, 310, 74, 42, 50, 54],
  ['Mata do Jacinto', 650, 260, 78, 47, 55, 60],
  ['Coophavila II', 560, 190, 66, 31, 38, 44],
  ['Guanandi', 620, 220, 67, 32, 39, 45],
  ['Centenário', 590, 200, 64, 27, 34, 41],
  ['São Conrado', 480, 170, 66, 30, 37, 43],
  ['Panamá', 520, 180, 69, 33, 42, 47],
  ['Batistão', 450, 160, 70, 35, 44, 48],
  ['Piratininga', 510, 170, 65, 28, 35, 42],
  ['Carandá', 380, 240, 86, 60, 66, 74],
  ['Jardim dos Estados', 260, 210, 88, 63, 69, 78],
  ['Chácara Cachoeira', 310, 220, 87, 61, 67, 76],
]

export const BAIRROS: Bairro[] = BAIRROS_CRUS.map(
  ([nome, caes, gatos, antirrabica, leishmaniose, coleira, castracao]) => ({
    nome,
    caes,
    gatos,
    cobertura: { antirrabica, leishmaniose, coleira, castracao },
  }),
).filter((bairro) => bairro.caes + bairro.gatos >= MINIMO_POR_BAIRRO)

/* ------------------------------------------------------------------- o contexto da doença */

/** Casos humanos de leishmaniose visceral em Campo Grande: Sesau, citados no Ofício 001/2026. */
export const CONTEXTO_LEISHMANIOSE = {
  fonte: 'Secretaria Municipal de Saúde (Sesau), citada no Ofício 001/2026',
  anos: [
    { ano: 2025, casos: 39, obitos: 4, observacao: 'ano inteiro' },
    { ano: 2026, casos: 30, obitos: null as number | null, observacao: 'até outubro' },
  ],
}

/* ---------------------------------------------------------------------------- campanhas */

export type TipoDeCampanha = 'antirrabica' | 'castracao' | 'encoleiramento' | 'exame'

export type DefinicaoDoTipo = {
  id: TipoDeCampanha
  rotulo: string
  icone: string
  tom: 'pets' | 'clinica' | 'hotel' | 'portal'
  /** Quem recebe o aviso: o indicador que está pendente. */
  publicoAlvo: string
  indicador: Indicador
  /** O texto que o tutor recebe, com {data} e {local}. */
  aviso: string
}

export const TIPOS_DE_CAMPANHA: DefinicaoDoTipo[] = [
  {
    id: 'antirrabica',
    rotulo: 'Vacinação antirrábica',
    icone: 'ph ph-syringe',
    tom: 'clinica',
    publicoAlvo: 'Tutores de cães e gatos com a antirrábica vencida',
    indicador: 'antirrabica',
    aviso:
      'Campanha de vacinação antirrábica gratuita no seu bairro: {data}, em {local}. Leve a carteirinha do pet ou abra o app.',
  },
  {
    id: 'encoleiramento',
    rotulo: 'Encoleiramento',
    icone: 'ph ph-shield-check',
    tom: 'pets',
    publicoAlvo: 'Tutores de cães sem a coleira repelente no prazo',
    indicador: 'coleira',
    aviso:
      'A coleira repelente protege seu cão da leishmaniose. Encoleiramento gratuito: {data}, em {local}.',
  },
  {
    id: 'exame',
    rotulo: 'Exame de leishmaniose',
    icone: 'ph ph-test-tube',
    tom: 'portal',
    publicoAlvo: 'Tutores de cães sem exame nos últimos 12 meses',
    indicador: 'leishmaniose',
    aviso: 'Mutirão de exame de leishmaniose para cães: {data}, em {local}. É rápido e gratuito.',
  },
  {
    id: 'castracao',
    rotulo: 'Castração',
    icone: 'ph ph-gender-neuter',
    tom: 'hotel',
    publicoAlvo: 'Tutores de cães e gatos não castrados',
    indicador: 'castracao',
    aviso:
      'Castração gratuita para cães e gatos: {data}, em {local}. Vagas limitadas, confirme pelo app.',
  },
]

export function tipoDeCampanha(id: TipoDeCampanha) {
  return TIPOS_DE_CAMPANHA.find((tipo) => tipo.id === id)!
}

export type SituacaoDaCampanha = 'agendada' | 'encerrada'

export type Campanha = {
  id: string
  tipo: TipoDeCampanha
  titulo: string
  regioes: IdDaRegiao[]
  /** AAAA-MM-DD */
  data: string
  local: string
  situacao: SituacaoDaCampanha
  avisados: number
  /** Tutores que abriram o aviso no app. */
  abriram: number
  /** Animais atendidos (só depois de encerrada). */
  atendidos: number | null
}

export const CAMPANHAS: Campanha[] = [
  {
    id: 'c4',
    tipo: 'exame',
    titulo: 'Mutirão de exame de leishmaniose',
    regioes: ['anhanduizinho'],
    data: '2027-03-20',
    local: 'Ponto de atendimento do Aero Rancho',
    situacao: 'agendada',
    avisados: 5520,
    abriram: 2870,
    atendidos: null,
  },
  {
    id: 'c3',
    tipo: 'encoleiramento',
    titulo: 'Encoleiramento contra a leishmaniose',
    regioes: ['lagoa', 'imbirussu'],
    data: '2027-03-13',
    local: 'Pontos de atendimento da Lagoa e do Imbirussu',
    situacao: 'agendada',
    avisados: 5140,
    abriram: 3010,
    atendidos: null,
  },
  {
    id: 'c2',
    tipo: 'antirrabica',
    titulo: 'Vacinação antirrábica',
    regioes: ['anhanduizinho', 'bandeira'],
    data: '2027-01-23',
    local: 'Pontos de vacinação do Anhanduizinho e do Bandeira',
    situacao: 'encerrada',
    avisados: 4380,
    abriram: 2960,
    atendidos: 2140,
  },
  {
    id: 'c1',
    tipo: 'castracao',
    titulo: 'Castração gratuita',
    regioes: ['segredo'],
    data: '2026-12-12',
    local: 'Centro de Controle de Zoonoses',
    situacao: 'encerrada',
    avisados: 2210,
    abriram: 1480,
    atendidos: 386,
  },
]

/**
 * Quem receberia o aviso de uma campanha: os tutores das regiões com o indicador pendente. Um tutor
 * por animal pendente é a estimativa (há quem tenha mais de um, e o app avisa uma vez só).
 */
export function alcanceEstimado(tipo: TipoDeCampanha, regioes: IdDaRegiao[]) {
  const id = tipoDeCampanha(tipo).indicador
  let animais = 0
  let tutores = 0
  for (const regiao of REGIOES.filter((item) => regioes.includes(item.id))) {
    const pendentes = Math.round(publicoDaRegiao(regiao, id) * (1 - regiao.cobertura[id] / 100))
    animais += pendentes
    tutores += Math.round(pendentes * (regiao.tutores / (regiao.caes + regiao.gatos)))
  }
  return { animais, tutores }
}

/* ------------------------------------------------------------------------ ONGs e adoção */

export type Ong = {
  id: string
  nome: string
  tipo: 'ONG' | 'Protetor independente'
  regiao: IdDaRegiao
  animais: number
  adocoes: number
}

/* Nomes de exemplo, para o protótipo. */
export const ONGS: Ong[] = [
  {
    id: 'o1',
    nome: 'Abrigo Ipê (exemplo)',
    tipo: 'ONG',
    regiao: 'anhanduizinho',
    animais: 84,
    adocoes: 17,
  },
  { id: 'o2', nome: 'Lar Sabiá (exemplo)', tipo: 'ONG', regiao: 'lagoa', animais: 61, adocoes: 12 },
  {
    id: 'o3',
    nome: 'Patas da Vila (exemplo)',
    tipo: 'ONG',
    regiao: 'segredo',
    animais: 47,
    adocoes: 9,
  },
  {
    id: 'o4',
    nome: 'Refúgio Pequi (exemplo)',
    tipo: 'ONG',
    regiao: 'imbirussu',
    animais: 39,
    adocoes: 8,
  },
  {
    id: 'o5',
    nome: 'Protetora A. M. (exemplo)',
    tipo: 'Protetor independente',
    regiao: 'bandeira',
    animais: 18,
    adocoes: 6,
  },
  {
    id: 'o6',
    nome: 'Protetor J. R. (exemplo)',
    tipo: 'Protetor independente',
    regiao: 'prosa',
    animais: 12,
    adocoes: 4,
  },
]

export type RegistroDoHistorico = {
  tipo: 'vacina' | 'exame' | 'castracao' | 'coleira' | 'vermifugo'
  texto: string
  /** AAAA-MM-DD */
  data: string
}

export type AnimalDaOng = {
  id: string
  nome: string
  especie: 'CACHORRO' | 'GATO'
  idade: string
  ongId: string
  historico: RegistroDoHistorico[]
}

export const ANIMAIS_DAS_ONGS: AnimalDaOng[] = [
  {
    id: 'a1',
    nome: 'Canela',
    especie: 'CACHORRO',
    idade: '2 anos',
    ongId: 'o1',
    historico: [
      { tipo: 'vacina', texto: 'V10, 3 doses', data: '2026-12-18' },
      { tipo: 'vacina', texto: 'Antirrábica', data: '2026-12-18' },
      { tipo: 'exame', texto: 'Leishmaniose: negativo', data: '2027-01-08' },
      { tipo: 'castracao', texto: 'Castrada', data: '2027-01-15' },
      { tipo: 'coleira', texto: 'Coleira repelente', data: '2027-02-02' },
    ],
  },
  {
    id: 'a2',
    nome: 'Biscoito',
    especie: 'CACHORRO',
    idade: '8 meses',
    ongId: 'o1',
    historico: [
      { tipo: 'vacina', texto: 'V10, 2 de 3 doses', data: '2027-02-10' },
      { tipo: 'vermifugo', texto: 'Vermífugo', data: '2027-02-10' },
      { tipo: 'exame', texto: 'Leishmaniose: negativo', data: '2027-02-12' },
    ],
  },
  {
    id: 'a3',
    nome: 'Mingau',
    especie: 'GATO',
    idade: '1 ano',
    ongId: 'o2',
    historico: [
      { tipo: 'vacina', texto: 'V4 felina, 2 doses', data: '2027-01-20' },
      { tipo: 'vacina', texto: 'Antirrábica', data: '2027-01-20' },
      { tipo: 'castracao', texto: 'Castrado', data: '2027-02-03' },
    ],
  },
  {
    id: 'a4',
    nome: 'Tapioca',
    especie: 'CACHORRO',
    idade: '4 anos',
    ongId: 'o3',
    historico: [
      { tipo: 'vacina', texto: 'V10 e antirrábica', data: '2027-01-05' },
      { tipo: 'exame', texto: 'Leishmaniose: negativo', data: '2027-01-05' },
      { tipo: 'castracao', texto: 'Castrada', data: '2027-01-12' },
      { tipo: 'coleira', texto: 'Coleira repelente', data: '2027-01-12' },
    ],
  },
]

export type Adocao = {
  id: string
  animal: string
  especie: 'CACHORRO' | 'GATO'
  ongId: string
  /** Só as iniciais: o painel não identifica o adotante. */
  adotante: string
  /** AAAA-MM-DD */
  data: string
  registros: number
}

export const ADOCOES: Adocao[] = [
  {
    id: 'd1',
    animal: 'Pipoca',
    especie: 'CACHORRO',
    ongId: 'o1',
    adotante: 'M. S.',
    data: '2027-02-24',
    registros: 6,
  },
  {
    id: 'd2',
    animal: 'Frida',
    especie: 'GATO',
    ongId: 'o2',
    adotante: 'R. L.',
    data: '2027-02-21',
    registros: 4,
  },
  {
    id: 'd3',
    animal: 'Tobias',
    especie: 'CACHORRO',
    ongId: 'o3',
    adotante: 'A. P.',
    data: '2027-02-17',
    registros: 5,
  },
  {
    id: 'd4',
    animal: 'Nina',
    especie: 'CACHORRO',
    ongId: 'o4',
    adotante: 'C. F.',
    data: '2027-02-11',
    registros: 5,
  },
  {
    id: 'd5',
    animal: 'Paçoca',
    especie: 'GATO',
    ongId: 'o5',
    adotante: 'J. B.',
    data: '2027-02-06',
    registros: 3,
  },
  {
    id: 'd6',
    animal: 'Thor',
    especie: 'CACHORRO',
    ongId: 'o1',
    adotante: 'L. A.',
    data: '2027-01-29',
    registros: 6,
  },
]

export function ong(id: string) {
  return ONGS.find((item) => item.id === id)!
}

export function regiao(id: IdDaRegiao) {
  return REGIOES.find((item) => item.id === id)!
}

/* ---------------------------------------------------------------------------- formatação */

const NUMERO = new Intl.NumberFormat('pt-BR')

export function numero(valor: number) {
  return NUMERO.format(valor)
}

/** `AAAA-MM-DD` como 23/01/2027, sem passar pelo fuso. */
export function dataCurta(valor: string) {
  const [ano, mes, dia] = valor.split('-')
  return `${dia}/${mes}/${ano}`
}

/** `AAAA-MM-DD` como "sáb., 23 de jan." */
export function dataPorExtenso(valor: string) {
  const [ano, mes, dia] = valor.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(Date.UTC(ano!, mes! - 1, dia!))
}
