<script setup lang="ts">
import Tab from 'primevue/tab'
import TabList from 'primevue/tablist'
import Tabs from 'primevue/tabs'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { currentColors, isDarkMode } from '@/theme/color-mode'

export type PartnerTabItem = {
  id: string
  label: string
  description?: string
}

const props = defineProps<{
  tabs: PartnerTabItem[]
  activeTab: string
  ariaLabel?: string
}>()

const emit = defineEmits<{
  select: [tabId: string]
}>()

const { t } = useI18n()

const tabStyle = computed(() => {
  const colors = currentColors.value

  return {
    '--tab-line': colors.dashboard.line,
    '--tab-muted': colors.dashboard.muted,
    '--tab-text': colors.dashboard.text,
    '--tab-active': colors.vet.primary,
    '--tab-active-soft': colors.vet.secondary,
    '--tab-active-strong': colors.dashboard.primaryStrong,
    '--tab-on-active': isDarkMode.value ? colors.text.primary : colors.auth.white,
    '--tab-faint': colors.dashboard.faint,
  }
})

const activeDescription = computed(
  () => props.tabs.find((tab) => tab.id === props.activeTab)?.description ?? '',
)

const resolvedAriaLabel = computed(
  () =>
    props.ariaLabel ??
    t('frame.tabs.aria', { labels: props.tabs.map((tab) => tab.label).join(', ') }),
)
</script>

<template>
  <div class="partner-tabs" :style="tabStyle">
    <!--
      Tabs só controla a faixa de abas: os painéis ficam nas páginas (id "partner-panel-*"),
      por isso id/aria-controls do Tab são sobrescritos para manter o vínculo a11y existente.
    -->
    <Tabs :value="activeTab" @update:value="(value) => emit('select', String(value))">
      <TabList
        class="partner-tabs__list"
        :pt="{ tabList: { 'aria-label': resolvedAriaLabel } }"
      >
        <Tab
          v-for="tab in tabs"
          :id="`partner-tab-${tab.id}`"
          :key="tab.id"
          class="partner-tabs__button"
          :value="tab.id"
          :aria-controls="`partner-panel-${tab.id}`"
        >
          {{ tab.label }}
        </Tab>
      </TabList>
    </Tabs>
    <p v-if="activeDescription" class="partner-tabs__description">{{ activeDescription }}</p>
  </div>
</template>

<style scoped>
.partner-tabs {
  display: grid;
  gap: 0.65rem;
  margin-bottom: 1rem;
}

.partner-tabs__list.p-tablist {
  overflow: visible;
  background: transparent;
}

.partner-tabs__list :deep(.p-tablist-tab-list) {
  flex-wrap: wrap;
  gap: 0.35rem;
  padding: 0.28rem;
  border: 1px solid var(--tab-line);
  border-radius: 0.85rem;
  background: color-mix(in srgb, var(--tab-active-soft) 10%, transparent);
}

/* O destaque é a pílula da aba ativa — a barra deslizante do Aura não se aplica. */
.partner-tabs__list :deep(.p-tablist-active-bar) {
  display: none;
}

.partner-tabs__button.p-tab {
  margin: 0;
  padding: 0.48rem 0.9rem;
  border: 1px solid transparent;
  border-radius: 0.62rem;
  background: transparent;
  color: var(--tab-muted);
  font-size: 0.84rem;
  font-weight: 650;
}

.partner-tabs__button.p-tab:not(.p-tab-active):not(.p-disabled):hover {
  border-color: transparent;
  background: color-mix(in srgb, var(--tab-active-soft) 35%, transparent);
  color: var(--tab-text);
}

.partner-tabs__button.p-tab-active {
  border-color: color-mix(in srgb, var(--tab-active-strong) 35%, transparent);
  background: var(--tab-active);
  color: var(--tab-on-active);
}

.partner-tabs__button.p-tab-active:hover {
  background: var(--tab-active-strong);
  color: var(--tab-on-active);
}

.partner-tabs__description {
  margin: 0;
  color: var(--tab-faint);
  font-size: 0.84rem;
}
</style>
