/**
 * O prontuário da Clínica na demonstração: a lista e o atendimento (seções, lock, finalizar,
 * anular, adendos, atos, resumo, retorno), a prescrição e a receita, os documentos e os laudos, os
 * catálogos (bulário, diagnósticos, faixas, dose) e as cópias do prontuário.
 *
 * Os dados e as regras moram em `dados/prontuario*.ts`; aqui só o contrato de cada rota. A senha da
 * assinatura aceita qualquer texto (vazia pede a senha); o PDF abre por uma URL `blob:` montada no
 * navegador.
 */
import type {
  Adendo,
  Atendimento,
  Ato,
  EstadoDaEdicao,
  Gravacao,
  LiberacaoDoResumo,
  LinhaDoTempo,
  Mutacao,
  PaginaDeAtendimentos,
  TipoNaLinhaDoTempo,
} from '@/service/parceiro/atendimentos-service'
import type {
  Acrescimos,
  Diagnostico,
  EspecieDoCatalogo,
  FaixasDoPaciente,
  Medicamento,
  PacoteDeCatalogos,
  ResultadoDaDose,
} from '@/service/parceiro/catalogos-service'
import type { PedidoDeCopia, UrlDaCopia } from '@/service/parceiro/copias-service'
import type { AceiteRegistrado, Documento, Laudo } from '@/service/parceiro/documentos-service'
import type {
  GravacaoDaPrescricao,
  Prescricao,
  Receita,
  Repeticao,
  UrlDaReceita,
} from '@/service/parceiro/receitas-service'
import type {
  CalcularDoseDto,
  CriarDiagnosticoDto,
  CriarExameDto,
  CriarMedicamentoDto,
  CriarVacinaDto,
  DescarteDto,
  DiagnosticoAdminDto,
  EscutasDoAtendimentoDto,
  ExameAdminDto,
  IntegridadeDto,
  ListaDeLaudosDto,
  ListaDePrescricoesDto,
  MedicamentoAdminDto,
  PaginaDeDocumentosDto,
  PaginaDePedidosDeCopiaDto,
  PedidoDeCopiaRegistradoDto,
  UrlDoDocumentoDto,
  UrlDoLaudoDto,
  VacinaAdminDto,
} from '@/service/contrato/openapi'

import { paciente } from '../base/cadastro'
import { ErroDaDemo } from '../dados/agenda-grade'
import { marcarRetorno } from '../dados/agenda-consulta'
import {
  acrescimos,
  buscarDiagnosticos,
  buscarMedicamentos,
  calcularDose,
  DIAGNOSTICOS,
  EXAMES,
  faixasDoPaciente,
  idDoAcrescimo,
  MEDICAMENTOS,
  pacoteDeCatalogos,
  VACINAS,
} from '../dados/prontuario-catalogos'
import {
  folhaDaCopia,
  folhaDaReceita,
  folhaDoDocumento,
  folhaDoLaudo,
} from '../dados/prontuario-folhas'
import { esquecerPdf, urlDoArquivo, urlDoPdf } from '../dados/prontuario-pdf'
import {
  abrirAvulso,
  anular,
  assinar,
  atendimentoDto,
  atoPorId,
  descartar,
  documentoPorId,
  documentosDoPaciente,
  emitir,
  esquecerDocumento,
  estadoDaEdicao,
  faltamParaFinalizar,
  finalizar,
  gravarSecao,
  itensDaLista,
  laudoPorId,
  liberarResumo,
  linhaDoTempoDoPaciente,
  marcarEdicao,
  montarCopias,
  montarPrescricao,
  montarReceita,
  novoAdendo,
  novoAto,
  novoDocumento,
  PEDIDOS_DE_COPIA,
  pedidoDeCopia,
  pedidoDto,
  receitaPorId,
  registroDoAtendimento,
  resumoDoDocumento,
  temConteudo,
  tomarLock,
  TIPOS_DA_LINHA,
  type EntradaDaPrescricao,
  type RegistroDoAtendimento,
} from '../dados/prontuario'
import { corpoDe, erro, limiteDe, ok, paginar, rota, type Pedido, type Resposta } from '../roteador'
import { agoraIso, diaDaSemana, hoje, somarDias, somarMinutos } from '../relogio'

const CLINICA = '/parceiro/portal/clinica'
const ATENDIMENTO = `${CLINICA}/atendimentos/:id`
const MARINA = 'demo-prof-marina'

const QUINZE_MINUTOS = () => somarMinutos(agoraIso(), 15)

/* --------------------------------------------------------------------------- ajudas */

function semAtendimento() {
  return erro(404, 'ATENDIMENTO_NAO_ENCONTRADO', 'Atendimento não encontrado.')
}

function comAtendimento(
  manipulador: (r: RegistroDoAtendimento, pedido: Pedido) => Resposta,
): (pedido: Pedido) => Resposta {
  return (pedido) => {
    const r = registroDoAtendimento(pedido.params.id ?? '')
    return r ? manipulador(r, pedido) : semAtendimento()
  }
}

function soRascunho(r: RegistroDoAtendimento): Resposta | null {
  if (r.status === 'FINALIZADO') {
    return erro(409, 'ATENDIMENTO_FINALIZADO', 'O atendimento já foi finalizado.')
  }
  if (r.status === 'ANULADO') return erro(409, 'ATENDIMENTO_ANULADO', 'O atendimento foi anulado.')
  return null
}

function senhaFalta(pedido: Pedido): Resposta | null {
  const { senha } = corpoDe<{ senha: string }>(pedido)
  return senha && String(senha).trim()
    ? null
    : erro(401, 'ASSINATURA_SENHA_EXIGIDA', 'Digite a senha da sua conta para assinar.')
}

function texto(valor: unknown) {
  return typeof valor === 'string' ? valor.trim() : ''
}

/* ------------------------------------------------------------------------- atendimentos */

