/**
 * Agenda e recepção: a agenda do dia e da semana, as ações do agendamento, a configuração da agenda
 * (salas, tipos, política, bloqueios, agendamento online), os pedidos de horário, a fila de espera,
 * as faltas, a pré-consulta e os retornos pendentes. Os dados moram em `dados/agenda*.ts`.
 *
 * A `versao` que a tela manda não é conferida: na apresentação, um 409 "mudou enquanto você
 * editava" só atrapalharia. As regras de situação (o que cabe em cada status), o feriado fechado e
 * o "Desfazer" de 15 s seguem a API.
 */
import type {
  AtualizarBloqueioDto,
  AtualizarSalaDto,
  AtualizarTipoDeAtendimentoDto,
  CriarBloqueioDto,
  CriarSalaDto,
  CriarTipoDeAtendimentoDto,
  PaginaDeRetornosDto,
} from '@/service/contrato/openapi'
import type {
  Bloqueio,
  BloqueiosDoPeriodo,
  Politica,
  PoliticaSalva,
  Sala,
  TipoDeAtendimento,
} from '@/service/parceiro/agenda-config-service'
import type {
  AgendaDaSemana,
  AgendaDoDia,
  AgendaDoIntervalo,
  Agendamento,
  Agrupamento,
  Cancelamento,
  EdicaoDoAgendamento,
  Movimento,
  Mutacao,
  NovoAgendamento,
  Simulacao,
  Sugestoes,
} from '@/service/parceiro/agenda-service'
import type { Retorno } from '@/service/parceiro/atendimentos-service'
import type {
  FaltaDoAgendamento,
  FaltaMarcada,
  HistoricoDeFaltas,
  JustificativaRegistrada,
  NovaJustificativa,
  PainelDeFaltas,
  RespostaDoLote,
} from '@/service/parceiro/faltas-service'
import type {
  AceiteDaRecepcao,
  DetalheDaEntrada,
  EntradaNaFila,
  NovaEntrada,
  OfertaFeita,
  PaginaDaFila,
  VagasDaFila,
} from '@/service/parceiro/fila-service'
import type {
  Aceite,
  ConfiguracaoOnline,
  ConfiguracaoOnlineSalva,
  DetalheDoPedido,
  PaginaDaCaixa,
  Recusa,
  RespostaDoPedido,
  SugestoesDoPedido,
} from '@/service/parceiro/pedidos-service'
import type { PreConsultaDaClinica } from '@/service/parceiro/pre-consulta-service'

import { AGENDAMENTOS, agendamento } from '../base/agenda'
import { PROFISSIONAIS, SALAS, TIPOS, USUARIO_ID } from '../base/clinica'
import { marcarRetorno, preConsultaDe, retornosPendentes } from '../dados/agenda-consulta'
import {
  faltaDto,
  faltasEmLote,
  historicoDoCliente,
  justificarFalta,
  LIMITE_DE_REINCIDENCIA,
  marcarFalta,
  painelDeFaltas,
  reagendarFalta,
} from '../dados/agenda-faltas'
import {
  detalheDaEntrada,
  entradaDto,
  entrarNaFila,
  exigirEntrada,
  exigirOfertaAberta,
  FILA,
  listaDaFila,
  marcarAceite,
  ofertar,
  recusarOferta,
  removerDaFila,
  statusEfetivo,
  vagasDaFila,
} from '../dados/agenda-fila'
import {
  avisoAoResponsavel,
  BLOQUEIOS,
  criarNaAgenda,
  desfazer,
  diaDaAgenda,
  doGrupo,
  dtoDe,
  ErroDaDemo,
  exigirAgendamento,
  exigirPacienteAtivo,
  guardarDesfazer,
  horariosLivres,
  intervaloDaAgenda,
  LIBERADOS,
  moverNaAgenda,
  mutacaoDe,
  novoIdDeBloqueio,
  ocorrenciasEntre,
  POLITICA,
  retratar,
  semanaDaAgenda,
  simular,
  statusInvalido,
  tocar,
} from '../dados/agenda-grade'
import {
  aceitarPedido,
  CONFIGURACAO_ONLINE,
  detalheDoPedido,
  exigirPedido,
  pedidoNaCaixa,
  pedidosDaAba,
  recusarPedido,
  sugestoesDoPedido,
} from '../dados/agenda-pedidos'
import { agoraIso, diasEntre, FUSO, hoje, instante, somarDias, somarMinutos } from '../relogio'
import {
  corpoDe,
  erro,
  ok,
  paginar,
  rota,
  vazio,
  type Manipulador,
  type Metodo,
  type Pedido,
} from '../roteador'

const CLINICA = '/parceiro/portal/clinica'

/** A rota com o erro da demonstração virando o corpo de erro da API. */
function registrar(metodo: Metodo, padrao: string, manipulador: Manipulador) {
  rota(metodo, padrao, async (pedido) => {
    try {
      return await manipulador(pedido)
    } catch (falha) {
      if (falha instanceof ErroDaDemo) {
        return erro(falha.status, falha.codigo, falha.message, falha.extra)
      }
      throw falha
    }
  })
}

