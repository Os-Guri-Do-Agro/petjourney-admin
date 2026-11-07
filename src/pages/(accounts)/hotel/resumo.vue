<script setup lang="ts">
/**
 * O resumo do hotel: pela API (E7-06, PJ-62YZHU) ou, na demonstração, sobre os dados locais.
 */
import ResumoDoHotel from '@/components/hotel/resumo/ResumoDoHotel.vue'
import { useModoDemonstracao } from '@/composables/useModoDemonstracao'
import ResumoDemonstracao from '@/features/hotel/components/resumo/ResumoDemonstracao.vue'

const { ativo: demonstracao } = useModoDemonstracao()
</script>

<template>
  <ResumoDemonstracao v-if="demonstracao" />
  <ResumoDoHotel v-else />
</template>
