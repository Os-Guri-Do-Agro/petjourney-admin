<script setup lang="ts">
/**
 * Relatórios do Hotel — a única tela do módulo que olha para trás.
 *
 * Olha-se depois que o mês acabou, não durante o dia, e a pergunta que ela responde é uma só:
 * **valeu a pena?** Por isso a receita vem acompanhada da diária média, e não sozinha: um mês com
 * mais receita e diária média menor é um mês em que a casa trabalhou mais para ganhar o mesmo.
 *
 * ## A forma (redesenho total, 19/10/2026)
 *
 * - **O período** no alto: três atalhos (7, 30 e 90 dias) e o calendário para qualquer outro.
 *   Todo número e todo gráfico da tela responde por ele, e por nenhum outro.
 * - **A régua** dos quatro números, como nos Relatórios da Clínica: ocupação média, receita,
 *   diária média e retorno. A frase do alto já diz o principal.
 * - **A ocupação dia a dia**, em colunas com a escala em percentual da casa. A média esconde
 *   exatamente o que se quer ver — que a casa lota no fim de semana e esvazia na terça —, então o
 *   fim de semana leva a cor cheia e o resto a clara, e a frase embaixo diz a noite mais cheia.
 * - **Os rankings**: receita por origem e por serviço, ocorrências do período, e as perdas.
 *
 * Sem movimento no período, a tela continua de pé — com o seletor de período à mão — e diz que
 * não houve estadia faturada, em vez de trocar a página inteira por um vazio sem saída.
 */
import DatePicker from 'primevue/datepicker'
import SelectButton from 'primevue/selectbutton'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import UiPagina from '@/components/ui/UiPagina.vue'
import UiSecao from '@/components/ui/UiSecao.vue'
import HotelDevPanel from '@/features/hotel/components/base/HotelDevPanel.vue'
import HotelTour from '@/features/hotel/components/base/HotelTour.vue'
import type { PassoDoTour } from '@/features/hotel/components/base/tour-types'
import { useHotelFormat } from '@/features/hotel/composables/useHotelFormat'
import { resumoRepository, type ResumoDoHotel } from '@/features/hotel/data/repositories'
import { addDays } from '@/features/hotel/domain/hotel-time'
import { hotelClock, useHotelStore } from '@/features/hotel/stores/hotel'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'

const { t, locale } = useI18n()
const formato = useHotelFormat()
const hotelStore = useHotelStore()

const padrao = resumoRepository.periodoPadrao()
const resumo = ref<ResumoDoHotel | null>(null)
const carregando = ref(false)
const erro = ref('')

const intervalo = ref<Date[]>([
  new Date(`${padrao.de}T12:00:00`),
  new Date(`${padrao.ate}T12:00:00`),
])

function paraIso(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(
    data.getDate(),
  ).padStart(2, '0')}`
}

async function carregar() {
  const [de, ate] = intervalo.value ?? []

  if (!de || !ate) {
    return
  }

  carregando.value = true
  erro.value = ''

  try {
    await hotelStore.carregar()
    resumo.value = await resumoRepository.carregar(paraIso(de), paraIso(ate))
  } catch {
    erro.value = 'hotel.erros.resumo'
  } finally {
    carregando.value = false
  }
}

onMounted(carregar)
watch(intervalo, () => void carregar())

// ------------------------------------------------------------------------------ o período

/**
 * Os atalhos de período. Terminam hoje, como o padrão da tela: "30 dias" é o padrão, e os outros
 * dois são a semana que passou e o trimestre.
 */
type Atalho = 7 | 30 | 90

const ATALHOS: Atalho[] = [7, 30, 90]

const atalhoAtual = computed<Atalho | null>(() => {
  const [de, ate] = intervalo.value ?? []
  const hoje = hotelClock.today()

  if (!de || !ate || paraIso(ate) !== hoje) {
    return null
  }

  return ATALHOS.find((dias) => paraIso(de) === addDays(hoje, -dias)) ?? null
})

const opcoesDeAtalho = computed(() =>
  ATALHOS.map((dias) => ({ valor: dias, rotulo: t('hotel.resumo.nova.ultimosDias', { total: dias }) })),
)

function escolherAtalho(dias: Atalho | null) {
  if (!dias) {
    return
  }

  const hoje = hotelClock.today()

  intervalo.value = [new Date(`${addDays(hoje, -dias)}T12:00:00`), new Date(`${hoje}T12:00:00`)]
}

const intl = computed(() => INTL_LOCALE[locale.value as Locale])

/** "sáb. 12/10" — o dia da semana é a informação num relatório de hotel. */
function diaCurto(iso: string) {
  return new Intl.DateTimeFormat(intl.value, {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T12:00:00Z`))
}