function parametro(pedido: Pedido, nome: string) {
  return pedido.params[nome] ?? ''
}

function periodoValido(de: string, ate: string, maxDias: number) {
  if (!de || !ate || ate < de || diasEntre(de, ate) + 1 > maxDias) {
    throw new ErroDaDemo(400, 'AGENDA_PERIODO_INVALIDO', `O período vai de 1 a ${maxDias} dias.`, {
      maxDias,
    })
  }
}

export function registrarAgenda() {
  registrarLeitura()
  registrarAcoes()
  registrarConfiguracao()
  registrarPedidos()
  registrarFila()
  registrarFaltas()
  registrarConsulta()
}

/* ------------------------------------------------------------------------------- leitura */

function registrarLeitura() {
  registrar('GET', `${CLINICA}/agenda/dia`, ({ query }) => {
    const agrupar: Agrupamento = query.get('agrupar') === 'SALA' ? 'SALA' : 'PROFISSIONAL'
    return ok<AgendaDoDia>(diaDaAgenda(query.get('data') || hoje(), agrupar))
  })

  registrar('GET', `${CLINICA}/agenda/semana`, ({ query }) =>
    ok<AgendaDaSemana>(semanaDaAgenda(query.get('data') || hoje())),
  )

  registrar('GET', `${CLINICA}/agenda/intervalo`, ({ query }) => {
    const de = query.get('de') ?? ''
    const ate = query.get('ate') ?? ''
    periodoValido(de, ate, 31)
    return ok<AgendaDoIntervalo>(
      intervaloDaAgenda(de, ate, query.get('profissionalId'), query.get('cursor')),
    )
  })

  registrar('GET', `${CLINICA}/agenda/sugestoes`, ({ query }) => {
    const pacienteId = query.get('pacienteId') ?? ''
    if (pacienteId) exigirPacienteAtivo(pacienteId)
    const profissionalId = query.get('profissionalId')
    const aPartirDe = query.get('aPartirDe') || hoje()
    const quantidade = Math.min(20, Math.max(1, Number(query.get('quantidade')) || 6))
    const atendem = PROFISSIONAIS.filter((p) => p.ativo && p.atendeNaAgenda)
    return ok<Sugestoes>({
      fuso: FUSO,
      sugestoes: horariosLivres({
        tipoId: query.get('tipoId') ?? '',
        pacienteId,
        profissionalIds: profissionalId ? [profissionalId] : undefined,
        aPartirDe: aPartirDe < hoje() ? hoje() : aPartirDe,
        quantidade,
      }),
      buscaInterrompida: false,
      profissionaisAvaliados: profissionalId ? 1 : atendem.length,
      profissionaisLimitados: false,
    })
  })

  registrar('POST', `${CLINICA}/agenda/desfazer`, (pedido) => {
    const { token } = corpoDe<{ token: string }>(pedido)
    return ok<Mutacao>(desfazer(token ?? ''))
  })
}

/* ---------------------------------------------------------------------- as ações */

const ANTES_DE_CHEGAR = ['AGENDADO', 'CONFIRMADO']
const ATE_AGUARDAR = ['AGENDADO', 'CONFIRMADO', 'AGUARDANDO']

