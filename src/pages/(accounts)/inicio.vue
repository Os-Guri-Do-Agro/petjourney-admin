<script setup lang="ts">
import { computed, onMounted } from 'vue'

import ClinicalHomeOverview from '@/components/home/ClinicalHomeOverview.vue'
import PartnerOperabilityBanner from '@/components/parceiro/PartnerOperabilityBanner.vue'
import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import PortalParceiroDashboard from '@/components/parceiro/PortalParceiroDashboard.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { hasVeterinarioProfile } from '@/service/auth/auth-session'

const { store, bootstrapping, ensureContext } = useParceiroPortal()

const hasClinicalProfile = computed(() => hasVeterinarioProfile())

const greetingTitle = computed(() => `Olá, ${store.parceiroNome} 👋`)

onMounted(() => {
  void ensureContext()
})
</script>

<template>
  <PartnerPageFrame
    subtitle="Visão geral"
    :title="greetingTitle"
    :loading="bootstrapping || (store.loadState === 'loading' && !store.dashboard)"
    :error="store.loadState === 'error' ? store.errorMessage : ''"
    @retry="ensureContext(true)"
  >
    <PartnerOperabilityBanner />
    <PortalParceiroDashboard />

    <section v-if="hasClinicalProfile" class="inicio-clinical" aria-label="Resumo clínico">
      <ClinicalHomeOverview layout="dashboard" />
    </section>
  </PartnerPageFrame>
</template>

<style scoped>
.inicio-clinical {
  margin-top: 0.5rem;
}
</style>
