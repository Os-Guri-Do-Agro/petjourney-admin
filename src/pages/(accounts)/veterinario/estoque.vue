<script setup lang="ts">
/**
 * Estoque de vacinas — a geladeira, as metas do mês e o que entrou e saiu.
 *
 * Morava numa aba de Vacinas, e só lia: gráficos e uma tabela de lotes, sem um botão. A clínica
 * comprava e não tinha onde dar entrada; quebrava um frasco e não tinha onde dar baixa; o mínimo de
 * cada vacina vinha de fábrica. Virou tela própria porque passou a ter trabalho próprio — e um
 * segmento de abas dentro de uma aba de outra tela seria a hierarquia que ninguém acha.
 *
 * Quatro segmentos, na ordem do uso:
 *
 * - **Geladeira** — o trabalho de todo dia. Uma linha por vacina (quanto tem, quanto dura, o que
 *   comprar) e uma por lote (de onde, até quando, o que saiu). As ações moram na linha: receber
 *   lote da vacina, ajustar o mínimo, dar baixa no frasco, descartar o vencido.
 * - **Metas** — o trabalho do começo e do fim do mês. O mês em curso contra o combinado, o próximo
 *   mês planejado com os dados deste, e o pedido de compra que sai das metas.
 * - **Movimentos** — a conferência: toda entrada e toda baixa, com quem e quando.
 * - **Análise** — os gráficos que a aba antiga abria. Continuam valendo para a pergunta de forma (o
 *   giro ao longo do ano, a sobreposição das validades); saíram da frente porque não pedem ação.
 *
 * O segmento vive na URL, como em Vacinas: "olha as metas de outubro" vai por mensagem com o link.
 */
import { PhPackage, PhTarget } from '@phosphor-icons/vue'
import Button from 'primevue/button'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import ClinicAlertChip from '@/features/clinico/components/base/ClinicAlertChip.vue'
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
import type { AlertSeverity } from '@/features/clinico/data/types'
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

const ABAS: Aba[] = ['geladeira', 'metas', 'movimentos', 'analise']

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const clinico = useClinicoStore()
const formato = useClinicFormat()
const rotulos = useRotulosDoEstoque()

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