function registrarAtendimentos() {
  rota('GET', `${CLINICA}/atendimentos`, ({ query }) => {
    const status = query.get('status') as Atendimento['status'] | null
    const lista = itensDaLista({
      status: status && ['RASCUNHO', 'FINALIZADO', 'ANULADO'].includes(status) ? status : null,
      profissionalId: query.get('profissionalId'),
    })
    return ok<PaginaDeAtendimentos>(paginar(lista, query, 20))
  })

  rota('POST', `${CLINICA}/atendimentos`, (pedido) => {
    const corpo = corpoDe<{
      pacienteId: string
      profissionalId: string
      tipo: Atendimento['tipo']
      retificaAtendimentoId: string
    }>(pedido)
    const r = abrirAvulso(corpo.pacienteId ?? '', corpo.profissionalId ?? null, corpo.tipo ?? null)
    if (!r) return erro(404, 'PACIENTE_NAO_ENCONTRADO', 'Paciente não encontrado.')
    if (corpo.retificaAtendimentoId) r.retificaAtendimentoId = corpo.retificaAtendimentoId
    return ok<Atendimento>(atendimentoDto(r, null), 201)
  })

  rota(
    'GET',
    ATENDIMENTO,
    comAtendimento((r, { query }) =>
      ok<Atendimento>(atendimentoDto(r, query.get('dispositivoId'))),
    ),
  )

  rota(
    'PATCH',
    ATENDIMENTO,
    comAtendimento((r, pedido) => {
      const bloqueio = soRascunho(r)
      if (bloqueio) return bloqueio
      const corpo = corpoDe<{
        secao: Gravacao['secao']
        dados: Record<string, unknown>
        dispositivoId: string
        dispositivoRotulo: string
      }>(pedido)
      const dispositivoId = corpo.dispositivoId ?? ''
      if (!tomarLock(r, dispositivoId, corpo.dispositivoRotulo ?? null)) {
        const estado = estadoDaEdicao(r, dispositivoId)
        return erro(409, 'EDICAO_EM_OUTRO_DISPOSITIVO', 'O atendimento está aberto em outra aba.', {
          lock: estado.lock,
        })
      }
      if (!corpo.secao || corpo.secao === 'PRESCRICAO') {
        return erro(400, 'SECAO_INVALIDA', 'Seção inválida.')
      }
      const mudou = gravarSecao(r, corpo.secao, corpo.dados ?? {})
      const lock = estadoDaEdicao(r, dispositivoId).lock
      return ok<Gravacao>({
        id: r.id,
        secao: corpo.secao,
        versao: r.versao,
        semMudanca: !mudou,
        lock: lock ?? {
          dispositivoRotulo: null,
          profissionalNome: null,
          desde: agoraIso(),
          ate: somarMinutos(agoraIso(), 10),
        },
      })
    }),
  )

  const edicao = (forcar: boolean | 'soltar') =>
    comAtendimento((r, pedido) => {
      const { dispositivoId, dispositivoRotulo } = corpoDe<{
        dispositivoId: string
        dispositivoRotulo: string
      }>(pedido)
      if (r.status === 'RASCUNHO' && dispositivoId) {
        if (forcar === 'soltar') {
          if (r.lock?.dispositivoId === dispositivoId) r.lock = null
        } else {
          tomarLock(r, dispositivoId, dispositivoRotulo ?? null, forcar)
        }
      }
      return ok<EstadoDaEdicao>({
        id: r.id,
        versao: r.versao,
        ...estadoDaEdicao(r, dispositivoId ?? null),
      })
    })
  rota('POST', `${ATENDIMENTO}/abrir-edicao`, edicao(false))
  rota('POST', `${ATENDIMENTO}/assumir-edicao`, edicao(true))
  rota('POST', `${ATENDIMENTO}/liberar-edicao`, edicao('soltar'))

  rota(
    'POST',
    `${ATENDIMENTO}/finalizar`,
    comAtendimento((r, pedido) => {
      if (r.status === 'FINALIZADO') return ok<Atendimento>(atendimentoDto(r, null))
      const bloqueio = soRascunho(r)
      if (bloqueio) return bloqueio
      const corpo = corpoDe<{ confirmarOutroResponsavel: boolean }>(pedido)
      const faltam = faltamParaFinalizar(r)
      if (faltam.length) {
        return erro(422, 'ATENDIMENTO_INCOMPLETO', 'Falta preencher parte do atendimento.', {
          faltam,
        })
      }
      if (r.profissionalId !== MARINA && !corpo.confirmarOutroResponsavel) {
        return erro(
          409,
          'ATENDIMENTO_DE_OUTRO_PROFISSIONAL',
          'O atendimento é de outro veterinário.',
        )
      }
      finalizar(r)
      return ok<Atendimento>(atendimentoDto(r, null))
    }),
  )

  rota(
    'POST',
    `${ATENDIMENTO}/anular`,
    comAtendimento((r, pedido) => {
      if (r.status === 'ANULADO')
        return erro(409, 'ATENDIMENTO_ANULADO', 'O atendimento já foi anulado.')
      const motivo = texto(corpoDe<{ motivo: string }>(pedido).motivo)
      if (motivo.length < 5) return erro(400, 'MOTIVO_OBRIGATORIO', 'Escreva o motivo da anulação.')
      anular(r, motivo)
      return ok<Atendimento>(atendimentoDto(r, null))
    }),
  )

  rota(
    'POST',
    `${ATENDIMENTO}/descartar`,
    comAtendimento((r) => {
      const bloqueio = soRascunho(r)
      if (bloqueio) return bloqueio
      if (temConteudo(r)) {
        return erro(
          409,
          'ATENDIMENTO_COM_CONTEUDO',
          'O rascunho já tem conteúdo: anule com o motivo.',
        )
      }
      const agendamentosDevolvidos = descartar(r)
      return ok<DescarteDto>({ id: r.id, descartado: true, agendamentosDevolvidos })
    }),
  )

  rota(
    'POST',
    `${ATENDIMENTO}/adendos`,
    comAtendimento((r, pedido) => {
      if (r.status === 'RASCUNHO') {
        return erro(
          409,
          'ATENDIMENTO_EM_RASCUNHO',
          'O rascunho ainda se edita: o adendo é depois de finalizar.',
        )
      }
      const corpo = corpoDe<{ texto: string; paraOResponsavel: boolean }>(pedido)
      const conteudo = texto(corpo.texto)
      if (!conteudo) return erro(400, 'TEXTO_OBRIGATORIO', 'Escreva o adendo.')
      return ok<Adendo>(novoAdendo(r, conteudo, Boolean(corpo.paraOResponsavel)), 201)
    }),
  )

  rota(
    'GET',
    `${ATENDIMENTO}/adendos`,
    comAtendimento((r, { query }) =>
      ok<{ itens: Adendo[]; proximoCursor: string | null }>(
        paginar([...r.adendos].reverse(), query, 20),
      ),
    ),
  )

  rota(
    'POST',
    `${ATENDIMENTO}/liberar-resumo`,
    comAtendimento((r) => {
      if (r.status === 'RASCUNHO') {
        return erro(
          409,
          'ATENDIMENTO_NAO_FINALIZADO',
          'Finalize o atendimento antes de liberar o resumo.',
        )
      }
      const resumo = liberarResumo(r)
      return ok<LiberacaoDoResumo>({
        id: r.id,
        publicado: resumo.publicado,
        motivo: resumo.motivoNaoPublicado,
        liberadoEm: resumo.liberadoEm,
        consultaId: resumo.consultaId,
      })
    }),
  )

  /* O retorno marca na agenda (a área da agenda cuida dos pendentes e do desfazer). */
  rota(
    'POST',
    `${ATENDIMENTO}/retorno`,
    comAtendimento((r, pedido) => {
      const corpo = corpoDe<Parameters<typeof marcarRetorno>[1]>(pedido)
      if (!corpo.inicio && !r.conduta.retornoEmDias && !corpo.tipoId) {
        return erro(422, 'RETORNO_NAO_DEFINIDO', 'Defina o retorno na conduta antes de marcar.')
      }
      try {
        const mutacao = marcarRetorno(r.id, {
          ...corpo,
          tipoId: corpo.tipoId ?? r.conduta.retornoTipoId ?? 'demo-tipo-retorno',
          profissionalId: corpo.profissionalId ?? r.profissionalId,
        })
        r.conduta.retornoAgendamentoId = mutacao.id
        return ok<Mutacao>(mutacao, 201)
      } catch (falha) {
        if (falha instanceof ErroDaDemo)
          return erro(falha.status, falha.codigo, falha.message, falha.extra)
        throw falha
      }
    }),
  )

  rota(
    'POST',
    `${ATENDIMENTO}/atos`,
    comAtendimento((r, pedido) => {
      const bloqueio = soRascunho(r)
      if (bloqueio) return bloqueio
      const corpo = corpoDe<Parameters<typeof novoAto>[2]>(pedido)
      if (!texto(corpo.descricao)) return erro(400, 'DESCRICAO_OBRIGATORIA', 'Descreva o ato.')
      return ok<Ato>(
        novoAto(r, r.pacienteId, {
          ...corpo,
          kind: corpo.kind ?? 'PROCEDIMENTO',
          descricao: texto(corpo.descricao),
          realizadoEm: corpo.realizadoEm ?? agoraIso(),
        }),
        201,
      )
    }),
  )

  rota(
    'GET',
    `${ATENDIMENTO}/integridade`,
    comAtendimento((r) =>
      ok<IntegridadeDto>({
        id: r.id,
        confere: r.status === 'RASCUNHO' ? null : true,
        verificadoEm: agoraIso(),
      }),
    ),
  )

  /* A gravação da consulta (escuta) não entra na demonstração: nenhuma sessão. */
  rota(
    'GET',
    `${ATENDIMENTO}/escutas`,
    comAtendimento(() => ok<EscutasDoAtendimentoDto>({ itens: [] })),
  )

  rota('POST', '/parceiro/portal/atos/:id/anular', (pedido) => {
    const achado = atoPorId(pedido.params.id ?? '')
    if (!achado) return erro(404, 'ATO_NAO_ENCONTRADO', 'Ato não encontrado.')
    const motivo = texto(corpoDe<{ motivo: string }>(pedido).motivo)
    if (motivo.length < 5) return erro(400, 'MOTIVO_OBRIGATORIO', 'Escreva o motivo.')
    const { ato, registro } = achado
    if (!ato.anuladoEm) {
      ato.anuladoEm = agoraIso()
      ato.motivoAnulacao = motivo
      if (registro) {
        registro.versao += 1
        ato.versaoDoAtendimento = registro.versao
      }
    }
    return ok<Ato>(ato)
  })

  rota('POST', '/parceiro/portal/pacientes/:id/atos', (pedido) => {
    const pacienteId = pedido.params.id ?? ''
    if (!paciente(pacienteId))
      return erro(404, 'PACIENTE_NAO_ENCONTRADO', 'Paciente não encontrado.')
    const corpo = corpoDe<Parameters<typeof novoAto>[2]>(pedido)
    if (!texto(corpo.descricao)) return erro(400, 'DESCRICAO_OBRIGATORIA', 'Descreva o ato.')
    return ok<Ato>(
      novoAto(null, pacienteId, {
        ...corpo,
        kind: corpo.kind ?? 'PROCEDIMENTO',
        descricao: texto(corpo.descricao),
        realizadoEm: corpo.realizadoEm ?? agoraIso(),
        origem: corpo.origem ?? 'AVULSO',
      }),
      201,
    )
  })

  rota('GET', '/parceiro/portal/pacientes/:id/linha-do-tempo', ({ params, query }) => {
    const pacienteId = params.id ?? ''
    if (!paciente(pacienteId))
      return erro(404, 'PACIENTE_NAO_ENCONTRADO', 'Paciente não encontrado.')
    const pedidos = (query.get('tipos') ?? '')
      .split(',')
      .filter((t): t is TipoNaLinhaDoTempo => (TIPOS_DA_LINHA as string[]).includes(t))
    const todos = linhaDoTempoDoPaciente(pacienteId)
    const lista = pedidos.length ? todos.filter((item) => pedidos.includes(item.tipo)) : todos
    const pagina = paginar(lista, query, 20)
    const primeira = !query.get('cursor')
    return ok<LinhaDoTempo>({
      ...pagina,
      tipos: TIPOS_DA_LINHA,
      contagens: primeira
        ? TIPOS_DA_LINHA.map((tipo) => {
            const total = todos.filter((item) => item.tipo === tipo).length
            return { tipo, total: Math.min(total, 1000), maisDe: total > 1000 }
          })
        : null,
    })
  })
}

