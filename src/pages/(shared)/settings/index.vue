<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import PartnerSectionTabs from '@/components/parceiro/PartnerSectionTabs.vue'
import SettingsContaPanel from '@/components/settings/SettingsContaPanel.vue'
import SettingsPerfilPanel from '@/components/settings/SettingsPerfilPanel.vue'
import SettingsSegurancaPanel from '@/components/settings/SettingsSegurancaPanel.vue'
import { usePartnerTabs } from '@/composables/usePartnerTabs'

const SETTINGS_TABS = ['perfil', 'seguranca', 'conta'] as const
type SettingsTab = (typeof SETTINGS_TABS)[number]

const HASH_TO_TAB: Record<string, SettingsTab> = {
  perfil: 'perfil',
  seguranca: 'seguranca',
  segurança: 'seguranca',
  conta: 'conta',
}

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { activeTab, setTab } = usePartnerTabs(SETTINGS_TABS, 'perfil')

const tabs = computed(() => [
  {
    id: 'perfil',
    label: t('settings.tabs.perfil.label'),
    description: t('settings.tabs.perfil.description'),
  },
  {
    id: 'seguranca',
    label: t('settings.tabs.seguranca.label'),
    description: t('settings.tabs.seguranca.description'),
  },
  {
    id: 'conta',
    label: t('settings.tabs.conta.label'),
    description: t('settings.tabs.conta.description'),
  },
])

async function resolveLegacyHash() {
  const hashId = route.hash.replace('#', '').trim().toLowerCase()

  if (!hashId || !(hashId in HASH_TO_TAB)) {
    return
  }

  const tab = HASH_TO_TAB[hashId]!
  const nextQuery = { ...route.query }

  if (tab === 'perfil') {
    delete nextQuery.aba
  } else {
    nextQuery.aba = tab
  }

  await router.replace({
    path: '/settings',
    query: nextQuery,
    hash: '',
  })
}

onMounted(() => {
  void resolveLegacyHash()
})

watch(
  () => route.hash,
  () => {
    void resolveLegacyHash()
  },
)
</script>

<template>
  <PartnerPageFrame
    :subtitle="t('settings.subtitle')"
    :title="t('settings.title')"
    :loading="false"
  >
    <PartnerSectionTabs
      :tabs="tabs"
      :active-tab="activeTab"
      @select="setTab($event as SettingsTab)"
    />

    <SettingsPerfilPanel v-if="activeTab === 'perfil'" />
    <SettingsSegurancaPanel v-else-if="activeTab === 'seguranca'" />
    <SettingsContaPanel v-else />
  </PartnerPageFrame>
</template>
