<script setup lang="ts">
/**
 * A análise do estoque pela API (E6-01b, guia e6 12): o giro por mês (o corrente parcial), o saldo
 * contra o mínimo, as perdas por motivo e a validade em quatro faixas. A conta é no banco; a tela
 * reaproveita os gráficos da demonstração com os números da API. Dinheiro só para quem vê dinheiro.
 */
import SelectButton from 'primevue/selectbutton'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import EstoqueChartConsumo from '@/features/clinico/components/estoque/EstoqueChartConsumo.vue'
import EstoqueChartSaldo from '@/features/clinico/components/estoque/EstoqueChartSaldo.vue'
import ClinicChartRanking from '@/features/clinico/components/resumo/ClinicChartRanking.vue'
import type { MesDeConsumo, SaldoDaVacina } from '@/features/clinico/domain/estoque-vacinas'
import type { Fatia } from '@/features/clinico/domain/resumo'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import { lerAnalise, type Analise } from '@/service/parceiro/estoque-service'
import { formatCentavosToBrl } from '@/utils/format/money'

const { t, locale } = useI18n()
const { parceiroQuery } = useParceiroPortal()

const meses = ref(6)
const analise = ref<Analise | null>(null)
const carregando = ref(false)
const erro = ref('')

async function carregar() {
  carregando.value = true
  erro.value = ''
  try {
    analise.value = await lerAnalise(meses.value, parceiroQuery())
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('estoque.analise.erro')).mensagem
  } finally {
    carregando.value = false
  }
}

onMounted(() => void carregar())
watch(meses, () => void carregar())

const opcoes = computed(() =>
  [3, 6, 12].map((valor) => ({ valor, rotulo: t('estoque.analise.meses', { n: valor }, valor) })),
)

const intl = computed(() => INTL_LOCALE[locale.value as Locale])
const dinheiro = (centavos: number | undefined) =>
  typeof centavos === 'number' ? formatCentavosToBrl(centavos, intl.value) : ''

/* ------------------------------------------------------------------------------- giro */

const vacinasDoGiro = computed(() =>
  (analise.value?.giro.vacinas ?? []).map((v) => ({ id: v.vacinaId, nome: v.nome })),
)

const consumo = computed<MesDeConsumo[]>(() =>
  (analise.value?.giro.meses ?? []).map((mes) => ({
    mes: mes.mes,
    total: mes.total,
    porVacina: Object.fromEntries(
      vacinasDoGiro.value.map((v) => [
        v.id,
        mes.porVacina.find((p) => p.vacinaId === v.id)?.doses ?? 0,
      ]),
    ),
  })),
)

const rotulosDosMeses = computed(() =>
  (analise.value?.giro.meses ?? []).map((mes) => {
    const [ano, m] = mes.mes.split('-').map(Number)
    const rotulo = new Intl.DateTimeFormat(intl.value, { month: 'short', timeZone: 'UTC' }).format(
      Date.UTC(ano!, (m ?? 1) - 1, 1),
    )
    return mes.parcial ? `${rotulo}*` : rotulo
  }),
)

const mesParcial = computed(() => analise.value?.giro.meses.some((mes) => mes.parcial) ?? false)

/* ----------------------------------------------------------------------- saldo e mínimo */

const SITUACAO: Record<string, SaldoDaVacina['situacao']> = {
  zerado: 'zerado',
  abaixo: 'abaixo',
  ok: 'ok',
}

const saldos = computed<SaldoDaVacina[]>(() =>
  (analise.value?.saldoContraMinimo ?? []).map((item) => ({
    vacinaId: item.vacinaId,
    nome: item.nome,
    saldo: item.saldo,
    minimo: item.minimo,
    consumoMensal: 0,
    coberturaEmDias: item.coberturaEmDias,
    situacao:
      SITUACAO[
        item.zerado && item.abaixoDoMinimo ? 'zerado' : item.abaixoDoMinimo ? 'abaixo' : 'ok'
      ]!,
    valorParado: 0,
    vencendo: 0,
  })),
)

function textoDeCobertura(dias: number | null) {
  return dias === null ? t('estoque.semConsumo') : t('estoque.cobertura', { n: dias }, dias)
}

/* ------------------------------------------------------------------------------ perdas */

const fatiasDePerda = computed<Fatia[]>(() => {
  const porMotivo = analise.value?.perdas.porMotivo ?? []
  const total = porMotivo.reduce((soma, item) => soma + item.doses, 0)
  return porMotivo.map((item) => ({
    id: item.motivo,
    rotulo: t(`estoque.baixa.motivo.${item.motivo}`),
    valor: item.doses,
    parte: total ? item.doses / total : 0,
  }))
})

const resumoDasPerdas = computed(() => {
  const perdas = analise.value?.perdas
  if (!perdas) return ''
  return [
    t('estoque.analise.perdas', {
      perdidas: perdas.dosesPerdidas,
      recebidas: perdas.dosesRecebidas,
      percentual: new Intl.NumberFormat(intl.value, {
        style: 'percent',
        maximumFractionDigits: 1,
      }).format(perdas.perdaPercentual),
    }),
    perdas.valorPerdidoCentavos !== undefined
      ? t('estoque.analise.valorPerdido', { valor: dinheiro(perdas.valorPerdidoCentavos) })
      : '',
  ]
    .filter(Boolean)
    .join(' · ')
})
</script>

