<script setup lang="ts">
/**
 * Atalhos da visão geral: um caminho para cada tela do painel.
 *
 * A versão anterior desenhava três colunas fixas. Como os grupos têm tamanhos muito diferentes
 * — oito telas em Clínica, uma em Conta —, a última linha de cada grupo sobrava pela metade e
 * o conjunto lia como cartão espalhado, não como lista organizada. Aqui a grade se preenche
 * sozinha a partir de uma largura mínima: os cartões têm sempre o mesmo tamanho e encostam uns
 * nos outros, que é o que faz um painel parecer arrumado.
 *
 * Duas coisas saíram do cartão, e as duas por serem repetição:
 *
 * - **O nome do grupo embaixo de cada tela.** Ele já está no título do grupo, três centímetros
 *   acima; repetido em cada cartão, dobrava a altura de todos para não dizer nada.
 * - **O texto de apoio da seção.** Continua existindo, atrás do botão de ajuda do cabeçalho da
 *   página — quem precisa dele precisa uma vez, e quem trabalha aqui todo dia não precisa nunca.
 *
 * Com o cartão em uma linha só, a mesma área que mostrava seis telas mostra doze — e a busca,
 * que antes ocupava uma faixa inteira, cabe ao lado do título.
 */
import Button from 'primevue/button'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import {
  filterNavigationGroups,
  useAppNavigation,
  type AppNavigationItem,
} from '@/composables/useAppNavigation'
import { useCupomComingSoon } from '@/composables/useCupomComingSoon'
import { isGuidanceVisible } from '@/composables/useLayoutPreferences'
import { currentColors } from '@/theme/color-mode'

const { t } = useI18n()
const filterQuery = ref('')
const { homeShortcutGroups } = useAppNavigation()
const { open: openCupomComingSoon } = useCupomComingSoon()

function handleShortcutClick(event: Event, item: AppNavigationItem) {
  if (!item.comingSoon) {
    return
  }

  event.preventDefault()
  openCupomComingSoon()
}

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

const showEmptyFilter = computed(() => hasActiveFilter.value && filteredGroups.value.length === 0)

const totalShortcuts = computed(() =>
  homeShortcutGroups.value.reduce((sum, group) => sum + group.items.length, 0),
)
</script>

<template>
  <section class="home-shortcuts" :style="styleVars" aria-labelledby="home-shortcuts-title">
    <header class="home-shortcuts__head">
      <div class="home-shortcuts__title-row">
        <h2 id="home-shortcuts-title">{{ t('inicio.shortcuts.title') }}</h2>
        <span class="home-shortcuts__count">{{
          t('inicio.shortcuts.countAvailable', { n: totalShortcuts }, totalShortcuts)
        }}</span>

        <!-- A busca cabe ao lado do título: com quinze telas ela é conveniência, não estrutura. -->
        <div class="home-shortcuts__filter">
          <IconField class="home-shortcuts__filter-field">
            <InputIcon class="pi pi-search" />
            <InputText
              id="home-shortcuts-filter"
              v-model="filterQuery"
              type="search"
              size="small"
              fluid
              :placeholder="t('inicio.shortcuts.filterPlaceholder')"
              :aria-label="t('inicio.shortcuts.filterPlaceholder')"
              autocomplete="off"
            />
          </IconField>
          <Button
            v-if="hasActiveFilter"
            class="home-shortcuts__clear"
            type="button"
            text
            severity="secondary"
            icon="pi pi-times"
            :aria-label="t('inicio.shortcuts.clearFilterAria')"
            @click="filterQuery = ''"
          />
        </div>
      </div>

      <p v-if="isGuidanceVisible" class="home-shortcuts__lede">
        {{ t('inicio.shortcuts.lede') }}
      </p>
    </header>

    <div class="home-shortcuts__panel">
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
              :class="{
                'shortcut-card--soon': item.comingSoon,
                'shortcut-card--locked': item.locked,
              }"
              :to="item.to"
              @click="handleShortcutClick($event, item)"
            >
              <span class="shortcut-card__icon" aria-hidden="true">
                <i :class="item.icon" />
              </span>

              <span class="shortcut-card__label">{{ item.label }}</span>

              <!--
                O estado vira selo ao lado do nome, e não segunda linha: "Em breve" embaixo de
                cada atalho fazia todos os cartões pagarem a altura de um estado que só dois
                deles têm.
              -->
              <span v-if="item.comingSoon" class="shortcut-card__selo">
                {{ t('comingSoon.cupom.badge') }}
              </span>
              <i
                v-else
                class="shortcut-card__arrow"
                :class="item.locked ? 'pi pi-lock' : 'pi pi-arrow-right'"
                aria-hidden="true"
              />
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
  gap: 0.75rem;
  width: 100%;
}

.home-shortcuts__head {
  display: grid;
  gap: 0.35rem;
}

.home-shortcuts__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.55rem;
}

.home-shortcuts__head h2 {
  margin: 0;
  color: var(--shortcuts-text);
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.home-shortcuts__lede {
  margin: 0;
  color: var(--shortcuts-muted);
  font-size: 0.82rem;
  line-height: 1.4;
}

.home-shortcuts__count {
  flex: 0 0 auto;
  padding: 0.18rem 0.55rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--shortcuts-primary-soft) 35%, var(--shortcuts-card));
  color: var(--shortcuts-primary-strong);
  font-size: 0.68rem;
  font-weight: 700;
  white-space: nowrap;
}

.home-shortcuts__panel {
  display: grid;
  gap: 1rem;
  width: 100%;
  padding: 1.05rem 1.1rem 1.15rem;
  border: 1px solid var(--shortcuts-line);
  border-radius: 1.2rem;
  background: var(--shortcuts-card);
  box-shadow: 0 12px 28px rgb(var(--shortcuts-shadow-rgb) / 0.04);
}

