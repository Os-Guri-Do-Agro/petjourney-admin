/**
 * Adesão ao tratamento: o que foi dado em casa, contado sem acusar ninguém.
 *
 * O vet prescreve, o app lembra o responsável na hora da dose, alguém da casa toca "dei" — e, no
 * retorno, o vet sabe se o tratamento foi feito antes de concluir que ele não funcionou. Este
 * arquivo é a regra dessa conta, igual para o portal e para a API.
 *
 * Três decisões moram aqui, e cada uma existe por um caso difícil:
 *
 * - **Sem registro não é dose perdida.** Quem dá o remédio e não marca no app existe, e é comum.
 *   A dose sem registro tem estado próprio, fica fora do "deu" **e** fora do "não deu", e nenhuma
 *   tela a soma com as puladas. Pulada é só o que alguém da casa disse que pulou, com o motivo.
 * - **A dose não cobra.** Quando o horário da dose seguinte chega, a anterior fecha sozinha: vira
 *   "sem registro" em silêncio, sem aviso de atraso. Remédio de oito em oito horas por catorze
 *   dias são 42 doses — se cada uma pudesse gerar cobrança, o lembrete viraria o que se desliga.
 * - **O alerta é de queda, não de nota.** A clínica é avisada quando um tratamento marcado como
 *   crítico muda de padrão: doses puladas seguidas, ou o registro despencando em quem registrava
 *   quase tudo. Quem nunca registrou não dispara nada — não há queda onde nunca houve registro, e
 *   um alerta ali seria a acusação que a tela existe para não fazer.
 *
 * Função pura, como o resto do domínio: recebe o tratamento, os registros e o instante, devolve a
 * grade. As datas saem no fuso do início do tratamento, que é o da clínica.
 */

import type { ClockTime, ISODate, ISODateTime } from '../data/types'

import { addDays, diffDays, epochToWall, minutesToClock, wallToIso } from './clinic-time'

const MINUTO_MS = 60_000
const HORA_MS = 60 * MINUTO_MS
const DIA_MS = 24 * HORA_MS

export const MOTIVOS_DA_DOSE_PULADA = ['esqueci', 'cuspiu', 'acabou'] as const
export type MotivoDaDosePulada = (typeof MOTIVOS_DA_DOSE_PULADA)[number]

/**
 * - `dada` / `pulada` — alguém da casa registrou.
 * - `sem-registro` — o prazo de registro passou e ninguém marcou. Não quer dizer que não deu.
 * - `aberta` — é a dose da vez: já dá para registrar, e ainda não passou a hora da seguinte.
 * - `prevista` — ainda não chegou.
 */
export type SituacaoDaDose = 'dada' | 'pulada' | 'sem-registro' | 'aberta' | 'prevista'

/** O registro abre uma hora antes: quem dá às 7h40 a dose das 8h não precisa esperar para marcar. */
export const ANTECEDENCIA_DO_REGISTRO_MIN = 60

/** A janela do alerta da clínica: os últimos três dias. */
export const JANELA_DO_ALERTA_HORAS = 72

/** O padrão de antes, contra o qual a queda é medida. */
export const BASE_DO_ALERTA_DIAS = 7

/** Duas doses puladas na janela já são notícia, qualquer que seja o histórico. */
export const PULADAS_PARA_ALERTA = 2

/** "Despencou": menos da metade dada na janela, vindo de quem dava quase todas. */
export const QUEDA_ABAIXO_DE = 0.5
export const BASE_ACIMA_DE = 0.8

/** Com menos doses do que isso antes da janela, não há padrão para dizer que caiu. */
export const BASE_MINIMA_DE_DOSES = 4

/** A madrugada que a sugestão do primeiro horário tenta deixar livre. */
export const MADRUGADA = { de: 0, ate: 6 * 60 } as const

export type RegistroDeDose = {
  id: string
  tratamentoId: string
  /** 1 é a primeira dose do tratamento. O horário sai da grade, não do registro. */
  numero: number
  situacao: 'dada' | 'pulada'
  /** Só na pulada. */
  motivo: MotivoDaDosePulada | null
  registradaEm: ISODateTime
  /** Quem tocou: o dono do pet ou alguém da família com acesso de edição. */
  cuidadorId: string
}

