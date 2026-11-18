/**
 * Notas fiscais de serviço (NFS-e) do financeiro: protótipo (18/11/2026, pedido do Luís: "receber
 * pagamentos, emissão de nota, tudo isso — só como protótipo, mas tem que ter").
 *
 * Como no resto do financeiro, nada sai do computador: não há prefeitura, certificado nem número de
 * verdade. A "prefeitura" é um relógio que responde alguns segundos depois (`estado.ts`).
 *
 * O que o protótipo segue do mundo real:
 *
 * - **A nota é de serviço.** O código é o item 5.01 da lista da Lei Complementar 116 (medicina
 *   veterinária e zootecnia). Produto vendido no balcão (antipulgas, ração) é mercadoria e fica fora:
 *   vai na nota de venda, não nesta. Conta só de produto não tem nota de serviço.
 * - **O tomador é o responsável, com CPF.** Sem CPF, ou com CPF que não confere, a prefeitura recusa,
 *   e a recepção corrige e reenvia.
 * - **Primeiro o RPS, depois o número.** A clínica numera o pedido (série e número do RPS); o número
 *   da nota e o código de verificação vêm da prefeitura quando ela autoriza.
 * - **Emissão e competência são datas diferentes.** A competência é o dia do atendimento; a emissão,
 *   o dia em que a conta foi paga (quem levou em aberto e pagou depois tem a nota no dia do Pix).
 * - **ISS no Simples Nacional.** A alíquota padrão (2,01%) é a parte do ISS na primeira faixa do
 *   Simples (6%, a mesma de `resultado.ts`): o imposto já vai na guia do mês e a nota só informa.
 * - **Cancelar tem prazo.** A clínica cancela sozinha até o dia 10 do mês seguinte ao da emissão;
 *   depois, só pedindo à prefeitura. Cancelada por erro, a conta volta para "A emitir".
 */
import { getDataset } from '@/features/clinico/data/store'
import { addDays } from '@/features/clinico/domain/clinic-time'
import { formatCpf, isValidCpf, stripCpf } from '@/utils/validation/cpf'

import {
  horaDeMinutos,
  mesAnterior,
  mesDe,
  minutosDaHora,
  sorteador,
  totalBruto,
  type Centavos,
  type Conta,
  type DataISO,
} from './dados'

// ------------------------------------------------------------------------------------- tipos

export type SituacaoDaNota = 'processando' | 'autorizada' | 'rejeitada' | 'cancelada'

/** Quem recebe o serviço e a nota: o responsável pelo pet. */
export type TomadorDaNota = {
  nome: string
  /** Como foi enviado (com ou sem máscara); vazio quando não havia CPF. */
  cpf: string
  email: string
  tutorId: string | null
}

export type ItemDaNota = { nome: string; quantidade: number; valor: Centavos }

/** `erro` devolve a conta para "A emitir"; os outros dois encerram a conta sem nota nova. */
export type TipoDeCancelamento = 'erro' | 'nao-prestado' | 'duplicidade'

export type CancelamentoDaNota = {
  tipo: TipoDeCancelamento
  motivo: string
  data: DataISO
  hora: string
  por: string
}

export type EnvioDaNota = { app: boolean; email: boolean; data: DataISO }

export type NotaFiscal = {
  id: string
  contaId: string
  /** Número da NFS-e: só existe depois que a prefeitura autoriza. */
  numero: number | null
  serieRps: string
  numeroRps: number
  emitidaEm: DataISO
  hora: string
  /** O dia do atendimento (o fato gerador). */
  competencia: DataISO
  tomador: TomadorDaNota
  petNome: string
  /** Os serviços da conta: a discriminação da nota. */
  itens: ItemDaNota[]
  /** Os produtos da conta, que não entram na nota de serviço. */
  foraDaNota: ItemDaNota[]
  codigoDoServico: string
  valorDosServicos: Centavos
  /** O desconto da conta na parte dos serviços (desconto incondicionado). */
  desconto: Centavos
  /** Congelada na emissão: mudar a configuração depois não reescreve nota velha. */
  aliquota: number
  codigoDeVerificacao: string | null
  situacao: SituacaoDaNota
  /** O motivo da prefeitura, quando recusou. */
  recusa: string | null
  cancelamento: CancelamentoDaNota | null
  envio: EnvioDaNota | null
  /** A nota cancelada que esta substitui. */
  substitui: string | null
}

