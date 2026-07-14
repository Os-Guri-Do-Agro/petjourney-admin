<script setup lang="ts">
import Select from 'primevue/select'
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import flagBR from 'country-flag-icons/string/3x2/BR'
import flagGB from 'country-flag-icons/string/3x2/GB'
import flagUS from 'country-flag-icons/string/3x2/US'

import { useAuthThemeVars } from '@/composables/useAuthThemeVars'
import { changeLocale } from '@/i18n'
import { LOCALES, type Locale } from '@/i18n/locales'
import { currentColors } from '@/theme/color-mode'

const props = withDefaults(
  defineProps<{
    /** `auth` = login; `settings` = painel conta; `menu` = dropdown do avatar */
    variant?: 'auth' | 'settings' | 'menu'
    /** `brand` = painel verde; `surface` = formulário claro (mobile) */
    tone?: 'brand' | 'surface'
  }>(),
  { variant: 'settings', tone: 'surface' },
)

const { t, locale } = useI18n()
const selectId = useId()
const authTheme = useAuthThemeVars()

/** SVG strings exportados pelo pacote (caminho SVG direto não está no exports). */
const FLAG_SVG: Partial<Record<Locale, string>> = {
  pt: flagBR,
  en: flagUS,
  'en-GB': flagGB,
}

const TITLE: Record<Locale, string> = {
  pt: 'Português (BR)',
  en: 'English (US)',
  'en-GB': 'English (UK)',
  es: 'Español (LatAm)',
}

type LocaleOption = {
  code: Locale
  flagSvg: string | null
  short: string
  title: string
}

const options = computed<LocaleOption[]>(() =>
  LOCALES.map((code) => ({
    code,
    flagSvg: FLAG_SVG[code] ?? null,
    short: t(`languageSwitcher.${code}`),
    title: TITLE[code],
  })),
)

const selectedLocale = computed({
  get: () => locale.value as Locale,
  set: (next: Locale) => {
    void changeLocale(next)
  },
})

const switcherStyle = computed(() => {
  const colors = currentColors.value
  const base = {
    '--ls-text': colors.text.primary,
    '--ls-muted': colors.text.secondary,
    '--ls-border': colors.border.default,
    '--ls-bg': colors.bg.card,
    '--ls-active': colors.vet.primary,
    '--ls-hover': colors.bg.light,
  }

  if (props.variant === 'auth' && props.tone === 'brand') {
    return {
      ...authTheme.value,
      ...base,
      '--ls-text': colors.dashboard.text,
      '--ls-muted': colors.dashboard.muted,
      '--ls-border': 'color-mix(in srgb, var(--auth-on-brand) 35%, transparent)',
      '--ls-bg': 'var(--auth-field-bg)',
      '--ls-active': 'var(--auth-sage)',
      '--ls-hover': 'var(--auth-sage-tint)',
    }
  }

  if (props.variant === 'auth') {
    return {
      ...authTheme.value,
      ...base,
      '--ls-text': 'var(--auth-text)',
      '--ls-muted': 'var(--auth-muted)',
      '--ls-border': 'var(--auth-line)',
      '--ls-bg': 'var(--auth-field-bg)',
      '--ls-active': 'var(--auth-sage)',
      '--ls-hover': 'var(--auth-sage-tint)',
    }
  }

  return base
})
</script>

<template>
  <div
    class="language-switcher"
    :class="[
      `language-switcher--${props.variant}`,
      props.variant === 'auth' ? `language-switcher--tone-${props.tone}` : null,
    ]"
    :style="switcherStyle"
  >
    <Select
      :id="selectId"
      v-model="selectedLocale"
      :options="options"
      option-label="short"
      option-value="code"
      :aria-label="t('languageSwitcher.label')"
      class="language-switcher__select"
    >
      <template #value="{ value, placeholder }">
        <span v-if="value" class="language-switcher__value">
          <span
            v-if="FLAG_SVG[value as Locale]"
            class="language-switcher__flag"
            aria-hidden="true"
            v-html="FLAG_SVG[value as Locale]"
          />
          <i v-else class="pi pi-globe language-switcher__globe" aria-hidden="true" />
          <span class="language-switcher__code">{{ t(`languageSwitcher.${value}`) }}</span>
        </span>
        <span v-else>{{ placeholder }}</span>
      </template>

      <template #option="{ option }">
        <span class="language-switcher__option" :title="option.title">
          <span
            v-if="option.flagSvg"
            class="language-switcher__flag"
            aria-hidden="true"
            v-html="option.flagSvg"
          />
          <i v-else class="pi pi-globe language-switcher__globe" aria-hidden="true" />
          <span class="language-switcher__code">{{ option.short }}</span>
        </span>
      </template>
    </Select>
  </div>
</template>

<style scoped>
.language-switcher {
  display: grid;
  gap: 0.45rem;
  width: 100%;
}

.language-switcher--auth {
  width: auto;
  max-width: none;
  flex-shrink: 0;
}

.language-switcher--auth .language-switcher__select :deep(.p-select) {
  min-height: 2.55rem;
  min-width: 7.5rem;
  border-radius: 0.75rem;
}

.language-switcher--auth .language-switcher__select :deep(.p-select-label) {
  padding: 0.4rem 0.5rem 0.4rem 0.65rem;
  color: var(--ls-text);
}

.language-switcher--auth .language-switcher__select :deep(.p-select-dropdown) {
  color: var(--ls-muted);
}

.language-switcher--menu {
  gap: 0;
  padding: 0;
}

.language-switcher--settings {
  max-width: 14rem;
}

.language-switcher__value,
.language-switcher__option {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  color: var(--ls-text);
}

.language-switcher__flag {
  display: inline-flex;
  width: 1.35rem;
  height: 0.9rem;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: 0.15rem;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--ls-text) 12%, transparent);
}

.language-switcher__flag :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}

.language-switcher__globe {
  display: grid;
  width: 1.35rem;
  height: 0.9rem;
  flex-shrink: 0;
  place-items: center;
  color: var(--ls-active);
  font-size: 0.95rem;
}

.language-switcher__code {
  color: var(--ls-text);
  font-size: 0.875rem;
  font-weight: 750;
  letter-spacing: 0.04em;
}

.language-switcher__select {
  width: 100%;
}

.language-switcher__select :deep(.p-select) {
  width: 100%;
  min-height: 3.125rem;
  border: 1px solid var(--ls-border);
  border-radius: 0.875rem;
  background: var(--ls-bg);
  color: var(--ls-text);
  box-shadow: none;
  transition:
    border-color 160ms ease,
    background 160ms ease,
    box-shadow 160ms ease;
}

.language-switcher__select :deep(.p-select:not(.p-disabled):hover) {
  border-color: color-mix(in srgb, var(--ls-active) 45%, var(--ls-border));
  background: var(--ls-bg);
}

.language-switcher__select :deep(.p-select.p-focus),
.language-switcher__select :deep(.p-select:not(.p-disabled).p-focus) {
  border-color: var(--ls-active);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ls-active) 18%, transparent);
}

.language-switcher__select :deep(.p-select-label) {
  display: flex;
  align-items: center;
  padding: 0.75rem 0.85rem;
  color: var(--ls-text);
  font-weight: 750;
}

.language-switcher__select :deep(.p-select-dropdown) {
  width: 2.5rem;
  color: var(--ls-muted);
}

.language-switcher--menu .language-switcher__select :deep(.p-select) {
  min-height: 2.55rem;
  border-radius: 0.75rem;
}

.language-switcher--menu .language-switcher__select :deep(.p-select-label) {
  padding: 0.45rem 0.65rem;
}
</style>
