/**
 * Os dados do Portal da demonstração (o que não é Clínica): carteira e ganhos, indicação, cupons,
 * equipe, avisos do sino, o cadastro da empresa e o perfil de quem entra.
 *
 * A Vila Madalena Pet está no Programa de Afiliados e no Participativo há uns 8 meses. Os ganhos
 * saem dos indicados: cada assinatura de quem entrou com o código gera a participação (primeira
 * assinatura, renovações, uma troca de plano e um reembolso), e o extrato, o saldo e os saques são
 * a soma desses lançamentos — a carteira nunca contradiz a lista de indicados.
 *
 * Exporta:
 * - `INDICADOS` (os 24 clientes da base que entraram com o código, `IndicadoDaDemo` com o
 *   `clienteId`), `EXTRATO` (lançamentos, mais recente primeiro), `SAQUES` (dois pagos, um em
 *   análise), `carteira()` (saldo e capacidade de saque), `pedirSaque`, `estadoDaCarteira`,
 *   `JANELA_DE_SEGURANCA_DIAS`, `SAQUE_MINIMO_CENTAVOS`, `reais(centavos)`;
 * - `INDICACAO` (código e link), `metricasDoQr()`, `CUPONS`, `RESGATES` (184, 27 nos últimos 30
 *   dias, coerentes com os `totais` do dashboard), `registrarResgate`;
 * - `MEMBROS` e `CONVITES` (equipe, já na forma do contrato), `AVISOS` (o sino) e `lerAviso`,
 *   `CADASTRO`, `PERFIL_DO_USUARIO`;
 * - `pendenciasDoPortal()`: as contagens de pendência do Portal para as agregadoras (convites de
 *   equipe esperando, acessos novos hoje e vencendo em menos de um dia, saque em análise, avisos
 *   por ler) — os acessos vêm de `portal-acessos.ts`.
 */
import type {
  ConvitePendenteDto,
  IndicadoDoParceiroDto,
  MembroEquipeDto,
} from '@/service/contrato/openapi'
import type { Aviso } from '@/service/parceiro/avisos-service'
import type {
  Carteira,
  CupomParceiro,
  IndicacaoMetricas,
  ParceiroCadastro,
  ResgateParceiro,
  SaqueDetalhe,
  TransacaoCarteira,
} from '@/service/parceiro/types'
import type { UsuarioProfile } from '@/service/user/user-service'

import { criarSorteio, idDe } from '../aleatorio'
import { CLIENTES, pacientesDoCliente } from '../base/cadastro'
import {
  CNPJ,
  CONVITES_PENDENTES,
  ENDERECO,
  EQUIPE,
  PARCEIRO_ID,
  PARCEIRO_NOME,
  USUARIO_ID,
} from '../base/clinica'
import {
  agoraIso,
  diaDaSemana,
  hoje,
  instante,
  jaPassou,
  minutosAte,
  somarDias,
  somarMinutos,
} from '../relogio'
import { contagensDosAcessos } from './portal-acessos'

const sorte = criarSorteio('portal')
const HOJE = hoje()

const DIA_MS = 24 * 60 * 60 * 1000

/** Os mesmos 14 dias da tela do extrato ("Libera em"). */
export const JANELA_DE_SEGURANCA_DIAS = 14
export const SAQUE_MINIMO_CENTAVOS = 5000

/** A participação por cobrança: 30% do plano mensal (R$ 29,90) e do anual (R$ 299,00). */
const PARTICIPACAO = { MENSAL: 897, ANUAL: 8970 } as const

/** R$ 1.234,56, para os textos dos avisos. */
export function reais(centavos: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(centavos / 100)
    .replace(/ /g, ' ')
}

