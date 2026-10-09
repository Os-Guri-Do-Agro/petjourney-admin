<script setup lang="ts">
/**
 * Resumo — a única tela do módulo que olha para trás.
 *
 * Olha-se depois que o mês acabou, não durante o dia, e a pergunta que ela responde é uma só:
 * **valeu a pena?** Por isso a receita vem acompanhada da diária média, e não sozinha: um mês com
 * mais receita e diária média menor é um mês em que a casa trabalhou mais para ganhar o mesmo.
 *
 * A ocupação é desenhada como barras por dia e não como um número único. A média esconde
 * exatamente o que se quer ver — que a casa lota no fim de semana e esvazia na terça —, e é essa
 * forma que decide se vale abrir no feriado.
 */
import DatePicker from 'primevue/datepicker'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import ClinicStat from '@/features/clinico/components/base/ClinicStat.vue'
import HotelDevPanel from '@/features/hotel/components/base/HotelDevPanel.vue'
import HotelTour from '@/features/hotel/components/base/HotelTour.vue'
import type { PassoDoTour } from '@/features/hotel/components/base/tour-types'
import { useHotelFormat } from '@/features/hotel/composables/useHotelFormat'
import { resumoRepository, type ResumoDoHotel } from '@/features/hotel/data/repositories'
import { useHotelStore } from '@/features/hotel/stores/hotel'

const { t } = useI18n()
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

/**
 * A altura de cada barra, em percentual da maior do período.
 *
 * Normalizada pela maior e não pela capacidade: uma casa que roda a 40% teria doze barras
 * rasteiras e indistinguíveis, e a forma da semana — que é a informação — desapareceria.
 */
const barras = computed(() => {
  const pontos = resumo.value?.ocupacaoPorDia ?? []
  const maior = Math.max(...pontos.map((ponto) => ponto.ocupadas), 1)

  return pontos.map((ponto) => ({ ...ponto, altura: Math.round((ponto.ocupadas / maior) * 100) }))
})

const vazio = computed(
  () => !carregando.value && !erro.value && (resumo.value?.diariasVendidas ?? 0) === 0,
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
    alvo: '.colunas',
    titulo: t('hotel.tour.resumo.cartoes.titulo'),
    texto: t('hotel.tour.resumo.cartoes.texto'),
  },
])
</script>