export type PadraoDaNota = 'nacional' | 'municipal'
export type RegimeTributario = 'simples' | 'presumido' | 'real'

export type ConfiguracaoDaNota = {
  municipio: string
  padrao: PadraoDaNota
  inscricaoMunicipal: string
  regime: RegimeTributario
  codigoDoServico: string
  aliquota: number
  serieRps: string
  proximoRps: number
  certificado: { tipo: string; titular: string; validoAte: DataISO }
  /** Ligado, o interruptor "Emitir nota" do receber já vem marcado. */
  emitirAoReceber: boolean
}

// ------------------------------------------------------------------------------- catálogos

/** A clínica de demonstração como prestadora (CNPJ e inscrição ilustrativos). */
export const PRESTADOR = {
  razaoSocial: 'PetJourney Clínica Veterinária Ltda.',
  cnpj: '41.207.385/0001-40',
  endereco: 'Rua das Acácias, 421, Vila Madalena · CEP 05435-020',
  telefone: '(11) 3555-0142',
}

export const MUNICIPIOS = [
  { id: 'sao-paulo', nome: 'São Paulo – SP', cidade: 'São Paulo' },
  { id: 'campinas', nome: 'Campinas – SP', cidade: 'Campinas' },
  { id: 'rio-de-janeiro', nome: 'Rio de Janeiro – RJ', cidade: 'Rio de Janeiro' },
  { id: 'belo-horizonte', nome: 'Belo Horizonte – MG', cidade: 'Belo Horizonte' },
  { id: 'curitiba', nome: 'Curitiba – PR', cidade: 'Curitiba' },
  { id: 'porto-alegre', nome: 'Porto Alegre – RS', cidade: 'Porto Alegre' },
  { id: 'campo-grande', nome: 'Campo Grande – MS', cidade: 'Campo Grande' },
] as const

export function municipio(id: string) {
  return MUNICIPIOS.find((m) => m.id === id) ?? MUNICIPIOS[0]
}

/** Os itens do grupo 5 (serviços veterinários) da lista da Lei Complementar 116/2003. */
export const CODIGOS_DE_SERVICO = [
  { codigo: '5.01', descricao: 'Medicina veterinária e zootecnia' },
  {
    codigo: '5.02',
    descricao: 'Hospitais, clínicas, ambulatórios e prontos-socorros na área veterinária',
  },
  { codigo: '5.03', descricao: 'Laboratórios de análise na área veterinária' },
  {
    codigo: '5.08',
    descricao: 'Guarda, tratamento, amestramento, embelezamento e alojamento de animais',
  },
] as const

export function servicoDoCodigo(codigo: string) {
  return CODIGOS_DE_SERVICO.find((c) => c.codigo === codigo) ?? CODIGOS_DE_SERVICO[0]
}

export const REGIMES: Record<RegimeTributario, string> = {
  simples: 'Simples Nacional',
  presumido: 'Lucro presumido',
  real: 'Lucro real',
}

export const PADROES: Record<PadraoDaNota, string> = {
  nacional: 'NFS-e nacional',
  municipal: 'Sistema da prefeitura',
}

export const SITUACAO_DA_NOTA: Record<
  SituacaoDaNota,
  { rotulo: string; icone: string; tom: '' | 'ok' | 'atencao' | 'risco' }
