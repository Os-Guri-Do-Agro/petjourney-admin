/**
 * As faltas da demonstração (E3-03), a partir dos agendamentos FALTA da base: cada uma com os
 * registros de contato (a última com contato vale), as de hoje e as mais recentes ainda sem
 * ninguém ter procurado. Três pacientes são reincidentes (três faltas ou mais em 12 meses): as
 * faltas antigas deles são criadas aqui, antes do começo da agenda da base (90 dias).
 */
import type { JustificativaDeFaltaDto, ObitoRegistradoDto } from '@/service/contrato/openapi'
import type {
  FaltaDoAgendamento,
  FaltaMarcada,
  FaltaNoHistorico,
  NovaJustificativa,
  ResumoDeFaltas,
  RespostaDoLote,
} from '@/service/parceiro/faltas-service'

import { criarSorteio } from '../aleatorio'
import { AGENDAMENTOS, criarAgendamento, type AgendamentoDaDemo } from '../base/agenda'
import { cliente, paciente } from '../base/cadastro'
import { PROFISSIONAIS, TIPOS, USUARIO_ID } from '../base/clinica'
import { agora, agoraIso, diaDaSemana, hoje, instante, somarDias, somarMinutos } from '../relogio'
import {
  criarNaAgenda,
  doGrupo,
  dtoDe,
  dtosDe,
  ErroDaDemo,
  guardarDesfazer,
  mutacaoDe,
  retratar,
  RISCADOS,
  statusInvalido,
  tocar,
} from './agenda-grade'

/** Os registros de cada falta, do mais antigo ao mais recente. */
const REGISTROS = new Map<string, JustificativaDeFaltaDto[]>()

export const LIMITE_DE_REINCIDENCIA = 3

let sequencia = 0

function novoId() {
  return `demo-justificativa-${String(++sequencia).padStart(4, '0')}`
}

const QUEM_REGISTRA = [
  { profissionalId: null, profissionalNome: 'Juliana Prado', usuarioId: 'demo-usr-juliana' },
  { profissionalId: null, profissionalNome: 'Juliana Prado', usuarioId: 'demo-usr-juliana' },
  { profissionalId: null, profissionalNome: 'Patrícia Lima', usuarioId: 'demo-usr-patricia' },
  {
    profissionalId: 'demo-prof-marina',
    profissionalNome: 'Dra. Marina Albuquerque',
    usuarioId: USUARIO_ID,
  },
] as const

const OBSERVACOES: Partial<Record<NonNullable<JustificativaDeFaltaDto['motivo']>, string[]>> = {
  ESQUECEU: [
    'Disse que esqueceu completamente. Pediu para receber o lembrete da véspera pelo app.',
    'Esqueceu, estava viajando a trabalho. Vai remarcar pelo app.',
    'Achou que era no dia seguinte.',
  ],
  IMPREVISTO: [
    'Teve um problema com o carro no caminho.',
    'Imprevisto no trabalho, não conseguiu sair a tempo.',
    'Filho doente, ficou em casa.',
  ],
  TRANSPORTE: [
    'O motorista do aplicativo não aceitou levar o animal.',
    'Sem carro na semana; vai ver com a irmã para trazer.',
  ],
  PACIENTE_MELHOROU: [
    'Disse que melhorou e não viu necessidade. Orientamos a vir mesmo assim para o retorno.',
    'Os sintomas passaram. Combinamos de remarcar só a vacina.',
  ],
  EMERGENCIA: ['Levou a outro pet da família ao pronto-socorro na mesma hora.'],
  CUSTO: ['Pediu para remarcar depois do dia 5, quando recebe.'],
  INSATISFACAO: ['Reclamou da espera da última consulta. Repassado à Marina.'],
  OUTRO: ['Mudou de bairro e está vendo se continua com a clínica.'],
}

