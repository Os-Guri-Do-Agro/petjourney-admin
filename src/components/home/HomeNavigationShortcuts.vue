<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import {
  filterNavigationGroups,
  useAppNavigation,
} from '@/composables/useAppNavigation'
import { currentColors } from '@/theme/color-mode'

const { t } = useI18n()
const filterQuery = ref('')
const { homeShortcutGroups } = useAppNavigation()

const styleVars = computed(() => {
  const colors = currentColors.value

  return {
    '--shortcuts-card': colors.dashboard.surface,
    '--shortcuts-surface': colors.dashboard.surfaceSoft,
    '--shortcuts-line': colors.dashboard.line,
    '--shortcuts-text': colors.dashboard.text,
    '--shortcuts-muted': colors.dashboard.muted,
    '--shortcuts-faint': colors.dashboard.faint,
    '--shortcuts-primary': colors.vet.primary,
    '--shortcuts-primary-soft': colors.vet.secondary,
    '--shortcuts-primary-strong': colors.dashboard.primaryStrong,
    '--shortcuts-shadow-rgb': colors.auth.shadowRgb,
  }
})

const filteredGroups = computed(() =>
  filterNavigationGroups(homeShortcutGroups.value, filterQuery.value),
)

const hasActiveFilter = computed(() => filterQuery.value.trim().length > 0)

const showEmptyFilter = computed(
  () => hasActiveFilter.value && filteredGroups.value.length === 0,
)

const totalShortcuts = computed(() =>
  homeShortcutGroups.value.reduce((sum, group) => sum + group.items.length, 0),
)
</script>

<template>
  <section class="home-shortcuts" :style="styleVars" aria-labelledby="home-shortcuts-title">
    <header class="home-shortcuts__head">
      <div class="home-shortcuts__title-row">
        <p class="home-shortcuts__index">03</p>
        <h2 id="home-shortcuts-title">{{ t('inicio.shortcuts.title') }}</h2>
        <span class="home-shortcuts__count">{{
          t('inicio.shortcuts.countAvailable', { n: totalShortcuts })
        }}</span>
      </div>
      <p>{{ t('inicio.shortcuts.lede') }}</p>
    </header>

    <div class="home-shortcuts__panel">
      <label class="home-shortcuts__filter" for="home-shortcuts-filter">
        <i class="pi pi-search" aria-hidden="true" />
        <input
          id="home-shortcuts-filter"
          v-model="filterQuery"
          type="search"
          :placeholder="t('inicio.shortcuts.filterPlaceholder')"
          autocomplete="off"
        />
        <button
          v-if="hasActiveFilter"
          class="home-shortcuts__clear"
          type="button"
          :aria-label="t('inicio.shortcuts.clearFilterAria')"
          @click="filterQuery = ''"
        >
          <i class="pi pi-times" aria-hidden="true" />
        </button>
      </label>

      <p v-if="showEmptyFilter" class="home-shortcuts__empty" role="status">
        {{ t('inicio.shortcuts.emptyFilter', { q: filterQuery.trim() }) }}
      </p>

      <div v-else class="home-shortcuts__groups">
        <div v-for="group in filteredGroups" :key="group.id" class="home-shortcuts__group">
          <h3>{{ group.label }}</h3>
          <div class="home-shortcuts__grid">
            <RouterLink
              v-for="item in group.items"
              :key="`${group.id}-${item.to}`"
              class="shortcut-card"
              :to="item.to"
            >
              <span class="shortcut-card__icon" aria-hidden="true">
                <i :class="item.icon" />
              </span>
              <span class="shortcut-card__body">
                <strong>{{ item.label }}</strong>
                <small>{{ group.label }}</small>
              </span>
              <i class="pi pi-arrow-right shortcut-card__arrow" aria-hidden="true" />
            </RouterLink>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.home-shortcuts {
  display: grid;
  gap: 0.9rem;
  width: 100%;
}

.home-shortcuts__head {
  display: grid;
  gap: 0.28rem;
  padding-bottom: 0.55rem;
  border-bottom: 1px solid color-mix(in srgb, var(--shortcuts-line) 85%, transparent);
}

.home-shortcuts__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.55rem;
}

.home-shortcuts__index {
  margin: 0;
  color: var(--shortcuts-faint);
  font-size: 0.72rem;
  font-weight: 750;
  letter-spacing: 0.08em;
}

.home-shortcuts__head h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--shortcuts-text);
}

.home-shortcuts__head > p {
  margin: 0;
  color: var(--shortcuts-muted);
  font-size: 0.82rem;
  line-height: 1.4;
}

