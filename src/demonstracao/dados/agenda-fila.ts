/**
 * A fila de espera da demonstração (E3-04): oito na fila (um urgente, um preferencial, dois com
 * oferta aberta, uma delas automática), duas ofertas que venceram sem resposta e as vagas soltas
 * por cancelamento, com os primeiros que cabem em cada uma.
 *
 * Se a agenda da base não deixou vagas que sirvam a alguém da fila, cancela ao carregar uns
 * horários dos próximos dias ("o responsável desmarcou pelo app"), para a gaveta de vagas não sair
 * vazia.
 */
import type {
  CandidatoDaVagaDto,
  ComprovanteDaOfertaDto,
  FaixaDeJanelasDto,
  OfertaDaFilaDto,
  PacienteDaFilaDto,
  RecusaDaOfertaDto,
} from '@/service/contrato/openapi'
import type {
  DetalheDaEntrada,
  EntradaNaFila,
  JanelaDaFila,
  NovaEntrada,
  OfertaFeita,
  PrioridadeDaFila,
  VagaDaFila,
} from '@/service/parceiro/fila-service'

import { criarSorteio } from '../aleatorio'
import { AGENDAMENTOS, type AgendamentoDaDemo } from '../base/agenda'
import { paciente, pacienteDto } from '../base/cadastro'
import { TIPOS, USUARIO_ID } from '../base/clinica'
import {
  agora,
  agoraIso,
  diaDaSemana,
  hoje,
  instante,
  minutosDe,
  somarDias,
  somarMinutos,
} from '../relogio'
import {
  conflitosDoHorario,
  definirFonteDeReservas,
  ErroDaDemo,
  exigirPacienteAtivo,
  faixaDe,
  LIBERADOS,
  minutosEmComum,
  POLITICA,
  primeiroLivre,
  RISCADOS,
} from './agenda-grade'

export type EntradaDaDemo = {
  id: string
  status: EntradaNaFila['status']
  prioridade: PrioridadeDaFila
  origem: EntradaNaFila['origem']
  pacienteId: string
  tipoId: string
  profissionalId: string | null
  janelas: JanelaDaFila[]
  observacao: string | null
  oferta: OfertaDaFilaDto | null
  ofertas: number
  agendamentoId: string | null
  aceitaPor: EntradaNaFila['aceitaPor']
  aceitaPorId: string | null
  ultimaRecusa: RecusaDaOfertaDto | null
  criadoEm: string
  comprovantes: ComprovanteDaOfertaDto[]
  /** Pediu para adiantar o horário que já tem (o `agendamentoAtual`). */
  querAntes?: boolean
}

export const FILA: EntradaDaDemo[] = []

/** As vagas que a recepção já ofertou à mão e as tentativas da oferta automática. */
const OFERTA_MANUAL = new Set<string>()
const TENTATIVAS_AUTOMATICAS = new Map<string, number>()

const chaveDaVaga = (profissionalId: string, inicio: string) => `${profissionalId}|${inicio}`

export const MENSAGEM_PADRAO_DA_OFERTA =
  'Abriu um horário que combina com os dias e horários que você deixou na fila de espera. Se puder vir, aceite pelo app antes do prazo. Se não puder, recuse: você continua na fila, no mesmo lugar.'

/* ------------------------------------------------------------------------------ leitura */

const PESO: Record<PrioridadeDaFila, number> = { URGENTE: 0, PREFERENCIAL: 1, NORMAL: 2 }

export function statusEfetivo(e: EntradaDaDemo): EntradaNaFila['status'] {
  if (e.status === 'OFERTADO' && e.oferta && Date.parse(e.oferta.expiraEm) <= agora().getTime()) {
    return 'EXPIRADO'
  }
  return e.status
}

function naOrdem(lista: readonly EntradaDaDemo[]) {
  return [...lista].sort(
    (a, b) => PESO[a.prioridade] - PESO[b.prioridade] || a.criadoEm.localeCompare(b.criadoEm),
  )
}

/** Quem aguarda, na ordem da fila. */
export function aguardandoNaOrdem() {
  return naOrdem(FILA.filter((e) => statusEfetivo(e) === 'AGUARDANDO'))
}

function pacienteDaFila(pacienteId: string): PacienteDaFilaDto {
  const p = pacienteDto(pacienteId)
  return {
    id: p.id,
    nome: p.nome,
    especie: p.especie,
    clienteId: p.cliente.id,
    clienteNome: p.cliente.nome,
    fotoUrl: p.fotoUrl,
  }
}

const ORDEM_DA_SEMANA = [1, 2, 3, 4, 5, 6, 0]