function registrar(
  agendamentoId: string,
  dados: Pick<JustificativaDeFaltaDto, 'motivo' | 'canal' | 'observacao' | 'registradaEm'> &
    Partial<JustificativaDeFaltaDto>,
) {
  const registro: JustificativaDeFaltaDto = {
    id: novoId(),
    profissionalId: null,
    profissionalNome: null,
    usuarioId: null,
    ...dados,
  }
  REGISTROS.set(agendamentoId, [...(REGISTROS.get(agendamentoId) ?? []), registro])
  return registro
}

/* ------------------------------------------------------------------------------ leitura */

function registrosDe(agendamentoId: string) {
  return REGISTROS.get(agendamentoId) ?? []
}

function situacaoDe(agendamentoId: string): FaltaDoAgendamento['situacao'] {
  const lista = registrosDe(agendamentoId)
  if (lista.some((r) => r.motivo === 'OBITO')) return 'ENCERRADA'
  if (lista.some((r) => r.canal !== 'SEM_RESPOSTA')) return 'JUSTIFICADA'
  return lista.length ? 'SEM_RESPOSTA' : 'PENDENTE'
}

function vigenteDe(agendamentoId: string) {
  return [...registrosDe(agendamentoId)].reverse().find((r) => r.canal !== 'SEM_RESPOSTA') ?? null
}

export function faltaDto(a: AgendamentoDaDemo): FaltaDoAgendamento {
  const principal = principalDe(a)
  const situacao = situacaoDe(principal.id)
  return {
    agendamentoId: principal.id,
    faltaEm: principal.faltaEm,
    situacao,
    aceitaReagendamento: situacao !== 'ENCERRADA',
    reagendadoComoId: principal.reagendadoComoId,
    vigente: vigenteDe(principal.id),
    justificativas: [...registrosDe(principal.id)].reverse(),
  }
}

function principalDe(a: AgendamentoDaDemo) {
  return a.grupoId ? (AGENDAMENTOS.find((o) => o.id === a.grupoId) ?? a) : a
}

function faltasPrincipais() {
  return AGENDAMENTOS.filter((a) => a.status === 'FALTA' && (!a.grupoId || a.grupoId === a.id))
}

/** "Voltou depois?": o reagendamento ou o primeiro agendamento criado depois, até 60 dias. */
function voltouDepois(a: AgendamentoDaDemo): FaltaNoHistorico['voltouDepois'] {
  if (a.reagendadoComoId) {
    const novo = AGENDAMENTOS.find((o) => o.id === a.reagendadoComoId)
    if (novo)
      return { agendamentoId: novo.id, inicio: novo.inicio, status: novo.status, explicito: true }
  }
  const limite = Date.parse(a.inicio) + 60 * 24 * 60 * 60_000
  const depois = AGENDAMENTOS.find(
    (o) =>
      o.pacienteId === a.pacienteId &&
      o.id !== a.id &&
      o.status !== 'CANCELADO' &&
      Date.parse(o.inicio) > Date.parse(a.inicio) &&
      Date.parse(o.criadoEm) > Date.parse(a.inicio) &&
      Date.parse(o.criadoEm) <= limite,
  )
  return depois
    ? { agendamentoId: depois.id, inicio: depois.inicio, status: depois.status, explicito: false }
    : null
}

function aConvidar(a: AgendamentoDaDemo) {
  return (
    situacaoDe(a.id) !== 'ENCERRADA' && !voltouDepois(a) && Boolean(paciente(a.pacienteId)?.ativo)
  )
}

function pacienteNoPainel(pacienteId: string) {
  const p = paciente(pacienteId)
  return {
    id: pacienteId,
    nome: p?.nome ?? '',
    especie: p?.especie ?? 'OUTRO',
    ativo: Boolean(p?.ativo),
    obito: p?.inativoMotivo === 'OBITO',
  }
}

function semContato(a: AgendamentoDaDemo) {
  const situacao = situacaoDe(a.id)
  return situacao === 'PENDENTE' || situacao === 'SEM_RESPOSTA'
}

