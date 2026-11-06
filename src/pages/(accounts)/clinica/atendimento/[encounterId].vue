<script setup lang="ts">
/**
 * O atendimento (prontuário): pela API (E4-01, PJ-QQT1WN) e, no modo demonstração, sobre os dados
 * locais.
 */
import AtendimentoDaClinica from '@/components/atendimento/AtendimentoDaClinica.vue'
import { useModoDemonstracao } from '@/composables/useModoDemonstracao'
import AtendimentoDemonstracao from '@/features/clinico/components/prontuario/AtendimentoDemonstracao.vue'

const { ativo: demonstracao } = useModoDemonstracao()
</script>

<template>
  <AtendimentoDemonstracao v-if="demonstracao" />
  <AtendimentoDaClinica v-else />
</template>
