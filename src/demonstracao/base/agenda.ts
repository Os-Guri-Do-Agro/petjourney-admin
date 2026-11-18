/**
 * A agenda da demonstração: de 90 dias atrás a 30 dias à frente, gerada pelo expediente de cada
 * profissional, com o estado de cada horário decidido pela hora da demonstração (ver
 * `relogio.ts`). Às 10:40 de hoje: a manhã já atendida, dois em consulta, alguns aguardando na
 * recepção, um atrasado e a tarde por vir.
 *
 * Os outros dados saem daqui: todo agendamento FINALIZADO ou EM_ATENDIMENTO tem `atendimentoId`
 * (`demo-atd-<id do agendamento>`), que o prontuário monta; FALTA alimenta as faltas; o dia de
 * hoje alimenta o Meu dia e as atividades.
 *
 * O registro guarda o agendamento na forma de `Agendamento` (o `AgendamentoDaAgendaDto` que a
 * agenda lê) sem o paciente embutido e sem os conflitos: `agendamentoDto` monta os dois.
 */
import type { Agendamento } from '@/service/parceiro/agenda-service'

import { criarSorteio, idDe } from '../aleatorio'
import {
  agora,
  agoraIso,
  diaDaSemana,
  diasEntre,
  hoje,
  horaDosMinutos,
  instante,
  minutosDe,
  somarDias,
  somarMinutos,
} from '../relogio'
import { paciente, pacienteDto, pacientesAtivos, PACIENTES } from './cadastro'
import {
  ALMOCO,
  EXPEDIENTE_DOS_PROFISSIONAIS,
  PROFISSIONAIS,
  SALA_PADRAO,
  TIPOS,
  USUARIO_ID,
} from './clinica'

export type AgendamentoDaDemo = Omit<Agendamento, 'paciente' | 'conflitos'> & {
  pacienteId: string
}

export const DIAS_PARA_TRAS = 90
export const DIAS_PARA_FRENTE = 30

export const AGENDAMENTOS: AgendamentoDaDemo[] = []

/** Pacientes que voltam mais vezes: têm histórico longo para mostrar no prontuário. */
const FREQUENTES = [
  'demo-pac-001',
  'demo-pac-002',
  'demo-pac-003',
  'demo-pac-005',
  'demo-pac-007',
  'demo-pac-007-2',
  'demo-pac-008',
  'demo-pac-010',
  'demo-pac-018',
]

/**
 * O dia de hoje montado à mão, para a captura sair sempre com a mesma história. Hora, profissional,
 * paciente, tipo e o estado às 10:40 (a hora padrão). Em outra hora, o estado segue o relógio.
 */
