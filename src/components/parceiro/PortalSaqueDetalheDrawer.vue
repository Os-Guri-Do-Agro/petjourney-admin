<script setup lang="ts">
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import Skeleton from 'primevue/skeleton'
import { useToast } from 'primevue/usetoast'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { usePartnerFocusSurface } from '@/composables/usePartnerFocusSurface'
import { useSidePanelOffset } from '@/composables/useSidePanelOffset'
import { INTL_LOCALE, isRTLLocale, type Locale } from '@/i18n/locales'
import { getSaqueDetalhe } from '@/service/parceiro/parceiro-portal-service'
import type { SaqueDetalhe } from '@/service/parceiro/types'
import { LightColors } from '@/theme/colors'
import { currentColors } from '@/theme/color-mode'
import { formatCentavosToBrl } from '@/utils/format/money'

const props = defineProps<{
  saqueId: string | null
}>()

const visible = defineModel<boolean>('visible', { default: false })

useSidePanelOffset(visible, '26.5rem')

const { t, locale } = useI18n()
const toast = useToast()
const { ensureContext, parceiroQuery } = useParceiroPortal()
const { focusSurfaceStyle } = usePartnerFocusSurface()

const saque = ref<SaqueDetalhe | null>(null)
const loading = ref(false)
const error = ref('')
const copyingPix = ref(false)

/**
 * O selo do saque, na cor do estado. O selo de status do programa dizia "Ativo ✓" para um saque
 * pago — o nome certo para a parceria, e o errado para dinheiro que já caiu na conta.
 */
const TOM_DO_SAQUE = {
  PENDENTE: 'hc--pessego',
  PAGO: 'hc--verde',
  FALHA: 'hc--coral',
} as const

const drawerStyle = computed(() => {
  const colors = currentColors.value

  return {
    ...focusSurfaceStyle.value,
    '--sd-bg': colors.dashboard.surface,
    '--sd-surface': colors.dashboard.surfaceSoft,
    '--sd-text': colors.dashboard.text,
    '--sd-muted': colors.dashboard.muted,
    '--sd-faint': colors.dashboard.faint,
    '--sd-line': colors.dashboard.line,
    '--sd-primary': colors.vet.primary,
    '--sd-primary-soft': colors.vet.secondary,
    '--sd-primary-strong': colors.dashboard.primaryStrong,
    '--sd-warm-bg': colors.dashboard.warmBg,
    '--sd-warm-text': colors.dashboard.warmText,
    '--sd-success-bg': colors.dashboard.successBg,
    '--sd-success-text': colors.dashboard.successText,
    '--sd-shadow-rgb': colors.auth.shadowRgb,
    /** Sempre branco real: `auth.white` é superfície (quebrada no claro, escura no dark). */
    '--sd-on-cta': LightColors.text.inverse,
  }
})

const drawerPt = computed(() => ({
  root: { class: 'saque-drawer' },
  header: { class: 'saque-drawer__header-shell' },
  content: { class: 'saque-drawer__content-shell' },
}))

/**
 * O PrimeVue posiciona o Drawer pelo lado físico. O painel fica no fim da linha de leitura (à
 * direita em LTR, à esquerda no árabe), do mesmo lado em que o `AppShell` abre espaço para ele.
 */