/* ------------------------------------------------------------------ prescrição e receita */

function gravacaoDe(
  r: RegistroDoAtendimento,
  p: Prescricao,
  avisos: GravacaoDaPrescricao['avisos'],
): GravacaoDaPrescricao {
  return { ...p, versao: r.versao, avisos }
}

function entradaDe(corpo: Record<string, unknown>, base?: Prescricao): EntradaDaPrescricao {
  const vale = <T>(chave: string, atual: T): T => (chave in corpo ? (corpo[chave] as T) : atual)
  return {
    medicamentoId: base
      ? (base.medicamentoId ?? undefined)
      : (corpo.medicamentoId as string | undefined),
    nomeLivre: base ? (base.nomeLivre ?? undefined) : (corpo.nomeLivre as string | undefined),
    via: vale('via', base?.via ?? 'ORAL'),
    mgPorKg: vale('mgPorKg', base?.mgPorKg ?? undefined),
    pesoKg: vale(
      'pesoKg',
      base?.pesoOrigem === 'INFORMADO' ? (base.pesoKg ?? undefined) : undefined,
    ),
    quantidade: vale('quantidade', base && !base.mgPorKg ? base.quantidade : undefined),
    unidade: vale('unidade', base?.unidade),
    frequenciaHoras: vale('frequenciaHoras', base?.frequenciaHoras ?? 24),
    duracaoDias: vale('duracaoDias', base?.duracaoDias ?? null),
    reavaliarEmDias: vale('reavaliarEmDias', base?.reavaliarEmDias ?? null),
    instrucoes: vale('instrucoes', base?.instrucoes ?? undefined),
    alergiaConfirmada: vale('alergiaConfirmada', base?.alergiaConfirmada),
    proibidoConfirmado: vale('proibidoConfirmado', base?.proibidoConfirmado),
    arredondamentoConfirmado: vale('arredondamentoConfirmado', base?.arredondamentoConfirmado),
    foraDaFaixaConfirmada: vale('foraDaFaixaConfirmada', base?.foraDaFaixaConfirmada),
    pesoImplausivelConfirmado: vale('pesoImplausivelConfirmado', base?.pesoImplausivelConfirmado),
    critico: vale('critico', base?.critico),
  }
}

/** A receita em rascunho perde a prescrição que saiu (e some quando fica vazia). */
function tirarDaReceita(r: RegistroDoAtendimento, prescricaoId: string) {
  for (const receita of r.receitas.filter((x) => x.status === 'RASCUNHO')) {
    const restantes = r.prescricoes.filter(
      (p) => p.receitaId === receita.id && p.id !== prescricaoId,
    )
    if (!restantes.length) {
      r.receitas = r.receitas.filter((x) => x.id !== receita.id)
      continue
    }
    Object.assign(receita, montarReceita(r, receita.id, restantes))
  }
}

