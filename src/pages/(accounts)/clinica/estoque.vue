<script setup lang="ts">
/**
 * Estoque de vacinas — a geladeira, as metas do mês e o que entrou e saiu.
 *
 * Mora em Pendências, como última aba: vacina é o único insumo que **estraga sozinho na
 * prateleira**, e frasco parado além da validade é prejuízo já pago e nunca faturado.
 *
 * Quatro telas na mesma, num controle segmentado logo abaixo das abas do destino (outro nível, não
 * outra fileira de abas), na ordem do uso:
 *
 * - **Geladeira** — o trabalho de todo dia. Por vacina, o saldo em número grande com o mínimo ao
 *   lado, quanto tempo ele dura (a barra de cobertura) e a situação em selo com palavra. Por lote, a
 *   validade em contagem regressiva colorida. As ações moram na linha: receber lote da vacina,
 *   ajustar o mínimo, dar baixa no frasco, descartar o vencido.
 * - **Metas** — o trabalho do começo e do fim do mês. O mês em curso contra o combinado, o próximo
 *   mês planejado com os dados deste, e o pedido de compra que sai das metas.
 * - **Movimentos** — a conferência: toda entrada e toda baixa, com quem e quando.
 * - **Análise** — os gráficos: o giro ao longo do ano, o saldo contra o piso, as perdas e a
 *   sobreposição das validades. Saíram da frente porque não pedem ação.
 *
 * O segmento vive na URL (`?aba=metas|movimentos|analise`; a geladeira é o endereço limpo): "olha as
 * metas de outubro" vai por mensagem com o link.
 */
import Button from 'primevue/button'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import UiPagina from '@/components/ui/UiPagina.vue'
import ClinicDataTable from '@/features/clinico/components/base/ClinicDataTable.vue'
import ClinicToggleGroup from '@/features/clinico/components/base/ClinicToggleGroup.vue'
import type { AcaoDeLinha, ColunaTabela } from '@/features/clinico/components/base/table-types'
import BaixaDeLoteDialog from '@/features/clinico/components/estoque/BaixaDeLoteDialog.vue'
import EstoqueChartConsumo from '@/features/clinico/components/estoque/EstoqueChartConsumo.vue'
import EstoqueChartSaldo from '@/features/clinico/components/estoque/EstoqueChartSaldo.vue'
import EstoqueChartValidade from '@/features/clinico/components/estoque/EstoqueChartValidade.vue'
import MetasDoMes from '@/features/clinico/components/estoque/MetasDoMes.vue'
import MinimoDialog from '@/features/clinico/components/estoque/MinimoDialog.vue'
import PlanoDoMesDialog from '@/features/clinico/components/estoque/PlanoDoMesDialog.vue'
import ReceberLoteDialog from '@/features/clinico/components/estoque/ReceberLoteDialog.vue'
import ClinicChartRanking from '@/features/clinico/components/resumo/ClinicChartRanking.vue'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import { useRotulosDoEstoque } from '@/features/clinico/composables/useRotulosDoEstoque'
import {
  estoqueRepository,
  vacinaRepository,
  type PainelDeMetas,
} from '@/features/clinico/data/repositories'
import {
  JANELA_DE_VALIDADE_EM_DIAS,
  type LoteNoEstoque,
  type MovimentoDeEstoque,
  type ResumoDoEstoque,
  type SaldoDaVacina,
} from '@/features/clinico/domain/estoque-vacinas'
import {
  custoDoPedido,
  diasRestantes,
  placar,
  type LinhaDoPedido,
} from '@/features/clinico/domain/metas-de-estoque'
import type { Fatia } from '@/features/clinico/domain/resumo'
import { clinicClock, useClinicoStore } from '@/features/clinico/stores/clinico'

type Aba = 'geladeira' | 'metas' | 'movimentos' | 'analise'
type FiltroDeMovimento = 'todos' | 'entrada' | 'baixa'
type Tom = 'risco' | 'atencao' | 'ok' | 'neutro'

const ABAS: Aba[] = ['geladeira', 'metas', 'movimentos', 'analise']

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const clinico = useClinicoStore()
const formato = useClinicFormat()
const rotulos = useRotulosDoEstoque()

/**
 * A data do lote leva o ano quando não é deste: "recebido em 03/12" lido em outubro parecia
 * dezembro que vem, e a validade "26/02" não dizia de que ano era.
 */
function dataDoLote(data: string) {
  return data.slice(0, 4) === clinicClock.today().slice(0, 4)
    ? formato.dataCurta(data)
    : formato.dataCurtaComAno(data)
}

const aba = ref<Aba>('geladeira')
const estoque = ref<ResumoDoEstoque | null>(null)
const painel = ref<PainelDeMetas | null>(null)
const movimentos = ref<MovimentoDeEstoque[]>([])
const carregando = ref(false)
const erro = ref('')

/** O catálogo com o mínimo ajustado. Relido a cada carga: o mínimo muda por esta tela. */
const catalogo = ref(vacinaRepository.catalogo())

async function carregar() {
  carregando.value = true
  erro.value = ''

  try {
    await clinico.carregar()

    const [geladeira, metas, lista] = await Promise.all([
      vacinaRepository.estoque(),
      estoqueRepository.metas(),
      estoqueRepository.movimentos(),
    ])

    estoque.value = geladeira
    painel.value = metas
    movimentos.value = lista
    catalogo.value = vacinaRepository.catalogo()
  } catch {
    erro.value = t('clinico.estoque.erroAoCarregar')
  } finally {
    carregando.value = false
  }
}

/**
 * Depois de gravar: avisa o resto do módulo (o selo do menu conta o que falta comprar) e relê a tela.
 */
function depoisDeGravar() {
  clinico.invalidarTudo()
  void carregar()
}

onMounted(() => {
  const daUrl = String(route.query.aba ?? '')

  if ((ABAS as string[]).includes(daUrl)) {
    aba.value = daUrl as Aba
  }

  void carregar()
})

/* A geladeira é o endereço limpo; o resto da query (o que outra tela passou) fica onde estava. */
watch(aba, (valor) => {
  const resto = { ...route.query }

  delete resto.aba
  void router.replace({ query: valor === 'geladeira' ? resto : { ...resto, aba: valor } })
})

const faltando = computed(() => estoque.value?.indicadores.vacinasAbaixoDoMinimo ?? 0)

const placarDoMes = computed(() => placar(painel.value?.atual.progresso ?? []))

const mesAtual = computed(() => painel.value?.atual.mes ?? clinicClock.today().slice(0, 7))
const proximoMes = computed(() => painel.value?.proximo.mes ?? '')

const opcoesAba = computed(() => [
  {
    valor: 'geladeira' as Aba,
    rotulo: t('clinico.estoque.aba.geladeira'),
    /* Zero não vira selo: um "0" ao lado da aba ensina a não olhar para ela. */
    contagem: faltando.value || undefined,
    tom: faltando.value > 0 ? ('atencao' as const) : ('neutro' as const),
  },
  {
    /* O selo das metas é o que pede conversa: falhou ou está abaixo do ritmo. */
    valor: 'metas' as Aba,
    rotulo: t('clinico.estoque.aba.metas'),
    contagem: placarDoMes.value.falhou + placarDoMes.value.atencao || undefined,
    tom: placarDoMes.value.falhou > 0 ? ('risco' as const) : ('atencao' as const),
  },
  { valor: 'movimentos' as Aba, rotulo: t('clinico.estoque.aba.movimentos') },
  { valor: 'analise' as Aba, rotulo: t('clinico.estoque.aba.analise') },
])

/**
 * A frase de estado: o tamanho da geladeira, o que comprar e como vai o mês. São as três coisas
 * que fazem alguém abrir esta tela, e cada uma leva a um segmento.
 */