// ------------------------------------------------------------------------------ a frase e a régua

const semMovimento = computed(
  () => !carregando.value && !erro.value && (resumo.value?.diariasVendidas ?? 0) === 0,
)

/** O que o dono procura primeiro: quanto entrou, em quantas diárias, com a casa quão cheia. */
const fraseDoResumo = computed(() => {
  if (!resumo.value || erro.value) {
    return ''
  }

  if (semMovimento.value) {
    return t('hotel.resumo.vazioDescricao')
  }

  const total = resumo.value.diariasVendidas

  return t(
    'hotel.resumo.nova.frase',
    {
      receita: formato.moeda(resumo.value.receitaCentavos),
      total,
      ocupacao: formato.percentual(resumo.value.ocupacaoMedia),
    },
    total,
  )
})

const numeros = computed(() => {
  const dados = resumo.value

  if (!dados) {
    return []
  }

  return [
    {
      id: 'ocupacao',
      rotulo: t('hotel.resumo.stat.ocupacao'),
      valor: formato.percentual(dados.ocupacaoMedia),
      nota: t('hotel.resumo.stat.ocupacaoDetalhe'),
    },
    {
      id: 'receita',
      rotulo: t('hotel.resumo.stat.receita'),
      valor: formato.moeda(dados.receitaCentavos),
      nota: t('hotel.resumo.stat.diarias', { total: dados.diariasVendidas }, dados.diariasVendidas),
    },
    {
      id: 'diaria',
      rotulo: t('hotel.resumo.stat.diariaMedia'),
      valor: formato.moeda(dados.diariaMediaCentavos),
      nota: t('hotel.resumo.stat.diariaMediaDetalhe'),
    },
    {
      id: 'retorno',
      rotulo: t('hotel.resumo.stat.retorno'),
      valor: formato.percentual(dados.taxaDeRetorno),
      nota: t('hotel.resumo.stat.retornoDetalhe'),
    },
  ]
})

// ------------------------------------------------------------------------------ a ocupação

/** Sábado e domingo: os dias que decidem se vale abrir no feriado. */
function fimDeSemana(iso: string) {
  const dia = new Date(`${iso}T12:00:00Z`).getUTCDay()

  return dia === 0 || dia === 6
}

/**
 * As colunas, em percentual **da casa** — ocupadas sobre as que operavam no dia. Escala fixa de
 * 0 a 100%: uma casa a 40% deve parecer uma casa a 40%, e não uma casa cheia por normalização.
 */
const colunas = computed(() => {
  const pontos = resumo.value?.ocupacaoPorDia ?? []
  const passo = pontos.length > 45 ? 7 : pontos.length > 16 ? 5 : pontos.length > 9 ? 2 : 1

  return pontos.map((ponto, indice) => ({
    ...ponto,
    altura: Math.round(Math.min(1, ponto.taxa) * 100),
    fimDeSemana: fimDeSemana(ponto.data),
    rotulo:
      indice % passo === 0 || indice === pontos.length - 1
        ? pontos.length <= 9
          ? diaCurto(ponto.data)
          : formato.data(ponto.data)
        : '',
    dica: t('hotel.resumo.nova.ocupacao.dica', {
      dia: diaCurto(ponto.data),
      ocupadas: ponto.ocupadas,
      total: ponto.operando,
      taxa: formato.percentual(Math.min(1, ponto.taxa)),
    }),
  }))
})

