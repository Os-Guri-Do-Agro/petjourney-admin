/**
 * "Este pet em 30 segundos": o que o vet lê antes de entrar na sala.
 *
 * Junta três fontes que nunca se encontravam na mesma tela — o prontuário da clínica, o Diário
 * Pet do responsável e o cadastro — e responde a uma pergunta só: **o que mudou desde a última
 * vez?** O prontuário sozinho não sabe; o diário sozinho não tem contexto clínico.
 *
 * Três regras decidem o que sobe para o topo, e cada uma existe por um caso difícil:
 *
 * - **Tendência vale mais que registro.** Perda de peso contínua não aparece em pesagem nenhuma
 *   isolada — 4,5 kg na consulta, 4,4 kg em casa, nada assusta. A sequência é o achado, então o
 *   cálculo é sobre a série inteira, clínica e casa juntas.
 * - **Raro sobe porque é raro.** O responsável que registra três vezes por dia produz noventa
 *   linhas de "tudo certo"; um desmaio no meio delas não pode perder para a média. Sintoma de
 *   alarme vira sinal com **um** registro.
 * - **Resumir é contar, não cortar.** Os registros sem nada viram um número ("84 sem
 *   alteração"), e continuam a um clique. Esconder dado do vet não é resumir.
 *
 * Função pura: recebe o que o repositório juntou e o instante de referência, devolve o resumo.
 */

import type {
  AlertSeverity,
  ApetiteNoDiario,
  ComportamentoNoDiario,
  Diagnosis,
  EntradaDoDiario,
  ISODateTime,
  Pet,
  PetAlert,
  SintomaNoDiario,
} from '../data/types'

const DIA_MS = 24 * 60 * 60 * 1000

/** Janela da tendência de peso. Mais longa que isso, a perda vira envelhecimento. */
export const JANELA_DO_PESO_DIAS = 180

/** Abaixo disso, a variação é ruído de balança — ainda mais de balança de casa. */
export const PERDA_DE_ATENCAO = -5
export const PERDA_DE_RISCO = -10

/**
 * Quanto um ponto pode subir sobre o anterior sem quebrar a "perda contínua".
 *
 * A série mistura a balança da clínica e a de casa, e as duas não concordam na casa decimal.
 * Sem tolerância, 4,40 em casa depois de 4,38 na clínica desmentiria uma queda de cinco meses.
 */
const TOLERANCIA_DE_SUBIDA = 0.01

/** Pontos mínimos para chamar de contínua. Com dois, qualquer par é "contínuo". */
const PONTOS_PARA_TENDENCIA = 4

/** Sintoma comum que se repete isto desde a última consulta vira sinal. */
export const VEZES_PARA_RECORRENTE = 3

/** Sem consulta anterior, "desde a última vez" é esta janela do diário. */
const JANELA_SEM_CONSULTA_DIAS = 30

export const SINTOMAS_DE_ALARME: readonly SintomaNoDiario[] = [
  'desmaio',
  'falta-de-ar',
  'convulsao',
]

/**
 * "Check-up sem alterações" é diagnóstico no catálogo, mas não é condição de ninguém. Listado
 * como condição ativa, faria o paciente saudável parecer doente.
 */
const DIAGNOSTICOS_QUE_NAO_SAO_CONDICAO = new Set(['GN-00'])

const APETITE_ALTERADO: readonly ApetiteNoDiario[] = ['reduzido', 'ausente']
const COMPORTAMENTO_ALTERADO: readonly ComportamentoNoDiario[] = ['quieto', 'apatico']

export type ConsultaDoResumo = {
  encounterId: string
  appointmentId: string
  /** Quando terminou. É dali que "desde a última consulta" começa a contar. */
  em: ISODateTime
  typeId: string
  professionalId: string
  diagnosticos: Diagnosis[]
  /** Peso aferido na balança da clínica, quando foi. */
  pesoKg: number | null
  /** O que saiu receitado, com o último dia de tratamento. `null` é receita contínua. */
  prescricoes: Array<{ medicamentoId: string; ate: ISODateTime | null }>
}

export type EntradaDoResumoDoPaciente = {
  pet: Pet
  /** Consultas finalizadas do paciente, em qualquer ordem. */
  consultas: ConsultaDoResumo[]
  /** Registros do diário do paciente, em qualquer ordem. */
  diario: EntradaDoDiario[]
  agora: ISODateTime
}

export type PesagemDoPaciente = {
  em: ISODateTime
  pesoKg: number
  /** A balança da clínica e a de casa não valem o mesmo — o gráfico diz qual é qual. */
  origem: 'clinica' | 'casa'
}