function registrarReceitas() {
  rota(
    'GET',
    `${ATENDIMENTO}/prescricoes`,
    comAtendimento((r) => ok<ListaDePrescricoesDto>({ itens: r.prescricoes, versao: r.versao })),
  )

  rota(
    'POST',
    `${ATENDIMENTO}/prescricoes`,
    comAtendimento((r, pedido) => {
      const bloqueio = soRascunho(r)
      if (bloqueio) return bloqueio
      if (r.prescricoes.length >= 10) {
        return erro(409, 'PRESCRICOES_NO_LIMITE', 'O atendimento já tem 10 prescrições.')
      }
      const ordem = Math.max(0, ...r.prescricoes.map((p) => p.ordem)) + 1
      const resultado = montarPrescricao(
        r,
        `${r.id}-presc-${ordem}`,
        ordem,
        entradaDe(corpoDe(pedido)),
      )
      if (!resultado.ok) return erro(422, resultado.codigo, resultado.mensagem, resultado.detalhes)
      r.prescricoes.push(resultado.prescricao)
      r.versao += 1
      r.nuncaAberto = false
      marcarEdicao(r, 'PRESCRICAO')
      return ok<GravacaoDaPrescricao>(gravacaoDe(r, resultado.prescricao, resultado.avisos), 201)
    }),
  )

  rota(
    'PATCH',
    `${ATENDIMENTO}/prescricoes/:pid`,
    comAtendimento((r, pedido) => {
      const bloqueio = soRascunho(r)
      if (bloqueio) return bloqueio
      const atual = r.prescricoes.find((p) => p.id === pedido.params.pid)
      if (!atual) return erro(404, 'PRESCRICAO_NAO_ENCONTRADA', 'Prescrição não encontrada.')
      if (atual.receitaStatus === 'ASSINADA') {
        return erro(
          409,
          'PRESCRICAO_EM_RECEITA_ASSINADA',
          'A prescrição já está em uma receita assinada.',
        )
      }
      const resultado = montarPrescricao(
        r,
        atual.id,
        atual.ordem,
        entradaDe(corpoDe(pedido), atual),
      )
      if (!resultado.ok) return erro(422, resultado.codigo, resultado.mensagem, resultado.detalhes)
      const nova = {
        ...resultado.prescricao,
        receitaId: atual.receitaId,
        receitaStatus: atual.receitaStatus,
      }
      r.prescricoes = r.prescricoes.map((p) => (p.id === atual.id ? nova : p))
      if (atual.receitaId) {
        const receita = r.receitas.find((x) => x.id === atual.receitaId)
        if (receita)
          Object.assign(
            receita,
            montarReceita(
              r,
              receita.id,
              r.prescricoes.filter((p) => p.receitaId === receita.id),
            ),
          )
      }
      r.versao += 1
      marcarEdicao(r, 'PRESCRICAO')
      return ok<GravacaoDaPrescricao>(gravacaoDe(r, nova, resultado.avisos))
    }),
  )

  rota(
    'DELETE',
    `${ATENDIMENTO}/prescricoes/:pid`,
    comAtendimento((r, pedido) => {
      const bloqueio = soRascunho(r)
      if (bloqueio) return bloqueio
      const atual = r.prescricoes.find((p) => p.id === pedido.params.pid)
      if (!atual) return erro(404, 'PRESCRICAO_NAO_ENCONTRADA', 'Prescrição não encontrada.')
      if (atual.receitaStatus === 'ASSINADA') {
        return erro(
          409,
          'PRESCRICAO_EM_RECEITA_ASSINADA',
          'A prescrição já está em uma receita assinada.',
        )
      }
      tirarDaReceita(r, atual.id)
      r.prescricoes = r.prescricoes.filter((p) => p.id !== atual.id)
      r.versao += 1
      return ok<{ versao: number }>({ versao: r.versao })
    }),
  )

  rota(
    'GET',
    `${ATENDIMENTO}/receitas`,
    comAtendimento((r) => ok<{ itens: Receita[] }>({ itens: r.receitas })),
  )

  rota(
    'POST',
    `${ATENDIMENTO}/receitas`,
    comAtendimento((r, pedido) => {
      const bloqueio = soRascunho(r)
      if (bloqueio) return bloqueio
      const ids = corpoDe<{ prescricaoIds: string[] }>(pedido).prescricaoIds ?? []
      const escolhidas = r.prescricoes.filter((p) => ids.includes(p.id) && !p.receitaId)
      if (!escolhidas.length)
        return erro(400, 'RECEITA_SEM_PRESCRICAO', 'Escolha ao menos uma prescrição.')
      const receita = montarReceita(r, `${r.id}-rec-${r.receitas.length + 1}`, escolhidas)
      for (const p of escolhidas) {
        p.receitaId = receita.id
        p.receitaStatus = 'RASCUNHO'
      }
      r.versao += 1
      receita.versaoDoAtendimento = r.versao
      r.receitas.push(receita)
      return ok<Receita>(receita, 201)
    }),
  )

  const comReceita =
    (
      manipulador: (
        achado: NonNullable<ReturnType<typeof receitaPorId>>,
        pedido: Pedido,
      ) => Resposta,
    ) =>
    (pedido: Pedido) => {
      const achado = receitaPorId(pedido.params.id ?? '')
      return achado
        ? manipulador(achado, pedido)
        : erro(404, 'RECEITA_NAO_ENCONTRADA', 'Receita não encontrada.')
    }

  rota(
    'DELETE',
    `${CLINICA}/receitas/:id`,
    comReceita(({ receita, registro: r }) => {
      if (receita.status !== 'RASCUNHO') {
        return erro(409, 'RECEITA_JA_ASSINADA', 'Receita assinada se cancela, não se descarta.')
      }
      for (const p of r.prescricoes) {
        if (p.receitaId === receita.id) {
          p.receitaId = null
          p.receitaStatus = null
        }
      }
      r.receitas = r.receitas.filter((x) => x.id !== receita.id)
      r.versao += 1
      return ok<{ versao: number }>({ versao: r.versao })
    }),
  )

  rota(
    'POST',
    `${CLINICA}/receitas/:id/assinar`,
    comReceita(({ receita, registro: r }, pedido) => {
      if (receita.status === 'ASSINADA') return ok<Receita>(receita)
      if (receita.status === 'CANCELADA') {
        return erro(409, 'RECEITA_JA_CANCELADA', 'A receita foi cancelada.')
      }
      const falta = senhaFalta(pedido)
      if (falta) return falta
      r.versao += 1
      assinar(r, receita, MARINA, agoraIso())
      return ok<Receita>(receita)
    }),
  )

  rota(
    'GET',
    `${CLINICA}/receitas/:id/pdf`,
    comReceita(({ receita, registro: r }) => {
      if (receita.status === 'RASCUNHO') {
        return erro(409, 'RECEITA_NAO_ASSINADA', 'Assine a receita para abrir o PDF.')
      }
      if (receita.status === 'CANCELADA') {
        return ok<UrlDaReceita>({
          id: receita.id,
          url: null,
          expiraEm: null,
          cancelada: true,
          motivo: 'CANCELADA',
        })
      }
      return ok<UrlDaReceita>({
        id: receita.id,
        url: urlDoPdf(`receita:${receita.id}:${receita.emitidaEm}`, () =>
          folhaDaReceita(r, receita),
        ),
        expiraEm: QUINZE_MINUTOS(),
        cancelada: false,
        motivo: null,
      })
    }),
  )

  rota(
    'POST',
    `${CLINICA}/receitas/:id/cancelar`,
    comReceita(({ receita, registro: r }, pedido) => {
      if (receita.status === 'CANCELADA')
        return erro(409, 'RECEITA_JA_CANCELADA', 'A receita já foi cancelada.')
      if (receita.status === 'RASCUNHO') {
        return erro(409, 'RECEITA_NAO_ASSINADA', 'Receita em rascunho se descarta.')
      }
      const motivo = texto(corpoDe<{ motivo: string }>(pedido).motivo)
      if (motivo.length < 10)
        return erro(400, 'MOTIVO_OBRIGATORIO', 'Escreva o motivo do cancelamento.')
      receita.status = 'CANCELADA'
      receita.cancelamento = { em: agoraIso(), origem: 'PROFISSIONAL', motivo }
      receita.pdfDisponivel = false
      for (const p of r.prescricoes) if (p.receitaId === receita.id) p.receitaStatus = 'CANCELADA'
      esquecerPdf(`receita:${receita.id}:${receita.emitidaEm}`)
      return ok<Receita>(receita)
    }),
  )

  rota(
    'POST',
    `${CLINICA}/receitas/:id/repetir`,
    comReceita(({ receita, registro: origem }, pedido) => {
      const corpo = corpoDe<{ atendimentoId: string }>(pedido)
      const destino = registroDoAtendimento(corpo.atendimentoId ?? '')
      if (!destino) return semAtendimento()
      const bloqueio = soRascunho(destino)
      if (bloqueio) return bloqueio
      if (destino.pacienteId !== origem.pacienteId) {
        return erro(409, 'PACIENTE_DIFERENTE', 'O atendimento de destino é de outro paciente.')
      }
      const criadas: Prescricao[] = []
      const omitidos: Repeticao['omitidos'] = []
      for (const item of receita.itens) {
        const original = origem.prescricoes.find((p) => p.id === item.prescricaoId)
        if (!original) continue
        if (destino.prescricoes.length >= 10) {
          omitidos.push({
            prescricaoIdDeOrigem: original.id,
            nome: original.medicamentoNome,
            motivo: 'LIMITE_DE_PRESCRICOES',
          })
          continue
        }
        const ordem = Math.max(0, ...destino.prescricoes.map((p) => p.ordem)) + 1
        const entrada = {
          ...entradaDe({}, original),
          pesoKg: undefined,
          alergiaConfirmada: false,
          proibidoConfirmado: false,
          arredondamentoConfirmado: false,
          foraDaFaixaConfirmada: false,
        }
        const resultado = montarPrescricao(destino, `${destino.id}-presc-${ordem}`, ordem, entrada)
        if (!resultado.ok) {
          const motivo = Array.isArray(resultado.detalhes.avisos)
            ? String(resultado.detalhes.avisos[0])
            : resultado.codigo
          omitidos.push({
            prescricaoIdDeOrigem: original.id,
            nome: original.medicamentoNome,
            motivo,
          })
          continue
        }
        destino.prescricoes.push(resultado.prescricao)
        criadas.push(resultado.prescricao)
      }
      if (criadas.length) {
        destino.versao += 1
        destino.nuncaAberto = false
        marcarEdicao(destino, 'PRESCRICAO')
      }
      return ok<Repeticao>({ criadas, omitidos, versao: destino.versao })
    }),
  )
}

