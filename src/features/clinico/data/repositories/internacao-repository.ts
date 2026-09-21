/**
 * Repositório da internação.
 *
 * É aqui que mora a regra que dá nome ao requisito, e ela mora aqui **de propósito**: quando a
 * gravidade piora, o boletim nasce retido e não sai até alguém ligar. Se isso vivesse na tela,
 * bastaria outra tela — ou uma rota de API amanhã — para a notícia grave escapar por push. Regra
 * de comunicação com o responsável é regra de servidor.
 *
 * O texto do boletim é montado aqui, em português, e não na apresentação. Parece contradizer a
 * disciplina do módulo (`kind` viaja, texto se traduz), e não contradiz: o boletim **não é
 * interface**, é uma mensagem endereçada ao responsável, escrita no idioma dele e congelada no
 * envio — como a receita congela a conduta. O idioma da tela da clínica não tem nada a ver com o
 * idioma em que a Rita lê que o gato dela piorou.
 */

import {
  exigeLigacaoAntes,
  horariosDaPrescricao,
  horasInternado,
  HORIZONTE_DE_APRAZAMENTO_HORAS,
  idDoPlantao,
  limitesDoPlantao,
  impedimentoParaDesativar,
  impedimentoParaNomear,
  impedimentoParaRemover,
  mapaDeLeitos,
  pendenciasDaPassagem,
  plantaoDe,
  plantaoSeguinte,
  saiPorMensagem,
  situacaoDaAdministracao,
  taxaDeOcupacao,
  type DesfechoDaInternacao,
  type ImpedimentoDeLeito,
  type OcupacaoDoLeito,
} from '../../domain/internacao'
import { createClinicClock, diffDays } from '../../domain/clinic-time'
import {
  montarModelos,
  montarTextoDeAlta,
  montarTextoDoBoletim,
  type ModeloDeBoletim,
} from '../boletim-texto'
import { CLINIC_UTC_OFFSET } from '../fixtures'
import { simularChamada } from '../mock-runtime'
import { agoraIso, getDataset, novoId } from '../store'
import type {
  AdministracaoAgendada,
  AdministracaoStatus,
  BoletimAoTutor,
  EvolucaoDeInternacao,
  GravidadeClinica,
  Internacao,
  ISODateTime,
  Leito,
  LeitoInativoMotivo,
  LeitoKind,
  Measurement,
  Plantao,
  PreferenciaDeBoletim,
  PrescricaoDeInternacao,
  VitalKey,
} from '../types'

const clock = createClinicClock(CLINIC_UTC_OFFSET)

function base() {
  return getDataset().internacao
}

function maisHoras(iso: ISODateTime, horas: number): ISODateTime {
  const data = clock.dateOf(iso)

  return clock.toIso(data, clock.minutesFrom(iso, data) + Math.round(horas * 60))
}

// ---------------------------------------------------------------------------
// Envelopes de leitura
// ---------------------------------------------------------------------------

/** Uma linha do mapa, já com paciente e responsável resolvidos para a tela não buscar de novo. */
export type LeitoNoMapa = OcupacaoDoLeito & {
  petNome: string
  petIniciais: string
  tutorNome: string
  /** Pendências que cobram ação agora — é o número que decide a cor do cartão. */
  pendentes: number
  atrasadas: number
  /**
   * Este paciente tem boletim preso esperando ligação.
   *
   * O mapa já contava os retidos num total no topo da página — "1 boletim retido" —, e esse
   * total não dizia **de quem**. Achar o paciente custava abrir os cinco internados um a um,
   * exatamente a busca que o boletim retido não tem tempo de esperar.
   */
  boletimRetido: boolean
  /** Minutos até a próxima administração prevista. `null` quando não há nenhuma à frente. */
  proximaEmMinutos: number | null
  horasInternado: number
}

export type MapaDeInternacao = {
  leitos: LeitoNoMapa[]
  ocupacao: number
  ativos: number
  ocupados: number
  criticos: number
  /** Boletins retidos esperando ligação — o contador que não pode ser ignorado. */
  boletinsRetidos: number
  plantaoAtual: Plantao | null
}

export type PacienteInternado = {
  internacao: Internacao
  prescricoes: PrescricaoDeInternacao[]
  administracoes: AdministracaoAgendada[]
  evolucoes: EvolucaoDeInternacao[]
  boletins: BoletimAoTutor[]
  preferencia: PreferenciaDeBoletim
  leito: Leito | null
  /**
   * Os plantões conhecidos, para a evolução conseguir se nomear.
   *
   * Sem eles, a evolução de ontem à noite apareceria com o turno em branco: o registro guarda o
   * id do plantão, e um id sozinho não diz "noite" a ninguém.
   */
  plantoes: Plantao[]
}

/**
 * Uma pendência da passagem, já com paciente, leito e **o que é a dose**.
 *
 * A tela mostrava só o nome do paciente, e duas vezes — o mesmo dado no lugar da descrição e no
 * lugar do paciente, produzindo "Tofu · UTI · Tofu · UTI". O que falta a quem passa o turno não é
 * saber de quem é a dose: é saber **qual** é, para decidir quem dá.
 */
export type PendenciaDaPassagem = {
  administracao: AdministracaoAgendada
  internacaoId: string
  petNome: string
  leitoNome: string
  /** O item prescrito, como a enfermagem o lê no checklist. */
  descricao: string
}

