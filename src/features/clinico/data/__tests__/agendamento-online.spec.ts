/**
 * O servidor do agendamento online, dos dois lados do mesmo pedido.
 *
 * Fixa o percurso que a demonstração promete — o responsável pede, a recepção responde, o horário
 * aparece na agenda com a origem do pedido e o aviso chega a quem pediu — e os casos difíceis do
 * requisito: dois pets da mesma casa seguidos, o horário que some enquanto a pessoa preenche, a
 * primeira consulta de um pet que a clínica nunca viu, e o cadastro incompleto.
 *
 * O relógio fica parado às 10:00 de um dia útil: o prazo de resposta conta expediente, e um teste
 * rodado às 22h não pode enxergar uma clínica diferente da que roda às 10h.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { OpcaoDeHorario } from '../../contrato/responsavel'
import {
  addDays,
  createClinicClock,
  epochNow,
  epochToWall,
  isWeekend,
  nextBusinessDay,
  setClockSkew,
  wallToEpoch,
} from '../../domain/clinic-time'
import {
  agendamentoOnlineDoResponsavel as app,
  disputarProximaReserva,
  ErroDoPedido,
  pedidoRepository,
} from '../agendamento-online'
import { CLINIC_UTC_OFFSET } from '../fixtures'
import { setMockConfig } from '../mock-runtime'
import { PET_SEM_VINCULO, RESPONSAVEL_SEM_VINCULO } from '../seed-pedidos'
import { RESPONSAVEL_DA_DEMONSTRACAO } from '../seed-responsavel'
import { getDataset, resetDataset } from '../store'

const clock = createClinicClock(CLINIC_UTC_OFFSET)
const FATIMA = RESPONSAVEL_DA_DEMONSTRACAO

beforeEach(() => {
  setClockSkew(0)

  const hoje = epochToWall(epochNow(), CLINIC_UTC_OFFSET).date
  let diaUtil = isWeekend(hoje) ? nextBusinessDay(hoje) : hoje

  /*
   * Feriado também fecha a clínica (1º de janeiro, Natal): num deles a emergência dizia "fechada"
   * e o teste de "aberta agora" quebrava no dia. O dia do teste é um em que ela abre.
   */
  for (let tentativa = 0; tentativa < 10; tentativa += 1) {
    setClockSkew(wallToEpoch({ date: diaUtil, minutes: 10 * 60 }, CLINIC_UTC_OFFSET) - Date.now())
    resetDataset()

    const dia = diaUtil
    if (!getDataset().clinic.feriados.some((feriado) => feriado.fechado && feriado.date === dia)) {
      break
    }

    // `nextBusinessDay` devolve o próprio dia quando ele já é útil: o próximo começa amanhã.
    diaUtil = nextBusinessDay(addDays(diaUtil, 1))
  }

  setMockConfig({ latenciaMs: 0, jitterMs: 0 })
  disputarProximaReserva(false)
})

afterEach(() => {
  setClockSkew(0)
})

async function codigoDe(promessa: Promise<unknown>) {
  try {
    await promessa

    return null
  } catch (causa) {
    return causa instanceof ErroDoPedido ? causa.codigo : 'outro'
  }
}

/** O primeiro horário que o app oferece, nos próximos dias, para estes pets. */
async function primeiroHorario(
  petIds: string[],
  servicoId = 'tipo-consulta',
): Promise<OpcaoDeHorario> {
  const hoje = clock.today()
  const dias = await app.dias({ servicoId, petIds, de: hoje, ate: addDays(hoje, 13) })
  const dia = dias.find((item) => item.situacao === 'COM_HORARIO')

  if (!dia) {
    throw new Error('nenhum horário nas duas semanas')
  }

  return dia.horarios[0]!
}

async function pedirComHorario(tutorId: string, petIds: string[]) {
  const clinica = await app.clinica()
  const opcao = await primeiroHorario(petIds)
  const reserva = await app.reservar({
    clinicaId: clinica.clinica.id,
    servicoId: 'tipo-consulta',
    petIds,
    profissionalId: opcao.profissional.id,
    inicio: opcao.inicio,
  })

  const pedido = await app.pedir(tutorId, {
    clinicaId: clinica.clinica.id,
    servicoId: 'tipo-consulta',
    motivo: 'CHECKUP',
    modo: 'HORARIO_ESCOLHIDO',
    petIds,
    reservaId: reserva.id,
  })

  return { opcao, pedido }
}

