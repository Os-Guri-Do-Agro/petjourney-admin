/**
 * Regras da internação: aprazamento, plantão e boletim ao responsável.
 *
 * TypeScript puro, sem Vue e sem `Date` fora do relógio da clínica. Três decisões deste arquivo
 * carregam o requisito inteiro, e nenhuma delas é cosmética:
 *
 * 1. **Atraso é lido, nunca gravado.** A administração guarda o horário previsto e o executado;
 *    "atrasada" nasce da comparação com o relógio, a cada leitura.
 * 2. **A passagem de plantão tem dono.** Uma dose prevista para o minuto da troca não pertence a
 *    nenhum dos dois turnos por padrão — e é exatamente aí que ela some. Aqui ela é nomeada.
 * 3. **Piora não sai por aplicativo sozinha.** O boletim que traz notícia grave fica retido até
 *    alguém ligar. A regra mora no domínio, e não na tela, porque tela se contorna.
 */

import type {
  AdministracaoAgendada,
  BoletimAoTutor,
  GravidadeClinica,
  Internacao,
  ISODate,
  ISODateTime,
  Leito,
  LeitoKind,
  PlantaoKind,
  PrescricaoDeInternacao,
  SituacaoDaAdministracao,
} from '../data/types'

import { addDays, MINUTOS_POR_DIA, type ClinicClock } from './clinic-time'

// ---------------------------------------------------------------------------
// Aprazamento
// ---------------------------------------------------------------------------

/**
 * Tolerância de horário, em minutos, para os dois lados.
 *
 * Trinta minutos não é frouxidão: é o que separa "a enfermagem está trabalhando" de "a dose
 * falhou". Uma janela apertada demais pinta de vermelho um plantão inteiro que está indo bem, e
 * um checklist que vive vermelho é um checklist que ninguém mais lê — que é o desfecho pior.
 */
export const JANELA_TOLERANCIA_MINUTOS = 30

/**
 * Horizonte de materialização, em horas.
 *
 * A prescrição de internação quase nunca tem data de fim, e materializar horários "até segunda
 * ordem" é materializar até o fim dos tempos. Quarenta e oito horas cobrem o que o plantão de
 * hoje e o de amanhã precisam ver; o resto nasce quando a internação continuar.
 */
export const HORIZONTE_DE_APRAZAMENTO_HORAS = 48

/**
 * Os horários concretos de uma prescrição, do primeiro até o limite.
 *
 * Contínuo também produz horários, e isso é proposital: fluido em bomba não se administra de
 * 6 em 6 horas, mas **se confere**, e a conferência é o que prova que a bomba não parou às 3 da
 * manhã. Sem linha no checklist, ninguém olha.
 */
export function horariosDaPrescricao(
  prescricao: PrescricaoDeInternacao,
  ate: ISODateTime,
  clock: ClinicClock,
): ISODateTime[] {
  const passoHoras = Math.max(1, Math.round(prescricao.frequenciaHoras))
  const limite = Math.min(Date.parse(prescricao.encerraEm ?? ate), Date.parse(ate))

  const referencia = clock.dateOf(prescricao.primeiroHorario)
  const inicioMin = clock.minutesFrom(prescricao.primeiroHorario, referencia)
  const horarios: ISODateTime[] = []

  for (let passo = 0; passo < 512; passo += 1) {
    const minutos = inicioMin + passo * passoHoras * 60
    const iso = clock.toIso(referencia, minutos)

    if (Date.parse(iso) > limite) {
      break
    }

    horarios.push(iso)
  }

  return horarios
}

/**
 * Situação de uma administração agora.
 *
 * O que já foi resolvido responde por si — dado é dado, e o relógio não o desfaz. O que segue
 * pendente é julgado contra a janela: dentro dela é hora de fazer, depois dela é atraso, antes
 * dela ainda nem chegou. É esta função que pinta o checklist.
 */
