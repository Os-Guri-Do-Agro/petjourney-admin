<script setup lang="ts">
import Skeleton from 'primevue/skeleton'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import PartnerStatusBadge from '@/components/parceiro/PartnerStatusBadge.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import { getPortalStatus } from '@/service/parceiro/parceiro-portal-service'
import type { PortalStatus } from '@/service/parceiro/types'

withDefaults(
  defineProps<{
    skeleton?: boolean
  }>(),
  {
    skeleton: false,
  },
)

const { t, locale } = useI18n()
const { ensureContext, parceiroQuery } = useParceiroPortal()
const status = ref<PortalStatus | null>(null)
const loading = ref(true)
const error = ref('')

async function loadStatus() {
  loading.value = true
  error.value = ''

  try {
    await ensureContext()
    status.value = await getPortalStatus(parceiroQuery())
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('programas.cred.errorLoad')
  } finally {
    loading.value = false
  }
}

const auditadoEmLabel = computed(() => {
  if (!status.value?.auditadoEm) {
    return ''
  }

  return new Date(status.value.auditadoEm).toLocaleString(INTL_LOCALE[locale.value as Locale])
})

onMounted(() => {
  void loadStatus()
})
</script>

<template>
  <section id="credenciamento" class="cred-section" aria-labelledby="cred-section-title">
    <header class="cred-section__head">
      <h3 id="cred-section-title">{{ t('programas.cred.sectionTitle') }}</h3>
      <p>{{ t('programas.cred.sectionLede') }}</p>
    </header>

    <article
      v-if="skeleton || loading"
      class="cred-card cred-card--skeleton"
      role="status"
      aria-live="polite"
      aria-busy="true"
      :aria-label="t('programas.cred.loadingAria')"
    >
      <div class="cred-card__row">
        <Skeleton width="9rem" height="0.85rem" border-radius="4px" />
        <Skeleton width="4.5rem" height="1.4rem" border-radius="999px" />
      </div>
      <div class="cred-card__row">
        <Skeleton width="8rem" height="0.85rem" border-radius="4px" />
        <Skeleton width="2.5rem" height="0.95rem" border-radius="4px" />
      </div>
      <div class="cred-card__meta cred-card__meta--skeleton">
        <Skeleton width="14rem" height="0.75rem" border-radius="4px" />
      </div>
      <div class="cred-card__hint cred-card__hint--skeleton">
        <Skeleton width="100%" height="0.8rem" border-radius="4px" />
        <Skeleton width="72%" height="0.8rem" border-radius="4px" />
      </div>
    </article>

    <div v-else-if="error" class="cred-section__state cred-section__state--error" role="alert">
      <p>{{ error }}</p>
      <button type="button" @click="loadStatus">{{ t('programas.cred.retry') }}</button>
    </div>

    <article v-else-if="status" class="cred-card">
      <div class="cred-card__row">
        <span>{{ t('programas.cred.rowAuditoria') }}</span>
        <PartnerStatusBadge :status="status.statusAuditoria" />
      </div>
      <div class="cred-card__row">
        <span>{{ t('programas.cred.rowOperacao') }}</span>
        <strong>{{ status.podeOperar ? t('programas.cred.yes') : t('programas.cred.no') }}</strong>
      </div>
      <div v-if="status.motivoAuditoria" class="cred-card__note">
        <strong>{{ t('programas.cred.motivoTitle') }}</strong>
        <p>{{ status.motivoAuditoria }}</p>
      </div>
      <p v-if="status.auditadoEm" class="cred-card__meta">
        {{ t('programas.cred.lastUpdate', { data: auditadoEmLabel }) }}
      </p>
      <p v-if="!status.podeOperar" class="cred-card__hint">
        {{ t('programas.cred.blockedHint') }}
      </p>
    </article>
  </section>
</template>

<style scoped>
.cred-section {
  display: grid;
  gap: 0.75rem;
  width: 100%;
}

.cred-section__head h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
}

.cred-section__head p {
  margin: 0.2rem 0 0;
  color: var(--partner-muted, var(--prog-muted));
  font-size: 0.83rem;
}

.cred-section__state {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 1rem 1.15rem;
  border: 1px solid var(--partner-line, var(--prog-line));
  border-radius: 1.1rem;
  background: var(--partner-card, var(--prog-card));
  color: var(--partner-muted, var(--prog-muted));
}

.cred-section__state--error {
  flex-direction: column;
  align-items: flex-start;
}

.cred-section__state--error p {
  margin: 0;
  color: var(--partner-warm-text, inherit);
}

.cred-section__state button {
  border: 1px solid var(--partner-line, var(--prog-line));
  border-radius: 0.6rem;
  padding: 0.4rem 0.8rem;
  background: var(--partner-card, var(--prog-card));
  cursor: pointer;
}

.cred-card {
  display: grid;
  gap: 0.75rem;
  padding: 1.1rem 1.15rem;
  border: 1px solid var(--partner-line, var(--prog-line));
  border-radius: 1.1rem;
  background: var(--partner-card, var(--prog-card));
}

.cred-card__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.9rem;
}

.cred-card__note {
  padding: 0.75rem 0.85rem;
  border-radius: 0.8rem;
  background: var(--partner-surface, var(--prog-surface));
}

.cred-card__note strong {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.8rem;
}

.cred-card__note p {
  margin: 0;
  color: var(--partner-muted, var(--prog-muted));
  font-size: 0.84rem;
  line-height: 1.4;
}

.cred-card__meta {
  margin: 0;
  color: var(--partner-faint, var(--prog-faint));
  font-size: 0.78rem;
}

.cred-card__hint {
  margin: 0;
  color: var(--partner-muted, var(--prog-muted));
  font-size: 0.82rem;
  line-height: 1.4;
}

.cred-card--skeleton {
  pointer-events: none;
}

.cred-card__meta--skeleton,
.cred-card__hint--skeleton {
  display: grid;
  gap: 0.35rem;
}

.cred-card--skeleton :deep(.p-skeleton) {
  --p-skeleton-background: color-mix(
    in srgb,
    var(--partner-primary-soft, var(--prog-primary-soft)) 42%,
    var(--partner-card, var(--prog-card))
  );
  --p-skeleton-animation-background: color-mix(
    in srgb,
    var(--partner-primary-soft, var(--prog-primary-soft)) 18%,
    transparent
  );
}
</style>