/** "seg. a sex. 14:00 a 18:00": as janelas de mesmo horário em dias seguidos viram uma faixa. */
export function agruparJanelas(janelas: readonly JanelaDaFila[]): FaixaDeJanelasDto[] {
  const porHorario = new Map<string, number[]>()
  for (const j of janelas) {
    const chave = `${j.inicio}|${j.fim}`
    porHorario.set(chave, [...(porHorario.get(chave) ?? []), j.diaSemana])
  }
  const faixas: FaixaDeJanelasDto[] = []
  for (const [chave, dias] of porHorario) {
    const [inicio = '', fim = ''] = chave.split('|')
    const posicoes = [...new Set(dias)]
      .map((d) => ORDEM_DA_SEMANA.indexOf(d))
      .filter((p) => p >= 0)
      .sort((a, b) => a - b)
    let comeco = 0
    while (comeco < posicoes.length) {
      let termino = comeco
      while (posicoes[termino + 1] === (posicoes[termino] ?? -9) + 1) termino++
      faixas.push({
        de: ORDEM_DA_SEMANA[posicoes[comeco] ?? 0] ?? 1,
        ate: ORDEM_DA_SEMANA[posicoes[termino] ?? 0] ?? 1,
        inicio,
        fim,
      })
      comeco = termino + 1
    }
  }
  return faixas.sort(
    (a, b) =>
      ORDEM_DA_SEMANA.indexOf(a.de) - ORDEM_DA_SEMANA.indexOf(b.de) ||
      a.inicio.localeCompare(b.inicio),
  )
}

/**
 * O agendamento que o paciente já tem neste serviço (o mais cedo, futuro, fora retorno). Só de quem
 * pediu para adiantar: a base dá consulta futura a quase todo paciente, e a fila inteira sairia com
 * "já tem horário".
 */
function agendamentoAtual(e: EntradaDaDemo) {
  if (!e.querAntes) return null
  if (TIPOS.find((t) => t.id === e.tipoId)?.kind === 'RETORNO') return null
  const agoraMs = agora().getTime()
  const atual = AGENDAMENTOS.find(
    (a) =>
      a.pacienteId === e.pacienteId &&
      a.tipoId === e.tipoId &&
      (a.status === 'AGENDADO' || a.status === 'CONFIRMADO') &&
      Date.parse(a.inicio) > agoraMs,
  )
  return atual ? { agendamentoId: atual.id, inicio: atual.inicio } : null
}

function cortar(texto: string | null, limite = 140) {
  if (!texto) return { texto: null, cortado: false }
  const letras = [...texto]
  return letras.length > limite
    ? { texto: `${letras.slice(0, limite).join('').trimEnd()}…`, cortado: true }
    : { texto, cortado: false }
}

export function entradaDto(e: EntradaDaDemo, inteira = false): EntradaNaFila {
  const status = statusEfetivo(e)
  const fila = aguardandoNaOrdem()
  const indice = fila.findIndex((x) => x.id === e.id)
  const observacao = inteira ? { texto: e.observacao, cortado: false } : cortar(e.observacao)
  const mensagem = e.oferta
    ? inteira
      ? { texto: e.oferta.mensagem, cortado: false }
      : cortar(e.oferta.mensagem)
    : null
  const viva = status === 'AGUARDANDO' || status === 'OFERTADO' || status === 'EXPIRADO'
  return {
    id: e.id,
    status,
    prioridade: e.prioridade,
    origem: e.origem,
    posicao: indice >= 0 ? indice + 1 : null,
    aFrente: indice >= 0 ? indice : null,
    paciente: pacienteDaFila(e.pacienteId),
    tipoId: e.tipoId,
    profissionalId: e.profissionalId,
    janelas: e.janelas.map((j) => ({ ...j })),
    janelasAgrupadas: agruparJanelas(e.janelas),
    observacao: observacao.texto,
    observacaoCortada: observacao.cortado,
    oferta:
      e.oferta && mensagem
        ? { ...e.oferta, mensagem: mensagem.texto, mensagemCortada: mensagem.cortado }
        : null,
    ofertas: e.ofertas,
    agendamentoId: e.agendamentoId,
    aceitaPor: e.aceitaPor,
    aceitaPorId: e.aceitaPorId,
    ultimaRecusa: e.ultimaRecusa,
    agendamentoAtual: viva ? agendamentoAtual(e) : null,
    criadoEm: e.criadoEm,
  }
}

export function detalheDaEntrada(e: EntradaDaDemo): DetalheDaEntrada {
  return { ...entradaDto(e, true), comprovantes: [...e.comprovantes].reverse().slice(0, 20) }
}

export function exigirEntrada(id: string) {
  const e = FILA.find((x) => x.id === id)
  if (!e) throw new ErroDaDemo(403, 'SEM_ACESSO', 'Entrada da fila não encontrada ou sem acesso.')
  return e
}

