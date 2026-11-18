/**
 * A internação da demonstração em memória: leitos, internações, prescrições, doses, plantões,
 * evoluções, boletins e ligações, montados do roteiro (`internacao-roteiro.ts`) na hora da carga,
 * e as contas que a API faz na leitura (a situação da dose, a urgência do mapa, a pendência do
 * boletim). As rotas (`rotas/internacao.ts`) leem e escrevem aqui.
 *
 * O que as agregadoras (pendências, Meu dia, linha do tempo) usam deste arquivo:
 *
 * - `internacoesAtivas()` → os internados agora: `{ id, pacienteId, pacienteNome, especie,
 *   leitoId, leitoNome, gravidade, desde (entrada), responsavelNome, urgencia }`, na ordem da
 *   pauta (o mais urgente primeiro). Hoje às 10:40: 5 internados, 1 crítico (Chico, UTI 1), 1 com
 *   alta prevista para hoje (Floquinho).
 * - `dosesAtrasadas()` → as doses atrasadas agora (sem as conferências de fluido, como o contador
 *   da API), com paciente e leito; `contarDosesAtrasadas()` é o `dosesAtrasadasInternacao` das
 *   pendências (rota `/clinica/internacao`). Hoje às 10:40: 3 (Chico 1, Toddy 2).
 * - `boletinsPendentes()` → a fila da recepção (`BoletimPendenteDto[]`); `contarBoletinsPendentes()`
 *   é o `boletinsRetidos` das pendências (rota `/clinica/internacao/boletins-pendentes`). Hoje às
 *   10:40: 2 (Chico: ligar; Bento: enviar).
 * - `internacoesDoPaciente(pacienteId)` → para a linha do tempo (tipo `INTERNACAO`, `situacao` =
 *   status, `em` = entrada, `profissionalNome` = responsável): `{ id, status, entradaEm,
 *   encerradaEm, responsavelNome, leitoNome, motivo }`, da mais recente. Pacientes com internação:
 *   Chico, Duna, Bento, Toddy, Floquinho (em curso), Nina, Simba, Tobias e Pingo (alta no mês).
 * - `pacienteInternado(pacienteId)` → se está internado agora.
 */
import type {
  CelulaDoMapa,
  Gravidade,
  Internacao,
  InternadoDoMapa,
  KindDoLeito,
  Leito,
  MotivoDeUrgencia,
  NivelDeUrgencia,
  StatusDaInternacao,
} from '@/service/parceiro/internacao-service'
import type {
  Boletim,
  BoletimPendente,
  PreferenciaDoBoletim,
} from '@/service/parceiro/boletins-da-internacao-service'
import type {
  DoseNoChecklist,
  Evolucao,
  KindDoItem,
  MotivoDaNaoDada,
  PrescricaoDaInternacao,
  PrescricaoNoChecklist,
  SituacaoDaDose,
  ViaNaInternacao,
  VersoesDaEvolucao,
} from '@/service/parceiro/plantao-da-internacao-service'
import type { VitaisDto } from '@/service/contrato/openapi'

import { criarSorteio, idDe } from '../aleatorio'
import { agendamentosDoPaciente } from '../base/agenda'
import { cliente, paciente } from '../base/cadastro'
import { profissional, SALAS, USUARIO_ID } from '../base/clinica'
import {
  agora,
  agoraIso,
  dataDe,
  diasEntre,
  hoje,
  instante,
  isoDe,
  jaPassou,
  minutosAte,
  OFFSET,
  somarDias,
  somarMinutos,
} from '../relogio'
import {
  BRUNO,
  CAMILA,
  ENFERMAGEM,
  HISTORIAS,
  LEITOS_DO_ROTEIRO,
  LUCAS,
  MARINA,
  MEDICAMENTOS,
  NOTA_DA_ULTIMA_PASSAGEM,
  NOTAS_DE_ROTINA,
  RAFAEL,
  textoDoRetido,
  type FaixaDeVitais,
  type HistoriaDeInternacao,
  type MedicamentoDaInternacao,
  type TextoDaEvolucao,
} from './internacao-roteiro'

/* ------------------------------------------------------------------------------ as contas */

const MINUTO = 60_000
const HORA = 60 * MINUTO
const HOJE = hoje()
const sorte = criarSorteio('internacao')

/** Quem está logada (a dona, veterinária): quem registra, evolui e passa o plantão. */
export const EU = MARINA

export const ms = (iso: string) => Date.parse(iso)
const agoraMs = () => agora().getTime()

function arred(n: number, casas: number) {
  const f = 10 ** casas
  return Math.round(n * f) / f
}

