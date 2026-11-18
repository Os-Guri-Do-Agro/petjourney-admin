/**
 * Vacinas da demonstração: as aplicações de cada pet, os lotes da geladeira e as baixas.
 *
 * De onde vem cada coisa:
 * - o catálogo é o do prontuário (`prontuario-catalogos.ts`, o mesmo que a rota do pacote de
 *   catálogos devolve): V10, antirrábica, tosse dos canis, giárdia, leishmaniose, V4 e V5 felinas;
 * - as aplicações dos últimos 90 dias saem dos agendamentos de Vacinação FINALIZADOS da agenda
 *   (`demo-tipo-vacina`), com o profissional e a hora do agendamento; antes disso, o histórico de
 *   cada pet é montado para trás (reforço anual, série de filhote, dose de outro lugar);
 * - a espécie manda: vacina felina só em gato, leishmaniose e giárdia só em cão, o furão só a
 *   antirrábica; porquinho-da-índia, jabuti, calopsita, coelho e hamster não têm vacina no
 *   catálogo (plano vazio);
 * - cada dose dos últimos 90 dias baixou de um lote do estoque (implantado há 95 dias); as mais
 *   antigas levam só o lote digitado;
 * - a lista de chamada e o plano saem da data da última dose de cada vacina.
 *
 * O que este arquivo exporta (para as agregadoras e a linha do tempo):
 * - `APLICACOES`, `LOTES`, `BAIXAS`: as coleções em memória (as escritas mexem nelas);
 * - `vacinasDoCatalogo()`, `vacinaDoCatalogoPorId(id)` e os ids (`V10`, `RAIVA`, `TOSSE`...);
 * - `chamadaDeVacinas()`: a lista de chamada inteira (`ChamadaDto[]`), do mais atrasado ao menos;
 * - `contagensDaChamada()`: quantos avisar (itens, pets, vencidas, série aberta, a vencer, sem app);
 * - `aplicacoesDoPaciente(id)`: o histórico do pet (`AplicacaoDeVacinaDto[]`, anuladas inclusive),
 *   para a linha do tempo;
 * - `aplicacoesEntre(de, ate)`: as doses aplicadas aqui num período (registros internos), para o
 *   Meu dia e as atividades (`agendamentoId` liga a dose ao agendamento);
 * - `planoDoPaciente(id)`, `historicoDoPaciente(id)`, `aplicadasEntre`, `lotesParaAplicar`:
 *   as respostas das rotas.
 */
import type { Vacina } from '@/service/parceiro/catalogos-service'
import type { Baixa, LoteDoEstoque, MotivoDaBaixa } from '@/service/parceiro/estoque-service'
import type { LembreteDaVacina } from '@/service/parceiro/lembrete-de-vacina-service'
import type {
  Aplicacao,
  Chamada,
  DoseNoPlano,
  HistoricoDeVacinas,
  LotesParaAplicar,
  PaginaDeAplicadas,
  PlanoVacinal,
  VacinaNoPlano,
} from '@/service/parceiro/vacinacao-service'

import { criarSorteio, idDe } from '../aleatorio'
import { agendamento, AGENDAMENTOS, DIAS_PARA_TRAS, type AgendamentoDaDemo } from '../base/agenda'
import { paciente, PACIENTES, pacienteResumo, type PacienteDaDemo } from '../base/cadastro'
import { EXPEDIENTE_DOS_PROFISSIONAIS, profissional, PROFISSIONAIS } from '../base/clinica'
import {
  agora,
  agoraIso,
  diaDaSemana,
  diasEntre,
  hoje,
  instante,
  somarDias,
  somarMinutos,
} from '../relogio'
import { VACINAS } from './prontuario-catalogos'

type Especie = Vacina['especies'][number]
export type Via = NonNullable<Aplicacao['via']>
type TipoDeSerie = Aplicacao['tipoDeSerie']

/* ---------------------------------------------------------------------------- o catálogo */

export const V10 = 'demo-vac-v10'
export const RAIVA = 'demo-vac-antirrabica'
export const TOSSE = 'demo-vac-tosse'
export const GIARDIA = 'demo-vac-giardia'
export const LEISH = 'demo-vac-leish'
export const V4 = 'demo-vac-v4-felina'
export const V5 = 'demo-vac-v5-felina'

/**
 * A reserva das vacinas que esta área usa, igual ao catálogo do prontuário: se uma sumir de lá,
 * a demonstração continua carregando.
 */
function reserva(
  id: string,
  nome: string,
  especies: Especie[],
  serie: Pick<
    Vacina,
    'dosesSerieFilhote' | 'dosesSerieAdultoSemHistorico' | 'idadeMinimaDias' | 'estoqueMinimoPadrao'
  >,
  vias: Via[],
): Vacina {
  return {
    fonte: 'Diretrizes WSAVA de vacinação de cães e gatos (2024)',
    revisado: true,
    revisadoPor: 'CRMV-SP 18802',
    revisadoEm: '2026-02-03T10:00:00-03:00',
    id,
    origem: 'GLOBAL',
    nome,
    fabricante: null,
    especies,
    ...serie,
    essencial: id === V10 || id === RAIVA || id === V4 || id === V5,
    vias,
    intervaloReforcoDias: 365,
    intervaloEntreDosesDias: 21,
    obrigatoria: id === RAIVA,
    modoSerieFilhote: 'FIXA',
    idadeMinimaUltimaDoseFilhoteDias: null,
    ativo: true,
  }
}

const SC: Via[] = ['SUBCUTANEA']
const serie = (filhote: number, adulto: number, idade: number, minimo: number) => ({
  dosesSerieFilhote: filhote,
  dosesSerieAdultoSemHistorico: adulto,
  idadeMinimaDias: idade,
  estoqueMinimoPadrao: minimo,
})

const RESERVA: Vacina[] = [
  reserva(V10, 'V10 (polivalente canina)', ['CACHORRO'], serie(3, 2, 42, 10), SC),
  reserva(RAIVA, 'Antirrábica', ['CACHORRO', 'GATO', 'OUTRO'], serie(1, 1, 84, 12), [
    'SUBCUTANEA',
    'INTRAMUSCULAR',
  ]),
  reserva(TOSSE, 'Tosse dos canis', ['CACHORRO'], serie(1, 1, 56, 6), ['INTRANASAL']),
  reserva(GIARDIA, 'Giárdia', ['CACHORRO'], serie(2, 2, 56, 4), SC),
  reserva(LEISH, 'Leishmaniose visceral canina', ['CACHORRO'], serie(3, 3, 120, 3), SC),
  reserva(V5, 'V5 felina (quíntupla)', ['GATO'], serie(3, 2, 56, 8), SC),
  reserva(V4, 'V4 felina (quádrupla)', ['GATO'], serie(3, 2, 56, 6), SC),
]

function semTraducoes(v: (typeof VACINAS)[number]): Vacina {
  const { traducoes: _traducoes, ...resto } = v
  return resto
}

/** As vacinas ativas do catálogo (as do prontuário, inclusive as que a clínica acrescentar). */
export function vacinasDoCatalogo(): Vacina[] {
  const lista = VACINAS.filter((v) => v.ativo).map(semTraducoes)
  for (const v of RESERVA) if (!lista.some((x) => x.id === v.id)) lista.push(v)
  return lista
}

/** Polivalentes felinas que se substituem: quem toma uma não "deixou de iniciar" a outra. */
const EQUIVALENTES = [[V4, V5]]

const PREFIXO_DO_LOTE: Record<string, string> = {
  [V10]: 'VPL',
  [RAIVA]: 'RAB',
  [TOSSE]: 'BRC',
  [GIARDIA]: 'GIA',
  [LEISH]: 'LTC',
  [V4]: 'FEL',
  [V5]: 'PRF',
}

export function vacinaDoCatalogoPorId(id: string): Vacina | null {
  const doCatalogo = VACINAS.find((v) => v.id === id)
  return doCatalogo ? semTraducoes(doCatalogo) : (RESERVA.find((v) => v.id === id) ?? null)
}

function catalogo(id: string): Vacina {
  const v = vacinaDoCatalogoPorId(id)
  if (!v) throw new Error(`demonstração: vacina ${id}`)
  return v
}

export function vacinaResumo(id: string): Aplicacao['vacina'] {
  const v = catalogo(id)
  return {
    id: v.id,
    nome: v.nome,
    fabricante: v.fabricante,
    obrigatoria: v.obrigatoria,
    essencial: v.essencial,
    origem: v.origem,
    revisado: v.revisado,
  }
}

