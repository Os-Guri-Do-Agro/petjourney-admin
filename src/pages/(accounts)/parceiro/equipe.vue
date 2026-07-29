<script setup lang="ts">
import { computed, onMounted } from 'vue'

import PartnerOperabilityBanner from '@/components/parceiro/PartnerOperabilityBanner.vue'
import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import PortalEquipeSection from '@/components/parceiro/sections/PortalEquipeSection.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'

const { store, bootstrapping, ensureContext } = useParceiroPortal()

const loadError = computed(() =>
  store.loadState === 'error' && !store.semAcessoParceiro ? store.errorMessage : '',
)

onMounted(() => {
  void ensureContext()
})
</script>

<template>
  <PartnerPageFrame
    subtitle="Portal"
    title="Equipe"
    :loading="bootstrapping || (store.loadState === 'loading' && !store.dashboard)"
    :error="loadError"
    :no-partner-access="store.semAcessoParceiro"
    block-when-suspended
    @retry="ensureContext(true)"
  >
    <PartnerOperabilityBanner />

    <p class="equipe-page__intro">
      Gerencie quem pode operar a parceria. Apenas donos enviam convites e removem membros.
    </p>

    <PortalEquipeSection />
  </PartnerPageFrame>
</template>

<style scoped>
.equipe-page__intro {
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.9rem;
  line-height: 1.45;
}
</style>
