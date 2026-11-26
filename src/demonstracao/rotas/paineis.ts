/**
 * As rotas que cruzam todas as áreas: os contadores do menu e do Início (`/pendencias`, E1-06), o
 * Hoje da Clínica (`meu-dia`), as Atividades e o Resumo (E3-08, guia e3 seção 8).
 *
 * O que é da agenda sai da base; o que é de outra área (rascunhos, internados, vacinas, pedidos...)
 * vem das funções que cada área exporta, reunidas em `fontes`. Assim o número do selo, o do Início
 * e o da tela do assunto são o mesmo.
 */
import type { Pendencia } from '@/service/parceiro/pendencias-service'
import type {
  AtividadesDaClinica,
  BlocoDoPainel,
  ItemDoPainel,
  MeuDiaDaClinica,
  ResumoDaClinica,
} from '@/service/parceiro/painel-service'

import { criarSorteio } from '../aleatorio'
import { agendamentosEntre, agendamentosDoDia, type AgendamentoDaDemo } from '../base/agenda'
import { paciente } from '../base/cadastro'
import {
  ALMOCO,
  EXPEDIENTE_DOS_PROFISSIONAIS,
  PROFISSIONAIS,
  profissional,
  tipo,
} from '../base/clinica'
import {
  agora,
  agoraIso,
  diaDaSemana,
  diasEntre,
  FUSO,
  hoje,
  minutosAte,
  minutosDe,
  somarDias,
} from '../relogio'
import { erro, ok, rota } from '../roteador'
import { internacoesDoPaciente } from '../dados/internacao'
import { registrarFonteDaLinhaDoTempo } from '../dados/prontuario'
import { aplicacoesDoPaciente } from '../dados/vacinas'
import { fontes } from './fontes'

/* ---------------------------------------------------------------------------------- blocos */

function bloco(itens: ItemDoPainel[], total = itens.length, teto = 500): BlocoDoPainel {
  return { total, itens: itens.slice(0, teto), truncado: total > teto, falhou: false }
}

function nomeDoPaciente(id: string) {
  return paciente(id)?.nome ?? ''
}

function nomeDoProfissional(id: string) {
  return profissional(id)?.nome ?? ''
}

function itemDoAgendamento(a: AgendamentoDaDemo): ItemDoPainel {
  const item: ItemDoPainel = {
    id: a.id,
    pacienteId: a.pacienteId,
    pacienteNome: nomeDoPaciente(a.pacienteId),
    profissionalId: a.profissionalId,
    tipoId: a.tipoId,
    quando: a.inicio,
    fim: a.fim,
    status: a.status,
    encaixe: a.encaixe,
  }
  if (a.atendimentoId) {
    ;(item as Record<string, unknown>).atendimentoId = a.atendimentoId
  }
  return item
}

/* ---------------------------------------------------------------------------------- meu dia */

function meuDia(query: URLSearchParams): MeuDiaDaClinica {
  const escopoPedido = query.get('escopo')
  const profissionalPedido = query.get('profissionalId')
  /* Quem entra é a Marina, que tem ficha: sem filtro, o dia dela. */
  const profissionalId =
    profissionalPedido ?? (escopoPedido === 'CLINICA' ? null : 'demo-prof-marina')
  const escopo = profissionalId ? 'PROFISSIONAL' : 'CLINICA'
  const doEscopo = (a: { profissionalId?: string | null }) =>
    !profissionalId || a.profissionalId === profissionalId

  const doDia = agendamentosDoDia(hoje()).filter((a) => a.status !== 'CANCELADO' && doEscopo(a))
  const espera = doDia
    .filter((a) => a.status === 'AGUARDANDO')
    .sort((x, y) => (x.chegadaEm ?? '').localeCompare(y.chegadaEm ?? ''))
    .map<ItemDoPainel>((a) => ({
      id: a.id,
      pacienteId: a.pacienteId,
      pacienteNome: nomeDoPaciente(a.pacienteId),
      profissionalId: a.profissionalId,
      quando: a.chegadaEm ?? a.inicio,
      esperaMinutos: Math.max(0, -minutosAte(a.chegadaEm ?? a.inicio)),
    }))

  const retornos = fontes.retornosPendentes().filter(doEscopo)
  const preConsultas = fontes.preConsultasNovas().filter(doEscopo)
  const rascunhos = fontes.rascunhos().filter(doEscopo)
  const internados = fontes.internados()

  return {
    data: hoje(),
    fuso: FUSO,
    escopo,
    profissionalId,
    profissionalNome: profissionalId ? nomeDoProfissional(profissionalId) : null,
    blocos: {
      atendimentos: bloco(doDia.map(itemDoAgendamento)),
      salaDeEspera: bloco(espera),
      faltasSemJustificativa: {
        total: fontes.faltasSemJustificativa().length,
        itens: [],
        truncado: false,
        falhou: false,
      },
      retornosPendentes: bloco(retornos),
      preConsultasNovas: bloco(preConsultas),
      rascunhos: bloco(rascunhos),
      internados: bloco(internados),
    },
    blocosIndisponiveis: [],
    geradoEm: agoraIso(),
  }
}