/** O pedaço do tratamento de que a grade depende. */
export type GradeDoTratamento = {
  inicioEm: ISODateTime
  frequenciaHoras: number
  /** `null` é uso contínuo: a grade não tem fim. */
  duracaoDias: number | null
  /** Quando alguém encerrou antes do fim — o vet suspendeu, o responsável desligou. */
  encerradoEm: ISODateTime | null
}

export type DoseNaGrade = {
  numero: number
  previstaEm: ISODateTime
  /** Até quando dá para registrar: a hora da dose seguinte. */
  registravelAte: ISODateTime
  situacao: SituacaoDaDose
  registro: RegistroDeDose | null
}

function ms(iso: ISODateTime): number {
  return Date.parse(iso)
}

/** O offset escrito no fim da string (`-04:00`). A grade continua no fuso em que começou. */
function offsetDe(iso: ISODateTime): string {
  const encontrado = /([+-]\d{2}:\d{2})$/.exec(iso)

  return encontrado?.[1] ?? '+00:00'
}

function isoEm(epoch: number, utcOffset: string): ISODateTime {
  return wallToIso(epochToWall(epoch, utcOffset), utcOffset)
}

/** Quantas doses o tratamento tem ao todo. `null` no uso contínuo. */
export function totalDeDoses(grade: Pick<GradeDoTratamento, 'frequenciaHoras' | 'duracaoDias'>) {
  if (grade.duracaoDias === null) {
    return null
  }

  return Math.max(1, Math.round((grade.duracaoDias * 24) / grade.frequenciaHoras))
}

/** O instante da última dose do tratamento. `null` no uso contínuo. */
export function ultimaDoseEm(grade: GradeDoTratamento): ISODateTime | null {
  const total = totalDeDoses(grade)

  if (total === null) {
    return null
  }

  return isoEm(
    ms(grade.inicioEm) + (total - 1) * grade.frequenciaHoras * HORA_MS,
    offsetDe(grade.inicioEm),
  )
}

/**
 * O tratamento ainda pede dose?
 *
 * Termina quando alguém o encerra ou quando o prazo de registro da última dose passa — até lá,
 * a última dose ainda pode ser marcada.
 */
export function emCurso(grade: GradeDoTratamento, agora: ISODateTime): boolean {
  if (grade.encerradoEm && ms(grade.encerradoEm) <= ms(agora)) {
    return false
  }

  const ultima = ultimaDoseEm(grade)

  return ultima === null || ms(ultima) + grade.frequenciaHoras * HORA_MS > ms(agora)
}

function situacaoSemRegistro(previsto: number, registravelAte: number, agora: number) {
  if (agora < previsto - ANTECEDENCIA_DO_REGISTRO_MIN * MINUTO_MS) {
    return 'prevista' as const
  }

  return agora < registravelAte ? ('aberta' as const) : ('sem-registro' as const)
}

/**
 * A grade de doses até `ate`, cada uma com a situação no instante `agora`.
 *
 * `ate` é separado de `agora` de propósito: o celular mostra as doses de hoje que ainda não
 * chegaram, e a ficha para no agora.
 */