export function situacaoDaAdministracao(
  administracao: AdministracaoAgendada,
  agora: ISODateTime,
): SituacaoDaAdministracao {
  if (administracao.status !== 'pendente') {
    return administracao.status
  }

  const diferencaMinutos = (Date.parse(agora) - Date.parse(administracao.previstaPara)) / 60_000

  if (diferencaMinutos < -JANELA_TOLERANCIA_MINUTOS) {
    return 'futura'
  }

  return diferencaMinutos > JANELA_TOLERANCIA_MINUTOS ? 'atrasada' : 'na-janela'
}

/** Minutos de atraso de uma pendência. Zero para o que ainda está na janela ou já foi resolvido. */
export function atrasoEmMinutos(administracao: AdministracaoAgendada, agora: ISODateTime): number {
  if (situacaoDaAdministracao(administracao, agora) !== 'atrasada') {
    return 0
  }

  return Math.round((Date.parse(agora) - Date.parse(administracao.previstaPara)) / 60_000)
}

/** As situações que cobram ação de quem está de plantão — o contador do topo da tela. */
const COBRAM_ACAO = new Set<SituacaoDaAdministracao>(['na-janela', 'atrasada'])

export function pendentesAgora(
  administracoes: AdministracaoAgendada[],
  agora: ISODateTime,
): AdministracaoAgendada[] {
  return administracoes
    .filter((item) => COBRAM_ACAO.has(situacaoDaAdministracao(item, agora)))
    .sort((a, b) => a.previstaPara.localeCompare(b.previstaPara))
}

// ---------------------------------------------------------------------------
// Plantão
// ---------------------------------------------------------------------------

/**
 * As três janelas do dia, em minutos desde a meia-noite da parede da clínica.
 *
 * A noite atravessa o dia — 19h de hoje às 7h de amanhã — e é por isso que o plantão é
 * identificado pelo dia em que **começa**, não pelo dia em que o relógio está. Sem essa
 * distinção, a evolução das 2 da manhã cairia num turno que ainda não existe.
 */
export const JANELAS_DE_PLANTAO: Record<PlantaoKind, { inicioMin: number; fimMin: number }> = {
  manha: { inicioMin: 7 * 60, fimMin: 13 * 60 },
  tarde: { inicioMin: 13 * 60, fimMin: 19 * 60 },
  noite: { inicioMin: 19 * 60, fimMin: 31 * 60 },
}

export const ORDEM_DOS_PLANTOES: PlantaoKind[] = ['manha', 'tarde', 'noite']

/** O plantão a que um instante pertence, com o dia em que esse plantão começou. */
export function plantaoDe(
  iso: ISODateTime,
  clock: ClinicClock,
): { kind: PlantaoKind; data: ISODate } {
  const data = clock.dateOf(iso)
  const minutos = clock.minutesOf(iso)

  if (minutos < JANELAS_DE_PLANTAO.manha.inicioMin) {
    /* Madrugada pertence à noite que começou ontem. */
    return { kind: 'noite', data: addDays(data, -1) }
  }

  if (minutos < JANELAS_DE_PLANTAO.tarde.inicioMin) {
    return { kind: 'manha', data }
  }

  return minutos < JANELAS_DE_PLANTAO.noite.inicioMin
    ? { kind: 'tarde', data }
    : { kind: 'noite', data }
}

export function limitesDoPlantao(
  kind: PlantaoKind,
  data: ISODate,
  clock: ClinicClock,
): { inicio: ISODateTime; fim: ISODateTime } {
  const janela = JANELAS_DE_PLANTAO[kind]

  return {
    inicio: clock.toIso(data, janela.inicioMin),
    fim: clock.toIso(data, janela.fimMin),
  }
}

/** Identificador estável de um plantão: mesma data e mesmo turno geram sempre o mesmo id. */
export function idDoPlantao(kind: PlantaoKind, data: ISODate): string {
  return `plantao-${data}-${kind}`
}

export function plantaoSeguinte(
  kind: PlantaoKind,
  data: ISODate,
): { kind: PlantaoKind; data: ISODate } {
  const indice = ORDEM_DOS_PLANTOES.indexOf(kind)

  return indice === ORDEM_DOS_PLANTOES.length - 1
    ? { kind: 'manha', data: addDays(data, 1) }
    : { kind: ORDEM_DOS_PLANTOES[indice + 1]!, data }
}

