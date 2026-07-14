<script setup lang="ts">
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
    <div class="partner-tabs__list" role="tablist" :aria-label="resolvedAriaLabel">
      <button
        v-for="tab in tabs"
        :id="`partner-tab-${tab.id}`"
        :key="tab.id"
        class="partner-tabs__button"
        :class="{ 'partner-tabs__button--active': activeTab === tab.id }"
        type="button"
        role="tab"
        :aria-selected="activeTab === tab.id"
        :aria-controls="`partner-panel-${tab.id}`"
        @click="emit('select', tab.id)"
      >
        {{ tab.label }}
      </button>
    </div>
    <p v-if="activeDescription" class="partner-tabs__description">{{ activeDescription }}</p>
  </div>
</template>

<style scoped>
.partner-tabs {
  display: grid;
  gap: 0.65rem;
  margin-bottom: 1rem;
}

.partner-tabs__list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  padding: 0.28rem;
  border: 1px solid var(--tab-line);
  border-radius: 0.85rem;
  background: color-mix(in srgb, var(--tab-active-soft) 10%, transparent);
}

.partner-tabs__button {
  padding: 0.48rem 0.9rem;
  border: 1px solid transparent;
  border-radius: 0.62rem;
  background: transparent;
  color: var(--tab-muted);
  font-size: 0.84rem;
  font-weight: 650;
  cursor: pointer;
  transition: background 140ms ease, color 140ms ease, border-color 140ms ease;
}

.partner-tabs__button:hover {
  color: var(--tab-text);
  background: color-mix(in srgb, var(--tab-active-soft) 35%, transparent);
}

.partner-tabs__button--active {
  border-color: color-mix(in srgb, var(--tab-active-strong) 35%, transparent);
  background: var(--tab-active);
  color: var(--tab-on-active);
}

.partner-tabs__button--active:hover {
  color: var(--tab-on-active);
  background: var(--tab-active-strong);
}

.partner-tabs__description {
  margin: 0;
  color: var(--tab-faint);
  font-size: 0.84rem;
}
</style>
