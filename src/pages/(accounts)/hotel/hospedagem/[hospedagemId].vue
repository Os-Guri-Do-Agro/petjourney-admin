<script setup lang="ts">
/** A estadia de um animal: pela API (E7-04, PJ-GLOYC4). */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import HospedagemDoHotel from '@/components/hotel/estadia/HospedagemDoHotel.vue'

const route = useRoute()
const hospedagemId = computed(() => String(route.params.hospedagemId ?? ''))
</script>

<template>
  <HospedagemDoHotel :hospedagem-id="hospedagemId" />
</template>
