<script setup lang="ts">
/**
 * Pedidos de horário: a caixa pela API (E3-05, PJ-SVL85R) e, no modo demonstração, a de sempre
 * sobre os dados locais, com o celular do responsável ao lado.
 */
import CaixaDePedidos from '@/components/pedidos/CaixaDePedidos.vue'
import { useModoDemonstracao } from '@/composables/useModoDemonstracao'
import PedidosDemonstracao from '@/features/clinico/components/pedidos/PedidosDemonstracao.vue'

const { ativo: demonstracao } = useModoDemonstracao()
</script>

<template>
  <PedidosDemonstracao v-if="demonstracao" />
  <CaixaDePedidos v-else />
</template>