export function dosesDoTratamento(
  tratamento: GradeDoTratamento & { id: string },
  registros: RegistroDeDose[],
  agora: ISODateTime,
  ate: ISODateTime,
): DoseNaGrade[] {
  const utcOffset = offsetDe(tratamento.inicioEm)
  const inicio = ms(tratamento.inicioEm)
  const passo = tratamento.frequenciaHoras * HORA_MS
  const total = totalDeDoses(tratamento)
  const limite = Math.min(
    ms(ate),
    tratamento.encerradoEm ? ms(tratamento.encerradoEm) - 1 : Number.POSITIVE_INFINITY,
  )
  const agoraMs = ms(agora)

  const porNumero = new Map(
    registros
      .filter((registro) => registro.tratamentoId === tratamento.id)
      .map((registro) => [registro.numero, registro]),
  )

  const doses: DoseNaGrade[] = []

  for (let indice = 0; total === null || indice < total; indice += 1) {
    const previsto = inicio + indice * passo

    if (previsto > limite || passo <= 0) {
      break
    }

    const registravelAte = previsto + passo
    const registro = porNumero.get(indice + 1) ?? null

    doses.push({
      numero: indice + 1,
      previstaEm: isoEm(previsto, utcOffset),
      registravelAte: isoEm(registravelAte, utcOffset),
      situacao: registro
        ? registro.situacao
        : situacaoSemRegistro(previsto, registravelAte, agoraMs),
      registro,
    })
  }

  return doses
}

// ---------------------------------------------------------------------------
// O resumo do período
// ---------------------------------------------------------------------------

export type ContagemDeMotivo = { motivo: MotivoDaDosePulada; vezes: number }

export type HorarioDaGrade = {
  horario: ClockTime
  dadas: number
  fechadas: number
}

export type ResumoDaAdesao = {
  desde: ISODateTime
  ate: ISODateTime
  dadas: number
  puladas: number
  semRegistro: number
  /** Ainda dá para registrar: não entra em conta nenhuma. */
  abertas: number
  /** Dadas, puladas e sem registro: as doses cujo prazo de registro já passou. */
  fechadas: number
  motivos: ContagemDeMotivo[]
  /** Quem registrou, e quantas vezes. Mais registros primeiro. */
  porCuidador: Array<{ cuidadorId: string; registros: number }>
  /**
   * Por horário do dia, quando a grade repete os mesmos horários todo dia (de 6 em 6, de 8 em 8,
   * de 12 em 12, uma vez por dia). Vazio nas outras frequências.
   */
  porHorario: HorarioDaGrade[]
}

function contarMotivos(doses: DoseNaGrade[]): ContagemDeMotivo[] {
  const vezes = new Map<MotivoDaDosePulada, number>()

  for (const dose of doses) {
    const motivo = dose.situacao === 'pulada' ? dose.registro?.motivo : null

    if (motivo) {
      vezes.set(motivo, (vezes.get(motivo) ?? 0) + 1)
    }
  }

  return MOTIVOS_DA_DOSE_PULADA.filter((motivo) => vezes.has(motivo))
    .map((motivo) => ({ motivo, vezes: vezes.get(motivo)! }))
    .sort((a, b) => b.vezes - a.vezes)
}

function horarioDe(iso: ISODateTime): ClockTime {
  return iso.slice(11, 16)
}

/** As doses cuja hora prevista cai dentro do período, com os extremos incluídos. */
export function dosesNoPeriodo(doses: DoseNaGrade[], desde: ISODateTime, ate: ISODateTime) {
  return doses.filter((dose) => ms(dose.previstaEm) >= ms(desde) && ms(dose.previstaEm) <= ms(ate))
}

export function resumirAdesao(
  doses: DoseNaGrade[],
  desde: ISODateTime,
  ate: ISODateTime,
  frequenciaHoras: number,
): ResumoDaAdesao {
  const doPeriodo = dosesNoPeriodo(doses, desde, ate)
  const contar = (situacao: SituacaoDaDose) =>
    doPeriodo.filter((dose) => dose.situacao === situacao).length

  const dadas = contar('dada')
  const puladas = contar('pulada')
  const semRegistro = contar('sem-registro')

  const porCuidador = new Map<string, number>()

  for (const dose of doPeriodo) {
    if (dose.registro) {
      porCuidador.set(
        dose.registro.cuidadorId,
        (porCuidador.get(dose.registro.cuidadorId) ?? 0) + 1,
      )
    }
  }

  const repete = frequenciaHoras > 0 && 24 % frequenciaHoras === 0
  const porHorario = new Map<ClockTime, HorarioDaGrade>()

  if (repete) {
    for (const dose of doPeriodo) {
      if (dose.situacao === 'aberta' || dose.situacao === 'prevista') {
        continue
      }

      const horario = horarioDe(dose.previstaEm)
      const atual = porHorario.get(horario) ?? { horario, dadas: 0, fechadas: 0 }

      atual.fechadas += 1
      atual.dadas += dose.situacao === 'dada' ? 1 : 0
      porHorario.set(horario, atual)
    }
  }

  return {
    desde,
    ate,
    dadas,
    puladas,
    semRegistro,
    abertas: contar('aberta'),
    fechadas: dadas + puladas + semRegistro,
    motivos: contarMotivos(doPeriodo),
    porCuidador: [...porCuidador.entries()]
      .map(([cuidadorId, registros]) => ({ cuidadorId, registros }))
      .sort((a, b) => b.registros - a.registros),
    porHorario: [...porHorario.values()].sort((a, b) => a.horario.localeCompare(b.horario)),
  }
}

