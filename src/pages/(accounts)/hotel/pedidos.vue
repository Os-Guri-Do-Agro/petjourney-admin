<script setup lang="ts">
/**
 * Os pedidos de hospedagem: pela API (E7-03, PJ-6B946W, parte do portal) ou, na demonstração, a
 * caixa sobre os dados locais.
 */
import CaixaDoHotel from '@/components/hotel/pedidos/CaixaDoHotel.vue'
import { useModoDemonstracao } from '@/composables/useModoDemonstracao'
import PedidosDemonstracao from '@/features/hotel/components/pedidos/PedidosDemonstracao.vue'

const { ativo: demonstracao } = useModoDemonstracao()
</script>

<template>
  <PedidosDemonstracao v-if="demonstracao" />
  <CaixaDoHotel v-else />
</template>