function num(n: number) {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

/** Um instante em ms como a API escreve (minuto cheio). */
function isoDoMs(valor: number) {
  return isoDe(new Date(Math.floor(valor / MINUTO) * MINUTO))
}

/** A hora cheia do instante, no fuso da clínica. */
export function horaCheia(iso: string) {
  return `${isoDe(new Date(iso)).slice(0, 13)}:00:00${OFFSET}`
}

/** O `atualizadoEm` da evolução, com milissegundos (a tela devolve igual ao reescrever). */
function comMilissegundos(iso: string) {
  return `${isoDe(new Date(iso)).slice(0, 19)}.${String(sorte.inteiro(100, 989))}${OFFSET}`
}

export function nomeDe(profissionalId: string) {
  if (profissionalId === LUCAS) return ENFERMAGEM.nome
  return profissional(profissionalId)?.nome ?? 'Equipe da clínica'
}

export function usuarioDe(profissionalId: string) {
  if (profissionalId === LUCAS) return ENFERMAGEM.usuarioId
  return profissional(profissionalId)?.usuarioId ?? USUARIO_ID
}

export function existeProfissional(profissionalId: string) {
  return profissionalId === LUCAS || Boolean(profissional(profissionalId))
}

const GRAU: Record<Gravidade, number> = { ESTAVEL: 0, ATENCAO: 1, CRITICO: 2 }

/* --------------------------------------------------------------------------- a grade */

export type Turno = 'MANHA' | 'TARDE' | 'NOITE'
type Grade = { kind: Turno; data: string; inicio: string; fimPrevisto: string }

/** O plantão da grade (manhã 07-13, tarde 13-19, noite 19-07) que contém o instante. */
export function gradeDe(iso: string): Grade {
  const local = isoDe(new Date(iso))
  const data = local.slice(0, 10)
  const h = Number(local.slice(11, 13))
  if (h >= 7 && h < 13)
    return {
      kind: 'MANHA',
      data,
      inicio: instante(data, '07:00'),
      fimPrevisto: instante(data, '13:00'),
    }
  if (h >= 13 && h < 19)
    return {
      kind: 'TARDE',
      data,
      inicio: instante(data, '13:00'),
      fimPrevisto: instante(data, '19:00'),
    }
  const dia = h >= 19 ? data : somarDias(data, -1)
  return {
    kind: 'NOITE',
    data: dia,
    inicio: instante(dia, '19:00'),
    fimPrevisto: instante(somarDias(dia, 1), '07:00'),
  }
}

export function proximaGrade(grade: Grade) {
  return gradeDe(somarMinutos(grade.fimPrevisto, 1))
}

/** Quem pega cada plantão: a manhã revezada entre as veterinárias, a noite com a enfermagem. */
function responsavelDaGrade(grade: Grade) {
  const d = Math.max(0, diasEntre(grade.data, HOJE))
  if (grade.kind === 'MANHA') return [MARINA, CAMILA, BRUNO][d % 3] ?? MARINA
  if (grade.kind === 'TARDE') return d % 4 === 3 ? BRUNO : RAFAEL
  return d % 2 === 1 ? LUCAS : d % 4 === 0 ? RAFAEL : CAMILA
}

/* ---------------------------------------------------------------------------- os tipos */

export type PendenciaCongelada = {
  administracaoId: string
  previstaPara: string
  descricao: string
  situacaoNaEntrega: 'futura' | 'na-janela' | 'atrasada'
  atribuidaAId: string | null
}

export type PlantaoDaDemo = {
  id: string
  kind: Turno
  data: string
  inicio: string
  fimPrevisto: string
  origem: 'ASSUMIDO' | 'RECEBIDO' | 'AUTOMATICO'
  responsavelId: string
  entregueEm: string | null
  turnoAnteriorId: string | null
  /** O que este plantão entregou ao seguinte. */
  passagem: { nota: string; entreguePorId: string; pendencias: PendenciaCongelada[] } | null
}

export type LeitoDaDemo = {
  id: string
  nome: string
  kind: KindDoLeito
  salaId: string
  ativo: boolean
  motivoInativo: Leito['motivoInativo']
  detalheInativo: string | null
  inativoDesde: string | null
  jaRecebeuPaciente: boolean
}

type MudancaDeLeito = Internacao['mudancasDeLeito'][number]
type MudancaDeGravidade = Internacao['mudancasDeGravidade'][number]

export type InternacaoDaDemo = {
  id: string
  pacienteId: string
  leitoId: string
  status: StatusDaInternacao
  responsavelId: string
  internadoPorId: string
  /** `undefined`: procura na agenda o atendimento do dia da entrada. */
  atendimentoId: string | null | undefined
  motivo: string
  diagnosticoDeTrabalho: string | null
  observacao: string | null
  entradaEm: string
  altaPrevistaEm: string | null
  encerradaEm: string | null
  gravidade: Gravidade
  gravidadeNaEntrada: Gravidade
  pesoEntradaKg: number
  orientacaoDeSaida: string | null
  avisadoPorTelefone: { em: string; porId: string } | null
  motivoEncerramentoAdministrativo: string | null
  /** Da mais antiga para a mais nova. */
  mudancasDeLeito: MudancaDeLeito[]
  mudancasDeGravidade: MudancaDeGravidade[]
  ligacoes: Array<{ em: string; porId: string; registradaPorUsuarioId: string }>
  preferencia: HistoriaDeInternacao['preferencia']
}

type Suspensao = {
  em: string
  motivo: string
  porId: string | null
  substituidaPorId: string | null
}

export type PrescricaoDaDemo = {
  id: string
  internacaoId: string
  kind: KindDoItem
  medicamentoId: string | null
  descricao: string
  principioAtivo: string | null
  via: ViaNaInternacao | null
  dose: PrescricaoDaInternacao['dose']
  doseTexto: string | null
  regime: PrescricaoDaInternacao['regime']
  frequenciaHoras: number
  continuo: boolean
  primeiroHorario: string
  encerraEm: string | null
  materializadoAte: string
  prescritoPorId: string
  prescritoEm: string
  suspensao: Suspensao | null
  substituiPrescricaoId: string | null
  observacao: string | null
}

export type StatusDaDose = DoseNoChecklist['status']

export type DoseDaDemo = {
  id: string
  internacaoId: string
  prescricaoId: string
  previstaPara: string
  conferencia: boolean
  status: StatusDaDose
  motivo: MotivoDaNaoDada | null
  executadaEm: string | null
  registradaEm: string | null
  executadaPorId: string | null
  turnoId: string | null
  atribuidaAId: string | null
  observacao: string | null
}

type VersaoDaEvolucao = VersoesDaEvolucao['itens'][number]

export type EvolucaoDaDemo = {
  id: string
  internacaoId: string
  plantaoId: string
  profissionalId: string
  registradoEm: string
  atualizadoEm: string
  vitais: VitaisDto
  observado: string | null
  avaliacao: string | null
  plano: string | null
  gravidade: Gravidade
  /** Da mais recente. */
  versoes: VersaoDaEvolucao[]
}

export type BoletimDaDemo = Boletim & { fotoUrl: string | null }

/* --------------------------------------------------------------------------- o estado */

export const LEITOS: LeitoDaDemo[] = []
export const PLANTOES: PlantaoDaDemo[] = []
export const INTERNACOES: InternacaoDaDemo[] = []
export const PRESCRICOES: PrescricaoDaDemo[] = []
export const DOSES: DoseDaDemo[] = []
export const EVOLUCOES: EvolucaoDaDemo[] = []
export const BOLETINS: BoletimDaDemo[] = []

const sequencia = {
  internacao: 20,
  prescricao: 0,
  dose: 0,
  evolucao: 0,
  boletim: 0,
  leito: 0,
  plantao: 0,
  versao: 0,
}

export function novoId(tipo: keyof typeof sequencia) {
  const prefixo = {
    internacao: 'demo-int',
    prescricao: 'demo-presc',
    dose: 'demo-dose',
    evolucao: 'demo-evo',
    boletim: 'demo-bol',
    leito: 'demo-leito-novo',
    plantao: 'demo-turno-novo',
    versao: 'demo-evo-versao',
  }[tipo]
  return idDe(prefixo, ++sequencia[tipo])
}

export const SALA_DA_INTERNACAO = SALAS.find((s) => s.tipo === 'INTERNACAO') ?? SALAS[0]!

/* --------------------------------------------------------------------------- consultas */

export function leito(id: string) {
  return LEITOS.find((l) => l.id === id) ?? null
}

export function internacao(id: string) {
  return INTERNACOES.find((i) => i.id === id) ?? null
}

export function prescricao(id: string) {
  return PRESCRICOES.find((p) => p.id === id) ?? null
}

export function dose(id: string) {
  return DOSES.find((d) => d.id === id) ?? null
}

export function plantao(id: string) {
  return PLANTOES.find((p) => p.id === id) ?? null
}

export function boletim(id: string) {
  return BOLETINS.find((b) => b.id === id) ?? null
}

export function emCurso(i: InternacaoDaDemo) {
  return i.status === 'INTERNADO'
}

export function internacaoNoLeito(leitoId: string) {
  return INTERNACOES.find((i) => emCurso(i) && i.leitoId === leitoId) ?? null
}

export function prescricoesDa(internacaoId: string) {
  return PRESCRICOES.filter((p) => p.internacaoId === internacaoId)
}

export function dosesDa(internacaoId: string) {
  return DOSES.filter((d) => d.internacaoId === internacaoId)
}

export function boletinsDa(internacaoId: string) {
  return BOLETINS.filter((b) => b.internacaoId === internacaoId).sort((a, b) =>
    b.geradoEm.localeCompare(a.geradoEm),
  )
}

export function evolucoesDa(internacaoId: string) {
  return EVOLUCOES.filter((e) => e.internacaoId === internacaoId).sort((a, b) =>
    b.registradoEm.localeCompare(a.registradoEm),
  )
}

/** O plantão aberto (ninguém entregou ainda). */
export function plantaoAberto() {
  return PLANTOES.find((p) => !p.entregueEm) ?? null
}

/** O plantão em que o instante caiu (do início dele até a entrega). */
export function plantaoEm(iso: string) {
  const t = ms(iso)
  return (
    PLANTOES.find((p) => ms(p.inicio) <= t && (p.entregueEm === null || t < ms(p.entregueEm))) ??
    null
  )
}

export function pacienteDa(i: InternacaoDaDemo) {
  const p = paciente(i.pacienteId)
  if (!p) throw new Error(`demonstração: paciente ${i.pacienteId} não existe`)
  return p
}

/** O paciente sem vínculo com o app: nada sai pelo app, a recepção liga. */
export function semCanalNoApp(i: InternacaoDaDemo) {
  return !pacienteDa(i).noApp
}

export function femea(i: InternacaoDaDemo) {
  return pacienteDa(i).sexo === 'FEMEA'
}

/* -------------------------------------------------------------------------- a dose */

export function prescricaoAtiva(p: PrescricaoDaDemo) {
  return !p.suspensao && (!p.encerraEm || ms(p.encerraEm) > agoraMs())
}

export function situacaoDe(d: DoseDaDemo): SituacaoDaDose {
  if (d.status === 'FEITA') return 'feita'
  if (d.status === 'PULADA') return 'pulada'
  if (d.status === 'RECUSADA') return 'recusada'
  if (d.status === 'SUSPENSA') return 'suspensa'
  if (internacao(d.internacaoId)?.encerradaEm) return 'nao-registrada'
  const diferenca = ms(d.previstaPara) - agoraMs()
  if (diferenca > 30 * MINUTO) return 'futura'
  if (diferenca >= -30 * MINUTO) return 'na-janela'
  return 'atrasada'
}

export function atrasoDe(d: DoseDaDemo) {
  return situacaoDe(d) === 'atrasada' ? Math.floor((agoraMs() - ms(d.previstaPara)) / MINUTO) : 0
}

/** O piso das atrasadas: 12 h antes do início do plantão da grade. */
function pisoDasAtrasadas() {
  return ms(gradeDe(agoraIso()).inicio) - 12 * HORA
}

/** As doses atrasadas das internações em curso (sem as conferências de fluido). */
function atrasadasDa(i: InternacaoDaDemo) {
  const piso = pisoDasAtrasadas()
  return dosesDa(i.id).filter(
    (d) =>
      !d.conferencia &&
      d.status === 'PENDENTE' &&
      ms(d.previstaPara) >= piso &&
      situacaoDe(d) === 'atrasada',
  )
}

/* ------------------------------------------------------------------- a dose prescrita */

const VIA_POR_EXTENSO: Record<ViaNaInternacao, string> = {
  INTRAVENOSA: 'via intravenosa',
  SUBCUTANEA: 'via subcutânea',
  INTRAMUSCULAR: 'via intramuscular',
  ORAL: 'via oral',
  TOPICA: 'via tópica',
  OTOLOGICA: 'via otológica',
  OFTALMICA: 'via oftálmica',
  INTRANASAL: 'via intranasal',
}

const FRACAO_POR_EXTENSO: Record<string, string> = {
  QUARTO: 'um quarto de comprimido',
  MEIO: 'meio comprimido',
  TRES_QUARTOS: 'três quartos de comprimido',
  INTEIRO: '1 comprimido',
  UM_E_MEIO: '1 comprimido e meio',
}

function aCada(horas: number) {
  return horas === 1 ? 'a cada hora' : `a cada ${horas} horas`
}

/** A conta da dose sobre o peso de entrada, como a API faz (a tela só confere). */
export function calcularDose(
  med: MedicamentoDaInternacao,
  mgPorKg: number,
  pesoKg: number,
  frequenciaHoras: number,
  via: ViaNaInternacao,
) {
  const mg = arred(pesoKg * mgPorKg, 2)
  let quantidade: number
  let mgReal: number
  let fracao: string | null = null
  let parte: string

  if (med.unidade === 'COMPRIMIDO') {
    quantidade = Math.max(0.25, Math.round((mg / med.concentracao) * 4) / 4)
    mgReal = arred(quantidade * med.concentracao, 2)
    fracao =
      { 0.25: 'QUARTO', 0.5: 'MEIO', 0.75: 'TRES_QUARTOS', 1: 'INTEIRO', 1.5: 'UM_E_MEIO' }[
        quantidade
      ] ?? 'MULTIPLO'
    parte = `${FRACAO_POR_EXTENSO[fracao] ?? `${num(quantidade)} comprimidos`} (${num(mgReal)} mg)`
  } else if (med.unidade === 'ML') {
    quantidade = arred(mg / med.concentracao, 3)
    mgReal = arred(quantidade * med.concentracao, 2)
    parte = `${num(mg)} mg (${num(quantidade)} mL)`
  } else {
    quantidade = Math.max(1, Math.round(mg / med.concentracao))
    mgReal = arred(quantidade * med.concentracao, 2)
    const palavra =
      med.unidade === 'GOTA'
        ? quantidade === 1
          ? 'gota'
          : 'gotas'
        : quantidade === 1
          ? 'aplicação'
          : 'aplicações'
    parte = `${num(mg)} mg (${quantidade} ${palavra})`
  }

  const dose: NonNullable<PrescricaoDaInternacao['dose']> = {
    mgPorKg,
    pesoKg,
    mgPorAdministracao: mg,
    mgReal,
    quantidade,
    unidade: med.unidade,
    fracao,
    arredondamentoConfirmado: mg > 0 && Math.abs(mgReal - mg) / mg > 0.1,
    foraDaFaixaConfirmada: false,
    pesoImplausivelConfirmado: false,
  }
  return { dose, doseTexto: `${parte}, ${aCada(frequenciaHoras)}, ${VIA_POR_EXTENSO[via]}` }
}

/* ------------------------------------------------------------------ gravidade e boletim */

/** A gravidade da internação num instante (a da entrada e as mudanças até ali). */
function gravidadeEm(i: InternacaoDaDemo, iso: string): Gravidade {
  let atual = i.gravidadeNaEntrada
  for (const mudanca of i.mudancasDeGravidade) if (ms(mudanca.em) <= ms(iso)) atual = mudanca.para
  return atual
}

/** Desde quando a ligação é devida: a piora mais recente ou a entrada crítica. */
export function ligacaoDevidaDesde(i: InternacaoDaDemo): string | null {
  let desde = i.gravidadeNaEntrada === 'CRITICO' ? i.entradaEm : null
  for (const mudanca of i.mudancasDeGravidade)
    if (GRAU[mudanca.para] > GRAU[mudanca.de]) desde = mudanca.em
  return desde
}

export function ultimaLigacao(i: InternacaoDaDemo): string | null {
  const todas = [
    ...i.ligacoes.map((l) => l.em),
    ...BOLETINS.filter((b) => b.internacaoId === i.id && b.ligacao).map((b) => b.ligacao!.em),
  ]
  return todas.sort((a, b) => ms(b) - ms(a))[0] ?? null
}

export function boletimAbertoDe(internacaoId: string) {
  return (
    BOLETINS.find(
      (b) =>
        b.internacaoId === internacaoId &&
        (b.status === 'RASCUNHO' || b.status === 'RETIDO' || b.status === 'LIBERADO'),
    ) ?? null
  )
}

/** A pendência do boletim pela regra do servidor (a tela nunca decide). */
export function pendenciaDoBoletim(i: InternacaoDaDemo): 'LIGAR' | 'ENVIAR' | null {
  if (!emCurso(i)) return null
  const desde = ligacaoDevidaDesde(i)
  const ultima = ultimaLigacao(i)
  if (desde && (!ultima || ms(ultima) < ms(desde))) return 'LIGAR'
  if (semCanalNoApp(i)) return null
  const aberto = boletimAbertoDe(i.id)
  if (aberto && (aberto.status === 'LIBERADO' || aberto.status === 'RETIDO')) return 'ENVIAR'
  return null
}

function entregaEnviada(i: InternacaoDaDemo, em: string): NonNullable<Boletim['entrega']> {
  const c = cliente(pacienteDa(i).clienteId)
  return {
    situacao: 'ENVIADO',
    canal: 'PUSH_INBOX',
    motivo: null,
    destinatarios: c?.autorizados.length ? 2 : 1,
    soInbox: false,
    em,
  }
}

export function marcarEnviado(b: BoletimDaDemo, i: InternacaoDaDemo, em: string) {
  b.status = 'ENVIADO'
  b.enviadoEm = em
  b.atualizadoEm = em
  b.entrega = entregaEnviada(i, em)
}

export function novoBoletim(
  i: InternacaoDaDemo,
  dados: Partial<BoletimDaDemo> & Pick<Boletim, 'texto' | 'status' | 'geradoEm'>,
): BoletimDaDemo {
  const registro: BoletimDaDemo = {
    id: novoId('boletim'),
    internacaoId: i.id,
    tipo: 'ATUALIZACAO',
    origem: 'MANUAL',
    gravidade: gravidadeEm(i, dados.geradoEm),
    idioma: 'pt-BR',
    temFoto: false,
    fotoLegenda: null,
    atualizadoEm: dados.geradoEm,
    autorUsuarioId: null,
    exigeLigacao: false,
    motivoDaRetencao: null,
    retidoDesde: null,
    ligacao: null,
    enviadoEm: null,
    canceladoEm: null,
    motivoCancelamento: null,
    entrega: null,
    fotoUrl: null,
    ...dados,
  }
  BOLETINS.push(registro)
  return registro
}

/**
 * Muda a gravidade como a API: entra no histórico e, na piora de quem tem app, o sistema cria o
 * boletim retido (o rascunho aberto vira SUPERADO). Devolve se mudou.
 */
export function aplicarGravidade(i: InternacaoDaDemo, nova: Gravidade, em = agoraIso()) {
  const antes = i.gravidade
  if (nova === antes) return false
  i.mudancasDeGravidade.push({ de: antes, para: nova, em })
  i.gravidade = nova
  if (GRAU[nova] > GRAU[antes] && !semCanalNoApp(i)) {
    const aberto = boletimAbertoDe(i.id)
    if (aberto && aberto.autorUsuarioId === null) {
      aberto.status = 'RETIDO'
      aberto.gravidade = nova
      aberto.ligacao = null
      aberto.retidoDesde = em
      aberto.exigeLigacao = true
      aberto.motivoDaRetencao = 'PIORA'
      aberto.temFoto = false
      aberto.fotoLegenda = null
      aberto.fotoUrl = null
      aberto.atualizadoEm = em
    } else {
      if (aberto) {
        aberto.status = 'CANCELADO'
        aberto.canceladoEm = em
        aberto.motivoCancelamento = 'SUPERADO'
        aberto.atualizadoEm = em
      }
      novoBoletim(i, {
        origem: 'AUTOMATICO',
        status: 'RETIDO',
        gravidade: nova,
        texto: textoDoRetido(pacienteDa(i).nome, femea(i)),
        geradoEm: em,
        exigeLigacao: true,
        motivoDaRetencao: 'PIORA',
        retidoDesde: em,
      })
    }
  }
  return true
}

/** Registra uma ligação: libera o retido aberto. Devolve o boletim liberado, se houver. */
export function registrarLigacao(
  i: InternacaoDaDemo,
  em: string,
  porId: string,
  noBoletim?: BoletimDaDemo,
) {
  const ligacao = {
    em,
    por: { profissionalId: porId, nome: nomeDe(porId) },
    registradaPorUsuarioId: USUARIO_ID,
  }
  const alvo = noBoletim ?? boletimAbertoDe(i.id)
  if (alvo && (alvo.status === 'RETIDO' || noBoletim)) {
    alvo.ligacao = ligacao
    if (alvo.status === 'RETIDO') alvo.status = 'LIBERADO'
    alvo.atualizadoEm = agoraIso()
    return alvo
  }
  i.ligacoes.push({ em, porId, registradaPorUsuarioId: USUARIO_ID })
  return null
}

/* ------------------------------------------------------------------------- as doses novas */

/** Cria as doses da prescrição, de `desde` até 72 h à frente (ou o fim). Devolve quantas. */
export function materializar(p: PrescricaoDaDemo, desde = p.primeiroHorario) {
  const teto = Math.min(p.encerraEm ? ms(p.encerraEm) : Infinity, agoraMs() + 72 * HORA)
  let criadas = 0
  for (let t = ms(desde); t <= teto; t += p.frequenciaHoras * HORA) {
    DOSES.push({
      id: novoId('dose'),
      internacaoId: p.internacaoId,
      prescricaoId: p.id,
      previstaPara: isoDoMs(t),
      conferencia: p.kind === 'FLUIDO',
      status: 'PENDENTE',
      motivo: null,
      executadaEm: null,
      registradaEm: null,
      executadaPorId: null,
      turnoId: null,
      atribuidaAId: null,
      observacao: null,
    })
    criadas++
  }
  p.materializadoAte = isoDoMs(teto === Infinity ? agoraMs() + 72 * HORA : teto)
  return criadas
}

/** Suspende a prescrição: toda dose pendente vira SUSPENSA. Devolve quantas. */
export function suspenderPrescricao(
  p: PrescricaoDaDemo,
  motivo: string,
  porId: string | null,
  substituidaPorId: string | null = null,
) {
  p.suspensao = { em: agoraIso(), motivo, porId, substituidaPorId }
  let suspensas = 0
  for (const d of DOSES) {
    if (d.prescricaoId === p.id && d.status === 'PENDENTE') {
      d.status = 'SUSPENSA'
      suspensas++
    }
  }
  return suspensas
}

/** O plantão aberto, ou um automático da grade com quem registra (o primeiro registro abre). */
export function plantaoParaRegistrar() {
  const aberto = plantaoAberto()
  if (aberto) return aberto
  const grade = gradeDe(agoraIso())
  const anterior = PLANTOES[PLANTOES.length - 1] ?? null
  const novo: PlantaoDaDemo = {
    id: novoId('plantao'),
    kind: grade.kind,
    data: grade.data,
    inicio: agoraIso(),
    fimPrevisto: grade.fimPrevisto,
    origem: 'AUTOMATICO',
    responsavelId: EU,
    entregueEm: null,
    turnoAnteriorId: anterior?.id ?? null,
    passagem: null,
  }
  PLANTOES.push(novo)
  return novo
}

/* ------------------------------------------------------------------------- a montagem */

function vitaisDe(faixa: FaixaDeVitais | undefined, fixos?: [number, number, number]): VitaisDto {
  const [t, fc, fr] = fixos ?? [
    faixa ? arred(faixa[0] + sorte.numero() * (faixa[1] - faixa[0]), 1) : 38.5,
    faixa ? sorte.inteiro(faixa[2], faixa[3]) : 110,
    faixa ? sorte.inteiro(faixa[4], faixa[5]) : 24,
  ]
  return {
    temperatura: { valor: t, naoAferido: false },
    frequenciaCardiaca: { valor: fc, naoAferido: false },
    frequenciaRespiratoria: { valor: fr, naoAferido: false },
  }
}

function montarLeitos() {
  for (const l of LEITOS_DO_ROTEIRO) {
    LEITOS.push({
      id: l.id,
      nome: l.nome,
      kind: l.kind,
      salaId: SALA_DA_INTERNACAO.id,
      ativo: !l.inativo,
      motivoInativo: l.inativo?.motivo ?? null,
      detalheInativo: l.inativo?.detalhe ?? null,
      inativoDesde: l.inativo?.desde ?? null,
      /* A ala funciona há meses: todo leito já recebeu paciente. */
      jaRecebeuPaciente: true,
    })
  }
}

function montarPlantoes(desde: string) {
  const atual = gradeDe(agoraIso())
  let grade = gradeDe(desde)
  let anterior: PlantaoDaDemo | null = null

  for (;;) {
    const corrente = grade.inicio === atual.inicio
    const entrega = somarMinutos(grade.fimPrevisto, sorte.inteiro(3, 9))
    const p: PlantaoDaDemo = {
      id: `demo-turno-${grade.data}-${grade.kind.toLowerCase()}`,
      kind: grade.kind,
      data: grade.data,
      inicio: anterior?.entregueEm ?? grade.inicio,
      fimPrevisto: grade.fimPrevisto,
      origem: anterior ? 'RECEBIDO' : 'ASSUMIDO',
      responsavelId: responsavelDaGrade(grade),
      entregueEm: corrente ? null : jaPassou(entrega) ? entrega : agoraIso(),
      turnoAnteriorId: anterior?.id ?? null,
      passagem: null,
    }
    PLANTOES.push(p)
    if (anterior) {
      const ultimaNoite = anterior.kind === 'NOITE' && corrente
      anterior.passagem = {
        nota: ultimaNoite ? NOTA_DA_ULTIMA_PASSAGEM : sorte.escolher(NOTAS_DE_ROTINA),
        entreguePorId: anterior.responsavelId,
        pendencias: [],
      }
    }
    if (corrente) break
    anterior = p
    grade = proximaGrade(grade)
  }
}

function montarInternacao(h: HistoriaDeInternacao) {
  const fim = h.alta && jaPassou(h.alta.em) ? h.alta : null
  const mudancasDeGravidade: MudancaDeGravidade[] = []
  for (let n = 1; n < h.gravidades.length; n++) {
    const antes = h.gravidades[n - 1]!
    const depois = h.gravidades[n]!
    if (jaPassou(depois.em))
      mudancasDeGravidade.push({ de: antes.gravidade, para: depois.gravidade, em: depois.em })
  }
  const mudancasDeLeito: MudancaDeLeito[] = []
  for (let n = 1; n < h.leitos.length; n++) {
    const de = leito(h.leitos[n - 1]!.leitoId)!
    const para = leito(h.leitos[n]!.leitoId)!
    const mudanca = h.leitos[n]!
    if (jaPassou(mudanca.desde))
      mudancasDeLeito.push({
        de: { id: de.id, nome: de.nome, kind: de.kind },
        para: { id: para.id, nome: para.nome, kind: para.kind },
        em: mudanca.desde,
        motivo: mudanca.motivo ?? null,
      })
  }
  const leitoAtual = mudancasDeLeito.length
    ? mudancasDeLeito[mudancasDeLeito.length - 1]!.para.id
    : h.leitos[0]!.leitoId

  const i: InternacaoDaDemo = {
    id: h.id,
    pacienteId: h.pacienteId,
    leitoId: leitoAtual,
    status: fim ? 'ALTA' : 'INTERNADO',
    responsavelId: h.responsavel,
    internadoPorId: h.internadoPor,
    atendimentoId: undefined,
    motivo: h.motivo,
    diagnosticoDeTrabalho: h.diagnostico,
    observacao: h.observacao,
    entradaEm: h.entradaEm,
    altaPrevistaEm: fim ? null : h.altaPrevistaEm,
    encerradaEm: fim?.em ?? null,
    gravidade: mudancasDeGravidade.length
      ? mudancasDeGravidade[mudancasDeGravidade.length - 1]!.para
      : h.gravidades[0]!.gravidade,
    gravidadeNaEntrada: h.gravidades[0]!.gravidade,
    pesoEntradaKg: h.pesoKg,
    orientacaoDeSaida: fim?.orientacao ?? null,
    avisadoPorTelefone: null,
    motivoEncerramentoAdministrativo: null,
    mudancasDeLeito,
    mudancasDeGravidade,
    ligacoes: h.ligacoes
      .filter((l) => jaPassou(l.em))
      .map((l) => ({ em: l.em, porId: l.por, registradaPorUsuarioId: usuarioDe(l.por) })),
    preferencia: { ...h.preferencia },
  }
  INTERNACOES.push(i)
  return i
}

/** Quem deu a dose do roteiro: a noite é do plantão; o dia, do plantão ou do veterinário do caso. */
function quemDeu(iso: string, caso: string, n: number) {
  const p = plantaoEm(iso)
  if (!p) return caso
  if (p.kind === 'NOITE') return p.responsavelId
  return n % 3 === 0 ? caso : p.responsavelId
}

function montarReceita(h: HistoriaDeInternacao, i: InternacaoDaDemo) {
  const porChave = new Map<string, PrescricaoDaDemo>()
  const limiteDaInternacao = i.encerradaEm ? ms(i.encerradaEm) : agoraMs() + 72 * HORA

  for (const item of h.receita) {
    if (!jaPassou(somarMinutos(item.primeiro, -30))) continue
    const med = item.remedio ? MEDICAMENTOS[item.remedio] : undefined
    const via = item.via ?? null
    const conta =
      med && item.mgPorKg && via
        ? calcularDose(med, item.mgPorKg, h.pesoKg, item.frequenciaHoras, via)
        : null
    const suspensa = item.suspensa && jaPassou(item.suspensa.em) ? item.suspensa : null
    const p: PrescricaoDaDemo = {
      id: `${h.id.replace('demo-int', 'demo-presc')}-${item.chave}`,
      internacaoId: i.id,
      kind: item.kind,
      medicamentoId: med?.id ?? null,
      descricao: med?.nome ?? item.descricao ?? '',
      principioAtivo: med?.principioAtivo ?? null,
      via,
      dose: conta?.dose ?? null,
      doseTexto: conta?.doseTexto ?? null,
      regime: med?.regime ?? null,
      frequenciaHoras: item.frequenciaHoras,
      continuo: item.kind === 'FLUIDO',
      primeiroHorario: item.primeiro,
      encerraEm: null,
      materializadoAte: item.primeiro,
      prescritoPorId: item.por,
      prescritoEm: somarMinutos(item.primeiro, -sorte.inteiro(10, 25)),
      suspensao: suspensa
        ? { em: suspensa.em, motivo: suspensa.motivo, porId: suspensa.por, substituidaPorId: null }
        : i.encerradaEm
          ? {
              em: i.encerradaEm,
              motivo: 'Internação encerrada',
              porId: h.alta?.por ?? null,
              substituidaPorId: null,
            }
          : null,
      substituiPrescricaoId: null,
      observacao: item.observacao ?? null,
    }
    porChave.set(item.chave, p)
    PRESCRICOES.push(p)

    const teto = Math.min(limiteDaInternacao, suspensa ? ms(suspensa.em) : Infinity)
    for (let t = ms(item.primeiro), n = 0; t <= teto; t += item.frequenciaHoras * HORA, n++) {
      const prevista = isoDoMs(t)
      const d: DoseDaDemo = {
        id: novoId('dose'),
        internacaoId: i.id,
        prescricaoId: p.id,
        previstaPara: prevista,
        conferencia: item.kind === 'FLUIDO',
        status: 'PENDENTE',
        motivo: null,
        executadaEm: null,
        registradaEm: null,
        executadaPorId: null,
        turnoId: null,
        atribuidaAId: null,
        observacao: null,
      }
      if (t < agoraMs() - 30 * MINUTO) {
        const feita = Math.min(t + sorte.inteiro(-4, 12) * MINUTO, agoraMs() - MINUTO)
        const quando = isoDoMs(feita)
        d.status = 'FEITA'
        d.executadaEm = quando
        d.registradaEm = isoDoMs(feita + sorte.inteiro(0, 3) * MINUTO)
        d.executadaPorId = quemDeu(quando, h.responsavel, n)
        d.turnoId = plantaoEm(quando)?.id ?? null
        if (item.kind === 'ALIMENTACAO' && sorte.chance(0.1)) {
          d.status = 'RECUSADA'
          d.motivo = 'RECUSOU'
        } else if (via === 'ORAL' && sorte.chance(0.04)) {
          d.status = 'RECUSADA'
          d.motivo = 'CUSPIU_OU_VOMITOU'
        }
      }
      DOSES.push(d)
    }
    p.materializadoAte = isoDoMs(Math.min(teto, agoraMs() + 72 * HORA))
  }

  /* A troca de dose: a antiga aponta a nova. */
  for (const item of h.receita) {
    const nova = porChave.get(item.chave)
    const antiga = item.substitui ? porChave.get(item.substitui) : undefined
    if (nova && antiga) {
      nova.substituiPrescricaoId = antiga.id
      if (antiga.suspensao) antiga.suspensao.substituidaPorId = nova.id
    }
  }

  /* As doses que o roteiro decide. */
  for (const ajuste of h.ajustes) {
    const p = porChave.get(ajuste.chave)
    const d =
      p && DOSES.find((x) => x.prescricaoId === p.id && ms(x.previstaPara) === ms(ajuste.em))
    if (!d) continue
    if (ajuste.status === 'PENDENTE') {
      Object.assign(d, {
        status: 'PENDENTE',
        motivo: null,
        executadaEm: null,
        registradaEm: null,
        executadaPorId: null,
        turnoId: null,
        observacao: null,
      })
      continue
    }
    const quando = somarMinutos(d.previstaPara, ajuste.aos ?? 5)
    if (!jaPassou(quando)) continue
    d.status = ajuste.status
    d.motivo = ajuste.motivo ?? null
    d.observacao = ajuste.observacao ?? null
    d.executadaEm = quando
    d.registradaEm = quando
    d.executadaPorId = ajuste.por ?? quemDeu(quando, h.responsavel, 1)
    d.turnoId = plantaoEm(quando)?.id ?? null
  }
}

function montarEvolucoes(h: HistoriaDeInternacao, i: InternacaoDaDemo) {
  const fim = i.encerradaEm ? ms(i.encerradaEm) : agoraMs()
  const usados: Partial<Record<Gravidade, number>> = {}

  for (const p of PLANTOES) {
    const inicio = ms(p.inicio)
    const entrega = p.entregueEm ? ms(p.entregueEm) : agoraMs()
    if (inicio >= fim || entrega <= ms(i.entradaEm)) continue

    const chave = `${diasEntre(p.data, HOJE)}-${p.kind}`
    const roteiro = h.evolucoes[chave]
    let registradoEm: string
    let porId: string
    let texto: TextoDaEvolucao
    let fixos: [number, number, number] | undefined
    let versoes: VersaoDaEvolucao[] = []
    let atualizadoEm: string

    if (roteiro) {
      if (!jaPassou(roteiro.em)) continue
      const antes = roteiro.antes
      registradoEm = antes?.em ?? roteiro.em
      atualizadoEm = comMilissegundos(roteiro.em)
      porId = roteiro.por
      texto = roteiro
      fixos = roteiro.vitais
      if (antes) {
        versoes = [
          {
            id: novoId('versao'),
            profissional: { profissionalId: antes.por, nome: nomeDe(antes.por) },
            escritaEm: antes.em,
            substituidaPor: { profissionalId: roteiro.por, nome: nomeDe(roteiro.por) },
            substituidaEm: roteiro.em,
            vitais: vitaisDe(h.vitais[gravidadeEm(i, antes.em)], antes.vitais),
            observado: antes.observado,
            avaliacao: antes.avaliacao,
            plano: antes.plano,
            gravidade: gravidadeEm(i, antes.em),
          },
        ]
      }
    } else {
      /* O plantão aberto só tem as evoluções escritas no roteiro (as outras ainda vão ser feitas). */
      if (!p.entregueEm) continue
      const de = Math.max(inicio, ms(i.entradaEm)) + 20 * MINUTO
      const ate = Math.min(entrega, fim) - 15 * MINUTO
      if (ate - de < 20 * MINUTO) continue
      registradoEm = isoDoMs(de + sorte.numero() * (ate - de))
      atualizadoEm = comMilissegundos(registradoEm)
      porId = p.kind === 'NOITE' || sorte.chance(0.5) ? p.responsavelId : h.responsavel
      const g = gravidadeEm(i, registradoEm)
      const lista = h.rotina[g] ?? h.rotina.ESTAVEL ?? h.rotina.ATENCAO ?? []
      const n = usados[g] ?? 0
      usados[g] = n + 1
      const escolhido = lista[n % Math.max(1, lista.length)]
      if (!escolhido) continue
      texto = escolhido
    }

    const gravidade = gravidadeEm(i, roteiro?.em ?? registradoEm)
    EVOLUCOES.push({
      id: novoId('evolucao'),
      internacaoId: i.id,
      plantaoId: (plantaoEm(registradoEm) ?? p).id,
      profissionalId: porId,
      registradoEm,
      atualizadoEm,
      vitais: vitaisDe(h.vitais[gravidade], fixos),
      observado: texto.observado,
      avaliacao: texto.avaliacao,
      plano: texto.plano,
      gravidade,
      versoes,
    })
  }
}

/** Os boletins: os escritos no roteiro e os automáticos da preferência, quem tem app. */
function montarBoletins(h: HistoriaDeInternacao, i: InternacaoDaDemo) {
  if (semCanalNoApp(i)) return
  const pet = pacienteDa(i).nome
  const fim = i.encerradaEm ? ms(i.encerradaEm) : agoraMs()

  for (const b of h.boletins) {
    if (!jaPassou(b.em)) continue
    const enviadoEm =
      b.status === 'ENVIADO' ? (b.enviadoEm ?? somarMinutos(b.em, sorte.inteiro(1, 4))) : null
    const registro = novoBoletim(i, {
      origem: b.por ? 'MANUAL' : 'AUTOMATICO',
      status: b.status,
      texto: b.texto,
      geradoEm: b.em,
      atualizadoEm: enviadoEm ?? b.cancelado?.em ?? b.ligacao?.em ?? b.em,
      autorUsuarioId: b.por ? usuarioDe(b.por) : null,
      exigeLigacao: Boolean(b.retencao),
      motivoDaRetencao: b.retencao ?? null,
      retidoDesde: b.retencao === 'ENTROU_CRITICO' ? i.entradaEm : b.retencao ? b.em : null,
      ligacao: b.ligacao
        ? {
            em: b.ligacao.em,
            por: { profissionalId: b.ligacao.por, nome: nomeDe(b.ligacao.por) },
            registradaPorUsuarioId: usuarioDe(b.ligacao.por),
          }
        : null,
      canceladoEm: b.cancelado?.em ?? null,
      motivoCancelamento: b.cancelado?.motivo ?? null,
      temFoto: Boolean(b.foto),
      fotoLegenda: b.foto?.legenda ?? null,
      fotoUrl: b.foto?.url ?? null,
    })
    if (enviadoEm) marcarEnviado(registro, i, enviadoEm)
  }

  /* Os automáticos: das 07h, de tantas em tantas horas, com o silêncio da noite. */
  const escritos = BOLETINS.filter((b) => b.internacaoId === i.id)
  const horarios: number[] = []
  for (
    let dia = dataDe(new Date(i.entradaEm));
    dia <= dataDe(new Date(fim));
    dia = somarDias(dia, 1)
  ) {
    for (
      let hora = 7;
      hora < (i.preferencia.silencioNoturno ? 22 : 24);
      hora += i.preferencia.frequenciaHoras
    ) {
      const t = ms(instante(dia, `${String(hora).padStart(2, '0')}:00`))
      if (t <= ms(i.entradaEm) + HORA || t >= fim) continue
      const perto = escritos.some((b) => Math.abs(ms(b.geradoEm) - t) < 2 * HORA)
      const aberto = escritos.some((b) => {
        const fechou = b.enviadoEm ?? b.canceladoEm
        return b.status !== 'ENVIADO' && ms(b.geradoEm) <= t && (!fechou || t < ms(fechou))
      })
      if (!perto && !aberto) horarios.push(t)
    }
  }

  const internadoA = femea(i) ? 'internada' : 'internado'
  const enviados = () =>
    BOLETINS.filter((b) => b.internacaoId === i.id && b.enviadoEm).map((b) => ms(b.enviadoEm!))
  for (const t of horarios) {
    const anterior = Math.max(ms(i.entradaEm), ...enviados().filter((e) => e < t))
    const n = DOSES.filter(
      (d) =>
        d.internacaoId === i.id &&
        !d.conferencia &&
        d.status === 'FEITA' &&
        d.executadaEm &&
        ms(d.executadaEm) > anterior &&
        ms(d.executadaEm) <= t,
    ).length
    const cuidados = n === 1 ? '1 medicação ou cuidado' : `${n} medicações e cuidados`
    const quando = isoDoMs(t)
    const bomDia = quando.slice(11, 13) === '07' && i.preferencia.silencioNoturno
    const registro = novoBoletim(i, {
      origem: 'AUTOMATICO',
      status: 'ENVIADO',
      geradoEm: quando,
      texto: bomDia
        ? `Bom dia! ${pet} passou a noite ${internadoA} sob os cuidados da equipe e recebeu ${cuidados} desde o último boletim. A clínica manda novas notícias ao longo do dia.`
        : `Notícias de ${pet}: segue ${internadoA} sob os cuidados da equipe e recebeu ${cuidados} desde o último boletim.`,
    })
    marcarEnviado(registro, i, quando)
  }

  if (h.alta && i.encerradaEm) {
    const registro = novoBoletim(i, {
      tipo: 'ALTA',
      status: 'ENVIADO',
      geradoEm: i.encerradaEm,
      autorUsuarioId: usuarioDe(h.alta.por),
      texto: `${pet} teve alta. Estas são as orientações da equipe para casa:\n\n${h.alta.orientacao}`,
    })
    marcarEnviado(registro, i, somarMinutos(i.encerradaEm, 1))
  }
}

/** A lista congelada da última passagem: o que ficou pendente na hora da entrega. */
function congelarUltimaPassagem() {
  const atual = plantaoAberto()
  const anterior = atual?.turnoAnteriorId ? plantao(atual.turnoAnteriorId) : null
  if (!atual || !anterior?.entregueEm || !anterior.passagem) return
  const entrega = ms(anterior.entregueEm)
  const de = entrega - 12 * HORA
  const ate = ms(anterior.fimPrevisto) + 30 * MINUTO

  anterior.passagem.pendencias = DOSES.filter((d) => {
    const i = internacao(d.internacaoId)
    if (!i || ms(i.entradaEm) > entrega || (i.encerradaEm && ms(i.encerradaEm) <= entrega))
      return false
    const t = ms(d.previstaPara)
    if (t < de || t > ate || d.status === 'SUSPENSA') return false
    return d.status === 'PENDENTE' || (d.registradaEm !== null && ms(d.registradaEm) > entrega)
  })
    .sort((a, b) => a.previstaPara.localeCompare(b.previstaPara))
    .map((d) => {
      const diferenca = ms(d.previstaPara) - entrega
      const situacao =
        diferenca > 30 * MINUTO ? 'futura' : diferenca >= -30 * MINUTO ? 'na-janela' : 'atrasada'
      const dono = situacao === 'futura' ? null : atual.responsavelId
      if (dono && d.status === 'PENDENTE') d.atribuidaAId = dono
      return {
        administracaoId: d.id,
        previstaPara: d.previstaPara,
        descricao: descricaoDaDose(d),
        situacaoNaEntrega: situacao,
        atribuidaAId: dono,
      }
    })
}

/** "Chico (UTI 1): Butorfanol 10 mg/mL", como a passagem congela. */
export function descricaoDaDose(d: DoseDaDemo) {
  const i = internacao(d.internacaoId)
  const p = prescricao(d.prescricaoId)
  const l = i ? leito(i.leitoId) : null
  return `${i ? pacienteDa(i).nome : ''} (${l?.nome ?? ''}): ${p?.descricao ?? ''}`
}

function montar() {
  montarLeitos()
  const primeira = HISTORIAS.map((h) => h.entradaEm).sort()[0] ?? agoraIso()
  montarPlantoes(primeira)
  for (const h of HISTORIAS) {
    if (!jaPassou(h.entradaEm)) continue
    const i = montarInternacao(h)
    montarReceita(h, i)
    montarEvolucoes(h, i)
    montarBoletins(h, i)
  }
  congelarUltimaPassagem()
}

montar()

/* ----------------------------------------------------------------------- os DTOs */

export function leitoDto(l: LeitoDaDemo): Leito {
  const sala = SALAS.find((s) => s.id === l.salaId)
  return {
    id: l.id,
    nome: l.nome,
    kind: l.kind,
    salaId: l.salaId,
    salaNome: sala?.nome ?? 'Internação',
    ativo: l.ativo,
    motivoInativo: l.motivoInativo,
    detalheInativo: l.detalheInativo,
    inativoDesde: l.inativoDesde,
    jaRecebeuPaciente: l.jaRecebeuPaciente,
    ocupado: Boolean(internacaoNoLeito(l.id)),
    podeApagar: !l.jaRecebeuPaciente,
  }
}

/** Na ordem do cadastro: sala e nome ("UTI 2" depois de "UTI 1"). */
export function leitosEmOrdem() {
  return [...LEITOS].sort(
    (a, b) =>
      a.salaId.localeCompare(b.salaId) || a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }),
  )
}

