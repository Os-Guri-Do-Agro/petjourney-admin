<script setup lang="ts">
/**
 * Cadastrar paciente: pela API (E2-01, PJ-ECWI3Z) e, no modo demonstração, o formulário de sempre
 * sobre os dados locais, com a prévia ao lado.
 */
import PacienteNovo from '@/components/cadastro/PacienteNovo.vue'
import { useModoDemonstracao } from '@/composables/useModoDemonstracao'
import PacienteNovoDemonstracao from '@/features/clinico/components/pacientes/PacienteNovoDemonstracao.vue'

const { ativo: demonstracao } = useModoDemonstracao()
</script>

<template>
  <PacienteNovoDemonstracao v-if="demonstracao" />
  <PacienteNovo v-else />
</template>
