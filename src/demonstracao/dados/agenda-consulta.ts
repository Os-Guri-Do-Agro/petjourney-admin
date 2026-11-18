/**
 * O antes e o depois da consulta, do lado da agenda:
 *
 * - **Pré-consulta** (E3-07): o que o responsável contou pelo app antes da consulta. Algumas
 *   consultas de hoje e de amanhã já têm resposta (só de quem usa o app); as outras dizem em que
 *   pé está a janela (abre 48 h antes, fecha no horário).
 * - **Retornos pendentes** (E4-01): o retorno que o veterinário indicou num atendimento finalizado
 *   e ninguém marcou. Sete, uns vencidos e outros a vencer, sem texto clínico.
 */
import type { PreConsultaDaClinicaDto, RetornoPendenteDto } from '@/service/contrato/openapi'
import type { Retorno } from '@/service/parceiro/atendimentos-service'
import type { Mutacao } from '@/service/parceiro/agenda-service'

import { AGENDAMENTOS, agendamentoDoAtendimento, type AgendamentoDaDemo } from '../base/agenda'
import { paciente } from '../base/cadastro'
import { PROFISSIONAIS, TIPOS } from '../base/clinica'
import { agora, agoraIso, diasEntre, hoje, instante, somarDias, somarMinutos } from '../relogio'
import {
  avisoAoResponsavel,
  criarNaAgenda,
  ErroDaDemo,
  guardarDesfazer,
  mutacaoDe,
  POLITICA,
  primeiroLivre,
} from './agenda-grade'

/* ------------------------------------------------------------------------ pré-consulta */

type Resposta = Omit<
  PreConsultaDaClinicaDto,
  'agendamentoId' | 'situacao' | 'completa' | 'abreEm' | 'fechaEm' | 'fotos'
>

const RESPOSTAS = new Map<string, Resposta>()

type Modelo = Omit<Resposta, 'respondidaEm' | 'atualizadaEm' | 'pesadoEm'> & {
  /** Quantas horas antes da consulta respondeu; e se editou depois. */
  horasAntes: number
  editadaHorasAntes?: number
}

