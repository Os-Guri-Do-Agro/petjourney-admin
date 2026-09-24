/**
 * Repositório da estadia — e é aqui que moram R3 e R4.
 *
 * R3 dá nome ao módulo do mesmo jeito que o boletim retido dá nome à internação: quando a
 * ocorrência é grave, o boletim nasce retido e não sai até alguém ligar. Se isso vivesse na tela,
 * bastaria outra tela — ou uma rota de API amanhã — para a notícia ruim escapar por push.
 *
 * R4 trava o check-out. Um pertence sem conferência não é um campo em branco: é uma coleira que
 * ninguém sabe onde está, e o único momento em que isso ainda tem solução é enquanto o carro está
 * no estacionamento.
 *
 * O texto do boletim é montado aqui, em português, e não na apresentação. Parece contradizer a
 * disciplina do módulo (`kind` viaja, texto se traduz), e não contradiz: o boletim **não é
 * interface**, é uma mensagem endereçada ao responsável, escrita no idioma dele e congelada no
 * envio. O idioma da tela do hotel não tem nada a ver com o idioma em que a Rita lê que o gato
 * dela não comeu.
 */

import { addDays } from '@/features/clinico/domain/clinic-time'

import { avaliarAdmissao } from '../../domain/admissao'
import {
  boletimPodeSair,
  exigeContato,
  impedimentosDeSaida,
  noitesNaCasa,
  ocorrenciasTravadas,
  pertencesPendentes,
  type ImpedimentoDeSaida,
} from '../../domain/estadia'
import { contarDiarias, dataDe, maisMinutos } from '../../domain/hotel-time'
import { reconciliarDia } from '../../domain/materializacao'
import { rotinaEfetiva } from '../../domain/rotina-padrao'
import {
  atrasadasAgora,
  diaDaRotina,
  focoDoHospede,
  pendenciasDoTurno,
  pendentesAgora,
  planejarDia,
  proximaEmMinutos,
  situacaoDaTarefa,
  tarefasDoDia,
} from '../../domain/rotina'
import { cobrancaDaSaida, montarOrcamento } from '../../domain/tarifas'
import { HOTEL_UTC_OFFSET } from '../fixtures'
import { simularChamada } from '../mock-runtime'
import { agoraIso, getDataset, hojeIso, novoId } from '../store'
import { AdmissaoBloqueadaError } from './reserva-repository'
import type {
  Adaptacao,
  Autorizacao,
  Boletim,
  GravidadeDaOcorrencia,
  Hospedagem,
  ISODate,
  ISODateTime,
  CuidadoDaEstadia,
  MedicacaoDaEstadia,
  Ocorrencia,
  OcorrenciaKind,
  Pertence,
  PetSpecies,
  PlanoAlimentar,
  RegistroDoDiario,
  RegistroKind,
  TarefaDeRotina,
  TarefaKind,
  TarefaStatus,
  ViaDeMedicacao,
  Turno,
} from '../types'

function base() {
  return getDataset()
}

/**
 * Materializa o dia pedido para quem está na casa, se ninguém o materializou ainda.
 *
 * ## O defeito que isto conserta
 *
 * As tarefas de um dia nasciam em dois momentos, e só nesses dois: a semente gera **ontem e hoje**,
 * e o check-in gera **hoje e amanhã**. Ninguém gerava o resto. Numa estadia de sete noites, o
 * terceiro dia chegava com a prancheta **vazia** — não "sem tarefas pendentes", vazia — e a casa
 * passava o dia sem lista. O defeito não aparecia na demonstração porque a demonstração sempre
 * olha hoje.
 *
 * Num sistema de verdade isto é trabalho noturno do servidor. Aqui não há servidor, então a
 * materialização acontece na leitura, e é honesto dizer que **uma leitura escreve**. Só funciona
 * porque `reconciliarDia` é idempotente pela chave da tarefa: abrir a mesma prancheta dez vezes
 * cria as tarefas na primeira e nada nas outras nove.
 *
 * ## O que ela nunca faz
 *
 * Não cria nada no passado, não toca no que já existe, e não retira coisa alguma — só o balde
 * `criar` é usado. Preencher lacuna e publicar plano novo passam pela mesma função de domínio, mas
 * são operações diferentes: esta só sabe acrescentar o que falta.
 */
function garantirHorizonte(dia: ISODate) {
  const dataset = getDataset()
  const agora = agoraIso()

  for (const hospedagem of dataset.hospedagens) {
    if (hospedagem.status !== 'hospedado') {
      continue
    }

    const reserva = dataset.reservas.find((item) => item.id === hospedagem.reservaId)

    const planejadas = planejarDia({
      hospedagemId: hospedagem.id,
      dia,
      utcOffset: HOTEL_UTC_OFFSET,
      planoAlimentar: hospedagem.planoAlimentar,
      medicacoes: dataset.medicacoes.filter((item) => item.hospedagemId === hospedagem.id),
      cuidados: dataset.cuidados.filter((item) => item.hospedagemId === hospedagem.id),
      passeioAutorizado: hospedagem.autorizacoes.some(
        (item) => item.kind === 'passeio-externo' && item.concedida,
      ),
      entradaEm: hospedagem.entradaEm,
      saidaPrevistaEm: hospedagem.saidaPrevistaEm,
      servicos: reserva?.servicos,
      catalogoDeServicos: dataset.servicos,
      rotinaPadrao: rotinaEfetiva(
        dataset.rotinaPadrao.itens,
        dataset.ajustesDeRotina.filter(
          (ajuste) => ajuste.hospedagemId === hospedagem.id && !ajuste.revogadoEm,
        ),
      ),
    })

    if (planejadas.length === 0) {
      continue
    }

    const { criar } = reconciliarDia({
      existentes: tarefasDoDia(
        dataset.tarefas.filter((item) => item.hospedagemId === hospedagem.id),
        dia,
      ),
      planejadas,
      agora,
    })

    for (const planejada of criar) {
      dataset.tarefas.push({
        id: novoId('tarefa'),
        ...planejada,
        status: 'pendente',
        executadaEm: null,
        executadaPor: null,
        turnoId: null,
        observacao: '',
      })
    }
  }
}

