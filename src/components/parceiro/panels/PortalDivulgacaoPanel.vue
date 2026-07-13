<script setup lang="ts">
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref } from 'vue'

import PartnerFocusCard from '@/components/parceiro/PartnerFocusCard.vue'
import PartnerStatusBadge from '@/components/parceiro/PartnerStatusBadge.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  getPortalCupons,
  getPortalIndicacao,
  getPortalResgates,
} from '@/service/parceiro/parceiro-portal-service'
import type { CupomParceiro, PortalIndicacao, ResgateParceiro } from '@/service/parceiro/types'
import { currentColors } from '@/theme/color-mode'

const toast = useToast()
const { store, ensureContext, parceiroQuery } = useParceiroPortal()

const indicacao = ref<PortalIndicacao | null>(null)
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
  }
})

const metrics = computed(() => {
  const totais = store.dashboard?.totais

  return [
    {
      id: 'cupons',
      label: 'Cupons ativos',
      value: totais?.cuponsAtivos ?? cupons.value.filter((c) => c.ativo).length,
      icon: 'pi pi-ticket',
      tone: 'primary' as const,
    },
    {
      id: 'total',
      label: 'Resgates totais',
      value: totais?.resgatesTotal ?? resgates.value.length,
      icon: 'pi pi-check-circle',
      tone: 'success' as const,
    },
    {
      id: 'recentes',
      label: 'Últimos 30 dias',
      value: totais?.resgatesUltimos30d ?? 0,
      icon: 'pi pi-chart-line',
      tone: 'amber' as const,
    },
  ]
})

async function copyToClipboard(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.add({ severity: 'success', summary: 'Copiado', detail: `${label} copiado.`, life: 2500 })
  } catch {
    toast.add({ severity: 'warn', summary: 'Não foi possível copiar', life: 3000 })
  }
}

