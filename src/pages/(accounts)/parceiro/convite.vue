<script setup lang="ts">
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AuthTextField from '@/components/auth/AuthTextField.vue'
import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import { aceitarConviteEquipe } from '@/service/parceiro/parceiro-portal-service'
import { useParceiroStore } from '@/stores/parceiro'
import { getDefaultLandingPath } from '@/utils/navigation/default-landing'

const toast = useToast()
const route = useRoute()
const router = useRouter()
const store = useParceiroStore()

const parceiroIdInput = ref('')
const accepting = ref(false)
const accepted = ref(false)

const parceiroIdFromQuery = computed(() =>
  typeof route.query.parceiroId === 'string' ? route.query.parceiroId.trim() : '',
)

async function handleAccept() {
  const parceiroId = parceiroIdInput.value.trim() || parceiroIdFromQuery.value

  if (!parceiroId) {
    toast.add({
      severity: 'warn',
      summary: 'Informe a empresa',
      detail: 'O link de convite deve incluir o identificador do parceiro.',
      life: 4000,
    })
    return
  }

  accepting.value = true

  try {
    await aceitarConviteEquipe(parceiroId)
    store.setParceiroId(parceiroId)
    accepted.value = true
    toast.add({
      severity: 'success',
      summary: 'Convite aceito',
      detail: 'Você já pode acessar o portal da empresa.',
      life: 4000,
    })
    await store.bootstrap(true)
    await router.replace(getDefaultLandingPath())
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Não foi possível aceitar',
      detail: err instanceof Error ? err.message : 'Verifique o link ou tente novamente.',
      life: 5000,
    })
  } finally {
    accepting.value = false
  }
}

onMounted(() => {
  if (parceiroIdFromQuery.value) {
    parceiroIdInput.value = parceiroIdFromQuery.value
  }
})
</script>

<template>
  <PartnerPageFrame
    subtitle="Equipe"
    title="Aceitar convite"
    :loading="accepting && !accepted"
  >
    <article class="convite-card">
      <p>
        Você foi convidado para integrar a equipe de uma empresa parceira PetJourney.
        Informe o identificador recebido no e-mail ou abra o link completo do convite.
      </p>

      <AuthTextField
        id="convite-parceiro-id"
        v-model="parceiroIdInput"
        :disabled="accepting"
        hint="Obrigatório — vem no link como ?parceiroId=..."
        label="ID do parceiro"
        placeholder="cuid-da-empresa"
      />

      <Button label="Aceitar convite" :loading="accepting" @click="handleAccept" />

      <p class="convite-card__footnote">
        Após aceitar, você passa a operar no portal com o papel definido pelo dono da empresa.
      </p>
    </article>
  </PartnerPageFrame>
</template>

<style scoped>
.convite-card {
  display: grid;
  gap: 0.85rem;
  max-width: 32rem;
  padding: 1rem 1.05rem;
  border: 1px solid var(--partner-line);
  border-radius: 0.95rem;
  background: var(--partner-card);
}

.convite-card p {
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.9rem;
}

.convite-card__footnote {
  font-size: 0.82rem !important;
}
</style>

