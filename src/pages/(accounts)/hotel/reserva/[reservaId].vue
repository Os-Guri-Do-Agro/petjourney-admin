<script setup lang="ts">
/**
 * O detalhe de uma reserva do hotel: pela API (E7-02, PJ-28JU4U) ou, na demonstração, sobre os
 * dados locais.
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import ReservaDoHotel from '@/components/hotel/reservas/ReservaDoHotel.vue'
import { useModoDemonstracao } from '@/composables/useModoDemonstracao'
import ReservaDemonstracao from '@/features/hotel/components/reserva/ReservaDemonstracao.vue'

const { ativo: demonstracao } = useModoDemonstracao()
const route = useRoute()
const reservaId = computed(() => String(route.params.reservaId ?? ''))
</script>

<template>
  <ReservaDemonstracao v-if="demonstracao" />
  <ReservaDoHotel v-else :reserva-id="reservaId" />
</template>
