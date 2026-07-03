<script setup lang="ts">
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AuthTextField from '@/components/auth/AuthTextField.vue'
import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import { useParceiroStore } from '@/stores/parceiro'

const toast = useToast()
const route = useRoute()
const router = useRouter()
const store = useParceiroStore()
const parceiroIdInput = ref(store.parceiroId ?? '')
const loading = ref(false)

onMounted(() => {
  const fromQuery = typeof route.query.parceiroId === 'string' ? route.query.parceiroId.trim() : ''

  if (fromQuery) {
    parceiroIdInput.value = fromQuery
  }
})

async function handleSelect() {
  const id = parceiroIdInput.value.trim()

  if (!id) {
    return
  }

  loading.value = true
  store.setParceiroId(id)

  try {
    await store.bootstrap(true)
    await router.replace('/parceiro/programas')
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Não foi possível acessar',
      detail: err instanceof Error ? err.message : 'Verifique o identificador.',
      life: 5000,
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <PartnerPageFrame
    subtitle="Multi-empresa"
    title="Selecionar parceiro"
    :loading="loading"
  >
    <article class="select-card">
      <p>
        Sua conta participa de mais de uma empresa parceira. Informe qual deseja operar agora.
      </p>
      <AuthTextField
        id="parceiro-id"
        v-model="parceiroIdInput"
        :disabled="loading"
        hint="O identificador é fornecido pelo administrador ou aparece no convite."
        label="ID do parceiro"
        placeholder="cuid-do-parceiro"
      />
      <Button label="Continuar" :loading="loading" @click="handleSelect" />
    </article>
  </PartnerPageFrame>
</template>

<style scoped>
.select-card {
  display: grid;
  gap: 0.85rem;
  max-width: 32rem;
  padding: 1rem 1.05rem;
  border: 1px solid var(--partner-line);
  border-radius: 0.95rem;
  background: var(--partner-card);
}

.select-card p {
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.9rem;
}
</style>
