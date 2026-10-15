/**
 * O servidor do agendamento online — a parte da API que o app, a página pública e a recepção
 * chamam.
 *
 * Faz o papel do backend nos dois lados do mesmo pedido. O celular do responsável e a página
 * pública falam **só o contrato** (`contrato/responsavel.ts`): é o que chega ao app de verdade, e
 * uma prévia que lesse o registro da clínica mentiria sobre o que o celular vê. A recepção fala os
 * tipos da clínica, como o resto do portal.
 *
 * As regras moram em `domain/pedidos.ts`; aqui fica o que é de servidor: guardar, conferir na hora
 * de gravar (o horário que estava livre há trinta segundos pode não estar mais) e avisar quem pediu.
 */

import {
  TEXTOS_PT_DO_PEDIDO,
  textoPtDaMensagemDoLink,
  type AgendamentoOnlineDaClinica,
  type Agendamento,
  type BuscarDiasParaPedido,
  type CodigoDeErroClinico,
  type CodigoDeErroDoPedido,
  type CriarPedidoDeAgendamento,
  type CriarPedidoPeloLink,
  type DadosDaNotificacaoDoPedido,
  type DiaParaPedido,
  type EmergenciaDaClinica,
  type EspecieNaClinica,
  type MotivoDeRecusaDoPedido,
  type MotivoVisita,
  type OpcaoDeHorario,
  type PedidoDeAgendamento,
  type PedidoPeloLink,
  type ReservaDoPedido,
  type ReservarParaPedido,
  type SexoNaClinica,
  type StatusDoPedidoNoContrato,
} from '../contrato/responsavel'
import { addDays, createClinicClock } from '../domain/clinic-time'
import { materializarBloqueios } from '../domain/conflicts'
import { CAPACIDADE_MINUTOS_POR_PROFISSIONAL } from '../domain/load'
import {
  camposQueFaltam,
  diaFechado,
  estadoDaClinica,
  melhoresOpcoes,
  ocupacoesDosPedidos,
  opcoesDoDia,
  pedidoPerdeuOSentido,
  periodoDe,
  prazoEmExpediente,
  type CampoQueFalta,
  type OpcaoDeHorarioInterna,
  type SugestaoDoPedido,
} from '../domain/pedidos'
import { podeCancelarPeloApp } from '../domain/politica'

import {
  appointmentTypesFixture,
  CLINIC_UTC_OFFSET,
  professionalsFixture,
  roomsFixture,
} from './fixtures'
import { simularChamada } from './mock-runtime'
import {
  projetarAgendamento,
  resumoDaClinica,
  resumoDoProfissional,
  servicoDoTipo,
} from './projecao-do-responsavel'
import { atendimentoNovo } from './repositories/agenda-repository'
import { agoraIso, criarReserva, getDataset, liberarReserva, listarReservas, novoId } from './store'
import type {
  AgendamentoOnline,
  Appointment,
  AvisoDoPedido,
  CadastroMinimo,
  ISODate,
  ISODateTime,
  MotivoDaRecusaDoPedido,
  MotivoDoPedido,
  PedidoDeHorario,
  Pet,
  PetSex,
  PetSpecies,
  PeriodoDoDia,
  Tutor,
} from './types'

const clock = createClinicClock(CLINIC_UTC_OFFSET)

/**
 * Recusa com código estável, como a API: a tela decide pelo código, nunca pelo texto.
 */
export class ErroDoPedido extends Error {
  readonly codigo: CodigoDeErroDoPedido | CodigoDeErroClinico

  constructor(codigo: CodigoDeErroDoPedido | CodigoDeErroClinico) {
    super(`[pedido] ${codigo}`)
    this.name = 'ErroDoPedido'
    this.codigo = codigo
  }
}

// ---------------------------------------------------------------------------
// Ensaio — os casos difíceis que a demonstração liga à mão
// ---------------------------------------------------------------------------

/**
 * "Horário que some enquanto a pessoa preenche, porque outra pegou primeiro."
 *
 * Ligado, o próximo `reservar` encontra o horário tomado — e tomado de verdade: a recepção marca
 * outro paciente ali, por telefone. Voltar à lista mostra o horário sumido, que é o que o
 * responsável veria se alguém tivesse sido mais rápido.
 */
const ensaio = { proximaReservaDisputada: false }

export function disputarProximaReserva(ligado = true) {
  ensaio.proximaReservaDisputada = ligado
}

export function reservaVaiSerDisputada() {
  return ensaio.proximaReservaDisputada
}

// ---------------------------------------------------------------------------
// De-para entre a clínica e o fio
// ---------------------------------------------------------------------------

const MOTIVO_NO_FIO: Record<MotivoDoPedido, MotivoVisita> = {
  checkup: 'CHECKUP',
  sintoma: 'SINTOMA',
  retorno: 'RETORNO',
  exame: 'EXAME',
  vacina: 'VACINA',
  banho: 'OUTRO',
  outro: 'OUTRO',
}

function motivoDaClinica(motivo: MotivoVisita, typeId: string): MotivoDoPedido {
  switch (motivo) {
    case 'CHECKUP':
      return 'checkup'
    case 'SINTOMA':
      return 'sintoma'
    case 'RETORNO':
      return 'retorno'
    case 'EXAME':
      return 'exame'
    case 'VACINA':
      return 'vacina'
    default:
      /* "Outro" com banho escolhido é banho: o motivo do Prisma não tem estética. */
      return tipoDe(typeId).kind === 'banho' ? 'banho' : 'outro'
  }
}

const STATUS_NO_FIO: Record<PedidoDeHorario['status'], StatusDoPedidoNoContrato> = {
  pendente: 'AGUARDANDO_CLINICA',
  aceito: 'ACEITO',
  recusado: 'RECUSADO',
  desistiu: 'CANCELADO_PELO_RESPONSAVEL',
  expirado: 'EXPIRADO',
}

const RECUSA_NO_FIO: Record<MotivoDaRecusaDoPedido, MotivoDeRecusaDoPedido> = {
  'sem-horario': 'SEM_HORARIO',
  'servico-indisponivel': 'SERVICO_INDISPONIVEL',
  'precisa-avaliar': 'PRECISA_AVALIAR',
  emergencia: 'EMERGENCIA',
  outro: 'OUTRO',
}

const ESPECIE_DO_FIO: Record<EspecieNaClinica, PetSpecies> = {
  CANINA: 'canina',
  FELINA: 'felina',
  AVE: 'ave',
  ROEDOR: 'roedor',
  REPTIL: 'reptil',
  EQUINA: 'equina',
}

const SEXO_DO_FIO: Record<SexoNaClinica, PetSex> = { MACHO: 'macho', FEMEA: 'femea' }

const PERIODO_NO_FIO: Record<PeriodoDoDia, 'MANHA' | 'TARDE'> = { manha: 'MANHA', tarde: 'TARDE' }
const PERIODO_DO_FIO = { MANHA: 'manha', TARDE: 'tarde' } as const

// ---------------------------------------------------------------------------
// Leitura do que existe
// ---------------------------------------------------------------------------

