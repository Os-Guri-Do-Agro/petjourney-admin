<script setup lang="ts">
/**
 * Atividades: o que ficou para trás na clínica. Pela rota `atividades` (E3-08, PJ-W2RB1D) e, no
 * modo demonstração, sobre os dados locais.
 */
import AtividadesDaClinica from '@/components/atividades/AtividadesDaClinica.vue'
import { useModoDemonstracao } from '@/composables/useModoDemonstracao'
import AtividadesDemonstracao from '@/features/clinico/components/atividades/AtividadesDemonstracao.vue'

const { ativo: demonstracao } = useModoDemonstracao()
</script>

<template>
  <AtividadesDemonstracao v-if="demonstracao" />
  <AtividadesDaClinica v-else />
</template>
