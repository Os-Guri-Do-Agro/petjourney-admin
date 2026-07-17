<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { useParceiroPortal } from '@/composables/useParceiroPortal'

const { t } = useI18n()
const { store } = useParceiroPortal()
</script>

<template>
  <aside v-if="store.loadState === 'ready' && !store.podeOperar" class="operability-banner" role="status">
    <i class="pi pi-lock" aria-hidden="true" />
    <div>
      <strong>{{ t('frame.operability.title') }}</strong>
      <p>
        {{ t('frame.operability.body') }}
        <template v-if="store.status?.motivoAuditoria">
          {{ t('frame.operability.reasonPrefix') }} {{ store.status.motivoAuditoria }}
        </template>
      </p>
      <RouterLink to="/settings?aba=empresa">{{
        t('frame.operability.link')
      }}</RouterLink>
    </div>
  </aside>
</template>

<style scoped>
.operability-banner {
  display: flex;
  gap: 0.75rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--partner-line);
  border-radius: 0.9rem;
  background: var(--partner-amber-bg);
  color: var(--partner-amber-text);
  font-size: 0.88rem;
}

.operability-banner i {
  margin-top: 0.15rem;
  font-size: 1.1rem;
}

.operability-banner p {
  margin: 0.25rem 0 0.45rem;
}

.operability-banner a {
  color: inherit;
  font-weight: 700;
}
</style>