// ---------------------------------------------------------------------------
// Erros
// ---------------------------------------------------------------------------

/** Check-out recusado, com **quais** impedimentos — a tela lista, não adivinha. */
export class SaidaBloqueadaError extends Error {
  readonly kinds: ImpedimentoDeSaida[]

  constructor(kinds: ImpedimentoDeSaida[]) {
    super(`[mock] saída bloqueada: ${kinds.join(', ')}`)
    this.name = 'SaidaBloqueadaError'
    this.kinds = kinds
  }
}

/** Boletim que carrega ocorrência grave e ainda não teve ligação. É a regra R3. */
export class BoletimRetidoError extends Error {
  constructor() {
    super('[mock] boletim exige contato antes do envio')
    this.name = 'BoletimRetidoError'
  }
}

/** Turno que não pode ser entregue: há ocorrência grave sem contato registrado. */
export class PassagemTravadaError extends Error {
  readonly ocorrencias: string[]

  constructor(ocorrencias: string[]) {
    super('[mock] passagem travada por ocorrência sem contato')
    this.name = 'PassagemTravadaError'
    this.ocorrencias = ocorrencias
  }
}

// ---------------------------------------------------------------------------
// Envelopes de leitura
// ---------------------------------------------------------------------------

/** Um hóspede na lista da casa, já com o que cobra ação. */
export type HospedeNaCasa = {
  hospedagem: Hospedagem
  petNome: string
  petIniciais: string
  /** Espécie e retrato: o avatar do hóspede acompanha o nome em toda lista. */
  petEspecie: PetSpecies | null
  petFotoUrl: string
  /**
   * O segundo animal da mesma casa, quando a estadia tem dois dividindo a acomodação.
   *
   * A lista devolve **uma linha por estadia**, e a estadia é que carrega o acompanhante — então,
   * sem este campo, o segundo animal está na casa e não aparece em tela nenhuma. Era o caso da
   * Amora no dado de demonstração: a casa tinha seis hóspedes e a tela mostrava cinco.
   */
  acompanhante: {
    nome: string
    iniciais: string
    especie: PetSpecies | null
    fotoUrl: string
  } | null
  tutorNome: string
  tutorTelefone: string
  acomodacaoNome: string
  blocoId: string
  pendentes: number
  atrasadas: number
  /** Ocorrência grave esperando ligação. É o selo que não pode ser ignorado. */
  ocorrenciaTravada: boolean
  boletimRetido: boolean
  noites: number
  saiHoje: boolean
  proximaEmMinutos: number | null
  /**
   * A tarefa que decide o cartão: a mais antiga atrasada, ou a próxima à frente.
   *
   * Quem varre a grade lê o desenho antes da palavra, e passeio e medicação pedem preparos
   * diferentes: "daqui a 40 min" sozinho não diz qual dos dois é, e é justamente a diferença que
   * faz alguém largar o que está fazendo agora ou daqui a meia hora. Vai a tarefa inteira porque
   * o ícone sai do `kind` e o relógio sai do `previstaPara` — separados, podem discordar.
   */
  foco: { kind: TarefaKind; previstaPara: ISODateTime; atrasada: boolean } | null
  /** O dia da rotina deste hóspede: quantas tarefas tem e quantas já saíram do caminho. */
  rotinaDoDia: { total: number; resolvidas: number }
}

export type EstadiaDetalhada = {
  hospedagem: Hospedagem
  tarefas: TarefaDeRotina[]
  medicacoes: MedicacaoDaEstadia[]
  diario: RegistroDoDiario[]
  ocorrencias: Ocorrencia[]
  boletins: Boletim[]
  /** Por que o check-out não fecha. Vazio significa que fecha. */
  impedimentos: ImpedimentoDeSaida[]
  /** O que ainda falta cobrar, já com a taxa de saída tardia se houver. */
  saldoCentavos: number
  /** Percentual de diária que a saída prevista acrescenta. 0 quando sai no horário. */
  acrescimoDeSaida: number
  /**
   * Quem, além do responsável, pode retirar o animal.
   *
   * Vem junto do detalhe e não de uma segunda chamada: a conferência acontece no check-out, que é
   * feito **desta** tela, e buscar a reserva inteira só para ler uma lista de nomes seria uma
   * requisição para responder a uma pergunta que já estava respondida.
   */
  autorizadosARetirar: string[]
}

/** Uma linha da prancheta do turno, com o hóspede resolvido. */
export type TarefaNaPrancheta = {
  tarefa: TarefaDeRotina
  hospedagemId: string
  petNome: string
  petIniciais: string
  /** Espécie e retrato: o avatar do hóspede acompanha o nome em toda lista. */
  petEspecie: PetSpecies | null
  petFotoUrl: string
  acomodacaoNome: string
  blocoId: string
}