function tipoDe(typeId: string) {
  return appointmentTypesFixture.find((item) => item.id === typeId) ?? appointmentTypesFixture[0]!
}

function configuracao(): AgendamentoOnline {
  return getDataset().agendamentoOnline
}

/** O pet onde ele estiver: na clínica, ou só no app de quem a clínica ainda não conhece. */
function petEmQualquerLugar(petId: string): Pet | null {
  const dataset = getDataset()

  return (
    dataset.pets.find((pet) => pet.id === petId) ??
    dataset.contasSoNoApp.flatMap((conta) => conta.pets).find((pet) => pet.id === petId) ??
    null
  )
}

function tutorEmQualquerLugar(tutorId: string): Tutor | null {
  const dataset = getDataset()

  return (
    dataset.tutores.find((tutor) => tutor.id === tutorId) ??
    dataset.contasSoNoApp.find((conta) => conta.tutor.id === tutorId)?.tutor ??
    null
  )
}

/** A clínica já atende este pet? Ainda não, enquanto ele só existe no app. */
function petConhecido(petId: string): boolean {
  return getDataset().pets.some((pet) => pet.id === petId)
}

/** Quem está revisando também ocupa: a reserva de cinco minutos entra na mesma conta. */
function reservasComoAtendimentos(): Appointment[] {
  return listarReservas().map((reserva) => ({
    ...atendimentoNovo(
      {
        petId: `reserva@${reserva.id}`,
        tutorId: '',
        professionalId: reserva.professionalId,
        roomIds: [],
        typeId: 'tipo-consulta',
        inicio: reserva.inicio,
        fim: reserva.fim,
        encaixe: false,
        observacao: '',
        origem: 'app',
      },
      reserva.inicio,
    ),
    id: `reserva@${reserva.id}`,
  }))
}

function contextoDoDia(data: ISODate, ignorarGrupo: string | null = null) {
  const dataset = getDataset()

  return {
    clinic: dataset.clinic,
    clock,
    atendimentos: [
      ...dataset.appointments.filter((item) => clock.dateOf(item.inicio) === data),
      ...ocupacoesDosPedidos(dataset.pedidos, ignorarGrupo),
      ...reservasComoAtendimentos(),
    ],
    bloqueios: materializarBloqueios(dataset.blocks, data, clock),
    tipos: appointmentTypesFixture,
    salas: roomsFixture,
    pets: dataset.pets,
    capacidadeMinutos: CAPACIDADE_MINUTOS_POR_PROFISSIONAL,
  }
}

function aPartirDeAgora(): ISODateTime {
  const agora = clock.now()

  return clock.toIso(agora.date, agora.minutes + configuracao().antecedenciaMinimaHoras * 60)
}

function opcoesDe(
  data: ISODate,
  typeId: string,
  petIds: string[],
  professionalIds: string[],
  ignorarGrupo: string | null = null,
): OpcaoDeHorarioInterna[] {
  return opcoesDoDia(
    {
      data,
      typeId,
      duracaoMinutos: tipoDe(typeId).duracaoMinutos,
      petIds,
      professionalIds,
      aPartirDe: aPartirDeAgora(),
    },
    contextoDoDia(data, ignorarGrupo),
  )
}

function opcaoNoFio(opcao: OpcaoDeHorarioInterna): OpcaoDeHorario {
  return {
    profissional: resumoDoProfissional(opcao.professionalId),
    inicio: opcao.inicio,
    fim: opcao.fim,
    porPet: opcao.porPet.map((trecho) => ({ ...trecho })),
  }
}

// ---------------------------------------------------------------------------
// O lado do responsável — app e página pública
// ---------------------------------------------------------------------------

function emergenciaNoFio(): EmergenciaDaClinica {
  const dataset = getDataset()
  const { emergencia } = configuracao()
  const estado = estadoDaClinica(dataset.clinic, clock)

  return {
    telefone: emergencia.telefone,
    whatsapp: emergencia.whatsapp,
    telefoneDePlantao: emergencia.telefoneDePlantao,
    endereco: dataset.clinic.endereco,
    abertaAgora: estado.abertaAgora,
    fechaAs: estado.fechaAs,
    abreEm: estado.abreEm,
    orientacao: emergencia.orientacao || null,
    idiomaDaOrientacao: emergencia.orientacao ? 'pt-BR' : null,
  }
}

function agendamentoOnlineNoFio(): AgendamentoOnlineDaClinica {
  const dataset = getDataset()
  const config = configuracao()

  return {
    clinica: resumoDaClinica({ dataset }),
    enderecoResumo: dataset.clinic.endereco,
    recebePedidos: config.ativo,
    modos: [
      ...(config.permiteEscolherHorario ? (['HORARIO_ESCOLHIDO'] as const) : []),
      ...(config.permiteMelhorHorario ? (['MELHOR_HORARIO'] as const) : []),
    ],
    prazoDeRespostaHoras: config.prazoDeRespostaHoras,
    antecedenciaMinimaHoras: config.antecedenciaMinimaHoras,
    horizonteDias: config.horizonteDias,
    politica: { ...dataset.politica },
    servicos: config.typeIds.map((typeId) => servicoDoTipo(typeId)),
    profissionais: config.professionalIds.map((id) => resumoDoProfissional(id)),
    emergencia: emergenciaNoFio(),
  }
}

/** O que a reserva segura além do horário: para quem e o quê. */
const detalheDaReserva = new Map<string, { opcao: OpcaoDeHorarioInterna; typeId: string }>()

/** Os pets do pedido, para a conta do conflito. Quem veio pelo link entra com um id de visitante. */
function petsParaConta(petIds: string[]): string[] {
  return petIds.length > 0 ? petIds : ['visitante@link']
}

function diasParaPedido(busca: BuscarDiasParaPedido): DiaParaPedido[] {
  const config = configuracao()

  if (!config.ativo) {
    throw new ErroDoPedido('CLINICA_NAO_RECEBE_PEDIDOS')
  }

  if (!config.permiteEscolherHorario) {
    throw new ErroDoPedido('MODO_INDISPONIVEL')
  }

  const hoje = clock.today()
  const ultimo = addDays(hoje, config.horizonteDias)
  const de = busca.de > hoje ? busca.de : hoje
  const ate = busca.ate < ultimo ? busca.ate : ultimo
  const profissionais = busca.profissionalId ? [busca.profissionalId] : config.professionalIds
  const dias: DiaParaPedido[] = []

  for (let data = de; data <= ate; data = addDays(data, 1)) {
    const fechado = diaFechado(getDataset().clinic, data)

    if (fechado.fechado) {
      dias.push({ data, situacao: 'FECHADA', feriado: fechado.feriado, horarios: [] })
      continue
    }

    const horarios = opcoesDe(data, busca.servicoId, petsParaConta(busca.petIds), profissionais)

    dias.push({
      data,
      situacao: horarios.length > 0 ? 'COM_HORARIO' : 'SEM_HORARIO',
      feriado: null,
      horarios: horarios.map(opcaoNoFio),
    })
  }

  return dias
}

