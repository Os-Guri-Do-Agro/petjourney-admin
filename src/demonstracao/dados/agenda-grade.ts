/**
 * A grade da agenda na demonstração: a política, os bloqueios, o feriado, os avisos (conflitos) de
 * cada horário, o dia, a semana, as sugestões e as escritas com o "Desfazer". Lê e muda os
 * agendamentos de `base/agenda.ts`.
 *
 * Ao carregar, tira da base os agendamentos futuros que caem no feriado nacional que vem (a clínica
 * fecha), nas férias da Dra. Camila (a semana que vem) e na reunião de equipe das quintas: a base
 * gera a agenda sem saber deles, e um horário marcado por cima de um bloqueio pareceria erro.
 *
 * Os avisos seguem a tabela do guia (e3 2.3), sem `room-overlap`, `over-capacity` e
 * `type-room-mismatch`: a base põe a Dra. Camila e o Dr. Bruno no mesmo consultório e o dia sairia
 * cheio de avisos que a clínica de verdade não teria.
 */
import type { AvisoPedidoDto, CargaDoProfissionalDto } from '@/service/contrato/openapi'
import type {
  Bloqueio,
  OcorrenciaDeBloqueio,
  Politica,
} from '@/service/parceiro/agenda-config-service'
import type {
  AgendaDaSemana,
  AgendaDoDia,
  AgendaDoIntervalo,
  Agendamento,
  Agrupamento,
  Alternativa,
  CargaDoDia,
  ColunaDaAgenda,
  Conflito,
  HorarioSugerido,
  Movimento,
  Mutacao,
  NovoAgendamento,
  ProfissionalNaAgenda,
  ReservaNaAgenda,
  Simulacao,
} from '@/service/parceiro/agenda-service'

import {
  AGENDAMENTOS,
  agendamento,
  agendamentoDto,
  agendamentosDoDia,
  agendamentosEntre,
  criarAgendamento,
  type AgendamentoDaDemo,
} from '../base/agenda'
import { paciente } from '../base/cadastro'
import {
  ALMOCO,
  EXPEDIENTE_DA_CLINICA,
  EXPEDIENTE_DOS_PROFISSIONAIS,
  PROFISSIONAIS,
  SALA_PADRAO,
  SALAS,
  TIPOS,
  USUARIO_ID,
} from '../base/clinica'
import {
  agora,
  agoraIso,
  diaDaSemana,
  FUSO,
  hoje,
  horaDosMinutos,
  instante,
  isoDe,
  minutosDe,
  somarDias,
  somarMinutos,
} from '../relogio'

/* ------------------------------------------------------------------------------ o erro */

/** O erro que a rota devolve como a API (`codigo` e os extras no corpo). */
export class ErroDaDemo extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensagem: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(mensagem)
  }
}

/* --------------------------------------------------------------------------- a política */

export const POLITICA: Politica = {
  granularidadeMinutos: 15,
  cancelarAteHorasAntes: 12,
  reservaMinutos: 10,
  preConsultaAbreHorasAntes: 48,
  ofertaDeVagaMinutos: 60,
  confirmacaoAbreHorasAntes: 48,
  ofertaAutomaticaFila: true,
  personalizada: true,
  atualizadoEm: instante(somarDias(hoje(), -61), '18:20'),
  limites: {
    granularidadeMinutos: [5, 10, 15, 20, 30, 60],
    cancelarAteHorasAntes: { min: 0, max: 72 },
    reservaMinutos: { min: 2, max: 15 },
    preConsultaAbreHorasAntes: { min: 12, max: 168 },
    ofertaDeVagaMinutos: { min: 10, max: 240 },
    confirmacaoAbreHorasAntes: { min: 12, max: 168 },
  },
}

/* ---------------------------------------------------------------------------- o feriado */

function dois(n: number) {
  return String(n).padStart(2, '0')
}

/** O domingo de Páscoa (algoritmo de Meeus), para a Sexta-feira Santa. */
function pascoa(ano: number): string {
  const a = ano % 19
  const b = Math.floor(ano / 100)
  const c = ano % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return `${ano}-${dois(mes)}-${dois(dia)}`
}

const NACIONAIS: ReadonlyArray<readonly [string, string]> = [
  ['01-01', 'Confraternização Universal'],
  ['04-21', 'Tiradentes'],
  ['05-01', 'Dia do Trabalho'],
  ['09-07', 'Independência do Brasil'],
  ['10-12', 'Nossa Senhora Aparecida'],
  ['11-02', 'Finados'],
  ['11-15', 'Proclamação da República'],
  ['11-20', 'Dia da Consciência Negra'],
  ['12-25', 'Natal'],
]

function feriadoNacional(data: string): string | null {
  const fixo = NACIONAIS.find(([dia]) => dia === data.slice(5))
  if (fixo) return fixo[1]
  if (data === somarDias(pascoa(Number(data.slice(0, 4))), -2)) return 'Sexta-feira Santa'
  return null
}

/**
 * O feriado que fecha a clínica. Só os que ainda vêm: nos de antes a clínica abriu de plantão (a
 * base tem horários neles).
 */
export function feriadoDe(data: string): { nome: string } | null {
  if (data <= hoje()) return null
  const nome = feriadoNacional(data)
  return nome ? { nome } : null
}

/** O primeiro feriado que fecha a clínica nos próximos 60 dias (para o resumo). */
export function proximoFeriado(): { data: string; nome: string } | null {
  for (let d = 1; d <= 60; d++) {
    const data = somarDias(hoje(), d)
    const feriado = feriadoDe(data)
    if (feriado && diaDaSemana(data) !== 0) return { data, nome: feriado.nome }
  }
  return null
}

