<script setup lang="ts">
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import IndicacaoMetricasCard from '@/components/parceiro/IndicacaoMetricasCard.vue'
import IndicacaoQrBlock from '@/components/parceiro/IndicacaoQrBlock.vue'
import PartnerFocusCard from '@/components/parceiro/PartnerFocusCard.vue'
import PartnerStatusBadge from '@/components/parceiro/PartnerStatusBadge.vue'
// Volta junto com o teaser de cupom comentado no template.
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
import { LightColors } from '@/theme/colors'
import { currentColors } from '@/theme/color-mode'

/** Mesmo destino do gate da Carteira (`goToProgramas`): a âncora abre a lista. */
const PROGRAMAS_ROUTE = { path: '/parceiro/programas', hash: '#programas' } as const

const { t, locale } = useI18n()
const toast = useToast()
const { store, ensureContext, parceiroQuery } = useParceiroPortal()
const { lastSuccessAt } = useCupomResgateModal()
// const { open: openCupomComingSoon } = useCupomComingSoon()
const cupomFeatureEnabled = CUPOM_FEATURE_ENABLED

const indicacaoSteps = computed(() => [
  {
    icon: 'pi pi-share-alt',
    title: t('divulgacao.howItWorks.steps.share.title'),
    body: t('divulgacao.howItWorks.steps.share.body'),
  },
  {
    icon: 'pi pi-user-plus',
    title: t('divulgacao.howItWorks.steps.signup.title'),
    body: t('divulgacao.howItWorks.steps.signup.body'),
  },
  {
    icon: 'pi pi-link',
    title: t('divulgacao.howItWorks.steps.link.title'),
    body: t('divulgacao.howItWorks.steps.link.body'),
  },
  {
    icon: 'pi pi-wallet',
    title: t('divulgacao.howItWorks.steps.earn.title'),
    body: t('divulgacao.howItWorks.steps.earn.body'),
  },
])

/**
 * Termos concretos da participação, do jeito que o backend calcula
 * (`comissao.config.ts`): 5% do plano, a cada renovação paga, janela de 18 meses
 * desde a primeira assinatura paga do indicado, hold de 14 dias e saque mínimo
 * de R$ 50.
 *
 * Divulgação em dois níveis: os três números que definem o ganho ficam sempre à
 * vista; o detalhe completo (incluindo hold, saque e a condição de ativação) abre
 * sob demanda. Abrir tudo de uma vez virava parede de texto no meio da tela.
 */
const TERM_IDS = ['percent', 'recurring', 'window', 'hold', 'payout', 'requirement'] as const

const termsOpen = ref(false)

const indicacaoHighlights = computed(() =>
  (['percent', 'recurring', 'window'] as const).map((id) => ({
    id,
    value: t(`divulgacao.terms.highlights.${id}.value`),
    caption: t(`divulgacao.terms.highlights.${id}.caption`),
  })),
)

