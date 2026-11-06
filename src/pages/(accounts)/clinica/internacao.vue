<script setup lang="ts">
/**
 * Internação: o mapa da ala pela API (E5-01, PJ-7G0NQI). A demonstração segue com o plantão sobre
 * os dados locais (prescrições, checklist, passagem e boletins, que entram com a E5-02 e a E5-03).
 */
import InternacaoDaClinica from '@/components/internacao/InternacaoDaClinica.vue'
import { useModoDemonstracao } from '@/composables/useModoDemonstracao'
import InternacaoDemonstracao from '@/features/clinico/components/internacao/InternacaoDemonstracao.vue'

const { ativo: demonstracao } = useModoDemonstracao()
</script>

<template>
  <InternacaoDemonstracao v-if="demonstracao" />
  <InternacaoDaClinica v-else />
</template>
