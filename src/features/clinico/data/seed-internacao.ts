/**
 * Dataset da internação: leitos ocupados, prescrição aprazada, plantões e boletins.
 *
 * Mora fora de `seed.ts` porque o eixo de tempo é outro. A agenda gira em torno de um **dia**
 * âncora; a internação gira em torno do **plantão corrente**, que depende da hora em que a
 * demonstração acontece. Uma internação plantada para "14h do dia âncora" mostraria um plantão
 * da tarde já encerrado para quem abre a tela às 9h — e o requisito pede que um plantão inteiro
 * possa ser encenado, a qualquer hora.
 *
 * Por isso tudo aqui é ancorado em `agora`: o plantão atual está aberto, os dois anteriores
 * estão entregues, o que já passou está executado e o que vem está previsto. Abra às 3 da manhã
 * e você cai no plantão da noite, com a mesma história contada.
 */

import {
  administracoesDoPlantao,
  exigeLigacaoAntes,
  horariosDaPrescricao,
  HORIZONTE_DE_APRAZAMENTO_HORAS,
  idDoPlantao,
  limitesDoPlantao,
  plantaoAnterior,
  plantaoDe,
  plantaoSeguinte,
  proximoBoletimEm,
} from '../domain/internacao'
import { createClinicClock } from '../domain/clinic-time'

import { montarTextoDoBoletim } from './boletim-texto'
import { CLINIC_UTC_OFFSET, petsFixture } from './fixtures'
import { leitosFixture } from './fixtures/internacao'
import { createPrng } from './mock-runtime'
import type {
  AdministracaoAgendada,
  BoletimAoTutor,
  EvolucaoDeInternacao,
  GravidadeClinica,
  Internacao,
  ISODate,
  ISODateTime,
  Leito,
  Measurement,
  Plantao,
  PlantaoKind,
  PreferenciaDeBoletim,
  PrescricaoDeInternacao,
  VitalKey,
} from './types'

const clock = createClinicClock(CLINIC_UTC_OFFSET)

export type DatasetDeInternacao = {
  leitos: Leito[]
  internacoes: Internacao[]
  prescricoes: PrescricaoDeInternacao[]
  administracoes: AdministracaoAgendada[]
  plantoes: Plantao[]
  evolucoes: EvolucaoDeInternacao[]
  boletins: BoletimAoTutor[]
  preferencias: PreferenciaDeBoletim[]
  /** O plantão aberto agora — o painel e o teste entram por aqui. */
  plantaoAtualId: string
}

function medicao(valor: number | null, naoAferido = false): Measurement {
  return { valor, naoAferido }
}

function vitaisVazios(): Record<VitalKey, Measurement> {
  return {
    peso: medicao(null),
    temperatura: medicao(null),
    frequenciaCardiaca: medicao(null),
    frequenciaRespiratoria: medicao(null),
    tempoPreenchimentoCapilar: medicao(null),
    escoreCorporal: medicao(null),
    pressaoSistolica: medicao(null),
  }
}

/** Desloca um instante em horas, sempre pela parede da clínica. */
function maisHoras(iso: ISODateTime, horas: number): ISODateTime {
  const data = clock.dateOf(iso)

  return clock.toIso(data, clock.minutesFrom(iso, data) + Math.round(horas * 60))
}

function maisMinutos(iso: ISODateTime, minutos: number): ISODateTime {
  const data = clock.dateOf(iso)

  return clock.toIso(data, clock.minutesFrom(iso, data) + minutos)
}

/**
 * Quem cobre cada turno.
 *
 * Fixo por turno, e não sorteado, porque a passagem de plantão só faz sentido se o nome que sai
 * e o nome que entra forem sempre os mesmos na demonstração — "a Helena passou para o Caio" é
 * uma frase que a plateia acompanha; um sorteio diferente a cada recarga, não.
 */
const RESPONSAVEL_DO_TURNO: Record<PlantaoKind, string> = {
  manha: 'prof-ana',
  tarde: 'prof-helena',
  noite: 'prof-caio',
}

// ---------------------------------------------------------------------------
// Os pacientes internados
// ---------------------------------------------------------------------------

type ItemPlantado = {
  sufixo: string
  kind: PrescricaoDeInternacao['kind']
  medicamentoId: string | null
  descricao: string
  via: PrescricaoDeInternacao['via']
  doseTexto: string
  frequenciaHoras: number
  continuo?: boolean
  /** Deslocamento em horas a partir da entrada para o primeiro horário. */
  primeiroApos: number
  observacao?: string
}

type InternacaoPlantada = {
  id: string
  petId: string
  tutorId: string
  leitoId: string
  responsavelId: string
  motivo: string
  diagnostico: string
  /** Horas desde agora, negativas: há quanto tempo o animal está internado. */
  entradaHaHoras: number
  altaPrevistaEmHoras: number | null
  gravidade: GravidadeClinica
  pesoEntradaKg: number
  observacao: string
  frequenciaBoletim: PreferenciaDeBoletim['frequenciaHoras']
  silencioNoturno: boolean
  fotoSempre: boolean
  itens: ItemPlantado[]
}

/**
 * Cinco internados em oito leitos.
 *
 * A ocupação é apertada de propósito — sobra um leito geral, um felino e a UTI está tomada. É a
 * configuração em que a próxima pergunta do dia ("chegou um crítico, onde ponho?") já tem uma
 * resposta difícil na tela, sem que ninguém precise mexer no dataset para provocá-la.
 */