export function profissionalResumo(id: string): Aplicacao['profissional'] {
  const p = profissional(id)
  return {
    id,
    nome: p?.nome ?? 'Profissional da clínica',
    crmv: p?.registro ? `${p.conselho ?? 'CRMV'}-${p.uf ?? 'SP'} ${p.registro}` : null,
  }
}

/* --------------------------------------------------------------------------- os registros */

export type AplicacaoDaDemo = {
  id: string
  pacienteId: string
  vacinaId: string
  origem: 'CLINICA' | 'EXTERNA'
  profissionalId: string
  aplicadaEm: string
  lote: { codigo: string; validade: string; loteId?: string } | null
  via: Via | null
  dose: number
  dosesNaSerie: number
  tipoDeSerie: TipoDeSerie
  proximaDoseEm: string
  /** O agendamento de Vacinação em que a dose foi dada (só as dos últimos 90 dias e as novas). */
  agendamentoId: string | null
  /** A próxima dose já marcada na agenda. */
  agendamentoProximaId: string | null
  externa: NonNullable<Aplicacao['externa']> | null
  observacao: string | null
  crmvConfirmado: boolean
  anulada: { em: string; motivo: string } | null
  criadaEm: string
  lembrete: LembreteDaVacina | null
}

export type LoteDaDemo = {
  id: string
  vacinaId: string
  codigo: string
  fornecedor: string | null
  notaFiscal: string | null
  recebidoEm: string
  validade: string
  quantidadeRecebida: number
  conferidoPor: string | null
  custoUnitarioCentavos: number
  /** Quem registrou a entrada (o nome da conta). */
  quemNome: string
  criadoEm: string
}

export type BaixaDaDemo = {
  id: string
  loteId: string
  em: string
  quantidade: number
  motivo: MotivoDaBaixa
  observacao: string | null
  estorno: { em: string; quemNome: string; motivo: string } | null
  quemNome: string
  criadaEm: string
}

export const APLICACOES: AplicacaoDaDemo[] = []
export const LOTES: LoteDaDemo[] = []
export const BAIXAS: BaixaDaDemo[] = []
/** O mínimo que a clínica definiu por vacina (sem linha, vale o padrão do catálogo). */
export const MINIMOS_DA_CLINICA = new Map<string, number>()

let sequenciaDeAplicacao = 0
let sequenciaDeLote = 0
let sequenciaDeBaixa = 0

export function novoIdDeAplicacao() {
  return idDe('demo-apl', ++sequenciaDeAplicacao)
}

export function novoIdDeLote() {
  return idDe('demo-lote', ++sequenciaDeLote)
}

export function novoIdDeBaixa() {
  return idDe('demo-baixa', ++sequenciaDeBaixa)
}

/** A data da próxima dose: a série segue pelo intervalo entre doses; fechada, o reforço. */
export function proximaDoseDe(vacinaId: string, data: string, dose: number, total: number) {
  const v = catalogo(vacinaId)
  return somarDias(data, dose < total ? v.intervaloEntreDosesDias : v.intervaloReforcoDias)
}

/* ------------------------------------------------------------------------------ a geração */

const sorte = criarSorteio('vacinas-estoque')
const HOJE = hoje()
const INICIO_DA_JANELA = somarDias(HOJE, -DIAS_PARA_TRAS)
/** O dia em que a geladeira passou a ser controlada no portal: a contagem inicial dos lotes. */
export const IMPLANTACAO_DO_ESTOQUE = somarDias(HOJE, -95)

const LOCAIS_DE_FORA = [
  { local: 'Clínica Veterinária Pompeia', aplicador: 'Dr. Henrique Assis' },
  { local: 'Hospital Veterinário Sumaré', aplicador: null },
  { local: 'Pet Shop Amigo Fiel (sala de vacinação)', aplicador: 'Dra. Sueli Matos' },
  { local: 'Clínica Veterinária Bichos & Cia, Campinas', aplicador: null },
]

const CAMPANHA = { local: 'Campanha municipal de vacinação antirrábica', aplicador: null }

const OBSERVACOES = [
  'Sem reação no período de observação de 15 minutos.',
  'Aplicada no subcutâneo da região escapular.',
  'Tutor relatou dor local leve na dose anterior; observado 20 minutos, sem intercorrências.',
  'Paciente agitado; contenção com a ajuda do tutor.',
  'Peso e temperatura conferidos antes da aplicação, sem febre.',
  'Orientado a evitar banho e passeios longos nas próximas 48 horas.',
]

function diaUtil(data: string) {
  return diaDaSemana(data) === 0 ? somarDias(data, 1) : data
}

function quemAtendeEm(data: string, especie: Especie): string {
  const semana = diaDaSemana(data)
  const ids = PROFISSIONAIS.filter((p) => EXPEDIENTE_DOS_PROFISSIONAIS[p.id]?.[semana]).map(
    (p) => p.id,
  )
  if (especie === 'GATO' && ids.includes('demo-prof-camila') && sorte.chance(0.7)) {
    return 'demo-prof-camila'
  }
  return ids.length ? sorte.escolher(ids) : 'demo-prof-marina'
}

function horaNoDia(data: string) {
  const sabado = diaDaSemana(data) === 6
  const fim = sabado ? 12 * 60 + 30 : 16 * 60 + 30
  const horarios: string[] = []
  for (let m = 8 * 60; m <= fim; m += 15) {
    if (m >= 12 * 60 && m < 13 * 60) continue
    horarios.push(
      `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`,
    )
  }
  return sorte.escolher(horarios)
}

/** O lote digitado das doses de antes da geladeira no portal: um por vacina e trimestre. */
function loteDigitado(vacinaId: string, data: string) {
  const [ano = 2025, mes = 1] = data.split('-').map(Number)
  const trimestre = Math.floor((mes - 1) / 3)
  const prefixo = PREFIXO_DO_LOTE[vacinaId] ?? 'VAC'
  const numero = 11 + ((ano * 7 + trimestre * 13 + prefixo.charCodeAt(0)) % 80)
  const fimDoTrimestre = ['03-31', '06-30', '09-30', '12-31'][trimestre] ?? '12-31'
  return {
    codigo: `${prefixo}${String(ano).slice(2)}${'ABCD'[trimestre] ?? 'A'}${numero}`,
    validade: `${ano + 1}-${fimDoTrimestre}`,
  }
}

function viaPara(vacinaId: string): Via {
  if (vacinaId === TOSSE) return 'INTRANASAL'
  if (vacinaId === RAIVA && sorte.chance(0.2)) return 'INTRAMUSCULAR'
  return 'SUBCUTANEA'
}

function observacaoPara(p: PacienteDaDemo, vacinaId: string): string | null {
  if (p.alertas.some((a) => a.tipo === 'AGRESSIVO')) {
    return 'Aplicada com focinheira, conforme o alerta da ficha.'
  }
  if (p.alertas.some((a) => a.tipo === 'IMUNOSSUPRIMIDO')) {
    return 'Paciente FIV positivo: vacina inativada, avaliação clínica antes da dose, sem intercorrências.'
  }
  if (vacinaId === TOSSE && sorte.chance(0.4)) {
    return 'Aplicada pela via intranasal; espirros leves logo depois, esperados.'
  }
  return sorte.chance(0.25) ? sorte.escolher(OBSERVACOES) : null
}

type Registro = Omit<AplicacaoDaDemo, 'id' | 'proximaDoseEm' | 'lembrete' | 'anulada'> & {
  proximaDoseEm?: string
}

function registrar(dados: Registro): AplicacaoDaDemo {
  const aplicacao: AplicacaoDaDemo = {
    ...dados,
    id: novoIdDeAplicacao(),
    proximaDoseEm:
      dados.proximaDoseEm ??
      proximaDoseDe(dados.vacinaId, dados.aplicadaEm.slice(0, 10), dados.dose, dados.dosesNaSerie),
    anulada: null,
    lembrete: null,
  }
  APLICACOES.push(aplicacao)
  return aplicacao
}

type Serie = { dose: number; total: number; tipo: TipoDeSerie }
const REFORCO: Serie = { dose: 1, total: 1, tipo: 'ADULTO' }

