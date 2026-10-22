/**
 * Os pedidos de horário que a recepção encontra ao abrir a tela.
 *
 * Cada um está aqui por um motivo, e juntos cobrem o que a tela precisa mostrar sem ninguém
 * encenar nada:
 *
 * - **Thor** — horário escolhido, ainda livre. É o aceite de um clique.
 * - **Nina e Oliver** — a mesma casa, dois pets seguidos com a mesma veterinária. É o grupo que
 *   se responde de uma vez.
 * - **Tobias** — veio pelo link, de quem não tem o app: cadastro mínimo, primeira consulta, e o
 *   pedido de melhor horário ("de manhã, esta semana").
 * - **Luna** — o horário que ela escolheu foi ocupado pela recepção, por telefone, depois do
 *   pedido. É o caso difícil do horário que some — visto do lado da clínica.
 * - **Zeus** e **Simba** — respondidos hoje, um aceito e um recusado, para o histórico existir.
 *
 * A Fátima (três pets) e a Renata (um pet que a clínica nunca viu, com o cadastro do app
 * incompleto) ficam de fora de propósito: são as duas pessoas que a demonstração usa no celular.
 */

import { materializarBloqueios } from '../domain/conflicts'
import { addDays, createClinicClock, type ClinicClock } from '../domain/clinic-time'
import { CAPACIDADE_MINUTOS_POR_PROFISSIONAL } from '../domain/load'
import {
  ocupacoesDosPedidos,
  opcoesDoDia,
  prazoEmExpediente,
  type OpcaoDeHorarioInterna,
} from '../domain/pedidos'

import { appointmentTypesFixture, CLINIC_UTC_OFFSET, roomsFixture } from './fixtures'
import type {
  AgendamentoOnline,
  Appointment,
  Block,
  Clinic,
  ISODate,
  ISODateTime,
  PedidoDeHorario,
  Pet,
  Tutor,
} from './types'

const clock: ClinicClock = createClinicClock(CLINIC_UTC_OFFSET)

/** O endereço da página pública da clínica da demonstração. */
export const SLUG_DA_CLINICA = 'petjourney-vila-madalena'

export const RESPONSAVEL_SEM_VINCULO = 'tutor-renata'
export const PET_SEM_VINCULO = 'pet-fuba'

export function agendamentoOnlinePadrao(): AgendamentoOnline {
  return {
    ativo: true,
    permiteEscolherHorario: true,
    permiteMelhorHorario: true,
    aceitarSozinho: false,
    typeIds: ['tipo-consulta', 'tipo-retorno', 'tipo-vacina', 'tipo-exame', 'tipo-banho'],
    /* A anestesista não atende consulta: não recebe pedido online. */
    professionalIds: ['prof-ana', 'prof-helena', 'prof-tiago', 'prof-caio'],
    antecedenciaMinimaHoras: 2,
    horizonteDias: 30,
    prazoDeRespostaHoras: 4,
    slug: SLUG_DA_CLINICA,
    emergencia: {
      telefone: '(11) 3555-0142',
      whatsapp: '(11) 95555-0142',
      telefoneDePlantao: null,
      orientacao:
        'Fora do horário, procure um hospital veterinário 24 horas. Se puder, mande uma mensagem pelo WhatsApp: a equipe lê assim que abrir.',
    },
  }
}

/**
 * A conta do app que a clínica ainda não conhece.
 *
 * O Fubá existe no app da Renata, não na clínica — é o caso da primeira consulta onde o pet não
 * tem histórico. E o cadastro dele no app não tem nascimento nem sexo, que é o estado "pet com
 * cadastro incompleto" que o fluxo precisa mostrar antes de deixar pedir.
 */