function reservar(entrada: ReservarParaPedido): ReservaDoPedido {
  const dataset = getDataset()
  const petIds = petsParaConta(entrada.petIds)
  const data = clock.dateOf(entrada.inicio)
  const tipo = tipoDe(entrada.servicoId)

  if (ensaio.proximaReservaDisputada) {
    ensaio.proximaReservaDisputada = false

    /* Alguém ligou e a recepção marcou ali — o horário sumiu de verdade, não só para a tela. */
    dataset.appointments.push(
      atendimentoNovo(
        {
          petId: 'pet-bidu',
          tutorId: 'tutor-sergio',
          professionalId: entrada.profissionalId,
          roomIds: [],
          typeId: tipo.id,
          inicio: entrada.inicio,
          fim: clock.toIso(data, clock.minutesOf(entrada.inicio) + tipo.duracaoMinutos),
          encaixe: false,
          observacao: '',
          origem: 'telefone',
        },
        agoraIso(),
      ),
    )

    throw new ErroDoPedido('HORARIO_INDISPONIVEL')
  }

  const opcao = opcoesDe(data, tipo.id, petIds, [entrada.profissionalId]).find(
    (item) => item.inicio === entrada.inicio,
  )

  if (!opcao) {
    throw new ErroDoPedido('HORARIO_INDISPONIVEL')
  }

  const reserva = criarReserva({
    professionalId: opcao.professionalId,
    inicio: opcao.inicio,
    fim: opcao.fim,
  })

  detalheDaReserva.set(reserva.id, { opcao, typeId: tipo.id })

  return { id: reserva.id, opcao: opcaoNoFio(opcao), expiraEm: reserva.expiraEm }
}

function liberar(reservaId: string) {
  liberarReserva(reservaId)
  detalheDaReserva.delete(reservaId)
}

/** O pedido no fio: um por envio, com todos os pets juntos. */
function pedidoNoFio(grupo: PedidoDeHorario[]): PedidoDeAgendamento {
  const dataset = getDataset()
  const [primeiro] = grupo as [PedidoDeHorario, ...PedidoDeHorario[]]
  const ultimo = grupo[grupo.length - 1]!
  const agendamentos = grupo
    .map((pedido) => dataset.appointments.find((item) => item.id === pedido.appointmentId))
    .filter((item): item is Appointment => Boolean(item))

  const horarioPedido: OpcaoDeHorario | null =
    primeiro.modo === 'horario-escolhido' &&
    primeiro.inicio &&
    ultimo.fim &&
    primeiro.professionalId
      ? {
          profissional: resumoDoProfissional(primeiro.professionalId),
          inicio: primeiro.inicio,
          fim: ultimo.fim,
          porPet: grupo.map((pedido) => ({
            petId: pedido.petId ?? '',
            inicio: pedido.inicio!,
            fim: pedido.fim!,
          })),
        }
      : null

  const horarioMarcado: OpcaoDeHorario | null =
    agendamentos.length > 0
      ? {
          profissional: resumoDoProfissional(agendamentos[0]!.professionalId),
          inicio: agendamentos[0]!.inicio,
          fim: agendamentos[agendamentos.length - 1]!.fim,
          porPet: agendamentos.map((item) => ({
            petId: item.petId,
            inicio: item.inicio,
            fim: item.fim,
          })),
        }
      : null

  return {
    id: primeiro.id,
    canal: primeiro.canal === 'link' ? 'LINK_PUBLICO' : 'APP',
    modo: primeiro.modo === 'horario-escolhido' ? 'HORARIO_ESCOLHIDO' : 'MELHOR_HORARIO',
    clinica: resumoDaClinica({ dataset }),
    pets: grupo.map((pedido) => {
      const pet = pedido.petId ? petEmQualquerLugar(pedido.petId) : null

      return {
        id: pedido.petId ?? '',
        nome: pet?.nome ?? pedido.novoCadastro?.petNome ?? '',
        fotoUrl: pet?.fotoUrl || null,
      }
    }),
    servico: servicoDoTipo(primeiro.typeId),
    motivo: MOTIVO_NO_FIO[primeiro.motivo],
    queixa: primeiro.queixa,
    horarioPedido,
    preferencia: primeiro.preferencia
      ? {
          de: primeiro.preferencia.de,
          ate: primeiro.preferencia.ate,
          periodos: primeiro.preferencia.periodos.map((periodo) => PERIODO_NO_FIO[periodo]),
          profissionalId: primeiro.preferencia.professionalId,
        }
      : null,
    status: STATUS_NO_FIO[primeiro.status],
    criadoEm: primeiro.criadoEm,
    responderAte: primeiro.responderAte,
    respondidoEm: primeiro.respondidoEm,
    agendamentoIds: agendamentos.map((item) => item.id),
    horarioMarcado,
    recusa: primeiro.recusa
      ? {
          motivo: RECUSA_NO_FIO[primeiro.recusa.motivo],
          mensagemDaClinica: primeiro.recusa.mensagem,
          idiomaDaMensagem: 'pt-BR',
        }
      : null,
    remarcaAgendamentoId: primeiro.remarcaAppointmentId,
    podeCancelar: primeiro.status === 'pendente',
  }
}

function grupoDe(pedidoId: string): PedidoDeHorario[] {
  const { pedidos } = getDataset()
  const alvo = pedidos.find((pedido) => pedido.id === pedidoId)

  if (!alvo) {
    return []
  }

  return alvo.grupoId ? pedidos.filter((pedido) => pedido.grupoId === alvo.grupoId) : [alvo]
}

/** O que vale para todo pedido, venha do app ou do link. */
function conferirPedido(entrada: Pick<CriarPedidoDeAgendamento, 'modo' | 'servicoId'>) {
  const config = configuracao()

  if (!config.ativo || !config.typeIds.includes(entrada.servicoId)) {
    throw new ErroDoPedido('CLINICA_NAO_RECEBE_PEDIDOS')
  }

  const permitido =
    entrada.modo === 'HORARIO_ESCOLHIDO'
      ? config.permiteEscolherHorario
      : config.permiteMelhorHorario

  if (!permitido) {
    throw new ErroDoPedido('MODO_INDISPONIVEL')
  }
}

type PedidoSemId = Omit<PedidoDeHorario, 'id' | 'grupoId'>

/**
 * Grava o envio: um pedido por pet, juntos no mesmo grupo.
 *
 * A reserva sai junto com o pedido — dali em diante é o próprio pedido que segura o horário, e
 * por todo o prazo de resposta, não só pelos cinco minutos da revisão.
 */