const fraseDoResumo = computed(() => {
  if (!estoque.value) {
    return ''
  }

  const partes = [
    t('clinico.estoque.saudacao.doses', {
      n: rotulos.doses(estoque.value.indicadores.dosesEmEstoque),
    }),
    faltando.value > 0
      ? t('clinico.estoque.saudacao.comprar', { n: faltando.value }, faltando.value)
      : t('clinico.estoque.saudacao.nadaAComprar'),
  ]

  if (placarDoMes.value.total > 0) {
    partes.push(
      t('clinico.estoque.saudacao.metas', {
        bem: placarDoMes.value.bem,
        total: placarDoMes.value.total,
        mes: formato.mesPorExtenso(mesAtual.value),
      }),
    )
  }

  return partes.reduce((frase, parte) => t('clinico.estoque.par', { a: frase, b: parte }))
})

// ------------------------------------------------------------------ diálogos

const receberAberto = ref(false)
const vacinaParaReceber = ref<string | null>(null)
const quantidadeParaReceber = ref<number | null>(null)

function abrirReceber(vacinaId: string | null = null, quantidade: number | null = null) {
  vacinaParaReceber.value = vacinaId
  quantidadeParaReceber.value = quantidade
  receberAberto.value = true
}

const baixaAberta = ref(false)
const loteDaBaixa = ref<LoteNoEstoque | null>(null)

const minimoAberto = ref(false)
const saldoDoMinimo = ref<SaldoDaVacina | null>(null)

const planoAberto = ref(false)
const mesDoPlano = ref('')

function abrirPlano(mes: string) {
  mesDoPlano.value = mes
  planoAberto.value = true
}

const planoEmEdicao = computed(() => {
  if (!painel.value) {
    return null
  }

  return mesDoPlano.value === painel.value.atual.mes
    ? painel.value.atual.plano
    : painel.value.proximo.plano
})

/* A sugestão é do próximo mês: no mês em curso, o diálogo abre sem as colunas de referência. */
const sugestaoEmEdicao = computed(() =>
  painel.value && mesDoPlano.value === painel.value.proximo.mes ? painel.value.sugestao : null,
)

// ------------------------------------------------------------------ geladeira

/*
 * Receber é a ação que se procura, e tem rótulo; o mínimo é ajuste raro, e fica no ícone. O
 * critério é o da casa: o que a pessoa precisa achar tem fundo ou borda visível.
 */
function ajustarMinimo(linha: SaldoDaVacina) {
  saldoDoMinimo.value = linha
  minimoAberto.value = true
}

function tomDoSaldo(situacao: SaldoDaVacina['situacao']): Tom {
  if (situacao === 'zerado') {
    return 'risco'
  }

  return situacao === 'abaixo' ? 'atencao' : 'ok'
}

const ICONE_DO_SALDO: Record<SaldoDaVacina['situacao'], string> = {
  zerado: 'ph ph-x-circle',
  abaixo: 'ph ph-arrow-down',
  ok: 'ph ph-check',
}

/**
 * A régua da barra de cobertura: um ano. Curta o bastante para separar quem dura um mês de quem
 * dura seis, e longa o bastante para a vacina folgada não encher a barra de todas.
 */
const ESCALA_DA_COBERTURA_EM_DIAS = 365

function coberturaPreenchida(dias: number | null): number {
  if (dias === null) {
    return 0
  }

  return Math.min(100, Math.round((dias / ESCALA_DA_COBERTURA_EM_DIAS) * 100))
}

/** Menos de um mês de giro é compra para já; menos de dois, compra no próximo pedido. */
function tomDaCobertura(dias: number | null): Tom {
  if (dias === null) {
    return 'neutro'
  }

  if (dias < 30) {
    return 'risco'
  }

  return dias < 60 ? 'atencao' : 'ok'
}

function textoDeCobertura(dias: number | null): string {
  return dias === null
    ? t('clinico.vacinas.estoque.semCobertura')
    : t('clinico.vacinas.estoque.cobertura', { dias })
}

const colunasLotes = computed<ColunaTabela<LoteNoEstoque>[]>(() => [
  {
    id: 'lote',
    rotulo: t('clinico.vacinas.lote'),
    largura: 'minmax(6.5rem, 1fr)',
    ordenarPor: (linha) => linha.codigo,
  },
  {
    id: 'vacina',
    rotulo: t('clinico.vacinas.colunaVacina'),
    largura: 'minmax(8.5rem, 1.3fr)',
    ordenarPor: (linha) => linha.vacinaNome,
  },
  {
    id: 'saldo',
    rotulo: t('clinico.vacinas.estoque.saldo'),
    largura: 'minmax(7rem, 9.5rem)',
    numerico: true,
    ordenarPor: (linha) => linha.saldo,
  },
  {
    id: 'validade',
    rotulo: t('clinico.vacinas.validadeLote'),
    largura: '9rem',
    numerico: true,
    ordenarPor: (linha) => linha.diasParaVencer,
    ordemInicial: 'asc',
  },
  {
    id: 'valor',
    rotulo: t('clinico.vacinas.estoque.valorParado'),
    largura: 'minmax(7rem, 8.5rem)',
    numerico: true,
    ocultarEmTelaEstreita: true,
    ordenarPor: (linha) => linha.valorParado,
  },
])

/*
 * O lote vencido com saldo pede uma coisa só — sair da geladeira —, e por isso troca "Dar baixa"
 * por "Descartar", que abre o mesmo diálogo já no motivo e com o saldo inteiro. O esgotado não
 * tem ação: continua na lista para a farmacovigilância, não para trabalho.
 */
const acoesLotes = computed<AcaoDeLinha<LoteNoEstoque>[]>(() => [
  {
    id: 'descartar',
    rotulo: t('clinico.estoque.baixa.descartar'),
    perigo: true,
    visivel: (linha) => linha.situacao === 'vencido',
  },
  {
    id: 'baixa',
    rotulo: t('clinico.estoque.baixa.acao'),
    visivel: (linha) => linha.saldo > 0 && linha.situacao !== 'vencido',
  },
])

function acaoNoLote({ linha }: { acao: AcaoDeLinha<LoteNoEstoque>; linha: LoteNoEstoque }) {
  loteDaBaixa.value = linha
  baixaAberta.value = true
}

/** A validade em contagem regressiva: vermelho venceu, âmbar vence na janela, verde tem prazo. */
function tomDoLote(situacao: LoteNoEstoque['situacao']): Tom {
  const tons: Record<LoteNoEstoque['situacao'], Tom> = {
    vencido: 'risco',
    vencendo: 'atencao',
    ativo: 'ok',
    esgotado: 'neutro',
  }

  return tons[situacao]
}

const ICONE_DO_LOTE: Record<LoteNoEstoque['situacao'], string> = {
  vencido: 'ph ph-warning',
  vencendo: 'ph ph-hourglass-medium',
  ativo: 'ph ph-calendar-check',
  esgotado: 'ph ph-minus-circle',
}

function prazoDoLote(lote: LoteNoEstoque): string {
  if (lote.situacao === 'esgotado') {
    return t('clinico.vacinas.estoque.situacaoLote.esgotado')
  }

  if (lote.diasParaVencer < 0) {
    return t('clinico.estoque.lote.venceuHa', { dias: Math.abs(lote.diasParaVencer) })
  }

  return lote.diasParaVencer === 0
    ? t('clinico.estoque.lote.venceHoje')
    : t('clinico.estoque.lote.venceEm', { dias: lote.diasParaVencer })
}

/** A frase dos lotes: o que vence na janela e quanto dinheiro está nele. */
type IndicadorDoEstoque = {
  id: string
  valor: string
  rotulo: string
  nota: string
  icone: string
  tom: '' | 'atencao' | 'risco'
}

/**
 * Os números do alto, os mesmos em todas as vistas: o que há na geladeira, o que comprar, o que
 * vence logo e — havendo metas — como vai o mês. A frase de estado diz isso em prosa; os números
 * deixam a conta à vista e ficam no lugar quando se troca de vista.
 */
