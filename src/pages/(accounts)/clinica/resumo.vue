<script setup lang="ts">
/**
 * Resumo da clínica: pela rota `resumo` (E3-08, PJ-W2RB1D) e, no modo demonstração, com a conta
 * feita no navegador sobre os dados locais.
 */
import ResumoDaClinica from '@/components/resumo/ResumoDaClinica.vue'
import { useModoDemonstracao } from '@/composables/useModoDemonstracao'
import ResumoDemonstracao from '@/features/clinico/components/resumo/ResumoDemonstracao.vue'

const { ativo: demonstracao } = useModoDemonstracao()
</script>

<template>
  <ResumoDemonstracao v-if="demonstracao" />
  <ResumoDaClinica v-else />
</template>