function gravarEnvio(
  entrada: Pick<CriarPedidoDeAgendamento, 'modo' | 'servicoId' | 'reservaId' | 'preferencia'>,
  porPet: Array<Pick<PedidoDeHorario, 'petId' | 'tutorId' | 'novoCadastro'>>,
  comum: Omit<
    PedidoSemId,
    | 'petId'
    | 'tutorId'
    | 'novoCadastro'
    | 'professionalId'
    | 'inicio'
    | 'fim'
    | 'preferencia'
    | 'modo'
    | 'typeId'
  >,
): PedidoDeHorario[] {
  const dataset = getDataset()
  let opcao: OpcaoDeHorarioInterna | null = null

  if (entrada.modo === 'HORARIO_ESCOLHIDO') {
    const reservaViva = listarReservas().some((reserva) => reserva.id === entrada.reservaId)
    const detalhe = entrada.reservaId ? detalheDaReserva.get(entrada.reservaId) : undefined

    if (!reservaViva || !detalhe) {
      throw new ErroDoPedido('RESERVA_EXPIRADA')
    }

    opcao = detalhe.opcao
    liberar(entrada.reservaId!)
  }

  const grupoId = porPet.length > 1 ? novoId('grupo') : null

  const pedidos = porPet.map((pet, indice): PedidoDeHorario => {
    const trecho = opcao?.porPet[indice] ?? null

    return {
      ...comum,
      ...pet,
      id: novoId('pedido'),
      grupoId,
      modo: entrada.modo === 'HORARIO_ESCOLHIDO' ? 'horario-escolhido' : 'melhor-horario',
      typeId: entrada.servicoId,
      professionalId: opcao?.professionalId ?? null,
      inicio: trecho?.inicio ?? null,
      fim: trecho?.fim ?? null,
      preferencia: entrada.preferencia
        ? {
            de: entrada.preferencia.de,
            ate: entrada.preferencia.ate,
            periodos: entrada.preferencia.periodos.map((periodo) => PERIODO_DO_FIO[periodo]),
            professionalId: entrada.preferencia.profissionalId,
          }
        : null,
    }
  })

  dataset.pedidos.push(...pedidos)

  /* Aceite automático: horário escolhido, ainda livre, e a clínica disse que confia. */
  if (configuracao().aceitarSozinho && entrada.modo === 'HORARIO_ESCOLHIDO') {
    aceitarGrupo(pedidos[0]!.id, null, 'automatico')
  }

  return pedidos
}

function camposNoFio(faltam: CampoQueFalta[]) {
  return faltam.map((campo) => (campo === 'nascimento' ? 'NASCIMENTO' : 'SEXO'))
}

function pedirPeloApp(tutorId: string, entrada: CriarPedidoDeAgendamento): PedidoDeAgendamento {
  conferirPedido(entrada)

  if (entrada.petIds.length === 0 || entrada.petIds.length > 3) {
    throw new ErroDoPedido('CADASTRO_INCOMPLETO')
  }

  const tutor = tutorEmQualquerLugar(tutorId)
  const porPet = entrada.petIds.map((petId) => {
    const pet = petEmQualquerLugar(petId)

    if (!pet || pet.tutorId !== tutorId || camposQueFaltam(pet).length > 0) {
      throw new ErroDoPedido('CADASTRO_INCOMPLETO')
    }

    /* Primeira vez: a clínica recebe o que o app sabe, e o cadastro nasce no aceite. */
    const novoCadastro: CadastroMinimo | null = petConhecido(petId)
      ? null
      : {
          nome: tutor?.nome ?? '',
          telefone: tutor?.telefone ?? '',
          petNome: pet.nome,
          especie: pet.especie,
          nascimento: pet.nascimento,
          sexo: pet.sexo,
        }

    return { petId, tutorId, novoCadastro }
  })

  const criadoEm = agoraIso()
  const pedidos = gravarEnvio(entrada, porPet, {
    canal: 'app',
    motivo: motivoDaClinica(entrada.motivo, entrada.servicoId),
    queixa: (entrada.queixa ?? '').trim(),
    remarcaAppointmentId: entrada.remarcaAgendamentoId ?? null,
    status: 'pendente',
    criadoEm,
    responderAte: prazoEmExpediente(
      criadoEm,
      configuracao().prazoDeRespostaHoras,
      getDataset().clinic,
      clock,
    ),
    respondidoEm: null,
    respondidoPor: null,
    appointmentId: null,
    recusa: null,
    compartilhaHistorico: Boolean(entrada.compartilharHistorico),
  })

  return pedidoNoFio(grupoDe(pedidos[0]!.id))
}

function soDigitos(telefone: string): string {
  return telefone.replace(/\D/g, '')
}

/**
 * O pedido de quem não tem o app.
 *
 * O telefone é a chave: quem já é cliente e marcou pelo link não vira um segundo cadastro. Se o
 * telefone bate com um responsável e o nome do pet com um dos dele, é o mesmo paciente; se só o
 * telefone bate, é pet novo de uma casa conhecida.
 */
function pedirPeloLink(entrada: CriarPedidoPeloLink): PedidoPeloLink {
  conferirPedido(entrada)

  const dataset = getDataset()
  const { visitante } = entrada

  if (
    !visitante.nome.trim() ||
    soDigitos(visitante.telefone).length < 10 ||
    !visitante.petNome.trim()
  ) {
    throw new ErroDoPedido('CADASTRO_INCOMPLETO')
  }

  const tutor =
    dataset.tutores.find((item) => soDigitos(item.telefone) === soDigitos(visitante.telefone)) ??
    null
  const pet = tutor
    ? (dataset.pets.find(
        (item) =>
          item.tutorId === tutor.id &&
          item.nome.localeCompare(visitante.petNome.trim(), 'pt-BR', { sensitivity: 'base' }) === 0,
      ) ?? null)
    : null

  const criadoEm = agoraIso()
  const [pedido] = gravarEnvio(
    entrada,
    [
      {
        petId: pet?.id ?? null,
        tutorId: tutor?.id ?? null,
        novoCadastro: pet
          ? null
          : {
              nome: visitante.nome.trim(),
              telefone: visitante.telefone.trim(),
              petNome: visitante.petNome.trim(),
              especie: ESPECIE_DO_FIO[visitante.especie],
              nascimento: visitante.nascimento ?? null,
              sexo: visitante.sexo ? SEXO_DO_FIO[visitante.sexo] : null,
            },
      },
    ],
    {
      canal: 'link',
      motivo: motivoDaClinica(entrada.motivo, entrada.servicoId),
      queixa: (entrada.queixa ?? '').trim(),
      remarcaAppointmentId: null,
      status: 'pendente',
      criadoEm,
      responderAte: prazoEmExpediente(
        criadoEm,
        configuracao().prazoDeRespostaHoras,
        dataset.clinic,
        clock,
      ),
      respondidoEm: null,
      respondidoPor: null,
      appointmentId: null,
      recusa: null,
      compartilhaHistorico: false,
    },
  )

  const token = novoId('lk').split('-').slice(0, 2).join('')

  dataset.tokensDoLink[pedido!.id] = token

  return { ...pedidoNoFio(grupoDe(pedido!.id)), token }
}

function pedidosDoResponsavel(tutorId: string): PedidoDeAgendamento[] {
  const { pedidos } = getDataset()
  const vistos = new Set<string>()
  const meus: PedidoDeAgendamento[] = []

  expirarOsQuePerderamOSentido()

  for (const pedido of [...pedidos].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))) {
    const chave = pedido.grupoId ?? pedido.id

    if (pedido.tutorId !== tutorId || vistos.has(chave)) {
      continue
    }

    vistos.add(chave)
    meus.push(pedidoNoFio(grupoDe(pedido.id)))
  }

  return meus
}