const INTERNADOS: InternacaoPlantada[] = [
  {
    id: 'int-bento',
    petId: 'pet-bento',
    tutorId: 'tutor-joao',
    leitoId: 'leito-r1',
    responsavelId: 'prof-ana',
    motivo: 'Pós-operatório de osteossíntese de fêmur',
    diagnostico: 'Fratura diafisária de fêmur direito, corrigida',
    entradaHaHoras: -30,
    altaPrevistaEmHoras: 18,
    gravidade: 'estavel',
    pesoEntradaKg: 32.4,
    observacao: 'Deambula com apoio. Curativo limpo.',
    frequenciaBoletim: 6,
    silencioNoturno: true,
    fotoSempre: true,
    itens: [
      {
        sufixo: 'dipirona',
        kind: 'medicamento',
        medicamentoId: 'med-dipirona',
        descricao: 'Dipirona sódica',
        via: 'intravenosa',
        doseTexto: '25 mg/kg, 1,6 mL',
        frequenciaHoras: 8,
        primeiroApos: 1,
      },
      {
        sufixo: 'cefalexina',
        kind: 'medicamento',
        medicamentoId: 'med-cefalexina',
        descricao: 'Cefalexina',
        via: 'oral',
        doseTexto: '22 mg/kg, 2 comprimidos',
        frequenciaHoras: 12,
        primeiroApos: 2,
      },
      {
        sufixo: 'fluido',
        kind: 'fluido',
        medicamentoId: null,
        descricao: 'Ringer lactato em bomba',
        via: 'intravenosa',
        doseTexto: '65 mL/h',
        frequenciaHoras: 4,
        continuo: true,
        primeiroApos: 1,
        observacao: 'Conferir gotejamento e acesso a cada passagem.',
      },
      {
        sufixo: 'vitais',
        kind: 'monitoramento',
        medicamentoId: null,
        descricao: 'Aferir temperatura, FC e FR',
        via: null,
        doseTexto: '',
        frequenciaHoras: 6,
        primeiroApos: 2,
      },
    ],
  },
  {
    /**
     * O caso do boletim de hora em hora.
     *
     * Ana Lu perdeu uma cadela em internação há dois anos e não desgruda do telefone. É o
     * responsável que o requisito descreve — e a resposta do produto não é dizer não, é dar a
     * ele um botão que custa menos que quatro ligações para a recepção.
     */
    id: 'int-cacau',
    petId: 'pet-cacau',
    tutorId: 'tutor-ana-lu',
    leitoId: 'leito-r2',
    responsavelId: 'prof-caio',
    motivo: 'Crise de discopatia com dor intensa',
    diagnostico: 'Doença do disco intervertebral, grau II',
    entradaHaHoras: -16,
    altaPrevistaEmHoras: null,
    gravidade: 'atencao',
    pesoEntradaKg: 9,
    observacao: 'Propriocepção preservada nos quatro membros. Repouso absoluto em gaiola.',
    frequenciaBoletim: 1,
    silencioNoturno: true,
    fotoSempre: true,
    itens: [
      {
        sufixo: 'tramadol',
        kind: 'medicamento',
        medicamentoId: 'med-tramadol',
        descricao: 'Tramadol',
        via: 'subcutanea',
        doseTexto: '3 mg/kg, 0,54 mL',
        frequenciaHoras: 6,
        primeiroApos: 1,
      },
      {
        sufixo: 'omeprazol',
        kind: 'medicamento',
        medicamentoId: 'med-omeprazol',
        descricao: 'Omeprazol',
        via: 'oral',
        doseTexto: '1 mg/kg, 1 comprimido',
        frequenciaHoras: 24,
        primeiroApos: 3,
      },
      {
        sufixo: 'neuro',
        kind: 'monitoramento',
        medicamentoId: null,
        descricao: 'Avaliar propriocepção e dor à palpação',
        via: null,
        doseTexto: '',
        frequenciaHoras: 8,
        primeiroApos: 2,
      },
    ],
  },
  {
    /**
     * O caso da piora.
     *
     * Tofu entra em atenção e piora dentro do plantão corrente. É a internação que segura o
     * boletim e obriga alguém a ligar — o caso difícil que dá sentido a todo o resto.
     */
    id: 'int-tofu',
    petId: 'pet-tofu',
    tutorId: 'tutor-rita',
    leitoId: 'leito-uti',
    responsavelId: 'prof-helena',
    motivo: 'Obstrução uretral com azotemia',
    diagnostico: 'Doença do trato urinário inferior dos felinos, obstrutiva',
    entradaHaHoras: -21,
    altaPrevistaEmHoras: null,
    gravidade: 'atencao',
    pesoEntradaKg: 5.1,
    observacao: 'Sonda uretral fixada. Diurese medida a cada 4 h.',
    frequenciaBoletim: 4,
    silencioNoturno: false,
    fotoSempre: false,
    itens: [
      {
        sufixo: 'fluido',
        kind: 'fluido',
        medicamentoId: null,
        descricao: 'NaCl 0,9% em bomba',
        via: 'intravenosa',
        doseTexto: '20 mL/h',
        frequenciaHoras: 2,
        continuo: true,
        primeiroApos: 1,
        observacao: 'Ajustar conforme diurese da hora anterior.',
      },
      {
        sufixo: 'diurese',
        kind: 'monitoramento',
        medicamentoId: null,
        descricao: 'Medir diurese e anotar volume',
        via: null,
        doseTexto: '',
        frequenciaHoras: 4,
        primeiroApos: 1,
      },
      {
        sufixo: 'maropitant',
        kind: 'medicamento',
        medicamentoId: 'med-maropitant',
        descricao: 'Maropitant',
        via: 'subcutanea',
        doseTexto: '1 mg/kg, 0,51 mL',
        frequenciaHoras: 24,
        primeiroApos: 2,
      },
      {
        sufixo: 'potassio',
        kind: 'monitoramento',
        medicamentoId: null,
        descricao: 'Coletar sangue para potássio e creatinina',
        via: null,
        doseTexto: '',
        frequenciaHoras: 12,
        primeiroApos: 3,
      },
    ],
  },
  {
    id: 'int-sushi',
    petId: 'pet-sushi',
    tutorId: 'tutor-daniel',
    leitoId: 'leito-f1',
    responsavelId: 'prof-ana',
    motivo: 'Anorexia e vômito há três dias',
    diagnostico: 'Gastrite aguda, etiologia em investigação',
    entradaHaHoras: -9,
    altaPrevistaEmHoras: 26,
    gravidade: 'estavel',
    pesoEntradaKg: 4,
    observacao: 'Aceitou pouca ração pastosa às 6h. Sem vômito desde a entrada.',
    frequenciaBoletim: 8,
    silencioNoturno: true,
    fotoSempre: true,
    itens: [
      {
        sufixo: 'ondansetrona',
        kind: 'medicamento',
        medicamentoId: 'med-ondansetrona',
        descricao: 'Ondansetrona',
        via: 'intravenosa',
        doseTexto: '0,5 mg/kg, 1 mL',
        frequenciaHoras: 12,
        primeiroApos: 1,
      },
      {
        sufixo: 'alimentacao',
        kind: 'alimentacao',
        medicamentoId: null,
        descricao: 'Oferecer ração pastosa morna e anotar aceitação',
        via: null,
        doseTexto: '30 g',
        frequenciaHoras: 6,
        primeiroApos: 2,
      },
    ],
  },
  {
    id: 'int-pipoca',
    petId: 'pet-pipoca',
    tutorId: 'tutor-fatima',
    leitoId: 'leito-i1',
    responsavelId: 'prof-tiago',
    motivo: 'Diarreia com sangue e prostração',
    diagnostico: 'Enterite infecciosa, isolamento até resultado',
    entradaHaHoras: -40,
    altaPrevistaEmHoras: 8,
    gravidade: 'estavel',
    pesoEntradaKg: 0.9,
    observacao: 'Fezes já pastosas. Ganhou 20 g desde a entrada.',
    frequenciaBoletim: 12,
    silencioNoturno: true,
    /* A Pipoca é a internação da demonstração do app: a conversa precisa ter foto. */
    fotoSempre: true,
    itens: [
      {
        sufixo: 'metronidazol',
        kind: 'medicamento',
        medicamentoId: 'med-metronidazol',
        descricao: 'Metronidazol',
        via: 'oral',
        doseTexto: '15 mg/kg, 0,05 comprimido',
        frequenciaHoras: 12,
        primeiroApos: 2,
        observacao: 'Manipulado em suspensão pela farmácia.',
      },
      {
        sufixo: 'peso',
        kind: 'monitoramento',
        medicamentoId: null,
        descricao: 'Pesar em balança de precisão',
        via: null,
        doseTexto: '',
        frequenciaHoras: 12,
        primeiroApos: 4,
      },
    ],
  },
]

