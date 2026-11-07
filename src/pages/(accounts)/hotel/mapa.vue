<script setup lang="ts">
/**
 * O mapa do hotel: pela API (E7-02, PJ-28JU4U) ou, na demonstração, a grade de ocupação sobre os
 * dados locais.
 */
import MapaDoHotel from '@/components/hotel/reservas/MapaDoHotel.vue'
import { useModoDemonstracao } from '@/composables/useModoDemonstracao'
import MapaDemonstracao from '@/features/hotel/components/mapa/MapaDemonstracao.vue'

const { ativo: demonstracao } = useModoDemonstracao()
</script>

<template>
  <MapaDemonstracao v-if="demonstracao" />
  <MapaDoHotel v-else />
</template>