export type VariacaoDePeso = {
  deKg: number
  paraKg: number
  /** Negativo é perda. Uma casa decimal. */
  percentual: number
  semanas: number
  /** Nenhuma subida relevante no caminho, com pontos suficientes para afirmar. */
  continua: boolean
}

export type SinalDoResumo =
  | {
      tipo: 'perda-de-peso'
      severidade: AlertSeverity
      variacao: VariacaoDePeso
    }
  | {
      tipo: 'sintoma-de-alarme'
      severidade: 'risco'
      sintomas: SintomaNoDiario[]
      em: ISODateTime
      nota: string
    }
  | {
      tipo: 'sintoma-recorrente'
      severidade: 'atencao'
      sintoma: SintomaNoDiario
      vezes: number
    }
  | {
      tipo: 'apetite'
      severidade: 'atencao'
      alterados: number
      total: number
    }

export type ContagemDoDiario<T extends string> = {
  total: number
  alterados: number
  ultimo: T
  ultimoEm: ISODateTime
}

export type SintomaContado = {
  sintoma: SintomaNoDiario
  vezes: number
  ultimaEm: ISODateTime
  alarme: boolean
}

export type MedicacaoEmUso =
  | { origem: 'continua'; id: string; descricao: string }
  | { origem: 'prescricao'; id: string; medicamentoId: string; ate: ISODateTime | null }

export type ResumoDoPaciente = {
  /** Nunca teve consulta finalizada na clínica. */
  primeiraVez: boolean
  ultimaConsulta: ConsultaDoResumo | null
  diasDesdeUltima: number | null
  /** O que precisa ser visto antes de tudo. Risco primeiro. */
  sinais: SinalDoResumo[]
  /** Alertas do cadastro que não viram linha própria (alergia, manejo, gestação...). */
  alertas: PetAlert[]
  condicoes: string[]
  medicacoes: MedicacaoEmUso[]
  diario: {
    /** Início da janela: fim da última consulta ou, sem ela, os últimos 30 dias. */
    desde: ISODateTime
    /** Os registros da janela, mais recente primeiro. */
    entradas: EntradaDoDiario[]
    semAlteracao: number
    apetite: ContagemDoDiario<ApetiteNoDiario> | null
    comportamento: ContagemDoDiario<ComportamentoNoDiario> | null
    sintomas: SintomaContado[]
    /** As falas do responsável que vale ler. No máximo três; alarme já sai no sinal. */
    notas: EntradaDoDiario[]
    peso: { deKg: number; paraKg: number; ultimoEm: ISODateTime } | null
  }
  peso: {
    serie: PesagemDoPaciente[]
    consultas: Array<{ em: ISODateTime; typeId: string; pesoKg: number | null }>
    variacao: VariacaoDePeso | null
  }
}

function diasEntre(de: ISODateTime, ate: ISODateTime): number {
  return Math.floor((Date.parse(ate) - Date.parse(de)) / DIA_MS)
}

/**
 * Instante em milissegundos. Toda comparação de data daqui passa por ele: o dataset escreve o
 * fuso da clínica (`-03:00`) e `toISOString` escreve `Z`, e comparar os dois como texto dá a
 * resposta errada em qualquer horário depois das nove da noite.
 */
function ms(iso: ISODateTime): number {
  return Date.parse(iso)
}