/* ---------------------------------------------------------------------------- bloqueios */

function proximo(semana: number, depoisDe = hoje()): string {
  for (let d = 1; d <= 7; d++) {
    const data = somarDias(depoisDe, d)
    if (diaDaSemana(data) === semana) return data
  }
  return somarDias(depoisDe, 7)
}

function regra(
  dados: Pick<Bloqueio, 'id' | 'inicio' | 'fim' | 'motivo' | 'criadoEm'> & Partial<Bloqueio>,
): Bloqueio {
  return {
    profissionalId: null,
    salaId: null,
    detalhe: null,
    recorrente: false,
    diasDaSemana: [],
    repeteAte: null,
    excecoes: [],
    criadoPorId: USUARIO_ID,
    atualizadoEm: dados.criadoEm,
    ...dados,
  }
}

const HOJE = hoje()
const SEGUNDA_QUE_VEM = proximo(1)
const QUINTA_QUE_VEM = proximo(4)

export const BLOQUEIOS: Bloqueio[] = [
  regra({
    id: 'demo-bloq-almoco',
    inicio: instante('2025-03-10', '12:00'),
    fim: instante('2025-03-10', '13:00'),
    motivo: 'ALMOCO',
    detalhe: 'Almoço da equipe',
    recorrente: true,
    diasDaSemana: [1, 2, 3, 4, 5],
    criadoEm: instante('2025-03-10', '09:30'),
  }),
  regra({
    id: 'demo-bloq-reuniao',
    inicio: instante(QUINTA_QUE_VEM, '08:00'),
    fim: instante(QUINTA_QUE_VEM, '09:00'),
    motivo: 'REUNIAO',
    detalhe: 'Reunião de equipe: discussão dos casos da semana',
    recorrente: true,
    diasDaSemana: [4],
    criadoEm: instante(somarDias(HOJE, -2), '17:40'),
  }),
  regra({
    id: 'demo-bloq-ferias-camila',
    profissionalId: 'demo-prof-camila',
    inicio: instante(SEGUNDA_QUE_VEM, '00:00'),
    fim: instante(somarDias(SEGUNDA_QUE_VEM, 6), '00:00'),
    motivo: 'FERIAS',
    detalhe: 'Férias',
    criadoEm: instante(somarDias(HOJE, -41), '10:15'),
  }),
]

if (diaDaSemana(HOJE) >= 1 && diaDaSemana(HOJE) <= 5) {
  BLOQUEIOS.push(
    regra({
      id: 'demo-bloq-laboratorio',
      profissionalId: 'demo-prof-marina',
      inicio: instante(HOJE, '15:00'),
      fim: instante(HOJE, '16:00'),
      motivo: 'REUNIAO',
      detalhe: 'Visita do laboratório de análises parceiro',
      criadoEm: instante(somarDias(HOJE, -6), '11:05'),
    }),
    regra({
      id: 'demo-bloq-autoclave',
      salaId: 'demo-sala-cir',
      inicio: instante(HOJE, '15:00'),
      fim: instante(HOJE, '17:00'),
      motivo: 'MANUTENCAO',
      detalhe: 'Revisão da autoclave',
      criadoEm: instante(somarDias(HOJE, -3), '16:30'),
    }),
  )
}

let sequenciaDoBloqueio = 0

export function novoIdDeBloqueio() {
  return `demo-bloq-novo-${++sequenciaDoBloqueio}`
}

function minutosEntre(inicio: string, fim: string) {
  return Math.round((Date.parse(fim) - Date.parse(inicio)) / 60_000)
}

function ocorrencia(b: Bloqueio, data: string, inicio: string, fim: string): OcorrenciaDeBloqueio {
  return {
    bloqueioId: b.id,
    data,
    inicio,
    fim,
    profissionalId: b.profissionalId,
    salaId: b.salaId,
    motivo: b.motivo,
    detalhe: b.detalhe,
    recorrente: b.recorrente,
  }
}

/** As ocorrências que tocam o período: a série, uma por dia; o bloqueio único, no dia do início. */
export function ocorrenciasEntre(de: string, ate: string): OcorrenciaDeBloqueio[] {
  const comeco = Date.parse(instante(de, '00:00'))
  const termino = Date.parse(instante(somarDias(ate, 1), '00:00'))
  const lista: OcorrenciaDeBloqueio[] = []

  for (const b of BLOQUEIOS) {
    if (!b.recorrente) {
      if (Date.parse(b.inicio) < termino && Date.parse(b.fim) > comeco) {
        lista.push(ocorrencia(b, b.inicio.slice(0, 10), b.inicio, b.fim))
      }
      continue
    }
    const hora = b.inicio.slice(11, 16)
    const duracao = minutosEntre(b.inicio, b.fim)
    const primeiro = b.inicio.slice(0, 10)
    for (let data = somarDias(de, -1); data <= ate; data = somarDias(data, 1)) {
      if (data < primeiro || (b.repeteAte && data > b.repeteAte)) continue
      if (!b.diasDaSemana.includes(diaDaSemana(data)) || b.excecoes.includes(data)) continue
      const inicio = instante(data, hora)
      const fim = somarMinutos(inicio, duracao)
      if (Date.parse(inicio) < termino && Date.parse(fim) > comeco) {
        lista.push(ocorrencia(b, data, inicio, fim))
      }
    }
  }

  return lista.sort((a, b) => a.inicio.localeCompare(b.inicio))
}

export function ocorrenciasDoDia(data: string) {
  return ocorrenciasEntre(data, data)
}