async function loadAll() {
  loading.value = true
  error.value = ''

  try {
    await ensureContext()
    const query = parceiroQuery()

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
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Erro ao carregar divulgação.'
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
      summary: 'Erro',
      detail: err instanceof Error ? err.message : 'Não foi possível carregar mais cupons.',
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
      summary: 'Erro',
      detail: err instanceof Error ? err.message : 'Não foi possível carregar mais resgates.',
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
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

onMounted(() => {
  void loadAll()
})
</script>

<template>
  <div class="divulgacao" :style="panelStyle">
    <div v-if="error" class="divulgacao__error" role="alert">
      <i class="pi pi-exclamation-circle" aria-hidden="true" />
      <p>{{ error }}</p>
      <Button label="Tentar novamente" severity="secondary" size="small" @click="loadAll" />
    </div>

    <template v-else-if="loading">
      <section class="div-zone" aria-labelledby="div-indicacao-title">
        <header class="div-zone__head">
          <div class="div-zone__title-row">
            <p class="div-zone__index">01</p>
            <h2 id="div-indicacao-title">Indicação</h2>
          </div>
          <p>Código, link e QR para atrair assinantes vinculados à empresa.</p>
        </header>

        <div
          class="divulgacao__top"
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-label="Carregando kit de indicação"
        >
          <PartnerFocusCard class="share-kit share-kit--skeleton" aria-hidden="true">
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

          <aside class="metrics-strip" aria-hidden="true">
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

      <section class="div-zone" aria-labelledby="div-movimentacao-title">
        <header class="div-zone__head">
          <div class="div-zone__title-row">
            <p class="div-zone__index">02</p>
            <h2 id="div-movimentacao-title">Cupons e resgates</h2>
          </div>
          <p>Descontos da empresa e histórico de uso — lado a lado.</p>
        </header>

        <div
          class="divulgacao__lists"
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-label="Carregando cupons e resgates"
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
          <div class="div-zone__title-row">
            <p class="div-zone__index">01</p>
            <h2 id="div-indicacao-title">Indicação</h2>
          </div>
          <p>Código, link e QR para atrair assinantes vinculados à empresa.</p>
        </header>

        <div class="divulgacao__top">
          <PartnerFocusCard class="share-kit" :muted="!indicacao.podeIndicar">
            <header class="share-kit__head">
              <div>
                <p class="share-kit__eyebrow">Kit de indicação</p>
                <h3>Compartilhe e vincule assinantes</h3>
              </div>
              <span v-if="!indicacao.podeIndicar" class="share-kit__pill">Indisponível</span>
            </header>

            <p v-if="indicacao.aviso" class="share-kit__aviso">{{ indicacao.aviso }}</p>

            <div class="share-kit__stage">
              <div class="share-kit__main">
                <div class="share-kit__code-block">
                  <span class="share-kit__label">Código</span>
                  <div class="share-kit__code-row">
                    <strong class="share-kit__code">{{ indicacao.codigoIndicacao }}</strong>
                    <button
                      type="button"
                      class="share-kit__icon-btn"
                      aria-label="Copiar código"
                      :disabled="!indicacao.podeIndicar"
                      @click="copyToClipboard(indicacao.codigoIndicacao, 'Código')"
                    >
                      <i class="pi pi-copy" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div class="share-kit__link">
                  <span class="share-kit__label">Link pronto</span>
                  <div class="share-kit__link-field">
                    <code>{{ indicacao.link }}</code>
                    <button
                      type="button"
                      class="share-kit__copy-cta"
                      :disabled="!indicacao.podeIndicar"
                      @click="copyToClipboard(indicacao.link, 'Link')"
                    >
                      <i class="pi pi-link" aria-hidden="true" />
                      Copiar link
                    </button>
                  </div>
                </div>
              </div>

              <figure v-if="indicacao.qrCodeDataUrl" class="share-kit__qr">
                <img :src="indicacao.qrCodeDataUrl" alt="QR Code de indicação" />
                <figcaption>Escaneie no celular</figcaption>
              </figure>
            </div>

            <p class="share-kit__hint">
              Comissão na carteira exige programa afiliado ativo. Cupons de desconto não geram
              comissão.
            </p>
          </PartnerFocusCard>

          <aside class="metrics-strip" aria-label="Métricas de divulgação">
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
        </div>
      </section>

      <section class="div-zone" aria-labelledby="div-movimentacao-title">
        <header class="div-zone__head">
          <div class="div-zone__title-row">
            <p class="div-zone__index">02</p>
            <h2 id="div-movimentacao-title">Cupons e resgates</h2>
          </div>
          <p>Descontos da empresa e histórico de uso — lado a lado.</p>
        </header>

        <div class="divulgacao__lists">
          <section id="cupons" class="list-panel" aria-labelledby="divulgacao-cupons-title">
            <header class="list-panel__head">
              <div>
                <h3 id="divulgacao-cupons-title">Cupons</h3>
                <p>Descontos para tutores — não geram comissão.</p>
              </div>
              <span class="list-panel__count">{{ cupons.length }}</span>
            </header>

            <div v-if="cupons.length === 0" class="list-panel__empty">
              <i class="pi pi-ticket" aria-hidden="true" />
              <span>Nenhum cupom no momento.</span>
            </div>

            <ul v-else class="list-panel__items">
              <li v-for="cupom in cupons" :key="cupom.id" class="cupom-row">
                <div class="cupom-row__main">
                  <strong>{{ cupom.titulo }}</strong>
                  <span>{{ cupom.codigo }} · {{ formatCategoria(cupom.categoria) }}</span>
                </div>
                <div class="cupom-row__meta">
                  <span class="cupom-row__discount">{{ cupom.descontoPercentual }}%</span>
                  <span>{{ cupom.totalResgates }} usos</span>
                  <PartnerStatusBadge :status="cupom.ativo ? 'ATIVO' : 'SUSPENSO'" />
                </div>
              </li>
            </ul>

            <Button
              v-if="cuponsCursor"
              class="list-panel__more"
              label="Mais cupons"
              size="small"
              severity="secondary"
              :loading="loadingCuponsMore"
              @click="loadMoreCupons"
            />
          </section>

          <section id="resgates" class="list-panel" aria-labelledby="divulgacao-resgates-title">
            <header class="list-panel__head">
              <div>
                <h3 id="divulgacao-resgates-title">Resgates</h3>
                <p>Sem dados pessoais dos tutores.</p>
              </div>
              <span class="list-panel__count">{{ resgates.length }}</span>
            </header>

            <div v-if="resgates.length === 0" class="list-panel__empty">
              <i class="pi pi-chart-line" aria-hidden="true" />
              <span>Nenhum resgate ainda.</span>
            </div>

            <ul v-else class="list-panel__items">
              <li v-for="resgate in resgates" :key="resgate.resgateId" class="resgate-row">
                <div class="resgate-row__main">
                  <strong>{{ resgate.cupomCodigo }}</strong>
                  <span>{{ resgate.canal === 'QR' ? 'Via QR Code' : 'Código manual' }}</span>
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
              label="Mais resgates"
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

.div-zone__title-row {
  display: flex;
  align-items: baseline;
  gap: 0.55rem;
}

.div-zone__index {
  margin: 0;
  color: var(--div-faint);
  font-size: 0.72rem;
  font-weight: 750;
  letter-spacing: 0.08em;
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
  --p-skeleton-animation-background: color-mix(
    in srgb,
    var(--div-primary-soft) 18%,
    transparent
  );
}

.divulgacao__error {
  display: grid;
  justify-items: start;
  gap: 0.65rem;
  padding: 1.1rem 1.2rem;
  border: 1px solid color-mix(in srgb, var(--div-warm-text) 35%, var(--div-line));
  border-radius: 1.1rem;
  background: var(--div-warm-bg);
  color: var(--div-warm-text);
}

.divulgacao__error p {
  margin: 0;
  font-size: 0.9rem;
}

.divulgacao__top {
  display: grid;
  gap: 0.9rem;
  width: 100%;
  grid-template-columns: minmax(0, 1.45fr) minmax(14rem, 0.7fr);
  align-items: stretch;
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
  background: var(--div-amber-bg);
  color: var(--div-amber-text);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
}

.share-kit__aviso {
  margin: 0;
  padding: 0.7rem 0.85rem;
  border-radius: 0.85rem;
  background: var(--div-amber-bg);
  color: var(--div-amber-text);
  font-size: 0.84rem;
  line-height: 1.4;
}

.share-kit__stage {
  display: grid;
  gap: 1rem;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: stretch;
}

.share-kit__main {
  display: grid;
  gap: 0.95rem;
  align-content: start;
  min-width: 0;
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

.share-kit__icon-btn {
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  place-items: center;
  border: 1px solid var(--pf-line, var(--div-line));
  border-radius: 0.85rem;
  background: var(--pf-field, var(--div-card));
  color: var(--pf-on, var(--div-muted));
  cursor: pointer;
  transition:
    background 140ms ease,
    border-color 140ms ease,
    filter 140ms ease;
}

.share-kit__icon-btn:hover:not(:disabled),
.share-kit__icon-btn:focus-visible:not(:disabled) {
  filter: brightness(1.08);
  outline: none;
}

.share-kit__icon-btn:disabled {
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

.share-kit__copy-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  align-self: center;
  min-height: 2.45rem;
  padding: 0.45rem 0.9rem;
  border: 0;
  border-radius: 0.75rem;
  background: var(--pf-cta-bg, color-mix(in srgb, var(--div-primary) 16%, var(--div-card)));
  color: var(--pf-cta-text, var(--div-primary-strong));
  font-size: 0.82rem;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  transition:
    filter 140ms ease,
    transform 140ms ease;
}

.share-kit__copy-cta:hover:not(:disabled),
.share-kit__copy-cta:focus-visible:not(:disabled) {
  filter: brightness(1.04);
  outline: none;
  transform: translateY(-1px);
}

.share-kit__copy-cta:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.share-kit__qr {
  display: grid;
  gap: 0.45rem;
  justify-items: center;
  align-content: center;
  margin: 0;
  padding: 0.85rem 0.9rem 0.75rem;
  border: 1px solid var(--pf-line, var(--div-line-soft));
  border-radius: 1.05rem;
  background: var(--pf-chip, var(--div-card));
}

.share-kit__qr img {
  width: 7rem;
  height: 7rem;
  border-radius: 0.7rem;
  background: #fff;
  padding: 0.35rem;
  box-sizing: border-box;
}

.share-kit__qr figcaption {
  color: var(--pf-on-soft, var(--div-muted));
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.share-kit__hint {
  margin: 0;
  padding-top: 0.75rem;
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

.share-kit.partner-focus--muted .share-kit__icon-btn {
  border-color: var(--div-line);
  background: var(--div-card);
  color: var(--div-muted);
}

.share-kit.partner-focus--muted .share-kit__link-field {
  border-color: var(--div-line-soft);
  background: color-mix(in srgb, var(--div-surface) 70%, var(--div-card));
}

.share-kit.partner-focus--muted .share-kit__copy-cta {
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
  .divulgacao__top {
    grid-template-columns: 1fr;
  }

  .metrics-strip {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .metrics-strip__item {
    min-height: 0;
  }
}

@media (max-width: 720px) {
  .divulgacao__lists,
  .metrics-strip {
    grid-template-columns: 1fr;
  }

  .share-kit__stage {
    grid-template-columns: 1fr;
  }

  .share-kit__qr {
    justify-self: start;
  }

  .share-kit__link-field {
    grid-template-columns: 1fr;
  }

  .share-kit__copy-cta {
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
