<script setup lang="ts">
import { computed, onMounted } from 'vue'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import PartnerOperabilityBanner from '@/components/parceiro/PartnerOperabilityBanner.vue'
import PartnerSectionTabs from '@/components/parceiro/PartnerSectionTabs.vue'
import PortalCredenciamentoPanel from '@/components/parceiro/panels/PortalCredenciamentoPanel.vue'
import PortalModoPanel from '@/components/parceiro/panels/PortalModoPanel.vue'
import PortalVisaoPanel from '@/components/parceiro/panels/PortalVisaoPanel.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { usePartnerTabs } from '@/composables/usePartnerTabs'

const PROGRAMAS_TABS = ['visao', 'credenciamento', 'afiliado', 'participativo'] as const
type ProgramasTab = (typeof PROGRAMAS_TABS)[number]

const { store, bootstrapping, ensureContext } = useParceiroPortal()
const { activeTab, setTab } = usePartnerTabs(PROGRAMAS_TABS, 'visao')

const tabs = [
  {
    id: 'visao',
    label: 'Visão geral',
    description: 'Resumo da parceria, métricas e status.',
  },
  {
    id: 'credenciamento',
    label: 'Credenciamento',
    description: 'Situação da empresa e liberação para operar.',
  },
  {
    id: 'afiliado',
    label: 'Afiliado',
    description: 'Comissões por indicação e acesso ao financeiro.',
  },
  {
    id: 'participativo',
    label: 'Participativo',
    description: 'Selo e benefícios de comunidade (sem carteira).',
  },
]

const loadError = computed(() =>
  store.loadState === 'error' ? store.errorMessage : '',
)

onMounted(() => {
  void ensureContext()
})
</script>

<template>
  <PartnerPageFrame
    subtitle="Portal"
    title="Programas e credenciamento"
    :loading="bootstrapping || store.loadState === 'loading'"
    :error="loadError"
    @retry="ensureContext(true)"
  >
    <PartnerOperabilityBanner />

    <PartnerSectionTabs :tabs="tabs" :active-tab="activeTab" @select="setTab($event as ProgramasTab)" />

    <PortalVisaoPanel v-if="activeTab === 'visao'" />
    <PortalCredenciamentoPanel v-else-if="activeTab === 'credenciamento'" />
    <PortalModoPanel v-else-if="activeTab === 'afiliado'" modo="afiliado" />
    <PortalModoPanel v-else modo="participativo" />
  </PartnerPageFrame>
</template>
