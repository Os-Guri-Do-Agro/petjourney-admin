<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { useParceiroPortal } from '@/composables/useParceiroPortal'
import type { StatusAuditoriaParceiro } from '@/service/parceiro/types'

const props = withDefaults(
  defineProps<{
    /**
     * Cobre também o cadastro SUSPENSO, com a copy de leitura liberada.
     * Use nas telas onde a leitura NÃO é gated por auditoria (atendimentos:
     * seção 4 da spec das Partes 11 a 13). Nas demais, o SUSPENSO continua no
     * gate de página cheia do `PartnerPageFrame` e este banner não o duplica.
     */
    coverSuspended?: boolean
  }>(),
  { coverSuspended: false },
)

const { t } = useI18n()
const { store } = useParceiroPortal()

const visible = computed(() => {
  if (store.loadState !== 'ready' || store.podeOperar) {
    return false
  }

  if (store.cadastroSuspenso) {
    return props.coverSuspended
  }

  const status = store.statusAuditoria
  return status === 'PENDENTE' || status === 'REJEITADO'
})

const copyKey = computed(() => {
  const status = store.statusAuditoria as StatusAuditoriaParceiro | null

  if (status === 'SUSPENSO') {
    return 'suspendedReadOnly'
  }

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

.operability-banner[data-tone='rejected'],
.operability-banner[data-tone='suspendedReadOnly'] {
  border-color: color-mix(in srgb, var(--partner-warm-text) 24%, var(--partner-line));
}

.operability-banner[data-tone='rejected'] i,
.operability-banner[data-tone='suspendedReadOnly'] i {
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
