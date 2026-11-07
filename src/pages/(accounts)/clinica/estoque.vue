<script setup lang="ts">
/**
 * Estoque de vacinas: pela API (E6-01, PJ-RFFOKT) ou, na demonstração, a geladeira e as metas
 * sobre os dados locais.
 */
import EstoqueDaClinica from '@/components/estoque/EstoqueDaClinica.vue'
import { useModoDemonstracao } from '@/composables/useModoDemonstracao'
import EstoqueDemonstracao from '@/features/clinico/components/estoque/EstoqueDemonstracao.vue'

const { ativo: demonstracao } = useModoDemonstracao()
</script>

<template>
  <EstoqueDemonstracao v-if="demonstracao" />
  <EstoqueDaClinica v-else />
</template>
