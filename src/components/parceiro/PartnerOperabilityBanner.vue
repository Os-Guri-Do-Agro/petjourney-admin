<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { useParceiroPortal } from '@/composables/useParceiroPortal'
import type { StatusAuditoriaParceiro } from '@/service/parceiro/types'

const { t } = useI18n()
const { store } = useParceiroPortal()

/** SUSPENSO usa o gate de página cheia — este banner cobre só análise/recusa. */
const visible = computed(() => {
  if (store.loadState !== 'ready' || store.podeOperar || store.cadastroSuspenso) {
    return false
  }

  const status = store.statusAuditoria
  return status === 'PENDENTE' || status === 'REJEITADO'
})

const copyKey = computed(() => {
  const status = store.statusAuditoria as StatusAuditoriaParceiro | null
  return status === 'REJEITADO' ? 'rejected' : 'pending'
})
</script>

<template>
  <aside v-if="visible" class="operability-banner" :data-tone="copyKey" role="status">
    <i
      class="pi"
      :class="copyKey === 'rejected' ? 'pi-times-circle' : 'pi-lock'"
      aria-hidden="true"
    />
    <div>
      <strong>{{ t(`frame.operability.${copyKey}.title`) }}</strong>
      <p>
        {{ t(`frame.operability.${copyKey}.body`) }}
        <template v-if="store.status?.motivoAuditoria">
          {{ t('frame.operability.reasonPrefix') }} {{ store.status.motivoAuditoria }}
        </template>
      </p>
      <RouterLink to="/settings?aba=empresa">{{
        t(`frame.operability.${copyKey}.link`)
      }}</RouterLink>
    </div>
  </aside>
</template>

<style scoped>
.operability-banner {
  display: flex;
  gap: 0.75rem;
  padding: 0.9rem 1rem;
  border: 1px solid color-mix(in srgb, var(--partner-primary) 22%, var(--partner-line));
  border-radius: 0.9rem;
  background: var(--partner-card);
  color: var(--partner-text);
  font-size: 0.88rem;
}

.operability-banner i {
  margin-top: 0.15rem;
  color: var(--partner-primary-strong);
  font-size: 1.1rem;
}

.operability-banner[data-tone='rejected'] {
  border-color: color-mix(in srgb, var(--partner-warm-text) 24%, var(--partner-line));
}

.operability-banner[data-tone='rejected'] i {
  color: var(--partner-warm-text);
}

.operability-banner p {
  margin: 0.25rem 0 0.45rem;
}

.operability-banner a {
  color: inherit;
  font-weight: 700;
}
</style>
