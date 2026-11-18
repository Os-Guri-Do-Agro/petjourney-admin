<script setup lang="ts">
/** O detalhe de uma reserva do hotel: pela API (E7-02, PJ-28JU4U). */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import ReservaDoHotel from '@/components/hotel/reservas/ReservaDoHotel.vue'

const route = useRoute()
const reservaId = computed(() => String(route.params.reservaId ?? ''))
</script>

<template>
  <ReservaDoHotel :reserva-id="reservaId" />
</template>
