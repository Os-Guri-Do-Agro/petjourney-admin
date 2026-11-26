/**
 * Os pedidos de horário do app e do link público (E3-05), vistos da caixa da recepção: sete
 * esperando resposta (dois vencendo o prazo, um com o horário escolhido ocupado depois, um de dois
 * pets juntos), e o histórico de aceitos, recusados e encerrados, ligados aos agendamentos da base
 * que vieram do app e do link (`pedidoId`).
 *
 * O prazo (`NO_PRAZO`, `VENCENDO` nos 30 min finais, `ATRASADO`) e a folhinha riscada
 * (`horarioSumiu`) são calculados na leitura, pelo relógio e pela agenda de agora.
 */
import type { ComprovanteDoPedidoDto, ServicoOnlineDto } from '@/service/contrato/openapi'
import type {
  Aceite,
  ConfiguracaoOnline,
  DetalheDoPedido,
  PedidoNaCaixa,
  Recusa,
  RespostaDoPedido,
  SugestoesDoPedido,
} from '@/service/parceiro/pedidos-service'

import { criarSorteio } from '../aleatorio'
import { AGENDAMENTOS, type AgendamentoDaDemo } from '../base/agenda'
import { cliente, paciente } from '../base/cadastro'
import { PROFISSIONAIS, SLUG, TIPOS } from '../base/clinica'
import { agora, agoraIso, FUSO, hoje, instante, somarDias, somarMinutos } from '../relogio'
import {
  conflitosDoHorario,
  criarNaAgenda,
  ErroDaDemo,
  horariosLivres,
  minutosEmComum,
  primeiroLivre,
  RISCADOS,
} from './agenda-grade'
/* A fila cancela uns horários ao carregar (as vagas): vem antes de escolher os horários daqui. */
import './agenda-fila'

/* -------------------------------------------------------------------- a configuração */

export const CONFIGURACAO_ONLINE: ConfiguracaoOnline = {
  ativo: true,
  permiteEscolherHorario: true,
  permiteMelhorHorario: true,
  aceitaPeloLink: true,
  aceitarSozinho: false,
  mostrarProfissionais: true,
  tipoIds: ['demo-tipo-consulta', 'demo-tipo-retorno', 'demo-tipo-vacina'],
  profissionalIds: ['demo-prof-marina', 'demo-prof-rafael', 'demo-prof-camila', 'demo-prof-bruno'],
  antecedenciaMinimaHoras: 4,
  horizonteDias: 30,
  prazoDeRespostaHoras: 3,
  perfilPublicado: true,
  slug: SLUG,
  atualizadoEm: instante(somarDias(hoje(), -54), '09:40'),
}

/* -------------------------------------------------------------------------- o pedido */

type PetDoPedido = DetalheDoPedido['pets'][number]

/** O pedido guardado; o prazo e a folhinha riscada saem na leitura. */
export type PedidoDaDemo = Omit<DetalheDoPedido, 'prazo' | 'pets'> & {
  pets: Array<Omit<PetDoPedido, 'horarioSumiu'>>
}

export const PEDIDOS: PedidoDaDemo[] = []

function servicoDe(tipoId: string): ServicoOnlineDto {
  const t = TIPOS.find((x) => x.id === tipoId)
  return {
    id: tipoId,
    nome: t?.nome ?? '',
    kind: t?.kind ?? 'CONSULTA',
    duracaoMinutos: t?.duracaoMinutos ?? 30,
  }
}

function nomeDoProfissional(id: string | null) {
  return id ? (PROFISSIONAIS.find((p) => p.id === id)?.nome ?? null) : null
}

function prazoDe(p: PedidoDaDemo): DetalheDoPedido['prazo'] {
  if (p.status !== 'PENDENTE') return 'NO_PRAZO'
  const faltam = Date.parse(p.responderAte) - agora().getTime()
  if (faltam <= 0) return 'ATRASADO'
  return faltam <= 30 * 60_000 ? 'VENCENDO' : 'NO_PRAZO'
}

/** O horário escolhido foi ocupado depois do pedido (alguém marcou por cima). */
function sumiu(p: PedidoDaDemo, pet: Omit<PetDoPedido, 'horarioSumiu'>) {
  if (p.status !== 'PENDENTE' || p.modo !== 'HORARIO_ESCOLHIDO' || !pet.inicio || !pet.fim) {
    return false
  }
  const { inicio, fim } = pet
  return AGENDAMENTOS.some(
    (a) =>
      a.profissionalId === p.profissionalId &&
      !RISCADOS.includes(a.status) &&
      a.pedidoId !== p.id &&
      minutosEmComum(a.inicio, a.fim, inicio, fim) > 0,
  )
}