/** ATIVAS na ordem da fila; NAO_RESPONDERAM, as ofertas vencidas nos últimos 7 dias. */
export function listaDaFila(situacao: string): EntradaDaDemo[] {
  if (situacao === 'NAO_RESPONDERAM') {
    const desde = agora().getTime() - 7 * 24 * 60 * 60_000
    return FILA.filter(
      (e) => statusEfetivo(e) === 'EXPIRADO' && e.oferta && Date.parse(e.oferta.expiraEm) >= desde,
    ).sort((a, b) => (b.oferta?.expiraEm ?? '').localeCompare(a.oferta?.expiraEm ?? ''))
  }
  return naOrdem(FILA.filter((e) => ['AGUARDANDO', 'OFERTADO'].includes(statusEfetivo(e))))
}

/* ------------------------------------------------------------------------- quem cabe */

function cabeNaJanela(janelas: readonly JanelaDaFila[], inicio: string, fim: string) {
  const dia = diaDaSemana(inicio.slice(0, 10))
  const comeco = minutosDe(inicio.slice(11, 16))
  const termino = fim.slice(0, 10) === inicio.slice(0, 10) ? minutosDe(fim.slice(11, 16)) : 24 * 60
  return janelas.some(
    (j) => j.diaSemana === dia && minutosDe(j.inicio) <= comeco && termino <= minutosDe(j.fim),
  )
}

/** A entrada serve para o horário (janela, profissional, serviço cabendo até `livreAte`). */
function serve(e: EntradaDaDemo, profissionalId: string, inicio: string, livreAte: string) {
  const tipo = TIPOS.find((t) => t.id === e.tipoId)
  if (!tipo?.ativo) return false
  if (e.profissionalId && e.profissionalId !== profissionalId) return false
  const fim = somarMinutos(inicio, tipo.duracaoMinutos)
  return Date.parse(fim) <= Date.parse(livreAte) && cabeNaJanela(e.janelas, inicio, fim)
}

/** Até quando o horário fica livre: o próximo agendamento, o bloqueio ou o fim da faixa. */
function livreAteDe(profissionalId: string, inicio: string): string {
  const data = inicio.slice(0, 10)
  const faixa = faixaDe(profissionalId, data)
  let limite = faixa ? instante(data, faixa.fim) : inicio
  for (const a of AGENDAMENTOS) {
    if (a.profissionalId !== profissionalId || RISCADOS.includes(a.status)) continue
    if (a.inicio.slice(0, 10) !== data || a.inicio < inicio) continue
    if (a.inicio < limite) limite = a.inicio
  }
  return limite
}

type Liberado = {
  profissionalId: string
  inicio: string
  fim: string
  origem: VagaDaFila['origem']
  agendamentoId: string | null
}

function horariosLiberados(de: string, ate: string): Liberado[] {
  const agoraMs = agora().getTime()
  const lista: Liberado[] = []
  for (const a of AGENDAMENTOS) {
    const data = a.inicio.slice(0, 10)
    if (data < de || data > ate) continue
    if (a.status === 'CANCELADO' && Date.parse(a.inicio) > agoraMs) {
      lista.push({ ...a, origem: 'CANCELAMENTO', agendamentoId: a.id })
    } else if (a.status === 'FALTA' && Date.parse(a.fim) > agoraMs + 20 * 60_000) {
      lista.push({ ...a, inicio: agoraIso(), origem: 'FALTA', agendamentoId: a.id })
    }
  }
  for (const l of LIBERADOS) {
    const data = l.inicio.slice(0, 10)
    if (data >= de && data <= ate && Date.parse(l.inicio) > agoraMs) {
      lista.push({ ...l, origem: 'REMARCACAO' })
    }
  }
  return lista
}

function candidatoDe(e: EntradaDaDemo, posicao: number, inicio: string): CandidatoDaVagaDto {
  return {
    entradaId: e.id,
    paciente: pacienteDaFila(e.pacienteId),
    prioridade: e.prioridade,
    posicao,
    tipoId: e.tipoId,
    profissionalId: e.profissionalId,
    janelasAgrupadas: agruparJanelas(e.janelas),
    ofertas: e.ofertas,
    jaOfertadoNesteHorario: e.comprovantes.some((c) => c.inicioAvisado === inicio),
    temCanalNoApp: Boolean(paciente(e.pacienteId)?.noApp),
  }
}

