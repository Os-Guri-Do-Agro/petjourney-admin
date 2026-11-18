/**
 * O que o app do responsável mostra à clínica (leitura com consentimento): o Diário Pet, o peso de
 * casa, a carteirinha e o "este pet em 30 segundos". Só para paciente com vínculo ativo (`noApp`).
 *
 * O diário sai de um gerador por espécie (90 dias, com a frequência de cada família) e, por cima
 * dele, as histórias dos pets que a apresentação mostra: a Duna cardiopata tossindo à noite, a Cacau
 * com a hérnia mancando, a Mel gestante comendo mais, o Biscoito filhote crescendo, a Pérola com bola
 * de pelo. Cada história fica nos dias antes de hoje, para o resumo da consulta de hoje.
 *
 * Exporta `diarioDe`, `pesosDeCasa`, `carteirinhaDe` e `resumoDe` (as formas da API) e
 * `ultimaConsultaDe` (o último atendimento finalizado, que começa a janela do resumo).
 */
import type {
  CarteirinhaParaClinica,
  EntradaDoDiario,
  ResumoDoPaciente,
  SinalDoResumo,
} from '@/service/parceiro/leitura-do-app-service'

import { criarSorteio, type Sorteio } from '../aleatorio'
import { agendamentosDoPaciente } from '../base/agenda'
import { paciente, type PacienteDaDemo } from '../base/cadastro'
import { PARCEIRO_NOME } from '../base/clinica'
import { agoraIso, diasEntre, hoje, instante, jaPassou, somarDias, somarMinutos } from '../relogio'

type Campo = 'vitalidade' | 'alimentacao' | 'hidratacao' | 'fezes' | 'urina'
type Sintoma = EntradaDoDiario['sintomas'][number]

export const DIAS_DO_DIARIO = 90

/* ------------------------------------------------------------------------------- histórias */

type Marca = {
  dias: number
  vitalidade?: EntradaDoDiario['vitalidade']
  alimentacao?: EntradaDoDiario['alimentacao']
  hidratacao?: EntradaDoDiario['hidratacao']
  fezes?: EntradaDoDiario['fezes']
  urina?: EntradaDoDiario['urina']
  sintomas?: Sintoma[]
  doencas?: EntradaDoDiario['doencas']
  temperamento?: EntradaDoDiario['temperamento']
  observacoes?: string
  remedios?: string
  nota?: string
  foto?: boolean
}

type Historia = {
  /** Fração dos dias com registro (o responsável que preenche quase todo dia). */
  frequencia: number
  marcas: Marca[]
  /** Peso de casa: [dias atrás, kg]. */
  pesos: Array<[number, number]>
}

