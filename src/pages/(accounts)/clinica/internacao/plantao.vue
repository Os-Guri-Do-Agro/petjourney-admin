<script setup lang="ts">
/**
 * O checklist do plantão inteiro pela API (E5-02, PJ-2HGJUX). Na demonstração, a tela volta para
 * o mapa (lá a passagem e o checklist são os dos dados locais).
 */
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

import ChecklistDoPlantao from '@/components/internacao/ChecklistDoPlantao.vue'
import { useModoDemonstracao } from '@/composables/useModoDemonstracao'

const { ativo: demonstracao } = useModoDemonstracao()
const router = useRouter()

onMounted(() => {
  if (demonstracao.value) void router.replace('/clinica/internacao')
})
</script>

<template>
  <ChecklistDoPlantao v-if="!demonstracao" />
</template>