/** A noite mais cheia, em frase: é o pico que a média esconde. */
const fraseDaOcupacao = computed(() => {
  const pontos = resumo.value?.ocupacaoPorDia ?? []

  if (pontos.length === 0 || !resumo.value) {
    return ''
  }

  const cheia = pontos.reduce((maior, ponto) => (ponto.taxa > maior.taxa ? ponto : maior))

  return t('hotel.resumo.nova.ocupacao.frase', {
    media: formato.percentual(resumo.value.ocupacaoMedia),
    dia: diaCurto(cheia.data),
    ocupadas: cheia.ocupadas,
    total: cheia.operando,
  })
})

// ------------------------------------------------------------------------------ os rankings

type LinhaDeRanking = { id: string; rotulo: string; valor: string; nota: string; parte: number; grave?: string }

function emRanking<T>(
  itens: T[],
  medida: (item: T) => number,
  linha: (item: T) => Omit<LinhaDeRanking, 'parte'>,
): LinhaDeRanking[] {
  const maior = itens.reduce((topo, item) => Math.max(topo, medida(item)), 0)

  return itens.map((item) => ({
    ...linha(item),
    parte: maior > 0 ? medida(item) / maior : 0,
  }))
}

const porOrigem = computed(() =>
  emRanking(
    resumo.value?.porOrigem ?? [],
    (fatia) => fatia.receitaCentavos,
    (fatia) => ({
      id: fatia.origem,
      rotulo: formato.origem(fatia.origem),
      valor: formato.moeda(fatia.receitaCentavos),
      nota: t('hotel.resumo.reservas', { total: fatia.reservas }, fatia.reservas),
    }),
  ),
)

const porServico = computed(() =>
  emRanking(
    resumo.value?.porServico ?? [],
    (fatia) => fatia.receitaCentavos,
    (fatia) => ({
      id: fatia.kind,
      rotulo: formato.servico(fatia.kind),
      valor: formato.moeda(fatia.receitaCentavos),
      nota: t('hotel.resumo.vezes', { total: fatia.vezes }, fatia.vezes),
    }),
  ),
)

const ocorrencias = computed(() =>
  emRanking(
    resumo.value?.ocorrencias ?? [],
    (contagem) => contagem.total,
    (contagem) => ({
      id: contagem.kind,
      rotulo: formato.ocorrenciaKind(contagem.kind),
      valor: String(contagem.total),
      nota: '',
      grave:
        contagem.graves > 0
          ? t('hotel.resumo.graves', { total: contagem.graves }, contagem.graves)
          : undefined,
    }),
  ),
)

const totalDeOcorrencias = computed(() =>
  (resumo.value?.ocorrencias ?? []).reduce((soma, item) => soma + item.total, 0),
)

/**
 * O tutorial desta tela, na ordem em que se lê a página.
 *
 * Os passos ficam aqui, e não num catálogo central, porque cada um carrega um seletor do próprio
 * template: separá-los faria o roteiro apontar para uma classe renomeada sem ninguém notar.
 */
const tourAberto = ref(false)