export function contasSoNoApp(): Array<{ tutor: Tutor; pets: Pet[] }> {
  return [
    {
      tutor: {
        id: RESPONSAVEL_SEM_VINCULO,
        nome: 'Renata Lima',
        telefone: '(11) 98120-4471',
        telefoneSecundario: '',
        email: 'renata.lima@exemplo.com',
        documento: '',
        preferenciaContato: 'whatsapp',
        endereco: null,
      },
      pets: [
        {
          id: PET_SEM_VINCULO,
          nome: 'Fubá',
          especie: 'canina',
          raca: 'SRD',
          sexo: null,
          nascimento: null,
          castrado: false,
          porte: null,
          pesoKg: null,
          microchip: '',
          pelagem: '',
          tutorId: RESPONSAVEL_SEM_VINCULO,
          alertas: [],
          iniciais: 'FU',
          fotoUrl: '',
        },
      ],
    },
  ]
}

type EntradaDaSemente = {
  hoje: ISODate
  agora: ISODateTime
  clinic: Clinic
  /** Os atendimentos do dataset. Recebem os que os pedidos respondidos criaram. */
  appointments: Appointment[]
  blocks: Block[]
  pets: Pet[]
  configuracao: AgendamentoOnline
}

function minutosAntes(agora: ISODateTime, minutos: number): ISODateTime {
  const parede = clock.toWall(agora)

  return clock.toIso(parede.date, parede.minutes - minutos)
}

/**
 * O primeiro horário livre de verdade a partir de um dia e de uma hora.
 *
 * Livre de verdade porque o aceite confere: um pedido semeado num horário ocupado faria a
 * demonstração abrir com "horário ocupado" em todas as linhas.
 */
function primeiraOpcao(
  entrada: EntradaDaSemente,
  pedidos: PedidoDeHorario[],
  busca: {
    aPartirDe: ISODate
    minuto: number
    typeId: string
    petIds: string[]
    profissional: string
  },
): OpcaoDeHorarioInterna | null {
  const tipo = appointmentTypesFixture.find((item) => item.id === busca.typeId)!

  for (let offset = 0; offset <= 10; offset += 1) {
    const data = addDays(busca.aPartirDe, offset)
    const opcoes = opcoesDoDia(
      {
        data,
        typeId: tipo.id,
        duracaoMinutos: tipo.duracaoMinutos,
        petIds: busca.petIds,
        professionalIds: [busca.profissional],
        aPartirDe: clock.toIso(data, busca.minuto),
      },
      {
        clinic: entrada.clinic,
        clock,
        atendimentos: [
          ...entrada.appointments.filter((item) => clock.dateOf(item.inicio) === data),
          ...ocupacoesDosPedidos(pedidos),
        ],
        bloqueios: materializarBloqueios(entrada.blocks, data, clock),
        tipos: appointmentTypesFixture,
        salas: roomsFixture,
        pets: entrada.pets,
        capacidadeMinutos: CAPACIDADE_MINUTOS_POR_PROFISSIONAL,
      },
    )

    if (opcoes[0]) {
      return opcoes[0]
    }
  }

  return null
}

function pedidoBase(
  entrada: EntradaDaSemente,
  dados: Partial<PedidoDeHorario> &
    Pick<PedidoDeHorario, 'id' | 'canal' | 'modo' | 'typeId' | 'motivo' | 'criadoEm'>,
): PedidoDeHorario {
  return {
    petId: null,
    tutorId: null,
    novoCadastro: null,
    queixa: '',
    professionalId: null,
    inicio: null,
    fim: null,
    preferencia: null,
    grupoId: null,
    remarcaAppointmentId: null,
    status: 'pendente',
    responderAte: prazoEmExpediente(
      dados.criadoEm,
      entrada.configuracao.prazoDeRespostaHoras,
      entrada.clinic,
      clock,
    ),
    respondidoEm: null,
    respondidoPor: null,
    appointmentId: null,
    recusa: null,
    compartilhaHistorico: false,
    ...dados,
  }
}