/** O painel: um item por responsável e paciente, mais faltas primeiro, depois mais minutos. */
export function painelDeFaltas(filtro: {
  de: string
  ate: string
  reincidentes: boolean
  semJustificativa: boolean
}): ResumoDeFaltas[] {
  const umAnoAtras = somarDias(hoje(), -365)
  const porPaciente = new Map<string, AgendamentoDaDemo[]>()
  for (const a of faltasPrincipais()) {
    porPaciente.set(a.pacienteId, [...(porPaciente.get(a.pacienteId) ?? []), a])
  }

  const itens: ResumoDeFaltas[] = []
  for (const [pacienteId, todas] of porPaciente) {
    const p = paciente(pacienteId)
    if (!p) continue
    const doPeriodo = todas
      .filter((a) => a.inicio.slice(0, 10) >= filtro.de && a.inicio.slice(0, 10) <= filtro.ate)
      .sort((a, b) => a.inicio.localeCompare(b.inicio))
    const ultima = doPeriodo[doPeriodo.length - 1]
    if (!ultima) continue
    const faltas12Meses = todas.filter((a) => a.inicio.slice(0, 10) >= umAnoAtras).length
    const item: ResumoDeFaltas = {
      cliente: { id: p.clienteId, nome: cliente(p.clienteId)?.nome ?? '' },
      paciente: pacienteNoPainel(pacienteId),
      faltas: doPeriodo.length,
      minutosPerdidos: doPeriodo.reduce((soma, a) => soma + a.duracaoMinutos, 0),
      ultimaFaltaEm: ultima.faltaEm ?? ultima.inicio,
      faltas12Meses,
      reincidente: faltas12Meses >= LIMITE_DE_REINCIDENCIA,
      semJustificativa: doPeriodo.filter(semContato).length,
      naoProcuradas: doPeriodo.filter((a) => situacaoDe(a.id) === 'PENDENTE').length,
      aConvidar: aConvidar(ultima),
    }
    if (filtro.reincidentes && !item.reincidente) continue
    if (filtro.semJustificativa && !item.semJustificativa) continue
    itens.push(item)
  }

  return itens.sort(
    (a, b) =>
      b.faltas - a.faltas ||
      b.minutosPerdidos - a.minutosPerdidos ||
      b.ultimaFaltaEm.localeCompare(a.ultimaFaltaEm),
  )
}

/** As faltas de um responsável, da mais recente. */
export function historicoDoCliente(clienteId: string): FaltaNoHistorico[] {
  return faltasPrincipais()
    .filter((a) => paciente(a.pacienteId)?.clienteId === clienteId)
    .sort((a, b) => b.inicio.localeCompare(a.inicio))
    .map((a) => {
      const tipo = TIPOS.find((t) => t.id === a.tipoId)
      const quem = PROFISSIONAIS.find((p) => p.id === a.profissionalId)
      const vigente = vigenteDe(a.id)
      const observacao = vigente?.observacao ?? null
      const cortada = observacao !== null && [...observacao].length > 140
      return {
        agendamentoId: a.id,
        paciente: pacienteNoPainel(a.pacienteId),
        inicio: a.inicio,
        fim: a.fim,
        minutosPerdidos: a.duracaoMinutos,
        tipo: { id: a.tipoId, nome: tipo?.nome ?? '', kind: tipo?.kind ?? 'CONSULTA' },
        profissional: { id: a.profissionalId, nome: quem?.nome ?? '' },
        faltaEm: a.faltaEm,
        situacao: situacaoDe(a.id),
        vigente: vigente
          ? {
              id: vigente.id,
              motivo: vigente.motivo,
              canal: vigente.canal,
              observacao: cortada
                ? `${[...(observacao ?? '')].slice(0, 140).join('')}…`
                : observacao,
              observacaoCortada: cortada,
              profissionalId: vigente.profissionalId,
              usuarioId: vigente.usuarioId,
              registradaEm: vigente.registradaEm,
            }
          : null,
        registros: registrosDe(a.id).length,
        voltouDepois: voltouDepois(a),
        aConvidar: aConvidar(a),
      }
    })
}

