<script setup lang="ts">
/** A ficha do animal da ONG (PJ-TJ07TW, guia 2.3): em cuidado, entregue ou encerrada. */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import FichaDoAnimal from '@/components/ong/FichaDoAnimal.vue'

const route = useRoute()
const animalId = computed(() => String((route.params as Record<string, unknown>).animalId ?? ''))
</script>

<template>
  <FichaDoAnimal :animal-id="animalId" />
</template>