// ---------------------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------------------

/**
 * Marca o que já passou como executado.
 *
 * Executa com um atraso de 2 a 14 minutos sobre o previsto, sempre — plantão que cumpre o
 * horário no minuto exato, dose após dose, é a assinatura de um dado inventado, e a plateia
 * percebe antes de saber por quê.
 */
function executarPassado(
  administracao: AdministracaoAgendada,
  agora: ISODateTime,
  rng: () => number,
): AdministracaoAgendada {
  const atrasoMin = 2 + Math.floor(rng() * 13)
  const executadaEm = maisMinutos(administracao.previstaPara, atrasoMin)

  if (Date.parse(executadaEm) > Date.parse(agora)) {
    return administracao
  }

  const turno = plantaoDe(executadaEm, clock)

  return {
    ...administracao,
    status: 'feita',
    executadaEm,
    executadaPor: RESPONSAVEL_DO_TURNO[turno.kind],
    plantaoId: idDoPlantao(turno.kind, turno.data),
  }
}

function montarPrescricoes(
  internacao: Internacao,
  plantada: InternacaoPlantada,
): PrescricaoDeInternacao[] {
  return plantada.itens.map((item) => ({
    id: `presc-${plantada.id}-${item.sufixo}`,
    internacaoId: internacao.id,
    kind: item.kind,
    medicamentoId: item.medicamentoId,
    descricao: item.descricao,
    via: item.via,
    doseTexto: item.doseTexto,
    frequenciaHoras: item.frequenciaHoras,
    continuo: item.continuo ?? false,
    primeiroHorario: maisHoras(internacao.entradaEm, item.primeiroApos),
    encerraEm: null,
    prescritoPor: plantada.responsavelId,
    prescritoEm: internacao.entradaEm,
    suspensaEm: null,
    motivoSuspensao: '',
    observacao: item.observacao ?? '',
  }))
}

