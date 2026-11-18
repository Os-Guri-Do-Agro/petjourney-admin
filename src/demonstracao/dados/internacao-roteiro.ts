/**
 * O roteiro da internação da demonstração: os leitos da ala, o catálogo de remédios que as
 * prescrições usam e a história de cada internado (entrada, leitos, gravidade ao longo do tempo,
 * prescrições, evoluções escritas à mão e boletins ao responsável). O motor (`internacao.ts`)
 * transforma o roteiro em doses, plantões, evoluções e boletins na forma da API.
 *
 * Hoje às 10:40: cinco internados (Chico crítico na UTI, Duna saindo da insuficiência cardíaca,
 * Bento com a piora renal, Toddy no isolamento com suspeita de leptospirose e Floquinho com alta
 * prevista para hoje) e quatro altas no mês.
 */
import type { Gravidade, KindDoLeito } from '@/service/parceiro/internacao-service'
import type {
  KindDoItem,
  MotivoDaNaoDada,
  PrescricaoDaInternacao,
  ViaNaInternacao,
} from '@/service/parceiro/plantao-da-internacao-service'

import { hoje, instante, somarDias } from '../relogio'

/* ---------------------------------------------------------------------------- quem é quem */

export const MARINA = 'demo-prof-marina'
export const RAFAEL = 'demo-prof-rafael'
export const CAMILA = 'demo-prof-camila'
export const BRUNO = 'demo-prof-bruno'
/**
 * A enfermagem (Lucas) não tem ficha na base (`PROFISSIONAIS` só traz os veterinários): o id só
 * existe aqui, para o plantão da noite e as doses que ele deu.
 */
export const LUCAS = 'demo-prof-lucas'
export const ENFERMAGEM = { id: LUCAS, nome: 'Lucas Ferreira', usuarioId: 'demo-usr-lucas' }

/* ---------------------------------------------------------------------------- o calendário */

const HOJE = hoje()

/** `dias` atrás (negativo: à frente), na hora `HH:MM` da clínica. */
export function em(dias: number, hora: string) {
  return instante(somarDias(HOJE, -dias), hora)
}

/* ------------------------------------------------------------------------------ os leitos */

export type LeitoDoRoteiro = {
  id: string
  nome: string
  kind: KindDoLeito
  inativo?: {
    motivo: 'MANUTENCAO' | 'DESINFECCAO' | 'REFORMA' | 'EQUIPAMENTO' | 'OUTRO'
    detalhe: string | null
    desde: string
  }
}

export const LEITOS_DO_ROTEIRO: LeitoDoRoteiro[] = [
  { id: 'demo-leito-uti1', nome: 'UTI 1', kind: 'UTI' },
  { id: 'demo-leito-uti2', nome: 'UTI 2', kind: 'UTI' },
  { id: 'demo-leito-r1', nome: 'R1', kind: 'GERAL' },
  { id: 'demo-leito-r2', nome: 'R2', kind: 'GERAL' },
  { id: 'demo-leito-r3', nome: 'R3', kind: 'GERAL' },
  {
    id: 'demo-leito-r4',
    nome: 'R4',
    kind: 'GERAL',
    inativo: {
      motivo: 'EQUIPAMENTO',
      detalhe: 'Tapete térmico queimado, troca agendada',
      desde: em(1, '16:20'),
    },
  },
  { id: 'demo-leito-f1', nome: 'F1', kind: 'FELINO' },
  { id: 'demo-leito-f2', nome: 'F2', kind: 'FELINO' },
  { id: 'demo-leito-i1', nome: 'I1', kind: 'ISOLAMENTO' },
]

/* ------------------------------------------------------------------------- os remédios */

type Regime = NonNullable<PrescricaoDaInternacao['regime']>

export type MedicamentoDaInternacao = {
  id: string
  nome: string
  principioAtivo: string
  /** mg por mL (ou por comprimido). */
  concentracao: number
  unidade: 'ML' | 'COMPRIMIDO' | 'GOTA' | 'APLICACAO'
  regime: Regime
}

/** Os remédios que as prescrições do roteiro usam (o nome congela na prescrição, como na API). */
export const MEDICAMENTOS: Record<string, MedicamentoDaInternacao> = {
  ampicilina: {
    id: 'demo-med-ampicilina',
    nome: 'Ampicilina sódica 1 g (reconstituída a 100 mg/mL)',
    principioAtivo: 'Ampicilina',
    concentracao: 100,
    unidade: 'ML',
    regime: 'NENHUM',
  },
  buprenorfina: {
    id: 'demo-med-buprenorfina',
    nome: 'Buprenorfina 0,3 mg/mL',
    principioAtivo: 'Buprenorfina',
    concentracao: 0.3,
    unidade: 'ML',
    regime: 'ANVISA_RETENCAO',
  },
  butorfanol: {
    id: 'demo-med-butorfanol',
    nome: 'Butorfanol 10 mg/mL',
    principioAtivo: 'Butorfanol',
    concentracao: 10,
    unidade: 'ML',
    regime: 'MAPA_VETERINARIO',
  },
  dexametasona: {
    id: 'demo-med-dexametasona',
    nome: 'Dexametasona 2 mg/mL',
    principioAtivo: 'Dexametasona',
    concentracao: 2,
    unidade: 'ML',
    regime: 'NENHUM',
  },
  furosemida: {
    id: 'demo-med-furosemida',
    nome: 'Furosemida 10 mg/mL (injetável)',
    principioAtivo: 'Furosemida',
    concentracao: 10,
    unidade: 'ML',
    regime: 'NENHUM',
  },
  maropitant: {
    id: 'demo-med-maropitant',
    nome: 'Maropitant 10 mg/mL',
    principioAtivo: 'Maropitant',
    concentracao: 10,
    unidade: 'ML',
    regime: 'NENHUM',
  },
  meloxicam: {
    id: 'demo-med-meloxicam',
    nome: 'Meloxicam 2 mg/mL (injetável)',
    principioAtivo: 'Meloxicam',
    concentracao: 2,
    unidade: 'ML',
    regime: 'NENHUM',
  },
  metoclopramida: {
    id: 'demo-med-metoclopramida',
    nome: 'Metoclopramida 5 mg/mL',
    principioAtivo: 'Metoclopramida',
    concentracao: 5,
    unidade: 'ML',
    regime: 'NENHUM',
  },
  metronidazol: {
    id: 'demo-med-metronidazol',
    nome: 'Metronidazol 5 mg/mL (bolsa intravenosa)',
    principioAtivo: 'Metronidazol',
    concentracao: 5,
    unidade: 'ML',
    regime: 'NENHUM',
  },
  omeprazol: {
    id: 'demo-med-omeprazol',
    nome: 'Omeprazol 4 mg/mL (injetável)',
    principioAtivo: 'Omeprazol',
    concentracao: 4,
    unidade: 'ML',
    regime: 'NENHUM',
  },
  ondansetrona: {
    id: 'demo-med-ondansetrona',
    nome: 'Ondansetrona 2 mg/mL',
    principioAtivo: 'Ondansetrona',
    concentracao: 2,
    unidade: 'ML',
    regime: 'NENHUM',
  },
  pimobendan: {
    id: 'demo-med-pimobendan',
    nome: 'Pimobendan 2,5 mg (comprimido)',
    principioAtivo: 'Pimobendan',
    concentracao: 2.5,
    unidade: 'COMPRIMIDO',
    regime: 'NENHUM',
  },
  prednisolonaComprimido: {
    id: 'demo-med-prednisolona-5',
    nome: 'Prednisolona 5 mg (comprimido)',
    principioAtivo: 'Prednisolona',
    concentracao: 5,
    unidade: 'COMPRIMIDO',
    regime: 'NENHUM',
  },
  prednisolonaSolucao: {
    id: 'demo-med-prednisolona-sol',
    nome: 'Prednisolona 3 mg/mL (solução oral)',
    principioAtivo: 'Prednisolona',
    concentracao: 3,
    unidade: 'ML',
    regime: 'NENHUM',
  },
}

/* -------------------------------------------------------------------------- as histórias */

export type ItemDaReceita = {
  chave: string
  kind: KindDoItem
  /** MEDICAMENTO: a chave em `MEDICAMENTOS`. */
  remedio?: string
  /** Os outros tipos: o texto da prescrição. */
  descricao?: string
  via?: ViaNaInternacao
  mgPorKg?: number
  frequenciaHoras: number
  primeiro: string
  por: string
  observacao?: string
  suspensa?: { em: string; motivo: string; por: string; trocadaPor?: string }
  /** Trocou a dose desta outra (chave). */
  substitui?: string
}