/* ------------------------------------------------------------------------------ escrita */

function conferirJustificativa(corpo: Partial<NovaJustificativa>): NovaJustificativa {
  const canal = corpo.canal ?? 'SEM_RESPOSTA'
  if (canal !== 'SEM_RESPOSTA' && !corpo.motivo) {
    throw new ErroDaDemo(400, 'JUSTIFICATIVA_INVALIDA', 'Diga o motivo da falta.', {
      reason: 'MOTIVO_OBRIGATORIO',
    })
  }
  if (canal === 'SEM_RESPOSTA' && corpo.motivo) {
    throw new ErroDaDemo(400, 'JUSTIFICATIVA_INVALIDA', 'Sem resposta não tem motivo.', {
      reason: 'MOTIVO_EM_SEM_RESPOSTA',
    })
  }
  if (corpo.obitoEm && corpo.obitoEm > hoje()) {
    throw new ErroDaDemo(400, 'JUSTIFICATIVA_INVALIDA', 'O óbito não pode ser depois de hoje.', {
      reason: 'OBITO_NO_FUTURO',
    })
  }
  return { ...corpo, canal }
}

/** O óbito encerra o caso: o paciente fica inativo e os horários dele em diante são cancelados. */
function registrarObito(a: AgendamentoDaDemo, obitoEm: string): ObitoRegistradoDto {
  const p = paciente(a.pacienteId)
  if (p) {
    p.ativo = false
    p.inativoMotivo = 'OBITO'
    p.obitoEm = obitoEm
  }
  let cancelados = 0
  for (const o of AGENDAMENTOS) {
    if (o.pacienteId !== a.pacienteId || o.inicio.slice(0, 10) < obitoEm) continue
    if (o.status !== 'AGENDADO' && o.status !== 'CONFIRMADO') continue
    o.status = 'CANCELADO'
    o.canceladoEm = agoraIso()
    o.motivoCancelamento = 'OBITO'
    o.canceladoPor = 'RECEPCAO'
    tocar(o)
    cancelados++
  }
  return {
    obitoEm,
    agendamentosCancelados: cancelados,
    vinculosEncerrados: p ? 1 : 0,
    reservasCanceladas: [],
    reservasAjustadas: [],
    hospedagensEncerradas: [],
  }
}

function quemSouEu() {
  return {
    profissionalId: 'demo-prof-marina',
    profissionalNome: 'Dra. Marina Albuquerque',
    usuarioId: USUARIO_ID,
  }
}

function justificarAgora(a: AgendamentoDaDemo, corpo: NovaJustificativa) {
  const registro = registrar(a.id, {
    motivo: corpo.canal === 'SEM_RESPOSTA' ? null : (corpo.motivo ?? null),
    canal: corpo.canal,
    observacao: corpo.observacao?.trim() || null,
    registradaEm: agoraIso(),
    ...quemSouEu(),
  })
  const obito =
    corpo.motivo === 'OBITO' ? registrarObito(a, corpo.obitoEm ?? a.inicio.slice(0, 10)) : null
  return { registro, obito }
}