.home-shortcuts__count {
  flex: 0 0 auto;
  padding: 0.22rem 0.58rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--shortcuts-primary-soft) 35%, var(--shortcuts-card));
  color: var(--shortcuts-primary-strong);
  font-size: 0.7rem;
  font-weight: 700;
  white-space: nowrap;
}

.home-shortcuts__panel {
  display: grid;
  gap: 1rem;
  width: 100%;
  padding: 1.15rem 1.2rem 1.25rem;
  border: 1px solid var(--shortcuts-line);
  border-radius: 1.2rem;
  background: var(--shortcuts-card);
  box-shadow: 0 12px 28px rgb(var(--shortcuts-shadow-rgb) / 0.04);
}

.home-shortcuts__filter {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  min-height: 2.85rem;
  padding: 0 0.35rem 0 0.9rem;
  border: 1px solid var(--shortcuts-line);
  border-radius: 0.9rem;
  background: var(--shortcuts-surface);
  color: var(--shortcuts-muted);
  transition:
    border-color 140ms ease,
    box-shadow 140ms ease;
}

.home-shortcuts__filter:focus-within {
  border-color: color-mix(in srgb, var(--shortcuts-primary) 42%, var(--shortcuts-line));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--shortcuts-primary) 14%, transparent);
}

.home-shortcuts__filter > i {
  font-size: 0.9rem;
}

.home-shortcuts__filter input {
  width: 100%;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--shortcuts-text);
  font: inherit;
  font-size: 0.9rem;
  outline: none;
}

.home-shortcuts__filter input::placeholder {
  color: var(--shortcuts-faint);
}

.home-shortcuts__clear {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  flex: 0 0 auto;
  place-items: center;
  margin-right: 0.15rem;
  border: 0;
  border-radius: 0.65rem;
  background: var(--shortcuts-card);
  color: var(--shortcuts-muted);
  cursor: pointer;
}

.home-shortcuts__clear:hover,
.home-shortcuts__clear:focus-visible {
  color: var(--shortcuts-primary-strong);
  outline: none;
}

.home-shortcuts__empty {
  margin: 0;
  padding: 1rem;
  border: 1px dashed var(--shortcuts-line);
  border-radius: 0.9rem;
  color: var(--shortcuts-muted);
  font-size: 0.88rem;
  line-height: 1.45;
}

.home-shortcuts__groups {
  display: grid;
  gap: 1.15rem;
}

.home-shortcuts__group h3 {
  margin: 0 0 0.55rem;
  color: var(--shortcuts-faint);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.home-shortcuts__grid {
  display: grid;
  gap: 0.7rem;
  width: 100%;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.shortcut-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 4.1rem;
  padding: 0.8rem 0.9rem;
  border: 1px solid var(--shortcuts-line);
  border-radius: 0.95rem;
  background: color-mix(in srgb, var(--shortcuts-surface) 70%, var(--shortcuts-card));
  color: inherit;
  text-decoration: none;
  transition:
    border-color 150ms ease,
    background 150ms ease,
    transform 150ms ease;
}

.shortcut-card:hover,
.shortcut-card:focus-visible {
  border-color: color-mix(in srgb, var(--shortcuts-primary) 36%, var(--shortcuts-line));
  background: color-mix(in srgb, var(--shortcuts-primary-soft) 20%, var(--shortcuts-card));
  outline: none;
  transform: translateY(-1px);
}

.shortcut-card:hover .shortcut-card__arrow,
.shortcut-card:focus-visible .shortcut-card__arrow {
  transform: translateX(3px);
  color: var(--shortcuts-primary-strong);
}

.shortcut-card__icon {
  display: grid;
  width: 2.4rem;
  height: 2.4rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.75rem;
  background: color-mix(in srgb, var(--shortcuts-primary) 15%, var(--shortcuts-card));
  color: var(--shortcuts-primary-strong);
  font-size: 0.95rem;
}

.shortcut-card__body {
  display: grid;
  gap: 0.12rem;
  min-width: 0;
  flex: 1;
}

.shortcut-card__body strong {
  color: var(--shortcuts-text);
  font-size: 0.92rem;
  font-weight: 700;
}

.shortcut-card__body small {
  color: var(--shortcuts-muted);
  font-size: 0.74rem;
}

.shortcut-card__arrow {
  color: var(--shortcuts-faint);
  font-size: 0.78rem;
  transition:
    transform 150ms ease,
    color 150ms ease;
}

@media (prefers-reduced-motion: reduce) {
  .shortcut-card:hover,
  .shortcut-card:focus-visible {
    transform: none;
  }
}

@media (max-width: 980px) {
  .home-shortcuts__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .home-shortcuts__grid {
    grid-template-columns: 1fr;
  }
}
</style>
