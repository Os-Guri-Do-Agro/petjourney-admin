<script setup lang="ts">
/**
 * Pacientes: a lista pela API (E2-01, PJ-ECWI3Z) e, no modo demonstração, a de sempre sobre os
 * dados locais. A da demonstração segue com as colunas de atendimento que a agenda e o prontuário
 * ainda não trazem da API.
 */
import PacientesLista from '@/components/cadastro/PacientesLista.vue'
import { useModoDemonstracao } from '@/composables/useModoDemonstracao'
import PacientesDemonstracao from '@/features/clinico/components/pacientes/PacientesDemonstracao.vue'

const { ativo: demonstracao } = useModoDemonstracao()
</script>

<template>
  <PacientesDemonstracao v-if="demonstracao" />
  <PacientesLista v-else />
</template>