function horasDesde(iso: string, ate?: string | null) {
  return Math.max(0, Math.floor(((ate ? ms(ate) : agoraMs()) - ms(iso)) / HORA))
}

function atendimentoDe(i: InternacaoDaDemo) {
  if (i.atendimentoId === undefined) {
    const dia = dataDe(new Date(i.entradaEm))
    i.atendimentoId =
      agendamentosDoPaciente(i.pacienteId).find(
        (a) => a.inicio.startsWith(dia) && a.atendimentoId && ms(a.inicio) <= ms(i.entradaEm),
      )?.atendimentoId ?? null
  }
  return i.atendimentoId
}

export function internacaoDto(i: InternacaoDaDemo): Internacao {
  const p = pacienteDa(i)
  const l = leito(i.leitoId)
  return {
    id: i.id,
    status: i.status,
    encerrada: !emCurso(i),
    paciente: { id: p.id, nome: p.nome, especie: p.especie, fotoUrl: p.fotoUrl },
    leito: { id: i.leitoId, nome: l?.nome ?? '', kind: l?.kind ?? 'GERAL' },
    responsavel: { id: i.responsavelId, nome: nomeDe(i.responsavelId) },
    internadoPor: { id: i.internadoPorId, nome: nomeDe(i.internadoPorId) },
    atendimentoId: atendimentoDe(i),
    motivo: i.motivo,
    diagnosticoDeTrabalho: i.diagnosticoDeTrabalho,
    observacao: i.observacao,
    entradaEm: i.entradaEm,
    altaPrevistaEm: i.altaPrevistaEm,
    encerradaEm: i.encerradaEm,
    altaEm: i.status === 'ALTA' ? i.encerradaEm : null,
    gravidade: i.gravidade,
    gravidadeNaEntrada: i.gravidadeNaEntrada,
    pesoEntradaKg: i.pesoEntradaKg,
    horasInternado: horasDesde(i.entradaEm, i.encerradaEm),
    orientacaoDeSaida: i.orientacaoDeSaida,
    avisadoPorTelefone: i.avisadoPorTelefone
      ? {
          em: i.avisadoPorTelefone.em,
          por: { id: i.avisadoPorTelefone.porId, nome: nomeDe(i.avisadoPorTelefone.porId) },
        }
      : null,
    motivoEncerramentoAdministrativo: i.motivoEncerramentoAdministrativo,
    mudancasDeLeito: [...i.mudancasDeLeito].reverse().slice(0, 50),
    mudancasDeGravidade: [...i.mudancasDeGravidade].reverse().slice(0, 50),
    mudancasTruncadas: i.mudancasDeLeito.length > 50 || i.mudancasDeGravidade.length > 50,
    abertaSemRegistro: null,
    medicacaoDaEstadia: null,
  }
}