export function marcarFalta(
  a: AgendamentoDaDemo,
  corpo: { justificativa?: Partial<NovaJustificativa> },
): FaltaMarcada {
  if (a.status !== 'AGENDADO' && a.status !== 'CONFIRMADO') statusInvalido(a, 'falta')
  if (Date.parse(a.inicio) > agora().getTime()) {
    throw new ErroDaDemo(409, 'FALTA_ANTES_DO_HORARIO', 'A falta só vale depois do início.', {
      inicio: a.inicio,
    })
  }
  const justificativa = corpo.justificativa ? conferirJustificativa(corpo.justificativa) : null
  const grupo = doGrupo(a)
  const retratos = retratar(grupo)
  for (const g of grupo) {
    g.status = 'FALTA'
    g.faltaEm = agoraIso()
    tocar(g)
  }
  const principal = principalDe(a)
  const feito = justificativa ? justificarAgora(principal, justificativa) : null
  const desfazer = feito?.obito
    ? null
    : guardarDesfazer(retratos, [], () => {
        if (!feito) return
        REGISTROS.set(
          principal.id,
          registrosDe(principal.id).filter((r) => r.id !== feito.registro.id),
        )
      })
  return {
    ...mutacaoDe(a, grupo, desfazer),
    falta: faltaDto(principal),
    obito: feito?.obito ?? null,
  }
}

export function justificarFalta(a: AgendamentoDaDemo, corpo: Partial<NovaJustificativa>) {
  if (a.status !== 'FALTA') statusInvalido(a, 'justificar')
  const principal = principalDe(a)
  if (situacaoDe(principal.id) === 'ENCERRADA') {
    throw new ErroDaDemo(409, 'FALTA_ENCERRADA', 'O caso desta falta está encerrado.')
  }
  if (registrosDe(principal.id).length >= 20) {
    throw new ErroDaDemo(409, 'JUSTIFICATIVAS_NO_LIMITE', 'Esta falta já tem 20 registros.', {
      maxJustificativas: 20,
    })
  }
  const { obito } = justificarAgora(principal, conferirJustificativa(corpo))
  tocar(principal)
  return { falta: faltaDto(principal), agendamento: dtoDe(principal), obito }
}

export function reagendarFalta(
  a: AgendamentoDaDemo,
  corpo: {
    inicio?: string
    profissionalId?: string
    tipoId?: string
    salaIds?: string[]
    duracaoMinutos?: number
    observacao?: string | null
    confirmarConflitos?: string[]
  },
) {
  if (a.status !== 'FALTA') statusInvalido(a, 'reagendar')
  const principal = principalDe(a)
  if (situacaoDe(principal.id) === 'ENCERRADA') {
    throw new ErroDaDemo(409, 'FALTA_ENCERRADA', 'O caso desta falta está encerrado.')
  }
  const anterior = AGENDAMENTOS.find((o) => o.id === principal.reagendadoComoId)
  if (anterior && !RISCADOS.includes(anterior.status)) {
    throw new ErroDaDemo(409, 'FALTA_JA_REAGENDADA', 'Esta falta já foi reagendada.', {
      reagendadoComoId: anterior.id,
    })
  }
  const retratos = retratar([principal])
  const { principal: novo } = criarNaAgenda(
    {
      pacienteId: principal.pacienteId,
      profissionalId: corpo.profissionalId ?? principal.profissionalId,
      tipoId: corpo.tipoId ?? principal.tipoId,
      inicio: corpo.inicio ?? principal.inicio,
      duracaoMinutos: corpo.duracaoMinutos,
      salaIds: corpo.salaIds ?? principal.salaIds,
      observacao: corpo.observacao ?? null,
      confirmarConflitos: corpo.confirmarConflitos?.includes('holiday-closed')
        ? ['holiday-closed']
        : undefined,
    },
    { remarcadoDeId: principal.id },
  )
  principal.reagendadoComoId = novo.id
  tocar(principal)
  return mutacaoDe(novo, [novo, principal], guardarDesfazer(retratos, [novo]))
}