/** A dose dada aqui num agendamento de Vacinação da agenda. */
function daAgenda(p: PacienteDaDemo, vacinaId: string, a: AgendamentoDaDemo, serie: Serie) {
  const aplicadaEm = somarMinutos(a.iniciadoEm ?? a.inicio, sorte.inteiro(3, 9))
  return registrar({
    pacienteId: p.id,
    vacinaId,
    origem: 'CLINICA',
    profissionalId: a.profissionalId,
    aplicadaEm,
    lote: null,
    via: viaPara(vacinaId),
    dose: serie.dose,
    dosesNaSerie: serie.total,
    tipoDeSerie: serie.tipo,
    agendamentoId: a.id,
    agendamentoProximaId: null,
    externa: null,
    observacao: observacaoPara(p, vacinaId),
    crmvConfirmado: true,
    criadaEm: somarMinutos(aplicadaEm, sorte.inteiro(1, 6)),
  })
}

/** A dose dada aqui antes da janela da agenda, com o lote digitado. */
function daqui(p: PacienteDaDemo, vacinaId: string, data: string, serie: Serie) {
  const dia = diaUtil(data)
  const aplicadaEm = instante(dia, horaNoDia(dia))
  return registrar({
    pacienteId: p.id,
    vacinaId,
    origem: 'CLINICA',
    profissionalId: quemAtendeEm(dia, p.especie as Especie),
    aplicadaEm,
    lote: loteDigitado(vacinaId, dia),
    via: viaPara(vacinaId),
    dose: serie.dose,
    dosesNaSerie: serie.total,
    tipoDeSerie: serie.tipo,
    agendamentoId: null,
    agendamentoProximaId: null,
    externa: null,
    observacao: observacaoPara(p, vacinaId),
    crmvConfirmado: !sorte.chance(0.03),
    criadaEm: somarMinutos(aplicadaEm, sorte.inteiro(2, 30)),
  })
}

/** A dose de outro lugar, transcrita da carteirinha quando o pet chegou à clínica. */
function deFora(p: PacienteDaDemo, vacinaId: string, data: string, serie: Serie) {
  const origem = vacinaId === RAIVA && sorte.chance(0.4) ? CAMPANHA : sorte.escolher(LOCAIS_DE_FORA)
  const chegada = diaUtil(p.criadoEm.slice(0, 10))
  const transcreveu = quemAtendeEm(chegada, p.especie as Especie)
  return registrar({
    pacienteId: p.id,
    vacinaId,
    origem: 'EXTERNA',
    profissionalId: transcreveu,
    aplicadaEm: instante(data, '12:00'),
    lote: null,
    via: origem === CAMPANHA ? 'SUBCUTANEA' : sorte.chance(0.6) ? viaPara(vacinaId) : null,
    dose: serie.dose,
    dosesNaSerie: serie.total,
    tipoDeSerie: serie.tipo,
    agendamentoId: null,
    agendamentoProximaId: null,
    externa: {
      local: origem.local,
      aplicador: origem.aplicador,
      procedencia: sorte.chance(0.8) ? 'COMPROVANTE' : 'RELATO',
    },
    observacao: sorte.chance(0.5)
      ? `Etiqueta do lote na carteirinha: ${loteDigitado(vacinaId, data).codigo}.`
      : null,
    crmvConfirmado: true,
    criadaEm: instante(chegada, '10:30'),
  })
}

/* Os agendamentos de Vacinação de cada pet: os atendidos na janela e os que ainda vêm. */
const ATENDIDOS = new Map<string, AgendamentoDaDemo[]>()
const POR_VIR = new Map<string, AgendamentoDaDemo[]>()

function separarAgendamentos() {
  const agoraMs = agora().getTime()
  for (const a of AGENDAMENTOS) {
    if (a.tipoId !== 'demo-tipo-vacina') continue
    const dia = a.inicio.slice(0, 10)
    if (a.status === 'FINALIZADO' && dia >= INICIO_DA_JANELA && dia <= HOJE) {
      ATENDIDOS.set(a.pacienteId, [...(ATENDIDOS.get(a.pacienteId) ?? []), a])
    } else if (
      (a.status === 'AGENDADO' || a.status === 'CONFIRMADO' || a.status === 'AGUARDANDO') &&
      Date.parse(a.inicio) > agoraMs
    ) {
      POR_VIR.set(a.pacienteId, [...(POR_VIR.get(a.pacienteId) ?? []), a])
    }
  }
}

/** O atendido mais perto do dia pedido, não antes de `minimo`. */
function atendidoPerto(pacienteId: string, alvo: string, minimo?: string) {
  const lista = (ATENDIDOS.get(pacienteId) ?? []).filter(
    (a) => !minimo || a.inicio.slice(0, 10) >= minimo,
  )
  let melhor: AgendamentoDaDemo | null = null
  for (const a of lista) {
    const distancia = Math.abs(diasEntre(alvo, a.inicio.slice(0, 10)))
    if (!melhor || distancia < Math.abs(diasEntre(alvo, melhor.inicio.slice(0, 10)))) melhor = a
  }
  return melhor
}

type Ultima = { agendamento: AgendamentoDaDemo } | { data: string }
type Categoria = 'janela' | 'emDia' | 'proximo' | 'vencido'

function sortearCategoria(p: PacienteDaDemo): Categoria {
  /*
   * Os pets da base gerada (`base/cadastro-gerado.ts`) são a maioria da clínica e estão quase
   * todos em dia: sem isso, a lista de chamada passava de cem vencidas.
   */
  const gerado = p.id.startsWith('demo-pac-g')
  const c = sorte.pesado(
    gerado
      ? ([
          ['janela', 18],
          ['emDia', 73],
          ['proximo', 8],
          ['vencido', 1],
        ] as const)
      : ([
          ['janela', 45],
          ['emDia', 22],
          ['proximo', 17],
          ['vencido', 16],
        ] as const),
  )
  if (c === 'janela' && !(ATENDIDOS.get(p.id) ?? []).length) return 'emDia'
  /* A Mel está gestante: as vacinas vivas esperam o parto. */
  if (c === 'janela' && p.alertas.some((a) => a.tipo === 'GESTANTE')) return 'vencido'
  return c
}

/*
 * Os dias de cada categoria se espalham pela faixa dela (passo da razão áurea, com um pouco de
 * sorte): o giro mês a mês sai sem buraco, o que o sorteio puro deixava com poucos pets.
 */
const VEZES: Record<Categoria, number> = { janela: 0, emDia: 0, proximo: 0, vencido: 0 }

function espalhado(categoria: Categoria, min: number, max: number) {
  const fracao = (++VEZES[categoria] * 0.6180339887 + sorte.numero() * 0.12) % 1
  return Math.round(min + fracao * (max - min))
}

function ultimaPara(p: PacienteDaDemo, categoria: Categoria): Ultima {
  switch (categoria) {
    case 'janela': {
      const alvo = somarDias(HOJE, -espalhado('janela', 1, DIAS_PARA_TRAS - 1))
      const perto = atendidoPerto(p.id, alvo)
      return { agendamento: perto ?? sorte.escolher(ATENDIDOS.get(p.id) ?? []) }
    }
    case 'emDia':
      return { data: somarDias(HOJE, -espalhado('emDia', 93, 330)) }
    case 'proximo':
      return { data: somarDias(HOJE, -espalhado('proximo', 337, 364)) }
    case 'vencido':
      return { data: somarDias(HOJE, -espalhado('vencido', 368, 500)) }
  }
}

/** O reforço anual: a última dose e as de antes, um ano para trás de cada vez. */
function historicoAnual(p: PacienteDaDemo, vacinaId: string, ultima: Ultima) {
  const chegada = p.criadoEm.slice(0, 10)
  let anterior: string
  if ('agendamento' in ultima) {
    daAgenda(p, vacinaId, ultima.agendamento, REFORCO)
    anterior = ultima.agendamento.inicio.slice(0, 10)
  } else {
    const dia = diaUtil(ultima.data)
    if (dia < chegada) {
      deFora(p, vacinaId, dia, REFORCO)
      return
    }
    daqui(p, vacinaId, dia, REFORCO)
    anterior = dia
  }
  for (;;) {
    const antes = diaUtil(somarDias(anterior, -365 + sorte.inteiro(-9, 9)))
    if (antes < chegada) {
      if (sorte.chance(0.55)) deFora(p, vacinaId, antes, REFORCO)
      return
    }
    daqui(p, vacinaId, antes, REFORCO)
    anterior = antes
  }
}