/* ------------------------------------------------------------- horários e sobreposição */

/** O que basta de um horário para saber os avisos dele. */
export type Horario = Pick<
  AgendamentoDaDemo,
  'pacienteId' | 'profissionalId' | 'inicio' | 'fim' | 'salaIds'
> & { id?: string; grupoId?: string | null }

export const RISCADOS: ReadonlyArray<AgendamentoDaDemo['status']> = ['CANCELADO', 'FALTA']

export function minutosEmComum(aInicio: string, aFim: string, bInicio: string, bFim: string) {
  const ms =
    Math.min(Date.parse(aFim), Date.parse(bFim)) -
    Math.max(Date.parse(aInicio), Date.parse(bInicio))
  return Math.max(0, Math.round(ms / 60_000))
}

function minutosDoIso(iso: string) {
  return Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16))
}

function horaDoIso(iso: string) {
  return iso.slice(11, 16)
}

function valeParaOHorario(o: OcorrenciaDeBloqueio, h: Horario) {
  if (!o.profissionalId && !o.salaId) return true
  if (o.profissionalId) return o.profissionalId === h.profissionalId
  return h.salaIds.includes(o.salaId ?? '')
}

/** A faixa do profissional no dia; `null` na folga, no domingo e no feriado. */
export function faixaDe(profissionalId: string, data: string) {
  const semana = diaDaSemana(data)
  if (feriadoDe(data) || !EXPEDIENTE_DA_CLINICA[semana]) return null
  return EXPEDIENTE_DOS_PROFISSIONAIS[profissionalId]?.[semana] ?? null
}

/** As salas de um tipo para um profissional, como a base escolhe. */
export function salasPara(tipoId: string, profissionalId: string): string[] {
  const kind = TIPOS.find((t) => t.id === tipoId)?.kind
  if (kind === 'VACINA' || kind === 'EXAME') return ['demo-sala-vac']
  if (kind === 'CIRURGIA') return ['demo-sala-cir']
  return [SALA_PADRAO[profissionalId] ?? 'demo-sala-c1']
}

/* -------------------------------------------------------- reservas e vagas liberadas */

let fonteDeReservas: () => ReservaNaAgenda[] = () => []

/** A fila diz quais horários estão segurados por oferta aberta (a reserva `FILA`). */
export function definirFonteDeReservas(fonte: () => ReservaNaAgenda[]) {
  fonteDeReservas = fonte
}

export function reservasEntre(de: string, ate: string): ReservaNaAgenda[] {
  return fonteDeReservas().filter(
    (r) => r.inicio.slice(0, 10) >= de && r.inicio.slice(0, 10) <= ate,
  )
}

/** Horários soltos por remarcação (o cancelamento a fila lê dos próprios agendamentos). */
export const LIBERADOS: Array<{
  profissionalId: string
  inicio: string
  fim: string
  agendamentoId: string
}> = []

/* ---------------------------------------------------------------------------- avisos */

/**
 * Os avisos de um horário, como a API calcula na leitura (guia e3 2.3): um por tipo, com
 * `quantidade` e até 5 ids; os outros parâmetros descrevem o primeiro.
 */