/** As vagas soltas, ainda livres e no futuro, com quem cabe (padrão: hoje e mais 13 dias). */
export function vagasDaFila(de = hoje(), ate = somarDias(hoje(), 13)): VagaDaFila[] {
  const fila = aguardandoNaOrdem()
  const vistas = new Set<string>()
  const vagas: VagaDaFila[] = []

  for (const liberado of horariosLiberados(de, ate)) {
    const chave = chaveDaVaga(liberado.profissionalId, liberado.inicio)
    if (vistas.has(chave)) continue
    vistas.add(chave)
    const ocupado = conflitosDoHorario(
      { pacienteId: '', ...liberado, salaIds: [] },
      { ignorar: new Set(liberado.agendamentoId ? [liberado.agendamentoId] : []) },
    ).some((c) => c.kind === 'professional-overlap' || c.kind === 'block-invasion')
    if (ocupado) continue

    const livreAte = livreAteDe(liberado.profissionalId, liberado.inicio)
    const cabem = fila
      .map((e, i) => ({ e, posicao: i + 1 }))
      .filter(({ e }) => serve(e, liberado.profissionalId, liberado.inicio, livreAte))
      .map(({ e, posicao }) => candidatoDe(e, posicao, liberado.inicio))
      .sort((a, b) => Number(a.jaOfertadoNesteHorario) - Number(b.jaOfertadoNesteHorario))
    if (!cabem.length) continue

    vagas.push({
      id: `demo-vaga-${liberado.agendamentoId ?? chave}`,
      profissionalId: liberado.profissionalId,
      inicio: liberado.inicio,
      fim: liberado.fim,
      origem: liberado.origem,
      agendamentoId: liberado.agendamentoId,
      livreAte,
      candidatos: cabem.slice(0, 3),
      totalCandidatos: cabem.length,
      ofertasAbertas: FILA.filter(
        (e) =>
          statusEfetivo(e) === 'OFERTADO' &&
          e.oferta?.inicio === liberado.inicio &&
          e.oferta.profissionalId === liberado.profissionalId,
      ).length,
      tentativasAutomaticas: TENTATIVAS_AUTOMATICAS.get(chave) ?? 0,
      ofertaManual: OFERTA_MANUAL.has(chave),
    })
  }

  return vagas.sort((a, b) => a.inicio.localeCompare(b.inicio)).slice(0, 50)
}

/* ------------------------------------------------------------------------------ escrita */

let sequencia = 0
let sequenciaDoComprovante = 0

function novaEntrada(dados: Partial<EntradaDaDemo> & Pick<EntradaDaDemo, 'pacienteId' | 'tipoId'>) {
  const e: EntradaDaDemo = {
    id: `demo-fila-${String(++sequencia).padStart(3, '0')}`,
    status: 'AGUARDANDO',
    prioridade: 'NORMAL',
    origem: 'RECEPCAO',
    profissionalId: null,
    janelas: [],
    observacao: null,
    oferta: null,
    ofertas: 0,
    agendamentoId: null,
    aceitaPor: null,
    aceitaPorId: null,
    ultimaRecusa: null,
    criadoEm: agoraIso(),
    comprovantes: [],
    ...dados,
  }
  FILA.push(e)
  return e
}

export function entrarNaFila(corpo: Partial<NovaEntrada>): EntradaDaDemo {
  const pacienteId = corpo.pacienteId ?? ''
  const tipoId = corpo.tipoId ?? ''
  exigirPacienteAtivo(pacienteId)
  const tipo = TIPOS.find((t) => t.id === tipoId)
  if (!tipo?.ativo) throw new ErroDaDemo(409, 'TIPO_INATIVO', 'O serviço está desativado.')
  const janelas = corpo.janelas ?? []
  if (!janelas.length || janelas.length > 14) {
    throw new ErroDaDemo(400, 'FILA_INVALIDA', 'Diga de 1 a 14 janelas.', { reason: 'JANELAS' })
  }
  if (janelas.some((j) => minutosDe(j.fim) <= minutosDe(j.inicio))) {
    throw new ErroDaDemo(400, 'FILA_INVALIDA', 'A janela termina antes de começar.', {
      reason: 'JANELA_INVERTIDA',
    })
  }
  const viva = FILA.find(
    (e) =>
      e.pacienteId === pacienteId &&
      e.tipoId === tipoId &&
      ['AGUARDANDO', 'OFERTADO', 'EXPIRADO'].includes(statusEfetivo(e)),
  )
  if (viva) {
    throw new ErroDaDemo(409, 'FILA_JA_NA_FILA', 'Este paciente já espera por este serviço.', {
      entradaId: viva.id,
    })
  }
  return novaEntrada({
    pacienteId,
    tipoId,
    profissionalId: corpo.profissionalId ?? null,
    prioridade: corpo.prioridade ?? 'NORMAL',
    janelas: janelas.map((j) => ({ ...j })),
    observacao: corpo.observacao?.trim() || null,
  })
}

function comprovanteDaOferta(
  e: EntradaDaDemo,
  oferta: OfertaDaFilaDto,
  situacao: ComprovanteDaOfertaDto['situacao'],
): ComprovanteDaOfertaDto {
  const comApp = Boolean(paciente(e.pacienteId)?.noApp)
  return {
    id: `demo-comprovante-fila-${++sequenciaDoComprovante}`,
    situacao: comApp ? situacao : 'NAO_ENVIADO',
    canal: comApp ? 'PUSH_INBOX' : 'NENHUM',
    motivoSemAviso: comApp ? null : 'SEM_CANAL_NO_APP',
    mensagemDaClinica: oferta.mensagem,
    inicioAvisado: oferta.inicio,
    destinatarios: comApp ? 1 : 0,
    criadoEm: oferta.ofertadaEm,
    processadoEm: situacao === 'PENDENTE' && comApp ? null : somarMinutos(oferta.ofertadaEm, 1),
  }
}