/* --------------------------------------------------------------------- documentos e laudos */

const TIPOS_QUE_EMITEM: Documento['tipo'][] = [
  'ATESTADO_SAUDE',
  'ATESTADO_VIAGEM',
  'COMPROVANTE_VACINACAO',
  'PEDIDO_EXAME',
  'ENCAMINHAMENTO',
  'DECLARACAO_OBITO',
  'TERMO_CONSENTIMENTO',
  'TERMO_RECUSA',
  'TERMO_EUTANASIA',
]

const OBRIGATORIOS: Partial<Record<Documento['tipo'], string[]>> = {
  ATESTADO_SAUDE: ['dataDoExame'],
  ATESTADO_VIAGEM: ['dataDoExame'],
  PEDIDO_EXAME: ['exames'],
  ENCAMINHAMENTO: ['motivo', 'solicitacao'],
  TERMO_CONSENTIMENTO: ['objeto'],
  TERMO_RECUSA: ['objeto'],
  TERMO_EUTANASIA: ['objeto'],
}

function registrarDocumentos() {
  rota('POST', `${CLINICA}/documentos`, (pedido) => {
    const corpo = corpoDe<{
      tipo: Documento['tipo']
      pacienteId: string
      atendimentoId: string
      idioma: Documento['idioma']
      conteudo: Record<string, unknown>
    }>(pedido)
    if (!corpo.tipo || !TIPOS_QUE_EMITEM.includes(corpo.tipo)) {
      return erro(422, 'DOCUMENTO_TIPO_INDISPONIVEL', 'Este tipo de documento ainda não emite.')
    }
    if (!paciente(corpo.pacienteId ?? ''))
      return erro(404, 'PACIENTE_NAO_ENCONTRADO', 'Paciente não encontrado.')
    const r = corpo.atendimentoId ? registroDoAtendimento(corpo.atendimentoId) : null
    const doc = novoDocumento(
      corpo.tipo,
      corpo.pacienteId as string,
      r?.id ?? null,
      corpo.conteudo ?? {},
      corpo.idioma ?? 'pt-BR',
    )
    if (r && r.status === 'RASCUNHO') {
      r.versao += 1
      doc.versaoDoAtendimento = r.versao
    }
    return ok<Documento>(doc, 201)
  })

  const comDocumento =
    (manipulador: (doc: Documento, pedido: Pedido) => Resposta) => (pedido: Pedido) => {
      const doc = documentoPorId(pedido.params.id ?? '')
      return doc
        ? manipulador(doc, pedido)
        : erro(404, 'DOCUMENTO_NAO_ENCONTRADO', 'Documento não encontrado.')
    }

  rota(
    'GET',
    `${CLINICA}/documentos/:id`,
    comDocumento((doc) => ok<Documento>(doc)),
  )

  rota(
    'PATCH',
    `${CLINICA}/documentos/:id`,
    comDocumento((doc, pedido) => {
      if (doc.status !== 'RASCUNHO')
        return erro(409, 'DOCUMENTO_JA_EMITIDO', 'Documento emitido não se edita.')
      const corpo = corpoDe<{ conteudo: Record<string, unknown>; idioma: Documento['idioma'] }>(
        pedido,
      )
      if (corpo.conteudo) doc.conteudo = corpo.conteudo
      if (corpo.idioma) doc.idioma = corpo.idioma
      doc.atualizadoEm = agoraIso()
      doc.resumoDoConteudo = resumoDoDocumento(doc.tipo, doc.conteudo)
      return ok<Documento>(doc)
    }),
  )

  rota(
    'DELETE',
    `${CLINICA}/documentos/:id`,
    comDocumento((doc) => {
      if (doc.status !== 'RASCUNHO')
        return erro(409, 'DOCUMENTO_JA_EMITIDO', 'Documento emitido se anula.')
      esquecerDocumento(doc.id)
      return ok<{ id: string; descartado: boolean }>({ id: doc.id, descartado: true })
    }),
  )

  rota('GET', `${CLINICA}/pacientes/:pid/documentos`, ({ params, query }) => {
    const pacienteId = params.pid ?? ''
    if (!paciente(pacienteId))
      return erro(404, 'PACIENTE_NAO_ENCONTRADO', 'Paciente não encontrado.')
    const lista = documentosDoPaciente(pacienteId, query.get('atendimentoId'))
    return ok<PaginaDeDocumentosDto>(paginar(lista, query, 20))
  })

  rota(
    'POST',
    `${CLINICA}/documentos/:id/emitir`,
    comDocumento((doc, pedido) => {
      if (doc.status === 'EMITIDO') return ok<Documento>(doc)
      if (doc.status === 'ANULADO')
        return erro(409, 'DOCUMENTO_ANULADO', 'O documento foi anulado.')
      const faltando = (OBRIGATORIOS[doc.tipo] ?? []).filter((campo) => {
        const valor = doc.conteudo[campo]
        return Array.isArray(valor) ? !valor.length : !valor
      })
      if (faltando.length) {
        return erro(422, 'DOCUMENTO_CAMPO_OBRIGATORIO', 'Preencha os campos obrigatórios.', {
          faltando,
        })
      }
      const falta = senhaFalta(pedido)
      if (falta) return falta
      const { aceitePeloApp } = corpoDe<{ aceitePeloApp: boolean }>(pedido)
      const peloApp =
        Boolean(aceitePeloApp) &&
        (doc.tipo === 'TERMO_CONSENTIMENTO' || doc.tipo === 'TERMO_RECUSA') &&
        Boolean(paciente(doc.pacienteId)?.noApp)
      emitir(doc, MARINA, agoraIso(), peloApp)
      return ok<Documento>(doc)
    }),
  )

  rota(
    'GET',
    `${CLINICA}/documentos/:id/pdf`,
    comDocumento((doc) => {
      if (doc.status === 'RASCUNHO')
        return erro(409, 'DOCUMENTO_NAO_EMITIDO', 'Emita o documento para abrir o PDF.')
      return ok<UrlDoDocumentoDto>({
        id: doc.id,
        url: urlDoPdf(`documento:${doc.id}:${doc.status}:${doc.aceiteStatus}`, () =>
          folhaDoDocumento(doc),
        ),
        expiraEm: QUINZE_MINUTOS(),
      })
    }),
  )

  rota(
    'POST',
    `${CLINICA}/documentos/:id/anular`,
    comDocumento((doc, pedido) => {
      if (doc.status !== 'EMITIDO')
        return erro(409, 'DOCUMENTO_NAO_EMITIDO', 'Só o documento emitido se anula.')
      const motivo = texto(corpoDe<{ motivo: string }>(pedido).motivo)
      if (motivo.length < 10)
        return erro(400, 'MOTIVO_OBRIGATORIO', 'Escreva o motivo da anulação.')
      doc.status = 'ANULADO'
      doc.anulacao = { em: agoraIso(), origem: 'PROFISSIONAL', motivo }
      doc.atualizadoEm = agoraIso()
      return ok<Documento>(doc)
    }),
  )

  rota(
    'POST',
    `${CLINICA}/documentos/:id/aceite-no-balcao`,
    comDocumento((doc, pedido) => {
      if (doc.status !== 'EMITIDO' || !doc.tipo.startsWith('TERMO_')) {
        return erro(409, 'ACEITE_NAO_SE_APLICA', 'Este documento não pede aceite.')
      }
      const corpo = corpoDe<{ situacao: 'ACEITO' | 'RECUSADO'; nome: string }>(pedido)
      const situacao = corpo.situacao === 'RECUSADO' ? 'RECUSADO' : 'ACEITO'
      const registradoEm = agoraIso()
      if (doc.aceiteStatus === 'PENDENTE') {
        doc.aceiteStatus = situacao
        doc.atualizadoEm = registradoEm
      }
      return ok<AceiteRegistrado>({
        documentoId: doc.id,
        situacao: doc.aceiteStatus === 'RECUSADO' ? 'RECUSADO' : 'ACEITO',
        canal: 'BALCAO',
        registradoEm,
        documentoConfere: true,
      })
    }),
  )

  /* ------------------------------------------------------------------------- laudos */

  const URL_DO_ENVIADO = new Map<string, string>()

  rota(
    'GET',
    `${ATENDIMENTO}/laudos`,
    comAtendimento((r) => ok<ListaDeLaudosDto>({ itens: r.laudos })),
  )

  rota(
    'POST',
    `${ATENDIMENTO}/laudos`,
    comAtendimento((r, pedido) => {
      if (r.status === 'ANULADO')
        return erro(409, 'ATENDIMENTO_ANULADO', 'O atendimento foi anulado.')
      const form = pedido.corpo instanceof FormData ? pedido.corpo : null
      const arquivos = (form?.getAll('file') ?? []).filter((f): f is File => typeof f !== 'string')
      if (!arquivos.length) return erro(400, 'LAUDO_SEM_ARQUIVO', 'Escolha ao menos um arquivo.')
      const tipoExameId = form?.get('tipoExameId')
      const exame = EXAMES.find((e) => e.id === tipoExameId)
      const nome = exame?.nome ?? texto(form?.get('nomeDoExame')) ?? 'Exame'
      const dataDoResultado = texto(form?.get('dataDoResultado')) || hoje()
      const tipos = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const
      for (const arquivo of arquivos) {
        const ordem = r.laudos.length + 1
        const id = `${r.id}-laudo-${ordem}`
        URL_DO_ENVIADO.set(id, urlDoArquivo(arquivo))
        r.laudos.push({
          id,
          atendimentoId: r.id,
          tipoExameId: exame?.id ?? null,
          tipoExameNome: nome || 'Exame',
          grupoExame: exame?.grupo ?? null,
          dataDoResultado,
          mimetype: tipos.find((t) => t === arquivo.type) ?? 'application/pdf',
          tamanho: arquivo.size,
          ordem,
          criadoEm: agoraIso(),
          liberadoEm: null,
          visivelAoResponsavel: false,
          removido: false,
        })
      }
      return ok<ListaDeLaudosDto>({ itens: r.laudos }, 201)
    }),
  )

  const comLaudo =
    (
      manipulador: (achado: NonNullable<ReturnType<typeof laudoPorId>>, pedido: Pedido) => Resposta,
    ) =>
    (pedido: Pedido) => {
      const achado = laudoPorId(pedido.params.lid ?? '')
      return achado
        ? manipulador(achado, pedido)
        : erro(404, 'LAUDO_NAO_ENCONTRADO', 'Laudo não encontrado.')
    }

  rota(
    'GET',
    `${CLINICA}/laudos/:lid/url`,
    comLaudo(({ laudo, registro }) =>
      ok<UrlDoLaudoDto>({
        id: laudo.id,
        url:
          URL_DO_ENVIADO.get(laudo.id) ??
          urlDoPdf(`laudo:${laudo.id}`, () => folhaDoLaudo(registro, laudo)),
        expiraEm: QUINZE_MINUTOS(),
      }),
    ),
  )

  rota(
    'POST',
    `${CLINICA}/laudos/:lid/liberar`,
    comLaudo(({ laudo }) => {
      if (!laudo.removido && !laudo.visivelAoResponsavel) {
        laudo.visivelAoResponsavel = true
        laudo.liberadoEm = agoraIso()
      }
      return ok<Laudo>(laudo)
    }),
  )

  rota(
    'POST',
    `${CLINICA}/laudos/:lid/remover`,
    comLaudo(({ laudo }, pedido) => {
      const motivo = texto(corpoDe<{ motivo: string }>(pedido).motivo)
      if (motivo.length < 10) return erro(400, 'MOTIVO_OBRIGATORIO', 'Escreva o motivo.')
      laudo.removido = true
      laudo.visivelAoResponsavel = false
      return ok<Laudo>(laudo)
    }),
  )
}