function registrarAcoes() {
  registrar('POST', `${CLINICA}/agendamentos/simular`, (pedido) =>
    ok<Simulacao>(simular(corpoDe<NovoAgendamento>(pedido) as NovoAgendamento)),
  )

  registrar('POST', `${CLINICA}/agendamentos`, (pedido) => {
    const corpo = corpoDe<NovoAgendamento>(pedido)
    if (!corpo.pacienteId || !corpo.profissionalId || !corpo.tipoId || !corpo.inicio) {
      throw new ErroDaDemo(400, 'AGENDAMENTO_INVALIDO', 'Faltam dados do horário.', {
        reason: 'CAMPOS',
      })
    }
    if (corpo.mensagem && !corpo.avisarResponsavel) {
      throw new ErroDaDemo(400, 'AGENDAMENTO_INVALIDO', 'A mensagem vai junto do aviso.', {
        reason: 'MENSAGEM_SEM_AVISO',
      })
    }
    const { principal, todos } = criarNaAgenda(corpo as NovoAgendamento)
    const aviso = corpo.avisarResponsavel
      ? avisoAoResponsavel('AGENDAMENTO_CRIADO_PELA_CLINICA', principal.pacienteId)
      : null
    return ok<Mutacao>(mutacaoDe(principal, todos, guardarDesfazer([], todos), aviso), 201)
  })

  /* O horário que o aceite de um pedido marcou, aberto pelo id (N24). */
  registrar('GET', `${CLINICA}/agendamentos/:id`, (pedido) =>
    ok<Agendamento>(dtoDe(exigirAgendamento(parametro(pedido, 'id')))),
  )

  registrar('PATCH', `${CLINICA}/agendamentos/:id`, (pedido) => {
    const a = exigirAgendamento(parametro(pedido, 'id'))
    if (['FINALIZADO', 'FALTA', 'CANCELADO'].includes(a.status)) statusInvalido(a, 'editar')
    const corpo = corpoDe<EdicaoDoAgendamento>(pedido)
    const retratos = retratar([a])
    if (corpo.tipoId) {
      const tipo = TIPOS.find((t) => t.id === corpo.tipoId)
      if (!tipo?.ativo) throw new ErroDaDemo(409, 'TIPO_INATIVO', 'O tipo está desativado.')
      a.tipoId = tipo.id
    }
    if ('observacao' in corpo) a.observacao = corpo.observacao?.trim() || null
    if (corpo.salaIds) a.salaIds = [...corpo.salaIds]
    if (corpo.duracaoMinutos) {
      a.duracaoMinutos = corpo.duracaoMinutos
      a.fim = somarMinutos(a.inicio, corpo.duracaoMinutos)
    }
    if (typeof corpo.encaixe === 'boolean') a.encaixe = corpo.encaixe
    tocar(a)
    return ok<Mutacao>(mutacaoDe(a, [a], guardarDesfazer(retratos)))
  })

  registrar('POST', `${CLINICA}/agendamentos/:id/mover`, (pedido) => {
    const a = exigirAgendamento(parametro(pedido, 'id'))
    const corpo = corpoDe<Movimento>(pedido)
    if (!corpo.inicio) {
      throw new ErroDaDemo(400, 'AGENDAMENTO_INVALIDO', 'Diga o horário novo.', {
        reason: 'INICIO',
      })
    }
    const { grupo, retratos } = moverNaAgenda(a, corpo as Movimento)
    const aviso = corpo.avisarResponsavel
      ? avisoAoResponsavel('AGENDAMENTO_REMARCADO', a.pacienteId)
      : null
    return ok<Mutacao>(mutacaoDe(a, grupo, guardarDesfazer(retratos), aviso))
  })

  registrar('POST', `${CLINICA}/agendamentos/:id/cancelar`, (pedido) => {
    const a = exigirAgendamento(parametro(pedido, 'id'))
    if (!ATE_AGUARDAR.includes(a.status)) statusInvalido(a, 'cancelar')
    const corpo = corpoDe<Cancelamento>(pedido)
    const grupo = doGrupo(a)
    const retratos = retratar(grupo)
    for (const g of grupo) {
      g.status = 'CANCELADO'
      g.canceladoEm = agoraIso()
      g.motivoCancelamento = corpo.motivo ?? 'OUTRO'
      g.canceladoPor = 'RECEPCAO'
      tocar(g)
    }
    const aviso = corpo.avisarResponsavel
      ? avisoAoResponsavel('AGENDAMENTO_CANCELADO_PELA_CLINICA', a.pacienteId)
      : null
    return ok<Mutacao>(mutacaoDe(a, grupo, guardarDesfazer(retratos), aviso))
  })

  registrar('POST', `${CLINICA}/agendamentos/:id/confirmar-presenca`, (pedido) => {
    const a = exigirAgendamento(parametro(pedido, 'id'))
    if (!ANTES_DE_CHEGAR.includes(a.status)) statusInvalido(a, 'confirmar-presenca')
    const grupo = doGrupo(a)
    const retratos = retratar(grupo)
    for (const g of grupo) {
      g.status = 'CONFIRMADO'
      g.confirmadoEm = agoraIso()
      g.confirmadoPor = 'RECEPCAO'
      tocar(g)
    }
    return ok<Mutacao>(mutacaoDe(a, grupo, guardarDesfazer(retratos)))
  })

  registrar('POST', `${CLINICA}/agendamentos/:id/chegada`, (pedido) => {
    const a = exigirAgendamento(parametro(pedido, 'id'))
    if (!ANTES_DE_CHEGAR.includes(a.status)) statusInvalido(a, 'chegada')
    const grupo = doGrupo(a)
    const retratos = retratar(grupo)
    for (const g of grupo) {
      g.status = 'AGUARDANDO'
      g.chegadaEm = agoraIso()
      tocar(g)
    }
    return ok<Mutacao>(mutacaoDe(a, grupo, guardarDesfazer(retratos)))
  })

  /* Iniciar abre o atendimento: o prontuário monta o `demo-atd-<id>`. */
  registrar('POST', `${CLINICA}/agendamentos/:id/iniciar`, (pedido) => {
    const a = exigirAgendamento(parametro(pedido, 'id'))
    if (!ATE_AGUARDAR.includes(a.status)) statusInvalido(a, 'iniciar')
    const retratos = retratar([a])
    a.status = 'EM_ATENDIMENTO'
    a.chegadaEm ??= agoraIso()
    a.iniciadoEm = agoraIso()
    a.atendimentoId = `demo-atd-${a.id}`
    tocar(a)
    return ok<Mutacao>(mutacaoDe(a, [a], guardarDesfazer(retratos)))
  })

  registrar('POST', `${CLINICA}/agendamentos/:id/falta`, (pedido) => {
    const a = exigirAgendamento(parametro(pedido, 'id'))
    const corpo = corpoDe<{ justificativa: Partial<NovaJustificativa> }>(pedido)
    return ok<FaltaMarcada>(marcarFalta(a, corpo))
  })

  registrar('GET', `${CLINICA}/agendamentos/:id/falta`, (pedido) => {
    const a = exigirAgendamento(parametro(pedido, 'id'))
    if (a.status !== 'FALTA') statusInvalido(a, 'falta')
    return ok<FaltaDoAgendamento>(faltaDto(a))
  })

  registrar('POST', `${CLINICA}/agendamentos/:id/justificativas`, (pedido) => {
    const a = exigirAgendamento(parametro(pedido, 'id'))
    return ok<JustificativaRegistrada>(justificarFalta(a, corpoDe<NovaJustificativa>(pedido)), 201)
  })

  registrar('POST', `${CLINICA}/agendamentos/:id/reagendar`, (pedido) => {
    const a = exigirAgendamento(parametro(pedido, 'id'))
    return ok<Mutacao>(reagendarFalta(a, corpoDe(pedido)), 201)
  })

  registrar('POST', `${CLINICA}/agendamentos/faltas-em-lote`, (pedido) =>
    ok<RespostaDoLote>(faltasEmLote(corpoDe(pedido))),
  )
}