/**
 * Evolução de um turno já encerrado.
 *
 * Os vitais variam pouco e de forma coerente com a gravidade: paciente estável não tem
 * temperatura oscilando um grau entre turnos, e um dataset que faz isso ensina a desconfiar do
 * realce de valor fora da faixa.
 */
function montarEvolucao(input: {
  internacao: Internacao
  plantada: InternacaoPlantada
  kind: PlantaoKind
  data: ISODate
  registradoEm: ISODateTime
  gravidade: GravidadeClinica
  rng: () => number
}): EvolucaoDeInternacao {
  const { internacao, plantada, rng } = input
  const desvio = (rng() - 0.5) * 0.6
  const febril = input.gravidade === 'critico'

  const vitais = vitaisVazios()

  vitais.peso = medicao(Number((plantada.pesoEntradaKg + desvio * 0.2).toFixed(2)))
  vitais.temperatura = medicao(Number(((febril ? 39.4 : 38.5) + desvio).toFixed(1)))
  vitais.frequenciaCardiaca = medicao(
    Math.round((plantada.pesoEntradaKg > 20 ? 96 : 148) + desvio * 18 + (febril ? 26 : 0)),
  )
  vitais.frequenciaRespiratoria = medicao(Math.round(26 + desvio * 8 + (febril ? 12 : 0)))
  vitais.tempoPreenchimentoCapilar = medicao(febril ? 3 : 2)
  /* Escore corporal não muda em 8 horas. Aferir todo turno seria teatro. */
  vitais.escoreCorporal = medicao(null, true)
  vitais.pressaoSistolica = medicao(null, true)

  return {
    id: `evo-${internacao.id}-${input.data}-${input.kind}`,
    internacaoId: internacao.id,
    plantaoId: idDoPlantao(input.kind, input.data),
    professionalId: RESPONSAVEL_DO_TURNO[input.kind],
    registradoEm: input.registradoEm,
    vitais,
    observado: doTurno(TEXTO_OBSERVADO, plantada.id, input.kind, 'Sem intercorrências no turno.'),
    avaliacao: doTurno(
      TEXTO_AVALIACAO,
      plantada.id,
      input.kind,
      'Mantém o quadro do turno anterior.',
    ),
    plano: doTurno(
      TEXTO_PLANO,
      plantada.id,
      input.kind,
      'Manter prescrição e reavaliar no próximo plantão.',
    ),
    gravidade: input.gravidade,
  }
}

/**
 * Texto de evolução, **por turno**.
 *
 * Duas evoluções seguidas com a mesma frase denunciam dado inventado antes de qualquer outra
 * coisa: a tela põe os dois turnos lado a lado, e a plateia lê os dois. Cada paciente tem uma
 * variante por turno, e elas contam a mesma história avançando.
 *
 * Quem fica mais de um dia passa pelo mesmo turno de novo. Para esse, o turno é uma lista — a
 * primeira noite, a segunda noite —, e a última frase vale dali em diante.
 */
type TextoPorTurno = Record<string, Partial<Record<PlantaoKind, string | string[]>>>

function doTurno(
  mapa: TextoPorTurno,
  internacaoId: string,
  kind: PlantaoKind,
  reserva: string,
  vez = 0,
): string {
  const doPaciente = mapa[internacaoId]
  const texto = doPaciente?.[kind] ?? doPaciente?.manha

  if (texto === undefined) {
    return reserva
  }

  return Array.isArray(texto) ? (texto[Math.min(vez, texto.length - 1)] ?? reserva) : texto
}

const TEXTO_OBSERVADO: TextoPorTurno = {
  'int-bento': {
    manha: 'Comeu toda a ração oferecida. Urinou duas vezes. Apoia o membro ao levantar.',
    tarde: 'Dormiu boa parte da tarde. Levantou sozinho para beber água.',
    noite: 'Noite tranquila. Trocou de posição sem ajuda e não vocalizou.',
  },
  'int-cacau': {
    manha: 'Deitada e quieta. Não vocaliza ao ser manipulada desde a última dose.',
    tarde: 'Aceitou petisco na mão. Continua sem apoiar o trem posterior.',
    noite: 'Dormiu entre as doses. Reagiu bem à palpação lombar às 2h.',
  },
  'int-tofu': {
    manha: 'Diurese abaixo do esperado no turno. Recusou o alimento oferecido.',
    tarde: 'Diurese ainda baixa. Sonda pérvia, urina concentrada.',
    noite: 'Ficou prostrado a maior parte da noite. Não aceitou alimento.',
  },
  'int-sushi': {
    manha: 'Aceitou meia porção de ração pastosa. Sem vômito.',
    tarde: 'Comeu a porção inteira e se limpou depois. Sem vômito.',
    noite: 'Dormiu a noite toda. Recusou a oferta das 3h.',
  },
  'int-pipoca': {
    manha: 'Mais ativa pela manhã. Fezes pastosas, sem sangue visível.',
    tarde: 'Explorou a caixa e comeu feno sozinha pela primeira vez. Fezes pastosas, sem sangue.',
    noite: [
      'Chegou prostrada e foi para o isolamento. Aceitou papinha na seringa. Fezes ainda líquidas, sem sangue desde a meia-noite.',
      'Dormiu no ninho a noite inteira. Uma evacuação de madrugada, pastosa e sem sangue.',
    ],
  },
}