const indicadoresDoTopo = computed<IndicadorDoEstoque[]>(() => {
  const indicadores = estoque.value?.indicadores

  if (!indicadores) {
    return []
  }

  const aComprar = (estoque.value?.saldos ?? [])
    .filter((linha) => linha.situacao !== 'ok')
    .map((linha) => linha.nome)

  const lista: IndicadorDoEstoque[] = [
    {
      id: 'doses',
      valor: formato.numero(indicadores.dosesEmEstoque, 0),
      rotulo: t('clinico.vacinas.estoque.dosesEmEstoque'),
      nota: t('clinico.vacinas.estoque.valorParadoDetalhe', {
        valor: formato.moeda(indicadores.valorParado),
      }),
      icone: 'ph ph-snowflake',
      tom: '',
    },
    {
      id: 'comprar',
      valor: String(indicadores.vacinasAbaixoDoMinimo),
      rotulo: t('clinico.vacinas.estoque.abaixoDoMinimo'),
      nota: aComprar.length > 0 ? aComprar.join(', ') : t('clinico.estoque.saudacao.nadaAComprar'),
      icone: 'ph ph-shopping-cart',
      tom: indicadores.vacinasAbaixoDoMinimo > 0 ? 'atencao' : '',
    },
    {
      id: 'vencendo',
      valor: String(indicadores.dosesVencendo),
      rotulo: t('clinico.vacinas.estoque.vencendo', { dias: JANELA_DE_VALIDADE_EM_DIAS }),
      nota: t('clinico.vacinas.estoque.emRisco', {
        valor: formato.moeda(indicadores.valorEmRisco),
      }),
      icone: 'ph ph-hourglass-medium',
      tom: indicadores.dosesVencendo > 0 ? 'atencao' : '',
    },
  ]

  if (placarDoMes.value.total > 0) {
    lista.push({
      id: 'metas',
      valor: String(placarDoMes.value.bem),
      rotulo: t('clinico.estoque.metas.doMes', { mes: formato.mesPorExtenso(mesAtual.value) }),
      nota: t('clinico.estoque.metas.placar', {
        bem: placarDoMes.value.bem,
        total: placarDoMes.value.total,
      }),
      icone: 'ph ph-target',
      tom: '',
    })
  }

  return lista
})

const fraseDosLotes = computed(() => {
  const indicadores = estoque.value?.indicadores

  if (!indicadores || indicadores.dosesVencendo === 0) {
    return t('clinico.estoque.geladeira.nadaVencendo', { dias: JANELA_DE_VALIDADE_EM_DIAS })
  }

  return t(
    'clinico.estoque.geladeira.vencendo',
    {
      doses: rotulos.doses(indicadores.dosesVencendo),
      dias: JANELA_DE_VALIDADE_EM_DIAS,
      valor: formato.moeda(indicadores.valorEmRisco),
    },
    indicadores.dosesVencendo,
  )
})

// ------------------------------------------------------------------ metas

const historicoAberto = ref<string | null>(null)

/** O pedido mostra o que comprar; o que fecha o mês acima do mínimo sem compra vira uma frase. */
const pedidoAComprar = computed(() =>
  (painel.value?.pedido ?? []).filter((linha) => linha.comprar > 0),
)
const custoDoProximoPedido = computed(() => custoDoPedido(pedidoAComprar.value))

const colunasPedido = computed<ColunaTabela<LinhaDoPedido>[]>(() => [
  {
    id: 'vacina',
    rotulo: t('clinico.vacinas.colunaVacina'),
    largura: 'minmax(10rem, 1.4fr)',
    ordenarPor: (linha) => linha.nome,
  },
  {
    id: 'conta',
    rotulo: t('clinico.estoque.pedido.conta'),
    largura: 'minmax(0, 1.5fr)',
    ocultarEmTelaEstreita: true,
  },
  {
    id: 'comprar',
    rotulo: t('clinico.estoque.pedido.comprar'),
    largura: '7.5rem',
    numerico: true,
    ordenarPor: (linha) => linha.comprar,
  },
  {
    id: 'custo',
    rotulo: t('clinico.estoque.pedido.custo'),
    largura: '8.5rem',
    numerico: true,
    ordenarPor: (linha) => linha.custoEstimado,
  },
])

const acoesPedido = computed<AcaoDeLinha<LinhaDoPedido>[]>(() => [
  { id: 'receber', rotulo: t('clinico.estoque.receber.acao') },
])

function acaoNoPedido({ linha }: { acao: AcaoDeLinha<LinhaDoPedido>; linha: LinhaDoPedido }) {
  abrirReceber(linha.vacinaId, linha.comprar)
}

/**
 * O pedido em texto, para colar na mensagem ao fornecedor.
 *
 * Texto e não planilha: o pedido de vacina sai por mensagem para o representante, e é isso que ele
 * lê no celular. Agrupado por fornecedor porque cada um recebe só a parte dele.
 */
const copiado = ref(false)

async function copiarPedido() {
  const porFornecedor = new Map<string, LinhaDoPedido[]>()

  for (const linha of pedidoAComprar.value) {
    const chave = linha.fornecedor || t('clinico.estoque.pedido.semFornecedor')

    porFornecedor.set(chave, [...(porFornecedor.get(chave) ?? []), linha])
  }

  const texto = [
    t('clinico.estoque.pedido.cabecalhoTexto', {
      mes: formato.mesPorExtenso(proximoMes.value, true),
    }),
    ...[...porFornecedor].flatMap(([fornecedor, linhas]) => [
      '',
      fornecedor,
      ...linhas.map((linha) =>
        t('clinico.estoque.pedido.linhaTexto', {
          vacina: linha.nome,
          doses: rotulos.doses(linha.comprar),
        }),
      ),
    ]),
    '',
    t('clinico.estoque.pedido.totalTexto', { valor: formato.moeda(custoDoProximoPedido.value) }),
  ].join('\n')

  try {
    await navigator.clipboard.writeText(texto)
    copiado.value = true
    window.setTimeout(() => {
      copiado.value = false
    }, 2000)
  } catch {
    copiado.value = false
  }
}

// ------------------------------------------------------------------ movimentos

const filtroDeMovimento = ref<FiltroDeMovimento>('todos')

const movimentosVisiveis = computed(() =>
  filtroDeMovimento.value === 'todos'
    ? movimentos.value
    : movimentos.value.filter((item) => item.tipo === filtroDeMovimento.value),
)

const opcoesDeMovimento = computed(() => [
  {
    valor: 'todos' as FiltroDeMovimento,
    rotulo: t('clinico.comum.todos'),
    contagem: movimentos.value.length,
  },
  {
    valor: 'entrada' as FiltroDeMovimento,
    rotulo: t('clinico.estoque.movimentos.entradas'),
    contagem: movimentos.value.filter((item) => item.tipo === 'entrada').length,
  },
  {
    valor: 'baixa' as FiltroDeMovimento,
    rotulo: t('clinico.estoque.movimentos.baixas'),
    contagem: movimentos.value.filter((item) => item.tipo === 'baixa').length,
  },
])

const colunasMovimentos = computed<ColunaTabela<MovimentoDeEstoque>[]>(() => [
  {
    id: 'quando',
    rotulo: t('clinico.paciente.atos.colunaQuando'),
    largura: '7rem',
    ordenarPor: (linha) => linha.em,
    ordemInicial: 'desc',
  },
  {
    id: 'movimento',
    rotulo: t('clinico.estoque.movimentos.colunaMovimento'),
    largura: '10.5rem',
  },
  {
    id: 'lote',
    rotulo: t('clinico.vacinas.lote'),
    largura: 'minmax(10rem, 1.4fr)',
    ordenarPor: (linha) => linha.vacinaNome,
  },
  {
    id: 'doses',
    rotulo: t('clinico.estoque.movimentos.colunaDoses'),
    largura: '6rem',
    numerico: true,
    ordenarPor: (linha) => (linha.tipo === 'entrada' ? linha.quantidade : -linha.quantidade),
  },
  {
    id: 'valor',
    rotulo: t('clinico.estoque.movimentos.colunaValor'),
    largura: '8rem',
    numerico: true,
    ocultarEmTelaEstreita: true,
    ordenarPor: (linha) => linha.valor,
  },
  {
    id: 'quem',
    rotulo: t('clinico.paciente.atos.colunaQuem'),
    largura: 'minmax(0, 1fr)',
    ocultarEmTelaEstreita: true,
  },
])