/* --------------------------------------------------------------------- configuração */

function exigirTexto(valor: string | undefined, min: number, max: number, campo: string) {
  const texto = (valor ?? '').trim()
  if ([...texto].length < min || [...texto].length > max) {
    throw new ErroDaDemo(400, 'CAMPO_INVALIDO', `O ${campo} vai de ${min} a ${max} caracteres.`, {
      campo,
    })
  }
  return texto
}

let sequenciaDaSala = 0
let sequenciaDoTipo = 0

function registrarConfiguracao() {
  /* Salas */
  registrar('GET', `${CLINICA}/salas`, ({ query }) => {
    const ativas = query.get('ativas') === 'true'
    return ok<Sala[]>(
      SALAS.filter((s) => !ativas || s.ativa)
        .sort((a, b) => a.ordem - b.ordem)
        .map((s) => ({ ...s })),
    )
  })

  registrar('POST', `${CLINICA}/salas`, (pedido) => {
    const corpo = corpoDe<CriarSalaDto>(pedido)
    const sala: Sala = {
      id: `demo-sala-nova-${++sequenciaDaSala}`,
      nome: exigirTexto(corpo.nome, 2, 60, 'nome'),
      tipo: corpo.tipo ?? 'CONSULTORIO',
      ativa: true,
      ordem: corpo.ordem ?? Math.max(0, ...SALAS.map((s) => s.ordem)) + 1,
    }
    SALAS.push(sala)
    return ok<Sala>({ ...sala }, 201)
  })

  registrar('PATCH', `${CLINICA}/salas/:id`, (pedido) => {
    const sala = SALAS.find((s) => s.id === parametro(pedido, 'id'))
    if (!sala) throw new ErroDaDemo(403, 'SEM_ACESSO', 'Sala não encontrada ou sem acesso.')
    const corpo = corpoDe<AtualizarSalaDto>(pedido)
    if (corpo.nome !== undefined) sala.nome = exigirTexto(corpo.nome, 2, 60, 'nome')
    if (corpo.tipo) sala.tipo = corpo.tipo
    if (typeof corpo.ordem === 'number') sala.ordem = corpo.ordem
    if (typeof corpo.ativa === 'boolean') sala.ativa = corpo.ativa
    return ok<Sala>({ ...sala })
  })

  /* Tipos de atendimento */
  registrar('GET', `${CLINICA}/tipos-de-atendimento`, ({ query }) => {
    const ativos = query.get('ativos') === 'true'
    return ok<TipoDeAtendimento[]>(
      TIPOS.filter((t) => !ativos || t.ativo)
        .sort((a, b) => a.ordem - b.ordem)
        .map((t) => ({ ...t, salasCompativeis: [...t.salasCompativeis] })),
    )
  })

  const foraDoOnline = (kind: string, ofertado: boolean | undefined) => {
    if (ofertado && (kind === 'CIRURGIA' || kind === 'EMERGENCIA')) {
      throw new ErroDaDemo(
        400,
        'TIPO_NAO_OFERTAVEL_ONLINE',
        'Este tipo não vai para o pedido online.',
      )
    }
  }

  registrar('POST', `${CLINICA}/tipos-de-atendimento`, (pedido) => {
    const corpo = corpoDe<CriarTipoDeAtendimentoDto>(pedido)
    const kind = corpo.kind ?? 'CONSULTA'
    foraDoOnline(kind, corpo.ofertadoOnline)
    const tipo: TipoDeAtendimento = {
      id: `demo-tipo-novo-${++sequenciaDoTipo}`,
      nome: exigirTexto(corpo.nome, 2, 60, 'nome'),
      kind,
      duracaoMinutos: corpo.duracaoMinutos ?? 30,
      salasCompativeis: [...(corpo.salasCompativeis ?? [])],
      permiteEncaixe: corpo.permiteEncaixe ?? true,
      ofertadoOnline: corpo.ofertadoOnline ?? false,
      podeSerOfertadoOnline: kind !== 'CIRURGIA' && kind !== 'EMERGENCIA',
      ativo: true,
      ordem: corpo.ordem ?? Math.max(0, ...TIPOS.map((t) => t.ordem)) + 1,
    }
    TIPOS.push(tipo)
    return ok<TipoDeAtendimento>({ ...tipo }, 201)
  })

  registrar('PATCH', `${CLINICA}/tipos-de-atendimento/:id`, (pedido) => {
    const tipo = TIPOS.find((t) => t.id === parametro(pedido, 'id'))
    if (!tipo) throw new ErroDaDemo(403, 'SEM_ACESSO', 'Tipo não encontrado ou sem acesso.')
    const corpo = corpoDe<AtualizarTipoDeAtendimentoDto>(pedido)
    const kind = corpo.kind ?? tipo.kind
    foraDoOnline(kind, corpo.ofertadoOnline ?? tipo.ofertadoOnline)
    if (corpo.nome !== undefined) tipo.nome = exigirTexto(corpo.nome, 2, 60, 'nome')
    tipo.kind = kind
    tipo.podeSerOfertadoOnline = kind !== 'CIRURGIA' && kind !== 'EMERGENCIA'
    if (corpo.duracaoMinutos) tipo.duracaoMinutos = corpo.duracaoMinutos
    if (corpo.salasCompativeis) tipo.salasCompativeis = [...corpo.salasCompativeis]
    if (typeof corpo.permiteEncaixe === 'boolean') tipo.permiteEncaixe = corpo.permiteEncaixe
    if (typeof corpo.ofertadoOnline === 'boolean') tipo.ofertadoOnline = corpo.ofertadoOnline
    if (typeof corpo.ordem === 'number') tipo.ordem = corpo.ordem
    if (typeof corpo.ativo === 'boolean') tipo.ativo = corpo.ativo
    return ok<TipoDeAtendimento>({ ...tipo })
  })

  /* Política */
  registrar('GET', `${CLINICA}/politica`, () => ok<Politica>({ ...POLITICA }))

  registrar('PUT', `${CLINICA}/politica`, (pedido) => {
    const corpo = corpoDe<PoliticaSalva>(pedido)
    const limites = POLITICA.limites
    if (!limites.granularidadeMinutos.includes(Number(corpo.granularidadeMinutos))) {
      throw new ErroDaDemo(400, 'POLITICA_FORA_DO_LIMITE', 'Passo da grade fora das opções.', {
        campo: 'granularidadeMinutos',
        opcoes: limites.granularidadeMinutos,
      })
    }
    const faixas = [
      'cancelarAteHorasAntes',
      'reservaMinutos',
      'preConsultaAbreHorasAntes',
      'ofertaDeVagaMinutos',
      'confirmacaoAbreHorasAntes',
    ] as const
    for (const campo of faixas) {
      const valor = Number(corpo[campo])
      const { min, max } = limites[campo]
      if (!Number.isFinite(valor) || valor < min || valor > max) {
        throw new ErroDaDemo(
          400,
          'POLITICA_FORA_DO_LIMITE',
          `Valor fora da faixa (${min} a ${max}).`,
          {
            campo,
            min,
            max,
          },
        )
      }
      POLITICA[campo] = valor
    }
    POLITICA.granularidadeMinutos = Number(corpo.granularidadeMinutos)
    if (typeof corpo.ofertaAutomaticaFila === 'boolean') {
      POLITICA.ofertaAutomaticaFila = corpo.ofertaAutomaticaFila
    }
    POLITICA.personalizada = true
    POLITICA.atualizadoEm = agoraIso()
    return ok<Politica>({ ...POLITICA })
  })

  /* Bloqueios */
  registrar('GET', `${CLINICA}/bloqueios`, ({ query }) => {
    const de = query.get('de') ?? ''
    const ate = query.get('ate') ?? ''
    periodoValido(de, ate, 62)
    const profissionalId = query.get('profissionalId')
    const salaId = query.get('salaId')
    const daClinica = (o: { profissionalId: string | null; salaId: string | null }) =>
      !o.profissionalId && !o.salaId
    return ok<BloqueiosDoPeriodo>({
      fuso: FUSO,
      de,
      ate,
      ocorrencias: ocorrenciasEntre(de, ate).filter(
        (o) =>
          (!profissionalId || o.profissionalId === profissionalId || daClinica(o)) &&
          (!salaId || o.salaId === salaId || daClinica(o)),
      ),
    })
  })

  const exigirBloqueio = (id: string) => {
    const b = BLOQUEIOS.find((x) => x.id === id)
    if (!b) throw new ErroDaDemo(403, 'SEM_ACESSO', 'Bloqueio não encontrado ou sem acesso.')
    return b
  }

  const conferirHorario = (inicio: string, fim: string) => {
    if (!inicio || !fim || Date.parse(fim) <= Date.parse(inicio)) {
      throw new ErroDaDemo(400, 'BLOQUEIO_INVALIDO', 'O fim vem antes do início.', {
        reason: 'FIM_ANTES_DO_INICIO',
      })
    }
  }

  registrar('GET', `${CLINICA}/bloqueios/:id`, (pedido) =>
    ok<Bloqueio>({ ...exigirBloqueio(parametro(pedido, 'id')) }),
  )

  registrar('POST', `${CLINICA}/bloqueios`, (pedido) => {
    const corpo = corpoDe<CriarBloqueioDto>(pedido)
    conferirHorario(corpo.inicio ?? '', corpo.fim ?? '')
    const dias = corpo.diasDaSemana ?? []
    const agora = agoraIso()
    const bloqueio: Bloqueio = {
      id: novoIdDeBloqueio(),
      profissionalId: corpo.profissionalId ?? null,
      salaId: corpo.salaId ?? null,
      inicio: corpo.inicio ?? '',
      fim: corpo.fim ?? '',
      motivo: corpo.motivo ?? 'OUTRO',
      detalhe: corpo.detalhe?.trim() || null,
      recorrente: dias.length > 0,
      diasDaSemana: [...dias],
      repeteAte: dias.length ? (corpo.repeteAte ?? null) : null,
      excecoes: [],
      criadoPorId: USUARIO_ID,
      criadoEm: agora,
      atualizadoEm: agora,
    }
    BLOQUEIOS.push(bloqueio)
    return ok<Bloqueio>({ ...bloqueio }, 201)
  })

  registrar('PATCH', `${CLINICA}/bloqueios/:id`, (pedido) => {
    const b = exigirBloqueio(parametro(pedido, 'id'))
    const corpo = corpoDe<AtualizarBloqueioDto>(pedido)
    const somenteEm = pedido.query.get('somenteEm')

    if (somenteEm) {
      if (!b.recorrente) {
        throw new ErroDaDemo(400, 'BLOQUEIO_NAO_RECORRENTE', 'Este bloqueio não se repete.')
      }
      const duracao = Math.round((Date.parse(b.fim) - Date.parse(b.inicio)) / 60_000)
      const inicio = corpo.inicio ?? instante(somenteEm, b.inicio.slice(11, 16))
      const fim = corpo.fim ?? somarMinutos(inicio, duracao)
      conferirHorario(inicio, fim)
      b.excecoes = [...new Set([...b.excecoes, somenteEm])]
      b.atualizadoEm = agoraIso()
      const agora = agoraIso()
      const unico: Bloqueio = {
        id: novoIdDeBloqueio(),
        profissionalId:
          corpo.profissionalId !== undefined ? corpo.profissionalId : b.profissionalId,
        salaId: corpo.salaId !== undefined ? corpo.salaId : b.salaId,
        inicio,
        fim,
        motivo: corpo.motivo ?? b.motivo,
        detalhe: corpo.detalhe !== undefined ? corpo.detalhe : b.detalhe,
        recorrente: false,
        diasDaSemana: [],
        repeteAte: null,
        excecoes: [],
        criadoPorId: USUARIO_ID,
        criadoEm: agora,
        atualizadoEm: agora,
      }
      BLOQUEIOS.push(unico)
      return ok<Bloqueio>({ ...unico })
    }

    if (corpo.inicio) b.inicio = corpo.inicio
    if (corpo.fim) b.fim = corpo.fim
    conferirHorario(b.inicio, b.fim)
    if (corpo.profissionalId !== undefined) b.profissionalId = corpo.profissionalId
    if (corpo.salaId !== undefined) b.salaId = corpo.salaId
    if (corpo.motivo) b.motivo = corpo.motivo
    if (corpo.detalhe !== undefined) b.detalhe = corpo.detalhe?.trim() || null
    if (corpo.diasDaSemana) {
      b.diasDaSemana = [...corpo.diasDaSemana]
      b.recorrente = corpo.diasDaSemana.length > 0
      if (!b.recorrente) {
        b.repeteAte = null
        b.excecoes = []
      }
    }
    if (corpo.repeteAte !== undefined && b.recorrente) b.repeteAte = corpo.repeteAte
    if (corpo.excecoes && b.recorrente) b.excecoes = [...corpo.excecoes]
    b.atualizadoEm = agoraIso()
    return ok<Bloqueio>({ ...b })
  })

  registrar('DELETE', `${CLINICA}/bloqueios/:id`, (pedido) => {
    const b = exigirBloqueio(parametro(pedido, 'id'))
    const somenteEm = pedido.query.get('somenteEm')
    if (somenteEm) {
      if (!b.recorrente) {
        throw new ErroDaDemo(400, 'BLOQUEIO_NAO_RECORRENTE', 'Este bloqueio não se repete.')
      }
      b.excecoes = [...new Set([...b.excecoes, somenteEm])]
      b.atualizadoEm = agoraIso()
    } else {
      BLOQUEIOS.splice(BLOQUEIOS.indexOf(b), 1)
    }
    return vazio()
  })

  /* Agendamento online */
  registrar('GET', `${CLINICA}/agendamento-online`, () =>
    ok<ConfiguracaoOnline>({
      ...CONFIGURACAO_ONLINE,
      tipoIds: [...CONFIGURACAO_ONLINE.tipoIds],
      profissionalIds: [...CONFIGURACAO_ONLINE.profissionalIds],
    }),
  )

  registrar('PUT', `${CLINICA}/agendamento-online`, (pedido) => {
    const corpo = corpoDe<ConfiguracaoOnlineSalva>(pedido)
    const tipoIds = corpo.tipoIds ?? CONFIGURACAO_ONLINE.tipoIds
    const profissionalIds = corpo.profissionalIds ?? CONFIGURACAO_ONLINE.profissionalIds
    if (corpo.ativo && (!tipoIds.length || !profissionalIds.length)) {
      throw new ErroDaDemo(
        400,
        'AGENDAMENTO_ONLINE_INVALIDO',
        'Escolha um serviço e um profissional.',
        {
          reason: tipoIds.length ? 'SEM_PROFISSIONAL' : 'SEM_SERVICO',
        },
      )
    }
    Object.assign(CONFIGURACAO_ONLINE, {
      ...corpo,
      tipoIds: [...tipoIds],
      profissionalIds: [...profissionalIds],
      atualizadoEm: agoraIso(),
    })
    return ok<ConfiguracaoOnline>({ ...CONFIGURACAO_ONLINE })
  })
}

