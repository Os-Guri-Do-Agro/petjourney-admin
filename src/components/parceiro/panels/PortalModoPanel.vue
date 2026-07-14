<script setup lang="ts">
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { computed, ref, useAttrs } from 'vue'

import PartnerStatusBadge from '@/components/parceiro/PartnerStatusBadge.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { solicitarModo } from '@/service/parceiro/parceiro-portal-service'
import type { ModoParticipacao } from '@/service/parceiro/types'
import {
  canManageSolicitacaoModo,
  canSolicitarModo,
  getModoCardCopy,
  resolveModoCta,
  resolveSolicitarModoError,
} from '@/utils/parceiro/modo-participacao'

const props = withDefaults(
  defineProps<{
    modo: ModoParticipacao
    embedded?: boolean
  }>(),
  { embedded: false },
)

const toast = useToast()
const attrs = useAttrs()
const { store, parceiroQuery } = useParceiroPortal()
const submitting = ref(false)

const panelId = computed(() => `partner-panel-${props.modo}`)

const rootId = computed(() => {
  if (props.embedded) {
    return typeof attrs.id === 'string' ? attrs.id : undefined
  }

  return panelId.value
})

const cardCopy = computed(() => getModoCardCopy(props.modo))

const modoStatus = computed(() => {
  if (props.modo === 'afiliado') {
    return store.status?.statusAfiliado ?? 'NAO_SOLICITADO'
  }

  return store.status?.statusParticipativo ?? 'NAO_SOLICITADO'
})

const canManageSolicitacao = computed(() =>
  canManageSolicitacaoModo(store.isDono, store.semAcessoParceiro),
)

const solicitarBloqueadoPorAuditoria = computed(
  () => !store.semAcessoParceiro && !store.podeOperar,
)

const cta = computed(() =>
  resolveModoCta(modoStatus.value, props.modo, canManageSolicitacao.value),
)

const showSolicitarButton = computed(
  () => cta.value.type === 'solicitar' || cta.value.type === 'solicitar-novamente',
)

const solicitarLabel = computed(() => {
  if (cta.value.type === 'solicitar' || cta.value.type === 'solicitar-novamente') {
    return cta.value.label
  }

  return ''
})

async function handleSolicitar() {
  if (!canManageSolicitacao.value) {
    toast.add({
      severity: 'warn',
      summary: 'Ação indisponível',
      detail: 'Apenas o dono da empresa pode solicitar programas.',
      life: 4000,
    })
    return
  }

  if (solicitarBloqueadoPorAuditoria.value || !canSolicitarModo(modoStatus.value)) {
    return
  }

  submitting.value = true

  try {
    const result = await solicitarModo(props.modo, parceiroQuery())
    store.patchModoStatus(result.modo, result.status)
    toast.add({
      severity: 'success',
      summary: 'Solicitação enviada',
      detail: 'Aguarde a análise do time PetJourney.',
      life: 4000,
    })

    try {
      await store.bootstrap(true)
    } catch {
      try {
        await store.refreshStatus()
      } catch {
        /* status pode permanecer local após patch */
      }
    }
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Erro ao solicitar',
      detail: resolveSolicitarModoError(err),
      life: 5000,
    })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <article
    :id="rootId"
    class="modo-panel"
    :class="{ 'modo-panel--embedded': embedded }"
    :role="embedded ? undefined : 'tabpanel'"
    :aria-labelledby="embedded ? undefined : `partner-tab-${modo}`"
  >
    <p v-if="solicitarBloqueadoPorAuditoria" class="modo-panel__alert">
      Seu cadastro ainda está em análise. Solicitações de programa ficam bloqueadas até aprovação.
    </p>

    <div class="modo-panel__card">
      <div class="modo-panel__head">
        <h3>{{ cardCopy.title }}</h3>
        <PartnerStatusBadge :status="modoStatus" />
      </div>
      <p>{{ cardCopy.description }}</p>

      <div class="modo-panel__actions">
        <Button
          v-if="showSolicitarButton"
          :label="solicitarLabel"
          :loading="submitting"
          :disabled="solicitarBloqueadoPorAuditoria"
          @click="handleSolicitar"
        />
        <Button
          v-else-if="cta.type === 'carteira'"
          as="router-link"
          :label="cta.label"
          :to="cta.to"
        />
        <span v-else-if="cta.type === 'aguardando'" class="modo-panel__waiting">
          {{ cta.label }}
        </span>
      </div>
    </div>

    <p v-if="!canManageSolicitacao" class="modo-panel__hint">
      Apenas donos podem solicitar programas. Você pode acompanhar o status aqui.
    </p>
  </article>
</template>

<style scoped>
.modo-panel {
  display: grid;
  gap: 0.75rem;
}

.modo-panel--embedded .modo-panel__card {
  height: 100%;
}

.modo-panel__alert {
  margin: 0;
  padding: 0.85rem 0.95rem;
  border-radius: 0.85rem;
  background: var(--partner-amber-bg);
  color: var(--partner-amber-text);
  font-size: 0.88rem;
}

.modo-panel__card {
  display: grid;
  gap: 0.75rem;
  padding: 1rem 1.05rem;
  border: 1px solid var(--partner-line);
  border-radius: 0.95rem;
  background: var(--partner-card);
}

.modo-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.modo-panel__head h3 {
  margin: 0;
  font-size: 1rem;
}

.modo-panel__card > p {
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.88rem;
}

.modo-panel__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.65rem;
}

.modo-panel__waiting {
  color: var(--partner-muted);
  font-size: 0.84rem;
  font-weight: 600;
}

.modo-panel__hint {
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.86rem;
}
</style>
