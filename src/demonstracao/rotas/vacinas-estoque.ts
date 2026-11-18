/**
 * Vacinas, estoque de vacinas e tratamentos em casa: a lista de chamada e as aplicadas, o plano e o
 * histórico do pet, aplicar (dá baixa no lote), a dose de outro lugar, anular e corrigir, o
 * lembrete; a geladeira, os lotes, as baixas, os movimentos, a análise e as metas; a adesão.
 *
 * Os dados moram em `dados/vacinas.ts`, `dados/estoque.ts` e `dados/tratamentos.ts`. As escritas
 * mexem na memória e devolvem o que a API devolve, para a tela seguir (até recarregar a página).
 */
import type {
  CorrecaoDoLote,
  MetaNova,
  Movimento,
  NovaBaixa,
  NovoLote,
} from '@/service/parceiro/estoque-service'
import type { LembreteDaVacina } from '@/service/parceiro/lembrete-de-vacina-service'
import type {
  Chamada,
  DoseExterna,
  EdicaoDaAplicacao,
  NovaAplicacao,
  ResultadoDaAplicacao,
} from '@/service/parceiro/vacinacao-service'

import { agendamentosDoDia, criarAgendamento } from '../base/agenda'
import { paciente, type PacienteDaDemo } from '../base/cadastro'
import { pessoaDaEquipe, profissional, tipo, USUARIO_ID } from '../base/clinica'
import {
  analise,
  fornecedores,
  geladeira,
  metas,
  minimoDe,
  movimentos,
  pedidoDoMes,
  salvarPlanoDoMes,
  sugestao,
} from '../dados/estoque'
import {
  adesaoDoPaciente,
  dosesDoTratamento,
  listaDeTratamentos,
  marcarCriticoDe,
  registrarContatoEm,
  tratamento,
} from '../dados/tratamentos'
import {
  aplicacao,
  aplicacaoDto,
  aplicadasEntre,
  APLICACOES,
  BAIXAS,
  baixaDto,
  chamadaDeVacinas,
  diasParaVencerDo,
  historicoDoPaciente,
  lote,
  loteDto,
  LOTES,
  lotesParaAplicar,
  MINIMOS_DA_CLINICA,
  novoIdDeAplicacao,
  novoIdDeBaixa,
  novoIdDeLote,
  planoDoPaciente,
  proximaDoseDe,
  repeticaoDoLembrete,
  saldoDoLote,
  vacinaDoCatalogoPorId,
  vigenteDe,
  type AplicacaoDaDemo,
  type BaixaDaDemo,
  type LoteDaDemo,
} from '../dados/vacinas'
import { agora, agoraIso, diasEntre, hoje, instante, isoDe, somarDias } from '../relogio'
import { corpoDe, erro, ok, paginar, rota, vazio, type Pedido } from '../roteador'

const CODIGO_DO_LOTE = /^[A-Za-z0-9 ./_-]{1,40}$/
const MOTIVOS_DA_BAIXA = ['QUEBRA', 'TEMPERATURA', 'CONTAGEM', 'VENCIMENTO'] as const

function quemEstaLogado() {
  return pessoaDaEquipe(USUARIO_ID)?.nome ?? 'Marina Albuquerque'
}

function param(pedido: Pedido, nome: string) {
  return pedido.params[nome] ?? ''
}

function semPaciente() {
  return erro(404, 'PACIENTE_NAO_ENCONTRADO', 'Paciente não encontrado.')
}

function semAplicacao() {
  return erro(404, 'APLICACAO_NAO_ENCONTRADA', 'Aplicação não encontrada.')
}

function semLote() {
  return erro(404, 'LOTE_NAO_ENCONTRADO', 'Lote não encontrado.')
}

function semTratamento() {
  return erro(404, 'TRATAMENTO_NAO_ENCONTRADO', 'Tratamento não encontrado.')
}

/** O instante que a tela mandou (às vezes em UTC), escrito no fuso da clínica. */
function instanteDaClinica(valor: string | undefined | null) {
  if (!valor) return null
  const ms = Date.parse(valor)
  return Number.isNaN(ms) ? null : isoDe(new Date(ms))
}