/* ------------------------------------------------------------------------------ atividades */

function atividades(): AtividadesDaClinica {
  const pilha = (itens: ItemDoPainel[]) => bloco(itens, itens.length, 20)
  const rascunhos = fontes.rascunhos()

  return {
    data: hoje(),
    fuso: FUSO,
    pilhas: {
      faltasSemJustificativa: pilha(fontes.faltasSemJustificativa()),
      retornosVencidos: pilha(fontes.retornosPendentes().filter((r) => (r.diasDeAtraso ?? 0) > 0)),
      pedidosAtrasados: pilha(fontes.pedidosAtrasados()),
      vacinasAtrasadas: pilha(fontes.vacinasAtrasadas()),
      rascunhosSemFecho: pilha(rascunhos.filter((r) => !r.nuncaAberto)),
      iniciadosNuncaAbertos: pilha(rascunhos.filter((r) => r.nuncaAberto)),
      resumosNaoPublicados: pilha(fontes.resumosNaoPublicados()),
    },
    pilhasIndisponiveis: [],
    geradoEm: agoraIso(),
  }
}

/* ---------------------------------------------------------------------------------- resumo */

const PERIODOS = ['HOJE', 'SEMANA', 'SEMANA_PASSADA', 'TRINTA_DIAS'] as const

function intervaloDo(query: URLSearchParams): { inicio: string; fim: string } | string {
  const periodo = query.get('periodo')
  const de = query.get('de')
  const ate = query.get('ate')
  const dia = hoje()

  if (periodo && (de || ate)) return 'PERIODO_E_DATAS'
  if (de || ate) {
    if (!de || !ate) return 'DATA_FALTANDO'
    if (de > ate) return 'DATA_INVERTIDA'
    if (diasEntre(de, ate) + 1 > 90) return 'MUITOS_DIAS'
    return { inicio: de, fim: ate }
  }
  if (periodo && !PERIODOS.includes(periodo as (typeof PERIODOS)[number])) {
    return 'PERIODO_DESCONHECIDO'
  }
  const segunda = somarDias(dia, -((diaDaSemana(dia) + 6) % 7))
  switch (periodo) {
    case 'SEMANA':
      return { inicio: segunda, fim: somarDias(segunda, 6) }
    case 'SEMANA_PASSADA':
      return { inicio: somarDias(segunda, -7), fim: somarDias(segunda, -1) }
    case 'TRINTA_DIAS':
      return { inicio: somarDias(dia, -29), fim: dia }
    default:
      return { inicio: dia, fim: dia }
  }
}

/** Minutos de expediente de um profissional num dia, sem o almoço. */
function capacidade(profissionalId: string, data: string) {
  const faixa = EXPEDIENTE_DOS_PROFISSIONAIS[profissionalId]?.[diaDaSemana(data)]
  if (!faixa) return 0
  const inicio = minutosDe(faixa.inicio)
  const fim = minutosDe(faixa.fim)
  const almoco = Math.max(
    0,
    Math.min(fim, minutosDe(ALMOCO.fim)) - Math.max(inicio, minutosDe(ALMOCO.inicio)),
  )
  return fim - inicio - almoco
}

type Desfecho = 'finalizados' | 'previstos' | 'semDesfecho' | 'faltas' | 'cancelados'

function desfechoDe(a: AgendamentoDaDemo): Desfecho {
  if (a.status === 'FINALIZADO') return 'finalizados'
  if (a.status === 'FALTA') return 'faltas'
  if (a.status === 'CANCELADO') return 'cancelados'
  const dia = a.inicio.slice(0, 10)
  if (dia < hoje()) return 'semDesfecho'
  if (
    (a.status === 'AGENDADO' || a.status === 'CONFIRMADO') &&
    Date.parse(a.fim) < agora().getTime() - 60 * 60_000
  ) {
    return 'semDesfecho'
  }
  return 'previstos'
}

