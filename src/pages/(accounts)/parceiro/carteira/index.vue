<script setup lang="ts">
import Button from 'primevue/button'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import PartnerSectionTabs from '@/components/parceiro/PartnerSectionTabs.vue'
import PortalCarteiraExtratoPanel from '@/components/parceiro/panels/PortalCarteiraExtratoPanel.vue'
import PortalCarteiraSaquesPanel from '@/components/parceiro/panels/PortalCarteiraSaquesPanel.vue'
import PortalCarteiraVisaoPanel from '@/components/parceiro/panels/PortalCarteiraVisaoPanel.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { usePartnerTabs } from '@/composables/usePartnerTabs'

const CARTEIRA_TABS = ['visao', 'extrato', 'saques'] as const
type CarteiraTab = (typeof CARTEIRA_TABS)[number]

const { t } = useI18n()
const router = useRouter()
const { store, ensureContext } = useParceiroPortal()
const { activeTab, setTab } = usePartnerTabs(CARTEIRA_TABS, 'visao')

const tabs = computed(() => [
  {
    id: 'visao',
    label: t('carteira.tabs.visao.label'),
    description: t('carteira.tabs.visao.description'),
  },
  {
    id: 'extrato',
    label: t('carteira.tabs.extrato.label'),
    description: t('carteira.tabs.extrato.description'),
  },
  {
    id: 'saques',
    label: t('carteira.tabs.saques.label'),
    description: t('carteira.tabs.saques.description'),
  },
])

const tabsAriaLabel = computed(() =>
  t('carteira.tabs.ariaLabel', { labels: tabs.value.map((tab) => tab.label).join(', ') }),
)

const loadError = computed(() =>
  store.loadState === 'error' && !store.semAcessoParceiro ? store.errorMessage : '',
)

const showAfiliadoGate = computed(
  () => store.loadState === 'ready' && !store.statusAfiliadoAtivo,
)

function goToProgramas() {
  void router.replace({ path: '/parceiro/programas', hash: '#programas' })
}

onMounted(() => {
  void ensureContext()
})
</script>

<template>
  <PartnerPageFrame
    :subtitle="t('carteira.subtitle')"
    :title="t('carteira.title')"
    :loading="false"
    :error="loadError"
    :no-partner-access="store.semAcessoParceiro"
    @retry="ensureContext(true)"
  >
    <article v-if="showAfiliadoGate" class="carteira-gate">
      <h3>{{ t('carteira.gate.title') }}</h3>
      <p>{{ t('carteira.gate.body') }}</p>
      <Button :label="t('carteira.gate.cta')" @click="goToProgramas" />
    </article>

    <template v-else>
      <PartnerSectionTabs
        :tabs="tabs"
        :active-tab="activeTab"
        :aria-label="tabsAriaLabel"
        @select="setTab($event as CarteiraTab)"
      />

      <PortalCarteiraVisaoPanel v-if="activeTab === 'visao'" @needs-programas="goToProgramas" />
      <PortalCarteiraExtratoPanel v-else-if="activeTab === 'extrato'" @needs-programas="goToProgramas" />
      <PortalCarteiraSaquesPanel v-else @needs-programas="goToProgramas" />
    </template>
  </PartnerPageFrame>
</template>

<style scoped>
.carteira-gate {
  display: grid;
  gap: 0.75rem;
  max-width: 28rem;
  padding: 1.2rem;
  border: 1px solid var(--partner-line);
  border-radius: 1rem;
  background: var(--partner-card);
}

.carteira-gate h3 {
  margin: 0;
  font-size: 1rem;
}

.carteira-gate p {
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.9rem;
}
</style>
