<script setup lang="ts">
import { onMounted, watch } from 'vue'
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

const route = useRoute()
const router = useRouter()
const { activeTab, setTab } = usePartnerTabs(SETTINGS_TABS, 'perfil')

const tabs = [
  {
    id: 'perfil',
    label: 'Perfil',
    description: 'Nome, contatos, documento e dados profissionais.',
  },
  {
    id: 'seguranca',
    label: 'Segurança',
    description: 'Troca de senha da conta autenticada.',
  },
  {
    id: 'conta',
    label: 'Conta',
    description: 'Sessão, desativação de perfil e preferências futuras.',
  },
]

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
  <PartnerPageFrame subtitle="Conta" title="Configurações" :loading="false">
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