export function plantaoAnterior(
  kind: PlantaoKind,
  data: ISODate,
): { kind: PlantaoKind; data: ISODate } {
  const indice = ORDEM_DOS_PLANTOES.indexOf(kind)

  return indice === 0
    ? { kind: 'noite', data: addDays(data, -1) }
    : { kind: ORDEM_DOS_PLANTOES[indice - 1]!, data }
}

/** O que está previsto para dentro da janela de um plantão. */
export function administracoesDoPlantao(
  administracoes: AdministracaoAgendada[],
  kind: PlantaoKind,
  data: ISODate,
  clock: ClinicClock,
): AdministracaoAgendada[] {
  const { inicio, fim } = limitesDoPlantao(kind, data, clock)

  return administracoes
    .filter((item) => item.previstaPara >= inicio && item.previstaPara < fim)
    .sort((a, b) => a.previstaPara.localeCompare(b.previstaPara))
}

/**
 * A dose que cai **em cima** da troca de turno.
 *
 * O caso difícil do requisito, e o mais banal de todos na vida real: a medicação das 19h com a
 * passagem às 19h. Quem sai acha que quem entra vai dar; quem entra acha que já foi dada. Ela
 * não é de ninguém, e some.
 *
 * A definição aqui é deliberadamente estreita — a janela de tolerância encavalando o instante da
 * troca — porque marcar meia tarde como "em cima da passagem" devolveria o mesmo silêncio por
 * excesso de aviso.
 */
export function atravessaAPassagem(
  administracao: AdministracaoAgendada,
  fimDoPlantao: ISODateTime,
): boolean {
  if (administracao.status !== 'pendente') {
    return false
  }

  const distanciaMinutos =
    Math.abs(Date.parse(administracao.previstaPara) - Date.parse(fimDoPlantao)) / 60_000

  return distanciaMinutos <= JANELA_TOLERANCIA_MINUTOS
}

/**
 * O que o plantão precisa resolver ou entregar antes de sair.
 *
 * `emCimaDaTroca` sai separado do resto porque a conversa é outra: pendência comum quem sai
 * explica, pendência em cima da troca quem sai e quem entra **decidem juntos** — e a tela só
 * consegue cobrar essa decisão se souber quais são.
 */
export type PendenciasDaPassagem = {
  atrasadas: AdministracaoAgendada[]
  emCimaDaTroca: AdministracaoAgendada[]
  /** Internações sem evolução registrada no turno — a outra metade do que se perde na troca. */
  semEvolucao: string[]
}

export function pendenciasDaPassagem(input: {
  administracoes: AdministracaoAgendada[]
  kind: PlantaoKind
  data: ISODate
  clock: ClinicClock
  agora: ISODateTime
  internacoesAbertas: string[]
  internacoesComEvolucaoNoTurno: string[]
}): PendenciasDaPassagem {
  const { fim } = limitesDoPlantao(input.kind, input.data, input.clock)
  const doTurno = administracoesDoPlantao(input.administracoes, input.kind, input.data, input.clock)
  const registradas = new Set(input.internacoesComEvolucaoNoTurno)

  /*
   * A dose em cima da troca pode estar prevista para depois do fim da janela — e por isso ela é
   * buscada no conjunto inteiro, não só no do turno. Uma pendência que só aparece para quem
   * entra é uma pendência que quem sai nunca vai explicar.
   */
  const emCimaDaTroca = input.administracoes.filter((item) => atravessaAPassagem(item, fim))
  const naTroca = new Set(emCimaDaTroca.map((item) => item.id))

  return {
    atrasadas: doTurno.filter(
      (item) => !naTroca.has(item.id) && situacaoDaAdministracao(item, input.agora) === 'atrasada',
    ),
    emCimaDaTroca,
    semEvolucao: input.internacoesAbertas.filter((id) => !registradas.has(id)),
  }
}

