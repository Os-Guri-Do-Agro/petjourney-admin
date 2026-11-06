<script setup lang="ts">
/**
 * Retornos pendentes pela API (E4-01, PJ-QQT1WN). Na demonstração, os retornos vencidos moram nas
 * Atividades, sobre os dados locais.
 */
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

import RetornosPendentes from '@/components/atendimento/RetornosPendentes.vue'
import { useModoDemonstracao } from '@/composables/useModoDemonstracao'

const { ativo: demonstracao } = useModoDemonstracao()
const router = useRouter()

onMounted(() => {
  if (demonstracao.value) void router.replace('/clinica/atividades')
})
</script>

<template>
  <RetornosPendentes v-if="!demonstracao" />
</template>