/** O filhote que chegou novo: a série, depois os reforços que já venceram. */
function historicoDeFilhote(p: PacienteDaDemo, vacinaId: string, esperaAgendado: boolean) {
  const v = catalogo(vacinaId)
  const chegada = p.criadoEm.slice(0, 10)
  const nascimento = p.nascimento ?? somarDias(chegada, -60)
  /* A série de filhote: as doses fixas ou, no modo ATE_IDADE_MINIMA, até uma dose na idade. */
  const ultimaIdade =
    v.modoSerieFilhote === 'ATE_IDADE_MINIMA' ? (v.idadeMinimaUltimaDoseFilhoteDias ?? 0) : 0
  const datas = [diaUtil(somarDias(nascimento, v.idadeMinimaDias + sorte.inteiro(14, 20)))]
  for (;;) {
    const ultima = datas[datas.length - 1] ?? nascimento
    const falta =
      datas.length < v.dosesSerieFilhote ||
      (diasEntre(nascimento, ultima) < ultimaIdade && datas.length < 5)
    if (!falta) break
    datas.push(
      diaUtil(somarDias(ultima, Math.max(21, v.intervaloEntreDosesDias) + sorte.inteiro(0, 4))),
    )
  }
  const total = datas.length
  datas.forEach((data, i) => {
    const serie: Serie = { dose: i + 1, total, tipo: 'FILHOTE' }
    if (data < chegada) deFora(p, vacinaId, data, serie)
    else daqui(p, vacinaId, data, serie)
  })
  let dia = datas[datas.length - 1] ?? nascimento
  let vence = somarDias(dia, v.intervaloReforcoDias)
  while (vence <= HOJE) {
    /* Quem já tem a vacinação marcada para hoje deixou o reforço atrasar: fica na chamada. */
    if (esperaAgendado && vence >= somarDias(HOJE, -200)) return
    /* Os pets da base gerada quase sempre voltam no prazo do reforço. */
    const emDia = p.id.startsWith('demo-pac-g') && sorte.chance(0.92)
    if (vence < somarDias(INICIO_DA_JANELA, -12) || emDia) {
      dia = diaUtil(somarDias(vence, sorte.inteiro(0, 10)))
      if (dia >= HOJE) dia = diaUtil(somarDias(HOJE, -sorte.inteiro(3, 9)))
      daqui(p, vacinaId, dia, REFORCO)
      vence = somarDias(dia, v.intervaloReforcoDias)
      continue
    }
    const a = (ATENDIDOS.get(p.id) ?? []).find(
      (x) => x.inicio.slice(0, 10) >= somarDias(vence, -10),
    )
    if (!a) return
    daAgenda(p, vacinaId, a, REFORCO)
    vence = somarDias(a.inicio.slice(0, 10), v.intervaloReforcoDias)
  }
}

/**
 * A série que está em curso na janela, nos atendimentos mais perto de cada dia pedido (dias para
 * trás). Sem atendimento para a primeira dose, devolve falso e o pet segue o reforço anual.
 */
function serieEmCurso(
  p: PacienteDaDemo,
  vacinaId: string,
  diasAtras: number[],
  total: number,
): boolean {
  let minimo: string | undefined
  let dadas = 0
  for (const [i, atras] of diasAtras.entries()) {
    const a = atendidoPerto(p.id, somarDias(HOJE, -atras), minimo)
    if (!a || (i > 0 && a.inicio.slice(0, 10) < (minimo ?? ''))) break
    daAgenda(p, vacinaId, a, { dose: i + 1, total, tipo: 'ADULTO' })
    dadas++
    minimo = somarDias(a.inicio.slice(0, 10), catalogo(vacinaId).intervaloEntreDosesDias)
  }
  return dadas > 0
}

/**
 * As vacinas de cada pet: cão e gato; o furão, a antirrábica (o catálogo a dá para OUTRO); os
 * outros não têm vacina no catálogo.
 */
function protocoloDe(p: PacienteDaDemo): string[] {
  if (p.especie === 'CACHORRO') {
    const lista = [V10, RAIVA]
    if (sorte.chance(0.45)) lista.push(TOSSE)
    if (p.id === 'demo-pac-040' || sorte.chance(0.12)) lista.push(GIARDIA)
    if (COM_LEISHMANIOSE.has(p.id)) lista.push(LEISH)
    return lista
  }
  if (p.especie === 'GATO') return [sorte.chance(0.7) ? V4 : V5, RAIVA]
  const raiva = vacinaDoCatalogoPorId(RAIVA)
  if (
    p.especieOutra === 'Furão' &&
    (raiva?.especies as string[] | undefined)?.includes(p.especie)
  ) {
    return [RAIVA]
  }
  return []
}

/** Cães que viajam para o litoral e o interior: vacinados contra leishmaniose. */
const COM_LEISHMANIOSE = new Set(['demo-pac-012', 'demo-pac-014', 'demo-pac-032'])

/** Séries em curso, contadas para trás a partir de hoje. */
const SERIES_EM_CURSO: Array<{ pacienteId: string; vacinaId: string; dias: number[] }> = [
  /* Ozzy começou a leishmaniose: a terceira dose passou da data. */
  { pacienteId: 'demo-pac-032', vacinaId: LEISH, dias: [46, 25] },
  /* Toddy começou a giárdia: a segunda dose vem em poucos dias. */
  { pacienteId: 'demo-pac-040', vacinaId: GIARDIA, dias: [12] },
  /* Hulk começou a V10 como adulto sem histórico da polivalente: a segunda dose atrasou. */
  { pacienteId: 'demo-pac-038', vacinaId: V10, dias: [30] },
]

function gerarAplicacoes() {
  separarAgendamentos()

  for (const p of PACIENTES) {
    const protocolo = protocoloDe(p)
    if (!protocolo.length) continue

    const atendidoHoje = (ATENDIDOS.get(p.id) ?? []).find((a) => a.inicio.startsWith(HOJE))
    const marcadoHoje = (POR_VIR.get(p.id) ?? []).some((a) => a.inicio.startsWith(HOJE))
    const nascimento = p.nascimento ?? '2015-01-01'
    const filhoteNaChegada = diasEntre(nascimento, p.criadoEm.slice(0, 10)) < 300

    if (filhoteNaChegada) {
      for (const vacinaId of protocolo) {
        if (vacinaId === GIARDIA || vacinaId === LEISH) continue
        historicoDeFilhote(p, vacinaId, marcadoHoje)
      }
      continue
    }

    /* Inativo: as doses param antes do óbito ou da transferência. */
    if (!p.ativo) {
      const fim = p.obitoEm ?? somarDias(HOJE, -170)
      for (const vacinaId of protocolo) {
        historicoAnual(p, vacinaId, { data: somarDias(fim, -sorte.inteiro(40, 220)) })
      }
      continue
    }

    let principal: Ultima
    if (atendidoHoje) principal = { agendamento: atendidoHoje }
    else if (marcadoHoje) principal = { data: somarDias(HOJE, -365 - sorte.inteiro(4, 60)) }
    else principal = ultimaPara(p, sortearCategoria(p))

    for (const vacinaId of protocolo) {
      const emCurso = SERIES_EM_CURSO.find((s) => s.pacienteId === p.id && s.vacinaId === vacinaId)
      if (emCurso) {
        const total = catalogo(vacinaId).dosesSerieAdultoSemHistorico
        if (serieEmCurso(p, vacinaId, emCurso.dias, total)) continue
      }
      const junto = vacinaId === V10 || vacinaId === V4 || vacinaId === V5
      const mesmaVisita = junto || vacinaId === RAIVA || (vacinaId === TOSSE && sorte.chance(0.6))
      historicoAnual(
        p,
        vacinaId,
        mesmaVisita || atendidoHoje || marcadoHoje ? principal : ultimaPara(p, sortearCategoria(p)),
      )
    }
  }
}

/**
 * Duas doses anuladas: uma lançada no irmão errado e uma com o lote trocado (registrada de novo
 * com o lote certo). Ficam riscadas no histórico e fora do saldo.
 */
function gerarAnuladas() {
  const IRMAOS: Array<[string, string]> = [
    ['demo-pac-019-2', 'demo-pac-019'],
    ['demo-pac-033', 'demo-pac-033-2'],
    ['demo-pac-023', 'demo-pac-023-2'],
    ['demo-pac-011', 'demo-pac-011-2'],
  ]
  for (const [certo, errado] of IRMAOS) {
    const dose = APLICACOES.find(
      (a) => a.pacienteId === certo && a.agendamentoId && a.origem === 'CLINICA',
    )
    const pet = paciente(certo)
    if (!dose || !pet) continue
    const registro = registrar({
      ...dose,
      pacienteId: errado,
      criadaEm: somarMinutos(dose.criadaEm, -3),
      observacao: null,
    })
    registro.anulada = {
      em: somarMinutos(dose.criadaEm, 22),
      motivo: `Lançada no paciente errado: a dose foi aplicada em ${pet.nome}, ${pet.sexo === 'FEMEA' ? 'irmã' : 'irmão'} da mesma casa.`,
    }
    break
  }

  const trocado = [...APLICACOES]
    .reverse()
    .find((a) => a.agendamentoId && a.origem === 'CLINICA' && a.vacinaId === RAIVA && !a.anulada)
  if (trocado) {
    const errado = registrar({ ...trocado, criadaEm: somarMinutos(trocado.criadaEm, -4) })
    errado.lote = { codigo: 'RAB2507C41', validade: somarDias(HOJE, 220) }
    errado.anulada = {
      em: somarMinutos(trocado.criadaEm, -1),
      motivo: 'Lote digitado errado; registrada de novo com o lote do frasco.',
    }
  }
}

