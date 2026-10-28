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
const { lastSuccessAt } = useCupomResgateModal()
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

/**
 * O título da espera. Com o pedido já feito (ou o cadastro em análise), "Programa afiliado
 * necessário" mandava pedir de novo o que estava em análise.
 */
const tituloDaEspera = computed(() =>
  store.statusAuditoria === 'PENDENTE' || store.modoBloco('afiliado').status === 'SOLICITADO'
    ? t('carteira.gate.emAnaliseTitle')
    : t('carteira.gate.title'),
)

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
        class="kit ui-folha"
        role="status"
        aria-live="polite"
        aria-busy="true"
        :aria-label="t('divulgacao.indicacao.loadingAria')"
      >
        <div class="kit__cabeca" aria-hidden="true">
          <Skeleton width="44px" height="44px" border-radius="13px" />
          <div class="kit__titulos">
            <Skeleton width="16rem" height="1.1rem" border-radius="6px" />
            <Skeleton width="min(100%, 30rem)" height="0.8rem" border-radius="6px" />
          </div>
        </div>
        <div class="kit__principal" aria-hidden="true">
          <div v-for="n in 2" :key="n" class="kit__forma">
            <div class="kit__forma-cabeca">
              <Skeleton width="36px" height="36px" border-radius="11px" />
              <div class="kit__forma-titulos">
                <Skeleton width="8rem" height="0.9rem" border-radius="6px" />
                <Skeleton width="12rem" height="0.75rem" border-radius="6px" />
              </div>
            </div>
            <Skeleton width="100%" height="4.5rem" border-radius="14px" />
          </div>
        </div>
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

        <!-- Sem afiliado ativo não há código: a folha diz o que falta e leva aos programas. -->
        <div v-if="!indicacao.podeIndicar" class="estado ui-folha">
          <span class="ui-ladrilho ui-ladrilho--g ui-ladrilho--lugar" aria-hidden="true">
            <i class="ph ph-hourglass" />
          </span>
          <h2>{{ tituloDaEspera }}</h2>
          <!--
            O `aviso` da API não entra: vem só em português e sem acento ("esta em analise"), e
            diz o mesmo que a frase abaixo, que é traduzida.
          -->
          <p>{{ t('divulgacao.shareKit.esperaHint') }}</p>
          <RouterLink class="p-button p-component estado__acao" :to="PROGRAMAS_ROUTE">
            <i class="ph ph-squares-four" aria-hidden="true" />
            {{ t('divulgacao.shareKit.esperaCta') }}
          </RouterLink>
        </div>

        <!--
          O convite numa folha só. Em cima, para que serve: quem ainda não usa o app e cria a conta
          com o código fica ligado à empresa, e as assinaturas rendem participação. Embaixo, os
          três jeitos de convidar, cada um com um verbo e uma frase: passar o código (no bilhete,
          o maior da tela), mandar o link (copiar e WhatsApp) e imprimir o QR (ao lado).
        -->
        <div
          v-else
          class="kit ui-folha"
          :class="{ 'kit--com-qr': Boolean(indicacao.qrImageUrl) }"
          role="group"
          aria-labelledby="kit-titulo"
        >
          <header class="kit__cabeca">
            <span class="ui-ladrilho ui-ladrilho--g ui-ladrilho--lugar" aria-hidden="true">
              <i class="ph ph-user-plus" />
            </span>
            <div class="kit__titulos">
              <h2 id="kit-titulo" class="kit__titulo">{{ t('divulgacao.kit.titulo') }}</h2>
              <p class="kit__descricao">{{ t('divulgacao.kit.descricao') }}</p>
            </div>
          </header>

          <div class="kit__principal">
            <div class="kit__forma kit__forma--codigo">
              <div class="kit__forma-cabeca">
                <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-ticket" /></span>
                <div class="kit__forma-titulos">
                  <h3 class="kit__forma-titulo">{{ t('divulgacao.kit.codigo') }}</h3>
                  <p class="kit__forma-dica">{{ t('divulgacao.kit.codigoDica') }}</p>
                </div>
              </div>

              <!-- O bilhete: o código no miolo, o copiar no canhoto, um picote entre os dois. -->
              <div class="kit__bilhete-caixa">
                <div class="kit__bilhete">
                  <span class="kit__bilhete-miolo">
                    <span class="kit__bilhete-rotulo">{{ t('inicio.indique.seuCodigo') }}</span>
                    <strong class="kit__valor ui-num">
                      <bdi dir="ltr">{{ codigoIndicacao }}</bdi>
                    </strong>
                  </span>
                  <span class="kit__bilhete-canhoto">
                    <Button
                      type="button"
                      icon="ph ph-copy"
                      :label="t('divulgacao.kit.copiar')"
                      :aria-label="t('divulgacao.shareKit.copyCodeAria')"
                      severity="secondary"
                      outlined
                      @click="copyToClipboard(codigoIndicacao, t('divulgacao.shareKit.codeLabel'))"
                    />
                  </span>
                </div>
              </div>
            </div>

            <div class="kit__forma kit__forma--link">
              <div class="kit__forma-cabeca">
                <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-link" /></span>
                <div class="kit__forma-titulos">
                  <h3 class="kit__forma-titulo">{{ t('divulgacao.kit.link') }}</h3>
                  <p class="kit__forma-dica">{{ t('divulgacao.kit.linkDica') }}</p>
                </div>
              </div>

              <div class="kit__link">
                <bdi class="kit__endereco" dir="ltr" :title="linkIndicacao">{{ linkLegivel }}</bdi>
                <div class="kit__link-acoes">
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
            </div>
          </div>

          <div v-if="indicacao.qrImageUrl" class="kit__lado">
            <IndicacaoQrBlock
              class="kit__qr"
              :image-url="indicacao.qrImageUrl"
              :code="codigoIndicacao"
              :disabled="!indicacao.podeIndicar"
              size="md"
            />
          </div>
        </div>
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
            <h2 id="div-terms-titulo" class="ui-cartao__titulo">{{ t('divulgacao.regras.titulo') }}</h2>
            <p class="ui-cartao__descricao regras__frase">{{ t('divulgacao.regras.frase') }}</p>
          </div>
          <div class="ui-cartao__acoes">
            <Button
              type="button"
              :label="termsOpen ? t('divulgacao.terms.toggleHide') : t('divulgacao.terms.toggleShow')"
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
              <span class="ui-ladrilho ui-ladrilho--p" aria-hidden="true"><i :class="term.icon" /></span>
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

              <p v-if="cupons.length === 0" class="ui-vazio">{{ t('divulgacao.cupons.empty') }}</p>

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
                      {{ t('divulgacao.cupons.usos', { n: cupom.totalResgates }, cupom.totalResgates) }}
                    </span>
                    <strong class="cupom__desconto ui-num">{{ cupom.descontoPercentual }}%</strong>
                    <span class="ui-selo" :class="{ 'ui-selo--ok': cupom.ativo }">
                      <i
                        class="ph"
                        :class="cupom.ativo ? 'ph-check-circle' : 'ph-pause-circle'"
                        aria-hidden="true"
                      />
                      {{ cupom.ativo ? t('programas.card.status.ativo') : t('programas.card.status.suspenso') }}
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

              <p v-if="resgates.length === 0" class="ui-vazio">
                {{ t('divulgacao.resgates.empty') }}
              </p>

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

