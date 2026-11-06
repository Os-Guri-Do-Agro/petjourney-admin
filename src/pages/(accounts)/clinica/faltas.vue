<script setup lang="ts">
/**
 * Faltas da Clínica: pela API (E3-03, PJ-MVMNOZ) e, no modo demonstração, o painel de sempre sobre
 * os dados locais.
 */
import FaltasDaClinica from '@/components/faltas/FaltasDaClinica.vue'
import { useModoDemonstracao } from '@/composables/useModoDemonstracao'
import FaltasDemonstracao from '@/features/clinico/components/faltas/FaltasDemonstracao.vue'

const { ativo: demonstracao } = useModoDemonstracao()
</script>

<template>
  <FaltasDemonstracao v-if="demonstracao" />
  <FaltasDaClinica v-else />
</template>
