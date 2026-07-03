<script setup lang="ts">
import Button from 'primevue/button'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import PartnerStatusBadge from '@/components/parceiro/PartnerStatusBadge.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { getSaqueDetalhe } from '@/service/parceiro/parceiro-portal-service'
import type { SaqueDetalhe } from '@/service/parceiro/types'
import { formatCentavosToBrl } from '@/utils/format/money'

const route = useRoute()
const router = useRouter()
const { bootstrapping, ensureContext, parceiroQuery } = useParceiroPortal()

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

async function loadDetalhe() {
  if (!saqueId.value) {
    error.value = 'Identificador do saque inválido.'
    loading.value = false
    return
  }

  loading.value = true
  error.value = ''

  try {
    await ensureContext()
    saque.value = await getSaqueDetalhe(saqueId.value, parceiroQuery())
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Erro ao carregar saque.'
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
    subtitle="Financeiro"
    title="Detalhe do saque"
    :loading="bootstrapping || loading"
    :error="error"
    @retry="loadDetalhe"
  >
    <template #actions>
      <Button icon="pi pi-arrow-left" label="Voltar" severity="secondary" @click="goBack" />
    </template>

    <article v-if="saque" class="saque-detail">
      <div class="saque-detail__head">
        <div>
          <span class="saque-detail__label">Valor solicitado</span>
          <strong class="saque-detail__value">{{ formatCentavosToBrl(saque.valorCentavos) }}</strong>
        </div>
        <PartnerStatusBadge :status="statusMap[saque.status]" />
      </div>

      <dl class="saque-detail__meta">
        <div>
          <dt>Solicitado em</dt>
          <dd>{{ new Date(saque.createdAt).toLocaleString('pt-BR') }}</dd>
        </div>
        <div v-if="saque.liquidadoEm">
          <dt>Liquidado em</dt>
          <dd>{{ new Date(saque.liquidadoEm).toLocaleString('pt-BR') }}</dd>
        </div>
        <div>
          <dt>Chave PIX (snapshot)</dt>
          <dd>{{ saque.chavePixSnapshot }}</dd>
        </div>
        <div v-if="saque.motivoFalha">
          <dt>Motivo da falha</dt>
          <dd class="saque-detail__fail">{{ saque.motivoFalha }}</dd>
        </div>
        <div v-if="saque.comprovante">
          <dt>Comprovante</dt>
          <dd>{{ saque.comprovante }}</dd>
        </div>
      </dl>

      <p v-if="saque.status === 'PENDENTE'" class="saque-detail__hint">
        Pagamentos são liquidados manualmente pelo PetJourney. Ciclo orientativo: corte dia 27,
        pagamento até dia 5.
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
</style>
