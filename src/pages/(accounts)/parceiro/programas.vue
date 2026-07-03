<script setup lang="ts">
import { computed, onMounted } from 'vue'

import PartnerOperabilityBanner from '@/components/parceiro/PartnerOperabilityBanner.vue'
import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import ProgramNavCards, { type ProgramNavItem } from '@/components/parceiro/ProgramNavCards.vue'
import PortalCredenciamentoPanel from '@/components/parceiro/panels/PortalCredenciamentoPanel.vue'
import PortalModoPanel from '@/components/parceiro/panels/PortalModoPanel.vue'
import PortalVisaoPanel from '@/components/parceiro/panels/PortalVisaoPanel.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { usePartnerTabs } from '@/composables/usePartnerTabs'

const PROGRAMAS_TABS = ['visao', 'credenciamento', 'afiliado', 'participativo'] as const
type ProgramasTab = (typeof PROGRAMAS_TABS)[number]

const { store, bootstrapping, ensureContext } = useParceiroPortal()
const { activeTab, setTab } = usePartnerTabs(PROGRAMAS_TABS, 'visao')

const navItems = computed<ProgramNavItem[]>(() => [
  {
    id: 'visao',
    label: 'Visão geral',
    description: 'Resumo da parceria e próximos passos',
    icon: 'pi pi-th-large',
    tone: 'primary',
  },
  {
    id: 'credenciamento',
    label: 'Credenciamento',
    description: 'Auditoria da empresa e liberação para operar',
    icon: 'pi pi-shield',
    tone: 'success',
    status: store.dashboard?.parceiro.statusAuditoria,
  },
  {
    id: 'afiliado',
    label: 'Afiliado',
    description: 'Comissão por indicação e carteira PIX',
    icon: 'pi pi-wallet',
    tone: 'amber',
    status: store.status?.statusAfiliado,
  },
  {
    id: 'participativo',
    label: 'Participativo',
    description: 'Selo e benefícios de comunidade',
    icon: 'pi pi-star',
    tone: 'warm',
    status: store.status?.statusParticipativo,
  },
])

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

    <ProgramNavCards
      :items="navItems"
      :active-id="activeTab"
      @select="setTab($event as ProgramasTab)"
    />

    <Transition name="programas-fade" mode="out-in">
      <PortalVisaoPanel v-if="activeTab === 'visao'" key="visao" />
      <PortalCredenciamentoPanel
        v-else-if="activeTab === 'credenciamento'"
        key="credenciamento"
      />
      <PortalModoPanel
        v-else-if="activeTab === 'afiliado'"
        key="afiliado"
        modo="afiliado"
      />
      <PortalModoPanel v-else key="participativo" modo="participativo" />
    </Transition>
  </PartnerPageFrame>
</template>

<style scoped>
.programas-fade-enter-active,
.programas-fade-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.programas-fade-enter-from,
.programas-fade-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