/* ------------------------------------------------------------------------------ o estoque */

type PerdaDaConfig = {
  /** 0 = o lote em uso; 1 = o anterior; e assim por diante. */
  lote: number
  motivo: MotivoDaBaixa
  quantidade: number
  observacao: string
  estorno?: string
}

type ConfigDoEstoque = {
  vacinaId: string
  pacote: number
  saldoEmUso: number
  /** Dias até vencer o lote em uso (sem isso, a validade normal de um lote novo). */
  validadeEmUso?: number
  /** O lote que acabou de chegar e ainda não foi aberto. */
  novo?: { diasAtras: number; quantidade: number }
  /** A sobra da contagem inicial que venceu na geladeira (descarte pendente). */
  vencido?: { quantidade: number; validadeDias: number }
  custo: number
  fornecedor: string
  perdas: PerdaDaConfig[]
}

/*
 * Uma clínica de bairro: frascos em caixas de 5 a 10 doses, o bastante para um a dois meses. A V10
 * ficou abaixo do mínimo (o pedido atrasou); o lote em uso da antirrábica vence este mês (e o novo
 * já chegou); a sobra da contagem inicial da giárdia venceu na geladeira.
 */
const ESTOQUE: ConfigDoEstoque[] = [
  {
    vacinaId: V10,
    pacote: 10,
    saldoEmUso: 6,
    custo: 4850,
    fornecedor: 'Distribuidora Pet Paulista',
    perdas: [
      {
        lote: 0,
        motivo: 'QUEBRA',
        quantidade: 1,
        observacao: 'Frasco escorregou da bandeja no preparo.',
      },
      {
        lote: 1,
        motivo: 'CONTAGEM',
        quantidade: 1,
        observacao: 'Contagem de sexta: um frasco a menos que o sistema.',
        estorno: 'O frasco estava na porta da geladeira, separado para a vacinação do sábado.',
      },
    ],
  },
  {
    vacinaId: RAIVA,
    pacote: 10,
    saldoEmUso: 3,
    validadeEmUso: 12,
    novo: { diasAtras: 4, quantidade: 10 },
    custo: 1850,
    fornecedor: 'Distribuidora Pet Paulista',
    perdas: [
      {
        lote: 1,
        motivo: 'CONTAGEM',
        quantidade: 1,
        observacao: 'Inventário do mês: uma dose a menos na geladeira.',
      },
    ],
  },
  {
    vacinaId: V4,
    pacote: 10,
    saldoEmUso: 7,
    custo: 5200,
    fornecedor: 'Agropecuária Cantareira',
    perdas: [
      {
        lote: 1,
        motivo: 'TEMPERATURA',
        quantidade: 2,
        observacao: 'Queda de energia de madrugada; o termômetro marcou 11 °C pela manhã.',
      },
    ],
  },
  {
    vacinaId: V5,
    pacote: 5,
    saldoEmUso: 4,
    custo: 8900,
    fornecedor: 'Agropecuária Cantareira',
    perdas: [],
  },
  {
    vacinaId: TOSSE,
    pacote: 10,
    saldoEmUso: 7,
    custo: 6200,
    fornecedor: 'VetMinas Distribuidora',
    perdas: [],
  },
  {
    vacinaId: GIARDIA,
    pacote: 5,
    saldoEmUso: 4,
    vencido: { quantidade: 2, validadeDias: -9 },
    custo: 5500,
    fornecedor: 'VetMinas Distribuidora',
    perdas: [],
  },
  {
    vacinaId: LEISH,
    pacote: 5,
    saldoEmUso: 3,
    custo: 14500,
    fornecedor: 'Frigovet Logística',
    perdas: [],
  },
]

const CONFERENTES = ['Dra. Camila Torres', 'Dr. Bruno Saito', 'Dra. Marina Albuquerque']

function codigoDoLote(vacinaId: string, recebidoEm: string, ordem: number) {
  const [ano = '26', mes = '01'] = [recebidoEm.slice(2, 4), recebidoEm.slice(5, 7)]
  return `${PREFIXO_DO_LOTE[vacinaId] ?? 'VAC'}${ano}${mes}${'ABCDEFGHJK'[ordem % 10]}${sorte.inteiro(10, 98)}`
}

function novoLote(
  config: ConfigDoEstoque,
  recebidoEm: string,
  validade: string,
  quantidade: number,
  ordem: number,
  implantacao = false,
): LoteDaDemo {
  const lote: LoteDaDemo = {
    id: novoIdDeLote(),
    vacinaId: config.vacinaId,
    codigo: codigoDoLote(config.vacinaId, recebidoEm, ordem),
    fornecedor: config.fornecedor,
    notaFiscal: implantacao ? null : String(sorte.inteiro(18000, 96000)),
    recebidoEm,
    validade,
    quantidadeRecebida: quantidade,
    conferidoPor: sorte.escolher(CONFERENTES),
    custoUnitarioCentavos: config.custo,
    quemNome: implantacao
      ? 'Marina Albuquerque'
      : sorte.escolher(['Lucas Ferreira', 'Patrícia Lima']),
    criadoEm: instante(
      recebidoEm,
      `${sorte.inteiro(9, 11)}:${String(sorte.inteiro(0, 59)).padStart(2, '0')}`,
    ),
  }
  LOTES.push(lote)
  return lote
}

function registrarBaixa(lote: LoteDaDemo, perda: PerdaDaConfig, dia: string) {
  const criadaEm = instante(
    dia,
    `${sorte.inteiro(8, 17)}:${String(sorte.inteiro(0, 59)).padStart(2, '0')}`,
  )
  const baixa: BaixaDaDemo = {
    id: novoIdDeBaixa(),
    loteId: lote.id,
    em: dia,
    quantidade: perda.quantidade,
    motivo: perda.motivo,
    observacao: perda.observacao,
    estorno: null,
    quemNome: perda.motivo === 'CONTAGEM' ? 'Patrícia Lima' : 'Lucas Ferreira',
    criadaEm,
  }
  if (perda.estorno) {
    const depois = somarMinutos(criadaEm, 26 * 60)
    baixa.estorno = {
      em: Date.parse(depois) < agora().getTime() ? depois : somarMinutos(criadaEm, 45),
      quemNome: 'Marina Albuquerque',
      motivo: perda.estorno,
    }
  }
  BAIXAS.push(baixa)
}

/**
 * Os lotes de cada vacina, montados de trás para frente pelas doses dos últimos 90 dias: o lote em
 * uso leva as doses mais recentes e fica com o saldo combinado; os anteriores, cheios, esgotaram;
 * o mais antigo é a contagem inicial (a quantidade que sobrou para fechar a conta).
 */