function atendimentoDoPedido(
  id: string,
  pedido: PedidoDeHorario,
  trecho: { petId: string; inicio: ISODateTime; fim: ISODateTime },
  criadoEm: ISODateTime,
): Appointment {
  return {
    id,
    petId: trecho.petId,
    tutorId: pedido.tutorId ?? '',
    professionalId: pedido.professionalId ?? '',
    roomIds: [],
    typeId: pedido.typeId,
    inicio: trecho.inicio,
    fim: trecho.fim,
    status: 'agendado',
    origem: pedido.canal,
    encaixe: false,
    observacao: pedido.queixa,
    chegadaEm: null,
    iniciadoEm: null,
    finalizadoEm: null,
    canceladoEm: null,
    motivoCancelamento: null,
    justificativaDeFalta: null,
    encounterId: null,
    linkedGroupId: null,
    criadoEm,
    atualizadoEm: criadoEm,
  }
}

export type SementeDosPedidos = {
  pedidos: PedidoDeHorario[]
  /** Os atendimentos que nasceram de pedido aceito, e o que ocupou o horário da Luna. */
  atendimentos: Appointment[]
  /** Código do link de cada pedido que veio pela página pública. */
  tokens: Record<string, string>
}

export function semearPedidos(entrada: EntradaDaSemente): SementeDosPedidos {
  const { hoje, agora } = entrada
  const amanha = addDays(hoje, 1)
  const pedidos: PedidoDeHorario[] = []
  const atendimentos: Appointment[] = []

  /* Thor: horário escolhido, ainda livre, com a Ana. */
  const doThor = primeiraOpcao(entrada, pedidos, {
    aPartirDe: amanha,
    minuto: 10 * 60,
    typeId: 'tipo-consulta',
    petIds: ['pet-thor'],
    profissional: 'prof-ana',
  })

  if (doThor) {
    pedidos.push(
      pedidoBase(entrada, {
        id: 'pedido-thor',
        canal: 'app',
        modo: 'horario-escolhido',
        petId: 'pet-thor',
        tutorId: 'tutor-eduardo',
        typeId: 'tipo-consulta',
        motivo: 'sintoma',
        queixa: 'Coçando muito a orelha esquerda desde sábado. Balança a cabeça o tempo todo.',
        professionalId: doThor.professionalId,
        inicio: doThor.inicio,
        fim: doThor.fim,
        criadoEm: minutosAntes(agora, 25),
      }),
    )
  }

  /* Nina e Oliver: a mesma casa, vacina seguida com a Helena. */
  const daCamila = primeiraOpcao(entrada, pedidos, {
    aPartirDe: addDays(hoje, 2),
    minuto: 14 * 60,
    typeId: 'tipo-vacina',
    petIds: ['pet-nina', 'pet-oliver'],
    profissional: 'prof-helena',
  })

  if (daCamila) {
    daCamila.porPet.forEach((trecho, indice) => {
      pedidos.push(
        pedidoBase(entrada, {
          id: `pedido-camila-${indice + 1}`,
          canal: 'app',
          modo: 'horario-escolhido',
          petId: trecho.petId,
          tutorId: 'tutor-camila',
          typeId: 'tipo-vacina',
          motivo: 'vacina',
          queixa: 'Reforço anual das duas, se der no mesmo horário.',
          professionalId: daCamila.professionalId,
          inicio: trecho.inicio,
          fim: trecho.fim,
          grupoId: 'grupo-camila',
          criadoEm: minutosAntes(agora, 70),
        }),
      )
    })
  }

  /* Tobias: pelo link, de quem não tem o app — melhor horário, de manhã, esta semana. */
  const nascimentoDoTobias = addDays(hoje, -96)

  pedidos.push(
    pedidoBase(entrada, {
      id: 'pedido-tobias',
      canal: 'link',
      modo: 'melhor-horario',
      typeId: 'tipo-consulta',
      motivo: 'checkup',
      queixa: 'Adotamos na semana passada. Primeira consulta e ver o que falta de vacina.',
      novoCadastro: {
        nome: 'Juliana Prates',
        telefone: '(11) 97412-5530',
        petNome: 'Tobias',
        especie: 'canina',
        nascimento: nascimentoDoTobias,
        sexo: 'macho',
      },
      preferencia: { de: amanha, ate: addDays(hoje, 4), periodos: ['manha'], professionalId: null },
      criadoEm: minutosAntes(agora, 125),
    }),
  )

  /*
   * Luna: o retorno que a Marina escolheu, e o telefonema que tomou o horário depois. O
   * atendimento por telefone é criado **depois** do pedido — é essa ordem que a linha conta.
   */
  const daLuna = primeiraOpcao(entrada, pedidos, {
    aPartirDe: amanha,
    minuto: 15 * 60,
    typeId: 'tipo-retorno',
    petIds: ['pet-luna'],
    profissional: 'prof-caio',
  })

  if (daLuna) {
    const pedidoDaLuna = pedidoBase(entrada, {
      id: 'pedido-luna',
      canal: 'app',
      modo: 'horario-escolhido',
      petId: 'pet-luna',
      tutorId: 'tutor-marina',
      typeId: 'tipo-retorno',
      motivo: 'retorno',
      queixa: 'Retorno da otite, como o doutor pediu.',
      professionalId: daLuna.professionalId,
      inicio: daLuna.inicio,
      fim: daLuna.fim,
      criadoEm: minutosAntes(agora, 220),
    })

    pedidos.push(pedidoDaLuna)

    const porTelefone = atendimentoDoPedido(
      'apt-tomou-o-horario-da-luna',
      { ...pedidoDaLuna, canal: 'app', tutorId: 'tutor-joao', queixa: '' },
      { petId: 'pet-bento', inicio: daLuna.inicio, fim: daLuna.fim },
      minutosAntes(agora, 95),
    )

    atendimentos.push({ ...porTelefone, typeId: 'tipo-consulta', origem: 'telefone' })
  }

  /* Zeus: aceito hoje de manhã, já na agenda com a origem do app. */
  const doZeus = primeiraOpcao(
    { ...entrada, appointments: [...entrada.appointments, ...atendimentos] },
    pedidos,
    {
      aPartirDe: addDays(hoje, 2),
      minuto: 9 * 60,
      typeId: 'tipo-consulta',
      petIds: ['pet-zeus'],
      profissional: 'prof-tiago',
    },
  )

  if (doZeus) {
    const pedidoDoZeus = pedidoBase(entrada, {
      id: 'pedido-zeus',
      canal: 'app',
      modo: 'horario-escolhido',
      petId: 'pet-zeus',
      tutorId: 'tutor-rita',
      typeId: 'tipo-consulta',
      motivo: 'checkup',
      queixa: 'Check-up anual.',
      professionalId: doZeus.professionalId,
      inicio: doZeus.inicio,
      fim: doZeus.fim,
      criadoEm: minutosAntes(agora, 190),
    })
    const aceito = atendimentoDoPedido(
      'apt-do-pedido-zeus',
      pedidoDoZeus,
      doZeus.porPet[0]!,
      minutosAntes(agora, 160),
    )

    atendimentos.push(aceito)
    pedidos.push({
      ...pedidoDoZeus,
      status: 'aceito',
      respondidoEm: minutosAntes(agora, 160),
      respondidoPor: 'recepcao',
      appointmentId: aceito.id,
    })
  }

  /* Simba: banho num sábado lotado — recusado, com o texto que saiu. */
  pedidos.push(
    pedidoBase(entrada, {
      id: 'pedido-simba',
      canal: 'app',
      modo: 'melhor-horario',
      petId: 'pet-simba',
      tutorId: 'tutor-heitor',
      typeId: 'tipo-banho',
      motivo: 'banho',
      queixa: 'Banho e tosa higiênica, só no sábado.',
      preferencia: {
        de: amanha,
        ate: addDays(hoje, 12),
        periodos: ['manha'],
        professionalId: null,
      },
      criadoEm: minutosAntes(agora, 260),
      status: 'recusado',
      respondidoEm: minutosAntes(agora, 200),
      respondidoPor: 'recepcao',
      recusa: {
        motivo: 'sem-horario',
        mensagem:
          'Oi, Heitor! O banho de sábado está lotado até o fim do mês. Terça à tarde tem horário. Se servir, é só pedir de novo.',
      },
    }),
  )

  return { pedidos, atendimentos, tokens: { 'pedido-tobias': 'b7k2q9' } }
}
