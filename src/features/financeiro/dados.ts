/**
 * Financeiro da clínica: protótipo (18/11/2026, pedido do Luís: "o financeiro da clínica e dos
 * veterinários, bem completo e bem pensado", com VetSmart, SimplesVet, ezyVet e Provet como
 * referência).
 *
 * Tudo aqui é ilustrativo e roda no navegador, sobre a clínica de demonstração: os atendimentos de
 * hoje saem da agenda dela (`getDataset`), e os seis meses para trás são gerados de forma
 * determinística (o mesmo dia gera os mesmos números) com os mesmos pacientes, responsáveis e
 * veterinários. Nenhum valor sai do computador: não há cobrança, nota nem mensagem de verdade.
 *
 * As peças e de onde vieram:
 *
 * - **A conta nasce do atendimento.** O veterinário finaliza e o que foi feito (consulta, vacina,
 *   exame, medicação) vira a conta do responsável, com os preços da tabela. A recepção só recebe.
 *   Venda de balcão (antipulgas, ração) é uma conta avulsa.
 * - **O caixa abre e fecha com conferência por forma de pagamento** (o "fim do dia" do ezyVet):
 *   o que o sistema esperava contra o que a gaveta e a maquininha dizem.
 * - **Cartão tem taxa e prazo.** O crédito parcelado cai em parcelas de 30 em 30 dias, já sem a
 *   taxa: é o "a receber" que a clínica não vê na gaveta.
 * - **"Deixar em aberto"** é o fiado de balcão, com vencimento; vira débito do cliente, que se
 *   lembra pelo app da PetJourney.
 * - **Repasse do veterinário por regra** (a "conferência e fechamento de comissões" do
 *   SimplesVet): porcentagem por tipo de serviço, valor por dia ou por procedimento. Sai do valor
 *   que a clínica de fato recebeu, sem a taxa do cartão; o que está em aberto entra quando o
 *   cliente paga. Fechar o mês vira uma conta a pagar.
 * - **Resultado pelo mês do atendimento** (competência), com o demonstrativo em linhas que um dono
 *   de clínica lê sem contador do lado.
 */
import { getDataset } from '@/features/clinico/data/store'
import type {
  Appointment,
  AppointmentTypeKind,
  Pet,
  PetSpecies,
  Tutor,
} from '@/features/clinico/data/types'
import { addDays, diffDays, weekdayOf } from '@/features/clinico/domain/clinic-time'
import { clinicClock } from '@/features/clinico/stores/clinico'

/** Dinheiro sempre em centavos inteiros: soma de reais com vírgula erra no terceiro decimal. */
export type Centavos = number
export type DataISO = string

// ---------------------------------------------------------------------------------- catálogo

export type TipoDeItem =
  | 'consulta'
  | 'retorno'
  | 'vacina'
  | 'exame'
  | 'cirurgia'
  | 'anestesia'
  | 'emergencia'
  | 'internacao'
  | 'medicacao'
  | 'banho'
  | 'produto'

export type ItemDePreco = {
  id: string
  nome: string
  grupo: 'servico' | 'produto'
  tipo: TipoDeItem
  preco: Centavos
}

export const ROTULO_DO_TIPO: Record<TipoDeItem, string> = {
  consulta: 'Consultas',
  retorno: 'Retornos',
  vacina: 'Vacinas',
  exame: 'Exames',
  cirurgia: 'Cirurgias',
  anestesia: 'Anestesias',
  emergencia: 'Emergências',
  internacao: 'Internação',
  medicacao: 'Medicação aplicada',
  banho: 'Banho e tosa',
  produto: 'Produtos',
}

export const ICONE_DO_TIPO: Record<TipoDeItem, string> = {
  consulta: 'ph ph-stethoscope',
  retorno: 'ph ph-arrow-counter-clockwise',
  vacina: 'ph ph-syringe',
  exame: 'ph ph-test-tube',
  cirurgia: 'ph ph-first-aid-kit',
  anestesia: 'ph ph-heartbeat',
  emergencia: 'ph ph-siren',
  internacao: 'ph ph-bed',
  medicacao: 'ph ph-pill',
  banho: 'ph ph-drop',
  produto: 'ph ph-shopping-bag',
}

/** A tabela de preços da clínica de demonstração (valores de 2026, faixa de capital). */
export const TABELA_INICIAL: ItemDePreco[] = [
  { id: 'consulta', nome: 'Consulta clínica', grupo: 'servico', tipo: 'consulta', preco: 18000 },
  {
    id: 'consulta-especialista',
    nome: 'Consulta com especialista',
    grupo: 'servico',
    tipo: 'consulta',
    preco: 26000,
  },
  { id: 'retorno', nome: 'Retorno (até 30 dias)', grupo: 'servico', tipo: 'retorno', preco: 9000 },
  { id: 'v10', nome: 'Vacina V10', grupo: 'servico', tipo: 'vacina', preco: 11000 },
  { id: 'v4-felina', nome: 'Vacina V4 felina', grupo: 'servico', tipo: 'vacina', preco: 12000 },
  { id: 'antirrabica', nome: 'Vacina antirrábica', grupo: 'servico', tipo: 'vacina', preco: 8000 },
  { id: 'hemograma', nome: 'Hemograma completo', grupo: 'servico', tipo: 'exame', preco: 7500 },
  { id: 'bioquimico', nome: 'Perfil bioquímico', grupo: 'servico', tipo: 'exame', preco: 12000 },
  { id: 'ultrassom', nome: 'Ultrassom abdominal', grupo: 'servico', tipo: 'exame', preco: 22000 },
  { id: 'raio-x', nome: 'Raio X (duas posições)', grupo: 'servico', tipo: 'exame', preco: 19000 },
  { id: 'eco', nome: 'Ecocardiograma', grupo: 'servico', tipo: 'exame', preco: 32000 },
  {
    id: 'castracao-cao',
    nome: 'Castração de cão até 10 kg',
    grupo: 'servico',
    tipo: 'cirurgia',
    preco: 85000,
  },
  {
    id: 'castracao-gata',
    nome: 'Castração de gata',
    grupo: 'servico',
    tipo: 'cirurgia',
    preco: 65000,
  },
  {
    id: 'profilaxia',
    nome: 'Limpeza de tártaro',
    grupo: 'servico',
    tipo: 'cirurgia',
    preco: 48000,
  },
  {
    id: 'anestesia',
    nome: 'Anestesia inalatória',
    grupo: 'servico',
    tipo: 'anestesia',
    preco: 35000,
  },
  {
    id: 'emergencia',
    nome: 'Atendimento de emergência',
    grupo: 'servico',
    tipo: 'emergencia',
    preco: 32000,
  },
  { id: 'fluido', nome: 'Fluidoterapia', grupo: 'servico', tipo: 'medicacao', preco: 9000 },
  {
    id: 'medicacao',
    nome: 'Medicação aplicada (dose)',
    grupo: 'servico',
    tipo: 'medicacao',
    preco: 3500,
  },
  {
    id: 'diaria',
    nome: 'Diária de internação',
    grupo: 'servico',
    tipo: 'internacao',
    preco: 28000,
  },
  { id: 'banho', nome: 'Banho e tosa (porte médio)', grupo: 'servico', tipo: 'banho', preco: 9500 },
  {
    id: 'antipulgas',
    nome: 'Antipulgas mastigável (1 dose)',
    grupo: 'produto',
    tipo: 'produto',
    preco: 12900,
  },
  {
    id: 'vermifugo',
    nome: 'Vermífugo (comprimido)',
    grupo: 'produto',
    tipo: 'produto',
    preco: 4500,
  },
  {
    id: 'racao',
    nome: 'Ração terapêutica 2 kg',
    grupo: 'produto',
    tipo: 'produto',
    preco: 18900,
  },
  {
    id: 'shampoo',
    nome: 'Shampoo de clorexidina',
    grupo: 'produto',
    tipo: 'produto',
    preco: 6800,
  },
  { id: 'colar', nome: 'Colar elizabetano', grupo: 'produto', tipo: 'produto', preco: 3900 },
]

