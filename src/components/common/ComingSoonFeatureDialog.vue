<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { LightColors } from '@/theme/colors'
import { currentColors } from '@/theme/color-mode'

const visible = defineModel<boolean>('visible', { default: false })

const props = withDefaults(
  defineProps<{
    title?: string
    lede?: string
    body?: string
    ctaLabel?: string
    icon?: string
  }>(),
  {
    title: '',
    lede: '',
    body: '',
    ctaLabel: '',
    icon: 'pi pi-bolt',
  },
)

const { t } = useI18n()

const dialogStyle = computed(() => {
  const colors = currentColors.value

  return {
    '--soon-bg': colors.dashboard.surface,
    '--soon-surface': colors.dashboard.surfaceSoft,
    '--soon-text': colors.dashboard.text,
    '--soon-muted': colors.dashboard.muted,
    '--soon-faint': colors.dashboard.faint,
    '--soon-line': colors.dashboard.line,
    '--soon-primary': colors.vet.primary,
    '--soon-primary-soft': colors.vet.secondary,
    '--soon-primary-strong': colors.dashboard.primaryStrong,
    '--soon-on-primary': LightColors.auth.white,
    '--soon-shadow-rgb': colors.auth.shadowRgb,
  }
})

const resolvedTitle = computed(() => props.title || t('comingSoon.cupom.title'))
const resolvedLede = computed(() => props.lede || t('comingSoon.cupom.lede'))
const resolvedBody = computed(() => props.body || t('comingSoon.cupom.body'))
const resolvedCta = computed(() => props.ctaLabel || t('comingSoon.cupom.cta'))

function close() {
  visible.value = false
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :draggable="false"
    :closable="false"
    class="coming-soon-dialog"
    :pt="{ root: { class: 'coming-soon-dialog' }, content: { class: 'coming-soon-dialog__content' } }"
    @hide="close"
  >
    <template #container="{ closeCallback }">
      <div class="soon-card" :style="dialogStyle" role="dialog" aria-modal="true" aria-labelledby="coming-soon-title">
        <button
          type="button"
          class="soon-card__close"
          :aria-label="t('comingSoon.cupom.closeAria')"
          @click="closeCallback"
        >
          <i class="pi pi-times" aria-hidden="true" />
        </button>

        <div class="soon-card__hero" aria-hidden="true">
          <span class="soon-card__badge">{{ t('comingSoon.cupom.badge') }}</span>
          <span class="soon-card__icon">
            <i :class="props.icon" />
          </span>
        </div>

        <div class="soon-card__copy">
          <h2 id="coming-soon-title">{{ resolvedTitle }}</h2>
          <p class="soon-card__lede">{{ resolvedLede }}</p>
          <p class="soon-card__body">{{ resolvedBody }}</p>
        </div>

        <div class="soon-card__actions">
          <Button type="button" :label="resolvedCta" @click="closeCallback" />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.soon-card {
  position: relative;
  display: grid;
  gap: 1.15rem;
  width: min(100vw - 1.5rem, 26.5rem);
  padding: 1.35rem 1.35rem 1.25rem;
  border: 1px solid var(--soon-line);
  border-radius: 1.35rem;
  background:
    linear-gradient(
      160deg,
      color-mix(in srgb, var(--soon-primary-soft) 28%, var(--soon-bg)) 0%,
      var(--soon-bg) 48%
    );
  box-shadow:
    0 1px 0 color-mix(in srgb, white 8%, transparent) inset,
    0 22px 48px rgb(var(--soon-shadow-rgb) / 0.18);
}

.soon-card__close {
  position: absolute;
  top: 0.85rem;
  right: 0.85rem;
  display: grid;
  width: 2.1rem;
  height: 2.1rem;
  place-items: center;
  border: 0;
  border-radius: 0.7rem;
  background: color-mix(in srgb, var(--soon-surface) 80%, transparent);
  color: var(--soon-muted);
  cursor: pointer;
  transition:
    background 140ms ease,
    color 140ms ease;
}

.soon-card__close:hover,
.soon-card__close:focus-visible {
  outline: none;
  background: var(--soon-surface);
  color: var(--soon-text);
}

.soon-card__hero {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.85rem;
  padding-right: 2rem;
}

.soon-card__badge {
  display: inline-flex;
  align-items: center;
  min-height: 1.55rem;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--soon-primary) 18%, transparent);
  color: var(--soon-primary-strong);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.soon-card__icon {
  display: grid;
  width: 3.25rem;
  height: 3.25rem;
  place-items: center;
  border-radius: 1rem;
  background: color-mix(in srgb, var(--soon-primary) 22%, var(--soon-surface));
  color: var(--soon-primary-strong);
  font-size: 1.25rem;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--soon-primary) 20%, transparent);
}

.soon-card__copy {
  display: grid;
  gap: 0.55rem;
}

.soon-card__copy h2 {
  margin: 0;
  color: var(--soon-text);
  font-size: 1.35rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.2;
}

.soon-card__lede {
  margin: 0;
  color: var(--soon-text);
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.45;
}

.soon-card__body {
  margin: 0;
  color: var(--soon-muted);
  font-size: 0.88rem;
  line-height: 1.5;
}

.soon-card__actions {
  display: flex;
  justify-content: stretch;
  padding-top: 0.15rem;
}

.soon-card__actions :deep(.p-button) {
  width: 100%;
  justify-content: center;
  border: 0;
  background: var(--soon-primary);
  color: var(--soon-on-primary);
  font-weight: 700;
}

.soon-card__actions :deep(.p-button:not(:disabled):hover) {
  filter: brightness(1.04);
}
</style>

<style>
.coming-soon-dialog.p-dialog,
.coming-soon-dialog .p-dialog {
  border: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}

.coming-soon-dialog .p-dialog-content {
  padding: 0 !important;
  background: transparent !important;
}
</style>
