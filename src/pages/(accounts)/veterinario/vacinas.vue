<script setup lang="ts">
/**
 * Vacinas — o que foi aplicado e quem falta chamar.
 *
 * O estoque morava aqui, como terceira aba, e saiu para a própria tela (`/veterinario/estoque`)
 * quando ganhou trabalho próprio — receber lote, dar baixa, metas do mês. O endereço antigo
 * (`?aba=estoque`) leva para lá, para o link guardado não cair numa aba que não existe mais.
 *
 * Eram três perguntas, e elas não se respondem na mesma lista. **Aplicadas** é registro: o que
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
 *
 * Sem aba na URL, a tela abre em **Em atraso** quando há vencidas — é a lista que vira consulta —
 * e em **Aplicadas** quando não há. Os cartões de número do topo saíram: o atraso está na frase da
 * saudação, a agenda a recuperar mora dentro de Em atraso, e o estoque tem a própria linha de fatos.
 * O histórico de aplicações mostra vinte por vez: abria com 98 linhas e 5,8 telas de rolagem.
 */
import { PhPackage } from '@phosphor-icons/vue'
import Button from 'primevue/button'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import ClinicAlertChip from '@/features/clinico/components/base/ClinicAlertChip.vue'
import ClinicPacienteCelula from '@/features/clinico/components/base/ClinicPacienteCelula.vue'
import ClinicDataTable from '@/features/clinico/components/base/ClinicDataTable.vue'
import ClinicFilterBar from '@/features/clinico/components/base/ClinicFilterBar.vue'
import ClinicToggleGroup from '@/features/clinico/components/base/ClinicToggleGroup.vue'
import type { GrupoDeFiltro } from '@/features/clinico/components/base/filter-types'
import type { AcaoDeLinha, ColunaTabela } from '@/features/clinico/components/base/table-types'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import {
  vacinaRepository,
  type AplicacaoNaLista,
  type ChamadaDeVacina,
} from '@/features/clinico/data/repositories'
import { diffDays } from '@/features/clinico/domain/clinic-time'
import { clinicClock, useClinicoStore } from '@/features/clinico/stores/clinico'

type Recorte = 'todos' | 'vencido' | 'proximo' | 'serie-incompleta'
type Aba = 'aplicadas' | 'atraso'

const ABAS: Aba[] = ['aplicadas', 'atraso']

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

    const [chamada, historico] = await Promise.all([
      vacinaRepository.listaDeChamada(),
      vacinaRepository.aplicadas(),
    ])

    linhas.value = chamada
    aplicacoes.value = historico

    /** Sem nenhum vencido, abrir no recorte vazio esconderia o que existe. */
    if (porSituacao.value.vencido.length === 0) {
      recorte.value = 'todos'
    }

    /* Sem aba pedida na URL, quem tem vencida para chamar abre na lista de chamada. */
    if (!abaPedida && porSituacao.value.vencido.length > 0) {
      aba.value = 'atraso'
    }
  } catch {
    erro.value = t('clinico.erros.agenda')
  } finally {
    carregando.value = false
  }
}

/** A URL pediu uma aba: aí ela manda, e o "abrir em Em atraso" não se aplica. */
let abaPedida = false

onMounted(() => {
  const daUrl = String(route.query.aba ?? '')

  if (daUrl === 'estoque') {
    void router.replace('/veterinario/estoque')
    return
  }

  if ((ABAS as string[]).includes(daUrl)) {
    aba.value = daUrl as Aba
    abaPedida = true
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
    rotulo: t('clinico.vacinas.situacao.vencido'),
    contagem: porSituacao.value.vencido.length,
    tom: 'risco' as const,
  },
  {
    valor: 'proximo' as Recorte,
    rotulo: t('clinico.vacinas.situacao.proximo'),
    contagem: porSituacao.value.proximo.length,
    tom: 'atencao' as const,
  },
  {
    valor: 'serie-incompleta' as Recorte,
    rotulo: t('clinico.vacinas.situacao.serie-incompleta'),
    contagem: porSituacao.value['serie-incompleta'].length,
    tom: 'neutro' as const,
  },
  {
    valor: 'todos' as Recorte,
    rotulo: t('clinico.faltas.filtro.todas'),
    contagem: linhas.value.length,
    tom: 'neutro' as const,
  },
])

// --------------------------------------------------------------------- aplicadas

const opcoesAba = computed(() => [
  {
    valor: 'aplicadas' as Aba,
    rotulo: t('clinico.vacinas.aba.aplicadas'),
    contagem: aplicacoes.value.length,
    tom: 'neutro' as const,
  },
  {
    /*
     * A contagem viaja no selo da aba porque o número de atrasados é o que faz a clínica trocar de
     * aba — e um selo que só aparece depois do clique chega tarde demais para provocar o clique.
     */
    valor: 'atraso' as Aba,
    rotulo: t('clinico.vacinas.aba.atraso'),
    contagem: porSituacao.value.vencido.length,
    tom: porSituacao.value.vencido.length > 0 ? ('risco' as const) : ('neutro' as const),
  },
])

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