export function conflitosDoHorario(
  h: Horario,
  opcoes: { doDia?: readonly AgendamentoDaDemo[]; ignorar?: ReadonlySet<string> } = {},
): Conflito[] {
  const data = h.inicio.slice(0, 10)
  const semana = diaDaSemana(data)
  const conflitos: Conflito[] = []

  const feriado = feriadoDe(data)
  if (feriado) {
    conflitos.push({
      kind: 'holiday-closed',
      severity: 'blocking',
      params: { feriado: feriado.nome },
    })
  } else {
    const casa = EXPEDIENTE_DA_CLINICA[semana]
    const faixa = EXPEDIENTE_DOS_PROFISSIONAIS[h.profissionalId]?.[semana]
    const inicioMin = minutosDoIso(h.inicio)
    const fimMin = h.fim.slice(0, 10) === data ? minutosDoIso(h.fim) : 24 * 60
    if (!casa) {
      conflitos.push({ kind: 'outside-hours', severity: 'warning', params: { motivo: 'FECHADO' } })
    } else if (!faixa) {
      conflitos.push({ kind: 'outside-hours', severity: 'warning', params: { motivo: 'FOLGA' } })
    } else if (inicioMin < minutosDe(faixa.inicio) || fimMin > minutosDe(faixa.fim)) {
      conflitos.push({
        kind: 'outside-hours',
        severity: 'warning',
        params: { motivo: 'FORA_DO_EXPEDIENTE', abre: faixa.inicio, fecha: faixa.fim },
      })
    }
  }

  const doHorario = ocorrenciasDoDia(data)
    .filter((o) => valeParaOHorario(o, h))
    .map((o) => ({ o, minutos: minutosEmComum(h.inicio, h.fim, o.inicio, o.fim) }))
    .filter((item) => item.minutos > 0)

  const almoco = doHorario.find((item) => item.o.motivo === 'ALMOCO')
  if (almoco) {
    conflitos.push({
      kind: 'lunch-overlap',
      severity: 'info',
      params: { minutos: almoco.minutos, bloqueioId: almoco.o.bloqueioId },
    })
  }

  const invadidos = doHorario.filter((item) => item.o.motivo !== 'ALMOCO')
  const primeiroBloqueio = invadidos[0]
  if (primeiroBloqueio) {
    const ids = [...new Set(invadidos.map((item) => item.o.bloqueioId))]
    conflitos.push({
      kind: 'block-invasion',
      severity: 'warning',
      params: {
        quantidade: ids.length,
        bloqueioIds: ids.slice(0, 5),
        motivo: primeiroBloqueio.o.motivo,
        minutos: primeiroBloqueio.minutos,
      },
    })
  }

  const doDia = (opcoes.doDia ?? agendamentosDoDia(data)).filter(
    (o) =>
      !RISCADOS.includes(o.status) &&
      o.id !== h.id &&
      !(h.grupoId && o.grupoId === h.grupoId) &&
      !opcoes.ignorar?.has(o.id) &&
      minutosEmComum(h.inicio, h.fim, o.inicio, o.fim) > 0,
  )

  const doProfissional = doDia
    .filter((o) => o.profissionalId === h.profissionalId)
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
  const primeiroDoProfissional = doProfissional[0]
  if (primeiroDoProfissional) {
    conflitos.push({
      kind: 'professional-overlap',
      severity: 'warning',
      params: {
        quantidade: doProfissional.length,
        agendamentoIds: doProfissional.slice(0, 5).map((o) => o.id),
        paciente: paciente(primeiroDoProfissional.pacienteId)?.nome ?? '',
        hora: horaDoIso(primeiroDoProfissional.inicio),
        minutos: minutosEmComum(
          h.inicio,
          h.fim,
          primeiroDoProfissional.inicio,
          primeiroDoProfissional.fim,
        ),
      },
    })
  }

  const doPet = doDia
    .filter((o) => o.pacienteId === h.pacienteId)
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
  const primeiroDoPet = doPet[0]
  if (primeiroDoPet) {
    conflitos.push({
      kind: 'pet-double-book',
      severity: 'warning',
      params: {
        quantidade: doPet.length,
        agendamentoIds: doPet.slice(0, 5).map((o) => o.id),
        paciente: paciente(primeiroDoPet.pacienteId)?.nome ?? '',
        hora: horaDoIso(primeiroDoPet.inicio),
      },
    })
  }

  const reservas = fonteDeReservas()
    .filter(
      (r) =>
        r.profissionalId === h.profissionalId &&
        minutosEmComum(h.inicio, h.fim, r.inicio, r.fim) > 0,
    )
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
  const primeiraReserva = reservas[0]
  if (primeiraReserva) {
    conflitos.push({
      kind: 'pedido-pendente',
      severity: 'warning',
      params: {
        quantidade: reservas.length,
        reservaIds: reservas.slice(0, 5).map((r) => r.id),
        origem: primeiraReserva.donoTipo,
        expiraEm: primeiraReserva.expiraEm,
      },
    })
  }

  return conflitos
}

/** O agendamento como a agenda lê, com os avisos calculados agora. */
export function dtoDe(a: AgendamentoDaDemo, doDia?: readonly AgendamentoDaDemo[]): Agendamento {
  const dto = agendamentoDto(a)
  return {
    ...dto,
    salaIds: [...a.salaIds],
    conflitos: RISCADOS.includes(a.status) ? [] : conflitosDoHorario(a, { doDia }),
  }
}

/** Vários agendamentos, cada dia lido uma vez só. */
export function dtosDe(lista: readonly AgendamentoDaDemo[]): Agendamento[] {
  const dias = new Map<string, AgendamentoDaDemo[]>()
  return lista.map((a) => {
    const data = a.inicio.slice(0, 10)
    let doDia = dias.get(data)
    if (!doDia) {
      doDia = agendamentosDoDia(data)
      dias.set(data, doDia)
    }
    return dtoDe(a, doDia)
  })
}

/* ------------------------------------------------- tirar da base o que caiu em bloqueio */

function tirarDaBase() {
  const amanha = somarDias(hoje(), 1)
  for (let i = AGENDAMENTOS.length - 1; i >= 0; i--) {
    const a = AGENDAMENTOS[i]
    if (!a || a.inicio.slice(0, 10) < amanha) continue
    const data = a.inicio.slice(0, 10)
    const bloqueado = ocorrenciasDoDia(data).some(
      (o) =>
        o.motivo !== 'ALMOCO' &&
        valeParaOHorario(o, a) &&
        minutosEmComum(a.inicio, a.fim, o.inicio, o.fim) > 0,
    )
    if (feriadoDe(data) || bloqueado) AGENDAMENTOS.splice(i, 1)
  }
}

tirarDaBase()

/* ------------------------------------------------------------------------------ o dia */

function profissionaisNoDia(data: string): ProfissionalNaAgenda[] {
  return PROFISSIONAIS.filter((p) => p.ativo && p.atendeNaAgenda).map((p) => {
    const faixa = faixaDe(p.id, data)
    return {
      id: p.id,
      nome: p.nome,
      corIndice: p.corIndice,
      salaPadraoId: SALA_PADRAO[p.id] ?? null,
      ativo: p.ativo,
      trabalhaNoDia: Boolean(faixa),
      origemDoExpediente: 'PROFISSIONAL' as const,
      faixas: faixa ? [{ inicio: faixa.inicio, fim: faixa.fim }] : [],
    }
  })
}

