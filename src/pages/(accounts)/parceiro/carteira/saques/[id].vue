<script setup lang="ts">
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import PartnerStatusBadge from '@/components/parceiro/PartnerStatusBadge.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import { getSaqueDetalhe } from '@/service/parceiro/parceiro-portal-service'
import type { SaqueDetalhe } from '@/service/parceiro/types'
import { formatCentavosToBrl } from '@/utils/format/money'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const { ensureContext, parceiroQuery } = useParceiroPortal()

const saque = ref<SaqueDetalhe | null>(null)
const loading = ref(true)
const error = ref('')

const statusMap = {
  PENDENTE: 'SOLICITADO',
  PAGO: 'ATIVO',
  FALHA: 'REJEITADO',
} as const

const saqueId = computed(() => {
  const id = route.params.id

  return typeof id === 'string' ? id : ''
})

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(INTL_LOCALE[locale.value as Locale])
}

async function loadDetalhe() {
  if (!saqueId.value) {
    error.value = t('carteira.detail.errorInvalidId')
    loading.value = false
    return
  }

  loading.value = true
  error.value = ''

  try {
    await ensureContext()
    saque.value = await getSaqueDetalhe(saqueId.value, parceiroQuery())
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('carteira.detail.errorLoad')
  } finally {
    loading.value = false
  }
}

function goBack() {
  void router.push({ path: '/parceiro/carteira', query: { aba: 'saques' } })
}

onMounted(() => {
  void loadDetalhe()
})
</script>

<template>
  <PartnerPageFrame
    :subtitle="t('carteira.detail.subtitle')"
    :title="t('carteira.detail.title')"
    :loading="false"
    :error="error"
    @retry="loadDetalhe"
  >
    <template #actions>
      <Button
        icon="pi pi-arrow-left"
        :label="t('carteira.detail.back')"
        severity="secondary"
        @click="goBack"
      />
    </template>

    <article
      v-if="loading"
      class="saque-detail saque-detail--skeleton"
      role="status"
      aria-live="polite"
      aria-busy="true"
      :aria-label="t('carteira.detail.loadingAria')"
    >
      <div class="saque-detail__head">
        <div class="saque-detail__head-copy">
          <Skeleton width="7rem" height="0.7rem" border-radius="4px" />
          <Skeleton width="9rem" height="1.65rem" border-radius="6px" />
        </div>
        <Skeleton width="4.5rem" height="1.4rem" border-radius="999px" />
      </div>

      <dl class="saque-detail__meta">
        <div v-for="index in 3" :key="index">
          <Skeleton width="6rem" height="0.7rem" border-radius="4px" />
          <Skeleton width="10rem" height="0.9rem" border-radius="4px" />
        </div>
      </dl>

      <div class="saque-detail__hint saque-detail__hint--skeleton">
        <Skeleton width="100%" height="0.85rem" border-radius="4px" />
        <Skeleton width="78%" height="0.85rem" border-radius="4px" />
      </div>
    </article>

    <article v-else-if="saque" class="saque-detail">
      <div class="saque-detail__head">
        <div>
          <span class="saque-detail__label">{{ t('carteira.detail.valorLabel') }}</span>
          <strong class="saque-detail__value">{{ formatCentavosToBrl(saque.valorCentavos) }}</strong>
        </div>
        <PartnerStatusBadge :status="statusMap[saque.status]" />
      </div>

      <dl class="saque-detail__meta">
        <div>
          <dt>{{ t('carteira.detail.requestedAt') }}</dt>
          <dd>{{ formatDateTime(saque.createdAt) }}</dd>
        </div>
        <div v-if="saque.liquidadoEm">
          <dt>{{ t('carteira.detail.liquidatedAt') }}</dt>
          <dd>{{ formatDateTime(saque.liquidadoEm) }}</dd>
        </div>
        <div>
          <dt>{{ t('carteira.detail.pixSnapshot') }}</dt>
          <dd>{{ saque.chavePixSnapshot }}</dd>
        </div>
        <div v-if="saque.motivoFalha">
          <dt>{{ t('carteira.detail.failReason') }}</dt>
          <dd class="saque-detail__fail">{{ saque.motivoFalha }}</dd>
        </div>
        <div v-if="saque.comprovante">
          <dt>{{ t('carteira.detail.receipt') }}</dt>
          <dd>{{ saque.comprovante }}</dd>
        </div>
      </dl>

      <p v-if="saque.status === 'PENDENTE'" class="saque-detail__hint">
        {{ t('carteira.detail.pendingHint') }}
      </p>
    </article>
  </PartnerPageFrame>
</template>

<style scoped>
.saque-detail {
  display: grid;
  gap: 1rem;
  max-width: 36rem;
  padding: 1.1rem 1.15rem;
  border: 1px solid var(--partner-line);
  border-radius: 1rem;
  background: var(--partner-card);
}

.saque-detail__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.saque-detail__head-copy {
  display: grid;
  gap: 0.4rem;
}

.saque-detail__label {
  display: block;
  margin-bottom: 0.25rem;
  color: var(--partner-muted);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.saque-detail__value {
  font-size: 1.65rem;
}

.saque-detail__meta {
  display: grid;
  gap: 0.75rem;
  margin: 0;
}

.saque-detail__meta div {
  display: grid;
  gap: 0.15rem;
}

.saque-detail__meta dt {
  color: var(--partner-muted);
  font-size: 0.78rem;
  font-weight: 600;
}

.saque-detail__meta dd {
  margin: 0;
  font-size: 0.92rem;
}

.saque-detail__fail {
  color: var(--partner-warm-text);
}

.saque-detail__hint {
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.86rem;
}

.saque-detail__hint--skeleton {
  display: grid;
  gap: 0.35rem;
}

.saque-detail--skeleton {
  pointer-events: none;
}

.saque-detail--skeleton :deep(.p-skeleton) {
  --p-skeleton-background: color-mix(in srgb, var(--partner-primary-soft) 42%, var(--partner-card));
  --p-skeleton-animation-background: color-mix(
    in srgb,
    var(--partner-primary-soft) 18%,
    transparent
  );
}
</style>
