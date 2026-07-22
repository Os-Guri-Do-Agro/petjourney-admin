<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import flagBR from 'country-flag-icons/string/3x2/BR'
import flagES from 'country-flag-icons/string/3x2/ES'
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
const listboxId = useId()
const authTheme = useAuthThemeVars()

const rootRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLButtonElement | null>(null)
const optionRefs = ref<HTMLButtonElement[]>([])
const open = ref(false)
const activeIndex = ref(0)

/** SVG strings exportados pelo pacote (caminho SVG direto não está no exports). */
const FLAG_SVG: Record<Locale, string> = {
  pt: flagBR,
  en: flagUS,
  'en-GB': flagGB,
  es: flagES,
}

/** Nomes nativos — não dependem do locale da UI. */
const NATIVE_NAME: Record<Locale, string> = {
  pt: 'Português',
  en: 'English (US)',
  'en-GB': 'English (UK)',
  es: 'Español',
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

/** Menu do avatar: lista explícita (evita dropdown aninhado). Settings usa pill compacta. */
const isListVariant = computed(() => props.variant === 'menu')

const switcherStyle = computed(() => {
  const colors = currentColors.value
  const base = {
    '--ls-text': colors.text.primary,
    '--ls-muted': colors.text.secondary,
    '--ls-border': colors.border.default,
    '--ls-bg': colors.bg.card,
    '--ls-panel': colors.bg.screen,
    '--ls-active': colors.vet.primary,
    '--ls-active-soft': colors.auth.sageTint,
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
      '--ls-panel-muted': colors.dashboard.muted,
      '--ls-active': 'var(--auth-sage)',
      '--ls-active-soft': 'var(--auth-sage-tint)',
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
      '--ls-panel-muted': 'var(--auth-muted)',
      '--ls-active': 'var(--auth-sage)',
      '--ls-active-soft': 'var(--auth-sage-tint)',
      '--ls-hover': 'var(--auth-sage-tint)',
      '--ls-check': 'var(--auth-sage-strong)',
    }
  }

  return {
    ...base,
    '--ls-panel': colors.bg.screen,
    '--ls-panel-text': colors.text.primary,
    '--ls-panel-muted': colors.text.secondary,
  }
})

function setOptionRef(el: unknown, index: number) {
  if (el instanceof HTMLButtonElement) {
    optionRefs.value[index] = el
  }
}

function syncActiveIndex() {
  const index = options.value.findIndex((option) => option.code === selectedLocale.value)
  activeIndex.value = index >= 0 ? index : 0
}

async function focusActiveOption() {
  await nextTick()
  optionRefs.value[activeIndex.value]?.focus()
}

function closePanel(restoreFocus = true) {
  if (!open.value) return
  open.value = false
  if (restoreFocus) {
    triggerRef.value?.focus()
  }
}

function togglePanel() {
  if (open.value) {
    closePanel()
    return
  }
  syncActiveIndex()
  open.value = true
  void focusActiveOption()
}

async function selectLocale(code: Locale) {
  if (code !== selectedLocale.value) {
    await changeLocale(code)
  }
  closePanel()
}

function onTriggerKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    if (!open.value) {
      syncActiveIndex()
      open.value = true
      void focusActiveOption()
      return
    }
  }

  if (event.key === 'Escape') {
    closePanel()
  }
}

function onPanelKeydown(event: KeyboardEvent) {
  const last = options.value.length - 1

  if (event.key === 'Escape') {
    event.preventDefault()
    closePanel()
    return
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeIndex.value = activeIndex.value >= last ? 0 : activeIndex.value + 1
    void focusActiveOption()
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value = activeIndex.value <= 0 ? last : activeIndex.value - 1
    void focusActiveOption()
    return
  }

  if (event.key === 'Home') {
    event.preventDefault()
    activeIndex.value = 0
    void focusActiveOption()
    return
  }

  if (event.key === 'End') {
    event.preventDefault()
    activeIndex.value = last
    void focusActiveOption()
  }
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!open.value || !rootRef.value) return
  const target = event.target
  if (target instanceof Node && !rootRef.value.contains(target)) {
    closePanel(false)
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
})