// ---------------------------------------------------------------------------
// Ocupação
// ---------------------------------------------------------------------------

export type OcupacaoDoLeito = {
  leito: Leito
  internacao: Internacao | null
}

/**
 * O mapa de leitos, na ordem em que a clínica o lê.
 *
 * Ordena por leito, não por paciente, e essa é a diferença entre um mapa e uma lista: a pergunta
 * que o mapa responde é "onde há vaga e quem está onde", e ela exige que o leito vazio ocupe
 * espaço na tela. Uma lista de internados esconde exatamente a informação que falta.
 */
export function mapaDeLeitos(leitos: Leito[], internacoes: Internacao[]): OcupacaoDoLeito[] {
  const abertas = internacoes.filter((item) => item.status === 'internado')

  return leitos.map((leito) => ({
    leito,
    internacao: abertas.find((item) => item.leitoId === leito.id) ?? null,
  }))
}

/**
 * O que impede uma mudança no cadastro de leitos. `null` quando a mudança pode acontecer.
 *
 * Devolve o motivo, e não um booleano, porque a tela precisa **dizer por que não** — um botão
 * desabilitado sem explicação é lido como defeito, e defeito se contorna por outro caminho.
 */
export type ImpedimentoDeLeito = 'ocupado' | 'tem-historico' | 'nome-repetido' | 'sem-nome' | null

/**
 * Tirar de operação um leito ocupado é dizer que o animal que está nele não está.
 *
 * A clínica precisa transferir ou dar alta primeiro. É a única trava desta tela, e ela existe
 * porque o contrário produz um mapa que mostra vaga onde há paciente.
 */
export function impedimentoParaDesativar(
  leito: Leito,
  internacoes: Internacao[],
): ImpedimentoDeLeito {
  const ocupado = internacoes.some(
    (item) => item.leitoId === leito.id && item.status === 'internado',
  )

  return ocupado ? 'ocupado' : null
}

/**
 * Leito com história **não se apaga**.
 *
 * Toda internação guarda o `leitoId`, e o registro de onde o animal ficou é o que responde a
 * pergunta da fiscalização e a da própria clínica seis meses depois. Um leito que já recebeu
 * alguém sai de operação e permanece no cadastro; some do mapa apenas o que nunca foi usado —
 * o leito cadastrado por engano.
 */
export function impedimentoParaRemover(
  leito: Leito,
  internacoes: Internacao[],
): ImpedimentoDeLeito {
  if (internacoes.some((item) => item.leitoId === leito.id && item.status === 'internado')) {
    return 'ocupado'
  }

  return internacoes.some((item) => item.leitoId === leito.id) ? 'tem-historico' : null
}

/**
 * Nome de leito é endereço: "põe na R3" só funciona se existir uma R3 e nenhuma outra.
 *
 * A comparação ignora caixa e espaços das pontas porque "r3" e "R3 " são o mesmo lugar para quem
 * digita com pressa — e duas linhas iguais no mapa valem menos que nenhuma.
 */
export function impedimentoParaNomear(
  nome: string,
  leitos: Leito[],
  ignorarId?: string,
): ImpedimentoDeLeito {
  const limpo = nome.trim()

  if (limpo.length === 0) {
    return 'sem-nome'
  }

  const repetido = leitos.some(
    (item) => item.id !== ignorarId && item.nome.trim().toLowerCase() === limpo.toLowerCase(),
  )

  return repetido ? 'nome-repetido' : null
}

/**
 * Sugestão de nome para o próximo leito de um tipo.
 *
 * Cadastrar leito é tarefa repetitiva de dia de mudança — seis de uma vez —, e obrigar a inventar
 * nome a cada um é o que faz a clínica largar pela metade. A sugestão segue a numeração que já
 * existe: onde há R1 e R2, o próximo é R3.
 */
const PREFIXO_POR_KIND: Record<LeitoKind, string> = {
  geral: 'R',
  felino: 'F',
  isolamento: 'I',
  uti: 'UTI',
}

