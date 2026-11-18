<script setup lang="ts">
/**
 * Cadastrar paciente. Pela API, desde 17/11/2026, o cadastro é uma gaveta em passos na lista de
 * Pacientes: este endereço só leva até ela (`/clinica/pacientes?novo=1`), para os links e favoritos
 * de antes continuarem funcionando. No modo demonstração segue o formulário de sempre, sobre os
 * dados locais, com a prévia ao lado.
 */
import { useRouter } from 'vue-router'

import { useModoDemonstracao } from '@/composables/useModoDemonstracao'
import PacienteNovoDemonstracao from '@/features/clinico/components/pacientes/PacienteNovoDemonstracao.vue'

const router = useRouter()
const { ativo: demonstracao } = useModoDemonstracao()

if (!demonstracao.value) {
  void router.replace({ path: '/clinica/pacientes', query: { novo: '1' } })
}
</script>

<template>
  <PacienteNovoDemonstracao v-if="demonstracao" />
</template>
