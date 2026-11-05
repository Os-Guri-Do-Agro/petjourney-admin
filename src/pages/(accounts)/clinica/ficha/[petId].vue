<script setup lang="ts">
/**
 * A ficha do cadastro do paciente pela API (E2-01, PJ-ECWI3Z). A ficha da demonstração, com o
 * histórico, as vacinas e o tratamento, segue em `/clinica/paciente/:id/...` até o prontuário e as
 * vacinas virem da API (E4).
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import FichaDoPaciente from '@/components/cadastro/FichaDoPaciente.vue'

const route = useRoute()
const petId = computed(() => String((route.params as Record<string, unknown>).petId ?? ''))
</script>

<template>
  <FichaDoPaciente :paciente-id="petId" />
</template>