export function proximoNomeDeLeito(leitos: Leito[], kind: LeitoKind): string {
  const prefixo = PREFIXO_POR_KIND[kind]
  const usados = new Set(leitos.map((item) => item.nome.trim().toLowerCase()))

  for (let numero = 1; numero <= 99; numero += 1) {
    /* O primeiro da UTI se chama "UTI"; a partir do segundo, "UTI 2". */
    const candidato =
      kind === 'uti' && numero === 1 ? prefixo : `${prefixo}${kind === 'uti' ? ' ' : ''}${numero}`

    if (!usados.has(candidato.toLowerCase())) {
      return candidato
    }
  }

  return prefixo
}

/** Fração 0..1 dos leitos ativos que estão ocupados. */
export function taxaDeOcupacao(leitos: Leito[], internacoes: Internacao[]): number {
  const ativos = leitos.filter((leito) => leito.ativo)

  if (ativos.length === 0) {
    return 0
  }

  const ocupados = mapaDeLeitos(ativos, internacoes).filter((item) => item.internacao).length

  return ocupados / ativos.length
}

/** Horas completas desde a entrada — é como a clínica conta internação, e como o app mostra. */
export function horasInternado(internacao: Internacao, agora: ISODateTime): number {
  const fim = internacao.altaEm ?? agora

  return Math.max(0, Math.floor((Date.parse(fim) - Date.parse(internacao.entradaEm)) / 3_600_000))
}

// ---------------------------------------------------------------------------
// Boletim ao responsável
// ---------------------------------------------------------------------------

const PESO_DA_GRAVIDADE: Record<GravidadeClinica, number> = {
  estavel: 0,
  atencao: 1,
  critico: 2,
}

export function piorou(anterior: GravidadeClinica, atual: GravidadeClinica): boolean {
  return PESO_DA_GRAVIDADE[atual] > PESO_DA_GRAVIDADE[anterior]
}

/**
 * O boletim precisa de uma ligação antes de sair?
 *
 * **A regra central do requisito.** Notícia ruim não chega por notificação: o responsável está no
 * trabalho, abre o celular e lê que o animal piorou, sem ninguém para perguntar o que isso
 * significa. O que era diferencial vira a pior lembrança que ele tem da clínica.
 *
 * Duas situações cobram voz humana antes:
 *
 * - **Piorou** desde o último boletim — de estável para atenção, de atenção para crítico.
 * - **Entrou crítico** e este é o primeiro boletim (`anterior` nulo). Sem esta cláusula, o animal
 *   que chega grave às 2 da manhã teria a primeira notícia dada por push.
 *
 * Seguir crítico sem piorar **não** cobra ligação nova a cada boletim: a conversa já aconteceu, e
 * exigi-la de hora em hora faria a clínica desligar os boletins do paciente que mais precisa
 * deles — que é como uma regra de segurança produz o dano que queria evitar.
 */
export function exigeLigacaoAntes(
  anterior: GravidadeClinica | null,
  atual: GravidadeClinica,
): boolean {
  if (anterior === null) {
    return atual === 'critico'
  }

  return piorou(anterior, atual)
}

/** Motivo pelo qual um boletim não pode ser enviado agora. `null` quando pode. */
export type ImpedimentoDeEnvio = 'ja-enviado' | 'ligacao-pendente' | null

export function impedimentoDeEnvio(boletim: BoletimAoTutor): ImpedimentoDeEnvio {
  if (boletim.status === 'enviado') {
    return 'ja-enviado'
  }

  return boletim.exigeLigacao && !boletim.ligacaoEm ? 'ligacao-pendente' : null
}

export function podeEnviar(boletim: BoletimAoTutor): boolean {
  return impedimentoDeEnvio(boletim) === null
}

/**
 * Faixa de silêncio noturno: 22h às 7h.
 *
 * O boletim de hora em hora é um pedido legítimo, e ainda assim ninguém quer ser acordado às 3
 * da manhã para saber que o animal dorme. O silêncio acumula e entrega ao amanhecer — **exceto**
 * quando há piora, que é o único caso em que acordar é o certo.
 */