// ------------------------------------------------------------------------ formas de pagamento

export type FormaDePagamento = 'pix' | 'dinheiro' | 'debito' | 'credito' | 'em-aberto'

export type CondicaoDaForma = {
  forma: FormaDePagamento
  nome: string
  icone: string
  /** Fração cobrada pela maquininha (0,0309 = 3,09%). */
  taxa: number
  /** Taxa do crédito parcelado (de 2 parcelas em diante). */
  taxaParcelado?: number
  /** Em quantos dias o dinheiro cai na conta (por parcela, no crédito). */
  prazoDias: number
  maxParcelas?: number
}

export const CONDICOES_INICIAIS: CondicaoDaForma[] = [
  { forma: 'pix', nome: 'Pix', icone: 'ph ph-qr-code', taxa: 0, prazoDias: 0 },
  { forma: 'debito', nome: 'Débito', icone: 'ph ph-credit-card', taxa: 0.0149, prazoDias: 1 },
  {
    forma: 'credito',
    nome: 'Crédito',
    icone: 'ph ph-credit-card',
    taxa: 0.0309,
    taxaParcelado: 0.0399,
    prazoDias: 30,
    maxParcelas: 6,
  },
  { forma: 'dinheiro', nome: 'Dinheiro', icone: 'ph ph-money', taxa: 0, prazoDias: 0 },
  {
    forma: 'em-aberto',
    nome: 'Deixar em aberto',
    icone: 'ph ph-hourglass-medium',
    taxa: 0,
    prazoDias: 15,
  },
]

// ------------------------------------------------------------------------------------- contas

export type ItemDaConta = {
  id: string
  precoId: string
  nome: string
  tipo: TipoDeItem
  quantidade: number
  /** Preço unitário na hora da conta: mudar a tabela depois não reescreve conta velha. */
  preco: Centavos
  /** Quem fez: é por aqui que o repasse acha o veterinário. Nulo no produto e no banho. */
  profissionalId: string | null
}

export type Pagamento = {
  id: string
  forma: FormaDePagamento
  valor: Centavos
  parcelas: number
  data: DataISO
  hora: string
  /** A taxa congelada no recebimento (a da tabela de formas naquele dia). */
  taxa: number
  por: string
}

export type OrigemDaConta = 'atendimento' | 'internacao' | 'balcao'

/**
 * `aberta`: esperando no balcão. `paga`: quitada. `em-aberto`: o responsável levou sem pagar, com
 * vencimento (o fiado). `correndo`: internação, a conta cresce até a alta.
 */
export type SituacaoDaConta = 'aberta' | 'paga' | 'em-aberto' | 'correndo'

export type Lembrete = {
  data: DataISO
  canal: 'app' | 'telefone' | 'whatsapp' | 'presencial'
  nota: string
}

export type Conta = {
  id: string
  data: DataISO
  hora: string
  origem: OrigemDaConta
  petId: string | null
  petNome: string
  especie: PetSpecies | null
  fotoUrl: string
  tutorId: string | null
  tutorNome: string
  /** O veterinário do atendimento (a linha da lista); cada item tem o seu. */
  profissionalId: string | null
  itens: ItemDaConta[]
  desconto: Centavos
  pagamentos: Pagamento[]
  situacao: SituacaoDaConta
  vencimento: DataISO | null
  lembretes: Lembrete[]
  reciboNoApp: boolean
  nota: boolean
}

// ------------------------------------------------------------------------------------ despesas

export type CategoriaDeDespesa =
  | 'fornecedores'
  | 'laboratorio'
  | 'aluguel'
  | 'folha'
  | 'encargos'
  | 'repasses'
  | 'impostos'
  | 'consumo'
  | 'servicos'
  | 'manutencao'
  | 'marketing'
  | 'outros'

export const CATEGORIAS: Record<CategoriaDeDespesa, { nome: string; icone: string }> = {
  fornecedores: { nome: 'Medicamentos, vacinas e materiais', icone: 'ph ph-package' },
  laboratorio: { nome: 'Laboratório de apoio', icone: 'ph ph-flask' },
  aluguel: { nome: 'Aluguel e condomínio', icone: 'ph ph-buildings' },
  folha: { nome: 'Salários da equipe', icone: 'ph ph-users-three' },
  encargos: { nome: 'Encargos (INSS, FGTS)', icone: 'ph ph-scales' },
  repasses: { nome: 'Repasses aos veterinários', icone: 'ph ph-hand-coins' },
  impostos: { nome: 'Impostos (Simples Nacional)', icone: 'ph ph-bank' },
  consumo: { nome: 'Energia, água e internet', icone: 'ph ph-lightning' },
  servicos: { nome: 'Contabilidade e sistemas', icone: 'ph ph-briefcase' },
  manutencao: { nome: 'Manutenção e equipamentos', icone: 'ph ph-wrench' },
  marketing: { nome: 'Divulgação', icone: 'ph ph-megaphone-simple' },
  outros: { nome: 'Outras despesas', icone: 'ph ph-dots-three-circle' },
}

export type OrigemDaDespesa =
  | { tipo: 'estoque'; texto: string }
  | { tipo: 'repasse'; texto: string; profissionalId: string; mes: string }

export type Despesa = {
  id: string
  descricao: string
  fornecedor: string
  categoria: CategoriaDeDespesa
  valor: Centavos
  vencimento: DataISO
  pagaEm: DataISO | null
  recorrente: boolean
  origem: OrigemDaDespesa | null
}

// ------------------------------------------------------------------------------------ repasses

