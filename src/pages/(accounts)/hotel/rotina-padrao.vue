<script setup lang="ts">
/**
 * A rotina da casa (água, higiene, passeio e pesagem de todos os hóspedes): pela API (E7-05,
 * PJ-21T3ER) ou, na demonstração, sobre os dados locais.
 */
import RotinaDaCasa from '@/components/hotel/rotina/RotinaDaCasa.vue'
import { useModoDemonstracao } from '@/composables/useModoDemonstracao'
import RotinaPadraoDemonstracao from '@/features/hotel/components/rotina-padrao/RotinaPadraoDemonstracao.vue'

const { ativo: demonstracao } = useModoDemonstracao()
</script>

<template>
  <RotinaPadraoDemonstracao v-if="demonstracao" />
  <RotinaDaCasa v-else />
</template>