const TEXTO_AVALIACAO: TextoPorTurno = {
  'int-bento': {
    manha: 'Pós-operatório evoluindo bem. Dor controlada com a analgesia atual.',
    tarde: 'Segue confortável. Ferida cirúrgica sem secreção nem calor.',
    noite: 'Sem sinais de dor noturna. Analgesia adequada na dose atual.',
  },
  'int-cacau': {
    manha: 'Dor bem controlada. Sem déficit proprioceptivo novo.',
    tarde: 'Quadro neurológico estável. Mantém grau II.',
    noite: 'Sem piora neurológica. Analgesia cobrindo o intervalo inteiro.',
  },
  'int-tofu': {
    manha: 'Diurese em queda e azotemia provável. Vigiar potássio de perto.',
    tarde: 'Azotemia confirmada. Risco de hipercalemia: monitorar ritmo.',
    noite: 'Sem melhora do débito urinário. Quadro exige reavaliação pela manhã.',
  },
  'int-sushi': {
    manha: 'Retomando alimentação. Sem sinais de desidratação.',
    tarde: 'Aceitação plena do alimento. Gastrite em resolução.',
    noite: 'Estável. Jejum noturno espontâneo, sem repercussão.',
  },
  'int-pipoca': {
    manha: 'Resposta boa ao tratamento. Quadro entérico em resolução.',
    tarde: 'Fezes já formadas. Ganho de peso desde a entrada.',
    noite: 'Quadro resolvido do ponto de vista clínico.',
  },
}

const TEXTO_PLANO: TextoPorTurno = {
  'int-bento': {
    manha: 'Manter analgesia. Avaliar alta amanhã se mantiver apoio do membro.',
    tarde: 'Trocar curativo pela manhã. Manter prescrição.',
    noite: 'Manter analgesia até a visita da manhã.',
  },
  'int-cacau': {
    manha: 'Manter repouso absoluto e analgesia. Reavaliar neurológico a cada 8 h.',
    tarde: 'Manter conduta. Reavaliar propriocepção às 22h.',
    noite: 'Manter repouso. Discutir corticoide com a responsável pelo caso.',
  },
  'int-tofu': {
    manha: 'Colher potássio agora. Comunicar responsável antes de qualquer conduta nova.',
    tarde: 'Repetir potássio em 4 h. Manter fluidoterapia e vigiar frequência cardíaca.',
    noite: 'Colher potássio às 6h. Avisar a responsável pelo caso ao menor sinal de piora.',
  },
  'int-sushi': {
    manha: 'Aumentar porção se aceitar. Alta provável amanhã.',
    tarde: 'Manter dieta. Avaliar alta pela manhã.',
    noite: 'Oferecer alimento ao amanhecer e preparar a alta.',
  },
  'int-pipoca': {
    manha: 'Última dose de metronidazol pela manhã e alta se as fezes se mantiverem.',
    tarde: 'Pesar antes da alta. Orientar a responsável sobre a dieta.',
    noite: 'Manter dieta branda. Alta prevista para a manhã.',
  },
}

/**
 * Boletins já enviados, um por janela de frequência que passou.
 *
 * Reconstruir o histórico em vez de plantar dois ou três avulsos é o que faz a tela do
 * responsável ter a densidade certa: quem escolheu boletim de hora em hora tem dezesseis
 * mensagens desde a entrada, e é vendo essa coluna que a clínica entende o que a preferência
 * significa.
 */