export function diaDaAgenda(data: string, agrupar: Agrupamento): AgendaDoDia {
  const semana = diaDaSemana(data)
  const feriado = feriadoDe(data)
  const casa = EXPEDIENTE_DA_CLINICA[semana] ?? null
  const clinicaFechada = !casa || Boolean(feriado)
  const doDia = agendamentosDoDia(data)
  const profissionais = profissionaisNoDia(data)

  const colunas: ColunaDaAgenda[] =
    agrupar === 'SALA'
      ? [...SALAS]
          .filter((s) => s.ativa || doDia.some((a) => a.salaIds.includes(s.id)))
          .sort((a, b) => a.ordem - b.ordem)
          .map((s) => ({ tipo: 'SALA' as const, id: s.id, nome: s.nome }))
      : profissionais
          .filter((p) => p.trabalhaNoDia || doDia.some((a) => a.profissionalId === p.id))
          .map((p) => ({ tipo: 'PROFISSIONAL' as const, id: p.id, nome: p.nome }))

  return {
    data,
    fuso: FUSO,
    agrupar,
    clinicaFechada,
    feriado: feriado ? { nome: feriado.nome, fechado: true, abre: null, fecha: null } : null,
    expediente: casa && !clinicaFechada ? { inicio: casa.inicio, fim: casa.fim } : null,
    almoco: !clinicaFechada && semana >= 1 && semana <= 5 ? { ...ALMOCO } : null,
    colunas,
    profissionais,
    salas: SALAS.map((s) => ({ ...s })),
    agendamentos: doDia.map((a) => dtoDe(a, doDia)),
    bloqueios: ocorrenciasDoDia(data),
    reservas: reservasEntre(data, data),
  }
}

/* --------------------------------------------------------------------- semana e carga */

function capacidadeDe(profissionalId: string, data: string) {
  const faixa = faixaDe(profissionalId, data)
  if (!faixa) return { total: 0, manha: 0, tarde: 0 }
  const inicio = minutosDe(faixa.inicio)
  const fim = minutosDe(faixa.fim)
  const semana = diaDaSemana(data)
  const almocoInicio = minutosDe(ALMOCO.inicio)
  const tardeDesde = semana >= 1 && semana <= 5 ? minutosDe(ALMOCO.fim) : almocoInicio
  const manha = Math.max(0, Math.min(fim, almocoInicio) - inicio)
  const tarde = Math.max(0, fim - Math.max(inicio, tardeDesde))
  return { total: Math.min(480, manha + tarde), manha, tarde }
}

function razao(parte: number, todo: number) {
  return todo > 0 ? Math.round((parte / todo) * 100) / 100 : 0
}

function cargaDoDia(data: string, doDia: readonly AgendamentoDaDemo[]): CargaDoDia {
  const validos = doDia.filter(
    (a) => !RISCADOS.includes(a.status) && (!a.grupoId || a.grupoId === a.id),
  )
  const porProfissional: CargaDoProfissionalDto[] = PROFISSIONAIS.filter(
    (p) =>
      p.atendeNaAgenda &&
      (capacidadeDe(p.id, data).total > 0 || validos.some((a) => a.profissionalId === p.id)),
  ).map((p) => {
    const capacidade = capacidadeDe(p.id, data)
    const dele = validos.filter((a) => a.profissionalId === p.id)
    const manha = dele
      .filter((a) => minutosDoIso(a.inicio) < minutosDe(ALMOCO.inicio))
      .reduce((soma, a) => soma + a.duracaoMinutos, 0)
    const ocupado = dele.reduce((soma, a) => soma + a.duracaoMinutos, 0)
    return {
      profissionalId: p.id,
      agendados: dele.length,
      ocupadoMinutos: ocupado,
      capacidadeMinutos: capacidade.total,
      ocupacao: Math.min(2, razao(ocupado, capacidade.total)),
      ocupacaoManha: Math.min(2, razao(manha, capacidade.manha)),
      ocupacaoTarde: Math.min(2, razao(ocupado - manha, capacidade.tarde)),
    }
  })
  const capacidade = porProfissional.reduce((soma, p) => soma + p.capacidadeMinutos, 0)
  const ocupado = porProfissional.reduce((soma, p) => soma + p.ocupadoMinutos, 0)
  const feriado = feriadoDe(data)

  return {
    data,
    clinicaFechada: !EXPEDIENTE_DA_CLINICA[diaDaSemana(data)] || Boolean(feriado),
    feriado: feriado?.nome ?? null,
    agendados: validos.length,
    capacidadeMinutos: capacidade,
    ocupadoMinutos: ocupado,
    ocupacao: Math.min(2, razao(ocupado, capacidade)),
    faltas: doDia.filter((a) => a.status === 'FALTA').length,
    encaixes: validos.filter((a) => a.encaixe).length,
    porProfissional,
  }
}

export function segundaDe(data: string) {
  return somarDias(data, -((diaDaSemana(data) + 6) % 7))
}

export function semanaDaAgenda(data: string): AgendaDaSemana {
  const de = segundaDe(data)
  const dias: CargaDoDia[] = []
  const agendamentos: Agendamento[] = []
  for (let i = 0; i < 7; i++) {
    const dia = somarDias(de, i)
    const doDia = agendamentosDoDia(dia)
    dias.push(cargaDoDia(dia, doDia))
    agendamentos.push(...doDia.map((a) => dtoDe(a, doDia)))
  }
  return { fuso: FUSO, de, ate: somarDias(de, 6), dias, agendamentos }
}

const POR_PAGINA_DO_INTERVALO = 200

export function intervaloDaAgenda(
  de: string,
  ate: string,
  profissionalId: string | null,
  cursor: string | null,
): AgendaDoIntervalo {
  const lista = agendamentosEntre(de, ate).filter(
    (a) => !profissionalId || a.profissionalId === profissionalId,
  )
  const inicio = Number(cursor ?? 0) || 0
  const fim = inicio + POR_PAGINA_DO_INTERVALO
  return {
    fuso: FUSO,
    de,
    ate,
    agendamentos: dtosDe(lista.slice(inicio, fim)),
    proximoCursor: fim < lista.length ? String(fim) : null,
  }
}