/** A série da dose nova: segue a aberta; fechada, é reforço; sem dose, abre pela idade. */
function serieDaNova(p: PacienteDaDemo, vacinaId: string, vigente: AplicacaoDaDemo | null) {
  const v = vacinaDoCatalogoPorId(vacinaId)
  if (vigente && vigente.dose < vigente.dosesNaSerie) {
    return { dose: vigente.dose + 1, total: vigente.dosesNaSerie, tipo: vigente.tipoDeSerie }
  }
  if (vigente) return { dose: 1, total: 1, tipo: 'ADULTO' as const }
  const idade = p.nascimento ? diasEntre(p.nascimento, hoje()) : 9999
  return idade < 365
    ? { dose: 1, total: v?.dosesSerieFilhote ?? 1, tipo: 'FILHOTE' as const }
    : { dose: 1, total: v?.dosesSerieAdultoSemHistorico ?? 1, tipo: 'ADULTO' as const }
}

/** O atendimento do pet hoje, se houver: a dose fica ligada a ele (Meu dia, atividades). */
function atendimentoDeHoje(pacienteId: string) {
  return (
    agendamentosDoDia(hoje()).find(
      (a) =>
        a.pacienteId === pacienteId &&
        (a.status === 'EM_ATENDIMENTO' || a.status === 'AGUARDANDO' || a.status === 'FINALIZADO'),
    )?.id ?? null
  )
}

/* ------------------------------------------------------------------------------ vacinação */

