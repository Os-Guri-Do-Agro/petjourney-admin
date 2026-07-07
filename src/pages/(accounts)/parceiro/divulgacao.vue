<script setup lang="ts">
import { computed, onMounted } from 'vue'

import PartnerOperabilityBanner from '@/components/parceiro/PartnerOperabilityBanner.vue'
import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import PartnerSectionTabs from '@/components/parceiro/PartnerSectionTabs.vue'
import PortalDivulgacaoPanel from '@/components/parceiro/panels/PortalDivulgacaoPanel.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { usePartnerTabs } from '@/composables/usePartnerTabs'

const DIVULGACAO_TABS = ['indicacao', 'cupons', 'resgates'] as const
type DivulgacaoTab = (typeof DIVULGACAO_TABS)[number]

const { store, bootstrapping, ensureContext } = useParceiroPortal()
const { activeTab, setTab } = usePartnerTabs(DIVULGACAO_TABS, 'indicacao')

const tabs = [
  {
    id: 'indicacao',
    label: 'Indicação',
    description: 'Código, link e QR para atrair assinantes.',
  },
  {
    id: 'cupons',
    label: 'Cupons',
    description: 'Descontos da empresa — não geram comissão.',
  },
  {
    id: 'resgates',
    label: 'Resgates',
    description: 'Histórico de uso dos cupons.',
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
    title="Divulgação"
    :loading="bootstrapping || (store.loadState === 'loading' && !store.dashboard)"
    :error="loadError"
    @retry="ensureContext(true)"
  >
    <PartnerOperabilityBanner />

    <PartnerSectionTabs
      :tabs="tabs"
      :active-tab="activeTab"
      @select="setTab($event as DivulgacaoTab)"
    />

    <PortalDivulgacaoPanel :section="activeTab" />
  </PartnerPageFrame>
</template>