/* ---------------------------------------------------------------------------- o mapa */

export function internadoDoMapa(i: InternacaoDaDemo): InternadoDoMapa {
  const p = pacienteDa(i)
  const atrasadas = atrasadasDa(i)
  const proximas = dosesDa(i.id)
    .filter((d) => !d.conferencia && d.status === 'PENDENTE')
    .filter((d) => {
      const s = situacaoDe(d)
      return s === 'futura' || s === 'na-janela'
    })
    .sort((a, b) => a.previstaPara.localeCompare(b.previstaPara))
  const proxima = proximas[0]
  const proximaEmMinutos = proxima ? Math.max(0, minutosAte(proxima.previstaPara)) : null
  const boletimRetido = pendenciaDoBoletim(i) !== null

  const motivos: MotivoDeUrgencia[] = []
  if (boletimRetido) motivos.push('BOLETIM_RETIDO')
  if (atrasadas.length) motivos.push('DOSES_ATRASADAS')
  if (proximaEmMinutos !== null && proximaEmMinutos <= 60) motivos.push('DOSE_PROXIMA')
  if (i.altaPrevistaEm && jaPassou(i.altaPrevistaEm)) motivos.push('ALTA_PREVISTA_VENCIDA')
  const nivel: NivelDeUrgencia =
    boletimRetido || atrasadas.length ? 'URGENTE' : motivos.length ? 'ATENCAO' : 'NENHUMA'

  return {
    id: i.id,
    paciente: { id: p.id, nome: p.nome, especie: p.especie, fotoUrl: p.fotoUrl },
    responsavel: { id: i.responsavelId, nome: nomeDe(i.responsavelId) },
    gravidade: i.gravidade,
    urgencia: { nivel, motivos },
    sinais: {
      dosesAtrasadas: atrasadas.length,
      minutosDaMaisAtrasada: atrasadas.reduce((maior, d) => Math.max(maior, atrasoDe(d)), 0),
      proximaEmMinutos,
      boletimRetido,
      alergiaNova: false,
    },
    entradaEm: i.entradaEm,
    altaPrevistaEm: i.altaPrevistaEm,
    altaPrevistaHoje: Boolean(i.altaPrevistaEm && dataDe(new Date(i.altaPrevistaEm)) === hoje()),
    horasInternado: horasDesde(i.entradaEm),
    abertaSemRegistro: null,
  }
}

