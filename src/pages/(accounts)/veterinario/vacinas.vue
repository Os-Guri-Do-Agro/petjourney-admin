<script setup lang="ts">
/**
 * Vacinas — o que foi aplicado, quem falta chamar, e o que tem na geladeira.
 *
 * São três perguntas, e elas não se respondem na mesma lista. **Aplicadas** é registro: o que
 * saiu da geladeira, em quem, por quem e de que lote — a pergunta que aparece quando alguém
 * emite comprovante ou a farmacovigilância pergunta por um lote. **Em atraso** é fila de
 * trabalho: quem chamar hoje. **Estoque** é a terceira, e é a única que a clínica costuma
 * descobrir tarde: vacina é o único insumo que **estraga sozinho na prateleira**, e frasco
 * parado além da validade é prejuízo já pago e nunca faturado.
 *
 * O estoque é a aba que fala por gráfico, e não por tabela, porque as três perguntas dele são
 * de forma e não de valor: o **giro** é uma onda ao longo do ano — campanha, ninhada, viagem —,
 * o **saldo contra o piso** é uma comparação item a item, e a **validade** é sobreposição no
 * tempo, que nenhuma ordenação por coluna mostra. A tabela de lotes continua embaixo, porque o
 * número exato ainda é o que se copia para o pedido de compra.
 *
 * A chamada continua sendo o que faz esta tela valer dinheiro. **É a única consulta que a
 * clínica pode provocar** — todo o resto do módulo reage a algo que já aconteceu, e uma clínica
 * que não chama perde a visita para o pet shop da esquina. Por isso a contagem de atrasados
 * viaja no rótulo da própria aba: ela precisa ser lida sem trocar de tela. Os três cartões do
 * topo seguem a mesma ideia e **trocam com a aba** — recall nas duas primeiras, geladeira na
 * terceira —, porque repetir a contagem de ligações em cima de um gráfico de validade seria
 * três números que ninguém veio buscar ali.
 *
 * Dentro de **Em atraso**, os três recortes são as três conversas diferentes que a clínica tem:
 * **vencido** liga hoje, **a vencer** entra na semana, **série aberta** é filhote que sumiu no
 * meio — e esse último some de qualquer relatório que só olhe data de vencimento.
 *
 * A aba vive na URL, como a da internação: é o que permite mandar "olha a lista de atrasados"
 * por mensagem sem mandar junto a instrução de qual aba abrir.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import ClinicAlertChip from '@/features/clinico/components/base/ClinicAlertChip.vue'
import ClinicDataTable from '@/features/clinico/components/base/ClinicDataTable.vue'
import ClinicFilterBar from '@/features/clinico/components/base/ClinicFilterBar.vue'
import ClinicStat from '@/features/clinico/components/base/ClinicStat.vue'
import ClinicToggleGroup from '@/features/clinico/components/base/ClinicToggleGroup.vue'
import type { GrupoDeFiltro } from '@/features/clinico/components/base/filter-types'
import type { AcaoDeLinha, ColunaTabela } from '@/features/clinico/components/base/table-types'
import EstoqueChartConsumo from '@/features/clinico/components/estoque/EstoqueChartConsumo.vue'
import EstoqueChartSaldo from '@/features/clinico/components/estoque/EstoqueChartSaldo.vue'
import EstoqueChartValidade from '@/features/clinico/components/estoque/EstoqueChartValidade.vue'
import ClinicChartRanking from '@/features/clinico/components/resumo/ClinicChartRanking.vue'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import {
  vacinaRepository,
  type AplicacaoNaLista,
  type ChamadaDeVacina,
} from '@/features/clinico/data/repositories'
import type { AlertSeverity } from '@/features/clinico/data/types'
import { diffDays } from '@/features/clinico/domain/clinic-time'
import {
  JANELA_DE_VALIDADE_EM_DIAS,
  type LoteNoEstoque,
  type ResumoDoEstoque,
} from '@/features/clinico/domain/estoque-vacinas'
import type { Fatia } from '@/features/clinico/domain/resumo'
import { clinicClock, useClinicoStore } from '@/features/clinico/stores/clinico'

type Recorte = 'todos' | 'vencido' | 'proximo' | 'serie-incompleta'
type Aba = 'aplicadas' | 'atraso' | 'estoque'

const ABAS: Aba[] = ['aplicadas', 'atraso', 'estoque']

/**
 * As janelas de tempo do filtro de aplicadas.
 *
 * Não é uma escolha de data livre de propósito: a pergunta real é sempre "o que saiu esta
 * semana / este mês / este ano", e um par de calendários custa quatro cliques para responder o
 * que três fichas respondem em um. Quem precisar de um intervalo exato tem a ordenação por data.
 */
