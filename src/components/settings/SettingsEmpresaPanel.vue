<script setup lang="ts">
/**
 * Configurações → Empresa: o credenciamento e os dados da empresa parceira.
 *
 * O conteúdo é o funil do Portal (`PortalParceiroFunilSection`, de quem cuida do Portal): ele já
 * desenha as próprias folhas — cadastro, em análise, aprovada, recusada, suspensa. Aqui só o erro
 * de carregar o contexto, com o "Tentar de novo".
 */
import Button from 'primevue/button'
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import PortalParceiroFunilSection from '@/components/parceiro/PortalParceiroFunilSection.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'

import './configuracoes.css'

const { t } = useI18n()
const { store, ensureContext } = useParceiroPortal()

onMounted(() => {
  void ensureContext()
})
</script>

<template>
  <div class="empresa-panel">
    <div
      v-if="store.loadState === 'error' && !store.semAcessoParceiro"
      class="ui-folha cfg-folha cfg-estado"
      role="alert"
    >
      <span class="cfg-estado__icone" aria-hidden="true"><i class="ph ph-warning-circle" /></span>
      <h2>{{ t('frame.error.title') }}</h2>
      <p>{{ store.errorMessage }}</p>
      <Button
        icon="ph ph-arrow-clockwise"
        :label="t('common.retry')"
        severity="secondary"
        outlined
        @click="ensureContext(true)"
      />
    </div>

    <PortalParceiroFunilSection v-else />
  </div>
</template>

<style scoped>
.empresa-panel {
  display: grid;
  gap: 16px;
  width: 100%;
}
</style>