function montarEstoque() {
  for (const config of ESTOQUE) {
    const doses = APLICACOES.filter(
      (a) =>
        a.vacinaId === config.vacinaId && a.origem === 'CLINICA' && a.agendamentoId && !a.anulada,
    ).sort((x, y) => Date.parse(y.aplicadaEm) - Date.parse(x.aplicadaEm))

    const perdasDo = (k: number) =>
      config.perdas
        .filter((p) => p.lote === k && !p.estorno)
        .reduce((soma, p) => soma + p.quantidade, 0)

    const cadeia: Array<{ doses: AplicacaoDaDemo[]; saldo: number }> = []
    let resto = doses
    for (let k = 0; k === 0 || resto.length; k++) {
      const saldo = k === 0 ? config.saldoEmUso : 0
      const cabe = Math.max(0, config.pacote - saldo - perdasDo(k))
      cadeia.push({ doses: resto.slice(0, cabe), saldo })
      resto = resto.slice(cabe)
    }

    const ultimo = cadeia.length - 1
    const lotes = cadeia.map((elo, k) => {
      const perdas = config.perdas.filter((p) => (p.lote >= ultimo ? ultimo : p.lote) === k)
      const perdidas = perdas.filter((p) => !p.estorno).reduce((s, p) => s + p.quantidade, 0)
      const quantidade = elo.doses.length + perdidas + elo.saldo
      const primeira = elo.doses[elo.doses.length - 1]?.aplicadaEm.slice(0, 10)
      const implantacao = k === ultimo && quantidade !== config.pacote
      let recebidoEm = primeira
        ? somarDias(primeira, -sorte.inteiro(1, 8))
        : somarDias(HOJE, -sorte.inteiro(15, 40))
      if (implantacao || recebidoEm < IMPLANTACAO_DO_ESTOQUE) recebidoEm = IMPLANTACAO_DO_ESTOQUE
      recebidoEm = diaUtil(recebidoEm)
      const validade =
        k === 0 && config.validadeEmUso !== undefined
          ? somarDias(HOJE, config.validadeEmUso)
          : somarDias(recebidoEm, sorte.inteiro(300, 520))
      const lote = novoLote(config, recebidoEm, validade, quantidade, k, implantacao)
      for (const dose of elo.doses) {
        dose.lote = { codigo: lote.codigo, validade: lote.validade, loteId: lote.id }
      }
      for (const perda of perdas) {
        /* No meio do uso do lote, um pouco para o lado das doses mais antigas. */
        const meio = elo.doses[Math.min(elo.doses.length - 1, Math.floor(elo.doses.length / 2) + 1)]
        const dia = meio ? meio.aplicadaEm.slice(0, 10) : somarDias(recebidoEm, 3)
        registrarBaixa(lote, perda, dia >= HOJE ? somarDias(HOJE, -1) : dia)
      }
      return lote
    })

    if (config.novo) {
      const recebidoEm = diaUtil(somarDias(HOJE, -config.novo.diasAtras))
      novoLote(
        config,
        recebidoEm > HOJE ? HOJE : recebidoEm,
        somarDias(HOJE, sorte.inteiro(420, 560)),
        config.novo.quantidade,
        lotes.length,
      )
    }
    if (config.vencido) {
      novoLote(
        config,
        IMPLANTACAO_DO_ESTOQUE,
        somarDias(HOJE, config.vencido.validadeDias),
        config.vencido.quantidade,
        lotes.length + 1,
        true,
      )
    }
  }

  /* A V5 sai pouco (a maioria dos gatos toma a V4): a clínica baixou o mínimo dela. */
  MINIMOS_DA_CLINICA.set(V5, 3)
}

/* ----------------------------------------------------------------------- a próxima dose */

/**
 * A próxima dose já marcada: o pet que tem Vacinação na agenda por perto da data (a de hoje à
 * tarde sempre; as outras, parte delas, como quem marcou no mesmo gesto da aplicação).
 */
function ligarAgendamentosDaProxima() {
  for (const a of vigentes()) {
    const p = paciente(a.pacienteId)
    if (!p?.ativo) continue
    const dias = diasEntre(HOJE, a.proximaDoseEm)
    if (dias > 30 && a.dose >= a.dosesNaSerie) continue
    const marcado = (POR_VIR.get(p.id) ?? []).find((x) => {
      const dia = x.inicio.slice(0, 10)
      if (dia === HOJE) return true
      return (
        diasEntre(HOJE, dia) <= 10 &&
        Math.abs(diasEntre(a.proximaDoseEm, dia)) <= (dias < 0 ? 40 : 6)
      )
    })
    if (!marcado) continue
    if (marcado.inicio.startsWith(HOJE) || sorte.chance(0.45)) a.agendamentoProximaId = marcado.id
  }
}

/* ---------------------------------------------------------------------------- os lembretes */

/**
 * Lembretes ligados em parte da chamada (só de quem tem o responsável no app), cada um num ponto
 * da entrega: entregue, enviado, só na caixa, o que não saiu pelo teto do dia, o que já repetiu e
 * o que acabou de ligar.
 */
function ligarLembretes() {
  const candidatos = chamadaDeVacinas().filter(
    (item) => item.responsavelNoApp && !item.agendamentoProxima,
  )
  const ESTADOS: Array<{
    horas: number
    entrega: LembreteDaVacina['entrega']
    envios: number
    motivo?: LembreteDaVacina['motivoSemEnvio']
    repetiu?: boolean
    quem: string
  }> = [
    { horas: 74, entrega: 'ENTREGUE', envios: 1, quem: 'demo-usr-juliana' },
    { horas: 1.4, entrega: 'ENVIADO', envios: 1, quem: 'demo-usr-marina' },
    { horas: 122, entrega: 'SO_NA_CAIXA', envios: 1, quem: 'demo-usr-juliana' },
    { horas: 49, entrega: 'FALHOU', envios: 1, motivo: 'TETO_DO_DIA', quem: 'demo-usr-juliana' },
    { horas: 250, entrega: 'ENTREGUE', envios: 2, repetiu: true, quem: 'demo-usr-patricia' },
    { horas: 0.15, entrega: 'PENDENTE', envios: 0, quem: 'demo-usr-marina' },
  ]
  const passo = Math.max(1, Math.floor(candidatos.length / ESTADOS.length))
  ESTADOS.forEach((estado, i) => {
    const item = candidatos[i * passo]
    const aplicacao = item ? APLICACOES.find((a) => a.id === item.aplicacaoId) : null
    if (!aplicacao) return
    const ligadoEm = somarMinutos(agoraIso(), -Math.round(estado.horas * 60))
    const envio = estado.envios ? somarMinutos(ligadoEm, 1) : null
    aplicacao.lembrete = {
      aplicacaoId: aplicacao.id,
      ligadoEm,
      ligadoPorId: estado.quem,
      ultimoEnvioEm: estado.repetiu ? somarMinutos(ligadoEm, 7 * 24 * 60) : envio,
      proximoEnvioEm: estado.repetiu ? null : repeticaoDoLembrete(aplicacao, ligadoEm),
      envios: estado.envios,
      entrega: estado.entrega,
      motivoSemEnvio: estado.motivo ?? null,
    }
  })
}

/** A repetição: no dia da próxima dose, se ainda vai vencer; ou 7 dias depois, às 9h. */
export function repeticaoDoLembrete(aplicacao: AplicacaoDaDemo, ligadoEm: string): string | null {
  const dia = ligadoEm.slice(0, 10)
  const alvo = aplicacao.proximaDoseEm > dia ? aplicacao.proximaDoseEm : somarDias(dia, 7)
  return instante(alvo, '09:00')
}

/* -------------------------------------------------------------------------------- consultas */

function chave(a: Pick<AplicacaoDaDemo, 'pacienteId' | 'vacinaId'>) {
  return `${a.pacienteId}|${a.vacinaId}`
}

/** A última dose não anulada de cada vacina em cada pet: a que cobra. */
export function vigentes(): AplicacaoDaDemo[] {
  const ultimas = new Map<string, AplicacaoDaDemo>()
  for (const a of APLICACOES) {
    if (a.anulada) continue
    const atual = ultimas.get(chave(a))
    if (!atual || Date.parse(a.aplicadaEm) > Date.parse(atual.aplicadaEm)) ultimas.set(chave(a), a)
  }
  return [...ultimas.values()]
}

export function vigenteDe(pacienteId: string, vacinaId: string): AplicacaoDaDemo | null {
  let melhor: AplicacaoDaDemo | null = null
  for (const a of APLICACOES) {
    if (a.anulada || a.pacienteId !== pacienteId || a.vacinaId !== vacinaId) continue
    if (!melhor || Date.parse(a.aplicadaEm) > Date.parse(melhor.aplicadaEm)) melhor = a
  }
  return melhor
}

export function aplicacao(id: string) {
  return APLICACOES.find((a) => a.id === id) ?? null
}

function ehVigente(a: AplicacaoDaDemo) {
  return !a.anulada && vigenteDe(a.pacienteId, a.vacinaId)?.id === a.id
}

function situacaoDaAplicacao(a: AplicacaoDaDemo): Aplicacao['situacao'] {
  if (!ehVigente(a)) return 'EM_DIA'
  if (a.dose < a.dosesNaSerie) return 'SERIE_INCOMPLETA'
  const dias = diasEntre(hoje(), a.proximaDoseEm)
  if (dias < 0) return 'VENCIDO'
  return dias <= 30 ? 'PROXIMO' : 'EM_DIA'
}

