<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import PartnerOperabilityBanner from '@/components/parceiro/PartnerOperabilityBanner.vue'
import PortalEquipeSection from '@/components/parceiro/sections/PortalEquipeSection.vue'
import UiPagina from '@/components/ui/UiPagina.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'

const { t } = useI18n()
const { store, bootstrapping, ensureContext } = useParceiroPortal()

const loadError = computed(() =>
  store.loadState === 'error' && !store.semAcessoParceiro ? store.errorMessage : '',
)

onMounted(() => {
  void ensureContext()
})
</script>

<template>
  <!-- A Equipe está fora do menu (`EQUIPE_MENU_ENABLED`): sem destino no mapa, o título vem daqui. -->
  <UiPagina
    class="tela-equipe"
    :titulo="t('parceiro.equipe.titulo')"
    resumo="Gerencie quem pode operar a parceria. Apenas donos enviam convites e removem membros."
    :carregando="bootstrapping || (store.loadState === 'loading' && !store.dashboard)"
    :erro="loadError"
    :sem-acesso-de-parceiro="store.semAcessoParceiro"
    bloquear-se-suspenso
    @tentar-de-novo="ensureContext(true)"
  >
    <div class="equipe-pagina">
      <PartnerOperabilityBanner />
      <PortalEquipeSection />
    </div>
  </UiPagina>
</template>

<style scoped>
.equipe-pagina {
  display: grid;
  gap: 20px;
}
</style>
