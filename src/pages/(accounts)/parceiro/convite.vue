<script setup lang="ts">
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import UiPagina from '@/components/ui/UiPagina.vue'
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
  <!--
    O convite numa folha só, no meio da tela: o que é, o identificador da empresa (que já vem
    preenchido quando a pessoa abre o link do e-mail) e o botão de aceitar.
  -->
  <UiPagina class="tela-convite" :titulo="t('parceiro.convite.title')">
    <template #cabecalho>
      <div class="centro-cabeca">
        <span class="ui-ladrilho ui-ladrilho--lugar centro-cabeca__selo" aria-hidden="true">
          <i :class="accepted ? 'ph ph-check-circle' : 'ph ph-envelope-open'" />
        </span>
        <h1 class="centro-cabeca__titulo">{{ t('parceiro.convite.title') }}</h1>
        <p class="centro-cabeca__texto">{{ t('parceiro.convite.body') }}</p>
      </div>
    </template>

    <form class="convite ui-folha" novalidate @submit.prevent="handleAccept">
      <div class="convite__campo">
        <label for="convite-parceiro-id">{{ t('parceiro.convite.idLabel') }}</label>
        <InputText
          id="convite-parceiro-id"
          v-model="parceiroIdInput"
          class="convite__entrada"
          :disabled="accepting"
          :placeholder="t('parceiro.convite.idPlaceholder')"
          autocomplete="off"
          spellcheck="false"
          aria-describedby="convite-parceiro-id-dica"
        />
        <small id="convite-parceiro-id-dica" class="convite__dica">
          {{ t('parceiro.convite.idHint') }}
        </small>
      </div>

      <Button
        type="submit"
        class="convite__aceitar"
        icon="ph ph-check"
        :label="t('parceiro.convite.accept')"
        :loading="accepting"
      />

      <p class="convite__rodape">
        <i class="ph ph-users-three" aria-hidden="true" />
        {{ t('parceiro.convite.footnote') }}
      </p>
    </form>
  </UiPagina>
</template>

<style scoped>
.centro-cabeca {
  display: grid;
  width: 100%;
  max-width: 30rem;
  justify-items: center;
  gap: 8px;
  margin: clamp(16px, 7vh, 80px) auto 0;
  text-align: center;
}

.centro-cabeca__selo.ui-ladrilho {
  width: 60px;
  height: 60px;
  border-radius: 18px;
  font-size: 28px;
}

.centro-cabeca__titulo {
  margin: 12px 0 0;
  color: var(--tinta);
  font-size: 28px;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.centro-cabeca__texto {
  max-width: 46ch;
  margin: 0;
  color: var(--tinta-2);
  font-size: 15px;
  line-height: 1.5;
}

.convite {
  display: grid;
  width: 100%;
  max-width: 30rem;
  gap: 18px;
  margin: 8px auto 0;
  padding: 26px 26px 22px;
}

.convite__campo {
  display: grid;
  gap: 6px;
}

.convite__campo label {
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 550;
}

.convite__entrada.p-inputtext {
  width: 100%;
  min-height: 46px;
  font-family: var(--font-dados);
  font-size: 15.5px;
}

.convite__dica {
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

.convite__aceitar.p-button {
  width: 100%;
  min-height: 46px;
  font-size: 15px;
}

.convite__rodape {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0;
  padding: 12px 14px;
  border: 1px solid var(--linha-suave);
  border-radius: var(--raio-cartao-pequeno);
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.5;
}

.convite__rodape i {
  margin-top: 1px;
  color: var(--tinta-3);
  font-size: 17px;
}

@media (max-width: 520px) {
  .centro-cabeca {
    margin-top: 8px;
  }

  .centro-cabeca__titulo {
    font-size: 24px;
  }

  .convite {
    padding: 20px 16px;
  }
}
</style>