const NIVEL: Record<NivelDeUrgencia, number> = { NENHUMA: 0, ATENCAO: 1, URGENTE: 2 }

/** A pauta: alergia nova, boletim retido, mais doses atrasadas, a mais atrasada, o degrau, a gravidade. */
export function emOrdemDeUrgencia(itens: InternadoDoMapa[]) {
  return [...itens].sort(
    (a, b) =>
      Number(b.sinais.alergiaNova) - Number(a.sinais.alergiaNova) ||
      Number(b.sinais.boletimRetido) - Number(a.sinais.boletimRetido) ||
      b.sinais.dosesAtrasadas - a.sinais.dosesAtrasadas ||
      b.sinais.minutosDaMaisAtrasada - a.sinais.minutosDaMaisAtrasada ||
      NIVEL[b.urgencia.nivel] - NIVEL[a.urgencia.nivel] ||
      GRAU[b.gravidade] - GRAU[a.gravidade] ||
      a.entradaEm.localeCompare(b.entradaEm),
  )
}

export function celulasDoMapa(): CelulaDoMapa[] {
  return leitosEmOrdem().map((l) => {
    const sala = SALAS.find((s) => s.id === l.salaId)
    const i = internacaoNoLeito(l.id)
    return {
      leito: {
        id: l.id,
        nome: l.nome,
        kind: l.kind,
        ativo: l.ativo,
        motivoInativo: l.motivoInativo,
        salaId: l.salaId,
        salaNome: sala?.nome ?? 'Internação',
      },
      internacao: i ? internadoDoMapa(i) : null,
    }
  })
}