const HOJE: Array<[string, string, string, string]> = [
  ['08:00', 'demo-prof-marina', 'demo-pac-012', 'demo-tipo-consulta'],
  ['08:00', 'demo-prof-bruno', 'demo-pac-006', 'demo-tipo-consulta'],
  ['08:00', 'demo-prof-camila', 'demo-pac-011', 'demo-tipo-vacina'],
  ['08:30', 'demo-prof-marina', 'demo-pac-025', 'demo-tipo-retorno'],
  ['08:30', 'demo-prof-camila', 'demo-pac-021', 'demo-tipo-consulta'],
  ['09:00', 'demo-prof-marina', 'demo-pac-016', 'demo-tipo-vacina'],
  ['09:00', 'demo-prof-bruno', 'demo-pac-028', 'demo-tipo-consulta'],
  ['09:00', 'demo-prof-camila', 'demo-pac-029', 'demo-tipo-consulta'],
  ['09:30', 'demo-prof-marina', 'demo-pac-034', 'demo-tipo-consulta'],
  ['09:30', 'demo-prof-bruno', 'demo-pac-013', 'demo-tipo-consulta'],
  ['09:45', 'demo-prof-camila', 'demo-pac-033', 'demo-tipo-vacina'],
  ['10:00', 'demo-prof-rafael', 'demo-pac-032', 'demo-tipo-retorno'],
  ['10:00', 'demo-prof-camila', 'demo-pac-015', 'demo-tipo-consulta'],
  ['10:15', 'demo-prof-marina', 'demo-pac-001', 'demo-tipo-consulta'],
  ['10:30', 'demo-prof-rafael', 'demo-pac-007', 'demo-tipo-consulta'],
  ['10:30', 'demo-prof-bruno', 'demo-pac-020', 'demo-tipo-consulta'],
  ['10:45', 'demo-prof-marina', 'demo-pac-005', 'demo-tipo-consulta'],
  ['10:45', 'demo-prof-camila', 'demo-pac-024', 'demo-tipo-retorno'],
  ['11:00', 'demo-prof-rafael', 'demo-pac-003', 'demo-tipo-consulta'],
  ['11:00', 'demo-prof-bruno', 'demo-pac-002', 'demo-tipo-consulta'],
  ['11:15', 'demo-prof-marina', 'demo-pac-004', 'demo-tipo-vacina'],
  ['11:30', 'demo-prof-camila', 'demo-pac-039', 'demo-tipo-consulta'],
  ['11:30', 'demo-prof-rafael', 'demo-pac-022', 'demo-tipo-exame'],
  ['13:00', 'demo-prof-marina', 'demo-pac-009', 'demo-tipo-vacina'],
  ['13:00', 'demo-prof-rafael', 'demo-pac-043', 'demo-tipo-retorno'],
  ['13:00', 'demo-prof-bruno', 'demo-pac-019', 'demo-tipo-cirurgia'],
  ['13:30', 'demo-prof-camila', 'demo-pac-030', 'demo-tipo-consulta'],
  ['14:00', 'demo-prof-marina', 'demo-pac-026', 'demo-tipo-consulta'],
  ['14:00', 'demo-prof-rafael', 'demo-pac-027', 'demo-tipo-consulta'],
  ['14:30', 'demo-prof-camila', 'demo-pac-035', 'demo-tipo-vacina'],
  ['14:30', 'demo-prof-marina', 'demo-pac-031', 'demo-tipo-retorno'],
  ['15:00', 'demo-prof-rafael', 'demo-pac-014', 'demo-tipo-consulta'],
  ['15:00', 'demo-prof-bruno', 'demo-pac-028', 'demo-tipo-consulta'],
  ['15:30', 'demo-prof-camila', 'demo-pac-044', 'demo-tipo-consulta'],
  ['16:00', 'demo-prof-marina', 'demo-pac-036-2', 'demo-tipo-vacina'],
  ['16:00', 'demo-prof-rafael', 'demo-pac-038', 'demo-tipo-consulta'],
  ['16:30', 'demo-prof-bruno', 'demo-pac-042', 'demo-tipo-consulta'],
  ['17:00', 'demo-prof-rafael', 'demo-pac-045', 'demo-tipo-consulta'],
  ['17:30', 'demo-prof-rafael', 'demo-pac-023', 'demo-tipo-retorno'],
  ['18:00', 'demo-prof-rafael', 'demo-pac-041', 'demo-tipo-consulta'],
]

/** Quem chegou e não foi atendido, às 10:40: aparecem como aguardando na recepção. */
const AGUARDANDO_HOJE = new Set(['demo-pac-005', 'demo-pac-024', 'demo-pac-003'])

/**
 * Os internados de agora (`dados/internacao-roteiro.ts`: Chico, Duna, Bento, Toddy e Floquinho):
 * não têm consulta marcada hoje nem na semana que vem.
 */
const INTERNADOS_AGORA = new Set([
  'demo-pac-008',
  'demo-pac-010',
  'demo-pac-007-2',
  'demo-pac-040',
  'demo-pac-017',
])

const PACIENTES_DE_HOJE = new Set(HOJE.map(([, , pacienteId]) => pacienteId))