/**
 * Abaixo disso, o horário "fica para trás"; os outros precisam estar acima do segundo número. Com
 * seis doses num horário, uma que falta já dá 83% — "regular" não pode exigir perfeição.
 */
const HORARIO_DESTOANTE_ATE = 0.6
const HORARIOS_REGULARES_DESDE = 0.8
const DOSES_MINIMAS_NO_HORARIO = 4

/**
 * O horário do dia que menos aparece como dado, quando ele destoa dos outros.
 *
 * É o achado que o vet procura numa grade de oito em oito horas: a dose da noite que ninguém
 * registra quase sempre é a que ninguém dá — e a conversa é mudar o horário, não cobrar a casa.
 */
export function horarioDestoante(resumo: ResumoDaAdesao): HorarioDaGrade | null {
  if (resumo.porHorario.length < 2) {
    return null
  }

  const taxa = (item: HorarioDaGrade) => (item.fechadas > 0 ? item.dadas / item.fechadas : 1)
  const candidatos = resumo.porHorario.filter(
    (item) => item.fechadas >= DOSES_MINIMAS_NO_HORARIO && taxa(item) <= HORARIO_DESTOANTE_ATE,
  )

  if (candidatos.length !== 1) {
    return null
  }

  const [destoante] = candidatos
  const outros = resumo.porHorario.filter((item) => item !== destoante)

  return outros.every((item) => taxa(item) >= HORARIOS_REGULARES_DESDE) ? destoante! : null
}

// ---------------------------------------------------------------------------
// O alerta da clínica
// ---------------------------------------------------------------------------

export type AlertaDeAdesao = {
  motivo: 'puladas' | 'queda'
  /** A primeira pulada da janela (porta das puladas) ou a primeira que não aparece como dada (queda). */
  desde: ISODateTime
  janela: { dadas: number; puladas: number; semRegistro: number; fechadas: number }
  motivos: ContagemDeMotivo[]
  /** O padrão de antes da janela, quando há o bastante para chamar de padrão. */
  antes: { dadas: number; fechadas: number } | null
}

export type TratamentoDoAlerta = GradeDoTratamento & {
  critico: boolean
  /** A última vez que a clínica falou com a casa sobre este tratamento. */
  contatoEm: ISODateTime | null
}

const FECHADA: SituacaoDaDose[] = ['dada', 'pulada', 'sem-registro']

/**
 * O alerta da clínica para um tratamento crítico, ou `null`.
 *
 * Duas portas, e as duas olham só para doses **fechadas** — a dose da vez ainda pode ser marcada:
 *
 * - **Puladas:** duas ou mais nas últimas 72 horas. É a casa dizendo que não deu, com o motivo
 *   — e "acabou" é o que a clínica resolve com uma receita nova.
 * - **Queda:** menos da metade dada nas últimas 72 horas, em quem dava ao menos 80% na semana
 *   anterior. É o silêncio de quem registrava tudo, e é o que merece uma ligação.
 *
 * Falar com a casa (`contatoEm`) apaga o alerta até a próxima dose que não aparecer como dada.
 */