const HISTORIAS: Record<string, Historia> = {
  /* Duna, cavalier com doença valvar: tosse à noite e uma madrugada ofegante. */
  'demo-pac-010': {
    frequencia: 0.85,
    marcas: [
      {
        dias: 1,
        vitalidade: 'CALMO',
        sintomas: ['TOSSE', 'FALTA_DE_AR'],
        observacoes:
          'Tossiu de madrugada e ficou com a respiração rápida, contei uns 42 por minuto dormindo.',
        remedios: 'Pimobendan 2,5 mg de 12 em 12 horas',
        foto: true,
      },
      { dias: 3, sintomas: ['TOSSE'], nota: 'Tosse seca quando deita para dormir.' },
      { dias: 4, sintomas: ['TOSSE'], vitalidade: 'SONOLENTO' },
      { dias: 8, sintomas: ['TOSSE'], remedios: 'Pimobendan 2,5 mg de 12 em 12 horas' },
      { dias: 12, temperamento: ['CARINHOSO', 'CALMO'], nota: 'Passeio curto, cansou na volta.' },
    ],
    pesos: [
      [70, 7.7],
      [42, 7.6],
      [21, 7.5],
      [6, 7.4],
    ],
  },
  /* Cacau, dachshund com hérnia de disco: mancou de novo depois de descer do sofá. */
  'demo-pac-007': {
    frequencia: 0.7,
    marcas: [
      {
        dias: 2,
        vitalidade: 'DESANIMADO',
        sintomas: ['CLAUDICACAO'],
        observacoes: 'Desceu do sofá sozinha e ficou mancando da pata de trás esquerda.',
        remedios: 'Gabapentina 100 mg, 2 vezes ao dia',
        foto: true,
      },
      { dias: 3, vitalidade: 'DESANIMADO', sintomas: ['CLAUDICACAO'] },
      { dias: 6, sintomas: ['CLAUDICACAO'], nota: 'Não quis subir a rampa da cama.' },
      { dias: 10, temperamento: ['CALMO'], remedios: 'Gabapentina 100 mg, 2 vezes ao dia' },
    ],
    pesos: [
      [60, 8.2],
      [30, 8.3],
      [9, 8.5],
    ],
  },
  /* Mel, golden gestante: mais quieta, comendo mais, a barriga aparecendo. */
  'demo-pac-003': {
    frequencia: 0.9,
    marcas: [
      {
        dias: 1,
        vitalidade: 'SONOLENTO',
        alimentacao: 'MUITO',
        nota: 'A barriga já está aparecendo. Dorme quase a tarde toda.',
        foto: true,
      },
      { dias: 2, alimentacao: 'MUITO', temperamento: ['CARINHOSO', 'CALMO'] },
      { dias: 4, alimentacao: 'MUITO', vitalidade: 'CALMO' },
      { dias: 6, alimentacao: 'MUITO', hidratacao: 'MUITO' },
      { dias: 9, alimentacao: 'POUCO', nota: 'Enjoou da ração de manhã, à noite comeu tudo.' },
      { dias: 13, alimentacao: 'MUITO' },
    ],
    pesos: [
      [36, 29.3],
      [24, 29.8],
      [12, 30.4],
      [3, 31.1],
    ],
  },
  /* Biscoito, labrador de quatro meses: cresce rápido; trocou de ração e as fezes amoleceram. */
  'demo-pac-004': {
    frequencia: 0.75,
    marcas: [
      { dias: 2, temperamento: ['BAGUNCEIRO', 'BRINCANDO'], nota: 'Roeu o pé da mesa da sala.' },
      { dias: 9, fezes: 'MOLE', nota: 'Trocamos a ração de filhote e as fezes ficaram moles.' },
      { dias: 10, fezes: 'PASTOSA' },
      { dias: 11, fezes: 'NORMAL', temperamento: ['BRINCANDO'] },
    ],
    pesos: [
      [62, 9.6],
      [47, 11.0],
      [32, 12.2],
      [17, 13.6],
      [2, 14.8],
    ],
  },
  /* Pérola, gata de sete anos: bola de pelo duas vezes. */
  'demo-pac-001': {
    frequencia: 0.6,
    marcas: [
      {
        dias: 5,
        sintomas: ['VOMITO'],
        observacoes: 'Vomitou bola de pelo depois do café da manhã.',
        foto: true,
      },
      { dias: 12, sintomas: ['VOMITO'], alimentacao: 'POUCO' },
      { dias: 3, temperamento: ['CARINHOSO'], nota: 'Voltou a dormir na cama com a gente.' },
    ],
    pesos: [
      [50, 4.2],
      [8, 4.1],
    ],
  },
  /* Pipoca, porquinho-da-índia: come muito feno, vida boa. */
  'demo-pac-001-2': {
    frequencia: 0.5,
    marcas: [
      { dias: 2, alimentacao: 'MUITO', nota: 'Comeu todo o feno e um pedaço de pimentão.' },
      { dias: 7, vitalidade: 'AGITADO', temperamento: ['VOCALIZANDO_MUITO'] },
    ],
    pesos: [
      [40, 0.88],
      [20, 0.9],
      [4, 0.92],
    ],
  },
  /* Brunilda, jabuti: primavera, sol e apetite. */
  'demo-pac-006': {
    frequencia: 0.4,
    marcas: [
      {
        dias: 1,
        vitalidade: 'ATIVO',
        alimentacao: 'MUITO',
        nota: 'Tomou sol a manhã toda e comeu folha de couve e mamão.',
        foto: true,
      },
      { dias: 8, vitalidade: 'ATIVO', alimentacao: 'MUITO' },
    ],
    pesos: [
      [80, 3.3],
      [10, 3.4],
    ],
  },
  /* Chico, pug: ronco alto e um espirro. */
  'demo-pac-008': {
    frequencia: 0.65,
    marcas: [
      { dias: 4, sintomas: ['ESPIRRO'], nota: 'Roncou alto a noite toda, mais que o normal.' },
      { dias: 6, temperamento: ['BRINCANDO', 'CARINHOSO'] },
    ],
    pesos: [
      [45, 9.2],
      [15, 9.5],
    ],
  },
  /* Paçoca, SRD jovem: coçando a orelha. */
  'demo-pac-009': {
    frequencia: 0.55,
    marcas: [
      {
        dias: 3,
        sintomas: ['COCEIRA'],
        observacoes: 'Coçando muito a orelha esquerda e balançando a cabeça.',
        foto: true,
      },
      { dias: 7, sintomas: ['COCEIRA'] },
    ],
    pesos: [[25, 11.0]],
  },
  /* Bento, persa renal: bebe muita água, urina muito, peso caindo. */
  'demo-pac-007-2': {
    frequencia: 0.7,
    marcas: [
      { dias: 2, hidratacao: 'MUITO', urina: 'MUITO', alimentacao: 'POUCO' },
      { dias: 4, hidratacao: 'MUITO', urina: 'MUITO', nota: 'Bebendo água o dia inteiro.' },
      { dias: 7, hidratacao: 'MUITO', alimentacao: 'POUCO', sintomas: ['VOMITO'] },
      { dias: 11, hidratacao: 'MUITO' },
    ],
    pesos: [
      [63, 4.9],
      [42, 4.75],
      [21, 4.6],
      [5, 4.45],
    ],
  },
}