export function detalheDoPedido(p: PedidoDaDemo): DetalheDoPedido {
  return {
    ...p,
    pets: p.pets.map((pet) => ({ ...pet, horarioSumiu: sumiu(p, pet) })),
    prazo: prazoDe(p),
    avisos: p.avisos.map((a) => ({ ...a })),
  }
}

export function pedidoNaCaixa(p: PedidoDaDemo): PedidoNaCaixa {
  const {
    queixa: _queixa,
    telefone: _telefone,
    email: _email,
    compartilharHistorico: _compartilhar,
    avisos: _avisos,
    ...resto
  } = detalheDoPedido(p)
  return resto
}

export function exigirPedido(id: string) {
  const p = PEDIDOS.find((x) => x.id === id)
  if (!p) throw new ErroDaDemo(403, 'SEM_ACESSO', 'Pedido não encontrado ou sem acesso.')
  return p
}

const DA_ABA: Record<string, ReadonlyArray<PedidoDaDemo['status']>> = {
  PENDENTES: ['PENDENTE'],
  ACEITOS: ['ACEITO'],
  RECUSADOS: ['RECUSADO'],
  ENCERRADOS: ['DESISTIU', 'EXPIRADO'],
}

/** PENDENTES do mais antigo; o resto, do mais recente. */
export function pedidosDaAba(aba: string): PedidoDaDemo[] {
  const status = DA_ABA[aba] ?? DA_ABA.PENDENTES ?? []
  const lista = PEDIDOS.filter((p) => status.includes(p.status))
  return aba === 'PENDENTES' || !DA_ABA[aba]
    ? lista.sort((a, b) => a.criadoEm.localeCompare(b.criadoEm))
    : lista.sort((a, b) =>
        (b.respondidoEm ?? b.criadoEm).localeCompare(a.respondidoEm ?? a.criadoEm),
      )
}

/* ------------------------------------------------------------------------ as sugestões */

export function sugestoesDoPedido(p: PedidoDaDemo, limite: number): SugestoesDoPedido {
  const servico = p.servico
  const duracao = servico.duracaoMinutos * p.pets.length
  const pacienteId = p.pets[0]?.pacienteId ?? undefined
  const amanha = somarDias(hoje(), 1)
  const pedidoDe =
    p.modo === 'MELHOR_HORARIO'
      ? (p.preferencia?.de ?? hoje())
      : (p.pets[0]?.inicio?.slice(0, 10) ?? hoje())
  const de = pedidoDe < hoje() ? hoje() : pedidoDe
  const ate =
    p.modo === 'MELHOR_HORARIO' ? (p.preferencia?.ate ?? somarDias(de, 6)) : somarDias(de, 4)
  const quem = p.modo === 'MELHOR_HORARIO' ? (p.preferencia?.profissionalId ?? null) : null
  const busca = {
    tipoId: servico.id,
    duracaoMinutos: duracao,
    pacienteId: pacienteId ?? undefined,
    profissionalIds: quem ? [quem] : CONFIGURACAO_ONLINE.profissionalIds,
    periodos: p.preferencia?.periodos,
    umPorProfissionalPorDia: true,
    quantidade: limite,
  }

  let foraDaPreferencia = false
  let achados = horariosLivres({ ...busca, aPartirDe: de, ate })
  if (!achados.length) {
    foraDaPreferencia = true
    achados = horariosLivres({
      ...busca,
      profissionalIds: CONFIGURACAO_ONLINE.profissionalIds,
      periodos: undefined,
      aPartirDe: somarDias(ate, 1) < amanha ? amanha : somarDias(ate, 1),
      ate: somarDias(ate, 7),
    })
  }

  return {
    fuso: FUSO,
    buscaInterrompida: false,
    sugestoes: achados.map((s) => ({
      profissionalId: s.profissionalId,
      profissionalNome: s.profissionalNome,
      inicio: s.inicio,
      fim: s.fim,
      porPet: p.pets.map((_, i) => ({
        inicio: somarMinutos(s.inicio, i * servico.duracaoMinutos),
        fim: somarMinutos(s.inicio, (i + 1) * servico.duracaoMinutos),
      })),
      foraDaPreferencia,
    })),
  }
}