export type ModeloDeRepasse = 'percentual' | 'por-dia' | 'por-procedimento'

/** Sobre o que a porcentagem incide. */
export type BaseDoRepasse = 'cobrado' | 'recebido' | 'liquido'

export const ROTULO_DA_BASE: Record<BaseDoRepasse, string> = {
  cobrado: 'Sobre o valor cobrado',
  recebido: 'Sobre o valor recebido',
  liquido: 'Sobre o valor recebido, sem a taxa do cartão',
}

export type RegraDeRepasse = {
  profissionalId: string
  vinculo: string
  modelo: ModeloDeRepasse
  percentuais: Partial<Record<TipoDeItem, number>>
  valorPorDia: Centavos
  valorPorProcedimento: Centavos
  procedimento: TipoDeItem
  base: BaseDoRepasse
  chavePix: string
}

export type Adiantamento = {
  id: string
  profissionalId: string
  data: DataISO
  valor: Centavos
  nota: string
}

/** O mês fechado de um veterinário: o valor fica congelado no fechamento. */
export type Fechamento = {
  profissionalId: string
  mes: string
  fechadoEm: DataISO
  valor: Centavos
  pagoEm: DataISO | null
}

// --------------------------------------------------------------------------------------- caixa

export type MovimentoDoCaixa = {
  id: string
  tipo: 'retirada' | 'reforco'
  valor: Centavos
  motivo: string
  hora: string
  por: string
}

export type CaixaDoDia = {
  data: DataISO
  abertoEm: string | null
  abertoPor: string
  trocoInicial: Centavos
  movimentos: MovimentoDoCaixa[]
  fechadoEm: string | null
  fechadoPor: string
  /** O que se contou no fechamento, por forma. */
  contado: Partial<Record<FormaDePagamento, Centavos>>
  observacao: string
}

// ------------------------------------------------------------------------------------- pessoas

export const RECEPCAO = 'Bruna Lima'
export const QUEM_USA = 'Marina Duarte'

/** As regras da clínica de demonstração: um modelo de cada, para mostrar a escolha. */
export const REGRAS_INICIAIS: RegraDeRepasse[] = [
  {
    profissionalId: 'prof-ana',
    vinculo: 'Prestadora (PJ)',
    modelo: 'percentual',
    percentuais: { consulta: 0.4, retorno: 0.4, vacina: 0.15, exame: 0.2, emergencia: 0.4 },
    valorPorDia: 0,
    valorPorProcedimento: 0,
    procedimento: 'consulta',
    base: 'liquido',
    chavePix: 'ana.ribeiro@vet.com.br',
  },
  {
    profissionalId: 'prof-helena',
    vinculo: 'Prestadora (PJ)',
    modelo: 'percentual',
    percentuais: { consulta: 0.5, retorno: 0.4, exame: 0.2 },
    valorPorDia: 0,
    valorPorProcedimento: 0,
    procedimento: 'consulta',
    base: 'liquido',
    chavePix: '(11) 97412-3380',
  },
  {
    profissionalId: 'prof-caio',
    vinculo: 'Volante (cirurgias)',
    modelo: 'percentual',
    percentuais: { cirurgia: 0.35 },
    valorPorDia: 0,
    valorPorProcedimento: 0,
    procedimento: 'cirurgia',
    base: 'recebido',
    chavePix: '318.552.770-14',
  },
  {
    profissionalId: 'prof-tiago',
    vinculo: 'Volante (por dia)',
    modelo: 'por-dia',
    percentuais: {},
    valorPorDia: 70000,
    valorPorProcedimento: 0,
    procedimento: 'consulta',
    base: 'cobrado',
    chavePix: 'tiago.sa.cardio@gmail.com',
  },
  {
    profissionalId: 'prof-marcia',
    vinculo: 'Volante (por anestesia)',
    modelo: 'por-procedimento',
    percentuais: {},
    valorPorDia: 0,
    valorPorProcedimento: 25000,
    procedimento: 'anestesia',
    base: 'cobrado',
    chavePix: 'marcia.anestesia@vet.com.br',
  },
]

// ------------------------------------------------------------------------------- contas da casa

export function totalBruto(conta: Pick<Conta, 'itens'>): Centavos {
  return conta.itens.reduce((soma, item) => soma + item.preco * item.quantidade, 0)
}

export function totalDaConta(conta: Pick<Conta, 'itens' | 'desconto'>): Centavos {
  return Math.max(0, totalBruto(conta) - conta.desconto)
}

/** O que já entrou (o "em aberto" não é pagamento: é a promessa dele). */
export function pagoDaConta(conta: Pick<Conta, 'pagamentos'>): Centavos {
  return conta.pagamentos
    .filter((pagamento) => pagamento.forma !== 'em-aberto')
    .reduce((soma, pagamento) => soma + pagamento.valor, 0)
}

export function devidoDaConta(conta: Conta): Centavos {
  return Math.max(0, totalDaConta(conta) - pagoDaConta(conta))
}

export function taxaDoPagamento(pagamento: Pagamento): Centavos {
  return Math.round(pagamento.valor * pagamento.taxa)
}

export function taxasDaConta(conta: Conta): Centavos {
  return conta.pagamentos.reduce((soma, pagamento) => soma + taxaDoPagamento(pagamento), 0)
}

// ------------------------------------------------------------------------------ gerador estável