/* ---------------------------------------------------------------------------- pedidos */

function registrarPedidos() {
  registrar('GET', `${CLINICA}/pedidos`, ({ query }) => {
    const pagina = paginar(pedidosDaAba(query.get('status') ?? 'PENDENTES'), query, 50)
    return ok<PaginaDaCaixa>({
      fuso: FUSO,
      itens: pagina.itens.map(pedidoNaCaixa),
      proximoCursor: pagina.proximoCursor,
    })
  })

  registrar('GET', `${CLINICA}/pedidos/:id`, (pedido) =>
    ok<DetalheDoPedido>(detalheDoPedido(exigirPedido(parametro(pedido, 'id')))),
  )

  registrar('GET', `${CLINICA}/pedidos/:id/sugestoes`, (pedido) => {
    const limite = Math.min(20, Math.max(1, Number(pedido.query.get('limite')) || 6))
    return ok<SugestoesDoPedido>(sugestoesDoPedido(exigirPedido(parametro(pedido, 'id')), limite))
  })

  registrar('POST', `${CLINICA}/pedidos/:id/aceitar`, (pedido) =>
    ok<RespostaDoPedido>(
      aceitarPedido(exigirPedido(parametro(pedido, 'id')), corpoDe<Aceite>(pedido)),
    ),
  )

  registrar('POST', `${CLINICA}/pedidos/:id/recusar`, (pedido) =>
    ok<DetalheDoPedido>(
      recusarPedido(exigirPedido(parametro(pedido, 'id')), corpoDe<Recusa>(pedido)),
    ),
  )
}