// ------------------------------------------------------------------ análise

const rotulosDosMeses = computed(() =>
  (estoque.value?.consumo ?? []).map((ponto) => formato.mesCurto(`${ponto.mes}-01`)),
)

const fatiasDePerda = computed<Fatia[]>(() => {
  const perdas = estoque.value?.perdasPorMotivo ?? []
  const total = perdas.reduce((soma, item) => soma + item.doses, 0)

  return perdas.map((item) => ({
    id: item.motivo,
    rotulo: t(`clinico.vacinas.estoque.perda.${item.motivo}`),
    valor: item.doses,
    parte: total > 0 ? item.doses / total : 0,
  }))
})
</script>

<template>
  <UiPagina
    :resumo="fraseDoResumo"
    :carregando="carregando && !estoque"
    :erro="erro"
    bloquear-se-suspenso
    @tentar-de-novo="carregar"
  >
    <template #acoes>
      <!--
        O próximo mês sem plano é a ação do fim do mês, e sobe para cá até ser feita. Na aba Metas o
        mesmo botão já está na seção do mês, e dois iguais na mesma tela é ruído.
      -->
      <Button
        v-if="painel && !painel.proximo.plano && aba !== 'metas'"
        type="button"
        icon="ph ph-target"
        severity="secondary"
        outlined
        :label="t('clinico.estoque.metas.planejar', { mes: formato.mesPorExtenso(proximoMes) })"
        @click="abrirPlano(proximoMes)"
      />
      <Button
        type="button"
        icon="ph ph-package"
        :label="t('clinico.estoque.receber.acao')"
        @click="abrirReceber()"
      />
    </template>

    <div class="estoque clinic-scope">
      <ul
        v-if="indicadoresDoTopo.length"
        class="ui-indicadores indicadores"
        :aria-label="t('clinico.estoque.titulo')"
      >
        <li
          v-for="item in indicadoresDoTopo"
          :key="item.id"
          class="ui-indicador"
          :class="item.tom ? `ui-indicador--${item.tom}` : ''"
        >
          <span
            class="ui-ladrilho"
            :class="item.tom ? `ui-ladrilho--${item.tom}` : ''"
            aria-hidden="true"
          >
            <i :class="item.icone" />
          </span>
          <span class="ui-indicador__valor">{{ item.valor }}</span>
          <span class="ui-indicador__rotulo">{{ item.rotulo }}</span>
          <span class="ui-indicador__nota">{{ item.nota }}</span>
        </li>
      </ul>

      <div class="estoque__barra">
        <ClinicToggleGroup
          v-model="aba"
          :opcoes="opcoesAba"
          :rotulo="t('clinico.estoque.titulo')"
        />
      </div>

      <!-- ============================================================== geladeira -->
      <template v-if="aba === 'geladeira' && estoque">
        <section class="ui-folha ui-cartao geladeira" aria-labelledby="estoque-por-vacina-titulo">
          <header class="ui-cartao__cabeca">
            <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-snowflake" /></span>
            <span class="ui-cartao__titulos">
              <h2 id="estoque-por-vacina-titulo" class="ui-cartao__titulo">
                {{ t('clinico.estoque.porVacina') }}
              </h2>
              <p class="ui-cartao__descricao">
                {{
                  t('clinico.vacinas.estoque.valorParadoDetalhe', {
                    valor: formato.moeda(estoque.indicadores.valorParado),
                  })
                }}
              </p>
            </span>
            <span class="ui-cartao__total">{{ estoque.saldos.length }}</span>
          </header>

          <div>
            <div class="geladeira__cabeca" aria-hidden="true">
              <span>{{ t('clinico.vacinas.colunaVacina') }}</span>
              <span>{{ t('clinico.vacinas.estoque.saldo') }}</span>
              <span>{{ t('clinico.estoque.colunaCobertura') }}</span>
              <span>{{ t('clinico.estoque.colunaSituacao') }}</span>
              <span />
            </div>

            <ul class="ui-lista">
              <li
                v-for="linha in estoque.saldos"
                :key="linha.vacinaId"
                class="geladeira__linha"
                :class="
                  linha.situacao !== 'ok' ? `ui-marca ui-marca--${tomDoSaldo(linha.situacao)}` : ''
                "
              >
                <span class="geladeira__vacina">
                  <strong>{{ linha.nome }}</strong>
                  <span>
                    {{
                      t('clinico.estoque.giroMensal', { n: formato.numero(linha.consumoMensal, 1) })
                    }}
                  </span>
                </span>

                <!-- Saldo com o mínimo ao lado: um sem o outro não diz se é muito ou pouco. -->
                <span class="geladeira__saldo" :class="`geladeira__saldo--${linha.situacao}`">
                  <strong class="ui-num">{{ linha.saldo }}</strong>
                  <span class="ui-num">{{ t('clinico.estoque.minimoDe', { n: linha.minimo }) }}</span>
                </span>

                <span class="geladeira__cobertura">
                  <span
                    v-if="linha.coberturaEmDias !== null"
                    class="geladeira__trilho"
                    aria-hidden="true"
                  >
                    <span
                      class="geladeira__barra"
                      :class="`geladeira__barra--${tomDaCobertura(linha.coberturaEmDias)}`"
                      :style="{ inlineSize: `${coberturaPreenchida(linha.coberturaEmDias)}%` }"
                    />
                  </span>
                  <span class="geladeira__dias">
                    <template v-if="linha.coberturaEmDias !== null">
                      <span class="ui-num">
                        {{
                          t(
                            'clinico.estoque.geladeira.dias',
                            { n: linha.coberturaEmDias },
                            linha.coberturaEmDias,
                          )
                        }}
                      </span>
                    </template>
                    <template v-else>{{ t('clinico.vacinas.estoque.semCobertura') }}</template>
                    <span v-if="linha.vencendo > 0" class="geladeira__usar">
                      <i class="ph ph-hourglass-medium" aria-hidden="true" />
                      {{ t('clinico.estoque.vencendoNaVacina', { n: linha.vencendo }) }}
                    </span>
                  </span>
                </span>

                <span class="geladeira__situacao">
                  <span class="ui-selo" :class="`ui-selo--${tomDoSaldo(linha.situacao)}`">
                    <i :class="ICONE_DO_SALDO[linha.situacao]" aria-hidden="true" />
                    {{ t(`clinico.vacinas.estoque.situacaoSaldo.${linha.situacao}`) }}
                  </span>
                </span>

                <span class="geladeira__acoes">
                  <Button
                    type="button"
                    :label="t('clinico.estoque.receber.acao')"
                    severity="secondary"
                    outlined
                    size="small"
                    :aria-label="`${t('clinico.estoque.receber.acao')}: ${linha.nome}`"
                    @click="abrirReceber(linha.vacinaId)"
                  />
                  <Button
                    type="button"
                    icon="ph ph-sliders-horizontal"
                    severity="secondary"
                    text
                    size="small"
                    :aria-label="`${t('clinico.estoque.minimo.acao')}: ${linha.nome}`"
                    :title="t('clinico.estoque.minimo.acao')"
                    @click="ajustarMinimo(linha)"
                  />
                </span>
              </li>
            </ul>
          </div>
        </section>

        <section class="ui-folha ui-cartao lotes" aria-labelledby="estoque-lotes-titulo">
          <header class="ui-cartao__cabeca">
            <span
              class="ui-ladrilho"
              :class="{ 'ui-ladrilho--atencao': estoque.indicadores.dosesVencendo > 0 }"
              aria-hidden="true"
            >
              <i class="ph ph-package" />
            </span>
            <span class="ui-cartao__titulos">
              <h2 id="estoque-lotes-titulo" class="ui-cartao__titulo">
                {{ t('clinico.estoque.lotes') }}
              </h2>
              <p class="ui-cartao__descricao">{{ fraseDosLotes }}</p>
            </span>
            <span class="ui-cartao__total">{{ estoque.lotes.length }}</span>
          </header>

          <!--
            Todos os lotes, o esgotado inclusive: é o código antigo que a farmacovigilância procura
            quando liga, e um lote que some quando acaba deixa a pergunta sem resposta.
          -->
          <ClinicDataTable
            class="tabela-rola"
            :colunas="colunasLotes"
            :linhas="estoque.lotes"
            :chave="(linha) => linha.id"
            :acoes="acoesLotes"
            :carregando="carregando"
            :vazio-titulo="t('clinico.vacinas.estoque.semLotes')"
            :rotulo="t('clinico.estoque.lotes')"
            @acao="acaoNoLote"
          >
            <template #celula-lote="{ linha }">
              <span class="celula__forte ui-num">{{ linha.codigo }}</span>
              <span class="celula__meta">{{ linha.fornecedor }}</span>
            </template>

            <template #celula-vacina="{ linha }">
              <span class="celula__forte">{{ linha.vacinaNome }}</span>
              <span class="celula__meta">
                {{
                  t('clinico.vacinas.estoque.recebidoEm', {
                    data: dataDoLote(linha.recebidoEm),
                    total: linha.quantidadeRecebida,
                  })
                }}
              </span>
            </template>

            <template #celula-saldo="{ linha }">
              <span
                class="celula__numero ui-num"
                :class="{ 'celula__numero--apagado': linha.saldo === 0 }"
              >
                {{ linha.saldo }}
              </span>
              <span class="celula__meta celula__meta--quebra">
                {{
                  t('clinico.vacinas.estoque.saidas', {
                    aplicadas: linha.aplicadas,
                    perdidas: linha.perdidas,
                  })
                }}
              </span>
            </template>

            <template #celula-validade="{ linha }">
              <span class="ui-selo" :class="`ui-selo--${tomDoLote(linha.situacao)}`">
                <i :class="ICONE_DO_LOTE[linha.situacao]" aria-hidden="true" />
                {{ prazoDoLote(linha) }}
              </span>
              <span class="celula__meta ui-num">{{ dataDoLote(linha.validade) }}</span>
            </template>

            <template #celula-valor="{ linha }">
              <span class="celula__texto ui-num">{{ formato.moeda(linha.valorParado) }}</span>
              <span class="celula__meta celula__meta--quebra">
                {{
                  t('clinico.vacinas.estoque.custoUnitario', {
                    valor: formato.moeda(linha.custoUnitario),
                  })
                }}
              </span>
            </template>
          </ClinicDataTable>
        </section>
      </template>

      <!-- ============================================================== metas -->
      <template v-else-if="aba === 'metas' && painel">
        <!-- O mês em curso: o combinado contra o ritmo de hoje. -->
        <section class="ui-folha ui-cartao" aria-labelledby="metas-atual-titulo">
          <header class="ui-cartao__cabeca">
            <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-target" /></span>
            <span class="ui-cartao__titulos">
              <h2 id="metas-atual-titulo" class="ui-cartao__titulo">
                {{
                  t('clinico.estoque.metas.doMes', { mes: formato.mesPorExtenso(painel.atual.mes) })
                }}
              </h2>
              <p class="ui-cartao__descricao">
                {{
                  placarDoMes.total > 0
                    ? t('clinico.estoque.par', {
                        a: t(
                          'clinico.estoque.metas.emCurso',
                          { n: diasRestantes(painel.atual.mes, painel.hoje) },
                          diasRestantes(painel.atual.mes, painel.hoje),
                        ),
                        b: t('clinico.estoque.metas.placar', {
                          bem: placarDoMes.bem,
                          total: placarDoMes.total,
                        }),
                      })
                    : t(
                        'clinico.estoque.metas.emCurso',
                        { n: diasRestantes(painel.atual.mes, painel.hoje) },
                        diasRestantes(painel.atual.mes, painel.hoje),
                      )
                }}
              </p>
            </span>
            <span v-if="painel.atual.plano" class="ui-cartao__acoes">
              <Button
                type="button"
                :label="t('clinico.estoque.metas.editar')"
                icon="ph ph-pencil-simple"
                severity="secondary"
                outlined
                size="small"
                @click="abrirPlano(painel.atual.mes)"
              />
            </span>
          </header>

          <div v-if="painel.atual.plano" class="metas-folha">
            <MetasDoMes :progresso="painel.atual.progresso" :vacinas="catalogo" em-curso />
          </div>

          <div v-else class="estoque__convite">
            <p>{{ t('clinico.estoque.metas.semPlanoAtual') }}</p>
            <Button
              type="button"
              :label="
                t('clinico.estoque.metas.combinar', {
                  mes: formato.mesPorExtenso(painel.atual.mes),
                })
              "
              icon="ph ph-flag"
              severity="secondary"
              outlined
              @click="abrirPlano(painel.atual.mes)"
            />
          </div>
        </section>

        <!-- O próximo mês: o plano, ou o convite para fazê-lo com os números deste. -->
        <section class="ui-folha ui-cartao" aria-labelledby="metas-proximo-titulo">
          <header class="ui-cartao__cabeca">
            <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-flag" /></span>
            <span class="ui-cartao__titulos">
              <h2 id="metas-proximo-titulo" class="ui-cartao__titulo">
                {{
                  t('clinico.estoque.metas.doMes', {
                    mes: formato.mesPorExtenso(painel.proximo.mes),
                  })
                }}
              </h2>
              <p class="ui-cartao__descricao">
                {{
                  painel.proximo.plano
                    ? t('clinico.estoque.metas.planejadoEm', {
                        data: formato.dataCurta(painel.proximo.plano.atualizadoEm.slice(0, 10)),
                        quem: clinico.profissional(painel.proximo.plano.criadoPor)?.nome ?? '',
                      })
                    : t('clinico.estoque.metas.semPlanoProximo', {
                        base: formato.mesPorExtenso(painel.sugestao.mesBase),
                      })
                }}
              </p>
            </span>
            <span class="ui-cartao__acoes">
              <Button
                v-if="painel.proximo.plano"
                type="button"
                :label="t('clinico.estoque.metas.editar')"
                icon="ph ph-pencil-simple"
                severity="secondary"
                outlined
                size="small"
                @click="abrirPlano(painel.proximo.mes)"
              />
              <Button
                v-else
                type="button"
                :label="
                  t('clinico.estoque.metas.planejar', {
                    mes: formato.mesPorExtenso(painel.proximo.mes),
                  })
                "
                icon="ph ph-flag"
                severity="secondary"
                outlined
                size="small"
                @click="abrirPlano(painel.proximo.mes)"
              />
            </span>
          </header>

          <ul v-if="painel.proximo.plano" class="ui-lista alvos">
            <li v-for="meta in painel.proximo.plano.metas" :key="meta.id" class="alvos__linha">
              <span class="alvos__nome">
                <strong>{{ rotulos.nomeDaMeta(meta, catalogo) }}</strong>
                <span>{{ rotulos.oQueMede(meta.tipo) }}</span>
              </span>
              <strong class="alvos__valor ui-num">{{ rotulos.valor(meta.tipo, meta.alvo) }}</strong>
            </li>
          </ul>
        </section>

        <!--
          O pedido mora junto do mês que ele abastece. Sem plano, ele sai da sugestão — e o texto diz
          isso, para ninguém comprar por uma meta que ainda não foi combinada sem saber.
        -->
        <section class="ui-folha ui-cartao pedido" aria-labelledby="metas-pedido-titulo">
          <header class="ui-cartao__cabeca">
            <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-shopping-cart" /></span>
            <span class="ui-cartao__titulos">
              <h2 id="metas-pedido-titulo" class="ui-cartao__titulo">
                {{
                  t('clinico.estoque.pedido.titulo', {
                    mes: formato.mesPorExtenso(painel.proximo.mes),
                  })
                }}
                <span v-if="pedidoAComprar.length" class="ui-contagem">
                  {{ pedidoAComprar.length }}
                </span>
              </h2>
              <p class="ui-cartao__descricao">
                {{
                  painel.proximo.plano
                    ? t('clinico.estoque.pedido.peloPlano')
                    : t('clinico.estoque.pedido.pelaSugestao')
                }}
              </p>
            </span>
            <span v-if="pedidoAComprar.length > 0" class="ui-cartao__acoes">
              <Button
                v-if="pedidoAComprar.length > 0"
                type="button"
                :label="
                  copiado ? t('clinico.estoque.pedido.copiado') : t('clinico.estoque.pedido.copiar')
                "
                :icon="copiado ? 'ph ph-check' : 'ph ph-copy'"
                severity="secondary"
                outlined
                size="small"
                @click="copiarPedido"
              />
            </span>
          </header>

          <ClinicDataTable
            class="tabela-rola"
            :colunas="colunasPedido"
            :linhas="pedidoAComprar"
            :chave="(linha) => linha.vacinaId"
            :acoes="acoesPedido"
            :vazio-titulo="
              t('clinico.estoque.pedido.vazio', {
                mes: formato.mesPorExtenso(painel.proximo.mes),
              })
            "
            :rotulo="
              t('clinico.estoque.pedido.titulo', {
                mes: formato.mesPorExtenso(painel.proximo.mes),
              })
            "
            @acao="acaoNoPedido"
          >
            <template #celula-vacina="{ linha }">
              <span class="celula__forte">{{ linha.nome }}</span>
              <span class="celula__meta">{{ linha.fornecedor }}</span>
            </template>

            <!-- A conta escrita: é ela que se defende quando o pedido parece grande. -->
            <template #celula-conta="{ linha }">
              <span class="celula__meta celula__conta ui-num">
                {{
                  t('clinico.estoque.pedido.contaTexto', {
                    meta: linha.meta,
                    minimo: linha.minimo,
                    sobra: linha.sobra,
                  })
                }}
              </span>
            </template>

            <template #celula-comprar="{ linha }">
              <span class="celula__numero ui-num">{{ linha.comprar }}</span>
            </template>

            <template #celula-custo="{ linha }">
              <span class="celula__texto ui-num">{{ formato.moeda(linha.custoEstimado) }}</span>
              <span class="celula__meta">
                {{
                  t('clinico.vacinas.estoque.custoUnitario', {
                    valor: formato.moeda(linha.custoUnitario),
                  })
                }}
              </span>
            </template>
          </ClinicDataTable>

          <p v-if="pedidoAComprar.length > 0" class="ui-cartao__pe pedido__total">
            <i class="ph ph-shopping-cart" aria-hidden="true" />
            <span class="ui-num">
              {{
                t('clinico.estoque.pedido.total', {
                  doses: rotulos.doses(
                    pedidoAComprar.reduce((soma, linha) => soma + linha.comprar, 0),
                  ),
                  valor: formato.moeda(custoDoProximoPedido),
                })
              }}
            </span>
          </p>
        </section>

        <!-- Meses fechados: recolhidos, abertos um de cada vez. -->
        <section
          v-if="painel.historico.length > 0"
          class="ui-folha ui-cartao"
          aria-labelledby="metas-historico-titulo"
        >
          <header class="ui-cartao__cabeca">
            <span class="ui-ladrilho ui-ladrilho--neutro" aria-hidden="true">
              <i class="ph ph-clock-counter-clockwise" />
            </span>
            <span class="ui-cartao__titulos">
              <h2 id="metas-historico-titulo" class="ui-cartao__titulo">
                {{ t('clinico.estoque.metas.historico') }}
              </h2>
            </span>
            <span class="ui-cartao__total">{{ painel.historico.length }}</span>
          </header>

          <ul class="ui-lista historico">
            <li v-for="mes in painel.historico" :key="mes.mes">
              <button
                type="button"
                class="ui-linha historico__botao"
                :aria-expanded="historicoAberto === mes.mes"
                @click="historicoAberto = historicoAberto === mes.mes ? null : mes.mes"
              >
                <i
                  class="ph historico__caret"
                  :class="historicoAberto === mes.mes ? 'ph-caret-down' : 'ph-caret-right'"
                  aria-hidden="true"
                />
                <span class="ui-linha__texto">
                  <strong class="ui-linha__titulo historico__mes">
                    {{ formato.mesPorExtenso(mes.mes, true) }}
                  </strong>
                </span>
                <span
                  class="ui-selo"
                  :class="
                    placar(mes.progresso).bem === placar(mes.progresso).total
                      ? 'ui-selo--ok'
                      : 'ui-selo--contorno'
                  "
                >
                  {{
                    t('clinico.estoque.metas.placarFechado', {
                      bem: placar(mes.progresso).bem,
                      total: placar(mes.progresso).total,
                    })
                  }}
                </span>
              </button>

              <div v-if="historicoAberto === mes.mes" class="historico__corpo">
                <MetasDoMes :progresso="mes.progresso" :vacinas="catalogo" :em-curso="false" />
              </div>
            </li>
          </ul>
        </section>
      </template>

      <!-- ============================================================== movimentos -->
      <section
        v-else-if="aba === 'movimentos'"
        class="ui-folha ui-cartao movimentos"
        aria-labelledby="estoque-movimentos-titulo"
      >
        <header class="ui-cartao__cabeca">
          <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-arrows-down-up" /></span>
          <span class="ui-cartao__titulos">
            <h2 id="estoque-movimentos-titulo" class="ui-cartao__titulo">
              {{ t('clinico.estoque.aba.movimentos') }}
            </h2>
            <p class="ui-cartao__descricao">{{ t('clinico.estoque.movimentos.descricao') }}</p>
          </span>
        </header>

        <div class="ui-cartao__ferramentas">
          <ClinicToggleGroup
            v-model="filtroDeMovimento"
            :opcoes="opcoesDeMovimento"
            :rotulo="t('clinico.estoque.aba.movimentos')"
          />
        </div>

        <ClinicDataTable
          class="tabela-rola"
          :colunas="colunasMovimentos"
          :linhas="movimentosVisiveis"
          :chave="(linha) => linha.id"
          :carregando="carregando"
          :vazio-titulo="t('clinico.estoque.movimentos.vazio')"
          :rotulo="t('clinico.estoque.aba.movimentos')"
        >
          <template #celula-quando="{ linha }">
            <span class="celula__forte ui-num">{{ formato.dataCurta(linha.em) }}</span>
            <span class="celula__meta ui-num">{{ linha.em.slice(0, 4) }}</span>
          </template>

          <template #celula-movimento="{ linha }">
            <span v-if="linha.tipo === 'entrada'" class="ui-selo ui-selo--ok">
              <i class="ph ph-arrow-down" aria-hidden="true" />
              {{ t('clinico.estoque.movimentos.entrada') }}
            </span>
            <span
              v-else
              class="ui-selo"
              :class="linha.motivo === 'contagem' ? '' : 'ui-selo--atencao'"
            >
              <i class="ph ph-arrow-up" aria-hidden="true" />
              {{ t(`clinico.vacinas.estoque.perda.${linha.motivo}`) }}
            </span>
          </template>

          <template #celula-lote="{ linha }">
            <span class="celula__forte ui-num">{{ linha.codigo }}</span>
            <span class="celula__meta">{{ linha.vacinaNome }}</span>
          </template>

          <template #celula-doses="{ linha }">
            <span
              class="celula__numero ui-num"
              :class="linha.tipo === 'entrada' ? 'celula__numero--entra' : 'celula__numero--sai'"
            >
              {{ linha.tipo === 'entrada' ? `+${linha.quantidade}` : `−${linha.quantidade}` }}
            </span>
          </template>

          <template #celula-valor="{ linha }">
            <span class="celula__texto ui-num">{{ formato.moeda(linha.valor) }}</span>
          </template>

          <template #celula-quem="{ linha }">
            <span class="celula__texto">
              {{ linha.quem ? (clinico.profissional(linha.quem)?.nome ?? '') : linha.fornecedor }}
            </span>
            <span v-if="linha.detalhe" class="celula__meta">
              {{
                linha.tipo === 'entrada'
                  ? t('clinico.estoque.movimentos.nota', { nota: linha.detalhe })
                  : linha.detalhe
              }}
            </span>
          </template>
        </ClinicDataTable>
      </section>

      <!-- ============================================================== análise -->
      <template v-else-if="aba === 'analise' && estoque">
        <section class="ui-folha ui-cartao" aria-labelledby="analise-consumo-titulo">
          <header class="ui-cartao__cabeca">
            <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-chart-bar" /></span>
            <span class="ui-cartao__titulos">
              <h2 id="analise-consumo-titulo" class="ui-cartao__titulo">
                {{ t('clinico.vacinas.estoque.grafico.consumo') }}
              </h2>
              <p class="ui-cartao__descricao">
                {{ t('clinico.vacinas.estoque.grafico.consumoAjuda') }}
              </p>
            </span>
          </header>

          <div class="ui-cartao__corpo grafico">
            <EstoqueChartConsumo
              :meses="estoque.consumo"
              :vacinas="catalogo"
              :rotulos="rotulosDosMeses"
              :unidade="t('clinico.vacinas.estoque.doses')"
              :vazio="t('clinico.vacinas.estoque.semConsumo')"
            />
          </div>
        </section>

        <div class="estoque__par">
          <section class="ui-folha ui-cartao" aria-labelledby="analise-saldo-titulo">
            <header class="ui-cartao__cabeca">
              <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-shopping-cart" /></span>
              <span class="ui-cartao__titulos">
                <h2 id="analise-saldo-titulo" class="ui-cartao__titulo">
                  {{ t('clinico.vacinas.estoque.grafico.saldo') }}
                </h2>
                <p class="ui-cartao__descricao">
                  {{ t('clinico.vacinas.estoque.grafico.saldoAjuda') }}
                </p>
              </span>
            </header>

            <div class="ui-cartao__corpo grafico">
              <EstoqueChartSaldo
                :saldos="estoque.saldos"
                :legenda="{
                  minimo: t('clinico.vacinas.estoque.minimo'),
                  doses: t('clinico.vacinas.estoque.doses'),
                  zerado: t('clinico.vacinas.estoque.situacaoSaldo.zerado'),
                  abaixo: t('clinico.vacinas.estoque.situacaoSaldo.abaixo'),
                  ok: t('clinico.vacinas.estoque.situacaoSaldo.ok'),
                  cobertura: textoDeCobertura,
                }"
                :vazio="t('clinico.vacinas.estoque.semLotes')"
              />
            </div>
          </section>

          <section class="ui-folha ui-cartao" aria-labelledby="analise-perdas-titulo">
            <header class="ui-cartao__cabeca">
              <span class="ui-ladrilho ui-ladrilho--atencao" aria-hidden="true"
                ><i class="ph ph-warning"
              /></span>
              <span class="ui-cartao__titulos">
                <h2 id="analise-perdas-titulo" class="ui-cartao__titulo">
                  {{ t('clinico.vacinas.estoque.grafico.perdas') }}
                </h2>
                <p class="ui-cartao__descricao">
                  {{ t('clinico.vacinas.estoque.grafico.perdasAjuda') }}
                </p>
              </span>
            </header>

            <div class="ui-cartao__corpo grafico">
              <ClinicChartRanking
                tom="atencao"
                :fatias="fatiasDePerda"
                :unidade="t('clinico.vacinas.estoque.doses')"
                :vazio="t('clinico.vacinas.estoque.semPerdas')"
              />
            </div>
          </section>
        </div>

        <section class="ui-folha ui-cartao" aria-labelledby="analise-validade-titulo">
          <header class="ui-cartao__cabeca">
            <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-calendar-blank" /></span>
            <span class="ui-cartao__titulos">
              <h2 id="analise-validade-titulo" class="ui-cartao__titulo">
                {{ t('clinico.vacinas.estoque.grafico.validade') }}
              </h2>
              <p class="ui-cartao__descricao">
                {{ t('clinico.vacinas.estoque.grafico.validadeAjuda') }}
              </p>
            </span>
          </header>

          <div class="ui-cartao__corpo grafico">
            <EstoqueChartValidade
              :lotes="estoque.lotes"
              :hoje="clinicClock.today()"
              :legenda="{
                hoje: t('clinico.resumo.periodo.hoje'),
                doses: t('clinico.vacinas.estoque.doses'),
                situacao: {
                  vencido: t('clinico.vacinas.estoque.situacaoLote.vencido'),
                  vencendo: t('clinico.vacinas.estoque.situacaoLote.vencendo'),
                  ativo: t('clinico.vacinas.estoque.situacaoLote.ativo'),
                  esgotado: t('clinico.vacinas.estoque.situacaoLote.esgotado'),
                },
              }"
              :vazio="t('clinico.vacinas.estoque.semLotes')"
            />
          </div>
        </section>
      </template>
    </div>

    <template #sempre>
      <ReceberLoteDialog
        v-model:visivel="receberAberto"
        :vacinas="catalogo"
        :lotes="estoque?.lotes ?? []"
        :vacina-inicial="vacinaParaReceber"
        :quantidade-inicial="quantidadeParaReceber"
        @recebido="depoisDeGravar"
      />

      <BaixaDeLoteDialog
        v-model:visivel="baixaAberta"
        :lote="loteDaBaixa"
        @registrada="depoisDeGravar"
      />

      <MinimoDialog
        v-model:visivel="minimoAberto"
        :saldo="saldoDoMinimo"
        @ajustado="depoisDeGravar"
      />

      <PlanoDoMesDialog
        v-if="painel"
        v-model:visivel="planoAberto"
        :mes="mesDoPlano"
        :sugestao="sugestaoEmEdicao"
        :plano="planoEmEdicao"
        :vacinas="catalogo"
        @salvo="depoisDeGravar"
      />
    </template>
  </UiPagina>