function pedidoPorToken(token: string): PedidoPeloLink | null {
  const entrada = Object.entries(getDataset().tokensDoLink).find(([, valor]) => valor === token)

  if (!entrada) {
    return null
  }

  expirarOsQuePerderamOSentido()

  return { ...pedidoNoFio(grupoDe(entrada[0])), token }
}

function cancelarPedido(pedidoId: string): PedidoDeAgendamento {
  const grupo = grupoDe(pedidoId)

  if (grupo.length === 0 || grupo.some((pedido) => pedido.status !== 'pendente')) {
    throw new ErroDoPedido('PEDIDO_JA_RESPONDIDO')
  }

  const agora = agoraIso()

  for (const pedido of grupo) {
    pedido.status = 'desistiu'
    pedido.respondidoEm = agora
  }

  return pedidoNoFio(grupo)
}

const TEXTOS_DA_PROJECAO = {
  emInvestigacao: '',
  sinaisDeAlerta: '',
  tituloDoDocumento: { RECEITUARIO: '', ORIENTACOES: '', PEDIDO_EXAME: '' },
}

/** Os horários que vão acontecer, dos pets desta pessoa. */
function agendamentosDoResponsavel(tutorId: string): Agendamento[] {
  const dataset = getDataset()
  const agora = agoraIso()
  const meusPets = new Set(
    dataset.pets.filter((pet) => pet.tutorId === tutorId).map((pet) => pet.id),
  )

  return dataset.appointments
    .filter(
      (item) =>
        meusPets.has(item.petId) &&
        Date.parse(item.fim) > Date.parse(agora) &&
        item.status !== 'cancelado' &&
        item.status !== 'falta',
    )
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
    .map((item) =>
      projetarAgendamento(item, { dataset, tutorId, agora, textos: TEXTOS_DA_PROJECAO }),
    )
}

function cancelarAgendamento(tutorId: string, agendamentoId: string): Agendamento {
  const dataset = getDataset()
  const alvo = dataset.appointments.find((item) => item.id === agendamentoId)
  const agora = agoraIso()

  if (!alvo || petEmQualquerLugar(alvo.petId)?.tutorId !== tutorId) {
    throw new ErroDoPedido('AGENDAMENTO_ENCERRADO')
  }

  if (!podeCancelarPeloApp(alvo, dataset.politica, agora, clock.utcOffset)) {
    throw new ErroDoPedido('FORA_DO_PRAZO_DE_CANCELAMENTO')
  }

  alvo.status = 'cancelado'
  alvo.canceladoEm = agora
  alvo.motivoCancelamento = 'responsavel-desmarcou'
  alvo.atualizadoEm = agora

  return projetarAgendamento(alvo, { dataset, tutorId, agora, textos: TEXTOS_DA_PROJECAO })
}

/**
 * Completa o pet no app: o "cadastro incompleto" resolvido no próprio fluxo, sem mandar a pessoa
 * para outra tela e perder o que ela já escolheu.
 */
function completarPet(
  tutorId: string,
  petId: string,
  dados: { nascimento: ISODate | null; sexo: PetSex | null },
): { faltam: ReturnType<typeof camposNoFio> } {
  const pet = petEmQualquerLugar(petId)

  if (!pet || pet.tutorId !== tutorId) {
    throw new ErroDoPedido('CADASTRO_INCOMPLETO')
  }

  pet.nascimento = dados.nascimento ?? pet.nascimento
  pet.sexo = dados.sexo ?? pet.sexo

  return { faltam: camposNoFio(camposQueFaltam(pet)) }
}

/** Os pets da conta, como o app os tem — inclusive os que a clínica ainda não conhece. */
export type PetDaConta = {
  id: string
  nome: string
  especie: PetSpecies
  fotoUrl: string | null
  /** O que falta para pedir horário. Vazio: pode pedir. */
  faltam: CampoQueFalta[]
  /** Em internação nesta clínica: não se marca consulta para quem está lá dentro. */
  internado: boolean
  /** A clínica já atende. Falso é a primeira consulta. */
  conhecidoPelaClinica: boolean
}

function petsDaConta(tutorId: string): PetDaConta[] {
  const dataset = getDataset()
  const daClinica = dataset.pets.filter((pet) => pet.tutorId === tutorId)
  const soNoApp = dataset.contasSoNoApp
    .filter((conta) => conta.tutor.id === tutorId)
    .flatMap((conta) => conta.pets)
    .filter((pet) => !daClinica.some((item) => item.id === pet.id))

  return [...daClinica, ...soNoApp].map((pet) => ({
    id: pet.id,
    nome: pet.nome,
    especie: pet.especie,
    fotoUrl: pet.fotoUrl || null,
    faltam: camposQueFaltam(pet),
    internado: dataset.internacao.internacoes.some(
      (item) => item.petId === pet.id && item.status === 'internado',
    ),
    conhecidoPelaClinica: daClinica.some((item) => item.id === pet.id),
  }))
}

function avisosDoResponsavel(tutorId: string): AvisoDoPedido[] {
  return getDataset()
    .avisosDoPedido.filter((aviso) => aviso.tutorId === tutorId)
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
}

/**
 * O que o app e a página pública chamam. Cada função paga a latência do mock, como a API pagaria
 * a da rede — o fluxo precisa aguentar a espera entre um toque e a resposta.
 */
export const agendamentoOnlineDoResponsavel = {
  clinica: () => simularChamada('pedido.horarios', agendamentoOnlineNoFio),
  emergencia: () => simularChamada('pedido.horarios', emergenciaNoFio),
  dias: (busca: BuscarDiasParaPedido) =>
    simularChamada('pedido.horarios', () => diasParaPedido(busca)),
  reservar: (entrada: ReservarParaPedido) =>
    simularChamada('pedido.enviar', () => reservar(entrada)),
  liberar: (reservaId: string) => simularChamada('pedido.enviar', () => liberar(reservaId)),
  pedir: (tutorId: string, entrada: CriarPedidoDeAgendamento) =>
    simularChamada('pedido.enviar', () => pedirPeloApp(tutorId, entrada)),
  pedirPeloLink: (entrada: CriarPedidoPeloLink) =>
    simularChamada('pedido.enviar', () => pedirPeloLink(entrada)),
  pedidos: (tutorId: string) =>
    simularChamada('pedido.horarios', () => pedidosDoResponsavel(tutorId)),
  pedidoPorToken: (token: string) => simularChamada('pedido.horarios', () => pedidoPorToken(token)),
  cancelarPedido: (pedidoId: string) =>
    simularChamada('pedido.enviar', () => cancelarPedido(pedidoId)),
  agendamentos: (tutorId: string) =>
    simularChamada('pedido.horarios', () => agendamentosDoResponsavel(tutorId)),
  cancelarAgendamento: (tutorId: string, agendamentoId: string) =>
    simularChamada('pedido.enviar', () => cancelarAgendamento(tutorId, agendamentoId)),
  completarPet: (
    tutorId: string,
    petId: string,
    dados: { nascimento: ISODate | null; sexo: PetSex | null },
  ) => simularChamada('pedido.enviar', () => completarPet(tutorId, petId, dados)),
  /** Síncronas: a conta do app já está no aparelho, e o aviso chega por push, sem pedir. */
  petsDaConta,
  avisos: avisosDoResponsavel,
  tutor: (tutorId: string) => tutorEmQualquerLugar(tutorId),
}