function montarBoletinsEnviados(input: {
  internacao: Internacao
  preferencia: PreferenciaDeBoletim
  agora: ISODateTime
  petNome: string
  petIniciais: string
  /**
   * O que contar, conforme o turno do período que o boletim cobre, e quantas vezes esse turno
   * já foi contado.
   *
   * É função, e não texto fixo: o boletim das 4 da manhã fala da noite, o das 10 fala da manhã.
   * Um texto só para o dia inteiro faria o responsável ler "comeu toda a ração" às 3h.
   */
  observado: (turno: PlantaoKind, vez: number) => string
  administracoes: AdministracaoAgendada[]
}): BoletimAoTutor[] {
  const boletins: BoletimAoTutor[] = []
  const doPaciente = input.administracoes.filter(
    (item) => item.internacaoId === input.internacao.id,
  )
  let desde = input.internacao.entradaEm
  /*
   * O que o plantão observou entra **uma vez por turno**, no primeiro boletim dele.
   *
   * Com o texto em todo boletim, três mensagens seguidas da madrugada saíam idênticas menos pelos
   * números — e uma coluna de mensagens repetidas é a primeira coisa que denuncia dado inventado
   * numa demonstração. Repetido é também o que o responsável para de ler.
   *
   * "Turno" é o plantão daquele dia, não o tipo: a noite de ontem e a de hoje são duas, e a de
   * hoje tem o que contar.
   */
  let turnoDoUltimo = ''
  const vezesDoTurno = new Map<PlantaoKind, number>()
  const fim = Date.parse(input.agora)

  /*
   * O horário de cada boletim é o que `proximoBoletimEm` agenda — o mesmo que a tela anuncia
   * como próximo. A madrugada em silêncio não some do histórico nem vira mensagem em branco:
   * junta num boletim só, às 7h. Pular deixava nove horas sem notícia, e a Pipoca, de doze em
   * doze horas, passava um dia e meio internada com um boletim só.
   */
  const proximo = (desdeDe: ISODateTime) =>
    proximoBoletimEm({
      frequenciaHoras: input.preferencia.frequenciaHoras,
      silencioNoturno: input.preferencia.silencioNoturno,
      desde: desdeDe,
      clock,
    })

  for (
    let em = proximo(input.internacao.entradaEm), indice = 1;
    Date.parse(em) <= fim;
    em = proximo(em), indice += 1
  ) {
    /*
     * O período do boletim é o intervalo desde o anterior — é o que dá sentido a "3 de 3
     * realizados no horário". Contar desde a entrada faria o número crescer o dia inteiro e
     * dizer cada vez menos.
     */
    const doPeriodo = doPaciente.filter(
      (item) => item.previstaPara > desde && item.previstaPara <= em,
    )
    /*
     * O turno é o do **meio do período** que o boletim cobre, não o da hora em que ele sai. O
     * boletim que junta a madrugada sai às 7h, primeiro minuto da manhã — pelo horário de saída,
     * contaria uma manhã que ainda não aconteceu; o das 19h diria "dormiu a noite inteira" com a
     * noite por começar.
     */
    const meio = maisMinutos(desde, Math.round((Date.parse(em) - Date.parse(desde)) / 120_000))
    const plantao = plantaoDe(meio, clock)
    const turnoDeste = plantao.kind
    const vez = vezesDoTurno.get(turnoDeste) ?? 0
    const contaOTurno = `${plantao.kind}|${plantao.data}` !== turnoDoUltimo

    if (contaOTurno) {
      vezesDoTurno.set(turnoDeste, vez + 1)
    }

    boletins.push({
      id: `bol-${input.internacao.id}-${indice}`,
      internacaoId: input.internacao.id,
      origem: 'automatico',
      status: 'enviado',
      gravidade: input.internacao.gravidade,
      texto: montarTextoDoBoletim({
        petNome: input.petNome,
        gravidade: input.internacao.gravidade,
        feitas: doPeriodo.filter((item) => item.status === 'feita').length,
        previstas: doPeriodo.length,
        /* A temperatura entra num boletim sim, noutro não: toda mensagem com número vira ruído. */
        temperatura: indice % 2 === 0 ? Number((38.4 + (indice % 3) * 0.2).toFixed(1)) : null,
        observado: contaOTurno ? input.observado(turnoDeste, vez) : '',
        exigeLigacao: false,
      }),
      /*
       * Foto em um boletim sim, outro não — contando os **enviados**, não os horários. Contando
       * horários, o de número par podia cair na madrugada e sumir no silêncio noturno, e a
       * internação passava o dia sem uma foto sequer, dependendo da hora em que a demonstração
       * abriu.
       */
      foto: input.preferencia.fotoSempre && boletins.length % 2 === 0 ? input.petIniciais : null,
      fotoLegenda: input.preferencia.fotoSempre && boletins.length % 2 === 0 ? FOTO_LEGENDA : '',
      geradoEm: em,
      autorId: null,
      enviadoEm: maisMinutos(em, 1),
      exigeLigacao: false,
      ligacaoEm: null,
      ligacaoPor: null,
    })

    desde = em
    turnoDoUltimo = `${plantao.kind}|${plantao.data}`
  }

  return boletins
}