export type PacienteSemEvolucao = {
  internacaoId: string
  petNome: string
  leitoNome: string
}

export type PassagemDePlantao = {
  plantao: Plantao
  seguinte: { kind: Plantao['kind']; data: string; responsavelId: string }
  pendencias: {
    atrasadas: PendenciaDaPassagem[]
    emCimaDaTroca: PendenciaDaPassagem[]
    semEvolucao: PacienteSemEvolucao[]
  }
}

export class BoletimBloqueadoError extends Error {
  constructor() {
    super('[mock] boletim exige ligação antes do envio')
    this.name = 'BoletimBloqueadoError'
  }
}

/**
 * Mudança de cadastro recusada, com o motivo legível.
 *
 * O `kind` viaja e a tela traduz — mesma disciplina do resto do módulo. Sem ele, a interface só
 * saberia dizer "não deu", e "não deu" numa tela de configuração faz a clínica tentar de novo
 * exatamente do mesmo jeito.
 */
export class LeitoRecusadoError extends Error {
  readonly kind: Exclude<ImpedimentoDeLeito, null>

  constructor(kind: Exclude<ImpedimentoDeLeito, null>) {
    super(`[mock] mudança de leito recusada: ${kind}`)
    this.name = 'LeitoRecusadoError'
    this.kind = kind
  }
}

export class LeitoOcupadoError extends Error {
  constructor(leitoId: string) {
    super(`[mock] leito ${leitoId} indisponível`)
    this.name = 'LeitoOcupadoError'
  }
}

/**
 * Encerramento grave sem ligação registrada.
 *
 * Óbito e transferência não podem ser fechados enquanto ninguém tiver falado com o responsável.
 * É a **mesma regra do boletim de piora**, no outro extremo da internação: notícia grave não
 * chega por aplicativo, e o responsável que descobre a morte do animal por notificação não volta
 * a essa clínica — mesmo que tudo o que se fez antes disso tenha sido impecável.
 *
 * Mora aqui, e não na tela, pelo mesmo motivo de sempre: tela se contorna, e uma rota de API
 * amanhã contornaria sozinha.
 */
export class AltaSemAvisoError extends Error {
  readonly desfecho: 'obito' | 'transferido'

  constructor(desfecho: 'obito' | 'transferido') {
    super(`[mock] ${desfecho} exige ligação ao responsável antes do encerramento`)
    this.name = 'AltaSemAvisoError'
    this.desfecho = desfecho
  }
}

function ultimoBoletim(internacaoId: string): BoletimAoTutor | null {
  const doPaciente = base()
    .boletins.filter((item) => item.internacaoId === internacaoId)
    .sort((a, b) => a.geradoEm.localeCompare(b.geradoEm))

  return doPaciente[doPaciente.length - 1] ?? null
}

/**
 * Os dados do paciente que todo texto de boletim usa, reunidos uma vez só.
 *
 * O boletim composto e os modelos prontos precisam exatamente dos mesmos números — quantas
 * medicações do período saíram no horário, quanto tempo o animal está internado —, e duas
 * contagens separadas divergiriam no primeiro ajuste de janela. O que muda entre os dois é o que
 * se escreve com eles, não o que eles são.
 */
function fatosDoPaciente(internacao: Internacao) {
  const dataset = base()
  const agora = agoraIso()
  const anterior = ultimoBoletim(internacao.id)

  /* O período é desde o último boletim; no primeiro, desde a entrada. */
  const desde = anterior?.geradoEm ?? internacao.entradaEm
  const doPeriodo = dataset.administracoes.filter(
    (item) =>
      item.internacaoId === internacao.id &&
      item.previstaPara >= desde &&
      item.previstaPara <= agora,
  )

  return {
    agora,
    anterior,
    petNome: getDataset().pets.find((pet) => pet.id === internacao.petId)?.nome ?? 'Seu pet',
    feitas: doPeriodo.filter((item) => item.status === 'feita').length,
    previstas: doPeriodo.length,
    diasInternado: Math.max(0, diffDays(clock.dateOf(internacao.entradaEm), clock.dateOf(agora))),
  }
}

/**
 * A última temperatura aferida deste paciente.
 *
 * Sai da evolução mais recente, e não de um campo da internação: temperatura é medida, tem hora,
 * e a que interessa ao boletim é a de agora há pouco. `null` quando ninguém aferiu ainda — e
 * nesse caso o texto simplesmente não fala de temperatura, em vez de inventar um valor.
 */
function ultimaTemperatura(internacaoId: string): number | null {
  const evolucoes = base()
    .evolucoes.filter((item) => item.internacaoId === internacaoId)
    .sort((a, b) => a.registradoEm.localeCompare(b.registradoEm))

  return evolucoes[evolucoes.length - 1]?.vitais.temperatura?.valor ?? null
}

/**
 * Compõe um boletim e decide, sozinho, se ele pode sair.
 *
 * O `status` nasce de `exigeLigacaoAntes` — não de um parâmetro. Deixar quem chama escolher se o
 * boletim é retido devolveria a regra para a tela pela porta dos fundos.
 */