export function alertaDeAdesao(
  tratamento: TratamentoDoAlerta,
  doses: DoseNaGrade[],
  agora: ISODateTime,
): AlertaDeAdesao | null {
  if (!tratamento.critico || !emCurso(tratamento, agora)) {
    return null
  }

  const agoraMs = ms(agora)
  const inicioDaJanela = agoraMs - JANELA_DO_ALERTA_HORAS * HORA_MS
  const inicioDaBase = inicioDaJanela - BASE_DO_ALERTA_DIAS * DIA_MS

  const fechadas = doses.filter((dose) => FECHADA.includes(dose.situacao))
  const naJanela = fechadas.filter(
    (dose) => ms(dose.previstaEm) >= inicioDaJanela && ms(dose.previstaEm) <= agoraMs,
  )
  const naBase = fechadas.filter(
    (dose) => ms(dose.previstaEm) >= inicioDaBase && ms(dose.previstaEm) < inicioDaJanela,
  )

  const naoDadas = naJanela.filter((dose) => dose.situacao !== 'dada')
  const dadas = naJanela.length - naoDadas.length
  const puladas = naJanela.filter((dose) => dose.situacao === 'pulada').length
  const semRegistro = naJanela.filter((dose) => dose.situacao === 'sem-registro').length
  const baseDadas = naBase.filter((dose) => dose.situacao === 'dada').length
  const temBase = naBase.length >= BASE_MINIMA_DE_DOSES

  let motivo: AlertaDeAdesao['motivo'] | null = null

  if (puladas >= PULADAS_PARA_ALERTA) {
    motivo = 'puladas'
  } else if (
    naJanela.length >= 2 &&
    dadas / naJanela.length < QUEDA_ABAIXO_DE &&
    temBase &&
    baseDadas / naBase.length >= BASE_ACIMA_DE
  ) {
    motivo = 'queda'
  }

  /*
   * "Desde quando" conta a partir do que o alerta afirma: na porta das puladas, a primeira pulada —
   * a noite sem registro antes dela não é pulada, e a frase diz "2 doses puladas desde…".
   */
  const primeira =
    motivo === 'puladas' ? naJanela.find((dose) => dose.situacao === 'pulada') : naoDadas[0]
  const ultima = naoDadas[naoDadas.length - 1]

  if (!motivo || !primeira || !ultima) {
    return null
  }

  /* A clínica já ligou depois da última dose que faltou: o assunto está com ela. */
  if (tratamento.contatoEm && ms(tratamento.contatoEm) >= ms(ultima.previstaEm)) {
    return null
  }

  return {
    motivo,
    desde: primeira.previstaEm,
    janela: { dadas, puladas, semRegistro, fechadas: naJanela.length },
    motivos: contarMotivos(naJanela),
    antes: temBase ? { dadas: baseDadas, fechadas: naBase.length } : null,
  }
}

// ---------------------------------------------------------------------------
// O primeiro horário
// ---------------------------------------------------------------------------

/** Quantas doses da grade diária caem na madrugada, começando neste minuto do dia. */
function dosesNaMadrugada(inicioMin: number, frequenciaHoras: number): number {
  const passo = frequenciaHoras * 60
  const porDia = Math.max(1, Math.round((24 * 60) / passo))
  let vezes = 0

  for (let dose = 0; dose < porDia; dose += 1) {
    const minuto = (inicioMin + dose * passo) % (24 * 60)

    if (minuto >= MADRUGADA.de && minuto < MADRUGADA.ate) {
      vezes += 1
    }
  }

  return vezes
}

/** Até quanto a sugestão pode adiar a primeira dose para poupar a madrugada. */
const ADIAMENTO_MAXIMO_HORAS = 8

/**
 * O horário que o app sugere para a primeira dose.
 *
 * A próxima hora cheia, **a menos que** esperar um pouco tire uma dose da madrugada: de 12 em 12
 * horas começando às 15h, a segunda cai às 3h, todo dia, por dez dias. Começando às 18h, cai às
 * 6h. A sugestão procura até oito horas à frente e fica com a que acorda menos gente — e, entre
 * as empatadas, com a mais cedo. De 6 em 6 horas não há como: uma das quatro cai na madrugada, e
 * a sugestão não finge que resolve.
 *
 * É sugestão. Quem cria o lembrete escolhe outro horário se quiser.
 */