/** Abre a oferta (sem conferir: quem chama já conferiu), com o comprovante do aviso. */
function abrirOferta(
  e: EntradaDaDemo,
  dados: {
    inicio: string
    profissionalId: string
    mensagem: string | null
    ofertadaEm: string
    automatica: boolean
    situacaoDoAviso: ComprovanteDaOfertaDto['situacao']
  },
) {
  const tipo = TIPOS.find((t) => t.id === e.tipoId)
  const prazo = somarMinutos(dados.ofertadaEm, POLITICA.ofertaDeVagaMinutos)
  const oferta: OfertaDaFilaDto = {
    inicio: dados.inicio,
    fim: somarMinutos(dados.inicio, tipo?.duracaoMinutos ?? 30),
    profissionalId: dados.profissionalId,
    expiraEm: Date.parse(prazo) < Date.parse(dados.inicio) ? prazo : dados.inicio,
    mensagem: dados.mensagem,
    mensagemCortada: false,
    ofertadaEm: dados.ofertadaEm,
    automatica: dados.automatica,
    ofertadaPorId: dados.automatica ? null : USUARIO_ID,
    aviso: null,
  }
  const comprovante = comprovanteDaOferta(e, oferta, dados.situacaoDoAviso)
  oferta.aviso = {
    id: comprovante.id,
    situacao: comprovante.situacao,
    canal: comprovante.canal,
    motivoSemAviso: comprovante.motivoSemAviso,
    processadoEm: comprovante.processadoEm,
  }
  e.oferta = oferta
  e.status = 'OFERTADO'
  e.ofertas += 1
  e.comprovantes.push(comprovante)
  const chave = chaveDaVaga(dados.profissionalId, dados.inicio)
  if (dados.automatica)
    TENTATIVAS_AUTOMATICAS.set(chave, (TENTATIVAS_AUTOMATICAS.get(chave) ?? 0) + 1)
  else OFERTA_MANUAL.add(chave)
}

export function ofertar(
  e: EntradaDaDemo,
  corpo: { inicio?: string; profissionalId?: string; mensagem?: string },
): OfertaFeita {
  const status = statusEfetivo(e)
  if (status === 'ACEITO' || status === 'REMOVIDO') {
    throw new ErroDaDemo(409, 'FILA_ENCERRADA', 'Esta entrada já saiu da fila.')
  }
  if (status === 'OFERTADO' && e.oferta) {
    throw new ErroDaDemo(409, 'OFERTA_JA_ABERTA', 'Já há uma oferta aberta para esta entrada.', {
      ofertaExpiraEm: e.oferta.expiraEm,
    })
  }
  const inicio = corpo.inicio ?? ''
  const profissionalId = corpo.profissionalId ?? ''
  if (!inicio || Date.parse(inicio) <= agora().getTime()) {
    throw new ErroDaDemo(400, 'FILA_INVALIDA', 'O horário já passou.', {
      reason: 'INICIO_NO_PASSADO',
    })
  }
  const tipo = TIPOS.find((t) => t.id === e.tipoId)
  const fim = somarMinutos(inicio, tipo?.duracaoMinutos ?? 30)
  const conflitos = conflitosDoHorario({
    pacienteId: e.pacienteId,
    profissionalId,
    inicio,
    fim,
    salaIds: [],
  })
  if (conflitos.some((c) => c.kind === 'professional-overlap')) {
    throw new ErroDaDemo(
      409,
      'VAGA_JA_PREENCHIDA',
      'O profissional já tem atendimento neste horário.',
      {
        reason: 'PREENCHIDA',
      },
    )
  }
  if (conflitos.some((c) => c.severity === 'blocking')) {
    throw new ErroDaDemo(409, 'CONFLITO_BLOQUEANTE', 'A clínica está fechada neste dia.', {
      conflitos: conflitos.filter((c) => c.severity === 'blocking'),
    })
  }
  abrirOferta(e, {
    inicio,
    profissionalId,
    mensagem: corpo.mensagem?.trim() || null,
    ofertadaEm: agoraIso(),
    automatica: false,
    situacaoDoAviso: 'PENDENTE',
  })
  return {
    entrada: entradaDto(e),
    aviso: {
      id: e.oferta?.aviso?.id ?? '',
      situacao: 'PENDENTE',
      liberarEm: somarMinutos(agoraIso(), 1),
      semCanalNoApp: !paciente(e.pacienteId)?.noApp,
    },
    conflitos: conflitos.filter((c) => c.kind !== 'pedido-pendente'),
  }
}

