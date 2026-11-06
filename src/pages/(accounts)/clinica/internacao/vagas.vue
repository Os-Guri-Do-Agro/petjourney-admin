<script setup lang="ts">
/**
 * As vagas da internação para a recepção (E5-01, guia e5 5): "tem vaga?" ao telefone, sem dado
 * de paciente. Só pela API; na demonstração, a tela volta para o mapa.
 */
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

import VagasDaInternacao from '@/components/internacao/VagasDaInternacao.vue'
import { useModoDemonstracao } from '@/composables/useModoDemonstracao'

const { ativo: demonstracao } = useModoDemonstracao()
const router = useRouter()

onMounted(() => {
  if (demonstracao.value) void router.replace('/clinica/internacao')
})
</script>

<template>
  <VagasDaInternacao v-if="!demonstracao" />
</template>