const KINDS: KindDoLeito[] = ['GERAL', 'FELINO', 'ISOLAMENTO', 'UTI']

export function vagasPorKind() {
  return KINDS.map((kind) => {
    const doTipo = LEITOS.filter((l) => l.kind === kind)
    const ocupados = doTipo.filter((l) => internacaoNoLeito(l.id)).length
    return {
      kind,
      livres: doTipo.filter((l) => l.ativo && !internacaoNoLeito(l.id)).length,
      ocupados,
      inativos: doTipo.filter((l) => !l.ativo).length,
    }
  })
}

/* --------------------------------------------------------------------- a prescrição */

export function pesoBase(i: InternacaoDaDemo) {
  return {
    pesoBaseKg: i.pesoEntradaKg,
    aferidoEm: i.entradaEm,
    aferidoHaDias: Math.max(0, Math.floor((agoraMs() - ms(i.entradaEm)) / (24 * HORA))),
  }
}

export function prescricaoDto(p: PrescricaoDaDemo): PrescricaoDaInternacao {
  const pendentes = DOSES.filter((d) => {
    if (d.prescricaoId !== p.id || d.status !== 'PENDENTE') return false
    const s = situacaoDe(d)
    return s === 'futura' || s === 'na-janela'
  }).sort((a, b) => a.previstaPara.localeCompare(b.previstaPara))
  return {
    id: p.id,
    internacaoId: p.internacaoId,
    kind: p.kind,
    medicamentoId: p.medicamentoId,
    descricao: p.descricao,
    principioAtivo: p.principioAtivo,
    via: p.via,
    dose: p.dose,
    doseTexto: p.doseTexto,
    regime: p.regime,
    frequenciaHoras: p.frequenciaHoras,
    continuo: p.continuo,
    primeiroHorario: p.primeiroHorario,
    encerraEm: p.encerraEm,
    materializadoAte: p.materializadoAte,
    prescritoPor: { profissionalId: p.prescritoPorId, nome: nomeDe(p.prescritoPorId) },
    prescritoEm: p.prescritoEm,
    ativa: prescricaoAtiva(p),
    suspensao: p.suspensao
      ? {
          em: p.suspensao.em,
          motivo: p.suspensao.motivo,
          por: p.suspensao.porId
            ? { profissionalId: p.suspensao.porId, nome: nomeDe(p.suspensao.porId) }
            : null,
          substituidaPorId: p.suspensao.substituidaPorId,
        }
      : null,
    substituiPrescricaoId: p.substituiPrescricaoId,
    observacao: p.observacao,
    pendentes: pendentes.length,
    proximaEm: pendentes[0]?.previstaPara ?? null,
  }
}

