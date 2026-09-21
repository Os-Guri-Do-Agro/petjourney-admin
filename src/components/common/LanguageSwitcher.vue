<script setup lang="ts">
import Select from 'primevue/select'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import flagBR from 'country-flag-icons/string/3x2/BR'
import flagES from 'country-flag-icons/string/3x2/ES'
import flagAE from 'country-flag-icons/string/3x2/AE'
import flagGB from 'country-flag-icons/string/3x2/GB'
import flagRS from 'country-flag-icons/string/3x2/RS'
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
const authTheme = useAuthThemeVars()

/** Espelha o overlay do `Select`: gira o chevron e reforça a borda do gatilho. */
const open = ref(false)

/** SVG strings exportados pelo pacote (caminho SVG direto não está no exports). */
const FLAG_SVG: Record<Locale, string> = {
  pt: flagBR,
  en: flagUS,
  'en-GB': flagGB,
  es: flagES,
  sr: flagRS,
  /* O árabe atende vários países: os Emirados representam o idioma no seletor. */
  ar: flagAE,
}

/** Nomes nativos — não dependem do locale da UI. */
const NATIVE_NAME: Record<Locale, string> = {
  pt: 'Português',
  en: 'English (US)',
  'en-GB': 'English (UK)',
  es: 'Español',
  sr: 'Srpski',
  ar: 'العربية',
}

type LocaleOption = {
  code: Locale
  flagSvg: string
  short: string
  name: string
}

const options = computed<LocaleOption[]>(() =>
  LOCALES.map((code) => ({
    code,
    flagSvg: FLAG_SVG[code],
    short: t(`languageSwitcher.${code}`),
    name: NATIVE_NAME[code],
  })),
)

const selectedLocale = computed(() => locale.value as Locale)

const selectedOption = computed<LocaleOption>(() => {
  return (
    options.value.find((option) => option.code === selectedLocale.value) ?? {
      code: 'pt',
      flagSvg: FLAG_SVG.pt,
      short: t('languageSwitcher.pt'),
      name: NATIVE_NAME.pt,
    }
  )
})

const switcherStyle = computed(() => {
  const colors = currentColors.value
  const base = {
    '--ls-text': colors.text.primary,
    '--ls-muted': colors.text.secondary,
    '--ls-border': colors.border.default,
    '--ls-bg': colors.bg.card,
    '--ls-panel': colors.bg.screen,
    '--ls-active': colors.vet.primary,
    '--ls-hover': colors.bg.light,
    '--ls-check': colors.dashboard.primaryStrong,
    '--ls-shadow': `0 10px 28px rgb(${colors.auth.shadowRgb} / 0.14)`,
  }

  if (props.variant === 'auth' && props.tone === 'brand') {
    return {
      ...authTheme.value,
      ...base,
      '--ls-text': 'var(--auth-on-brand)',
      '--ls-muted': 'color-mix(in srgb, var(--auth-on-brand) 72%, transparent)',
      '--ls-border': 'color-mix(in srgb, var(--auth-on-brand) 28%, transparent)',
      '--ls-bg': 'color-mix(in srgb, var(--auth-on-brand) 12%, transparent)',
      '--ls-panel': colors.dashboard.surface,
      '--ls-panel-text': colors.dashboard.text,
      '--ls-active': 'var(--auth-sage)',
      '--ls-hover': 'color-mix(in srgb, var(--auth-on-brand) 18%, transparent)',
      '--ls-check': colors.dashboard.primaryStrong,
      '--ls-shadow': `0 14px 36px rgb(${colors.auth.shadowRgb} / 0.22)`,
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
      '--ls-panel': 'var(--auth-field-bg)',
      '--ls-panel-text': 'var(--auth-text)',
      '--ls-active': 'var(--auth-sage)',
      '--ls-hover': 'var(--auth-sage-tint)',
      '--ls-check': 'var(--auth-sage-strong)',
    }
  }

  return {
    ...base,
    '--ls-panel': colors.bg.screen,
    '--ls-panel-text': colors.text.primary,
  }
})

async function selectLocale(code: Locale | null) {
  if (code && code !== selectedLocale.value) {
    await changeLocale(code)
  }
}
</script>

<template>
  <div
    class="language-switcher"
    :class="[
      `language-switcher--${props.variant}`,
      props.variant === 'auth' ? `language-switcher--tone-${props.tone}` : null,
      open ? 'language-switcher--open' : null,
    ]"
    :style="switcherStyle"
  >
    <!--
      Gatilho compacto + painel, igual nas três variantes.
      `append-to="self"`: as variáveis `--ls-*` moram na raiz, e um painel teleportado para o
      `body` perderia as cores do tom (o verde da marca no login) e fecharia o menu do avatar,
      que trata clique fora como "sair".
    -->
    <Select
      class="language-switcher__select"
      :model-value="selectedLocale"
      :options="options"
      option-label="short"
      option-value="code"
      append-to="self"
      scroll-height="22rem"
      :aria-label="t('languageSwitcher.label')"
      :pt="{ overlay: { class: 'language-switcher__panel' } }"
      @update:model-value="selectLocale"
      @show="open = true"
      @hide="open = false"
    >
      <template #value>
        <span
          class="language-switcher__flag"
          aria-hidden="true"
          v-html="selectedOption.flagSvg"
        />
        <span class="language-switcher__code">{{ selectedOption.short }}</span>
      </template>
      <template #dropdownicon>
        <i class="pi pi-chevron-down language-switcher__chevron" aria-hidden="true" />
      </template>
      <template #option="{ option, selected }">
        <span class="language-switcher__flag" aria-hidden="true" v-html="option.flagSvg" />
        <span class="language-switcher__meta">
          <span class="language-switcher__name" dir="auto">{{ option.name }}</span>
          <span class="language-switcher__short">{{ option.short }}</span>
        </span>
        <i v-if="selected" class="pi pi-check language-switcher__check" aria-hidden="true" />
      </template>
    </Select>
  </div>
