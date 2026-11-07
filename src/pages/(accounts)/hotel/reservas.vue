<script setup lang="ts">
/**
 * As reservas do hotel: pela API (E7-02, PJ-28JU4U) ou, na demonstração, a lista, a véspera
 * travada e a espera sobre os dados locais.
 */
import ReservasDoHotel from '@/components/hotel/reservas/ReservasDoHotel.vue'
import { useModoDemonstracao } from '@/composables/useModoDemonstracao'
import ReservasDemonstracao from '@/features/hotel/components/reserva/ReservasDemonstracao.vue'

const { ativo: demonstracao } = useModoDemonstracao()
</script>

<template>
  <ReservasDemonstracao v-if="demonstracao" />
  <ReservasDoHotel v-else />
</template>