<template>
  <div class="an">
    <div class="an__filtros">
      <SelectButton
        v-model="meses"
        :options="opcoes"
        option-label="rotulo"
        option-value="valor"
        :allow-empty="false"
        :aria-label="t('estoque.analise.periodo')"
      />
    </div>

    <p v-if="erro" class="an__erro" role="alert">{{ erro }}</p>

    <template v-if="analise">
      <section class="ui-folha ui-cartao" aria-labelledby="an-giro" :aria-busy="carregando">
        <header class="ui-cartao__cabeca">
          <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-chart-bar" /></span>
          <span class="ui-cartao__titulos">
            <h2 id="an-giro" class="ui-cartao__titulo">{{ t('estoque.analise.giro') }}</h2>
            <p class="ui-cartao__descricao">
              {{ mesParcial ? t('estoque.analise.giroParcial') : t('estoque.analise.giroDica') }}
            </p>
          </span>
        </header>
        <div class="an__grafico">
          <EstoqueChartConsumo
            :meses="consumo"
            :vacinas="vacinasDoGiro"
            :rotulos="rotulosDosMeses"
            :unidade="t('estoque.doses')"
            :vazio="t('estoque.analise.semGiro')"
          />
        </div>
        <p v-if="analise.truncado" class="an__nota">{{ t('estoque.analise.truncado') }}</p>
      </section>

      <div class="an__par">
        <section class="ui-folha ui-cartao" aria-labelledby="an-saldo">
          <header class="ui-cartao__cabeca">
            <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-gauge" /></span>
            <span class="ui-cartao__titulos">
              <h2 id="an-saldo" class="ui-cartao__titulo">{{ t('estoque.analise.saldo') }}</h2>
              <p class="ui-cartao__descricao">{{ t('estoque.analise.saldoDica') }}</p>
            </span>
          </header>
          <div class="an__grafico">
            <EstoqueChartSaldo
              :saldos="saldos"
              :legenda="{
                minimo: t('estoque.minimo.rotulo'),
                doses: t('estoque.doses'),
                zerado: t('estoque.situacao.zerada'),
                abaixo: t('estoque.situacao.ABAIXO_DO_MINIMO'),
                ok: t('estoque.situacao.OK'),
                cobertura: textoDeCobertura,
              }"
              :vazio="t('estoque.vazio')"
            />
          </div>
        </section>

        <section class="ui-folha ui-cartao" aria-labelledby="an-perdas">
          <header class="ui-cartao__cabeca">
            <span class="ui-ladrilho ui-ladrilho--atencao" aria-hidden="true">
              <i class="ph ph-warning" />
            </span>
            <span class="ui-cartao__titulos">
              <h2 id="an-perdas" class="ui-cartao__titulo">
                {{ t('estoque.analise.perdasTitulo') }}
              </h2>
              <p class="ui-cartao__descricao">{{ resumoDasPerdas }}</p>
            </span>
          </header>
          <div class="an__grafico">
            <ClinicChartRanking
              tom="atencao"
              :fatias="fatiasDePerda"
              :unidade="t('estoque.doses')"
              :vazio="t('estoque.analise.semPerdas')"
            />
          </div>
        </section>
      </div>

      <section class="ui-folha ui-cartao" aria-labelledby="an-validade">
        <header class="ui-cartao__cabeca">
          <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-calendar-blank" /></span>
          <span class="ui-cartao__titulos">
            <h2 id="an-validade" class="ui-cartao__titulo">{{ t('estoque.analise.validade') }}</h2>
            <p class="ui-cartao__descricao">
              {{
                analise.validade.valorEmRiscoCentavos !== undefined
                  ? t('estoque.analise.emRisco', {
                      valor: dinheiro(analise.validade.valorEmRiscoCentavos),
                    })
                  : t('estoque.analise.validadeDica')
              }}
            </p>
          </span>
        </header>
        <ul class="ui-lista">
          <li v-for="faixa in analise.validade.faixas" :key="faixa.faixa" class="ui-linha">
            <span class="ui-linha__texto">
              <strong class="ui-linha__titulo">{{
                t(`estoque.analise.faixa.${faixa.faixa}`)
              }}</strong>
              <span class="ui-linha__meta">{{
                [
                  t('estoque.analise.lotes', { n: faixa.lotes }, faixa.lotes),
                  t('estoque.analise.doses', { n: faixa.doses }, faixa.doses),
                  dinheiro(faixa.valorCentavos),
                ]
                  .filter(Boolean)
                  .join(' · ')
              }}</span>
            </span>
            <span
              v-if="faixa.faixa === 'VENCIDO' && faixa.doses"
              class="ui-linha__fim ui-selo ui-selo--risco"
              >{{ t('estoque.analise.descartePendente') }}</span
            >
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
.an {
  display: grid;
  gap: 20px;
}

.an__filtros {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.an__erro {
  margin: 0;
  color: var(--risco-tinta);
  font-size: 13.5px;
}

.an__grafico {
  padding: 18px 24px 16px;
}

.an__nota {
  margin: 0;
  padding: 0 24px 14px;
  color: var(--tinta-2);
  font-size: 13px;
}

.an__par {
  display: grid;
  align-items: stretch;
  gap: 20px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
}
</style>
