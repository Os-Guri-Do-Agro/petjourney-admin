<script setup lang="ts">
import Button from 'primevue/button'
import { onMounted, ref } from 'vue'

import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { ApiError } from '@/service/api'
import { getCarteiraExtrato } from '@/service/parceiro/parceiro-portal-service'
import type { TransacaoCarteira } from '@/service/parceiro/types'
import { formatCentavosToBrl } from '@/utils/format/money'

const emit = defineEmits<{
  needsProgramas: []
}>()

const { ensureContext, parceiroQuery, store } = useParceiroPortal()
const items = ref<TransacaoCarteira[]>([])
const nextCursor = ref<string | null>(null)
const loading = ref(true)
const loadingMore = ref(false)
const error = ref('')

async function loadExtrato(cursor?: string) {
  if (cursor) {
    loadingMore.value = true
  } else {
    loading.value = true
    error.value = ''
  }

  try {
    await ensureContext()

    if (!store.statusAfiliadoAtivo) {
      emit('needsProgramas')
      return
    }

    const page = await getCarteiraExtrato({ ...parceiroQuery(), cursor, limit: 20 })

    if (cursor) {
      items.value = [...items.value, ...page.items]
    } else {
      items.value = page.items
    }

    nextCursor.value = page.nextCursor
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 409) {
      emit('needsProgramas')
      return
    }

    error.value = err instanceof Error ? err.message : 'Erro ao carregar extrato.'
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

onMounted(() => {
  void loadExtrato()
})
</script>

<template>
  <div id="partner-panel-extrato" class="portal-panel" role="tabpanel" aria-labelledby="partner-tab-extrato">
    <div v-if="loading" class="portal-panel__state" role="status">
      <i class="pi pi-spin pi-spinner" aria-hidden="true" />
      <span>Carregando extrato...</span>
    </div>

    <div v-else-if="error" class="portal-panel__state portal-panel__state--error" role="alert">
      <p>{{ error }}</p>
      <button type="button" @click="loadExtrato()">Tentar novamente</button>
    </div>

    <div v-else-if="items.length === 0" class="portal-panel__empty">
      <i class="pi pi-list" aria-hidden="true" />
      <strong>Nenhuma movimentação</strong>
      <p>Créditos de comissão e débitos de saque aparecem aqui.</p>
    </div>

    <template v-else>
      <div class="extrato-list">
        <article v-for="item in items" :key="item.id" class="extrato-row">
          <div>
            <strong>{{ item.tipo.replaceAll('_', ' ') }}</strong>
            <p>
              <span v-if="item.origem">{{ item.origem }}</span>
              <span v-if="item.periodicidade"> · {{ item.periodicidade }}</span>
            </p>
          </div>
          <div class="extrato-row__value">
            <strong :class="{ 'is-negative': item.valorCentavos < 0 }">
              {{ formatCentavosToBrl(item.valorCentavos) }}
            </strong>
            <time>{{ new Date(item.createdAt).toLocaleString('pt-BR') }}</time>
          </div>
        </article>
      </div>

      <Button
        v-if="nextCursor"
        class="mt-2"
        label="Carregar mais"
        :loading="loadingMore"
        severity="secondary"
        @click="loadExtrato(nextCursor ?? undefined)"
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

.extrato-list {
  display: grid;
  gap: 0.55rem;
}

.extrato-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--partner-line);
  border-radius: 0.85rem;
  background: var(--partner-card);
}

.extrato-row p {
  margin: 0.15rem 0 0;
  color: var(--partner-muted);
  font-size: 0.8rem;
}

.extrato-row__value {
  display: grid;
  justify-items: end;
  gap: 0.15rem;
  font-size: 0.8rem;
  color: var(--partner-muted);
}

.is-negative {
  color: var(--partner-warm-text);
}
</style>