watch(
  () => locale.value,
  () => {
    syncActiveIndex()
  },
)
</script>

<template>
  <div
    ref="rootRef"
    class="language-switcher"
    :class="[
      `language-switcher--${props.variant}`,
      props.variant === 'auth' ? `language-switcher--tone-${props.tone}` : null,
      open ? 'language-switcher--open' : null,
    ]"
    :style="switcherStyle"
  >
    <!-- Preferências: lista explícita, sem dropdown -->
    <div
      v-if="isListVariant"
      :id="listboxId"
      class="language-switcher__list"
      role="listbox"
      :aria-label="t('languageSwitcher.label')"
      :aria-activedescendant="`ls-option-${selectedLocale}`"
    >
      <button
        v-for="option in options"
        :id="`ls-option-${option.code}`"
        :key="option.code"
        type="button"
        class="language-switcher__option"
        :class="{ 'language-switcher__option--selected': option.code === selectedLocale }"
        role="option"
        :aria-selected="option.code === selectedLocale"
        @click="selectLocale(option.code)"
      >
        <span
          class="language-switcher__flag"
          aria-hidden="true"
          v-html="option.flagSvg"
        />
        <span class="language-switcher__meta">
          <span class="language-switcher__name">{{ option.name }}</span>
          <span class="language-switcher__short">{{ option.short }}</span>
        </span>
        <i
          v-if="option.code === selectedLocale"
          class="pi pi-check language-switcher__check"
          aria-hidden="true"
        />
      </button>
    </div>

    <!-- Auth / menu: trigger compacto + painel -->
    <template v-else>
      <button
        ref="triggerRef"
        type="button"
        class="language-switcher__trigger"
        :aria-label="t('languageSwitcher.label')"
        :aria-expanded="open"
        aria-haspopup="listbox"
        :aria-controls="listboxId"
        @click="togglePanel"
        @keydown="onTriggerKeydown"
      >
        <span
          class="language-switcher__flag"
          aria-hidden="true"
          v-html="selectedOption.flagSvg"
        />
        <span class="language-switcher__code">{{ selectedOption.short }}</span>
        <i class="pi pi-chevron-down language-switcher__chevron" aria-hidden="true" />
      </button>

      <div
        v-if="open"
        :id="listboxId"
        class="language-switcher__panel"
        role="listbox"
        :aria-label="t('languageSwitcher.label')"
        @keydown="onPanelKeydown"
      >
        <button
          v-for="(option, index) in options"
          :key="option.code"
          :ref="(el) => setOptionRef(el, index)"
          type="button"
          class="language-switcher__option"
          :class="{
            'language-switcher__option--selected': option.code === selectedLocale,
            'language-switcher__option--active': index === activeIndex,
          }"
          role="option"
          :aria-selected="option.code === selectedLocale"
          tabindex="-1"
          @click="selectLocale(option.code)"
          @mouseenter="activeIndex = index"
        >
          <span
            class="language-switcher__flag"
            aria-hidden="true"
            v-html="option.flagSvg"
          />
          <span class="language-switcher__meta">
            <span class="language-switcher__name">{{ option.name }}</span>
            <span class="language-switcher__short">{{ option.short }}</span>
          </span>
          <i
            v-if="option.code === selectedLocale"
            class="pi pi-check language-switcher__check"
            aria-hidden="true"
          />
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.language-switcher {
  position: relative;
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

.language-switcher--settings .language-switcher__trigger {
  min-height: 2.55rem;
  min-width: 6.75rem;
  padding: 0.4rem 0.7rem 0.4rem 0.6rem;
  border-radius: 0.8rem;
}

.language-switcher--settings .language-switcher__panel {
  right: 0;
  left: auto;
  min-width: 13.5rem;
}

.language-switcher--menu .language-switcher__list {
  padding: 0.2rem;
  border: 0;
  border-radius: 0.75rem;
  background: transparent;
  box-shadow: none;
}

.language-switcher--menu .language-switcher__option {
  min-height: 2.4rem;
  padding: 0.35rem 0.55rem;
  border-radius: 0.65rem;
}

.language-switcher--menu .language-switcher__name {
  font-size: 0.84rem;
}

.language-switcher__trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 2.4rem;
  padding: 0.35rem 0.65rem 0.35rem 0.55rem;
  border: 1px solid var(--ls-border);
  border-radius: 999px;
  background: var(--ls-bg);
  color: var(--ls-text);
  font: inherit;
  cursor: pointer;
  transition:
    border-color 160ms ease,
    background 160ms ease,
    box-shadow 160ms ease,
    transform 160ms ease;
}