/* ----------------------------------------------------------------------- por espécie */

type Perfil = {
  campos: Campo[]
  temperamentos: EntradaDoDiario['temperamento'][number][]
  notas: string[]
}

const PERFIS: Record<PacienteDaDemo['especie'], Perfil> = {
  CACHORRO: {
    campos: ['vitalidade', 'alimentacao', 'hidratacao', 'fezes', 'urina'],
    temperamentos: ['BRINCANDO', 'CARINHOSO', 'CALMO', 'AGITADO', 'ANSIOSO'],
    notas: [
      'Passeio longo no parque, voltou cansado e feliz.',
      'Ficou ansioso com os fogos do jogo.',
      'Comeu a ração inteira e pediu mais.',
      'Dormiu a tarde toda depois do banho.',
    ],
  },
  GATO: {
    campos: ['vitalidade', 'alimentacao', 'hidratacao', 'fezes', 'urina'],
    temperamentos: ['CARINHOSO', 'CALMO', 'BRINCANDO', 'RETRAIDO'],
    notas: [
      'Passou a manhã na janela tomando sol.',
      'Escondeu-se embaixo da cama quando chegou visita.',
      'Usou a caixa de areia normalmente.',
    ],
  },
  AVE: {
    campos: ['vitalidade', 'alimentacao', 'fezes'],
    temperamentos: ['VOCALIZANDO_MUITO', 'BRINCANDO', 'CALMO'],
    notas: ['Cantou a manhã inteira.', 'Tomou banho no pratinho de água.'],
  },
  ROEDOR: {
    campos: ['vitalidade', 'alimentacao', 'fezes'],
    temperamentos: ['AGITADO', 'CALMO', 'BRINCANDO'],
    notas: ['Correu na roda a noite toda.', 'Comeu bem as verduras.'],
  },
  COELHO: {
    campos: ['vitalidade', 'alimentacao', 'fezes'],
    temperamentos: ['CALMO', 'CARINHOSO', 'BRINCANDO'],
    notas: ['Ficou solto na sala e explorou tudo.', 'Comeu feno o dia todo.'],
  },
  PEIXE: { campos: ['vitalidade', 'alimentacao'], temperamentos: [], notas: [] },
  REPTIL: {
    campos: ['vitalidade', 'alimentacao', 'fezes'],
    temperamentos: ['CALMO'],
    notas: ['Tomou sol no quintal.'],
  },
  OUTRO: {
    campos: ['vitalidade', 'alimentacao', 'fezes'],
    temperamentos: ['BRINCANDO', 'AGITADO'],
    notas: ['Brincou bastante no fim da tarde.'],
  },
}

/** O que conta como fora do normal em cada campo. */
const NORMAL: Record<Campo, readonly string[]> = {
  vitalidade: ['ATIVO', 'NORMAL', 'CALMO'],
  alimentacao: ['NORMAL'],
  hidratacao: ['NORMAL'],
  fezes: ['NORMAL'],
  urina: ['NORMAL'],
}

const SINTOMAS_DE_ALARME: readonly Sintoma[] = ['FALTA_DE_AR', 'CONVULSAO', 'SANGRAMENTO']

function entradaVazia(id: string, data: string): EntradaDoDiario {
  return {
    id,
    data,
    vitalidade: null,
    vitalidadeOutra: null,
    alimentacao: null,
    alimentacaoOutra: null,
    hidratacao: null,
    hidratacaoOutra: null,
    fezes: null,
    fezesOutro: null,
    urina: null,
    urinaOutro: null,
    sintomas: [],
    sintomasOutros: null,
    doencas: [],
    doencasOutras: null,
    cicloCio: null,
    temperamento: [],
    temperamentoOutro: null,
    observacoes: null,
    remedios: null,
    nota: null,
    fotoIds: [],
  }
}