/* ---------------------------------------------------------------------- horários livres */

export type BuscaDeHorario = {
  tipoId: string
  /** Padrão: a do tipo. O pedido de dois pets pede o tempo dos dois. */
  duracaoMinutos?: number
  profissionalIds?: readonly string[]
  pacienteId?: string
  aPartirDe: string
  ate?: string
  quantidade: number
  periodos?: readonly string[]
  umPorProfissionalPorDia?: boolean
  ignorar?: ReadonlySet<string>
  /** Um corte a mais (a janela de quem está na fila, por exemplo). */
  aceita?: (inicio: string, profissionalId: string) => boolean
}

export function nomeDoProfissional(id: string) {
  return PROFISSIONAIS.find((p) => p.id === id)?.nome ?? ''
}

/**
 * Horários sem aviso nenhum, do mais cedo ao mais tarde, na faixa de cada profissional e no passo
 * da política, até 35 dias à frente. Só a partir de meia hora depois de agora.
 */
export function horariosLivres(busca: BuscaDeHorario): HorarioSugerido[] {
  const tipo = TIPOS.find((t) => t.id === busca.tipoId)
  const duracao = busca.duracaoMinutos ?? tipo?.duracaoMinutos ?? 30
  const passo = POLITICA.granularidadeMinutos
  const desde = agora().getTime() + 30 * 60_000
  const profissionais = (
    busca.profissionalIds?.length
      ? PROFISSIONAIS.filter((p) => busca.profissionalIds?.includes(p.id))
      : PROFISSIONAIS
  ).filter((p) => p.ativo && p.atendeNaAgenda)
  const achados: HorarioSugerido[] = []

  for (let d = 0; d < 35 && achados.length < busca.quantidade; d++) {
    const data = somarDias(busca.aPartirDe, d)
    if (busca.ate && data > busca.ate) break
    const doDia = agendamentosDoDia(data)
    const doDiaInteiro: HorarioSugerido[] = []

    for (const p of profissionais) {
      const faixa = faixaDe(p.id, data)
      if (!faixa) continue
      for (let m = minutosDe(faixa.inicio); m + duracao <= minutosDe(faixa.fim); m += passo) {
        const inicio = instante(data, horaDosMinutos(m))
        if (Date.parse(inicio) < desde) continue
        const tarde = m >= minutosDe(ALMOCO.inicio)
        if (busca.periodos?.length && !busca.periodos.includes(tarde ? 'TARDE' : 'MANHA')) continue
        if (busca.aceita && !busca.aceita(inicio, p.id)) continue
        const fim = somarMinutos(inicio, duracao)
        const avisos = conflitosDoHorario(
          {
            pacienteId: busca.pacienteId ?? '',
            profissionalId: p.id,
            inicio,
            fim,
            salaIds: [],
          },
          { doDia, ignorar: busca.ignorar },
        )
        if (avisos.length) continue
        doDiaInteiro.push({ profissionalId: p.id, profissionalNome: p.nome, data, inicio, fim })
        if (busca.umPorProfissionalPorDia) break
      }
    }

    doDiaInteiro.sort((a, b) => a.inicio.localeCompare(b.inicio))
    achados.push(...doDiaInteiro.slice(0, busca.quantidade - achados.length))
  }

  return achados
}

/** O primeiro horário livre (ou `null`). */
export function primeiroLivre(busca: Omit<BuscaDeHorario, 'quantidade'>) {
  return horariosLivres({ ...busca, quantidade: 1 })[0] ?? null
}

/* ------------------------------------------------------------------------------ simular */

export function simular(novo: NovoAgendamento): Simulacao {
  const tipo = TIPOS.find((t) => t.id === novo.tipoId)
  const duracao = novo.duracaoMinutos ?? tipo?.duracaoMinutos ?? 30
  const fim = somarMinutos(novo.inicio, duracao)
  const salaIds = novo.salaIds ?? salasPara(novo.tipoId, novo.profissionalId)
  const horario: Horario = {
    pacienteId: novo.pacienteId,
    profissionalId: novo.profissionalId,
    inicio: novo.inicio,
    fim,
    salaIds,
  }
  const conflitos = conflitosDoHorario(horario)
  const pernas = [
    { tipoId: novo.tipoId, salaIds, conflitos },
    ...(novo.pernasLigadas ?? []).map((perna) => ({
      tipoId: perna.tipoId ?? novo.tipoId,
      salaIds: perna.salaIds,
      conflitos: conflitos.filter((c) => c.kind !== 'professional-overlap'),
    })),
  ]
  const bloqueante =
    conflitos.some((c) => c.severity === 'blocking') &&
    !novo.confirmarConflitos?.includes('holiday-closed')

  const pedemAtencao = conflitos.some((c) => c.severity !== 'info')
  return { pernas, bloqueante, alternativas: pedemAtencao ? alternativasDe(horario, duracao) : [] }
}

