<script setup lang="ts">
/**
 * A fila de boletins da recepção pela API (E5-03, PJ-XW4PBB). Só pela API; na demonstração, a
 * tela volta para o mapa (lá os boletins são os dos dados locais).
 */
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

import BoletinsPendentes from '@/components/internacao/BoletinsPendentes.vue'
import { useModoDemonstracao } from '@/composables/useModoDemonstracao'

const { ativo: demonstracao } = useModoDemonstracao()
const router = useRouter()

onMounted(() => {
  if (demonstracao.value) void router.replace('/clinica/internacao')
})
</script>

<template>
  <BoletinsPendentes v-if="!demonstracao" />
</template>