function comporBoletim(input: {
  internacao: Internacao
  origem: BoletimAoTutor['origem']
  autorId: string | null
  observado: string
  temperatura: number | null
  foto: string | null
  fotoLegenda: string
  textoManual?: string
}): BoletimAoTutor {
  const fatos = fatosDoPaciente(input.internacao)
  const { agora } = fatos
  const exigeLigacao = exigeLigacaoAntes(
    fatos.anterior?.gravidade ?? null,
    input.internacao.gravidade,
  )

  return {
    id: novoId('bol'),
    internacaoId: input.internacao.id,
    origem: input.origem,
    status: exigeLigacao ? 'retido' : 'liberado',
    gravidade: input.internacao.gravidade,
    texto:
      input.textoManual?.trim() ||
      montarTextoDoBoletim({
        petNome: fatos.petNome,
        gravidade: input.internacao.gravidade,
        feitas: fatos.feitas,
        previstas: fatos.previstas,
        temperatura: input.temperatura,
        observado: input.observado,
        exigeLigacao,
      }),
    foto: input.foto,
    fotoLegenda: input.fotoLegenda,
    geradoEm: agora,
    autorId: input.autorId,
    enviadoEm: null,
    exigeLigacao,
    ligacaoEm: null,
    ligacaoPor: null,
  }
}

// ---------------------------------------------------------------------------
// Repositório
// ---------------------------------------------------------------------------

/** Paciente e leito de uma internação, para as listas que precisam nomeá-la. */
function descreverInternacao(internacaoId: string): PacienteSemEvolucao {
  const dataset = base()
  const internacao = dataset.internacoes.find((item) => item.id === internacaoId)
  const pet = internacao
    ? getDataset().pets.find((item) => item.id === internacao.petId)
    : undefined

  return {
    internacaoId,
    petNome: pet?.nome ?? '',
    leitoNome: dataset.leitos.find((item) => item.id === internacao?.leitoId)?.nome ?? '',
  }
}

function descreverPendencia(administracao: AdministracaoAgendada): PendenciaDaPassagem {
  const prescricao = base().prescricoes.find(
    (item) => item.id === administracao.prescricaoId,
  )

  return {
    administracao,
    ...descreverInternacao(administracao.internacaoId),
    descricao: [prescricao?.descricao, prescricao?.doseTexto].filter(Boolean).join(' · '),
  }
}

/**
 * Quem cobre o turno seguinte.
 *
 * Sai da **escala**, não do plantão que está saindo: o turno seguinte ainda não existe como
 * registro, e cair no responsável atual fazia o seletor abrir com o nome de quem está indo
 * embora — a única escolha que a passagem não pode sugerir. Procura o plantão mais recente do
 * mesmo turno, que é quem costuma cobri-lo.
 */
function quemCobre(kind: Plantao['kind'], atual: Plantao): string {
  const anteriores = base()
    .plantoes.filter((item) => item.kind === kind && item.id !== atual.id)
    .sort((a, b) => b.inicio.localeCompare(a.inicio))

  return anteriores[0]?.responsavelId ?? atual.recebidoPor ?? atual.responsavelId
}