export function prescricaoDoChecklist(p: PrescricaoDaDemo): PrescricaoNoChecklist {
  return {
    id: p.id,
    descricao: p.descricao,
    kind: p.kind,
    via: p.via,
    doseTexto: p.doseTexto,
    frequenciaHoras: p.frequenciaHoras,
    alergiaNova: false,
    especieProibidaNova: false,
  }
}

/* --------------------------------------------------------------------- o checklist */

export function linhaDaDose(d: DoseDaDemo) {
  const aberto = plantaoAberto()
  const fim = aberto ? ms(aberto.fimPrevisto) : null
  const t = ms(d.previstaPara)
  return {
    id: d.id,
    internacaoId: d.internacaoId,
    prescricaoId: d.prescricaoId,
    previstaPara: d.previstaPara,
    conferencia: d.conferencia,
    status: d.status,
    situacao: situacaoDe(d),
    atrasoMinutos: atrasoDe(d),
    motivo: d.motivo,
    executadaEm: d.executadaEm,
    registradaEm: d.registradaEm,
    executadaPorId: d.executadaPorId,
    turnoId: d.turnoId,
    atribuidaAId: d.atribuidaAId,
    atravessaAPassagem: d.status === 'PENDENTE' && fim !== null && Math.abs(fim - t) <= 30 * MINUTO,
  }
}

/** Os nomes de quem deu e de quem ficou com cada dose, uma vez cada. */
export function profissionaisDas(doses: DoseDaDemo[], extras: string[] = []) {
  const ids = new Set<string>(extras)
  for (const d of doses) {
    if (d.executadaPorId) ids.add(d.executadaPorId)
    if (d.atribuidaAId) ids.add(d.atribuidaAId)
  }
  return [...ids].map((profissionalId) => ({ profissionalId, nome: nomeDe(profissionalId) }))
}

export function agruparPorHora<T extends { previstaPara: string }>(linhas: T[]) {
  const grupos = new Map<string, T[]>()
  for (const linha of [...linhas].sort((a, b) => a.previstaPara.localeCompare(b.previstaPara))) {
    const hora = horaCheia(linha.previstaPara)
    const lista = grupos.get(hora) ?? []
    lista.push(linha)
    grupos.set(hora, lista)
  }
  return [...grupos.entries()].map(([hora, itens]) => ({ hora, itens }))
}

export function plantaoDoChecklist() {
  const aberto = plantaoAberto()
  return aberto
    ? { id: aberto.id, fimPrevisto: aberto.fimPrevisto, vencido: jaPassou(aberto.fimPrevisto) }
    : null
}

export function plantaoDto(p: PlantaoDaDemo) {
  return {
    id: p.id,
    kind: p.kind,
    inicio: p.inicio,
    fimPrevisto: p.fimPrevisto,
    origem: p.origem,
    responsavel: { profissionalId: p.responsavelId, nome: nomeDe(p.responsavelId) },
    vencido: !p.entregueEm && jaPassou(p.fimPrevisto),
    entregueEm: p.entregueEm,
    turnoAnteriorId: p.turnoAnteriorId,
  }
}