describe('a caixa de pedidos semeada', () => {
  it('abre com pedidos esperando, e o horário escolhido de cada um livre — menos o da Luna', async () => {
    const caixa = await pedidoRepository.listar()
    const abertos = caixa.filter((linha) => linha.pedidos[0]!.status === 'pendente')
    const daLuna = abertos.find((linha) => linha.chave === 'pedido-luna')

    expect(abertos.length).toBeGreaterThanOrEqual(4)
    expect(daLuna?.horarioLivre).toBe(false)
    expect(daLuna?.sugestao).not.toBeNull()
    expect(
      abertos
        .filter(
          (linha) =>
            linha.pedidos[0]!.modo === 'horario-escolhido' && linha.chave !== 'pedido-luna',
        )
        .every((linha) => linha.horarioLivre),
    ).toBe(true)
  })

  it('os dois pets da Camila são uma linha só', async () => {
    const caixa = await pedidoRepository.listar()
    const daCamila = caixa.find((linha) => linha.chave === 'grupo-camila')

    expect(daCamila?.pedidos).toHaveLength(2)
  })
})

describe('o pedido do app', () => {
  it('dois pets da mesma casa: um pedido, dois horários seguidos com o mesmo profissional', async () => {
    const petIds = ['pet-perola', 'pet-bruna']
    const { opcao, pedido } = await pedirComHorario(FATIMA, petIds)

    expect(pedido.status).toBe('AGUARDANDO_CLINICA')
    expect(pedido.pets.map((pet) => pet.id)).toEqual(petIds)
    expect(pedido.horarioPedido?.porPet[1]!.inicio).toBe(opcao.porPet[0]!.fim)

    const caixa = await pedidoRepository.listar()
    const linha = caixa.find((item) => item.pedidos.some((p) => p.id === pedido.id))

    expect(linha?.pedidos).toHaveLength(2)
    expect(linha?.horarioLivre).toBe(true)
  })

  it('o horário pedido sai da agenda que os outros veem enquanto a clínica não responde', async () => {
    const { opcao } = await pedirComHorario(FATIMA, ['pet-perola'])
    const dias = await app.dias({
      servicoId: 'tipo-consulta',
      petIds: ['pet-thor'],
      de: clock.dateOf(opcao.inicio),
      ate: clock.dateOf(opcao.inicio),
      profissionalId: opcao.profissional.id,
    })

    expect(dias[0]!.horarios.some((item) => item.inicio === opcao.inicio)).toBe(false)
  })

  it('o horário que outra pessoa pegou primeiro some de verdade', async () => {
    const clinica = await app.clinica()
    const opcao = await primeiroHorario(['pet-perola'])

    disputarProximaReserva()

    const codigo = await codigoDe(
      app.reservar({
        clinicaId: clinica.clinica.id,
        servicoId: 'tipo-consulta',
        petIds: ['pet-perola'],
        profissionalId: opcao.profissional.id,
        inicio: opcao.inicio,
      }),
    )
    const depois = await app.dias({
      servicoId: 'tipo-consulta',
      petIds: ['pet-perola'],
      de: clock.dateOf(opcao.inicio),
      ate: clock.dateOf(opcao.inicio),
      profissionalId: opcao.profissional.id,
    })

    expect(codigo).toBe('HORARIO_INDISPONIVEL')
    expect(depois[0]!.horarios.some((item) => item.inicio === opcao.inicio)).toBe(false)
  })

  it('a reserva vence em cinco minutos e o pedido com ela é recusado', async () => {
    const clinica = await app.clinica()
    const opcao = await primeiroHorario(['pet-perola'])
    const reserva = await app.reservar({
      clinicaId: clinica.clinica.id,
      servicoId: 'tipo-consulta',
      petIds: ['pet-perola'],
      profissionalId: opcao.profissional.id,
      inicio: opcao.inicio,
    })

    setClockSkew(Date.parse(reserva.expiraEm) - Date.now() + 60_000)

    const codigo = await codigoDe(
      app.pedir(FATIMA, {
        clinicaId: clinica.clinica.id,
        servicoId: 'tipo-consulta',
        motivo: 'CHECKUP',
        modo: 'HORARIO_ESCOLHIDO',
        petIds: ['pet-perola'],
        reservaId: reserva.id,
      }),
    )

    expect(codigo).toBe('RESERVA_EXPIRADA')
  })

  it('pet com cadastro incompleto não pede até completar', async () => {
    const pets = app.petsDaConta(RESPONSAVEL_SEM_VINCULO)

    expect(pets.find((pet) => pet.id === PET_SEM_VINCULO)?.faltam).toEqual(['nascimento', 'sexo'])

    const clinica = await app.clinica()
    const tentativa = await codigoDe(
      app.pedir(RESPONSAVEL_SEM_VINCULO, {
        clinicaId: clinica.clinica.id,
        servicoId: 'tipo-vacina',
        motivo: 'VACINA',
        modo: 'MELHOR_HORARIO',
        petIds: [PET_SEM_VINCULO],
        preferencia: {
          de: clock.today(),
          ate: addDays(clock.today(), 6),
          periodos: [],
          profissionalId: null,
        },
      }),
    )

    expect(tentativa).toBe('CADASTRO_INCOMPLETO')

    const { faltam } = await app.completarPet(RESPONSAVEL_SEM_VINCULO, PET_SEM_VINCULO, {
      nascimento: addDays(clock.today(), -60),
      sexo: 'femea',
    })

    expect(faltam).toEqual([])
  })

  it('pet em internação não aparece como disponível', () => {
    const pipoca = app.petsDaConta(FATIMA).find((pet) => pet.nome === 'Pipoca')

    expect(pipoca?.internado).toBe(true)
  })

  it('desistir é possível só enquanto a clínica não respondeu', async () => {
    const { pedido } = await pedirComHorario(FATIMA, ['pet-perola'])
    const cancelado = await app.cancelarPedido(pedido.id)

    expect(cancelado.status).toBe('CANCELADO_PELO_RESPONSAVEL')
    expect(await codigoDe(pedidoRepository.aceitar(pedido.id))).toBe('PEDIDO_JA_RESPONDIDO')
  })
})