function registrarVacinacao() {
  rota('GET', '/parceiro/portal/pacientes/:id/vacinas/plano', (pedido) => {
    const plano = planoDoPaciente(param(pedido, 'id'))
    return plano ? ok(plano) : semPaciente()
  })

  rota('GET', '/parceiro/portal/pacientes/:id/vacinas', (pedido) => {
    const id = param(pedido, 'id')
    return paciente(id) ? ok(historicoDoPaciente(id)) : semPaciente()
  })

  rota('GET', '/parceiro/portal/clinica/vacinas/:vacinaId/lotes-para-aplicar', (pedido) => {
    const vacinaId = param(pedido, 'vacinaId')
    if (!vacinaDoCatalogoPorId(vacinaId)) {
      return erro(404, 'VACINA_NAO_ENCONTRADA', 'Vacina não encontrada no catálogo.')
    }
    return ok(lotesParaAplicar(vacinaId))
  })

  rota('POST', '/parceiro/portal/pacientes/:id/vacinas/aplicar', (pedido) => {
    const p = paciente(param(pedido, 'id'))
    if (!p) return semPaciente()
    if (!p.ativo) return erro(409, 'PACIENTE_INATIVO', 'O paciente está inativo.')
    const corpo = corpoDe<NovaAplicacao>(pedido)
    const v = corpo.vacinaId ? vacinaDoCatalogoPorId(corpo.vacinaId) : null
    if (!v) return erro(404, 'VACINA_NAO_ENCONTRADA', 'Vacina não encontrada no catálogo.')
    if (!(v.especies as string[]).includes(p.especie)) {
      return erro(409, 'VACINA_FORA_DA_ESPECIE', 'Esta vacina não é para a espécie do paciente.')
    }
    if (!corpo.via || !v.vias.includes(corpo.via)) {
      return erro(409, 'VIA_INVALIDA', 'Esta via não é uma das vias da vacina.')
    }
    if (!corpo.profissionalId || !profissional(corpo.profissionalId)) {
      return erro(400, 'PROFISSIONAL_INVALIDO', 'Escolha quem aplicou.')
    }

    const aplicadaEm = instanteDaClinica(corpo.aplicadaEm) ?? agoraIso()
    if (Date.parse(aplicadaEm) > agora().getTime() + 60_000) {
      return erro(400, 'APLICACAO_NO_FUTURO', 'A aplicação não pode ser no futuro.')
    }
    if (diasEntre(aplicadaEm.slice(0, 10), hoje()) > 30) {
      return erro(400, 'APLICACAO_ANTIGA_DEMAIS', 'A aplicação vale até 30 dias para trás.')
    }

    const avisos: string[] = []
    const guardaEstaVacina = LOTES.some((l) => l.vacinaId === v.id)
    let doEstoque: LoteDaDemo | null = null
    let digitado: { codigo: string; validade: string } | null = null

    if (corpo.loteId) {
      doEstoque = lote(corpo.loteId)
      if (!doEstoque) return semLote()
    } else {
      const codigo = (corpo.loteCodigo ?? '').trim().toUpperCase()
      const validade = corpo.validadeLote ?? ''
      if (!codigo || !validade) {
        return erro(400, 'LOTE_OBRIGATORIO', 'Informe o lote e a validade.')
      }
      const mesmoCodigo = LOTES.find((l) => l.vacinaId === v.id && l.codigo === codigo)
      if (mesmoCodigo) {
        if (mesmoCodigo.validade !== validade) {
          return erro(
            409,
            'LOTE_VALIDADE_DIVERGENTE',
            'A validade não confere com a do lote no estoque.',
            { validade: mesmoCodigo.validade },
          )
        }
        doEstoque = mesmoCodigo
      } else {
        if (/[^\x20-\x7E]/.test(codigo) && guardaEstaVacina && !corpo.confirmarCodigoDoLote) {
          return erro(409, 'LOTE_CODIGO_NAO_ASCII', 'O código do lote tem letra fora de A a Z.', {
            exigeConfirmacao: true,
          })
        }
        if (validade < hoje()) return erro(409, 'LOTE_VENCIDO', 'Este lote está vencido.')
        digitado = { codigo, validade }
        if (guardaEstaVacina) avisos.push('LOTE_FORA_DO_ESTOQUE')
      }
    }

    if (doEstoque) {
      if (doEstoque.vacinaId !== v.id) {
        return erro(409, 'LOTE_DE_OUTRA_VACINA', 'Este lote é de outra vacina.')
      }
      if (doEstoque.recebidoEm > aplicadaEm.slice(0, 10)) {
        return erro(409, 'LOTE_AINDA_NAO_RECEBIDO', 'O lote ainda não tinha chegado nesse dia.')
      }
      if (diasParaVencerDo(doEstoque) < 0) {
        return erro(409, 'LOTE_VENCIDO', 'Este lote está vencido.')
      }
      if (saldoDoLote(doEstoque) <= 0) {
        return erro(409, 'LOTE_SEM_SALDO', 'Este lote não tem mais doses.')
      }
    }

    const validadeDoLote = doEstoque?.validade ?? digitado?.validade ?? hoje()
    const diasDoLote = diasEntre(hoje(), validadeDoLote)
    if (diasDoLote === 0) avisos.push('LOTE_VENCE_HOJE')
    else if (diasDoLote <= 60) avisos.push('LOTE_VENCENDO')

    if (p.nascimento) {
      const aPartirDe = somarDias(p.nascimento, v.idadeMinimaDias)
      if (aplicadaEm.slice(0, 10) < aPartirDe) {
        if (!corpo.confirmarIdadeMinima) {
          return erro(
            409,
            'IDADE_MINIMA_NAO_ATINGIDA',
            'O paciente ainda não tem a idade mínima para esta vacina.',
            { aPartirDe, exigeConfirmacao: true },
          )
        }
        avisos.push('IDADE_MINIMA_CONFIRMADA')
      }
    }

    const vigente = vigenteDe(p.id, v.id)
    if (vigente && vigente.aplicadaEm.slice(0, 10) === aplicadaEm.slice(0, 10)) {
      return erro(409, 'APLICACAO_REPETIDA', 'Esta vacina já foi registrada hoje neste paciente.')
    }
    if (vigente && Date.parse(aplicadaEm) < Date.parse(vigente.aplicadaEm)) {
      return erro(409, 'APLICACAO_FORA_DE_ORDEM', 'Há uma dose desta vacina depois dessa data.', {
        ultimaEm: vigente.aplicadaEm,
      })
    }

    let marcacao: ResultadoDaAplicacao['marcacao'] = {
      status: 'NAO_PEDIDA',
      agendamentoId: null,
      codigo: null,
      conflitos: [],
    }
    let agendamentoProximaId: string | null = null
    if (corpo.marcarProxima) {
      const inicio = instanteDaClinica(corpo.marcarProxima.inicio)
      const dias = inicio ? diasEntre(hoje(), inicio.slice(0, 10)) : -1
      if (!inicio || dias < 0 || dias > 60) {
        return erro(409, 'PROXIMA_DOSE_FORA_DA_JANELA', 'A próxima dose se marca em até 60 dias.')
      }
      const tipoId =
        corpo.marcarProxima.tipoId && tipo(corpo.marcarProxima.tipoId)
          ? corpo.marcarProxima.tipoId
          : 'demo-tipo-vacina'
      const marcado = criarAgendamento({
        pacienteId: p.id,
        profissionalId: corpo.marcarProxima.profissionalId,
        tipoId,
        inicio,
      })
      marcacao = { status: 'MARCADA', agendamentoId: marcado.id, codigo: null, conflitos: [] }
      agendamentoProximaId = marcado.id
    }

    const serie = serieDaNova(p, v.id, vigente)
    const nova: AplicacaoDaDemo = {
      id: novoIdDeAplicacao(),
      pacienteId: p.id,
      vacinaId: v.id,
      origem: 'CLINICA',
      profissionalId: corpo.profissionalId,
      aplicadaEm,
      lote: doEstoque
        ? { codigo: doEstoque.codigo, validade: doEstoque.validade, loteId: doEstoque.id }
        : digitado,
      via: corpo.via,
      dose: serie.dose,
      dosesNaSerie: serie.total,
      tipoDeSerie: serie.tipo,
      proximaDoseEm: proximaDoseDe(v.id, aplicadaEm.slice(0, 10), serie.dose, serie.total),
      agendamentoId: atendimentoDeHoje(p.id),
      agendamentoProximaId,
      externa: null,
      observacao: corpo.observacao?.trim() || null,
      crmvConfirmado: true,
      anulada: null,
      criadaEm: agoraIso(),
      lembrete: null,
    }
    APLICACOES.push(nova)

    return ok<ResultadoDaAplicacao>(
      {
        ...aplicacaoDto(nova),
        publicacao: {
          publicada: p.noApp,
          motivo: p.noApp ? null : 'SEM_VINCULO_ATIVO',
        },
        marcacao,
        avisos,
      },
      201,
    )
  })

  rota('POST', '/parceiro/portal/pacientes/:id/vacinas/externa', (pedido) => {
    const p = paciente(param(pedido, 'id'))
    if (!p) return semPaciente()
    const corpo = corpoDe<DoseExterna>(pedido)
    const v = corpo.vacinaId ? vacinaDoCatalogoPorId(corpo.vacinaId) : null
    if (!v) return erro(404, 'VACINA_NAO_ENCONTRADA', 'Vacina não encontrada no catálogo.')
    if (!(v.especies as string[]).includes(p.especie)) {
      return erro(409, 'VACINA_FORA_DA_ESPECIE', 'Esta vacina não é para a espécie do paciente.')
    }
    const dia = corpo.aplicadaEm?.slice(0, 10) ?? ''
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || dia > hoje()) {
      return erro(400, 'DATA_INVALIDA', 'A data da dose não pode ser no futuro.')
    }
    if (!corpo.local?.trim())
      return erro(400, 'LOCAL_OBRIGATORIO', 'Diga onde a dose foi aplicada.')
    if (corpo.via && !v.vias.includes(corpo.via)) {
      return erro(409, 'VIA_INVALIDA', 'Esta via não é uma das vias da vacina.')
    }
    const vigente = vigenteDe(p.id, v.id)
    const aplicadaEm = instante(dia, '12:00')
    if (vigente && vigente.aplicadaEm.slice(0, 10) === dia) {
      return erro(409, 'APLICACAO_REPETIDA', 'Já há uma dose desta vacina nesse dia.')
    }
    const depoisDaVigente = !vigente || Date.parse(aplicadaEm) > Date.parse(vigente.aplicadaEm)
    const serie = depoisDaVigente
      ? serieDaNova(p, v.id, vigente)
      : { dose: 1, total: 1, tipo: 'ADULTO' as const }
    const nova: AplicacaoDaDemo = {
      id: novoIdDeAplicacao(),
      pacienteId: p.id,
      vacinaId: v.id,
      origem: 'EXTERNA',
      profissionalId: corpo.profissionalId ?? 'demo-prof-marina',
      aplicadaEm,
      lote: null,
      via: corpo.via ?? null,
      dose: serie.dose,
      dosesNaSerie: serie.total,
      tipoDeSerie: serie.tipo,
      proximaDoseEm: proximaDoseDe(v.id, dia, serie.dose, serie.total),
      agendamentoId: null,
      agendamentoProximaId: null,
      externa: {
        local: corpo.local.trim(),
        aplicador: corpo.aplicador?.trim() || null,
        procedencia: corpo.procedencia ?? 'COMPROVANTE',
      },
      observacao: corpo.observacao?.trim() || null,
      crmvConfirmado: true,
      anulada: null,
      criadaEm: agoraIso(),
      lembrete: null,
    }
    APLICACOES.push(nova)
    return ok(aplicacaoDto(nova), 201)
  })

  rota('POST', '/parceiro/portal/clinica/aplicacoes/:id/anular', (pedido) => {
    const a = aplicacao(param(pedido, 'id'))
    if (!a) return semAplicacao()
    const motivo = String(corpoDe<{ motivo: string }>(pedido).motivo ?? '').trim()
    if (motivo.length < 5 || motivo.length > 500) {
      return erro(400, 'MOTIVO_INVALIDO', 'O motivo vai de 5 a 500 caracteres.')
    }
    if (a.anulada) return erro(409, 'APLICACAO_JA_ANULADA', 'Esta aplicação já foi anulada.')
    a.anulada = { em: agoraIso(), motivo }
    a.lembrete = null
    return ok(aplicacaoDto(a))
  })

  rota('PATCH', '/parceiro/portal/clinica/aplicacoes/:id', (pedido) => {
    const a = aplicacao(param(pedido, 'id'))
    if (!a) return semAplicacao()
    const corpo = corpoDe<EdicaoDaAplicacao>(pedido)
    const motivo = String(corpo.motivo ?? '').trim()
    if (motivo.length < 5 || motivo.length > 500) {
      return erro(400, 'MOTIVO_INVALIDO', 'O motivo vai de 5 a 500 caracteres.')
    }
    if (!('observacao' in corpo) && !('via' in corpo)) {
      return erro(400, 'APLICACAO_EDICAO_VAZIA', 'Nada mudou.')
    }
    if (a.anulada) return erro(409, 'APLICACAO_ANULADA', 'A aplicação anulada não se corrige.')
    if ('via' in corpo) {
      const v = vacinaDoCatalogoPorId(a.vacinaId)
      if (!corpo.via) return erro(400, 'VIA_OBRIGATORIA', 'A via não se apaga.')
      if (v && !v.vias.includes(corpo.via)) {
        return erro(409, 'VIA_INVALIDA', 'Esta via não é uma das vias da vacina.')
      }
      a.via = corpo.via
    }
    if ('observacao' in corpo) a.observacao = corpo.observacao?.trim() || null
    return ok(aplicacaoDto(a))
  })

  rota('GET', '/parceiro/portal/clinica/vacinas/chamada', (pedido) => {
    const situacao = pedido.query.get('situacao') as Chamada['situacao'] | null
    const lista = chamadaDeVacinas().filter((i) => !situacao || i.situacao === situacao)
    const pagina = paginar(lista, pedido.query, 50)
    return ok({ hoje: hoje(), itens: pagina.itens, proximoCursor: pagina.proximoCursor })
  })

  rota('GET', '/parceiro/portal/clinica/vacinas/aplicadas', (pedido) => {
    const ate = pedido.query.get('ate') ?? hoje()
    const de = pedido.query.get('de') ?? somarDias(ate, -29)
    const dias = diasEntre(de, ate)
    if (dias < 0 || dias > 91) {
      return erro(400, 'PERIODO_INVALIDO', 'O período vai até 92 dias.')
    }
    const pagina = paginar(aplicadasEntre(de, ate), pedido.query, 50)
    return ok({ itens: pagina.itens, proximoCursor: pagina.proximoCursor })
  })

  rota('POST', '/parceiro/portal/clinica/aplicacoes/:id/lembrete', (pedido) => {
    const a = aplicacao(param(pedido, 'id'))
    if (!a) return semAplicacao()
    if (a.lembrete) return ok<LembreteDaVacina>(a.lembrete)
    if (a.anulada || vigenteDe(a.pacienteId, a.vacinaId)?.id !== a.id) {
      return erro(409, 'LEMBRETE_SEM_DOSE_PENDENTE', 'Esta dose já não está na lista de chamada.')
    }
    const p = paciente(a.pacienteId)
    if (!p?.noApp || !p.ativo) {
      return erro(
        409,
        'SEM_CANAL_NO_APP',
        'O responsável não usa o app: ligue para o telefone do cadastro.',
      )
    }
    const ligadoEm = agoraIso()
    a.lembrete = {
      aplicacaoId: a.id,
      ligadoEm,
      ligadoPorId: USUARIO_ID,
      ultimoEnvioEm: ligadoEm,
      proximoEnvioEm: repeticaoDoLembrete(a, ligadoEm),
      envios: 1,
      entrega: 'ENVIADO',
      motivoSemEnvio: null,
    }
    return ok<LembreteDaVacina>(a.lembrete, 201)
  })

  rota('DELETE', '/parceiro/portal/clinica/aplicacoes/:id/lembrete', (pedido) => {
    const a = aplicacao(param(pedido, 'id'))
    if (a) a.lembrete = null
    return vazio()
  })
}

