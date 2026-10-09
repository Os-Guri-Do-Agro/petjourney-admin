<script setup lang="ts">
import Button from 'primevue/button'
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import PortalParceiroFunilSection from '@/components/parceiro/PortalParceiroFunilSection.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'

const { t } = useI18n()
const { store, ensureContext } = useParceiroPortal()

onMounted(() => {
  void ensureContext()
})
</script>

<template>
  <div class="empresa-panel">
    <div
      v-if="store.loadState === 'error' && !store.semAcessoParceiro"
      class="empresa-panel__error"
      role="alert"
    >
      <i class="ph ph-warning-circle" aria-hidden="true" />
      <p>{{ store.errorMessage }}</p>
      <Button :label="t('common.retry')" severity="secondary" @click="ensureContext(true)" />
    </div>

    <PortalParceiroFunilSection v-else />
  </div>
</template>

<style scoped>
.empresa-panel {
  display: grid;
  gap: 1rem;
  width: 100%;
}

.empresa-panel__error {
  display: grid;
  gap: 0.75rem;
  justify-items: start;
  padding: 1.1rem 1.2rem;
  border: 1px solid color-mix(in srgb, var(--partner-warm-text) 22%, var(--partner-line));
  border-radius: 1.1rem;
  background: var(--partner-card);
}

.empresa-panel__error i {
  color: var(--partner-warm-text);
  font-size: 1.2rem;
}

.empresa-panel__error p {
  margin: 0;
  color: var(--partner-text);
  font-size: 0.9rem;
  line-height: 1.5;
}
</style>