describe('a resposta da recepção', () => {
  it('aceitar vira atendimento na agenda com a origem do app, e o aviso chega a quem pediu', async () => {
    const { pedido, opcao } = await pedirComHorario(FATIMA, ['pet-perola'])
    const atendimentos = await pedidoRepository.aceitar(pedido.id)

    expect(atendimentos).toHaveLength(1)
    expect(atendimentos[0]!.origem).toBe('app')
    expect(atendimentos[0]!.inicio).toBe(opcao.inicio)
    expect(getDataset().appointments.some((item) => item.id === atendimentos[0]!.id)).toBe(true)

    const [aviso] = app.avisos(FATIMA)

    expect(aviso?.tipo).toBe('aceito')
    expect(aviso?.titulo).toContain('Pérola')

    const [meu] = await app.pedidos(FATIMA)

    expect(meu?.status).toBe('ACEITO')
    expect(meu?.agendamentoIds).toEqual([atendimentos[0]!.id])
  })

  it('o horário escolhido que foi ocupado não é aceito às cegas', async () => {
    expect(await codigoDe(pedidoRepository.aceitar('pedido-luna'))).toBe('HORARIO_INDISPONIVEL')

    const [sugestao] = await pedidoRepository.sugestoes('pedido-luna', 1)
    const atendimentos = await pedidoRepository.aceitar('pedido-luna', {
      professionalId: sugestao!.professionalId,
      inicio: sugestao!.inicio,
    })

    expect(atendimentos[0]!.inicio).toBe(sugestao!.inicio)
    expect(app.avisos('tutor-marina')[0]?.tipo).toBe('marcado')
  })

  it('primeira vez pelo link: o aceite cria o paciente e marca com a origem do link', async () => {
    const [sugestao] = await pedidoRepository.sugestoes('pedido-tobias', 1)
    const [atendimento] = await pedidoRepository.aceitar('pedido-tobias', {
      professionalId: sugestao!.professionalId,
      inicio: sugestao!.inicio,
    })
    const pet = getDataset().pets.find((item) => item.id === atendimento!.petId)
    const tutor = getDataset().tutores.find((item) => item.id === atendimento!.tutorId)

    expect(atendimento!.origem).toBe('link')
    expect(pet?.nome).toBe('Tobias')
    expect(pet?.iniciais).toBe('TO')
    expect(tutor?.telefone).toBe('(11) 97412-5530')
    /* Quem não tem o app recebe por mensagem, com o endereço para acompanhar. */
    expect(getDataset().avisosDoPedido[getDataset().avisosDoPedido.length - 1]?.corpo).toContain(
      '/agendar/',
    )
  })

  it('primeira vez pelo app: o pet que só existia no app entra no cadastro da clínica', async () => {
    await app.completarPet(RESPONSAVEL_SEM_VINCULO, PET_SEM_VINCULO, {
      nascimento: addDays(clock.today(), -60),
      sexo: 'macho',
    })

    const clinica = await app.clinica()
    const pedido = await app.pedir(RESPONSAVEL_SEM_VINCULO, {
      clinicaId: clinica.clinica.id,
      servicoId: 'tipo-vacina',
      motivo: 'VACINA',
      modo: 'MELHOR_HORARIO',
      petIds: [PET_SEM_VINCULO],
      preferencia: {
        de: clock.today(),
        ate: addDays(clock.today(), 6),
        periodos: [],
        profissionalId: null,
      },
      compartilharHistorico: true,
    })

    expect(getDataset().pets.some((pet) => pet.id === PET_SEM_VINCULO)).toBe(false)

    const [sugestao] = await pedidoRepository.sugestoes(pedido.id, 1)

    await pedidoRepository.aceitar(pedido.id, {
      professionalId: sugestao!.professionalId,
      inicio: sugestao!.inicio,
    })

    expect(getDataset().pets.some((pet) => pet.id === PET_SEM_VINCULO)).toBe(true)
    expect(
      getDataset().consentimentos.find((item) => item.tutorId === RESPONSAVEL_SEM_VINCULO)
        ?.diarioCompleto,
    ).toBe(true)
  })

  it('recusar guarda o motivo e o texto, e avisa', async () => {
    await pedidoRepository.recusar('pedido-thor', 'sem-horario', 'Oi! Sem horário essa semana.')

    const thor = getDataset().pedidos.find((item) => item.id === 'pedido-thor')

    expect(thor?.status).toBe('recusado')
    expect(thor?.recusa).toEqual({
      motivo: 'sem-horario',
      mensagem: 'Oi! Sem horário essa semana.',
    })
    expect(app.avisos('tutor-eduardo')[0]?.tipo).toBe('recusado')
  })

  it('com o aceite automático ligado, o horário escolhido vira atendimento na hora', async () => {
    const configuracao = pedidoRepository.configuracao()

    await pedidoRepository.salvarConfiguracao({ ...configuracao, aceitarSozinho: true })

    const { pedido } = await pedirComHorario(FATIMA, ['pet-perola'])

    expect(pedido.status).toBe('ACEITO')
    expect(getDataset().pedidos.find((item) => item.id === pedido.id)?.respondidoPor).toBe(
      'automatico',
    )
  })
})