.estado__acao {
  gap: 8px;
  margin-top: 10px;
  text-decoration: none;
}

/* ------------------------------------------------------------------ o kit
 * Uma folha em três partes: a cabeça (para que serve o convite, com a luz do Portal rente ao
 * topo), os jeitos de convidar (código e link, cada um com verbo, frase e a coisa em si) e, ao
 * lado, o QR num poço. Quem decide a forma é a largura do painel e a da coluna principal, não a
 * da janela.
 */

.kit {
  display: grid;
  overflow: hidden;
  grid-template-areas:
    'cabeca'
    'principal'
    'lado';
  grid-template-columns: minmax(0, 1fr);
}

@container divulgacao (min-width: 860px) {
  .kit--com-qr {
    grid-template-areas:
      'cabeca cabeca'
      'principal lado';
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .kit--com-qr .kit__lado {
    border-top: 0;
    border-inline-start: 1px solid var(--linha-suave);
  }
}

.kit__cabeca {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 26px 28px 24px;
  border-bottom: 1px solid var(--linha-suave);
  background: linear-gradient(
    180deg,
    color-mix(in oklab, var(--pj-lugar-fundo) 60%, var(--superficie)),
    var(--superficie)
  );
  grid-area: cabeca;
}

.kit__titulos {
  display: grid;
  min-width: 0;
  gap: 6px;
  padding-top: 1px;
}

.kit__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 18px;
  font-weight: 650;
  letter-spacing: -0.015em;
  line-height: 1.3;
}

.kit__descricao {
  max-width: 68ch;
  margin: 0;
  color: var(--tinta-2);
  font-size: 14.5px;
  line-height: 1.55;
  text-wrap: pretty;
}

/* Quando o QR ao lado é mais alto, o vão se reparte entre os jeitos, em vez de sobrar embaixo. */
.kit__principal {
  display: grid;
  min-width: 0;
  align-content: stretch;
  container: kit-principal / inline-size;
  grid-area: principal;
}

/* Cada jeito de convidar: o verbo e a frase de um lado, a coisa do outro (empilha no estreito). */
.kit__forma {
  display: grid;
  min-width: 0;
  gap: 16px;
  padding: 24px 28px;
}

.kit__forma + .kit__forma {
  border-top: 1px solid var(--linha-suave);
}