const DIAGNOSTICOS = [
  ['CID-VET-K29', 'Gastroenterite aguda', 9],
  ['CID-VET-L30', 'Dermatite alérgica', 8],
  ['CID-VET-H60', 'Otite externa', 7],
  ['CID-VET-K05', 'Doença periodontal', 5],
  ['CID-VET-N18', 'Doença renal crônica', 3],
  ['CID-VET-E66', 'Obesidade', 3],
  ['CID-VET-M17', 'Osteoartrite', 2],
  ['CID-VET-N39', 'Infecção do trato urinário', 2],
] as const

function fatias(contagem: Map<string, { rotulo: string; valor: number }>) {
  const total = [...contagem.values()].reduce((s, f) => s + f.valor, 0) || 1
  return [...contagem.entries()]
    .map(([id, f]) => ({ id, rotulo: f.rotulo, valor: f.valor, parte: f.valor / total }))
    .sort((a, b) => b.valor - a.valor)
}

function resumo(query: URLSearchParams) {
  const intervalo = intervaloDo(query)
  if (typeof intervalo === 'string') {
    return erro(400, 'RESUMO_PERIODO_INVALIDO', 'Período inválido para o resumo.', {
      motivo: intervalo,
      maxDias: 90,
    })
  }

  const profissionalId = query.get('profissionalId')
  const tipoId = query.get('tipoId')
  const lista = agendamentosEntre(intervalo.inicio, intervalo.fim).filter(
    (a) =>
      (!profissionalId || a.profissionalId === profissionalId) && (!tipoId || a.tipoId === tipoId),
  )
  const dias = diasEntre(intervalo.inicio, intervalo.fim) + 1
  const naAgenda = PROFISSIONAIS.filter((p) => p.atendeNaAgenda)
  const profissionais = profissionalId ? naAgenda.filter((p) => p.id === profissionalId) : naAgenda

  const indicadores = {
    finalizados: 0,
    previstos: 0,
    semDesfecho: 0,
    faltas: 0,
    cancelados: 0,
    total: lista.length,
    encaixes: 0,
    comparecimento: null as number | null,
    ocupacaoMedia: null as number | null,
    horasAgendadas: 0,
    novosPacientes: 0,
  }
  const porDia = new Map<string, ResumoDaClinica['porDia'][number]>()
  const porTipo = new Map<string, { rotulo: string; valor: number }>()
  const porOrigem = new Map<string, { rotulo: string; valor: number }>()
  const porHora = new Map<string, number>()
  const porProfissional = new Map<
    string,
    {
      valor: number
      finalizados: number
      faltas: number
      minutos: number
      ocupados: number
      capacidade: number
    }
  >()

  for (let d = 0; d < dias; d++) {
    const data = somarDias(intervalo.inicio, d)
    const cap = profissionais.reduce((s, p) => s + capacidade(p.id, data), 0)
    porDia.set(data, {
      data,
      finalizados: 0,
      previstos: 0,
      semDesfecho: 0,
      faltas: 0,
      cancelados: 0,
      ocupacao: null,
      fechado: cap === 0,
    })
  }

  const ocupadoNoDia = new Map<string, number>()
  /* Paciente novo: cadastrado no período e com um atendimento não cancelado nele. */
  const novos = new Set<string>()
  for (const a of lista) {
    const desfecho = desfechoDe(a)
    const data = a.inicio.slice(0, 10)
    indicadores[desfecho] += 1
    const ponto = porDia.get(data)
    if (ponto) ponto[desfecho] += 1
    if (a.encaixe) indicadores.encaixes += 1
    if (desfecho === 'finalizados') indicadores.horasAgendadas += a.duracaoMinutos / 60
    if (desfecho !== 'cancelados') {
      const t = tipo(a.tipoId)
      const fatiaTipo = porTipo.get(a.tipoId) ?? { rotulo: t?.nome ?? '', valor: 0 }
      fatiaTipo.valor += 1
      porTipo.set(a.tipoId, fatiaTipo)
      const fatiaOrigem = porOrigem.get(a.origem) ?? { rotulo: a.origem, valor: 0 }
      fatiaOrigem.valor += 1
      porOrigem.set(a.origem, fatiaOrigem)
      const hora = Number(a.inicio.slice(11, 13))
      const chave = `${diaDaSemana(data)}-${hora}`
      porHora.set(chave, (porHora.get(chave) ?? 0) + 1)
      ocupadoNoDia.set(data, (ocupadoNoDia.get(data) ?? 0) + a.duracaoMinutos)
      const cadastro = paciente(a.pacienteId)?.criadoEm.slice(0, 10) ?? ''
      if (cadastro >= intervalo.inicio && cadastro <= intervalo.fim) novos.add(a.pacienteId)
    }
    const linha = porProfissional.get(a.profissionalId) ?? {
      valor: 0,
      finalizados: 0,
      faltas: 0,
      minutos: 0,
      ocupados: 0,
      capacidade: 0,
    }
    if (desfecho !== 'cancelados') {
      linha.valor += 1
      linha.ocupados += a.duracaoMinutos
    }
    if (desfecho === 'finalizados') {
      linha.finalizados += 1
      linha.minutos += a.duracaoMinutos
    }
    if (desfecho === 'faltas') linha.faltas += 1
    porProfissional.set(a.profissionalId, linha)
  }

  let somaOcupacao = 0
  let diasComCapacidade = 0
  for (const ponto of porDia.values()) {
    const cap = profissionais.reduce((s, p) => s + capacidade(p.id, ponto.data), 0)
    if (!cap) continue
    ponto.ocupacao = (ocupadoNoDia.get(ponto.data) ?? 0) / cap
    somaOcupacao += ponto.ocupacao
    diasComCapacidade += 1
  }
  indicadores.novosPacientes = novos.size
  indicadores.ocupacaoMedia = diasComCapacidade ? somaOcupacao / diasComCapacidade : null
  const base = indicadores.finalizados + indicadores.faltas
  indicadores.comparecimento = base ? indicadores.finalizados / base : null
  indicadores.horasAgendadas = Math.round(indicadores.horasAgendadas * 10) / 10

  const totalSemCancelados = lista.filter((a) => a.status !== 'CANCELADO').length || 1
  const linhasDeProfissional = profissionais.map((p) => {
    const linha = porProfissional.get(p.id) ?? {
      valor: 0,
      finalizados: 0,
      faltas: 0,
      minutos: 0,
      ocupados: 0,
      capacidade: 0,
    }
    let cap = 0
    for (let d = 0; d < dias; d++) cap += capacidade(p.id, somarDias(intervalo.inicio, d))
    const baseP = linha.finalizados + linha.faltas
    return {
      id: p.id,
      rotulo: p.nome,
      valor: linha.valor,
      parte: linha.valor / totalSemCancelados,
      finalizados: linha.finalizados,
      faltas: linha.faltas,
      comparecimento: baseP ? linha.finalizados / baseP : null,
      horasAgendadas: Math.round((linha.minutos / 60) * 10) / 10,
      ocupacao: cap ? linha.ocupados / cap : null,
    }
  })

  /* Os diagnósticos dos finalizados, pelo código do catálogo (a mesma sorte para o mesmo atendimento). */
  const diagnosticos = new Map<string, { rotulo: string; valor: number }>()
  let semDiagnostico = 0
  for (const a of lista) {
    if (a.status !== 'FINALIZADO') continue
    const t = tipo(a.tipoId)
    if (t?.kind === 'VACINA' || t?.kind === 'EXAME') {
      semDiagnostico += 1
      continue
    }
    const sorte = criarSorteio(a.id)
    const [id, rotulo] = sorte.pesado(
      DIAGNOSTICOS.map((d) => [[d[0], d[1]] as const, d[2]] as const),
    )
    const fatia = diagnosticos.get(id) ?? { rotulo, valor: 0 }
    fatia.valor += 1
    diagnosticos.set(id, fatia)
  }

  const resposta: ResumoDaClinica = {
    intervalo: { inicio: intervalo.inicio, fim: intervalo.fim, dias },
    indicadores,
    porDia: [...porDia.values()],
    porTipo: fatias(porTipo),
    porProfissional: linhasDeProfissional,
    porProfissionalCompleto: true,
    porOrigem: fatias(porOrigem),
    porHora: [...porHora.entries()].map(([chave, valor]) => {
      const [diaSemana = 0, hora = 0] = chave.split('-').map(Number)
      return { diaSemana, hora, valor }
    }),
    picoDaHora: Math.max(0, ...porHora.values()),
    diagnosticos: { itens: fatias(diagnosticos).slice(0, 6), semDiagnostico, avulsos: 0 },
    geradoEm: agoraIso(),
    emCache: false,
    fuso: FUSO,
  }
  return ok(resposta)
}

