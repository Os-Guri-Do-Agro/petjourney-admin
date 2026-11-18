<script setup lang="ts">
/**
 * O convite para quem ainda não usa o PetJourney: quem cria a conta com o código da empresa fica
 * ligado a ela, e as assinaturas dessa pessoa rendem participação no programa de afiliados. Três
 * jeitos de convidar (passar o código, mandar o link, imprimir o QR), as leituras do QR e as
 * regras. Com a flag de cupons ligada, os cupons e os resgates ganham seções próprias embaixo.
 *
 * As âncoras `#indicacao`, `#cupons` e `#resgates` são o destino dos redirects legados
 * (`?aba=indicacao|cupons|resgates`) e do link "Resgates" do diálogo de validar cupom.
 */
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import IndicacaoMetricasCard from '@/components/parceiro/IndicacaoMetricasCard.vue'
import IndicacaoQrBlock from '@/components/parceiro/IndicacaoQrBlock.vue'
import type { PassoDoGuia } from '@/components/ui/UiPassos.vue'
import UiVazioIlustrado from '@/components/ui/UiVazioIlustrado.vue'
// Volta junto com o teaser de cupom (ver o comentário no fim do template).
// import { useCupomComingSoon } from '@/composables/useCupomComingSoon'
import { useCupomResgateModal } from '@/composables/useCupomResgateModal'
import { isGuidanceVisible } from '@/composables/useLayoutPreferences'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { CUPOM_FEATURE_ENABLED } from '@/features/cupom-feature'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import {
  getPortalCupons,
  getPortalIndicacao,
  getPortalIndicacaoMetricas,
  getPortalResgates,
} from '@/service/parceiro/parceiro-portal-service'
import type {
  CupomParceiro,
  IndicacaoMetricas,
  PortalIndicacao,
  ResgateParceiro,
} from '@/service/parceiro/types'
import { resolveMetricasErro, type MetricasEstadoErro } from '@/utils/parceiro/indicacao-metricas'

/** Mesmo destino do gate da Carteira (`goToProgramas`): a âncora abre a lista. */
const PROGRAMAS_ROUTE = { path: '/parceiro/programas', hash: '#programas' } as const

const { t, locale } = useI18n()
const toast = useToast()
const { store, ensureContext, parceiroQuery } = useParceiroPortal()
const { lastSuccessAt, canOpen: podeValidarCupom, open: abrirValidarCupom } = useCupomResgateModal()
// const { open: openCupomComingSoon } = useCupomComingSoon()
const cupomFeatureEnabled = CUPOM_FEATURE_ENABLED

/**
 * Termos concretos da participação, do jeito que o backend calcula
 * (`comissao.config.ts`): 5% do plano, a cada renovação paga, janela de 18 meses
 * desde a primeira assinatura paga do indicado, hold de 14 dias e saque mínimo
 * de R$ 50.
 *
 * Divulgação em dois níveis: o ganho numa frase sempre à vista (5%, todo mês, 18 meses); o
 * detalhe completo (incluindo hold, saque e a condição de ativação) abre sob demanda.
 */
const TERM_IDS = ['percent', 'recurring', 'window', 'hold', 'payout', 'requirement'] as const

const TERM_ICONS: Record<(typeof TERM_IDS)[number], string> = {
  percent: 'ph ph-percent',
  recurring: 'ph ph-arrows-clockwise',
  window: 'ph ph-calendar-blank',
  hold: 'ph ph-hourglass',
  payout: 'ph ph-bank',
  requirement: 'ph ph-seal-check',
}

const termsOpen = ref(false)

/** Pedido já feito, ou o cadastro em análise: a primeira etapa da espera está feita. */
const esperaEmAnalise = computed(
  () => store.statusAuditoria === 'PENDENTE' || store.modoBloco('afiliado').status === 'SOLICITADO',
)

/**
 * O título da espera. Com o pedido já feito (ou o cadastro em análise), "Programa afiliado
 * necessário" mandava pedir de novo o que estava em análise.
 */
const tituloDaEspera = computed(() =>
  esperaEmAnalise.value ? t('carteira.gate.emAnaliseTitle') : t('carteira.gate.title'),
)