/* ------------------------------------------------------------------------ as respostas */

let sequenciaDoAviso = 0

function comprovante(p: PedidoDaDemo, tipo: string, situacao: ComprovanteDoPedidoDto['situacao']) {
  const temApp = p.canal === 'APP'
  return {
    id: `demo-aviso-pedido-${++sequenciaDoAviso}`,
    tipo,
    situacao,
    canal: temApp ? ('PUSH_INBOX' as const) : ('EMAIL' as const),
    motivoSemAviso: null,
    criadoEm: agoraIso(),
  }
}

export function aceitarPedido(p: PedidoDaDemo, aceite: Partial<Aceite>): RespostaDoPedido {
  if (p.status !== 'PENDENTE') {
    throw new ErroDaDemo(409, 'PEDIDO_JA_RESPONDIDO', 'Este pedido já foi respondido.', {
      status: p.status,
    })
  }
  const escolhido = p.pets[0]?.inicio ?? null
  const inicio = aceite.inicio ?? (p.modo === 'HORARIO_ESCOLHIDO' ? escolhido : null)
  if (!inicio) {
    throw new ErroDaDemo(400, 'PEDIDO_INVALIDO', 'Escolha o horário para marcar.', {
      reason: 'INICIO_OBRIGATORIO',
    })
  }
  const duracao = p.servico.duracaoMinutos
  const total = duracao * p.pets.length
  const confirmar = aceite.confirmarConflitos ?? []
  const livre = (profissionalId: string) =>
    !conflitosDoHorario({
      pacienteId: '',
      profissionalId,
      inicio,
      fim: somarMinutos(inicio, total),
      salaIds: [],
    }).some((c) => c.kind === 'professional-overlap')
  const profissionalId =
    aceite.profissionalId ??
    p.profissionalId ??
    CONFIGURACAO_ONLINE.profissionalIds.find(livre) ??
    CONFIGURACAO_ONLINE.profissionalIds[0] ??
    ''
  if (!livre(profissionalId) && !confirmar.includes('professional-overlap')) {
    throw new ErroDaDemo(
      409,
      'HORARIO_JA_TOMADO',
      'O profissional já tem atendimento neste horário.',
    )
  }

  const origem = p.canal === 'APP' ? ('APP' as const) : ('LINK' as const)
  const criados: AgendamentoDaDemo[] = []
  p.pets.forEach((pet, i) => {
    if (!pet.pacienteId) return
    const { principal } = criarNaAgenda(
      {
        pacienteId: pet.pacienteId,
        profissionalId,
        tipoId: p.servico.id,
        inicio: somarMinutos(inicio, i * duracao),
        encaixe: confirmar.includes('professional-overlap'),
        confirmarConflitos: confirmar.includes('holiday-closed') ? ['holiday-closed'] : undefined,
      },
      { origem, pedidoId: p.id, criadoPorId: null },
    )
    criados.push(principal)
    pet.agendamentoId = principal.id
    pet.inicio = principal.inicio
    pet.fim = principal.fim
  })

  p.status = 'ACEITO'
  p.profissionalId = profissionalId
  p.profissionalNome = nomeDoProfissional(profissionalId)
  p.respondidoEm = agoraIso()
  p.respondidoPor = 'RECEPCAO'
  p.avisos.push(
    comprovante(
      p,
      inicio === escolhido ? 'PEDIDO_ACEITO' : 'PEDIDO_ACEITO_OUTRO_HORARIO',
      'PENDENTE',
    ),
  )

  return {
    pedido: detalheDoPedido(p),
    agendamentoIds: criados.map((a) => a.id),
    conflitos: criados.flatMap((a) => conflitosDoHorario(a)).filter((c) => c.severity !== 'info'),
  }
}

export function recusarPedido(p: PedidoDaDemo, recusa: Partial<Recusa>): DetalheDoPedido {
  if (p.status !== 'PENDENTE') {
    throw new ErroDaDemo(409, 'PEDIDO_JA_RESPONDIDO', 'Este pedido já foi respondido.', {
      status: p.status,
    })
  }
  p.status = 'RECUSADO'
  p.recusa = {
    motivo: recusa.motivo ?? 'OUTRO',
    mensagem: recusa.mensagem?.trim() || null,
    idioma: 'pt-BR',
  }
  p.respondidoEm = agoraIso()
  p.respondidoPor = 'RECEPCAO'
  p.avisos.push(comprovante(p, 'PEDIDO_RECUSADO', 'PENDENTE'))
  return detalheDoPedido(p)
}