/* ------------------------------------------------------------------------------ pendências */

function pendencias(query: URLSearchParams): Pendencia[] {
  /* Os da agenda vêm prontos da área: pedidos, fila, faltas sem contato, retornos, confirmação. */
  const daAgenda: Pendencia[] = fontes
    .contadoresDaAgenda()
    .map((c) => ({ ...c, modulo: 'CLINICA' as const }))

  const lista: Pendencia[] = [
    ...daAgenda,
    {
      chave: 'convitesPendentes',
      modulo: 'PORTAL',
      valor: fontes.convitesPendentes(),
      tom: 'NEUTRO',
      rota: '/parceiro/equipe',
    },
    {
      chave: 'acessosTemporariosAtivos',
      modulo: 'PORTAL',
      valor: fontes.acessosAtivos(),
      tom: 'NEUTRO',
      rota: '/parceiro/acessos',
    },
    {
      chave: 'vacinasAtrasadas',
      modulo: 'CLINICA',
      valor: fontes.vacinasAtrasadas().length,
      tom: 'ATENCAO',
      rota: '/clinica/vacinas',
    },
    {
      chave: 'vacinasAbaixoDoMinimo',
      modulo: 'CLINICA',
      valor: fontes.vacinasAbaixoDoMinimo(),
      tom: 'RISCO',
      rota: '/clinica/estoque',
    },
    {
      chave: 'tratamentosEmQueda',
      modulo: 'CLINICA',
      valor: fontes.tratamentosEmQueda(),
      tom: 'ATENCAO',
      rota: '/clinica/tratamentos',
    },
    {
      chave: 'copiasDoProntuario',
      modulo: 'CLINICA',
      valor: fontes.copiasPendentes(),
      tom: 'ATENCAO',
      rota: '/clinica/copias-do-prontuario',
    },
    {
      chave: 'termosPendentes',
      modulo: 'CLINICA',
      valor: fontes.termosPendentes(),
      tom: 'NEUTRO',
      rota: '/clinica/documentos?aceite=PENDENTE',
    },
    {
      chave: 'dosesAtrasadasInternacao',
      modulo: 'CLINICA',
      valor: fontes.dosesAtrasadas(),
      tom: 'RISCO',
      rota: '/clinica/internacao/plantao',
    },
    {
      chave: 'boletinsRetidos',
      modulo: 'CLINICA',
      valor: fontes.boletinsPendentes(),
      tom: 'ATENCAO',
      rota: '/clinica/internacao/boletins-pendentes',
    },
    {
      chave: 'importacoesPausadas',
      modulo: 'CLINICA',
      valor: fontes.importacoesPausadas(),
      tom: 'ATENCAO',
      rota: '/clinica/pacientes',
    },
  ]

  const modulo = query.get('modulo')
  return modulo ? lista.filter((p) => p.modulo === modulo) : lista
}