/** Como o código é liberado: o pedido (feito, se já foi), a aprovação e o código nesta tela. */
const passosDaEspera = computed<PassoDoGuia[]>(() => [
  {
    id: 'pedir',
    icone: 'ph ph-paper-plane-tilt',
    titulo: t('carteira.gate.guia.pedir.titulo'),
    texto: t('carteira.gate.guia.pedir.texto'),
    feito: esperaEmAnalise.value,
  },
  {
    id: 'analise',
    icone: 'ph ph-hourglass',
    titulo: t('carteira.gate.guia.analise.titulo'),
    texto: t('carteira.gate.guia.analise.texto'),
  },
  {
    id: 'codigo',
    icone: 'ph ph-qr-code',
    titulo: t('divulgacao.espera.guia.codigo.titulo'),
    texto: t('divulgacao.espera.guia.codigo.texto'),
  },
])

const indicacaoTerms = computed(() =>
  TERM_IDS.map((id) => ({
    id,
    icon: TERM_ICONS[id],
    title: t(`divulgacao.terms.${id}.title`),
    body: t(`divulgacao.terms.${id}.body`),
  })),
)

const indicacao = ref<PortalIndicacao | null>(null)

/**
 * Só existem quando `podeIndicar` (cadastro aprovado E afiliado ATIVO); fora
 * disso a API devolve `null` e a tela nem chega a renderizar este bloco. O
 * `?? ''` evita espalhar narrowing pelo template.
 */
const codigoIndicacao = computed(() => indicacao.value?.codigoIndicacao ?? '')
const linkIndicacao = computed(() => indicacao.value?.link ?? '')

/** O link sem o protocolo: é o que cabe na linha e o que a pessoa reconhece. */
const linkLegivel = computed(() => linkIndicacao.value.replace(/^https?:\/\//, ''))

/** A mensagem pronta para o WhatsApp: o código e o link, numa frase do parceiro. */
const whatsappHref = computed(
  () =>
    `https://wa.me/?text=${encodeURIComponent(
      t('divulgacao.kit.mensagem', { codigo: codigoIndicacao.value, link: linkIndicacao.value }),
    )}`,
)

const metricas = ref<IndicacaoMetricas | null>(null)
const metricasLoading = ref(false)
const metricasErro = ref<MetricasEstadoErro | null>(null)

const cupons = ref<CupomParceiro[]>([])
const resgates = ref<ResgateParceiro[]>([])
const cuponsCursor = ref<string | null>(null)
const resgatesCursor = ref<string | null>(null)

const loading = ref(true)
const loadingCuponsMore = ref(false)
const loadingResgatesMore = ref(false)
const error = ref('')

const metrics = computed(() => {
  const totais = store.dashboard?.totais

  return [
    {
      id: 'cupons',
      label: t('divulgacao.metrics.cuponsAtivos'),
      value: totais?.cuponsAtivos ?? cupons.value.filter((c) => c.ativo).length,
      icon: 'ph ph-ticket',
    },
    {
      id: 'total',
      label: t('divulgacao.metrics.resgatesTotais'),
      value: totais?.resgatesTotal ?? resgates.value.length,
      icon: 'ph ph-check-circle',
    },
    {
      id: 'recentes',
      label: t('divulgacao.metrics.ultimos30d'),
      value: totais?.resgatesUltimos30d ?? 0,
      icon: 'ph ph-chart-line',
    },
  ]
})

async function copyToClipboard(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.add({
      severity: 'success',
      summary: t('divulgacao.toast.copied'),
      detail: t('divulgacao.toast.copiedDetail', { label }),
      life: 2500,
    })
  } catch {
    toast.add({
      severity: 'warn',
      summary: t('divulgacao.toast.copyFail'),
      detail: t('divulgacao.toast.copyFailDetail'),
      life: 3000,
    })
  }
}

/**
 * Métricas rodam fora do `loadAll`: 409 (cadastro não aprovado ou afiliado não
 * ativo) e 503 (QR fora) são estados do card, não erro da tela, e não podem
 * derrubar o painel. Sem `podeIndicar` nem chamamos — o 409 seria garantido.
 */
async function loadMetricas() {
  if (!indicacao.value?.podeIndicar) {
    metricas.value = null
    metricasErro.value = null
    return
  }

  metricasLoading.value = true
  metricasErro.value = null

  try {
    metricas.value = await getPortalIndicacaoMetricas(parceiroQuery())
  } catch (err) {
    metricas.value = null
    metricasErro.value = resolveMetricasErro(err)
  } finally {
    metricasLoading.value = false
  }
}

async function loadAll() {
  loading.value = true
  error.value = ''

  try {
    await ensureContext()
    const query = parceiroQuery()

    if (!CUPOM_FEATURE_ENABLED) {
      indicacao.value = await getPortalIndicacao(query)
      cupons.value = []
      cuponsCursor.value = null
      resgates.value = []
      resgatesCursor.value = null
      void loadMetricas()
      return
    }

    const [indicacaoData, cuponsPage, resgatesPage] = await Promise.all([
      getPortalIndicacao(query),
      getPortalCupons({ ...query, limit: 10 }),
      getPortalResgates({ ...query, limit: 10 }),
    ])

    indicacao.value = indicacaoData
    cupons.value = cuponsPage.data
    cuponsCursor.value = cuponsPage.meta.proximoCursor ?? null
    resgates.value = resgatesPage.data
    resgatesCursor.value = resgatesPage.meta.proximoCursor ?? null
    void loadMetricas()
  } catch (err) {
    /** 403 aqui pode ser o parceiro excluído no meio da sessão: a tela de saída assume. */
    if (await store.revalidarAcesso(err)) {
      return
    }

    error.value = err instanceof Error ? err.message : t('divulgacao.errorLoad')
  } finally {
    loading.value = false
  }
}

async function loadMoreCupons() {
  if (!cuponsCursor.value) {
    return
  }

  loadingCuponsMore.value = true

  try {
    const page = await getPortalCupons({
      ...parceiroQuery(),
      cursor: cuponsCursor.value,
      limit: 10,
    })
    cupons.value = [...cupons.value, ...page.data]
    cuponsCursor.value = page.meta.proximoCursor ?? null
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: t('divulgacao.toast.error'),
      detail: err instanceof Error ? err.message : t('divulgacao.toast.moreCuponsFail'),
      life: 4000,
    })
  } finally {
    loadingCuponsMore.value = false
  }
}