/* ------------------------------------------------------------------------------ catálogos */

type TipoDoAcrescimo = 'medicamentos' | 'vacinas' | 'exames' | 'diagnosticos'

function registrarCatalogos() {
  rota('GET', `${CLINICA}/catalogos`, () => ok<PacoteDeCatalogos>(pacoteDeCatalogos()))

  rota('GET', `${CLINICA}/catalogos/medicamentos`, ({ query }) => {
    const especie = query.get('especie') as EspecieDoCatalogo | null
    return ok<Medicamento[]>(
      buscarMedicamentos(query.get('q'), especie || null, Number(query.get('limite')) || 12),
    )
  })

  rota('GET', `${CLINICA}/catalogos/diagnosticos`, ({ query }) =>
    ok<Diagnostico[]>(buscarDiagnosticos(query.get('q'), Number(query.get('limite')) || 12)),
  )

  rota('GET', `${CLINICA}/catalogos/faixas/paciente/:pacienteId`, ({ params }) => {
    const faixas = faixasDoPaciente(params.pacienteId ?? '')
    return faixas
      ? ok<FaixasDoPaciente>(faixas)
      : erro(404, 'PACIENTE_NAO_ENCONTRADO', 'Paciente não encontrado.')
  })

  rota('GET', `${CLINICA}/catalogos/acrescimos`, () => ok<Acrescimos>(acrescimos()))

  rota('POST', `${CLINICA}/dose/calcular`, (pedido) => {
    const resultado = calcularDose(corpoDe<CalcularDoseDto>(pedido) as CalcularDoseDto)
    return resultado
      ? ok<ResultadoDaDose>(resultado)
      : erro(404, 'MEDICAMENTO_NAO_ENCONTRADO', 'Medicamento ou paciente não encontrado.')
  })

  const nova = (tipo: TipoDoAcrescimo, pedido: Pedido): Resposta => {
    const corpo = corpoDe<Record<string, unknown>>(pedido)
    const id = idDoAcrescimo(tipo)
    const comum = { id, origem: 'PARCEIRO' as const, ativo: true, traducoes: null }
    switch (tipo) {
      case 'medicamentos': {
        const c = corpo as Partial<CriarMedicamentoDto>
        const item: MedicamentoAdminDto = {
          ...comum,
          fonte: c.fonte ?? null,
          revisado: false,
          revisadoPor: null,
          revisadoEm: null,
          nome: c.nome ?? 'Medicamento',
          principioAtivo: c.principioAtivo ?? '',
          sinonimosDoPrincipio: c.sinonimosDoPrincipio ?? [],
          apresentacao: c.apresentacao ?? '',
          concentracao: c.concentracao ?? 1,
          unidadeApresentacao: c.unidadeApresentacao ?? 'COMPRIMIDO',
          classe: c.classe ?? 'OUTRA',
          controle: c.controle ?? 'NENHUM',
          listaControle: c.listaControle ?? null,
          manipulado: Boolean(c.manipulado),
          viasPermitidas: c.viasPermitidas ?? ['ORAL'],
          doseUsualMgKg: { min: c.doseUsualMgKgMin ?? 0, max: c.doseUsualMgKgMax ?? 0 },
          indicacoes: c.indicacoes ?? [],
          contraindicacoes: c.contraindicacoes ?? [],
          efeitosAdversos: c.efeitosAdversos ?? [],
          interacoes: c.interacoes ?? [],
          cuidados: c.cuidados ?? [],
          observacao: c.observacao ?? null,
          doses: (c.doses ?? []).map((d, i) => ({
            id: `${id}-dose-${i + 1}`,
            especie: d.especie,
            mgKgMin: d.mgKgMin,
            mgKgMax: d.mgKgMax,
            frequenciaHoras: d.frequenciaHoras,
            duracaoUsualDias: d.duracaoUsualDias ?? null,
            proibido: Boolean(d.proibido),
            nota: d.nota ?? null,
            traducoes: null,
          })),
        }
        MEDICAMENTOS.push(item)
        return ok(item, 201)
      }
      case 'vacinas': {
        const c = corpo as Partial<CriarVacinaDto>
        const item: VacinaAdminDto = {
          ...comum,
          fonte: c.fonte ?? null,
          revisado: false,
          revisadoPor: null,
          revisadoEm: null,
          nome: c.nome ?? 'Vacina',
          fabricante: c.fabricante ?? null,
          especies: c.especies ?? [],
          dosesSerieFilhote: c.dosesSerieFilhote ?? 1,
          dosesSerieAdultoSemHistorico: c.dosesSerieAdultoSemHistorico ?? 1,
          idadeMinimaDias: c.idadeMinimaDias ?? 0,
          essencial: Boolean(c.essencial),
          vias: c.vias ?? ['SUBCUTANEA'],
          intervaloReforcoDias: c.intervaloReforcoDias ?? 365,
          intervaloEntreDosesDias: c.intervaloEntreDosesDias ?? 21,
          obrigatoria: Boolean(c.obrigatoria),
          estoqueMinimoPadrao: c.estoqueMinimoPadrao ?? 0,
          modoSerieFilhote: c.modoSerieFilhote ?? 'FIXA',
          idadeMinimaUltimaDoseFilhoteDias: c.idadeMinimaUltimaDoseFilhoteDias ?? null,
        }
        VACINAS.push(item)
        return ok(item, 201)
      }
      case 'exames': {
        const c = corpo as Partial<CriarExameDto>
        const item: ExameAdminDto = {
          ...comum,
          nome: c.nome ?? 'Exame',
          grupo: c.grupo ?? 'OUTROS',
        }
        EXAMES.push(item)
        return ok(item, 201)
      }
      case 'diagnosticos': {
        const c = corpo as Partial<CriarDiagnosticoDto>
        if (DIAGNOSTICOS.some((d) => d.codigo.toLowerCase() === (c.codigo ?? '').toLowerCase())) {
          return erro(409, 'CODIGO_JA_USADO', 'Já existe um diagnóstico com este código.')
        }
        const item: DiagnosticoAdminDto = {
          ...comum,
          codigo: c.codigo ?? '',
          codigoExterno: c.codigoExterno ?? null,
          descricao: c.descricao ?? '',
          sistema: c.sistema ?? null,
        }
        DIAGNOSTICOS.push(item)
        return ok(item, 201)
      }
    }
  }

  const editar = (tipo: TipoDoAcrescimo, pedido: Pedido): Resposta => {
    const lista: Array<{ id: string; origem: string } & Record<string, unknown>> =
      tipo === 'medicamentos'
        ? MEDICAMENTOS
        : tipo === 'vacinas'
          ? VACINAS
          : tipo === 'exames'
            ? EXAMES
            : DIAGNOSTICOS
    const item = lista.find((x) => x.id === pedido.params.id)
    if (!item) return erro(404, 'ITEM_NAO_ENCONTRADO', 'Item não encontrado.')
    if (item.origem !== 'PARCEIRO')
      return erro(403, 'ITEM_DO_CATALOGO_GLOBAL', 'O catálogo da PetJourney não se edita.')
    const corpo = corpoDe<Record<string, unknown>>(pedido)
    for (const [chave, valor] of Object.entries(corpo)) {
      if (chave === 'doseUsualMgKgMin' || chave === 'doseUsualMgKgMax') continue
      if (chave === 'doses' && Array.isArray(valor)) {
        item.doses = (valor as Array<Record<string, unknown>>).map((d, i) => ({
          id: `${item.id}-dose-${i + 1}`,
          duracaoUsualDias: null,
          proibido: false,
          nota: null,
          traducoes: null,
          ...d,
        }))
        continue
      }
      if (chave in item) item[chave] = valor
    }
    if ('doseUsualMgKgMin' in corpo || 'doseUsualMgKgMax' in corpo) {
      const atual = (item.doseUsualMgKg ?? { min: 0, max: 0 }) as { min: number; max: number }
      item.doseUsualMgKg = {
        min: Number(corpo.doseUsualMgKgMin ?? atual.min),
        max: Number(corpo.doseUsualMgKgMax ?? atual.max),
      }
    }
    return ok(item)
  }

  for (const tipo of ['medicamentos', 'vacinas', 'exames', 'diagnosticos'] as const) {
    rota('POST', `${CLINICA}/catalogos/${tipo}`, (pedido) => nova(tipo, pedido))
    rota('PATCH', `${CLINICA}/catalogos/${tipo}/:id`, (pedido) => editar(tipo, pedido))
  }
}