const passosDoTour = computed<PassoDoTour[]>(() => [
  {
    titulo: t('hotel.tour.resumo.pergunta.titulo'),
    texto: t('hotel.tour.resumo.pergunta.texto'),
  },
  {
    alvo: '.periodo',
    titulo: t('hotel.tour.resumo.periodo.titulo'),
    texto: t('hotel.tour.resumo.periodo.texto'),
  },
  {
    alvo: '.numeros',
    titulo: t('hotel.tour.resumo.numeros.titulo'),
    texto: t('hotel.tour.resumo.numeros.texto'),
  },
  {
    alvo: '.grafico',
    titulo: t('hotel.tour.resumo.grafico.titulo'),
    texto: t('hotel.tour.resumo.grafico.texto'),
  },
  {
    alvo: '.rankings',
    titulo: t('hotel.tour.resumo.cartoes.titulo'),
    texto: t('hotel.tour.resumo.cartoes.texto'),
  },
])
</script>

<template>
  <UiPagina
    class="tela"
    :resumo="fraseDoResumo"
    :carregando="carregando && !resumo"
    :erro="erro ? t(erro) : ''"
    tour
    @tour="tourAberto = true"
    @tentar-de-novo="carregar"
  >
    <div v-if="resumo" class="relatorio">
      <!-- O período: todo número da tela responde por ele, e por nenhum outro. -->
      <div class="periodo">
        <SelectButton
          :model-value="atalhoAtual"
          :options="opcoesDeAtalho"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          :aria-label="t('hotel.resumo.periodo')"
          @update:model-value="escolherAtalho"
        />

        <span class="periodo__ou">{{ t('hotel.resumo.nova.ou') }}</span>

        <DatePicker
          v-model="intervalo"
          class="periodo__calendario"
          input-id="resumo-periodo"
          selection-mode="range"
          :manual-input="false"
          date-format="dd/mm/yy"
          show-icon
          icon-display="input"
          :aria-label="t('hotel.resumo.periodo')"
        />
      </div>

      <div v-if="semMovimento" class="ui-folha nada">
        <span class="nada__icone" aria-hidden="true"><i class="ph ph-chart-bar" /></span>
        <strong>{{ t('hotel.resumo.vazioTitulo') }}</strong>
        <p>{{ t('hotel.resumo.vazioDescricao') }}</p>
      </div>

      <template v-else>
        <!-- A régua dos quatro números do período. -->
        <ul class="numeros ui-folha" :aria-label="t('hotel.resumo.nova.numerosRotulo')">
          <li v-for="numero in numeros" :key="numero.id" class="numero">
            <span class="numero__rotulo">{{ numero.rotulo }}</span>
            <strong class="numero__valor ui-num">{{ numero.valor }}</strong>
            <span class="numero__nota">{{ numero.nota }}</span>
          </li>
        </ul>

        <UiSecao
          id="resumo-ocupacao"
          :titulo="t('hotel.resumo.ocupacaoPorDia')"
          :descricao="t('hotel.resumo.nova.ocupacao.descricao')"
          folha
        >
          <div class="ocupacao">
            <div class="grafico" role="img" :aria-label="fraseDaOcupacao || t('hotel.resumo.ocupacaoAria')">
              <!-- A escala da casa: 0 a 100%, com quatro fios. -->
              <div class="grafico__escala" aria-hidden="true">
                <span v-for="marca in [100, 75, 50, 25, 0]" :key="marca" class="grafico__fio">
                  <small class="ui-num">{{ marca }}%</small>
                </span>
              </div>

              <div class="grafico__colunas" :style="{ '--colunas': colunas.length }">
                <div
                  v-for="coluna in colunas"
                  :key="coluna.data"
                  class="grafico__coluna"
                  :title="coluna.dica"
                >
                  <span
                    class="grafico__barra"
                    :class="{ 'grafico__barra--fim': coluna.fimDeSemana }"
                    :style="{ blockSize: `${Math.max(coluna.altura, coluna.ocupadas > 0 ? 2 : 0)}%` }"
                  />
                  <small class="grafico__rotulo ui-num" aria-hidden="true">{{ coluna.rotulo }}</small>
                </div>
              </div>
            </div>

            <div class="ocupacao__pe">
              <ul class="legenda" aria-hidden="true">
                <li><span class="legenda__cor legenda__cor--fim" />{{ t('hotel.resumo.nova.ocupacao.fimDeSemana') }}</li>
                <li><span class="legenda__cor" />{{ t('hotel.resumo.nova.ocupacao.diaDeSemana') }}</li>
              </ul>

              <p v-if="fraseDaOcupacao" class="ocupacao__frase">
                <i class="ph ph-moon-stars" aria-hidden="true" />
                {{ fraseDaOcupacao }}
              </p>
            </div>
          </div>
        </UiSecao>

        <div class="rankings">
          <UiSecao id="resumo-origem" :titulo="t('hotel.resumo.porOrigem')" folha>
            <ol v-if="porOrigem.length" class="ranking">
              <li v-for="linha in porOrigem" :key="linha.id" class="ranking__linha">
                <span class="ranking__nome">{{ linha.rotulo }}</span>
                <span class="ranking__trilho" aria-hidden="true">
                  <span class="ranking__barra" :style="{ inlineSize: `${linha.parte * 100}%` }" />
                </span>
                <span class="ranking__valor">
                  <strong class="ui-num">{{ linha.valor }}</strong>
                  <small>{{ linha.nota }}</small>
                </span>
              </li>
            </ol>
            <p v-else class="ui-vazio">{{ t('hotel.resumo.vazioDescricao') }}</p>
          </UiSecao>

          <UiSecao id="resumo-servico" :titulo="t('hotel.resumo.porServico')" folha>
            <ol v-if="porServico.length" class="ranking">
              <li v-for="linha in porServico" :key="linha.id" class="ranking__linha">
                <span class="ranking__nome">{{ linha.rotulo }}</span>
                <span class="ranking__trilho" aria-hidden="true">
                  <span class="ranking__barra" :style="{ inlineSize: `${linha.parte * 100}%` }" />
                </span>
                <span class="ranking__valor">
                  <strong class="ui-num">{{ linha.valor }}</strong>
                  <small>{{ linha.nota }}</small>
                </span>
              </li>
            </ol>
            <p v-else class="ui-vazio">{{ t('hotel.resumo.semServicos') }}</p>
          </UiSecao>

          <UiSecao
            id="resumo-ocorrencias"
            :titulo="t('hotel.resumo.ocorrencias')"
            :contagem="totalDeOcorrencias || null"
            folha
          >
            <ol v-if="ocorrencias.length" class="ranking ranking--atencao">
              <li v-for="linha in ocorrencias" :key="linha.id" class="ranking__linha">
                <span class="ranking__nome">{{ linha.rotulo }}</span>
                <span class="ranking__trilho" aria-hidden="true">
                  <span class="ranking__barra" :style="{ inlineSize: `${linha.parte * 100}%` }" />
                </span>
                <span class="ranking__valor">
                  <strong class="ui-num">{{ linha.valor }}</strong>
                  <small v-if="linha.grave" class="ranking__grave">
                    <i class="ph ph-warning-octagon" aria-hidden="true" />
                    {{ linha.grave }}
                  </small>
                </span>
              </li>
            </ol>
            <p v-else class="ui-vazio">{{ t('hotel.resumo.semOcorrencias') }}</p>
          </UiSecao>

          <!--
            Cancelamento é aviso — deu para revender a vaga; não comparecer é vaga queimada. Os
            dois lado a lado, e o segundo pesa mais.
          -->
          <UiSecao id="resumo-perdas" :titulo="t('hotel.resumo.perdas')" folha>
            <dl class="perdas">
              <div class="perda">
                <dt>{{ t('hotel.resumo.cancelamento') }}</dt>
                <dd>
                  <strong class="ui-num">{{ formato.percentual(resumo.taxaDeCancelamento) }}</strong>
                  <small>{{ t('hotel.resumo.nova.perdas.cancelamentoDetalhe') }}</small>
                </dd>
              </div>
              <div class="perda" :class="{ 'perda--atencao': resumo.taxaDeNaoComparecimento > 0 }">
                <dt>{{ t('hotel.resumo.naoComparecimento') }}</dt>
                <dd>
                  <strong class="ui-num">
                    <i
                      v-if="resumo.taxaDeNaoComparecimento > 0"
                      class="ph ph-warning"
                      aria-hidden="true"
                    />
                    {{ formato.percentual(resumo.taxaDeNaoComparecimento) }}
                  </strong>
                  <small>{{ t('hotel.resumo.naoComparecimentoDetalhe') }}</small>
                </dd>
              </div>
            </dl>
          </UiSecao>
        </div>
      </template>
    </div>

    <template #sempre>
      <HotelDevPanel />

      <HotelTour v-model:aberto="tourAberto" :passos="passosDoTour" />
    </template>
  </UiPagina>