/**
 * Dias mínimos entre duas visitas do mesmo pet, sorteados por pet (de 3 semanas a 2 meses e meio);
 * os frequentes, que tratam alguma coisa, voltam antes.
 */
const INTERVALO_POR_PET = new Map<string, number>()

function intervaloDe(pacienteId: string, sorte: ReturnType<typeof criarSorteio>) {
  let dias = INTERVALO_POR_PET.get(pacienteId)
  if (dias === undefined) {
    dias = FREQUENTES.includes(pacienteId) ? sorte.inteiro(10, 16) : sorte.inteiro(21, 75)
    INTERVALO_POR_PET.set(pacienteId, dias)
  }
  return dias
}

/** A última visita marcada de cada pet, enquanto a agenda é montada do passado para o futuro. */
const ULTIMA_VISITA = new Map<string, string>()
/** Quem faltou hoje cedo. */
const FALTOU_HOJE = new Set(['demo-pac-029'])
/** Quem não chegou ainda, já passado o horário (atrasado). */
const ATRASADO_HOJE = new Set(['demo-pac-020'])

function tipoDe(id: string) {
  const t = TIPOS.find((x) => x.id === id)
  if (!t) throw new Error(`demonstração: tipo ${id}`)
  return t
}

function salasPara(tipoId: string, profissionalId: string): string[] {
  const kind = tipoDe(tipoId).kind
  if (kind === 'VACINA' || kind === 'EXAME') return ['demo-sala-vac']
  if (kind === 'CIRURGIA') return ['demo-sala-cir']
  return [SALA_PADRAO[profissionalId] ?? 'demo-sala-c1']
}

function origemPara(kind: string, sorte: ReturnType<typeof criarSorteio>) {
  if (kind === 'RETORNO') return 'RETORNO' as const
  if (kind === 'EMERGENCIA') return 'ENCAIXE' as const
  return sorte.pesado([
    ['RECEPCAO', 45],
    ['APP', 28],
    ['LINK', 12],
    ['TELEFONE', 15],
  ] as const)
}

let sequencia = 0

function novo(
  data: string,
  hora: string,
  profissionalId: string,
  pacienteId: string,
  tipoId: string,
  sorte: ReturnType<typeof criarSorteio>,
): AgendamentoDaDemo {
  const t = tipoDe(tipoId)
  const inicio = instante(data, hora)
  const fim = somarMinutos(inicio, t.duracaoMinutos)
  const id = idDe('demo-ag', ++sequencia)
  const origem = origemPara(t.kind, sorte)
  const criadoEm = somarMinutos(inicio, -sorte.inteiro(2, 20) * 24 * 60)

  return {
    id,
    versao: 1,
    status: 'AGENDADO',
    origem,
    encaixe: origem === 'ENCAIXE',
    inicio,
    fim,
    duracaoMinutos: t.duracaoMinutos,
    pacienteId,
    profissionalId,
    tipoId,
    salaIds: salasPara(tipoId, profissionalId),
    grupoId: null,
    observacao: null,
    confirmadoEm: null,
    confirmadoPor: null,
    chegadaEm: null,
    iniciadoEm: null,
    finalizadoEm: null,
    canceladoEm: null,
    motivoCancelamento: null,
    canceladoPor: null,
    atendimentoId: null,
    pedidoId: null,
    remarcadoDeId: null,
    faltaEm: null,
    reagendadoComoId: null,
    criadoPorId: origem === 'APP' || origem === 'LINK' ? null : USUARIO_ID,
    criadoEm,
    atualizadoEm: criadoEm,
  }
}