/** mulberry32: o mesmo texto dá a mesma sequência; nada de `Math.random` em dado de tela. */
export function sorteador(texto: string) {
  let h = 1779033703 ^ texto.length
  for (let i = 0; i < texto.length; i++) {
    h = Math.imul(h ^ texto.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = h >>> 0
  const proximo = () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    numero: proximo,
    inteiro: (min: number, max: number) => min + Math.floor(proximo() * (max - min + 1)),
    um: <T>(lista: readonly T[]): T => lista[Math.floor(proximo() * lista.length)] as T,
    chance: (p: number) => proximo() < p,
  }
}

type Sorteio = ReturnType<typeof sorteador>

let sequencia = 0
export function novoIdFinanceiro(prefixo: string) {
  sequencia += 1
  return `${prefixo}-${sequencia.toString(36)}`
}

export function horaDeMinutos(minutos: number) {
  const m = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutos)))
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export function minutosDaHora(hora: string) {
  const [h, m] = hora.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

/** "2026-11" de uma data. */
export function mesDe(data: DataISO) {
  return data.slice(0, 7)
}

export function primeiroDoMes(mes: string): DataISO {
  return `${mes}-01`
}

export function ultimoDoMes(mes: string): DataISO {
  const [ano, m] = mes.split('-').map(Number)
  const dia = new Date(Date.UTC(ano!, m!, 0)).getUTCDate()
  return `${mes}-${String(dia).padStart(2, '0')}`
}

export function mesAnterior(mes: string, quantos = 1): string {
  const [ano, m] = mes.split('-').map(Number)
  const data = new Date(Date.UTC(ano!, m! - 1 - quantos, 1))
  return data.toISOString().slice(0, 7)
}

function preco(id: string): ItemDePreco {
  return (TABELA_INICIAL.find((item) => item.id === id) ?? TABELA_INICIAL[0]) as ItemDePreco
}

function item(id: string, profissionalId: string | null, quantidade = 1): ItemDaConta {
  const p = preco(id)
  return {
    id: novoIdFinanceiro('item'),
    precoId: p.id,
    nome: p.nome,
    tipo: p.tipo,
    quantidade,
    preco: p.preco,
    profissionalId,
  }
}

const ESPECIALISTAS = new Set(['prof-helena', 'prof-tiago'])

/** O que um atendimento costuma gerar, por tipo; a variação sai do sorteio do próprio atendimento. */
function itensDoAtendimento(
  kind: AppointmentTypeKind,
  profissionalId: string,
  especie: PetSpecies | null,
  s: Sorteio,
): ItemDaConta[] {
  const gato = especie === 'felina'
  switch (kind) {
    case 'consulta': {
      const itens = [
        item(
          ESPECIALISTAS.has(profissionalId) ? 'consulta-especialista' : 'consulta',
          profissionalId,
        ),
      ]
      if (s.chance(0.3)) itens.push(item('hemograma', profissionalId))
      if (s.chance(0.18))
        itens.push(item(profissionalId === 'prof-tiago' ? 'eco' : 'ultrassom', profissionalId))
      if (s.chance(0.25)) itens.push(item('medicacao', profissionalId, s.inteiro(1, 2)))
      if (s.chance(0.12)) itens.push(item(s.um(['antipulgas', 'vermifugo', 'shampoo']), null))
      return itens
    }
    case 'retorno':
      return [item('retorno', profissionalId)]
    case 'vacina': {
      const itens = [
        item(gato ? 'v4-felina' : s.chance(0.7) ? 'v10' : 'antirrabica', profissionalId),
      ]
      if (s.chance(0.25)) itens.push(item('antirrabica', profissionalId))
      if (s.chance(0.2)) itens.push(item('vermifugo', null))
      return itens
    }
    case 'exame': {
      const itens = [item(s.um(['ultrassom', 'raio-x', 'bioquimico']), profissionalId)]
      if (s.chance(0.5)) itens.push(item('hemograma', profissionalId))
      return itens
    }
    case 'cirurgia':
      return [
        item(gato ? 'castracao-gata' : s.chance(0.7) ? 'castracao-cao' : 'profilaxia', 'prof-caio'),
        item('anestesia', 'prof-marcia'),
        item('medicacao', 'prof-caio', s.inteiro(2, 3)),
        ...(s.chance(0.6) ? [item('colar', null)] : []),
      ]
    case 'banho':
      return [item('banho', null)]
    case 'emergencia':
      return [
        item('emergencia', profissionalId),
        item('fluido', profissionalId),
        item('medicacao', profissionalId, s.inteiro(1, 3)),
        ...(s.chance(0.5) ? [item('hemograma', profissionalId)] : []),
      ]
  }
}

/** Como a conta foi paga, no sorteio: Pix na frente, depois crédito, débito e dinheiro. */
function pagamentosSorteados(
  total: Centavos,
  data: DataISO,
  hora: string,
  s: Sorteio,
): { pagamentos: Pagamento[]; emAberto: boolean } {
  const sorteio = s.numero()
  const forma: FormaDePagamento =
    sorteio < 0.38
      ? 'pix'
      : sorteio < 0.68
        ? 'credito'
        : sorteio < 0.88
          ? 'debito'
          : sorteio < 0.975
            ? 'dinheiro'
            : 'em-aberto'
  if (forma === 'em-aberto') return { pagamentos: [], emAberto: true }
  const parcelas = forma === 'credito' && total >= 40000 && s.chance(0.55) ? s.inteiro(2, 4) : 1
  const condicao = CONDICOES_INICIAIS.find((c) => c.forma === forma)!
  const taxa =
    forma === 'credito' && parcelas > 1 ? (condicao.taxaParcelado ?? condicao.taxa) : condicao.taxa
  return {
    pagamentos: [
      {
        id: novoIdFinanceiro('pag'),
        forma,
        valor: total,
        parcelas,
        data,
        hora,
        taxa,
        por: RECEPCAO,
      },
    ],
    emAberto: false,
  }
}

type Cadastro = { pets: Pet[]; tutores: Tutor[] }

function tutorDoPet(cadastro: Cadastro, pet: Pet) {
  return cadastro.tutores.find((tutor) => tutor.id === pet.tutorId) ?? null
}

function montarConta(
  base: {
    data: DataISO
    hora: string
    pet: Pet | null
    tutor: Tutor | null
    profissionalId: string | null
    origem: OrigemDaConta
    itens: ItemDaConta[]
  },
  s: Sorteio,
): Conta {
  const desconto = s.chance(0.06) ? Math.round((totalBruto(base) * 0.1) / 100) * 100 : 0
  return {
    id: novoIdFinanceiro('conta'),
    data: base.data,
    hora: base.hora,
    origem: base.origem,
    petId: base.pet?.id ?? null,
    petNome: base.pet?.nome ?? 'Venda no balcão',
    especie: base.pet?.especie ?? null,
    fotoUrl: base.pet?.fotoUrl ?? '',
    tutorId: base.tutor?.id ?? null,
    tutorNome: base.tutor?.nome ?? 'Cliente sem cadastro',
    profissionalId: base.profissionalId,
    itens: base.itens,
    desconto,
    pagamentos: [],
    situacao: 'aberta',
    vencimento: null,
    lembretes: [],
    reciboNoApp: Boolean(base.tutor),
    nota: true,
  }
}

/** Quem atende cada tipo nos dias passados (a agenda de hoje traz o profissional de verdade). */
function profissionalDoTipo(kind: AppointmentTypeKind, data: DataISO, s: Sorteio): string {
  const diaDoTiago = [2, 4].includes(weekdayOf(data))
  switch (kind) {
    case 'consulta':
    case 'retorno': {
      const n = s.numero()
      if (diaDoTiago && n < 0.3) return 'prof-tiago'
      return n < 0.68 ? 'prof-ana' : 'prof-helena'
    }
    case 'exame':
      return diaDoTiago && s.chance(0.4) ? 'prof-tiago' : 'prof-ana'
    case 'cirurgia':
      return 'prof-caio'
    default:
      return 'prof-ana'
  }
}

const SORTEIO_DE_TIPO: [AppointmentTypeKind, number][] = [
  ['consulta', 0.38],
  ['vacina', 0.18],
  ['retorno', 0.13],
  ['exame', 0.1],
  ['banho', 0.08],
  ['cirurgia', 0.07],
  ['emergencia', 0.06],
]

function tipoSorteado(s: Sorteio): AppointmentTypeKind {
  let n = s.numero()
  for (const [kind, peso] of SORTEIO_DE_TIPO) {
    if (n < peso) return kind
    n -= peso
  }
  return 'consulta'
}

// ------------------------------------------------------------------------------------- o mundo

export type MundoDoFinanceiro = {
  hoje: DataISO
  agora: number
  contas: Conta[]
  despesas: Despesa[]
  adiantamentos: Adiantamento[]
  fechamentos: Fechamento[]
  caixa: CaixaDoDia
  /** Quantos estão em atendimento agora: a conta deles nasce quando o veterinário finalizar. */
  emAtendimento: number
}

const DESPESAS_FIXAS: {
  descricao: string
  fornecedor: string
  categoria: CategoriaDeDespesa
  valor: Centavos
  dia: number
}[] = [
  {
    descricao: 'Aluguel do imóvel',
    fornecedor: 'Imobiliária Paulista',
    categoria: 'aluguel',
    valor: 850000,
    dia: 5,
  },
  {
    descricao: 'Condomínio e IPTU',
    fornecedor: 'Condomínio Ed. Aurora',
    categoria: 'aluguel',
    valor: 120000,
    dia: 10,
  },
  {
    descricao: 'Salários (recepção e enfermagem)',
    fornecedor: 'Equipe',
    categoria: 'folha',
    valor: 1480000,
    dia: 5,
  },
  {
    descricao: 'INSS e FGTS',
    fornecedor: 'Receita Federal e Caixa',
    categoria: 'encargos',
    valor: 430000,
    dia: 20,
  },
  {
    descricao: 'Energia elétrica',
    fornecedor: 'Enel',
    categoria: 'consumo',
    valor: 190000,
    dia: 15,
  },
  { descricao: 'Água e esgoto', fornecedor: 'Sabesp', categoria: 'consumo', valor: 42000, dia: 15 },
  {
    descricao: 'Internet e telefone',
    fornecedor: 'Vivo Empresas',
    categoria: 'consumo',
    valor: 38000,
    dia: 12,
  },
  {
    descricao: 'Contabilidade',
    fornecedor: 'Escritório Contábil Faria',
    categoria: 'servicos',
    valor: 90000,
    dia: 10,
  },
  {
    descricao: 'Sistemas e assinaturas',
    fornecedor: 'Softwares da clínica',
    categoria: 'servicos',
    valor: 59000,
    dia: 8,
  },
  {
    descricao: 'Divulgação nas redes',
    fornecedor: 'Agência Ponto Pet',
    categoria: 'marketing',
    valor: 60000,
    dia: 18,
  },
  {
    descricao: 'Coleta de resíduos de saúde',
    fornecedor: 'Ambiental Saúde',
    categoria: 'servicos',
    valor: 32000,
    dia: 22,
  },
]

const FORNECEDORES_DO_MES: {
  descricao: string
  fornecedor: string
  fracao: number
  dia: number
  estoque: boolean
}[] = [
  {
    descricao: 'Lote de vacinas (V10 e antirrábica)',
    fornecedor: 'Zoetis',
    fracao: 0.035,
    dia: 7,
    estoque: true,
  },
  {
    descricao: 'Medicamentos e materiais',
    fornecedor: 'Distribuidora VetMais',
    fracao: 0.045,
    dia: 14,
    estoque: false,
  },
  {
    descricao: 'Lote de vacinas felinas',
    fornecedor: 'Boehringer Ingelheim',
    fracao: 0.012,
    dia: 21,
    estoque: true,
  },
  {
    descricao: 'Produtos de revenda',
    fornecedor: 'Pet Atacado Sul',
    fracao: 0.02,
    dia: 26,
    estoque: false,
  },
]

/**
 * O mundo inteiro do protótipo para "hoje": as contas dos seis meses para trás e as de hoje (da
 * agenda), as despesas até o mês que vem, os fechamentos de repasse e o caixa do dia.
 */
export function gerarMundo(): MundoDoFinanceiro {
  sequencia = 0
  const dataset = getDataset()
  const hoje = clinicClock.today()
  const agora = clinicClock.now().minutes
  const cadastro: Cadastro = { pets: dataset.pets, tutores: dataset.tutores }
  const petsComDono = dataset.pets.filter((pet) => tutorDoPet(cadastro, pet))
  const mesAtual = mesDe(hoje)
  const inicio = primeiroDoMes(mesAnterior(mesAtual, 5))

  const contas: Conta[] = []

  // Os dias passados: de seis meses atrás até ontem.
  for (let dia = inicio; dia < hoje; dia = addDays(dia, 1)) {
    const semana = weekdayOf(dia)
    if (semana === 0) continue
    const s = sorteador(`dia-${dia}`)
    /* A clínica cresce devagar no semestre: ~10% do primeiro ao último mês. */
    const crescimento = 0.92 + (diffDays(inicio, dia) / 180) * 0.1
    const quantos = Math.round((semana === 6 ? s.inteiro(9, 13) : s.inteiro(15, 22)) * crescimento)
    for (let i = 0; i < quantos; i++) {
      const kind = tipoSorteado(s)
      const pet = s.um(petsComDono)
      const tutor = tutorDoPet(cadastro, pet)
      const profissionalId = profissionalDoTipo(kind, dia, s)
      const hora = horaDeMinutos(
        8 * 60 + 15 + Math.floor((i / quantos) * 10 * 60) + s.inteiro(0, 20),
      )
      const conta = montarConta(
        {
          data: dia,
          hora,
          pet,
          tutor,
          profissionalId: kind === 'banho' ? null : profissionalId,
          origem: 'atendimento',
          itens: itensDoAtendimento(kind, profissionalId, pet.especie, s),
        },
        s,
      )
      const { pagamentos, emAberto } = pagamentosSorteados(
        totalDaConta(conta),
        dia,
        horaDeMinutos(minutosDaHora(hora) + 35),
        s,
      )
      conta.pagamentos = pagamentos
      if (emAberto) {
        conta.situacao = 'em-aberto'
        conta.vencimento = addDays(dia, 15)
        /*
         * Quase todo fiado com mais de um mês já foi acertado depois (no Pix); entre 15 e 30 dias,
         * metade. Sobram poucos atrasados, como numa clínica que cobra.
         */
        const idade = diffDays(dia, hoje)
        const acertou = idade > 30 ? s.chance(0.96) : idade > 15 ? s.chance(0.5) : false
        if (acertou) {
          const quitou = addDays(dia, s.inteiro(8, Math.min(25, idade - 1)))
          conta.pagamentos = [
            {
              id: novoIdFinanceiro('pag'),
              forma: 'pix',
              valor: totalDaConta(conta),
              parcelas: 1,
              data: quitou,
              hora: '11:20',
              taxa: 0,
              por: RECEPCAO,
            },
          ]
          conta.situacao = 'paga'
        } else if (addDays(conta.vencimento, 2) < hoje && s.chance(0.6)) {
          conta.lembretes.push({
            data: addDays(conta.vencimento, 2),
            canal: 'app',
            nota: 'Lembrete enviado pelo app',
          })
        }
      } else {
        conta.situacao = 'paga'
      }
      contas.push(conta)
    }
  }

  // Hoje: da agenda de demonstração.
  const deHoje = dataset.appointments
    .filter((a) => clinicClock.dateOf(a.inicio) === hoje)
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
  /*
   * A cirurgia ocupa duas salas e vira dois horários ligados na agenda (`linkedGroupId`): a conta
   * é uma só, a do primeiro.
   */
  const gruposVistos = new Set<string>()
  const finalizados = deHoje.filter((a) => {
    if (a.status !== 'finalizado') return false
    if (!a.linkedGroupId) return true
    if (gruposVistos.has(a.linkedGroupId)) return false
    gruposVistos.add(a.linkedGroupId)
    return true
  })
  const emAtendimento = deHoje.filter((a) => a.status === 'em-atendimento').length
  /* Os quatro últimos que terminaram ainda estão no balcão; os outros já pagaram. */
  const noBalcao = new Set(
    [...finalizados]
      .sort((a, b) => (b.finalizadoEm ?? b.fim).localeCompare(a.finalizadoEm ?? a.fim))
      .slice(0, 4)
      .map((a) => a.id),
  )
  finalizados.forEach((atendimento: Appointment, indice) => {
    const s = sorteador(`hoje-${atendimento.id}`)
    const pet = dataset.pets.find((p) => p.id === atendimento.petId) ?? null
    const tutor = dataset.tutores.find((t) => t.id === atendimento.tutorId) ?? null
    const kind = TIPOS_DA_AGENDA[atendimento.typeId] ?? 'consulta'
    const fim = clinicClock.minutesOf(atendimento.finalizadoEm ?? atendimento.fim)
    const conta = montarConta(
      {
        data: hoje,
        hora: horaDeMinutos(fim),
        pet,
        tutor,
        profissionalId: kind === 'banho' ? null : atendimento.professionalId,
        origem: 'atendimento',
        itens: itensDoAtendimento(kind, atendimento.professionalId, pet?.especie ?? null, s),
      },
      s,
    )
    conta.id = `conta-hoje-${atendimento.id}`
    if (!noBalcao.has(atendimento.id)) {
      /* Um dos de hoje levou sem pagar: o "deixar em aberto" na prática. */
      if (indice === 1) {
        conta.situacao = 'em-aberto'
        conta.vencimento = addDays(hoje, 15)
      } else {
        const { pagamentos } = pagamentosSorteados(
          totalDaConta(conta),
          hoje,
          horaDeMinutos(fim + 8),
          s,
        )
        conta.pagamentos = pagamentos
        conta.situacao = pagamentos.length ? 'paga' : 'em-aberto'
        if (!pagamentos.length) conta.vencimento = addDays(hoje, 15)
      }
    }
    contas.push(conta)
  })

  // Internados: a conta corre até a alta.
  for (const internacao of dataset.internacao.internacoes.filter((i) => i.status === 'internado')) {
    const pet = dataset.pets.find((p) => p.id === internacao.petId) ?? null
    const tutor = dataset.tutores.find((t) => t.id === internacao.tutorId) ?? null
    const entrada = clinicClock.dateOf(internacao.entradaEm)
    const diarias = Math.max(1, diffDays(entrada, hoje) + 1)
    const s = sorteador(`internacao-${internacao.id}`)
    const conta = montarConta(
      {
        data: entrada,
        hora: horaDeMinutos(clinicClock.minutesOf(internacao.entradaEm)),
        pet,
        tutor,
        profissionalId: internacao.responsavelId,
        origem: 'internacao',
        itens: [
          item('diaria', internacao.responsavelId, diarias),
          item('fluido', internacao.responsavelId, diarias),
          item('medicacao', internacao.responsavelId, diarias * s.inteiro(2, 4)),
          item('hemograma', internacao.responsavelId, Math.max(1, Math.round(diarias / 2))),
        ],
      },
      s,
    )
    conta.desconto = 0
    conta.situacao = 'correndo'
    /* Quem interna costuma deixar um adiantamento na entrada. */
    if (s.chance(0.7)) {
      conta.pagamentos = [
        {
          id: novoIdFinanceiro('pag'),
          forma: 'credito',
          valor: 60000,
          parcelas: 1,
          data: entrada,
          hora: conta.hora,
          taxa: 0.0309,
          por: RECEPCAO,
        },
      ]
    }
    contas.push(conta)
  }

  // Despesas: do primeiro mês gerado até o fim do mês que vem.
  const despesas: Despesa[] = []
  const proximoMes = mesAnterior(mesAtual, -1)
  for (let k = 5; k >= -1; k--) {
    const mes = mesAnterior(mesAtual, k)
    const receitaDoMes = (m: string) =>
      contas.filter((c) => mesDe(c.data) === m).reduce((soma, c) => soma + totalDaConta(c), 0)
    const referencia = receitaDoMes(k === -1 ? mesAtual : mes) || receitaDoMes(mesAnterior(mes))
    const vencimentoNoMes = (dia: number) => `${mes}-${String(Math.min(dia, 28)).padStart(2, '0')}`
    for (const fixa of DESPESAS_FIXAS) {
      const s = sorteador(`fixa-${mes}-${fixa.descricao}`)
      const variacao = fixa.categoria === 'consumo' ? 0.88 + s.numero() * 0.24 : 1
      despesas.push({
        id: novoIdFinanceiro('desp'),
        descricao: fixa.descricao,
        fornecedor: fixa.fornecedor,
        categoria: fixa.categoria,
        valor: Math.round((fixa.valor * variacao) / 100) * 100,
        vencimento: vencimentoNoMes(fixa.dia),
        pagaEm: null,
        recorrente: true,
        origem: null,
      })
    }
    if (mes === proximoMes) continue
    for (const compra of FORNECEDORES_DO_MES) {
      const s = sorteador(`compra-${mes}-${compra.descricao}`)
      despesas.push({
        id: novoIdFinanceiro('desp'),
        descricao: compra.descricao,
        fornecedor: compra.fornecedor,
        categoria: 'fornecedores',
        valor: Math.round((referencia * compra.fracao * (0.85 + s.numero() * 0.3)) / 100) * 100,
        vencimento: vencimentoNoMes(compra.dia + 7),
        pagaEm: null,
        recorrente: false,
        origem: compra.estoque
          ? {
              tipo: 'estoque',
              texto: `Entrou no estoque em ${vencimentoNoMes(compra.dia).slice(8)}/${mes.slice(5)}`,
            }
          : null,
      })
    }
    const exames = contas
      .filter((c) => mesDe(c.data) === mesAnterior(mes))
      .flatMap((c) => c.itens)
      .filter((i) => i.tipo === 'exame' && ['hemograma', 'bioquimico'].includes(i.precoId))
      .reduce((soma, i) => soma + i.preco * i.quantidade, 0)
    if (exames) {
      despesas.push({
        id: novoIdFinanceiro('desp'),
        descricao: 'Exames enviados ao laboratório',
        fornecedor: 'Laboratório VetAnálises',
        categoria: 'laboratorio',
        valor: Math.round((exames * 0.38) / 100) * 100,
        vencimento: vencimentoNoMes(12),
        pagaEm: null,
        recorrente: false,
        origem: null,
      })
    }
    const receitaAnterior = receitaDoMes(mesAnterior(mes))
    if (receitaAnterior) {
      despesas.push({
        id: novoIdFinanceiro('desp'),
        descricao: `Simples Nacional (receita de ${nomeDoMes(mesAnterior(mes))})`,
        fornecedor: 'Receita Federal',
        categoria: 'impostos',
        valor: Math.round((receitaAnterior * 0.06) / 100) * 100,
        vencimento: vencimentoNoMes(20),
        pagaEm: null,
        recorrente: true,
        origem: null,
      })
    }
  }
  /* Uma manutenção que passou do vencimento: o vermelho da lista. */
  despesas.push({
    id: novoIdFinanceiro('desp'),
    descricao: 'Revisão da autoclave',
    fornecedor: 'TecMed Equipamentos',
    categoria: 'manutencao',
    valor: 68000,
    vencimento: addDays(hoje, -4),
    pagaEm: null,
    recorrente: false,
    origem: null,
  })
  for (const despesa of despesas) {
    if (despesa.vencimento < hoje && !(despesa.categoria === 'manutencao' && !despesa.recorrente)) {
      despesa.pagaEm = despesa.vencimento
    }
  }

  // Repasses: os meses passados fechados no dia 1º; pagos no dia 5, menos o último do Caio.
  const fechamentos: Fechamento[] = []
  const adiantamentos: Adiantamento[] = [
    {
      id: novoIdFinanceiro('adi'),
      profissionalId: 'prof-ana',
      data: `${mesAtual}-10`,
      valor: 50000,
      nota: 'Adiantamento pedido pela Ana',
    },
  ]
  const mundoParcial = { contas, adiantamentos, regras: REGRAS_INICIAIS }
  for (let k = 5; k >= 1; k--) {
    const mes = mesAnterior(mesAtual, k)
    const fechadoEm = `${mesAnterior(mes, -1)}-01`
    for (const regra of REGRAS_INICIAIS) {
      const valor = calcularRepasse(regra, mes, mundoParcial, ultimoDoMes(mes)).aReceber
      const ultimo = k === 1
      const pagoEm =
        ultimo && regra.profissionalId === 'prof-caio' ? null : `${mesAnterior(mes, -1)}-05`
      fechamentos.push({ profissionalId: regra.profissionalId, mes, fechadoEm, valor, pagoEm })
      const nome = nomeDoProfissional(regra.profissionalId)
      despesas.push({
        id: novoIdFinanceiro('desp'),
        descricao: `Repasse de ${nomeDoMes(mes)} · ${nome}`,
        fornecedor: nome,
        categoria: 'repasses',
        valor,
        vencimento:
          ultimo && regra.profissionalId === 'prof-caio'
            ? addDays(hoje, 2)
            : `${mesAnterior(mes, -1)}-05`,
        pagaEm: pagoEm,
        recorrente: false,
        origem: {
          tipo: 'repasse',
          texto: `Fechado em ${fechadoEm.slice(8)}/${fechadoEm.slice(5, 7)}`,
          profissionalId: regra.profissionalId,
          mes,
        },
      })
    }
  }

  // O caixa de hoje: aberto às 8h02 pela recepção, com uma retirada depois do almoço.
  const caixa: CaixaDoDia = {
    data: hoje,
    abertoEm: agora >= 8 * 60 + 2 ? '08:02' : null,
    abertoPor: RECEPCAO,
    trocoInicial: 20000,
    movimentos:
      agora >= 13 * 60 + 10
        ? [
            {
              id: novoIdFinanceiro('mov'),
              tipo: 'retirada',
              valor: 30000,
              motivo: 'Depósito no banco',
              hora: '13:10',
              por: RECEPCAO,
            },
          ]
        : [],
    fechadoEm: null,
    fechadoPor: '',
    contado: {},
    observacao: '',
  }

  return { hoje, agora, contas, despesas, adiantamentos, fechamentos, caixa, emAtendimento }
}

/** Os tipos da agenda de demonstração (`fixtures/clinic.ts`), pelo id. */
const TIPOS_DA_AGENDA: Record<string, AppointmentTypeKind> = {
  'tipo-consulta': 'consulta',
  'tipo-retorno': 'retorno',
  'tipo-vacina': 'vacina',
  'tipo-exame': 'exame',
  'tipo-cirurgia': 'cirurgia',
  'tipo-banho': 'banho',
  'tipo-emergencia': 'emergencia',
}

// ------------------------------------------------------------------------------------- nomes

const NOMES: Record<
  string,
  { nome: string; curto: string; iniciais: string; corIndice: number; especialidade: string }
> = {
  'prof-ana': {
    nome: 'Ana Ribeiro',
    curto: 'Ana',
    iniciais: 'AR',
    corIndice: 0,
    especialidade: 'Clínica geral',
  },
  'prof-caio': {
    nome: 'Caio Nogueira',
    curto: 'Caio',
    iniciais: 'CN',
    corIndice: 1,
    especialidade: 'Cirurgia',
  },
  'prof-helena': {
    nome: 'Helena Vasconcelos Prado',
    curto: 'Helena',
    iniciais: 'HP',
    corIndice: 2,
    especialidade: 'Dermatologia',
  },
  'prof-tiago': {
    nome: 'Tiago Sá',
    curto: 'Tiago',
    iniciais: 'TS',
    corIndice: 3,
    especialidade: 'Cardiologia',
  },
  'prof-marcia': {
    nome: 'Márcia Do Espírito Santo Albuquerque',
    curto: 'Márcia',
    iniciais: 'MA',
    corIndice: 4,
    especialidade: 'Anestesiologia',
  },
}

export function profissional(id: string | null) {
  return (
    (id && NOMES[id]) || {
      nome: 'Sem veterinário',
      curto: '—',
      iniciais: '—',
      corIndice: 5,
      especialidade: '',
    }
  )
}

export function nomeDoProfissional(id: string | null) {
  return profissional(id).nome
}

export const IDS_DOS_VETERINARIOS = Object.keys(NOMES)

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

export function nomeDoMes(mes: string) {
  return MESES[Number(mes.slice(5, 7)) - 1] ?? mes
}

// ------------------------------------------------------------------------------------ repasse

export type LinhaDoRepasse = {
  id: string
  data: DataISO
  petNome: string
  tutorNome: string
  descricao: string
  base: Centavos
  regra: string
  valor: Centavos
  /** Entra quando o cliente pagar. */
  aguardando: boolean
}

export type CalculoDoRepasse = {
  linhas: LinhaDoRepasse[]
  producao: Centavos
  atendimentos: number
  bruto: Centavos
  adiantado: Centavos
  aReceber: Centavos
  aguardando: Centavos
}

function percentual(valor: number) {
  return `${Math.round(valor * 1000) / 10}%`.replace('.', ',')
}

/**
 * O repasse de um veterinário num mês, até a data de corte. Linha por atendimento (no por dia, uma
 * linha por dia trabalhado). O que ainda não foi pago pelo cliente aparece, marcado, e não soma.
 */
export function calcularRepasse(
  regra: RegraDeRepasse,
  mes: string,
  mundo: { contas: Conta[]; adiantamentos: Adiantamento[] },
  ate: DataISO,
): CalculoDoRepasse {
  const doMes = mundo.contas.filter(
    (conta) =>
      mesDe(conta.data) === mes &&
      conta.data <= ate &&
      conta.situacao !== 'correndo' &&
      conta.itens.some((item) => item.profissionalId === regra.profissionalId),
  )
  const linhas: LinhaDoRepasse[] = []
  let producao = 0

  if (regra.modelo === 'por-dia') {
    const dias = new Map<DataISO, Conta[]>()
    for (const conta of doMes) dias.set(conta.data, [...(dias.get(conta.data) ?? []), conta])
    for (const [data, contasDoDia] of [...dias.entries()].sort()) {
      const gerado = contasDoDia.reduce(
        (soma, conta) =>
          soma +
          conta.itens
            .filter((item) => item.profissionalId === regra.profissionalId)
            .reduce((s, item) => s + item.preco * item.quantidade, 0),
        0,
      )
      producao += gerado
      linhas.push({
        id: `dia-${data}`,
        data,
        petNome: `${contasDoDia.length} atendimentos`,
        tutorNome: '',
        descricao: 'Dia de atendimento',
        base: gerado,
        regra: 'Valor fixo por dia',
        valor: regra.valorPorDia,
        aguardando: false,
      })
    }
  } else {
    for (const conta of doMes) {
      const meus = conta.itens.filter((item) => item.profissionalId === regra.profissionalId)
      const brutoMeu = meus.reduce((soma, item) => soma + item.preco * item.quantidade, 0)
      producao += brutoMeu
      const totalBrutoConta = totalBruto(conta) || 1
      const fatorDesconto = 1 - conta.desconto / totalBrutoConta
      const pago = conta.situacao === 'paga' || pagoDaConta(conta) >= totalDaConta(conta)
      const taxaMedia =
        conta.pagamentos.length && pagoDaConta(conta) ? taxasDaConta(conta) / pagoDaConta(conta) : 0
      let valor = 0
      let base = 0
      const partes: string[] = []
      for (const item of meus) {
        const bruto = item.preco * item.quantidade
        if (regra.modelo === 'por-procedimento') {
          if (item.tipo !== regra.procedimento) continue
          valor += regra.valorPorProcedimento * item.quantidade
          base += bruto
          partes.push(item.nome)
          continue
        }
        const pct = regra.percentuais[item.tipo] ?? 0
        if (!pct) continue
        const recebido = regra.base === 'cobrado' ? bruto : bruto * fatorDesconto
        const liquido = regra.base === 'liquido' ? recebido * (1 - taxaMedia) : recebido
        base += liquido
        valor += liquido * pct
        partes.push(`${item.nome} ${percentual(pct)}`)
      }
      if (!partes.length) continue
      linhas.push({
        id: conta.id,
        data: conta.data,
        petNome: conta.petNome,
        tutorNome: conta.tutorNome,
        descricao: partes.join(' · '),
        base: Math.round(base),
        regra:
          regra.modelo === 'por-procedimento'
            ? 'Valor fixo por procedimento'
            : ROTULO_DA_BASE[regra.base],
        valor: Math.round(valor),
        aguardando: !pago,
      })
    }
  }

  linhas.sort((a, b) => a.data.localeCompare(b.data))
  const bruto = linhas.filter((l) => !l.aguardando).reduce((soma, l) => soma + l.valor, 0)
  const aguardando = linhas.filter((l) => l.aguardando).reduce((soma, l) => soma + l.valor, 0)
  const adiantado = mundo.adiantamentos
    .filter((a) => a.profissionalId === regra.profissionalId && mesDe(a.data) === mes)
    .reduce((soma, a) => soma + a.valor, 0)
  return {
    linhas,
    producao,
    atendimentos: regra.modelo === 'por-dia' ? doMes.length : linhas.length,
    bruto,
    adiantado,
    aReceber: Math.max(0, bruto - adiantado),
    aguardando,
  }
}

export function descreverRegra(regra: RegraDeRepasse): string {
  if (regra.modelo === 'por-dia') return `${reaisCurtos(regra.valorPorDia)} por dia de atendimento`
  if (regra.modelo === 'por-procedimento')
    return `${reaisCurtos(regra.valorPorProcedimento)} por ${ROTULO_DO_TIPO[regra.procedimento].toLowerCase().replace(/s$/, '')}`
  const partes = Object.entries(regra.percentuais)
    .filter(([, v]) => v)
    .map(
      ([tipo, v]) =>
        `${percentual(v as number)} ${ROTULO_DO_TIPO[tipo as TipoDeItem].toLowerCase()}`,
    )
  return partes.join(', ')
}

// ------------------------------------------------------------------------------------ formato

const REAIS = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const REAIS_CURTOS = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})

export function reais(centavos: Centavos) {
  return REAIS.format(centavos / 100)
}

/** Sem centavos: para totais grandes, onde os centavos só atrapalham a leitura. */
export function reaisCurtos(centavos: Centavos) {
  return REAIS_CURTOS.format(Math.round(centavos / 100))
}

export function dataCurta(data: DataISO) {
  return `${data.slice(8, 10)}/${data.slice(5, 7)}`
}

const DIAS_DA_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

export function dataComDia(data: DataISO) {
  return `${DIAS_DA_SEMANA[weekdayOf(data)]}, ${dataCurta(data)}`
}

export function porcento(fracao: number, casas = 0) {
  return `${(fracao * 100).toFixed(casas).replace('.', ',')}%`
}