// ---------------------------------------------------------------------------
// O lado da clínica — a caixa de pedidos da recepção
// ---------------------------------------------------------------------------

/** O pedido que perdeu o sentido sai da fila de trabalho: o horário passou, a janela acabou. */
function expirarOsQuePerderamOSentido() {
  const agora = agoraIso()

  for (const pedido of getDataset().pedidos) {
    if (pedidoPerdeuOSentido(pedido, agora)) {
      pedido.status = 'expirado'
    }
  }
}

function chaveDoGrupo(grupo: PedidoDeHorario[]): string {
  return grupo[0]!.grupoId ?? grupo[0]!.id
}

/** O horário que o responsável escolheu continua livre — tirando o próprio pedido da conta? */
function horarioEscolhidoLivre(grupo: PedidoDeHorario[]): boolean {
  const [primeiro] = grupo

  if (
    !primeiro ||
    primeiro.modo !== 'horario-escolhido' ||
    !primeiro.inicio ||
    !primeiro.professionalId
  ) {
    return false
  }

  const data = clock.dateOf(primeiro.inicio)
  const petIds = grupo.map((pedido) => pedido.petId ?? `novo@${pedido.id}`)
  const opcoes = opcoesDoDia(
    {
      data,
      typeId: primeiro.typeId,
      duracaoMinutos: tipoDe(primeiro.typeId).duracaoMinutos,
      petIds,
      professionalIds: [primeiro.professionalId],
      /* A recepção pode aceitar dentro da antecedência: quem não pode é o app oferecer. */
      aPartirDe: agoraIso(),
    },
    contextoDoDia(data, chaveDoGrupo(grupo)),
  )

  return opcoes.some((opcao) => opcao.inicio === primeiro.inicio)
}

/** Quem atendeu este pet por último aqui. É a continuidade que a sugestão favorece. */
function profissionalDaCasa(petId: string | null): string | null {
  if (!petId) {
    return null
  }

  const anteriores = getDataset()
    .appointments.filter((item) => item.petId === petId && item.status === 'finalizado')
    .sort((a, b) => b.inicio.localeCompare(a.inicio))

  return anteriores[0]?.professionalId ?? null
}

function sugestoesPara(grupo: PedidoDeHorario[], limite: number): SugestaoDoPedido[] {
  const [primeiro] = grupo

  if (!primeiro) {
    return []
  }

  const config = configuracao()
  const hoje = clock.today()
  const petIds = grupo.map((pedido) => pedido.petId ?? `novo@${pedido.id}`)
  const tipo = tipoDe(primeiro.typeId)

  /*
   * Horário escolhido que não serve mais: a busca começa no dia que a pessoa escolheu e no mesmo
   * período, e favorece quem ela escolheu — é a alternativa mais parecida com o que ela pediu.
   */
  const preferencia =
    primeiro.modo === 'horario-escolhido' && primeiro.inicio
      ? {
          de: clock.dateOf(primeiro.inicio),
          ate: addDays(clock.dateOf(primeiro.inicio), 2),
          periodos: [periodoDe(clock.minutesOf(primeiro.inicio))],
          professionalId: null,
        }
      : (primeiro.preferencia ?? {
          de: hoje,
          ate: addDays(hoje, 7),
          periodos: [],
          professionalId: null,
        })

  const daCasa =
    primeiro.modo === 'horario-escolhido'
      ? primeiro.professionalId
      : profissionalDaCasa(primeiro.petId)

  return melhoresOpcoes(
    {
      typeId: tipo.id,
      duracaoMinutos: tipo.duracaoMinutos,
      petIds,
      professionalIds: config.professionalIds,
      aPartirDe: agoraIso(),
      preferencia,
      hoje,
      profissionalDaCasa: daCasa,
      limite,
      alemDaJanelaDias: 14,
      alvoEmMinutos:
        primeiro.modo === 'horario-escolhido' && primeiro.inicio
          ? clock.minutesOf(primeiro.inicio)
          : null,
    },
    contextoDoDia(hoje, chaveDoGrupo(grupo)),
    (data, professionalIds) =>
      opcoesDoDia(
        {
          data,
          typeId: tipo.id,
          duracaoMinutos: tipo.duracaoMinutos,
          petIds,
          professionalIds,
          aPartirDe: agoraIso(),
        },
        contextoDoDia(data, chaveDoGrupo(grupo)),
      ),
  )
}

/** Um dia do calendário da recepção, com os horários que servem ao pedido. */
export type DiaDaAgendaDoPedido = {
  data: ISODate
  situacao: 'livre' | 'cheio' | 'fechado'
  feriado: string | null
  horarios: OpcaoDeHorarioInterna[]
}

/**
 * O calendário que a recepção vê ao responder: de `de` a `ate`, cada dia com os horários livres de
 * todos os profissionais para o serviço e os pets do pedido.
 *
 * Conta a partir de agora, não da antecedência do app: a antecedência é regra de quem pede, e a
 * recepção pode encaixar daqui a uma hora. O próprio pedido sai da conta — o horário que ele
 * segura é dele.
 */
function agendaDoPedido(pedidoId: string, de: ISODate, ate: ISODate): DiaDaAgendaDoPedido[] {
  const grupo = grupoDe(pedidoId)
  const [primeiro] = grupo

  if (!primeiro) {
    return []
  }

  const config = configuracao()
  const tipo = tipoDe(primeiro.typeId)
  const petIds = grupo.map((pedido) => pedido.petId ?? `novo@${pedido.id}`)
  const hoje = clock.today()
  const dias: DiaDaAgendaDoPedido[] = []

  for (let data = de < hoje ? hoje : de; data <= ate; data = addDays(data, 1)) {
    const fechado = diaFechado(getDataset().clinic, data)

    if (fechado.fechado) {
      dias.push({ data, situacao: 'fechado', feriado: fechado.feriado, horarios: [] })
      continue
    }

    const horarios = opcoesDoDia(
      {
        data,
        typeId: tipo.id,
        duracaoMinutos: tipo.duracaoMinutos,
        petIds,
        professionalIds: config.professionalIds,
        aPartirDe: agoraIso(),
      },
      contextoDoDia(data, chaveDoGrupo(grupo)),
    )

    dias.push({
      data,
      situacao: horarios.length > 0 ? 'livre' : 'cheio',
      feriado: null,
      horarios,
    })
  }

  return dias
}

