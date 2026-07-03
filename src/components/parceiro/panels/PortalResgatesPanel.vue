<script setup lang="ts">
import Button from 'primevue/button'
import { onMounted, ref } from 'vue'

import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { getPortalResgates } from '@/service/parceiro/parceiro-portal-service'
import type { ResgateParceiro } from '@/service/parceiro/types'

const { ensureContext, parceiroQuery } = useParceiroPortal()
const resgates = ref<ResgateParceiro[]>([])
const nextCursor = ref<string | null>(null)
const loading = ref(true)
const loadingMore = ref(false)
const error = ref('')

async function loadResgates(cursor?: string) {
  if (cursor) {
    loadingMore.value = true
  } else {
    loading.value = true
    error.value = ''
  }

  try {
    await ensureContext()
    const page = await getPortalResgates({ ...parceiroQuery(), cursor, limit: 20 })

    if (cursor) {
      resgates.value = [...resgates.value, ...page.data]
    } else {
      resgates.value = page.data
    }

    nextCursor.value = page.meta.proximoCursor ?? null
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Erro ao carregar resgates.'
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

onMounted(() => {
  void loadResgates()
})
</script>

<template>
  <div id="partner-panel-resgates" class="portal-panel" role="tabpanel" aria-labelledby="partner-tab-resgates">
    <div v-if="loading" class="portal-panel__state" role="status">
      <i class="pi pi-spin pi-spinner" aria-hidden="true" />
      <span>Carregando resgates...</span>
    </div>

    <div v-else-if="error" class="portal-panel__state portal-panel__state--error" role="alert">
      <p>{{ error }}</p>
      <button type="button" @click="() => loadResgates()">Tentar novamente</button>
    </div>

    <div v-else-if="resgates.length === 0" class="portal-panel__empty">
      <i class="pi pi-chart-line" aria-hidden="true" />
      <strong>Nenhum resgate registrado</strong>
      <p>Histórico de uso dos cupons, sem dados pessoais dos tutores.</p>
    </div>

    <template v-else>
    <div class="resgates-list">
      <article v-for="resgate in resgates" :key="resgate.resgateId" class="resgate-row">
        <div>
          <strong>{{ resgate.cupomCodigo }}</strong>
          <p>{{ resgate.canal === 'QR' ? 'Via QR Code' : 'Código manual' }}</p>
        </div>
        <div class="resgate-row__meta">
          <span v-if="resgate.descontoPercentualSnapshot != null">
            {{ resgate.descontoPercentualSnapshot }}%
          </span>
          <time>{{ new Date(resgate.resgatadoEm).toLocaleString('pt-BR') }}</time>
        </div>
      </article>
    </div>

    <Button
      v-if="nextCursor"
      class="mt-2"
      label="Carregar mais"
      :loading="loadingMore"
      severity="secondary"
      @click="loadResgates(nextCursor ?? undefined)"
    />
    </template>
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

.resgates-list {
  display: grid;
  gap: 0.55rem;
}

.resgate-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--partner-line);
  border-radius: 0.85rem;
  background: var(--partner-card);
}

.resgate-row p {
  margin: 0.15rem 0 0;
  color: var(--partner-muted);
  font-size: 0.82rem;
}

.resgate-row__meta {
  display: grid;
  justify-items: end;
  gap: 0.15rem;
  color: var(--partner-muted);
  font-size: 0.8rem;
}
</style>