> = {
  processando: { rotulo: 'Em processamento', icone: 'ph ph-hourglass-medium', tom: 'atencao' },
  autorizada: { rotulo: 'Autorizada', icone: 'ph ph-seal-check', tom: 'ok' },
  rejeitada: { rotulo: 'Recusada', icone: 'ph ph-warning-circle', tom: 'risco' },
  cancelada: { rotulo: 'Cancelada', icone: 'ph ph-prohibit', tom: '' },
}

export const MOTIVOS_DE_CANCELAMENTO: {
  tipo: TipoDeCancelamento
  rotulo: string
  ajuda: string
}[] = [
  {
    tipo: 'erro',
    rotulo: 'Erro na emissão',
    ajuda:
      'Valor, serviço ou responsável errado. A conta volta para A emitir, para sair a nota certa.',
  },
  {
    tipo: 'nao-prestado',
    rotulo: 'Serviço não prestado',
    ajuda: 'O atendimento não aconteceu ou foi desfeito. A conta não ganha nota nova.',
  },
  {
    tipo: 'duplicidade',
    rotulo: 'Nota em duplicidade',
    ajuda: 'Saíram duas notas para a mesma conta. Fica valendo a outra.',
  },
]

export const RECUSA_SEM_CPF = 'Tomador sem CPF: a prefeitura exige o CPF de quem recebe o serviço.'
export const RECUSA_CPF_INVALIDO = 'CPF do tomador inválido: os dígitos não conferem.'

/** A partir de onde a clínica de demonstração numera (ela já emitia antes do protótipo). */
const RPS_INICIAL = 5120
const NUMERO_INICIAL = 4871

export function configuracaoInicial(hoje: DataISO): ConfiguracaoDaNota {
  return {
    municipio: 'sao-paulo',
    padrao: 'nacional',
    inscricaoMunicipal: '4.812.337-0',
    regime: 'simples',
    codigoDoServico: '5.01',
    aliquota: 0.0201,
    serieRps: 'A',
    proximoRps: RPS_INICIAL,
    certificado: {
      tipo: 'e-CNPJ A1',
      titular: 'PETJOURNEY CLINICA VETERINARIA LTDA',
      validoAte: addDays(hoje, 241),
    },
    emitirAoReceber: true,
  }
}

// ---------------------------------------------------------------------------------- contas

export function ehServico(item: { tipo: string }) {
  return item.tipo !== 'produto'
}

export function temServico(conta: Pick<Conta, 'itens'>) {
  return conta.itens.some(ehServico)
}

/** Quanto da conta vai para a nota: os serviços, com a parte deles no desconto. */
export function valorDosServicos(conta: Pick<Conta, 'itens' | 'desconto'>) {
  const servicos = conta.itens
    .filter(ehServico)
    .reduce((soma, item) => soma + item.preco * item.quantidade, 0)
  const bruto = totalBruto(conta) || 1
  return { servicos, desconto: Math.round((conta.desconto * servicos) / bruto) }
}

/** Quando a conta ficou paga: o último pagamento que entrou (o fiado acertado depois conta aqui). */
export function momentoDoPagamento(conta: Conta): { data: DataISO; hora: string } {
  const pagos = conta.pagamentos
    .filter((p) => p.forma !== 'em-aberto')
    .sort((a, b) => a.data.localeCompare(b.data) || a.hora.localeCompare(b.hora))
  const ultimo = pagos[pagos.length - 1]
  return ultimo ? { data: ultimo.data, hora: ultimo.hora } : { data: conta.data, hora: conta.hora }
}

/** O responsável como está no cadastro da clínica (nome, CPF e e-mail). */
export function tomadorDoCadastro(conta: Pick<Conta, 'tutorId' | 'tutorNome'>): TomadorDaNota {
  const tutor = conta.tutorId
    ? (getDataset().tutores.find((t) => t.id === conta.tutorId) ?? null)
    : null
  return {
    nome: conta.tutorNome,
    cpf: tutor?.documento ?? '',
    email: tutor?.email ?? '',
    tutorId: conta.tutorId,
  }
}