/* -------------------------------------------------------------------------------- estoque */

function registrarEstoque() {
  const BASE = '/parceiro/portal/clinica/estoque'

  rota('GET', `${BASE}/geladeira`, () => ok(geladeira()))

  rota('GET', `${BASE}/fornecedores`, () => ok<{ itens: string[] }>({ itens: fornecedores() }))

  rota('POST', `${BASE}/lotes`, (pedido) => {
    const corpo = corpoDe<NovoLote>(pedido)
    const v = corpo.vacinaId ? vacinaDoCatalogoPorId(corpo.vacinaId) : null
    if (!v) return erro(404, 'VACINA_NAO_ENCONTRADA', 'Vacina não encontrada no catálogo.')
    const codigo = String(corpo.codigo ?? '')
      .trim()
      .toUpperCase()
    if (!CODIGO_DO_LOTE.test(codigo)) {
      return erro(400, 'LOTE_CODIGO_INVALIDO', 'O código do lote tem caracteres que não valem.')
    }
    if (LOTES.some((l) => l.vacinaId === v.id && l.codigo === codigo)) {
      return erro(409, 'LOTE_DUPLICADO', 'Este lote já foi recebido para esta vacina.')
    }
    const validade = corpo.validade ?? ''
    if (!/^\d{4}-\d{2}-\d{2}$/.test(validade)) {
      return erro(400, 'VALIDADE_INVALIDA', 'Informe a validade do lote.')
    }
    if (validade < hoje()) return erro(409, 'LOTE_JA_VENCIDO', 'Este lote já venceu.')
    const recebidoEm = corpo.recebidoEm ?? hoje()
    if (recebidoEm > hoje() || diasEntre(recebidoEm, hoje()) > 60) {
      return erro(400, 'RECEBIMENTO_FORA_DA_JANELA', 'O recebimento vale até 60 dias para trás.')
    }
    const quantidade = Number(corpo.quantidade)
    if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 999) {
      return erro(400, 'QUANTIDADE_INVALIDA', 'A quantidade vai de 1 a 999 doses.')
    }
    const custo = Number(corpo.custoUnitarioCentavos)
    if (!Number.isInteger(custo) || custo < 0 || custo > 1_000_000) {
      return erro(400, 'CUSTO_INVALIDO', 'O custo por dose não vale.')
    }
    const novo: LoteDaDemo = {
      id: novoIdDeLote(),
      vacinaId: v.id,
      codigo,
      fornecedor: corpo.fornecedor?.trim() || null,
      notaFiscal: corpo.notaFiscal?.trim() || null,
      recebidoEm,
      validade,
      quantidadeRecebida: quantidade,
      conferidoPor: corpo.conferidoPorProfissionalId
        ? (profissional(corpo.conferidoPorProfissionalId)?.nome ?? null)
        : null,
      custoUnitarioCentavos: custo,
      quemNome: quemEstaLogado(),
      criadoEm: agoraIso(),
    }
    LOTES.push(novo)
    return ok(loteDto(novo), 201)
  })

  rota('PATCH', `${BASE}/lotes/:id`, (pedido) => {
    const l = lote(param(pedido, 'id'))
    if (!l) return semLote()
    const corpo = corpoDe<CorrecaoDoLote>(pedido)
    if ('custoUnitarioCentavos' in corpo) {
      const custo = Number(corpo.custoUnitarioCentavos)
      if (corpo.custoUnitarioCentavos === null || !Number.isInteger(custo) || custo < 0) {
        return erro(400, 'CUSTO_INVALIDO', 'O custo por dose não vale.')
      }
      l.custoUnitarioCentavos = custo
    }
    if ('fornecedor' in corpo) l.fornecedor = corpo.fornecedor?.trim() || null
    if ('notaFiscal' in corpo) l.notaFiscal = corpo.notaFiscal?.trim() || null
    return ok(loteDto(l))
  })

  rota('POST', `${BASE}/lotes/:id/baixa`, (pedido) => {
    const l = lote(param(pedido, 'id'))
    if (!l) return semLote()
    const corpo = corpoDe<NovaBaixa>(pedido)
    const motivo = corpo.motivo
    if (!motivo || !MOTIVOS_DA_BAIXA.includes(motivo)) {
      return erro(400, 'MOTIVO_INVALIDO', 'Escolha o motivo da baixa.')
    }
    const saldo = saldoDoLote(l)
    if (saldo <= 0) return erro(409, 'LOTE_SEM_SALDO', 'Este lote não tem doses.')
    let quantidade: number
    if (motivo === 'CONTAGEM') {
      const contadas = Number(corpo.contadas)
      if (!Number.isInteger(contadas) || contadas < 0) {
        return erro(400, 'CONTAGEM_INVALIDA', 'Diga quantas doses há na geladeira.')
      }
      if (contadas > saldo) {
        return erro(409, 'CONTAGEM_ACIMA_DO_SALDO', 'A contagem passou do saldo do lote.', {
          saldo,
        })
      }
      quantidade = saldo - contadas
      if (!quantidade) {
        return erro(409, 'CONTAGEM_SEM_DIFERENCA', 'A contagem bate com o saldo: nada a baixar.')
      }
    } else if (motivo === 'VENCIMENTO' && corpo.quantidade === undefined) {
      quantidade = saldo
    } else {
      quantidade = Number(corpo.quantidade)
      if (!Number.isInteger(quantidade) || quantidade < 1) {
        return erro(400, 'QUANTIDADE_INVALIDA', 'Diga quantas doses saíram.')
      }
      if (quantidade > saldo) {
        return erro(409, 'BAIXA_ACIMA_DO_SALDO', 'A baixa passou do saldo do lote.', { saldo })
      }
    }
    const baixa: BaixaDaDemo = {
      id: novoIdDeBaixa(),
      loteId: l.id,
      em: hoje(),
      quantidade,
      motivo,
      observacao: corpo.observacao?.trim() || null,
      estorno: null,
      quemNome: quemEstaLogado(),
      criadaEm: agoraIso(),
    }
    BAIXAS.push(baixa)
    return ok(baixaDto(baixa), 201)
  })

  rota('POST', `${BASE}/baixas/:id/estornar`, (pedido) => {
    const baixa = BAIXAS.find((b) => b.id === param(pedido, 'id'))
    if (!baixa) return erro(404, 'BAIXA_NAO_ENCONTRADA', 'Baixa não encontrada.')
    if (baixa.estorno) return erro(409, 'BAIXA_JA_ESTORNADA', 'Esta baixa já foi estornada.')
    const motivo = String(corpoDe<{ motivo: string }>(pedido).motivo ?? '').trim()
    if (motivo.length < 10 || motivo.length > 300) {
      return erro(400, 'MOTIVO_INVALIDO', 'O motivo do estorno vai de 10 a 300 caracteres.')
    }
    baixa.estorno = { em: agoraIso(), quemNome: quemEstaLogado(), motivo }
    return ok(baixaDto(baixa))
  })

  rota('PUT', `${BASE}/minimos/:vacinaId`, (pedido) => {
    const vacinaId = param(pedido, 'vacinaId')
    const v = vacinaDoCatalogoPorId(vacinaId)
    if (!v) return erro(404, 'VACINA_NAO_ENCONTRADA', 'Vacina não encontrada no catálogo.')
    const minimo = Number(corpoDe<{ minimo: number }>(pedido).minimo)
    if (!Number.isInteger(minimo) || minimo < 0 || minimo > 9999) {
      return erro(400, 'MINIMO_INVALIDO', 'O mínimo vai de 0 a 9999 doses.')
    }
    MINIMOS_DA_CLINICA.set(vacinaId, minimo)
    return ok({ vacinaId, minimo: minimoDe(vacinaId), minimoPadrao: v.estoqueMinimoPadrao })
  })

  rota('GET', `${BASE}/movimentos`, (pedido) => {
    const tipo = pedido.query.get('tipo') as Movimento['tipo'] | null
    const limite = Math.min(100, Number(pedido.query.get('limit')) || 30)
    return ok(
      movimentos({
        tipo: tipo === 'ENTRADA' || tipo === 'BAIXA' ? tipo : null,
        de: pedido.query.get('de'),
        ate: pedido.query.get('ate'),
        cursor: pedido.query.get('cursor'),
        limite,
      }),
    )
  })

  rota('GET', `${BASE}/analise`, (pedido) => {
    const meses = Math.min(24, Math.max(1, Number(pedido.query.get('meses')) || 6))
    return ok(analise(meses))
  })

  rota('GET', `${BASE}/metas`, () => ok(metas()))

  rota('GET', `${BASE}/metas/sugestao`, (pedido) => ok(sugestao(pedido.query.get('mes'))))

  rota('PUT', `${BASE}/metas/:mes`, (pedido) => {
    const resultado = salvarPlanoDoMes(param(pedido, 'mes'), corpoDe(pedido))
    if ('codigo' in resultado) {
      return erro(resultado.status, resultado.codigo, resultado.mensagem, {
        ...resultado.extra,
      })
    }
    return ok(resultado)
  })

  rota('POST', `${BASE}/metas/:mes/simular-pedido`, (pedido) => {
    const mes = param(pedido, 'mes')
    const atual = hoje().slice(0, 7)
    const seguinte = somarDias(`${atual}-28`, 7).slice(0, 7)
    if (mes !== atual && mes !== seguinte) {
      return erro(400, 'MES_FORA_DA_JANELA', 'Só o mês em curso ou o seguinte.')
    }
    const lista = corpoDe<{ metas: MetaNova[] }>(pedido).metas ?? []
    return ok(pedidoDoMes(mes, lista, true))
  })
}