function comum(p: PacienteDaDemo, e: EntradaDoDiario, perfil: Perfil, sorte: Sorteio) {
  for (const campo of perfil.campos) {
    if (campo === 'vitalidade') {
      e.vitalidade = sorte.pesado([
        ['NORMAL', 50],
        ['ATIVO', 30],
        ['CALMO', 16],
        ['SONOLENTO', 4],
      ] as const)
    } else if (campo === 'alimentacao') {
      e.alimentacao = sorte.pesado([
        ['NORMAL', 88],
        ['MUITO', 7],
        ['POUCO', 5],
      ] as const)
    } else if (campo === 'hidratacao') {
      e.hidratacao = sorte.chance(0.95) ? 'NORMAL' : 'POUCO'
    } else if (campo === 'fezes') {
      e.fezes = sorte.chance(0.95) ? 'NORMAL' : 'MOLE'
    } else {
      e.urina = 'NORMAL'
    }
  }
  if (perfil.temperamentos.length && sorte.chance(0.35)) {
    e.temperamento = sorte.alguns(perfil.temperamentos, sorte.inteiro(1, 2))
  }
  if (perfil.notas.length && sorte.chance(0.12)) e.nota = sorte.escolher(perfil.notas)
  if (p.especie === 'CACHORRO' && p.sexo === 'FEMEA' && !p.castrado && sorte.chance(0.04)) {
    e.cicloCio = 'MEIO'
  }
}

function aplicar(e: EntradaDoDiario, marca: Marca) {
  const { dias: _dias, foto, sintomas, temperamento, ...resto } = marca
  Object.assign(e, resto)
  if (sintomas) e.sintomas = [...new Set([...e.sintomas, ...sintomas])]
  if (temperamento) e.temperamento = [...new Set([...temperamento, ...e.temperamento])].slice(0, 3)
  if (foto) e.fotoIds = [`${e.id}-foto-1`]
}

/**
 * O resumo lê "desde a última consulta", e quem volta toda semana tem poucos dias de janela. A
 * história cabe nela: os dias das marcas encolhem para os dias depois da última consulta, e marcas
 * que caem no mesmo dia viram um registro só (os sintomas somados, as falas juntas).
 */
function marcasNaJanela(marcas: Marca[], janela: number): Map<number, Marca> {
  const ordenadas = [...marcas].sort((a, b) => a.dias - b.dias)
  const menor = ordenadas[0]?.dias ?? 0
  const maior = ordenadas[ordenadas.length - 1]?.dias ?? 0
  const mapa = new Map<number, Marca>()

  for (const marca of ordenadas) {
    const dias =
      maior <= janela
        ? marca.dias
        : janela <= 1
          ? janela
          : 1 + Math.round(((marca.dias - menor) * (janela - 1)) / Math.max(1, maior - menor))
    const atual = mapa.get(dias)
    if (!atual) {
      mapa.set(dias, { ...marca, dias })
      continue
    }
    const falas = (a?: string, b?: string) => (a && b && a !== b ? `${a} ${b}` : (a ?? b))
    mapa.set(dias, {
      ...marca,
      ...atual,
      dias,
      sintomas: [...new Set([...(atual.sintomas ?? []), ...(marca.sintomas ?? [])])],
      temperamento: [...new Set([...(atual.temperamento ?? []), ...(marca.temperamento ?? [])])],
      observacoes: falas(atual.observacoes, marca.observacoes),
      nota: falas(atual.nota, marca.nota),
      foto: atual.foto || marca.foto,
    })
  }
  return mapa
}

/* ------------------------------------------------------------------------------ geração */

const DIARIOS = new Map<string, EntradaDoDiario[]>()
const PESOS = new Map<string, Array<{ id: string; data: string; pesoKg: number }>>()