/** As 5 melhores do mesmo dia com o mesmo profissional: menos avisos, mais perto do pedido. */
function alternativasDe(h: Horario, duracao: number): Alternativa[] {
  const data = h.inicio.slice(0, 10)
  const faixa = faixaDe(h.profissionalId, data)
  if (!faixa) return []
  const doDia = agendamentosDoDia(data)
  const pedido = Date.parse(h.inicio)
  const desde = agora().getTime()
  const opcoes: Array<Alternativa & { peso: number }> = []

  for (
    let m = minutosDe(faixa.inicio);
    m + duracao <= minutosDe(faixa.fim);
    m += POLITICA.granularidadeMinutos
  ) {
    const inicio = instante(data, horaDosMinutos(m))
    if (inicio === h.inicio || Date.parse(inicio) < desde) continue
    const fim = somarMinutos(inicio, duracao)
    const conflitos = conflitosDoHorario({ ...h, inicio, fim }, { doDia })
    const peso = conflitos.filter((c) => c.severity !== 'info').length
    const distanciaMinutos = Math.abs(Math.round((Date.parse(inicio) - pedido) / 60_000))
    opcoes.push({
      profissionalId: h.profissionalId,
      inicio,
      fim,
      conflitos,
      distanciaMinutos,
      peso,
    })
  }

  return opcoes
    .sort((a, b) => a.peso - b.peso || a.distanciaMinutos - b.distanciaMinutos)
    .slice(0, 5)
    .map(({ peso: _peso, ...alternativa }) => alternativa)
}

/* -------------------------------------------------------------------------- o desfazer */

type Retrato = { registro: AgendamentoDaDemo; antes: AgendamentoDaDemo }

type Guardado = {
  ate: number
  retratos: Retrato[]
  versoes: Map<string, number>
  criados: string[]
  aoDesfazer?: () => void
}

const DESFAZERES = new Map<string, Guardado>()
const JANELA_DO_DESFAZER_MS = 15_000
let sequenciaDoToken = 0

/** Uma cópia de cada registro, antes de mexer. */
export function retratar(lista: readonly AgendamentoDaDemo[]): Retrato[] {
  return lista.map((registro) => ({
    registro,
    antes: { ...registro, salaIds: [...registro.salaIds] },
  }))
}

/**
 * Guarda o que desfazer (depois de mexer): volta os retratos, apaga os criados e roda o resto. Se
 * algum deles mudou depois (outra versão), o desfazer vence.
 */
export function guardarDesfazer(
  retratos: Retrato[],
  criados: readonly AgendamentoDaDemo[] = [],
  aoDesfazer?: () => void,
) {
  const token = `demo-desfazer-${++sequenciaDoToken}`
  const ate = Date.now() + JANELA_DO_DESFAZER_MS
  const versoes = new Map<string, number>(
    [...retratos.map((r) => r.registro), ...criados].map((a) => [a.id, a.versao]),
  )
  DESFAZERES.set(token, { ate, retratos, versoes, criados: criados.map((a) => a.id), aoDesfazer })
  return { desfazerToken: token, desfazerAte: isoDe(new Date(ate)) }
}

export function desfazer(token: string): Mutacao {
  const guardado = DESFAZERES.get(token)
  DESFAZERES.delete(token)
  const mudou =
    !guardado ||
    Date.now() > guardado.ate ||
    [...guardado.versoes].some(([id, versao]) => agendamento(id)?.versao !== versao)
  if (!guardado || mudou) {
    throw new ErroDaDemo(409, 'DESFAZER_EXPIRADO', 'Não dá mais para desfazer.')
  }

  for (const { registro, antes } of guardado.retratos) {
    Object.assign(registro, antes, { versao: registro.versao + 1, atualizadoEm: agoraIso() })
  }
  const removidos: string[] = []
  for (const id of guardado.criados) {
    const i = AGENDAMENTOS.findIndex((a) => a.id === id)
    if (i >= 0) {
      AGENDAMENTOS.splice(i, 1)
      removidos.push(id)
    }
  }
  guardado.aoDesfazer?.()

  const voltaram = guardado.retratos.map((r) => r.registro).filter((r) => !removidos.includes(r.id))
  return {
    id: voltaram[0]?.id ?? removidos[0] ?? '',
    agendamentos: dtosDe(voltaram),
    desfazerToken: null,
    desfazerAte: null,
    removidos,
  }
}

/* ------------------------------------------------------------------------- as escritas */

export function tocar(a: AgendamentoDaDemo) {
  a.versao += 1
  a.atualizadoEm = agoraIso()
}

export function doGrupo(a: AgendamentoDaDemo) {
  return a.grupoId ? AGENDAMENTOS.filter((o) => o.grupoId === a.grupoId) : [a]
}

export function exigirAgendamento(id: string) {
  const a = agendamento(id)
  if (!a) throw new ErroDaDemo(403, 'SEM_ACESSO', 'Agendamento não encontrado ou sem acesso.')
  return a
}

export function statusInvalido(a: AgendamentoDaDemo, acao: string): never {
  throw new ErroDaDemo(
    409,
    'AGENDAMENTO_STATUS_INVALIDO',
    'Esta ação não cabe na situação do agendamento.',
    { status: a.status, acao },
  )
}

export function exigirPacienteAtivo(pacienteId: string) {
  const p = paciente(pacienteId)
  if (!p) throw new ErroDaDemo(403, 'SEM_ACESSO', 'Paciente não encontrado ou sem acesso.')
  if (!p.ativo) {
    throw new ErroDaDemo(409, 'PACIENTE_INATIVO', `${p.nome} está com o cadastro inativo.`, {
      obito: p.inativoMotivo === 'OBITO',
    })
  }
  return p
}

let sequenciaDoAviso = 0

/** O aviso pedido ao responsável (E3-06): sai depois da janela do desfazer. */
export function avisoAoResponsavel(
  tipo: AvisoPedidoDto['tipo'],
  pacienteId: string,
): AvisoPedidoDto {
  return {
    id: `demo-aviso-agenda-${++sequenciaDoAviso}`,
    tipo,
    situacao: 'PENDENTE',
    liberarEm: somarMinutos(agoraIso(), 2),
    semCanalNoApp: !paciente(pacienteId)?.noApp,
  }
}