/* ------------------------------------------------------------------------------- fila */

function registrarFila() {
  registrar('GET', `${CLINICA}/fila`, ({ query }) => {
    const pagina = paginar(listaDaFila(query.get('situacao') ?? 'ATIVAS'), query, 50)
    return ok<PaginaDaFila>({
      fuso: FUSO,
      itens: pagina.itens.map((e) => entradaDto(e)),
      aguardando: FILA.filter((e) => statusEfetivo(e) === 'AGUARDANDO').length,
      proximoCursor: pagina.proximoCursor,
    })
  })

  registrar('GET', `${CLINICA}/fila/vagas`, ({ query }) => {
    const de = query.get('de') || hoje()
    const ate = query.get('ate') || somarDias(de, 13)
    periodoValido(de, ate, 31)
    return ok<VagasDaFila>({ fuso: FUSO, de, ate, itens: vagasDaFila(de, ate) })
  })

  registrar('GET', `${CLINICA}/fila/:id`, (pedido) =>
    ok<DetalheDaEntrada>(detalheDaEntrada(exigirEntrada(parametro(pedido, 'id')))),
  )

  registrar('POST', `${CLINICA}/fila`, (pedido) =>
    ok<EntradaNaFila>(entradaDto(entrarNaFila(corpoDe<NovaEntrada>(pedido))), 201),
  )

  registrar('DELETE', `${CLINICA}/fila/:id`, (pedido) => {
    const e = FILA.find((x) => x.id === parametro(pedido, 'id'))
    if (e && e.status !== 'REMOVIDO') removerDaFila(e)
    return vazio()
  })

  registrar('POST', `${CLINICA}/fila/:id/ofertar`, (pedido) =>
    ok<OfertaFeita>(ofertar(exigirEntrada(parametro(pedido, 'id')), corpoDe(pedido))),
  )

  /* O "sim" do telefone: cria o agendamento confirmado (ou troca o horário do que ele já tinha). */
  registrar('POST', `${CLINICA}/fila/:id/oferta/aceitar`, (pedido) => {
    const e = exigirEntrada(parametro(pedido, 'id'))
    const jaFeito = e.status === 'ACEITO' && e.agendamentoId ? agendamento(e.agendamentoId) : null
    if (jaFeito) {
      return ok<AceiteDaRecepcao>({
        entrada: entradaDto(e),
        agendamento: mutacaoDe(jaFeito, [jaFeito], null),
        remarcadoDe: null,
      })
    }
    const { oferta, atual } = exigirOfertaAberta(e)
    const existente = atual ? agendamento(atual.agendamentoId) : null

    if (existente) {
      const remarcadoDe = existente.inicio
      if (Date.parse(existente.inicio) > Date.now()) {
        LIBERADOS.push({
          profissionalId: existente.profissionalId,
          inicio: existente.inicio,
          fim: existente.fim,
          agendamentoId: existente.id,
        })
      }
      existente.inicio = oferta.inicio
      existente.fim = somarMinutos(oferta.inicio, existente.duracaoMinutos)
      existente.profissionalId = oferta.profissionalId
      existente.status = 'CONFIRMADO'
      existente.confirmadoEm = agoraIso()
      existente.confirmadoPor = 'RECEPCAO'
      tocar(existente)
      AGENDAMENTOS.sort((a, b) => a.inicio.localeCompare(b.inicio))
      marcarAceite(e, existente.id)
      return ok<AceiteDaRecepcao>({
        entrada: entradaDto(e),
        agendamento: mutacaoDe(existente, [existente], null),
        remarcadoDe,
      })
    }

    const { principal, todos } = criarNaAgenda(
      {
        pacienteId: e.pacienteId,
        profissionalId: oferta.profissionalId,
        tipoId: e.tipoId,
        inicio: oferta.inicio,
      },
      {
        origem: 'FILA',
        status: 'CONFIRMADO',
        confirmadoEm: agoraIso(),
        confirmadoPor: 'RECEPCAO',
      },
    )
    marcarAceite(e, principal.id)
    return ok<AceiteDaRecepcao>({
      entrada: entradaDto(e),
      agendamento: mutacaoDe(principal, todos, null),
      remarcadoDe: null,
    })
  })

  registrar('POST', `${CLINICA}/fila/:id/oferta/recusar`, (pedido) =>
    ok<EntradaNaFila>(entradaDto(recusarOferta(exigirEntrada(parametro(pedido, 'id'))))),
  )
}