const drawerPosition = computed(() =>
  isRTLLocale(locale.value as Locale) ? 'left' : 'right',
)

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(INTL_LOCALE[locale.value as Locale], {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

async function loadDetalhe(id: string) {
  loading.value = true
  error.value = ''
  saque.value = null

  try {
    await ensureContext()
    saque.value = await getSaqueDetalhe(id, parceiroQuery())
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('carteira.detail.errorLoad')
  } finally {
    loading.value = false
  }
}

async function copyPix() {
  const key = saque.value?.chavePixSnapshot?.trim()
  if (!key || copyingPix.value) {
    return
  }

  copyingPix.value = true
  try {
    await navigator.clipboard.writeText(key)
    toast.add({
      severity: 'success',
      summary: t('common.copied'),
      detail: t('carteira.detail.pixCopied'),
      life: 2500,
    })
  } catch {
    toast.add({
      severity: 'error',
      summary: t('carteira.detail.pixCopyError'),
      life: 3500,
    })
  } finally {
    copyingPix.value = false
  }
}

function close() {
  visible.value = false
}

watch(
  () => [visible.value, props.saqueId] as const,
  ([isOpen, id]) => {
    if (isOpen && id) {
      void loadDetalhe(id)
    }

    if (!isOpen) {
      saque.value = null
      error.value = ''
    }
  },
)
</script>

<template>
  <Drawer
    v-model:visible="visible"
    :position="drawerPosition"
    :modal="false"
    :dismissable="false"
    :block-scroll="false"
    class="saque-drawer hc-tema"
    :pt="drawerPt"
    :style="drawerStyle"
    @hide="close"
  >
    <template #header>
      <div class="saque-drawer__header">
        <p class="saque-drawer__eyebrow">{{ t('carteira.detail.subtitle') }}</p>
        <h2>{{ t('carteira.detail.title') }}</h2>
      </div>
    </template>

    <div class="saque-drawer__body">
      <div
        v-if="loading"
        class="saque-drawer__loading"
        role="status"
        aria-live="polite"
        aria-busy="true"
        :aria-label="t('carteira.detail.loadingAria')"
      >
        <div class="saque-drawer__hero saque-drawer__hero--skeleton">
          <Skeleton width="5.5rem" height="0.7rem" border-radius="4px" />
          <Skeleton width="11rem" height="2rem" border-radius="8px" />
          <Skeleton width="4.5rem" height="1.4rem" border-radius="999px" />
        </div>
        <div class="saque-drawer__section">
          <Skeleton width="7rem" height="0.75rem" border-radius="4px" />
          <Skeleton width="100%" height="3.4rem" border-radius="12px" />
          <Skeleton width="100%" height="3.4rem" border-radius="12px" />
        </div>
      </div>

      <div v-else-if="error" class="saque-drawer__error" role="alert">
        <span class="saque-drawer__error-icon" aria-hidden="true">
          <i class="ph ph-warning-circle" />
        </span>
        <strong>{{ t('carteira.detail.errorLoad') }}</strong>
        <p>{{ error }}</p>
        <Button
          v-if="saqueId"
          :label="t('common.retry')"
          severity="secondary"
          @click="loadDetalhe(saqueId)"
        />
      </div>

      <template v-else-if="saque">
        <section class="saque-drawer__hero" :data-status="saque.status">
          <p class="saque-drawer__hero-label">{{ t('carteira.detail.valorLabel') }}</p>
          <strong class="saque-drawer__hero-value">
            {{ formatCentavosToBrl(saque.valorCentavos, INTL_LOCALE[locale as Locale]) }}
          </strong>
          <span class="hc-selo" :class="TOM_DO_SAQUE[saque.status]">
                {{ t(`carteira.saques.status.${saque.status}`) }}
              </span>
        </section>

        <section class="saque-drawer__section" :aria-label="t('carteira.detail.timelineLabel')">
          <h3>{{ t('carteira.detail.timelineLabel') }}</h3>
          <ol class="saque-drawer__timeline">
            <li>
              <span class="saque-drawer__dot" aria-hidden="true" />
              <div>
                <strong>{{ t('carteira.detail.requestedAt') }}</strong>
                <time :datetime="saque.createdAt">{{ formatDateTime(saque.createdAt) }}</time>
              </div>
            </li>
            <li v-if="saque.liquidadoEm">
              <span class="saque-drawer__dot saque-drawer__dot--done" aria-hidden="true" />
              <div>
                <strong>{{ t('carteira.detail.liquidatedAt') }}</strong>
                <time :datetime="saque.liquidadoEm">{{ formatDateTime(saque.liquidadoEm) }}</time>
              </div>
            </li>
            <li v-else-if="saque.status === 'PENDENTE'">
              <span class="saque-drawer__dot saque-drawer__dot--pending" aria-hidden="true" />
              <div>
                <strong>{{ t('carteira.detail.awaitingLiquidation') }}</strong>
                <span>{{ t('carteira.detail.awaitingLiquidationHint') }}</span>
              </div>
            </li>
          </ol>
        </section>

        <section class="saque-drawer__section">
          <h3>{{ t('carteira.detail.pixSnapshot') }}</h3>
          <div class="saque-drawer__pix">
            <code>{{ saque.chavePixSnapshot }}</code>
            <Button
              type="button"
              icon="ph ph-copy"
              :label="t('common.copy')"
              severity="secondary"
              size="small"
              :loading="copyingPix"
              @click="copyPix"
            />
          </div>
        </section>

        <section v-if="saque.motivoFalha" class="saque-drawer__alert" role="alert">
          <span aria-hidden="true"><i class="ph ph-info" /></span>
          <div>
            <strong>{{ t('carteira.detail.failReason') }}</strong>
            <p>{{ saque.motivoFalha }}</p>
          </div>
        </section>

        <section v-if="saque.comprovante" class="saque-drawer__section">
          <h3>{{ t('carteira.detail.receipt') }}</h3>
          <p class="saque-drawer__receipt">{{ saque.comprovante }}</p>
        </section>

        <p v-if="saque.status === 'PENDENTE'" class="saque-drawer__hint">
          {{ t('carteira.detail.pendingHint') }}
        </p>
      </template>
    </div>
  </Drawer>
</template>

<style scoped>
.saque-drawer__header {
  display: grid;
  gap: 0.2rem;
  padding-inline-end: 0.5rem;
}

.saque-drawer__eyebrow {
  margin: 0;
  color: var(--sd-faint);
  font-size: 0.75rem;
  font-weight: 700;
}

.saque-drawer__header h2 {
  margin: 0;
  color: var(--sd-text);
  font-size: 1.2rem;
  font-weight: 750;
  letter-spacing: -0.02em;
}

.saque-drawer__body {
  display: grid;
  gap: 1.15rem;
  padding-bottom: 0.5rem;
}

.saque-drawer__loading,
.saque-drawer__error {
  display: grid;
  gap: 0.85rem;
}

.saque-drawer__error {
  justify-items: start;
  padding: 1rem;
  border: 1px solid color-mix(in srgb, var(--sd-warm-text) 22%, var(--sd-line));
  border-radius: 1rem;
  background: var(--sd-bg);
}

.saque-drawer__error-icon {
  display: grid;
  width: 2.4rem;
  height: 2.4rem;
  place-items: center;
  border-radius: 0.8rem;
  background: color-mix(in srgb, var(--sd-warm-text) 14%, transparent);
  color: var(--sd-warm-text);
}

.saque-drawer__error strong {
  color: var(--sd-text);
}

.saque-drawer__error p {
  margin: 0;
  color: var(--sd-muted);
  font-size: 0.88rem;
}

.saque-drawer__hero {
  display: grid;
  gap: 0.55rem;
  justify-items: start;
  padding: 1.15rem 1.2rem;
  border: 1px solid color-mix(in srgb, var(--sd-primary) 22%, var(--sd-line));
  border-radius: 1.15rem;
  background:
    linear-gradient(
      145deg,
      color-mix(in srgb, var(--sd-primary-soft) 38%, var(--sd-bg)),
      var(--sd-bg) 62%
    );
  box-shadow: 0 14px 30px rgb(var(--sd-shadow-rgb) / 0.06);
}

.saque-drawer__hero[data-status='FALHA'] {
  border-color: color-mix(in srgb, var(--sd-warm-text) 28%, var(--sd-line));
  background: var(--sd-bg);
}

.saque-drawer__hero[data-status='PAGO'] {
  border-color: color-mix(in srgb, var(--sd-success-text) 24%, var(--sd-line));
  background:
    linear-gradient(
      145deg,
      color-mix(in srgb, var(--sd-success-bg) 70%, var(--sd-bg)),
      var(--sd-bg) 68%
    );
}

.saque-drawer__hero-label {
  margin: 0;
  color: var(--sd-muted);
  font-size: 0.75rem;
  font-weight: 700;
}

.saque-drawer__hero-value {
  color: var(--sd-text);
  font-size: clamp(1.7rem, 3vw, 2.05rem);
  font-weight: 750;
  letter-spacing: -0.04em;
  line-height: 1.05;
}

.saque-drawer__section {
  display: grid;
  gap: 0.65rem;
}

.saque-drawer__section h3 {
  margin: 0;
  color: var(--sd-text);
  font-size: 0.82rem;
  font-weight: 750;
  letter-spacing: 0.02em;
}

.saque-drawer__timeline {
  display: grid;
  gap: 0.55rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.saque-drawer__timeline li {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.75rem;
  align-items: start;
  padding: 0.8rem 0.9rem;
  border: 1px solid var(--sd-line);
  border-radius: 0.95rem;
  background: var(--sd-bg);
}

.saque-drawer__dot {
  width: 0.65rem;
  height: 0.65rem;
  margin-top: 0.35rem;
  border-radius: 999px;
  background: var(--sd-primary);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--sd-primary) 18%, transparent);
}

.saque-drawer__dot--done {
  background: var(--sd-success-text);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--sd-success-text) 16%, transparent);
}