/** Decide o estado pelo relógio: o que passou foi atendido, o que está agora está em sala. */
function viverAte(a: AgendamentoDaDemo, sorte: ReturnType<typeof criarSorteio>, deHoje: boolean) {
  const agoraMs = agora().getTime()
  const inicioMs = Date.parse(a.inicio)
  const fimMs = Date.parse(a.fim)
  const confirmar = () => {
    if (a.origem === 'APP' || sorte.chance(0.5)) {
      a.confirmadoEm = somarMinutos(a.inicio, -sorte.inteiro(18, 40) * 60)
      a.confirmadoPor = a.origem === 'APP' ? 'APP' : 'RECEPCAO'
    }
  }

  if (deHoje && FALTOU_HOJE.has(a.pacienteId) && inicioMs + 30 * 60_000 < agoraMs) {
    a.status = 'FALTA'
    a.faltaEm = somarMinutos(a.inicio, 30)
    return
  }

  if (
    deHoje &&
    ATRASADO_HOJE.has(a.pacienteId) &&
    inicioMs < agoraMs &&
    agoraMs < fimMs + 60 * 60_000
  ) {
    confirmar()
    a.status = a.confirmadoEm ? 'CONFIRMADO' : 'AGENDADO'
    return
  }

  if (
    deHoje &&
    AGUARDANDO_HOJE.has(a.pacienteId) &&
    inicioMs - 25 * 60_000 < agoraMs &&
    agoraMs < fimMs + 30 * 60_000
  ) {
    confirmar()
    a.status = 'AGUARDANDO'
    a.chegadaEm = somarMinutos(a.inicio, -sorte.inteiro(5, 15))
    return
  }

  if (fimMs <= agoraMs) {
    const sorteio = deHoje
      ? 'FINALIZADO'
      : sorte.pesado([
          ['FINALIZADO', 86],
          ['FALTA', 6],
          ['CANCELADO', 8],
        ] as const)
    if (sorteio === 'CANCELADO') {
      a.status = 'CANCELADO'
      a.canceladoEm = somarMinutos(a.inicio, -sorte.inteiro(3, 48) * 60)
      a.motivoCancelamento = sorte.pesado([
        ['RESPONSAVEL_DESMARCOU', 70],
        ['CLINICA_REMARCOU', 15],
        ['PACIENTE_INDISPONIVEL', 15],
      ] as const)
      a.canceladoPor = a.origem === 'APP' ? 'APP' : 'RECEPCAO'
      return
    }
    confirmar()
    if (sorteio === 'FALTA') {
      a.status = 'FALTA'
      a.faltaEm = somarMinutos(a.inicio, 30)
      return
    }
    a.status = 'FINALIZADO'
    a.chegadaEm = somarMinutos(a.inicio, -sorte.inteiro(2, 14))
    a.iniciadoEm = somarMinutos(a.inicio, sorte.inteiro(0, 8))
    a.finalizadoEm = somarMinutos(a.fim, sorte.inteiro(-3, 9))
    a.atendimentoId = `demo-atd-${a.id}`
    return
  }

  if (inicioMs <= agoraMs) {
    confirmar()
    a.status = 'EM_ATENDIMENTO'
    a.chegadaEm = somarMinutos(a.inicio, -sorte.inteiro(3, 12))
    a.iniciadoEm = somarMinutos(a.inicio, sorte.inteiro(0, 5))
    a.atendimentoId = `demo-atd-${a.id}`
    return
  }

  const horasAte = (inicioMs - agoraMs) / 3_600_000
  if (horasAte <= 48) confirmar()
  a.status = a.confirmadoEm ? 'CONFIRMADO' : 'AGENDADO'
  if (horasAte > 48 && sorte.chance(0.04)) {
    a.status = 'CANCELADO'
    a.canceladoEm = somarMinutos(agora().toISOString(), -sorte.inteiro(1, 72) * 60)
    a.motivoCancelamento = 'RESPONSAVEL_DESMARCOU'
    a.canceladoPor = a.origem === 'APP' ? 'APP' : 'RECEPCAO'
  }
}

