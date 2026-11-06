<script setup lang="ts">
/**
 * Cópias do prontuário pela API (E4-06c, PJ-0EK0TY). Os pedidos só existem no servidor: na
 * demonstração, a tela volta para os pacientes.
 */
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

import CopiasDoProntuario from '@/components/copias/CopiasDoProntuario.vue'
import { useModoDemonstracao } from '@/composables/useModoDemonstracao'

const { ativo: demonstracao } = useModoDemonstracao()
const router = useRouter()

onMounted(() => {
  if (demonstracao.value) void router.replace('/clinica/pacientes')
})
</script>

<template>
  <CopiasDoProntuario v-if="!demonstracao" />
</template>