describe('o link público', () => {
  it('quem já é cliente não vira um segundo cadastro', async () => {
    const pedido = await app.pedirPeloLink({
      servicoId: 'tipo-consulta',
      motivo: 'CHECKUP',
      modo: 'MELHOR_HORARIO',
      preferencia: {
        de: clock.today(),
        ate: addDays(clock.today(), 6),
        periodos: [],
        profissionalId: null,
      },
      visitante: { nome: 'Eduardo', telefone: '11 98411-2299', petNome: 'thor', especie: 'CANINA' },
    })
    const gravado = getDataset().pedidos.find((item) => item.id === pedido.id)

    expect(gravado?.tutorId).toBe('tutor-eduardo')
    expect(gravado?.petId).toBe('pet-thor')
    expect(gravado?.novoCadastro).toBeNull()
  })

  it('o código acompanha o pedido sem conta, e deixa desistir', async () => {
    const pedido = await app.pedirPeloLink({
      servicoId: 'tipo-consulta',
      motivo: 'SINTOMA',
      modo: 'MELHOR_HORARIO',
      preferencia: {
        de: clock.today(),
        ate: addDays(clock.today(), 6),
        periodos: ['MANHA'],
        profissionalId: null,
      },
      visitante: {
        nome: 'Carla Mendes',
        telefone: '(11) 97777-1212',
        petNome: 'Fred',
        especie: 'FELINA',
      },
    })

    const acompanhado = await app.pedidoPorToken(pedido.token)

    expect(acompanhado?.status).toBe('AGUARDANDO_CLINICA')
    expect((await app.cancelarPedido(pedido.id)).status).toBe('CANCELADO_PELO_RESPONSAVEL')
  })

  it('sem nome, telefone ou pet, o pedido não sai', async () => {
    const codigo = await codigoDe(
      app.pedirPeloLink({
        servicoId: 'tipo-consulta',
        motivo: 'CHECKUP',
        modo: 'MELHOR_HORARIO',
        preferencia: {
          de: clock.today(),
          ate: addDays(clock.today(), 6),
          periodos: [],
          profissionalId: null,
        },
        visitante: { nome: 'Ana', telefone: '123', petNome: '', especie: 'CANINA' },
      }),
    )

    expect(codigo).toBe('CADASTRO_INCOMPLETO')
  })
})

describe('a configuração da clínica', () => {
  it('pausado, o app não oferece horário', async () => {
    await pedidoRepository.salvarConfiguracao({ ...pedidoRepository.configuracao(), ativo: false })

    const clinica = await app.clinica()
    const codigo = await codigoDe(
      app.dias({
        servicoId: 'tipo-consulta',
        petIds: ['pet-perola'],
        de: clock.today(),
        ate: clock.today(),
      }),
    )

    expect(clinica.recebePedidos).toBe(false)
    expect(codigo).toBe('CLINICA_NAO_RECEBE_PEDIDOS')
  })

  it('a emergência traz o contato e o estado de agora', async () => {
    const emergencia = await app.emergencia()

    expect(emergencia.telefone).toBe('(11) 3555-0142')
    expect(emergencia.abertaAgora).toBe(true)
    expect(emergencia.fechaAs).toBe('19:00')
  })
})
