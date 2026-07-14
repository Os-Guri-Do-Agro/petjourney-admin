<script setup lang="ts">
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import AuthTextField from '@/components/auth/AuthTextField.vue'
import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import { useParceiroStore } from '@/stores/parceiro'

const { t } = useI18n()
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
      summary: t('parceiro.selecionar.toast.error'),
      detail: err instanceof Error ? err.message : t('parceiro.selecionar.toast.errorDetail'),
      life: 5000,
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <PartnerPageFrame
    :subtitle="t('parceiro.selecionar.subtitle')"
    :title="t('parceiro.selecionar.title')"
    :loading="loading"
  >
    <article class="select-card">
      <p>
        {{ t('parceiro.selecionar.body') }}
      </p>
      <AuthTextField
        id="parceiro-id"
        v-model="parceiroIdInput"
        :disabled="loading"
        :hint="t('parceiro.selecionar.idHint')"
        :label="t('parceiro.selecionar.idLabel')"
        :placeholder="t('parceiro.selecionar.idPlaceholder')"
      />
      <Button :label="t('parceiro.selecionar.continue')" :loading="loading" @click="handleSelect" />
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