/** A linha do tempo da ficha ganha as vacinas e as internações (o resto vem do prontuário). */
function completarLinhaDoTempo() {
  registrarFonteDaLinhaDoTempo((pacienteId) =>
    aplicacoesDoPaciente(pacienteId).map((a) => ({
      tipo: 'VACINA' as const,
      id: a.id,
      em: a.aplicadaEm,
      titulo: a.vacina.nome,
      situacao: a.anulada ? 'ANULADO' : null,
      profissionalNome: a.origem === 'EXTERNA' ? null : a.profissional.nome,
      detalhe: a.dosesNaSerie > 1 ? `Dose ${a.dose} de ${a.dosesNaSerie}` : null,
    })),
  )
  registrarFonteDaLinhaDoTempo((pacienteId) =>
    internacoesDoPaciente(pacienteId).map((i) => ({
      tipo: 'INTERNACAO' as const,
      id: i.id,
      em: i.entradaEm,
      titulo: `Internação · ${i.leitoNome}`,
      situacao: i.encerradaEm ? 'ENCERRADA' : 'EM_CURSO',
      profissionalNome: i.responsavelNome,
      detalhe: i.motivo,
    })),
  )
}

export function registrarPaineis() {
  completarLinhaDoTempo()
  rota('GET', '/parceiro/portal/clinica/meu-dia', ({ query }) => ok(meuDia(query)))
  rota('GET', '/parceiro/portal/clinica/atividades', () => ok(atividades()))
  rota('GET', '/parceiro/portal/clinica/resumo', ({ query }) => resumo(query))
  rota('GET', '/parceiro/portal/pendencias', ({ query }) => ok(pendencias(query)))
}