export const internacaoRepository = {
  mapa(): Promise<MapaDeInternacao> {
    return simularChamada('internacao.mapa', () => {
      const dataset = base()
      const geral = getDataset()
      const agora = agoraIso()
      const ativos = dataset.leitos.filter((leito) => leito.ativo)

      const leitos: LeitoNoMapa[] = mapaDeLeitos(dataset.leitos, dataset.internacoes).map(
        (ocupacao) => {
          const pet = ocupacao.internacao
            ? (geral.pets.find((item) => item.id === ocupacao.internacao!.petId) ?? null)
            : null
          const tutor = ocupacao.internacao
            ? (geral.tutores.find((item) => item.id === ocupacao.internacao!.tutorId) ?? null)
            : null

          const doLeito = ocupacao.internacao
            ? dataset.administracoes.filter(
                (item) => item.internacaoId === ocupacao.internacao!.id,
              )
            : []

          const situacoes = doLeito.map((item) => ({
            item,
            situacao: situacaoDaAdministracao(item, agora),
          }))

          const futuras = doLeito
            .filter((item) => item.status === 'pendente' && item.previstaPara > agora)
            .sort((a, b) => a.previstaPara.localeCompare(b.previstaPara))

          return {
            ...ocupacao,
            petNome: pet?.nome ?? '',
            petIniciais: pet?.iniciais ?? '',
            tutorNome: tutor?.nome ?? '',
            pendentes: situacoes.filter(
              (entry) => entry.situacao === 'na-janela' || entry.situacao === 'atrasada',
            ).length,
            atrasadas: situacoes.filter((entry) => entry.situacao === 'atrasada').length,
            boletimRetido: ocupacao.internacao
              ? dataset.boletins.some(
                  (item) =>
                    item.internacaoId === ocupacao.internacao!.id && item.status === 'retido',
                )
              : false,
            proximaEmMinutos: futuras[0]
              ? Math.round((Date.parse(futuras[0].previstaPara) - Date.parse(agora)) / 60_000)
              : null,
            horasInternado: ocupacao.internacao
              ? Math.max(
                  0,
                  Math.floor(
                    (Date.parse(agora) - Date.parse(ocupacao.internacao.entradaEm)) / 3_600_000,
                  ),
                )
              : 0,
          }
        },
      )

      return {
        leitos,
        ocupacao: taxaDeOcupacao(dataset.leitos, dataset.internacoes),
        ativos: ativos.length,
        ocupados: leitos.filter((item) => item.internacao).length,
        criticos: leitos.filter((item) => item.internacao?.gravidade === 'critico').length,
        boletinsRetidos: dataset.boletins.filter((item) => item.status === 'retido').length,
        plantaoAtual:
          dataset.plantoes.find((item) => item.id === dataset.plantaoAtualId) ?? null,
      }
    })
  },

  // -------------------------------------------------------------------------
  // Cadastro de leitos
  //
  // O sistema não adivinha quantos leitos a clínica tem: ela cadastra, renomeia, tira de
  // operação e devolve. As três travas vivem no domínio e são conferidas aqui — a tela pede,
  // o repositório decide.
  // -------------------------------------------------------------------------

  leitos(): Promise<Leito[]> {
    return simularChamada('internacao.leitos', () =>
      base().leitos.map((leito) => ({ ...leito })),
    )
  },

  criarLeito(input: { nome: string; roomId: string; kind: LeitoKind }): Promise<Leito> {
    return simularChamada('internacao.leitos', () => {
      const dataset = base()
      const impedimento = impedimentoParaNomear(input.nome, dataset.leitos)

      if (impedimento) {
        throw new LeitoRecusadoError(impedimento)
      }

      const leito: Leito = {
        id: novoId('leito'),
        nome: input.nome.trim(),
        roomId: input.roomId,
        kind: input.kind,
        ativo: true,
        motivoInativo: null,
        detalheInativo: '',
        inativoDesde: null,
      }

      dataset.leitos.push(leito)

      return { ...leito }
    })
  },

  /** Renomear e reclassificar. O leito segue o mesmo — é a etiqueta dele que muda. */
  editarLeito(input: { leitoId: string; nome: string; kind: LeitoKind }): Promise<Leito> {
    return simularChamada('internacao.leitos', () => {
      const dataset = base()
      const leito = dataset.leitos.find((item) => item.id === input.leitoId)

      if (!leito) {
        throw new Error(`internacao.editarLeito: ${input.leitoId} não existe`)
      }

      const impedimento = impedimentoParaNomear(input.nome, dataset.leitos, leito.id)

      if (impedimento) {
        throw new LeitoRecusadoError(impedimento)
      }

      leito.nome = input.nome.trim()
      leito.kind = input.kind

      return { ...leito }
    })
  },

  desativarLeito(input: {
    leitoId: string
    motivo: LeitoInativoMotivo
    detalhe: string
  }): Promise<Leito> {
    return simularChamada('internacao.leitos', () => {
      const dataset = base()
      const leito = dataset.leitos.find((item) => item.id === input.leitoId)

      if (!leito) {
        throw new Error(`internacao.desativarLeito: ${input.leitoId} não existe`)
      }

      const impedimento = impedimentoParaDesativar(leito, dataset.internacoes)

      if (impedimento) {
        throw new LeitoRecusadoError(impedimento)
      }

      leito.ativo = false
      leito.motivoInativo = input.motivo
      leito.detalheInativo = input.detalhe.trim()
      leito.inativoDesde = agoraIso()

      return { ...leito }
    })
  },

  reativarLeito(leitoId: string): Promise<Leito> {
    return simularChamada('internacao.leitos', () => {
      const leito = base().leitos.find((item) => item.id === leitoId)

      if (!leito) {
        throw new Error(`internacao.reativarLeito: ${leitoId} não existe`)
      }

      leito.ativo = true
      leito.motivoInativo = null
      leito.detalheInativo = ''
      leito.inativoDesde = null

      return { ...leito }
    })
  },

  /** Só sai do cadastro o leito que nunca recebeu ninguém. O resto se desativa. */
  removerLeito(leitoId: string): Promise<void> {
    return simularChamada('internacao.leitos', () => {
      const dataset = base()
      const leito = dataset.leitos.find((item) => item.id === leitoId)

      if (!leito) {
        throw new Error(`internacao.removerLeito: ${leitoId} não existe`)
      }

      const impedimento = impedimentoParaRemover(leito, dataset.internacoes)

      if (impedimento) {
        throw new LeitoRecusadoError(impedimento)
      }

      dataset.leitos = dataset.leitos.filter((item) => item.id !== leitoId)
    })
  },

  doPaciente(internacaoId: string): Promise<PacienteInternado | null> {
    return simularChamada('internacao.paciente', () => {
      const dataset = base()
      const internacao = dataset.internacoes.find((item) => item.id === internacaoId)

      if (!internacao) {
        return null
      }

      return {
        internacao,
        leito: dataset.leitos.find((item) => item.id === internacao.leitoId) ?? null,
        plantoes: [...dataset.plantoes].sort((a, b) => b.inicio.localeCompare(a.inicio)),
        prescricoes: dataset.prescricoes
          .filter((item) => item.internacaoId === internacaoId)
          .sort((a, b) => a.primeiroHorario.localeCompare(b.primeiroHorario)),
        administracoes: dataset.administracoes
          .filter((item) => item.internacaoId === internacaoId)
          .sort((a, b) => a.previstaPara.localeCompare(b.previstaPara)),
        evolucoes: dataset.evolucoes
          .filter((item) => item.internacaoId === internacaoId)
          .sort((a, b) => b.registradoEm.localeCompare(a.registradoEm)),
        boletins: dataset.boletins
          .filter((item) => item.internacaoId === internacaoId)
          .sort((a, b) => b.geradoEm.localeCompare(a.geradoEm)),
        preferencia: dataset.preferencias.find((item) => item.internacaoId === internacaoId) ?? {
          internacaoId,
          frequenciaHoras: 6,
          fotoSempre: false,
          silencioNoturno: true,
        },
      }
    })
  },

  /**
   * Registra a execução de uma administração.
   *
   * Grava **quem** e **quando**, e o plantão em que a execução caiu — que pode não ser o plantão
   * da previsão, e essa diferença é justamente o que a auditoria da troca de turno procura.
   */
  registrar(input: {
    administracaoId: string
    status: Exclude<AdministracaoStatus, 'pendente' | 'suspensa'>
    professionalId: string
    observacao?: string
  }): Promise<AdministracaoAgendada> {
    return simularChamada('internacao.administrar', () => {
      const alvo = base().administracoes.find((item) => item.id === input.administracaoId)

      if (!alvo) {
        throw new Error(`internacao.registrar: ${input.administracaoId} não existe`)
      }

      const agora = agoraIso()
      const turno = plantaoDe(agora, clock)

      alvo.status = input.status
      alvo.executadaEm = agora
      alvo.executadaPor = input.professionalId
      alvo.plantaoId = idDoPlantao(turno.kind, turno.data)
      alvo.observacao = input.observacao?.trim() ?? ''

      return { ...alvo }
    })
  },

  /** Desfaz um registro. Enfermeira clica errado, e um checklist sem volta vira dado mentiroso. */
  desfazer(administracaoId: string): Promise<AdministracaoAgendada> {
    return simularChamada('internacao.administrar', () => {
      const alvo = base().administracoes.find((item) => item.id === administracaoId)

      if (!alvo) {
        throw new Error(`internacao.desfazer: ${administracaoId} não existe`)
      }

      alvo.status = 'pendente'
      alvo.executadaEm = null
      alvo.executadaPor = null
      alvo.plantaoId = null
      alvo.observacao = ''

      return { ...alvo }
    })
  },

  /**
   * Nova prescrição, já aprazada.
   *
   * Os horários nascem junto com ela porque prescrição de internação sem horário não existe: um
   * item que aparece no checklist "quando alguém calcular" é um item que ninguém dá.
   */
  prescrever(input: {
    internacaoId: string
    kind: PrescricaoDeInternacao['kind']
    medicamentoId: string | null
    descricao: string
    via: PrescricaoDeInternacao['via']
    doseTexto: string
    frequenciaHoras: number
    continuo: boolean
    primeiroHorario: ISODateTime
    prescritoPor: string
    observacao?: string
  }): Promise<PrescricaoDeInternacao> {
    return simularChamada('internacao.prescrever', () => {
      const dataset = base()
      const agora = agoraIso()

      const prescricao: PrescricaoDeInternacao = {
        id: novoId('presc'),
        internacaoId: input.internacaoId,
        kind: input.kind,
        medicamentoId: input.medicamentoId,
        descricao: input.descricao.trim(),
        via: input.via,
        doseTexto: input.doseTexto.trim(),
        frequenciaHoras: input.frequenciaHoras,
        continuo: input.continuo,
        primeiroHorario: input.primeiroHorario,
        encerraEm: null,
        prescritoPor: input.prescritoPor,
        prescritoEm: agora,
        suspensaEm: null,
        motivoSuspensao: '',
        observacao: input.observacao?.trim() ?? '',
      }

      dataset.prescricoes.push(prescricao)

      for (const previstaPara of horariosDaPrescricao(
        prescricao,
        maisHoras(agora, HORIZONTE_DE_APRAZAMENTO_HORAS),
        clock,
      )) {
        dataset.administracoes.push({
          id: novoId('adm'),
          internacaoId: input.internacaoId,
          prescricaoId: prescricao.id,
          previstaPara,
          status: 'pendente',
          executadaEm: null,
          executadaPor: null,
          plantaoId: null,
          observacao: '',
        })
      }

      dataset.administracoes.sort((a, b) => a.previstaPara.localeCompare(b.previstaPara))

      return prescricao
    })
  },

  /**
   * Suspende uma prescrição.
   *
   * Marca as administrações **futuras** como suspensas e não toca no que já passou. Apagar os
   * horários daria a impressão de que a medicação nunca existiu — e o que se procura no
   * prontuário de um paciente que piorou é exatamente o que ele recebeu antes de piorar.
   */
  suspender(input: {
    prescricaoId: string
    motivo: string
  }): Promise<PrescricaoDeInternacao | null> {
    return simularChamada('internacao.prescrever', () => {
      const dataset = base()
      const prescricao = dataset.prescricoes.find((item) => item.id === input.prescricaoId)

      if (!prescricao) {
        return null
      }

      const agora = agoraIso()

      prescricao.suspensaEm = agora
      prescricao.motivoSuspensao = input.motivo.trim()

      for (const administracao of dataset.administracoes) {
        if (
          administracao.prescricaoId === prescricao.id &&
          administracao.status === 'pendente' &&
          administracao.previstaPara > agora
        ) {
          administracao.status = 'suspensa'
        }
      }

      return prescricao
    })
  },

  /**
   * Evolução do turno.
   *
   * Grava a nota **e** move a gravidade da internação, porque as duas coisas são a mesma decisão
   * clínica — e separá-las produziria um paciente marcado como estável com uma evolução que diz
   * o contrário. Quando a gravidade piora, um boletim nasce aqui, retido, esperando a ligação.
   */
  evoluir(input: {
    internacaoId: string
    professionalId: string
    vitais: Record<VitalKey, Measurement>
    observado: string
    avaliacao: string
    plano: string
    gravidade: GravidadeClinica
  }): Promise<{ evolucao: EvolucaoDeInternacao; boletim: BoletimAoTutor | null }> {
    return simularChamada('internacao.evoluir', () => {
      const dataset = base()
      const internacao = dataset.internacoes.find((item) => item.id === input.internacaoId)

      if (!internacao) {
        throw new Error(`internacao.evoluir: ${input.internacaoId} não existe`)
      }

      const agora = agoraIso()
      const turno = plantaoDe(agora, clock)

      const evolucao: EvolucaoDeInternacao = {
        id: novoId('evo'),
        internacaoId: input.internacaoId,
        plantaoId: idDoPlantao(turno.kind, turno.data),
        professionalId: input.professionalId,
        registradoEm: agora,
        vitais: input.vitais,
        observado: input.observado.trim(),
        avaliacao: input.avaliacao.trim(),
        plano: input.plano.trim(),
        gravidade: input.gravidade,
      }

      dataset.evolucoes.push(evolucao)
      internacao.gravidade = input.gravidade

      const anterior = ultimoBoletim(internacao.id)
      const precisa = exigeLigacaoAntes(anterior?.gravidade ?? null, input.gravidade)

      /*
       * Só a piora gera boletim automático a partir da evolução. Um boletim por evolução
       * registrada faria o responsável receber três mensagens por dia que ele não pediu — e a
       * frequência é escolha dele, não do plantão.
       */
      if (!precisa) {
        return { evolucao, boletim: null }
      }

      const boletim = comporBoletim({
        internacao,
        origem: 'automatico',
        autorId: input.professionalId,
        observado: input.observado,
        temperatura: input.vitais.temperatura.valor,
        foto: null,
        fotoLegenda: '',
      })

      dataset.boletins.push(boletim)

      return { evolucao, boletim }
    })
  },

  // -------------------------------------------------------------------------
  // Boletim
  // -------------------------------------------------------------------------

  /**
   * Os textos prontos para este paciente, já com os dados dele dentro.
   *
   * Sai do repositório e não da tela porque os números são os mesmos que o boletim composto usa
   * — medicações do período, última temperatura, tempo de internação — e a tela não tem nenhum
   * deles em mãos. Buscá-los na apresentação significaria refazer ali a mesma contagem, e um dos
   * dois lados ficaria para trás no primeiro ajuste.
   *
   * O resultado é texto pronto, não um gabarito: quem recebe edita à vontade antes de enviar.
   */
  modelosDeBoletim(internacaoId: string): Promise<ModeloDeBoletim[]> {
    return simularChamada('internacao.boletim', () => {
      const internacao = base().internacoes.find((item) => item.id === internacaoId)

      if (!internacao) {
        throw new Error(`internacao.modelosDeBoletim: ${internacaoId} não existe`)
      }

      const fatos = fatosDoPaciente(internacao)

      return montarModelos({
        petNome: fatos.petNome,
        gravidade: internacao.gravidade,
        feitas: fatos.feitas,
        previstas: fatos.previstas,
        temperatura: ultimaTemperatura(internacaoId),
        diasInternado: fatos.diasInternado,
      })
    })
  },

  gerarBoletim(input: {
    internacaoId: string
    autorId: string
    observado: string
    temperatura?: number | null
    foto?: string | null
    fotoLegenda?: string
    texto?: string
  }): Promise<BoletimAoTutor> {
    return simularChamada('internacao.boletim', () => {
      const dataset = base()
      const internacao = dataset.internacoes.find((item) => item.id === input.internacaoId)

      if (!internacao) {
        throw new Error(`internacao.gerarBoletim: ${input.internacaoId} não existe`)
      }

      const boletim = comporBoletim({
        internacao,
        origem: 'manual',
        autorId: input.autorId,
        observado: input.observado,
        temperatura: input.temperatura ?? null,
        foto: input.foto ?? null,
        fotoLegenda: input.fotoLegenda?.trim() ?? '',
        textoManual: input.texto,
      })

      dataset.boletins.push(boletim)

      return boletim
    })
  },

  /**
   * Registra que a ligação foi feita — e só então o boletim retido se torna enviável.
   *
   * Guarda quem ligou. Sem esse nome, "ligamos para o responsável" é uma caixa marcada, e uma
   * caixa marcada não responde a ninguém depois.
   */
  registrarLigacao(input: {
    boletimId: string
    professionalId: string
  }): Promise<BoletimAoTutor> {
    return simularChamada('internacao.boletim', () => {
      const boletim = base().boletins.find((item) => item.id === input.boletimId)

      if (!boletim) {
        throw new Error(`internacao.registrarLigacao: ${input.boletimId} não existe`)
      }

      boletim.ligacaoEm = agoraIso()
      boletim.ligacaoPor = input.professionalId

      if (boletim.status === 'retido') {
        boletim.status = 'liberado'
      }

      return { ...boletim }
    })
  },

  /** Envia ao app do responsável. Recusa o que ainda espera ligação — a regra é do servidor. */
  enviarBoletim(boletimId: string): Promise<BoletimAoTutor> {
    return simularChamada('internacao.boletim', () => {
      const boletim = base().boletins.find((item) => item.id === boletimId)

      if (!boletim) {
        throw new Error(`internacao.enviarBoletim: ${boletimId} não existe`)
      }

      if (boletim.exigeLigacao && !boletim.ligacaoEm) {
        throw new BoletimBloqueadoError()
      }

      boletim.status = 'enviado'
      boletim.enviadoEm = agoraIso()

      return { ...boletim }
    })
  },

  atualizarPreferencia(input: PreferenciaDeBoletim): Promise<PreferenciaDeBoletim> {
    return simularChamada('internacao.boletim', () => {
      const dataset = base()
      const atual = dataset.preferencias.find(
        (item) => item.internacaoId === input.internacaoId,
      )

      if (!atual) {
        dataset.preferencias.push({ ...input })

        return { ...input }
      }

      atual.frequenciaHoras = input.frequenciaHoras
      atual.fotoSempre = input.fotoSempre
      atual.silencioNoturno = input.silencioNoturno

      return { ...atual }
    })
  },

  // -------------------------------------------------------------------------
  // Plantão
  // -------------------------------------------------------------------------

  passagem(): Promise<PassagemDePlantao | null> {
    return simularChamada('internacao.passagem', () => {
      const dataset = base()
      const plantao = dataset.plantoes.find((item) => item.id === dataset.plantaoAtualId)

      if (!plantao) {
        return null
      }

      const agora = agoraIso()
      const turno = plantaoDe(plantao.inicio, clock)
      const seguinte = plantaoSeguinte(turno.kind, turno.data)
      const abertas = dataset.internacoes.filter((item) => item.status === 'internado')
      const comEvolucao = dataset.evolucoes
        .filter((item) => item.plantaoId === plantao.id)
        .map((item) => item.internacaoId)

      const cruas = pendenciasDaPassagem({
        administracoes: dataset.administracoes,
        kind: turno.kind,
        data: turno.data,
        clock,
        agora,
        internacoesAbertas: abertas.map((item) => item.id),
        internacoesComEvolucaoNoTurno: comEvolucao,
      })

      return {
        plantao,
        seguinte: {
          kind: seguinte.kind,
          data: seguinte.data,
          responsavelId: quemCobre(seguinte.kind, plantao),
        },
        pendencias: {
          atrasadas: cruas.atrasadas.map(descreverPendencia),
          emCimaDaTroca: cruas.emCimaDaTroca.map(descreverPendencia),
          semEvolucao: cruas.semEvolucao.map(descreverInternacao),
        },
      }
    })
  },

  /**
   * Fecha o plantão e abre o seguinte.
   *
   * As pendências são **congeladas** na entrega, e não recalculadas na leitura. A passagem
   * precisa dizer o que estava aberto naquele minuto: recalculada amanhã, ela mostraria a
   * pendência já resolvida pelo turno seguinte e a lista viraria uma página em branco — que é a
   * forma mais educada de apagar responsabilidade.
   */
  entregarPlantao(input: {
    notaDePassagem: string
    recebidoPor: string
  }): Promise<Plantao | null> {
    return simularChamada('internacao.passagem', () => {
      const dataset = base()
      const plantao = dataset.plantoes.find((item) => item.id === dataset.plantaoAtualId)

      if (!plantao) {
        return null
      }

      const agora = agoraIso()
      const turno = plantaoDe(plantao.inicio, clock)
      const abertas = dataset.internacoes.filter((item) => item.status === 'internado')
      const comEvolucao = dataset.evolucoes
        .filter((item) => item.plantaoId === plantao.id)
        .map((item) => item.internacaoId)

      const pendencias = pendenciasDaPassagem({
        administracoes: dataset.administracoes,
        kind: turno.kind,
        data: turno.data,
        clock,
        agora,
        internacoesAbertas: abertas.map((item) => item.id),
        internacoesComEvolucaoNoTurno: comEvolucao,
      })

      plantao.entregueEm = agora
      plantao.recebidoPor = input.recebidoPor
      plantao.notaDePassagem = input.notaDePassagem.trim()
      plantao.pendenciasEntregues = [
        ...pendencias.atrasadas.map((item) => item.id),
        ...pendencias.emCimaDaTroca.map((item) => item.id),
      ]

      const seguinte = plantaoSeguinte(turno.kind, turno.data)
      const idSeguinte = idDoPlantao(seguinte.kind, seguinte.data)

      if (!dataset.plantoes.some((item) => item.id === idSeguinte)) {
        const limites = limitesDoPlantao(seguinte.kind, seguinte.data, clock)

        dataset.plantoes.push({
          id: idSeguinte,
          kind: seguinte.kind,
          inicio: limites.inicio,
          fim: limites.fim,
          responsavelId: input.recebidoPor,
          entregueEm: null,
          recebidoPor: null,
          notaDePassagem: '',
          pendenciasEntregues: [],
        })
      }

      dataset.plantaoAtualId = idSeguinte

      return { ...plantao }
    })
  },

  // -------------------------------------------------------------------------
  // Entrada e saída
  // -------------------------------------------------------------------------

  internar(input: {
    petId: string
    tutorId: string
    leitoId: string
    responsavelId: string
    motivo: string
    diagnostico: string
    gravidade: GravidadeClinica
    pesoEntradaKg: number
    encounterId?: string | null
  }): Promise<Internacao> {
    return simularChamada('internacao.internar', () => {
      const dataset = base()
      const leito = dataset.leitos.find((item) => item.id === input.leitoId)
      const ocupado = dataset.internacoes.some(
        (item) => item.leitoId === input.leitoId && item.status === 'internado',
      )

      if (!leito || !leito.ativo || ocupado) {
        throw new LeitoOcupadoError(input.leitoId)
      }

      const internacao: Internacao = {
        id: novoId('int'),
        petId: input.petId,
        tutorId: input.tutorId,
        leitoId: input.leitoId,
        responsavelId: input.responsavelId,
        encounterId: input.encounterId ?? null,
        motivo: input.motivo.trim(),
        diagnostico: input.diagnostico.trim(),
        entradaEm: agoraIso(),
        altaPrevistaEm: null,
        altaEm: null,
        status: 'internado',
        gravidade: input.gravidade,
        pesoEntradaKg: input.pesoEntradaKg,
        observacao: '',
      }

      dataset.internacoes.push(internacao)
      dataset.preferencias.push({
        internacaoId: internacao.id,
        /*
         * Seis horas é o padrão porque é o intervalo em que a clínica tem o que dizer. Estrear em
         * "de hora em hora" prometeria à clínica um trabalho que ela não escolheu; estrear em
         * "uma vez por dia" devolveria o responsável ao telefone no primeiro dia.
         */
        frequenciaHoras: 6,
        fotoSempre: false,
        silencioNoturno: true,
      })

      getDataset().timeline.push({
        id: `tl-internacao-aberta-${internacao.id}`,
        petId: internacao.petId,
        kind: 'internacao',
        em: internacao.entradaEm,
        titulo: internacao.motivo,
        resumo: internacao.diagnostico,
        encounterId: internacao.encounterId,
        appointmentId: null,
      })

      return internacao
    })
  },

  /**
   * Alta.
   *
   * Suspende o que estava pendente em vez de deixar horários futuros de um paciente que já foi
   * para casa — e é isso que devolve o leito ao mapa.
   */
  /**
   * Encerra a internação e devolve o leito.
   *
   * Duas coisas mudaram quando a alta ganhou tela — antes esta função existia sem que nada a
   * chamasse, e o animal entrava no mapa de leitos para nunca sair:
   *
   * 1. **A alta escreve a última mensagem ao responsável.** A conversa do aplicativo terminava no
   *    boletim das 14h, e quem estava do outro lado ficava com o celular na mão sem saber se já
   *    podia parar de olhar. O boletim de alta fecha o ciclo que os outros abriram.
   * 2. **Óbito e transferência não saem por mensagem.** Exigem `avisadoPorTelefone`, e o
   *    encerramento é recusado sem ele. É a regra do boletim de piora aplicada ao fim.
   *
   * `professionalId` é quem assina o encerramento. Sem esse nome, "o animal recebeu alta às 16h"
   * é uma linha que não responde a ninguém depois — e a alta é justamente o registro que a
   * auditoria de um caso difícil vai procurar primeiro.
   */
  darAlta(input: {
    internacaoId: string
    status: DesfechoDaInternacao
    observacao: string
    professionalId: string
    /** Registro de que alguém falou com o responsável. Obrigatório em óbito e transferência. */
    avisadoPorTelefone?: boolean
  }): Promise<{ internacao: Internacao; boletim: BoletimAoTutor | null } | null> {
    return simularChamada('internacao.internar', () => {
      const dataset = base()
      const internacao = dataset.internacoes.find((item) => item.id === input.internacaoId)

      if (!internacao) {
        return null
      }

      if (!saiPorMensagem(input.status) && !input.avisadoPorTelefone) {
        throw new AltaSemAvisoError(input.status as 'obito' | 'transferido')
      }

      const agora = agoraIso()

      internacao.status = input.status
      internacao.altaEm = agora
      internacao.observacao = input.observacao.trim()

      for (const administracao of dataset.administracoes) {
        if (
          administracao.internacaoId === internacao.id &&
          administracao.status === 'pendente' &&
          administracao.previstaPara > agora
        ) {
          administracao.status = 'suspensa'
        }
      }

      /*
       * O boletim de alta nasce **liberado**, e não retido: é a única boa notícia da série, e
       * `comporBoletim` não serve aqui porque ele decide a retenção pela gravidade — um animal
       * que passou a internação inteira crítico e teve alta cairia como notícia grave.
       */
      let boletim: BoletimAoTutor | null = null

      if (saiPorMensagem(input.status)) {
        const petNome =
          getDataset().pets.find((pet) => pet.id === internacao.petId)?.nome ?? 'Seu pet'

        boletim = {
          id: novoId('bol'),
          internacaoId: internacao.id,
          origem: 'manual',
          status: 'liberado',
          gravidade: internacao.gravidade,
          texto: montarTextoDeAlta({
            petNome,
            horas: horasInternado(internacao, agora),
            orientacao: internacao.observacao,
          }),
          foto: null,
          fotoLegenda: '',
          geradoEm: agora,
          autorId: input.professionalId,
          enviadoEm: null,
          exigeLigacao: false,
          ligacaoEm: null,
          ligacaoPor: null,
        }

        dataset.boletins.push(boletim)
      }

      return { internacao: { ...internacao }, boletim }
    })
  },
}