async function loadMoreResgates() {
  if (!resgatesCursor.value) {
    return
  }

  loadingResgatesMore.value = true

  try {
    const page = await getPortalResgates({
      ...parceiroQuery(),
      cursor: resgatesCursor.value,
      limit: 10,
    })
    resgates.value = [...resgates.value, ...page.data]
    resgatesCursor.value = page.meta.proximoCursor ?? null
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: t('divulgacao.toast.error'),
      detail: err instanceof Error ? err.message : t('divulgacao.toast.moreResgatesFail'),
      life: 4000,
    })
  } finally {
    loadingResgatesMore.value = false
  }
}

/** A categoria vem do enum (`PET_SHOP`): sem o sublinhado e só com a primeira maiúscula. */
function formatCategoria(value: string) {
  const texto = value.replaceAll('_', ' ').toLocaleLowerCase(INTL_LOCALE[locale.value as Locale])

  return texto.charAt(0).toLocaleUpperCase() + texto.slice(1)
}

function formatResgateDate(value: string) {
  return new Date(value).toLocaleString(INTL_LOCALE[locale.value as Locale], {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * O que a frase do topo da página precisa saber: o código, o link e as leituras do QR. A página
 * monta a frase; o painel é quem carrega os dados.
 */
const emit = defineEmits<{
  estado: [
    estado: {
      codigo: string
      link: string
      leituras: number | null
      podeIndicar: boolean
      carregando: boolean
    },
  ]
}>()

watch(
  () => ({
    codigo: codigoIndicacao.value,
    link: linkIndicacao.value,
    leituras: metricas.value?.scanCount ?? null,
    podeIndicar: Boolean(indicacao.value?.podeIndicar),
    carregando: loading.value,
  }),
  (estado) => emit('estado', estado),
  { immediate: true },
)

onMounted(() => {
  void loadAll()
})

watch(lastSuccessAt, (at) => {
  if (!at) {
    return
  }

  void loadAll()
  void store.bootstrap(true).catch(() => undefined)
})
</script>

<template>
  <div class="divulgacao">
    <div v-if="error" class="estado ui-folha" role="alert">
      <span class="ui-ladrilho ui-ladrilho--g ui-ladrilho--risco" aria-hidden="true">
        <i class="ph ph-warning-circle" />
      </span>
      <p>{{ error }}</p>
      <Button
        type="button"
        icon="ph ph-arrow-clockwise"
        :label="t('divulgacao.retry')"
        severity="secondary"
        outlined
        @click="loadAll"
      />
    </div>

    <!-- ------------------------------------------------------------ carregando -->
    <template v-else-if="loading">
      <div
        class="convite ui-folha ui-cartao"
        role="status"
        aria-live="polite"
        aria-busy="true"
        :aria-label="t('divulgacao.indicacao.loadingAria')"
      >
        <div class="ui-cartao__cabeca" aria-hidden="true">
          <Skeleton width="40px" height="40px" border-radius="12px" />
          <div class="ui-cartao__titulos">
            <Skeleton width="16rem" height="1.1rem" border-radius="6px" />
            <Skeleton width="min(100%, 30rem)" height="0.8rem" border-radius="6px" />
          </div>
        </div>
        <ul class="convite__jeitos" aria-hidden="true">
          <li v-for="n in 3" :key="n" class="jeito">
            <div class="jeito__cabeca">
              <Skeleton width="36px" height="36px" border-radius="11px" />
              <div class="jeito__titulos">
                <Skeleton width="8rem" height="0.9rem" border-radius="6px" />
                <Skeleton width="12rem" height="0.75rem" border-radius="6px" />
              </div>
            </div>
            <Skeleton width="min(100%, 26rem)" height="2.9rem" border-radius="14px" />
          </li>
        </ul>
      </div>

      <div
        v-if="cupomFeatureEnabled"
        class="listas"
        role="status"
        aria-live="polite"
        aria-busy="true"
        :aria-label="t('divulgacao.lists.loadingAria')"
      >
        <div v-for="n in 2" :key="n" class="ui-folha esqueleto" aria-hidden="true">
          <div v-for="m in 3" :key="m" class="esqueleto__linha">
            <span class="esqueleto__texto">
              <Skeleton width="9rem" height="0.9rem" border-radius="6px" />
              <Skeleton width="6rem" height="0.75rem" border-radius="6px" />
            </span>
            <Skeleton width="3.5rem" height="1.4rem" border-radius="7px" />
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="indicacao">
      <!-- ------------------------------------------------------------ o kit -->
      <section id="indicacao" class="indicacao" :aria-label="t('divulgacao.indicacao.title')">
        <p v-if="isGuidanceVisible" class="divulgacao__lede">
          {{ t('divulgacao.indicacao.lede') }}
        </p>

        <!--
          Sem afiliado ativo não há código: o que falta, como o código é liberado e o caminho dos
          programas. O `aviso` da API diz o que falta em cada estado (cadastro em análise,
          recusado, programa não pedido...) e vem no idioma da tela desde o PJ-4BI7TE; a frase
          fixa só entra quando ele não vem. Indicação nunca no botão cheio (03/11): as etapas não
          têm botão (o de pedir seria o cheio) e "Ver programas" vai embaixo, contornado.
        -->
        <UiVazioIlustrado
          v-if="!indicacao.podeIndicar"
          icone="ph ph-hourglass"
          :titulo="tituloDaEspera"
          :texto="indicacao.aviso || t('divulgacao.shareKit.esperaHint')"
          :guia-titulo="t('divulgacao.espera.guia.titulo')"
          :passos="passosDaEspera"
        >
          <template #acao>
            <Button
              :as="RouterLink"
              :to="PROGRAMAS_ROUTE"
              icon="ph ph-squares-four"
              :label="t('divulgacao.shareKit.esperaCta')"
              severity="secondary"
              outlined
            />
          </template>
        </UiVazioIlustrado>

        <!--
          O convite numa caixa só, como as outras da tela (17/11/2026): para que serve no título, e
          os três jeitos de convidar em linhas iguais, cada um com o verbo e a frase à esquerda e a
          coisa em si à direita: o código com o copiar, o link com copiar e WhatsApp, e o QR em
          miniatura com baixar e imprimir. Antes o QR ficava numa coluna ao lado, mais alta que os
          outros dois, e o código boiava num vão do tamanho dela.
        -->
        <section v-else class="convite ui-folha ui-cartao" aria-labelledby="kit-titulo">
          <header class="ui-cartao__cabeca">
            <span class="ui-ladrilho ui-ladrilho--lugar" aria-hidden="true">
              <i class="ph ph-user-plus" />
            </span>
            <div class="ui-cartao__titulos">
              <h2 id="kit-titulo" class="ui-cartao__titulo">{{ t('divulgacao.kit.titulo') }}</h2>
              <p class="ui-cartao__descricao">{{ t('divulgacao.kit.descricao') }}</p>
            </div>
          </header>

          <ul class="convite__jeitos">
            <li class="jeito">
              <div class="jeito__cabeca">
                <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-keyboard" /></span>
                <div class="jeito__titulos">
                  <h3 class="jeito__titulo">{{ t('divulgacao.kit.codigo') }}</h3>
                  <p class="jeito__dica">{{ t('divulgacao.kit.codigoDica') }}</p>
                </div>
              </div>

              <!--
                O código no campo, com o copiar dentro dele. O rótulo "Seu código de indicação"
                fica para o leitor de tela: o título ao lado já diz o que é.
              -->
              <div
                class="convite__campo convite__codigo"
                role="group"
                :aria-label="t('inicio.indique.seuCodigo')"
              >
                <strong class="convite__valor ui-num">
                  <bdi dir="ltr">{{ codigoIndicacao }}</bdi>
                </strong>
                <Button
                  type="button"
                  icon="ph ph-copy"
                  :label="t('divulgacao.kit.copiar')"
                  :aria-label="t('divulgacao.shareKit.copyCodeAria')"
                  severity="secondary"
                  outlined
                  size="small"
                  @click="copyToClipboard(codigoIndicacao, t('divulgacao.shareKit.codeLabel'))"
                />
              </div>
            </li>

            <li class="jeito">
              <div class="jeito__cabeca">
                <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-link" /></span>
                <div class="jeito__titulos">
                  <h3 class="jeito__titulo">{{ t('divulgacao.kit.link') }}</h3>
                  <p class="jeito__dica">{{ t('divulgacao.kit.linkDica') }}</p>
                </div>
              </div>

              <div class="convite__link">
                <bdi class="convite__campo convite__endereco" dir="ltr" :title="linkIndicacao">
                  {{ linkLegivel }}
                </bdi>
                <div class="convite__acoes">
                  <Button
                    type="button"
                    icon="ph ph-copy"
                    :label="t('divulgacao.shareKit.copyLink')"
                    @click="copyToClipboard(linkIndicacao, t('divulgacao.shareKit.linkName'))"
                  />
                  <Button
                    as="a"
                    :href="whatsappHref"
                    target="_blank"
                    rel="noopener noreferrer"
                    icon="ph ph-whatsapp-logo"
                    :label="t('divulgacao.kit.whatsapp')"
                    severity="secondary"
                    outlined
                  />
                </div>
              </div>
            </li>

            <li v-if="indicacao.qrImageUrl" class="jeito">
              <div class="jeito__cabeca">
                <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-printer" /></span>
                <div class="jeito__titulos">
                  <h3 class="jeito__titulo">{{ t('divulgacao.kit.qr') }}</h3>
                  <p class="jeito__dica">{{ t('divulgacao.kit.qrDica') }}</p>
                </div>
              </div>

              <IndicacaoQrBlock
                :image-url="indicacao.qrImageUrl"
                :code="codigoIndicacao"
                :disabled="!indicacao.podeIndicar"
                forma="linha"
              />
            </li>
          </ul>
        </section>
      </section>

      <!-- Leituras do QR: só faz sentido quando existe código para ler. -->
      <IndicacaoMetricasCard
        v-if="indicacao.podeIndicar"
        class="divulgacao__metricas"
        :metricas="metricas"
        :loading="metricasLoading"
        :erro="metricasErro"
        @retry="loadMetricas"
      />

      <!-- ------------------------------------------------------------ as regras -->
      <section
        id="div-terms"
        class="regras ui-folha ui-cartao"
        :class="{ 'regras--aberta': termsOpen }"
        aria-labelledby="div-terms-titulo"
      >
        <header class="ui-cartao__cabeca regras__cabeca">
          <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-percent" /></span>
          <div class="ui-cartao__titulos">
            <h2 id="div-terms-titulo" class="ui-cartao__titulo">
              {{ t('divulgacao.regras.titulo') }}
            </h2>
            <p class="ui-cartao__descricao regras__frase">{{ t('divulgacao.regras.frase') }}</p>
          </div>
          <div class="ui-cartao__acoes">
            <Button
              type="button"
              :label="
                termsOpen ? t('divulgacao.terms.toggleHide') : t('divulgacao.terms.toggleShow')
              "
              :icon="termsOpen ? 'ph ph-caret-up' : 'ph ph-caret-down'"
              icon-pos="right"
              severity="secondary"
              text
              size="small"
              :aria-expanded="termsOpen"
              aria-controls="div-terms-full"
              @click="termsOpen = !termsOpen"
            />
          </div>
        </header>

        <!-- v-show, não v-if: o alvo do `aria-controls` precisa existir sempre. -->
        <dl v-show="termsOpen" id="div-terms-full" class="regras__lista">
          <div v-for="term in indicacaoTerms" :key="term.id" class="regra ui-poco">
            <dt>
              <span class="ui-ladrilho ui-ladrilho--p" aria-hidden="true"
                ><i :class="term.icon"
              /></span>
              {{ term.title }}
            </dt>
            <dd>{{ term.body }}</dd>
          </div>
        </dl>
      </section>

      <!-- ------------------------------------------------------------ cupons e resgates -->
      <template v-if="cupomFeatureEnabled">
        <ul class="ui-indicadores numeros" :aria-label="t('divulgacao.metrics.aria')">
          <li v-for="metric in metrics" :key="metric.id" class="ui-indicador">
            <span class="ui-ladrilho" aria-hidden="true"><i :class="metric.icon" /></span>
            <strong class="ui-indicador__valor ui-num">{{ metric.value }}</strong>
            <span class="ui-indicador__rotulo">{{ metric.label }}</span>
          </li>
        </ul>

        <p v-if="isGuidanceVisible" class="divulgacao__lede">{{ t('divulgacao.lists.lede') }}</p>

        <div class="listas">
          <div id="cupons" class="listas__coluna">
            <section
              class="ui-folha ui-cartao lista-cartao"
              aria-labelledby="divulgacao-cupons-titulo"
            >
              <header class="ui-cartao__cabeca">
                <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-ticket" /></span>
                <div class="ui-cartao__titulos">
                  <h2 id="divulgacao-cupons-titulo" class="ui-cartao__titulo">
                    {{ t('divulgacao.cupons.title') }}
                    <span class="ui-contagem">{{ cupons.length }}</span>
                  </h2>
                  <p v-if="isGuidanceVisible" class="ui-cartao__descricao">
                    {{ t('divulgacao.cupons.lede') }}
                  </p>
                </div>
              </header>

              <UiVazioIlustrado
                v-if="cupons.length === 0"
                aninhado
                icone="ph ph-ticket"
                :titulo="t('divulgacao.cupons.empty')"
                :texto="t('divulgacao.cupons.vazioTexto')"
              />

              <ul v-else class="ui-lista">
                <li v-for="cupom in cupons" :key="cupom.id" class="ui-linha cupom">
                  <span class="ui-linha__texto">
                    <span class="ui-linha__titulo">{{ cupom.titulo }}</span>
                    <span class="ui-linha__meta">
                      <bdi class="ui-num" dir="ltr">{{ cupom.codigo }}</bdi>
                      · {{ formatCategoria(cupom.categoria) }}
                    </span>
                  </span>
                  <span class="ui-linha__fim">
                    <span class="cupom__usos ui-num">
                      {{
                        t('divulgacao.cupons.usos', { n: cupom.totalResgates }, cupom.totalResgates)
                      }}
                    </span>
                    <strong class="cupom__desconto ui-num">{{ cupom.descontoPercentual }}%</strong>
                    <span class="ui-selo" :class="{ 'ui-selo--ok': cupom.ativo }">
                      <i
                        class="ph"
                        :class="cupom.ativo ? 'ph-check-circle' : 'ph-pause-circle'"
                        aria-hidden="true"
                      />
                      {{
                        cupom.ativo
                          ? t('programas.card.status.ativo')
                          : t('programas.card.status.suspenso')
                      }}
                    </span>
                  </span>
                </li>
              </ul>
            </section>

            <Button
              v-if="cuponsCursor"
              class="listas__mais"
              type="button"
              :label="t('divulgacao.cupons.loadMore')"
              severity="secondary"
              outlined
              :loading="loadingCuponsMore"
              @click="loadMoreCupons"
            />
          </div>

          <div id="resgates" class="listas__coluna">
            <section
              class="ui-folha ui-cartao lista-cartao"
              aria-labelledby="divulgacao-resgates-titulo"
            >
              <header class="ui-cartao__cabeca">
                <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-receipt" /></span>
                <div class="ui-cartao__titulos">
                  <h2 id="divulgacao-resgates-titulo" class="ui-cartao__titulo">
                    {{ t('divulgacao.resgates.title') }}
                    <span class="ui-contagem">{{ resgates.length }}</span>
                  </h2>
                  <p v-if="isGuidanceVisible" class="ui-cartao__descricao">
                    {{ t('divulgacao.resgates.lede') }}
                  </p>
                </div>
              </header>

              <!-- O resgate nasce no balcão: o vazio leva ao "Validar cupom", contornado (Divulgação). -->
              <UiVazioIlustrado
                v-if="resgates.length === 0"
                aninhado
                icone="ph ph-receipt"
                :titulo="t('divulgacao.resgates.empty')"
                :texto="t('divulgacao.resgates.vazioTexto')"
              >
                <template v-if="podeValidarCupom" #acao>
                  <Button
                    type="button"
                    icon="ph ph-ticket"
                    :label="t('shell.cupom.cta')"
                    severity="secondary"
                    outlined
                    @click="abrirValidarCupom"
                  />
                </template>
              </UiVazioIlustrado>

              <ul v-else class="ui-lista">
                <li v-for="resgate in resgates" :key="resgate.resgateId" class="ui-linha">
                  <span class="ui-ladrilho ui-ladrilho--neutro" aria-hidden="true">
                    <i class="ph" :class="resgate.canal === 'QR' ? 'ph-qr-code' : 'ph-keyboard'" />
                  </span>
                  <span class="ui-linha__texto">
                    <bdi class="ui-linha__titulo ui-num" dir="ltr">{{ resgate.cupomCodigo }}</bdi>
                    <span class="ui-linha__meta">
                      {{
                        resgate.canal === 'QR'
                          ? t('divulgacao.resgates.canalQr')
                          : t('divulgacao.resgates.canalManual')
                      }}
                    </span>
                  </span>
                  <span class="ui-linha__fim resgate__fim">
                    <strong
                      v-if="resgate.descontoPercentualSnapshot != null"
                      class="cupom__desconto ui-num"
                    >
                      {{ resgate.descontoPercentualSnapshot }}%
                    </strong>
                    <time class="resgate__quando ui-num" :datetime="resgate.resgatadoEm">
                      {{ formatResgateDate(resgate.resgatadoEm) }}
                    </time>
                  </span>
                </li>
              </ul>
            </section>

            <Button
              v-if="resgatesCursor"
              class="listas__mais"
              type="button"
              :label="t('divulgacao.resgates.loadMore')"
              severity="secondary"
              outlined
              :loading="loadingResgatesMore"
              @click="loadMoreResgates"
            />
          </div>
        </div>
      </template>

      <!--
        Teaser de cupom removido da Divulgação (pedido de 2026-07-31): a feature não sai agora e
        o cartão prometia o que não existe. Para restaurar, volte o `useCupomComingSoon` no script
        e ponha aqui uma seção com `id="cupons"` (e `id="resgates"` dentro dela) que abra
        `openCupomComingSoon`. Enquanto estiver fora, `#cupons` e `#resgates` não existem com a
        flag de cupom desligada: os redirects legados de `?aba=` caem no topo da tela.
      -->
    </template>
  </div>
</template>

<style scoped>
.divulgacao {
  display: grid;
  min-width: 0;
  gap: 24px;
  container: divulgacao / inline-size;
}

.divulgacao__lede {
  max-width: 72ch;
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
  line-height: 1.5;
}

.indicacao {
  display: grid;
  gap: 12px;
}

/* ------------------------------------------------------------------ estados */

.estado {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 36px 24px;
  text-align: center;
}

.estado h2 {
  margin: 6px 0 0;
  color: var(--tinta);
  font-size: 17px;
  font-weight: 600;
}

.estado p {
  max-width: 52ch;
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
  line-height: 1.5;
}

/* ------------------------------------------------------------------ o convite
 * Uma caixa como as outras da tela, e os três jeitos de convidar em linhas iguais, de ponta a
 * ponta, com a régua entre elas: o verbo e a frase numa coluna, a coisa em si na outra. Quem
 * decide se as duas colunas cabem lado a lado é a largura da caixa, não a da janela.
 */

.convite {
  container: convite / inline-size;
}

.convite__jeitos {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.jeito {
  display: grid;
  min-width: 0;
  align-items: center;
  gap: 14px 32px;
  padding: 18px 0;
  grid-template-columns: minmax(0, 1fr);
}

.jeito:last-child {
  padding-bottom: 0;
}

.jeito + .jeito {
  border-top: 1px solid var(--app-regua, var(--linha-suave));
}

@container convite (min-width: 700px) {
  .jeito {
    grid-template-columns: minmax(15rem, 0.8fr) minmax(0, 1.5fr);
  }
}

.jeito__cabeca {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: 12px;
}

.jeito__titulos {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.jeito__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 650;
  letter-spacing: -0.01em;
  line-height: 1.35;
}

.jeito__dica {
  max-width: 46ch;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.5;
  text-wrap: pretty;
}

/*
 * O código e o link no mesmo campo: poço claro com fio. O código é o que a pessoa vai digitar,
 * então vem maior e espaçado, mas sem tinta de fundo nem cara de cupom, e na largura dele: esticado
 * na linha toda, sobrava um campo vazio ao lado das seis letras.
 */
.convite__campo {
  min-width: 0;
  border: 1px solid var(--linha-suave);
  border-radius: var(--raio-cartao-pequeno);
  background: var(--superficie-2);
  color: var(--tinta);
}

.convite__codigo {
  display: flex;
  width: min(100%, 24rem);
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  padding-block: 6px;
  padding-inline: 16px 6px;
}

.convite__valor {
  min-width: 0;
  overflow-wrap: anywhere;
  font-family: var(--font-dados);
  font-size: 22px;
  font-weight: 650;
  letter-spacing: 0.12em;
  line-height: 1.2;
}

/* O copiar dentro do poço é papel, para não afundar nele como um contorno solto. */
.convite__codigo :deep(.p-button) {
  flex: none;
  background: var(--superficie);
}

/* O link e os dois botões numa linha; quando não cabem, os botões descem juntos. */
.convite__link {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.convite__endereco {
  overflow: hidden;
  flex: 1 1 16rem;
  padding: 11px 16px;
  font-family: var(--font-dados);
  font-size: 15px;
  font-weight: 550;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.convite__acoes {
  display: flex;
  flex: 0 1 auto;
  flex-wrap: wrap;
  gap: 8px;
}

/* ------------------------------------------------------------------ regras */

.regras {
  overflow: clip;
}

.regras:not(.regras--aberta) .regras__cabeca {
  padding-bottom: 16px;
}

.regras__frase.ui-cartao__descricao {
  color: var(--tinta-2);
  font-size: 13.5px;
}

.regras__lista {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 18px 20px 20px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.regra.ui-poco {
  display: grid;
  align-content: start;
  gap: 6px;
  padding: 14px 16px;
}

.regra dt {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
}

.regra dd {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.5;
}

@media (max-width: 1100px) {
  .regras__lista {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .regras__lista {
    padding: 16px;
    grid-template-columns: minmax(0, 1fr);
  }

  /* No estreito o botão de abrir desce para baixo do título, alinhado com o texto. */
  .regras__cabeca {
    flex-wrap: wrap;
  }

  .regras__cabeca .ui-cartao__titulos {
    flex-basis: 0;
  }

  .regras__cabeca .ui-cartao__acoes {
    flex-basis: 100%;
    justify-content: flex-start;
    margin-top: -4px;
    padding-inline-start: 42px;
  }
}

/* ------------------------------------------------------------------ números e listas */

.numeros {
  margin: 0;
  padding: 0;
  list-style: none;
}

.lista-cartao {
  overflow: clip;
}

.lista-cartao .ui-lista > li:first-child > .ui-linha {
  border-radius: 0;
}

.listas {
  display: grid;
  align-items: start;
  gap: 24px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 360px), 1fr));
}

.listas__coluna {
  display: grid;
  min-width: 0;
  gap: 12px;
}

.listas__mais.p-button {
  justify-self: center;
}

.cupom__usos {
  color: var(--tinta-2);
  font-size: 13px;
}

.cupom__desconto {
  min-width: 3ch;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 650;
  text-align: end;
}

.resgate__quando {
  color: var(--tinta-2);
  font-size: 13px;
}

.esqueleto {
  display: grid;
}

.esqueleto__linha {
  display: flex;
  min-height: 60px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 18px;
}

.esqueleto__linha + .esqueleto__linha {
  border-top: 1px solid var(--linha);
}

.esqueleto__texto {
  display: grid;
  gap: 6px;
}

@media (max-width: 640px) {
  .cupom__usos {
    display: none;
  }
}
</style>
