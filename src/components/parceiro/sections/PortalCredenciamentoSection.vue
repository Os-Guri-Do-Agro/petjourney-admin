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
</script>

<template>
  <section id="credenciamento" class="cred-section" aria-labelledby="cred-section-title">
    <header class="cred-section__head">
      <h3 id="cred-section-title">Credenciamento</h3>
      <p>Situação da auditoria e liberação para operar no portal.</p>
    </header>

    <div v-if="loading" class="cred-section__state" role="status">
      <i class="pi pi-spin pi-spinner" aria-hidden="true" />
      <span>Carregando...</span>
    </div>

    <div v-else-if="error" class="cred-section__state cred-section__state--error" role="alert">
      <p>{{ error }}</p>
      <button type="button" @click="loadStatus">Tentar novamente</button>
    </div>

    <article v-else-if="status" class="cred-card">
      <div class="cred-card__row">
        <span>Auditoria da empresa</span>
        <PartnerStatusBadge :status="status.statusAuditoria" />
      </div>
      <div class="cred-card__row">
        <span>Operação liberada</span>
        <strong>{{ status.podeOperar ? 'Sim' : 'Não' }}</strong>
      </div>
      <div v-if="status.motivoAuditoria" class="cred-card__note">
        <strong>Motivo informado</strong>
        <p>{{ status.motivoAuditoria }}</p>
      </div>
      <p v-if="status.auditadoEm" class="cred-card__meta">
        Última atualização: {{ new Date(status.auditadoEm).toLocaleString('pt-BR') }}
      </p>
      <p v-if="!status.podeOperar" class="cred-card__hint">
        Convites de equipe e solicitação de programas ficam bloqueados até aprovação. A análise é
        feita pelo time PetJourney.
      </p>
    </article>
  </section>
</template>

<style scoped>
.cred-section {
  display: grid;
  gap: 0.75rem;
}

.cred-section__head h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
}

.cred-section__head p {
  margin: 0.2rem 0 0;
  color: var(--partner-muted);
  font-size: 0.83rem;
}

.cred-section__state {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.85rem 1rem;
  border: 1px solid var(--partner-line);
  border-radius: 0.9rem;
  background: var(--partner-card);
  color: var(--partner-muted);
  font-size: 0.88rem;
}

.cred-section__state--error {
  flex-direction: column;
  align-items: flex-start;
  color: var(--partner-warm-text);
  background: var(--partner-warm-bg);
}

.cred-section__state--error p {
  margin: 0;
}

.cred-section__state button {
  border: 1px solid var(--partner-line);
  border-radius: 0.55rem;
  padding: 0.35rem 0.7rem;
  background: var(--partner-card);
  cursor: pointer;
}

.cred-card {
  display: grid;
  gap: 0.75rem;
  padding: 0.95rem 1rem;
  border: 1px solid var(--partner-line);
  border-radius: 0.95rem;
  background: var(--partner-card);
}

.cred-card__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.cred-card__row span {
  color: var(--partner-muted);
  font-size: 0.86rem;
}

.cred-card__note {
  padding: 0.75rem 0.85rem;
  border-radius: 0.75rem;
  background: color-mix(in srgb, var(--partner-warm-bg) 70%, transparent);
}

.cred-card__note p,
.cred-card__hint,
.cred-card__meta {
  margin: 0.3rem 0 0;
  color: var(--partner-muted);
  font-size: 0.84rem;
}
</style>
