<script setup lang="ts">
import Button from 'primevue/button'
import { computed, onMounted } from 'vue'
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

const router = useRouter()
const { store, bootstrapping, ensureContext } = useParceiroPortal()
const { activeTab, setTab } = usePartnerTabs(CARTEIRA_TABS, 'visao')

const tabs = [
  {
    id: 'visao',
    label: 'Visão geral',
    description: 'Saldos, chave PIX e solicitação de saque.',
  },
  {
    id: 'extrato',
    label: 'Extrato',
    description: 'Movimentações de comissão e débitos.',
  },
  {
    id: 'saques',
    label: 'Saques',
    description: 'Status das solicitações de pagamento.',
  },
]

const loadError = computed(() =>
  store.loadState === 'error' ? store.errorMessage : '',
)

const showAfiliadoGate = computed(
  () => !bootstrapping.value && store.loadState === 'ready' && !store.statusAfiliadoAtivo,
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
    subtitle="Portal"
    title="Financeiro"
    :loading="bootstrapping || store.loadState === 'loading'"
    :error="loadError"
    @retry="ensureContext(true)"
  >
    <article v-if="showAfiliadoGate" class="carteira-gate">
      <h3>Programa afiliado necessário</h3>
      <p>
        A carteira, extrato e saques só ficam disponíveis com o programa afiliado ativo. Solicite a
        participação na tela de programas.
      </p>
      <Button label="Solicitar programa afiliado" @click="goToProgramas" />
    </article>

    <template v-else>
      <PartnerSectionTabs :tabs="tabs" :active-tab="activeTab" @select="setTab($event as CarteiraTab)" />

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
