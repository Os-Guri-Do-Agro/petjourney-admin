<script setup lang="ts">
import Button from 'primevue/button'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import PartnerOperabilityBanner from '@/components/parceiro/PartnerOperabilityBanner.vue'
import PortalEquipeSection from '@/components/parceiro/sections/PortalEquipeSection.vue'
import UiPagina from '@/components/ui/UiPagina.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'

const { t } = useI18n()
const { store, bootstrapping, ensureContext } = useParceiroPortal()

const convidar = ref(false)

const loadError = computed(() =>
  store.loadState === 'error' && !store.semAcessoParceiro ? store.errorMessage : '',
)

onMounted(() => {
  void ensureContext()
})
</script>

<template>
  <UiPagina
    class="tela-equipe"
    :titulo="t('parceiro.equipe.titulo')"
    :resumo="t('parceiro.equipe.resumo')"
    :carregando="bootstrapping || (store.loadState === 'loading' && !store.dashboard)"
    :erro="loadError"
    :sem-acesso-de-parceiro="store.semAcessoParceiro"
    bloquear-se-suspenso
    @tentar-de-novo="ensureContext(true)"
  >
    <template v-if="store.isDono && store.podeOperar" #acoes>
      <Button
        type="button"
        icon="ph ph-user-plus"
        :label="t('parceiro.equipe.convidar')"
        @click="convidar = true"
      />
    </template>

    <div class="equipe-pagina">
      <PartnerOperabilityBanner />
      <PortalEquipeSection v-model:convidar="convidar" />
    </div>
  </UiPagina>
</template>

<style scoped>
.equipe-pagina {
  display: grid;
  gap: 20px;
}
</style>