/* --------------------------------------------------------------------------- a caixa */

type Semente = {
  canal: PedidoDaDemo['canal']
  modo: PedidoDaDemo['modo']
  motivo: PedidoDaDemo['motivo']
  tipoId: string
  profissionalId: string | null
  pacienteIds: string[]
  queixa: string | null
  criadoEm: string
  responderAte: string
  preferencia?: PedidoDaDemo['preferencia']
  /** O horário escolhido (o do primeiro pet). */
  inicio?: string | null
  compartilharHistorico?: boolean
}

let sequencia = 0

function semear(s: Semente, resto: Partial<PedidoDaDemo> = {}): PedidoDaDemo {
  const id = `demo-pedido-${String(++sequencia).padStart(3, '0')}`
  const servico = servicoDe(s.tipoId)
  const primeiro = paciente(s.pacienteIds[0] ?? '')
  const responsavel = primeiro ? cliente(primeiro.clienteId) : null
  const pets = s.pacienteIds.map((pacienteId, i) => {
    const pet = paciente(pacienteId)
    const inicio = s.inicio ? somarMinutos(s.inicio, i * servico.duracaoMinutos) : null
    return {
      pedidoId: `${id}-${i + 1}`,
      nome: pet?.nome ?? '',
      especie: pet?.especie ?? 'OUTRO',
      pacienteId,
      inicio,
      fim: inicio ? somarMinutos(inicio, servico.duracaoMinutos) : null,
      agendamentoId: null,
      agendamento: null,
    }
  })
  const pedido: PedidoDaDemo = {
    id,
    status: 'PENDENTE',
    canal: s.canal,
    modo: s.modo,
    motivo: s.motivo,
    servico,
    profissionalId: s.profissionalId,
    profissionalNome: nomeDoProfissional(s.profissionalId),
    quemPede: responsavel?.nome ?? '',
    pets,
    preferencia: s.preferencia ?? null,
    criadoEm: s.criadoEm,
    responderAte: s.responderAte,
    respondidoEm: null,
    respondidoPor: null,
    recusa: null,
    remarcacao: false,
    ativaVinculo: s.canal === 'APP' && !primeiro?.noApp,
    queixa: s.queixa,
    telefone: s.canal === 'LINK' ? (responsavel?.telefone ?? null) : null,
    email: s.canal === 'LINK' ? (responsavel?.email ?? null) : null,
    compartilharHistorico: s.canal === 'APP' && Boolean(s.compartilharHistorico),
    avisos: [],
    ...resto,
  }
  PEDIDOS.push(pedido)
  return pedido
}

function agoraMais(minutos: number) {
  return somarMinutos(agoraIso(), minutos)
}

/** Um horário livre para o pedido, ou amanhã às 9h se a agenda estiver tomada. */
function livreParaPedido(
  tipoId: string,
  profissionalId: string,
  aPartirDe: string,
  pacienteId: string,
) {
  return (
    primeiroLivre({ tipoId, profissionalIds: [profissionalId], aPartirDe, pacienteId })?.inicio ??
    instante(aPartirDe, '09:00')
  )
}