</template>

<style scoped>
.relatorio {
  display: grid;
  gap: 28px;
  grid-template-columns: minmax(0, 1fr);
}

/* ------------------------------------------------------------------ o período */

.periodo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
}

.periodo__ou {
  color: var(--tinta-3);
  font-size: 13.5px;
}

.periodo__calendario {
  width: 15.5rem;
}

/* ------------------------------------------------------------------ sem movimento */

.nada {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 36px 24px;
  color: var(--tinta-2);
  text-align: center;
}

.nada__icone {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  border-radius: 14px;
  background: var(--superficie-2);
  font-size: 22px;
}

.nada strong {
  color: var(--tinta);
  font-size: 16px;
  font-weight: 600;
}

.nada p {
  max-width: 48ch;
  margin: 0;
}

/* ------------------------------------------------------------------ a régua */

.numeros {
  display: grid;
  margin: 0;
  padding: 0;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  list-style: none;
}

.numero {
  display: grid;
  align-content: start;
  gap: 4px;
  padding: 18px 22px 20px;
}

.numero + .numero {
  border-inline-start: 1px solid var(--linha);
}

.numero__rotulo {
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 500;
}

.numero__valor {
  color: var(--tinta);
  font-size: 30px;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.1;
}

.numero__nota {
  color: var(--tinta-3);
  font-size: 12.5px;
}

