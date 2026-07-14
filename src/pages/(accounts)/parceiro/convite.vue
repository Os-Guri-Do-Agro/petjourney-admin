<script setup lang="ts">
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import AuthTextField from '@/components/auth/AuthTextField.vue'
import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import { aceitarConviteEquipe } from '@/service/parceiro/parceiro-portal-service'
import { useParceiroStore } from '@/stores/parceiro'
import { getDefaultLandingPath } from '@/utils/navigation/default-landing'

const { t } = useI18n()
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
      summary: t('parceiro.convite.toast.warnTitle'),
      detail: t('parceiro.convite.toast.warnDetail'),
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
      summary: t('parceiro.convite.toast.success'),
      detail: t('parceiro.convite.toast.successDetail'),
      life: 4000,
    })
    await store.bootstrap(true)
    await router.replace(getDefaultLandingPath())
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: t('parceiro.convite.toast.error'),
      detail: err instanceof Error ? err.message : t('parceiro.convite.toast.errorDetail'),
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
    :subtitle="t('parceiro.convite.subtitle')"
    :title="t('parceiro.convite.title')"
    :loading="accepting && !accepted"
  >
    <article class="convite-card">
      <p>
        {{ t('parceiro.convite.body') }}
      </p>

      <AuthTextField
        id="convite-parceiro-id"
        v-model="parceiroIdInput"
        :disabled="accepting"
        :hint="t('parceiro.convite.idHint')"
        :label="t('parceiro.convite.idLabel')"
        :placeholder="t('parceiro.convite.idPlaceholder')"
      />

      <Button
        :label="t('parceiro.convite.accept')"
        :loading="accepting"
        @click="handleAccept"
      />

      <p class="convite-card__footnote">
        {{ t('parceiro.convite.footnote') }}
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
