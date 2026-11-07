<script setup lang="ts">
/**
 * A casa do hotel: pela API (E7-01, PJ-OG9YPX) ou, na demonstração, a planta e os cadastros sobre
 * os dados locais.
 */
import CasaDoHotel from '@/components/hotel/casa/CasaDoHotel.vue'
import { useModoDemonstracao } from '@/composables/useModoDemonstracao'
import AcomodacoesDemonstracao from '@/features/hotel/components/acomodacoes/AcomodacoesDemonstracao.vue'

const { ativo: demonstracao } = useModoDemonstracao()
</script>

<template>
  <AcomodacoesDemonstracao v-if="demonstracao" />
  <CasaDoHotel v-else />
</template>