function gerar(p: PacienteDaDemo) {
  const sorte = criarSorteio(`diario:${p.id}`)
  const historia = HISTORIAS[p.id]
  const perfil = PERFIS[p.especie]
  const frequencia =
    historia?.frequencia ??
    sorte.pesado([
      [0, 30],
      [0.12, 20],
      [0.3, 25],
      [0.55, 18],
      [0.8, 7],
    ] as const)
  const janela = diasEntre(desdePadrao(p.id), hoje())
  const marcas = marcasNaJanela(historia?.marcas ?? [], janela)
  const entradas: EntradaDoDiario[] = []

  for (let dias = 0; dias < DIAS_DO_DIARIO; dias++) {
    const marca = marcas.get(dias)
    const sorteado = sorte.chance(frequencia)
    if (!marca && (dias === 0 || !sorteado)) continue
    const data = somarDias(hoje(), -dias)
    const e = entradaVazia(`demo-diario-${p.id.slice('demo-pac-'.length)}-${data}`, data)
    comum(p, e, perfil, sorte)
    if (marca) aplicar(e, marca)
    entradas.push(e)
  }

  const pesos = (historia?.pesos ?? pesosGenericos(p, sorte)).map(([dias, pesoKg]) => {
    const data = somarDias(hoje(), -dias)
    return { id: `demo-peso-${p.id.slice('demo-pac-'.length)}-${data}`, data, pesoKg }
  })

  DIARIOS.set(p.id, entradas)
  PESOS.set(
    p.id,
    pesos.sort((a, b) => a.data.localeCompare(b.data)),
  )
}

function pesosGenericos(p: PacienteDaDemo, sorte: Sorteio): Array<[number, number]> {
  const base = p.pesoKg ?? 0
  if (!base || p.especie === 'PEIXE' || !sorte.chance(p.especie === 'CACHORRO' ? 0.6 : 0.3)) {
    return []
  }
  const n = sorte.inteiro(1, 3)
  return Array.from({ length: n }, (_, i): [number, number] => {
    const variacao = 1 + (sorte.numero() - 0.5) * 0.04
    return [10 + (n - 1 - i) * sorte.inteiro(18, 30), Math.round(base * variacao * 100) / 100]
  })
}

function doPaciente(pacienteId: string) {
  const p = paciente(pacienteId)
  if (!p) return null
  if (!DIARIOS.has(p.id)) gerar(p)
  return { p, entradas: DIARIOS.get(p.id) ?? [], pesos: PESOS.get(p.id) ?? [] }
}

/* --------------------------------------------------------------------------- consultas */

/** O último atendimento finalizado nesta clínica. */
export function ultimaConsultaDe(pacienteId: string) {
  const finalizados = agendamentosDoPaciente(pacienteId)
    .filter((a) => a.status === 'FINALIZADO' && jaPassou(a.inicio))
    .sort((a, b) => b.inicio.localeCompare(a.inicio))
  return finalizados[0] ?? null
}

/** Sem `desde`: desde o último atendimento finalizado (ou 30 dias), no máximo 90. */
export function desdePadrao(pacienteId: string) {
  const ultima = ultimaConsultaDe(pacienteId)
  const trinta = somarDias(hoje(), -30)
  if (!ultima) return trinta
  const dia = ultima.inicio.slice(0, 10)
  return diasEntre(dia, hoje()) > DIAS_DO_DIARIO ? somarDias(hoje(), -DIAS_DO_DIARIO) : dia
}

export function diarioDe(pacienteId: string, desde: string) {
  const dados = doPaciente(pacienteId)
  const entradas = (dados?.entradas ?? []).filter((e) => e.data >= desde)
  return {
    desde,
    ate: hoje(),
    entradas: entradas.slice(0, 120),
    truncado: entradas.length > 120,
    motivo: null,
  }
}

export function pesosDeCasa(pacienteId: string, desde: string) {
  const dados = doPaciente(pacienteId)
  return {
    desde,
    ate: hoje(),
    pesos: (dados?.pesos ?? []).filter((p) => p.data >= desde).reverse(),
    truncado: false,
  }
}

/** A foto do diário: as fotos livres da demonstração, com o link de 15 minutos. */
export function fotoDoDiario(pacienteId: string, fotoId: string) {
  const p = paciente(pacienteId)
  const existe = doPaciente(pacienteId)?.entradas.some((e) => e.fotoIds.includes(fotoId))
  if (!p || !existe) return null
  return {
    url: p.fotoUrl,
    expiraEm: p.fotoUrl ? somarMinutos(agoraIso(), 15) : null,
    motivo: p.fotoUrl ? null : ('ARQUIVO_INDISPONIVEL' as const),
  }
}

/* -------------------------------------------------------------------------- carteirinha */

type Diagnostico = CarteirinhaParaClinica['diagnosticos'][number]
type Tratamento = CarteirinhaParaClinica['tratamentos'][number]
type Alergia = CarteirinhaParaClinica['alergias'][number]