/** As respostas pensadas para quem vem hoje (pelo paciente). */
const DE_HOJE: Record<string, Modelo> = {
  'demo-pac-001': {
    motivo: 'SINTOMA',
    queixaPrincipal:
      'Vomitou três vezes esta semana, uma delas com bola de pelo. Está comendo menos ração seca.',
    sintomas: ['VOMITO'],
    desdeQuando: 'TRES_A_SETE_DIAS',
    evolucao: 'ESTAVEL',
    alimentacao: 'POUCO',
    hidratacao: 'NORMAL',
    fezes: 'NORMAL',
    urina: 'NORMAL',
    vitalidade: 'CALMO',
    pesoKg: 4.0,
    observacao:
      'Ela come muito rápido quando eu chego do trabalho. Troquei a marca da areia na semana passada, não sei se tem a ver.',
    camposDoDiario: ['alimentacao', 'pesoKg'],
    horasAntes: 13,
    editadaHorasAntes: 3,
  },
  'demo-pac-005': {
    motivo: 'SINTOMA',
    queixaPrincipal: 'Coçando muito as orelhas e o pescoço, com a barriga vermelha.',
    sintomas: ['COCEIRA', 'LAMBEDURA_EXCESSIVA'],
    desdeQuando: 'UMA_A_DUAS_SEMANAS',
    evolucao: 'PIORANDO',
    alimentacao: 'NORMAL',
    hidratacao: 'NORMAL',
    fezes: 'NORMAL',
    urina: 'NORMAL',
    vitalidade: 'NORMAL',
    pesoKg: 6.3,
    observacao: 'Mudamos o xampu há uns 15 dias. Lembrando que a Nina tem alergia a dipirona.',
    camposDoDiario: [],
    horasAntes: 20,
  },
  'demo-pac-003': {
    motivo: 'CHECKUP',
    queixaPrincipal:
      'Acompanhamento da gestação. Está mais cansada e comendo bem mais que o normal.',
    sintomas: [],
    desdeQuando: null,
    evolucao: null,
    alimentacao: 'MUITO',
    hidratacao: 'MUITO',
    fezes: 'NORMAL',
    urina: 'NORMAL',
    vitalidade: 'CALMO',
    pesoKg: 31.2,
    observacao:
      'Preparamos um cantinho para o parto. Queremos saber quando fazer o raio-x para contar os filhotes.',
    camposDoDiario: ['alimentacao', 'pesoKg'],
    horasAntes: 26,
  },
  'demo-pac-002': {
    motivo: 'SINTOMA',
    queixaPrincipal: 'Mancando da pata traseira esquerda depois do passeio de domingo.',
    sintomas: ['CLAUDICACAO'],
    desdeQuando: 'TRES_A_SETE_DIAS',
    evolucao: 'MELHORANDO',
    alimentacao: 'NORMAL',
    hidratacao: 'NORMAL',
    fezes: 'NORMAL',
    urina: 'NORMAL',
    vitalidade: 'NORMAL',
    pesoKg: null,
    observacao: 'Ele fica nervoso no exame: levamos a focinheira.',
    camposDoDiario: [],
    horasAntes: 30,
  },
  'demo-pac-007-2': {
    motivo: 'RETORNO',
    queixaPrincipal: 'Controle da doença renal. Está bebendo muita água e fazendo mais xixi.',
    sintomas: ['PERDA_DE_PESO'],
    desdeQuando: 'MAIS_DE_DUAS_SEMANAS',
    evolucao: 'ESTAVEL',
    alimentacao: 'POUCO',
    hidratacao: 'MUITO',
    fezes: 'RESSECADA',
    urina: 'MUITO',
    vitalidade: 'SONOLENTO',
    pesoKg: 4.6,
    observacao: 'Está comendo só a ração renal úmida. A seca ele cheira e larga.',
    camposDoDiario: ['hidratacao', 'urina', 'pesoKg'],
    horasAntes: 18,
  },
  'demo-pac-039': {
    motivo: 'SINTOMA',
    queixaPrincipal: 'Espirrando e com secreção no olho direito.',
    sintomas: ['ESPIRRO', 'SECRECAO_OCULAR'],
    desdeQuando: 'UM_A_DOIS_DIAS',
    evolucao: 'PIORANDO',
    alimentacao: 'POUCO',
    hidratacao: 'NORMAL',
    fezes: 'NORMAL',
    urina: 'NORMAL',
    vitalidade: 'DESANIMADO',
    pesoKg: null,
    observacao: null,
    camposDoDiario: [],
    horasAntes: 9,
  },
  'demo-pac-026': {
    motivo: 'SINTOMA',
    queixaPrincipal: 'Diarreia desde ontem à noite. Acho que comeu alguma coisa na rua.',
    sintomas: ['DIARREIA'],
    desdeQuando: 'UM_A_DOIS_DIAS',
    evolucao: 'ESTAVEL',
    alimentacao: 'POUCO',
    hidratacao: 'NORMAL',
    fezes: 'DIARREIA',
    urina: 'NORMAL',
    vitalidade: 'DESANIMADO',
    pesoKg: null,
    observacao: 'Dei só água e arroz hoje de manhã.',
    camposDoDiario: ['fezes'],
    horasAntes: 4,
  },
}

/** Para as consultas de amanhã, uma resposta pela espécie. */
const POR_ESPECIE: Record<string, Omit<Modelo, 'horasAntes'>> = {
  CACHORRO: {
    motivo: 'CHECKUP',
    queixaPrincipal: 'Check-up anual e ver uma bolinha que apareceu na pele, perto da axila.',
    sintomas: [],
    desdeQuando: 'UMA_A_DUAS_SEMANAS',
    evolucao: 'ESTAVEL',
    alimentacao: 'NORMAL',
    hidratacao: 'NORMAL',
    fezes: 'NORMAL',
    urina: 'NORMAL',
    vitalidade: 'ATIVO',
    pesoKg: null,
    observacao: 'A bolinha não dói quando aperto e não cresceu.',
    camposDoDiario: [],
  },
  GATO: {
    motivo: 'SINTOMA',
    queixaPrincipal: 'Fazendo xixi fora da caixa de areia há alguns dias.',
    sintomas: [],
    desdeQuando: 'TRES_A_SETE_DIAS',
    evolucao: 'VAI_E_VOLTA',
    alimentacao: 'NORMAL',
    hidratacao: 'POUCO',
    fezes: 'NORMAL',
    urina: 'COM_DIFICULDADE',
    vitalidade: 'CALMO',
    pesoKg: null,
    observacao: 'Fica um tempão na caixa e sai pouco xixi.',
    camposDoDiario: ['urina'],
  },
}