/* --------------------------------------------------------------------------------- cópias */

function dentroDoPeriodo(de: string | null | undefined, ate: string | null | undefined) {
  return { de: de || null, ate: ate || null }
}

function maisCincoDiasUteis(data: string) {
  let atual = data
  let contados = 0
  while (contados < 5) {
    atual = somarDias(atual, 1)
    const semana = diaDaSemana(atual)
    if (semana !== 0 && semana !== 6) contados += 1
  }
  return atual
}

function registrarCopias() {
  const BASE = `${CLINICA}/pedidos-de-copia`
  const ABERTOS = ['ABERTO', 'PRORROGADO', 'GERANDO', 'PRONTO']

  const comPedido =
    (manipulador: (pedido: (typeof PEDIDOS_DE_COPIA)[number], requisicao: Pedido) => Resposta) =>
    (requisicao: Pedido) => {
      montarCopias()
      const achado = PEDIDOS_DE_COPIA.find((p) => p.id === requisicao.params.id)
      return achado
        ? manipulador(achado, requisicao)
        : erro(404, 'PEDIDO_NAO_ENCONTRADO', 'Pedido de cópia não encontrado.')
    }

  rota('GET', BASE, ({ query }) => {
    montarCopias()
    const abertos = query.get('situacao') !== 'ENCERRADOS'
    const lista = PEDIDOS_DE_COPIA.map(pedidoDto)
      .filter((p) => ABERTOS.includes(p.status) === abertos)
      .sort((a, b) =>
        abertos ? a.prazo.localeCompare(b.prazo) : b.recebidoEm.localeCompare(a.recebidoEm),
      )
    return ok<PaginaDePedidosDeCopiaDto>(paginar(lista, query, limiteDe(query, 30)))
  })

  rota(
    'GET',
    `${BASE}/:id`,
    comPedido((pedido) => ok<PedidoDeCopia>(pedidoDto(pedido))),
  )

  rota('POST', BASE, (requisicao) => {
    montarCopias()
    const corpo = corpoDe<{
      pacienteId: string
      solicitanteNome: string
      solicitanteDocumento: string
      de: string
      ate: string
    }>(requisicao)
    const pacienteId = corpo.pacienteId ?? ''
    if (!paciente(pacienteId))
      return erro(404, 'PACIENTE_NAO_ENCONTRADO', 'Paciente não encontrado.')
    const periodo = dentroDoPeriodo(corpo.de, corpo.ate)
    const existente = PEDIDOS_DE_COPIA.find(
      (p) =>
        p.pacienteId === pacienteId &&
        ABERTOS.includes(p.status) &&
        p.de === periodo.de &&
        p.ate === periodo.ate,
    )
    if (existente)
      return ok<PedidoDeCopiaRegistradoDto>({ pedido: pedidoDto(existente), jaExistia: true })
    const novo = pedidoDeCopia(pacienteId, {
      origem: 'BALCAO',
      solicitanteNome: texto(corpo.solicitanteNome) || null,
      recebidoEm: agoraIso(),
      ...periodo,
    })
    PEDIDOS_DE_COPIA.unshift(novo)
    return ok<PedidoDeCopiaRegistradoDto>({ pedido: pedidoDto(novo), jaExistia: false }, 201)
  })

  rota(
    'POST',
    `${BASE}/:id/prorrogar`,
    comPedido((pedido, requisicao) => {
      if (pedido.status !== 'ABERTO')
        return erro(409, 'PEDIDO_NAO_PRORROGAVEL', 'Este pedido não se prorroga mais.')
      const justificativa = texto(corpoDe<{ justificativa: string }>(requisicao).justificativa)
      if (justificativa.length < 20)
        return erro(400, 'JUSTIFICATIVA_CURTA', 'Escreva a justificativa (20 caracteres ou mais).')
      pedido.status = 'PRORROGADO'
      pedido.justificativa = justificativa
      pedido.venceEmProrrogado = maisCincoDiasUteis(pedido.venceEm)
      pedido.prazo = pedido.venceEmProrrogado
      return ok<PedidoDeCopia>(pedidoDto(pedido))
    }),
  )

  rota(
    'POST',
    `${BASE}/:id/recusar`,
    comPedido((pedido, requisicao) => {
      if (!['ABERTO', 'PRORROGADO'].includes(pedido.status)) {
        return erro(409, 'PEDIDO_ENCERRADO', 'Este pedido já não se recusa.')
      }
      const motivo = texto(corpoDe<{ motivo: string }>(requisicao).motivo)
      if (motivo.length < 20)
        return erro(400, 'MOTIVO_CURTO', 'Escreva o motivo (20 caracteres ou mais).')
      pedido.status = 'RECUSADO'
      pedido.motivoRecusa = motivo
      return ok<PedidoDeCopia>(pedidoDto(pedido))
    }),
  )

  rota(
    'POST',
    `${BASE}/:id/gerar`,
    comPedido((pedido, requisicao) => {
      if (!ABERTOS.includes(pedido.status))
        return erro(409, 'PEDIDO_ENCERRADO', 'O pedido está encerrado.')
      const corpo = corpoDe<{ de: string; ate: string }>(requisicao)
      if (corpo.de !== undefined || corpo.ate !== undefined)
        Object.assign(pedido, dentroDoPeriodo(corpo.de, corpo.ate))
      pedido.status = 'GERANDO'
      pedido.gerandoDesde = Date.now()
      pedido.pdfDisponivel = false
      esquecerPdf(`copia:${pedido.id}`)
      return ok<PedidoDeCopia>(pedidoDto(pedido), 202)
    }),
  )

  rota(
    'GET',
    `${BASE}/:id/pdf`,
    comPedido((pedido) => {
      const dto = pedidoDto(pedido)
      if (!dto.pdfDisponivel) return erro(409, 'COPIA_NAO_PRONTA', 'A cópia ainda não está pronta.')
      const foraDoPdf: UrlDaCopia['laudosForaDoPdf'] = []
      if (dto.laudosForaDoPdf) {
        const r = itensDaLista({ pacienteId: dto.pacienteId, status: 'FINALIZADO' })
          .map((i) => registroDoAtendimento(i.id))
          .find((x) => x?.laudos.length)
        const laudo = r?.laudos[0]
        if (r && laudo) {
          foraDoPdf.push({
            id: laudo.id,
            exame: laudo.tipoExameNome,
            dataDoResultado: laudo.dataDoResultado,
            url: urlDoPdf(`laudo:${laudo.id}`, () => folhaDoLaudo(r, laudo)),
          })
        }
      }
      return ok<UrlDaCopia>({
        url: urlDoPdf(`copia:${pedido.id}`, () => folhaDaCopia(dto)),
        expiraEm: QUINZE_MINUTOS(),
        laudosForaDoPdf: foraDoPdf,
      })
    }),
  )

  rota(
    'POST',
    `${BASE}/:id/entregar`,
    comPedido((pedido, requisicao) => {
      if (pedido.status !== 'PRONTO')
        return erro(409, 'COPIA_NAO_PRONTA', 'Gere a cópia antes de entregar.')
      const { canal } = corpoDe<{ canal: 'MAOS' | 'EMAIL_DO_RESPONSAVEL' }>(requisicao)
      pedido.status = 'ENTREGUE'
      pedido.entregueEm = agoraIso()
      pedido.canalDeEntrega = canal === 'EMAIL_DO_RESPONSAVEL' ? 'EMAIL_DO_RESPONSAVEL' : 'MAOS'
      return ok<PedidoDeCopia>(pedidoDto(pedido))
    }),
  )
}

/* ------------------------------------------------------------------------------- registro */

export function registrarProntuario() {
  registrarAtendimentos()
  registrarReceitas()
  registrarDocumentos()
  registrarCatalogos()
  registrarCopias()
}