export function agendamentoDaProxima(a: AplicacaoDaDemo): Aplicacao['agendamentoProxima'] {
  const ag = a.agendamentoProximaId ? agendamento(a.agendamentoProximaId) : null
  return ag ? { id: ag.id, inicio: ag.inicio, status: ag.status } : null
}

export function aplicacaoDto(a: AplicacaoDaDemo): Aplicacao {
  const p = paciente(a.pacienteId)
  return {
    id: a.id,
    pacienteId: a.pacienteId,
    vacina: vacinaResumo(a.vacinaId),
    origem: a.origem,
    profissional: profissionalResumo(a.profissionalId),
    aplicadaEm: a.aplicadaEm,
    lote: a.lote
      ? {
          codigo: a.lote.codigo,
          validade: a.lote.validade,
          ...(a.lote.loteId ? { loteId: a.lote.loteId } : {}),
        }
      : null,
    via: a.via,
    dose: a.dose,
    dosesNaSerie: a.dosesNaSerie,
    tipoDeSerie: a.tipoDeSerie,
    proximaDoseEm: a.proximaDoseEm,
    agendamentoProxima: agendamentoDaProxima(a),
    externa: a.externa,
    observacao: a.observacao,
    crmvConfirmado: a.crmvConfirmado,
    situacao: situacaoDaAplicacao(a),
    vigente: ehVigente(a),
    vacinaDaCarteiraId:
      a.origem === 'CLINICA' && p?.noApp && !a.anulada ? `demo-carteira-${a.id}` : null,
    anulada: a.anulada,
    criadaEm: a.criadaEm,
  }
}

function porData(x: AplicacaoDaDemo, y: AplicacaoDaDemo) {
  return Date.parse(y.aplicadaEm) - Date.parse(x.aplicadaEm)
}

/** O histórico do pet, do mais recente, anuladas inclusive: a linha do tempo da ficha. */
export function aplicacoesDoPaciente(pacienteId: string): Aplicacao[] {
  return APLICACOES.filter((a) => a.pacienteId === pacienteId)
    .sort(porData)
    .map(aplicacaoDto)
}

export function historicoDoPaciente(pacienteId: string): HistoricoDeVacinas {
  return { itens: aplicacoesDoPaciente(pacienteId), truncado: false }
}

/** As doses aplicadas aqui (não anuladas) entre dois dias, inclusive, da mais recente. */
export function aplicacoesEntre(de: string, ate: string): AplicacaoDaDemo[] {
  return APLICACOES.filter((a) => {
    const dia = a.aplicadaEm.slice(0, 10)
    return a.origem === 'CLINICA' && !a.anulada && dia >= de && dia <= ate
  }).sort(porData)
}

/** A lista de aplicadas do período (CLINICA e EXTERNA, anuladas riscadas). */
export function aplicadasEntre(de: string, ate: string): PaginaDeAplicadas['itens'] {
  return APLICACOES.filter((a) => {
    const dia = a.aplicadaEm.slice(0, 10)
    return dia >= de && dia <= ate
  })
    .sort(porData)
    .map((a) => ({
      id: a.id,
      aplicadaEm: a.aplicadaEm,
      paciente: pacienteResumo(a.pacienteId),
      vacina: vacinaResumo(a.vacinaId),
      origem: a.origem,
      dose: a.dose,
      dosesNaSerie: a.dosesNaSerie,
      lote: aplicacaoDto(a).lote,
      profissional: profissionalResumo(a.profissionalId),
      anulada: Boolean(a.anulada),
    }))
}

/** A lista de chamada inteira, do mais atrasado ao menos. */
export function chamadaDeVacinas(): Chamada[] {
  const dia = hoje()
  const itens: Chamada[] = []
  for (const a of vigentes()) {
    const p = paciente(a.pacienteId)
    if (!p?.ativo) continue
    const dias = diasEntre(dia, a.proximaDoseEm)
    const aberta = a.dose < a.dosesNaSerie
    const situacao: Chamada['situacao'] | null = aberta
      ? 'SERIE_INCOMPLETA'
      : dias < 0
        ? 'VENCIDO'
        : dias <= 30
          ? 'PROXIMO'
          : null
    if (!situacao) continue
    const resumo = pacienteResumo(p.id)
    itens.push({
      aplicacaoId: a.id,
      paciente: resumo,
      cliente: resumo.cliente,
      vacina: vacinaResumo(a.vacinaId),
      ultimaEm: a.aplicadaEm,
      proximaDoseEm: a.proximaDoseEm,
      diasParaVencer: dias,
      situacao,
      doseSeguinte: aberta ? a.dose + 1 : null,
      agendamentoProxima: agendamentoDaProxima(a),
      lembrete: a.lembrete,
      responsavelNoApp: p.noApp,
    })
  }
  return itens.sort(
    (x, y) =>
      x.diasParaVencer - y.diasParaVencer ||
      x.paciente.nome.localeCompare(y.paciente.nome) ||
      x.vacina.nome.localeCompare(y.vacina.nome),
  )
}

/** Quantos avisar: para os selos e a pauta do Início. */
export function contagensDaChamada() {
  const itens = chamadaDeVacinas()
  return {
    itens: itens.length,
    pets: new Set(itens.map((i) => i.paciente.id)).size,
    vencidas: itens.filter((i) => i.situacao === 'VENCIDO').length,
    serieAberta: itens.filter((i) => i.situacao === 'SERIE_INCOMPLETA').length,
    aVencer: itens.filter((i) => i.situacao === 'PROXIMO').length,
    semCanalNoApp: itens.filter((i) => !i.responsavelNoApp && !i.lembrete).length,
    comLembrete: itens.filter((i) => i.lembrete).length,
  }
}

/* ---------------------------------------------------------------------------------- o plano */

const ORDEM_DO_PLANO: Record<VacinaNoPlano['situacao'], number> = {
  ATRASADA: 0,
  DEVIDA: 1,
  A_VENCER: 2,
  NAO_INICIADA: 3,
  AGUARDA_IDADE: 4,
  EM_DIA: 5,
}

function estadoDaDose(dias: number): DoseNoPlano['estado'] {
  if (dias < -7) return 'ATRASADA'
  if (dias <= 0) return 'DEVIDA'
  return 'PREVISTA'
}

function situacaoPelaData(dias: number): VacinaNoPlano['situacao'] {
  if (dias < -7) return 'ATRASADA'
  if (dias <= 0) return 'DEVIDA'
  return dias <= 30 ? 'A_VENCER' : 'EM_DIA'
}