function montarPendentes() {
  const amanha = somarDias(hoje(), 1)
  const depois = somarDias(hoje(), 2)

  semear({
    canal: 'APP',
    modo: 'HORARIO_ESCOLHIDO',
    motivo: 'SINTOMA',
    tipoId: 'demo-tipo-consulta',
    profissionalId: 'demo-prof-bruno',
    pacienteIds: ['demo-pac-001-2'],
    queixa:
      'A Pipoca está comendo menos feno desde sábado e os dentes da frente parecem compridos. Ainda come as verduras, mas bem devagar.',
    inicio: livreParaPedido('demo-tipo-consulta', 'demo-prof-bruno', amanha, 'demo-pac-001-2'),
    criadoEm: agoraMais(-162),
    responderAte: agoraMais(18),
    compartilharHistorico: true,
  })
  semear({
    canal: 'APP',
    modo: 'MELHOR_HORARIO',
    motivo: 'VACINA',
    tipoId: 'demo-tipo-vacina',
    profissionalId: null,
    pacienteIds: ['demo-pac-018'],
    queixa: 'Vacina antirrábica e reforço da V10 do Tobias. Só consigo de manhã.',
    preferencia: {
      de: amanha,
      ate: somarDias(hoje(), 7),
      periodos: ['MANHA'],
      profissionalId: null,
    },
    criadoEm: agoraMais(-155),
    responderAte: agoraMais(26),
  })
  semear({
    canal: 'LINK',
    modo: 'HORARIO_ESCOLHIDO',
    motivo: 'CHECKUP',
    tipoId: 'demo-tipo-consulta',
    profissionalId: 'demo-prof-marina',
    pacienteIds: ['demo-pac-032'],
    queixa:
      'Check-up anual do Ozzy. Ele está ótimo, mas queria ver as vacinas e um tártaro que apareceu nos dentes de trás.',
    inicio: livreParaPedido('demo-tipo-consulta', 'demo-prof-marina', depois, 'demo-pac-032'),
    criadoEm: agoraMais(-52),
    responderAte: agoraMais(128),
  })

  /* O horário escolhido foi ocupado depois: um agendamento do Dr. Rafael nos próximos dias. */
  const agoraMs = agora().getTime()
  const tomado = AGENDAMENTOS.find(
    (a) =>
      a.profissionalId === 'demo-prof-rafael' &&
      !a.pedidoId &&
      (a.status === 'AGENDADO' || a.status === 'CONFIRMADO') &&
      Date.parse(a.inicio) > agoraMs + 20 * 60 * 60_000 &&
      a.criadoEm < agoraIso(),
  )
  const sumido =
    tomado?.inicio ??
    livreParaPedido('demo-tipo-retorno', 'demo-prof-rafael', amanha, 'demo-pac-037')
  if (tomado) tomado.criadoEm = agoraMais(-21)
  semear({
    canal: 'APP',
    modo: 'HORARIO_ESCOLHIDO',
    motivo: 'RETORNO',
    tipoId: 'demo-tipo-retorno',
    profissionalId: 'demo-prof-rafael',
    pacienteIds: ['demo-pac-037'],
    queixa: 'Retorno do ecocardiograma que o Dr. Rafael pediu. Os exames ficaram prontos ontem.',
    inicio: sumido,
    criadoEm: agoraMais(-38),
    responderAte: agoraMais(142),
    compartilharHistorico: true,
  })
  semear({
    canal: 'LINK',
    modo: 'MELHOR_HORARIO',
    motivo: 'SINTOMA',
    tipoId: 'demo-tipo-consulta',
    profissionalId: null,
    pacienteIds: ['demo-pac-043'],
    queixa:
      'A Charlote está coçando muito as orelhas e balançando a cabeça. Tem um cheiro forte no ouvido esquerdo e ela chora quando encosto.',
    preferencia: {
      de: amanha,
      ate: somarDias(hoje(), 4),
      periodos: ['TARDE'],
      profissionalId: null,
    },
    criadoEm: agoraMais(-9),
    responderAte: agoraMais(171),
  })
  semear({
    canal: 'APP',
    modo: 'HORARIO_ESCOLHIDO',
    motivo: 'VACINA',
    tipoId: 'demo-tipo-vacina',
    profissionalId: 'demo-prof-camila',
    pacienteIds: ['demo-pac-002-2'],
    queixa: 'Segunda dose da antirrábica do Duque.',
    inicio: livreParaPedido('demo-tipo-vacina', 'demo-prof-camila', depois, 'demo-pac-002-2'),
    criadoEm: agoraMais(-28),
    responderAte: agoraMais(152),
  })
  semear({
    canal: 'APP',
    modo: 'MELHOR_HORARIO',
    motivo: 'VACINA',
    tipoId: 'demo-tipo-vacina',
    profissionalId: null,
    pacienteIds: ['demo-pac-023', 'demo-pac-023-2'],
    queixa: 'Vacina anual da Lola e do Teco, de preferência juntos, na semana que vem.',
    preferencia: {
      de: somarDias(hoje(), 5),
      ate: somarDias(hoje(), 11),
      periodos: ['MANHA', 'TARDE'],
      profissionalId: null,
    },
    criadoEm: agoraMais(-74),
    responderAte: agoraMais(106),
    compartilharHistorico: true,
  })
}