/** A sala onde o atendimento cabe: a do profissional, se servir; senão a primeira compatível. */
function salaPara(professionalId: string, typeId: string): string[] {
  const tipo = tipoDe(typeId)
  const padrao = professionalsFixture.find((item) => item.id === professionalId)?.salaPadraoId
  const salaPadrao = roomsFixture.find((sala) => sala.id === padrao)

  if (
    salaPadrao &&
    (tipo.salasCompativeis.length === 0 || tipo.salasCompativeis.includes(salaPadrao.kind))
  ) {
    return [salaPadrao.id]
  }

  const compativel = roomsFixture.find((sala) => tipo.salasCompativeis.includes(sala.kind))

  return compativel ? [compativel.id] : []
}

/**
 * O pet que a clínica ainda não conhece entra no cadastro agora.
 *
 * Do app, entram o responsável e o pet como estão lá (mesmos ids: é o vínculo nascendo). Do link,
 * nasce um cadastro novo — ou um pet novo numa casa conhecida, quando o telefone bateu.
 */
function cadastrarSePreciso(pedido: PedidoDeHorario) {
  const dataset = getDataset()

  if (
    !pedido.novoCadastro ||
    (pedido.petId && dataset.pets.some((pet) => pet.id === pedido.petId))
  ) {
    return
  }

  const conta = dataset.contasSoNoApp.find((item) => item.tutor.id === pedido.tutorId)

  if (conta && pedido.petId) {
    if (!dataset.tutores.some((tutor) => tutor.id === conta.tutor.id)) {
      dataset.tutores.push({ ...conta.tutor })
    }

    const pet = conta.pets.find((item) => item.id === pedido.petId)

    if (pet) {
      dataset.pets.push({ ...pet, alertas: [...pet.alertas] })
    }

    return
  }

  const cadastro = pedido.novoCadastro
  let tutorId = pedido.tutorId

  if (!tutorId) {
    tutorId = novoId('tutor')
    dataset.tutores.push({
      id: tutorId,
      nome: cadastro.nome,
      telefone: cadastro.telefone,
      telefoneSecundario: '',
      email: '',
      documento: '',
      preferenciaContato: 'whatsapp',
      endereco: null,
    })
  }

  const petId = novoId('pet')
  /* Duas letras, como no resto do cadastro: as duas primeiras quando o nome é uma palavra só. */
  const partes = cadastro.petNome.trim().split(/\s+/)
  const iniciais = (
    partes.length > 1 ? partes.map((parte) => parte[0] ?? '').join('') : (partes[0] ?? '')
  )
    .slice(0, 2)
    .toUpperCase()

  dataset.pets.push({
    id: petId,
    nome: cadastro.petNome,
    especie: cadastro.especie,
    raca: '',
    sexo: cadastro.sexo,
    nascimento: cadastro.nascimento,
    castrado: false,
    porte: null,
    pesoKg: null,
    microchip: '',
    pelagem: '',
    tutorId,
    alertas: [],
    iniciais: iniciais || '?',
    fotoUrl: '',
  })

  pedido.tutorId = tutorId
  pedido.petId = petId
}

function avisar(
  grupo: PedidoDeHorario[],
  tipo: AvisoDoPedido['tipo'],
  atendimentos: Appointment[],
) {
  const dataset = getDataset()
  const [primeiro] = grupo as [PedidoDeHorario, ...PedidoDeHorario[]]
  const tutor = primeiro.tutorId ? tutorEmQualquerLugar(primeiro.tutorId) : null
  const dados: DadosDaNotificacaoDoPedido = {
    url: '',
    tipo:
      tipo === 'aceito'
        ? 'PEDIDO_ACEITO'
        : tipo === 'marcado'
          ? 'PEDIDO_MARCADO_PELA_CLINICA'
          : 'PEDIDO_RECUSADO',
    pedidoId: primeiro.id,
    petNomes: grupo.map(
      (pedido) =>
        (pedido.petId ? petEmQualquerLugar(pedido.petId)?.nome : null) ??
        pedido.novoCadastro?.petNome ??
        '',
    ),
    clinicaNome: dataset.clinic.nome,
    inicio: atendimentos[0]?.inicio ?? null,
    profissionalNome: atendimentos[0]
      ? (professionalsFixture.find((item) => item.id === atendimentos[0]!.professionalId)?.nome ??
        null)
      : null,
    mensagemDaClinica: primeiro.recusa?.mensagem ?? null,
    idiomaDaMensagem: primeiro.recusa ? 'pt-BR' : null,
  }
  const texto = TEXTOS_PT_DO_PEDIDO[dados.tipo](dados)
  const token = dataset.tokensDoLink[primeiro.id]

  dataset.avisosDoPedido.push({
    id: novoId('aviso'),
    pedidoId: primeiro.id,
    tutorId: primeiro.canal === 'app' ? primeiro.tutorId : null,
    canal: primeiro.canal,
    telefone: tutor?.telefone ?? primeiro.novoCadastro?.telefone ?? '',
    tipo,
    criadoEm: agoraIso(),
    titulo: texto.titulo,
    corpo:
      primeiro.canal === 'link' && token
        ? textoPtDaMensagemDoLink(dados, `/agendar/${configuracao().slug}?pedido=${token}`)
        : texto.corpo,
  })
}

/**
 * Aceita o grupo — no horário escolhido, ou no que a recepção escolheu no lugar.
 *
 * Confere de novo antes de gravar: o horário estava livre quando a linha apareceu, mas a agenda
 * não parou enquanto alguém lia a queixa.
 */
