<script setup lang="ts">
/**
 * Uma internação: pela API (E5-01, PJ-7G0NQI) ou, na demonstração, o plantão sobre os dados
 * locais.
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import InternacaoDetalhe from '@/components/internacao/InternacaoDetalhe.vue'
import { useModoDemonstracao } from '@/composables/useModoDemonstracao'
import InternacaoDetalheDemonstracao from '@/features/clinico/components/internacao/InternacaoDetalheDemonstracao.vue'

const { ativo: demonstracao } = useModoDemonstracao()
const route = useRoute()
const internacaoId = computed(() => String(route.params.internacaoId ?? ''))
</script>

<template>
  <InternacaoDetalheDemonstracao v-if="demonstracao" />
  <InternacaoDetalhe v-else :internacao-id="internacaoId" />
</template>
