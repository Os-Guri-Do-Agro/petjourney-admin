<script setup lang="ts">
/**
 * A estadia de um animal: pela API (E7-04, PJ-GLOYC4) ou, na demonstração, sobre os dados locais.
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import HospedagemDoHotel from '@/components/hotel/estadia/HospedagemDoHotel.vue'
import { useModoDemonstracao } from '@/composables/useModoDemonstracao'
import HospedagemDemonstracao from '@/features/hotel/components/estadia/HospedagemDemonstracao.vue'

const { ativo: demonstracao } = useModoDemonstracao()
const route = useRoute()
const hospedagemId = computed(() => String(route.params.hospedagemId ?? ''))
</script>

<template>
  <HospedagemDemonstracao v-if="demonstracao" />
  <HospedagemDoHotel v-else :hospedagem-id="hospedagemId" />
</template>