/** O "não" do telefone: volta a aguardar com a mesma vez. */
export function recusarOferta(e: EntradaDaDemo) {
  const status = statusEfetivo(e)
  if (status !== 'OFERTADO' && status !== 'EXPIRADO') {
    throw new ErroDaDemo(410, 'OFERTA_EXPIRADA', 'Não há oferta aberta para esta entrada.')
  }
  e.status = 'AGUARDANDO'
  e.oferta = null
  e.ultimaRecusa = { em: agoraIso(), por: 'RECEPCAO', porId: USUARIO_ID }
  return e
}

/** Tira da fila (e a oferta aberta junto). Aceita: 409. */
export function removerDaFila(e: EntradaDaDemo) {
  if (e.status === 'ACEITO') {
    throw new ErroDaDemo(409, 'FILA_ENCERRADA', 'Esta entrada já virou agendamento.')
  }
  e.status = 'REMOVIDO'
  e.oferta = null
}

/* -------------------------------------------------------------------- as reservas da fila */

definirFonteDeReservas(() =>
  FILA.filter((e) => statusEfetivo(e) === 'OFERTADO' && e.oferta).map((e) => ({
    id: `demo-reserva-${e.id}`,
    profissionalId: e.oferta?.profissionalId ?? '',
    inicio: e.oferta?.inicio ?? '',
    fim: e.oferta?.fim ?? '',
    expiraEm: e.oferta?.expiraEm ?? '',
    donoTipo: 'FILA' as const,
  })),
)

/* ------------------------------------------------------------------------- a fila de hoje */

const SEG_A_SEX = [1, 2, 3, 4, 5]

/** Os pets dos pedidos que esperam resposta (`agenda-pedidos.ts`): não entram também na fila. */
const PETS_DOS_PEDIDOS = [
  'demo-pac-001-2',
  'demo-pac-002-2',
  'demo-pac-018',
  'demo-pac-023',
  'demo-pac-023-2',
  'demo-pac-032',
  'demo-pac-037',
  'demo-pac-043',
]

function janelas(dias: readonly number[], inicio: string, fim: string): JanelaDaFila[] {
  return dias.map((diaSemana) => ({ diaSemana, inicio, fim }))
}

function haDias(dias: number, hora: string) {
  return instante(somarDias(hoje(), -dias), hora)
}

const DIAS_DA_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

function quandoNaMensagem(iso: string) {
  const data = iso.slice(0, 10)
  const dia =
    data === hoje()
      ? 'hoje'
      : data === somarDias(hoje(), 1)
        ? 'amanhã'
        : `${DIAS_DA_SEMANA[diaDaSemana(data)]}, ${data.slice(8, 10)}/${data.slice(5, 7)}`
  return `${dia} às ${iso.slice(11, 16)}`
}