<template>
  <PartnerPageFrame
    class="hc-tema"
    :title="t('hotel.resumo.titulo')"
    :subtitle="t('hotel.resumo.subtitulo')"
    tour
    @tour="tourAberto = true"
    :loading="carregando && !resumo"
    :error="erro ? t(erro) : ''"
    :empty="vazio"
    :empty-title="t('hotel.resumo.vazioTitulo')"
    :empty-description="t('hotel.resumo.vazioDescricao')"
    @retry="carregar"
  >
    <div v-if="resumo" class="resumo clinic-scope">
      <section class="periodo">
        <label for="resumo-periodo">{{ t('hotel.resumo.periodo') }}</label>
        <DatePicker
          panel-class="hc-tema"
          id="resumo-periodo"
          v-model="intervalo"
          selection-mode="range"
          :manual-input="false"
          date-format="dd/mm/yy"
          show-icon
        />
      </section>

      <section class="numeros">
        <ClinicStat
          :rotulo="t('hotel.resumo.stat.ocupacao')"
          :valor="formato.percentual(resumo.ocupacaoMedia)"
          :detalhe="t('hotel.resumo.stat.ocupacaoDetalhe')"
          icone="ph ph-chart-pie-slice"
        />
        <ClinicStat
          :rotulo="t('hotel.resumo.stat.receita')"
          :valor="formato.moeda(resumo.receitaCentavos)"
          :detalhe="
            t(
              'hotel.resumo.stat.diarias',
              { total: resumo.diariasVendidas },
              resumo.diariasVendidas,
            )
          "
          icone="ph ph-wallet"
          tom="acento"
        />
        <ClinicStat
          :rotulo="t('hotel.resumo.stat.diariaMedia')"
          :valor="formato.moeda(resumo.diariaMediaCentavos)"
          :detalhe="t('hotel.resumo.stat.diariaMediaDetalhe')"
          icone="ph ph-calculator"
        />
        <ClinicStat
          :rotulo="t('hotel.resumo.stat.retorno')"
          :valor="formato.percentual(resumo.taxaDeRetorno)"
          :detalhe="t('hotel.resumo.stat.retornoDetalhe')"
          icone="ph ph-arrow-counter-clockwise"
        />
      </section>

      <section class="cartao">
        <h2 class="cartao__titulo">{{ t('hotel.resumo.ocupacaoPorDia') }}</h2>

        <!--
          Barras desenhadas em CSS, e não num gráfico: são trinta valores de uma dimensão só, e
          arrastar uma biblioteca de gráficos para o primeiro carregamento de quem abre o resumo
          custaria mais do que a informação vale.
        -->
        <div class="grafico" role="img" :aria-label="t('hotel.resumo.ocupacaoAria')">
          <div v-for="ponto in barras" :key="ponto.data" class="grafico__coluna">
            <div
              class="grafico__barra"
              :style="{ height: `${ponto.altura}%` }"
              :title="`${formato.data(ponto.data)}: ${ponto.ocupadas}/${ponto.operando}`"
            />
          </div>
        </div>

        <p class="grafico__eixo">
          <span>{{ formato.data(resumo.de) }}</span>
          <span>{{ formato.data(resumo.ate) }}</span>
        </p>
      </section>

      <div class="colunas">
        <section class="cartao">
          <h2 class="cartao__titulo">{{ t('hotel.resumo.porOrigem') }}</h2>

          <ul class="fatias">
            <li v-for="fatia in resumo.porOrigem" :key="fatia.origem">
              <span>{{ formato.origem(fatia.origem) }}</span>
              <strong class="clinic-value">{{ formato.moeda(fatia.receitaCentavos) }}</strong>
              <small>
                {{ t('hotel.resumo.reservas', { total: fatia.reservas }, fatia.reservas) }}
              </small>
            </li>
          </ul>
        </section>

        <section class="cartao">
          <h2 class="cartao__titulo">{{ t('hotel.resumo.porServico') }}</h2>

          <p v-if="resumo.porServico.length === 0" class="cartao__vazio">
            {{ t('hotel.resumo.semServicos') }}
          </p>

          <ul v-else class="fatias">
            <li v-for="fatia in resumo.porServico" :key="fatia.kind">
              <span>{{ formato.servico(fatia.kind) }}</span>
              <strong class="clinic-value">{{ formato.moeda(fatia.receitaCentavos) }}</strong>
              <small>{{ t('hotel.resumo.vezes', { total: fatia.vezes }, fatia.vezes) }}</small>
            </li>
          </ul>
        </section>

        <section class="cartao">
          <h2 class="cartao__titulo">{{ t('hotel.resumo.ocorrencias') }}</h2>

          <p v-if="resumo.ocorrencias.length === 0" class="cartao__vazio">
            {{ t('hotel.resumo.semOcorrencias') }}
          </p>

          <ul v-else class="fatias">
            <li v-for="contagem in resumo.ocorrencias" :key="contagem.kind">
              <span>{{ formato.ocorrenciaKind(contagem.kind) }}</span>
              <strong class="clinic-value">{{ contagem.total }}</strong>
              <small v-if="contagem.graves > 0" class="fatias__grave">
                {{ t('hotel.resumo.graves', { total: contagem.graves }, contagem.graves) }}
              </small>
            </li>
          </ul>
        </section>

        <section class="cartao">
          <h2 class="cartao__titulo">{{ t('hotel.resumo.perdas') }}</h2>

          <ul class="fatias">
            <li>
              <span>{{ t('hotel.resumo.cancelamento') }}</span>
              <strong class="clinic-value">{{
                formato.percentual(resumo.taxaDeCancelamento)
              }}</strong>
            </li>
            <li>
              <span>{{ t('hotel.resumo.naoComparecimento') }}</span>
              <strong class="clinic-value">
                {{ formato.percentual(resumo.taxaDeNaoComparecimento) }}
              </strong>
              <small>{{ t('hotel.resumo.naoComparecimentoDetalhe') }}</small>
            </li>
          </ul>
        </section>
      </div>
    </div>

    <HotelDevPanel />

    <HotelTour v-model:aberto="tourAberto" :passos="passosDoTour" />
  </PartnerPageFrame>
</template>

<style scoped>
.resumo {
  display: grid;
  gap: var(--clinic-space-4);
}

.periodo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--clinic-space-3);
}

.periodo label {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.numeros {
  display: grid;
  gap: var(--clinic-space-3);
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
}

.cartao {
  display: grid;
  /* Os cartões de uma linha crescem juntos; a lista fica no topo, e não espalhada pela altura. */
  align-content: start;
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
}

.cartao__titulo {
  margin: 0;
  color: var(--clinic-text);
  font-size: 0.9375rem;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.cartao__vazio {
  margin: 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.grafico {
  display: flex;
  align-items: flex-end;
  height: 8rem;
  gap: 2px;
}

.grafico__coluna {
  display: flex;
  align-items: flex-end;
  height: 100%;
  flex: 1;
}

.grafico__barra {
  width: 100%;
  min-height: 2px;
  border-radius: 2px 2px 0 0;
  background: var(--clinic-accent-deep);
}

.grafico__eixo {
  display: flex;
  justify-content: space-between;
  margin: 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.colunas {
  display: grid;
  gap: var(--clinic-space-4);
  grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr));
}

.fatias {
  display: grid;
  gap: var(--clinic-space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.fatias li {
  display: grid;
  align-items: baseline;
  gap: 0 var(--clinic-space-2);
  grid-template-columns: 1fr auto;
}

.fatias span {
  font-size: var(--clinic-font-label);
}

.fatias strong {
  font-weight: 800;
}

.fatias small {
  grid-column: 1 / -1;
  color: var(--clinic-faint);
  font-size: 0.7rem;
}

.fatias__grave {
  color: var(--clinic-risk-text) !important;
  font-weight: 700;
}
</style>