/** Uma dose que o roteiro decide (as outras saem dadas no horário, pelo plantão da hora). */
export type AjusteDeDose = {
  chave: string
  em: string
  status: 'PENDENTE' | 'FEITA' | 'PULADA' | 'RECUSADA'
  motivo?: MotivoDaNaoDada
  observacao?: string
  por?: string
  /** Minutos depois do horário em que foi registrada. */
  aos?: number
}

export type TextoDaEvolucao = { observado: string; avaliacao: string; plano: string }

export type EvolucaoDoRoteiro = TextoDaEvolucao & {
  em: string
  por: string
  vitais?: [number, number, number]
  /** A versão que esta reescreveu (o primeiro texto do plantão). */
  antes?: TextoDaEvolucao & { em: string; por: string; vitais?: [number, number, number] }
}

export type BoletimDoRoteiro = {
  em: string
  /** `null`: o retido que o sistema cria na piora. */
  por: string | null
  texto: string
  status: 'ENVIADO' | 'RETIDO' | 'LIBERADO' | 'RASCUNHO' | 'CANCELADO'
  retencao?: 'PIORA' | 'ENTROU_CRITICO'
  ligacao?: { em: string; por: string }
  enviadoEm?: string
  cancelado?: { em: string; motivo: 'DESCARTADO' | 'SUPERADO' | 'ENCERRAMENTO' }
  foto?: { url: string; legenda: string }
}

/** Faixas de temperatura, frequência cardíaca e respiratória: `[tMin, tMax, fcMin, fcMax, frMin, frMax]`. */
export type FaixaDeVitais = [number, number, number, number, number, number]

export type HistoriaDeInternacao = {
  id: string
  pacienteId: string
  /** O primeiro é o leito da entrada; os outros, as mudanças. */
  leitos: Array<{ leitoId: string; desde: string; motivo?: string }>
  responsavel: string
  internadoPor: string
  motivo: string
  diagnostico: string
  observacao: string | null
  entradaEm: string
  pesoKg: number
  /** O primeiro é a gravidade da entrada; os outros, as mudanças. */
  gravidades: Array<{ em: string; gravidade: Gravidade }>
  altaPrevistaEm: string | null
  alta?: { em: string; orientacao: string; por: string }
  preferencia: {
    frequenciaHoras: 1 | 2 | 4 | 6 | 8 | 12 | 24
    fotoSempre: boolean
    silencioNoturno: boolean
    definidaPor: 'RESPONSAVEL' | 'CLINICA' | null
    definidaEm: string | null
  }
  receita: ItemDaReceita[]
  ajustes: AjusteDeDose[]
  /** A evolução escrita de um plantão: chave `diasAtras-TURNO` (o dia da grade). */
  evolucoes: Record<string, EvolucaoDoRoteiro>
  /** O texto de rotina dos outros plantões, pela gravidade da hora. */
  rotina: Partial<Record<Gravidade, TextoDaEvolucao[]>>
  vitais: Partial<Record<Gravidade, FaixaDeVitais>>
  boletins: BoletimDoRoteiro[]
  /** Ligações registradas na internação (o paciente sem app). */
  ligacoes: Array<{ em: string; por: string }>
}

const PREFERENCIA_PADRAO: HistoriaDeInternacao['preferencia'] = {
  frequenciaHoras: 6,
  fotoSempre: false,
  silencioNoturno: true,
  definidaPor: null,
  definidaEm: null,
}

const RETIDO_DO_SISTEMA = (pet: string, femea = false) =>
  `A equipe ligou para conversar sobre ${pet}. ${femea ? 'Ela segue internada' : 'Ele segue internado'}, com acompanhamento de perto, e a clínica manda novas notícias em seguida.`

/** O texto fechado do retido que o sistema cria na piora. */
export function textoDoRetido(pet: string, femea: boolean) {
  return RETIDO_DO_SISTEMA(pet, femea)
}

const OXIGENIO = 'Oxigenioterapia em gaiola, FiO2 40%: conferir fluxo e umidificador'

