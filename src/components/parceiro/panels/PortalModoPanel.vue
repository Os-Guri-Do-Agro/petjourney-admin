<script setup lang="ts">
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'

import PartnerStatusBadge from '@/components/parceiro/PartnerStatusBadge.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { ApiError } from '@/service/api'
import { solicitarModo } from '@/service/parceiro/parceiro-portal-service'
import type { ModoParticipacao, StatusModoParceiro } from '@/service/parceiro/types'

const props = defineProps<{
  modo: ModoParticipacao
}>()

const toast = useToast()
const { store, parceiroQuery } = useParceiroPortal()
const submitting = ref(false)

const panelId = computed(() => `partner-panel-${props.modo}`)

const config = computed(() => {
  if (props.modo === 'afiliado') {
    return {
      title: 'Programa Afiliado',
      description:
        'Receba comissão quando suas indicações viram assinantes pagantes. Libera carteira, extrato e saque via PIX.',
      status: store.status?.statusAfiliado ?? 'NAO_SOLICITADO',
      ctaCarteira: true,
      ctaDivulgacao: true,
    }
  }

  return {
    title: 'Programa Participativo',
    description:
      'Selo e benefícios de comunidade PetJourney. Não envolve carteira — perks e collabs são operados fora do sistema.',
    status: store.status?.statusParticipativo ?? 'NAO_SOLICITADO',
    ctaCarteira: false,
    ctaDivulgacao: false,
  }
})

function canSolicitar(status: StatusModoParceiro) {
  return ['NAO_SOLICITADO', 'REJEITADO', 'SUSPENSO'].includes(status)
}

async function handleSolicitar() {
  if (!store.isDono || !store.podeOperar || !canSolicitar(config.value.status)) {
    return
  }

  submitting.value = true

  try {
    await solicitarModo(props.modo, parceiroQuery())
    await store.refreshStatus()
    toast.add({
      severity: 'success',
      summary: 'Solicitação enviada',
      detail: 'Aguarde a análise do time PetJourney.',
      life: 4000,
    })
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Erro',
      detail:
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Não foi possível solicitar.',
      life: 5000,
    })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <article :id="panelId" class="modo-panel" role="tabpanel" :aria-labelledby="`partner-tab-${modo}`">
    <p v-if="!store.podeOperar" class="modo-panel__alert">
      Credenciamento pendente. Solicitações de programa ficam bloqueadas até aprovação.
    </p>

    <div class="modo-panel__card">
      <div class="modo-panel__head">
        <h3>{{ config.title }}</h3>
        <PartnerStatusBadge :status="config.status" />
      </div>
      <p>{{ config.description }}</p>

      <div class="modo-panel__actions">
        <Button
          v-if="store.isDono && canSolicitar(config.status)"
          label="Solicitar participação"
          :loading="submitting"
          :disabled="!store.podeOperar"
          @click="handleSolicitar"
        />
        <span v-else-if="config.status === 'SOLICITADO'" class="modo-panel__waiting">
          Em análise pelo PetJourney
        </span>
        <Button
          v-else-if="config.ctaCarteira && config.status === 'ATIVO'"
          as="router-link"
          label="Abrir financeiro"
          to="/parceiro/carteira"
        />
        <RouterLink
          v-if="config.ctaDivulgacao && config.status !== 'ATIVO'"
          class="modo-panel__link"
          to="/parceiro/divulgacao"
        >
          Divulgar código enquanto aguarda
        </RouterLink>
      </div>
    </div>

    <p v-if="!store.isDono" class="modo-panel__hint">
      Apenas donos podem solicitar programas. Você pode acompanhar o status aqui.
    </p>
  </article>
</template>

<style scoped>
.modo-panel {
  display: grid;
  gap: 0.75rem;
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

.modo-panel__link {
  color: var(--partner-primary-strong);
  font-size: 0.88rem;
  font-weight: 600;
  text-decoration: none;
}

.modo-panel__hint {
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.86rem;
}
</style>