function podeVir(
  pacienteId: string,
  data: string,
  distancia: number,
  sorte: ReturnType<typeof criarSorteio>,
) {
  const p = paciente(pacienteId)
  if (!p?.ativo || p.criadoEm.slice(0, 10) > data) return false
  if (distancia >= 0 && distancia <= 7 && INTERNADOS_AGORA.has(pacienteId)) return false
  /* Quem vem hoje não esteve aqui nos últimos dias (a história de hoje é a primeira visita do mês). */
  if (distancia < 0 && distancia >= -14 && PACIENTES_DE_HOJE.has(pacienteId)) return false
  const ultima = ULTIMA_VISITA.get(pacienteId)
  return !ultima || diasEntre(ultima, data) >= intervaloDe(pacienteId, sorte)
}

function escolherPaciente(
  data: string,
  distancia: number,
  ativos: ReturnType<typeof pacientesAtivos>,
  sorte: ReturnType<typeof criarSorteio>,
) {
  for (let tentativa = 0; tentativa < 14; tentativa++) {
    const id = sorte.chance(0.08) ? sorte.escolher(FREQUENTES) : sorte.escolher(ativos).id
    if (podeVir(id, data, distancia, sorte)) return id
  }
  return null
}

function gerarDia(data: string, sorte: ReturnType<typeof criarSorteio>) {
  const semana = diaDaSemana(data)
  const distancia = Math.round(
    (Date.parse(`${data}T12:00:00Z`) - Date.parse(`${hoje()}T12:00:00Z`)) / 86_400_000,
  )
  const ocupacao =
    distancia < 0
      ? 0.62
      : distancia <= 2
        ? 0.66
        : distancia <= 7
          ? 0.42
          : distancia <= 14
            ? 0.24
            : 0.1
  const ativos = pacientesAtivos()

  for (const prof of PROFISSIONAIS) {
    const faixa = EXPEDIENTE_DOS_PROFISSIONAIS[prof.id]?.[semana]
    if (!faixa) continue
    let minuto = minutosDe(faixa.inicio)
    const fimDoDia = minutosDe(faixa.fim)

    while (minuto < fimDoDia) {
      const noAlmoco = minuto >= minutosDe(ALMOCO.inicio) && minuto < minutosDe(ALMOCO.fim)
      if (noAlmoco) {
        minuto = minutosDe(ALMOCO.fim)
        continue
      }
      const tipoId = sorte.pesado([
        ['demo-tipo-consulta', 52],
        ['demo-tipo-retorno', 22],
        ['demo-tipo-vacina', 8],
        ['demo-tipo-exame', 8],
        ['demo-tipo-emergencia', 4],
        ['demo-tipo-cirurgia', prof.id === 'demo-prof-bruno' ? 6 : 0],
      ] as const)
      const duracao = tipoDe(tipoId).duracaoMinutos
      if (minuto + duracao > fimDoDia) break

      const pacienteId = sorte.chance(ocupacao)
        ? escolherPaciente(data, distancia, ativos, sorte)
        : null
      if (pacienteId) {
        const a = novo(data, horaDosMinutos(minuto), prof.id, pacienteId, tipoId, sorte)
        viverAte(a, sorte, false)
        AGENDAMENTOS.push(a)
        if (a.status !== 'CANCELADO') ULTIMA_VISITA.set(pacienteId, data)
        minuto += duracao
      } else {
        minuto += 30
      }
      if (minuto % 15) minuto += 15 - (minuto % 15)
    }
  }
}

function gerarHoje(sorte: ReturnType<typeof criarSorteio>) {
  const data = hoje()
  if (diaDaSemana(data) === 0) return
  const sabado = diaDaSemana(data) === 6

  for (const [hora, profissionalId, pacienteId, tipoId] of HOJE) {
    if (sabado && minutosDe(hora) >= minutosDe('13:00')) continue
    if (!PACIENTES.some((p) => p.id === pacienteId && p.ativo)) continue
    const a = novo(data, hora, profissionalId, pacienteId, tipoId, sorte)
    if (tipoDe(tipoId).kind === 'EMERGENCIA') a.encaixe = true
    viverAte(a, sorte, true)
    AGENDAMENTOS.push(a)
    ULTIMA_VISITA.set(pacienteId, data)
  }
}

