<script setup lang="ts">
/**
 * Fila de espera: pela API (E3-04, PJ-07YV9I) e, no modo demonstração, a de sempre sobre os dados
 * locais.
 */
import FilaDeEspera from '@/components/fila/FilaDeEspera.vue'
import { useModoDemonstracao } from '@/composables/useModoDemonstracao'
import FilaDemonstracao from '@/features/clinico/components/FilaDemonstracao.vue'

const { ativo: demonstracao } = useModoDemonstracao()
</script>

<template>
  <FilaDemonstracao v-if="demonstracao" />
  <FilaDeEspera v-else />
</template>