export function gerarInternacoes(semente: number): DatasetDeInternacao {
  const rng = createPrng(semente ^ 0x1e_7ac0)
  const agora = clock.nowIso()

  const atual = plantaoDe(agora, clock)
  const anterior = plantaoAnterior(atual.kind, atual.data)
  const retrasado = plantaoAnterior(anterior.kind, anterior.data)

  const internacoes: Internacao[] = []
  const prescricoes: PrescricaoDeInternacao[] = []
  const administracoes: AdministracaoAgendada[] = []
  const evolucoes: EvolucaoDeInternacao[] = []
  const boletins: BoletimAoTutor[] = []
  const preferencias: PreferenciaDeBoletim[] = []

  const limiteAprazamento = maisHoras(agora, HORIZONTE_DE_APRAZAMENTO_HORAS)

  for (const plantada of INTERNADOS) {
    const internacao: Internacao = {
      id: plantada.id,
      petId: plantada.petId,
      tutorId: plantada.tutorId,
      leitoId: plantada.leitoId,
      responsavelId: plantada.responsavelId,
      encounterId: null,
      motivo: plantada.motivo,
      diagnostico: plantada.diagnostico,
      entradaEm: maisHoras(agora, plantada.entradaHaHoras),
      altaPrevistaEm:
        plantada.altaPrevistaEmHoras === null
          ? null
          : maisHoras(agora, plantada.altaPrevistaEmHoras),
      altaEm: null,
      status: 'internado',
      gravidade: plantada.gravidade,
      pesoEntradaKg: plantada.pesoEntradaKg,
      observacao: plantada.observacao,
    }

    internacoes.push(internacao)

    const preferencia: PreferenciaDeBoletim = {
      internacaoId: internacao.id,
      frequenciaHoras: plantada.frequenciaBoletim,
      fotoSempre: plantada.fotoSempre,
      silencioNoturno: plantada.silencioNoturno,
    }

    preferencias.push(preferencia)

    const doPaciente = montarPrescricoes(internacao, plantada)

    prescricoes.push(...doPaciente)

    for (const prescricao of doPaciente) {
      for (const previstaPara of horariosDaPrescricao(prescricao, limiteAprazamento, clock)) {
        const base: AdministracaoAgendada = {
          id: `adm-${prescricao.id}-${previstaPara.slice(0, 16).replace(/[-:T]/g, '')}`,
          internacaoId: internacao.id,
          prescricaoId: prescricao.id,
          previstaPara,
          status: 'pendente',
          executadaEm: null,
          executadaPor: null,
          plantaoId: null,
          observacao: '',
        }

        administracoes.push(
          Date.parse(previstaPara) < Date.parse(agora) ? executarPassado(base, agora, rng) : base,
        )
      }
    }

    const pet = petsFixture.find((item) => item.id === plantada.petId)

    boletins.push(
      ...montarBoletinsEnviados({
        internacao,
        preferencia,
        agora,
        petNome: pet?.nome ?? '',
        petIniciais: pet?.iniciais ?? '',
        observado: (turno, vez) => doTurno(TEXTO_OBSERVADO, plantada.id, turno, '', vez),
        administracoes,
      }),
    )

    /* Evolução dos dois turnos fechados. O turno corrente é o que o plantão vai escrever. */
    for (const turno of [retrasado, anterior]) {
      const { fim } = limitesDoPlantao(turno.kind, turno.data, clock)

      /* Turno que terminou antes de o animal chegar não tem o que evoluir. */
      if (Date.parse(fim) <= Date.parse(internacao.entradaEm)) {
        continue
      }

      evolucoes.push(
        montarEvolucao({
          internacao,
          plantada,
          kind: turno.kind,
          data: turno.data,
          registradoEm: maisMinutos(fim, -35),
          gravidade: plantada.gravidade,
          rng,
        }),
      )
    }
  }

  const plantoes = montarPlantoes({ atual, anterior, retrasado, administracoes })

  aplicarCasosDificeis({ agora, atual, administracoes, internacoes, boletins })

  return {
    /*
     * O leito parado ganha a data em que parou — só o seed conhece o relógio do dataset.
     * Sem ela, "em manutenção" não diria se é de hoje de manhã ou de três semanas atrás, que é a
     * diferença entre uma manutenção e uma vaga esquecida.
     */
    leitos: leitosFixture.map((leito) => ({
      ...leito,
      inativoDesde: leito.ativo ? null : maisHoras(agora, -20),
    })),
    internacoes,
    prescricoes,
    administracoes: administracoes.sort((a, b) => a.previstaPara.localeCompare(b.previstaPara)),
    plantoes,
    evolucoes,
    boletins: boletins.sort((a, b) => a.geradoEm.localeCompare(b.geradoEm)),
    preferencias,
    plantaoAtualId: idDoPlantao(atual.kind, atual.data),
  }
}

function montarPlantoes(input: {
  atual: { kind: PlantaoKind; data: ISODate }
  anterior: { kind: PlantaoKind; data: ISODate }
  retrasado: { kind: PlantaoKind; data: ISODate }
  administracoes: AdministracaoAgendada[]
}): Plantao[] {
  const fechados = [input.retrasado, input.anterior].map((turno) => {
    const { inicio, fim } = limitesDoPlantao(turno.kind, turno.data, clock)
    const seguinte = plantaoSeguinte(turno.kind, turno.data)
    const pendentes = administracoesDoPlantao(
      input.administracoes,
      turno.kind,
      turno.data,
      clock,
    ).filter((item) => item.status === 'pendente')

    return {
      id: idDoPlantao(turno.kind, turno.data),
      kind: turno.kind,
      inicio,
      fim,
      responsavelId: RESPONSAVEL_DO_TURNO[turno.kind],
      entregueEm: fim,
      recebidoPor: RESPONSAVEL_DO_TURNO[seguinte.kind],
      notaDePassagem: NOTA_DE_PASSAGEM[turno.kind],
      pendenciasEntregues: pendentes.map((item) => item.id),
    } satisfies Plantao
  })

  const { inicio, fim } = limitesDoPlantao(input.atual.kind, input.atual.data, clock)

  return [
    ...fechados,
    {
      id: idDoPlantao(input.atual.kind, input.atual.data),
      kind: input.atual.kind,
      inicio,
      fim,
      responsavelId: RESPONSAVEL_DO_TURNO[input.atual.kind],
      /* Aberto: é o plantão que a demonstração vai encenar e entregar. */
      entregueEm: null,
      recebidoPor: null,
      notaDePassagem: '',
      pendenciasEntregues: [],
    },
  ]
}

/** Legenda da foto. Curta: quem manda foto de internado não escreve legenda longa. */
const FOTO_LEGENDA = 'Foto de agora há pouco.'

