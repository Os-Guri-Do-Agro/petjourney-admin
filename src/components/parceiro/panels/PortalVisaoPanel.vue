<script setup lang="ts">
import { onMounted } from 'vue'

import PartnerHomeOverview from '@/components/home/PartnerHomeOverview.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'

const { ensureContext } = useParceiroPortal()

onMounted(() => {
  void ensureContext()
})
</script>

<template>
  <div
    id="partner-panel-visao"
    class="portal-panel"
    role="tabpanel"
    aria-labelledby="partner-tab-visao"
  >
    <PartnerHomeOverview />
  </div>
</template>
