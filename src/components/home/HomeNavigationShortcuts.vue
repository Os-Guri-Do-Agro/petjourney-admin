<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'

import {
  filterNavigationGroups,
  useAppNavigation,
} from '@/composables/useAppNavigation'
import { currentColors } from '@/theme/color-mode'

const filterQuery = ref('')
const { homeShortcutGroups } = useAppNavigation()

const styleVars = computed(() => {
  const colors = currentColors.value

  return {
    '--shortcuts-card': colors.dashboard.surface,
    '--shortcuts-surface': colors.dashboard.surfaceSoft,
    '--shortcuts-line': colors.dashboard.line,
    '--shortcuts-line-soft': colors.dashboard.lineSoft,
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
      <div>
        <h2 id="home-shortcuts-title">Atalhos</h2>
        <p>Encontre qualquer tela pelo nome ou pela seção.</p>
      </div>
      <span class="home-shortcuts__count">{{ totalShortcuts }} disponíveis</span>
    </header>

    <label class="home-shortcuts__filter" for="home-shortcuts-filter">
      <i class="pi pi-search" aria-hidden="true" />
      <input
        id="home-shortcuts-filter"
        v-model="filterQuery"
        type="search"
        placeholder="Filtrar por tela ou seção..."
        autocomplete="off"
      />
      <button
        v-if="hasActiveFilter"
        class="home-shortcuts__clear"
        type="button"
        aria-label="Limpar filtro"
        @click="filterQuery = ''"
      >
        <i class="pi pi-times" aria-hidden="true" />
      </button>
    </label>

    <p v-if="showEmptyFilter" class="home-shortcuts__empty" role="status">
      Nenhuma tela encontrada para “{{ filterQuery.trim() }}”.
    </p>

    <div v-else class="home-shortcuts__groups">
      <div v-for="group in filteredGroups" :key="group.id" class="home-shortcuts__group">
        <h3>{{ group.label }}</h3>
        <div class="home-shortcuts__grid">
          <RouterLink
            v-for="(item, index) in group.items"
            :key="`${group.id}-${item.to}`"
            class="shortcut-card"
            :to="item.to"
            :style="{ '--shortcut-delay': `${index * 35}ms` }"
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
  </section>
</template>

<style scoped>
.home-shortcuts {
  display: grid;
  gap: 1rem;
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
}

.home-shortcuts__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
}

.home-shortcuts__head h2 {
  margin: 0;
  font-size: 0.98rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--shortcuts-text);
}

.home-shortcuts__head p {
  margin: 0.2rem 0 0;
  max-width: 36rem;
  color: var(--shortcuts-muted);
  font-size: 0.84rem;
  line-height: 1.4;
}

.home-shortcuts__count {
  flex: 0 0 auto;
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--shortcuts-primary-soft) 35%, var(--shortcuts-card));
  color: var(--shortcuts-primary-strong);
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
}

.home-shortcuts__filter {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  min-height: 3rem;
  padding: 0 0.35rem 0 0.95rem;
  border: 1px solid var(--shortcuts-line);
  border-radius: 1rem;
  background: var(--shortcuts-card);
  color: var(--shortcuts-muted);
  box-shadow: 0 12px 28px rgb(var(--shortcuts-shadow-rgb) / 0.04);
  transition:
    border-color 140ms ease,
    box-shadow 140ms ease;
}

.home-shortcuts__filter:focus-within {
  border-color: color-mix(in srgb, var(--shortcuts-primary) 42%, var(--shortcuts-line));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--shortcuts-primary) 14%, transparent);
}

.home-shortcuts__filter > i {
  font-size: 0.92rem;
}

.home-shortcuts__filter input {
  width: 100%;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--shortcuts-text);
  font: inherit;
  font-size: 0.92rem;
  outline: none;
}

.home-shortcuts__filter input::placeholder {
  color: var(--shortcuts-faint);
}

.home-shortcuts__clear {
  display: grid;
  width: 2.35rem;
  height: 2.35rem;
  flex: 0 0 auto;
  place-items: center;
  margin-right: 0.2rem;
  border: 0;
  border-radius: 0.7rem;
  background: var(--shortcuts-surface);
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
  padding: 1.15rem 1.2rem;
  border: 1px dashed var(--shortcuts-line);
  border-radius: 1rem;
  background: color-mix(in srgb, var(--shortcuts-surface) 70%, transparent);
  color: var(--shortcuts-muted);
  font-size: 0.88rem;
  line-height: 1.45;
}

.home-shortcuts__groups {
  display: grid;
  gap: 1.25rem;
}

.home-shortcuts__group h3 {
  margin: 0 0 0.65rem;
  color: var(--shortcuts-faint);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.home-shortcuts__grid {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.shortcut-card {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  min-height: 4.35rem;
  padding: 0.85rem 0.95rem;
  border: 1px solid var(--shortcuts-line);
  border-radius: 1.05rem;
  background: var(--shortcuts-card);
  box-shadow: 0 12px 26px rgb(var(--shortcuts-shadow-rgb) / 0.04);
  color: inherit;
  text-decoration: none;
  animation: shortcut-rise 400ms ease both;
  animation-delay: var(--shortcut-delay, 0ms);
  transition:
    border-color 150ms ease,
    background 150ms ease,
    transform 150ms ease,
    box-shadow 150ms ease;
}

.shortcut-card:hover,
.shortcut-card:focus-visible {
  border-color: color-mix(in srgb, var(--shortcuts-primary) 36%, var(--shortcuts-line));
  background: color-mix(in srgb, var(--shortcuts-primary-soft) 20%, var(--shortcuts-card));
  box-shadow: 0 16px 32px rgb(var(--shortcuts-shadow-rgb) / 0.07);
  outline: none;
  transform: translateY(-2px);
}

.shortcut-card:hover .shortcut-card__arrow,
.shortcut-card:focus-visible .shortcut-card__arrow {
  transform: translateX(3px);
  color: var(--shortcuts-primary-strong);
}

.shortcut-card__icon {
  display: grid;
  width: 2.55rem;
  height: 2.55rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.85rem;
  background: color-mix(in srgb, var(--shortcuts-primary) 15%, var(--shortcuts-card));
  color: var(--shortcuts-primary-strong);
  font-size: 1rem;
}

.shortcut-card__body {
  display: grid;
  gap: 0.14rem;
  min-width: 0;
  flex: 1;
}

.shortcut-card__body strong {
  color: var(--shortcuts-text);
  font-size: 0.94rem;
  font-weight: 700;
}

.shortcut-card__body small {
  color: var(--shortcuts-muted);
  font-size: 0.76rem;
}

.shortcut-card__arrow {
  color: var(--shortcuts-faint);
  font-size: 0.8rem;
  transition:
    transform 150ms ease,
    color 150ms ease;
}

@keyframes shortcut-rise {
  from {
    opacity: 0;
    transform: translateY(6px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .shortcut-card {
    animation: none;
  }

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

  .home-shortcuts__head {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