function gerar() {
  const sorte = criarSorteio('agenda')
  const dia = hoje()
  /* Cada pet já tinha vindo antes da janela, em dias diferentes: sem isso, todos chegam juntos. */
  for (const p of PACIENTES) {
    ULTIMA_VISITA.set(p.id, somarDias(dia, -DIAS_PARA_TRAS - sorte.inteiro(0, 70)))
  }
  for (let d = -DIAS_PARA_TRAS; d <= DIAS_PARA_FRENTE; d++) {
    const data = somarDias(dia, d)
    if (d === 0) gerarHoje(sorte)
    else gerarDia(data, sorte)
  }
  AGENDAMENTOS.sort((a, b) => a.inicio.localeCompare(b.inicio))
}

gerar()

/* ------------------------------------------------------------------------------ consultas */

export function agendamento(id: string) {
  return AGENDAMENTOS.find((a) => a.id === id) ?? null
}

/** Os agendamentos de um dia (`AAAA-MM-DD`), em ordem de horário. */
export function agendamentosDoDia(data: string) {
  return AGENDAMENTOS.filter((a) => a.inicio.startsWith(data))
}

/** Os agendamentos entre duas datas (inclusive), em ordem. */
export function agendamentosEntre(de: string, ate: string) {
  return AGENDAMENTOS.filter((a) => a.inicio.slice(0, 10) >= de && a.inicio.slice(0, 10) <= ate)
}

export function agendamentosDoPaciente(pacienteId: string) {
  return AGENDAMENTOS.filter((a) => a.pacienteId === pacienteId)
}

export function agendamentoDoAtendimento(atendimentoId: string) {
  return AGENDAMENTOS.find((a) => a.atendimentoId === atendimentoId) ?? null
}

/** O agendamento na forma que a agenda lê, com o paciente embutido e sem conflitos. */
export function agendamentoDto(a: AgendamentoDaDemo): Agendamento {
  const p = pacienteDto(a.pacienteId)
  const { pacienteId: _pacienteId, ...resto } = a
  return {
    ...resto,
    paciente: {
      id: p.id,
      nome: p.nome,
      especie: p.especie,
      clienteId: p.cliente.id,
      clienteNome: p.cliente.nome,
      fotoUrl: p.fotoUrl,
    },
    conflitos: [],
  }
}

/** Cria um agendamento novo (a tela de novo agendamento e os encaixes). */
export function criarAgendamento(
  dados: Pick<AgendamentoDaDemo, 'pacienteId' | 'profissionalId' | 'tipoId' | 'inicio'> &
    Partial<AgendamentoDaDemo>,
): AgendamentoDaDemo {
  const t = tipoDe(dados.tipoId)
  const duracao = dados.duracaoMinutos ?? t.duracaoMinutos
  const id = idDe('demo-ag', ++sequencia)
  const criadoEm = agoraIso()
  const registro: AgendamentoDaDemo = {
    id,
    versao: 1,
    status: 'AGENDADO',
    origem: 'RECEPCAO',
    encaixe: false,
    fim: somarMinutos(dados.inicio, duracao),
    duracaoMinutos: duracao,
    salaIds: salasPara(dados.tipoId, dados.profissionalId),
    grupoId: null,
    observacao: null,
    confirmadoEm: null,
    confirmadoPor: null,
    chegadaEm: null,
    iniciadoEm: null,
    finalizadoEm: null,
    canceladoEm: null,
    motivoCancelamento: null,
    canceladoPor: null,
    atendimentoId: null,
    pedidoId: null,
    remarcadoDeId: null,
    faltaEm: null,
    reagendadoComoId: null,
    criadoPorId: USUARIO_ID,
    criadoEm,
    atualizadoEm: criadoEm,
    ...dados,
  }
  AGENDAMENTOS.push(registro)
  AGENDAMENTOS.sort((a, b) => a.inicio.localeCompare(b.inicio))
  return registro
}