export function mutacaoDe(
  alvo: AgendamentoDaDemo,
  tocados: readonly AgendamentoDaDemo[],
  desfazer: { desfazerToken: string | null; desfazerAte: string | null } | null,
  aviso?: AvisoPedidoDto | null,
): Mutacao {
  return {
    id: alvo.id,
    agendamentos: dtosDe(tocados),
    desfazerToken: desfazer?.desfazerToken ?? null,
    desfazerAte: desfazer?.desfazerAte ?? null,
    removidos: [],
    ...(aviso !== undefined ? { aviso } : {}),
  }
}

function barrarFeriado(conflitos: Conflito[], confirmados: readonly string[] | undefined) {
  const fechados = conflitos.filter((c) => c.severity === 'blocking')
  if (fechados.length && !confirmados?.includes('holiday-closed')) {
    throw new ErroDaDemo(409, 'CONFLITO_BLOQUEANTE', 'A clínica está fechada neste dia.', {
      conflitos: fechados,
    })
  }
}

/**
 * Cria o agendamento (e as pernas ligadas), como o `POST .../agendamentos`. `extra` vale por cima
 * (a origem `FILA` ou `APP`, a confirmação, o pedido de onde veio).
 */
export function criarNaAgenda(
  novo: NovoAgendamento,
  extra: Partial<AgendamentoDaDemo> = {},
): { principal: AgendamentoDaDemo; todos: AgendamentoDaDemo[] } {
  exigirPacienteAtivo(novo.pacienteId)
  const tipo = TIPOS.find((t) => t.id === novo.tipoId)
  if (!tipo) throw new ErroDaDemo(403, 'SEM_ACESSO', 'Tipo de atendimento não encontrado.')
  if (!tipo.ativo) throw new ErroDaDemo(409, 'TIPO_INATIVO', `${tipo.nome} está desativado.`)
  const quem = PROFISSIONAIS.find((p) => p.id === novo.profissionalId)
  if (!quem?.ativo || !quem.atendeNaAgenda) {
    throw new ErroDaDemo(409, 'PROFISSIONAL_INDISPONIVEL', 'O profissional não atende na agenda.', {
      reason: quem ? 'FORA_DA_AGENDA' : 'INATIVO',
    })
  }

  const duracao = novo.duracaoMinutos ?? tipo.duracaoMinutos
  const salaIds = novo.salaIds ?? salasPara(novo.tipoId, novo.profissionalId)
  const fim = somarMinutos(novo.inicio, duracao)
  barrarFeriado(conflitosDoHorario({ ...novo, fim, salaIds }), novo.confirmarConflitos)

  const origem = novo.origem ?? 'RECEPCAO'
  const agoraMesmo = agoraIso()
  const comum = {
    pacienteId: novo.pacienteId,
    profissionalId: novo.profissionalId,
    inicio: novo.inicio,
    duracaoMinutos: duracao,
    origem,
    encaixe: novo.encaixe ?? origem === 'ENCAIXE',
    criadoPorId: USUARIO_ID,
    criadoEm: agoraMesmo,
    atualizadoEm: agoraMesmo,
  }
  const principal = criarAgendamento({
    ...comum,
    tipoId: novo.tipoId,
    salaIds,
    observacao: novo.observacao ?? null,
    ...extra,
  })
  const pernas = (novo.pernasLigadas ?? []).map((perna) =>
    criarAgendamento({
      ...comum,
      tipoId: perna.tipoId ?? novo.tipoId,
      salaIds: perna.salaIds,
      observacao: perna.observacao ?? null,
      grupoId: principal.id,
      ...extra,
    }),
  )
  if (pernas.length) principal.grupoId = principal.id
  return { principal, todos: [principal, ...pernas] }
}

/** Arrasta o agendamento (o grupo anda junto pelo mesmo deslocamento). */
export function moverNaAgenda(a: AgendamentoDaDemo, movimento: Movimento) {
  if (!['AGENDADO', 'CONFIRMADO', 'AGUARDANDO'].includes(a.status)) statusInvalido(a, 'mover')
  exigirPacienteAtivo(a.pacienteId)
  const destino = movimento.destino
  const profissionalId = destino?.profissionalId ?? a.profissionalId
  const deslocamento = Date.parse(movimento.inicio) - Date.parse(a.inicio)
  barrarFeriado(
    conflitosDoHorario({
      ...a,
      profissionalId,
      inicio: movimento.inicio,
      fim: isoDe(new Date(Date.parse(a.fim) + deslocamento)),
    }),
    movimento.confirmarConflitos,
  )

  const grupo = doGrupo(a)
  const retratos = retratar(grupo)
  if (Date.parse(a.inicio) > agora().getTime() && deslocamento !== 0) {
    LIBERADOS.push({
      profissionalId: a.profissionalId,
      inicio: a.inicio,
      fim: a.fim,
      agendamentoId: a.id,
    })
  }
  for (const g of grupo) {
    g.inicio = isoDe(new Date(Date.parse(g.inicio) + deslocamento))
    g.fim = isoDe(new Date(Date.parse(g.fim) + deslocamento))
    g.profissionalId = profissionalId
    tocar(g)
  }
  if (destino?.salaIds) a.salaIds = [...destino.salaIds]
  if (destino?.trocarSala) {
    const troca = destino.trocarSala
    a.salaIds = a.salaIds.map((s) => (s === troca.de ? troca.para : s))
  }
  AGENDAMENTOS.sort((x, y) => x.inicio.localeCompare(y.inicio))
  return { grupo, retratos }
}