/** Os agendamentos da base que vieram do app e do link ganham o pedido que os criou. */
function montarHistorico() {
  const sorte = criarSorteio('agenda-pedidos')
  const agoraMs = agora().getTime()
  const online = AGENDAMENTOS.filter(
    (a) =>
      (a.origem === 'APP' || a.origem === 'LINK') &&
      CONFIGURACAO_ONLINE.tipoIds.includes(a.tipoId) &&
      !a.grupoId &&
      !a.pedidoId &&
      Date.parse(a.inicio) > agoraMs - 14 * 24 * 60 * 60_000 &&
      Date.parse(a.inicio) < agoraMs + 12 * 24 * 60 * 60_000 &&
      Date.parse(a.criadoEm) < agoraMs - 3 * 60 * 60_000 &&
      a.status !== 'CANCELADO',
  )
  const escolhidos = sorte.alguns(online, 9).sort((a, b) => a.criadoEm.localeCompare(b.criadoEm))

  for (const a of escolhidos) {
    const kind = TIPOS.find((t) => t.id === a.tipoId)?.kind
    const motivo: PedidoDaDemo['motivo'] =
      kind === 'VACINA'
        ? 'VACINA'
        : kind === 'RETORNO'
          ? 'RETORNO'
          : sorte.escolher(['CHECKUP', 'SINTOMA'] as const)
    const respondidoEm = somarMinutos(a.criadoEm, sorte.inteiro(14, 150))
    const automatico = a.origem === 'APP' && sorte.chance(0.3)
    const pedido = semear(
      {
        canal: a.origem === 'APP' ? 'APP' : 'LINK',
        modo: 'HORARIO_ESCOLHIDO',
        motivo,
        tipoId: a.tipoId,
        profissionalId: a.profissionalId,
        pacienteIds: [a.pacienteId],
        queixa:
          motivo === 'SINTOMA'
            ? sorte.escolher([
                'Está vomitando desde ontem à noite e não quis comer de manhã.',
                'Mancando da pata de trás depois do passeio.',
                'Coceira forte e feridinhas na barriga.',
                'Olho direito vermelho e lacrimejando.',
              ])
            : null,
        inicio: a.inicio,
        criadoEm: a.criadoEm,
        responderAte: somarMinutos(a.criadoEm, 180),
      },
      {
        status: 'ACEITO',
        respondidoEm: automatico ? somarMinutos(a.criadoEm, 1) : respondidoEm,
        respondidoPor: automatico ? 'AUTOMATICO' : 'RECEPCAO',
      },
    )
    a.pedidoId = pedido.id
    const pet = pedido.pets[0]
    if (pet) pet.agendamentoId = a.id
    pedido.avisos = [
      {
        id: `demo-aviso-pedido-h${pedido.id.slice(-3)}`,
        tipo: 'PEDIDO_ACEITO',
        situacao: 'ENVIADO',
        canal: pedido.canal === 'APP' ? 'PUSH_INBOX' : 'EMAIL',
        motivoSemAviso: null,
        criadoEm: pedido.respondidoEm ?? pedido.criadoEm,
      },
    ]
  }

  const recusados: Array<[Semente, PedidoDaDemo['recusa']]> = [
    [
      {
        canal: 'APP',
        modo: 'HORARIO_ESCOLHIDO',
        motivo: 'CHECKUP',
        tipoId: 'demo-tipo-consulta',
        profissionalId: 'demo-prof-marina',
        pacienteIds: ['demo-pac-004'],
        queixa: 'Check-up e avaliação do peso do Biscoito, que cresceu muito no último mês.',
        inicio: instante(somarDias(hoje(), -1), '16:00'),
        criadoEm: instante(somarDias(hoje(), -3), '20:14'),
        responderAte: instante(somarDias(hoje(), -2), '11:00'),
      },
      {
        motivo: 'SEM_HORARIO',
        mensagem:
          'Oi, Sérgio! Nesse horário a Dra. Marina já estava com a agenda cheia. Temos vaga na sexta de manhã: se servir, peça de novo pelo app que confirmamos na hora.',
        idioma: 'pt-BR',
      },
    ],
    [
      {
        canal: 'LINK',
        modo: 'MELHOR_HORARIO',
        motivo: 'SINTOMA',
        tipoId: 'demo-tipo-consulta',
        profissionalId: 'demo-prof-bruno',
        pacienteIds: ['demo-pac-013'],
        queixa: 'O Kiwi está arrancando as penas do peito e ficou mais quieto.',
        preferencia: {
          de: somarDias(hoje(), -4),
          ate: somarDias(hoje(), 2),
          periodos: [],
          profissionalId: 'demo-prof-bruno',
        },
        criadoEm: instante(somarDias(hoje(), -5), '13:22'),
        responderAte: instante(somarDias(hoje(), -5), '16:22'),
      },
      {
        motivo: 'PRECISA_AVALIAR',
        mensagem:
          'Cristina, para aves o Dr. Bruno prefere conversar antes por telefone para orientar o transporte e o jejum. Vamos ligar para você ainda hoje.',
        idioma: 'pt-BR',
      },
    ],
    [
      {
        canal: 'APP',
        modo: 'HORARIO_ESCOLHIDO',
        motivo: 'SINTOMA',
        tipoId: 'demo-tipo-consulta',
        profissionalId: 'demo-prof-rafael',
        pacienteIds: ['demo-pac-008'],
        queixa:
          'O Chico está respirando com muito barulho e cansando rápido desde ontem. Hoje cedo a língua ficou meio roxa.',
        inicio: instante(somarDias(hoje(), -6), '17:30'),
        criadoEm: instante(somarDias(hoje(), -8), '07:41'),
        responderAte: instante(somarDias(hoje(), -8), '11:00'),
      },
      {
        motivo: 'EMERGENCIA',
        mensagem:
          'Pelo que você descreveu, o Chico precisa ser visto agora. Venha direto para a clínica: a equipe já sabe e atende assim que vocês chegarem.',
        idioma: 'pt-BR',
      },
    ],
  ]
  for (const [semente, recusa] of recusados) {
    const respondidoEm = somarMinutos(semente.criadoEm, semente.motivo === 'SINTOMA' ? 9 : 63)
    const p = semear(semente, {
      status: 'RECUSADO',
      recusa,
      respondidoEm,
      respondidoPor: 'RECEPCAO',
    })
    p.avisos = [
      {
        id: `demo-aviso-pedido-r${p.id.slice(-3)}`,
        tipo: 'PEDIDO_RECUSADO',
        situacao: 'ENVIADO',
        canal: p.canal === 'APP' ? 'PUSH_INBOX' : 'EMAIL',
        motivoSemAviso: null,
        criadoEm: respondidoEm,
      },
    ]
  }

  semear(
    {
      canal: 'APP',
      modo: 'HORARIO_ESCOLHIDO',
      motivo: 'VACINA',
      tipoId: 'demo-tipo-vacina',
      profissionalId: 'demo-prof-camila',
      pacienteIds: ['demo-pac-009'],
      queixa: null,
      inicio: instante(somarDias(hoje(), 3), '09:30'),
      criadoEm: instante(somarDias(hoje(), -2), '22:05'),
      responderAte: instante(somarDias(hoje(), -1), '11:00'),
    },
    { status: 'DESISTIU', respondidoEm: instante(somarDias(hoje(), -1), '07:12') },
  )
  semear(
    {
      canal: 'LINK',
      modo: 'MELHOR_HORARIO',
      motivo: 'CHECKUP',
      tipoId: 'demo-tipo-consulta',
      profissionalId: null,
      pacienteIds: ['demo-pac-025'],
      queixa: 'Primeira consulta da Belinha depois da mudança para o bairro.',
      preferencia: {
        de: somarDias(hoje(), -9),
        ate: somarDias(hoje(), -6),
        periodos: ['MANHA'],
        profissionalId: null,
      },
      criadoEm: instante(somarDias(hoje(), -10), '18:50'),
      responderAte: instante(somarDias(hoje(), -9), '11:00'),
    },
    { status: 'EXPIRADO', respondidoEm: instante(somarDias(hoje(), -6), '12:00') },
  )
}

montarHistorico()
montarPendentes()

/* ------------------------------------------------------------------------- consultas */

export function contagemDosPedidos() {
  const pendentes = PEDIDOS.filter((p) => p.status === 'PENDENTE')
  return {
    esperando: pendentes.length,
    vencendo: pendentes.filter((p) => prazoDe(p) === 'VENCENDO').length,
    atrasados: pendentes.filter((p) => prazoDe(p) === 'ATRASADO').length,
  }
}

export function pedidosDoPaciente(pacienteId: string) {
  return PEDIDOS.filter((p) => p.pets.some((pet) => pet.pacienteId === pacienteId)).map(
    pedidoNaCaixa,
  )
}