.saque-drawer__dot--pending {
  background: var(--sd-faint);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--sd-faint) 25%, transparent);
}

.saque-drawer__timeline strong {
  display: block;
  margin-bottom: 0.15rem;
  color: var(--sd-text);
  font-size: 0.86rem;
}

.saque-drawer__timeline time,
.saque-drawer__timeline span {
  color: var(--sd-muted);
  font-size: 0.82rem;
}

.saque-drawer__pix {
  display: grid;
  gap: 0.65rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--sd-line);
  border-radius: 0.95rem;
  background: color-mix(in srgb, var(--sd-surface) 70%, var(--sd-bg));
}

.saque-drawer__pix code {
  overflow-wrap: anywhere;
  color: var(--sd-text);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.9rem;
  font-weight: 650;
}

.saque-drawer__alert {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.75rem;
  padding: 0.95rem 1rem;
  border: 1px solid color-mix(in srgb, var(--sd-warm-text) 24%, var(--sd-line));
  border-radius: 0.95rem;
  background: var(--sd-bg);
  color: var(--sd-text);
}

.saque-drawer__alert strong {
  display: block;
  margin-bottom: 0.2rem;
  color: var(--sd-warm-text);
  font-size: 0.84rem;
}

.saque-drawer__alert p {
  margin: 0;
  color: var(--sd-text);
  font-size: 0.88rem;
  line-height: 1.45;
}