/* ----------------------------------------------------------------------------- faltas */

function registrarFaltas() {
  registrar('GET', `${CLINICA}/faltas`, ({ query }) => {
    const ate = query.get('ate') || hoje()
    const de = query.get('de') || somarDias(ate, -365)
    if (ate < de || diasEntre(de, ate) + 1 > 366) {
      throw new ErroDaDemo(400, 'FALTAS_PERIODO_INVALIDO', 'O período vai até 366 dias.', {
        maxDias: 366,
      })
    }
    const itens = painelDeFaltas({
      de,
      ate,
      reincidentes: query.get('reincidentes') === 'true',
      semJustificativa: query.get('semJustificativa') === 'true',
    })
    const pagina = paginar(itens, query, 50)
    return ok<PainelDeFaltas>({
      fuso: FUSO,
      de,
      ate,
      limiteReincidencia: LIMITE_DE_REINCIDENCIA,
      itens: pagina.itens,
      proximoCursor: pagina.proximoCursor,
    })
  })

  registrar('GET', '/parceiro/portal/clientes/:id/faltas', (pedido) => {
    const pagina = paginar(historicoDoCliente(parametro(pedido, 'id')), pedido.query, 50)
    return ok<HistoricoDeFaltas>({
      fuso: FUSO,
      itens: pagina.itens,
      proximoCursor: pagina.proximoCursor,
    })
  })
}

/* ------------------------------------------------------- pré-consulta e retornos */

function registrarConsulta() {
  registrar('GET', `${CLINICA}/agendamentos/:id/pre-consulta`, (pedido) =>
    ok<PreConsultaDaClinica>(preConsultaDe(exigirAgendamento(parametro(pedido, 'id')))),
  )

  registrar('GET', `${CLINICA}/retornos-pendentes`, ({ query }) => {
    const pagina = paginar(retornosPendentes(query.get('somenteVencidos') === 'true'), query, 50)
    return ok<PaginaDeRetornosDto>({
      itens: pagina.itens,
      proximoCursor: pagina.proximoCursor,
      hoje: hoje(),
    })
  })

  /* Marcar o retorno é do atendimento, mas a linha some dos pendentes e o horário entra aqui. */
  registrar('POST', `${CLINICA}/atendimentos/:id/retorno`, (pedido) =>
    ok<Mutacao>(marcarRetorno(parametro(pedido, 'id'), corpoDe<Retorno>(pedido)), 201),
  )
}