.language-switcher__trigger:hover {
  border-color: color-mix(in srgb, var(--ls-active) 42%, var(--ls-border));
  background: var(--ls-hover);
}

.language-switcher__trigger:focus-visible {
  outline: none;
  border-color: var(--ls-active);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ls-active) 22%, transparent);
}

.language-switcher--open .language-switcher__trigger {
  border-color: color-mix(in srgb, var(--ls-active) 50%, var(--ls-border));
}

.language-switcher--auth.language-switcher--tone-brand .language-switcher__trigger {
  backdrop-filter: blur(8px);
}

.language-switcher__code {
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  line-height: 1;
}

.language-switcher__chevron {
  margin-left: 0.1rem;
  font-size: 0.7rem;
  color: var(--ls-muted);
  transition: transform 160ms ease;
}

.language-switcher--open .language-switcher__chevron {
  transform: rotate(180deg);
}

.language-switcher__panel,
.language-switcher__list {
  display: grid;
  gap: 0.2rem;
  padding: 0.35rem;
  border: 1px solid var(--ls-border);
  border-radius: 0.95rem;
  background: var(--ls-panel);
  box-shadow: var(--ls-shadow);
}

.language-switcher__panel {
  position: absolute;
  top: calc(100% + 0.4rem);
  right: 0;
  z-index: 40;
  min-width: 12.5rem;
  animation: language-switcher-in 140ms ease;
}

.language-switcher__list {
  box-shadow: none;
  background: color-mix(in srgb, var(--ls-active-soft) 55%, var(--ls-panel));
}

.language-switcher__option {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.65rem;
  width: 100%;
  min-height: 2.55rem;
  padding: 0.45rem 0.6rem;
  border: 1px solid transparent;
  border-radius: 0.7rem;
  background: transparent;
  color: var(--ls-panel-text, var(--ls-text));
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    background 140ms ease,
    border-color 140ms ease;
}

.language-switcher__option:hover,
.language-switcher__option--active {
  background: color-mix(in srgb, var(--ls-active) 10%, transparent);
}

.language-switcher__option:focus-visible {
  outline: none;
  border-color: color-mix(in srgb, var(--ls-active) 55%, transparent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--ls-active) 18%, transparent);
}

.language-switcher__option--selected {
  background: color-mix(in srgb, var(--ls-active) 14%, transparent);
  border-color: color-mix(in srgb, var(--ls-active) 28%, transparent);
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
  color: var(--ls-panel-text, var(--ls-text));
}

.language-switcher__short {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--ls-panel-muted, var(--ls-muted));
}

.language-switcher__flag {
  display: inline-flex;
  width: 1.4rem;
  height: 0.95rem;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: 0.2rem;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--ls-text) 14%, transparent);
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

@keyframes language-switcher-in {
  from {
    opacity: 0;
    transform: translateY(-0.2rem);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .language-switcher__trigger,
  .language-switcher__chevron,
  .language-switcher__option,
  .language-switcher__panel {
    transition: none;
    animation: none;
  }
}
</style>