const JANELAS = [30, 90, 365] as const

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const clinico = useClinicoStore()
const formato = useClinicFormat()

const aba = ref<Aba>('aplicadas')
const linhas = ref<ChamadaDeVacina[]>([])
const aplicacoes = ref<AplicacaoNaLista[]>([])
const estoque = ref<ResumoDoEstoque | null>(null)
const carregando = ref(false)
const erro = ref('')
const recorte = ref<Recorte>('vencido')
const busca = ref('')
const filtros = ref<Record<string, string[]>>({})

async function carregar() {
  carregando.value = true
  erro.value = ''

  try {
    await clinico.carregar()

    const [chamada, historico, geladeira] = await Promise.all([
      vacinaRepository.listaDeChamada(),
      vacinaRepository.aplicadas(),
      vacinaRepository.estoque(),
    ])

    linhas.value = chamada
    aplicacoes.value = historico
    estoque.value = geladeira

    /** Sem nenhum vencido, abrir no recorte vazio esconderia o que existe. */
    if (porSituacao.value.vencido.length === 0) {
      recorte.value = 'todos'
    }
  } catch {
    erro.value = t('clinico.erros.agenda')
  } finally {
    carregando.value = false
  }
}

onMounted(() => {
  const daUrl = String(route.query.aba ?? '')

  if ((ABAS as string[]).includes(daUrl)) {
    aba.value = daUrl as Aba
  }

  void carregar()
})

/* A aba escolhida vira endereço — `replace` para não encher o histórico de voltas. */
watch(aba, (valor) => {
  void router.replace({ query: valor === 'aplicadas' ? {} : { aba: valor } })
})

const porSituacao = computed(() => ({
  vencido: linhas.value.filter((linha) => linha.situacao === 'vencido'),
  proximo: linhas.value.filter((linha) => linha.situacao === 'proximo'),
  'serie-incompleta': linhas.value.filter((linha) => linha.situacao === 'serie-incompleta'),
}))

const visiveis = computed(() =>
  recorte.value === 'todos' ? linhas.value : porSituacao.value[recorte.value],
)

const opcoesRecorte = computed(() => [
  {
    valor: 'vencido' as Recorte,
    rotulo: `${t('clinico.vacinas.situacao.vencido')} · ${porSituacao.value.vencido.length}`,
    tom: 'risco' as const,
  },
  {
    valor: 'proximo' as Recorte,
    rotulo: `${t('clinico.vacinas.situacao.proximo')} · ${porSituacao.value.proximo.length}`,
    tom: 'atencao' as const,
  },
  {
    valor: 'serie-incompleta' as Recorte,
    rotulo: `${t('clinico.vacinas.situacao.serie-incompleta')} · ${porSituacao.value['serie-incompleta'].length}`,
    tom: 'neutro' as const,
  },
  {
    valor: 'todos' as Recorte,
    rotulo: `${t('clinico.faltas.filtro.todas')} · ${linhas.value.length}`,
    tom: 'neutro' as const,
  },
])

// --------------------------------------------------------------------- aplicadas

const opcoesAba = computed(() => [
  {
    valor: 'aplicadas' as Aba,
    rotulo: `${t('clinico.vacinas.aba.aplicadas')} · ${aplicacoes.value.length}`,
    tom: 'neutro' as const,
  },
  {
    /*
     * A contagem viaja no rótulo porque o número de atrasados é o que faz a clínica trocar de
     * aba — e um selo que só aparece depois do clique chega tarde demais para provocar o clique.
     */
    valor: 'atraso' as Aba,
    rotulo: `${t('clinico.vacinas.aba.atraso')} · ${porSituacao.value.vencido.length}`,
    tom: porSituacao.value.vencido.length > 0 ? ('risco' as const) : ('neutro' as const),
  },
  {
    /*
     * A contagem do estoque é o que **falta comprar**, e não o que tem na geladeira.
     *
     * "Estoque · 59" seria um número grande e tranquilizador ao lado de duas vacinas que
     * acabaram — e o rótulo da aba existe para provocar o clique de quem precisa comprar, não
     * para dar boas notícias a quem não ia clicar mesmo.
     */
    valor: 'estoque' as Aba,
    rotulo: `${t('clinico.vacinas.aba.estoque')} · ${faltando.value}`,
    tom: faltando.value > 0 ? ('atencao' as const) : ('neutro' as const),
  },
])