@container kit-principal (min-width: 620px) {
  .kit__forma {
    align-items: center;
    column-gap: 32px;
    grid-template-columns: minmax(0, 0.75fr) minmax(0, 1.25fr);
  }
}

.kit__forma-cabeca {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: 12px;
}

.kit__forma-titulos {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.kit__forma-titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 650;
  letter-spacing: -0.01em;
  line-height: 1.35;
}

.kit__forma-dica {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.5;
  text-wrap: pretty;
}

/* Quem decide se o canhoto fica ao lado ou embaixo é a largura do próprio bilhete. */
.kit__bilhete-caixa {
  min-width: 0;
  container: bilhete / inline-size;
}

/*
 * O bilhete: papel tingido na cor do Portal, o código no miolo e o copiar no canhoto, com um
 * picote tracejado entre os dois e os dois furos do picote (meios-círculos na cor da folha).
 */
.kit__bilhete {
  --furo: 9px;

  display: flex;
  min-width: 0;
  align-items: stretch;
  border-radius: var(--raio-cartao-pequeno);
  background: color-mix(in oklab, var(--pj-lugar-fundo) 75%, var(--superficie));
}

.kit__bilhete-miolo {
  display: grid;
  min-width: 0;
  flex: 1 1 auto;
  align-content: center;
  gap: 4px;
  padding: 14px 22px 16px;
}

.kit__bilhete-rotulo {
  color: var(--pj-lugar-tinta);
  font-size: 12.5px;
  font-weight: 600;
}

.kit__valor {
  overflow-wrap: anywhere;
  color: var(--tinta);
  font-size: 38px;
  font-weight: 650;
  letter-spacing: 0.01em;
  line-height: 1.05;
}

.kit__bilhete-canhoto {
  position: relative;
  display: grid;
  flex: none;
  place-items: center;
  padding: 12px 18px;
  border-inline-start: 2px dashed color-mix(in oklab, var(--pj-lugar) 38%, transparent);
}

.kit__bilhete-canhoto::before,
.kit__bilhete-canhoto::after {
  position: absolute;
  width: calc(var(--furo) * 2);
  height: calc(var(--furo) * 2);
  border-radius: 50%;
  background: var(--superficie);
  content: '';
  inset-inline-start: calc(var(--furo) * -1 - 1px);
}

.kit__bilhete-canhoto::before {
  top: calc(var(--furo) * -1);
}

.kit__bilhete-canhoto::after {
  bottom: calc(var(--furo) * -1);
}

/* Estreito: o canhoto desce para baixo do código, e o picote e os furos vão junto. */
@container bilhete (max-width: 400px) {
  .kit__bilhete {
    flex-direction: column;
  }

  .kit__bilhete-miolo {
    padding: 14px 18px 16px;
  }

  .kit__valor {
    font-size: 32px;
  }

  .kit__bilhete-canhoto {
    place-items: stretch;
    padding: 12px 14px 14px;
    border-top: 2px dashed color-mix(in oklab, var(--pj-lugar) 38%, transparent);
    border-inline-start: 0;
  }

  .kit__bilhete-canhoto::before,
  .kit__bilhete-canhoto::after {
    top: calc(var(--furo) * -1 - 1px);
    bottom: auto;
  }

  .kit__bilhete-canhoto::before {
    inset-inline-start: calc(var(--furo) * -1);
  }

  .kit__bilhete-canhoto::after {
    inset-inline: auto calc(var(--furo) * -1);
  }

  .kit__bilhete-canhoto :deep(.p-button) {
    justify-content: center;
  }
}

.kit__link {
  display: grid;
  min-width: 0;
  gap: 12px;
}

.kit__endereco {
  overflow: hidden;
  padding: 13px 16px;
  border: 1px solid var(--linha-suave);
  border-radius: var(--raio-cartao-pequeno);
  background: var(--superficie-2);
  color: var(--tinta);
  font-family: var(--font-dados);
  font-size: 15.5px;
  font-weight: 550;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kit__link-acoes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* Os dois botões ocupam a largura do endereço logo acima, e quebram juntos quando não cabem. */
.kit__link-acoes :deep(.p-button) {
  flex: 1 1 auto;
  justify-content: center;
}

/* O QR num painel ao lado, em poço: a folha tem partes, não cartões dentro de cartão. */
.kit__lado {
  display: grid;
  place-items: center;
  padding: 24px 28px 26px;
  border-top: 1px solid var(--linha-suave);
  background: color-mix(in oklab, var(--superficie-2) 70%, transparent);
  grid-area: lado;
}

@media (max-width: 760px) {
  .kit__cabeca {
    gap: 14px;
    padding: 22px 18px 20px;
  }

  .kit__forma {
    padding: 20px 18px 22px;
  }

  .kit__lado {
    padding: 22px 18px 24px;
  }
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
