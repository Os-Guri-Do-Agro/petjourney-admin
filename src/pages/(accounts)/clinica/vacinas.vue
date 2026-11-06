<script setup lang="ts">
/**
 * Vacinas: a lista de chamada e as aplicadas pela API (E4-04, PJ-VQVQ0C) e, no modo demonstração,
 * sobre os dados locais.
 */
import VacinasDaClinica from '@/components/vacinas/VacinasDaClinica.vue'
import { useModoDemonstracao } from '@/composables/useModoDemonstracao'
import VacinasDemonstracao from '@/features/clinico/components/vacinas/VacinasDemonstracao.vue'

const { ativo: demonstracao } = useModoDemonstracao()
</script>

<template>
  <VacinasDemonstracao v-if="demonstracao" />
  <VacinasDaClinica v-else />
</template>