export const HISTORIAS: HistoriaDeInternacao[] = [
  /* ------------------------------------------------------------------ Nina (alta) */
  {
    id: 'demo-int-0001',
    pacienteId: 'demo-pac-005',
    leitos: [{ leitoId: 'demo-leito-r1', desde: em(14, '11:00') }],
    responsavel: MARINA,
    internadoPor: MARINA,
    motivo: 'Vômitos e diarreia com sangue há 24 horas',
    diagnostico: 'Gastroenterite hemorrágica aguda',
    observacao: 'ALERGIA A DIPIRONA: não usar. Analgesia só com opioide.',
    entradaEm: em(14, '11:00'),
    pesoKg: 5.9,
    gravidades: [
      { em: em(14, '11:00'), gravidade: 'ATENCAO' },
      { em: em(13, '09:30'), gravidade: 'ESTAVEL' },
    ],
    altaPrevistaEm: null,
    alta: {
      em: em(11, '16:30'),
      por: MARINA,
      orientacao:
        'Dieta gastrointestinal em pequenas porções, 4 vezes ao dia, por 7 dias; depois misture aos poucos com a ração de sempre. Metronidazol suspensão 40 mg/mL: 2,2 mL a cada 12 horas por mais 5 dias. Volte antes do retorno se ela vomitar, recusar comida ou se aparecer sangue nas fezes. Lembrete: a Nina tem alergia a dipirona. Retorno em 7 dias.',
    },
    preferencia: PREFERENCIA_PADRAO,
    receita: [
      {
        chave: 'flu',
        kind: 'FLUIDO',
        descricao: 'Ringer lactato, 25 mL/h em bomba de infusão',
        frequenciaHoras: 1,
        primeiro: em(14, '11:30'),
        por: MARINA,
      },
      {
        chave: 'met',
        kind: 'MEDICAMENTO',
        remedio: 'metronidazol',
        via: 'INTRAVENOSA',
        mgPorKg: 15,
        frequenciaHoras: 12,
        primeiro: em(14, '12:00'),
        por: MARINA,
        observacao: 'Infundir em 30 minutos',
      },
      {
        chave: 'mar',
        kind: 'MEDICAMENTO',
        remedio: 'maropitant',
        via: 'SUBCUTANEA',
        mgPorKg: 1,
        frequenciaHoras: 24,
        primeiro: em(14, '12:00'),
        por: MARINA,
      },
      {
        chave: 'ome',
        kind: 'MEDICAMENTO',
        remedio: 'omeprazol',
        via: 'INTRAVENOSA',
        mgPorKg: 1,
        frequenciaHoras: 24,
        primeiro: em(14, '12:00'),
        por: MARINA,
      },
      {
        chave: 'ali',
        kind: 'ALIMENTACAO',
        descricao: 'Ração gastrointestinal úmida, 2 colheres',
        frequenciaHoras: 6,
        primeiro: em(13, '12:00'),
        por: MARINA,
      },
    ],
    ajustes: [],
    evolucoes: {
      '14-MANHA': {
        em: em(14, '11:40'),
        por: MARINA,
        vitais: [39.1, 132, 30],
        observado:
          'Chegou abatida, com vômito e diarreia com sangue vivo. Mucosas secas, TPC de 3 segundos.',
        avaliacao: 'Gastroenterite hemorrágica com desidratação moderada (cerca de 7%).',
        plano:
          'Fluidoterapia, antiemético, protetor gástrico e metronidazol. Jejum de sólidos por 12 horas. Lembrar da alergia a dipirona.',
      },
      '13-MANHA': {
        em: em(13, '09:30'),
        por: MARINA,
        vitais: [38.6, 104, 24],
        observado:
          'Sem vômitos desde ontem à tarde. Fezes pastosas, só com rajas de sangue. Aceitou a ração úmida.',
        avaliacao: 'Boa resposta ao tratamento; hidratação corrigida.',
        plano: 'Iniciar alimentação em pequenas porções e reduzir o fluido amanhã.',
      },
    },
    rotina: {
      ATENCAO: [
        {
          observado: 'Duas evacuações com sangue no plantão. Sem vômitos desde a chegada.',
          avaliacao: 'Desidratação leve, em correção.',
          plano: 'Manter fluido e jejum de sólidos.',
        },
      ],
      ESTAVEL: [
        {
          observado: 'Fezes pastosas sem sangue. Comeu toda a porção oferecida.',
          avaliacao: 'Recuperação boa.',
          plano: 'Manter e programar a alta.',
        },
        {
          observado: 'Ativa, pedindo comida. Sem vômitos no período.',
          avaliacao: 'Estável.',
          plano: 'Manter.',
        },
      ],
    },
    vitais: { ATENCAO: [38.6, 39.3, 110, 140, 24, 34], ESTAVEL: [38.3, 38.9, 90, 120, 20, 28] },
    boletins: [],
    ligacoes: [
      { em: em(14, '12:30'), por: MARINA },
      { em: em(11, '15:00'), por: MARINA },
    ],
  },

  /* ----------------------------------------------------------------- Simba (alta) */
  {
    id: 'demo-int-0002',
    pacienteId: 'demo-pac-024',
    leitos: [{ leitoId: 'demo-leito-f2', desde: em(10, '09:40') }],
    responsavel: CAMILA,
    internadoPor: CAMILA,
    motivo: 'Tentando urinar sem conseguir, vocalizando na caixa de areia',
    diagnostico: 'Obstrução uretral por tampão; desobstruído sob sedação e sondado',
    observacao: 'FIV positivo: material de uso exclusivo e manipulação com luvas.',
    entradaEm: em(10, '09:40'),
    pesoKg: 5.7,
    gravidades: [
      { em: em(10, '09:40'), gravidade: 'ATENCAO' },
      { em: em(9, '10:00'), gravidade: 'ESTAVEL' },
    ],
    altaPrevistaEm: null,
    alta: {
      em: em(7, '15:00'),
      por: CAMILA,
      orientacao:
        'Simba deve comer só a ração urinária úmida a partir de agora e beber bastante água: deixe fontes e potes em vários cantos da casa. Prazosina 0,5 mg a cada 12 horas por 7 dias. Se ele entrar várias vezes na caixa de areia sem fazer xixi, ou chorar ao urinar, venha na hora: é emergência. Retorno em 5 dias para exame de urina.',
    },
    preferencia: { ...PREFERENCIA_PADRAO, frequenciaHoras: 8 },
    receita: [
      {
        chave: 'flu',
        kind: 'FLUIDO',
        descricao: 'Ringer lactato, 15 mL/h em bomba de infusão',
        frequenciaHoras: 1,
        primeiro: em(10, '11:00'),
        por: CAMILA,
      },
      {
        chave: 'bup',
        kind: 'MEDICAMENTO',
        remedio: 'buprenorfina',
        via: 'INTRAVENOSA',
        mgPorKg: 0.02,
        frequenciaHoras: 8,
        primeiro: em(10, '11:00'),
        por: CAMILA,
      },
      {
        chave: 'son',
        kind: 'MONITORAMENTO',
        descricao: 'Conferir a sonda uretral e medir a urina do coletor',
        frequenciaHoras: 4,
        primeiro: em(10, '12:00'),
        por: CAMILA,
        suspensa: { em: em(8, '10:00'), motivo: 'Sonda retirada; urinando sozinho', por: CAMILA },
      },
      {
        chave: 'ali',
        kind: 'ALIMENTACAO',
        descricao: 'Ração urinária úmida, 1 sachê',
        frequenciaHoras: 8,
        primeiro: em(9, '08:00'),
        por: CAMILA,
      },
    ],
    ajustes: [],
    evolucoes: {
      '10-MANHA': {
        em: em(10, '10:30'),
        por: CAMILA,
        vitais: [38.4, 196, 36],
        observado:
          'Desobstruído sob sedação, saiu tampão de cristais. Sonda fixada, urina com sangue.',
        avaliacao: 'Obstrução uretral resolvida; bexiga distendida e dolorida.',
        plano: 'Sonda por 48 horas, fluido, analgesia e colar elizabetano.',
      },
      '9-MANHA': {
        em: em(9, '10:00'),
        por: CAMILA,
        vitais: [38.3, 172, 28],
        observado: 'Urina clareando no coletor, sem coágulos. Comeu a ração úmida.',
        avaliacao: 'Evolução boa depois da desobstrução.',
        plano: 'Retirar a sonda amanhã cedo.',
      },
    },
    rotina: {
      ATENCAO: [
        {
          observado:
            'Sonda pérvia, urina com sangue em melhora. Tentando lamber a região, colar mantido.',
          avaliacao: 'Pós-desobstrução sem intercorrências.',
          plano: 'Manter sonda e analgesia.',
        },
      ],
      ESTAVEL: [
        {
          observado: 'Urinou sozinho na caixa depois da retirada da sonda, jato bom.',
          avaliacao: 'Recuperado.',
          plano: 'Observar 24 horas sem sonda.',
        },
        {
          observado: 'Comeu bem e está brincando com a bolinha.',
          avaliacao: 'Estável.',
          plano: 'Manter.',
        },
      ],
    },
    vitais: { ATENCAO: [38.0, 38.8, 170, 210, 28, 40], ESTAVEL: [38.0, 38.7, 150, 190, 22, 32] },
    boletins: [
      {
        em: em(10, '12:00'),
        por: CAMILA,
        status: 'ENVIADO',
        texto:
          'Olá, Felipe! O Simba estava com a uretra entupida e precisou ser desobstruído com sedação. Correu tudo bem: ele está com uma sonda para a bexiga descansar e já está bem mais confortável.',
      },
      {
        em: em(8, '11:00'),
        por: CAMILA,
        status: 'ENVIADO',
        texto:
          'Tiramos a sonda hoje e o Simba fez xixi sozinho na caixa de areia, com jato bom. Vamos observar mais um dia antes da alta.',
      },
    ],
    ligacoes: [],
  },

  /* ---------------------------------------------------------------- Tobias (alta) */
  {
    id: 'demo-int-0003',
    pacienteId: 'demo-pac-018',
    leitos: [{ leitoId: 'demo-leito-uti1', desde: em(8, '20:15') }],
    responsavel: RAFAEL,
    internadoPor: RAFAEL,
    motivo: 'Crise de tosse com a língua arroxeada',
    diagnostico: 'Colapso de traqueia (grau III) em crise aguda',
    observacao: 'Usar peitoral para conter; evitar estresse. Nunca puxar pela coleira.',
    entradaEm: em(8, '20:15'),
    pesoKg: 3,
    gravidades: [
      { em: em(8, '20:15'), gravidade: 'CRITICO' },
      { em: em(7, '09:00'), gravidade: 'ATENCAO' },
      { em: em(6, '08:00'), gravidade: 'ESTAVEL' },
    ],
    altaPrevistaEm: null,
    alta: {
      em: em(6, '11:00'),
      por: RAFAEL,
      orientacao:
        'Use sempre peitoral, nunca coleira. Evite calor, agitação e cheiros fortes como perfume e fumaça. Prednisolona 5 mg: 1/4 de comprimido uma vez ao dia por 5 dias e depois em dias alternados até o retorno. Se a tosse voltar forte ou a língua ficar arroxeada, venha na hora. Retorno em 10 dias.',
    },
    preferencia: PREFERENCIA_PADRAO,
    receita: [
      {
        chave: 'but',
        kind: 'MEDICAMENTO',
        remedio: 'butorfanol',
        via: 'INTRAVENOSA',
        mgPorKg: 0.2,
        frequenciaHoras: 6,
        primeiro: em(8, '21:00'),
        por: RAFAEL,
      },
      {
        chave: 'dex',
        kind: 'MEDICAMENTO',
        remedio: 'dexametasona',
        via: 'INTRAVENOSA',
        mgPorKg: 0.1,
        frequenciaHoras: 24,
        primeiro: em(8, '21:00'),
        por: RAFAEL,
        suspensa: { em: em(7, '08:30'), motivo: 'Trocado por prednisolona oral', por: RAFAEL },
      },
      {
        chave: 'oxi',
        kind: 'PROCEDIMENTO',
        descricao: OXIGENIO,
        frequenciaHoras: 2,
        primeiro: em(8, '21:00'),
        por: RAFAEL,
        suspensa: { em: em(7, '09:00'), motivo: 'Saturação estável em ar ambiente', por: RAFAEL },
      },
      {
        chave: 'pre',
        kind: 'MEDICAMENTO',
        remedio: 'prednisolonaComprimido',
        via: 'ORAL',
        mgPorKg: 0.5,
        frequenciaHoras: 24,
        primeiro: em(7, '09:00'),
        por: RAFAEL,
      },
    ],
    ajustes: [],
    evolucoes: {
      '8-NOITE': {
        em: em(8, '21:00'),
        por: RAFAEL,
        vitais: [39.4, 184, 66],
        observado:
          'Chegou com tosse em grasnado sem parar, cianose de língua e esforço inspiratório. Melhorou no oxigênio depois da sedação leve.',
        avaliacao: 'Crise aguda de colapso de traqueia.',
        plano: 'Oxigênio, butorfanol a cada 6 horas, dexametasona e mínimo de manipulação.',
      },
      '7-MANHA': {
        em: em(7, '09:00'),
        por: RAFAEL,
        vitais: [38.8, 146, 36],
        observado: 'Tosse esporádica, dormiu tranquilo fora do oxigênio por 3 horas.',
        avaliacao: 'Saiu da crise.',
        plano: 'Suspender o oxigênio, trocar a dexametasona por prednisolona oral.',
      },
      '6-MANHA': {
        em: em(6, '08:00'),
        por: RAFAEL,
        vitais: [38.5, 120, 26],
        observado: 'Noite sem tosse. Comeu e passeou no corredor de peitoral.',
        avaliacao: 'Estável.',
        plano: 'Alta hoje com prednisolona e orientação de manejo.',
      },
    },
    rotina: {
      CRITICO: [
        {
          observado: 'Tosse a cada poucos minutos, piora na manipulação. Segue no oxigênio.',
          avaliacao: 'Crise respiratória em controle parcial.',
          plano: 'Manter sedação leve e oxigênio.',
        },
      ],
      ATENCAO: [
        {
          observado: 'Tosse curta duas vezes no plantão, sem cianose.',
          avaliacao: 'Melhora clínica.',
          plano: 'Manter em ar ambiente.',
        },
      ],
      ESTAVEL: [{ observado: 'Sem tosse, ativo.', avaliacao: 'Estável.', plano: 'Manter.' }],
    },
    vitais: {
      CRITICO: [38.8, 39.6, 150, 190, 50, 70],
      ATENCAO: [38.5, 39.1, 130, 160, 32, 44],
      ESTAVEL: [38.2, 38.8, 110, 140, 22, 30],
    },
    boletins: [
      {
        em: em(8, '20:40'),
        por: RAFAEL,
        status: 'ENVIADO',
        retencao: 'ENTROU_CRITICO',
        ligacao: { em: em(8, '20:45'), por: RAFAEL },
        enviadoEm: em(8, '20:50'),
        texto:
          'André, como falamos por telefone: o Tobias teve uma crise forte por causa da traqueia e está na UTI, no oxigênio e com remédio para acalmar a tosse. Ele já está respirando melhor. Mandamos notícias logo cedo.',
      },
      {
        em: em(7, '10:00'),
        por: RAFAEL,
        status: 'ENVIADO',
        texto:
          'O Tobias passou a noite mais tranquilo e já ficou algumas horas fora do oxigênio. A tosse diminuiu bastante.',
      },
    ],
    ligacoes: [],
  },

  /* ----------------------------------------------------------------- Pingo (alta) */
  {
    id: 'demo-int-0004',
    pacienteId: 'demo-pac-020',
    leitos: [{ leitoId: 'demo-leito-r3', desde: em(5, '10:00') }],
    responsavel: BRUNO,
    internadoPor: BRUNO,
    motivo: 'Fraqueza nas patas de trás, salivação e olhar parado',
    diagnostico: 'Hipoglicemia (glicemia 42 mg/dL); suspeita de insulinoma',
    observacao: 'Furão: alimentar a cada 4 horas, inclusive de madrugada.',
    entradaEm: em(5, '10:00'),
    pesoKg: 1.05,
    gravidades: [
      { em: em(5, '10:00'), gravidade: 'ATENCAO' },
      { em: em(4, '10:00'), gravidade: 'ESTAVEL' },
    ],
    altaPrevistaEm: null,
    alta: {
      em: em(3, '17:00'),
      por: BRUNO,
      orientacao:
        'Ofereça comida rica em proteína a cada 4 a 6 horas, inclusive à noite. Nada de frutas, petiscos doces ou ração de gato com muito carboidrato. Prednisolona solução 3 mg/mL: 0,18 mL a cada 12 horas, sem parar por conta própria. Se o Pingo ficar fraco, babando ou com o olhar parado, passe mel na gengiva e venha à clínica. Ultrassom de abdômen agendado para a próxima semana.',
    },
    preferencia: PREFERENCIA_PADRAO,
    receita: [
      {
        chave: 'flu',
        kind: 'FLUIDO',
        descricao: 'Glicose 5% em Ringer lactato, 4 mL/h em bomba de infusão',
        frequenciaHoras: 1,
        primeiro: em(5, '10:30'),
        por: BRUNO,
        suspensa: { em: em(4, '10:00'), motivo: 'Glicemia estável comendo sozinho', por: BRUNO },
      },
      {
        chave: 'pre',
        kind: 'MEDICAMENTO',
        remedio: 'prednisolonaSolucao',
        via: 'ORAL',
        mgPorKg: 0.5,
        frequenciaHoras: 12,
        primeiro: em(5, '20:00'),
        por: BRUNO,
      },
      {
        chave: 'ali',
        kind: 'ALIMENTACAO',
        descricao: 'Papinha de carne para furões, 2 colheres',
        frequenciaHoras: 4,
        primeiro: em(5, '12:00'),
        por: BRUNO,
      },
      {
        chave: 'gli',
        kind: 'MONITORAMENTO',
        descricao: 'Glicemia no glicosímetro (alvo acima de 70 mg/dL)',
        frequenciaHoras: 6,
        primeiro: em(5, '12:00'),
        por: BRUNO,
      },
    ],
    ajustes: [],
    evolucoes: {
      '5-MANHA': {
        em: em(5, '10:40'),
        por: BRUNO,
        vitais: [37.6, 228, 40],
        observado:
          'Chegou prostrado, salivando, com as patas de trás fracas. Glicemia de 42 mg/dL; melhorou minutos depois da glicose na veia.',
        avaliacao: 'Crise hipoglicêmica; insulinoma é a principal suspeita na idade e na espécie.',
        plano: 'Glicose no fluido, comida a cada 4 horas, glicemia a cada 6 horas e prednisolona.',
      },
      '4-MANHA': {
        em: em(4, '10:00'),
        por: BRUNO,
        vitais: [38.4, 210, 34],
        observado: 'Glicemias entre 78 e 95 mg/dL comendo a papinha. Explorando o leito.',
        avaliacao: 'Glicemia controlada com dieta e corticoide.',
        plano: 'Suspender a glicose do fluido e observar 24 horas.',
      },
    },
    rotina: {
      ATENCAO: [
        {
          observado: 'Comeu a papinha toda. Glicemia de 68 mg/dL antes da refeição.',
          avaliacao: 'Ainda dependente da glicose do fluido.',
          plano: 'Manter.',
        },
      ],
      ESTAVEL: [
        {
          observado: 'Glicemia de 88 mg/dL. Brincando com o túnel de pano.',
          avaliacao: 'Estável.',
          plano: 'Manter a dieta a cada 4 horas.',
        },
      ],
    },
    vitais: { ATENCAO: [37.4, 38.2, 200, 250, 34, 44], ESTAVEL: [37.8, 39.0, 180, 240, 30, 40] },
    boletins: [],
    ligacoes: [
      { em: em(5, '11:30'), por: BRUNO },
      { em: em(3, '15:00'), por: BRUNO },
    ],
  },

  /* ------------------------------------------------------------------------- Bento */
  {
    id: 'demo-int-0005',
    pacienteId: 'demo-pac-007-2',
    leitos: [{ leitoId: 'demo-leito-f1', desde: em(5, '14:30') }],
    responsavel: CAMILA,
    internadoPor: CAMILA,
    motivo: 'Apatia, vômitos e desidratação; piora da doença renal crônica',
    diagnostico: 'Doença renal crônica (estágio 2 IRIS) agudizada, com azotemia e hipocalemia',
    observacao:
      'Gato tranquilo na manipulação. A tutora prefere notícias pelo app e ligação só se piorar.',
    entradaEm: em(5, '14:30'),
    pesoKg: 4.6,
    gravidades: [
      { em: em(5, '14:30'), gravidade: 'ATENCAO' },
      { em: em(3, '09:10'), gravidade: 'ESTAVEL' },
      { em: em(0, '08:30'), gravidade: 'ATENCAO' },
    ],
    altaPrevistaEm: null,
    preferencia: {
      frequenciaHoras: 12,
      fotoSempre: false,
      silencioNoturno: true,
      definidaPor: 'RESPONSAVEL',
      definidaEm: em(5, '18:40'),
    },
    receita: [
      {
        chave: 'flu',
        kind: 'FLUIDO',
        descricao: 'Ringer lactato com KCl 20 mEq/L, 12 mL/h em bomba de infusão',
        frequenciaHoras: 1,
        primeiro: em(5, '15:00'),
        por: CAMILA,
      },
      {
        chave: 'ond',
        kind: 'MEDICAMENTO',
        remedio: 'ondansetrona',
        via: 'INTRAVENOSA',
        mgPorKg: 0.5,
        frequenciaHoras: 8,
        primeiro: em(5, '22:00'),
        por: CAMILA,
      },
      {
        chave: 'ome',
        kind: 'MEDICAMENTO',
        remedio: 'omeprazol',
        via: 'INTRAVENOSA',
        mgPorKg: 1,
        frequenciaHoras: 12,
        primeiro: em(4, '08:00'),
        por: CAMILA,
      },
      {
        chave: 'mar',
        kind: 'MEDICAMENTO',
        remedio: 'maropitant',
        via: 'SUBCUTANEA',
        mgPorKg: 1,
        frequenciaHoras: 24,
        primeiro: em(4, '08:00'),
        por: CAMILA,
      },
      {
        chave: 'bup',
        kind: 'MEDICAMENTO',
        remedio: 'buprenorfina',
        via: 'INTRAVENOSA',
        mgPorKg: 0.02,
        frequenciaHoras: 8,
        primeiro: em(5, '15:00'),
        por: CAMILA,
        suspensa: { em: em(3, '09:10'), motivo: 'Sem sinais de dor na avaliação', por: CAMILA },
      },
      {
        chave: 'ali',
        kind: 'ALIMENTACAO',
        descricao: 'Ração renal úmida aquecida, 1/4 de lata',
        frequenciaHoras: 6,
        primeiro: em(4, '06:00'),
        por: CAMILA,
      },
      {
        chave: 'mon',
        kind: 'MONITORAMENTO',
        descricao: 'Pesar, avaliar a hidratação e anotar se urinou',
        frequenciaHoras: 12,
        primeiro: em(4, '07:00'),
        por: CAMILA,
      },
    ],
    ajustes: [
      {
        chave: 'ali',
        em: em(0, '00:00'),
        status: 'FEITA',
        por: LUCAS,
        aos: 6,
        observacao: 'Comeu cerca de um terço',
      },
      {
        chave: 'ali',
        em: em(0, '06:00'),
        status: 'RECUSADA',
        motivo: 'RECUSOU',
        por: LUCAS,
        aos: 4,
        observacao: 'Cheirou e virou o rosto',
      },
      { chave: 'flu', em: em(0, '10:00'), status: 'FEITA', por: CAMILA, aos: 4 },
    ],
    evolucoes: {
      '5-TARDE': {
        em: em(5, '15:20'),
        por: CAMILA,
        vitais: [37.8, 196, 34],
        observado:
          'Apático, desidratação estimada em 8%. Vomitou espuma uma vez na chegada. Não comeu.',
        avaliacao: 'Agudização da doença renal crônica: creatinina 4,8 mg/dL e potássio 3,2 mEq/L.',
        plano:
          'Fluidoterapia com reposição de potássio, antiemético, protetor gástrico e analgesia. Repetir creatinina e potássio em 48 horas.',
      },
      '3-MANHA': {
        em: em(3, '09:10'),
        por: CAMILA,
        vitais: [38.3, 176, 26],
        observado:
          'Comeu sozinho cerca de 1/4 de lata. Ronronou na manipulação. Sem vômitos desde ontem.',
        avaliacao: 'Creatinina caiu de 4,8 para 3,6 mg/dL; potássio normal. Sem sinais de dor.',
        plano: 'Suspender a buprenorfina. Manter fluido e medicação, reavaliar exames em 48 horas.',
      },
      '0-MANHA': {
        em: em(0, '09:20'),
        por: MARINA,
        vitais: [37.9, 188, 30],
        observado:
          'Vomitou duas vezes de madrugada e recusou a ração das 06h. Mais quieto, escondido no fundo da gaiola.',
        avaliacao: 'Piora clínica. Creatinina subiu para 5,2 mg/dL e potássio caiu para 3,1 mEq/L.',
        plano:
          'Aumentar a reposição de potássio no fluido e manter o antiemético. Conversar com a tutora sobre o prognóstico e a possibilidade de diálise em centro de referência.',
        antes: {
          em: em(0, '08:30'),
          por: CAMILA,
          vitais: [37.9, 188, 30],
          observado:
            'Vomitou duas vezes de madrugada e recusou a ração das 06h. Mais quieto, escondido no fundo da gaiola.',
          avaliacao: 'Piora clínica; colhido sangue para creatinina e potássio.',
          plano: 'Manter fluido e antiemético. Aguardar os exames.',
        },
      },
    },
    rotina: {
      ATENCAO: [
        {
          observado:
            'Aceitou um pouco de patê oferecido na seringa. Sem vômitos no plantão. Urinou volume bom na caixa.',
          avaliacao: 'Hidratação melhorando; ainda apático.',
          plano: 'Manter fluido e antiemético. Oferecer a ração renal aquecida.',
        },
        {
          observado: 'Ficou deitado a maior parte do plantão. Vomitou espuma uma vez às 02h.',
          avaliacao: 'Náusea persistente; turgor de pele ainda diminuído.',
          plano: 'Manter o antiemético e reavaliar a hidratação pela manhã.',
        },
      ],
      ESTAVEL: [
        {
          observado: 'Noite tranquila, usou a caixa de areia duas vezes. Voltou a se lamber.',
          avaliacao: 'Estável.',
          plano: 'Manter fluido e medicação.',
        },
        {
          observado: 'Peso estável em 4,6 kg. Comeu metade da lata oferecida.',
          avaliacao: 'Em recuperação.',
          plano: 'Programar a redução do fluido se seguir comendo.',
        },
        {
          observado: 'Ronronando, aceita carinho. Sem vômitos.',
          avaliacao: 'Estável.',
          plano: 'Manter.',
        },
      ],
    },
    vitais: { ATENCAO: [37.4, 38.2, 170, 210, 26, 38], ESTAVEL: [37.8, 38.6, 160, 190, 22, 32] },
    boletins: [
      {
        em: em(5, '16:10'),
        por: CAMILA,
        status: 'ENVIADO',
        texto:
          'Olá, Renata! O Bento ficou internado para tratar a desidratação e a piora dos rins. Ele já está no soro, recebeu remédio para o enjoo e está quietinho no leito dos gatos, longe do barulho dos cães. Vamos mandando notícias por aqui.',
      },
      {
        em: em(3, '11:00'),
        por: CAMILA,
        status: 'ENVIADO',
        texto:
          'Boa notícia: o Bento voltou a comer sozinho hoje de manhã e o exame de sangue mostrou que os rins estão respondendo ao tratamento. Ele segue no soro e com as medicações.',
      },
      {
        em: em(0, '08:30'),
        por: null,
        status: 'LIBERADO',
        retencao: 'PIORA',
        ligacao: { em: em(0, '09:15'), por: CAMILA },
        texto: RETIDO_DO_SISTEMA('Bento'),
      },
    ],
    ligacoes: [],
  },

  /* -------------------------------------------------------------------------- Duna */
  {
    id: 'demo-int-0006',
    pacienteId: 'demo-pac-010',
    leitos: [
      { leitoId: 'demo-leito-uti2', desde: em(4, '21:10') },
      { leitoId: 'demo-leito-r1', desde: em(1, '11:00'), motivo: 'Saiu do oxigênio; UTI liberada' },
    ],
    responsavel: RAFAEL,
    internadoPor: RAFAEL,
    motivo: 'Falta de ar intensa e tosse; edema pulmonar',
    diagnostico:
      'Insuficiência cardíaca congestiva por doença valvar mitral (estágio C), com edema pulmonar',
    observacao:
      'Usa pimobendan em casa. O tutor pediu para ser avisado antes de qualquer procedimento.',
    entradaEm: em(4, '21:10'),
    pesoKg: 7.4,
    gravidades: [
      { em: em(4, '21:10'), gravidade: 'CRITICO' },
      { em: em(3, '14:00'), gravidade: 'ATENCAO' },
      { em: em(1, '10:30'), gravidade: 'ESTAVEL' },
    ],
    altaPrevistaEm: em(-1, '12:00'),
    preferencia: { ...PREFERENCIA_PADRAO, frequenciaHoras: 8 },
    receita: [
      {
        chave: 'fu1',
        kind: 'MEDICAMENTO',
        remedio: 'furosemida',
        via: 'INTRAVENOSA',
        mgPorKg: 2,
        frequenciaHoras: 6,
        primeiro: em(4, '21:30'),
        por: RAFAEL,
        suspensa: {
          em: em(2, '09:30'),
          motivo: 'Dose trocada por uma prescrição nova',
          por: RAFAEL,
          trocadaPor: 'fu2',
        },
      },
      {
        chave: 'fu2',
        kind: 'MEDICAMENTO',
        remedio: 'furosemida',
        via: 'INTRAVENOSA',
        mgPorKg: 1,
        frequenciaHoras: 12,
        primeiro: em(2, '20:00'),
        por: RAFAEL,
        substitui: 'fu1',
      },
      {
        chave: 'pim',
        kind: 'MEDICAMENTO',
        remedio: 'pimobendan',
        via: 'ORAL',
        mgPorKg: 0.25,
        frequenciaHoras: 12,
        primeiro: em(3, '08:00'),
        por: RAFAEL,
        observacao: 'Dar uma hora antes da comida',
      },
      {
        chave: 'oxi',
        kind: 'PROCEDIMENTO',
        descricao: OXIGENIO,
        frequenciaHoras: 2,
        primeiro: em(4, '22:00'),
        por: RAFAEL,
        suspensa: { em: em(1, '10:30'), motivo: 'Saturação estável em ar ambiente', por: RAFAEL },
      },
      {
        chave: 'fr',
        kind: 'MONITORAMENTO',
        descricao: 'Frequência respiratória em repouso (alvo abaixo de 40 mpm)',
        frequenciaHoras: 4,
        primeiro: em(4, '23:00'),
        por: RAFAEL,
      },
      {
        chave: 'ali',
        kind: 'ALIMENTACAO',
        descricao: 'Ração cardíaca com pouco sódio, 1/3 da porção do dia',
        frequenciaHoras: 8,
        primeiro: em(3, '06:00'),
        por: RAFAEL,
      },
    ],
    ajustes: [
      {
        chave: 'ali',
        em: em(3, '06:00'),
        status: 'RECUSADA',
        motivo: 'RECUSOU',
        por: LUCAS,
        aos: 5,
        observacao: 'Ainda ofegante, não quis comer',
      },
    ],
    evolucoes: {
      '4-NOITE': {
        em: em(4, '22:15'),
        por: RAFAEL,
        vitais: [38.7, 182, 72],
        observado:
          'Chegou com dispneia intensa, tosse e crepitação pulmonar dos dois lados. Mucosas pálidas, TPC de 3 segundos.',
        avaliacao: 'Edema pulmonar cardiogênico por doença valvar mitral.',
        plano:
          'Furosemida 2 mg/kg na veia a cada 6 horas, oxigênio e repouso absoluto. Radiografia de tórax pela manhã.',
      },
      '3-MANHA': {
        em: em(3, '09:00'),
        por: RAFAEL,
        vitais: [38.6, 164, 52],
        observado:
          'Respiração mais tranquila depois da terceira dose de furosemida. Urinou bastante. Ainda não deita de lado.',
        avaliacao:
          'Boa resposta ao diurético; ainda depende do oxigênio. Radiografia com edema em regressão.',
        plano: 'Manter diurético, iniciar pimobendan. Testar saída do oxigênio à tarde.',
      },
      '3-TARDE': {
        em: em(3, '14:00'),
        por: RAFAEL,
        vitais: [38.5, 148, 42],
        observado: 'Passou uma hora fora do oxigênio sem esforço. Deitou de lado e dormiu.',
        avaliacao: 'Edema regredindo bem.',
        plano:
          'Oxigênio só se a frequência respiratória passar de 50. Reduzir furosemida em 48 horas.',
      },
      '1-MANHA': {
        em: em(1, '10:30'),
        por: RAFAEL,
        vitais: [38.4, 124, 30],
        observado:
          'Fora do oxigênio desde ontem à noite, frequência em repouso de 28 mpm. Comeu toda a porção e passeou no corredor.',
        avaliacao: 'Insuficiência cardíaca compensada.',
        plano: 'Suspender o oxigênio e passar para o leito comum. Alta prevista para amanhã.',
      },
      '0-MANHA': {
        em: em(0, '10:20'),
        por: RAFAEL,
        vitais: [38.3, 118, 26],
        observado:
          'Ativa, comeu bem às 06h. Frequência em repouso de 26 mpm, sem tosse. Sopro mitral já conhecido, sem crepitação.',
        avaliacao: 'Compensada.',
        plano:
          'Ecocardiograma de controle às 14h. Se mantiver, alta amanhã às 12h com furosemida, pimobendan e benazepril.',
      },
    },
    rotina: {
      CRITICO: [
        {
          observado:
            'Dispneia ainda importante, 60 mpm em repouso. Fica sentada com o pescoço esticado.',
          avaliacao: 'Edema pulmonar com resposta lenta.',
          plano: 'Manter oxigênio e furosemida. Chamar o veterinário se passar de 70 mpm.',
        },
      ],
      ATENCAO: [
        {
          observado:
            'Comeu metade da ração cardíaca. Frequência em repouso entre 36 e 40 mpm. Sem tosse.',
          avaliacao: 'Edema regredindo; tolera bem a medicação oral.',
          plano: 'Manter.',
        },
        {
          observado: 'Noite tranquila, dormiu a maior parte do tempo. Uma tosse curta às 02h.',
          avaliacao: 'Estável dentro do quadro.',
          plano: 'Manter e contar a frequência a cada 4 horas.',
        },
      ],
      ESTAVEL: [
        {
          observado: 'Noite sem tosse. Urinou e defecou normalmente.',
          avaliacao: 'Estável.',
          plano: 'Manter pimobendan e furosemida.',
        },
      ],
    },
    vitais: {
      CRITICO: [38.4, 39.0, 160, 190, 56, 72],
      ATENCAO: [38.2, 38.8, 130, 160, 34, 46],
      ESTAVEL: [38.1, 38.7, 110, 130, 22, 32],
    },
    boletins: [
      {
        em: em(4, '21:30'),
        por: RAFAEL,
        status: 'ENVIADO',
        retencao: 'ENTROU_CRITICO',
        ligacao: { em: em(4, '21:35'), por: RAFAEL },
        enviadoEm: em(4, '21:42'),
        texto:
          'Gustavo, como conversamos por telefone: a Duna chegou com muita falta de ar por causa do coração e está na UTI, no oxigênio, recebendo diurético na veia. As próximas horas são importantes. Mandamos notícias logo cedo.',
      },
      {
        em: em(3, '14:30'),
        por: RAFAEL,
        status: 'ENVIADO',
        texto:
          'A Duna respondeu bem ao diurético: está respirando com menos esforço e conseguiu dormir. Ainda precisa do oxigênio em alguns momentos, mas o pior já passou. Hoje começamos o remédio do coração pela boca.',
      },
      {
        em: em(1, '11:15'),
        por: RAFAEL,
        status: 'ENVIADO',
        foto: { url: '/demo/pacientes/duna.jpg', legenda: 'Duna no leito novo, já sem oxigênio' },
        texto:
          'A Duna saiu da UTI! Está respirando bem sem o oxigênio, comeu toda a ração e até abanou o rabo para a equipe. Se continuar assim, a alta deve sair amanhã ao meio-dia. Vamos ensinar você a contar a respiração dela em casa.',
      },
    ],
    ligacoes: [],
  },

  /* ------------------------------------------------------------------------- Toddy */
  {
    id: 'demo-int-0007',
    pacienteId: 'demo-pac-040',
    leitos: [{ leitoId: 'demo-leito-i1', desde: em(2, '16:40') }],
    responsavel: MARINA,
    internadoPor: MARINA,
    motivo: 'Vômitos, apatia e mucosas amareladas; suspeita de leptospirose',
    diagnostico: 'Leptospirose (suspeita), aguardando sorologia (MAT) e PCR; lesão renal aguda',
    observacao:
      'ISOLAMENTO: luvas, avental e propé. A urina é infectante: descartar os tapetes como resíduo infectante. Tutor avisado do risco para as pessoas da casa.',
    entradaEm: em(2, '16:40'),
    pesoKg: 14.6,
    gravidades: [
      { em: em(2, '16:40'), gravidade: 'ATENCAO' },
      { em: em(1, '18:00'), gravidade: 'ESTAVEL' },
      { em: em(0, '01:10'), gravidade: 'ATENCAO' },
    ],
    altaPrevistaEm: null,
    preferencia: PREFERENCIA_PADRAO,
    receita: [
      {
        chave: 'flu',
        kind: 'FLUIDO',
        descricao: 'Ringer lactato, 45 mL/h em bomba de infusão',
        frequenciaHoras: 1,
        primeiro: em(2, '17:00'),
        por: MARINA,
      },
      {
        chave: 'amp',
        kind: 'MEDICAMENTO',
        remedio: 'ampicilina',
        via: 'INTRAVENOSA',
        mgPorKg: 22,
        frequenciaHoras: 8,
        primeiro: em(2, '18:00'),
        por: MARINA,
      },
      {
        chave: 'ome',
        kind: 'MEDICAMENTO',
        remedio: 'omeprazol',
        via: 'INTRAVENOSA',
        mgPorKg: 1,
        frequenciaHoras: 24,
        primeiro: em(1, '09:00'),
        por: MARINA,
      },
      {
        chave: 'mar',
        kind: 'MEDICAMENTO',
        remedio: 'maropitant',
        via: 'SUBCUTANEA',
        mgPorKg: 1,
        frequenciaHoras: 24,
        primeiro: em(2, '17:00'),
        por: MARINA,
      },
      {
        chave: 'deb',
        kind: 'MONITORAMENTO',
        descricao: 'Pesar o tapete higiênico e estimar o débito urinário',
        frequenciaHoras: 4,
        primeiro: em(2, '18:00'),
        por: MARINA,
      },
      {
        chave: 'ali',
        kind: 'ALIMENTACAO',
        descricao: 'Ração gastrointestinal úmida em pequena quantidade',
        frequenciaHoras: 8,
        primeiro: em(1, '07:00'),
        por: MARINA,
      },
    ],
    ajustes: [
      { chave: 'ome', em: em(0, '09:00'), status: 'PENDENTE' },
      { chave: 'amp', em: em(0, '10:00'), status: 'PENDENTE' },
      { chave: 'flu', em: em(0, '10:00'), status: 'PENDENTE' },
      {
        chave: 'ali',
        em: em(1, '23:00'),
        status: 'RECUSADA',
        motivo: 'CUSPIU_OU_VOMITOU',
        por: LUCAS,
        aos: 8,
        observacao: 'Vomitou logo depois de comer',
      },
      {
        chave: 'ali',
        em: em(0, '07:00'),
        status: 'PULADA',
        motivo: 'ORDEM_VETERINARIA',
        por: MARINA,
        aos: 14,
        observacao: 'Jejum até parar de vomitar, ordem da Dra. Marina',
      },
      {
        chave: 'deb',
        em: em(0, '10:00'),
        status: 'FEITA',
        por: MARINA,
        aos: 9,
        observacao: 'Tapete com 60 g: débito baixo',
      },
    ],
    evolucoes: {
      '2-TARDE': {
        em: em(2, '17:30'),
        por: MARINA,
        vitais: [39.7, 128, 30],
        observado:
          'Chegou prostrado, mucosas levemente amareladas, vômito bilioso. Dor à palpação do abdômen cranial.',
        avaliacao:
          'Suspeita de leptospirose: sem vacina há 2 anos e contato com água de enchente na semana passada. Azotemia leve.',
        plano:
          'Isolamento, fluidoterapia, ampicilina na veia, antiemético e protetor gástrico. Sorologia (MAT) e PCR enviados.',
      },
      '1-TARDE': {
        em: em(1, '18:00'),
        por: MARINA,
        vitais: [38.9, 104, 24],
        observado: 'Mais ativo, abanou o rabo na troca do tapete. Aceitou um pouco de ração úmida.',
        avaliacao: 'Melhora clínica; icterícia mais discreta.',
        plano: 'Manter antibiótico e oferecer comida em pequenas porções.',
      },
      '1-NOITE': {
        em: em(0, '01:10'),
        por: LUCAS,
        vitais: [39.6, 122, 28],
        observado:
          'Vomitou duas vezes (23h e 00h40), conteúdo amarelado. Pouca urina no tapete das 22h.',
        avaliacao: 'Piora; Dra. Marina avisada por telefone à 00h50.',
        plano:
          'Jejum até nova ordem, manter o fluido. Pesar o tapete a cada 4 horas para estimar o débito urinário.',
      },
    },
    rotina: {
      ATENCAO: [
        {
          observado: 'Sem vômitos no período. Bebeu água. Urina escura, em volume razoável.',
          avaliacao: 'Estável dentro da suspeita.',
          plano: 'Manter fluido e antibiótico. Aguardar a sorologia.',
        },
        {
          observado: 'Prostrado, levanta só para trocar de posição. Mucosas ainda amareladas.',
          avaliacao: 'Sem melhora evidente.',
          plano: 'Repetir a bioquímica amanhã cedo.',
        },
      ],
      ESTAVEL: [
        {
          observado: 'Dormiu bem, sem vômitos. Urina em volume bom.',
          avaliacao: 'Estável.',
          plano: 'Manter.',
        },
      ],
    },
    vitais: { ATENCAO: [39.2, 39.9, 110, 135, 24, 34], ESTAVEL: [38.6, 39.2, 90, 115, 20, 28] },
    boletins: [],
    ligacoes: [
      { em: em(2, '17:20'), por: MARINA },
      { em: em(0, '07:50'), por: MARINA },
    ],
  },

  /* --------------------------------------------------------------------- Floquinho */
  {
    id: 'demo-int-0008',
    pacienteId: 'demo-pac-017',
    leitos: [{ leitoId: 'demo-leito-r2', desde: em(2, '10:20') }],
    responsavel: BRUNO,
    internadoPor: BRUNO,
    motivo: 'Sem comer e sem fezes há 24 horas',
    diagnostico: 'Estase gastrointestinal (íleo funcional), sem sinais de obstrução na radiografia',
    observacao: 'Coelho assustado com barulho: manter o leito coberto com pano. Feno à vontade.',
    entradaEm: em(2, '10:20'),
    pesoKg: 1.55,
    gravidades: [
      { em: em(2, '10:20'), gravidade: 'ATENCAO' },
      { em: em(1, '09:00'), gravidade: 'ESTAVEL' },
    ],
    altaPrevistaEm: em(0, '17:00'),
    preferencia: {
      frequenciaHoras: 12,
      fotoSempre: true,
      silencioNoturno: true,
      definidaPor: 'RESPONSAVEL',
      definidaEm: em(2, '12:05'),
    },
    receita: [
      {
        chave: 'sc',
        kind: 'PROCEDIMENTO',
        descricao: 'Ringer lactato subcutâneo, 50 mL',
        frequenciaHoras: 12,
        primeiro: em(2, '11:00'),
        por: BRUNO,
        suspensa: { em: em(1, '09:00'), motivo: 'Voltou a beber água sozinho', por: BRUNO },
      },
      {
        chave: 'met',
        kind: 'MEDICAMENTO',
        remedio: 'metoclopramida',
        via: 'SUBCUTANEA',
        mgPorKg: 0.5,
        frequenciaHoras: 8,
        primeiro: em(2, '14:00'),
        por: BRUNO,
      },
      {
        chave: 'mel',
        kind: 'MEDICAMENTO',
        remedio: 'meloxicam',
        via: 'SUBCUTANEA',
        mgPorKg: 0.5,
        frequenciaHoras: 24,
        primeiro: em(1, '09:00'),
        por: BRUNO,
      },
      {
        chave: 'ali',
        kind: 'ALIMENTACAO',
        descricao: 'Papinha de recuperação (Critical Care), 15 mL na seringa',
        frequenciaHoras: 6,
        primeiro: em(2, '12:00'),
        por: BRUNO,
      },
      {
        chave: 'mon',
        kind: 'MONITORAMENTO',
        descricao: 'Anotar as fezes (quantidade e formato) e se comeu feno',
        frequenciaHoras: 4,
        primeiro: em(2, '14:00'),
        por: BRUNO,
      },
    ],
    ajustes: [
      {
        chave: 'ali',
        em: em(0, '06:00'),
        status: 'FEITA',
        por: LUCAS,
        aos: 3,
        observacao: 'Aceitou os 15 mL e comeu feno em seguida',
      },
      { chave: 'mel', em: em(0, '09:00'), status: 'FEITA', por: BRUNO, aos: 4 },
      {
        chave: 'mon',
        em: em(0, '10:00'),
        status: 'FEITA',
        por: BRUNO,
        aos: 6,
        observacao: 'Cíbalas grandes e úmidas, comeu feno',
      },
    ],
    evolucoes: {
      '2-MANHA': {
        em: em(2, '11:10'),
        por: BRUNO,
        vitais: [38.1, 236, 58],
        observado:
          'Sem fezes há 24 horas, não comeu feno nem ração. Abdômen distendido e dolorido, rangendo os dentes.',
        avaliacao: 'Estase gastrointestinal; a radiografia não mostra obstrução.',
        plano:
          'Fluido subcutâneo, metoclopramida, analgesia e alimentação assistida a cada 6 horas.',
      },
      '1-MANHA': {
        em: em(1, '09:00'),
        por: BRUNO,
        vitais: [38.9, 214, 48],
        observado:
          'Fez cíbalas pequenas e secas pela manhã. Começou a mordiscar feno e bebeu água sozinho.',
        avaliacao: 'Trânsito intestinal retomado.',
        plano: 'Suspender o fluido subcutâneo. Reduzir a papinha conforme aceitar o feno.',
      },
      '0-MANHA': {
        em: em(0, '09:10'),
        por: BRUNO,
        vitais: [39.1, 206, 44],
        observado:
          'Noite com fezes abundantes e de formato normal. Comeu feno e verduras sozinho, ativo no cercado.',
        avaliacao: 'Estase resolvida.',
        plano: 'Alta hoje às 17h; manter meloxicam por mais 2 dias em casa e dieta rica em feno.',
      },
    },
    rotina: {
      ATENCAO: [
        {
          observado:
            'Aceitou a papinha na seringa, 12 mL. Ainda sem fezes. Ranger de dentes discreto.',
          avaliacao: 'Sem piora; dor controlada.',
          plano: 'Manter e estimular movimento no cercado.',
        },
      ],
      ESTAVEL: [
        {
          observado: 'Cíbalas de tamanho normal, comeu feno à vontade e bebeu água sozinho.',
          avaliacao: 'Trânsito intestinal normalizado.',
          plano: 'Reduzir a papinha conforme aceitar o feno.',
        },
        {
          observado: 'Noite ativa, mastigando feno. Muitas cíbalas no tapete.',
          avaliacao: 'Estável.',
          plano: 'Manter.',
        },
      ],
    },
    vitais: { ATENCAO: [37.8, 38.6, 200, 260, 50, 70], ESTAVEL: [38.6, 39.6, 180, 240, 40, 60] },
    boletins: [
      {
        em: em(2, '11:40'),
        por: BRUNO,
        status: 'ENVIADO',
        texto:
          'Olá, Sílvia! O Floquinho ficou internado porque o intestino dele parou de funcionar direito (estase), algo comum em coelhos. A radiografia não mostrou nada entupindo. Ele está recebendo remédio para o intestino voltar a trabalhar, analgésico e comidinha na seringa.',
      },
      {
        em: em(1, '15:30'),
        por: BRUNO,
        status: 'ENVIADO',
        texto:
          'O Floquinho fez cocô hoje de manhã e começou a mordiscar feno sozinho, exatamente o que esperávamos! Ele segue com a medicação e a papinha.',
      },
      {
        em: em(0, '09:40'),
        por: BRUNO,
        status: 'ENVIADO',
        texto:
          'Bom dia, Sílvia! O Floquinho passou a noite comendo feno e com o intestino funcionando normalmente. A alta está prevista para hoje às 17h. Na saída explicamos a medicação de casa e a alimentação.',
      },
    ],
    ligacoes: [],
  },

  /* ------------------------------------------------------------------------- Chico */
  {
    id: 'demo-int-0009',
    pacienteId: 'demo-pac-008',
    leitos: [{ leitoId: 'demo-leito-uti1', desde: em(1, '19:20') }],
    responsavel: RAFAEL,
    internadoPor: RAFAEL,
    motivo: 'Dificuldade para respirar e temperatura alta depois de passeio no calor',
    diagnostico:
      'Síndrome obstrutiva das vias aéreas dos braquicefálicos, com edema de laringe; hipertermia na chegada (40,6 °C)',
    observacao:
      'Braquicefálico: sedação só com o veterinário ao lado e material de intubação pronto. O tutor quer saber antes de qualquer cirurgia.',
    entradaEm: em(1, '19:20'),
    pesoKg: 9.2,
    gravidades: [
      { em: em(1, '19:20'), gravidade: 'ATENCAO' },
      { em: em(0, '09:48'), gravidade: 'CRITICO' },
    ],
    altaPrevistaEm: null,
    preferencia: PREFERENCIA_PADRAO,
    receita: [
      {
        chave: 'flu',
        kind: 'FLUIDO',
        descricao: 'NaCl 0,9%, 20 mL/h em bomba de infusão',
        frequenciaHoras: 1,
        primeiro: em(1, '20:00'),
        por: RAFAEL,
      },
      {
        chave: 'dex',
        kind: 'MEDICAMENTO',
        remedio: 'dexametasona',
        via: 'INTRAVENOSA',
        mgPorKg: 0.1,
        frequenciaHoras: 24,
        primeiro: em(1, '20:00'),
        por: RAFAEL,
      },
      {
        chave: 'but',
        kind: 'MEDICAMENTO',
        remedio: 'butorfanol',
        via: 'INTRAVENOSA',
        mgPorKg: 0.2,
        frequenciaHoras: 6,
        primeiro: em(1, '23:00'),
        por: RAFAEL,
        observacao: 'Sedação leve; observar a respiração por 15 minutos depois',
      },
      {
        chave: 'ome',
        kind: 'MEDICAMENTO',
        remedio: 'omeprazol',
        via: 'INTRAVENOSA',
        mgPorKg: 1,
        frequenciaHoras: 24,
        primeiro: em(1, '20:00'),
        por: RAFAEL,
      },
      {
        chave: 'mon',
        kind: 'MONITORAMENTO',
        descricao: 'Temperatura retal, frequência respiratória e saturação (SpO2)',
        frequenciaHoras: 2,
        primeiro: em(1, '20:00'),
        por: RAFAEL,
      },
      {
        chave: 'oxi',
        kind: 'PROCEDIMENTO',
        descricao: OXIGENIO,
        frequenciaHoras: 2,
        primeiro: em(1, '21:00'),
        por: RAFAEL,
      },
    ],
    ajustes: [
      { chave: 'mon', em: em(0, '10:00'), status: 'PENDENTE' },
      { chave: 'flu', em: em(0, '10:00'), status: 'FEITA', por: MARINA, aos: 2 },
    ],
    evolucoes: {
      '1-NOITE': {
        em: em(0, '03:20'),
        por: LUCAS,
        vitais: [39.4, 148, 54],
        observado:
          'Respiração ruidosa, com estridor que piora quando se agita. No oxigênio desde as 21h. Não aceitou água. Urinou uma vez no tapete.',
        avaliacao:
          'Desconforto respiratório moderado; temperatura caindo com as compressas (40,6 → 39,4 °C).',
        plano:
          'Manter oxigênio e ambiente fresco, mínimo de manipulação. Chamar o veterinário se a mucosa arroxear ou a frequência passar de 60.',
      },
      '0-MANHA': {
        em: em(0, '09:48'),
        por: MARINA,
        vitais: [39.8, 168, 66],
        observado:
          'Às 09h30 teve crise de cianose ao sair do oxigênio para a troca do tapete. Estridor alto, esforço inspiratório com os cotovelos abertos. Voltou ao oxigênio e recebeu sedação leve.',
        avaliacao:
          'Edema de laringe piorando apesar do corticoide. Risco de obstrução total das vias aéreas.',
        plano:
          'Oxigênio contínuo; temperatura e saturação a cada 2 horas. Material de intubação e traqueostomia ao lado do leito. Avaliar cirurgia das vias aéreas quando estabilizar; conversar com o tutor.',
      },
    },
    rotina: {
      ATENCAO: [
        {
          observado: 'Estridor leve em repouso. Aceitou água em pequena quantidade.',
          avaliacao: 'Respiração mais confortável no oxigênio.',
          plano: 'Manter.',
        },
      ],
      CRITICO: [
        {
          observado: 'Esforço respiratório importante mesmo no oxigênio.',
          avaliacao: 'Crítico.',
          plano: 'Manter monitoração contínua.',
        },
      ],
    },
    vitais: { ATENCAO: [38.9, 39.6, 130, 160, 40, 58], CRITICO: [39.5, 40.2, 150, 180, 60, 80] },
    boletins: [
      {
        em: em(1, '20:40'),
        por: RAFAEL,
        status: 'ENVIADO',
        texto:
          'Paulo, o Chico chegou com bastante dificuldade para respirar por causa do calor, algo que acontece com cães de focinho curto. Ele está no oxigênio, com compressas frias e remédio para desinchar a garganta. A temperatura já está baixando. Vamos acompanhar a noite toda e mandamos notícias cedo.',
      },
      {
        em: em(0, '09:30'),
        por: MARINA,
        status: 'CANCELADO',
        cancelado: { em: em(0, '09:48'), motivo: 'SUPERADO' },
        texto:
          'Bom dia, Paulo! O Chico passou a noite no oxigênio e a temperatura normalizou. Ele ainda faz barulho para respirar, mas está mais calmo.',
      },
      {
        em: em(0, '09:48'),
        por: null,
        status: 'RETIDO',
        retencao: 'PIORA',
        texto: RETIDO_DO_SISTEMA('Chico'),
      },
    ],
    ligacoes: [],
  },
]

/** A nota da passagem da noite para a manhã de hoje (a que o plantão atual recebeu). */
export const NOTA_DA_ULTIMA_PASSAGEM =
  'Noite agitada na UTI. Chico com estridor a noite toda, no oxigênio desde as 21h; temperatura 39,4 °C às 03h, compressas mantidas. Toddy vomitou às 23h e à 00h40: Dra. Marina avisada, jejum mantido e pouca urina, pesar o tapete a cada 4 h. Bento vomitou de madrugada e recusou a ração das 06h. Duna sem tosse. Floquinho fez muitas fezes e comeu feno.'

/** A nota de rotina das passagens antigas. */
export const NOTAS_DE_ROTINA = [
  'Plantão sem intercorrências. Medicações e conferências em dia.',
  'Tudo em dia. Atenção à alimentação assistida nos próximos horários.',
  'Sem novidades. Tapetes trocados e leitos limpos.',
]