const indicacaoTerms = computed(() =>
  TERM_IDS.map((id) => ({
    id,
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

const panelStyle = computed(() => {
  const colors = currentColors.value

  return {
    '--div-card': colors.dashboard.surface,
    '--div-surface': colors.dashboard.surfaceSoft,
    '--div-line': colors.dashboard.line,
    '--div-line-soft': colors.dashboard.lineSoft,
    '--div-text': colors.dashboard.text,
    '--div-muted': colors.dashboard.muted,
    '--div-faint': colors.dashboard.faint,
    '--div-primary': colors.vet.primary,
    '--div-primary-soft': colors.vet.secondary,
    '--div-primary-strong': colors.dashboard.primaryStrong,
    '--div-success-bg': colors.dashboard.successBg,
    '--div-success-text': colors.dashboard.successText,
    '--div-amber-bg': colors.dashboard.amberBg,
    '--div-amber-text': colors.dashboard.amberText,
    '--div-warm-bg': colors.dashboard.warmBg,
    '--div-warm-text': colors.dashboard.warmText,
    '--div-shadow-rgb': colors.auth.shadowRgb,
    '--div-on-primary': LightColors.text.inverse,
  }
})

const metrics = computed(() => {
  const totais = store.dashboard?.totais

  return [
    {
      id: 'cupons',
      label: t('divulgacao.metrics.cuponsAtivos'),
      value: totais?.cuponsAtivos ?? cupons.value.filter((c) => c.ativo).length,
      icon: 'pi pi-ticket',
      tone: 'primary' as const,
    },
    {
      id: 'total',
      label: t('divulgacao.metrics.resgatesTotais'),
      value: totais?.resgatesTotal ?? resgates.value.length,
      icon: 'pi pi-check-circle',
      tone: 'success' as const,
    },
    {
      id: 'recentes',
      label: t('divulgacao.metrics.ultimos30d'),
      value: totais?.resgatesUltimos30d ?? 0,
      icon: 'pi pi-chart-line',
      tone: 'primary' as const,
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

function formatCategoria(value: string) {
  return value.replaceAll('_', ' ')
}

function formatResgateDate(value: string) {
  return new Date(value).toLocaleString(INTL_LOCALE[locale.value as Locale], {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

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
  <div class="divulgacao" :style="panelStyle">
    <div v-if="error" class="divulgacao__error" role="alert">
      <i class="pi pi-exclamation-circle" aria-hidden="true" />
      <p>{{ error }}</p>
      <Button :label="t('divulgacao.retry')" severity="secondary" size="small" @click="loadAll" />
    </div>

    <template v-else-if="loading">
      <section class="div-zone" aria-labelledby="div-indicacao-title">
        <header class="div-zone__head">
          <h2 id="div-indicacao-title">{{ t('divulgacao.indicacao.title') }}</h2>
          <p v-if="isGuidanceVisible">{{ t('divulgacao.indicacao.lede') }}</p>
        </header>

        <div
          class="divulgacao__board"
          :class="{
            'divulgacao__board--with-metrics': cupomFeatureEnabled,
            'divulgacao__board--with-soon': !cupomFeatureEnabled,
          }"
          role="status"
          aria-live="polite"
          aria-busy="true"
          :aria-label="t('divulgacao.indicacao.loadingAria')"
        >
          <PartnerFocusCard
            class="share-kit share-kit--compact share-kit--skeleton"
            aria-hidden="true"
          >
            <header class="share-kit__head">
              <div class="share-kit__head-copy">
                <Skeleton width="7.5rem" height="0.7rem" border-radius="4px" />
                <Skeleton width="15rem" height="1.15rem" border-radius="6px" />
              </div>
            </header>

            <div class="share-kit__stage">
              <div class="share-kit__main">
                <div class="share-kit__code-block">
                  <span class="share-kit__label">
                    <Skeleton width="3.5rem" height="0.65rem" border-radius="4px" />
                  </span>
                  <div class="share-kit__code-row">
                    <Skeleton width="9.5rem" height="2.75rem" border-radius="0.85rem" />
                    <Skeleton width="2.75rem" height="2.75rem" border-radius="0.85rem" />
                  </div>
                </div>

                <div class="share-kit__link">
                  <span class="share-kit__label">
                    <Skeleton width="5rem" height="0.65rem" border-radius="4px" />
                  </span>
                  <div class="share-kit__link-field">
                    <div class="share-kit__link-skel">
                      <Skeleton width="100%" height="0.85rem" border-radius="4px" />
                      <Skeleton width="72%" height="0.85rem" border-radius="4px" />
                    </div>
                    <Skeleton width="7.25rem" height="2.45rem" border-radius="0.75rem" />
                  </div>
                </div>
              </div>
            </div>

            <div class="share-kit__hint share-kit__hint--skeleton">
              <Skeleton width="100%" height="0.8rem" border-radius="4px" />
              <Skeleton width="68%" height="0.8rem" border-radius="4px" />
            </div>
          </PartnerFocusCard>

          <aside v-if="cupomFeatureEnabled" class="metrics-strip" aria-hidden="true">
            <article
              v-for="metric in metrics"
              :key="`skel-${metric.id}`"
              class="metrics-strip__item metrics-strip__item--skeleton"
              :data-tone="metric.tone"
            >
              <Skeleton width="2.35rem" height="2.35rem" border-radius="0.75rem" />
              <div class="metrics-strip__skel-text">
                <Skeleton width="2.5rem" height="1.15rem" border-radius="4px" />
                <Skeleton width="5.5rem" height="0.7rem" border-radius="4px" />
              </div>
            </article>
          </aside>
        </div>
      </section>

      <section v-if="cupomFeatureEnabled" class="div-zone" aria-labelledby="div-movimentacao-title">
        <header class="div-zone__head">
          <h2 id="div-movimentacao-title">{{ t('divulgacao.lists.title') }}</h2>
          <p v-if="isGuidanceVisible">{{ t('divulgacao.lists.lede') }}</p>
        </header>

        <div
          class="divulgacao__lists"
          role="status"
          aria-live="polite"
          aria-busy="true"
          :aria-label="t('divulgacao.lists.loadingAria')"
        >
          <section class="list-panel list-panel--skeleton" aria-hidden="true">
            <header class="list-panel__head">
              <div>
                <Skeleton width="4.5rem" height="1rem" border-radius="4px" />
                <Skeleton
                  class="list-panel__subskel"
                  width="12rem"
                  height="0.75rem"
                  border-radius="4px"
                />
              </div>
              <Skeleton width="1.75rem" height="1.75rem" border-radius="999px" />
            </header>
            <ul class="list-panel__items">
              <li v-for="index in 3" :key="`cupom-skel-${index}`" class="cupom-row">
                <div class="cupom-row__main">
                  <Skeleton width="9rem" height="0.95rem" border-radius="4px" />
                  <Skeleton width="7rem" height="0.75rem" border-radius="4px" />
                </div>
                <div class="cupom-row__meta">
                  <Skeleton width="2.5rem" height="1.1rem" border-radius="4px" />
                  <Skeleton width="3.5rem" height="0.75rem" border-radius="4px" />
                  <Skeleton width="4rem" height="1.35rem" border-radius="999px" />
                </div>
              </li>
            </ul>
          </section>

          <section class="list-panel list-panel--skeleton" aria-hidden="true">
            <header class="list-panel__head">
              <div>
                <Skeleton width="5rem" height="1rem" border-radius="4px" />
                <Skeleton
                  class="list-panel__subskel"
                  width="10rem"
                  height="0.75rem"
                  border-radius="4px"
                />
              </div>
              <Skeleton width="1.75rem" height="1.75rem" border-radius="999px" />
            </header>
            <ul class="list-panel__items">
              <li v-for="index in 3" :key="`resgate-skel-${index}`" class="resgate-row">
                <div class="resgate-row__main">
                  <Skeleton width="6rem" height="0.95rem" border-radius="4px" />
                  <Skeleton width="5.5rem" height="0.75rem" border-radius="4px" />
                </div>
                <div class="resgate-row__meta">
                  <Skeleton width="2.25rem" height="0.75rem" border-radius="4px" />
                  <Skeleton width="5rem" height="0.75rem" border-radius="4px" />
                </div>
              </li>
            </ul>
          </section>
        </div>
      </section>
    </template>

    <template v-else-if="indicacao">
      <section id="indicacao" class="div-zone" aria-labelledby="div-indicacao-title">
        <header class="div-zone__head">
          <h2 id="div-indicacao-title">{{ t('divulgacao.indicacao.title') }}</h2>
          <p v-if="isGuidanceVisible">{{ t('divulgacao.indicacao.lede') }}</p>
        </header>

        <div
          class="divulgacao__board"
          :class="{
            'divulgacao__board--with-metrics': cupomFeatureEnabled,
            'divulgacao__board--with-soon': !cupomFeatureEnabled,
          }"
        >
          <PartnerFocusCard class="share-kit share-kit--compact" :muted="!indicacao.podeIndicar">
            <header class="share-kit__head">
              <div>
                <p class="share-kit__eyebrow">{{ t('divulgacao.shareKit.eyebrow') }}</p>
                <h3>{{ t('divulgacao.shareKit.title') }}</h3>
              </div>
              <span v-if="!indicacao.podeIndicar" class="share-kit__pill">{{
                t('divulgacao.shareKit.unavailable')
              }}</span>
            </header>

            <!-- Gate do kit: sem cadastro aprovado (2026-07-29) OU sem Programa de
                 Afiliados ativo (2026-08-19) não existe código, link nem QR — a API
                 devolve tudo null. Estado de espera com o `aviso` do backend, que
                 já é específico por status; nada de copy própria aqui. A saída é
                 sempre Programas: é de lá que sai tanto o reenvio do cadastro
                 quanto a solicitação do programa. -->
            <div v-if="!indicacao.podeIndicar" class="share-kit__espera">
              <span class="share-kit__espera-icon" aria-hidden="true">
                <i class="pi pi-hourglass" />
              </span>
              <p v-if="indicacao.aviso" class="share-kit__espera-aviso">{{ indicacao.aviso }}</p>
              <p class="share-kit__espera-hint">{{ t('divulgacao.shareKit.esperaHint') }}</p>
              <RouterLink class="share-kit__espera-cta" :to="PROGRAMAS_ROUTE">
                {{ t('divulgacao.shareKit.esperaCta') }}
                <i class="pi pi-arrow-right" aria-hidden="true" />
              </RouterLink>
            </div>

            <div
              v-else
              class="share-kit__stage"
              :class="{ 'share-kit__stage--with-qr': Boolean(indicacao.qrImageUrl) }"
            >
              <div class="share-kit__main">
                <div class="share-kit__code-block">
                  <span class="share-kit__label">{{ t('divulgacao.shareKit.codeLabel') }}</span>
                  <div class="share-kit__code-row">
                    <strong class="share-kit__code">{{ codigoIndicacao }}</strong>
                    <Button
                      type="button"
                      class="share-kit__icon-btn"
                      icon="pi pi-copy"
                      :aria-label="t('divulgacao.shareKit.copyCodeAria')"
                      :title="t('divulgacao.shareKit.copyCodeAria')"
                      :disabled="!indicacao.podeIndicar"
                      @click="copyToClipboard(codigoIndicacao, t('divulgacao.shareKit.codeLabel'))"
                    />
                  </div>
                </div>

                <div class="share-kit__link">
                  <span class="share-kit__label">{{ t('divulgacao.shareKit.linkLabel') }}</span>
                  <div class="share-kit__link-field">
                    <code>{{ linkIndicacao }}</code>
                    <Button
                      type="button"
                      class="share-kit__copy-cta"
                      icon="pi pi-link"
                      :label="t('divulgacao.shareKit.copyLink')"
                      :disabled="!indicacao.podeIndicar"
                      @click="copyToClipboard(linkIndicacao, t('divulgacao.shareKit.linkName'))"
                    />
                  </div>
                </div>

                <p class="share-kit__hint">
                  {{ t('divulgacao.shareKit.hint') }}
                </p>
              </div>

              <IndicacaoQrBlock
                v-if="indicacao.qrImageUrl"
                class="share-kit__qr"
                :image-url="indicacao.qrImageUrl"
                :code="codigoIndicacao"
                :disabled="!indicacao.podeIndicar"
                size="md"
              />
            </div>
          </PartnerFocusCard>

          <!-- Leituras do QR: só faz sentido quando existe QR para ler. -->
          <IndicacaoMetricasCard
            v-if="indicacao.podeIndicar"
            class="divulgacao__metricas"
            :metricas="metricas"
            :loading="metricasLoading"
            :erro="metricasErro"
            @retry="loadMetricas"
          />

          <aside
            v-if="cupomFeatureEnabled"
            class="metrics-strip"
            :aria-label="t('divulgacao.metrics.aria')"
          >
            <article
              v-for="metric in metrics"
              :key="metric.id"
              class="metrics-strip__item"
              :data-tone="metric.tone"
            >
              <span class="metrics-strip__icon" aria-hidden="true">
                <i :class="metric.icon" />
              </span>
              <div>
                <strong>{{ metric.value }}</strong>
                <small>{{ metric.label }}</small>
              </div>
            </article>
          </aside>

          <!--
            Teaser de cupom removido da Divulgação (pedido de 2026-07-31): a
            feature não sai agora e o card prometia o que não existe.

            Para restaurar, descomente este bloco E o `useCupomComingSoon` no
            script; o CSS (`.cupom-soon*`) foi mantido de propósito.
            Enquanto estiver fora, `#cupons` e `#resgates` não existem com a flag
            de cupom desligada: os redirects legados de `?aba=` caem no topo da
            tela em vez de rolar para a seção.

          <aside v-else id="cupons" class="cupom-soon" aria-labelledby="div-cupom-soon-title">
            <div id="resgates" class="cupom-soon__anchor">
              <span class="cupom-soon__badge">{{ t('comingSoon.cupom.badge') }}</span>
              <span class="cupom-soon__icon" aria-hidden="true">
                <i class="pi pi-ticket" />
              </span>
              <h2 id="div-cupom-soon-title">{{ t('comingSoon.cupom.title') }}</h2>
              <p class="cupom-soon__lede">{{ t('comingSoon.cupom.lede') }}</p>
              <Button
                type="button"
                :label="t('comingSoon.cupom.sectionCta')"
                @click="openCupomComingSoon"
              />
            </div>
          </aside>
          -->
        </div>
      </section>

      <section id="como-funciona" class="div-zone" aria-labelledby="div-how-title">
        <article class="indicacao-pitch">
          <header class="indicacao-pitch__hero">
            <p class="indicacao-pitch__eyebrow">{{ t('divulgacao.howItWorks.eyebrow') }}</p>
            <h2 id="div-how-title">{{ t('divulgacao.howItWorks.title') }}</h2>
            <p class="indicacao-pitch__lede">{{ t('divulgacao.howItWorks.lede') }}</p>
          </header>

          <ol class="indicacao-pitch__steps">
            <li
              v-for="(step, index) in indicacaoSteps"
              :key="step.title"
              class="indicacao-pitch__step"
            >
              <span class="indicacao-pitch__index" aria-hidden="true">{{
                String(index + 1).padStart(2, '0')
              }}</span>
              <span class="indicacao-pitch__icon" aria-hidden="true">
                <i :class="step.icon" />
              </span>
              <div>
                <h3>{{ step.title }}</h3>
                <p>{{ step.body }}</p>
              </div>
            </li>
          </ol>

          <section class="indicacao-terms" aria-labelledby="div-terms-title">
            <header class="indicacao-terms__head">
              <h3 id="div-terms-title">{{ t('divulgacao.terms.title') }}</h3>
              <p>{{ t('divulgacao.terms.lede') }}</p>
            </header>

            <ul class="indicacao-terms__highlights">
              <li v-for="item in indicacaoHighlights" :key="item.id">
                <strong>{{ item.value }}</strong>
                <span>{{ item.caption }}</span>
              </li>
            </ul>

            <Button
              type="button"
              class="indicacao-terms__toggle"
              :label="
                termsOpen ? t('divulgacao.terms.toggleHide') : t('divulgacao.terms.toggleShow')
              "
              :icon="termsOpen ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
              icon-pos="right"
              text
              size="small"
              :aria-expanded="termsOpen"
              aria-controls="div-terms-full"
              @click="termsOpen = !termsOpen"
            />

            <!-- v-show, não v-if: o alvo do `aria-controls` precisa existir sempre. -->
            <dl v-show="termsOpen" id="div-terms-full" class="indicacao-terms__grid">
              <div v-for="term in indicacaoTerms" :key="term.id" class="indicacao-terms__item">
                <dt>{{ term.title }}</dt>
                <dd>{{ term.body }}</dd>
              </div>
            </dl>
          </section>

          <div class="indicacao-pitch__close">
            <p class="indicacao-pitch__promise">{{ t('divulgacao.howItWorks.promise') }}</p>
            <p class="indicacao-pitch__note">{{ t('divulgacao.howItWorks.note') }}</p>
          </div>
        </article>
      </section>

      <section v-if="cupomFeatureEnabled" class="div-zone" aria-labelledby="div-movimentacao-title">
        <header class="div-zone__head">
          <h2 id="div-movimentacao-title">{{ t('divulgacao.lists.title') }}</h2>
          <p v-if="isGuidanceVisible">{{ t('divulgacao.lists.lede') }}</p>
        </header>

        <div class="divulgacao__lists">
          <section id="cupons" class="list-panel" aria-labelledby="divulgacao-cupons-title">
            <header class="list-panel__head">
              <div>
                <h3 id="divulgacao-cupons-title">{{ t('divulgacao.cupons.title') }}</h3>
                <p v-if="isGuidanceVisible">{{ t('divulgacao.cupons.lede') }}</p>
              </div>
              <span class="list-panel__count">{{ cupons.length }}</span>
            </header>

            <div v-if="cupons.length === 0" class="list-panel__empty">
              <i class="pi pi-ticket" aria-hidden="true" />
              <span>{{ t('divulgacao.cupons.empty') }}</span>
            </div>

            <ul v-else class="list-panel__items">
              <li v-for="cupom in cupons" :key="cupom.id" class="cupom-row">
                <div class="cupom-row__main">
                  <strong>{{ cupom.titulo }}</strong>
                  <span>{{ cupom.codigo }} · {{ formatCategoria(cupom.categoria) }}</span>
                </div>
                <div class="cupom-row__meta">
                  <span class="cupom-row__discount">{{ cupom.descontoPercentual }}%</span>
                  <span>{{ t('divulgacao.cupons.usos', { n: cupom.totalResgates }, cupom.totalResgates) }}</span>
                  <PartnerStatusBadge :status="cupom.ativo ? 'ATIVO' : 'SUSPENSO'" />
                </div>
              </li>
            </ul>

            <Button
              v-if="cuponsCursor"
              class="list-panel__more"
              :label="t('divulgacao.cupons.loadMore')"
              size="small"
              severity="secondary"
              :loading="loadingCuponsMore"
              @click="loadMoreCupons"
            />
          </section>

          <section id="resgates" class="list-panel" aria-labelledby="divulgacao-resgates-title">
            <header class="list-panel__head">
              <div>
                <h3 id="divulgacao-resgates-title">{{ t('divulgacao.resgates.title') }}</h3>
                <p v-if="isGuidanceVisible">{{ t('divulgacao.resgates.lede') }}</p>
              </div>
              <span class="list-panel__count">{{ resgates.length }}</span>
            </header>

            <div v-if="resgates.length === 0" class="list-panel__empty">
              <i class="pi pi-chart-line" aria-hidden="true" />
              <span>{{ t('divulgacao.resgates.empty') }}</span>
            </div>

            <ul v-else class="list-panel__items">
              <li v-for="resgate in resgates" :key="resgate.resgateId" class="resgate-row">
                <div class="resgate-row__main">
                  <strong>{{ resgate.cupomCodigo }}</strong>
                  <span>{{
                    resgate.canal === 'QR'
                      ? t('divulgacao.resgates.canalQr')
                      : t('divulgacao.resgates.canalManual')
                  }}</span>
                </div>
                <div class="resgate-row__meta">
                  <span v-if="resgate.descontoPercentualSnapshot != null">
                    {{ resgate.descontoPercentualSnapshot }}%
                  </span>
                  <time>{{ formatResgateDate(resgate.resgatadoEm) }}</time>
                </div>
              </li>
            </ul>

            <Button
              v-if="resgatesCursor"
              class="list-panel__more"
              :label="t('divulgacao.resgates.loadMore')"
              size="small"
              severity="secondary"
              :loading="loadingResgatesMore"
              @click="loadMoreResgates"
            />
          </section>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.divulgacao {
  display: grid;
  gap: 1.65rem;
  width: 100%;
  max-width: 100%;
  overflow-x: clip;
}

.div-zone {
  display: grid;
  gap: 0.9rem;
  width: 100%;
}

.div-zone__head {
  display: grid;
  gap: 0.28rem;
  padding-bottom: 0.55rem;
  border-bottom: 1px solid color-mix(in srgb, var(--div-line) 85%, transparent);
}

.div-zone__head h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--div-text);
}

.div-zone__head > p {
  margin: 0;
  color: var(--div-muted);
  font-size: 0.82rem;
  line-height: 1.4;
}

.indicacao-pitch {
  display: grid;
  gap: 1.25rem;
  padding: 1.35rem 1.4rem 1.4rem;
  border: 1px solid color-mix(in srgb, var(--div-primary) 18%, var(--div-line));
  border-radius: 1.25rem;
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--div-primary-soft) 42%, var(--div-card)) 0%,
    var(--div-card) 48%
  );
  box-shadow: 0 14px 34px rgb(var(--div-shadow-rgb) / 0.05);
}

.indicacao-pitch__hero {
  display: grid;
  gap: 0.45rem;
  max-width: 42rem;
}

.indicacao-pitch__eyebrow {
  margin: 0;
  color: var(--div-primary-strong);
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.indicacao-pitch__hero h2 {
  margin: 0;
  color: var(--div-text);
  font-size: clamp(1.45rem, 2.4vw, 1.85rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.15;
}

.indicacao-pitch__lede {
  margin: 0;
  color: var(--div-muted);
  font-size: 0.98rem;
  font-weight: 500;
  line-height: 1.5;
}

.indicacao-pitch__steps {
  display: grid;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.indicacao-pitch__step {
  display: grid;
  gap: 0.65rem;
  align-content: start;
  min-height: 100%;
  padding: 0.95rem 0.95rem 1rem;
  border: 1px solid color-mix(in srgb, var(--div-line) 90%, transparent);
  border-radius: 1rem;
  background: color-mix(in srgb, var(--div-surface) 70%, var(--div-card));
}

.indicacao-pitch__index {
  color: var(--div-faint);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.1em;
}

.indicacao-pitch__icon {
  display: grid;
  width: 2.45rem;
  height: 2.45rem;
  place-items: center;
  border-radius: 0.8rem;
  background: color-mix(in srgb, var(--div-primary) 18%, transparent);
  color: var(--div-primary-strong);
  font-size: 0.95rem;
}

.indicacao-pitch__step h3 {
  margin: 0 0 0.28rem;
  color: var(--div-text);
  font-size: 0.95rem;
  font-weight: 750;
  letter-spacing: -0.02em;
  line-height: 1.25;
}

.indicacao-pitch__step p {
  margin: 0;
  color: var(--div-muted);
  font-size: 0.82rem;
  line-height: 1.45;
}

.indicacao-terms {
  display: grid;
  gap: 0.65rem;
  justify-items: stretch;
  padding-top: 0.9rem;
  border-top: 1px solid color-mix(in srgb, var(--div-line) 85%, transparent);
}

.indicacao-terms__head h3 {
  margin: 0;
  color: var(--div-text);
  font-size: 0.95rem;
  font-weight: 750;
  letter-spacing: -0.01em;
}

.indicacao-terms__head p {
  margin: 0.2rem 0 0;
  color: var(--div-muted);
  font-size: 0.82rem;
  line-height: 1.45;
}

/* Nível 1: os três números que definem o ganho. Hierarquia por tamanho do valor,
   não por cor decorativa. */
.indicacao-terms__highlights {
  display: grid;
  gap: 0.55rem;
  grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
  margin: 0;
  padding: 0;
  list-style: none;
}

.indicacao-terms__highlights li {
  display: grid;
  gap: 0.1rem;
  align-content: start;
  min-width: 0;
  padding: 0.75rem 0.85rem;
  border: 1px solid color-mix(in srgb, var(--div-primary) 22%, var(--div-line));
  border-radius: 0.85rem;
  background: color-mix(in srgb, var(--div-primary-soft) 22%, var(--div-card));
}

.indicacao-terms__highlights strong {
  color: var(--div-primary-strong);
  font-size: 1.15rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.15;
}

.indicacao-terms__highlights span {
  color: var(--div-muted);
  font-size: 0.76rem;
  font-weight: 600;
  line-height: 1.35;
}

.indicacao-terms__toggle.p-button {
  justify-self: start;
  gap: 0.4rem;
  padding: 0.4rem 0.7rem;
  border-radius: 0.6rem;
  color: var(--div-primary-strong);
  font-size: 0.8rem;
}

.indicacao-terms__toggle.p-button :deep(.p-button-label) {
  font-weight: 700;
}

.indicacao-terms__toggle.p-button :deep(.p-button-icon) {
  font-size: 0.7rem;
}

.indicacao-terms__toggle.p-button:not(:disabled):hover {
  border-color: color-mix(in srgb, var(--div-primary) 28%, var(--div-line));
  background: color-mix(in srgb, var(--div-primary-soft) 26%, transparent);
  color: var(--div-primary-strong);
}

/* Nível 2: o detalhe completo, incluindo o que não cabe no resumo. */
.indicacao-terms__grid {
  display: grid;
  gap: 0.55rem;
  grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
  margin: 0;
}

.indicacao-terms__item {
  display: grid;
  gap: 0.2rem;
  align-content: start;
  min-width: 0;
  padding: 0.75rem 0.85rem;
  border: 1px solid color-mix(in srgb, var(--div-line) 90%, transparent);
  border-radius: 0.85rem;
  background: color-mix(in srgb, var(--div-surface) 70%, var(--div-card));
}

.indicacao-terms__item dt {
  color: var(--div-text);
  font-size: 0.86rem;
  font-weight: 750;
  line-height: 1.3;
}

.indicacao-terms__item dd {
  margin: 0;
  color: var(--div-muted);
  font-size: 0.8rem;
  line-height: 1.5;
}

.indicacao-pitch__close {
  display: grid;
  gap: 0.4rem;
  padding-top: 0.15rem;
  border-top: 1px solid color-mix(in srgb, var(--div-line) 85%, transparent);
}

.indicacao-pitch__promise {
  margin: 0;
  color: var(--div-text);
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.4;
}

.indicacao-pitch__note {
  margin: 0;
  color: var(--div-faint);
  font-size: 0.8rem;
  line-height: 1.45;
}

@media (max-width: 1100px) {
  .indicacao-pitch__steps {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.share-kit--skeleton,
.list-panel--skeleton,
.metrics-strip__item--skeleton {
  pointer-events: none;
}

.share-kit--skeleton {
  align-self: start;
  min-height: 0;
}

.share-kit__head-copy {
  display: grid;
  gap: 0.4rem;
}

.share-kit--skeleton .share-kit__stage {
  grid-template-columns: minmax(0, 1fr);
}

.share-kit--skeleton .share-kit__label {
  margin-bottom: 0.38rem;
  line-height: 0;
}

.share-kit--skeleton .share-kit__link-field {
  align-items: center;
}

.share-kit__link-skel {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
  padding: 0.55rem 0.65rem;
}

.share-kit__hint--skeleton {
  display: grid;
  gap: 0.35rem;
}

.metrics-strip__skel-text {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
}

.list-panel__subskel {
  display: block;
  margin-top: 0.35rem;
}

.share-kit--skeleton :deep(.p-skeleton) {
  --p-skeleton-background: color-mix(in srgb, white 34%, transparent);
  --p-skeleton-animation-background: color-mix(in srgb, white 16%, transparent);
}

.list-panel--skeleton :deep(.p-skeleton),
.metrics-strip__item--skeleton :deep(.p-skeleton) {
  --p-skeleton-background: color-mix(in srgb, var(--div-primary-soft) 42%, var(--div-card));
  --p-skeleton-animation-background: color-mix(in srgb, var(--div-primary-soft) 18%, transparent);
}

.divulgacao__error {
  display: grid;
  justify-items: start;
  gap: 0.65rem;
  padding: 1.1rem 1.2rem;
  border: 1px solid color-mix(in srgb, var(--div-warm-text) 24%, var(--div-line));
  border-radius: 1.1rem;
  background: var(--div-card);
  color: var(--div-text);
}

.divulgacao__error p {
  margin: 0;
  font-size: 0.9rem;
}

.divulgacao__board {
  display: grid;
  gap: 0.9rem;
  width: 100%;
  align-items: stretch;
}

.divulgacao__board--with-metrics {
  grid-template-columns: minmax(0, 1.45fr) minmax(13.5rem, 0.7fr);
}

.divulgacao__board--with-soon {
  grid-template-columns: minmax(0, 1.35fr) minmax(15rem, 0.8fr);
}

/* Estado de espera: substitui código, link e QR enquanto o cadastro não é
   aprovado. O texto é o `aviso` do backend, que já varia por status.
   Só aparece com o card em `muted`, que usa `color: inherit` e fundo claro:
   por isso os tokens são os do painel, e não `--pf-on` (branco). */
.share-kit__espera {
  display: grid;
  justify-items: center;
  gap: 0.5rem;
  padding: 1.5rem 1.15rem;
  border: 1px dashed color-mix(in srgb, var(--div-primary) 30%, var(--div-line));
  border-radius: 1rem;
  background: color-mix(in srgb, var(--div-surface) 60%, var(--div-card));
  text-align: center;
}

.share-kit__espera-icon {
  display: grid;
  width: 2.6rem;
  height: 2.6rem;
  place-items: center;
  border-radius: 999px;
  background: color-mix(in srgb, var(--div-primary) 16%, transparent);
  color: var(--div-primary-strong);
  font-size: 1.1rem;
}

.share-kit__espera-aviso {
  margin: 0;
  max-width: 30rem;
  color: var(--div-text);
  font-size: 0.92rem;
  font-weight: 650;
  line-height: 1.5;
}

.share-kit__espera-hint {
  margin: 0;
  max-width: 30rem;
  color: var(--div-muted);
  font-size: 0.8rem;
  line-height: 1.45;
}

.share-kit__espera-cta {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  margin-top: 0.35rem;
  padding: 0.6rem 1.05rem;
  border-radius: 0.85rem;
  background: color-mix(in srgb, var(--div-primary) 14%, var(--div-card));
  color: var(--div-primary-strong);
  font-size: 0.84rem;
  font-weight: 700;
  text-decoration: none;
  transition:
    background 150ms ease,
    transform 150ms ease;
}

.share-kit__espera-cta:hover,
.share-kit__espera-cta:focus-visible {
  background: color-mix(in srgb, var(--div-primary) 22%, var(--div-card));
  outline: none;
  transform: translateY(-1px);
}

.share-kit--compact {
  gap: 0.85rem;
  padding: 1.05rem 1.15rem 1.05rem;
}

.share-kit--compact :deep(.partner-focus),
.share-kit.share-kit--compact {
  gap: 0.85rem;
}

.share-kit--compact.partner-focus {
  gap: 0.85rem;
  padding: 1.05rem 1.15rem;
}

.share-kit__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.share-kit__eyebrow {
  margin: 0 0 0.28rem;
  color: var(--pf-on-soft, var(--div-faint));
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.11em;
  text-transform: uppercase;
}

.share-kit__head h3 {
  margin: 0;
  font-size: 1.12rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.share-kit__pill {
  padding: 0.28rem 0.62rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--div-primary-soft) 32%, var(--div-card));
  color: var(--div-primary-strong);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
}

.share-kit__stage {
  display: grid;
  gap: 0.85rem;
  align-items: stretch;
}

.share-kit__stage--with-qr {
  grid-template-columns: minmax(0, 1fr) auto;
}

.share-kit__main {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 0;
}

.share-kit__qr {
  align-self: stretch;
  min-height: 100%;
}

.share-kit--compact .share-kit__head h3 {
  font-size: 1.02rem;
}

.share-kit--compact .share-kit__code {
  min-height: 2.45rem;
  font-size: clamp(1.15rem, 2vw, 1.4rem);
}

.share-kit--compact .share-kit__icon-btn.p-button {
  width: 2.45rem;
  height: 2.45rem;
}

.share-kit--compact .share-kit__link-field {
  grid-template-columns: 1fr;
  gap: 0.45rem;
  padding: 0.4rem;
}

.share-kit--compact .share-kit__copy-cta.p-button {
  width: 100%;
  min-height: 2.25rem;
}

.share-kit--compact .share-kit__hint {
  padding-top: 0.65rem;
  font-size: 0.76rem;
}

.share-kit__label {
  display: block;
  margin-bottom: 0.38rem;
  color: var(--pf-on-soft, var(--div-faint));
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.share-kit__code-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.55rem;
}

.share-kit__code {
  display: inline-flex;
  align-items: center;
  min-height: 2.75rem;
  padding: 0.4rem 0.95rem;
  border-radius: 0.85rem;
  background: var(--pf-chip, color-mix(in srgb, var(--div-primary-soft) 32%, var(--div-card)));
  color: var(--pf-on, var(--div-primary-strong));
  font-size: clamp(1.25rem, 2.4vw, 1.65rem);
  font-weight: 750;
  letter-spacing: 0.1em;
}

/* Botões sobre o cartão de foco (tinta --pf-*): o preset não conhece essa superfície. */
.share-kit__icon-btn.p-button,
.share-kit__icon-btn.p-button:not(:disabled):hover,
.share-kit__icon-btn.p-button:not(:disabled):active {
  width: 2.75rem;
  height: 2.75rem;
  border: 1px solid var(--pf-line, var(--div-line));
  border-radius: 0.85rem;
  background: var(--pf-field, var(--div-card));
  color: var(--pf-on, var(--div-muted));
  transition:
    background 140ms ease,
    border-color 140ms ease,
    filter 140ms ease;
}

.share-kit__icon-btn.p-button:not(:disabled):hover,
.share-kit__icon-btn.p-button:focus-visible:not(:disabled) {
  filter: brightness(1.08);
  box-shadow: none;
  outline: none;
}

.share-kit__icon-btn.p-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.share-kit__link-field {
  display: grid;
  gap: 0.55rem;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: stretch;
  padding: 0.35rem;
  border: 1px solid var(--pf-line, var(--div-line-soft));
  border-radius: 0.95rem;
  background: var(--pf-field, color-mix(in srgb, var(--div-surface) 70%, var(--div-card)));
}

.share-kit__link-field code {
  display: block;
  min-width: 0;
  padding: 0.65rem 0.75rem;
  color: inherit;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.78rem;
  line-height: 1.45;
  word-break: break-all;
  opacity: 0.92;
}

.share-kit__copy-cta.p-button,
.share-kit__copy-cta.p-button:not(:disabled):hover,
.share-kit__copy-cta.p-button:not(:disabled):active {
  gap: 0.4rem;
  align-self: center;
  min-height: 2.45rem;
  padding: 0.45rem 0.9rem;
  border: 0;
  border-radius: 0.75rem;
  background: var(--pf-cta-bg, color-mix(in srgb, var(--div-primary) 16%, var(--div-card)));
  color: var(--pf-cta-text, var(--div-primary-strong));
  font-size: 0.82rem;
  white-space: nowrap;
  transition:
    filter 140ms ease,
    transform 140ms ease;
}

.share-kit__copy-cta.p-button :deep(.p-button-label) {
  font-weight: 700;
}

.share-kit__copy-cta.p-button:not(:disabled):hover,
.share-kit__copy-cta.p-button:focus-visible:not(:disabled) {
  filter: brightness(1.04);
  box-shadow: none;
  outline: none;
  transform: translateY(-1px);
}

.share-kit__copy-cta.p-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.share-kit__hint {
  margin: 0;
  margin-top: auto;
  padding-top: 0.85rem;
  border-top: 1px solid var(--pf-line, color-mix(in srgb, var(--div-line) 80%, transparent));
  color: var(--pf-on-soft, var(--div-muted));
  font-size: 0.8rem;
  line-height: 1.45;
}

.share-kit.partner-focus--muted .share-kit__eyebrow,
.share-kit.partner-focus--muted .share-kit__label,
.share-kit.partner-focus--muted .share-kit__hint,
.share-kit.partner-focus--muted .share-kit__qr figcaption {
  color: var(--div-faint);
}

.share-kit.partner-focus--muted .share-kit__code {
  background: color-mix(in srgb, var(--div-primary-soft) 32%, var(--div-card));
  color: var(--div-primary-strong);
}

.share-kit.partner-focus--muted .share-kit__icon-btn.p-button,
.share-kit.partner-focus--muted .share-kit__icon-btn.p-button:not(:disabled):hover,
.share-kit.partner-focus--muted .share-kit__icon-btn.p-button:not(:disabled):active {
  border-color: var(--div-line);
  background: var(--div-card);
  color: var(--div-muted);
}

.share-kit.partner-focus--muted .share-kit__link-field {
  border-color: var(--div-line-soft);
  background: color-mix(in srgb, var(--div-surface) 70%, var(--div-card));
}

.share-kit.partner-focus--muted .share-kit__copy-cta.p-button,
.share-kit.partner-focus--muted .share-kit__copy-cta.p-button:not(:disabled):hover,
.share-kit.partner-focus--muted .share-kit__copy-cta.p-button:not(:disabled):active {
  background: color-mix(in srgb, var(--div-primary) 16%, var(--div-card));
  color: var(--div-primary-strong);
}

.share-kit.partner-focus--muted .share-kit__qr {
  border-color: var(--div-line-soft);
  background: var(--div-card);
}

.share-kit.partner-focus--muted .share-kit__hint {
  border-top-color: color-mix(in srgb, var(--div-line) 80%, transparent);
  color: var(--div-muted);
}

.metrics-strip {
  display: grid;
  gap: 0.65rem;
  align-content: stretch;
  min-height: 100%;
}

.metrics-strip__item {
  display: grid;
  grid-template-columns: 2.35rem 1fr;
  align-items: center;
  gap: 0.7rem;
  min-height: 4.4rem;
  padding: 0.85rem 0.95rem;
  border: 1px solid var(--div-line);
  border-radius: 1rem;
  background: var(--div-card);
  box-shadow: 0 10px 22px rgb(var(--div-shadow-rgb) / 0.035);
}

.metrics-strip__icon {
  display: grid;
  width: 2.35rem;
  height: 2.35rem;
  place-items: center;
  border-radius: 0.7rem;
  background: color-mix(in srgb, var(--div-primary) 14%, var(--div-card));
  color: var(--div-primary-strong);
  font-size: 0.92rem;
}

.metrics-strip__item[data-tone='success'] .metrics-strip__icon {
  background: var(--div-success-bg);
  color: var(--div-success-text);
}

.metrics-strip__item[data-tone='amber'] .metrics-strip__icon {
  background: var(--div-amber-bg);
  color: var(--div-amber-text);
}

.metrics-strip__item strong {
  display: block;
  font-size: 1.2rem;
  line-height: 1.1;
  letter-spacing: -0.02em;
}

.metrics-strip__item small {
  color: var(--div-muted);
  font-size: 0.76rem;
}

.divulgacao__lists {
  display: grid;
  gap: 0.9rem;
  width: 100%;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
}

.list-panel {
  display: grid;
  gap: 0.75rem;
  align-content: start;
  min-height: 100%;
  padding: 1.1rem 1.15rem 1.15rem;
  border: 1px solid var(--div-line);
  border-radius: 1.15rem;
  background: var(--div-card);
  box-shadow: 0 12px 28px rgb(var(--div-shadow-rgb) / 0.04);
}

.list-panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.65rem;
}

.list-panel__head h3 {
  margin: 0 0 0.18rem;
  font-size: 0.95rem;
  font-weight: 700;
}

.list-panel__head p {
  margin: 0;
  color: var(--div-muted);
  font-size: 0.78rem;
  line-height: 1.35;
}

.list-panel__count {
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--div-primary-soft) 30%, var(--div-card));
  color: var(--div-primary-strong);
  font-size: 0.72rem;
  font-weight: 700;
}

.list-panel__empty {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 0.85rem;
  border-radius: 0.85rem;
  background: var(--div-surface);
  color: var(--div-muted);
  font-size: 0.82rem;
}

.list-panel__items {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.cupom-row,
.resgate-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.7rem 0.8rem;
  border: 1px solid var(--div-line-soft);
  border-radius: 0.85rem;
  background: color-mix(in srgb, var(--div-surface) 80%, var(--div-card));
}

.cupom-row__main,
.resgate-row__main {
  display: grid;
  gap: 0.14rem;
  min-width: 0;
}

.cupom-row__main strong,
.resgate-row__main strong {
  overflow: hidden;
  font-size: 0.86rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cupom-row__main span,
.resgate-row__main span {
  color: var(--div-muted);
  font-size: 0.76rem;
}

.cupom-row__meta,
.resgate-row__meta {
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.35rem 0.5rem;
  color: var(--div-muted);
  font-size: 0.74rem;
}

.cupom-row__discount {
  padding: 0.12rem 0.42rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--div-primary) 14%, var(--div-card));
  color: var(--div-primary-strong);
  font-weight: 700;
}

.resgate-row__meta {
  display: grid;
  justify-items: end;
  gap: 0.12rem;
}

.list-panel__more {
  justify-self: start;
  margin-top: 0.15rem;
}

@media (max-width: 980px) {
  .metrics-strip {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .metrics-strip__item {
    min-height: 0;
  }
}

/* As métricas passaram a ocupar a coluna 2 ao lado do kit (é a leitura do mesmo
   QR que está à esquerda), então o teaser de cupom desce para uma faixa inteira.
   Sem isto sobraria um buraco na coluna 2 da segunda linha. */
.cupom-soon {
  grid-column: 1 / -1;
  display: flex;
  min-height: 100%;
  padding: 1.1rem 1.15rem;
  border: 1px solid color-mix(in srgb, var(--div-primary) 22%, var(--div-line));
  border-radius: 1.2rem;
  background: linear-gradient(
    155deg,
    color-mix(in srgb, var(--div-primary-soft) 34%, var(--div-card)) 0%,
    var(--div-card) 55%
  );
  box-shadow: 0 12px 28px rgb(var(--div-shadow-rgb) / 0.05);
}

.cupom-soon__anchor {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.65rem;
  align-items: flex-start;
  min-width: 0;
}

.cupom-soon__badge {
  display: inline-flex;
  align-items: center;
  min-height: 1.45rem;
  padding: 0.12rem 0.55rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--div-primary) 18%, transparent);
  color: var(--div-primary-strong);
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.cupom-soon__icon {
  display: grid;
  width: 2.55rem;
  height: 2.55rem;
  place-items: center;
  border-radius: 0.8rem;
  background: color-mix(in srgb, var(--div-primary) 18%, var(--div-surface));
  color: var(--div-primary-strong);
  font-size: 1rem;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--div-primary) 16%, transparent);
}

.cupom-soon__anchor h2 {
  margin: 0;
  color: var(--div-text);
  font-size: 1.08rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.25;
}

.cupom-soon__lede {
  margin: 0;
  color: var(--div-muted);
  font-size: 0.86rem;
  font-weight: 500;
  line-height: 1.45;
}

.cupom-soon :deep(.p-button) {
  width: 100%;
  margin-top: auto;
  justify-content: center;
  border: 0;
  background: var(--div-primary);
  color: var(--div-on-primary);
  font-weight: 700;
}

.cupom-soon :deep(.p-button:not(:disabled):hover) {
  filter: brightness(1.04);
}

@media (max-width: 960px) {
  .divulgacao__board--with-soon,
  .divulgacao__board--with-metrics {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .divulgacao__lists,
  .metrics-strip {
    grid-template-columns: 1fr;
  }

  .indicacao-pitch__steps {
    grid-template-columns: 1fr;
  }

  .share-kit__stage,
  .share-kit__stage--with-qr {
    grid-template-columns: 1fr;
  }

  .share-kit__qr {
    width: min(100%, 12.5rem);
    justify-self: start;
  }

  .share-kit__link-field {
    grid-template-columns: 1fr;
  }

  .share-kit__copy-cta.p-button {
    width: 100%;
  }

  .cupom-row,
  .resgate-row {
    grid-template-columns: 1fr;
  }

  .cupom-row__meta,
  .resgate-row__meta {
    justify-content: flex-start;
    justify-items: start;
  }
}
</style>
