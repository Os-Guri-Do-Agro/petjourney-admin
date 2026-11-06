<script setup lang="ts">
/**
 * Trazer pacientes de outro sistema: o migrador pela API (E2-05, PJ-NSCETD) e, no modo
 * demonstração, o de sempre sobre os dados locais (o plano roda no navegador).
 */
import ImportacaoDaBase from '@/components/importacao/ImportacaoDaBase.vue'
import { useModoDemonstracao } from '@/composables/useModoDemonstracao'
import MigracaoDemonstracao from '@/features/clinico/components/migracao/MigracaoDemonstracao.vue'

const { ativo: demonstracao } = useModoDemonstracao()
</script>

<template>
  <MigracaoDemonstracao v-if="demonstracao" />
  <ImportacaoDaBase v-else />
</template>