const aplicadasDaPagina = computed(() => aplicadasVisiveis.value.slice(0, limiteDoHistorico.value))

const restamNoHistorico = computed(
  () => aplicadasVisiveis.value.length - aplicadasDaPagina.value.length,
)

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

/**
 * Um pet, uma linha: as vacinas atrasadas do mesmo animal viajam juntas.
 *
 * A Nina aparecia três vezes — traqueobronquite, V10 e antirrábica — e é uma ligação só para a
 * Camila. A linha leva todas as vacinas do pet no recorte, e o prazo dela é o da mais urgente.
 */
type ChamadaDoPet = {
  petId: string
  petNome: string
  tutorNome: string
  tutorTelefone: string
  vacinas: ChamadaDeVacina[]
  diasParaVencer: number
  proximaDoseEm: string
  situacao: ChamadaDeVacina['situacao']
}

const chamadasPorPet = computed<ChamadaDoPet[]>(() => {
  const mapa = new Map<string, ChamadaDoPet>()

  for (const linha of visiveis.value) {
    const grupo = mapa.get(linha.petId)

    if (!grupo) {
      mapa.set(linha.petId, {
        petId: linha.petId,
        petNome: linha.petNome,
        tutorNome: linha.tutorNome,
        tutorTelefone: linha.tutorTelefone,
        vacinas: [linha],
        diasParaVencer: linha.diasParaVencer,
        proximaDoseEm: linha.proximaDoseEm,
        situacao: linha.situacao,
      })
      continue
    }

    grupo.vacinas.push(linha)

    if (linha.diasParaVencer < grupo.diasParaVencer) {
      grupo.diasParaVencer = linha.diasParaVencer
      grupo.proximaDoseEm = linha.proximaDoseEm
      grupo.situacao = linha.situacao
    }
  }

  return [...mapa.values()]
})