export function faltasEmLote(corpo: {
  data?: string
  profissionalId?: string
  agendamentoIds?: string[]
}): RespostaDoLote {
  const ids = corpo.agendamentoIds ?? []
  if (ids.length > 100) {
    throw new ErroDaDemo(400, 'AGENDAMENTO_INVALIDO', 'Até 100 horários por vez.', {
      reason: 'LOTE_GRANDE',
    })
  }
  const agoraMs = agora().getTime()
  const ignorados: RespostaDoLote['ignorados'] = []
  const marcar: AgendamentoDaDemo[] = []
  for (const id of ids) {
    const a = AGENDAMENTOS.find((o) => o.id === id)
    if (
      !a ||
      a.inicio.slice(0, 10) !== corpo.data ||
      (corpo.profissionalId && a.profissionalId !== corpo.profissionalId)
    ) {
      ignorados.push({ agendamentoId: id, reason: 'FORA_DO_TURNO' })
    } else if (a.chegadaEm) {
      ignorados.push({ agendamentoId: id, reason: 'CHEGOU' })
    } else if (a.status !== 'AGENDADO' && a.status !== 'CONFIRMADO') {
      ignorados.push({ agendamentoId: id, reason: 'STATUS' })
    } else if (Date.parse(a.fim) > agoraMs) {
      ignorados.push({ agendamentoId: id, reason: 'NAO_ENCERROU' })
    } else {
      marcar.push(...doGrupo(a))
    }
  }
  if (!marcar.length) {
    return { marcados: [], ignorados, desfazerToken: null, desfazerAte: null }
  }
  const retratos = retratar(marcar)
  for (const a of marcar) {
    a.status = 'FALTA'
    a.faltaEm = agoraIso()
    tocar(a)
  }
  return { marcados: dtosDe(marcar), ignorados, ...guardarDesfazer(retratos) }
}

/* -------------------------------------------------------------------- as faltas antigas */

const CANAIS = [
  ['WHATSAPP', 50],
  ['TELEFONE', 38],
  ['PRESENCIAL', 6],
  ['APP', 6],
] as const

const MOTIVOS = [
  ['ESQUECEU', 34],
  ['IMPREVISTO', 24],
  ['PACIENTE_MELHOROU', 14],
  ['TRANSPORTE', 10],
  ['CUSTO', 6],
  ['EMERGENCIA', 5],
  ['INSATISFACAO', 3],
  ['OUTRO', 4],
] as const

/** Dia útil mais perto (para frente) em que a Dra. Marina atende. */
function diaUtil(data: string) {
  let dia = data
  while (diaDaSemana(dia) === 0 || diaDaSemana(dia) === 6) dia = somarDias(dia, 1)
  return dia
}

function criarFaltasAntigas() {
  const reincidentes: Array<[string, number[], string, string]> = [
    ['demo-pac-014', [118, 204, 296], 'demo-prof-rafael', '16:30'],
    ['demo-pac-026', [103, 171, 262], 'demo-prof-marina', '09:30'],
    ['demo-pac-021', [137, 229, 318], 'demo-prof-marina', '14:00'],
  ]
  for (const [pacienteId, dias, profissionalId, hora] of reincidentes) {
    dias.forEach((n, i) => {
      const data = diaUtil(somarDias(hoje(), -n))
      const inicio = instante(data, hora)
      criarAgendamento({
        pacienteId,
        profissionalId,
        tipoId: i === 1 ? 'demo-tipo-vacina' : 'demo-tipo-consulta',
        inicio,
        status: 'FALTA',
        faltaEm: somarMinutos(inicio, 30),
        origem: i === 0 ? 'APP' : 'TELEFONE',
        criadoPorId: i === 0 ? null : 'demo-usr-juliana',
        criadoEm: somarMinutos(inicio, -6 * 24 * 60),
        atualizadoEm: somarMinutos(inicio, 31),
      })
    })
  }
}

/**
 * A base sorteia falta em 6% dos horários passados, e quem volta muito à clínica ficaria com dez
 * faltas em três meses. Fica uma por paciente, até 24; as outras viram desmarcação.
 */