</template>

<style scoped>
/**
 * `z-index` na raiz, e não só no painel.
 *
 * O gatilho no painel da marca usa `backdrop-filter`, que cria contexto de empilhamento: o
 * `z-index` do painel do `Select` passa a valer só dentro dele, e o conteúdo que vem depois no
 * DOM (a copy da marca, no login) era pintado por cima das opções, que ficavam sem clique.
 */
.language-switcher {
  position: relative;
  z-index: 20;
  width: 100%;
}

.language-switcher--auth {
  width: auto;
  flex-shrink: 0;
}

.language-switcher--menu {
  width: 100%;
}

.language-switcher--settings {
  width: auto;
  flex-shrink: 0;
}

/* ---- Gatilho (Select) ---- */

.language-switcher__select.p-select {
  align-items: center;
  min-height: 2.4rem;
  border: 1px solid var(--ls-border);
  border-radius: 999px;
  background: var(--ls-bg);
  box-shadow: none;
  color: var(--ls-text);
  transition:
    border-color 160ms ease,
    background 160ms ease,
    box-shadow 160ms ease;
}

.language-switcher__select.p-select:not(.p-disabled):hover {
  border-color: color-mix(in srgb, var(--ls-active) 42%, var(--ls-border));
  background: var(--ls-hover);
}

.language-switcher__select.p-select:not(.p-disabled).p-focus {
  border-color: var(--ls-active);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ls-active) 22%, transparent);
  outline: none;
}

.language-switcher--open .language-switcher__select.p-select {
  border-color: color-mix(in srgb, var(--ls-active) 50%, var(--ls-border));
}

.language-switcher--auth.language-switcher--tone-brand .language-switcher__select.p-select {
  backdrop-filter: blur(8px);
}

.language-switcher__select :deep(.p-select-label) {
  display: inline-flex;
  width: auto;
  align-items: center;
  gap: 0.45rem;
  padding-block: 0.35rem;
  padding-inline: 0.55rem 0;
  color: var(--ls-text);
}

.language-switcher__select :deep(.p-select-dropdown) {
  width: auto;
  padding-block: 0;
  padding-inline: 0.45rem 0.65rem;
}

.language-switcher--settings .language-switcher__select.p-select {
  min-width: 6.75rem;
  min-height: 2.55rem;
  border-radius: 0.8rem;
}

/* Menu do avatar: o gatilho ocupa a linha inteira, como os outros itens do menu. */
.language-switcher--menu .language-switcher__select.p-select {
  width: 100%;
  min-height: 2.55rem;
  border-radius: 0.75rem;
}

.language-switcher--menu .language-switcher__select :deep(.p-select-label) {
  flex: 1;
  padding-block: 0.4rem;
  padding-inline: 0.6rem 0;
}

.language-switcher--settings .language-switcher__select :deep(.p-select-label) {
  padding-block: 0.4rem;
  padding-inline: 0.6rem 0;
}

.language-switcher--settings .language-switcher__select :deep(.p-select-dropdown) {
  padding-inline-end: 0.7rem;
}

.language-switcher__code {
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  line-height: 1;
}

.language-switcher__chevron {
  font-size: 0.7rem;
  color: var(--ls-muted);
  transition: transform 160ms ease;
}

.language-switcher--open .language-switcher__chevron {
  transform: rotate(180deg);
}

/* ---- Painel do Select (cores e estados das opções vêm do preset) ---- */

.language-switcher__select :deep(.language-switcher__panel) {
  min-width: 12.5rem;
  margin-top: 0.4rem;
  border-color: var(--ls-border);
  border-radius: 0.95rem;
  background: var(--ls-panel);
  box-shadow: var(--ls-shadow);
  color: var(--ls-panel-text, var(--ls-text));
}

/*
 * No painel de conta o gatilho fica no canto direito do cartão: o painel cresce para a esquerda.
 * `!important` porque o posicionamento relativo do PrimeVue escreve `inset-inline-start` inline.
 */
.language-switcher--settings .language-switcher__select :deep(.language-switcher__panel) {
  min-width: 13.5rem;
  inset-inline-start: auto !important;
  inset-inline-end: 0;
}

.language-switcher__select :deep(.p-select-list) {
  gap: 0.2rem;
  padding: 0.35rem;
}

/* ---- Opção ---- */

.language-switcher :deep(.p-select-option) {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0.65rem;
  min-height: 2.55rem;
  padding: 0.45rem 0.6rem;
  border-radius: 0.7rem;
  white-space: normal;
}

.language-switcher--menu :deep(.p-select-option) {
  min-height: 2.4rem;
  padding: 0.35rem 0.55rem;
  border-radius: 0.65rem;
}

.language-switcher__meta {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
}

.language-switcher__name {
  font-size: 0.875rem;
  font-weight: 650;
  line-height: 1.2;
}

.language-switcher--menu .language-switcher__name {
  font-size: 0.84rem;
}

.language-switcher__short {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  opacity: 0.72;
}

.language-switcher__flag {
  display: inline-flex;
  width: 1.4rem;
  height: 0.95rem;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: 0.2rem;
  box-shadow: 0 0 0 1px color-mix(in srgb, currentColor 14%, transparent);
}

.language-switcher__flag :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}

.language-switcher__check {
  font-size: 0.8rem;
  color: var(--ls-check);
}

@media (prefers-reduced-motion: reduce) {
  .language-switcher__select.p-select,
  .language-switcher__chevron {
    transition: none;
  }
}
</style>