export type PassagemDeTurno = {
  turno: Turno
  /**
   * O turno que assume, **com os horários dele**.
   *
   * Só o nome não basta: "assume Tarde" não diz a quem entra até que horas ele responde pela casa,
   * e é justamente isso que ele está aceitando ao assinar. O turno que sai mostrava a própria
   * janela desde sempre; o que entra ficava sem.
   */
  seguinte: { kind: Turno['kind']; responsavelId: string; inicio: ISODateTime; fim: ISODateTime }
  pendencias: {
    tarefas: TarefaNaPrancheta[]
    ocorrencias: Ocorrencia[]
    boletinsRetidos: Boletim[]
  }
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

function tarefasDe(hospedagemId: string) {
  return base().tarefas.filter((tarefa) => tarefa.hospedagemId === hospedagemId)
}

/**
 * O segundo animal da estadia, achatado para o que o cartão desenha. `null` no caso normal.
 *
 * Sai da **reserva** e não da hospedagem: quem carrega o acompanhante é o que foi vendido, e a
 * hospedagem é o que foi aberto a partir dele.
 */
function companheiroDaReserva(reservaId: string) {
  const dataset = base()
  const petId = dataset.reservas.find((item) => item.id === reservaId)?.acompanhantePetId

  if (!petId) {
    return null
  }

  const pet = dataset.pets.find((item) => item.id === petId)

  if (!pet) {
    return null
  }

  return {
    nome: pet.nome,
    iniciais: pet.iniciais,
    especie: pet.especie,
    fotoUrl: pet.fotoUrl,
  }
}

/**
 * O foco de um hóspede, achatado para o que a grade precisa.
 *
 * A tarefa inteira não atravessa: `TarefaDeRotina` carrega identificador, turno, observação e
 * executor, e nada disso é desenhado na grade. Mandar o objeto cheio convidaria alguém a marcar
 * tarefa a partir daqui, que é decisão de produto e não consequência de tipo.
 */
function focoDe(tarefas: TarefaDeRotina[], agora: ISODateTime) {
  const foco = focoDoHospede(tarefas, agora)

  if (!foco) {
    return null
  }

  return {
    kind: foco.kind,
    previstaPara: foco.previstaPara,
    atrasada: situacaoDaTarefa(foco, agora) === 'atrasada',
  }
}

function ocorrenciasDe(hospedagemId: string) {
  return base().ocorrencias.filter((item) => item.hospedagemId === hospedagemId)
}

function turnoDe(agora: string): Turno | null {
  return base().turnos.find((turno) => turno.inicio <= agora && agora < turno.fim) ?? null
}

function decorarTarefa(tarefa: TarefaDeRotina): TarefaNaPrancheta {
  const dataset = base()
  const hospedagem = dataset.hospedagens.find((item) => item.id === tarefa.hospedagemId)
  const pet = dataset.pets.find((item) => item.id === hospedagem?.petId)
  const acomodacao = dataset.acomodacoes.find((item) => item.id === hospedagem?.acomodacaoId)

  return {
    tarefa,
    hospedagemId: tarefa.hospedagemId,
    petNome: pet?.nome ?? '',
    petIniciais: pet?.iniciais ?? '',
    petEspecie: pet?.especie ?? null,
    petFotoUrl: pet?.fotoUrl ?? '',
    acomodacaoNome: acomodacao?.nome ?? '',
    blocoId: acomodacao?.blocoId ?? '',
  }
}

export const hospedagemRepository = {
  /** Quem está na casa agora. */
  listar(): Promise<HospedeNaCasa[]> {
    return simularChamada('hospedagem.listar', () => {
      const dataset = base()
      const agora = agoraIso()
      const hoje = hojeIso()

      return (
        dataset.hospedagens
          .filter((item) => item.status === 'hospedado')
          .map<HospedeNaCasa>((hospedagem) => {
            const pet = dataset.pets.find((item) => item.id === hospedagem.petId)
            const tutor = dataset.tutores.find((item) => item.id === hospedagem.tutorId)
            const acomodacao = dataset.acomodacoes.find(
              (item) => item.id === hospedagem.acomodacaoId,
            )
            const tarefas = tarefasDe(hospedagem.id)

            return {
              hospedagem,
              petNome: pet?.nome ?? '',
              petIniciais: pet?.iniciais ?? '',
              petEspecie: pet?.especie ?? null,
              petFotoUrl: pet?.fotoUrl ?? '',
              acompanhante: companheiroDaReserva(hospedagem.reservaId),
              tutorNome: tutor?.nome ?? '',
              tutorTelefone: tutor?.telefone ?? '',
              acomodacaoNome: acomodacao?.nome ?? '',
              blocoId: acomodacao?.blocoId ?? '',
              pendentes: pendentesAgora(tarefas, agora).length,
              atrasadas: atrasadasAgora(tarefas, agora).length,
              ocorrenciaTravada: ocorrenciasTravadas(ocorrenciasDe(hospedagem.id)).length > 0,
              boletimRetido: dataset.boletins.some(
                (item) => item.hospedagemId === hospedagem.id && item.status === 'retido',
              ),
              noites: noitesNaCasa(hospedagem, agora),
              saiHoje: dataDe(hospedagem.saidaPrevistaEm) === hoje,
              proximaEmMinutos: proximaEmMinutos(tarefas, agora),
              foco: focoDe(tarefas, agora),
              rotinaDoDia: diaDaRotina(tarefas, hoje, agora),
            }
          })
          /*
           * Ordena por quem cobra ação, não por nome nem por acomodação. O mapa responde "onde
           * está"; esta lista responde "quem precisa de mim", e uma ordem alfabética desperdiça a
           * única coisa que ela faz melhor que o mapa.
           */
          .sort((um, outro) => {
            const peso = (item: HospedeNaCasa) =>
              (item.ocorrenciaTravada ? 1000 : 0) + item.atrasadas * 100 + item.pendentes * 10

            return peso(outro) - peso(um)
          })
      )
    })
  },

  abrir(hospedagemId: string): Promise<EstadiaDetalhada | null> {
    return simularChamada('hospedagem.abrir', () => {
      const dataset = base()
      const hospedagem = dataset.hospedagens.find((item) => item.id === hospedagemId)

      if (!hospedagem) {
        return null
      }

      const reserva = dataset.reservas.find((item) => item.id === hospedagem.reservaId)
      const ocorrencias = ocorrenciasDe(hospedagemId)

      return {
        hospedagem,
        tarefas: tarefasDe(hospedagemId).sort((um, outro) =>
          um.previstaPara.localeCompare(outro.previstaPara),
        ),
        medicacoes: dataset.medicacoes.filter((item) => item.hospedagemId === hospedagemId),
        diario: dataset.diario
          .filter((item) => item.hospedagemId === hospedagemId)
          .sort((um, outro) => outro.registradoEm.localeCompare(um.registradoEm)),
        ocorrencias: ocorrencias.sort((um, outro) =>
          outro.registradaEm.localeCompare(um.registradaEm),
        ),
        boletins: dataset.boletins
          .filter((item) => item.hospedagemId === hospedagemId)
          .sort((um, outro) => outro.geradoEm.localeCompare(um.geradoEm)),
        impedimentos: impedimentosDeSaida({
          pertences: hospedagem.pertences,
          ocorrencias,
          pesoSaidaKg: hospedagem.pesoSaidaKg,
        }),
        saldoCentavos: reserva?.orcamento.saldoCentavos ?? 0,
        acrescimoDeSaida: cobrancaDaSaida(hospedagem.saidaPrevistaEm, dataset.hotel.politica),
        autorizadosARetirar: reserva?.autorizadosARetirar ?? [],
      }
    })
  },

  /**
   * A prancheta do dia: todas as tarefas de todos os hóspedes.
   *
   * Uma lista só, e não uma por hóspede, porque às 8h alguém alimenta os dezoito — percorrer
   * dezoito fichas é atravessar o corredor dezoito vezes.
   */
  rotina(dia: ISODate = hojeIso()): Promise<TarefaNaPrancheta[]> {
    return simularChamada('rotina.listar', () => {
      garantirHorizonte(dia)

      const emAberto = new Set(
        base()
          .hospedagens.filter((item) => item.status === 'hospedado')
          .map((item) => item.id),
      )

      return tarefasDoDia(base().tarefas, dia)
        .filter((tarefa) => emAberto.has(tarefa.hospedagemId))
        .sort((um, outro) => um.previstaPara.localeCompare(outro.previstaPara))
        .map(decorarTarefa)
    })
  },

  /** O turno corrente e o que ele não fechou. */
  passagem(): Promise<PassagemDeTurno | null> {
    return simularChamada('turno.passar', () => {
      const dataset = base()
      const agora = agoraIso()
      const turno = turnoDe(agora)

      if (!turno) {
        return null
      }

      const emAberto = new Set(
        dataset.hospedagens.filter((item) => item.status === 'hospedado').map((item) => item.id),
      )

      const ordem: Turno['kind'][] = ['manha', 'tarde', 'noite']
      const seguinteKind = ordem[(ordem.indexOf(turno.kind) + 1) % ordem.length]!
      const seguinte = dataset.turnos.find((item) => item.kind === seguinteKind)

      return {
        turno,
        seguinte: {
          kind: seguinteKind,
          responsavelId: seguinte?.responsavelId ?? '',
          inicio: seguinte?.inicio ?? turno.fim,
          fim: seguinte?.fim ?? turno.fim,
        },
        pendencias: {
          tarefas: pendenciasDoTurno(
            dataset.tarefas.filter((tarefa) => emAberto.has(tarefa.hospedagemId)),
            turno.fim,
            agora,
          ).map(decorarTarefa),
          ocorrencias: ocorrenciasTravadas(
            dataset.ocorrencias.filter((item) => emAberto.has(item.hospedagemId)),
          ),
          boletinsRetidos: dataset.boletins.filter(
            (item) => item.status === 'retido' && emAberto.has(item.hospedagemId),
          ),
        },
      }
    })
  },

  // -------------------------------------------------------------------------
  // Check-in
  // -------------------------------------------------------------------------

  /**
   * Transforma reserva em estadia.
   *
   * A regra R1 é aplicada **aqui**, e não no botão: a admissão é reavaliada no instante do
   * check-in, contra a saída prevista, com as dispensas da reserva. Uma reserva aprovada há três
   * semanas pode ter perdido a validade da antirrábica nesse meio-tempo — e é exatamente o caso
   * que a regra existe para pegar.
   */
  checkIn(entrada: {
    reservaId: string
    pesoEntradaKg: number
    inspecaoDeEntrada: string
    pertences: { descricao: string; quantidade: number }[]
    planoAlimentar: PlanoAlimentar
    autorizacoes: Autorizacao[]
    contatoEmergencia: string
    veterinarioDeConfianca: string
    recebidoPor: string
    medicacoes?: Omit<MedicacaoDaEstadia, 'id' | 'hospedagemId'>[]
  }): Promise<Hospedagem> {
    return simularChamada('checkin.executar', () => {
      const dataset = base()
      const reserva = dataset.reservas.find((item) => item.id === entrada.reservaId)

      if (!reserva) {
        throw new AdmissaoBloqueadaError([])
      }

      const pet = dataset.pets.find((item) => item.id === reserva.petId)

      const admissao = avaliarAdmissao({
        exigencias: dataset.exigencias,
        comprovantes: dataset.comprovantes,
        petId: reserva.petId,
        especie: pet?.especie ?? 'canina',
        saidaPrevista: dataDe(reserva.saidaPrevista),
        hoje: hojeIso(),
        dispensas: reserva.dispensas,
      })

      if (!admissao.liberada) {
        throw new AdmissaoBloqueadaError(admissao.impedimentos.map((item) => item.kind))
      }

      const agora = agoraIso()
      const hospedagemId = novoId('hosp')

      const hospedagem: Hospedagem = {
        id: hospedagemId,
        reservaId: reserva.id,
        petId: reserva.petId,
        tutorId: reserva.tutorId,
        acomodacaoId: reserva.acomodacaoId,
        /*
         * A entrada é **agora**, não a prevista. Quem chega às 15h30 de uma reserva marcada para as
         * 15h tem a rotina começando às 15h30 — e a primeira refeição planejada para antes disso
         * não pode nascer atrasada.
         */
        entradaEm: agora,
        saidaPrevistaEm: reserva.saidaPrevista,
        saidaEm: null,
        status: 'hospedado',
        pesoEntradaKg: entrada.pesoEntradaKg,
        pesoSaidaKg: null,
        inspecaoDeEntrada: entrada.inspecaoDeEntrada,
        pertences: entrada.pertences.map<Pertence>((item, indice) => ({
          id: `pert-${hospedagemId}-${indice}`,
          descricao: item.descricao,
          quantidade: item.quantidade,
          devolvido: false,
          observacao: '',
        })),
        planoAlimentar: entrada.planoAlimentar,
        autorizacoes: entrada.autorizacoes,
        contatoEmergencia: entrada.contatoEmergencia,
        veterinarioDeConfianca: entrada.veterinarioDeConfianca,
        adaptacao: 'em-adaptacao',
        observacao: reserva.observacao,
        recebidoPor: entrada.recebidoPor,
        entreguePor: null,
        retiradoPor: '',
      }

      dataset.hospedagens.push(hospedagem)

      const medicacoes = (entrada.medicacoes ?? []).map<MedicacaoDaEstadia>(
        (medicacao, indice) => ({
          ...medicacao,
          id: `med-${hospedagemId}-${indice}`,
          hospedagemId,
        }),
      )

      dataset.medicacoes.push(...medicacoes)

      /*
       * A rotina de hoje e de amanhã nasce junto com a estadia. Hoje porque a próxima refeição
       * precisa existir antes de alguém ir alimentar; amanhã porque quem entra no turno da noite
       * precisa ver o dia seguinte para saber o que entrega.
       */
      const passeioAutorizado = entrada.autorizacoes.some(
        (item) => item.kind === 'passeio-externo' && item.concedida,
      )

      for (const dia of [dataDe(agora), addDays(dataDe(agora), 1)]) {
        const planejadas = planejarDia({
          hospedagemId,
          dia,
          utcOffset: HOTEL_UTC_OFFSET,
          planoAlimentar: entrada.planoAlimentar,
          medicacoes,
          passeioAutorizado,
          entradaEm: agora,
          saidaPrevistaEm: reserva.saidaPrevista,
          /* O que foi vendido vira tarefa: sem isto, o banho é cobrado e ninguém é avisado. */
          servicos: reserva.servicos,
          catalogoDeServicos: dataset.servicos,
          rotinaPadrao: dataset.rotinaPadrao.itens,
        })

        for (const planejada of planejadas) {
          dataset.tarefas.push({
            id: novoId('tarefa'),
            ...planejada,
            status: 'pendente',
            executadaEm: null,
            executadaPor: null,
            turnoId: null,
            observacao: '',
          })
        }
      }

      reserva.status = 'hospedado'
      reserva.atualizadoEm = agora

      return hospedagem
    })
  },

  // -------------------------------------------------------------------------
  // Rotina
  // -------------------------------------------------------------------------

  /**
   * Marca uma tarefa.
   *
   * Devolve a tarefa atualizada e não a lista inteira, de propósito: a prancheta atualiza a linha
   * no lugar, e uma tela que se remonta a cada clique faz quem está no canil perder o dedo de onde
   * estava — exatamente o que a internação aprendeu com o checklist de doses.
   */
  /**
   * O remédio que chegou com o animal, ou que o responsável trouxe no meio da estadia.
   *
   * Existia um buraco: o check-in aceitava medicação, a rotina gerava as doses, a ficha mostrava —
   * mas depois do check-in **não havia porta nenhuma**. O animal que chega às 15h40 com um frasco
   * na sacola esperava o próximo check-in, que nunca vem.
   *
   * **Nenhuma dose nasce no passado.** Registrar às 15h40 um remédio de 08:00 e 20:00 cria a das
   * 20:00 e não cria a das 08:00 — uma dose que nasce já atrasada é uma acusação falsa: diz que a
   * casa falhou com o animal num horário em que a tarefa ainda não existia. Quem decidiu isso foi
   * `reconciliarDia`, e é a mesma regra que vale para tudo o mais.
   *
   * A receita **não trava**. É a mesma decisão que `CheckInDialog` já tomou por escrito: exigir o
   * documento no corredor produz "ok" digitado no campo, ou o animal sem antibiótico. A receita
   * vazia é pendência visível, nunca bloqueio.
   */
  registrarMedicacao(entrada: {
    hospedagemId: string
    descricao: string
    via: ViaDeMedicacao
    doseTexto: string
    horarios: string[]
    receita: string
    observacao: string
  }): Promise<MedicacaoDaEstadia> {
    return simularChamada('medicacao.registrar', () => {
      const dataset = getDataset()
      const agora = agoraIso()
      const hospedagem = dataset.hospedagens.find((item) => item.id === entrada.hospedagemId)!

      const medicacao: MedicacaoDaEstadia = {
        id: novoId('med'),
        hospedagemId: entrada.hospedagemId,
        descricao: entrada.descricao,
        via: entrada.via,
        doseTexto: entrada.doseTexto,
        horarios: entrada.horarios as MedicacaoDaEstadia['horarios'],
        inicio: dataDe(agora),
        fim: null,
        receita: entrada.receita,
        observacao: entrada.observacao,
        suspensaEm: null,
      }

      dataset.medicacoes.push(medicacao)

      /*
       * As doses de hoje e de amanhã, pela **mesma porta** que tudo o mais usa. Esta função já
       * sabe não criar nada no passado e não duplicar o que existe; refazer a conta aqui seria uma
       * segunda regra sobre quando uma tarefa nasce, e duas regras divergem.
       */
      garantirHorizonte(dataDe(agora))
      garantirHorizonte(addDays(dataDe(agora), 1))

      return medicacao
    })
  },

  /**
   * Um cuidado recorrente que **não é remédio**: curativo, compressa, casaco à noite.
   *
   * Existe porque havia um buraco entre três portas. Remédio entra por `registrarMedicacao`, onde
   * dose e via são obrigatórias e a receita é o respaldo. Banho e tosa entram por
   * `acrescentarServico`, que cobra. E água e higiene vêm da rotina da casa, que vale para todos.
   * Trocar um curativo não é nenhuma das três — e sem lugar próprio, esse trabalho ou não era
   * registrado, ou era registrado como medicação: uma linha de remédio sem dose e sem receita no
   * prontuário de um animal, que é o pior dos dois mundos.
   *
   * O que este caminho **não** aceita é dose. A tela diz isso e oferece a porta certa; aqui o tipo
   * simplesmente não tem o campo.
   */
  registrarCuidado(entrada: {
    hospedagemId: string
    descricao: string
    horarios: string[]
    observacao: string
  }): Promise<CuidadoDaEstadia> {
    return simularChamada('cuidado.registrar', () => {
      const dataset = getDataset()
      const agora = agoraIso()

      const cuidado: CuidadoDaEstadia = {
        id: novoId('cuidado'),
        hospedagemId: entrada.hospedagemId,
        descricao: entrada.descricao,
        horarios: entrada.horarios as CuidadoDaEstadia['horarios'],
        inicio: dataDe(agora),
        fim: null,
        observacao: entrada.observacao,
        encerradoEm: null,
      }

      dataset.cuidados.push(cuidado)

      garantirHorizonte(dataDe(agora))
      garantirHorizonte(addDays(dataDe(agora), 1))

      return cuidado
    })
  },

  /**
   * Um serviço vendido **no meio da estadia**: o banho que o responsável pediu por telefone.
   *
   * Duas coisas acontecem, e as duas precisam acontecer juntas. O serviço entra em
   * `reserva.servicos`, que é de onde o orçamento do check-out é recalculado — então ele **é
   * cobrado**, e a tela diz o preço antes de gravar. E ele ganha um dia próprio, porque a geração
   * coloca serviço avulso no primeiro dia inteiro da estadia: sem data, um banho vendido na quarta
   * cairia numa segunda que já passou, e nada nasce no passado. Seria cobrado e nunca feito.
   *
   * A tarefa não é criada aqui: `garantirHorizonte` a materializa a partir do contrato, como faz
   * com todo o resto. Criar à mão abriria uma segunda fonte para a mesma tarefa.
   */
  acrescentarServico(entrada: {
    hospedagemId: string
    servicoId: string
    dia: ISODate
    hora: string
    observacao: string
  }): Promise<void> {
    return simularChamada('servico.acrescentar', () => {
      const dataset = getDataset()
      const hospedagem = dataset.hospedagens.find((item) => item.id === entrada.hospedagemId)!
      const reserva = dataset.reservas.find((item) => item.id === hospedagem.reservaId)
      const servico = dataset.servicos.find((item) => item.id === entrada.servicoId)

      if (!reserva || !servico) {
        return
      }

      reserva.servicos = [
        ...reserva.servicos,
        {
          servicoId: servico.id,
          quantidade: 1,
          /* O preço de hoje, congelado: o reajuste de amanhã não altera o que foi combinado. */
          precoUnitarioCentavos: servico.precoCentavos,
          observacao: entrada.observacao,
          dia: entrada.dia,
          hora: entrada.hora as CuidadoDaEstadia['horarios'][number],
        },
      ]

      reserva.atualizadoEm = agoraIso()

      garantirHorizonte(entrada.dia)
    })
  },

  marcarTarefa(entrada: {
    tarefaId: string
    status: TarefaStatus
    executadaPor: string
    observacao?: string
  }): Promise<TarefaDeRotina> {
    return simularChamada('rotina.marcar', () => {
      const dataset = base()
      const tarefa = dataset.tarefas.find((item) => item.id === entrada.tarefaId)!
      const agora = agoraIso()

      tarefa.status = entrada.status
      tarefa.executadaEm = entrada.status === 'pendente' ? null : agora
      tarefa.executadaPor = entrada.status === 'pendente' ? null : entrada.executadaPor
      tarefa.turnoId = turnoDe(agora)?.id ?? null
      tarefa.observacao = entrada.observacao ?? tarefa.observacao

      return tarefa
    })
  },

  registrarNoDiario(entrada: {
    hospedagemId: string
    kind: RegistroKind
    texto: string
    foto?: string | null
    registradoPor: string
  }): Promise<RegistroDoDiario> {
    return simularChamada('diario.registrar', () => {
      const dataset = base()
      const agora = agoraIso()

      const registro: RegistroDoDiario = {
        id: novoId('diario'),
        hospedagemId: entrada.hospedagemId,
        kind: entrada.kind,
        texto: entrada.texto,
        foto: entrada.foto ?? null,
        registradoEm: agora,
        registradoPor: entrada.registradoPor,
        turnoId: turnoDe(agora)?.id ?? null,
      }

      dataset.diario.push(registro)

      return registro
    })
  },

  // -------------------------------------------------------------------------
  // Ocorrências — R3
  // -------------------------------------------------------------------------

  /**
   * Registra uma ocorrência.
   *
   * `exigeContato` é derivado da gravidade **aqui**, e não recebido de fora. Deixar que a tela
   * decidisse permitiria registrar uma briga com lesão como "grave, mas sem precisar avisar" — que
   * é precisamente a decisão que ninguém deveria poder tomar sozinho às duas da manhã.
   */
  registrarOcorrencia(entrada: {
    hospedagemId: string
    kind: OcorrenciaKind
    gravidade: GravidadeDaOcorrencia
    descricao: string
    conduta: string
    registradaPor: string
    encaminhadaAoVeterinario?: boolean
  }): Promise<Ocorrencia> {
    return simularChamada('ocorrencia.registrar', () => {
      const dataset = base()

      const ocorrencia: Ocorrencia = {
        id: novoId('ocor'),
        hospedagemId: entrada.hospedagemId,
        kind: entrada.kind,
        gravidade: entrada.gravidade,
        descricao: entrada.descricao,
        conduta: entrada.conduta,
        registradaEm: agoraIso(),
        registradaPor: entrada.registradaPor,
        exigeContato: exigeContato(entrada.gravidade),
        contatoEm: null,
        contatoPor: null,
        encaminhadaAoVeterinario: entrada.encaminhadaAoVeterinario ?? false,
      }

      dataset.ocorrencias.push(ocorrencia)

      return ocorrencia
    })
  },

  /** Registra que alguém ligou. É o que destrava o boletim, o turno e a saída. */
  registrarContato(ocorrenciaId: string, contatoPor: string): Promise<Ocorrencia> {
    return simularChamada('ocorrencia.contato', () => {
      const dataset = base()
      const ocorrencia = dataset.ocorrencias.find((item) => item.id === ocorrenciaId)!

      ocorrencia.contatoEm = agoraIso()
      ocorrencia.contatoPor = contatoPor

      /*
       * O boletim retido desta estadia é liberado junto. Exigir dois cliques — um para registrar a
       * ligação, outro para soltar o boletim — produziria a situação em que a casa ligou e o
       * responsável continua sem receber nada.
       */
      for (const boletim of dataset.boletins) {
        if (boletim.hospedagemId === ocorrencia.hospedagemId && boletim.status === 'retido') {
          boletim.contatoEm = ocorrencia.contatoEm
        }
      }

      return ocorrencia
    })
  },

  // -------------------------------------------------------------------------
  // Boletim
  // -------------------------------------------------------------------------

  /**
   * Compõe o boletim do período a partir do que foi registrado.
   *
   * Nasce `retido` quando há ocorrência grave sem contato — R3. O texto é montado do diário e da
   * rotina porque um boletim que alguém precisa escrever do zero é um boletim que não sai nos dias
   * cheios, que são exatamente os dias em que o responsável mais liga.
   */
  gerarBoletim(hospedagemId: string, autorId: string): Promise<Boletim> {
    return simularChamada('boletim.gerar', () => {
      const dataset = base()
      const hospedagem = dataset.hospedagens.find((item) => item.id === hospedagemId)!
      const pet = dataset.pets.find((item) => item.id === hospedagem.petId)
      const agora = agoraIso()
      const desde = maisMinutos(agora, -24 * 60)

      const registros = dataset.diario.filter(
        (item) => item.hospedagemId === hospedagemId && item.registradoEm >= desde,
      )

      const refeicoes = dataset.tarefas.filter(
        (item) =>
          item.hospedagemId === hospedagemId &&
          item.kind === 'refeicao' &&
          item.previstaPara >= desde &&
          item.previstaPara <= agora,
      )

      const comeu = refeicoes.filter((item) => item.status === 'feita').length
      const travadas = ocorrenciasTravadas(ocorrenciasDe(hospedagemId))

      const partes = [
        `${pet?.nome ?? ''} está no ${dataset.hotel.nome}.`,
        refeicoes.length > 0
          ? `Comeu ${comeu} de ${refeicoes.length} refeições nas últimas 24 horas.`
          : '',
        ...registros.slice(0, 3).map((item) => item.texto),
        travadas.length > 0
          ? 'Houve uma ocorrência que precisamos conversar por telefone antes de qualquer coisa.'
          : '',
      ].filter(Boolean)

      const boletim: Boletim = {
        id: novoId('bol'),
        hospedagemId,
        status: travadas.length > 0 ? 'retido' : 'rascunho',
        texto: partes.join(' '),
        fotos: registros
          .map((item) => item.foto)
          .filter((foto): foto is string => Boolean(foto))
          .slice(0, 3),
        geradoEm: agora,
        autorId,
        enviadoEm: null,
        exigeContato: travadas.length > 0,
        contatoEm: null,
      }

      dataset.boletins.push(boletim)

      return boletim
    })
  },

  enviarBoletim(boletimId: string): Promise<Boletim> {
    return simularChamada('boletim.enviar', () => {
      const dataset = base()
      const boletim = dataset.boletins.find((item) => item.id === boletimId)!

      if (!boletimPodeSair(boletim)) {
        throw new BoletimRetidoError()
      }

      boletim.status = 'enviado'
      boletim.enviadoEm = agoraIso()

      return boletim
    })
  },

  // -------------------------------------------------------------------------
  // Passagem de turno
  // -------------------------------------------------------------------------

  /**
   * Entrega o turno.
   *
   * Recusa enquanto houver ocorrência grave sem contato — R3 de novo, no outro extremo: quem entra
   * às 22h não pode herdar uma notícia que o responsável ainda não recebeu, porque a partir dali
   * ninguém mais sabe que ela não foi dada.
   */
  entregarTurno(entrada: { nota: string; recebidoPor: string }): Promise<Turno> {
    return simularChamada('turno.passar', () => {
      const dataset = base()
      const agora = agoraIso()
      const turno = turnoDe(agora)!

      const emAberto = new Set(
        dataset.hospedagens.filter((item) => item.status === 'hospedado').map((item) => item.id),
      )

      const travadas = ocorrenciasTravadas(
        dataset.ocorrencias.filter((item) => emAberto.has(item.hospedagemId)),
      )

      if (travadas.length > 0) {
        throw new PassagemTravadaError(travadas.map((item) => item.id))
      }

      turno.entregueEm = agora
      turno.recebidoPor = entrada.recebidoPor
      turno.notaDePassagem = entrada.nota
      turno.pendenciasEntregues = pendenciasDoTurno(
        dataset.tarefas.filter((tarefa) => emAberto.has(tarefa.hospedagemId)),
        turno.fim,
        agora,
      ).map((tarefa) => tarefa.id)

      return turno
    })
  },

  // -------------------------------------------------------------------------
  // Check-out — R4
  // -------------------------------------------------------------------------

  /** Confere um pertence. Sem devolução, a observação é obrigatória para o check-out fechar. */
  conferirPertence(entrada: {
    hospedagemId: string
    pertenceId: string
    devolvido: boolean
    observacao?: string
  }): Promise<Hospedagem> {
    return simularChamada('hospedagem.abrir', () => {
      const dataset = base()
      const hospedagem = dataset.hospedagens.find((item) => item.id === entrada.hospedagemId)!
      const pertence = hospedagem.pertences.find((item) => item.id === entrada.pertenceId)!

      pertence.devolvido = entrada.devolvido
      pertence.observacao = entrada.observacao ?? pertence.observacao

      return hospedagem
    })
  },

  /**
   * Como o hóspede está se adaptando.
   *
   * O selo nascia `em-adaptacao` no check-in e **não tinha como mudar**: quem sossegou no segundo
   * dia ficava em adaptação até ir embora, e quem começou a estranhar não tinha como ser marcado.
   * A tela de Hóspedes é construída em volta desse selo — deixá-lo imutável a transformava numa
   * lista que mostra sempre a mesma coisa.
   */
  ajustarAdaptacao(hospedagemId: string, adaptacao: Adaptacao): Promise<Hospedagem> {
    return simularChamada('hospedagem.adaptacao', () => {
      const dataset = base()
      const hospedagem = dataset.hospedagens.find((item) => item.id === hospedagemId)!

      hospedagem.adaptacao = adaptacao

      return hospedagem
    })
  },

  /** Registra o peso de saída. É a prova do que aconteceu, e ela some quando o carro sai. */
  pesarNaSaida(hospedagemId: string, pesoKg: number): Promise<Hospedagem> {
    return simularChamada('hospedagem.abrir', () => {
      const dataset = base()
      const hospedagem = dataset.hospedagens.find((item) => item.id === hospedagemId)!

      hospedagem.pesoSaidaKg = pesoKg

      return hospedagem
    })
  },

  /**
   * Fecha a estadia.
   *
   * Recusa com a lista de impedimentos — R4 —, e recalcula o orçamento contra a saída **real**:
   * quem saiu às 16h30 paga a meia diária que a previsão das 12h não tinha. Fechar sem recalcular
   * faria a casa descobrir a diferença no fim do mês, quando não há mais a quem cobrar.
   */
  checkOut(entrada: {
    hospedagemId: string
    entreguePor: string
    retiradoPor: string
  }): Promise<Hospedagem> {
    return simularChamada('hospedagem.checkout', () => {
      const dataset = base()
      const hospedagem = dataset.hospedagens.find((item) => item.id === entrada.hospedagemId)!
      const ocorrencias = ocorrenciasDe(hospedagem.id)

      const impedimentos = impedimentosDeSaida({
        pertences: hospedagem.pertences,
        ocorrencias,
        pesoSaidaKg: hospedagem.pesoSaidaKg,
      })

      if (impedimentos.length > 0) {
        throw new SaidaBloqueadaError(impedimentos)
      }

      const agora = agoraIso()

      hospedagem.saidaEm = agora
      hospedagem.status = 'encerrada'
      hospedagem.entreguePor = entrada.entreguePor
      hospedagem.retiradoPor = entrada.retiradoPor

      /*
       * O peso da balança volta para o cadastro do animal.
       *
       * Ele ficava só na estadia, e o `pet.pesoKg` seguia com o valor de meses atrás — que é
       * justamente o que sugere o peso no próximo check-in e o que a clínica lê. Uma casa que pesa
       * todo hóspede duas vezes e não atualiza o cadastro está jogando fora a medida que tem.
       */
      const hospede = dataset.pets.find((item) => item.id === hospedagem.petId)

      if (hospede && hospedagem.pesoSaidaKg !== null) {
        hospede.pesoKg = hospedagem.pesoSaidaKg
      }

      const reserva = dataset.reservas.find((item) => item.id === hospedagem.reservaId)

      if (reserva) {
        const acomodacao = dataset.acomodacoes.find((item) => item.id === reserva.acomodacaoId)
        const tarifa = dataset.tarifas.find((item) => item.id === acomodacao?.tarifaId)
        const pet = dataset.pets.find((item) => item.id === reserva.petId)
        const acompanhante = reserva.acompanhantePetId
          ? dataset.pets.find((item) => item.id === reserva.acompanhantePetId)
          : null

        if (tarifa) {
          reserva.orcamento = montarOrcamento({
            entrada: hospedagem.entradaEm,
            saida: agora,
            tarifa,
            porte: pet?.porte ?? null,
            porteAcompanhante: acompanhante?.porte ?? null,
            temporadas: dataset.temporadas,
            servicos: reserva.servicos,
            catalogoDeServicos: dataset.servicos,
            politica: dataset.hotel.politica,
            pagoCentavos: reserva.pagoCentavos,
          })
          reserva.diarias = contarDiarias(hospedagem.entradaEm, agora)
        }

        reserva.status = 'encerrada'
        reserva.atualizadoEm = agora
      }

      /*
       * As tarefas futuras da estadia encerrada saem da prancheta. Deixá-las produziria refeições
       * pendentes para um animal que já foi embora — e é assim que se ensina alguém a ignorar a
       * lista de pendências.
       */
      for (const tarefa of dataset.tarefas) {
        if (tarefa.hospedagemId === hospedagem.id && tarefa.status === 'pendente') {
          tarefa.status = 'pulada'
        }
      }

      return hospedagem
    })
  },
}

/** Reexportados: as telas leem a situação da tarefa com a mesma função que o repositório usa. */
export { pertencesPendentes, situacaoDaTarefa }
