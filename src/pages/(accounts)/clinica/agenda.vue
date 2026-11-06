<script setup lang="ts">
/**
 * Agenda da Clínica: pela API (E3-02, PJ-4BS8TK) e, no modo demonstração, a de sempre sobre os
 * dados locais (com o conflito calculado no navegador).
 */
import AgendaDaClinica from '@/components/agendamentos/AgendaDaClinica.vue'
import { useModoDemonstracao } from '@/composables/useModoDemonstracao'
import AgendaDemonstracao from '@/features/clinico/components/agenda/AgendaDemonstracao.vue'

const { ativo: demonstracao } = useModoDemonstracao()
</script>

<template>
  <AgendaDemonstracao v-if="demonstracao" />
  <AgendaDaClinica v-else />
</template>