const faltando = computed(() => estoque.value?.indicadores.vacinasAbaixoDoMinimo ?? 0)

function semAcento(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

/** Dias inteiros desde a aplicação. É por este número que a janela do filtro corta. */
function diasDesde(aplicadaEm: string): number {
  return diffDays(clinicClock.dateOf(aplicadaEm), clinicClock.today())
}

function dentroDaJanela(aplicacao: AplicacaoNaLista, dias: number): boolean {
  return diasDesde(aplicacao.aplicadaEm) <= dias
}

/**
 * Os grupos do filtro: quando e qual.
 *
 * "Qual vacina" lista **só as que a clínica aplicou**, e não o catálogo inteiro: uma ficha com
 * contagem zero é uma ficha que só serve para esvaziar a lista, e o catálogo tem vacinas que
 * esta clínica talvez nunca tenha usado.
 */
const gruposDeFiltro = computed<GrupoDeFiltro[]>(() => {
  const vacinasUsadas = [...new Set(aplicacoes.value.map((item) => item.vacinaNome))].sort((a, b) =>
    a.localeCompare(b, INTL_LOCALE[locale.value as Locale]),
  )

  return [
    {
      id: 'janela',
      rotulo: t('clinico.vacinas.filtro.quando'),
      opcoes: JANELAS.map((dias) => ({
        valor: `janela:${dias}`,
        rotulo: t('clinico.vacinas.filtro.ultimosDias', { dias }, dias),
        contagem: aplicacoes.value.filter((item) => dentroDaJanela(item, dias)).length,
      })),
    },
    {
      id: 'vacina',
      rotulo: t('clinico.vacinas.colunaVacina'),
      opcoes: vacinasUsadas.map((nome) => ({
        valor: nome,
        rotulo: nome,
        contagem: aplicacoes.value.filter((item) => item.vacinaNome === nome).length,
      })),
    },
  ]
})

/**
 * A busca é a mesma que a recepção faz no balcão: paciente, responsável, vacina ou **lote**.
 *
 * O lote entra porque é a busca que ninguém faz até precisar — e quando precisa, é urgente:
 * chegou um alerta de lote e é preciso saber em quais animais ele entrou.
 */
const aplicadasVisiveis = computed(() => {
  const termo = semAcento(busca.value)
  const janelas = (filtros.value.janela ?? []).map((valor) => Number(valor.split(':')[1]))
  const vacinas = filtros.value.vacina ?? []

  return aplicacoes.value.filter((item) => {
    if (janelas.length > 0 && !janelas.some((dias) => dentroDaJanela(item, dias))) {
      return false
    }

    if (vacinas.length > 0 && !vacinas.includes(item.vacinaNome)) {
      return false
    }

    if (!termo) {
      return true
    }

    return [
      item.petNome,
      item.tutorNome,
      item.vacinaNome,
      item.lote ?? '',
      item.externa?.local ?? '',
    ].some((campo) => semAcento(campo).includes(termo))
  })
})

const colunasAplicadas = computed<ColunaTabela<AplicacaoNaLista>[]>(() => [
  {
    id: 'quando',
    rotulo: t('clinico.paciente.atos.colunaQuando'),
    largura: '9rem',
    ordenarPor: (linha) => linha.aplicadaEm,
    ordemInicial: 'desc',
  },
  {
    id: 'paciente',
    rotulo: t('clinico.pacientes.colunaPaciente'),
    largura: 'minmax(0, 1.3fr)',
    ordenarPor: (linha) => linha.petNome,
  },
  {
    id: 'vacina',
    rotulo: t('clinico.vacinas.colunaVacina'),
    largura: 'minmax(0, 1.3fr)',
    ordenarPor: (linha) => linha.vacinaNome,
  },
  {
    id: 'lote',
    rotulo: t('clinico.vacinas.lote'),
    largura: '9rem',
    ocultarEmTelaEstreita: true,
    ordenarPor: (linha) => linha.lote,
  },
  {
    id: 'quem',
    rotulo: t('clinico.paciente.atos.colunaQuem'),
    largura: 'minmax(0, 1fr)',
    ocultarEmTelaEstreita: true,
  },
])

/** A linha abre a carteira do paciente — é lá que está a sequência e a prévia do app. */
function abrirPaciente(linha: { petId: string }) {
  void router.push(`/veterinario/paciente/${linha.petId}/vacinas`)
}

// --------------------------------------------------------------------- em atraso

const colunas = computed<ColunaTabela<ChamadaDeVacina>[]>(() => [
  {
    id: 'paciente',
    rotulo: t('clinico.pacientes.colunaPaciente'),
    largura: 'minmax(0, 1.4fr)',
    ordenarPor: (linha) => linha.petNome,
  },
  {
    id: 'vacina',
    rotulo: t('clinico.vacinas.colunaVacina'),
    largura: 'minmax(0, 1.4fr)',
    ordenarPor: (linha) => linha.vacinaNome,
  },
  {
    id: 'responsavel',
    rotulo: t('clinico.faltas.colunaResponsavel'),
    largura: 'minmax(0, 1.2fr)',
    ocultarEmTelaEstreita: true,
    ordenarPor: (linha) => linha.tutorNome,
  },
  {
    id: 'quando',
    rotulo: t('clinico.vacinas.colunaQuando'),
    largura: '10rem',
    numerico: true,
    /** Ordena pelo atraso real, não pelo texto "há 40 dias" que a célula escreve. */
    ordenarPor: (linha) => linha.diasParaVencer,
    ordemInicial: 'asc',
  },
])

/**
 * As duas ações que a lista de chamada precisa ter, e nenhuma a mais.
 *
 * Ligar é o que a pessoa vai fazer em nove de dez linhas; agendar é o desfecho. Qualquer coisa
 * além disso transforma uma fila de trabalho num painel de administração.
 */
const acoes = computed<AcaoDeLinha<ChamadaDeVacina>[]>(() => [
  {
    id: 'ligar',
    rotulo: t('clinico.vacinas.ligar'),
    icone: 'pi pi-phone',
    visivel: (linha) => Boolean(linha.tutorTelefone),
  },
  {
    id: 'agendar',
    rotulo: t('clinico.vacinas.agendar'),
    icone: 'pi pi-calendar-plus',
  },
])

function executarAcao({
  acao,
  linha,
}: {
  acao: AcaoDeLinha<ChamadaDeVacina>
  linha: ChamadaDeVacina
}) {
  if (acao.id === 'ligar') {
    window.location.href = `tel:${linha.tutorTelefone}`

    return
  }

  /* Leva à agenda já no paciente: a recepção escolhe o horário olhando a grade. */
  void router.push({ path: '/veterinario/agenda' })
}

/*
 * Vazio é vazio nas **três** listas.
 *
 * Antes, sem ninguém para chamar, a tela inteira virava o estado vazio — e escondia junto o
 * registro do que a clínica aplicou, que continua existindo. Uma clínica em dia com os reforços
 * é a melhor notícia possível, e não pode apagar a própria carteira. O estoque entrou na mesma
 * conta pelo mesmo motivo: uma geladeira cheia não é razão para esconder a tela.
 */
const vazio = computed(
  () =>
    !carregando.value &&
    !erro.value &&
    linhas.value.length === 0 &&
    aplicacoes.value.length === 0 &&
    (estoque.value?.lotes.length ?? 0) === 0,
)

/** Minutos de agenda que a chamada pode recuperar, a 20 min por aplicação. */
const potencial = computed(() => linhas.value.length * 20)

// --------------------------------------------------------------------- estoque

/**
 * O catálogo na ordem do catálogo — é ela que fixa a cor de cada vacina no gráfico de consumo.
 *
 * Vem do repositório e não das vacinas que aparecem no período: uma vacina que não saiu em
 * março não pode empurrar a cor das outras para o slot ao lado em abril.
 */
const catalogo = computed(() => vacinaRepository.catalogo())

/** `2026-03` → `mar/26`. O eixo tem doze colunas; mês por extenso não cabe em nenhuma. */
function rotuloDoMes(mes: string): string {
  return formato.mesCurto(`${mes}-01`)
}

const rotulosDosMeses = computed(() =>
  (estoque.value?.consumo ?? []).map((ponto) => rotuloDoMes(ponto.mes)),
)

/**
 * As perdas viram fatias para o ranking que o resumo já desenha.
 *
 * Três motivos é pouco para um gráfico próprio, e é exatamente o formato que `ClinicChartRanking`
 * resolve — com a mesma barra, a mesma escala e o mesmo comportamento de dica do resto do
 * módulo. Um quarto componente aqui seria um jeito novo de desenhar a mesma coisa.
 */
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

/**
 * A tabela de lotes mostra **tudo**, inclusive o esgotado.
 *
 * O lote vazio não pede ação nenhuma, e é justamente ele que a farmacovigilância procura quando
 * liga: o código que gerou a reação costuma ser de um frasco que acabou meses atrás. Esconder o
 * esgotado deixaria a tela limpa e a pergunta sem resposta.
 */
const lotesVisiveis = computed(() => estoque.value?.lotes ?? [])

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
    largura: 'minmax(0, 1.4fr)',
    ordenarPor: (linha) => linha.vacinaNome,
  },
  {
    id: 'saldo',
    rotulo: t('clinico.vacinas.estoque.saldo'),
    largura: '9rem',
    numerico: true,
    ordenarPor: (linha) => linha.saldo,
  },
  {
    id: 'validade',
    rotulo: t('clinico.vacinas.validadeLote'),
    largura: '10rem',
    numerico: true,
    /** Ordena pelo prazo real, não pelo texto "vence em 45 d" que a célula escreve. */
    ordenarPor: (linha) => linha.diasParaVencer,
    ordemInicial: 'asc',
  },
  {
    id: 'valor',
    rotulo: t('clinico.vacinas.estoque.valorParado'),
    largura: '9rem',
    numerico: true,
    ocultarEmTelaEstreita: true,
    ordenarPor: (linha) => linha.valorParado,
  },
])