export const SILENCIO_INICIO_MIN = 22 * 60
export const SILENCIO_FIM_MIN = 7 * 60

export function dentroDoSilencioNoturno(iso: ISODateTime, clock: ClinicClock): boolean {
  const minutos = clock.minutesOf(iso)

  return minutos >= SILENCIO_INICIO_MIN || minutos < SILENCIO_FIM_MIN
}

/**
 * Quando sai o próximo boletim automático.
 *
 * Adia para as 7h quando o horário calculado cai no silêncio noturno e a preferência o pede. Não
 * pula o boletim: **junta**. Pular deixaria um buraco de nove horas sem notícia; juntar entrega o
 * mesmo conteúdo na hora em que ele pode ser lido.
 */
export function proximoBoletimEm(input: {
  frequenciaHoras: number
  silencioNoturno: boolean
  desde: ISODateTime
  clock: ClinicClock
}): ISODateTime {
  const { clock } = input
  const referencia = clock.dateOf(input.desde)
  const previsto = clock.toIso(
    referencia,
    clock.minutesFrom(input.desde, referencia) + input.frequenciaHoras * 60,
  )

  if (!input.silencioNoturno || !dentroDoSilencioNoturno(previsto, clock)) {
    return previsto
  }

  /* Cai na madrugada: sai às 7h do dia em que essa madrugada termina. */
  const data = clock.dateOf(previsto)
  const minutos = clock.minutesOf(previsto)

  return clock.toIso(minutos >= SILENCIO_INICIO_MIN ? addDays(data, 1) : data, SILENCIO_FIM_MIN)
}

/**
 * Quantos boletins uma frequência produz por dia.
 *
 * A tela mostra este número ao lado da escolha porque "de hora em hora" soa inofensivo até
 * alguém ver que são vinte e quatro mensagens — e é o responsável, não a clínica, quem deve
 * tomar esse susto antes de confirmar.
 */
export function boletinsPorDia(frequenciaHoras: number, silencioNoturno: boolean): number {
  const cheio = Math.floor(MINUTOS_POR_DIA / 60 / Math.max(1, frequenciaHoras))

  if (!silencioNoturno) {
    return cheio
  }

  const horasDeSilencio = (MINUTOS_POR_DIA - SILENCIO_INICIO_MIN + SILENCIO_FIM_MIN) / 60

  return Math.max(1, Math.floor((24 - horasDeSilencio) / Math.max(1, frequenciaHoras)) + 1)
}

/**
 * Os fatos que compõem um boletim, sem uma palavra de texto.
 *
 * O texto é montado na apresentação, com i18n, e **congelado** no boletim ao ser enviado — pela
 * mesma razão que a receita congela a conduta: o que o responsável recebeu no celular às 14h não
 * pode mudar porque o plantão editou a evolução às 16h.
 */
export type FatosDoBoletim = {
  gravidade: GravidadeClinica
  horasInternado: number
  /** Administrações concluídas desde o boletim anterior. */
  administracoesFeitas: number
  administracoesPrevistas: number
  /** Última leitura de temperatura, quando houve. */
  temperatura: number | null
  comeu: boolean | null
  observado: string
  exigeLigacao: boolean
}

// ---------------------------------------------------------------------------
// Alta
// ---------------------------------------------------------------------------

/**
 * Como a internação termina.
 *
 * São três, e não dois, porque "transferido" não é alta nem óbito: o animal saiu vivo e o caso
 * **continua** em outro lugar. Somá-lo à alta faria a clínica ler como sucesso um encaminhamento
 * para um centro de referência às três da manhã, e somá-lo ao óbito seria pior ainda.
 */
export type DesfechoDaInternacao = Extract<Internacao['status'], 'alta' | 'obito' | 'transferido'>

/** Na ordem em que a tela os oferece: o esperado primeiro, o grave por último. */
export const DESFECHOS: DesfechoDaInternacao[] = ['alta', 'transferido', 'obito']