/* ------------------------------------------------------------------ a ocupação */

.ocupacao {
  display: grid;
  gap: 14px;
  padding: 18px 20px 16px;
}

.grafico {
  position: relative;
  display: grid;
  height: 240px;
  padding-bottom: 22px;
  grid-template-columns: 40px minmax(0, 1fr);
}

.grafico__escala {
  position: absolute;
  inset: 0 0 22px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  pointer-events: none;
}

.grafico__fio {
  position: relative;
  display: block;
  height: 0;
  margin-inline-start: 40px;
  border-top: 1px dashed var(--linha);
}

.grafico__fio:last-child {
  border-top-style: solid;
  border-top-color: var(--linha-forte);
}

.grafico__fio small {
  position: absolute;
  inset-inline-end: calc(100% + 8px);
  top: -8px;
  color: var(--tinta-3);
  font-size: 11.5px;
  white-space: nowrap;
}

.grafico__colunas {
  position: relative;
  display: grid;
  align-items: end;
  /* O vão acompanha a largura: oito pixels no desktop, um ou dois no telefone com trinta colunas. */
  column-gap: clamp(1px, 0.8%, 8px);
  grid-column: 2;
  grid-template-columns: repeat(var(--colunas), minmax(0, 1fr));
}

.grafico__coluna {
  position: relative;
  display: flex;
  height: 100%;
  align-items: flex-end;
  cursor: default;
}

.grafico__barra {
  display: block;
  width: 100%;
  max-width: 56px;
  margin-inline: auto;
  border-radius: 4px 4px 0 0;
  background: color-mix(in oklab, var(--pj-lugar) 45%, var(--superficie));
  transition: background-color var(--pj-tempo-curto) ease;
}