const DIAGNOSTICOS: Record<string, Diagnostico[]> = {
  'demo-pac-010': [
    {
      categoria: 'CARDIO',
      subtipo: 'Doença valvar mitral, estágio B2',
      dataDiagnostico: '2025-08-14',
      observacoes: null,
    },
  ],
  'demo-pac-007': [
    {
      categoria: 'ORTOPEDICA',
      subtipo: 'Doença do disco intervertebral',
      dataDiagnostico: '2024-11-02',
      observacoes: 'Evitar escadas e saltos.',
    },
  ],
  'demo-pac-007-2': [
    {
      categoria: 'RENAL',
      subtipo: 'DRC, estágio IRIS 2',
      dataDiagnostico: '2025-05-20',
      observacoes: null,
    },
  ],
  'demo-pac-008': [
    {
      categoria: 'OUTRA',
      subtipo: 'Síndrome braquicefálica',
      dataDiagnostico: null,
      observacoes: null,
    },
  ],
  'demo-pac-024': [
    { categoria: 'FIV', subtipo: null, dataDiagnostico: '2023-03-09', observacoes: null },
  ],
  'demo-pac-039': [
    {
      categoria: 'ENDOCRINA',
      subtipo: 'Hipertireoidismo',
      dataDiagnostico: '2025-10-01',
      observacoes: null,
    },
  ],
}

const TRATAMENTOS: Record<string, Tratamento[]> = {
  'demo-pac-010': [
    {
      medicamento: 'Pimobendan',
      dose: '2,5',
      unidade: 'mg',
      frequencia: 'De 12 em 12 horas',
      via: 'Oral',
      motivo: 'Doença valvar mitral',
      dataInicio: '2025-08-15',
      dataFim: null,
    },
  ],
  'demo-pac-007': [
    {
      medicamento: 'Gabapentina',
      dose: '100',
      unidade: 'mg',
      frequencia: 'De 12 em 12 horas',
      via: 'Oral',
      motivo: 'Dor da hérnia de disco',
      dataInicio: somarDias(hoje(), -21),
      dataFim: somarDias(hoje(), 9),
    },
  ],
  'demo-pac-007-2': [
    {
      medicamento: 'Benazepril',
      dose: '2,5',
      unidade: 'mg',
      frequencia: 'Uma vez ao dia',
      via: 'Oral',
      motivo: 'Proteinúria',
      dataInicio: '2025-05-22',
      dataFim: null,
    },
  ],
  'demo-pac-039': [
    {
      medicamento: 'Metimazol',
      dose: '2,5',
      unidade: 'mg',
      frequencia: 'De 12 em 12 horas',
      via: 'Oral',
      motivo: 'Hipertireoidismo',
      dataInicio: '2025-10-03',
      dataFim: null,
    },
  ],
}

/** [vacina, fabricante] */
const VACINAS_POR_ESPECIE: Partial<Record<PacienteDaDemo['especie'], Array<[string, string]>>> = {
  CACHORRO: [
    ['V10 (polivalente)', 'Zoetis'],
    ['Antirrábica', 'MSD Saúde Animal'],
    ['Gripe canina (Bordetella)', 'Boehringer Ingelheim'],
  ],
  GATO: [
    ['V4 (quádrupla felina)', 'Zoetis'],
    ['Antirrábica', 'MSD Saúde Animal'],
  ],
  OUTRO: [['Antirrábica', 'MSD Saúde Animal']],
}

function alergiasDe(p: PacienteDaDemo): Alergia[] {
  return p.alertas
    .filter((a) => a.ativo && a.tipo === 'ALERGIA')
    .map((a) => ({
      gatilho: a.detalhe.split(':')[0]?.trim() || a.detalhe,
      categoria: 'MEDICAMENTOSA' as const,
      reacao: a.detalhe.includes(':') ? (a.detalhe.split(':')[1]?.trim() ?? null) : null,
      severidade: a.severidade === 'RISCO' ? ('GRAVE' as const) : ('MODERADA' as const),
      descobertaEm: null,
      observacoes: null,
    }))
}