const NOTA_DE_PASSAGEM: Record<PlantaoKind, string> = {
  manha:
    'Cinco internados. Bento comeu e apoiou o membro. Tofu com diurese abaixo do esperado. Cobrar o potássio.',
  tarde:
    'Cacau confortável desde a dose das 14h. Sushi aceitou meia porção. Tofu pediu atenção redobrada.',
  noite:
    'Noite tranquila em quatro leitos. Tofu acordou duas vezes e voltou a se acomodar. Pipoca sem fezes com sangue.',
}

// ---------------------------------------------------------------------------
// Casos difíceis
// ---------------------------------------------------------------------------

/**
 * Os três casos que o requisito nomeia, plantados sobre o dataset já montado.
 *
 * Escritos por último, e por cima, de propósito: assim eles são **exceções visíveis** ao dataset
 * regular em vez de regras espalhadas pela geração — e quem for conferir se o caso ainda existe
 * lê uma função só.
 */
function aplicarCasosDificeis(input: {
  agora: ISODateTime
  atual: { kind: PlantaoKind; data: ISODate }
  administracoes: AdministracaoAgendada[]
  internacoes: Internacao[]
  boletins: BoletimAoTutor[]
}) {
  const { agora, administracoes, internacoes, boletins } = input
  const { fim: fimDoPlantao } = limitesDoPlantao(input.atual.kind, input.atual.data, clock)

  /*
   * Caso 1 — a dose em cima da troca de plantão.
   *
   * Empurra a próxima administração pendente do Bento para o minuto exato da passagem. Não é
   * ilustração: é o horário em que quem sai acha que quem entra vai dar, e vice-versa.
   */
  const candidataDaTroca = administracoes.find(
    (item) =>
      item.prescricaoId === 'presc-int-bento-dipirona' &&
      item.status === 'pendente' &&
      Date.parse(item.previstaPara) > Date.parse(agora),
  )

  if (candidataDaTroca) {
    candidataDaTroca.previstaPara = fimDoPlantao
    candidataDaTroca.id = 'adm-troca-de-plantao'
  }

  /*
   * Caso 2 — a dose atrasada que o plantão corrente ainda não fechou.
   *
   * Sem ela o checklist abre inteiro verde e o estado de atraso, que é metade do valor da tela,
   * nunca aparece na demonstração.
   */
  const atrasada = administracoes.find(
    (item) =>
      item.prescricaoId === 'presc-int-cacau-tramadol' &&
      item.status === 'feita' &&
      Date.parse(item.previstaPara) > Date.parse(agora) - 5 * 3_600_000,
  )

  if (atrasada) {
    atrasada.status = 'pendente'
    atrasada.executadaEm = null
    atrasada.executadaPor = null
    atrasada.plantaoId = null
    atrasada.id = 'adm-atrasada'
  }

  /*
   * Caso 3 — a recusa.
   *
   * Gato que cospe o comprimido não é falha da enfermagem, e registrar como "pulada" apagaria a
   * informação clínica. Recusada é um desfecho próprio, e é o que o vet precisa ler para trocar
   * a via.
   */
  const recusada = administracoes.find(
    (item) => item.prescricaoId === 'presc-int-sushi-alimentacao' && item.status === 'feita',
  )

  if (recusada) {
    recusada.status = 'recusada'
    recusada.observacao = 'Cheirou e virou o rosto. Não aceitou nem na seringa.'
  }

  /*
   * Caso 4 — a piora, e o boletim que ela segura.
   *
   * Tofu passa de atenção a crítico dentro do plantão corrente. O boletim automático da piora
   * nasce **retido**: existe, está escrito, e não sai do lugar até alguém ligar para a Rita.
   * É o caso que o requisito descreve com todas as letras, e o que a demonstração precisa poder
   * encenar de ponta a ponta.
   */
  const tofu = internacoes.find((item) => item.id === 'int-tofu')

  if (tofu) {
    const anteriores = boletins.filter((item) => item.internacaoId === tofu.id)
    const ultimo = anteriores[anteriores.length - 1] ?? null
    const gravidadeAnterior = ultimo?.gravidade ?? null

    tofu.gravidade = 'critico'
    tofu.observacao =
      'Potássio de 7,4 mEq/L na última coleta. Bradicardia. Gluconato de cálcio em curso.'

    const exigeLigacao = exigeLigacaoAntes(gravidadeAnterior, 'critico')

    boletins.push({
      id: 'bol-piora-tofu',
      internacaoId: tofu.id,
      origem: 'automatico',
      status: 'retido',
      gravidade: 'critico',
      texto: montarTextoDoBoletim({
        petNome: petsFixture.find((item) => item.id === tofu.petId)?.nome ?? '',
        gravidade: 'critico',
        /*
         * O boletim da piora não conta medicação.
         *
         * "0 de 2 realizados no horário" numa mensagem sobre agravamento lê como negligência,
         * quando as duas doses são justamente as que estão sendo dadas agora. O que explica o
         * quadro é a ligação, e é dela que a mensagem fala.
         */
        feitas: 0,
        previstas: 0,
        temperatura: 37.4,
        observado:
          'O potássio subiu e o coração está batendo mais devagar do que deveria. A medicação para corrigir já está em curso.',
        exigeLigacao,
      }),
      foto: null,
      fotoLegenda: '',
      geradoEm: maisMinutos(agora, -35),
      autorId: null,
      enviadoEm: null,
      exigeLigacao,
      ligacaoEm: null,
      ligacaoPor: null,
    })
  }
}