function aliviarFaltasDaBase() {
  const sorte = criarSorteio('agenda-faltas-base')
  const comFalta = new Set<string>()
  const faltas = sorte.embaralhar(
    AGENDAMENTOS.filter((a) => a.status === 'FALTA' && a.inicio.slice(0, 10) < hoje()),
  )

  for (const a of faltas) {
    if (!comFalta.has(a.pacienteId) && comFalta.size < 24) {
      comFalta.add(a.pacienteId)
      continue
    }
    a.status = 'CANCELADO'
    a.faltaEm = null
    a.canceladoEm = somarMinutos(a.inicio, -sorte.inteiro(3, 40) * 60)
    a.motivoCancelamento = sorte.pesado([
      ['RESPONSAVEL_DESMARCOU', 75],
      ['PACIENTE_INDISPONIVEL', 15],
      ['CLINICA_REMARCOU', 10],
    ] as const)
    a.canceladoPor = a.origem === 'APP' ? 'APP' : 'RECEPCAO'
  }
}

/** Os registros de contato das faltas que já estão na agenda. */
function registrarContatos() {
  const sorte = criarSorteio('agenda-faltas')
  const agoraMs = agora().getTime()
  const faltas = faltasPrincipais().sort((a, b) => a.inicio.localeCompare(b.inicio))

  for (const a of faltas) {
    const diasAtras = (agoraMs - Date.parse(a.inicio)) / (24 * 60 * 60_000)
    const faltaEm = a.faltaEm ?? somarMinutos(a.inicio, 30)
    const depois = (horas: number) => {
      const quando = somarMinutos(faltaEm, Math.round(horas * 60))
      return Date.parse(quando) < agoraMs ? quando : agoraIso()
    }
    if (diasAtras < 1) continue

    const destino = sorte.pesado(
      diasAtras < 8
        ? ([
            ['NADA', 35],
            ['TENTATIVA', 25],
            ['CONTATO', 40],
          ] as const)
        : ([
            ['NADA', 4],
            ['TENTATIVA', 8],
            ['CONTATO', 88],
          ] as const),
    )
    if (destino === 'NADA') continue

    const quem = sorte.escolher(QUEM_REGISTRA)
    if (destino === 'TENTATIVA' || sorte.chance(0.25)) {
      registrar(a.id, {
        motivo: null,
        canal: 'SEM_RESPOSTA',
        observacao: sorte.escolher([
          'Liguei duas vezes, caiu na caixa postal.',
          'Mensagem no WhatsApp sem resposta.',
          'Telefone fora de área.',
          null,
        ]),
        registradaEm: depois(sorte.inteiro(2, 6)),
        ...quem,
      })
    }
    if (destino === 'TENTATIVA') continue

    const canal = sorte.pesado(CANAIS)
    const motivo = sorte.pesado(MOTIVOS)
    const pelaClinica = canal === 'APP' ? null : sorte.escolher(QUEM_REGISTRA)
    registrar(a.id, {
      motivo,
      canal,
      observacao: canal === 'APP' ? null : sorte.escolher([...(OBSERVACOES[motivo] ?? []), null]),
      registradaEm: depois(sorte.inteiro(6, 30)),
      ...pelaClinica,
    })
  }
}

aliviarFaltasDaBase()
criarFaltasAntigas()
registrarContatos()

/* ------------------------------------------------------------------------- consultas */

/**
 * O contador `faltasSemJustificativa` (guia e3 3.9): faltas dos últimos 30 dias sem contato
 * registrado, de paciente ativo.
 */
export function faltasSemJustificativa() {
  const desde = somarDias(hoje(), -30)
  return faltasPrincipais().filter(
    (a) =>
      a.inicio.slice(0, 10) >= desde && semContato(a) && Boolean(paciente(a.pacienteId)?.ativo),
  ).length
}

export function faltasDoPaciente(pacienteId: string) {
  return faltasPrincipais()
    .filter((a) => a.pacienteId === pacienteId)
    .map((a) => ({ ...faltaDto(a), inicio: a.inicio }))
}