watch(aba, (valor) => {
  void router.replace({ query: valor === 'geladeira' ? {} : { aba: valor } })
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
 * A frase da saudação: o tamanho da geladeira, o que comprar e como vai o mês. São as três coisas
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

  return partes.join(' · ')
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

const colunasVacinas = computed<ColunaTabela<SaldoDaVacina>[]>(() => [
  {
    id: 'vacina',
    rotulo: t('clinico.vacinas.colunaVacina'),
    largura: 'minmax(0, 1.6fr)',
    ordenarPor: (linha) => linha.nome,
  },
  {
    id: 'saldo',
    rotulo: t('clinico.vacinas.estoque.saldo'),
    largura: '8.5rem',
    numerico: true,
    ordenarPor: (linha) => linha.saldo,
  },
  {
    id: 'cobertura',
    rotulo: t('clinico.estoque.colunaCobertura'),
    largura: '9.5rem',
    numerico: true,
    ocultarEmTelaEstreita: true,
    ordenarPor: (linha) => linha.coberturaEmDias,
    ordemInicial: 'asc',
  },
  {
    id: 'situacao',
    rotulo: t('clinico.estoque.colunaSituacao'),
    largura: '11rem',
  },
])

/*
 * Receber é a ação que se procura, e tem rótulo; o mínimo é ajuste raro, e fica no ícone. O
 * critério é o da casa: o que a pessoa precisa achar tem fundo ou borda visível.
 */
const acoesVacinas = computed<AcaoDeLinha<SaldoDaVacina>[]>(() => [
  { id: 'receber', rotulo: t('clinico.estoque.receber.acao') },
  { id: 'minimo', rotulo: t('clinico.estoque.minimo.acao'), icone: 'pi pi-sliders-h' },
])

function acaoNaVacina({ acao, linha }: { acao: AcaoDeLinha<SaldoDaVacina>; linha: SaldoDaVacina }) {
  if (acao.id === 'receber') {
    abrirReceber(linha.vacinaId)
    return
  }

  saldoDoMinimo.value = linha
  minimoAberto.value = true
}

function tomDoSaldo(situacao: SaldoDaVacina['situacao']): AlertSeverity {
  return situacao === 'zerado' ? 'risco' : 'atencao'
}

const colunasLotes = computed<ColunaTabela<LoteNoEstoque>[]>(() => [
  {
    id: 'lote',
    rotulo: t('clinico.vacinas.lote'),
    largura: 'minmax(0, 1fr)',
    ordenarPor: (linha) => linha.codigo,
  },
  {
    id: 'vacina',
    rotulo: t('clinico.vacinas.colunaVacina'),
    largura: 'minmax(0, 1.3fr)',
    ordenarPor: (linha) => linha.vacinaNome,
  },
  {
    id: 'saldo',
    rotulo: t('clinico.vacinas.estoque.saldo'),
    largura: '8.5rem',
    numerico: true,
    ordenarPor: (linha) => linha.saldo,
  },
  {
    id: 'validade',
    rotulo: t('clinico.vacinas.validadeLote'),
    largura: '8.5rem',
    numerico: true,
    ordenarPor: (linha) => linha.diasParaVencer,
    ordemInicial: 'asc',
  },
  {
    id: 'valor',
    rotulo: t('clinico.vacinas.estoque.valorParado'),
    largura: '8rem',
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

function tomDoLote(situacao: LoteNoEstoque['situacao']): AlertSeverity {
  if (situacao === 'vencido') {
    return 'risco'
  }

  return situacao === 'vencendo' ? 'atencao' : 'info'
}

function textoDeCobertura(dias: number | null): string {
  return dias === null
    ? t('clinico.vacinas.estoque.semCobertura')
    : t('clinico.vacinas.estoque.cobertura', { dias })
}

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
    largura: 'minmax(0, 1.4fr)',
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
    largura: '7.5rem',
    ordenarPor: (linha) => linha.em,
    ordemInicial: 'desc',
  },
  {
    id: 'movimento',
    rotulo: t('clinico.estoque.movimentos.colunaMovimento'),
    largura: '11rem',
  },
  {
    id: 'lote',
    rotulo: t('clinico.vacinas.lote'),
    largura: 'minmax(0, 1.4fr)',
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
  <PartnerPageFrame
    class="hc-tema"
    :subtitle="t('clinico.estoque.subtitulo')"
    :title="t('clinico.estoque.titulo')"
    :loading="carregando && !estoque"
    :error="erro"
    block-when-suspended
    @retry="carregar"
  >
    <template #cabecalho>
      <div class="hc-saudacao">
        <p class="hc-saudacao__data">{{ t('clinico.faltas.subtitulo') }}</p>
        <h1 class="hc-saudacao__titulo">{{ t('clinico.estoque.titulo') }}</h1>

        <div class="hc-saudacao__linha">
          <p v-if="fraseDoResumo" class="hc-saudacao__resumo" aria-live="polite">
            {{ fraseDoResumo }}
          </p>

          <nav class="hc-acoes" :aria-label="t('clinico.estoque.acoesRotulo')">
            <Button
              type="button"
              class="hc-pilula hc-pilula--cheia"
              :label="t('clinico.estoque.receber.acao')"
              @click="abrirReceber()"
            >
              <template #icon>
                <PhPackage class="hc-pilula__icone" weight="fill" aria-hidden="true" />
              </template>
            </Button>

            <!--
              O próximo mês sem plano é a ação do fim do mês, e sobe para cá até ser feita. Na aba
              Metas o mesmo botão já está no cartão do mês, e dois iguais na mesma tela é ruído.
            -->
            <Button
              v-if="painel && !painel.proximo.plano && aba !== 'metas'"
              type="button"
              class="hc-pilula"
              :label="
                t('clinico.estoque.metas.planejar', { mes: formato.mesPorExtenso(proximoMes) })
              "
              @click="abrirPlano(proximoMes)"
            >
              <template #icon>
                <PhTarget class="hc-pilula__icone" aria-hidden="true" />
              </template>
            </Button>
          </nav>
        </div>
      </div>
    </template>

    <div class="estoque clinic-scope">
      <div class="estoque__abas">
        <ClinicToggleGroup
          v-model="aba"
          :opcoes="opcoesAba"
          :rotulo="t('clinico.estoque.titulo')"
        />
      </div>

      <!-- ============================================================== geladeira -->
      <template v-if="aba === 'geladeira' && estoque">
        <section class="hc estoque-fatos" :aria-label="t('clinico.estoque.aba.geladeira')">
          <ul class="estoque-fatos__lista">
            <li>
              <strong>{{ estoque.indicadores.dosesEmEstoque }}</strong>
              {{ t('clinico.vacinas.estoque.dosesEmEstoque') }}
              <span class="estoque-fatos__nota">
                ({{
                  t('clinico.vacinas.estoque.valorParadoDetalhe', {
                    valor: formato.moeda(estoque.indicadores.valorParado),
                  })
                }})
              </span>
            </li>
            <li :class="{ 'estoque-fatos__item--atencao': estoque.indicadores.dosesVencendo > 0 }">
              <i
                v-if="estoque.indicadores.dosesVencendo > 0"
                class="pi pi-hourglass"
                aria-hidden="true"
              />
              <strong>{{ estoque.indicadores.dosesVencendo }}</strong>
              {{ t('clinico.vacinas.estoque.vencendo', { dias: JANELA_DE_VALIDADE_EM_DIAS }) }}
              <span class="estoque-fatos__nota">
                ({{
                  t('clinico.vacinas.estoque.emRisco', {
                    valor: formato.moeda(estoque.indicadores.valorEmRisco),
                  })
                }})
              </span>
            </li>
            <li :class="{ 'estoque-fatos__item--risco': faltando > 0 }">
              <i v-if="faltando > 0" class="pi pi-shopping-cart" aria-hidden="true" />
              <strong>{{ faltando }}</strong>
              {{ t('clinico.vacinas.estoque.abaixoDoMinimo') }}
            </li>
          </ul>
        </section>

        <section class="estoque__bloco">
          <h2 class="estoque__titulo">{{ t('clinico.estoque.porVacina') }}</h2>

          <ClinicDataTable
            :colunas="colunasVacinas"
            :linhas="estoque.saldos"
            :chave="(linha) => linha.vacinaId"
            :acoes="acoesVacinas"
            :carregando="carregando"
            :rotulo="t('clinico.estoque.porVacina')"
            @acao="acaoNaVacina"
          >
            <template #celula-vacina="{ linha }">
              <span class="estoque__nome">{{ linha.nome }}</span>
              <span class="estoque__meta">
                {{ t('clinico.estoque.giroMensal', { n: formato.numero(linha.consumoMensal, 1) }) }}
              </span>
            </template>

            <!-- Saldo com o mínimo embaixo: um sem o outro não diz se é muito ou pouco. -->
            <template #celula-saldo="{ linha }">
              <strong class="estoque__numero clinic-value">{{ linha.saldo }}</strong>
              <span class="estoque__meta">
                {{ t('clinico.estoque.minimoDe', { n: linha.minimo }) }}
              </span>
            </template>

            <template #celula-cobertura="{ linha }">
              <span class="estoque__cobertura">{{ textoDeCobertura(linha.coberturaEmDias) }}</span>
              <span v-if="linha.vencendo > 0" class="estoque__meta estoque__meta--atencao">
                {{ t('clinico.estoque.vencendoNaVacina', { n: linha.vencendo }) }}
              </span>
            </template>

            <template #celula-situacao="{ linha }">
              <ClinicAlertChip
                v-if="linha.situacao !== 'ok'"
                :severidade="tomDoSaldo(linha.situacao)"
                :rotulo="t(`clinico.vacinas.estoque.situacaoSaldo.${linha.situacao}`)"
              />
              <span v-else class="estoque__meta">
                {{ t('clinico.vacinas.estoque.situacaoSaldo.ok') }}
              </span>
            </template>
          </ClinicDataTable>
        </section>

        <section class="estoque__bloco">
          <h2 class="estoque__titulo">{{ t('clinico.estoque.lotes') }}</h2>

          <!--
            Todos os lotes, o esgotado inclusive: é o código antigo que a farmacovigilância procura
            quando liga, e um lote que some quando acaba deixa a pergunta sem resposta.
          -->
          <ClinicDataTable
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
              <span class="estoque__titulo-linha">
                <span class="estoque__nome clinic-value">{{ linha.codigo }}</span>
                <ClinicAlertChip
                  v-if="linha.situacao !== 'ativo'"
                  :severidade="tomDoLote(linha.situacao)"
                  :rotulo="t(`clinico.vacinas.estoque.situacaoLote.${linha.situacao}`)"
                />
              </span>
              <span class="estoque__meta">{{ linha.fornecedor }}</span>
            </template>

            <template #celula-vacina="{ linha }">
              <span class="estoque__nome">{{ linha.vacinaNome }}</span>
              <span class="estoque__meta">
                {{
                  t('clinico.vacinas.estoque.recebidoEm', {
                    data: formato.dataCurta(linha.recebidoEm),
                    total: linha.quantidadeRecebida,
                  })
                }}
              </span>
            </template>

            <template #celula-saldo="{ linha }">
              <strong class="estoque__numero clinic-value">{{ linha.saldo }}</strong>
              <span class="estoque__meta">
                {{
                  t('clinico.vacinas.estoque.saidas', {
                    aplicadas: linha.aplicadas,
                    perdidas: linha.perdidas,
                  })
                }}
              </span>
            </template>

            <template #celula-validade="{ linha }">
              <strong
                class="estoque__numero clinic-value"
                :class="`estoque__prazo--${tomDoLote(linha.situacao)}`"
              >
                {{
                  linha.diasParaVencer < 0
                    ? t('clinico.vacinas.atrasadoDias', { dias: Math.abs(linha.diasParaVencer) })
                    : t('clinico.vacinas.emDias', { dias: linha.diasParaVencer })
                }}
              </strong>
              <span class="estoque__meta">{{ formato.dataCurta(linha.validade) }}</span>
            </template>

            <template #celula-valor="{ linha }">
              <span class="estoque__nome clinic-value">{{ formato.moeda(linha.valorParado) }}</span>
              <span class="estoque__meta">
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
        <section class="hc">
          <header class="hc__cabeca">
            <div class="estoque__cabeca-texto">
              <h2 class="hc__titulo">
                {{
                  t('clinico.estoque.metas.doMes', { mes: formato.mesPorExtenso(painel.atual.mes) })
                }}
              </h2>
              <p class="estoque__lede">
                {{
                  t(
                    'clinico.estoque.metas.emCurso',
                    { n: diasRestantes(painel.atual.mes, painel.hoje) },
                    diasRestantes(painel.atual.mes, painel.hoje),
                  )
                }}
                <template v-if="placarDoMes.total > 0">
                  ·
                  {{
                    t('clinico.estoque.metas.placar', {
                      bem: placarDoMes.bem,
                      total: placarDoMes.total,
                    })
                  }}
                </template>
              </p>
            </div>

            <Button
              v-if="painel.atual.plano"
              :label="t('clinico.estoque.metas.editar')"
              icon="pi pi-pencil"
              severity="secondary"
              outlined
              size="small"
              @click="abrirPlano(painel.atual.mes)"
            />
          </header>

          <MetasDoMes
            v-if="painel.atual.plano"
            :progresso="painel.atual.progresso"
            :vacinas="catalogo"
            em-curso
          />

          <div v-else class="estoque__vazio">
            <p>{{ t('clinico.estoque.metas.semPlanoAtual') }}</p>
            <Button
              :label="
                t('clinico.estoque.metas.combinar', {
                  mes: formato.mesPorExtenso(painel.atual.mes),
                })
              "
              icon="pi pi-flag"
              class="clinic-acao-principal"
              @click="abrirPlano(painel.atual.mes)"
            />
          </div>
        </section>

        <!-- O próximo mês: o plano, ou o convite para fazê-lo com os números deste. -->
        <section class="hc">
          <header class="hc__cabeca">
            <div class="estoque__cabeca-texto">
              <h2 class="hc__titulo">
                {{
                  t('clinico.estoque.metas.doMes', {
                    mes: formato.mesPorExtenso(painel.proximo.mes),
                  })
                }}
              </h2>
              <p class="estoque__lede">
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
            </div>

            <Button
              v-if="painel.proximo.plano"
              :label="t('clinico.estoque.metas.editar')"
              icon="pi pi-pencil"
              severity="secondary"
              outlined
              size="small"
              @click="abrirPlano(painel.proximo.mes)"
            />
            <Button
              v-else
              :label="
                t('clinico.estoque.metas.planejar', {
                  mes: formato.mesPorExtenso(painel.proximo.mes),
                })
              "
              icon="pi pi-flag"
              class="clinic-acao-principal"
              @click="abrirPlano(painel.proximo.mes)"
            />
          </header>

          <ul v-if="painel.proximo.plano" class="estoque__alvos">
            <li v-for="meta in painel.proximo.plano.metas" :key="meta.id">
              <span>{{ rotulos.nomeDaMeta(meta, catalogo) }}</span>
              <span class="estoque__meta">{{ rotulos.oQueMede(meta.tipo) }}</span>
              <strong class="clinic-value">{{ rotulos.valor(meta.tipo, meta.alvo) }}</strong>
            </li>
          </ul>

          <!--
            O pedido mora junto do mês que ele abastece. Sem plano, ele sai da sugestão — e o texto
            diz isso, para ninguém comprar por uma meta que ainda não foi combinada sem saber.
          -->
          <div class="estoque__pedido">
            <div class="estoque__pedido-cabeca">
              <div>
                <h3 class="estoque__subtitulo">
                  {{
                    t('clinico.estoque.pedido.titulo', {
                      mes: formato.mesPorExtenso(painel.proximo.mes),
                    })
                  }}
                </h3>
                <p class="estoque__lede">
                  {{
                    painel.proximo.plano
                      ? t('clinico.estoque.pedido.peloPlano')
                      : t('clinico.estoque.pedido.pelaSugestao')
                  }}
                </p>
              </div>

              <Button
                v-if="pedidoAComprar.length > 0"
                :label="
                  copiado ? t('clinico.estoque.pedido.copiado') : t('clinico.estoque.pedido.copiar')
                "
                :icon="copiado ? 'pi pi-check' : 'pi pi-copy'"
                severity="secondary"
                outlined
                size="small"
                @click="copiarPedido"
              />
            </div>

            <ClinicDataTable
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
                <span class="estoque__nome">{{ linha.nome }}</span>
                <span class="estoque__meta">{{ linha.fornecedor }}</span>
              </template>

              <!-- A conta escrita: é ela que se defende quando o pedido parece grande. -->
              <template #celula-conta="{ linha }">
                <span class="estoque__meta estoque__conta">
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
                <strong class="estoque__numero clinic-value">{{ linha.comprar }}</strong>
              </template>

              <template #celula-custo="{ linha }">
                <span class="estoque__nome clinic-value">{{
                  formato.moeda(linha.custoEstimado)
                }}</span>
                <span class="estoque__meta">
                  {{
                    t('clinico.vacinas.estoque.custoUnitario', {
                      valor: formato.moeda(linha.custoUnitario),
                    })
                  }}
                </span>
              </template>
            </ClinicDataTable>

            <p v-if="pedidoAComprar.length > 0" class="estoque__total">
              {{
                t('clinico.estoque.pedido.total', {
                  doses: rotulos.doses(
                    pedidoAComprar.reduce((soma, linha) => soma + linha.comprar, 0),
                  ),
                  valor: formato.moeda(custoDoProximoPedido),
                })
              }}
            </p>
          </div>
        </section>

        <!-- Meses fechados: recolhidos, abertos um de cada vez. -->
        <section v-if="painel.historico.length > 0" class="hc">
          <header class="hc__cabeca">
            <h2 class="hc__titulo">{{ t('clinico.estoque.metas.historico') }}</h2>
          </header>

          <ul class="estoque__historico">
            <li v-for="mes in painel.historico" :key="mes.mes">
              <Button
                class="estoque__historico-botao"
                severity="secondary"
                text
                :aria-expanded="historicoAberto === mes.mes"
                @click="historicoAberto = historicoAberto === mes.mes ? null : mes.mes"
              >
                <i
                  :class="
                    historicoAberto === mes.mes ? 'pi pi-chevron-down' : 'pi pi-chevron-right'
                  "
                  aria-hidden="true"
                />
                <strong>{{ formato.mesPorExtenso(mes.mes, true) }}</strong>
                <span class="estoque__meta">
                  {{
                    t('clinico.estoque.metas.placarFechado', {
                      bem: placar(mes.progresso).bem,
                      total: placar(mes.progresso).total,
                    })
                  }}
                </span>
              </Button>

              <MetasDoMes
                v-if="historicoAberto === mes.mes"
                :progresso="mes.progresso"
                :vacinas="catalogo"
                :em-curso="false"
              />
            </li>
          </ul>
        </section>
      </template>

      <!-- ============================================================== movimentos -->
      <template v-else-if="aba === 'movimentos'">
        <div class="estoque__abas">
          <ClinicToggleGroup
            v-model="filtroDeMovimento"
            :opcoes="opcoesDeMovimento"
            :rotulo="t('clinico.estoque.aba.movimentos')"
          />
        </div>

        <ClinicDataTable
          :colunas="colunasMovimentos"
          :linhas="movimentosVisiveis"
          :chave="(linha) => linha.id"
          :carregando="carregando"
          :vazio-titulo="t('clinico.estoque.movimentos.vazio')"
          :rotulo="t('clinico.estoque.aba.movimentos')"
        >
          <template #celula-quando="{ linha }">
            <strong class="clinic-value">{{ formato.dataCurta(linha.em) }}</strong>
            <span class="estoque__meta">{{ linha.em.slice(0, 4) }}</span>
          </template>

          <template #celula-movimento="{ linha }">
            <span v-if="linha.tipo === 'entrada'" class="estoque__movimento">
              <i class="pi pi-arrow-down" aria-hidden="true" />
              {{ t('clinico.estoque.movimentos.entrada') }}
            </span>
            <ClinicAlertChip
              v-else
              :severidade="linha.motivo === 'contagem' ? 'info' : 'atencao'"
              :rotulo="t(`clinico.vacinas.estoque.perda.${linha.motivo}`)"
              icone="pi pi-arrow-up"
            />
          </template>

          <template #celula-lote="{ linha }">
            <span class="estoque__nome clinic-value">{{ linha.codigo }}</span>
            <span class="estoque__meta">{{ linha.vacinaNome }}</span>
          </template>

          <template #celula-doses="{ linha }">
            <strong class="estoque__numero clinic-value">
              {{ linha.tipo === 'entrada' ? `+${linha.quantidade}` : `−${linha.quantidade}` }}
            </strong>
          </template>

          <template #celula-valor="{ linha }">
            <span class="estoque__nome clinic-value">{{ formato.moeda(linha.valor) }}</span>
          </template>

          <template #celula-quem="{ linha }">
            <span class="estoque__nome">
              {{ linha.quem ? (clinico.profissional(linha.quem)?.nome ?? '') : linha.fornecedor }}
            </span>
            <span v-if="linha.detalhe" class="estoque__meta">
              {{
                linha.tipo === 'entrada'
                  ? t('clinico.estoque.movimentos.nota', { nota: linha.detalhe })
                  : linha.detalhe
              }}
            </span>
          </template>
        </ClinicDataTable>
      </template>

      <!-- ============================================================== análise -->
      <template v-else-if="aba === 'analise' && estoque">
        <section class="cartao">
          <header class="cartao__topo">
            <span class="cartao__marca" aria-hidden="true"><i class="pi pi-chart-bar" /></span>
            <h2>{{ t('clinico.vacinas.estoque.grafico.consumo') }}</h2>
            <p>{{ t('clinico.vacinas.estoque.grafico.consumoAjuda') }}</p>
          </header>

          <EstoqueChartConsumo
            :meses="estoque.consumo"
            :vacinas="catalogo"
            :rotulos="rotulosDosMeses"
            :unidade="t('clinico.vacinas.estoque.doses')"
            :vazio="t('clinico.vacinas.estoque.semConsumo')"
          />
        </section>

        <div class="estoque__par">
          <section class="cartao">
            <header class="cartao__topo">
              <span class="cartao__marca" aria-hidden="true"
                ><i class="pi pi-shopping-cart"
              /></span>
              <h2>{{ t('clinico.vacinas.estoque.grafico.saldo') }}</h2>
              <p>{{ t('clinico.vacinas.estoque.grafico.saldoAjuda') }}</p>
            </header>

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
          </section>

          <section class="cartao">
            <header class="cartao__topo">
              <span class="cartao__marca" aria-hidden="true">
                <i class="pi pi-exclamation-triangle" />
              </span>
              <h2>{{ t('clinico.vacinas.estoque.grafico.perdas') }}</h2>
              <p>{{ t('clinico.vacinas.estoque.grafico.perdasAjuda') }}</p>
            </header>

            <ClinicChartRanking
              tom="atencao"
              :fatias="fatiasDePerda"
              :unidade="t('clinico.vacinas.estoque.doses')"
              :vazio="t('clinico.vacinas.estoque.semPerdas')"
            />
          </section>
        </div>

        <section class="cartao">
          <header class="cartao__topo">
            <span class="cartao__marca" aria-hidden="true"><i class="pi pi-calendar" /></span>
            <h2>{{ t('clinico.vacinas.estoque.grafico.validade') }}</h2>
            <p>{{ t('clinico.vacinas.estoque.grafico.validadeAjuda') }}</p>
          </header>

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
        </section>
      </template>
    </div>

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
  </PartnerPageFrame>
</template>

<style scoped>
.estoque {
  display: grid;
  gap: var(--clinic-space-4);
}

.estoque__abas {
  display: flex;
  justify-content: flex-start;
}

.estoque__bloco {
  display: grid;
  gap: var(--clinic-space-2);
}

.estoque__titulo {
  margin: 0;
  color: var(--hc-tinta);
  font-size: 1rem;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.estoque__subtitulo {
  margin: 0;
  color: var(--hc-tinta);
  font-size: 0.9375rem;
  font-weight: 650;
}

.estoque__cabeca-texto {
  display: grid;
  gap: 0.15rem;
}

.estoque__lede {
  margin: 0;
  color: var(--hc-tinta-3);
  font-size: 0.8125rem;
}

.estoque__nome {
  display: block;
  overflow: hidden;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.estoque__cobertura {
  display: block;
  color: var(--clinic-text);
  font-variant-numeric: tabular-nums;
}

.estoque__titulo-linha {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--clinic-space-2);
}

.estoque__meta {
  display: block;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.estoque__meta--atencao {
  color: var(--clinic-attention-text);
}

.estoque__numero {
  display: block;
  font-size: 1rem;
  font-weight: 800;
}

.estoque__prazo--risco {
  color: var(--clinic-risk-text);
}

.estoque__prazo--atencao {
  color: var(--clinic-attention-text);
}

.estoque__conta {
  white-space: normal;
}

.estoque__movimento {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--clinic-text);
  font-size: var(--clinic-font-label);
  font-weight: 650;
}

.estoque__movimento i {
  color: var(--clinic-accent-strong);
  font-size: 0.75rem;
}

.estoque__vazio {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--clinic-space-3);
}

.estoque__vazio p {
  margin: 0;
  color: var(--hc-tinta-2);
  font-size: 0.875rem;
}

.estoque__alvos {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.estoque__alvos li {
  display: grid;
  align-items: baseline;
  gap: var(--clinic-space-3);
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1.4fr) auto;
  padding-block: 0.5rem;
  border-top: 1px solid var(--clinic-line-soft);
  font-size: 0.875rem;
}

.estoque__alvos li:first-child {
  border-top: none;
}

.estoque__pedido {
  display: grid;
  gap: var(--clinic-space-3);
  padding-top: var(--clinic-space-3);
  border-top: 1px solid var(--clinic-line-soft);
}

.estoque__pedido-cabeca {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--clinic-space-2);
}

.estoque__total {
  margin: 0;
  color: var(--hc-tinta);
  font-size: 0.875rem;
  font-weight: 650;
  text-align: end;
}

.estoque__historico {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.estoque__historico li {
  display: grid;
  gap: var(--clinic-space-2);
  padding-block: 0.25rem;
  border-top: 1px solid var(--clinic-line-soft);
}

.estoque__historico li:first-child {
  border-top: none;
}

.estoque__historico-botao.p-button {
  justify-content: flex-start;
  gap: 0.6rem;
  width: 100%;
  color: var(--hc-tinta);
}

/* "Setembro de 2026": só a primeira letra sobe — `capitalize` faria "Setembro De 2026". */
.estoque__historico-botao strong {
  display: inline-block;
}

.estoque__historico-botao strong::first-letter {
  text-transform: uppercase;
}

.estoque__historico-botao .estoque__meta {
  display: inline;
}

/* ------------------------------------------------------------------ fatos */

.estoque-fatos {
  padding-block: 0.85rem;
}

.estoque-fatos__lista {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1.75rem;
  margin: 0;
  padding: 0;
  color: var(--hc-tinta-2);
  font-size: 0.875rem;
  list-style: none;
}

.estoque-fatos__lista li {
  display: inline-flex;
  align-items: baseline;
  gap: 0.3rem;
}

.estoque-fatos__lista strong {
  color: var(--hc-tinta);
  font-size: 1rem;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.estoque-fatos__nota {
  color: var(--hc-tinta-3);
}

.estoque-fatos__lista i {
  align-self: center;
  font-size: 0.8rem;
}

.estoque-fatos__item--atencao i {
  color: var(--hc-pessego-tinta);
}

.estoque-fatos__item--risco i {
  color: var(--hc-coral-tinta);
}

/* ------------------------------------------------------------------ análise */

.estoque__par {
  display: grid;
  align-items: start;
  gap: var(--clinic-space-4);
  grid-template-columns: repeat(auto-fit, minmax(21rem, 1fr));
}

/* O cartão de gráfico, igual ao do resumo e ao da aba antiga: a mesma família, a mesma moldura. */
.cartao {
  display: grid;
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
  box-shadow: var(--clinic-shadow-card);
}

.cartao__topo {
  display: grid;
  align-items: center;
  gap: 0 var(--clinic-space-3);
  grid-template-areas:
    'marca titulo'
    'marca ajuda';
  grid-template-columns: auto minmax(0, 1fr);
}

.cartao__marca {
  display: grid;
  width: 2rem;
  height: 2rem;
  grid-area: marca;
  place-items: center;
  border-radius: 0.65rem;
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
  font-size: 0.8rem;
}

.cartao__topo h2 {
  margin: 0;
  grid-area: titulo;
  color: var(--clinic-text);
  font-size: var(--clinic-font-value);
  font-weight: 750;
  letter-spacing: -0.015em;
}

.cartao__topo p {
  margin: 0;
  grid-area: ajuda;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  line-height: 1.4;
}
</style>