/** O plano do pet: o que a API calcularia pela última dose de cada vacina da espécie. */
export function planoDoPaciente(pacienteId: string): PlanoVacinal | null {
  const p = paciente(pacienteId)
  if (!p) return null
  const dia = hoje()
  const idade = p.nascimento ? diasEntre(p.nascimento, dia) : null
  const faixa: PlanoVacinal['faixa'] = idade !== null && idade < 365 ? 'FILHOTE' : 'ADULTO'
  const daEspecie = vacinasDoCatalogo().filter(
    (v) => v.ativo && (v.especies as string[]).includes(p.especie),
  )
  const comDose = new Set(daEspecie.filter((v) => vigenteDe(p.id, v.id)).map((v) => v.id))

  const vacinas: VacinaNoPlano[] = []
  const opcionais: PlanoVacinal['opcionaisNaoIniciadas'] = []

  for (const v of daEspecie) {
    const vig = vigenteDe(p.id, v.id)
    if (!vig) {
      const substituta = EQUIVALENTES.some(
        (grupo) => grupo.includes(v.id) && grupo.some((id) => comDose.has(id)),
      )
      if (substituta) continue
      if (!v.essencial) {
        opcionais.push({ id: v.id, nome: v.nome, fabricante: v.fabricante })
        continue
      }
      const total = faixa === 'FILHOTE' ? v.dosesSerieFilhote : v.dosesSerieAdultoSemHistorico
      const aPartirDe = p.nascimento ? somarDias(p.nascimento, v.idadeMinimaDias) : dia
      const aguarda = aPartirDe > dia
      vacinas.push({
        vacina: vacinaResumo(v.id),
        tipoDeSerie: faixa,
        situacao: aguarda ? 'AGUARDA_IDADE' : 'NAO_INICIADA',
        aplicadasNaSerie: 0,
        total,
        serieCompleta: false,
        doses: [
          {
            numero: 1,
            total,
            tipo: 'SERIE',
            estado: aguarda ? 'AGUARDA_IDADE' : 'DEVIDA',
            em: aguarda ? aPartirDe : dia,
            dias: aguarda ? diasEntre(dia, aPartirDe) : 0,
            aplicacaoId: null,
            agendamento: null,
          },
        ],
        proxima: null,
      })
      continue
    }

    const serieCompleta = vig.dose >= vig.dosesNaSerie
    const dias = diasEntre(dia, vig.proximaDoseEm)
    const daSerie = APLICACOES.filter(
      (a) =>
        a.pacienteId === p.id &&
        a.vacinaId === v.id &&
        !a.anulada &&
        a.tipoDeSerie === vig.tipoDeSerie &&
        a.dosesNaSerie === vig.dosesNaSerie &&
        a.dose <= vig.dose,
    )
      .sort((x, y) => Date.parse(x.aplicadaEm) - Date.parse(y.aplicadaEm))
      .slice(-vig.dose)
    const marcada = agendamentoDaProxima(vig)
    const proxima: DoseNoPlano = {
      numero: serieCompleta ? 1 : vig.dose + 1,
      total: serieCompleta ? 1 : vig.dosesNaSerie,
      tipo: serieCompleta ? 'REFORCO' : 'SERIE',
      estado: estadoDaDose(dias),
      em: vig.proximaDoseEm,
      dias,
      aplicacaoId: null,
      agendamento: marcada ? { id: marcada.id, inicio: marcada.inicio } : null,
    }
    const doses: DoseNoPlano[] = daSerie.map((a) => ({
      numero: a.dose,
      total: a.dosesNaSerie,
      tipo: a.dosesNaSerie === 1 && a.tipoDeSerie === 'ADULTO' ? 'REFORCO' : 'SERIE',
      estado: 'APLICADA',
      em: a.aplicadaEm.slice(0, 10),
      dias: null,
      aplicacaoId: a.id,
      agendamento: null,
    }))
    doses.push(proxima)
    if (!serieCompleta) {
      const seguinte = vig.dose + 2
      doses.push({
        numero: seguinte <= vig.dosesNaSerie ? seguinte : 1,
        total: seguinte <= vig.dosesNaSerie ? vig.dosesNaSerie : 1,
        tipo: seguinte <= vig.dosesNaSerie ? 'SERIE' : 'REFORCO',
        estado: 'PENDENTE',
        em: somarDias(
          vig.proximaDoseEm,
          seguinte <= vig.dosesNaSerie ? v.intervaloEntreDosesDias : v.intervaloReforcoDias,
        ),
        dias: null,
        aplicacaoId: null,
        agendamento: null,
      })
    }
    vacinas.push({
      vacina: vacinaResumo(v.id),
      tipoDeSerie: vig.tipoDeSerie,
      situacao: situacaoPelaData(dias),
      aplicadasNaSerie: vig.dose,
      total: vig.dosesNaSerie,
      serieCompleta,
      doses,
      proxima,
    })
  }

  vacinas.sort(
    (x, y) =>
      ORDEM_DO_PLANO[x.situacao] - ORDEM_DO_PLANO[y.situacao] ||
      (x.proxima?.em ?? '').localeCompare(y.proxima?.em ?? '') ||
      x.vacina.nome.localeCompare(y.vacina.nome),
  )

  return {
    truncado: false,
    vacinasOmitidas: 0,
    opcionaisOmitidas: 0,
    pacienteId: p.id,
    idadeEmDias: idade,
    faixa,
    hoje: dia,
    vacinas,
    opcionaisNaoIniciadas: opcionais,
    atrasadas: vacinas.filter((v) => v.situacao === 'ATRASADA').length,
    devidas: vacinas.filter((v) => v.situacao === 'DEVIDA').length,
  }
}

/* ------------------------------------------------------------------------------- os lotes */

export function lote(id: string) {
  return LOTES.find((l) => l.id === id) ?? null
}

export function aplicadasDoLote(loteId: string) {
  return APLICACOES.filter((a) => a.lote?.loteId === loteId && !a.anulada).length
}

export function perdidasDoLote(loteId: string) {
  return BAIXAS.filter((b) => b.loteId === loteId && !b.estorno).reduce(
    (soma, b) => soma + b.quantidade,
    0,
  )
}

export function saldoDoLote(l: LoteDaDemo) {
  return Math.max(0, l.quantidadeRecebida - aplicadasDoLote(l.id) - perdidasDoLote(l.id))
}

export function diasParaVencerDo(l: LoteDaDemo) {
  return diasEntre(hoje(), l.validade)
}

export function situacaoDoLote(l: LoteDaDemo): LoteDoEstoque['situacao'] {
  if (saldoDoLote(l) <= 0) return 'ESGOTADO'
  const dias = diasParaVencerDo(l)
  if (dias < 0) return 'VENCIDO'
  return dias <= 60 ? 'VENCENDO' : 'ATIVO'
}

export function loteDto(l: LoteDaDemo): LoteDoEstoque {
  const v = catalogo(l.vacinaId)
  const saldo = saldoDoLote(l)
  return {
    id: l.id,
    vacina: { id: v.id, nome: v.nome, fabricante: v.fabricante },
    codigo: l.codigo,
    fornecedor: l.fornecedor,
    notaFiscal: l.notaFiscal,
    recebidoEm: l.recebidoEm,
    validade: l.validade,
    quantidadeRecebida: l.quantidadeRecebida,
    aplicadas: aplicadasDoLote(l.id),
    perdidas: perdidasDoLote(l.id),
    saldo,
    situacao: situacaoDoLote(l),
    diasParaVencer: diasParaVencerDo(l),
    conferidoPor: l.conferidoPor,
    custoUnitarioCentavos: l.custoUnitarioCentavos,
    valorParadoCentavos: saldo * l.custoUnitarioCentavos,
    criadoEm: l.criadoEm,
  }
}

export function baixaDto(b: BaixaDaDemo): Baixa {
  const l = lote(b.loteId)
  return {
    id: b.id,
    loteId: b.loteId,
    em: b.em,
    quantidade: b.quantidade,
    motivo: b.motivo,
    observacao: b.observacao,
    estornada: Boolean(b.estorno),
    saldoDoLote: l ? saldoDoLote(l) : 0,
    criadaEm: b.criadaEm,
  }
}

/** Os lotes para a gaveta de aplicar: do estoque, ou os já digitados nos últimos 180 dias. */
export function lotesParaAplicar(vacinaId: string): LotesParaAplicar {
  const dia = hoje()
  const doEstoque = LOTES.filter((l) => l.vacinaId === vacinaId)
  if (doEstoque.length) {
    const comDose = doEstoque
      .filter((l) => saldoDoLote(l) > 0)
      .sort((x, y) => x.validade.localeCompare(y.validade))
    let sugerido = false
    return {
      estoque: true,
      hoje: dia,
      lotes: comDose.map((l) => {
        const dias = diasParaVencerDo(l)
        const pode = dias >= 0
        const esteSugerido = pode && !sugerido
        if (esteSugerido) sugerido = true
        return {
          loteId: l.id,
          codigo: l.codigo,
          validade: l.validade,
          saldo: saldoDoLote(l),
          avaliacao: {
            pode,
            motivo: pode ? null : 'VENCIDO',
            aviso: dias === 0 ? 'VENCE_HOJE' : pode && dias <= 60 ? 'VENCENDO' : null,
            dias,
          },
          sugerido: esteSugerido,
        }
      }),
    }
  }

  const desde = somarDias(dia, -180)
  const vistos = new Map<string, string>()
  for (const a of [...APLICACOES].sort(porData)) {
    if (a.vacinaId !== vacinaId || a.origem !== 'CLINICA' || !a.lote) continue
    if (a.aplicadaEm.slice(0, 10) < desde || vistos.has(a.lote.codigo)) continue
    vistos.set(a.lote.codigo, a.lote.validade)
  }
  return {
    estoque: false,
    hoje: dia,
    lotes: [...vistos.entries()].slice(0, 20).map(([codigo, validade]) => {
      const dias = diasEntre(dia, validade)
      return {
        loteId: null,
        codigo,
        validade,
        saldo: null,
        avaliacao: {
          pode: dias >= 0,
          motivo: dias >= 0 ? null : 'VENCIDO',
          aviso: dias === 0 ? 'VENCE_HOJE' : dias >= 0 && dias <= 60 ? 'VENCENDO' : null,
          dias,
        },
        sugerido: false,
      }
    }),
  }
}

/* --------------------------------------------------------------------------------- a carga */

gerarAplicacoes()
montarEstoque()
gerarAnuladas()
ligarAgendamentosDaProxima()
ligarLembretes()