.saque-drawer__receipt {
  margin: 0;
  padding: 0.85rem 1rem;
  border: 1px solid var(--sd-line);
  border-radius: 0.95rem;
  background: var(--sd-bg);
  color: var(--sd-muted);
  font-size: 0.88rem;
  overflow-wrap: anywhere;
}

.saque-drawer__hint {
  margin: 0;
  padding: 0.85rem 1rem;
  border-radius: 0.95rem;
  background: color-mix(in srgb, var(--sd-primary-soft) 28%, var(--sd-bg));
  color: var(--sd-muted);
  font-size: 0.84rem;
  line-height: 1.5;
}

.saque-drawer__hero--skeleton {
  min-height: 7rem;
}
</style>

<style>
.saque-drawer.p-drawer.p-component {
  width: min(100vw, 26.5rem);
  height: calc(100% - var(--pj-shell-header-height, 4.25rem));
  margin-top: var(--pj-shell-header-height, 4.25rem);
  align-self: flex-start;
  border-inline-start: 1px solid color-mix(in srgb, var(--sd-line, #eaf0ee) 90%, transparent);
  background: var(--sd-bg, #fff);
  box-shadow: none;
}

.saque-drawer .p-drawer-header,
.saque-drawer__header-shell {
  padding: 1.15rem 1.25rem 0.85rem;
  border-bottom: 1px solid color-mix(in srgb, var(--sd-line, #eaf0ee) 90%, transparent);
  background: color-mix(in srgb, var(--sd-surface, #f4f7f6) 55%, var(--sd-bg, #fff));
}

.saque-drawer .p-drawer-content,
.saque-drawer__content-shell {
  padding: 1.15rem 1.25rem 1.4rem;
}

</style>
