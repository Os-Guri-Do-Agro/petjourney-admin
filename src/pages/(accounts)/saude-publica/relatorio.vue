<script setup lang="ts">
/**
 * Saúde pública › Relatório de 90 dias (protótipo, Ofício 001/2026, item 7). A folha na tela e,
 * para imprimir ou salvar em PDF, uma cópia dela no `body` marcada `clinic-print-root`: a regra de
 * impressão do portal mostra só ela, sem a barra nem o cabeçalho.
 */
import Button from 'primevue/button'

import UiPagina from '@/components/ui/UiPagina.vue'
import AvisoDoPrototipo from '@/features/saude-publica/components/AvisoDoPrototipo.vue'
import RelatorioDe90Dias from '@/features/saude-publica/components/RelatorioDe90Dias.vue'

function imprimir() {
  window.print()
}
</script>

<template>
  <UiPagina
    titulo="Relatório de 90 dias"
    icone="ph ph-file-text"
    resumo="O que o ofício promete à Câmara em 90 dias, pronto para imprimir ou salvar em PDF."
  >
    <template #acoes>
      <Button type="button" icon="ph ph-printer" label="Imprimir ou salvar PDF" @click="imprimir" />
    </template>

    <div class="rl">
      <AvisoDoPrototipo />
      <RelatorioDe90Dias />
    </div>

    <Teleport to="body">
      <div class="clinic-print-root rl-impressao" aria-hidden="true">
        <RelatorioDe90Dias papel />
      </div>
    </Teleport>
  </UiPagina>
</template>

<style scoped>
.rl {
  display: grid;
  gap: 22px;
}

/* Na tela, a cópia do papel nunca aparece; na impressão, a regra do portal a mostra. */
.rl-impressao {
  display: none;
}
</style>
