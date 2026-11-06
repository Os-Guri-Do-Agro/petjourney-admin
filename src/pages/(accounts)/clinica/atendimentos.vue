<script setup lang="ts">
/**
 * Atendimentos: pela API (E4-01, PJ-QQT1WN) e, no modo demonstração, sobre os dados locais.
 */
import AtendimentosDaClinica from '@/components/atendimento/AtendimentosDaClinica.vue'
import { useModoDemonstracao } from '@/composables/useModoDemonstracao'
import AtendimentosDemonstracao from '@/features/clinico/components/atendimentos/AtendimentosDemonstracao.vue'

const { ativo: demonstracao } = useModoDemonstracao()
</script>

<template>
  <AtendimentosDemonstracao v-if="demonstracao" />
  <AtendimentosDaClinica v-else />
</template>
