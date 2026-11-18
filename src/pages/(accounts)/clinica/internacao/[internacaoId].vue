<script setup lang="ts">
/** Uma internação: pela API (E5-01, PJ-7G0NQI). */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import InternacaoDetalhe from '@/components/internacao/InternacaoDetalhe.vue'

const route = useRoute()
const internacaoId = computed(() => String(route.params.internacaoId ?? ''))
</script>

<template>
  <InternacaoDetalhe :internacao-id="internacaoId" />
</template>