function aceitarGrupo(
  pedidoId: string,
  escolha: { professionalId: string; inicio: ISODateTime } | null,
  por: 'recepcao' | 'automatico',
): Appointment[] {
  const dataset = getDataset()
  const grupo = grupoDe(pedidoId)
  const [primeiro] = grupo

  if (!primeiro || grupo.some((pedido) => pedido.status !== 'pendente')) {
    throw new ErroDoPedido('PEDIDO_JA_RESPONDIDO')
  }

  const tipo = tipoDe(primeiro.typeId)
  let trechos: Array<{ inicio: ISODateTime; fim: ISODateTime }>
  let professionalId: string

  if (escolha) {
    const data = clock.dateOf(escolha.inicio)
    const petIds = grupo.map((pedido) => pedido.petId ?? `novo@${pedido.id}`)
    const opcao = opcoesDoDia(
      {
        data,
        typeId: tipo.id,
        duracaoMinutos: tipo.duracaoMinutos,
        petIds,
        professionalIds: [escolha.professionalId],
        aPartirDe: agoraIso(),
      },
      contextoDoDia(data, chaveDoGrupo(grupo)),
    ).find((item) => item.inicio === escolha.inicio)

    if (!opcao) {
      throw new ErroDoPedido('HORARIO_INDISPONIVEL')
    }

    trechos = opcao.porPet
    professionalId = escolha.professionalId
  } else {
    if (!horarioEscolhidoLivre(grupo)) {
      throw new ErroDoPedido('HORARIO_INDISPONIVEL')
    }

    trechos = grupo.map((pedido) => ({ inicio: pedido.inicio!, fim: pedido.fim! }))
    professionalId = primeiro.professionalId!
  }

  const agora = agoraIso()
  const atendimentos: Appointment[] = []

  grupo.forEach((pedido, indice) => {
    cadastrarSePreciso(pedido)

    const trecho = trechos[indice]!
    const remarcado = pedido.remarcaAppointmentId
      ? dataset.appointments.find((item) => item.id === pedido.remarcaAppointmentId)
      : undefined

    if (remarcado) {
      remarcado.inicio = trecho.inicio
      remarcado.fim = trecho.fim
      remarcado.professionalId = professionalId
      remarcado.status = 'agendado'
      remarcado.confirmacao = null
      remarcado.atualizadoEm = agora
      atendimentos.push(remarcado)
    } else {
      const novo = atendimentoNovo(
        {
          petId: pedido.petId!,
          tutorId: pedido.tutorId!,
          professionalId,
          roomIds: salaPara(professionalId, tipo.id),
          typeId: tipo.id,
          inicio: trecho.inicio,
          fim: trecho.fim,
          encaixe: false,
          observacao: pedido.queixa,
          origem: pedido.canal,
        },
        agora,
      )

      dataset.appointments.push(novo)
      atendimentos.push(novo)
    }

    pedido.status = 'aceito'
    pedido.respondidoEm = agora
    pedido.respondidoPor = por
    pedido.appointmentId = atendimentos[atendimentos.length - 1]!.id

    /* A primeira vez com o histórico liberado vira o consentimento que o resto do portal lê. */
    if (pedido.compartilhaHistorico && pedido.tutorId) {
      const existente = dataset.consentimentos.find((item) => item.tutorId === pedido.tutorId)

      if (existente) {
        existente.diarioCompleto = true
        existente.peso = true
        existente.atualizadoEm = agora
      } else {
        dataset.consentimentos.push({
          tutorId: pedido.tutorId,
          diarioCompleto: true,
          peso: true,
          notas: false,
          atualizadoEm: agora,
        })
      }
    }
  })

  const mudouOHorario =
    primeiro.modo === 'melhor-horario' ||
    (escolha !== null &&
      (escolha.inicio !== primeiro.inicio || escolha.professionalId !== primeiro.professionalId))

  avisar(grupo, mudouOHorario ? 'marcado' : 'aceito', atendimentos)

  return atendimentos
}

function recusarGrupo(pedidoId: string, motivo: MotivoDaRecusaDoPedido, mensagem: string) {
  const grupo = grupoDe(pedidoId)

  if (grupo.length === 0 || grupo.some((pedido) => pedido.status !== 'pendente')) {
    throw new ErroDoPedido('PEDIDO_JA_RESPONDIDO')
  }

  const agora = agoraIso()

  for (const pedido of grupo) {
    pedido.status = 'recusado'
    pedido.respondidoEm = agora
    pedido.respondidoPor = 'recepcao'
    pedido.recusa = { motivo, mensagem: mensagem.trim() }
  }

  avisar(grupo, 'recusado', [])

  return grupo.map((pedido) => ({ ...pedido }))
}

/** Uma linha da caixa de pedidos: o grupo, e o que a recepção precisa saber para responder. */
export type PedidoNaCaixa = {
  chave: string
  pedidos: PedidoDeHorario[]
  /** Horário escolhido ainda livre. Sempre `false` no pedido de melhor horário. */
  horarioLivre: boolean
  /** A melhor alternativa: o horário a oferecer quando o escolhido não serve, ou o melhor horário. */
  sugestao: SugestaoDoPedido | null
  /** Código do link, para a recepção dizer ao telefone se a pessoa ligar perguntando. */
  token: string | null
  /** O horário que o aceite gravou — o histórico diz quando ficou marcado. */
  marcado: { inicio: ISODateTime; professionalId: string } | null
}

function caixaDePedidos(): PedidoNaCaixa[] {
  const dataset = getDataset()

  expirarOsQuePerderamOSentido()

  const grupos = new Map<string, PedidoDeHorario[]>()

  for (const pedido of dataset.pedidos) {
    const chave = pedido.grupoId ?? pedido.id

    grupos.set(chave, [...(grupos.get(chave) ?? []), pedido])
  }

  return [...grupos.entries()].map(([chave, grupo]) => {
    const ordenado = [...grupo].sort((a, b) => (a.inicio ?? '').localeCompare(b.inicio ?? ''))
    const pendente = ordenado[0]!.status === 'pendente'
    const livre = pendente && horarioEscolhidoLivre(ordenado)
    const atendimento = dataset.appointments.find((item) => item.id === ordenado[0]!.appointmentId)

    return {
      chave,
      pedidos: ordenado.map((pedido) => ({ ...pedido })),
      horarioLivre: livre,
      sugestao: pendente && !livre ? (sugestoesPara(ordenado, 1)[0] ?? null) : null,
      token: dataset.tokensDoLink[ordenado[0]!.id] ?? null,
      marcado: atendimento
        ? { inicio: atendimento.inicio, professionalId: atendimento.professionalId }
        : null,
    }
  })
}

export const pedidoRepository = {
  listar: () => simularChamada('pedido.listar', caixaDePedidos),
  sugestoes: (pedidoId: string, limite = 6) =>
    simularChamada('pedido.listar', () => sugestoesPara(grupoDe(pedidoId), limite)),
  agenda: (pedidoId: string, de: ISODate, ate: ISODate) =>
    simularChamada('pedido.listar', () => agendaDoPedido(pedidoId, de, ate)),
  aceitar: (
    pedidoId: string,
    escolha: { professionalId: string; inicio: ISODateTime } | null = null,
  ) => simularChamada('pedido.responder', () => aceitarGrupo(pedidoId, escolha, 'recepcao')),
  recusar: (pedidoId: string, motivo: MotivoDaRecusaDoPedido, mensagem: string) =>
    simularChamada('pedido.responder', () => recusarGrupo(pedidoId, motivo, mensagem)),
  configuracao: (): AgendamentoOnline => structuredClone(configuracao()),
  /** O nome e o endereço que a página pública mostra — e que vão no texto de divulgação. */
  clinica: () => {
    const { clinic } = getDataset()

    return { nome: clinic.nome, telefone: clinic.telefone, endereco: clinic.endereco }
  },
  salvarConfiguracao: (nova: AgendamentoOnline) =>
    simularChamada('pedido.responder', () => {
      /* JSON, e não `structuredClone`: o que chega da tela pode ser um proxy reativo. */
      getDataset().agendamentoOnline = JSON.parse(JSON.stringify(nova)) as AgendamentoOnline

      return JSON.parse(JSON.stringify(nova)) as AgendamentoOnline
    }),
  /** Quantos esperam resposta — o selo do menu. Passa pela rede como as outras fontes do selo. */
  pendentes: (): Promise<PedidoDeHorario[]> =>
    simularChamada('pedido.listar', () => {
      expirarOsQuePerderamOSentido()

      return getDataset().pedidos.filter((pedido) => pedido.status === 'pendente')
    }),
}
