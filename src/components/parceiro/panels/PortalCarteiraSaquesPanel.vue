<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

import PartnerStatusBadge from '@/components/parceiro/PartnerStatusBadge.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { ApiError } from '@/service/api'
import { getSaques } from '@/service/parceiro/parceiro-portal-service'
import type { SaqueResumo } from '@/service/parceiro/types'
import { formatCentavosToBrl } from '@/utils/format/money'

const emit = defineEmits<{
  needsProgramas: []
}>()

const { ensureContext, parceiroQuery, store } = useParceiroPortal()
const saques = ref<SaqueResumo[]>([])
const loading = ref(true)
const error = ref('')

const statusMap = {
  PENDENTE: 'SOLICITADO',
  PAGO: 'ATIVO',
  FALHA: 'REJEITADO',
} as const

async function loadSaques() {
  loading.value = true
  error.value = ''

  try {
    await ensureContext()

    if (!store.statusAfiliadoAtivo) {
      emit('needsProgramas')
      return
    }

    saques.value = await getSaques(parceiroQuery())
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 409) {
      emit('needsProgramas')
      return
    }

    error.value = err instanceof Error ? err.message : 'Erro ao carregar saques.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadSaques()
})
</script>

<template>
  <div id="partner-panel-saques" class="portal-panel" role="tabpanel" aria-labelledby="partner-tab-saques">
    <div v-if="loading" class="portal-panel__state" role="status">
      <i class="pi pi-spin pi-spinner" aria-hidden="true" />
      <span>Carregando saques...</span>
    </div>

    <div v-else-if="error" class="portal-panel__state portal-panel__state--error" role="alert">
      <p>{{ error }}</p>
      <button type="button" @click="loadSaques">Tentar novamente</button>
    </div>

    <div v-else-if="saques.length === 0" class="portal-panel__empty">
      <i class="pi pi-wallet" aria-hidden="true" />
      <strong>Nenhum saque solicitado</strong>
      <p>Solicite um saque na aba Visão geral quando tiver saldo sacável.</p>
    </div>

    <div v-else class="saques-list">
      <RouterLink
        v-for="saque in saques"
        :key="saque.id"
        class="saque-row"
        :to="`/parceiro/carteira/saques/${saque.id}`"
      >
        <div>
          <strong>{{ formatCentavosToBrl(saque.valorCentavos) }}</strong>
          <p>Solicitado em {{ new Date(saque.createdAt).toLocaleString('pt-BR') }}</p>
          <p v-if="saque.motivoFalha" class="saque-row__fail">{{ saque.motivoFalha }}</p>
        </div>
        <PartnerStatusBadge :status="statusMap[saque.status]" />
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.portal-panel__state,
.portal-panel__empty {
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

.portal-panel__empty strong {
  color: var(--partner-text, inherit);
}

.portal-panel__empty p {
  margin: 0;
  max-width: 24rem;
  font-size: 0.88rem;
}

.saques-list {
  display: grid;
  gap: 0.55rem;
}

.saque-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--partner-line);
  border-radius: 0.85rem;
  background: var(--partner-card);
  color: inherit;
  text-decoration: none;
  transition: border-color 0.15s ease;
}

.saque-row:hover {
  border-color: var(--partner-primary-strong);
}

.saque-row p {
  margin: 0.15rem 0 0;
  color: var(--partner-muted);
  font-size: 0.82rem;
}

.saque-row__fail {
  color: var(--partner-warm-text) !important;
}
</style>
