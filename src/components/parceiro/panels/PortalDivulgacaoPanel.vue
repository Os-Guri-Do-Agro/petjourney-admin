<script setup lang="ts">
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref } from 'vue'

import PartnerStatusBadge from '@/components/parceiro/PartnerStatusBadge.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  getPortalCupons,
  getPortalIndicacao,
  getPortalResgates,
} from '@/service/parceiro/parceiro-portal-service'
import type { CupomParceiro, PortalIndicacao, ResgateParceiro } from '@/service/parceiro/types'
import { currentColors } from '@/theme/color-mode'

export type DivulgacaoSection = 'indicacao' | 'cupons' | 'resgates'

withDefaults(
  defineProps<{
    section?: DivulgacaoSection | null
  }>(),
  { section: null },
)

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
      getPortalCupons({ ...query, limit: 8 }),
      getPortalResgates({ ...query, limit: 8 }),
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
  if (!cuponsCursor.value) return

  loadingCuponsMore.value = true

  try {
    const page = await getPortalCupons({
      ...parceiroQuery(),
      cursor: cuponsCursor.value,
      limit: 8,
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
  if (!resgatesCursor.value) return

  loadingResgatesMore.value = true

  try {
    const page = await getPortalResgates({
      ...parceiroQuery(),
      cursor: resgatesCursor.value,
      limit: 8,
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
  <section
    class="divulgacao"
    :style="panelStyle"
    role="tabpanel"
    :aria-labelledby="section ? `partner-tab-${section}` : undefined"
  >
    <div v-if="loading" class="divulgacao__skeleton" role="status" aria-live="polite">
      <div class="divulgacao__skeleton-top" />
      <div class="divulgacao__skeleton-grid" />
    </div>

    <div v-else-if="error" class="divulgacao__error" role="alert">
      <i class="pi pi-exclamation-circle" aria-hidden="true" />
      <p>{{ error }}</p>
      <Button label="Tentar novamente" severity="secondary" size="small" @click="loadAll" />
    </div>

    <template v-else-if="indicacao">
      <div v-if="!section || section === 'indicacao'" class="divulgacao__top">
        <article class="share-kit">
          <header class="share-kit__head">
            <div>
              <h3>Kit de indicação</h3>
              <p>Compartilhe código, link ou QR para atrair assinantes vinculados à sua empresa.</p>
            </div>
            <span v-if="!indicacao.podeIndicar" class="share-kit__pill">Indisponível</span>
          </header>

          <p v-if="indicacao.aviso" class="share-kit__aviso">{{ indicacao.aviso }}</p>

          <div class="share-kit__body">
            <div class="share-kit__code-block">
              <span class="share-kit__label">Código</span>
              <div class="share-kit__code-row">
                <strong>{{ indicacao.codigoIndicacao }}</strong>
                <Button
                  icon="pi pi-copy"
                  label="Copiar"
                  size="small"
                  severity="secondary"
                  :disabled="!indicacao.podeIndicar"
                  @click="copyToClipboard(indicacao.codigoIndicacao, 'Código')"
                />
              </div>
            </div>

            <div v-if="indicacao.qrCodeDataUrl" class="share-kit__qr">
              <img :src="indicacao.qrCodeDataUrl" alt="QR Code de indicação" />
            </div>
          </div>

          <div class="share-kit__link">
            <span class="share-kit__label">Link</span>
            <div class="share-kit__link-row">
              <code>{{ indicacao.link }}</code>
              <Button
                icon="pi pi-link"
                label="Copiar link"
                size="small"
                :disabled="!indicacao.podeIndicar"
                @click="copyToClipboard(indicacao.link, 'Link')"
              />
            </div>
          </div>

          <p class="share-kit__hint">
            Comissão na carteira exige programa afiliado ativo. Cupons de desconto não geram comissão.
          </p>
        </article>

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

      <div
        v-if="!section || section === 'cupons' || section === 'resgates'"
        class="divulgacao__lists"
        :class="{ 'divulgacao__lists--single': section != null }"
      >
        <section
          v-if="!section || section === 'cupons'"
          class="list-panel"
          aria-labelledby="divulgacao-cupons-title"
        >
          <header class="list-panel__head">
            <div>
              <h4 id="divulgacao-cupons-title">Cupons da empresa</h4>
              <p>Descontos para tutores — não geram comissão.</p>
            </div>
            <span class="list-panel__count">{{ cupons.length }}</span>
          </header>

          <div v-if="cupons.length === 0" class="list-panel__empty">
            <i class="pi pi-ticket" aria-hidden="true" />
            <span>Nenhum cupom ativo no momento.</span>
          </div>

          <ul v-else class="list-panel__items">
            <li v-for="cupom in cupons" :key="cupom.id" class="cupom-row">
              <div class="cupom-row__main">
                <strong>{{ cupom.titulo }}</strong>
                <span>{{ cupom.codigo }} · {{ formatCategoria(cupom.categoria) }}</span>
              </div>
              <div class="cupom-row__meta">
                <span>{{ cupom.descontoPercentual }}% off</span>
                <span>{{ cupom.totalResgates }} resgates</span>
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

        <section
          v-if="!section || section === 'resgates'"
          class="list-panel"
          aria-labelledby="divulgacao-resgates-title"
        >
          <header class="list-panel__head">
            <div>
              <h4 id="divulgacao-resgates-title">Resgates recentes</h4>
              <p>Histórico de uso — sem dados pessoais dos tutores.</p>
            </div>
            <span class="list-panel__count">{{ resgates.length }}</span>
          </header>

          <div v-if="resgates.length === 0" class="list-panel__empty">
            <i class="pi pi-chart-line" aria-hidden="true" />
            <span>Nenhum resgate registrado ainda.</span>
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
    </template>
  </section>
</template>

<style scoped>
.divulgacao {
  display: grid;
  gap: 1rem;
}

.divulgacao__skeleton {
  display: grid;
  gap: 0.85rem;
}

.divulgacao__skeleton-top,
.divulgacao__skeleton-grid {
  border-radius: 1rem;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--div-line) 55%, transparent) 0%,
    color-mix(in srgb, var(--div-line-soft) 80%, transparent) 50%,
    color-mix(in srgb, var(--div-line) 55%, transparent) 100%
  );
  background-size: 200% 100%;
  animation: div-shimmer 1.2s ease-in-out infinite;
}

.divulgacao__skeleton-top {
  height: 14rem;
}

.divulgacao__skeleton-grid {
  height: 11rem;
}

@keyframes div-shimmer {
  0% {
    background-position: 100% 0;
  }

  100% {
    background-position: -100% 0;
  }
}

.divulgacao__error {
  display: grid;
  justify-items: start;
  gap: 0.65rem;
  padding: 1rem 1.1rem;
  border: 1px solid color-mix(in srgb, var(--div-warm-text) 35%, var(--div-line));
  border-radius: 0.95rem;
  background: var(--div-warm-bg);
  color: var(--div-warm-text);
}

.divulgacao__error p {
  margin: 0;
  font-size: 0.9rem;
}

.divulgacao__top {
  display: grid;
  gap: 0.85rem;
  grid-template-columns: minmax(0, 1.35fr) minmax(12rem, 0.65fr);
  align-items: stretch;
}

.share-kit {
  display: grid;
  gap: 0.85rem;
  padding: 1.05rem 1.15rem;
  border: 1px solid var(--div-line);
  border-radius: 1rem;
  background:
    radial-gradient(
      120% 180% at 100% 0%,
      color-mix(in srgb, var(--div-primary) 10%, transparent),
      transparent 55%
    ),
    var(--div-card);
  box-shadow: 0 16px 32px rgb(var(--div-shadow-rgb) / 0.05);
}

.share-kit__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.share-kit__head h3 {
  margin: 0 0 0.2rem;
  font-size: 1.02rem;
}

.share-kit__head p {
  margin: 0;
  color: var(--div-muted);
  font-size: 0.84rem;
  line-height: 1.4;
}

.share-kit__pill {
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: var(--div-amber-bg);
  color: var(--div-amber-text);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
}

.share-kit__aviso {
  margin: 0;
  padding: 0.65rem 0.75rem;
  border-radius: 0.75rem;
  background: var(--div-amber-bg);
  color: var(--div-amber-text);
  font-size: 0.84rem;
}

.share-kit__body {
  display: grid;
  gap: 0.85rem;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
}

.share-kit__label {
  display: block;
  margin-bottom: 0.3rem;
  color: var(--div-faint);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.share-kit__code-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.55rem;
}

.share-kit__code-row strong {
  font-size: clamp(1.35rem, 2.5vw, 1.75rem);
  letter-spacing: 0.06em;
}

.share-kit__qr img {
  width: 6.5rem;
  height: 6.5rem;
  border: 1px solid var(--div-line);
  border-radius: 0.75rem;
  background: var(--div-surface);
}

.share-kit__link-row {
  display: grid;
  gap: 0.55rem;
}

.share-kit__link-row code {
  display: block;
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--div-line-soft);
  border-radius: 0.65rem;
  background: var(--div-surface);
  color: var(--div-text);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.78rem;
  word-break: break-all;
}

.share-kit__hint {
  margin: 0;
  color: var(--div-muted);
  font-size: 0.8rem;
}

.metrics-strip {
  display: grid;
  gap: 0.55rem;
  align-content: start;
}

.metrics-strip__item {
  display: grid;
  grid-template-columns: 2.25rem 1fr;
  align-items: center;
  gap: 0.65rem;
  padding: 0.75rem 0.85rem;
  border: 1px solid var(--div-line);
  border-radius: 0.85rem;
  background: var(--div-card);
}

.metrics-strip__icon {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  border-radius: 0.65rem;
  background: color-mix(in srgb, var(--div-primary) 14%, var(--div-card));
  color: var(--div-primary-strong);
  font-size: 0.9rem;
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
  font-size: 1.15rem;
  line-height: 1.1;
}

.metrics-strip__item small {
  color: var(--div-muted);
  font-size: 0.76rem;
}

.divulgacao__lists {
  display: grid;
  gap: 0.85rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.divulgacao__lists--single {
  grid-template-columns: 1fr;
}

.list-panel {
  display: grid;
  gap: 0.65rem;
  padding: 0.95rem 1rem;
  border: 1px solid var(--div-line);
  border-radius: 0.95rem;
  background: var(--div-card);
}

.list-panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.65rem;
}

.list-panel__head h4 {
  margin: 0 0 0.15rem;
  font-size: 0.92rem;
}

.list-panel__head p {
  margin: 0;
  color: var(--div-muted);
  font-size: 0.78rem;
}

.list-panel__count {
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: var(--div-surface);
  color: var(--div-muted);
  font-size: 0.74rem;
  font-weight: 700;
}

.list-panel__empty {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 0.7rem;
  border-radius: 0.7rem;
  background: var(--div-surface);
  color: var(--div-muted);
  font-size: 0.82rem;
}

.list-panel__items {
  display: grid;
  gap: 0.45rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.cupom-row,
.resgate-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.62rem 0.68rem;
  border: 1px solid var(--div-line-soft);
  border-radius: 0.72rem;
  background: var(--div-surface);
}

.cupom-row__main,
.resgate-row__main {
  display: grid;
  gap: 0.12rem;
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
  gap: 0.35rem 0.55rem;
  color: var(--div-muted);
  font-size: 0.74rem;
}

.resgate-row__meta {
  display: grid;
  justify-items: end;
  gap: 0.1rem;
}

.list-panel__more {
  justify-self: start;
}

@media (max-width: 980px) {
  .divulgacao__top {
    grid-template-columns: 1fr;
  }

  .metrics-strip {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .divulgacao__lists {
    grid-template-columns: 1fr;
  }

  .metrics-strip {
    grid-template-columns: 1fr;
  }

  .share-kit__body {
    grid-template-columns: 1fr;
  }

  .cupom-row,
  .resgate-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .cupom-row__meta,
  .resgate-row__meta {
    justify-content: flex-start;
    justify-items: start;
  }
}
</style>
