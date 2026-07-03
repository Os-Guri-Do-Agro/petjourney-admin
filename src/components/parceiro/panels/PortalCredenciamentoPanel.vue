<script setup lang="ts">
import { onMounted, ref } from 'vue'

import PartnerStatusBadge from '@/components/parceiro/PartnerStatusBadge.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { getPortalStatus } from '@/service/parceiro/parceiro-portal-service'
import type { PortalStatus } from '@/service/parceiro/types'

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
    error.value = err instanceof Error ? err.message : 'Erro ao carregar credenciamento.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadStatus()
})

defineExpose({ reload: loadStatus })
</script>

<template>
  <div
    id="partner-panel-credenciamento"
    class="portal-panel"
    role="tabpanel"
    aria-labelledby="partner-tab-credenciamento"
  >
    <div v-if="loading" class="portal-panel__state" role="status">
      <i class="pi pi-spin pi-spinner" aria-hidden="true" />
      <span>Carregando credenciamento...</span>
    </div>

    <div v-else-if="error" class="portal-panel__state portal-panel__state--error" role="alert">
      <p>{{ error }}</p>
      <button type="button" @click="loadStatus">Tentar novamente</button>
    </div>

    <article v-else-if="status" class="status-card">
      <div class="status-card__row">
        <span>Auditoria da empresa</span>
        <PartnerStatusBadge :status="status.statusAuditoria" />
      </div>
      <div class="status-card__row">
        <span>Operação liberada</span>
        <strong>{{ status.podeOperar ? 'Sim' : 'Não' }}</strong>
      </div>
      <div v-if="status.motivoAuditoria" class="status-card__note">
        <strong>Motivo informado</strong>
        <p>{{ status.motivoAuditoria }}</p>
      </div>
      <div v-if="status.auditadoEm" class="status-card__meta">
        Última atualização: {{ new Date(status.auditadoEm).toLocaleString('pt-BR') }}
      </div>
      <p v-if="!status.podeOperar" class="status-card__hint">
        Enquanto o credenciamento não estiver aprovado, convites de equipe e solicitação de programas
        ficam indisponíveis. A análise é feita pelo time PetJourney — não há ações de admin neste
        portal.
      </p>
    </article>
  </div>
</template>

<style scoped>
.portal-panel__state {
  display: grid;
  justify-items: center;
  gap: 0.5rem;
  padding: 2rem 1rem;
  color: var(--partner-muted);
  text-align: center;
}

.portal-panel__state--error p {
  margin: 0;
  color: var(--partner-warm-text);
}

.portal-panel__state button {
  border: 1px solid var(--partner-line);
  border-radius: 0.6rem;
  padding: 0.45rem 0.85rem;
  background: var(--partner-card);
  cursor: pointer;
}

.status-card {
  display: grid;
  gap: 0.9rem;
  padding: 1.2rem;
  border: 1px solid var(--partner-line);
  border-radius: 1rem;
  background: var(--partner-card);
}

.status-card__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.status-card__row span {
  color: var(--partner-muted);
  font-size: 0.88rem;
}

.status-card__note {
  padding: 0.85rem;
  border-radius: 0.8rem;
  background: color-mix(in srgb, var(--partner-warm-bg) 70%, transparent);
}

.status-card__note p,
.status-card__hint,
.status-card__meta {
  margin: 0.35rem 0 0;
  color: var(--partner-muted);
  font-size: 0.88rem;
}
</style>