/** O que a prefeitura diria do tomador: nada (`null`) quando está tudo certo. */
export function problemaDoTomador(tomador: Pick<TomadorDaNota, 'cpf'>): string | null {
  if (!stripCpf(tomador.cpf)) return RECUSA_SEM_CPF
  if (!isValidCpf(tomador.cpf)) return RECUSA_CPF_INVALIDO
  return null
}

// ----------------------------------------------------------------------------------- notas

export function baseDaNota(nota: Pick<NotaFiscal, 'valorDosServicos' | 'desconto'>): Centavos {
  return Math.max(0, nota.valorDosServicos - nota.desconto)
}

export function issDaNota(
  nota: Pick<NotaFiscal, 'valorDosServicos' | 'desconto' | 'aliquota'>,
): Centavos {
  return Math.round(baseDaNota(nota) * nota.aliquota)
}

/** Até quando a clínica cancela sozinha: o dia 10 do mês seguinte ao da emissão. */
export function prazoParaCancelar(nota: Pick<NotaFiscal, 'emitidaEm'>): DataISO {
  return `${mesAnterior(mesDe(nota.emitidaEm), -1)}-10`
}

export function podeCancelar(nota: NotaFiscal, hoje: DataISO) {
  return nota.situacao === 'autorizada' && hoje <= prazoParaCancelar(nota)
}

/**
 * A conta precisa de nota quando está paga, tem serviço e não tem nota de pé (autorizada, em
 * processamento ou recusada esperando correção). Nota cancelada por erro devolve a conta à fila;
 * cancelada por serviço não prestado ou duplicidade, não.
 */
export function precisaDeNota(conta: Conta, notasDaConta: readonly NotaFiscal[] = []) {
  if (conta.situacao !== 'paga' || !temServico(conta)) return false
  if (notasDaConta.some((n) => n.situacao !== 'cancelada')) return false
  const ultima = notasDaConta[notasDaConta.length - 1]
  return !ultima || ultima.cancelamento?.tipo === 'erro'
}

/** O código de verificação no formato da prefeitura de São Paulo (oito letras e números). */
export function codigoDeVerificacao(semente: string) {
  const s = sorteador(`verificacao-${semente}`)
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const parte = () =>
    Array.from({ length: 4 }, () => letras[s.inteiro(0, letras.length - 1)]).join('')
  return `${parte()}-${parte()}`
}

const NUMERO = new Intl.NumberFormat('pt-BR')

export function numeroDaNota(numero: number) {
  return NUMERO.format(numero)
}

export function dataCompleta(data: DataISO) {
  return `${data.slice(8, 10)}/${data.slice(5, 7)}/${data.slice(0, 4)}`
}

export function cpfEscrito(cpf: string) {
  return stripCpf(cpf) ? formatCpf(cpf) : 'Não informado'
}

/** "no app e no e-mail de Marina": por onde a nota chega ao responsável. */
export function porOndeChega(envio: Pick<EnvioDaNota, 'app' | 'email'>, nome: string) {
  const primeiro = nome.split(' ')[0] ?? nome
  if (envio.app && envio.email) return `no app e no e-mail de ${primeiro}`
  if (envio.app) return `no app de ${primeiro}`
  if (envio.email) return `no e-mail de ${primeiro}`
  return ''
}

/** Por onde a nota pode chegar: o app (quem tem cadastro e recebe o recibo nele) e o e-mail. */
export function canaisDoTomador(tomador: TomadorDaNota, reciboNoApp: boolean) {
  return { app: Boolean(tomador.tutorId) && reciboNoApp, email: Boolean(tomador.email) }
}