/* ----------------------------------------------------------------------------- tratamentos */

function registrarTratamentos() {
  rota('GET', '/parceiro/portal/pacientes/:id/tratamentos', (pedido) => {
    const id = param(pedido, 'id')
    return paciente(id) ? ok(adesaoDoPaciente(id)) : semPaciente()
  })

  rota('GET', '/parceiro/portal/clinica/tratamentos', (pedido) => {
    const lista = listaDeTratamentos(pedido.query.get('filtro') === 'PEDEM_ATENCAO')
    const pagina = paginar(lista, pedido.query, 30)
    return ok({ itens: pagina.itens, proximoCursor: pagina.proximoCursor })
  })

  rota('GET', '/parceiro/portal/clinica/tratamentos/:id/doses', (pedido) => {
    const t = tratamento(param(pedido, 'id'))
    if (!t) return semTratamento()
    if (t.situacao === 'NAO_COMPARTILHADO') {
      return erro(403, 'TRATAMENTO_NAO_COMPARTILHADO', 'O responsável não compartilha as doses.')
    }
    const resultado = dosesDoTratamento(t, pedido.query.get('desde'), pedido.query.get('ate'))
    if ('erro' in resultado) {
      return erro(400, resultado.erro, 'O período vai até 90 dias.')
    }
    return ok(resultado)
  })

  rota('PATCH', '/parceiro/portal/clinica/tratamentos/:id', (pedido) => {
    const t = tratamento(param(pedido, 'id'))
    if (!t) return semTratamento()
    const critico = corpoDe<{ critico: boolean }>(pedido).critico
    if (typeof critico !== 'boolean') return erro(400, 'CRITICO_INVALIDO', 'Diga se é crítico.')
    if (t.situacao === 'ENCERRADO') {
      return erro(409, 'TRATAMENTO_ENCERRADO', 'Este tratamento já foi encerrado.')
    }
    return ok(marcarCriticoDe(t, critico))
  })

  rota('POST', '/parceiro/portal/clinica/tratamentos/:id/contato', (pedido) => {
    const t = tratamento(param(pedido, 'id'))
    if (!t) return semTratamento()
    const nota = String(corpoDe<{ nota: string }>(pedido).nota ?? '').trim()
    if (!nota || nota.length > 500) {
      return erro(400, 'NOTA_INVALIDA', 'A nota vai de 1 a 500 caracteres.')
    }
    if (t.situacao === 'ENCERRADO') {
      return erro(409, 'TRATAMENTO_ENCERRADO', 'Este tratamento já foi encerrado.')
    }
    return ok(registrarContatoEm(t, nota), 201)
  })
}

export function registrarVacinasEstoque() {
  registrarVacinacao()
  registrarEstoque()
  registrarTratamentos()
}