function montar() {
  const sorte = criarSorteio('agenda-fila')
  const amanha = somarDias(hoje(), 1)

  novaEntrada({
    pacienteId: 'demo-pac-019-2',
    tipoId: 'demo-tipo-consulta',
    profissionalId: 'demo-prof-marina',
    prioridade: 'URGENTE',
    janelas: janelas(SEG_A_SEX, '08:00', '12:00'),
    observacao:
      'Tosse seca há cinco dias, piora à noite. A Vanessa trabalha perto e consegue vir em meia hora: pode ligar a qualquer momento da manhã.',
    criadoEm: haDias(0, '08:20'),
  })
  novaEntrada({
    pacienteId: 'demo-pac-015-2',
    tipoId: 'demo-tipo-exame',
    prioridade: 'PREFERENCIAL',
    janelas: janelas([1, 3, 5], '08:00', '10:30'),
    observacao:
      'Gata idosa, coleta de sangue em jejum para o controle da tireoide: só no começo da manhã.',
    criadoEm: haDias(2, '16:45'),
  })
  const cacau = novaEntrada({
    pacienteId: 'demo-pac-007',
    tipoId: 'demo-tipo-consulta',
    janelas: janelas(SEG_A_SEX, '13:00', '18:00'),
    observacao: 'Hérnia de disco: reavaliar a dor nas costas antes do fim do mês. Prefere a tarde.',
    origem: 'APP',
    criadoEm: haDias(6, '19:12'),
  })
  const sol = novaEntrada({
    pacienteId: 'demo-pac-011-2',
    tipoId: 'demo-tipo-vacina',
    profissionalId: 'demo-prof-camila',
    janelas: janelas([2, 3, 4, 5, 6], '08:00', '12:00'),
    observacao:
      'Reforço da quádrupla felina atrasado. Gato bravo: a Beatriz traz na caixa de transporte.',
    criadoEm: haDias(4, '10:30'),
  })
  novaEntrada({
    pacienteId: 'demo-pac-033-2',
    tipoId: 'demo-tipo-consulta',
    profissionalId: 'demo-prof-camila',
    janelas: janelas([6], '08:00', '12:00'),
    observacao: 'Só consegue vir aos sábados.',
    ofertas: 1,
    ultimaRecusa: { em: haDias(3, '15:12'), por: 'APP', porId: null },
    criadoEm: haDias(12, '11:40'),
  })
  novaEntrada({
    pacienteId: 'demo-pac-044',
    tipoId: 'demo-tipo-consulta',
    origem: 'APP',
    janelas: [...janelas(SEG_A_SEX, '08:00', '19:00'), ...janelas([6], '08:00', '13:00')],
    criadoEm: haDias(1, '21:03'),
  })

  /* Dois que já têm consulta marcada e querem antes: a fila oferta só horário mais cedo. */
  const usados = new Set([...FILA.map((e) => e.pacienteId), ...PETS_DOS_PEDIDOS])
  const agoraMs = agora().getTime()
  const primeiraConsulta = new Map<string, AgendamentoDaDemo>()
  for (const a of AGENDAMENTOS) {
    const viva = a.status === 'AGENDADO' || a.status === 'CONFIRMADO'
    if (a.tipoId !== 'demo-tipo-consulta' || !viva || Date.parse(a.inicio) <= agoraMs) continue
    if (!primeiraConsulta.has(a.pacienteId)) primeiraConsulta.set(a.pacienteId, a)
  }
  const dia = 24 * 60 * 60_000
  const veioHoje = (pacienteId: string) =>
    AGENDAMENTOS.some((o) => o.pacienteId === pacienteId && o.inicio.startsWith(hoje()))
  const querAntes = [...primeiraConsulta.values()]
    .filter(
      (a) => Date.parse(a.inicio) > agoraMs + 9 * dia && Date.parse(a.inicio) < agoraMs + 26 * dia,
    )
    .sort((a, b) => Number(veioHoje(a.pacienteId)) - Number(veioHoje(b.pacienteId)))
  const textos = [
    'Tem consulta marcada para daqui a duas semanas, mas o responsável pediu para avisar se abrir antes.',
    'Quer adiantar a consulta: viaja no fim do mês e prefere resolver antes.',
  ]
  for (const texto of textos) {
    const a = querAntes.find((x) => !usados.has(x.pacienteId))
    if (!a) break
    usados.add(a.pacienteId)
    novaEntrada({
      pacienteId: a.pacienteId,
      tipoId: a.tipoId,
      profissionalId: a.profissionalId,
      janelas: janelas(SEG_A_SEX, '08:00', '18:00'),
      observacao: texto,
      querAntes: true,
      criadoEm: haDias(
        sorte.inteiro(3, 9),
        `${sorte.inteiro(9, 17)}:${sorte.escolher(['05', '20', '35', '50'])}`,
      ),
    })
  }

  /* As ofertas que venceram sem resposta (a aba "não responderam"). */
  const vencidas: Array<[string, string, number, string]> = [
    ['demo-pac-034', 'demo-tipo-exame', 2, 'demo-prof-rafael'],
    ['demo-pac-040', 'demo-tipo-vacina', 1, 'demo-prof-marina'],
  ]
  for (const [pacienteId, tipoId, dias, profissionalId] of vencidas) {
    const e = novaEntrada({
      pacienteId,
      tipoId,
      janelas: janelas(SEG_A_SEX, '09:00', '17:00'),
      criadoEm: haDias(dias + 8, '14:10'),
    })
    abrirOferta(e, {
      inicio: haDias(dias - 1, '15:30'),
      profissionalId,
      mensagem: MENSAGEM_PADRAO_DA_OFERTA,
      ofertadaEm: haDias(dias, '10:05'),
      automatica: true,
      situacaoDoAviso: 'ENVIADO',
    })
    e.status = 'EXPIRADO'
  }

  garantirVagas()

  /* A oferta automática: a primeira vaga em que a Cacau cabe (ou um horário livre que sirva). */
  const vaga = vagasDaFila().find((v) => v.candidatos.some((c) => c.entradaId === cacau.id))
  const paraCacau =
    vaga ??
    primeiroLivre({
      tipoId: cacau.tipoId,
      pacienteId: cacau.pacienteId,
      aPartirDe: amanha,
      aceita: (inicio) => cabeNaJanela(cacau.janelas, inicio, somarMinutos(inicio, 30)),
    })
  if (paraCacau) {
    abrirOferta(cacau, {
      inicio: paraCacau.inicio,
      profissionalId: paraCacau.profissionalId,
      mensagem: MENSAGEM_PADRAO_DA_OFERTA,
      ofertadaEm: somarMinutos(agoraIso(), -18),
      automatica: true,
      situacaoDoAviso: 'ENVIADO',
    })
  }

  /* A oferta da recepção, à mão. */
  const paraSol = primeiroLivre({
    tipoId: sol.tipoId,
    pacienteId: sol.pacienteId,
    profissionalIds: ['demo-prof-camila'],
    aPartirDe: hoje(),
    aceita: (inicio) => cabeNaJanela(sol.janelas, inicio, somarMinutos(inicio, 15)),
  })
  if (paraSol) {
    const ofertadaEm = somarMinutos(agoraIso(), -34)
    const prazo = somarMinutos(ofertadaEm, POLITICA.ofertaDeVagaMinutos)
    abrirOferta(sol, {
      inicio: paraSol.inicio,
      profissionalId: paraSol.profissionalId,
      mensagem: `Oi, Beatriz! Abriu um horário para a vacina do Sol com a Dra. Camila ${quandoNaMensagem(paraSol.inicio)}. Se puder vir, aceite pelo app até as ${prazo.slice(11, 16)}. Se não der, tudo bem: ele continua na fila, no mesmo lugar.`,
      ofertadaEm,
      automatica: false,
      situacaoDoAviso: 'ENVIADO',
    })
    const oferta = sol.oferta
    if (oferta) oferta.ofertadaPorId = 'demo-usr-juliana'
  }
}