</template>

<style scoped>
.estoque {
  display: grid;
  gap: 24px;
}

.estoque__barra {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

/* A nota do "a comprar" lista as vacinas: duas linhas no máximo, o resto na frase do alto. */
.indicadores .ui-indicador__nota {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

/* As tabelas da casa encostam nas bordas do cartão, com o mesmo recuo do cabeçalho. */
.lotes :deep(.tabela__cabecalho),
.lotes :deep(.tabela__linha),
.pedido :deep(.tabela__cabecalho),
.pedido :deep(.tabela__linha),
.movimentos :deep(.tabela__cabecalho),
.movimentos :deep(.tabela__linha) {
  padding-inline: 20px;
}

/* ------------------------------------------------------------------ geladeira
 * Uma linha por vacina, em colunas que se repetem: o saldo grande começa no mesmo lugar em todas,
 * e a barra de cobertura de uma se compara com a de baixo sem ler número.
 */
.geladeira {
  /* A última trilha tem largura própria: vazia no cabeçalho, ela não pode mudar a conta das outras. */
  --geladeira-colunas: minmax(0, 1.5fr) 8.5rem minmax(10rem, 1.3fr) 10.5rem minmax(10rem, max-content);
}

.geladeira__cabeca,
.geladeira__linha {
  display: grid;
  align-items: center;
  gap: 8px 20px;
  grid-template-columns: var(--geladeira-colunas);
  padding-inline: 20px 14px;
}

/* O cabeçalho das colunas num poço, como o das tabelas. */
.geladeira__cabeca {
  min-height: 42px;
  border-bottom: 1px solid var(--linha);
  background: var(--superficie-2);
  color: var(--tinta-3);
  font-size: 12.5px;
  font-weight: 600;
}

/* A última linha acompanha o canto do cartão, para o realce do hover não vazar. */
.geladeira__linha:last-child {
  border-bottom-left-radius: calc(var(--raio-cartao) - 1px);
  border-bottom-right-radius: calc(var(--raio-cartao) - 1px);
}

.geladeira__linha {
  position: relative;
  min-height: 76px;
  padding-block: 12px;
  transition: background-color var(--pj-tempo-curto) ease;
}

.geladeira__linha:hover {
  background: var(--superficie-2);
}

.geladeira__vacina {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.geladeira__vacina strong {
  overflow: hidden;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.geladeira__vacina span {
  color: var(--tinta-2);
  font-size: 13px;
}

/* O número que importa, grande; o mínimo ao lado, pequeno, na mesma linha de base. */
.geladeira__saldo {
  display: flex;
  align-items: baseline;
  gap: 8px;
  white-space: nowrap;
}

.geladeira__saldo strong {
  color: var(--tinta);
  font-family: var(--font-dados);
  font-size: 26px;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1;
}

.geladeira__saldo--zerado strong {
  color: var(--risco-tinta);
}

.geladeira__saldo--abaixo strong {
  color: var(--atencao-tinta);
}

.geladeira__saldo span {
  color: var(--tinta-3);
  font-size: 12.5px;
}

.geladeira__cobertura {
  display: grid;
  min-width: 0;
  gap: 6px;
}

.geladeira__trilho {
  display: block;
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--superficie-3);
}

.geladeira__barra {
  display: block;
  height: 100%;
  min-inline-size: 4px;
  border-radius: inherit;
  background: var(--ok);
  transition: inline-size var(--pj-tempo-medio) var(--pj-curva-chega);
}

.geladeira__barra--risco {
  background: var(--risco);
}

.geladeira__barra--atencao {
  background: var(--atencao);
}

.geladeira__dias {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 12px;
  color: var(--tinta-2);
  font-size: 13px;
}

.geladeira__usar {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--atencao-tinta);
  font-weight: 550;
}

.geladeira__situacao {
  display: flex;
}

.geladeira__acoes {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}

.geladeira__acoes .p-button {
  min-height: 36px;
  white-space: nowrap;
}

.geladeira__acoes .p-button-icon-only {
  width: 36px;
}

/* ------------------------------------------------------------------ células das tabelas */

/*
 * Tabela larga rola dentro de si no estreito. As colunas têm piso, e a grade cresce até ele em vez
 * de espremer o nome do paciente num fio de uma letra por linha.
 */
.tabela-rola :deep(.tabela__grade) {
  width: min-content;
  min-width: 100%;
}

.celula__forte {
  display: block;
  overflow: hidden;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.celula__texto {
  display: block;
  color: var(--tinta);
  font-size: 14px;
}

.celula__numero {
  display: block;
  color: var(--tinta);
  font-size: 18px;
  font-weight: 650;
  line-height: 1.2;
}

.celula__numero--apagado {
  color: var(--tinta-3);
}

.celula__numero--entra {
  color: var(--ok-tinta);
}

.celula__numero--sai {
  color: var(--risco-tinta);
}

.celula__meta {
  display: block;
  margin-top: 2px;
  color: var(--tinta-2);
  font-size: 13px;
}

/* Coluna numérica não quebra; a linha de apoio dela pode, para caber na largura da coluna. */
.celula__meta--quebra {
  white-space: normal;
}

.celula__conta {
  white-space: normal;
}

/* ------------------------------------------------------------------ metas */

.metas-folha {
  padding: 4px 20px 6px;
}

.estoque__convite {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 20px;
  padding: 18px 24px;
}

.estoque__convite p {
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
}

.alvos__linha {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 56px;
  padding: 10px 24px;
}

.alvos__nome {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.alvos__nome strong {
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
}

.alvos__nome span {
  color: var(--tinta-2);
  font-size: 13px;
}

.alvos__valor {
  flex: none;
  color: var(--tinta);
  font-family: var(--font-dados);
  font-size: 18px;
  font-weight: 650;
}

.pedido__total {
  justify-content: flex-end;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
}

.pedido__total i {
  color: var(--tinta-2);
  font-size: 17px;
}

.historico__botao {
  gap: 12px;
}

.historico__caret {
  color: var(--tinta-2);
  font-size: 16px;
}

/* "Setembro de 2026": só a primeira letra sobe — `capitalize` faria "Setembro De 2026". */
.historico__mes {
  display: inline-block;
}

.historico__mes::first-letter {
  text-transform: uppercase;
}

.historico__corpo {
  padding: 0 20px 8px 48px;
  border-top: 1px solid var(--linha-suave);
  background: color-mix(in oklab, var(--superficie-2) 45%, var(--superficie));
}

/* Embaixo do cabeçalho, a primeira linha do histórico não leva o raio de cima. */
.historico > li:first-child > .ui-linha {
  border-top-left-radius: 0;
  border-top-right-radius: 0;
}

/* ------------------------------------------------------------------ análise */

.estoque__par {
  display: grid;
  align-items: stretch;
  gap: 24px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
}

.grafico {
  padding: 18px 24px 16px;
}

/* ------------------------------------------------------------------ estreito */

@media (max-width: 1180px) {
  .geladeira {
    --geladeira-colunas: minmax(0, 1.4fr) 8rem minmax(8rem, 1fr) 10rem;
  }

  .geladeira__cabeca span:nth-child(4),
  .geladeira__cabeca span:nth-child(5) {
    display: none;
  }

  .geladeira__situacao {
    grid-column: 4;
    grid-row: 1;
    justify-content: flex-end;
  }

  .geladeira__acoes {
    grid-column: 1 / -1;
    grid-row: 2;
    justify-content: flex-start;
  }
}

@media (max-width: 760px) {
  .indicadores.ui-indicadores {
    gap: 10px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .indicadores .ui-indicador {
    padding: 14px 16px;
  }

  .indicadores .ui-indicador__valor {
    font-size: 24px;
  }

  .lotes :deep(.tabela__cabecalho),
  .lotes :deep(.tabela__linha),
  .pedido :deep(.tabela__cabecalho),
  .pedido :deep(.tabela__linha),
  .movimentos :deep(.tabela__cabecalho),
  .movimentos :deep(.tabela__linha) {
    padding-inline: 14px;
  }

  .geladeira__cabeca {
    display: none;
  }

  .geladeira__linha {
    grid-template-columns: minmax(0, 1fr) auto;
    padding-inline: 18px 14px;
  }

  .geladeira__vacina {
    grid-column: 1;
    grid-row: 1;
  }

  .geladeira__situacao {
    grid-column: 2;
    grid-row: 1;
  }

  .geladeira__saldo {
    grid-column: 1;
    grid-row: 2;
  }

  .geladeira__cobertura {
    grid-column: 1 / -1;
    grid-row: 3;
  }

  .geladeira__acoes {
    grid-column: 1 / -1;
    grid-row: 4;
  }

  .historico__corpo {
    padding-inline-start: 20px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .geladeira__barra {
    transition: none;
  }
}
</style>