const colunas = computed<ColunaTabela<ChamadaDoPet>[]>(() => [
  {
    id: 'paciente',
    rotulo: t('clinico.pacientes.colunaPaciente'),
    largura: 'minmax(0, 1fr)',
    ordenarPor: (linha) => linha.petNome,
  },
  {
    id: 'vacina',
    rotulo: t('clinico.vacinas.colunaVacina'),
    largura: 'minmax(0, 1.8fr)',
    ordenarPor: (linha) => linha.vacinas[0]?.vacinaNome ?? '',
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
/*
 * Sem "Ligar": a clínica liga pelo telefone do cadastro, que está escrito na linha. A tela não
 * disca — registra e agenda.
 */
const acoes = computed<AcaoDeLinha<ChamadaDoPet>[]>(() => [
  {
    id: 'agendar',
    rotulo: t('clinico.vacinas.agendar'),
    icone: 'ph ph-calendar-plus',
  },
])

function executarAcao({ acao }: { acao: AcaoDeLinha<ChamadaDoPet>; linha: ChamadaDoPet }) {
  if (acao.id !== 'agendar') {
    return
  }

  /* Leva à agenda: a recepção escolhe o horário olhando a grade. */
  void router.push({ path: '/veterinario/agenda' })
}

/*
 * Vazio é vazio nas **duas** listas.
 *
 * Antes, sem ninguém para chamar, a tela inteira virava o estado vazio — e escondia junto o
 * registro do que a clínica aplicou, que continua existindo. Uma clínica em dia com os reforços
 * é a melhor notícia possível, e não pode apagar a própria carteira.
 */
const vazio = computed(
  () =>
    !carregando.value && !erro.value && linhas.value.length === 0 && aplicacoes.value.length === 0,
)

/** Minutos de agenda que a chamada pode recuperar, a 20 min por aplicação. */
const potencial = computed(() => linhas.value.length * 20)

/**
 * A frase da saudação: quantas vencidas há para chamar hoje e quantas vencem no mês. É o número
 * que fazia a pessoa trocar de aba; agora é a primeira coisa lida na tela.
 */
const fraseDoResumo = computed(() => {
  if (carregando.value && linhas.value.length === 0) {
    return ''
  }

  const vencidas = porSituacao.value.vencido.length
  const aVencer = porSituacao.value.proximo.length
  const partes = [
    vencidas > 0
      ? t('clinico.vacinas.saudacao.vencidas', { n: vencidas }, vencidas)
      : t('clinico.vacinas.saudacao.nenhumaVencida'),
  ]

  if (aVencer > 0) {
    partes.push(t('clinico.vacinas.saudacao.aVencer', { n: aVencer }, aVencer))
  }

  return partes.join(' · ')
})

/** Quantas aplicações o histórico mostra por vez. */
const PASSO_DO_HISTORICO = 20
const limiteDoHistorico = ref(PASSO_DO_HISTORICO)

/* Trocar a busca ou o filtro recomeça do topo: o "mostrar mais" é da lista de agora. */
watch([busca, filtros], () => {
  limiteDoHistorico.value = PASSO_DO_HISTORICO
})
</script>

<template>
  <PartnerPageFrame
    class="hc-tema"
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
    <template #cabecalho>
      <div class="hc-saudacao">
        <p class="hc-saudacao__data">{{ t('clinico.faltas.subtitulo') }}</p>
        <h1 class="hc-saudacao__titulo">{{ t('clinico.vacinas.titulo') }}</h1>

        <div class="hc-saudacao__linha">
          <p v-if="fraseDoResumo" class="hc-saudacao__resumo" aria-live="polite">
            {{ fraseDoResumo }}
          </p>

          <!-- O estoque saiu daqui para a própria tela; o caminho para ele fica onde a aba estava. -->
          <nav class="hc-acoes" :aria-label="t('clinico.estoque.titulo')">
            <Button
              type="button"
              class="hc-pilula"
              :label="t('clinico.estoque.titulo')"
              @click="router.push('/veterinario/estoque')"
            >
              <template #icon>
                <PhPackage class="hc-pilula__icone" aria-hidden="true" />
              </template>
            </Button>
          </nav>
        </div>
      </div>
    </template>

    <div class="vacinas clinic-scope">
      <!--
        As duas perguntas da tela, lado a lado.

        Com vencidas para chamar, a tela abre em "Em atraso"; sem elas, em "Aplicadas". "Em
        atraso" carrega a contagem no rótulo: é o número que faz alguém trocar de aba, e ele
        precisa ser lido antes do clique, não depois.
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
          :linhas="aplicadasDaPagina"
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
            <ClinicPacienteCelula :pet="clinico.pet(linha.petId)" :nome="linha.petNome">
              {{ formato.especie(linha.especie) }} · {{ linha.tutorNome }}
            </ClinicPacienteCelula>
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

        <div v-if="restamNoHistorico > 0" class="vacinas__mais">
          <Button
            type="button"
            severity="secondary"
            outlined
            :label="
              t('clinico.vacinas.mostrarMais', {
                n: Math.min(PASSO_DO_HISTORICO, restamNoHistorico),
                total: restamNoHistorico,
              })
            "
            @click="limiteDoHistorico += PASSO_DO_HISTORICO"
          />
        </div>
      </template>

      <template v-else>
        <div class="vacinas__recorte">
          <ClinicToggleGroup
            v-model="recorte"
            :opcoes="opcoesRecorte"
            :rotulo="t('clinico.agenda.filtros')"
          />

          <!-- O tamanho da oportunidade, onde ela é trabalhada: era um cartão de número no topo. -->
          <p v-if="linhas.length > 0" class="vacinas__potencial">
            <i class="ph ph-calendar-plus" aria-hidden="true" />
            {{ t('clinico.vacinas.potencialFrase', { duracao: formato.duracao(potencial) }) }}
          </p>
        </div>

        <ClinicDataTable
          :colunas="colunas"
          :linhas="chamadasPorPet"
          :chave="(linha) => linha.petId"
          :acoes="acoes"
          :vazio-titulo="t('clinico.vacinas.vazioTitulo')"
          :rotulo="t('clinico.vacinas.titulo')"
          @acao="executarAcao"
          @ativar="abrirPaciente"
        >
          <template #celula-paciente="{ linha }">
            <ClinicPacienteCelula :pet="clinico.pet(linha.petId)" :nome="linha.petNome">
              {{
                clinico.pet(linha.petId) ? formato.especie(clinico.pet(linha.petId)!.especie) : ''
              }}
            </ClinicPacienteCelula>
          </template>

          <template #celula-vacina="{ linha }">
            <ul class="vacinas__do-pet">
              <li v-for="vacina in linha.vacinas" :key="vacina.vacinaId">
                <span class="vacinas__titulo">
                  <span class="vacinas__nome">{{ vacina.vacinaNome }}</span>
                  <!-- Obrigatória muda o tom da conversa: é exigência legal, não sugestão. -->
                  <ClinicAlertChip
                    v-if="vacina.obrigatoria"
                    severidade="atencao"
                    :rotulo="t('clinico.vacinas.obrigatoria')"
                  />
                </span>
                <span v-if="vacina.doseSeguinte" class="vacinas__meta">
                  {{ t('clinico.vacinas.doseSeguinte', { dose: vacina.doseSeguinte }) }}
                </span>
              </li>
            </ul>
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
.vacinas__do-pet {
  display: grid;
  gap: 0.35rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.vacinas__mais {
  display: flex;
  justify-content: center;
}

.vacinas__potencial {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
}

.vacinas__potencial i {
  color: var(--hc-marca);
  font-size: 0.8rem;
}

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
.vacinas__prazo--vencido {
  color: var(--clinic-risk-text);
}

.vacinas__prazo--proximo {
  color: var(--clinic-attention-text);
}
</style>