/** A nota pedida à prefeitura, ainda sem número: nasce em processamento. */
export function montarNota(
  conta: Conta,
  dados: {
    id: string
    config: ConfiguracaoDaNota
    data: DataISO
    hora: string
    numeroRps: number
    tomador: TomadorDaNota
  },
): NotaFiscal {
  const { servicos, desconto } = valorDosServicos(conta)
  const comoItem = (item: Conta['itens'][number]): ItemDaNota => ({
    nome: item.nome,
    quantidade: item.quantidade,
    valor: item.preco * item.quantidade,
  })
  return {
    id: dados.id,
    contaId: conta.id,
    numero: null,
    serieRps: dados.config.serieRps,
    numeroRps: dados.numeroRps,
    emitidaEm: dados.data,
    hora: dados.hora,
    competencia: conta.data,
    tomador: { ...dados.tomador },
    petNome: conta.petNome,
    itens: conta.itens.filter(ehServico).map(comoItem),
    foraDaNota: conta.itens.filter((item) => !ehServico(item)).map(comoItem),
    codigoDoServico: dados.config.codigoDoServico,
    valorDosServicos: servicos,
    desconto,
    aliquota: dados.config.aliquota,
    codigoDeVerificacao: null,
    situacao: 'processando',
    recusa: null,
    cancelamento: null,
    envio: null,
    substitui: null,
  }
}

/** O CPF com os dois últimos dígitos trocados: o erro de digitação mais comum no balcão. */
function cpfDigitadoErrado(cpf: string) {
  const d = stripCpf(cpf).split('')
  if (d.length !== 11) return '111.222.333-45'
  ;[d[9], d[10]] = [d[10]!, d[9]!]
  if (isValidCpf(d.join(''))) d[10] = String((Number(d[10]) + 1) % 10)
  return formatCpf(d.join(''))
}

function minutoDepois(hora: string, minutos: number) {
  return horaDeMinutos(minutosDaHora(hora) + minutos)
}

export type NotasGeradas = {
  notas: NotaFiscal[]
  proximoRps: number
  proximoNumero: number
}

/**
 * As notas dos meses do protótipo, a partir das contas pagas. Determinístico como o resto (o mesmo
 * dia gera as mesmas notas), e com um pouco de tudo para a tela mostrar:
 *
 * - quase todas autorizadas, enviadas ao app e ao e-mail do responsável;
 * - as duas últimas pagas hoje ainda em processamento na prefeitura;
 * - duas recusadas na semana, por CPF (um digitado errado, um que faltava), esperando correção;
 * - uma cancelada por erro no mês, com a nota certa logo depois;
 * - quatro contas pagas nos últimos três dias sem nota (a recepção desligou o "Emitir nota"):
 *   são a fila "A emitir". Essas contas ficam com `nota: false`.
 */