/** As pendências do plantão agora: as atrasadas de até 12 h e as do plantão. */
export function pendenciasDoPlantao() {
  const aberto = plantaoAberto()
  const grade = gradeDe(agoraIso())
  const de = ms(aberto?.inicio ?? grade.inicio) - 12 * HORA
  const ate = ms(aberto?.fimPrevisto ?? grade.fimPrevisto)
  return DOSES.filter((d) => {
    const i = internacao(d.internacaoId)
    if (!i || !emCurso(i) || d.status !== 'PENDENTE') return false
    const t = ms(d.previstaPara)
    return t >= de && t <= ate
  }).sort((a, b) => a.previstaPara.localeCompare(b.previstaPara))
}

export function internacaoDoChecklist(i: InternacaoDaDemo) {
  const p = pacienteDa(i)
  return {
    id: i.id,
    pacienteId: p.id,
    pacienteNome: p.nome,
    especie: p.especie,
    leitoNome: leito(i.leitoId)?.nome ?? '',
  }
}

/* ------------------------------------------------------------------------ a evolução */

export function evolucaoDto(e: EvolucaoDaDemo): Evolucao {
  const p = plantao(e.plantaoId)
  return {
    id: e.id,
    internacaoId: e.internacaoId,
    plantao: {
      id: e.plantaoId,
      kind: p?.kind ?? 'MANHA',
      inicio: p?.inicio ?? e.registradoEm,
      entregueEm: p?.entregueEm ?? null,
    },
    profissional: { profissionalId: e.profissionalId, nome: nomeDe(e.profissionalId) },
    registradoEm: e.registradoEm,
    atualizadoEm: e.atualizadoEm,
    vitais: e.vitais,
    observado: e.observado,
    avaliacao: e.avaliacao,
    plano: e.plano,
    gravidade: e.gravidade,
    congelada: Boolean(p?.entregueEm),
    versoesAnteriores: e.versoes.length,
  }
}

export function atualizadoAgora() {
  return comMilissegundos(agoraIso())
}

/* --------------------------------------------------------------------- o boletim */

export function boletimDto(b: BoletimDaDemo): Boletim {
  const { fotoUrl: _fotoUrl, ...dto } = b
  return dto
}

export function itemDaFila(i: InternacaoDaDemo): BoletimPendente | null {
  const pendencia = pendenciaDoBoletim(i)
  if (!pendencia) return null
  const p = pacienteDa(i)
  const c = cliente(p.clienteId)
  const l = leito(i.leitoId)
  const aberto = boletimAbertoDe(i.id)
  return {
    internacaoId: i.id,
    paciente: { id: p.id, nome: p.nome, especie: p.especie },
    leito: { id: i.leitoId, nome: l?.nome ?? '' },
    pendencia,
    semCanalNoApp: semCanalNoApp(i),
    desde: ligacaoDevidaDesde(i),
    ultimaLigacaoEm: ultimaLigacao(i),
    boletim:
      aberto && aberto.status !== 'ENVIADO' && aberto.status !== 'CANCELADO'
        ? {
            id: aberto.id,
            status: aberto.status,
            exigeLigacao: aberto.exigeLigacao,
            retidoDesde: aberto.retidoDesde,
          }
        : null,
    cliente: c
      ? { id: c.id, nome: c.nome, telefone: c.telefone, telefoneSecundario: c.telefoneSecundario }
      : null,
  }
}

/** Os horários do automático: das 07h, de tantas em tantas horas (sem a madrugada, com silêncio). */
function horariosDoAutomatico(pref: InternacaoDaDemo['preferencia']) {
  const horas: number[] = []
  for (let h = 7; h < 31; h += pref.frequenciaHoras) {
    const hora = h % 24
    if (pref.silencioNoturno && (hora >= 22 || hora < 7)) continue
    horas.push(hora)
  }
  return horas
}

export function preferenciaDto(i: InternacaoDaDemo): PreferenciaDoBoletim {
  const horas = horariosDoAutomatico(i.preferencia)
  let proximo: string | null = null
  if (emCurso(i)) {
    for (let dia = 0; dia < 2 && !proximo; dia++) {
      for (const h of horas) {
        const t = instante(somarDias(hoje(), dia), `${String(h).padStart(2, '0')}:00`)
        if (!jaPassou(t)) {
          proximo = t
          break
        }
      }
    }
  }
  return {
    internacaoId: i.id,
    frequenciaHoras: i.preferencia.frequenciaHoras,
    fotoSempre: i.preferencia.fotoSempre,
    silencioNoturno: i.preferencia.silencioNoturno,
    definidaPor: i.preferencia.definidaPor,
    definidaEm: i.preferencia.definidaEm,
    proximoBoletimEm: proximo,
    mensagensPorDia: horas.length,
    tetoDePushesPorDia: 12,
  }
}

/** O texto interno da última evolução (só como ponto de partida do boletim). */
export function observadoDaUltimaEvolucao(internacaoId: string) {
  return evolucoesDa(internacaoId)[0]?.observado ?? null
}

/** Desde quando conta o período do boletim: o último enviado ou a entrada. */
export function periodoDoBoletim(i: InternacaoDaDemo) {
  const enviado = BOLETINS.filter((b) => b.internacaoId === i.id && b.enviadoEm)
    .map((b) => b.enviadoEm!)
    .sort((a, b) => ms(b) - ms(a))[0]
  const desde = enviado ?? i.entradaEm
  const doses = DOSES.filter(
    (d) =>
      d.internacaoId === i.id &&
      !d.conferencia &&
      d.status === 'FEITA' &&
      d.executadaEm &&
      ms(d.executadaEm) > ms(desde),
  ).length
  return { desde, doses }
}

/* ------------------------------------------------------- o que as agregadoras usam */

/** Os internados agora, na ordem da pauta (o mais urgente primeiro). */
export function internacoesAtivas() {
  const itens = INTERNACOES.filter(emCurso).map((i) => ({ i, mapa: internadoDoMapa(i) }))
  const ordem = emOrdemDeUrgencia(itens.map((x) => x.mapa)).map((m) => m.id)
  return itens
    .sort((a, b) => ordem.indexOf(a.i.id) - ordem.indexOf(b.i.id))
    .map(({ i, mapa }) => {
      const p = pacienteDa(i)
      return {
        id: i.id,
        pacienteId: p.id,
        pacienteNome: p.nome,
        especie: p.especie,
        leitoId: i.leitoId,
        leitoNome: leito(i.leitoId)?.nome ?? '',
        gravidade: i.gravidade,
        desde: i.entradaEm,
        responsavelNome: nomeDe(i.responsavelId),
        urgencia: mapa.urgencia,
      }
    })
}

/** As doses atrasadas agora (sem as conferências de fluido), com paciente e leito. */
export function dosesAtrasadas() {
  return INTERNACOES.filter(emCurso).flatMap((i) =>
    atrasadasDa(i).map((d) => ({
      doseId: d.id,
      internacaoId: i.id,
      pacienteId: i.pacienteId,
      pacienteNome: pacienteDa(i).nome,
      leitoNome: leito(i.leitoId)?.nome ?? '',
      descricao: prescricao(d.prescricaoId)?.descricao ?? '',
      previstaPara: d.previstaPara,
      atrasoMinutos: atrasoDe(d),
    })),
  )
}

export function contarDosesAtrasadas() {
  return dosesAtrasadas().length
}

/** As conferências de fluido atrasadas (contadas à parte). */
export function conferenciasAtrasadas() {
  const piso = pisoDasAtrasadas()
  return DOSES.filter((d) => {
    const i = internacao(d.internacaoId)
    return (
      i &&
      emCurso(i) &&
      d.conferencia &&
      d.status === 'PENDENTE' &&
      ms(d.previstaPara) >= piso &&
      situacaoDe(d) === 'atrasada'
    )
  })
}

/** A fila de boletins da recepção, em ordem de entrada. */
export function boletinsPendentes() {
  return [...INTERNACOES]
    .filter(emCurso)
    .sort((a, b) => a.entradaEm.localeCompare(b.entradaEm))
    .map(itemDaFila)
    .filter((item): item is BoletimPendente => item !== null)
}

export function contarBoletinsPendentes() {
  return boletinsPendentes().length
}

/** As internações do paciente, da mais recente (a linha do tempo). */
export function internacoesDoPaciente(pacienteId: string) {
  return INTERNACOES.filter((i) => i.pacienteId === pacienteId)
    .sort((a, b) => b.entradaEm.localeCompare(a.entradaEm))
    .map((i) => ({
      id: i.id,
      status: i.status,
      entradaEm: i.entradaEm,
      encerradaEm: i.encerradaEm,
      responsavelNome: nomeDe(i.responsavelId),
      leitoNome: leito(i.leitoId)?.nome ?? '',
      motivo: i.motivo,
    }))
}

export function pacienteInternado(pacienteId: string) {
  return INTERNACOES.some((i) => emCurso(i) && i.pacienteId === pacienteId)
}