function hora(min: number, max: number) {
  const h = sorte.inteiro(min, max)
  const m = sorte.inteiro(0, 59)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Um instante no dia `diasAtras` (0 = hoje), sem passar do agora. */
function quandoNoDia(diasAtras: number, min = 7, max = 22) {
  const iso = instante(somarDias(HOJE, -diasAtras), hora(min, max))
  return jaPassou(iso) ? iso : somarMinutos(agoraIso(), -sorte.inteiro(20, 90))
}

/* ------------------------------------------------------------------------------ indicados */

export type IndicadoDaDemo = IndicadoDoParceiroDto & {
  id: string
  clienteId: string
}

type LinhaDoIndicado = {
  diasAtras: number
  status: IndicadoDoParceiroDto['status']
  plano?: 'MENSAL' | 'ANUAL' | null
  /** Dias entre o cadastro e a primeira assinatura. */
  assinaEm?: number
  /** Renovações antes de cancelar (só CANCELADO). */
  renovacoesAteCancelar?: number
  /** Pediu reembolso da última renovação ao cancelar. */
  reembolso?: boolean
  /** Renovações mensais antes de trocar para o anual. */
  trocaParaAnualApos?: number
}

/** Do cadastro mais antigo ao mais novo: quem entrou cedo acumulou renovações. */
const TABELA_DE_INDICADOS: LinhaDoIndicado[] = [
  { diasAtras: 236, status: 'COM_ASSINATURA', plano: 'MENSAL', assinaEm: 2 },
  { diasAtras: 229, status: 'COM_ASSINATURA', plano: 'ANUAL', assinaEm: 0 },
  {
    diasAtras: 221,
    status: 'CANCELADO',
    plano: 'MENSAL',
    assinaEm: 5,
    renovacoesAteCancelar: 3,
    reembolso: true,
  },
  { diasAtras: 214, status: 'SEM_ASSINATURA' },
  { diasAtras: 203, status: 'COM_ASSINATURA', plano: 'ANUAL', assinaEm: 0, trocaParaAnualApos: 2 },
  { diasAtras: 190, status: 'SEM_ASSINATURA' },
  { diasAtras: 176, status: 'COM_ASSINATURA', plano: 'MENSAL', assinaEm: 1 },
  { diasAtras: 168, status: 'SEM_ASSINATURA' },
  { diasAtras: 155, status: 'SEM_ASSINATURA' },
  { diasAtras: 141, status: 'SEM_ASSINATURA' },
  { diasAtras: 127, status: 'COM_ASSINATURA', plano: 'MENSAL', assinaEm: 3 },
  { diasAtras: 118, status: 'CANCELADO', plano: 'MENSAL', assinaEm: 0, renovacoesAteCancelar: 1 },
  { diasAtras: 104, status: 'SEM_ASSINATURA' },
  { diasAtras: 92, status: 'COM_ASSINATURA', plano: 'MENSAL', assinaEm: 6 },
  { diasAtras: 77, status: 'SEM_ASSINATURA' },
  { diasAtras: 63, status: 'COM_ASSINATURA', plano: 'ANUAL', assinaEm: 2 },
  { diasAtras: 51, status: 'SEM_ASSINATURA' },
  { diasAtras: 40, status: 'SEM_ASSINATURA' },
  { diasAtras: 29, status: 'SEM_ASSINATURA' },
  { diasAtras: 21, status: 'COM_ASSINATURA', plano: 'MENSAL', assinaEm: 1 },
  { diasAtras: 13, status: 'SEM_ASSINATURA' },
  { diasAtras: 9, status: 'COM_ASSINATURA', plano: 'MENSAL', assinaEm: 0 },
  /* Em teste grátis: assinou, mas ainda não houve cobrança (plano `null`, participação 0). */
  { diasAtras: 4, status: 'COM_ASSINATURA', plano: null, assinaEm: 0 },
  { diasAtras: 1, status: 'SEM_ASSINATURA' },
]

export const INDICADOS: IndicadoDaDemo[] = []
export const EXTRATO: TransacaoCarteira[] = []
export const SAQUES: SaqueDetalhe[] = []

/** O lançamento de cada indicado, para somar a participação dele. */
const lancamentosDoIndicado = new Map<string, TransacaoCarteira[]>()

type Rascunho = Omit<TransacaoCarteira, 'id'> & { indicadoId?: string }
const rascunhos: Rascunho[] = []

function creditar(
  indicadoId: string,
  createdAt: string,
  origem: TransacaoCarteira['origem'],
  periodicidade: TransacaoCarteira['periodicidade'],
  valorCentavos: number,
) {
  if (!jaPassou(createdAt)) return
  rascunhos.push({
    tipo: 'CREDITO_COMISSAO',
    valorCentavos,
    periodicidade,
    origem,
    createdAt,
    indicadoId,
  })
}

/** Os clientes que entraram pelo código: os que têm pet no app primeiro. */
function clientesIndicados() {
  const comApp = CLIENTES.filter((c) => pacientesDoCliente(c.id).some((p) => p.noApp))
  const semApp = CLIENTES.filter((c) => !comApp.includes(c))
  return [...sorte.embaralhar(comApp), ...sorte.embaralhar(semApp)].slice(
    0,
    TABELA_DE_INDICADOS.length,
  )
}

function montarIndicados() {
  const clientes = clientesIndicados()

  TABELA_DE_INDICADOS.forEach((linha, i) => {
    const cliente = clientes[i]
    if (!cliente) return
    const id = idDe('demo-ind', i + 1)
    const cadastradoEm = quandoNoDia(linha.diasAtras, 8, 22)
    const assinou = linha.status !== 'SEM_ASSINATURA'
    const diaDaAssinatura = linha.diasAtras - (linha.assinaEm ?? 0)
    const assinouEm = assinou ? quandoNoDia(diaDaAssinatura, 9, 22) : null

    if (assinouEm && linha.plano === 'ANUAL' && linha.trocaParaAnualApos == null) {
      creditar(id, assinouEm, 'INITIAL_PURCHASE', 'ANUAL', PARTICIPACAO.ANUAL)
    }

    if (assinouEm && (linha.plano === 'MENSAL' || linha.trocaParaAnualApos != null)) {
      creditar(id, assinouEm, 'INITIAL_PURCHASE', 'MENSAL', PARTICIPACAO.MENSAL)
      const limite =
        linha.renovacoesAteCancelar ?? linha.trocaParaAnualApos ?? Number.POSITIVE_INFINITY
      let ultima = assinouEm
      for (let n = 1; n <= limite; n++) {
        const quando = somarMinutos(assinouEm, n * 30 * 24 * 60)
        if (!jaPassou(quando)) break
        creditar(id, quando, 'RENEWAL', 'MENSAL', PARTICIPACAO.MENSAL)
        ultima = quando
      }
      if (linha.trocaParaAnualApos != null) {
        /* A troca credita o anual menos o que o mensal já tinha rendido no mês. */
        const troca = somarMinutos(ultima, 15 * 24 * 60 + 190)
        creditar(id, troca, 'UPGRADE', 'ANUAL', PARTICIPACAO.ANUAL - PARTICIPACAO.MENSAL)
      }
      if (linha.reembolso) {
        rascunhos.push({
          tipo: 'ESTORNO',
          valorCentavos: -PARTICIPACAO.MENSAL,
          periodicidade: null,
          origem: 'REFUND',
          createdAt: somarMinutos(ultima, 2 * 24 * 60 + 75),
          indicadoId: id,
        })
      }
    }

    INDICADOS.push({
      id,
      clienteId: cliente.id,
      nome: cliente.nome,
      cadastradoEm,
      status: linha.status,
      assinouEm,
      plano: linha.status === 'SEM_ASSINATURA' ? null : (linha.plano ?? null),
      participacaoCentavos: 0,
    })
  })
}

/* --------------------------------------------------------------------------- saques */

/** O que já podia sair num instante: créditos fora da janela, menos tudo o que saiu. */
function sacavelEm(iso: string) {
  const t = Date.parse(iso)
  const corte = t - JANELA_DE_SEGURANCA_DIAS * DIA_MS
  return rascunhos.reduce((soma, r) => {
    const quando = Date.parse(r.createdAt)
    if (quando > t) return soma
    if (r.valorCentavos < 0) return soma + r.valorCentavos
    return quando <= corte ? soma + r.valorCentavos : soma
  }, 0)
}

const CHAVE_PIX_INICIAL = CNPJ.replace(/\D/g, '')

/** Um código de transação PIX, como o comprovante que o banco devolve. */
function endToEnd(iso: string) {
  const data = iso.slice(0, 10).replace(/-/g, '') + iso.slice(11, 16).replace(':', '')
  const sufixo = Array.from({ length: 11 }, () =>
    sorte.escolher('abcdefghjkmnpqrstuvwxyz0123456789'.split('')),
  ).join('')
  return `E18236120${data}s${sufixo}`
}

function saque(
  createdAt: string,
  fracao: number,
  status: SaqueDetalhe['status'],
  diasAtePagar: number,
) {
  const disponivel = sacavelEm(createdAt)
  const valor = Math.floor((disponivel * fracao) / 1000) * 1000
  if (valor < SAQUE_MINIMO_CENTAVOS) return
  const id = idDe('demo-saque', SAQUES.length + 1)
  const liquidadoEm =
    status === 'PAGO' ? somarMinutos(createdAt, diasAtePagar * 24 * 60 + 47) : null
  SAQUES.push({
    id,
    valorCentavos: valor,
    status,
    createdAt,
    liquidadoEm,
    motivoFalha: null,
    chavePixSnapshot: CHAVE_PIX_INICIAL,
    comprovante: liquidadoEm ? endToEnd(liquidadoEm) : null,
  })
  rascunhos.push({
    tipo: 'DEBITO_SAQUE',
    valorCentavos: -valor,
    periodicidade: null,
    origem: null,
    createdAt,
  })
}

function montarCarteira() {
  montarIndicados()

  /* Um ajuste do Participativo: o bônus da primeira campanha de vacinação. */
  rascunhos.push({
    tipo: 'AJUSTE',
    valorCentavos: 1500,
    periodicidade: null,
    origem: null,
    createdAt: instante(somarDias(HOJE, -140), '11:20'),
  })

  rascunhos.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  saque(instante(somarDias(HOJE, -118), '14:12'), 0.7, 'PAGO', 1)
  rascunhos.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  saque(instante(somarDias(HOJE, -46), '09:37'), 0.6, 'PAGO', 2)
  rascunhos.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  saque(quandoNoDia(2, 16, 17), 0.45, 'PENDENTE', 0)

  rascunhos.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  rascunhos.forEach((r, i) => {
    const { indicadoId, ...item } = r
    const lancamento: TransacaoCarteira = { id: idDe('demo-ext', rascunhos.length - i), ...item }
    EXTRATO.push(lancamento)
    if (indicadoId) {
      const lista = lancamentosDoIndicado.get(indicadoId) ?? []
      lista.push(lancamento)
      lancamentosDoIndicado.set(indicadoId, lista)
    }
  })

  for (const indicado of INDICADOS) {
    indicado.participacaoCentavos = (lancamentosDoIndicado.get(indicado.id) ?? []).reduce(
      (soma, l) => soma + l.valorCentavos,
      0,
    )
  }

  INDICADOS.sort((a, b) => b.cadastradoEm.localeCompare(a.cadastradoEm))
  SAQUES.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

montarCarteira()

export const estadoDaCarteira = {
  chavePix: CHAVE_PIX_INICIAL as string | null,
  /** O questionário depois do saque abre uma vez por carga. */
  feedbackRespondido: false,
}

export function carteira(): Carteira {
  const total = EXTRATO.reduce((soma, l) => soma + l.valorCentavos, 0)
  const sacavel = Math.max(0, sacavelEm(agoraIso()))
  const totalSacado = SAQUES.filter((s) => s.status !== 'FALHA').reduce(
    (soma, s) => soma + s.valorCentavos,
    0,
  )

  let capacidadeDeSaque: Carteira['capacidadeDeSaque'] = 'LIBERADO'
  if (total <= 0) capacidadeDeSaque = 'SEM_SALDO'
  else if (sacavel <= 0) capacidadeDeSaque = 'TUDO_RETIDO'
  else if (!estadoDaCarteira.chavePix) capacidadeDeSaque = 'SEM_CHAVE_PIX'
  else if (sacavel < SAQUE_MINIMO_CENTAVOS) capacidadeDeSaque = 'ABAIXO_DO_MINIMO'

  return {
    saldoTotalCentavos: total,
    saldoSacavelCentavos: sacavel,
    chavePix: estadoDaCarteira.chavePix,
    totalSacadoCentavos: totalSacado,
    bloqueadoParaSaque: false,
    saqueMinimoCentavos: SAQUE_MINIMO_CENTAVOS,
    capacidadeDeSaque,
  }
}

/** Pede um saque: debita na hora e fica em análise, como a API. */
export function pedirSaque(valorCentavos: number): SaqueDetalhe {
  const createdAt = agoraIso()
  const registro: SaqueDetalhe = {
    id: idDe('demo-saque', SAQUES.length + 1),
    valorCentavos,
    status: 'PENDENTE',
    createdAt,
    liquidadoEm: null,
    motivoFalha: null,
    chavePixSnapshot: estadoDaCarteira.chavePix ?? '',
    comprovante: null,
  }
  SAQUES.unshift(registro)
  EXTRATO.unshift({
    id: idDe('demo-ext', EXTRATO.length + 1),
    tipo: 'DEBITO_SAQUE',
    valorCentavos: -valorCentavos,
    periodicidade: null,
    origem: null,
    createdAt,
  })
  rascunhos.push({
    tipo: 'DEBITO_SAQUE',
    valorCentavos: -valorCentavos,
    periodicidade: null,
    origem: null,
    createdAt,
  })
  return registro
}

/* ------------------------------------------------------------------------- indicação */

export const INDICACAO = {
  codigo: 'VMPET7K2',
  link: 'https://petjourney.health/i/VMPET7K2',
  qrCode: 'wfqr-vmpet7k2',
}

const AGENTES = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 15; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 14; moto g84 5G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
]

const LEITURAS_POR_DIA: Array<{ day: string; count: number }> = []
const LEITURAS_RECENTES: Array<{ at: string; userAgent: string | null }> = []

function montarLeituras() {
  for (let d = 29; d >= 0; d--) {
    const dia = somarDias(HOJE, -d)
    const semana = diaDaSemana(dia)
    const base = semana === 0 ? 1 : semana === 6 ? 4 : 6
    const count = Math.max(0, base + sorte.inteiro(-3, 4) - (d === 0 ? 3 : 0))
    if (count) LEITURAS_POR_DIA.push({ day: dia, count })
  }
  for (let i = 0; i < 8; i++) {
    LEITURAS_RECENTES.push({
      at: somarMinutos(agoraIso(), -(i * sorte.inteiro(70, 260) + sorte.inteiro(12, 50))),
      userAgent: i === 5 ? null : sorte.escolher(AGENTES),
    })
  }
}

montarLeituras()

export function metricasDoQr(): IndicacaoMetricas {
  const noMes = LEITURAS_POR_DIA.reduce((soma, d) => soma + d.count, 0)
  return {
    qrCode: INDICACAO.qrCode,
    scanCount: 268 + noMes,
    byDay: LEITURAS_POR_DIA.map((d) => ({ ...d })),
    recent: LEITURAS_RECENTES.map((r) => ({ ...r })),
  }
}

/* ---------------------------------------------------------------------- cupons e resgates */

const ANO = Number(HOJE.slice(0, 4))

export const CUPONS: CupomParceiro[] = [
  {
    id: 'demo-cupom-checkup',
    codigo: 'VMCHECKUP20',
    titulo: '20% no check-up do pet idoso',
    descontoPercentual: 20,
    categoria: 'VETERINARIO',
    validoAte: instante(somarDias(HOJE, 74), '23:59'),
    ativo: true,
    usoUnico: false,
    usosRestantes: 38,
    totalResgates: 0,
  },
  {
    id: 'demo-cupom-castracao',
    codigo: 'VMCASTRA15',
    titulo: 'Mutirão de castração: 15% na cirurgia',
    descontoPercentual: 15,
    categoria: 'VETERINARIO',
    validoAte: instante(somarDias(HOJE, -158), '23:59'),
    ativo: false,
    usoUnico: false,
    totalResgates: 0,
  },
  {
    id: 'demo-cupom-vacina',
    codigo: 'VMVACINA15',
    titulo: '15% na vacinação anual',
    descontoPercentual: 15,
    categoria: 'VETERINARIO',
    validoAte: instante(`${ANO + 1}-06-30`, '23:59'),
    ativo: true,
    usoUnico: false,
    totalResgates: 0,
  },
  {
    id: 'demo-cupom-consulta',
    codigo: 'VMCONSULTA10',
    titulo: '10% na consulta clínica',
    descontoPercentual: 10,
    categoria: 'VETERINARIO',
    validoAte: instante(`${ANO + 1}-12-31`, '23:59'),
    ativo: true,
    usoUnico: false,
    totalResgates: 0,
  },
]

export const RESGATES: ResgateParceiro[] = []

function cupomDe(codigo: string) {
  return CUPONS.find((c) => c.codigo === codigo) as CupomParceiro
}

/** Dia útil de atendimento: domingo vira sábado. */
function diaDeBalcao(diasAtras: number) {
  const dia = somarDias(HOJE, -diasAtras)
  return diaDaSemana(dia) === 0 ? diasAtras + 1 : diasAtras
}

function resgatar(codigo: string, diasAtras: number) {
  const d = diaDeBalcao(diasAtras)
  const sabado = diaDaSemana(somarDias(HOJE, -d)) === 6
  const quando =
    d === 0
      ? somarMinutos(agoraIso(), -88)
      : instante(somarDias(HOJE, -d), hora(8, sabado ? 12 : 18))
  const cupom = cupomDe(codigo)
  RESGATES.push({
    resgateId: '',
    cupomCodigo: codigo,
    canal: sorte.chance(0.7) ? 'QR' : 'CODIGO_MANUAL',
    descontoPercentualSnapshot: cupom.descontoPercentual,
    resgatadoEm: quando,
  })
  cupom.totalResgates++
}

function montarResgates() {
  /* Os últimos 30 dias: 27, um deles hoje cedo. */
  resgatar('VMCONSULTA10', 0)
  for (let i = 0; i < 11; i++) resgatar('VMCONSULTA10', sorte.inteiro(1, 29))
  for (let i = 0; i < 8; i++) resgatar('VMVACINA15', sorte.inteiro(1, 29))
  for (let i = 0; i < 7; i++) resgatar('VMCHECKUP20', sorte.inteiro(1, 29))
  /* Antes disso: 157. */
  for (let i = 0; i < 84; i++) resgatar('VMCONSULTA10', sorte.inteiro(31, 236))
  for (let i = 0; i < 53; i++) resgatar('VMVACINA15', sorte.inteiro(31, 234))
  for (let i = 0; i < 5; i++) resgatar('VMCHECKUP20', sorte.inteiro(31, 60))
  for (let i = 0; i < 15; i++) resgatar('VMCASTRA15', sorte.inteiro(160, 210))

  RESGATES.sort((a, b) => b.resgatadoEm.localeCompare(a.resgatadoEm))
  RESGATES.forEach((r, i) => (r.resgateId = idDe('demo-resgate', RESGATES.length - i)))

  const checkup = cupomDe('VMCHECKUP20')
  checkup.usosRestantes = 50 - checkup.totalResgates
}

montarResgates()

/** O resgate do balcão: o cupom é o do código que o cliente gerou no app. */
export function registrarResgate(token: string, canal: ResgateParceiro['canal']) {
  const ativos = CUPONS.filter((c) => c.ativo)
  let soma = 0
  for (const letra of token) soma += letra.charCodeAt(0)
  const cupom = ativos[soma % ativos.length] as CupomParceiro
  const resgate: ResgateParceiro = {
    resgateId: idDe('demo-resgate', RESGATES.length + 1),
    cupomCodigo: cupom.codigo,
    canal,
    descontoPercentualSnapshot: cupom.descontoPercentual,
    resgatadoEm: agoraIso(),
  }
  RESGATES.unshift(resgate)
  cupom.totalResgates++
  if (cupom.usosRestantes != null) cupom.usosRestantes = Math.max(0, cupom.usosRestantes - 1)
  const cliente = CLIENTES[soma % CLIENTES.length]
  return { cupom, resgate, tutorPrimeiroNome: cliente?.nome.split(' ')[0] ?? null }
}

/* ------------------------------------------------------------------------------- equipe */

const DONA = EQUIPE.find((p) => p.usuarioId === USUARIO_ID)

export const MEMBROS: MembroEquipeDto[] = EQUIPE.map((p) => ({
  usuarioId: p.usuarioId,
  nome: p.nome,
  email: p.email,
  papel: p.papel,
  papeisOperacionais: [...p.papeisOperacionais],
  desde: p.entrouEm,
  convidadoPor: p.usuarioId === USUARIO_ID ? null : (DONA?.nome ?? null),
}))

export type ConviteDaDemo = ConvitePendenteDto & { nome: string | null }

export const CONVITES: ConviteDaDemo[] = CONVITES_PENDENTES.map((c) => {
  const criadoEm = quandoNoDia(c.enviadoHaDias, 9, 17)
  return {
    id: c.id,
    email: c.email,
    papel: 'OPERADOR',
    criadoEm,
    expiraEm: somarMinutos(criadoEm, 7 * 24 * 60),
    nome: c.nome,
  }
})

/* -------------------------------------------------------------------------------- avisos */

export const AVISOS: Aviso[] = []

function aviso(
  tipo: string,
  titulo: string,
  corpo: string,
  criadoEm: string,
  lida: boolean,
  dados: Record<string, unknown> = {},
) {
  AVISOS.push({
    id: idDe('demo-aviso', AVISOS.length + 1),
    tipo,
    titulo,
    corpo,
    dados: { parceiroId: PARCEIRO_ID, parceiroNome: PARCEIRO_NOME, ...dados },
    criadoEm,
    lidaEm: lida ? somarMinutos(criadoEm, sorte.inteiro(15, 300)) : null,
  })
}

function montarAvisos() {
  const pendente = SAQUES.find((s) => s.status === 'PENDENTE')
  const pagos = SAQUES.filter((s) => s.status === 'PAGO')
  const novoAssinante = INDICADOS.find(
    (i) => i.plano === 'MENSAL' && i.assinouEm && minutosAte(i.assinouEm) > -12 * 24 * 60,
  )

  aviso(
    'COMPARTILHAMENTO_VINCULADO',
    'Novo acesso temporário',
    'Sílvia Martins liberou o histórico do Floquinho por 7 dias.',
    somarMinutos(agoraIso(), -34),
    false,
    { pacienteIds: ['demo-pac-017'] },
  )
  aviso(
    'COMPARTILHAMENTO_VINCULADO',
    'Novo acesso temporário',
    'Tânia Moreira liberou o histórico da Nina até amanhã. Atenção: alergia grave a dipirona.',
    somarMinutos(agoraIso(), -69),
    false,
    { pacienteIds: ['demo-pac-005'] },
  )
  aviso(
    'PEDIDO_RECEBIDO',
    'Pedido de horário pelo site',
    'Adriana Pires pediu uma consulta para o Paçoca na sexta-feira, de manhã.',
    somarMinutos(agoraIso(), -113),
    false,
  )
  aviso(
    'ADESAO_EM_QUEDA',
    'Um tratamento de Bento pede atenção',
    'Duas doses de benazepril foram puladas nos últimos três dias. Pode ser que tenham parado de registrar. Abra a ficha.',
    instante(somarDias(HOJE, -1), '18:20'),
    false,
    { pacienteId: 'demo-pac-007-2', petNome: 'Bento', motivo: 'PULADAS' },
  )
  aviso(
    'VINCULO_RESPONDIDO',
    'Vínculo aceito no app',
    'Luciana Campos aceitou ligar a Mel ao app. O histórico da clínica já aparece para ela.',
    instante(somarDias(HOJE, -1), '15:02'),
    true,
    { clienteId: 'demo-cli-003', pacienteIds: ['demo-pac-003'] },
  )
  if (pendente) {
    aviso(
      'PARCEIRO_SAQUE_SOLICITADO',
      'Saque em análise',
      `O pedido de saque de ${reais(pendente.valorCentavos)} entrou em análise. O pagamento sai em até 3 dias úteis, na chave PIX do CNPJ.`,
      somarMinutos(pendente.createdAt, 1),
      true,
    )
  }
  if (novoAssinante?.assinouEm) {
    aviso(
      'PARCEIRO_INDICADO_ASSINOU',
      'Novo assinante pelo seu código',
      `${novoAssinante.nome} assinou o plano mensal. A participação entra no saldo liberado depois da janela de segurança.`,
      somarMinutos(novoAssinante.assinouEm, 3),
      true,
    )
  }
  aviso(
    'VINCULO_RESPONDIDO',
    'Vínculo aceito no app',
    'Gustavo Almeida aceitou ligar a Duna ao app.',
    instante(somarDias(HOJE, -6), '19:44'),
    true,
    { clienteId: 'demo-cli-010', pacienteIds: ['demo-pac-010'] },
  )
  aviso(
    'VINCULO_ENCERRADO_PELO_RESPONSAVEL',
    'Vínculo encerrado pelo responsável',
    'Gabriel Moura desligou o Hulk do app. A ficha continua na clínica.',
    instante(somarDias(HOJE, -11), '21:05'),
    true,
    { clienteId: 'demo-cli-038', pacienteIds: ['demo-pac-038'] },
  )
  for (const pago of pagos) {
    if (!pago.liquidadoEm) continue
    aviso(
      'PARCEIRO_SAQUE_PAGO',
      'Saque pago',
      `O saque de ${reais(pago.valorCentavos)} foi pago na chave PIX do CNPJ.`,
      pago.liquidadoEm,
      true,
    )
  }
  aviso(
    'ADESAO_EM_QUEDA',
    'Um tratamento de Duna pede atenção',
    'Três doses de pimobendan sem registro desde domingo. Pode ser que tenham parado de registrar. Abra a ficha.',
    instante(somarDias(HOJE, -24), '08:00'),
    true,
    { pacienteId: 'demo-pac-010', petNome: 'Duna', motivo: 'QUEDA' },
  )

  AVISOS.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
}

montarAvisos()

/* ------------------------------------------------------------------- cadastro e perfil */

export const CADASTRO: ParceiroCadastro = {
  parceiroId: PARCEIRO_ID,
  nome: PARCEIRO_NOME,
  categoria: 'CLINICA_VETERINARIA',
  categorias: ['CLINICA_VETERINARIA'],
  cnpj: CNPJ.replace(/\D/g, ''),
  telefoneComercial: ENDERECO.telefone,
  crmv: 'SP-21847',
  logoUrl: null,
  statusAuditoria: 'APROVADO',
  motivoAuditoria: null,
}

export const PERFIL_DO_USUARIO: UsuarioProfile = {
  id: USUARIO_ID,
  email: DONA?.email ?? '',
  nome: DONA?.nome ?? '',
  telefone: DONA?.telefone ?? null,
  telefoneWhatsApp: DONA?.telefone ?? null,
  cpf: null,
  ativo: true,
  veterinarioPerfil: {
    id: 'demo-vet-marina',
    crmv: 'SP-21847',
    especialidade: 'Dermatologia',
    foto: null,
  },
}

/* ---------------------------------------------------------------- pendências do Portal */

/**
 * As pendências do Portal agora, para o painel de pendências e o Meu dia:
 * - `convitesDeEquipe`: convites enviados que ninguém aceitou ainda;
 * - `acessosNovosHoje`: acessos temporários vinculados hoje;
 * - `acessosVencendo`: acessos ativos que fecham em menos de 24 horas;
 * - `acessosAtivos`: todos os acessos ativos;
 * - `saquesEmAnalise`: saques pedidos que ainda não foram pagos;
 * - `avisosNaoLidos`: avisos do sino por ler.
 */
export function pendenciasDoPortal() {
  const acessos = contagensDosAcessos()
  return {
    convitesDeEquipe: CONVITES.filter((c) => !c.expiraEm || !jaPassou(c.expiraEm)).length,
    acessosNovosHoje: acessos.novosHoje,
    acessosVencendo: acessos.vencendoEmUmDia,
    acessosAtivos: acessos.ativos,
    saquesEmAnalise: SAQUES.filter((s) => s.status === 'PENDENTE').length,
    avisosNaoLidos: AVISOS.filter((a) => !a.lidaEm).length,
  }
}

/** O instante da leitura de um aviso. */
export function lerAviso(id: string) {
  const alvo = AVISOS.find((a) => a.id === id)
  if (alvo && !alvo.lidaEm) alvo.lidaEm = agoraIso()
  return alvo ?? null
}