export function gerarNotas(
  contas: Conta[],
  hoje: DataISO,
  config: ConfiguracaoDaNota,
  tomadorDe: (conta: Conta) => TomadorDaNota = tomadorDoCadastro,
): NotasGeradas {
  const pagas = contas
    .filter((conta) => conta.situacao === 'paga' && temServico(conta))
    .map((conta) => ({ conta, ...momentoDoPagamento(conta) }))
    .sort((a, b) => a.data.localeCompare(b.data) || a.hora.localeCompare(b.hora))

  type Paga = (typeof pagas)[number]
  const escolhidas = new Set<string>()
  /** A conta em uma posição da lista (de 0 a 1), pulando as que já têm papel. */
  function escolher(lista: Paga[], fracao: number): Paga | null {
    const livres = lista.filter((p) => !escolhidas.has(p.conta.id))
    const alvo = livres[Math.round(fracao * (livres.length - 1))] ?? null
    if (alvo) escolhidas.add(alvo.conta.id)
    return alvo
  }

  const processando = new Set(
    pagas
      .filter((p) => p.data === hoje)
      .slice(-2)
      .map((p) => p.conta.id),
  )
  processando.forEach((id) => escolhidas.add(id))

  const daSemana = pagas.filter((p) => p.data >= addDays(hoje, -5) && p.data <= addDays(hoje, -2))
  const recusaPorCpfErrado = escolher(daSemana, 0.3)?.conta.id
  const recusaSemCpf = escolher(daSemana, 0.75)?.conta.id

  const recentes = pagas.filter((p) => p.data >= addDays(hoje, -3) && p.data < hoje)
  const semNota = new Set(
    [0.1, 0.4, 0.7, 1]
      .map((fracao) => escolher(recentes, fracao)?.conta.id)
      .filter((id): id is string => Boolean(id)),
  )

  const antigas = pagas.filter((p) => p.data <= addDays(hoje, -3))
  const doMes = antigas.filter((p) => mesDe(p.data) === mesDe(hoje))
  const corrigiveis = (lista: Paga[]) =>
    lista.filter((p) => p.conta.desconto > 0 || p.conta.itens.filter(ehServico).length > 1)
  const cancelada = escolher(corrigiveis(doMes), 0.5) ?? escolher(corrigiveis(antigas), 1) ?? null

  const notas: NotaFiscal[] = []
  for (const { conta, data, hora } of pagas) {
    if (semNota.has(conta.id)) {
      conta.nota = false
      continue
    }
    const tomador = tomadorDe(conta)
    if (conta.id === recusaPorCpfErrado) tomador.cpf = cpfDigitadoErrado(tomador.cpf)
    if (conta.id === recusaSemCpf) tomador.cpf = ''
    const emitidaEm = minutoDepois(hora, 1)
    const nota = montarNota(conta, {
      id: `nota-${conta.id}`,
      config,
      data,
      hora: emitidaEm,
      numeroRps: 0,
      tomador,
    })
    const envio = canaisDoTomador(tomador, conta.reciboNoApp)
    const enviar = () => {
      nota.envio = envio.app || envio.email ? { ...envio, data } : null
    }

    if (processando.has(conta.id)) {
      notas.push(nota)
      continue
    }
    const problema = problemaDoTomador(tomador)
    if (problema) {
      nota.situacao = 'rejeitada'
      nota.recusa = problema
      notas.push(nota)
      continue
    }
    nota.situacao = 'autorizada'
    enviar()

    if (conta.id === cancelada?.conta.id) {
      /* A primeira saiu errada (sem o desconto, ou sem o último serviço) e foi cancelada 40 min depois. */
      const semDesconto = conta.desconto > 0
      const esquecido = nota.itens[nota.itens.length - 1]
      if (semDesconto) {
        nota.desconto = 0
      } else if (esquecido) {
        nota.itens = nota.itens.slice(0, -1)
        nota.valorDosServicos -= esquecido.valor
      }
      const horaDoCancelamento = minutoDepois(emitidaEm, 40)
      nota.situacao = 'cancelada'
      nota.cancelamento = {
        tipo: 'erro',
        motivo: semDesconto
          ? 'O desconto combinado com o responsável ficou de fora da nota.'
          : `Faltou ${esquecido?.nome.toLowerCase() ?? 'um serviço'} na discriminação.`,
        data,
        hora: horaDoCancelamento,
        por: 'Marina Duarte',
      }
      const certa = montarNota(conta, {
        id: `nota-${conta.id}-certa`,
        config,
        data,
        hora: minutoDepois(horaDoCancelamento, 2),
        numeroRps: 0,
        tomador,
      })
      certa.situacao = 'autorizada'
      certa.substitui = nota.id
      certa.envio = nota.envio ? { ...nota.envio } : null
      notas.push(nota, certa)
      continue
    }
    notas.push(nota)
  }

  /* A numeração segue a ordem da emissão: o RPS para todas, o número só para as autorizadas. */
  notas.sort((a, b) => a.emitidaEm.localeCompare(b.emitidaEm) || a.hora.localeCompare(b.hora))
  let rps = config.proximoRps
  let numero = NUMERO_INICIAL
  for (const nota of notas) {
    nota.numeroRps = rps++
    if (nota.situacao === 'autorizada' || nota.situacao === 'cancelada') {
      nota.numero = numero++
      nota.codigoDeVerificacao = codigoDeVerificacao(`${nota.id}-${nota.numero}`)
    }
  }
  return { notas, proximoRps: rps, proximoNumero: numero }
}
