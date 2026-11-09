<script setup lang="ts">
/**
 * A prancheta do hotel com o turno: pela API (E7-05, PJ-21T3ER) ou, na demonstração, sobre os dados
 * locais.
 */
import PranchetaDoHotel from '@/components/hotel/rotina/PranchetaDoHotel.vue'
import { useModoDemonstracao } from '@/composables/useModoDemonstracao'
import PranchetaDemonstracao from '@/features/hotel/components/rotina/PranchetaDemonstracao.vue'

const { ativo: demonstracao } = useModoDemonstracao()
</script>

<template>
  <PranchetaDemonstracao v-if="demonstracao" />
  <PranchetaDoHotel v-else />
</template>