function montarPreConsultas() {
  const data = hoje()
  const amanha = somarDias(data, 1)
  const consulta = (a: AgendamentoDaDemo) =>
    ['CONSULTA', 'RETORNO'].includes(TIPOS.find((t) => t.id === a.tipoId)?.kind ?? '') &&
    a.status !== 'CANCELADO' &&
    Boolean(paciente(a.pacienteId)?.noApp)

  for (const a of AGENDAMENTOS.filter((x) => x.inicio.startsWith(data) && consulta(x))) {
    const modelo = DE_HOJE[a.pacienteId]
    if (!modelo) continue
    const { horasAntes, editadaHorasAntes, ...resposta } = modelo
    const respondidaEm = somarMinutos(a.inicio, -horasAntes * 60 - 17)
    RESPOSTAS.set(a.id, {
      ...resposta,
      respondidaEm,
      atualizadaEm:
        editadaHorasAntes !== undefined
          ? somarMinutos(a.inicio, -editadaHorasAntes * 60 - 41)
          : respondidaEm,
      pesadoEm: resposta.pesoKg ? somarDias(a.inicio.slice(0, 10), -1) : null,
    })
  }

  const deAmanha = AGENDAMENTOS.filter((x) => x.inicio.startsWith(amanha) && consulta(x))
  let respondidas = 0
  for (const a of deAmanha) {
    const especie = paciente(a.pacienteId)?.especie ?? ''
    const modelo = POR_ESPECIE[especie]
    if (!modelo || respondidas >= 3) continue
    respondidas++
    const respondidaEm = instante(
      data,
      `${String(6 + respondidas).padStart(2, '0')}:${10 + respondidas * 11}`,
    )
    RESPOSTAS.set(a.id, {
      ...modelo,
      respondidaEm: Date.parse(respondidaEm) < agora().getTime() ? respondidaEm : agoraIso(),
      atualizadaEm: null,
      pesadoEm: null,
    })
  }
}

montarPreConsultas()

export function preConsultaDe(a: AgendamentoDaDemo): PreConsultaDaClinicaDto {
  const abreEm = somarMinutos(a.inicio, -POLITICA.preConsultaAbreHorasAntes * 60)
  const fechaEm = a.inicio
  const resposta = a.status === 'CANCELADO' ? undefined : RESPOSTAS.get(a.id)
  const agoraMs = agora().getTime()
  const encerrado = ['EM_ATENDIMENTO', 'FINALIZADO', 'FALTA', 'CANCELADO'].includes(a.status)
  const situacao: PreConsultaDaClinicaDto['situacao'] = resposta
    ? 'RESPONDIDA'
    : agoraMs < Date.parse(abreEm)
      ? 'AINDA_NAO_ABRIU'
      : encerrado || agoraMs >= Date.parse(fechaEm)
        ? 'FECHADA'
        : 'ABERTA'

  if (!resposta) {
    return {
      agendamentoId: a.id,
      situacao,
      respondidaEm: null,
      completa: true,
      motivo: null,
      queixaPrincipal: null,
      abreEm,
      fechaEm,
    }
  }
  return {
    agendamentoId: a.id,
    situacao,
    completa: true,
    abreEm,
    fechaEm,
    fotos: [],
    ...resposta,
  }
}

/** Os agendamentos com pré-consulta respondida (o Meu dia e o painel podem contar). */
export function preConsultasRespondidas() {
  return [...RESPOSTAS.keys()]
}

/* --------------------------------------------------------------------- retornos pendentes */

type RetornoDaDemo = RetornoPendenteDto

export const RETORNOS_PENDENTES: RetornoDaDemo[] = []

function retornoDe(
  a: AgendamentoDaDemo,
  emDias: number,
  semTipo: boolean,
  retornoAnteriorId: string | null,
): RetornoDaDemo {
  const dataDoAtendimento = a.inicio.slice(0, 10)
  const venceEm = somarDias(dataDoAtendimento, emDias)
  return {
    atendimentoId: a.atendimentoId ?? `demo-atd-${a.id}`,
    pacienteId: a.pacienteId,
    pacienteNome: paciente(a.pacienteId)?.nome ?? '',
    profissionalId: a.profissionalId,
    profissionalNome: PROFISSIONAIS.find((p) => p.id === a.profissionalId)?.nome ?? '',
    tipoId: semTipo ? null : 'demo-tipo-retorno',
    tipoNome: semTipo ? null : 'Retorno',
    emDias,
    dataDoAtendimento,
    venceEm,
    diasDeAtraso: diasEntre(venceEm, hoje()),
    retornoAnteriorId,
  }
}

/** A combinação de "em quantos dias" e "quanto já passou" de cada um, para variar a lista. */
const ALVOS: ReadonlyArray<readonly [number, number]> = [
  [15, 12],
  [7, 5],
  [30, 2],
  [10, 0],
  [14, -2],
  [21, -5],
  [30, -9],
]