/**
 * Tom do selo de situação do lote — a mesma escala de severidade das outras listas do módulo.
 *
 * `esgotado` fica em `info` e não em `atencao`: o frasco vazio não pede nada de ninguém, e
 * pintá-lo de alerta faria a tabela abrir com metade das linhas gritando.
 */
function tomDoLote(situacao: LoteNoEstoque['situacao']): AlertSeverity {
  if (situacao === 'vencido') {
    return 'risco'
  }

  return situacao === 'vencendo' ? 'atencao' : 'info'
}

/** "cobertura de 84 d", ou o traço quando não houve consumo de onde tirar o ritmo. */
function textoDeCobertura(dias: number | null): string {
  return dias === null
    ? t('clinico.vacinas.estoque.semCobertura')
    : t('clinico.vacinas.estoque.cobertura', { dias })
}
</script>

<template>
  <PartnerPageFrame
    :subtitle="t('clinico.vacinas.subtitulo')"
    :title="t('clinico.vacinas.titulo')"
    :loading="carregando && linhas.length === 0"
    :error="erro"
    :empty="vazio"
    :empty-title="t('clinico.vacinas.vazioTitulo')"
    :empty-description="t('clinico.vacinas.vazioDescricao')"
    block-when-suspended
    @retry="carregar"
  >
    <div class="vacinas clinic-scope">
      <!--
        Os três números que dizem o tamanho da oportunidade antes de a tabela ser lida.

        Eles **trocam com a aba**, e essa é a mudança que o estoque trouxe. Atrasados e agenda a
        recuperar respondem a pergunta do recall; na geladeira a pergunta é outra — quanto tem,
        quanto vence e quanto já virou prejuízo — e repetir a contagem de ligações em cima de um
        gráfico de validade seria três números que ninguém veio buscar.
      -->
      <div v-if="aba !== 'estoque'" class="resumo">
        <ClinicStat
          icone="pi pi-exclamation-circle"
          tom="risco"
          :rotulo="t('clinico.vacinas.situacao.vencido')"
          :valor="String(porSituacao.vencido.length)"
          :detalhe="t('clinico.vacinas.ligarHoje')"
        />
        <ClinicStat
          icone="pi pi-clock"
          tom="atencao"
          :rotulo="t('clinico.vacinas.situacao.proximo')"
          :valor="String(porSituacao.proximo.length)"
          :detalhe="t('clinico.vacinas.proximosDias')"
        />
        <ClinicStat
          icone="pi pi-calendar-plus"
          :rotulo="t('clinico.vacinas.potencial')"
          :valor="formato.duracao(potencial)"
          :detalhe="t('clinico.vacinas.potencialDetalhe')"
        />
      </div>

      <div v-else-if="estoque" class="resumo">
        <ClinicStat
          icone="pi pi-box"
          :rotulo="t('clinico.vacinas.estoque.dosesEmEstoque')"
          :valor="String(estoque.indicadores.dosesEmEstoque)"
          :detalhe="
            t('clinico.vacinas.estoque.valorParadoDetalhe', {
              valor: formato.moeda(estoque.indicadores.valorParado),
            })
          "
        />
        <!--
          O valor em risco, e não só a contagem de doses.

          "11 doses a vencer" não move ninguém; o mesmo fato em dinheiro é o que faz a clínica
          abrir a geladeira hoje — e ainda dá para faturar, porque a dose ainda vale.
        -->
        <ClinicStat
          icone="pi pi-hourglass"
          :tom="estoque.indicadores.dosesVencendo > 0 ? 'atencao' : 'neutro'"
          :rotulo="t('clinico.vacinas.estoque.vencendo', { dias: JANELA_DE_VALIDADE_EM_DIAS })"
          :valor="String(estoque.indicadores.dosesVencendo)"
          :detalhe="
            t('clinico.vacinas.estoque.emRisco', {
              valor: formato.moeda(estoque.indicadores.valorEmRisco),
            })
          "
        />
        <ClinicStat
          icone="pi pi-shopping-cart"
          :tom="faltando > 0 ? 'risco' : 'neutro'"
          :rotulo="t('clinico.vacinas.estoque.abaixoDoMinimo')"
          :valor="String(faltando)"
          :detalhe="
            t('clinico.vacinas.estoque.perdaNoPeriodo', {
              valor: formato.percentual(estoque.indicadores.perdaPercentual),
              doses: estoque.indicadores.dosesPerdidas,
            })
          "
        />
      </div>

      <!--
        As duas perguntas da tela, lado a lado.

        "Aplicadas" abre primeiro porque é a que se faz o dia inteiro — conferir, comprovar,
        rastrear lote. "Em atraso" carrega a contagem no rótulo: é o número que faz alguém
        trocar de aba, e ele precisa ser lido antes do clique, não depois.
      -->
      <div class="vacinas__abas">
        <ClinicToggleGroup
          v-model="aba"
          :opcoes="opcoesAba"
          :rotulo="t('clinico.vacinas.titulo')"
        />
      </div>

      <template v-if="aba === 'aplicadas'">
        <ClinicFilterBar
          v-model:busca="busca"
          v-model:selecionados="filtros"
          :grupos="gruposDeFiltro"
          :placeholder-busca="t('clinico.vacinas.buscar')"
          :resultado="aplicadasVisiveis.length"
        />

        <ClinicDataTable
          :colunas="colunasAplicadas"
          :linhas="aplicadasVisiveis"
          :chave="(linha) => linha.id"
          :carregando="carregando"
          :vazio-titulo="t('clinico.vacinas.aplicadasVazioTitulo')"
          :vazio-descricao="t('clinico.vacinas.aplicadasVazioDescricao')"
          :rotulo="t('clinico.vacinas.aba.aplicadas')"
          @ativar="abrirPaciente"
        >
          <template #celula-quando="{ linha }">
            <strong class="clinic-value">
              {{ formato.dataCurta(clinicClock.dateOf(linha.aplicadaEm)) }}
            </strong>
            <span class="vacinas__meta">
              {{ clinicClock.dateOf(linha.aplicadaEm).slice(0, 4) }}
            </span>
          </template>

          <template #celula-paciente="{ linha }">
            <strong class="vacinas__nome">{{ linha.petNome }}</strong>
            <span class="vacinas__meta">
              {{ formato.especie(linha.especie) }} · {{ linha.tutorNome }}
            </span>
          </template>

          <template #celula-vacina="{ linha }">
            <span class="vacinas__titulo">
              <span class="vacinas__nome">{{ linha.vacinaNome }}</span>
              <ClinicAlertChip
                v-if="linha.obrigatoria"
                severidade="atencao"
                :rotulo="t('clinico.vacinas.obrigatoria')"
              />
            </span>
            <span class="vacinas__meta">
              {{
                t('clinico.vacinas.doseDeTotal', { dose: linha.dose, total: linha.dosesNaSerie })
              }}
            </span>
          </template>

          <!--
            Lote e validade juntos, e nunca só o lote.

            É o par que a farmacovigilância pede e o que a companhia aérea confere no balcão —
            um sem o outro não responde a pergunta de nenhum dos dois.
          -->
          <!--
            A dose de fora não tem lote, e a célula diz isso em vez de ficar vazia: vazia parece
            registro incompleto; "outro local" é o registro dizendo exatamente o que sabe.
          -->
          <template #celula-lote="{ linha }">
            <template v-if="linha.externa">
              <span class="vacinas__nome">{{ t('clinico.vacinas.externa.semLote') }}</span>
              <span class="vacinas__meta">{{ linha.externa.local }}</span>
            </template>
            <template v-else>
              <span class="vacinas__nome clinic-value">{{ linha.lote }}</span>
              <span v-if="linha.validadeLote" class="vacinas__meta">
                {{ t('clinico.vacinas.validade', { data: formato.dataCurta(linha.validadeLote) }) }}
              </span>
            </template>
          </template>

          <template #celula-quem="{ linha }">
            <template v-if="linha.externa">
              <span class="vacinas__nome">{{ t('clinico.vacinas.externa.outroLocal') }}</span>
              <span class="vacinas__meta">
                {{
                  t('clinico.vacinas.externa.registradaPor', {
                    nome: clinico.profissional(linha.externa.registradaPor)?.nome ?? '',
                  })
                }}
              </span>
            </template>
            <template v-else>
              <span class="vacinas__nome">
                {{ clinico.profissional(linha.professionalId)?.nome }}
              </span>
              <span v-if="linha.observacao" class="vacinas__meta">{{ linha.observacao }}</span>
            </template>
          </template>
        </ClinicDataTable>
      </template>

      <template v-else-if="aba === 'estoque'">
        <template v-if="estoque">
          <!--
            O giro primeiro. É ele que dá escala a tudo o que vem depois: sem saber que a
            clínica aplica sete doses por mês, "59 doses em estoque" não é nem muito nem pouco.
          -->
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

          <div class="vacinas__par">
            <section class="cartao">
              <header class="cartao__topo">
                <span class="cartao__marca" aria-hidden="true">
                  <i class="pi pi-shopping-cart" />
                </span>
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

          <!--
            A tabela fecha a aba, e não abre.

            Gráfico responde "tem problema?"; tabela responde "qual, quanto e de quem" — que é o
            que vai no pedido de compra e o que a farmacovigilância pede pelo telefone. Invertida
            a ordem, a tela voltaria a ser a parede de números que os gráficos vieram resolver.
          -->
          <ClinicDataTable
            :colunas="colunasLotes"
            :linhas="lotesVisiveis"
            :chave="(linha) => linha.id"
            :carregando="carregando"
            :vazio-titulo="t('clinico.vacinas.estoque.semLotes')"
            :rotulo="t('clinico.vacinas.aba.estoque')"
          >
            <template #celula-lote="{ linha }">
              <span class="vacinas__titulo">
                <span class="vacinas__nome clinic-value">{{ linha.codigo }}</span>
                <ClinicAlertChip
                  v-if="linha.situacao !== 'ativo'"
                  :severidade="tomDoLote(linha.situacao)"
                  :rotulo="t(`clinico.vacinas.estoque.situacaoLote.${linha.situacao}`)"
                />
              </span>
              <span class="vacinas__meta">{{ linha.fornecedor }}</span>
            </template>

            <template #celula-vacina="{ linha }">
              <span class="vacinas__nome">{{ linha.vacinaNome }}</span>
              <span class="vacinas__meta">
                {{
                  t('clinico.vacinas.estoque.recebidoEm', {
                    data: formato.dataCurta(linha.recebidoEm),
                    total: linha.quantidadeRecebida,
                  })
                }}
              </span>
            </template>

            <!--
              Saldo com o que saiu ao lado, e nunca só o saldo.

              "4 doses" não diz se o lote girou; "4 · 13 aplicadas, 3 perdidas" conta a história
              inteira do frasco numa linha — e é a perda que muda a próxima compra.
            -->
            <template #celula-saldo="{ linha }">
              <strong class="vacinas__prazo clinic-value">{{ linha.saldo }}</strong>
              <span class="vacinas__meta">
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
                class="vacinas__prazo clinic-value"
                :class="`vacinas__prazo--${tomDoLote(linha.situacao)}`"
              >
                {{
                  linha.diasParaVencer < 0
                    ? t('clinico.vacinas.atrasadoDias', { dias: Math.abs(linha.diasParaVencer) })
                    : t('clinico.vacinas.emDias', { dias: linha.diasParaVencer })
                }}
              </strong>
              <span class="vacinas__meta">{{ formato.dataCurta(linha.validade) }}</span>
            </template>

            <template #celula-valor="{ linha }">
              <span class="vacinas__nome clinic-value">{{ formato.moeda(linha.valorParado) }}</span>
              <span class="vacinas__meta">
                {{
                  t('clinico.vacinas.estoque.custoUnitario', {
                    valor: formato.moeda(linha.custoUnitario),
                  })
                }}
              </span>
            </template>
          </ClinicDataTable>
        </template>
      </template>

      <template v-else>
        <div class="vacinas__recorte">
          <ClinicToggleGroup
            v-model="recorte"
            :opcoes="opcoesRecorte"
            :rotulo="t('clinico.agenda.filtros')"
          />
        </div>

        <ClinicDataTable
          :colunas="colunas"
          :linhas="visiveis"
          :chave="(linha) => `${linha.petId}-${linha.vacinaId}`"
          :acoes="acoes"
          :vazio-titulo="t('clinico.vacinas.vazioTitulo')"
          :rotulo="t('clinico.vacinas.titulo')"
          @acao="executarAcao"
          @ativar="abrirPaciente"
        >
          <template #celula-paciente="{ linha }">
            <strong class="vacinas__nome">{{ linha.petNome }}</strong>
            <span class="vacinas__meta">
              {{
                clinico.pet(linha.petId) ? formato.especie(clinico.pet(linha.petId)!.especie) : ''
              }}
            </span>
          </template>

          <template #celula-vacina="{ linha }">
            <span class="vacinas__titulo">
              <span class="vacinas__nome">{{ linha.vacinaNome }}</span>
              <!-- Obrigatória muda o tom da conversa: é exigência legal, não sugestão. -->
              <ClinicAlertChip
                v-if="linha.obrigatoria"
                severidade="atencao"
                :rotulo="t('clinico.vacinas.obrigatoria')"
              />
            </span>
            <span v-if="linha.doseSeguinte" class="vacinas__meta">
              {{ t('clinico.vacinas.doseSeguinte', { dose: linha.doseSeguinte }) }}
            </span>
          </template>

          <template #celula-responsavel="{ linha }">
            <span class="vacinas__nome">{{ linha.tutorNome }}</span>
            <span class="vacinas__meta">{{ linha.tutorTelefone }}</span>
          </template>

          <template #celula-quando="{ linha }">
            <strong
              class="vacinas__prazo clinic-value"
              :class="`vacinas__prazo--${linha.situacao}`"
            >
              {{
                linha.diasParaVencer < 0
                  ? t('clinico.vacinas.atrasadoDias', { dias: Math.abs(linha.diasParaVencer) })
                  : t('clinico.vacinas.emDias', { dias: linha.diasParaVencer })
              }}
            </strong>
            <span class="vacinas__meta">{{ formato.dataCurta(linha.proximaDoseEm) }}</span>
          </template>
        </ClinicDataTable>
      </template>
    </div>
  </PartnerPageFrame>
