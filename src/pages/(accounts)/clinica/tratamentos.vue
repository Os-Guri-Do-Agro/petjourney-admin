<script setup lang="ts">
/**
 * Tratamentos em casa: pela API (E4-05b, PJ-LU09N7) e, no modo demonstração, sobre os dados
 * locais.
 */
import TratamentosDaClinica from '@/components/tratamentos/TratamentosDaClinica.vue'
import { useModoDemonstracao } from '@/composables/useModoDemonstracao'
import TratamentosDemonstracao from '@/features/clinico/components/tratamento/TratamentosDemonstracao.vue'

const { ativo: demonstracao } = useModoDemonstracao()
</script>

<template>
  <TratamentosDemonstracao v-if="demonstracao" />
  <TratamentosDaClinica v-else />
</template>