export function sugerirPrimeiraDose(frequenciaHoras: number, agora: ISODateTime): ISODateTime {
  const utcOffset = offsetDe(agora)
  const proximaHoraCheia = Math.ceil(ms(agora) / HORA_MS) * HORA_MS
  let melhor = proximaHoraCheia
  let menosNaMadrugada = Number.POSITIVE_INFINITY

  for (let horas = 0; horas <= ADIAMENTO_MAXIMO_HORAS; horas += 1) {
    const candidato = proximaHoraCheia + horas * HORA_MS
    const minutoDoDia = epochToWall(candidato, utcOffset).minutes
    const naMadrugada = frequenciaHoras < 24 ? dosesNaMadrugada(minutoDoDia, frequenciaHoras) : 0

    if (naMadrugada < menosNaMadrugada && !(frequenciaHoras >= 24 && minutoDoDia < MADRUGADA.ate)) {
      melhor = candidato
      menosNaMadrugada = naMadrugada
    }

    if (menosNaMadrugada === 0) {
      break
    }
  }

  return isoEm(melhor, utcOffset)
}

// ---------------------------------------------------------------------------
// A janela da faixa
// ---------------------------------------------------------------------------

/** Seis semanas: cabe numa linha de cartão e mostra o ritmo. */
export const DIAS_DA_FAIXA = 42

/** Mais que três meses, a coluna afina demais para ser lida. */
export const DIAS_DA_FAIXA_MAX = 90

/**
 * Quantos dias a faixa da ficha mostra: seis semanas, ou o bastante para a última consulta caber
 * nela — é o fio da consulta que separa "antes" de "desde a última vez".
 *
 * As datas são lidas da própria string (`AAAA-MM-DD`), que vem no fuso da clínica.
 */
export function diasDaFaixa(ultimaConsultaEm: ISODateTime | null, hoje: ISODate): number {
  if (!ultimaConsultaEm) {
    return DIAS_DA_FAIXA
  }

  const desdeAConsulta = diffDays(ultimaConsultaEm.slice(0, 10), hoje) + 2

  return Math.min(DIAS_DA_FAIXA_MAX, Math.max(DIAS_DA_FAIXA, desdeAConsulta))
}

/**
 * A faixa desenha o fio da consulta? Só quando a consulta cai depois do primeiro dia visível: no
 * dia em que o tratamento começou, não há "antes" para separar. A tela só promete o fio quando ele
 * está lá.
 */
export function faixaMostraAConsulta(
  doses: DoseNaGrade[],
  ultimaConsultaEm: ISODateTime | null,
  dias: number,
): boolean {
  const primeira = doses[0]
  const ultima = doses[doses.length - 1]

  if (!ultimaConsultaEm || !primeira || !ultima) {
    return false
  }

  const fim = ultima.previstaEm.slice(0, 10)
  const inicio = [primeira.previstaEm.slice(0, 10), addDays(fim, -(dias - 1))].sort()[1]!
  const dia = ultimaConsultaEm.slice(0, 10)

  return dia > inicio && dia <= fim
}

/** `08:00`, `16:00`, `00:00` — os horários de um dia da grade, a partir do primeiro. */
export function horariosDoDia(inicioEm: ISODateTime, frequenciaHoras: number): ClockTime[] {
  if (frequenciaHoras <= 0 || 24 % frequenciaHoras !== 0) {
    return [horarioDe(inicioEm)]
  }

  const [hora, minuto] = horarioDe(inicioEm).split(':').map(Number)
  const inicioMin = (hora ?? 0) * 60 + (minuto ?? 0)

  return Array.from({ length: 24 / frequenciaHoras }, (_, dose) =>
    minutesToClock((inicioMin + dose * frequenciaHoras * 60) % (24 * 60)),
  )
}