function montarRetornos() {
  const usados = new Set<string>()
  const agoraMs = agora().getTime()
  const temRetornoMarcado = (pacienteId: string) =>
    AGENDAMENTOS.some(
      (o) =>
        o.pacienteId === pacienteId &&
        o.tipoId === 'demo-tipo-retorno' &&
        (o.status === 'AGENDADO' || o.status === 'CONFIRMADO') &&
        Date.parse(o.inicio) > agoraMs,
    )

  ALVOS.forEach(([emDias, atraso], i) => {
    for (const folga of [0, 1, -1, 2, -2, 3, -3]) {
      const data = somarDias(hoje(), -(emDias + atraso + folga))
      const achado = AGENDAMENTOS.find(
        (a) =>
          a.inicio.startsWith(data) &&
          a.status === 'FINALIZADO' &&
          a.tipoId === 'demo-tipo-consulta' &&
          !usados.has(a.pacienteId) &&
          Boolean(paciente(a.pacienteId)?.ativo) &&
          !temRetornoMarcado(a.pacienteId),
      )
      if (!achado) continue
      usados.add(achado.pacienteId)
      const anterior =
        i === 1
          ? (AGENDAMENTOS.find(
              (o) =>
                o.pacienteId === achado.pacienteId &&
                o.tipoId === 'demo-tipo-retorno' &&
                (o.status === 'CANCELADO' || o.status === 'FALTA') &&
                o.inicio > achado.inicio,
            )?.id ?? null)
          : null
      RETORNOS_PENDENTES.push(retornoDe(achado, emDias, i === 3, anterior))
      return
    }
  })
}

montarRetornos()

export function retornosPendentes(somenteVencidos: boolean): RetornoDaDemo[] {
  return RETORNOS_PENDENTES.map((r) => ({ ...r, diasDeAtraso: diasEntre(r.venceEm, hoje()) }))
    .filter((r) => !somenteVencidos || r.diasDeAtraso >= 0)
    .sort((a, b) => a.venceEm.localeCompare(b.venceEm))
}

/**
 * Marca o retorno (o `POST .../atendimentos/:id/retorno`): sem `inicio`, o primeiro horário livre
 * de quem atendeu a partir do vencimento. Tira a linha dos pendentes; o desfazer devolve.
 */
export function marcarRetorno(atendimentoId: string, corpo: Partial<Retorno>): Mutacao {
  const pendente = RETORNOS_PENDENTES.find((r) => r.atendimentoId === atendimentoId)
  const origem = agendamentoDoAtendimento(atendimentoId)
  const pacienteId = pendente?.pacienteId ?? origem?.pacienteId
  if (!pacienteId) {
    throw new ErroDaDemo(403, 'SEM_ACESSO', 'Atendimento não encontrado ou sem acesso.')
  }
  const tipoId = pendente?.tipoId ?? corpo.tipoId ?? (pendente ? null : 'demo-tipo-retorno')
  if (!tipoId) {
    throw new ErroDaDemo(400, 'AGENDAMENTO_INVALIDO', 'Escolha o tipo do retorno.', {
      reason: 'TIPO_OBRIGATORIO',
    })
  }
  const profissionalId =
    corpo.profissionalId ?? pendente?.profissionalId ?? origem?.profissionalId ?? ''
  const vence = pendente?.venceEm ?? somarDias(hoje(), 7)
  const aPartirDe = vence > hoje() ? vence : somarDias(hoje(), 1)
  const inicio =
    corpo.inicio ??
    primeiroLivre({ tipoId, pacienteId, profissionalIds: [profissionalId], aPartirDe })?.inicio
  if (!inicio) {
    throw new ErroDaDemo(
      409,
      'RETORNO_SEM_HORARIO',
      'Sem horário livre nas próximas cinco semanas.',
    )
  }

  const { principal } = criarNaAgenda({
    pacienteId,
    profissionalId,
    tipoId,
    inicio,
    duracaoMinutos: corpo.duracaoMinutos,
    salaIds: corpo.salaIds,
    origem: 'RETORNO',
    confirmarConflitos: corpo.confirmarConflitos,
  })
  const indice = pendente ? RETORNOS_PENDENTES.indexOf(pendente) : -1
  if (pendente) RETORNOS_PENDENTES.splice(indice, 1)
  const desfazer = guardarDesfazer([], [principal], () => {
    if (pendente) RETORNOS_PENDENTES.splice(Math.max(0, indice), 0, pendente)
  })
  const aviso = corpo.avisarResponsavel
    ? avisoAoResponsavel('AGENDAMENTO_CRIADO_PELA_CLINICA', pacienteId)
    : null
  return mutacaoDe(principal, [principal], desfazer, aviso)
}

export function contagemDosRetornos() {
  const lista = retornosPendentes(false)
  return { pendentes: lista.length, vencidos: lista.filter((r) => r.diasDeAtraso >= 0).length }
}

export function retornosDoPaciente(pacienteId: string) {
  return retornosPendentes(false).filter((r) => r.pacienteId === pacienteId)
}