export function carteirinhaDe(pacienteId: string): CarteirinhaParaClinica {
  const p = paciente(pacienteId)
  if (!p) return { vacinas: [], alergias: [], diagnosticos: [], tratamentos: [], truncado: false }
  const sorte = criarSorteio(`carteirinha:${p.id}`)
  const vacinas = (VACINAS_POR_ESPECIE[p.especie] ?? []).flatMap(([nome, fabricante], i) => {
    if (i === 2 && !sorte.chance(0.6)) return []
    const nossa = sorte.chance(0.75)
    const aplicadaEm = somarDias(hoje(), -sorte.inteiro(20, 330))
    return [
      {
        nome,
        aplicadaEm,
        origem: nossa ? ('PARCEIRO' as const) : ('TUTOR' as const),
        lote: nossa
          ? `${String.fromCharCode(65 + sorte.inteiro(0, 25))}${sorte.inteiro(10, 99)}K${sorte.inteiro(100, 999)}`
          : null,
        fabricante: nossa ? fabricante : null,
        dose: null,
        clinicaNome: nossa ? PARCEIRO_NOME : 'Clínica Veterinária da Pompeia',
        daClinica: nossa,
      },
    ]
  })
  vacinas.sort((a, b) => (b.aplicadaEm ?? '').localeCompare(a.aplicadaEm ?? ''))
  return {
    vacinas,
    alergias: alergiasDe(p),
    diagnosticos: DIAGNOSTICOS[p.id] ?? [],
    tratamentos: TRATAMENTOS[p.id] ?? [],
    truncado: false,
  }
}

/* ------------------------------------------------------------------------------- resumo */

/** O registro de hoje foi feito de manhã cedo; os outros, à noite. */
function noDia(data: string, hora: string) {
  return instante(data, data === hoje() ? '07:20' : hora)
}

function maisComum<T>(valores: T[]): T | null {
  const contagem = new Map<T, number>()
  for (const v of valores) contagem.set(v, (contagem.get(v) ?? 0) + 1)
  let melhor: T | null = null
  let vezes = 0
  for (const [v, n] of contagem) if (n > vezes) [melhor, vezes] = [v, n]
  return melhor
}