/**
 * O desfecho pode ser contado ao responsável por mensagem?
 *
 * Só a alta. É a **mesma regra do boletim de piora**, aplicada ao fim da internação: notícia
 * grave não chega por notificação. Óbito e transferência exigem uma voz humana antes — e quem
 * recebe a notícia de que o animal morreu por push não volta a essa clínica, mesmo que tudo o
 * que se fez antes disso tenha sido impecável.
 *
 * A regra é do repositório, e não da tela. Se vivesse na tela, bastaria outra tela — ou uma rota
 * de API amanhã — para o óbito escapar por notificação.
 */
export function saiPorMensagem(desfecho: DesfechoDaInternacao): boolean {
  return desfecho === 'alta'
}

/**
 * O que a internação deixa para trás no instante da alta.
 *
 * Números, e não uma lista: quem está fechando a internação já viu o checklist. O que ele
 * precisa aqui é a conferência de última hora — "ficou alguma coisa?" — antes de um registro que
 * não se desfaz.
 */
export type ResumoDaAlta = {
  horas: number
  /** Doses concluídas durante a internação inteira. */
  feitas: number
  /** Recusadas e puladas: o que não entrou no animal, e a alta não apaga. */
  naoFeitas: number
  /** Pendentes agora — o que está na janela ou atrasado **neste minuto**. */
  pendentesAgora: number
  /** Pendentes no futuro: serão suspensas pela alta, e a tela diz quantas antes de confirmar. */
  aSuspender: number
  /** Boletins que nunca saíram porque a ligação não foi registrada. */
  boletinsRetidos: number
  /** Boletins efetivamente entregues ao responsável durante a internação. */
  boletinsEnviados: number
}

export function resumirAlta(input: {
  internacao: Internacao
  administracoes: AdministracaoAgendada[]
  boletins: BoletimAoTutor[]
  agora: ISODateTime
}): ResumoDaAlta {
  const doPaciente = input.administracoes.filter(
    (item) => item.internacaoId === input.internacao.id,
  )

  const pendentes = doPaciente.filter((item) => item.status === 'pendente')

  return {
    horas: horasInternado(input.internacao, input.agora),
    feitas: doPaciente.filter((item) => item.status === 'feita').length,
    naoFeitas: doPaciente.filter((item) => item.status === 'recusada' || item.status === 'pulada')
      .length,
    pendentesAgora: pendentesAgora(pendentes, input.agora).length,
    /*
     * "A suspender" é o que sobra depois de tirar o que já cobra ação agora — as duas contas
     * somadas dariam a mesma dose duas vezes, e a tela diria "1 pendente e 1 a suspender" sobre
     * uma dose só.
     */
    aSuspender: pendentes.length - pendentesAgora(pendentes, input.agora).length,
    boletinsRetidos: input.boletins.filter((item) => item.status === 'retido').length,
    boletinsEnviados: input.boletins.filter((item) => item.status === 'enviado').length,
  }
}

/**
 * O que a tela precisa dizer em voz alta antes de a alta ser confirmada.
 *
 * São **avisos, e nunca travas**. A tentação de bloquear é grande e está errada: um animal pode
 * ir para casa com a dose das 18h por dar — o responsável leva o comprimido no bolso — e um
 * óbito acontece com um boletim retido na fila. Travar a alta nesses casos não faz a clínica
 * resolver a pendência; faz o animal sair pela porta enquanto o sistema segue dizendo que ele
 * está no leito R3, e é assim que o mapa de leitos deixa de ser confiável.
 *
 * Trava, aqui, existe uma só, e é a do desfecho grave que não pode sair por mensagem.
 */
export type AvisoDeAlta = 'dose-pendente' | 'dose-futura' | 'boletim-retido'

export function avisosDaAlta(resumo: ResumoDaAlta): AvisoDeAlta[] {
  const avisos: AvisoDeAlta[] = []

  if (resumo.pendentesAgora > 0) {
    avisos.push('dose-pendente')
  }

  if (resumo.aSuspender > 0) {
    avisos.push('dose-futura')
  }

  if (resumo.boletinsRetidos > 0) {
    avisos.push('boletim-retido')
  }

  return avisos
}