</template>

<style scoped>
.vacinas {
  display: grid;
  gap: var(--clinic-space-3);
}

.resumo {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
  gap: var(--clinic-space-3);
}

.vacinas__abas,
.vacinas__recorte {
  display: flex;
  justify-content: flex-start;
}

.vacinas__nome {
  display: block;
  overflow: hidden;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vacinas__titulo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--clinic-space-2);
}

.vacinas__meta {
  display: block;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.vacinas__prazo {
  display: block;
  font-size: 1rem;
  font-weight: 800;
}

/* O prazo carrega a urgência: vencido em risco, a vencer em atenção. Cor com a palavra ao lado. */
.vacinas__prazo--vencido,
.vacinas__prazo--risco {
  color: var(--clinic-risk-text);
}

.vacinas__prazo--proximo,
.vacinas__prazo--atencao {
  color: var(--clinic-attention-text);
}

/* ------------------------------------------------------------------ estoque */

.vacinas__par {
  display: grid;
  align-items: start;
  gap: var(--clinic-space-4);
  grid-template-columns: repeat(auto-fit, minmax(21rem, 1fr));
}

/*
 * O cartão de gráfico, igual ao do resumo.
 *
 * É a mesma moldura de propósito: as duas telas mostram gráfico da mesma família, e um cartão
 * com outra borda ou outro respiro faria o estoque parecer um módulo comprado de fora.
 */
.cartao {
  display: grid;
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
  box-shadow: var(--clinic-shadow-card);
}

/*
 * Ladrilho à esquerda, título e ajuda empilhados à direita — em áreas nomeadas, porque com
 * `grid-row: 1 / -1` o ladrilho colapsa para uma linha só quando não há grade explícita.
 */
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
