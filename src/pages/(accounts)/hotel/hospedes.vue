<script setup lang="ts">
/**
 * Quem está na casa: pela API (E7-04, PJ-GLOYC4) ou, na demonstração, sobre os dados locais.
 */
import HospedesDoHotel from '@/components/hotel/estadia/HospedesDoHotel.vue'
import { useModoDemonstracao } from '@/composables/useModoDemonstracao'
import HospedesDemonstracao from '@/features/hotel/components/hospedes/HospedesDemonstracao.vue'

const { ativo: demonstracao } = useModoDemonstracao()
</script>

<template>
  <HospedesDemonstracao v-if="demonstracao" />
  <HospedesDoHotel v-else />
</template>
