<script setup lang="ts">
import Button from 'primevue/button'
import { onMounted, ref } from 'vue'

import PartnerStatusBadge from '@/components/parceiro/PartnerStatusBadge.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { getPortalCupons } from '@/service/parceiro/parceiro-portal-service'
import type { CupomParceiro } from '@/service/parceiro/types'

const { ensureContext, parceiroQuery } = useParceiroPortal()
const cupons = ref<CupomParceiro[]>([])
const nextCursor = ref<string | null>(null)
const loading = ref(true)
const loadingMore = ref(false)
const error = ref('')

async function loadCupons(cursor?: string) {
  if (cursor) {
    loadingMore.value = true
  } else {
    loading.value = true
    error.value = ''
  }

  try {
    await ensureContext()
    const page = await getPortalCupons({ ...parceiroQuery(), cursor, limit: 20 })

    if (cursor) {
      cupons.value = [...cupons.value, ...page.data]
    } else {
      cupons.value = page.data
    }

    nextCursor.value = page.meta.proximoCursor ?? null
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Erro ao carregar cupons.'
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

onMounted(() => {
  void loadCupons()
})
</script>

<template>
  <div id="partner-panel-cupons" class="portal-panel" role="tabpanel" aria-labelledby="partner-tab-cupons">
    <div v-if="loading" class="portal-panel__state" role="status">
      <i class="pi pi-spin pi-spinner" aria-hidden="true" />
      <span>Carregando cupons...</span>
    </div>

    <div v-else-if="error" class="portal-panel__state portal-panel__state--error" role="alert">
      <p>{{ error }}</p>
      <button type="button" @click="() => loadCupons()">Tentar novamente</button>
    </div>

    <div v-else-if="cupons.length === 0" class="portal-panel__empty">
      <i class="pi pi-ticket" aria-hidden="true" />
      <strong>Nenhum cupom ativo</strong>
      <p>Quando houver cupons vinculados à sua empresa, eles aparecem aqui.</p>
    </div>

    <template v-else>
    <div class="cupons-list">
      <article v-for="cupom in cupons" :key="cupom.id" class="cupom-card">
        <div class="cupom-card__head">
          <div>
            <h3>{{ cupom.titulo }}</h3>
            <p>{{ cupom.codigo }} · {{ cupom.categoria.replaceAll('_', ' ') }}</p>
          </div>
          <PartnerStatusBadge :status="cupom.ativo ? 'ATIVO' : 'SUSPENSO'" />
        </div>
        <div class="cupom-card__meta">
          <span>{{ cupom.descontoPercentual }}% off</span>
          <span>{{ cupom.totalResgates }} resgates</span>
          <span>Válido até {{ new Date(cupom.validoAte).toLocaleDateString('pt-BR') }}</span>
          <span v-if="cupom.usoUnico">Uso único</span>
          <span v-else-if="cupom.usosRestantes != null">{{ cupom.usosRestantes }} restantes</span>
        </div>
      </article>
    </div>

    <Button
      v-if="nextCursor"
      class="mt-2"
      label="Carregar mais"
      :loading="loadingMore"
      severity="secondary"
      @click="loadCupons(nextCursor ?? undefined)"
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

.cupons-list {
  display: grid;
  gap: 0.75rem;
}

.cupom-card {
  padding: 1rem 1.05rem;
  border: 1px solid var(--partner-line);
  border-radius: 0.95rem;
  background: var(--partner-card);
}

.cupom-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.cupom-card__head h3 {
  margin: 0 0 0.2rem;
  font-size: 1rem;
}

.cupom-card__head p {
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.84rem;
}

.cupom-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem 0.85rem;
  margin-top: 0.75rem;
  color: var(--partner-muted);
  font-size: 0.8rem;
}
</style>