.grafico__barra--fim {
  background: var(--pj-lugar);
}

.grafico__coluna:hover .grafico__barra {
  background: var(--pj-lugar-tinta);
}

.grafico__rotulo {
  position: absolute;
  top: calc(100% + 6px);
  left: 50%;
  color: var(--tinta-2);
  font-size: 11.5px;
  transform: translateX(-50%);
  white-space: nowrap;
}

.ocupacao__pe {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 20px;
  padding-inline-start: 40px;
}

.legenda {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  margin: 0;
  padding: 0;
  color: var(--tinta-2);
  font-size: 12.5px;
  list-style: none;
}

.legenda li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.legenda__cor {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  background: color-mix(in oklab, var(--pj-lugar) 45%, var(--superficie));
}

.legenda__cor--fim {
  background: var(--pj-lugar);
}

.ocupacao__frase {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.ocupacao__frase i {
  color: var(--pj-lugar-tinta);
  font-size: 18px;
}

/* ------------------------------------------------------------------ os rankings */

.rankings {
  display: grid;
  align-items: start;
  gap: 28px 20px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.ranking {
  display: grid;
  gap: 14px;
  margin: 0;
  padding: 18px 20px;
  list-style: none;
}

/* Três colunas que se repetem em toda linha: as barras começam no mesmo lugar. */
.ranking__linha {
  display: grid;
  align-items: center;
  gap: 14px;
  grid-template-columns: minmax(6.5rem, 10rem) minmax(0, 1fr) minmax(6.5rem, auto);
}

.ranking__nome {
  overflow: hidden;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 550;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ranking__trilho {
  display: block;
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--superficie-3);
}

.ranking__barra {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--pj-lugar);
  transition: inline-size 0.2s ease-out;
}

.ranking--atencao .ranking__barra {
  background: var(--atencao);
}

.ranking__valor {
  display: grid;
  justify-items: end;
  line-height: 1.2;
  text-align: end;
}

.ranking__valor strong {
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 650;
  white-space: nowrap;
}

.ranking__valor small {
  color: var(--tinta-2);
  font-size: 12px;
  white-space: nowrap;
}

.ranking__grave {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--risco-tinta) !important;
  font-weight: 600;
}

.perdas {
  display: grid;
  margin: 0;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.perda {
  display: grid;
  align-content: start;
  gap: 4px;
  padding: 18px 20px 20px;
}

.perda + .perda {
  border-inline-start: 1px solid var(--linha);
}

.perda dt {
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 500;
}

.perda dd {
  display: grid;
  gap: 4px;
  margin: 0;
}

.perda strong {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--tinta);
  font-size: 26px;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.1;
}

.perda strong i {
  font-size: 20px;
}

.perda small {
  color: var(--tinta-3);
  font-size: 12.5px;
}

.perda--atencao strong {
  color: var(--atencao-tinta);
}

@media (max-width: 1100px) {
  .numeros {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .numero:nth-child(3) {
    border-inline-start: 0;
  }

  .numero:nth-child(n + 3) {
    border-top: 1px solid var(--linha);
  }

  .rankings {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 640px) {
  .periodo :deep(.p-selectbutton) {
    width: 100%;
  }

  .periodo :deep(.p-togglebutton) {
    flex: 1;
  }

  .periodo__calendario {
    width: 100%;
  }

  .periodo__ou {
    display: none;
  }

  .numero {
    padding: 14px 16px 16px;
  }

  .numero__valor {
    font-size: 22px;
  }

  .ocupacao {
    padding: 14px 12px 12px;
  }

  .grafico {
    height: 200px;
  }

  .ranking {
    padding: 14px 16px;
  }

  .ranking__linha {
    gap: 6px 12px;
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .ranking__trilho {
    grid-column: 1 / -1;
    grid-row: 2;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ranking__barra,
  .grafico__barra {
    transition: none;
  }
}
</style>