function maisRecentePrimeiro(a: ISODateTime, b: ISODateTime): number {
  return ms(b) - ms(a)
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

function temAlteracao(entrada: EntradaDoDiario): boolean {
  return (
    entrada.sintomas.length > 0 ||
    (entrada.apetite !== null && APETITE_ALTERADO.includes(entrada.apetite)) ||
    (entrada.comportamento !== null && COMPORTAMENTO_ALTERADO.includes(entrada.comportamento))
  )
}

function temAlarme(entrada: EntradaDoDiario): boolean {
  return entrada.sintomas.some((sintoma) => SINTOMAS_DE_ALARME.includes(sintoma))
}

function contar<T extends string>(
  entradas: EntradaDoDiario[],
  campo: (entrada: EntradaDoDiario) => T | null,
  alterados: readonly T[],
): ContagemDoDiario<T> | null {
  const comValor = entradas.filter((entrada) => campo(entrada) !== null)
  const ultima = comValor[0]

  if (!ultima) {
    return null
  }

  return {
    total: comValor.length,
    alterados: comValor.filter((entrada) => alterados.includes(campo(entrada)!)).length,
    ultimo: campo(ultima)!,
    ultimoEm: ultima.registradoEm,
  }
}

/**
 * A variação de peso na janela, do primeiro ao último ponto.
 *
 * "Contínua" é a série não ter subido de verdade em nenhum trecho. Uma perda de 12% com uma
 * recuperação no meio é outra história — pode ser a dieta que funcionou e parou —, e o resumo
 * não afirma tendência onde a série não afirma.
 */
export function variacaoDePeso(serie: PesagemDoPaciente[]): VariacaoDePeso | null {
  const primeiro = serie[0]
  const ultimo = serie[serie.length - 1]

  if (!primeiro || !ultimo || serie.length < 2 || primeiro.pesoKg <= 0) {
    return null
  }

  const semSubida = serie.every(
    (ponto, indice) =>
      indice === 0 || ponto.pesoKg <= serie[indice - 1]!.pesoKg * (1 + TOLERANCIA_DE_SUBIDA),
  )

  return {
    deKg: primeiro.pesoKg,
    paraKg: ultimo.pesoKg,
    percentual: Math.round(((ultimo.pesoKg - primeiro.pesoKg) / primeiro.pesoKg) * 1000) / 10,
    semanas: Math.max(1, Math.round(diasEntre(primeiro.em, ultimo.em) / 7)),
    continua: semSubida && serie.length >= PONTOS_PARA_TENDENCIA,
  }
}

function sinalDePeso(variacao: VariacaoDePeso | null): SinalDoResumo | null {
  if (!variacao || variacao.percentual > PERDA_DE_ATENCAO) {
    return null
  }

  /* Uma queda que subiu e desceu só conta se já passou do risco. */
  if (!variacao.continua && variacao.percentual > PERDA_DE_RISCO) {
    return null
  }

  return {
    tipo: 'perda-de-peso',
    severidade: variacao.percentual <= PERDA_DE_RISCO ? 'risco' : 'atencao',
    variacao,
  }
}

const ORDEM_DA_SEVERIDADE: Record<AlertSeverity, number> = { risco: 0, atencao: 1, info: 2 }

export function montarResumoDoPaciente(entrada: EntradaDoResumoDoPaciente): ResumoDoPaciente {
  const { pet, agora } = entrada

  const consultas = entrada.consultas
    .filter((consulta) => ms(consulta.em) <= ms(agora))
    .sort((a, b) => maisRecentePrimeiro(a.em, b.em))
  const ultimaConsulta = consultas[0] ?? null

  const desde =
    ultimaConsulta?.em ?? new Date(ms(agora) - JANELA_SEM_CONSULTA_DIAS * DIA_MS).toISOString()

  const diarioOrdenado = entrada.diario
    .filter((item) => item.petId === pet.id && ms(item.registradoEm) <= ms(agora))
    .sort((a, b) => maisRecentePrimeiro(a.registradoEm, b.registradoEm))
  const naJanela = diarioOrdenado.filter((item) => ms(item.registradoEm) > ms(desde))

  // ---------------------------------------------------------------- sintomas

  const porSintoma = new Map<SintomaNoDiario, SintomaContado>()

  for (const item of naJanela) {
    for (const sintoma of item.sintomas) {
      const atual = porSintoma.get(sintoma)

      porSintoma.set(sintoma, {
        sintoma,
        vezes: (atual?.vezes ?? 0) + 1,
        /* A janela vem do mais recente para o mais antigo: o primeiro visto é o último. */
        ultimaEm: atual?.ultimaEm ?? item.registradoEm,
        alarme: SINTOMAS_DE_ALARME.includes(sintoma),
      })
    }
  }

  const sintomas = [...porSintoma.values()].sort(
    (a, b) => Number(b.alarme) - Number(a.alarme) || b.vezes - a.vezes,
  )

  // ---------------------------------------------------------------- peso

  const inicioDaSerie = ms(agora) - JANELA_DO_PESO_DIAS * DIA_MS

  const serie: PesagemDoPaciente[] = [
    ...consultas
      .filter((consulta) => consulta.pesoKg !== null)
      .map((consulta) => ({
        em: consulta.em,
        pesoKg: consulta.pesoKg!,
        origem: 'clinica' as const,
      })),
    ...diarioOrdenado
      .filter((item) => item.pesoKg !== null)
      .map((item) => ({ em: item.registradoEm, pesoKg: item.pesoKg!, origem: 'casa' as const })),
  ]
    .filter((ponto) => ms(ponto.em) >= inicioDaSerie)
    .sort((a, b) => ms(a.em) - ms(b.em))

  const variacao = variacaoDePeso(serie)

  const pesosDeCasa = naJanela.filter((item) => item.pesoKg !== null)
  const pesoDeCasaMaisNovo = pesosDeCasa[0]
  const pesoDeCasaMaisVelho = pesosDeCasa[pesosDeCasa.length - 1]

  // ---------------------------------------------------------------- sinais

  const apetite = contar(naJanela, (item) => item.apetite, APETITE_ALTERADO)
  const sinais: SinalDoResumo[] = []
  const perda = sinalDePeso(variacao)

  if (perda) {
    sinais.push(perda)
  }

  for (const item of naJanela.filter(temAlarme)) {
    sinais.push({
      tipo: 'sintoma-de-alarme',
      severidade: 'risco',
      sintomas: item.sintomas.filter((sintoma) => SINTOMAS_DE_ALARME.includes(sintoma)),
      em: item.registradoEm,
      nota: item.nota,
    })
  }

  for (const contado of sintomas) {
    if (!contado.alarme && contado.vezes >= VEZES_PARA_RECORRENTE) {
      sinais.push({
        tipo: 'sintoma-recorrente',
        severidade: 'atencao',
        sintoma: contado.sintoma,
        vezes: contado.vezes,
      })
    }
  }

  /* Apetite alterado em metade dos registros, com registros suficientes para dizer "metade". */
  if (apetite && apetite.total >= 3 && apetite.alterados * 2 >= apetite.total) {
    sinais.push({
      tipo: 'apetite',
      severidade: 'atencao',
      alterados: apetite.alterados,
      total: apetite.total,
    })
  }

  sinais.sort((a, b) => ORDEM_DA_SEVERIDADE[a.severidade] - ORDEM_DA_SEVERIDADE[b.severidade])

  // ---------------------------------------------------------------- cadastro

  const umAnoAtras = ms(agora) - 365 * DIA_MS
  const condicoes: string[] = []
  const vistas = new Set<string>()

  const acrescentar = (texto: string) => {
    const chave = normalizar(texto)

    if (chave && !vistas.has(chave)) {
      vistas.add(chave)
      condicoes.push(texto)
    }
  }

  pet.alertas
    .filter((alerta) => alerta.kind === 'cronico')
    .forEach((alerta) => acrescentar(alerta.detalhe))

  for (const consulta of consultas.filter((item) => ms(item.em) >= umAnoAtras)) {
    for (const diagnostico of consulta.diagnosticos) {
      if (
        diagnostico.kind === 'definitivo' &&
        !DIAGNOSTICOS_QUE_NAO_SAO_CONDICAO.has(diagnostico.codigo)
      ) {
        acrescentar(diagnostico.descricao)
      }
    }
  }

  const medicacoes: MedicacaoEmUso[] = [
    ...pet.alertas
      .filter((alerta) => alerta.kind === 'medicacao-continua')
      .map((alerta) => ({ origem: 'continua' as const, id: alerta.id, descricao: alerta.detalhe })),
    ...consultas.flatMap((consulta) =>
      consulta.prescricoes
        .filter((prescricao) => prescricao.ate === null || ms(prescricao.ate) > ms(agora))
        .map((prescricao) => ({
          origem: 'prescricao' as const,
          id: `${consulta.encounterId}-${prescricao.medicamentoId}`,
          medicamentoId: prescricao.medicamentoId,
          ate: prescricao.ate,
        })),
    ),
  ]

  const alertas = pet.alertas
    .filter((alerta) => alerta.kind !== 'cronico' && alerta.kind !== 'medicacao-continua')
    .sort((a, b) => ORDEM_DA_SEVERIDADE[a.severidade] - ORDEM_DA_SEVERIDADE[b.severidade])

  return {
    primeiraVez: consultas.length === 0,
    ultimaConsulta,
    diasDesdeUltima: ultimaConsulta ? diasEntre(ultimaConsulta.em, agora) : null,
    sinais,
    alertas,
    condicoes,
    medicacoes,
    diario: {
      desde,
      entradas: naJanela,
      semAlteracao: naJanela.filter((item) => !temAlteracao(item)).length,
      apetite,
      comportamento: contar(naJanela, (item) => item.comportamento, COMPORTAMENTO_ALTERADO),
      sintomas,
      notas: naJanela
        .filter((item) => item.nota.trim() && temAlteracao(item) && !temAlarme(item))
        .slice(0, 3),
      peso:
        pesoDeCasaMaisNovo && pesoDeCasaMaisVelho
          ? {
              deKg: pesoDeCasaMaisVelho.pesoKg!,
              paraKg: pesoDeCasaMaisNovo.pesoKg!,
              ultimoEm: pesoDeCasaMaisNovo.registradoEm,
            }
          : null,
    },
    peso: {
      serie,
      consultas: consultas
        .filter((consulta) => ms(consulta.em) >= inicioDaSerie)
        .map((consulta) => ({ em: consulta.em, typeId: consulta.typeId, pesoKg: consulta.pesoKg })),
      variacao,
    },
  }
}
