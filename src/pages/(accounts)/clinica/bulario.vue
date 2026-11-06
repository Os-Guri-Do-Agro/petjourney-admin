<script setup lang="ts">
/**
 * Bulário: pelos catálogos da API (E4-02, PJ-7JRYWN) e, no modo demonstração, sobre os dados
 * locais.
 */
import BularioDaClinica from '@/components/bulario/BularioDaClinica.vue'
import { useModoDemonstracao } from '@/composables/useModoDemonstracao'
import BularioDemonstracao from '@/features/clinico/components/bulario/BularioDemonstracao.vue'

const { ativo: demonstracao } = useModoDemonstracao()
</script>

<template>
  <BularioDemonstracao v-if="demonstracao" />
  <BularioDaClinica v-else />
</template>