/** "Este pet em 30 segundos", com o que o responsável liberou. */
export function resumoDe(
  pacienteId: string,
  liberado: { diario: boolean; peso: boolean },
): ResumoDoPaciente {
  const dados = doPaciente(pacienteId)
  const p = dados?.p
  const ultima = ultimaConsultaDe(pacienteId)
  const desde = desdePadrao(pacienteId)
  const entradas = (dados?.entradas ?? []).filter((e) => e.data >= desde)
  const carteirinha = carteirinhaDe(pacienteId)
  const sinais: SinalDoResumo[] = []

  /* O diário em números: cada campo, os sintomas, as falas. */
  const campos = (['alimentacao', 'hidratacao', 'vitalidade', 'fezes', 'urina'] as const).flatMap(
    (campo) => {
      const comValor = entradas.filter((e) => e[campo])
      const primeiro = comValor[0]
      if (!primeiro) return []
      const alterados = comValor.filter((e) => !NORMAL[campo].includes(e[campo] as string))
      return [
        {
          campo,
          total: comValor.length,
          alterados: alterados.length,
          predominante: maisComum(alterados.map((e) => e[campo] as string)),
          ultimo: primeiro[campo] as string,
          ultimoEm: noDia(primeiro.data, '20:00'),
        },
      ]
    },
  )

  const porSintoma = new Map<Sintoma, { vezes: number; ultimaEm: string }>()
  for (const e of entradas) {
    for (const s of e.sintomas) {
      const atual = porSintoma.get(s)
      porSintoma.set(s, {
        vezes: (atual?.vezes ?? 0) + 1,
        ultimaEm: atual?.ultimaEm ?? noDia(e.data, '20:00'),
      })
    }
  }
  const sintomas = [...porSintoma].map(([sintoma, { vezes, ultimaEm }]) => ({
    sintoma,
    vezes,
    ultimaEm,
    alarme: SINTOMAS_DE_ALARME.includes(sintoma),
  }))

  const semAlteracao = entradas.filter(
    (e) =>
      !e.sintomas.length &&
      (Object.keys(NORMAL) as Campo[]).every((c) => !e[c] || NORMAL[c].includes(e[c] as string)),
  ).length

  const falas = entradas
    .filter((e) => e.nota || e.observacoes)
    .slice(0, 3)
    .map((e) => ({ em: noDia(e.data, '20:30'), texto: (e.observacoes ?? e.nota) as string }))

  /* O que chama atenção: o alarme primeiro, depois o que se repete e o que mudou. */
  if (liberado.diario) {
    for (const e of entradas) {
      const achados = [
        ...e.sintomas
          .filter((s) => SINTOMAS_DE_ALARME.includes(s))
          .map((valor) => ({ campo: 'sintomas' as const, valor })),
        ...(e.fezes === 'COM_SANGUE' ? [{ campo: 'fezes' as const, valor: 'COM_SANGUE' }] : []),
        ...(e.urina === 'COM_SANGUE' ? [{ campo: 'urina' as const, valor: 'COM_SANGUE' }] : []),
      ]
      if (!achados.length) continue
      sinais.push({
        tipo: 'alarme',
        severidade: 'risco',
        achados,
        em: instante(e.data, '06:10'),
        relato: e.sintomasOutros,
        texto: e.observacoes ?? e.nota,
      })
    }
    for (const s of sintomas) {
      if (s.vezes >= 2) {
        sinais.push({
          tipo: 'sintoma-recorrente',
          severidade: 'atencao',
          sintoma: s.sintoma,
          vezes: s.vezes,
        })
      }
    }
    for (const c of campos) {
      if (c.total >= 3 && c.alterados * 2 >= c.total && c.predominante) {
        sinais.push({
          tipo: 'campo-alterado',
          severidade: 'atencao',
          campo: c.campo,
          predominante: c.predominante,
          alterados: c.alterados,
          total: c.total,
        })
      }
    }
  }

  /* O peso: o da balança da clínica na última consulta e os de casa. */
  const deCasa = liberado.peso ? (dados?.pesos ?? []) : []
  const naConsulta = ultima
    ? ([...deCasa].reverse().find((x) => x.data <= ultima.inicio.slice(0, 10))?.pesoKg ??
      deCasa[0]?.pesoKg ??
      p?.pesoKg ??
      null)
    : null
  const serie = [
    ...(ultima && naConsulta
      ? [{ em: ultima.inicio, pesoKg: naConsulta, origem: 'clinica' as const }]
      : []),
    ...deCasa
      .filter((x) => x.data >= somarDias(hoje(), -90))
      .map((x) => ({ em: instante(x.data, '08:30'), pesoKg: x.pesoKg, origem: 'casa' as const })),
  ].sort((a, b) => a.em.localeCompare(b.em))

  let variacao: ResumoDoPaciente['peso']['variacao'] = null
  const primeiro = serie[0]
  const ultimo = serie[serie.length - 1]
  if (primeiro && ultimo && primeiro !== ultimo) {
    const percentual = Math.round(((ultimo.pesoKg - primeiro.pesoKg) / primeiro.pesoKg) * 1000) / 10
    if (percentual <= -5) {
      const semanas = Math.max(
        1,
        Math.round(diasEntre(primeiro.em.slice(0, 10), ultimo.em.slice(0, 10)) / 7),
      )
      const continua = serie.every(
        (x, i) => i === 0 || x.pesoKg <= (serie[i - 1]?.pesoKg ?? x.pesoKg),
      )
      variacao = { deKg: primeiro.pesoKg, paraKg: ultimo.pesoKg, percentual, semanas, continua }
      sinais.unshift({
        tipo: 'perda-de-peso',
        severidade: percentual <= -8 ? 'risco' : 'atencao',
        variacao,
      })
    }
  }

  const pesosNoPeriodo = deCasa.filter((x) => x.data >= desde)
  const primeiroPeso = pesosNoPeriodo[0]
  const ultimoPeso = pesosNoPeriodo[pesosNoPeriodo.length - 1]

  return {
    geradoEm: agoraIso(),
    primeiraVez: !ultima,
    ultimaConsulta: ultima ? { agendamentoId: ultima.id, em: ultima.inicio } : null,
    diasDesdeUltima: ultima ? diasEntre(ultima.inicio.slice(0, 10), hoje()) : null,
    sinais,
    naoLiberado: [
      ...(liberado.diario ? [] : ['diario' as const]),
      ...(liberado.peso ? [] : ['peso' as const]),
    ],
    naoDisponivel: [],
    adesao: null,
    diario: {
      liberado: liberado.diario,
      motivo: liberado.diario ? null : 'SEM_CONSENTIMENTO',
      desde,
      ate: hoje(),
      total: liberado.diario ? entradas.length : 0,
      semAlteracao: liberado.diario ? semAlteracao : 0,
      campos: liberado.diario ? campos : [],
      sintomas: liberado.diario ? sintomas : [],
      doencas: [],
      falas: liberado.diario ? falas : [],
      peso:
        primeiroPeso && ultimoPeso
          ? {
              deKg: primeiroPeso.pesoKg,
              paraKg: ultimoPeso.pesoKg,
              ultimoEm: instante(ultimoPeso.data, '08:30'),
            }
          : null,
    },
    peso: { serie, variacao },
    medicacoes: carteirinha.tratamentos.map((t) =>
      [t.medicamento, t.dose && t.unidade ? `${t.dose} ${t.unidade}` : t.dose]
        .filter(Boolean)
        .join(' '),
    ),
    carteirinha,
  }
}