.home-shortcuts__filter {
  display: flex;
  width: min(16rem, 100%);
  align-items: center;
  min-height: 2.2rem;
  margin-inline-start: auto;
  padding-block: 0;
  padding-inline: 0 0.2rem;
  gap: 0.2rem;
  border: 1px solid var(--shortcuts-line);
  border-radius: 0.75rem;
  background: var(--shortcuts-card);
  color: var(--shortcuts-muted);
  transition:
    border-color 140ms ease,
    box-shadow 140ms ease;
}

.home-shortcuts__filter:focus-within {
  border-color: color-mix(in srgb, var(--shortcuts-primary) 42%, var(--shortcuts-line));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--shortcuts-primary) 14%, transparent);
}

/* A caixa e o anel de foco são do `.home-shortcuts__filter`; o campo do PrimeVue fica sem borda. */
.home-shortcuts__filter-field {
  min-width: 0;
  flex: 1 1 auto;
  color: var(--shortcuts-muted);
}

.home-shortcuts__filter-field :deep(.p-inputicon) {
  color: inherit;
  font-size: 0.82rem;
}

.home-shortcuts__filter-field :deep(.p-inputtext),
.home-shortcuts__filter-field :deep(.p-inputtext:enabled:hover),
.home-shortcuts__filter-field :deep(.p-inputtext:enabled:focus) {
  padding-block: 0.4rem;
  border: 0;
  background: transparent;
  box-shadow: none;
  color: var(--shortcuts-text);
  font-size: 0.82rem;
  outline: none;
}

.home-shortcuts__filter-field :deep(.p-inputtext::placeholder) {
  color: var(--shortcuts-faint);
}

.home-shortcuts__clear.p-button {
  width: 1.75rem;
  height: 1.75rem;
  flex: 0 0 auto;
  padding: 0;
  border-radius: 0.55rem;
  color: var(--shortcuts-muted);
}

.home-shortcuts__clear.p-button:not(:disabled):hover,
.home-shortcuts__clear.p-button:not(:disabled):active,
.home-shortcuts__clear.p-button:focus-visible {
  background: transparent;
  box-shadow: none;
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
  gap: 1.05rem;
}

/*
 * O título do grupo puxa um filete até a borda. É o que separa quatro blocos empilhados sem
 * gastar uma caixa para cada um — caixa dentro de caixa é o que fazia a área parecer cheia.
 */
.home-shortcuts__group h3 {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin: 0 0 0.5rem;
  color: var(--shortcuts-faint);
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.home-shortcuts__group h3::after {
  height: 1px;
  flex: 1;
  background: color-mix(in srgb, var(--shortcuts-line) 80%, transparent);
  content: '';
}

/*
 * Preenchimento automático em vez de três colunas fixas.
 *
 * Com número fixo, um grupo de oito deixa dois buracos na última linha e um grupo de um deixa
 * dois terços vazios — é daí que vinha a sensação de cartão jogado. Com `auto-fill` a largura
 * mínima manda: sobra espaço, entra mais uma coluna; falta, sai uma.
 */
.home-shortcuts__grid {
  display: grid;
  width: 100%;
  gap: 0.55rem;
  grid-template-columns: repeat(auto-fill, minmax(12.5rem, 1fr));
}

.shortcut-card {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.6rem;
  min-height: 2.9rem;
  padding-block: 0.4rem;
  padding-inline: 0.45rem 0.7rem;
  border: 1px solid var(--shortcuts-line);
  border-radius: 0.8rem;
  background: color-mix(in srgb, var(--shortcuts-surface) 70%, var(--shortcuts-card));
  color: inherit;
  text-decoration: none;
  transition:
    border-color 150ms ease,
    background 150ms ease;
}

.shortcut-card:hover,
.shortcut-card:focus-visible {
  border-color: color-mix(in srgb, var(--shortcuts-primary) 36%, var(--shortcuts-line));
  background: color-mix(in srgb, var(--shortcuts-primary-soft) 20%, var(--shortcuts-card));
  outline: none;
}

.shortcut-card--locked {
  opacity: 0.78;
}

.shortcut-card:hover .shortcut-card__arrow,
.shortcut-card:focus-visible .shortcut-card__arrow {
  color: var(--shortcuts-primary-strong);
  transform: translateX(3px);
}

.shortcut-card__icon {
  display: grid;
  width: 2rem;
  height: 2rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.6rem;
  background: color-mix(in srgb, var(--shortcuts-primary) 15%, var(--shortcuts-card));
  color: var(--shortcuts-primary-strong);
  font-size: 0.86rem;
}

.shortcut-card__label {
  overflow: hidden;
  flex: 1;
  min-width: 0;
  color: var(--shortcuts-text);
  font-size: 0.86rem;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shortcut-card__selo {
  flex: 0 0 auto;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--shortcuts-primary-soft) 40%, var(--shortcuts-card));
  color: var(--shortcuts-primary-strong);
  font-size: 0.6rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.shortcut-card__arrow {
  flex: 0 0 auto;
  color: var(--shortcuts-faint);
  font-size: 0.74rem;
  transition:
    transform 150ms ease,
    color 150ms ease;
}

@media (prefers-reduced-motion: reduce) {
  .shortcut-card__arrow {
    transition: none;
  }

  .shortcut-card:hover .shortcut-card__arrow,
  .shortcut-card:focus-visible .shortcut-card__arrow {
    transform: none;
  }
}

@media (max-width: 720px) {
  .home-shortcuts__filter {
    width: 100%;
    margin-inline-start: 0;
  }

  .home-shortcuts__grid {
    grid-template-columns: 1fr;
  }
}
</style>
