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
 *   linhas de "tudo certo"; um desmaio no meio delas não pode perder para a média. Achado de
 *   alarme vira sinal com **um** registro.
 * - **Resumir é contar, não cortar.** Os registros sem nada viram um número ("84 sem
 *   alteração"), e continuam a um clique. Esconder dado do vet não é resumir.
 *
 * O diário chega na forma do contrato com o app (`DiarioParaClinica`), com os enums do Diário
 * Pet literais — e só chega se o responsável liberou (`ConsentimentoDaClinica`). Sem
 * consentimento, o resumo diz isso em vez de parecer vazio.
 *
 * Função pura: recebe o que o repositório juntou e o instante de referência, devolve o resumo.
 */

import type {
  AspectoFezes,
  ConsumoDiario,
  DiarioParaClinica,
  DoencaDiario,
  EntradaDoDiarioParaClinica,
  EstadoUrina,
  SintomaPet,
  VitalidadePet,
} from '../contrato/responsavel'
import type { AlertSeverity, Diagnosis, ISODateTime, Pet, PetAlert } from '../data/types'

import type { AlertaDeAdesao, DoseNaGrade, ResumoDaAdesao } from './adesao'

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

/** Sintomas que viram sinal de risco com um registro só. */
export const SINTOMAS_DE_ALARME: readonly SintomaPet[] = ['CONVULSAO', 'FALTA_DE_AR', 'SANGRAMENTO']

/** Sangue nas fezes é achado de alarme; o resto do aspecto é observação. */
const FEZES_DE_ALARME: readonly AspectoFezes[] = ['COM_SANGUE']

/** Sangue na urina, ou urina nenhuma — no gato, obstrução até prova em contrário. */
const URINA_DE_ALARME: readonly EstadoUrina[] = ['COM_SANGUE', 'NADA']

/**
 * "Check-up sem alterações" é diagnóstico no catálogo, mas não é condição de ninguém. Listado
 * como condição ativa, faria o paciente saudável parecer doente.
 */
const DIAGNOSTICOS_QUE_NAO_SAO_CONDICAO = new Set(['GN-00'])

/** Os campos de escolha única do diário, na ordem em que o vet os lê. */
export const CAMPOS_DO_DIARIO = [
  'alimentacao',
  'hidratacao',
  'vitalidade',
  'fezes',
  'urina',
] as const
export type CampoDoDiario = (typeof CAMPOS_DO_DIARIO)[number]

export type ValorDoCampo = {
  alimentacao: ConsumoDiario
  hidratacao: ConsumoDiario
  vitalidade: VitalidadePet
  fezes: AspectoFezes
  urina: EstadoUrina
}

/**
 * O que é "alterado" em cada campo.
 *
 * Comida e água: qualquer coisa fora do normal, **inclusive a mais**. Gata idosa bebendo muito
 * e comendo muito, emagrecendo, é o quadro clássico — "muito" não é notícia boa aqui.
 * Disposição: ativo e calmo são jeitos de estar bem; o resto pede atenção.
 */
const ALTERADO: { [C in CampoDoDiario]: (valor: ValorDoCampo[C]) => boolean } = {
  alimentacao: (valor) => valor !== 'NORMAL',
  hidratacao: (valor) => valor !== 'NORMAL',
  vitalidade: (valor) => !['NORMAL', 'ATIVO', 'CALMO'].includes(valor),
  fezes: (valor) => valor !== 'NORMAL',
  urina: (valor) => valor !== 'NORMAL',
}

function campoAlterado(campo: CampoDoDiario, entrada: EntradaDoDiarioParaClinica): boolean {
  const valor = entrada[campo]

  return valor !== null && (ALTERADO[campo] as (valor: string) => boolean)(valor)
}

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

/**
 * Um remédio de casa, com o que a casa registrou desde a última consulta.
 *
 * É a pergunta do retorno — "o tratamento foi feito?" — respondida antes de alguém perguntar.
 * Vem pronto do repositório (`domain/adesao.ts` faz a conta); o resumo só decide o que sobe.
 */
export type TratamentoNoResumo = {
  id: string
  medicamentoId: string | null
  /** Reserva para o que não é do bulário. */
  medicamento: string
  critico: boolean
  /** A casa compartilha os registros com a clínica. Sem isso, nada abaixo vale. */
  compartilhado: boolean
  emCurso: boolean
  quantidade: number
  unidade: 'ml' | 'comprimido'
  frequenciaHoras: number
  duracaoDias: number | null
  /** As doses do período, para a faixa. */
  doses: DoseNaGrade[]
  periodo: ResumoDaAdesao
  alerta: AlertaDeAdesao | null
  /** Quem cuida, pelo id — "registrado por Fátima (31) e Rafael (9)". */
  nomes: Record<string, string>
}

export type EntradaDoResumoDoPaciente = {
  pet: Pet
  /** Consultas finalizadas do paciente, em qualquer ordem. */
  consultas: ConsultaDoResumo[]
  /** O diário que o responsável liberou. `null`: ele não liberou para a clínica. */
  diario: DiarioParaClinica | null
  /** Os remédios de casa com lembrete no app. Ausente é o mesmo que nenhum. */
  tratamentos?: TratamentoNoResumo[]
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

export type AchadoDeAlarme =
  | { campo: 'sintomas'; valor: SintomaPet }
  | { campo: 'fezes'; valor: AspectoFezes }
  | { campo: 'urina'; valor: EstadoUrina }

/** A partir de quantos remédios diferentes em uso o resumo sinaliza polifarmácia. */
export const LIMIAR_DE_POLIFARMACIA = 5

/** Entre duas receitas do mesmo remédio, a que termina depois (ou não termina). */
function vaiMaisLonge(a: MedicacaoEmUso, b: MedicacaoEmUso): boolean {
  const fimDe = (item: MedicacaoEmUso) =>
    item.origem === 'continua' || item.ate === null
      ? Number.POSITIVE_INFINITY
      : Date.parse(item.ate)

  return fimDe(a) > fimDe(b)
}

export type SinalDoResumo =
  | {
      tipo: 'perda-de-peso'
      severidade: AlertSeverity
      variacao: VariacaoDePeso
    }
  | {
      tipo: 'alarme'
      severidade: 'risco'
      achados: AchadoDeAlarme[]
      em: ISODateTime
      /** O que o responsável escreveu em "outros sintomas" — onde mora o que o enum não tem. */
      relato: string | null
      /** O texto do registro, na íntegra: é o contexto que o achado não dá. */
      texto: string | null
    }
  | {
      tipo: 'sintoma-recorrente'
      severidade: 'atencao'
      sintoma: SintomaPet
      vezes: number
    }
  | {
      tipo: 'campo-alterado'
      severidade: 'atencao'
      campo: CampoDoDiario
      /** O valor alterado que mais apareceu: "pouco", "muito", "desanimado". */
      predominante: string
      alterados: number
      total: number
    }
  /*
   * Um tratamento crítico cuja adesão caiu em casa. Risco: é o que muda a conduta antes da
   * consulta começar — furosemida que acabou há dois dias explica o cansaço antes do exame.
   */
  | {
      tipo: 'adesao'
      severidade: 'risco'
      tratamentoId: string
      medicamentoId: string | null
      medicamento: string
      alerta: AlertaDeAdesao
    }
  /*
   * Polifarmácia: cinco ou mais remédios diferentes em uso ao mesmo tempo. Não é alarme — é o
   * lembrete de conferir interação antes de prescrever o sexto. Sem ele, o resumo dizia "nada fora
   * do comum" para um paciente com sete remédios correndo.
   */
  | {
      tipo: 'polifarmacia'
      severidade: 'atencao'
      total: number
    }

export type ContagemDoCampo = {
  campo: CampoDoDiario
  total: number
  alterados: number
  /** O valor alterado mais frequente, quando houve algum. */
  predominante: string | null
  ultimo: string
  ultimoEm: ISODateTime
}

export type SintomaContado = {
  sintoma: SintomaPet
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
  /** Os remédios de casa em curso ou com dose no período, na ordem do repositório. */
  tratamentos: TratamentoNoResumo[]
  diario: {
    /** O responsável liberou o diário para a clínica. Sem isso, tudo abaixo vem vazio. */
    liberado: boolean
    /** Início da janela: fim da última consulta ou, sem ela, os últimos 30 dias. */
    desde: ISODateTime
    /** Os registros da janela, mais recente primeiro. */
    entradas: EntradaDoDiarioParaClinica[]
    semAlteracao: number
    /** Uma contagem por campo que teve algum registro, na ordem de `CAMPOS_DO_DIARIO`. */
    campos: ContagemDoCampo[]
    sintomas: SintomaContado[]
    doencas: Array<{ doenca: DoencaDiario; vezes: number }>
    /** As falas do responsável que vale ler. No máximo três; alarme já sai no sinal. */
    notas: Array<{ entrada: EntradaDoDiarioParaClinica; texto: string }>
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
 * fuso da clínica (`-04:00`) e `toISOString` escreve `Z`, e comparar os dois como texto dá a
 * resposta errada em qualquer horário depois das oito da noite.
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

/** Os achados de alarme de um registro — vazio quando não há nenhum. */
export function achadosDeAlarme(entrada: EntradaDoDiarioParaClinica): AchadoDeAlarme[] {
  return [
    ...entrada.sintomas
      .filter((sintoma) => SINTOMAS_DE_ALARME.includes(sintoma))
      .map((valor) => ({ campo: 'sintomas' as const, valor })),
    ...(entrada.fezes && FEZES_DE_ALARME.includes(entrada.fezes)
      ? [{ campo: 'fezes' as const, valor: entrada.fezes }]
      : []),
    ...(entrada.urina && URINA_DE_ALARME.includes(entrada.urina)
      ? [{ campo: 'urina' as const, valor: entrada.urina }]
      : []),
  ]
}

/** O registro disse alguma coisa fora do normal? É o que separa o "84 sem alteração" do resto. */
export function temAlteracao(entrada: EntradaDoDiarioParaClinica): boolean {
  return (
    entrada.sintomas.length > 0 ||
    entrada.doencas.length > 0 ||
    Boolean(entrada.sintomasOutros?.trim()) ||
    CAMPOS_DO_DIARIO.some((campo) => campoAlterado(campo, entrada))
  )
}

/** O texto que o responsável escreveu no registro, na ordem do mais clínico ao mais pessoal. */
export function textoDoRegistro(entrada: EntradaDoDiarioParaClinica): string | null {
  return (
    entrada.observacoes?.trim() || entrada.sintomasOutros?.trim() || entrada.nota?.trim() || null
  )
}

function contarCampo(
  entradas: EntradaDoDiarioParaClinica[],
  campo: CampoDoDiario,
): ContagemDoCampo | null {
  const comValor = entradas.filter((entrada) => entrada[campo] !== null)
  const ultima = comValor[0]

  if (!ultima) {
    return null
  }

  const vezesPorValor = new Map<string, number>()

  for (const entrada of comValor.filter((item) => campoAlterado(campo, item))) {
    const valor = entrada[campo] as string

    vezesPorValor.set(valor, (vezesPorValor.get(valor) ?? 0) + 1)
  }

  const predominante = [...vezesPorValor.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return {
    campo,
    total: comValor.length,
    alterados: [...vezesPorValor.values()].reduce((soma, vezes) => soma + vezes, 0),
    predominante,
    ultimo: ultima[campo] as string,
    ultimoEm: ultima.data,
  }
}

/** O último valor registrado de um campo, com o tipo do próprio campo. */
export function ultimoDoCampo<C extends CampoDoDiario>(
  campos: ContagemDoCampo[],
  campo: C,
): ValorDoCampo[C] | null {
  const contagem = campos.find((item) => item.campo === campo)

  return contagem ? (contagem.ultimo as ValorDoCampo[C]) : null
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

  const registros = (entrada.diario?.entradas ?? [])
    .filter((item) => ms(item.data) <= ms(agora))
    .sort((a, b) => maisRecentePrimeiro(a.data, b.data))
  const naJanela = registros.filter((item) => ms(item.data) > ms(desde))

  const pesagensDeCasa = (entrada.diario?.pesos ?? [])
    .filter((item) => ms(item.data) <= ms(agora))
    .sort((a, b) => maisRecentePrimeiro(a.data, b.data))

  // ---------------------------------------------------------------- sintomas e doenças

  const porSintoma = new Map<SintomaPet, SintomaContado>()
  const porDoenca = new Map<DoencaDiario, number>()

  for (const item of naJanela) {
    for (const sintoma of item.sintomas) {
      const atual = porSintoma.get(sintoma)

      porSintoma.set(sintoma, {
        sintoma,
        vezes: (atual?.vezes ?? 0) + 1,
        /* A janela vem do mais recente para o mais antigo: o primeiro visto é o último. */
        ultimaEm: atual?.ultimaEm ?? item.data,
        alarme: SINTOMAS_DE_ALARME.includes(sintoma),
      })
    }

    for (const doenca of item.doencas) {
      porDoenca.set(doenca, (porDoenca.get(doenca) ?? 0) + 1)
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
    ...pesagensDeCasa.map((item) => ({
      em: item.data,
      pesoKg: item.pesoKg,
      origem: 'casa' as const,
    })),
  ]
    .filter((ponto) => ms(ponto.em) >= inicioDaSerie)
    .sort((a, b) => ms(a.em) - ms(b.em))

  const variacao = variacaoDePeso(serie)

  const pesosNaJanela = pesagensDeCasa.filter((item) => ms(item.data) > ms(desde))
  const pesoMaisNovo = pesosNaJanela[0]
  const pesoMaisVelho = pesosNaJanela[pesosNaJanela.length - 1]

  // ---------------------------------------------------------------- sinais

  const campos = CAMPOS_DO_DIARIO.map((campo) => contarCampo(naJanela, campo)).filter(
    (contagem): contagem is ContagemDoCampo => contagem !== null,
  )

  const sinais: SinalDoResumo[] = []
  const perda = sinalDePeso(variacao)

  if (perda) {
    sinais.push(perda)
  }

  for (const item of naJanela) {
    const achados = achadosDeAlarme(item)

    if (achados.length > 0) {
      sinais.push({
        tipo: 'alarme',
        severidade: 'risco',
        achados,
        em: item.data,
        relato: item.sintomasOutros?.trim() || null,
        texto: item.observacoes?.trim() || item.nota?.trim() || null,
      })
    }
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

  /* Campo alterado em metade dos registros, com registros suficientes para dizer "metade". */
  for (const contagem of campos) {
    if (contagem.total >= 3 && contagem.alterados * 2 >= contagem.total && contagem.predominante) {
      sinais.push({
        tipo: 'campo-alterado',
        severidade: 'atencao',
        campo: contagem.campo,
        predominante: contagem.predominante,
        alterados: contagem.alterados,
        total: contagem.total,
      })
    }
  }

  /*
   * Os remédios de casa. Entra o que está em curso e o que teve dose desde a última consulta — o
   * tratamento que terminou antes dela já foi assunto daquela consulta.
   */
  const tratamentos = (entrada.tratamentos ?? []).filter(
    (tratamento) => tratamento.emCurso || tratamento.periodo.fechadas > 0,
  )

  for (const tratamento of tratamentos) {
    if (tratamento.alerta) {
      sinais.push({
        tipo: 'adesao',
        severidade: 'risco',
        tratamentoId: tratamento.id,
        medicamentoId: tratamento.medicamentoId,
        medicamento: tratamento.medicamento,
        alerta: tratamento.alerta,
      })
    }
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

  const receitadas: MedicacaoEmUso[] = [
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

  /*
   * Uma linha por remédio. A cefalexina receitada em três consultas aparecia três vezes na lista;
   * fica a receita que vai mais longe (sem data de fim é uso contínuo, e ganha de qualquer data).
   */
  const porRemedio = new Map<string, MedicacaoEmUso>()

  for (const item of receitadas) {
    const chave =
      item.origem === 'continua' ? `continua:${normalizar(item.descricao)}` : item.medicamentoId
    const anterior = porRemedio.get(chave)

    if (!anterior || vaiMaisLonge(item, anterior)) {
      porRemedio.set(chave, item)
    }
  }

  const medicacoes = [...porRemedio.values()]

  /*
   * O mesmo remédio receitado em duas consultas é um remédio só: a contagem é por medicamento (ou
   * pela descrição, no uso contínuo), não por linha de receita.
   */
  const remediosDistintos = new Set(
    medicacoes.map((item) =>
      item.origem === 'continua' ? normalizar(item.descricao) : item.medicamentoId,
    ),
  ).size

  if (remediosDistintos >= LIMIAR_DE_POLIFARMACIA) {
    sinais.push({ tipo: 'polifarmacia', severidade: 'atencao', total: remediosDistintos })
    sinais.sort((a, b) => ORDEM_DA_SEVERIDADE[a.severidade] - ORDEM_DA_SEVERIDADE[b.severidade])
  }

  const alertas = pet.alertas
    .filter((alerta) => alerta.kind !== 'cronico' && alerta.kind !== 'medicacao-continua')
    .sort((a, b) => ORDEM_DA_SEVERIDADE[a.severidade] - ORDEM_DA_SEVERIDADE[b.severidade])

  const notas = naJanela
    .filter((item) => temAlteracao(item) && achadosDeAlarme(item).length === 0)
    .map((item) => ({ entrada: item, texto: textoDoRegistro(item) }))
    .filter((item): item is { entrada: EntradaDoDiarioParaClinica; texto: string } =>
      Boolean(item.texto),
    )
    .slice(0, 3)

  return {
    primeiraVez: consultas.length === 0,
    ultimaConsulta,
    diasDesdeUltima: ultimaConsulta ? diasEntre(ultimaConsulta.em, agora) : null,
    sinais,
    alertas,
    condicoes,
    medicacoes,
    tratamentos,
    diario: {
      liberado: entrada.diario !== null,
      desde,
      entradas: naJanela,
      semAlteracao: naJanela.filter((item) => !temAlteracao(item)).length,
      campos,
      sintomas,
      doencas: [...porDoenca.entries()]
        .map(([doenca, vezes]) => ({ doenca, vezes }))
        .sort((a, b) => b.vezes - a.vezes),
      notas,
      peso:
        pesoMaisNovo && pesoMaisVelho
          ? {
              deKg: pesoMaisVelho.pesoKg,
              paraKg: pesoMaisNovo.pesoKg,
              ultimoEm: pesoMaisNovo.data,
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