/**
 * Garante umas vagas para a gaveta: cancela horários dos próximos dias em que alguém da fila
 * cabe, como se o responsável tivesse desmarcado pelo app.
 */
function garantirVagas() {
  const agoraMs = agora().getTime()
  const desde = agoraMs + 20 * 60 * 60_000
  const ate = agoraMs + 10 * 24 * 60 * 60_000
  const candidatos = AGENDAMENTOS.filter(
    (a) =>
      (a.status === 'AGENDADO' || a.status === 'CONFIRMADO') &&
      !a.grupoId &&
      !a.pedidoId &&
      Date.parse(a.inicio) > desde &&
      Date.parse(a.inicio) < ate,
  )
  for (const a of candidatos) {
    if (vagasDaFila().length >= 4) return
    const fila = aguardandoNaOrdem()
    const livreAte = a.fim
    if (
      !fila.some(
        (e) => e.pacienteId !== a.pacienteId && serve(e, a.profissionalId, a.inicio, livreAte),
      )
    ) {
      continue
    }
    cancelarPeloApp(a)
  }
}

function cancelarPeloApp(a: AgendamentoDaDemo) {
  a.status = 'CANCELADO'
  a.canceladoEm = somarMinutos(agoraIso(), -((a.versao * 97) % 600) - 30)
  a.motivoCancelamento = 'RESPONSAVEL_DESMARCOU'
  a.canceladoPor = 'APP'
  a.confirmadoEm = null
  a.confirmadoPor = null
}

montar()

/* -------------------------------------------------------------------------- o aceite */

export function exigirOfertaAberta(e: EntradaDaDemo) {
  const status = statusEfetivo(e)
  if (status === 'EXPIRADO') {
    throw new ErroDaDemo(410, 'OFERTA_EXPIRADA', 'A oferta venceu.')
  }
  if (status !== 'OFERTADO' || !e.oferta) {
    throw new ErroDaDemo(409, 'FILA_ENCERRADA', 'Não há oferta aberta para esta entrada.')
  }
  const oferta = e.oferta
  const ocupado = AGENDAMENTOS.some(
    (a) =>
      a.profissionalId === oferta.profissionalId &&
      !RISCADOS.includes(a.status) &&
      minutosEmComum(a.inicio, a.fim, oferta.inicio, oferta.fim) > 0 &&
      a.id !== agendamentoAtual(e)?.agendamentoId,
  )
  if (ocupado) {
    e.status = 'AGUARDANDO'
    e.oferta = null
    throw new ErroDaDemo(409, 'VAGA_JA_PREENCHIDA', 'O horário já foi ocupado.', {
      reason: 'PREENCHIDA',
    })
  }
  return { oferta, atual: agendamentoAtual(e) }
}

/** Depois do sim: a entrada aceita, com o agendamento que nasceu ou mudou. */
export function marcarAceite(e: EntradaDaDemo, agendamentoId: string) {
  e.status = 'ACEITO'
  e.agendamentoId = agendamentoId
  e.aceitaPor = 'RECEPCAO'
  e.aceitaPorId = USUARIO_ID
}

/* ------------------------------------------------------------------------- consultas */

export function contagemDaFila() {
  const vivas = FILA.map(statusEfetivo)
  return {
    aguardando: vivas.filter((s) => s === 'AGUARDANDO').length,
    comOferta: vivas.filter((s) => s === 'OFERTADO').length,
    naoResponderam: listaDaFila('NAO_RESPONDERAM').length,
    vagas: vagasDaFila().length,
  }
}

export function filaDoPaciente(pacienteId: string) {
  return FILA.filter((e) => e.pacienteId === pacienteId).map((e) => entradaDto(e))
}
